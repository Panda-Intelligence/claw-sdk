import { Agent } from "./agent"
import { getRuntimeAdapter } from "./adapters"
import type { RuntimeAdapter } from "./adapters/runtime-adapter"
import { AgentNotFoundError, GatewayConnectionError } from "./errors"
import type { AgentConfig, AgentInfo, ClawConfig, Model } from "./types"

export class Claw {
  private readonly _config: {
    gatewayUrl: string
    token: string
    defaultModel: Model
  }
  private readonly _fetchImpl: typeof fetch
  private readonly _runtimeAdapter: RuntimeAdapter
  private readonly _agents = new Map<string, Agent>()

  constructor(config: ClawConfig) {
    if (!config.gatewayUrl) {
      throw new Error("`gatewayUrl` is required")
    }
    if (!config.token) {
      throw new Error("`token` is required")
    }

    const fetchImpl = config.fetch ?? globalThis.fetch
    if (!fetchImpl) {
      throw new Error("Global `fetch` is not available. Pass `fetch` in Claw config.")
    }

    this._runtimeAdapter = config.adapter ?? getRuntimeAdapter(config.runtime ?? "openclaw")
    this._config = {
      defaultModel: config.defaultModel ?? this._runtimeAdapter.defaultModel,
      token: config.token,
      gatewayUrl: config.gatewayUrl.replace(/\/+$/, ""),
    }
    this._fetchImpl = fetchImpl
  }

  agent(nameOrConfig: string | AgentConfig): Agent {
    const config: AgentConfig =
      typeof nameOrConfig === "string" ? { name: nameOrConfig } : nameOrConfig

    if (this._agents.has(config.name)) {
      return this._agents.get(config.name)!
    }

    const agentInit: ConstructorParameters<typeof Agent>[0] = {
      name: config.name,
      model: config.model ?? this._config.defaultModel,
      gatewayUrl: this._config.gatewayUrl,
      token: this._config.token,
      fetchImpl: this._fetchImpl,
      runtimeAdapter: this._runtimeAdapter,
    }
    if (config.systemPrompt !== undefined) {
      agentInit.systemPrompt = config.systemPrompt
    }

    const agent = new Agent(agentInit)

    this._agents.set(config.name, agent)
    return agent
  }

  close(agentName: string): void {
    if (!this._agents.delete(agentName)) {
      throw new AgentNotFoundError(agentName)
    }
  }

  get agents(): AgentInfo[] {
    return [...this._agents.values()].map((a) => a.info)
  }

  async ping(): Promise<boolean> {
    try {
      const request = this._runtimeAdapter.buildHealthRequest({ token: this._config.token })
      const init: RequestInit = { method: request.method ?? "GET" }
      if (request.headers) {
        init.headers = request.headers
      }
      if (request.body !== undefined) {
        init.body = JSON.stringify(request.body)
      }

      const res = await this._fetchImpl(`${this._config.gatewayUrl}${request.path}`, init)
      return res.ok
    } catch (err) {
      throw new GatewayConnectionError(this._config.gatewayUrl, err as Error)
    }
  }
}
