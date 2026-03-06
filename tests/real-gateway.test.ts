import { describe, expect, it } from "vitest"
import { Claw } from "../src/claw"
import { AdapterCapabilityError, ClawError } from "../src/errors"

type Runtime = "openclaw" | "nanoclaw"

const gatewayUrl = process.env.CLAW_REAL_GATEWAY_URL
const gatewayToken = process.env.CLAW_REAL_GATEWAY_TOKEN
const configuredRuntime = process.env.CLAW_REAL_RUNTIME
const runtime: Runtime = configuredRuntime === "nanoclaw" ? "nanoclaw" : "openclaw"
const model =
  process.env.CLAW_REAL_MODEL ?? (runtime === "nanoclaw" ? "claude-3-5-sonnet-latest" : "openclaw")
const timeoutMs = Number(process.env.CLAW_REAL_TIMEOUT_MS ?? 60_000)
const toolId = process.env.CLAW_REAL_TOOL_ID
const toolParamsRaw = process.env.CLAW_REAL_TOOL_PARAMS_JSON

const realRequired = process.env.CLAW_REAL_REQUIRED === "1"
const hasRealGatewayConfig = Boolean(gatewayUrl && gatewayToken)
if (realRequired && !hasRealGatewayConfig) {
  throw new Error(
    "Real gateway test requires CLAW_REAL_GATEWAY_URL and CLAW_REAL_GATEWAY_TOKEN. " +
      "Please fill .env.real (copy from .env.real.example) and run `pnpm test:real` again."
  )
}
const describeReal = hasRealGatewayConfig ? describe : describe.skip

function withGatewayDiagnostics(error: unknown, label: string): never {
  if (error instanceof ClawError) {
    throw new Error(
      `${label} failed: message=${error.message}, status=${error.statusCode ?? "unknown"}, body=${error.body ?? "<empty>"}`
    )
  }
  throw error
}

describeReal("real gateway integration", () => {
  const os = new Claw({
    gatewayUrl: gatewayUrl ?? "http://localhost:18789",
    token: gatewayToken ?? "missing-token",
    runtime,
    defaultModel: model,
  })
  const agent = os.agent({
    name: `real-${runtime}-${Date.now()}`,
    systemPrompt: "You are concise.",
  })

  it(
    "ping returns true",
    async () => {
      await expect(os.ping()).resolves.toBe(true)
    },
    timeoutMs
  )

  it(
    "send returns text",
    async () => {
      try {
        const reply = await agent.send("Give me one short sentence about SDK design.")
        expect(reply.trim().length).toBeGreaterThan(0)
      } catch (error) {
        withGatewayDiagnostics(error, "send")
      }
    },
    timeoutMs
  )

  it(
    "streaming returns chunks and final content",
    async () => {
      try {
        const chunks: string[] = []
        const full = await agent.send("Write a five-word release note.", {
          stream: true,
          onChunk: (chunk) => chunks.push(chunk),
        })

        expect(chunks.length).toBeGreaterThan(0)
        expect(chunks.join("")).toBe(full)
        expect(full.trim().length).toBeGreaterThan(0)
      } catch (error) {
        withGatewayDiagnostics(error, "stream")
      }
    },
    timeoutMs
  )

  if (runtime === "openclaw" && toolId) {
    it(
      "tool invocation works when tool id is provided",
      async () => {
        let params: Record<string, unknown> = {}
        if (toolParamsRaw) {
          const parsed = JSON.parse(toolParamsRaw) as unknown
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            params = parsed as Record<string, unknown>
          }
        }

        const result = await agent.use(toolId, params)
        expect(result).toBeDefined()
      },
      timeoutMs
    )
  } else {
    it(
      "tool invocation behavior follows runtime capability",
      async () => {
        if (runtime === "nanoclaw") {
          await expect(agent.use("any-tool", {})).rejects.toBeInstanceOf(AdapterCapabilityError)
          return
        }

        expect(true).toBe(true)
      },
      timeoutMs
    )
  }
})
