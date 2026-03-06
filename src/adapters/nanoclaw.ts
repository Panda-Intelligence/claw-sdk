import type { Message } from "../types"
import type { RuntimeAdapter } from "./runtime-adapter"

interface NanoClawTextBlock {
  type?: string
  text?: string
}

function splitMessages(messages: Message[]): {
  system?: string
  chat: Array<{ role: "user" | "assistant"; content: string }>
} {
  const systemParts: string[] = []
  const chat: Array<{ role: "user" | "assistant"; content: string }> = []

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content)
      continue
    }

    chat.push({
      role: message.role,
      content: message.content,
    })
  }

  if (systemParts.length > 0) {
    return {
      system: systemParts.join("\n\n"),
      chat,
    }
  }

  return { chat }
}

function buildNanoClawHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "x-api-key": token,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  }
}

function extractTextBlocks(content: unknown): string {
  if (typeof content === "string") {
    return content
  }

  if (!Array.isArray(content)) {
    return ""
  }

  const blocks = content as NanoClawTextBlock[]
  return blocks
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text ?? "")
    .join("")
}

export const NANOCLAW_ADAPTER: RuntimeAdapter = {
  id: "nanoclaw",
  defaultModel: "claude-3-5-sonnet-latest",
  supportsToolInvocation: false,
  buildHealthRequest({ token }) {
    return {
      path: "/v1/models",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": token,
        "anthropic-version": "2023-06-01",
      },
    }
  },
  buildChatRequest({ token, model, messages, stream }) {
    const { system, chat } = splitMessages(messages)
    const body: {
      model: string
      max_tokens: number
      stream: boolean
      system?: string
      messages: Array<{ role: "user" | "assistant"; content: string }>
    } = {
      model,
      max_tokens: 1024,
      stream,
      messages: chat,
    }
    if (system !== undefined) {
      body.system = system
    }

    return {
      path: "/v1/messages",
      method: "POST",
      headers: buildNanoClawHeaders(token),
      body,
    }
  },
  parseChatResponse(payload) {
    if (!payload || typeof payload !== "object") {
      return ""
    }

    const response = payload as { content?: unknown }
    return extractTextBlocks(response.content)
  },
  parseStreamEvent(frame) {
    if (!frame.data) {
      return {}
    }

    if (frame.data === "[DONE]") {
      return { done: true }
    }

    try {
      const json = JSON.parse(frame.data) as {
        type?: string
        delta?: { type?: string; text?: string }
        content_block?: { type?: string; text?: string }
      }
      const eventType = frame.event ?? json.type
      if (eventType === "message_stop") {
        return { done: true }
      }

      if (eventType === "content_block_delta") {
        if (json.delta?.type === "text_delta") {
          return { chunk: json.delta.text ?? "" }
        }
        return { chunk: json.delta?.text ?? "" }
      }

      if (eventType === "content_block_start") {
        if (json.content_block?.type === "text") {
          return { chunk: json.content_block.text ?? "" }
        }
      }
    } catch {
      return {}
    }

    return {}
  },
}
