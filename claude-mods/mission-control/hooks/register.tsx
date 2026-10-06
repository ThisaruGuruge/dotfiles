import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { AgentRec, Call } from '../types'

const PANE = 'mission-control'
const MAX_CALLS = 60
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

const calls = atom({ plugin: 'mission-control', key: 'calls' } as const, [])
const agents = atom({ plugin: 'mission-control', key: 'agents' } as const, [])
const files = atom({ plugin: 'mission-control', key: 'files' } as const, [])

const clip = (text: string, max: number) => {
  const one = text.replace(/\s+/g, ' ').trim()

  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

const base = (path: string) => path.split('/').slice(-2).join('/')

// A short, human target for a call: the file, the command, the pattern.
export const targetOf = (input: Record<string, unknown>): string => {
  const pick = (key: string) =>
    typeof input[key] === 'string' ? (input[key] as string) : undefined

  const path = pick('file_path') ?? pick('notebook_path')
  if (path) return base(path)

  const text =
    pick('command') ??
    pick('pattern') ??
    pick('url') ??
    pick('query') ??
    pick('description') ??
    pick('path')

  return text ? clip(text, 48) : ''
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'mission-control',
      description: 'Show live agents, tool calls and touched files in a pane',
    })

    return next(e)
  })

  on('command.run', { command: 'mission-control' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Mission control' })

    return { text: 'Mission control opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    const call: Call = {
      id: e.tool_use_id,
      tool: e.tool,
      target: targetOf(input),
      status: 'run',
      agentId: e.agentId,
    }

    await update($, calls, list => [...list, call].slice(-MAX_CALLS))

    if (FILE_TOOLS.has(e.tool) && typeof input.file_path === 'string') {
      const path = input.file_path
      await update($, files, list =>
        list.includes(path) ? list : [...list, path],
      )
    }

    const ran = await next(e)
    const hasFailed = ran.deny !== undefined || ran.isError === true

    await update($, calls, list =>
      list.map(one =>
        one.id === call.id
          ? { ...one, status: hasFailed ? 'fail' : 'ok' }
          : one,
      ),
    )

    return ran
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const started = await $.clock.now()
    const spawned = await next(e)

    if (spawned.deny === undefined && spawned.agentId !== undefined) {
      const rec: AgentRec = {
        id: spawned.agentId,
        label: clip(e.description || e.prompt, 40),
        type: e.subagentType,
        status: 'run',
        startedAt: started,
      }
      await update($, agents, list => [...list, rec])
    }

    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const ended = await $.clock.now()

    if (e.agentId !== undefined) {
      await update($, agents, list =>
        list.map(one =>
          one.id === e.agentId
            ? { ...one, status: 'done', endedAt: ended }
            : one,
        ),
      )
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const [callList, agentList, fileList] = await Promise.all([
      read($, calls),
      read($, agents),
      read($, files),
    ])
    const room = Math.max(4, (e.viewport?.rows ?? 30) - 12)
    const running = agentList.filter(a => a.status === 'run').length
    const mark = (status: Call['status']) =>
      status === 'run' ? '…' : status === 'ok' ? '✓' : '✗'

    return (
      <Box flexDirection="column">
        <Text bold>
          Agents ({running} running, {agentList.length} total)
        </Text>
        {agentList.length === 0 && <Text dimColor>none yet</Text>}
        {agentList.slice(-8).map(a => (
          <Text dimColor={a.status === 'done'}>
            {a.status === 'run' ? '●' : '○'} {a.type}: {a.label}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Tool calls (latest last)</Text>
        {callList.length === 0 && <Text dimColor>none yet</Text>}
        {callList.slice(-room).map(c => (
          <Text dimColor={c.status === 'ok'}>
            {mark(c.status)} {c.agentId ? '↳ ' : ''}
            {c.tool} {c.target}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>Files touched ({fileList.length})</Text>
        {fileList.length === 0 && <Text dimColor>none yet</Text>}
        {fileList.slice(-10).map(f => (
          <Text>{base(f)}</Text>
        ))}
      </Box>
    )
  })
}
