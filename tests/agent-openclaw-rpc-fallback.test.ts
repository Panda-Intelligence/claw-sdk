import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Claw } from "../src/claw"
import { createMockGateway } from "./fixtures/mock-gateway"

type RpcRequest = {
  type: "req"
  id: string
  method: string
  params: Record<string, unknown>
}

class AgentFallbackWebSocket extends EventTarget {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = AgentFallbackWebSocket.CONNECTING

  constructor(_url: string | URL) {
    super()
    queueMicrotask(() => {
      this.readyState = AgentFallbackWebSocket.OPEN
      this.dispatchEvent(new Event("open"))
    })
  }

  send(data: string): void {
    const request = JSON.parse(data) as RpcRequest

    if (request.method === "connect") {
      this.emit({
        type: "res",
        id: request.id,
        ok: true,
        payload: { protocol: 3 },
      })
      return
    }

    if (request.method === "chat.send") {
      const runId = String(request.params.idempotencyKey ?? "")
      const sessionKey = String(request.params.sessionKey ?? "")

      this.emit({
        type: "res",
        id: request.id,
        ok: true,
        payload: { accepted: true },
      })
      this.emit({
        type: "event",
        event: "chat",
        payload: {
          runId,
          sessionKey,
          state: "delta",
          message: { text: "Fallback " },
        },
      })
      this.emit({
        type: "event",
        event: "chat",
        payload: {
          runId,
          sessionKey,
          state: "delta",
          message: { text: "Fallback works" },
        },
      })
      this.emit({
        type: "event",
        event: "chat",
        payload: {
          runId,
          sessionKey,
          state: "final",
          message: { text: "Fallback works" },
        },
      })
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = AgentFallbackWebSocket.CLOSED
    this.dispatchEvent(new CloseEvent("close", { code: code ?? 1000, reason: reason ?? "closed" }))
  }

  private emit(payload: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(payload) }))
  }
}

describe("Agent OpenClaw RPC fallback", () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    globalThis.WebSocket = AgentFallbackWebSocket as any
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
  })

  it("falls back to OpenClaw RPC when chat completion endpoint returns 404", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        status: 404,
        text: "Not Found",
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      runtime: "openclaw",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    const reply = await agent.send("test fallback")

    expect(reply).toBe("Fallback works")
    expect(agent.history.at(-1)).toEqual({ role: "assistant", content: "Fallback works" })
    expect(gateway.calls).toHaveLength(1)
  })

  it("streams through OpenClaw RPC fallback when HTTP stream endpoint returns 404", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        status: 404,
        text: "Not Found",
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      runtime: "openclaw",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")
    const chunks: string[] = []

    const reply = await agent.send("test stream fallback", {
      stream: true,
      onChunk: (chunk) => chunks.push(chunk),
    })

    expect(reply).toBe("Fallback works")
    expect(chunks).toEqual(["Fallback ", "works"])
    expect(gateway.calls).toHaveLength(1)
  })
})
