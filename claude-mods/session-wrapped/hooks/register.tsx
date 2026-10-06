import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { TurnMark } from '../types'

const PANE = 'session-wrapped'
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const turns = atom({ plugin: 'session-wrapped', key: 'turns' } as const, 0)
const tools = atom({ plugin: 'session-wrapped', key: 'tools' } as const, {})
const files = atom({ plugin: 'session-wrapped', key: 'files' } as const, [])
const peak = atom({ plugin: 'session-wrapped', key: 'peakPercent' } as const, 0)
const current = atom({ plugin: 'session-wrapped', key: 'currentTools' } as const, 0)
const longest = atom({ plugin: 'session-wrapped', key: 'longest' } as const, null)
const busiest = atom({ plugin: 'session-wrapped', key: 'busiest' } as const, null)

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60

  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`

  return `${s}s`
}

export const bar = (value: number, max: number, width = 20): string => {
  const filled = max > 0 ? Math.max(1, Math.round((value / max) * width)) : 0

  return '█'.repeat(Math.min(width, filled))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wrapped',
      description: 'Show a Wrapped-style summary of this session',
    })

    return next(e)
  })

  on('command.run', { command: 'wrapped' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Session wrapped' })

    return { text: 'Session wrapped opened.' }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, current, n => n + 1)
    }

    await update($, tools, counts => ({
      ...counts,
      [e.tool]: (counts[e.tool] ?? 0) + 1,
    }))

    const path = (e as unknown as { file_path?: unknown }).file_path
    if (FILE_TOOLS.has(e.tool) && typeof path === 'string') {
      await update($, files, list => (list.includes(path) ? list : [...list, path]))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, turns, n => n + 1)
      const turn = await read($, turns)
      const used = await read($, current)
      const seconds = e.durationMs / 1000

      await update($, longest, old =>
        old === null || seconds > old.value ? { turn, value: seconds } : old,
      )
      await update($, busiest, old =>
        used > 0 && (old === null || used > old.value)
          ? { turn, value: used }
          : old,
      )
      await update($, current, () => 0)
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const percent = e.context.percent

    if (percent !== undefined) {
      await update($, peak, old => Math.max(old, percent))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [turnCount, counts, fileList, peakPct, long, busy] = await Promise.all([
      read($, turns),
      read($, tools),
      read($, files),
      read($, peak),
      read($, longest),
      read($, busiest),
    ])
    const usage = await $.session.usage()
    const duration = formatDuration((await $.clock.now()) - usage.startedAt)
    const cost = usage.cost ? `$${usage.cost.usd.toFixed(2)}` : 'n/a'
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const total = sorted.reduce((sum, [, n]) => sum + n, 0)
    const top = sorted.slice(0, 5)
    const max = top[0]?.[1] ?? 0
    const mark = (m: TurnMark | null, unit: (v: number) => string) =>
      m === null ? '–' : `turn ${m.turn} (${unit(m.value)})`

    return (
      <Box flexDirection="column">
        <Text bold>Your session, wrapped</Text>
        <Text> </Text>
        <Text>Time {duration}</Text>
        <Text>Turns {turnCount}</Text>
        <Text>Cost {cost}</Text>
        <Text>Peak context {Math.round(peakPct)}%</Text>
        <Text>Files edited {fileList.length}</Text>
        <Text> </Text>
        <Text bold>Top tools ({total} calls)</Text>
        {top.length === 0 && <Text dimColor>no tool calls yet</Text>}
        {top.map(([name, n]) => (
          <Text>
            {name.padEnd(12)} {bar(n, max)} {n}
          </Text>
        ))}
        <Text> </Text>
        <Text>Longest turn {mark(long, v => `${Math.round(v)}s`)}</Text>
        <Text>Busiest turn {mark(busy, v => `${v} tool calls`)}</Text>
      </Box>
    )
  })
}
