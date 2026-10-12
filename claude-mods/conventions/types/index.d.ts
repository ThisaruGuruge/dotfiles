/** The last message sent per file (absolute path), so an unchanged one is not repeated. */
export type Sent = Record<string, string>

declare module 'claude-code' {
  interface PluginState {
    conventions: {
      /** `/conventions off` for this session. */
      isPaused: boolean
      sent: Sent
    }
  }
}
