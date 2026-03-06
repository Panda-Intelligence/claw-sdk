# API Reference

## `new Claw(config)`

```ts
new Claw({
    gatewayUrl: string,
    token: string,
    runtime?: "openclaw" | "nanoclaw",
    adapter?: RuntimeAdapter,
    defaultModel?: string,
    fetch?: typeof fetch,
})
```

| Field          | Type                       | Required | Description                                 |
| -------------- | -------------------------- | -------- | ------------------------------------------- |
| `gatewayUrl`   | `string`                   | yes      | OpenClaw gateway base URL                   |
| `token`        | `string`                   | yes      | Bearer token                                |
| `runtime`      | `"openclaw" \| "nanoclaw"` | no       | Built-in runtime selector                   |
| `adapter`      | `RuntimeAdapter`           | no       | Custom runtime adapter, overrides `runtime` |
| `defaultModel` | `string`                   | no       | Default model for new agents (`openclaw`)   |
| `fetch`        | `typeof fetch`             | no       | Custom fetch implementation                 |

### Methods

| Method   | Signature                                | Description             |
| -------- | ---------------------------------------- | ----------------------- |
| `agent`  | `(name: string \| AgentConfig) => Agent` | Get or create an agent  |
| `close`  | `(name: string) => void`                 | Close an existing agent |
| `agents` | `AgentInfo[]`                            | Active agents snapshot  |
| `ping`   | `() => Promise<boolean>`                 | Check gateway health    |

## `Agent`

Created by `os.agent(...)`.

### Properties

| Property    | Type                 |
| ----------- | -------------------- |
| `name`      | `string`             |
| `model`     | `string`             |
| `createdAt` | `Date`               |
| `history`   | `readonly Message[]` |
| `info`      | `AgentInfo`          |

### Methods

#### `send(content, options?)`

```ts
send(
    content: string,
    options?: {
        stream?: boolean
        onChunk?: (chunk: string) => void
        signal?: AbortSignal
    }
): Promise<string>
```

When `stream: true`, `onChunk` is required.

#### `run(prompt, options?)`

```ts
run(prompt: string, options?: { signal?: AbortSignal }): Promise<string>
```

One-shot request. Does not read/write conversation history.

#### `use(toolId, params?, options?)`

```ts
use(
    toolId: string,
    params?: Record<string, unknown>,
    options?: { signal?: AbortSignal }
): Promise<unknown>
```

For `openclaw`, this calls `/tools/invoke`.  
`nanoclaw` adapter currently throws `AdapterCapabilityError`.

#### `reset(keepSystemPrompt = true)`

```ts
reset(keepSystemPrompt?: boolean): this
```

Clears conversation history.

## Error Types

| Error                    | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `ClawError`              | Base SDK error with optional `statusCode` and `body` |
| `GatewayConnectionError` | `ping()` cannot connect to gateway                   |
| `AgentNotFoundError`     | `close()` called for unknown agent                   |

## Exported Types

- `ClawConfig`
- `AgentConfig`
- `SendOptions`
- `RunOptions`
- `ToolOptions`
- `Runtime`
- `RuntimeAdapter`
- `AgentInfo`
- `Message`
- `Role`
- `Model`
