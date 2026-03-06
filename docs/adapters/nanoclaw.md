# NanoClaw Adapter

`claw-sdk` includes a built-in `nanoclaw` runtime adapter.

## Endpoint mapping

- Chat: `POST /v1/messages`
- Stream: `POST /v1/messages` with `stream: true` (Anthropic-style SSE)
- Health check: `GET /v1/models`

## Headers

The adapter sends:

- `Authorization: Bearer <token>`
- `x-api-key: <token>`
- `anthropic-version: 2023-06-01`

## Message mapping

- `system` messages are merged into a single `system` string.
- `user`/`assistant` history is sent as `messages`.
- Response text is extracted from `content` blocks with `type: "text"`.

## Capability note

Direct `agent.use()` tool invocation is not available on NanoClaw adapter and throws `AdapterCapabilityError`.
