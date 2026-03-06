import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
})

async function main() {
  const writer = os.agent({
    name: "writer",
    systemPrompt: "You write short and practical text.",
  })

  const full = await writer.send("Write a short release note for SDK v0.1.0.", {
    stream: true,
    onChunk: (chunk) => process.stdout.write(chunk),
  })

  process.stdout.write("\n\n---\n")
  console.log(full)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
