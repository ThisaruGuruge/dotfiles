export type TurnMark = { turn: number; value: number }

declare module 'claude-code' {
  interface PluginState {
    'session-wrapped': {
      turns: number
      tools: Record<string, number>
      files: string[]
      peakPercent: number
      currentTools: number
      longest: TurnMark | null
      busiest: TurnMark | null
    }
  }
}
