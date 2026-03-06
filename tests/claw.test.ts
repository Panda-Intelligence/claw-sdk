import { describe, expect, it, vi } from "vitest"
import { Claw } from "../src/claw"
import { AgentNotFoundError, GatewayConnectionError } from "../src/errors"
import { createMockGateway } from "./fixtures/mock-gateway"

describe("Claw", () => {
  it("reuses agent instance by same name", () => {
    const gateway = createMockGateway("http://localhost:18789", [])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789/",
      token: "token",
      fetch: gateway.fetch,
    })

    const a = os.agent("assistant")
    const b = os.agent({ name: "assistant", model: "other-model" })

    expect(a).toBe(b)
    expect(os.agents).toHaveLength(1)
    expect(os.agents[0]?.name).toBe("assistant")
  })

  it("throws when closing unknown agent", () => {
    const gateway = createMockGateway("http://localhost:18789", [])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })

    expect(() => os.close("missing")).toThrow(AgentNotFoundError)
  })

  it("pings gateway health endpoint", async () => {
    const gateway = createMockGateway("http://localhost:18789", [
      { method: "GET", path: "/health", status: 200 },
    ])
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: gateway.fetch,
    })

    await expect(os.ping()).resolves.toBe(true)
  })

  it("wraps connectivity errors from ping", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connection refused")
    })
    const os = new Claw({
      gatewayUrl: "http://localhost:18789",
      token: "token",
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(os.ping()).rejects.toBeInstanceOf(GatewayConnectionError)
  })
})
