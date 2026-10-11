import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRec } from '../types'
import { CRAB, clip, costumeOf, fillBar, fmt, fmtTime, modelName, targetOf, windowOf } from './format'

const PANE = 'agents'
const COMMAND = 'agents-pane'
const MAX_AGENTS = 100

const list = atom({ plugin: 'agents', key: 'list' } as const, [])
const now = atom({ plugin: 'agents', key: 'now' } as const, 0)
// Bumped when the pane opens or closes, so the rows above the prompt redraw and re-check whether the pane is showing.
const paneTick = atom({ plugin: 'agents', key: 'paneTick' } as const, 0)

const RED = '#e66767'
const GREEN = '#199e70'
const ACCENT = '#d95926'

const isRunning = (a: AgentRec) => a.status === 'run'
const elapsed = (a: AgentRec, at: number) => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

export type RowsMode = 'auto' | 'off' | 'always'

export const rowsModeOf = (value: unknown): RowsMode => (value === 'off' || value === 'always' ? value : 'auto')

export const register: Register = (on, options) => {
  const rowsMode = rowsModeOf(options?.rows)

  on('session.start', async ($, e, next) => {
    // Ticks the running agents' clocks; quiet when nothing runs.
    $.clock.every(1000, async () => {
      if (!(await read($, list)).some(isRunning)) return
      const at = await $.clock.now()
      await update($, now, () => at)
    })

    // `/agents` is Claude Code's own command, so the toggle is `/agents-pane`. A refused registration must not stop the hook.
    await $.command
      .register({
        name: COMMAND,
        description: 'Show or hide the subagent pane: model, effort, context, tokens and the latest tool call',
      })
      .catch(() => {})

    return next(e)
  })

  on('command.run', { command: COMMAND }, async $ => {
    const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
    if (isOpen) await $.ui.close({ id: PANE })
    else await $.ui.open({ id: PANE, title: 'Agents' })

    return { text: isOpen ? 'Agents pane closed.' : 'Agents pane opened.' }
  })

  // The rows above the prompt depend on whether the pane is showing, so a change of its seat redraws them.
  on('ui.open', { id: PANE }, async ($, e, next) => {
    const opened = await next(e)
    await update($, paneTick, n => n + 1)

    return opened
  }).catch(($, e, next) => next(e))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await next(e)
    await update($, paneTick, n => n + 1)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    const usage = await $.session.usage({ breakdown: 'summary' }).catch(() => undefined)
    const wasIdle = !(await read($, list)).some(isRunning)
    const rec: AgentRec = {
      id: started.agentId ?? e.tool_use_id,
      agentId: started.agentId,
      type: e.subagentType,
      label: clip(e.description || e.prompt, 60),
      model: started.model,
      window: windowOf(started.model, usage?.context.window),
      status: 'run',
      startedAt: at,
      context: 0,
      out: 0,
      fresh: 0,
      requests: 0,
      tools: 0,
    }
    await update($, list, all => [...all.filter(a => a.id !== rec.id), rec].slice(-MAX_AGENTS))
    await update($, now, () => at)
    // The first agent of a batch opens the pane; a seat below 144 columns waits for /agents-pane.
    if (wasIdle) void $.ui.open({ id: PANE, title: 'Agents' }).catch(() => {})

    return started
  }).catch(($, e, next) => next(e))

  // Each model request of a subagent: the effort it ran at and what it cost in tokens.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    if (!e.agentId || !usage) return result

    const context =
      usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens + usage.output_tokens
    await update($, list, all =>
      all.map(a =>
        a.agentId !== e.agentId
          ? a
          : {
              ...a,
              model: usage.model || e.model,
              effort: e.effort === undefined ? a.effort : String(e.effort),
              context,
              out: a.out + usage.output_tokens,
              fresh: a.fresh + usage.input_tokens + usage.cache_creation_input_tokens,
              requests: a.requests + 1,
            },
      ),
    )

    return result
  })

  on('tool.call', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      const last = clip(`${e.tool} ${targetOf(e as unknown as Record<string, unknown>, e.tool)}`, 140)
      await update($, list, all =>
        all.map(a => (a.agentId === agentId ? { ...a, tools: a.tools + 1, lastTool: last } : a)),
      )
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      const at = await $.clock.now()
      await update($, list, all =>
        all.map(a =>
          a.agentId === agentId
            ? { ...a, status: e.reason === 'answer' ? ('done' as const) : ('fail' as const), endedAt: at }
            : a,
        ),
      )
      await update($, now, () => at)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const all = await read($, list)
    const at = Math.max(await read($, now), ...all.map(a => a.startedAt), 0)
    const running = all.filter(isRunning).length
    const cols = e.props.bodyColumns
    const cells = cols < 60 ? 5 : 8

    return (
      <Box flexDirection="column">
        <Text bold>
          Agents ({running} running, {all.length} total)
        </Text>
        {all.length === 0 && <Text dimColor>No subagents yet.</Text>}
        {all
          .slice()
          .reverse()
          .map(a => {
            const max = a.window
            const mark = a.status === 'run' ? '●' : a.status === 'done' ? '✓' : '✗'
            const color = a.status === 'run' ? ACCENT : a.status === 'done' ? GREEN : RED
            return (
              <Box key={a.id} flexDirection="column" marginTop={1}>
                <Text>
                  <Text color={color}>{mark}</Text> {CRAB}
                  {costumeOf(a.type)} <Text bold>{a.type.replace(/^[^:]*:/, '')}</Text>{' '}
                  <Text dimColor>{clip(a.label, Math.max(12, cols - 24))}</Text>
                </Text>
                <Text dimColor={a.status !== 'run'}>
                  {'   '}
                  {modelName(a.model)}
                  {a.effort ? ` · ${a.effort}` : ''} · {fillBar(a.context, max, cells)} {fmt(a.context)}/{fmt(max)}
                </Text>
                <Text dimColor={a.status !== 'run'}>
                  {'   '}↑{fmt(a.out)} · {a.requests} req · {a.tools} tools · {fmtTime(elapsed(a, at))}
                </Text>
                {a.status === 'run' && a.lastTool && (
                  <Text dimColor wrap="truncate-end">
                    {'   '}↳ {a.lastTool}
                  </Text>
                )}
              </Box>
            )
          })}
      </Box>
    )
  })

  // One row per running agent above the prompt. They repeat what the pane shows, so `rows: auto` (the default) draws
  // them only while the pane is NOT showing: closed, still waiting below its width floor, or not the shown pane.
  // `always` draws them regardless (the engine's diff panel can take the pane's seat, and a plugin cannot see that);
  // `off` never draws them. It sits above whatever other mods draw, so none of them goes missing.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (rowsMode === 'off') return next(e)
    const running = (await read($, list)).filter(isRunning)
    if (e.props.hasSurvey || running.length === 0) return next(e)
    if (rowsMode === 'auto') {
      await read($, paneTick)
      const panes = await $.ui.panes().catch(() => [])
      if (panes.some(p => p.id === PANE && p.isPlaced && p.isShown)) return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const at = Math.max(await read($, now), ...running.map(a => a.startedAt))
    const cols = e.props.bodyColumns
    const room = Math.max(2, Math.min(6, Math.floor(e.props.maxRows / 3)))
    const shown = running.slice(0, room)
    const cells = cols < 100 ? 4 : 6

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" paddingX={1}>
          {shown.map(a => (
            <Box key={a.id} flexDirection="row" columnGap={2}>
              <Text color={ACCENT}>
                {CRAB}
                {costumeOf(a.type)}
              </Text>
              <Box width={Math.min(18, Math.max(10, Math.floor(cols / 7)))} flexShrink={0}>
                <Text bold wrap="truncate-end">
                  {a.type.replace(/^[^:]*:/, '')}
                </Text>
              </Box>
              <Text dimColor>
                {modelName(a.model)}
                {a.effort ? `·${a.effort}` : ''}
              </Text>
              <Text dimColor>
                {fillBar(a.context, a.window, cells)} {fmt(a.context)}
              </Text>
              <Text dimColor>
                ↑{fmt(a.out)} · {a.requests} req · {fmtTime(elapsed(a, at))}
              </Text>
              {cols >= 110 && a.lastTool && (
                <Box flexShrink={1}>
                  <Text dimColor wrap="truncate-end">
                    ↳ {a.lastTool}
                  </Text>
                </Box>
              )}
            </Box>
          ))}
          {running.length > shown.length && (
            <Text dimColor>
              +{running.length - shown.length} more · /agents-pane
            </Text>
          )}
        </Box>
        {await next(e)}
      </Box>
    )
  })
}
