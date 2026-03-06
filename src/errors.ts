export class ClawError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly body?: string
  ) {
    super(message)
    this.name = "ClawError"
  }
}

export class AgentNotFoundError extends ClawError {
  constructor(name: string) {
    super(`Agent "${name}" not found`)
    this.name = "AgentNotFoundError"
  }
}

export class GatewayConnectionError extends ClawError {
  constructor(url: string, cause?: Error) {
    super(`Cannot connect to gateway at ${url}`)
    this.name = "GatewayConnectionError"
    this.cause = cause
  }
}

export class AdapterCapabilityError extends ClawError {
  constructor(adapterId: string, capability: string) {
    super(`Adapter "${adapterId}" does not support capability "${capability}"`)
    this.name = "AdapterCapabilityError"
  }
}
