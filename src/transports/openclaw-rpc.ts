import { ClawError } from "../errors"

interface OpenClawRpcEvent {
  event: string
  payload?: unknown
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toWsUrl(gatewayUrl: string): string {
  const normalized = gatewayUrl.trim().replace(/\/+$/, "")
  if (normalized.startsWith("ws://") || normalized.startsWith("wss://")) {
    return normalized
  }
  if (normalized.startsWith("http://")) {
    return `ws://${normalized.slice("http://".length)}`
  }
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}`
  }
  return normalized
}

function toHttpOrigin(url: string): string | null {
  const normalized = url.trim().replace(/\/+$/, "")
  if (!normalized) {
    return null
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized
  }
  if (normalized.startsWith("ws://")) {
    return `http://${normalized.slice("ws://".length)}`
  }
  if (normalized.startsWith("wss://")) {
    return `https://${normalized.slice("wss://".length)}`
  }
  return null
}

function extractMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return ""
  }

  const payload = message as {
    text?: unknown
    content?: unknown
  }
  if (typeof payload.text === "string") {
    return payload.text
  }
  if (typeof payload.content === "string") {
    return payload.content
  }
  if (!Array.isArray(payload.content)) {
    return ""
  }

  return payload.content
    .filter((item) => {
      return typeof item === "object" && item !== null
    })
    .map((item) => {
      const block = item as { type?: unknown; text?: unknown }
      if (block.type === "text" && typeof block.text === "string") {
        return block.text
      }
      return ""
    })
    .join("")
}

export class OpenClawRpcClient {
  private readonly _wsUrl: string
  private readonly _token: string
  private readonly _originHeader: string | null
  private _ws: WebSocket | null = null
  private _pending = new Map<string, PendingRequest>()
  private _eventListeners = new Set<(event: OpenClawRpcEvent) => void>()
  private _connectPromise: Promise<void> | null = null
  private _connectResolver: (() => void) | null = null
  private _connectRejecter: ((error: unknown) => void) | null = null
  private _connectSent = false
  private _connectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(gatewayUrl: string, token: string) {
    this._wsUrl = toWsUrl(gatewayUrl)
    this._token = token
    this._originHeader = toHttpOrigin(gatewayUrl)
  }

  async chatSend(input: {
    sessionKey: string
    message: string
    signal?: AbortSignal
    timeoutMs?: number
    onChunk?: (chunk: string) => void
  }): Promise<string> {
    await this.connect()

    const timeoutMs = input.timeoutMs ?? 120_000
    const runId = randomId()
    let fullText = ""

    const done = new Promise<string>((resolve, reject) => {
      const cleanup = this.onEvent((event) => {
        if (event.event !== "chat") {
          return
        }

        const payload = event.payload as
          | {
              sessionKey?: string
              runId?: string
              state?: string
              message?: unknown
              errorMessage?: string
            }
          | undefined

        if (!payload) {
          return
        }

        if (payload.runId) {
          if (payload.runId !== runId) {
            return
          }
        } else if (payload.sessionKey && payload.sessionKey !== input.sessionKey) {
          return
        }

        const text = extractMessageText(payload.message)
        if (payload.state === "delta" && text) {
          if (text.startsWith(fullText)) {
            const chunk = text.slice(fullText.length)
            if (chunk) {
              fullText = text
              input.onChunk?.(chunk)
            }
          } else {
            fullText += text
            input.onChunk?.(text)
          }
          return
        }

        if (payload.state === "error") {
          cleanup()
          reject(new ClawError("OpenClaw RPC chat error", undefined, payload.errorMessage))
          return
        }

        if (payload.state === "final" || payload.state === "aborted") {
          if (text) {
            if (text.startsWith(fullText)) {
              const chunk = text.slice(fullText.length)
              if (chunk) {
                fullText = text
                input.onChunk?.(chunk)
              }
            } else {
              fullText = text
            }
          }
          cleanup()
          resolve(fullText)
        }
      })

      const timer = setTimeout(() => {
        cleanup()
        reject(new ClawError("OpenClaw RPC chat timeout"))
      }, timeoutMs)

      const clear = () => clearTimeout(timer)
      const cleanupWithTimer = () => {
        clear()
        cleanup()
      }

      const originalResolve = resolve
      const originalReject = reject
      resolve = (value) => {
        cleanupWithTimer()
        originalResolve(value)
      }
      reject = (error) => {
        cleanupWithTimer()
        originalReject(error)
      }
    })

    const abortPromise = new Promise<never>((_, reject) => {
      if (!input.signal) {
        return
      }
      if (input.signal.aborted) {
        reject(new ClawError("OpenClaw RPC chat aborted"))
        return
      }
      const onAbort = () => {
        input.signal?.removeEventListener("abort", onAbort)
        reject(new ClawError("OpenClaw RPC chat aborted"))
      }
      input.signal.addEventListener("abort", onAbort)
    })

    await this.request("chat.send", {
      sessionKey: input.sessionKey,
      message: input.message,
      deliver: false,
      idempotencyKey: runId,
    })

    return Promise.race([done, abortPromise])
  }

  async connect(): Promise<void> {
    if (this._ws && this._ws.readyState === WebSocket.OPEN && this._connectSent) {
      return
    }
    if (this._connectPromise) {
      return this._connectPromise
    }

    this._connectPromise = new Promise<void>((resolve, reject) => {
      this._connectResolver = resolve
      this._connectRejecter = reject
    })

    try {
      if (this._originHeader) {
        this._ws = this._createWebSocketWithHeaders(this._wsUrl, {
          Origin: this._originHeader,
        })
      } else {
        this._ws = new WebSocket(this._wsUrl)
      }
    } catch (error) {
      this._resetConnectionState()
      throw new ClawError(
        `OpenClaw WebSocket init failed: ${this._wsUrl}`,
        undefined,
        String(error)
      )
    }

    this._ws.addEventListener("open", () => {
      this._connectSent = false
      if (this._connectTimer) {
        clearTimeout(this._connectTimer)
      }
      this._connectTimer = setTimeout(() => {
        this._sendConnect().catch((error) => {
          this._rejectConnect(error)
        })
      }, 750)
    })

    this._ws.addEventListener("message", (event) => {
      this._handleMessage(String(event.data ?? ""))
    })

    this._ws.addEventListener("close", (event) => {
      const reason = typeof event.reason === "string" ? event.reason : "closed"
      const error = new ClawError(`OpenClaw WebSocket closed (${event.code}): ${reason}`)
      this._flushPending(error)
      this._rejectConnect(error)
      this._resetConnectionState()
    })

    this._ws.addEventListener("error", () => {
      if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
        this._rejectConnect(new ClawError(`OpenClaw WebSocket error: ${this._wsUrl}`))
      }
    })

    return this._connectPromise
  }

  async request(method: string, params: unknown): Promise<unknown> {
    await this.connect()
    return this._requestOverSocket(method, params)
  }

  onEvent(listener: (event: OpenClawRpcEvent) => void): () => void {
    this._eventListeners.add(listener)
    return () => {
      this._eventListeners.delete(listener)
    }
  }

  private async _sendConnect(): Promise<void> {
    if (this._connectSent) {
      return
    }
    this._connectSent = true

    if (this._connectTimer) {
      clearTimeout(this._connectTimer)
      this._connectTimer = null
    }

    const payload = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "gateway-client",
        version: "0.1.0",
        platform: "node",
        mode: "webchat",
        instanceId: randomId(),
      },
      role: "operator",
      scopes: ["operator.admin", "operator.approvals", "operator.pairing"],
      caps: [],
      auth: {
        token: this._token,
      },
    }

    await this._requestOverSocket("connect", payload)
    this._resolveConnect()
  }

  private _handleMessage(raw: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }

    const message = parsed as {
      type?: string
      id?: string
      ok?: boolean
      payload?: unknown
      error?: { message?: string; details?: unknown }
      event?: string
    }

    if (message.type === "event") {
      if (message.event === "connect.challenge") {
        this._sendConnect().catch((error) => {
          this._rejectConnect(error)
        })
        return
      }

      for (const listener of this._eventListeners) {
        listener({
          event: message.event ?? "unknown",
          payload: message.payload,
        })
      }
      return
    }

    if (message.type === "res" && message.id) {
      const pending = this._pending.get(message.id)
      if (!pending) {
        return
      }
      this._pending.delete(message.id)
      if (message.ok) {
        pending.resolve(message.payload)
        return
      }
      pending.reject(
        new ClawError(
          message.error?.message ?? "OpenClaw request failed",
          undefined,
          JSON.stringify(message.error?.details ?? null)
        )
      )
    }
  }

  private _requestOverSocket(method: string, params: unknown): Promise<unknown> {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new ClawError("OpenClaw WebSocket is not connected"))
    }

    const id = randomId()
    const request = {
      type: "req",
      id,
      method,
      params,
    }

    const promise = new Promise<unknown>((resolve, reject) => {
      this._pending.set(id, { resolve, reject })
    })
    this._ws.send(JSON.stringify(request))
    return promise
  }

  private _createWebSocketWithHeaders(url: string, headers: Record<string, string>): WebSocket {
    const WebSocketCtor = WebSocket as unknown as {
      new (
        url: string,
        protocols?: string | string[] | { headers?: Record<string, string> }
      ): WebSocket
    }
    return new WebSocketCtor(url, { headers })
  }

  private _resolveConnect(): void {
    this._connectResolver?.()
    this._connectResolver = null
    this._connectRejecter = null
  }

  private _rejectConnect(error: unknown): void {
    this._connectRejecter?.(error)
    this._connectResolver = null
    this._connectRejecter = null
  }

  private _flushPending(error: unknown): void {
    for (const [, pending] of this._pending) {
      pending.reject(error)
    }
    this._pending.clear()
  }

  private _resetConnectionState(): void {
    if (this._connectTimer) {
      clearTimeout(this._connectTimer)
      this._connectTimer = null
    }
    this._connectPromise = null
    this._ws = null
    this._connectSent = false
  }
}
