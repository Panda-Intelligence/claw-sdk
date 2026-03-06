# Claw SDK

Pure TypeScript SDK for standard OpenClaw gateway API calls.

`claw-sdk` wraps OpenClaw chat and tool endpoints into an agent-oriented API so your app can call stable methods instead of manually building HTTP payloads.

## Features

- Pure TypeScript with full type exports
- Built-in runtime adapters: OpenClaw and NanoClaw
- Agent abstraction with auto conversation memory
- Streaming support (`stream + onChunk`)
- One-shot calls (`run`) that do not affect memory
- Tool invocation support (`agent.use`)
- Multi-agent lifecycle management
- Typed error hierarchy for gateway failures

## Install

```bash
pnpm add claw-sdk
```

Node.js `>=18.17` is required.

## Quick Start

```ts
import { Claw } from "claw-sdk"

const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_GATEWAY_TOKEN ?? "your-gateway-token",
  runtime: "openclaw",
  defaultModel: "openclaw",
})

const assistant = os.agent({
  name: "assistant",
  systemPrompt: "You are concise and practical.",
})

const first = await assistant.send("My name is Alex.")
const second = await assistant.send("What is my name?")

console.log(first)
console.log(second)
```

## Streaming

```ts
const text = await assistant.send("Write a short haiku about coding.", {
  stream: true,
  onChunk: (chunk) => process.stdout.write(chunk),
})
```

## One-shot Prompt

```ts
const summary = await assistant.run("Summarize: TypeScript SDKs improve DX.")
```

## Tool Use

```ts
const result = await assistant.use("web-search", { query: "OpenClaw release notes" })
```

## NanoClaw Runtime

```ts
const os = new Claw({
  gatewayUrl: "http://localhost:18789",
  token: process.env.CLAW_NANOCLAW_TOKEN ?? "your-nanoclaw-token",
  runtime: "nanoclaw",
  defaultModel: "claude-3-5-sonnet-latest",
})
```

`nanoclaw` adapter uses Anthropic-compatible endpoints (`/v1/messages`, `/v1/models`).
Direct `agent.use()` tool invocation is currently only supported by the `openclaw` adapter.

## API Overview

```ts
const os = new Claw(config)
const agent = os.agent("assistant")

await agent.send("...")
await agent.run("...")
await agent.use("tool-id", { ...params })

agent.reset()
os.close("assistant")
await os.ping()
```

## Errors

- `ClawError`: base SDK error
- `GatewayConnectionError`: network/connection failure on ping
- `AgentNotFoundError`: closing a non-existing agent

## Docs

- Getting started: `docs/getting-started.md`
- API reference: `docs/api-reference.md`
- OpenClaw test coverage: `docs/openclaw-test-coverage.md`
- Examples: `docs/examples/*`

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Real gateway integration test (optional):

```bash
cp .env.real.example .env.real
pnpm test:real
```

Optional env vars: `CLAW_REAL_MODEL`, `CLAW_REAL_TIMEOUT_MS`, `CLAW_REAL_TOOL_ID`, `CLAW_REAL_TOOL_PARAMS_JSON`.

## License

MIT
