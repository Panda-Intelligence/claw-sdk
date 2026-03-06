import type { RuntimeAdapter } from "./runtime-adapter"

export const OPENCLAW_ADAPTER: RuntimeAdapter = {
  id: "openclaw",
  defaultModel: "openclaw",
  supportsToolInvocation: true,
  buildHealthRequest({ token }) {
    return {
      path: "/health",
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  },
  buildChatRequest({ token, model, messages, stream }) {
    return {
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: {
        model,
        messages,
        stream,
      },
    }
  },
  parseChatResponse(payload) {
    if (!payload || typeof payload !== "object") {
      return ""
    }

    const response = payload as {
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
    }
    return response.choices?.[0]?.message?.content ?? ""
  },
  parseStreamEvent(frame) {
    if (frame.data === "[DONE]") {
      return { done: true }
    }

    if (!frame.data) {
      return {}
    }

    try {
      const json = JSON.parse(frame.data) as {
        choices?: Array<{ delta?: { content?: string } }>
      }
      return { chunk: json.choices?.[0]?.delta?.content ?? "" }
    } catch {
      return {}
    }
  },
  buildToolRequest({ token, toolId, params }) {
    return {
      path: "/tools/invoke",
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: {
        tool: toolId,
        input: params,
      },
    }
  },
}
