# ROADMAP

## Product Positioning

`claw-sdk` is the **active calling layer** for OpenClaw.

- OpenClaw -> App: passive delivery mode (events/messages pushed to app side).
- App -> OpenClaw: active control mode (explicit API calls initiated by your system).
- `claw-sdk` focuses on the second path: stable, typed, production-grade active invocation.

## Current Status (Done)

- [x] OpenClaw HTTP chat/tool encapsulation
- [x] Agent abstraction with memory + one-shot call support
- [x] Streaming parsing and chunk callback flow
- [x] Runtime adapters: `openclaw` + `nanoclaw`
- [x] OpenClaw RPC fallback for chat endpoints
- [x] Real gateway integration tests (env-driven)

## 2026 Roadmap

### Phase 1 - Reliability Baseline (v0.2)

- [ ] Unified retry/backoff policy by request type (chat/stream/tool/ping)
- [ ] Timeout and cancellation strategy hardening (`AbortSignal` + defaults)
- [ ] Structured error extensions (`code`, `requestId`, `retryable`)
- [ ] Deterministic contract tests for runtime adapters

### Phase 2 - Active Invocation Ergonomics (v0.3)

- [ ] Typed tool invocation helpers (schema-first input/output inference)
- [ ] Request middleware pipeline (pre-request/post-response hooks)
- [ ] Prompt/message builder utilities for system-level orchestration
- [ ] Optional session persistence adapter (memory abstraction)

### Phase 3 - System Integration (v0.4)

- [ ] Observability hooks (logging/metrics/tracing events)
- [ ] Framework integration examples (Node service, queue worker, cron job)
- [ ] Compatibility matrix docs for OpenClaw/NanoClaw gateway versions
- [ ] Multi-agent coordination cookbook for backend workflows

### Phase 4 - Stable SDK (v1.0)

- [ ] API freeze and long-term compatibility policy
- [ ] Migration guide for pre-1.0 adopters
- [ ] Performance benchmark and load profile report
- [ ] Complete docs + launch samples for production setup

## Out of Scope (for now)

- Hosting a managed gateway service
- Replacing OpenClaw core runtime behavior
- Building a no-code orchestration product inside SDK
