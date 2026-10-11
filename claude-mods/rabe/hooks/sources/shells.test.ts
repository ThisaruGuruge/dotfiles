import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { RabeItem } from '../model'
import { MAX_ENDED } from '../registry'
import { core, files, memoryState } from '../testing'

const DIR = '/tmp/claude-1000/-home-me-app/5f1c/tasks'

function bash(on: On) {
  on('tool.call', { tool: 'Bash' }, async (_$, e) => {
    const taskId =
      e.tool === 'Bash' && e.run_in_background
        ? e.description === 'Starting the API dev server'
          ? 'b1'
          : (e.description ?? 'b1')
        : undefined

    return {
      result: {
        stdout: '',
        stderr: '',
        interrupted: false,
        ...(taskId && { backgroundTaskId: taskId }),
      },
      text: taskId
        ? `Command running in background with ID: ${taskId}. Output is being written to: ${DIR}/${taskId}.output. If it exits you will be notified.`
        : 'ok',
    }
  })
}

const running = {
  id: 'shell:b1',
  kind: 'shell',
  title: 'bun run dev · b1',
  status: 'running',
  seenAt: 1000,
  startedAt: 1000,
  detail: { command: 'bun run dev', taskId: 'b1', outputPath: `${DIR}/b1.output` },
}

test('a background Bash call adds a running shell with its output file', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  expect(state['rabe.items']?.value).toEqual([running])
})

test('a background Bash row uses its description and keeps the original command', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({
    tool: 'Bash',
    command: 'while true; do\n  echo ready; done',
    description: 'Starting the API dev server',
    run_in_background: true,
  })
  expect((state['rabe.items']?.value as RabeItem[] | undefined)?.[0]).toMatchObject({
    title: 'Starting the API dev server · b1',
    detail: { command: 'while true; do\n  echo ready; done' },
  })
})

test('a Bash call in the foreground adds nothing', async ($, on) => {
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(state['rabe.items']?.value).toBeUndefined()
})

test('a background Bash call in a subagent names the agent as parent', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({
    tool: 'Bash',
    command: 'bun run dev',
    run_in_background: true,
    agentId: 'a1',
  } as never)
  expect(state['rabe.items']?.value).toEqual([{ ...running, parentId: 'agent:a1' }])
})

test('a task notification ends the shell with its exit code', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await clock.set(5000)
  await $.prompt.submit({
    text: `<task-notification>
<task-id>b1</task-id>
<output-file>${DIR}/b1.output</output-file>
<status>failed</status>
<summary>Background command "Start dev server" failed with exit code 2</summary>
</task-notification>`,
    origin: { kind: 'task-notification' },
    wait: false,
  })
  expect(state['rabe.items']?.value).toEqual([
    { ...running, status: 'failed', endedAt: 5000, detail: { ...running.detail, exitCode: 2 } },
  ])
})

test('the same text typed by the user ends nothing', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await $.prompt.submit({
    text: '<task-notification><task-id>b1</task-id><status>killed</status></task-notification>',
    origin: { kind: 'composer' },
    wait: false,
  })
  expect(state['rabe.items']?.value).toEqual([running])
})

test('the poll reads the port, when it found it, and the exit line from the output file', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const held: Record<string, string> = {}
  files(on, held)
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.session.start({ cwd: '/home/me/app', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  held[`${DIR}/b1.output`] = '  ➜  Local:   http://localhost:5173/\n'
  await clock.advance(2000)
  expect(state['rabe.items']?.value).toEqual([
    { ...running, detail: { ...running.detail, port: 5173, portAt: 3000 } },
  ])
  held[`${DIR}/b1.output`] += '\n[exited with code 0]\n'
  await clock.advance(2000)
  expect(state['rabe.items']?.value).toEqual([
    {
      ...running,
      status: 'done',
      endedAt: 5000,
      detail: { ...running.detail, port: 5173, portAt: 3000, exitCode: 0 },
    },
  ])
})

test('at Stop a shell no longer in flight ends by its exit line, else as stopped', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const held: Record<string, string> = { [`${DIR}/b1.output`]: 'boom\n\n[exited with code 1]\n' }
  files(on, held)
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await $.tool.call({
    tool: 'Bash',
    command: 'sleep 99',
    description: 'b2',
    run_in_background: true,
  })
  await clock.set(3000)
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
  const ended = state['rabe.items']?.value as {
    status: string
    detail: { exitCode?: number }
  }[]
  expect(ended.map(one => [one.status, one.detail.exitCode])).toEqual([
    ['failed', 1],
    ['stopped', undefined],
  ])
})

// The end notification of a subagent's shell reaches only the subagent.
test('a subagent shell ends from the exit line of its output file; the main Stop leaves it running', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const held: Record<string, string> = { [`${DIR}/b1.output`]: 'ready\n' }
  files(on, held)
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.session.start({ cwd: '/home/me/app', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'Bash',
    command: 'bun run dev',
    run_in_background: true,
    agentId: 'a1',
  } as never)
  await $.classic.Stop({ stop_hook_active: false, background_tasks: [] })
  await clock.advance(2000)
  expect(state['rabe.items']?.value).toEqual([{ ...running, parentId: 'agent:a1' }])
  held[`${DIR}/b1.output`] += '\n[exited with code 0]\n'
  await clock.advance(2000)
  expect(state['rabe.items']?.value).toEqual([
    {
      ...running,
      parentId: 'agent:a1',
      status: 'done',
      endedAt: 5000,
      detail: { ...running.detail, exitCode: 0 },
    },
  ])
})

test('at Stop a shell started before Rabe loaded is added', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      { id: 'b1', type: 'shell', status: 'running', description: 'dev', command: 'bun run dev' },
      { id: 'b0', type: 'shell', status: 'running', description: 'watch', command: 'tsc -w' },
      { id: 'a1', type: 'subagent', status: 'running', description: 'review' },
    ],
  })
  expect(state['rabe.items']?.value).toEqual([
    running,
    {
      id: 'shell:b0',
      kind: 'shell',
      title: 'watch · b0',
      status: 'running',
      seenAt: 1000,
      detail: { command: 'tsc -w', taskId: 'b0', outputPath: `${DIR}/b0.output` },
    },
  ])
})

test('at Stop a monitor, which Claude Code lists as a shell, is not added as a shell', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  const monitor = {
    id: 'monitor:m1',
    kind: 'monitor',
    title: 'CI run',
    status: 'running',
    seenAt: 500,
    detail: { command: 'gh run watch 1', taskId: 'm1' },
  }
  state['rabe.items'] = { value: [monitor], version: 1 }
  core(on)
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [
      {
        id: 'm1',
        type: 'shell',
        status: 'running',
        description: 'CI run',
        command: 'gh run watch 1',
      },
    ],
  })
  expect(state['rabe.items']?.value).toEqual([monitor])
})

test('the poll keeps the output lines in rabe.lines; an end that pushes a shell out drops its lines', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const held: Record<string, string> = {}
  files(on, held)
  const state = memoryState(on)
  const old = Array.from({ length: MAX_ENDED }, (_, n) => ({
    ...running,
    id: `shell:old${n}`,
    status: 'done',
    seenAt: 10 + n,
    endedAt: 10 + n,
  }))
  state['rabe.items'] = { value: old, version: 1 }
  const gone = { seen: 1, lines: [] }
  state['rabe.lines'] = { value: { 'shell:old0': gone, 'shell:old1': gone }, version: 1 }
  bash(on)
  core(on)
  await $.session.start({ cwd: '/home/me/app', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  held[`${DIR}/b1.output`] = 'ready\n'
  await clock.advance(2000)
  held[`${DIR}/b1.output`] += 'boom\n\n[exited with code 1]\n'
  // The poll's timer ends b1, so the cap pushes out the oldest ended shell.
  await clock.advance(2000)
  expect(state['rabe.lines']?.value).toEqual({
    'shell:old1': gone,
    'shell:b1': {
      seen: 2,
      lines: [
        { at: 3000, text: 'ready' },
        { at: 5000, text: 'boom' },
      ],
    },
  })
})

test('a task notification keeps the last lines of a shell the poll did not read', async ($, on) => {
  mock.clock(on, { now: 1000 })
  files(on, { [`${DIR}/b1.output`]: 'done fast\n\n[exited with code 0]\n' })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await $.prompt.submit({
    text: `<task-notification><task-id>b1</task-id><output-file>${DIR}/b1.output</output-file><status>completed</status></task-notification>`,
    origin: { kind: 'task-notification' },
    wait: false,
  })
  expect(state['rabe.lines']?.value).toEqual({
    'shell:b1': { seen: 1, lines: [{ at: 1000, text: 'done fast' }] },
  })
})

test('an output file over 4 MiB is read with tail, its path after --', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const path = `${DIR}/b1.output`
  on('fs.stat', async (_$, e, next) =>
    e.path === path
      ? { value: { kind: 'file' as const, size: 5 * 1024 * 1024, mtimeMs: 0, isLink: false } }
      : next(e),
  )
  const runs: string[][] = []
  const timeouts: (number | undefined)[] = []
  on('process.run', async (_$, e) => {
    runs.push([...e.argv])
    timeouts.push(e.init?.timeoutMs)
    return { value: { exitCode: 0, stdout: 'port 4000\n', stderr: '' } } as never
  })
  const state = memoryState(on)
  bash(on)
  core(on)
  await $.session.start({ cwd: '/home/me/app', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'bun run dev', run_in_background: true })
  await clock.advance(2000)
  expect(runs).toContainEqual(['tail', '-c', '1048576', '--', path])
  expect(timeouts.every(ms => ms !== undefined && ms <= 5000)).toBe(true)
  expect((state['rabe.items']?.value as RabeItem[] | undefined)?.[0]).toMatchObject({
    detail: { port: 4000 },
  })
})
