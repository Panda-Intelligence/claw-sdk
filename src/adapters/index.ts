import { NANOCLAW_ADAPTER } from "./nanoclaw"
import { OPENCLAW_ADAPTER } from "./openclaw"
import type { Runtime, RuntimeAdapter } from "./runtime-adapter"

const BUILTIN_ADAPTERS: Record<Runtime, RuntimeAdapter> = {
  openclaw: OPENCLAW_ADAPTER,
  nanoclaw: NANOCLAW_ADAPTER,
}

export function getRuntimeAdapter(runtime: Runtime): RuntimeAdapter {
  return BUILTIN_ADAPTERS[runtime]
}

export { OPENCLAW_ADAPTER, NANOCLAW_ADAPTER }
export type {
  Runtime,
  RuntimeAdapter,
  AdapterRequest,
  StreamEventFrame,
  StreamParseResult,
} from "./runtime-adapter"
