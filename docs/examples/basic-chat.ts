import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
})

async function main() {
  const agent = os.agent({
    name: "assistant",
    systemPrompt: "You are a concise assistant.",
  })

  const reply = await agent.send("Give me three priorities for today.")
  console.log(reply)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
