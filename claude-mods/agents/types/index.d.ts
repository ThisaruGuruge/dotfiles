export type AgentStatus = 'run' | 'done' | 'fail'

export type AgentRec = {
  id: string
  agentId?: string
  type: string
  label: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  /** Context window in tokens: the session's, or 200k for Haiku */
  window: number
  /** Size of the latest request: input, cache and output tokens */
  context: number
  /** Output tokens, summed over every request */
  out: number
  /** Input tokens that were not a cache read, summed over every request */
  fresh: number
  requests: number
  tools: number
  lastTool?: string
}

declare module 'claude-code' {
  interface PluginState {
    agents: {
      list: AgentRec[]
      now: number
      paneTick: number
    }
  }
}
