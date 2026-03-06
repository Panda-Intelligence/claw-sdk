import type { Runtime, RuntimeAdapter } from "./adapters/runtime-adapter"

export type Model = string

export type Role = "user" | "assistant" | "system"

export interface Message {
  role: Role
  content: string
}

export interface ClawConfig {
  gatewayUrl: string
  token: string
  defaultModel?: Model
  runtime?: Runtime
  adapter?: RuntimeAdapter
  fetch?: typeof fetch
}

export interface AgentConfig {
  name: string
  model?: Model
  systemPrompt?: string
}

export interface SendOptions {
  stream?: boolean
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
}

export interface RunOptions {
  signal?: AbortSignal
}

export interface ToolOptions {
  signal?: AbortSignal
}

export interface AgentInfo {
  name: string
  model: Model
  messageCount: number
  createdAt: Date
}

export interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}
