import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OpenClawRpcClient } from "../../src/transports/openclaw-rpc"

type RpcRequest = {
  type: "req"
  id: string
  method: string
  params: Record<string, unknown>
}

class MockWebSocket extends EventTarget {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []
  static challengeNonce: string | null = null

  readonly url: string
  readyState = MockWebSocket.CONNECTING
  sentMessages: RpcRequest[] = []

  constructor(url: string | URL) {
    super()
    this.url = String(url)
    MockWebSocket.instances.push(this)

    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN
      this.dispatchEvent(new Event("open"))

      if (MockWebSocket.challengeNonce) {
        this.emitEvent({
          type: "event",
          event: "connect.challenge",
          payload: { nonce: MockWebSocket.challengeNonce },
        })
      }
    })
  }

  send(data: string): void {
    const request = JSON.parse(data) as RpcRequest
    this.sentMessages.push(request)

    if (request.method === "connect") {
      this.emitEvent({
        type: "res",
        id: request.id,
        ok: true,
        payload: { protocol: 3 },
      })
      return
    }

    if (request.method === "chat.send") {
      const sessionKey = String(request.params.sessionKey ?? "")
      const runId = String(request.params.idempotencyKey ?? "")

      this.emitEvent({
        type: "res",
        id: request.id,
        ok: true,
        payload: { accepted: true },
      })
      this.emitEvent({
        type: "event",
        event: "chat",
        payload: {
          sessionKey,
          runId,
          state: "delta",
          message: { text: "Hello " },
        },
      })
      this.emitEvent({
        type: "event",
        event: "chat",
        payload: {
          sessionKey,
          runId,
          state: "delta",
          message: { text: "Hello OpenClaw" },
        },
      })
      this.emitEvent({
        type: "event",
        event: "chat",
        payload: {
          sessionKey,
          runId,
          state: "final",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello OpenClaw" }],
          },
        },
      })
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = MockWebSocket.CLOSED
    this.dispatchEvent(
      new CloseEvent("close", {
        code: code ?? 1000,
        reason: reason ?? "closed",
      })
    )
  }

  private emitEvent(payload: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify(payload),
      })
    )
  }
}

describe("OpenClawRpcClient", () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    MockWebSocket.instances = []
    MockWebSocket.challengeNonce = null
    globalThis.WebSocket = MockWebSocket as any
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    vi.useRealTimers()
  })

  it("converts http URL to ws and completes chat send flow", async () => {
    const client = new OpenClawRpcClient("http://localhost:18789", "token")
    const chunks: string[] = []

    const result = await client.chatSend({
      sessionKey: "sdk:test:1",
      message: "hello",
      onChunk: (chunk) => chunks.push(chunk),
    })

    expect(result).toBe("Hello OpenClaw")
    expect(chunks).toEqual(["Hello ", "OpenClaw"])
    expect(MockWebSocket.instances[0]?.url).toBe("ws://localhost:18789")

    const sentMethods = MockWebSocket.instances[0]?.sentMessages.map((item) => item.method) ?? []
    expect(sentMethods).toContain("connect")
    expect(sentMethods).toContain("chat.send")
  })

  it("handles connect challenge without adding unsupported nonce field", async () => {
    MockWebSocket.challengeNonce = "nonce-123"

    const client = new OpenClawRpcClient("ws://localhost:18789", "token")
    await client.connect()

    const connectRequest = MockWebSocket.instances[0]?.sentMessages.find(
      (item) => item.method === "connect"
    )
    expect(connectRequest).toBeDefined()
    expect("nonce" in (connectRequest?.params ?? {})).toBe(false)
  })
})
