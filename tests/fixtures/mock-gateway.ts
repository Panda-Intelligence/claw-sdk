import { vi } from "vitest"

export interface MockGatewayRoute {
  path: string
  method?: string
  status?: number
  json?: unknown
  text?: string
  stream?: string[]
  headers?: HeadersInit
}

export interface GatewayCall {
  url: string
  method: string
  headers: Record<string, string>
  bodyText: string | undefined
}

export interface MockGateway {
  fetch: typeof fetch
  calls: GatewayCall[]
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers.map(([key, value]) => [key, String(value)]))
  }

  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]))
}

export function createMockGateway(baseUrl: string, routes: MockGatewayRoute[]): MockGateway {
  const calls: GatewayCall[] = []

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? "GET").toUpperCase()
    const path = new URL(url, baseUrl).pathname

    calls.push({
      url,
      method,
      headers: normalizeHeaders(init?.headers),
      bodyText: typeof init?.body === "string" ? init.body : undefined,
    })

    const route = routes.find((item) => {
      const routeMethod = (item.method ?? "GET").toUpperCase()
      return item.path === path && routeMethod === method
    })

    if (!route) {
      return new Response(`No mock route: ${method} ${path}`, { status: 500 })
    }

    if (route.stream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of route.stream ?? []) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      })

      return new Response(stream, {
        status: route.status ?? 200,
        headers: {
          "Content-Type": "text/event-stream",
          ...(route.headers ?? {}),
        },
      })
    }

    if (route.json !== undefined) {
      const jsonInit: ResponseInit = { status: route.status ?? 200 }
      if (route.headers) {
        jsonInit.headers = route.headers
      }
      return Response.json(route.json, jsonInit)
    }

    const responseInit: ResponseInit = { status: route.status ?? 200 }
    if (route.headers) {
      responseInit.headers = route.headers
    }

    return new Response(route.text ?? "", responseInit)
  })

  return {
    fetch: fetchMock as unknown as typeof fetch,
    calls,
  }
}
