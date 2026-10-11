import type { On } from 'claude-code'
import { type Engine, expect, type MockClock, mock, test } from 'claude-code/testing'

import type { RabeItem, RabeItemOf } from '../model'
import { MAX_ENDED } from '../registry'
import { memoryState } from '../testing'
import { codexItem, jobEnd, parseRollout } from './codex'

const line = (type: string, payload: object) => JSON.stringify({ type, payload })

const ROLLOUT = [
  line('session_meta', { id: 'th-1' }),
  line('turn_context', {
    model: 'gpt-6.1-sol',
    effort: 'high',
    sandbox_policy: { type: 'read-only' },
  }),
  line('event_msg', {
    type: 'item_completed',
    item: { type: 'UserMessage', content: [{ type: 'text', text: 'Review pkg/auth.' }] },
  }),
  line('response_item', {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'I will read the diff first.' }],
  }),
  line('response_item', {
    type: 'reasoning',
    summary: [{ type: 'summary_text', text: '**Checking verify.ts**' }],
  }),
  line('response_item', { type: 'reasoning', summary: [], encrypted_content: 'x' }),
  line('response_item', {
    type: 'custom_tool_call',
    call_id: 'c1',
    input: 'text(await tools.exec_command({cmd:"git diff main"}))',
  }),
  line('event_msg', {
    type: 'item_completed',
    item: {
      type: 'CommandExecution',
      command: ['/bin/bash', '-lc', 'git diff main'],
      exit_code: 0,
      aggregated_output: 'a\nb\nc\n',
    },
  }),
  line('response_item', { type: 'custom_tool_call_output', call_id: 'c1' }),
  line('event_msg', {
    type: 'token_count',
    info: {
      total_token_usage: { input_tokens: 25000, cached_input_tokens: 18000, output_tokens: 3000 },
      last_token_usage: {
        input_tokens: 25000,
        cached_input_tokens: 18000,
        cache_write_input_tokens: 0,
        output_tokens: 3000,
      },
    },
  }),
  line('response_item', {
    type: 'custom_tool_call',
    call_id: 'c2',
    input: 'text(await tools.exec_command({cmd:"rg -n \\"redact\\" pkg"}))',
  }),
  '{"type":"event_msg","payload":{"type":"token_cou',
].join('\n')

test('a rollout gives model, effort, sandbox, prompt, tokens and steps', () => {
  expect(parseRollout(ROLLOUT)).toEqual({
    model: 'gpt-6.1-sol',
    effort: 'high',
    sandbox: 'read-only',
    prompt: 'Review pkg/auth.',
    tokens: { input: 25000, output: 3000, cached: 18000 },
    requests: [{ model: 'gpt-6.1-sol', input: 25000, cached: 18000, write: 0, output: 3000 }],
    commandCount: 1,
    steps: [
      { kind: 'message', text: 'I will read the diff first.' },
      { kind: 'reasoning', text: '**Checking verify.ts**' },
      { kind: 'command', text: 'git diff main', exitCode: 0, lines: 3 },
      { kind: 'command', text: 'rg -n "redact" pkg', isRunning: true },
    ],
  })
})

// The shape of Codex's records; paths and content are made up.
const change = (status: string, changes: object, at: number) =>
  line('event_msg', {
    type: 'item_completed',
    completed_at_ms: at,
    item: { type: 'FileChange', id: 'exec-1', changes, status, stdout: '', stderr: '' },
  })
const command = (script: string, exit_code: number, at: number, cwd = 'file:///work') =>
  line('event_msg', {
    type: 'item_completed',
    started_at_ms: at - 500,
    completed_at_ms: at,
    item: {
      type: 'CommandExecution',
      command: ['/bin/bash', '-lc', script],
      cwd,
      status: exit_code === 0 ? 'completed' : 'failed',
      exit_code,
      aggregated_output: '',
    },
  })

test('completed file changes are edits; shell writes are files to check on disk', () => {
  const rollout = [
    change('completed', { '/work/new.cjs': { type: 'add', content: 'x' } }, 1000),
    change(
      'completed',
      {
        '/work/a.ts': { type: 'update', unified_diff: '', move_path: null },
        '/work/old.ts': { type: 'update', unified_diff: '', move_path: '/work/moved.ts' },
        '/work/gone.ts': { type: 'delete', content: 'x' },
      },
      2000,
    ),
    change('failed', { '/work/never.ts': { type: 'add', content: 'x' } }, 3000),
    command("cat > notes.md <<'EOF'\nhi > there\nEOF", 0, 4000),
    command('echo x > /work/broken.txt && false', 1, 5000),
    command('rm /work/gone.txt; cp a.md out', 0, 6000, '/plain'),
    command('touch x', 0, 7000, 'file:///work/a%23b%3Fc%20d'),
    command('false || echo x > fallback.txt', 0, 8000),
  ].join('\n')
  const { edits, checks } = parseRollout(rollout, '/home/u')
  expect(edits).toEqual([
    { path: '/work/new.cjs', at: 1000, via: 'codex', change: 'add' },
    { path: '/work/a.ts', at: 2000, via: 'codex', change: 'update' },
    { path: '/work/old.ts', at: 2000, via: 'codex', change: 'delete' },
    { path: '/work/moved.ts', at: 2000, via: 'codex', change: 'add' },
    { path: '/work/gone.ts', at: 2000, via: 'codex', change: 'delete' },
  ])
  expect(checks).toEqual([
    { path: '/work/notes.md', from: 3500, to: 4000 },
    { path: '/plain/out', from: 5500, to: 6000 },
    { path: '/plain/out/a.md', from: 5500, to: 6000 },
    { path: '/work/a#b?c d/x', from: 6500, to: 7000 },
    { path: '/work/fallback.txt', from: 7500, to: 8000 },
  ])
})

test('a shell write of a codex job counts when the file changed while the command ran', async ($, on) => {
  const writes = watchItems(on)
  const rollout = [
    change('completed', { '/work/new.cjs': { type: 'add', content: 'x' } }, 3000),
    command('touch /work/in.md /work/old.md /work/late.md /work/none.md /work', 0, 4000),
  ].join('\n')
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: rollout,
  })
  w.files.set('/work/in.md', { text: 'x', mtimeMs: 3800 })
  w.files.set('/work/old.md', { text: 'x', mtimeMs: 3000 })
  w.files.set('/work/late.md', { text: 'x', mtimeMs: 9000 })
  await startAndTick($, w)
  expect((writes.at(-1)?.[0] as RabeItemOf<'codex'>).detail.edits).toEqual([
    { path: '/work/new.cjs', at: 3000, via: 'codex', change: 'add' },
    { path: '/work/in.md', at: 4000, via: 'shell' },
  ])
})

test('a stalled stat ends the shell checks after a second and keeps the rest', async ($, on) => {
  const writes = watchItems(on)
  const rollout = [
    change('completed', { '/work/new.cjs': { type: 'add', content: 'x' } }, 3000),
    command('touch /work/in.md /work/hang.md', 0, 4000),
    command('touch /work/in.md', 0, 4100),
  ].join('\n')
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: rollout,
  })
  w.files.set('/work/in.md', { text: 'x', mtimeMs: 3800 })
  await startAndTick($, w)
  expect(writes).toHaveLength(0)
  await w.clock.advance(1000)
  expect((writes.at(-1)?.[0] as RabeItemOf<'codex'>).detail.edits).toEqual([
    { path: '/work/new.cjs', at: 3000, via: 'codex', change: 'add' },
    { path: '/work/in.md', at: 4000, via: 'shell' },
    { path: '/work/in.md', at: 4100, via: 'shell' },
  ])
  expect(w.calls.filter(call => call === 'stat /work/in.md')).toHaveLength(1)
})

test('a tick is skipped while the last poll still runs', async ($, on) => {
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  let open = () => {}
  w.hold = new Promise(resolve => {
    open = resolve
  })
  const polls = () => w.calls.filter(call => call === `list ${STATE}`).length
  await startAndTick($, w)
  await w.clock.advance(4000)
  expect(polls()).toBe(1)
  w.hold = undefined
  open()
  await w.clock.advance(2000)
  expect(polls()).toBe(2)
})

const tokenCount = (total: number, last?: object) =>
  line('event_msg', {
    type: 'token_count',
    info: { total_token_usage: { input_tokens: total, output_tokens: 1 }, last_token_usage: last },
  })
const usage = (input: number) => ({
  input_tokens: input,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 1,
})

test('each new total is one request, with the model in use then', () => {
  const { requests } = parseRollout(
    [
      line('turn_context', { model: 'gpt-6.1-sol' }),
      line('event_msg', { type: 'token_count', info: null }),
      tokenCount(10, usage(10)),
      tokenCount(10, usage(10)),
      line('turn_context', { model: 'gpt-6-luna' }),
      tokenCount(30, usage(20)),
      tokenCount(40, { input_tokens: 10, output_tokens: 1 }),
    ].join('\n'),
  )
  expect(requests).toEqual([
    { model: 'gpt-6.1-sol', input: 10, cached: 0, write: 0, output: 1 },
    { model: 'gpt-6-luna', input: 20, cached: 0, write: 0, output: 1 },
    // a count is missing: no model, so no price
    { input: 10, cached: 0, write: 0, output: 1 },
  ])
})

test('a rate-limit record between two equal totals adds no request', () => {
  const { requests } = parseRollout(
    [
      line('turn_context', { model: 'gpt-6.1-sol' }),
      tokenCount(10, usage(10)),
      line('event_msg', { type: 'token_count', info: null }),
      tokenCount(10, usage(10)),
    ].join('\n'),
  )
  expect(requests).toHaveLength(1)
})

// A record with its time, as Codex writes each line.
const timed = (ms: number, record: string) =>
  JSON.stringify({ timestamp: new Date(ms).toISOString(), ...JSON.parse(record) })
const userMessage = (text: string) =>
  line('event_msg', {
    type: 'item_completed',
    item: { type: 'UserMessage', content: [{ type: 'text', text }] },
  })
const commandRun = line('event_msg', {
  type: 'item_completed',
  item: { type: 'CommandExecution', command: ['ls'], exit_code: 0 },
})
const total = (input: number, output: number, last: object) =>
  line('event_msg', {
    type: 'token_count',
    info: {
      total_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: output },
      last_token_usage: last,
    },
  })
// A thread resumed by a second job: the first job's turn comes first.
const RESUMED = [
  timed(100, line('turn_context', { model: 'gpt-6.1-sol' })),
  timed(110, userMessage('Job A')),
  timed(120, commandRun),
  timed(130, total(10, 1, usage(10))),
  timed(1100, line('turn_context', { model: 'gpt-6-luna' })),
  timed(1110, userMessage('Job B')),
  timed(1120, total(30, 2, usage(20))),
]

test('a resumed thread counts only the turns after the job started', () => {
  const own = parseRollout(RESUMED.join('\n'), undefined, 1000)
  expect(own.requests).toEqual([{ model: 'gpt-6-luna', input: 20, cached: 0, write: 0, output: 1 }])
  expect(own.tokens).toEqual({ input: 20, output: 1, cached: 0 })
  expect(own.prompt).toBe('Job B')
  expect(own.commandCount).toBe(0)
  expect(own.model).toBe('gpt-6-luna')
  // without the first job's total, this job's share of the thread total is not known
  const cut = RESUMED.filter((_, i) => i !== 3).join('\n')
  expect(parseRollout(cut, undefined, 1000).tokens).toBeUndefined()
  // a job that started the thread counts all of it
  expect(parseRollout(RESUMED.join('\n'), undefined, 50).tokens).toEqual({
    input: 30,
    output: 2,
    cached: 0,
  })
})

test('a finished job counts nothing after its end, even when its thread ran on', () => {
  const later = [
    ...RESUMED,
    timed(1130, change('completed', { '/work/b.ts': { type: 'add' } }, 1130)),
  ]
  const own = parseRollout(later.join('\n'), undefined, 50, 500)
  expect(own.requests).toEqual([
    { model: 'gpt-6.1-sol', input: 10, cached: 0, write: 0, output: 1 },
  ])
  expect(own.tokens).toEqual({ input: 10, output: 1, cached: 0 })
  expect(own.prompt).toBe('Job A')
  expect(own.commandCount).toBe(1)
  expect(own.model).toBe('gpt-6.1-sol')
  expect(own.edits).toBeUndefined()
  // no end yet (a running job): the thread so far counts
  expect(parseRollout(later.join('\n'), undefined, 50).edits).toHaveLength(1)
})

test('an empty or broken rollout gives no fields', () => {
  expect(parseRollout('not json\n')).toEqual({ requests: [], steps: [], commandCount: 0 })
})

test('job states map to item states', () => {
  expect(jobEnd('running')).toBeUndefined()
  expect(jobEnd('queued')).toBeUndefined()
  expect(jobEnd('completed')).toBe('done')
  expect(jobEnd('failed')).toBe('failed')
  expect(jobEnd('cancelled')).toBe('stopped')
})

test('a job without a session file keeps the job fields and leaves no undefined keys', () => {
  const item = codexItem(
    { id: 'task-1', summary: 'Review pkg/db\nmore', startedAt: '1970-01-01T00:00:01.000Z' },
    undefined,
  )
  expect(item).toEqual({
    id: 'codex:task-1',
    kind: 'codex',
    title: 'Review pkg/db',
    status: 'running',
    startedAt: 1000,
    detail: { jobId: 'task-1' },
  })
})

const HOME = '/home/u'
const STATE = `${HOME}/.claude/plugins/data/codex-openai-codex/state`
const WS = `${STATE}/rabe-0123456789abcdef`
const OTHER = `${STATE}/other-fedcba9876543210`
const SESSIONS = `${HOME}/.codex/sessions/1970/01/01`
const ROLLOUT_PATH = `${SESSIONS}/rollout-1970-01-01T00-00-01-th-1.jsonl`
const PLUGIN = `${HOME}/.claude/plugins/cache/openai-codex/codex/1.0.6`

type Job = Record<string, unknown>

function job(over: Job = {}): Job {
  return {
    id: 'task-1',
    kindLabel: 'rescue',
    title: 'Codex Task',
    summary: 'Review pkg/auth after the logger migration.',
    workspaceRoot: '/work/rabe',
    sessionId: 'sess-1',
    status: 'running',
    startedAt: '1970-01-01T00:00:01.000Z',
    logFile: `${WS}/jobs/task-1.log`,
    threadId: 'th-1',
    request: { model: 'gpt-6.1-sol', effort: 'high', prompt: 'Review pkg/auth.' },
    ...over,
  }
}

type World = {
  files: Map<string, { text: string; mtimeMs: number; size?: number }>
  clock: MockClock
  calls: string[]
  hold?: Promise<void>
}

function world(on: On, files: Record<string, string | object>, mtimeMs = 5000): World {
  const held: World = { files: new Map(), clock: mock.clock(on, { now: 10_000 }), calls: [] }
  for (const [path, text] of Object.entries(files)) {
    held.files.set(path, { text: typeof text === 'string' ? text : JSON.stringify(text), mtimeMs })
  }
  mock.env(on, { HOME })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.id', async () => ({ value: 'sess-1' }))
  on('session.usage', async () => ({ value: { startedAt: 1000, rateLimits: [] } }) as never)
  on('fs.list', async (_$, e) => {
    held.calls.push(`list ${e.path}`)
    await held.hold
    const prefix = `${e.path}/`
    const names = new Set<string>()
    for (const path of held.files.keys()) {
      if (path.startsWith(prefix)) names.add(path.slice(prefix.length).split('/')[0] as string)
    }
    if (names.size === 0) return { deny: 'ENOENT' }
    return {
      value: [...names].map(name => ({
        name,
        kind: held.files.has(prefix + name) ? ('file' as const) : ('dir' as const),
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  on('fs.stat', async (_$, e) => {
    held.calls.push(`stat ${e.path}`)
    if (e.path.includes('hang')) return new Promise<never>(() => {})
    const file = held.files.get(e.path)
    if (!file) return { deny: 'ENOENT' }
    return {
      value: {
        kind: 'file',
        size: file.size ?? file.text.length,
        mtimeMs: file.mtimeMs,
        isLink: false,
      },
    }
  })
  on('fs.read', async (_$, e) => {
    const file = held.files.get(e.path)
    return file ? { value: file.text } : { deny: 'ENOENT' }
  })
  return held
}

function watchItems(on: On): RabeItem[][] {
  const writes: RabeItem[][] = []
  on('state.set', async (_$, e, next) => {
    if (e.plugin === 'rabe' && e.key === 'items') writes.push(e.value as RabeItem[])
    return next(e)
  })
  return writes
}

// Rabe's own price table, as fs.read answers it for the plugin's folder.
function prices(on: On): void {
  on('fs.read', { path: /\/data\/prices\.csv$/ }, async () => ({
    value: 'provider,model,input,output,cache_read\nopenai,gpt-6.1-sol,2,10,0.1\n',
  }))
}

async function startAndTick($: Engine, w: World) {
  await $.session.start({ cwd: '/work/rabe', surface: 'terminal', isInteractive: true })
  await w.clock.advance(2000)
}

test('a running job of this session becomes a live codex item', async ($, on) => {
  const writes = watchItems(on)
  const w = world(on, {
    [`${WS}/state.json`]: {
      jobs: [
        { id: 'task-1', status: 'running' },
        job({ id: 'task-x', sessionId: 'other' }),
        { id: 'task-y', status: 'running' },
      ],
    },
    [`${WS}/jobs/task-1.json`]: job(),
    [`${WS}/jobs/task-y.json`]: job({ id: 'task-y', sessionId: 'other' }),
    [`${OTHER}/state.json`]: { jobs: [job({ id: 'task-old' })] },
    [ROLLOUT_PATH]: ROLLOUT,
  })
  w.files.set(`${OTHER}/state.json`, { text: '{"jobs":[]}', mtimeMs: 10 })
  await startAndTick($, w)
  const items = writes.at(-1) ?? []
  expect(items.map(item => item.id)).toEqual(['codex:task-1'])
  expect(items[0]).toMatchObject({
    kind: 'codex',
    status: 'running',
    title: 'Review pkg/auth after the logger migration.',
    startedAt: 1000,
    tokens: { input: 25000, output: 3000, cached: 18000 },
    detail: {
      jobId: 'task-1',
      jobKind: 'rescue',
      threadId: 'th-1',
      model: 'gpt-6.1-sol',
      effort: 'high',
      sandbox: 'read-only',
      prompt: 'Review pkg/auth.',
      workspaceRoot: '/work/rabe',
      logPath: `${WS}/jobs/task-1.log`,
      sessionPath: ROLLOUT_PATH,
      sessionUpdatedAt: 5000,
      commandCount: 1,
    },
  })
})

test('a job id that is not a plain file name is skipped', async ($, on) => {
  const writes = watchItems(on)
  // each id has a job file where the unchecked path would lead
  const ids = ['../../x', 'a/b', '..', '-rf', '.hidden']
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: ids.map(id => ({ id, status: 'running' })) },
    ...Object.fromEntries(ids.map(id => [`${WS}/jobs/${id}.json`, job({ id })])),
    [`${STATE}/x.json`]: job({ id: '../../x' }),
  })
  await startAndTick($, w)
  expect(writes.flat().filter(item => item.kind === 'codex')).toEqual([])
})

test('a job costs its requests at the price of their model', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  // 7k uncached at 2, 18k cached at 0.1, 3k out at 10, per million
  expect(writes.at(-1)?.[0]?.costUsd).toBe((7000 * 2 + 18000 * 0.1 + 3000 * 10) / 1e6)
})

test('a job that resumed a thread costs only its own requests', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const resumed = RESUMED.map(one => one.replace('gpt-6-luna', 'gpt-6.1-sol')).join('\n')
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: resumed,
  })
  await startAndTick($, w)
  // 20 input at 2 and 1 output at 10 per million: the first job's request is not counted
  expect(Math.round((writes.at(-1)?.[0]?.costUsd ?? 0) * 1e6)).toBe(20 * 2 + 10)
})

test('a finished job found after a later job resumed its thread keeps only its own turns', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const resumed = [
    ...RESUMED.map(one => one.replace('gpt-6-luna', 'gpt-6.1-sol')),
    timed(1130, change('completed', { '/work/b.ts': { type: 'add' } }, 1130)),
  ].join('\n')
  const done = job({
    status: 'completed',
    startedAt: '1970-01-01T00:00:00.050Z',
    completedAt: '1970-01-01T00:00:00.500Z',
  })
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [done] },
    [`${WS}/jobs/task-1.json`]: done,
    [ROLLOUT_PATH]: resumed,
  })
  await startAndTick($, w)
  const item = writes.at(-1)?.[0]
  expect(item?.tokens).toEqual({ input: 10, output: 1, cached: 0 })
  // 10 input at 2 and 1 output at 10 per million
  expect(Math.round((item?.costUsd ?? 0) * 1e6)).toBe(10 * 2 + 10)
  expect(item?.detail).not.toHaveProperty('edits')
})

test('a job whose session file is gone by its end has no cost, not the last one seen', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  expect(writes.at(-1)?.[0]?.costUsd).toBeDefined()
  w.files.delete(ROLLOUT_PATH)
  w.files.set(`${WS}/jobs/task-1.json`, {
    text: JSON.stringify(job({ status: 'completed', completedAt: '1970-01-01T00:00:09.000Z' })),
    mtimeMs: 6000,
  })
  await w.clock.advance(2000)
  expect(writes.at(-1)?.[0]).toMatchObject({ status: 'done', detail: { isSessionMissing: true } })
  expect(writes.at(-1)?.[0]?.costUsd).toBeUndefined()
})

test('a running job whose session file goes away or cannot be read loses its cost', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  expect(writes.at(-1)?.[0]?.costUsd).toBeDefined()
  w.files.delete(ROLLOUT_PATH)
  await w.clock.advance(2000)
  expect(writes.at(-1)?.[0]?.status).toBe('running')
  expect(writes.at(-1)?.[0]?.costUsd).toBeUndefined()
  // back with new requests: priced again
  w.files.set(ROLLOUT_PATH, { text: ROLLOUT, mtimeMs: 6000 })
  await w.clock.advance(2000)
  expect(writes.at(-1)?.[0]?.costUsd).toBeDefined()
  // grown past 4 MiB and the tail fails: the file cannot be read
  w.files.set(ROLLOUT_PATH, { text: ROLLOUT, mtimeMs: 7000, size: 5 * 1024 * 1024 })
  await w.clock.advance(2000)
  expect(writes.at(-1)?.[0]?.costUsd).toBeUndefined()
})

test('an unchanged session file causes no second write', async ($, on) => {
  const writes = watchItems(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  await w.clock.advance(4000)
  expect(writes).toHaveLength(1)
})

test('a finished job ends its item; a gone session file shows as missing', async ($, on) => {
  const writes = watchItems(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job({
      status: 'completed',
      completedAt: '1970-01-01T00:00:09.000Z',
    }),
    [`${SESSIONS}/rollout-other.jsonl`]: '',
  })
  await startAndTick($, w)
  expect(writes.at(-1)?.[0]).toMatchObject({
    status: 'done',
    endedAt: 9000,
    detail: { model: 'gpt-6.1-sol', isSessionMissing: true },
  })
})

test('a session file over 4 MiB is read with grep and tail', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: '',
  })
  w.files.set(ROLLOUT_PATH, { text: '', mtimeMs: 5000, size: 5 * 1024 * 1024 })
  const runs: string[][] = []
  const timeouts: (number | undefined)[] = []
  on('process.run', async (_$, e, next) => {
    if (e.argv[0] === 'git') return next(e)
    runs.push([...e.argv])
    timeouts.push(e.init?.timeoutMs)
    const [head, tail] = ROLLOUT.split('\n').reduce<[string[], string[]]>(
      ([h, t], one, n) => (n < 3 ? [[...h, one], t] : [h, [...t, one]]),
      [[], []],
    )
    return {
      value: {
        exitCode: 0,
        stdout: `${(e.argv[0] === 'grep' ? head : tail).join('\n')}\n`,
        stderr: '',
      },
    } as never
  })
  await startAndTick($, w)
  expect(runs.map(argv => argv[0])).toEqual(['grep', 'tail'])
  // a poll's command stops long before the default 30 seconds
  expect(timeouts.every(ms => ms !== undefined && ms <= 5000)).toBe(true)
  expect(runs.map(argv => argv.slice(-2))).toEqual([
    ['--', ROLLOUT_PATH],
    ['--', ROLLOUT_PATH],
  ])
  expect(writes.at(-1)?.[0]).toMatchObject({
    detail: { model: 'gpt-6.1-sol', isSessionPartial: true, commandCount: 1 },
  })
  // the tail misses requests, so the cost is not known
  expect(writes.at(-1)?.[0]?.tokens).toBeDefined()
  expect(writes.at(-1)?.[0]?.costUsd).toBeUndefined()
})

test('/rabe-stop cancels the job through the companion script', async ($, on) => {
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
    [`${HOME}/.claude/plugins/installed_plugins.json`]: {
      plugins: { 'codex@openai-codex': [{ installPath: PLUGIN }] },
    },
  })
  const runs: { argv: string[]; env?: Record<string, string> }[] = []
  on('process.run', async (_$, e, next) => {
    if (e.argv[0] === 'git') return next(e)
    runs.push({ argv: [...e.argv], env: e.init?.env })
    return { value: { exitCode: 0, stdout: '{}', stderr: '' } } as never
  })
  await startAndTick($, w)
  const answer = await $.command.run({ command: 'rabe-stop', args: 'codex:task-1' } as never)
  expect(runs).toEqual([
    {
      argv: [
        'node',
        `${PLUGIN}/scripts/codex-companion.mjs`,
        'cancel',
        'task-1',
        '--json',
        '--cwd',
        '/work/rabe',
      ],
      env: { CLAUDE_PLUGIN_DATA: `${HOME}/.claude/plugins/data/codex-openai-codex` },
    },
  ])
  // the answer is a transcript line the model reads: the job id, never the file's title
  expect(answer).toEqual({ text: 'Stopped codex task-1' })
})

// A stop ends the item at once, and later polls skip it: its cost stays only
// when the session file is the one it was priced from.
test('/rabe-stop keeps the cost of an unchanged session file and drops it otherwise', async ($, on) => {
  const writes = watchItems(on)
  prices(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job(), job({ id: 'task-2', threadId: 'th-1' })] },
    [`${WS}/jobs/task-1.json`]: job(),
    [`${WS}/jobs/task-2.json`]: job({ id: 'task-2', threadId: 'th-1' }),
    [ROLLOUT_PATH]: ROLLOUT,
    [`${HOME}/.claude/plugins/installed_plugins.json`]: {
      plugins: { 'codex@openai-codex': [{ installPath: PLUGIN }] },
    },
  })
  on('process.run', async (_$, e, next) =>
    e.argv[0] === 'git' ? next(e) : ({ value: { exitCode: 0, stdout: '{}', stderr: '' } } as never),
  )
  await startAndTick($, w)
  const priced = writes.at(-1)?.find(item => item.id === 'codex:task-1')?.costUsd
  expect(priced).toBeDefined()
  await $.command.run({ command: 'rabe-stop', args: 'codex:task-1' } as never)
  expect(writes.at(-1)?.find(item => item.id === 'codex:task-1')).toMatchObject({
    status: 'stopped',
    costUsd: priced,
  })
  w.files.set(ROLLOUT_PATH, { text: ROLLOUT, mtimeMs: 6000 })
  await $.command.run({ command: 'rabe-stop', args: 'codex:task-2' } as never)
  const stopped = writes.at(-1)?.find(item => item.id === 'codex:task-2')
  expect(stopped?.status).toBe('stopped')
  expect(stopped?.costUsd).toBeUndefined()
})

test('an unchanged session file keeps the model and effort it gave', () => {
  const item = codexItem({ ...job(), id: 'task-1' }, { path: ROLLOUT_PATH, updatedAt: 5000 })
  expect(item.detail).not.toHaveProperty('model')
  expect(item.detail).not.toHaveProperty('effort')
})

test('a session file that cannot be read still lets the job end', async ($, on) => {
  on('fs.read', { path: ROLLOUT_PATH }, async () => ({ deny: 'EACCES' }))
  const writes = watchItems(on)
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job({
      status: 'completed',
      completedAt: '1970-01-01T00:00:09.000Z',
    }),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  expect(writes.at(-1)?.[0]).toMatchObject({ status: 'done', endedAt: 9000 })
})

function endedShells(at: number): RabeItem[] {
  return Array.from({ length: MAX_ENDED }, (_, n) => ({
    id: `shell:s${n}`,
    kind: 'shell',
    title: `s${n}`,
    status: 'done',
    seenAt: at + n,
    endedAt: at + n,
    detail: { command: `s${n}` },
  }))
}

async function pollEnded($: Engine, on: On, heldAt: number) {
  const state = memoryState(on)
  state['rabe.items'] = { value: endedShells(heldAt), version: 1 }
  const looked: string[] = []
  on('fs.list', { path: /\/sessions\// }, async (_$, e, next) => {
    looked.push(e.path)
    return next(e)
  })
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [{ id: 'task-1', status: 'completed' }] },
    [`${WS}/jobs/task-1.json`]: job({
      status: 'completed',
      completedAt: '1970-01-01T00:00:09.000Z',
    }),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  await w.clock.advance(2000)

  return { state, looked }
}

test('a finished job older than all history held is not added back, nor its session read', async ($, on) => {
  const { state, looked } = await pollEnded($, on, 9500)
  expect(state['rabe.items']?.version).toBe(1)
  expect(looked).toEqual([])
})

test('a finished job newer than the oldest history held is added and pushes it out', async ($, on) => {
  const { state } = await pollEnded($, on, 100)
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items).toHaveLength(MAX_ENDED)
  expect(items.at(-1)).toMatchObject({ id: 'codex:task-1', status: 'done', endedAt: 9000 })
  expect(items.some(item => item.id === 'shell:s0')).toBe(false)
})

test('a job is linked to the agent whose companion call started it', async ($, on) => {
  const state = memoryState(on)
  const text = `node "${PLUGIN}/scripts/codex-companion.mjs" task "Review pkg/auth after the logger migration."`
  const forwarder: RabeItem = {
    id: 'agent:f1',
    kind: 'agent',
    title: 'forward',
    status: 'running',
    seenAt: 500,
    detail: { agentId: 'f1', toolCount: 1, codexCalls: [{ at: 900, command: 'task', text }] },
  }
  state['rabe.items'] = { value: [forwarder], version: 1 }
  const w = world(on, {
    [`${WS}/state.json`]: { jobs: [job()] },
    [`${WS}/jobs/task-1.json`]: job(),
    [ROLLOUT_PATH]: ROLLOUT,
  })
  await startAndTick($, w)
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items.map(item => [item.id, item.parentId])).toEqual([
    ['agent:f1', undefined],
    ['codex:task-1', 'agent:f1'],
  ])
  const version = state['rabe.items']?.version
  await w.clock.advance(2000)
  expect(state['rabe.items']?.version).toBe(version)
})
