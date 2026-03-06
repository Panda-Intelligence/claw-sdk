import type { AdapterRequest, RuntimeAdapter, StreamEventFrame } from "./adapters/runtime-adapter"
import { AdapterCapabilityError, ClawError } from "./errors"
import { OpenClawRpcClient } from "./transports/openclaw-rpc"
import type { AgentInfo, Message, Model, RunOptions, SendOptions, ToolOptions } from "./types"

export class Agent {
  readonly name: string
  readonly model: Model
  readonly createdAt: Date

  private readonly _gatewayUrl: string
  private readonly _token: string
  private readonly _fetchImpl: typeof fetch
  private readonly _runtimeAdapter: RuntimeAdapter
  private readonly _baseSessionKey: string
  private _sessionVersion = 1
  private _openClawRpcClient: OpenClawRpcClient | null = null
  private _messages: Message[] = []

  constructor(opts: {
    name: string
    model: Model
    systemPrompt?: string
    gatewayUrl: string
    token: string
    fetchImpl: typeof fetch
    runtimeAdapter: RuntimeAdapter
  }) {
    this.name = opts.name
    this.model = opts.model
    this.createdAt = new Date()
    this._gatewayUrl = opts.gatewayUrl
    this._token = opts.token
    this._fetchImpl = opts.fetchImpl
    this._runtimeAdapter = opts.runtimeAdapter
    this._baseSessionKey = `sdk:${this.name}`

    if (opts.systemPrompt) {
      this._messages.push({ role: "system", content: opts.systemPrompt })
    }
  }

  async send(content: string, opts: SendOptions = {}): Promise<string> {
    this._messages.push({ role: "user", content })

    try {
      if (opts.stream) {
        if (!opts.onChunk) {
          throw new ClawError("`onChunk` callback is required when `stream` is true")
        }
        return await this._sendStream(opts.onChunk, opts.signal)
      }

      return await this._sendSync(opts.signal)
    } catch (error) {
      this._messages.pop()
      throw error
    }
  }

  async run(prompt: string, opts: RunOptions = {}): Promise<string> {
    const request = this._runtimeAdapter.buildChatRequest({
      token: this._token,
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
    })
    const response = await this._requestJson<unknown>(request, opts.signal)
    return this._runtimeAdapter.parseChatResponse(response)
  }

  async use(
    toolId: string,
    params: Record<string, unknown> = {},
    opts: ToolOptions = {}
  ): Promise<unknown> {
    if (!this._runtimeAdapter.supportsToolInvocation || !this._runtimeAdapter.buildToolRequest) {
      throw new AdapterCapabilityError(this._runtimeAdapter.id, "tool-invocation")
    }

    const request = this._runtimeAdapter.buildToolRequest({
      token: this._token,
      toolId,
      params,
    })
    return this._requestJson<unknown>(request, opts.signal)
  }

  reset(keepSystemPrompt = true): this {
    if (keepSystemPrompt) {
      this._messages = this._messages.filter((item) => item.role === "system")
    } else {
      this._messages = []
    }
    this._sessionVersion += 1
    return this
  }

  get history(): readonly Message[] {
    return [...this._messages]
  }

  get info(): AgentInfo {
    return {
      name: this.name,
      model: this.model,
      messageCount: this._messages.filter((item) => item.role !== "system").length,
      createdAt: this.createdAt,
    }
  }

  private async _sendSync(signal?: AbortSignal): Promise<string> {
    const reply = await this._sendSyncWithFallback(signal)
    this._messages.push({ role: "assistant", content: reply })
    return reply
  }

  private async _sendStream(
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const fullText = await this._sendStreamWithFallback(onChunk, signal)
    this._messages.push({ role: "assistant", content: fullText })
    return fullText
  }

  private async _sendSyncWithFallback(signal?: AbortSignal): Promise<string> {
    const request = this._runtimeAdapter.buildChatRequest({
      token: this._token,
      model: this.model,
      messages: [...this._messages],
      stream: false,
    })

    try {
      const response = await this._requestJson<unknown>(request, signal)
      return this._runtimeAdapter.parseChatResponse(response)
    } catch (error) {
      if (!this._shouldUseOpenClawRpcFallback(error)) {
        throw error
      }

      const latestUserMessage = this._messages[this._messages.length - 1]?.content ?? ""
      return this._sendViaOpenClawRpc(latestUserMessage, signal)
    }
  }

  private async _sendStreamWithFallback(
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const request = this._runtimeAdapter.buildChatRequest({
      token: this._token,
      model: this.model,
      messages: [...this._messages],
      stream: true,
    })

    try {
      const response = await this._requestRaw(request, signal)

      if (!response.ok) {
        const body = await this._readResponseText(response)
        throw new ClawError("Stream request failed", response.status, body)
      }

      if (!response.body) {
        throw new ClawError("Stream response body is empty", response.status)
      }

      let fullText = ""
      let streamDone = false
      const reader = response.body.getReader()
      await this._consumeSSE(reader, (frame) => {
        if (streamDone) {
          return
        }

        const parsed = this._runtimeAdapter.parseStreamEvent(frame)
        if (parsed.done) {
          streamDone = true
          return
        }

        if (parsed.chunk) {
          fullText += parsed.chunk
          onChunk(parsed.chunk)
        }
      })

      return fullText
    } catch (error) {
      if (!this._shouldUseOpenClawRpcFallback(error)) {
        throw error
      }

      const latestUserMessage = this._messages[this._messages.length - 1]?.content ?? ""
      return this._sendViaOpenClawRpc(latestUserMessage, signal, onChunk)
    }
  }

  private async _sendViaOpenClawRpc(
    message: string,
    signal?: AbortSignal,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const client = this._getOpenClawRpcClient()
    const payload: Parameters<OpenClawRpcClient["chatSend"]>[0] = {
      sessionKey: this._sessionKey,
      message,
    }
    if (signal) {
      payload.signal = signal
    }
    if (onChunk) {
      payload.onChunk = onChunk
    }
    return client.chatSend(payload)
  }

  private _getOpenClawRpcClient(): OpenClawRpcClient {
    if (!this._openClawRpcClient) {
      this._openClawRpcClient = new OpenClawRpcClient(this._gatewayUrl, this._token)
    }
    return this._openClawRpcClient
  }

  private get _sessionKey(): string {
    return `${this._baseSessionKey}:${this._sessionVersion}`
  }

  private _shouldUseOpenClawRpcFallback(error: unknown): boolean {
    if (this._runtimeAdapter.id !== "openclaw") {
      return false
    }
    if (!(error instanceof ClawError)) {
      return false
    }
    return error.statusCode === 404
  }

  private async _consumeSSE(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onFrame: (frame: StreamEventFrame) => void
  ): Promise<void> {
    const decoder = new TextDecoder()
    let pending = ""
    let currentEvent: string | undefined
    let dataLines: string[] = []

    const flushFrame = () => {
      if (dataLines.length === 0) {
        currentEvent = undefined
        return
      }
      const frame: StreamEventFrame = {
        data: dataLines.join("\n"),
      }
      if (currentEvent !== undefined) {
        frame.event = currentEvent
      }
      onFrame(frame)
      currentEvent = undefined
      dataLines = []
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      pending += decoder.decode(value, { stream: true })
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ""

      for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        if (line.length === 0) {
          flushFrame()
          continue
        }

        if (line.startsWith(":")) {
          continue
        }

        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim()
          continue
        }

        if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart())
        }
      }
    }

    const flushed = decoder.decode()
    if (flushed) {
      pending += flushed
    }
    if (pending.trim().length > 0) {
      const finalLine = pending.trimEnd()
      if (finalLine.startsWith("event:")) {
        currentEvent = finalLine.slice(6).trim()
      } else if (finalLine.startsWith("data:")) {
        dataLines.push(finalLine.slice(5).trimStart())
      }
    }
    flushFrame()
  }

  private async _requestRaw(request: AdapterRequest, signal?: AbortSignal): Promise<Response> {
    const url = `${this._gatewayUrl}${request.path}`

    try {
      const init = this._buildRequestInit(request, signal)
      return await this._fetchImpl(url, init)
    } catch (err) {
      throw new ClawError(`Network error: ${url}`, undefined, String(err))
    }
  }

  private async _requestJson<T>(request: AdapterRequest, signal?: AbortSignal): Promise<T> {
    const response = await this._requestRaw(request, signal)
    if (!response.ok) {
      throw new ClawError("Gateway error", response.status, await this._readResponseText(response))
    }
    return (await response.json()) as T
  }

  private _buildRequestInit(request: AdapterRequest, signal?: AbortSignal): RequestInit {
    const init: RequestInit = {
      method: request.method ?? "POST",
    }

    const headers: Record<string, string> = { ...(request.headers ?? {}) }
    if (request.body !== undefined) {
      const hasContentType = Object.keys(headers).some(
        (key) => key.toLowerCase() === "content-type"
      )
      if (!hasContentType) {
        headers["Content-Type"] = "application/json"
      }
      init.body = JSON.stringify(request.body)
    }
    if (Object.keys(headers).length > 0) {
      init.headers = headers
    }
    if (signal) {
      init.signal = signal
    }

    return init
  }

  private async _readResponseText(response: Response): Promise<string> {
    try {
      return await response.text()
    } catch {
      return ""
    }
  }
}
