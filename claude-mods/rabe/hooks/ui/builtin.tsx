import type { On } from 'claude-code'

const TASK =
  /^\d+ (background |dynamic )?(shell|monitor|agent|subagent|workflow|task|teammate|MCP task|cloud session)s?$/

// Removes the part of Claude Code's prompt hint that counts background work
// ("2 shells, 1 monitor") and its "↓ to manage"; keeps every other part.
export function stripTasks(hint: string): string {
  return hint
    .split(' · ')
    .filter(part => part !== '↓ to manage' && !part.split(', ').every(one => TASK.test(one)))
    .join(' · ')
}

// The engine's duration format on the turn line: 5s, 1m 4s, 1h 2m 5s.
export function turnDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor(s / 60) % 60
  if (h > 0) return `${h}h ${m}m ${s % 60}s`

  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// Hides Claude Code's own count of background work, since the band shows it.
export function builtin(on: On): void {
  on('ui.render', { component: 'PromptHint' }, async (_$, e, next) => {
    const hint = stripTasks(e.props.hint)

    return hint === e.props.hint ? next(e) : next({ ...e, props: { ...e.props, hint } })
  })

  // The line's "N shells, M monitors still running" part is not a prop, so the
  // hook draws the line itself, only while Rabe knows of a running shell or
  // monitor and no running agent or workflow (then the engine waits for those
  // and draws no such part). That line leaves out "done 1:16": no prop has it.
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const running = items.filter(item => item.status === 'running')
    const isWaiting = running.some(item => item.kind === 'agent' || item.kind === 'workflow')
    const hasTasks = running.some(item => item.kind === 'shell' || item.kind === 'monitor')
    if (isWaiting || !hasTasks) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" marginTop={1} width="100%">
        <Box minWidth={2}>
          <Text dimColor>✻</Text>
        </Box>
        <Text dimColor>
          {e.props.word} for {turnDuration(e.props.durationMs)}
        </Text>
      </Box>
    )
  })
}
