import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
})

async function main() {
  const planner = os.agent({
    name: "planner",
    systemPrompt: "You create clear action plans.",
  })

  const reviewer = os.agent({
    name: "reviewer",
    systemPrompt: "You find risks and missing details.",
  })

  const plan = await planner.send("Plan a one-week launch checklist for an SDK.")
  const review = await reviewer.send(`Review this plan and suggest improvements:\n${plan}`)

  console.log("Plan:\n", plan)
  console.log("\nReview:\n", review)
  console.log(
    "\nActive agents:",
    os.agents.map((item) => item.name)
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
