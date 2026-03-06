# Getting Started

## 1) Prerequisites

- Node.js `>=18.17`
- A running OpenClaw gateway instance
- Gateway token

## 2) Install SDK

```bash
pnpm add claw-sdk
```

## 3) Create `Claw` instance

```ts
import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
  runtime: "openclaw",
  defaultModel: "openclaw",
})
```

For NanoClaw runtime, switch to:

```ts
const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_NANOCLAW_TOKEN ?? "your-nanoclaw-token",
  runtime: "nanoclaw",
  defaultModel: "claude-3-5-sonnet-latest",
})
```

## 4) Create agent and chat

```ts
const assistant = os.agent({
  name: "assistant",
  systemPrompt: "You are a concise assistant.",
})

const reply = await assistant.send("Give me 3 priorities for today.")
console.log(reply)
```

## 5) Stream output

```ts
await assistant.send("Write a short release note.", {
  stream: true,
  onChunk: (chunk) => process.stdout.write(chunk),
})
```

## 6) Health check and cleanup

```ts
const alive = await os.ping()
console.log("gateway alive:", alive)

os.close("assistant")
```

## 7) Next steps

- See `docs/api-reference.md` for full API signatures.
- Check runnable snippets under `docs/examples/`.
