import { describe, expect, it } from "vitest"
import { Claw } from "../src/claw"
import { AdapterCapabilityError } from "../src/errors"
import { createMockGateway } from "./fixtures/mock-gateway"

describe("NanoClaw adapter", () => {
  it("uses /v1/messages and maps system/user payload", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/messages",
        json: {
          content: [{ type: "text", text: "Hello from NanoClaw" }],
        },
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "nano-token",
      runtime: "nanoclaw",
      defaultModel: "claude-test-model",
      fetch: gateway.fetch,
    })
    const agent = os.agent({
      name: "nano",
      systemPrompt: "You are concise.",
    })

    const reply = await agent.send("Hi")

    expect(reply).toBe("Hello from NanoClaw")
    expect(gateway.calls).toHaveLength(1)
    expect(gateway.calls[0]?.url).toContain("/v1/messages")

    const body = JSON.parse(gateway.calls[0]?.bodyText ?? "{}")
    expect(body).toEqual({
      model: "claude-test-model",
      max_tokens: 1024,
      stream: false,
      system: "You are concise.",
      messages: [{ role: "user", content: "Hi" }],
    })
  })

  it("parses anthropic style streaming frames", async () => {
    const chunks: string[] = []
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "POST",
        path: "/v1/messages",
        stream: [
          "event: content_block_delta\n",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}\n\n',
          "event: content_block_delta\n",
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"NanoClaw"}}\n\n',
          "event: message_stop\n",
          'data: {"type":"message_stop"}\n\n',
        ],
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "nano-token",
      runtime: "nanoclaw",
      defaultModel: "claude-test-model",
      fetch: gateway.fetch,
    })
    const agent = os.agent("nano")

    const full = await agent.send("stream this", {
      stream: true,
      onChunk: (chunk) => chunks.push(chunk),
    })

    expect(full).toBe("Hello NanoClaw")
    expect(chunks).toEqual(["Hello ", "NanoClaw"])
  })

  it("uses /v1/models for ping with compatible headers", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      {
        method: "GET",
        path: "/v1/models",
        status: 200,
      },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "nano-token",
      runtime: "nanoclaw",
      fetch: gateway.fetch,
    })

    const alive = await os.ping()

    expect(alive).toBe(true)
    expect(gateway.calls[0]?.headers["x-api-key"]).toBe("nano-token")
    expect(gateway.calls[0]?.headers["anthropic-version"]).toBe("2023-06-01")
  })

  it("throws on direct tool invocation because NanoClaw adapter has no tool endpoint", async () => {
    const gateway = createMockGateway("http://localhost:18789", [])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "nano-token",
      runtime: "nanoclaw",
      fetch: gateway.fetch,
    })
    const agent = os.agent("nano")

    await expect(agent.use("web-search", { query: "news" })).rejects.toBeInstanceOf(
      AdapterCapabilityError
    )
  })
})
