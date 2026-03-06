import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
})

async function main() {
  const agent = os.agent("tool-runner")
  const result = await agent.use("web-search", { query: "OpenClaw docs" })
  console.log(result)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
