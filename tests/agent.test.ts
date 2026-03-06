import { describe, expect, it } from "vitest"
import { Claw } from "../src/claw"
import { ClawError } from "../src/errors"
import { createMockGateway } from "./fixtures/mock-gateway"

describe("Agent", () => {
  it("sends sync messages and appends assistant reply to history", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        json: { choices: [{ message: { content: "Hello back" } }] },
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent({ name: "assistant", systemPrompt: "Be concise." })

    const reply = await agent.send("Hello")

    expect(reply).toBe("Hello back")
    expect(agent.history).toEqual([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hello back" },
    ])
  })

  it("supports SSE streaming responses", async () => {
    const chunks: string[] = []
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        stream: [
          'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"world"}}]}\n\n',
          "data: [DONE]\n\n",
        ],
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    const full = await agent.send("Stream please", {
      stream: true,
      onChunk: (chunk) => chunks.push(chunk),
    })

    expect(full).toBe("Hello world")
    expect(chunks).toEqual(["Hello ", "world"])
    expect(agent.history.at(-1)).toEqual({ role: "assistant", content: "Hello world" })
  })

  it("runs one-shot prompt without changing history", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        json: { choices: [{ message: { content: "One-shot answer" } }] },
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    const reply = await agent.run("Summarize this")

    expect(reply).toBe("One-shot answer")
    expect(agent.history).toHaveLength(0)
  })

  it("invokes tools through /tools/invoke with OpenClaw-compatible body", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/tools/invoke",
        json: { ok: true, result: "done" },
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    const response = await agent.use("web-search", {
      query: "OpenClaw",
      mode: {
        kind: "approved",
        host: "gateway",
      },
    })

    expect(response).toEqual({ ok: true, result: "done" })
    expect(gateway.calls).toHaveLength(1)
    const payload = JSON.parse(gateway.calls[0]?.bodyText ?? "{}")
    expect(payload).toEqual({
      tool: "web-search",
      input: {
        query: "OpenClaw",
        mode: {
          kind: "approved",
          host: "gateway",
        },
      },
    })
  })

  it("rolls back user message when send fails", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/chat/completions",
        status: 500,
        text: "gateway error",
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    await expect(agent.send("Will fail")).rejects.toBeInstanceOf(ClawError)
    expect(agent.history).toEqual([])
  })

  it("requires onChunk callback in streaming mode", async () => {
    const gateway = createMockGateway("http://localhost:18789", [])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })
    const agent = os.agent("assistant")

    await expect(agent.send("test", { stream: true })).rejects.toBeInstanceOf(ClawError)
    expect(agent.history).toEqual([])
  })
})
