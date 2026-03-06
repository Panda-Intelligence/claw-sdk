# OpenClaw Test Coverage Map

This document maps `claw-sdk` tests to OpenClaw gateway behavior from official docs.

## Referenced docs

- Getting started: https://docs.openclaw.ai/start/getting-started
- TypeBox mode header (tool invocation security mode): https://docs.openclaw.ai/core-api/typebox-schemas/typebox-modeheader
- Tools invoke endpoint: https://docs.openclaw.ai/core-api/tools-invoke

## Coverage summary

- HTTP tool invocation (`POST /tools/invoke`)
  - Test: `tests/agent.test.ts`
  - Verifies request body shape for `tool` + `input` and passes `mode` in `input`.
- OpenClaw WebSocket RPC chat flow (`chat.send` + `chat` events)
  - Tests: `tests/transports/openclaw-rpc.test.ts`, `tests/agent-openclaw-rpc-fallback.test.ts`
  - Verifies connect handshake, challenge nonce handling, delta/final chat event processing.
- OpenClaw fallback behavior in SDK
  - Test: `tests/agent-openclaw-rpc-fallback.test.ts`
  - Verifies SDK falls back to WebSocket RPC when HTTP chat endpoints return 404.
- Real gateway smoke/integration (environment-driven)
  - Test: `tests/real-gateway.test.ts`
  - Verifies ping/send/stream/tool behavior against live gateway when configured.
