export type Runtime = "openclaw" | "nanoclaw"

export interface AdapterMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface AdapterRequest {
  path: string
  method?: "GET" | "POST"
  headers?: Record<string, string>
  body?: unknown
}

export interface StreamEventFrame {
  event?: string
  data: string
}

export interface StreamParseResult {
  done?: boolean
  chunk?: string
}

export interface BuildChatRequestInput {
  token: string
  model: string
  messages: AdapterMessage[]
  stream: boolean
}

export interface BuildToolRequestInput {
  token: string
  toolId: string
  params: Record<string, unknown>
}

export interface RuntimeAdapter {
  readonly id: Runtime
  readonly defaultModel: string
  readonly supportsToolInvocation: boolean
  buildHealthRequest(input: { token: string }): AdapterRequest
  buildChatRequest(input: BuildChatRequestInput): AdapterRequest
  parseChatResponse(payload: unknown): string
  parseStreamEvent(frame: StreamEventFrame): StreamParseResult
  buildToolRequest?(input: BuildToolRequestInput): AdapterRequest
}
