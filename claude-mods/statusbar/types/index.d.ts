export type Row = {
  name: string
  tokens: number
  color: string
  kind: 'used' | 'free' | 'buffer' | 'deferred'
}

export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Snap = {
  tokens?: number
  window: number
  percent?: number
  limits: Limit[]
  usd?: number
}

export type Last = {
  seconds: number
  tools: number
  usd: number
  outTokens: number
  cacheHitPercent: number
  endedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    statusbar: {
      snap: Snap | null
      rows: Row[] | null
      history: number[]
      last: Last | null
      isHidden: boolean
      isLegend: boolean
      warned: string[]
      now: number
    }
  }
}
