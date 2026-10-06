export type CallStatus = 'run' | 'ok' | 'fail'

export type Call = {
  id: string
  tool: string
  target: string
  status: CallStatus
  agentId?: string
}

export type AgentStatus = 'run' | 'done'

export type AgentRec = {
  id: string
  label: string
  type: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'mission-control': {
      calls: Call[]
      agents: AgentRec[]
      files: string[]
    }
  }
}
