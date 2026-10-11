import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { RabeItem } from '../model'
import { MAX_ENDED } from '../registry'
import { core, memoryState } from '../testing'

const JOB = {
  id: 'c1',
  cron: '*/5 * * * *',
  humanSchedule: 'every 5 minutes',
  prompt: '/babysit-prs',
}

function tools(on: On, jobs = [JOB]) {
  on(
    'tool.call',
    { tool: ['CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup'] },
    async (_$, e) => {
      if (e.tool === 'CronCreate') {
        return { result: { id: 'c1', humanSchedule: 'every 5 minutes', recurring: true } }
      }
      if (e.tool === 'CronDelete') return { result: { id: e.id } }
      if (e.tool === 'CronList') return { result: { jobs } }

      return e.tool === 'ScheduleWakeup' && e.stop
        ? { result: { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false, stopped: true } }
        : {
            result: {
              scheduledFor: 1000 + (e.tool === 'ScheduleWakeup' ? (e.delaySeconds ?? 0) * 1000 : 0),
              clampedDelaySeconds: 60,
              wasClamped: false,
            },
          }
    },
  )
}

const cron = {
  id: 'cron:c1',
  kind: 'cron',
  title: '/babysit-prs',
  status: 'running',
  seenAt: 1000,
  startedAt: 1000,
  detail: {
    jobId: 'c1',
    prompt: '/babysit-prs',
    schedule: '*/5 * * * *',
    humanSchedule: 'every 5 minutes',
  },
}

test('a CronCreate call adds a running cron job', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: '/babysit-prs' })
  expect(state['rabe.items']?.value).toEqual([cron])
})

test('a CronDelete call records that the job was deleted', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: '/babysit-prs' })
  await clock.set(2000)
  await $.tool.call({ tool: 'CronDelete', id: 'c1' })
  expect(state['rabe.items']?.value).toEqual([
    { ...cron, status: 'stopped', endedAt: 2000, detail: { ...cron.detail, isDeleted: true } },
  ])
})

test('a wakeup shows when it fires, and the next one replaces it', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  const wake = { delaySeconds: 60, reason: 'check CI', prompt: '/loop check CI', noop: false }
  await $.tool.call({ tool: 'ScheduleWakeup', ...wake })
  const first = {
    id: 'cron:wakeup-61000',
    kind: 'cron',
    title: '/loop check CI',
    status: 'running',
    seenAt: 1000,
    startedAt: 1000,
    detail: { jobId: 'wakeup-61000', prompt: '/loop check CI', scheduledFor: 61000 },
  }
  expect(state['rabe.items']?.value).toEqual([first])
  await clock.set(61000)
  await $.prompt.submit({
    text: '/loop check CI',
    origin: { kind: 'scheduled-trigger' },
    wait: false,
  })
  expect(state['rabe.items']?.value).toEqual([{ ...first, status: 'done', endedAt: 61000 }])
  await $.tool.call({ tool: 'ScheduleWakeup', ...wake, delaySeconds: 120 })
  await $.tool.call({ tool: 'ScheduleWakeup', stop: true })
  const items = state['rabe.items']?.value as { id: string; status: string }[]
  expect(items.map(item => [item.id, item.status])).toEqual([
    ['cron:wakeup-61000', 'done'],
    ['cron:wakeup-121000', 'stopped'],
  ])
})

// The texts Claude Code 2.1.295 fires for the two autonomous loops, shortened.
const RECURRING_TICK = `# Autonomous loop tick

Run the autonomous check using the loop instructions established earlier in this conversation. The recurring cron will fire the next tick automatically — do not call ScheduleWakeup from this tick.`
const DYNAMIC_TICK = `# Autonomous loop tick (dynamic pacing)

You scheduled this tick via the ScheduleWakeup tool (not a recurring cron). To keep the loop alive, call ScheduleWakeup again this turn with \`prompt\` set to the literal sentinel \`<<autonomous-loop-dynamic>>\` and \`noop\` set to \`true\` if this tick changed nothing.`

test('a fired prompt ends a due wakeup only when it is its prompt or names its sentinel', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: '<<autonomous-loop>>' })
  await $.tool.call({
    tool: 'ScheduleWakeup',
    delaySeconds: 600,
    reason: 'r',
    prompt: '<<autonomous-loop-dynamic>>',
    noop: false,
  })
  const fire = (text: string) =>
    $.prompt.submit({ text, origin: { kind: 'scheduled-trigger' }, wait: false })
  const status = () =>
    (state['rabe.items']?.value as { id: string; status: string }[]).map(one => one.status)

  // Not due yet: even its own text ends nothing.
  await fire(DYNAMIC_TICK)
  expect(status()).toEqual(['running', 'running'])

  // Due: the recurring loop's tick and other text are no evidence.
  await clock.set(601_000)
  await fire(RECURRING_TICK)
  await fire('/babysit-prs')
  expect(status()).toEqual(['running', 'running'])

  // Its own tick names its sentinel.
  await fire(DYNAMIC_TICK)
  expect(status()).toEqual(['running', 'done'])
})

test('a /loop wakeup ends on its own prompt, not on an autonomous tick', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({
    tool: 'ScheduleWakeup',
    delaySeconds: 60,
    reason: 'r',
    prompt: '/loop check CI',
    noop: false,
  })
  const fire = (text: string) =>
    $.prompt.submit({ text, origin: { kind: 'scheduled-trigger' }, wait: false })
  const status = () =>
    (state['rabe.items']?.value as { id: string; status: string }[]).map(one => one.status)
  await clock.set(61_000)
  await fire(DYNAMIC_TICK)
  await fire(RECURRING_TICK)
  expect(status()).toEqual(['running'])
  await fire('/loop check CI')
  expect(status()).toEqual(['done'])
})

test('the autonomous loop sentinel gets a plain title', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({
    tool: 'ScheduleWakeup',
    delaySeconds: 60,
    reason: 'idle',
    prompt: '<<autonomous-loop-dynamic>>',
    noop: true,
  })
  const items = state['rabe.items']?.value as { title: string }[]
  expect(items[0]?.title).toBe('autonomous loop')
})

test('at session start CronList adds jobs made before Rabe loaded', async ($, on) => {
  mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.session.start({ cwd: '/home/me/app', surface: 'terminal', isInteractive: true })
  const { startedAt: _, ...listed } = cron
  expect(state['rabe.items']?.value).toEqual([listed])
})

test('at Stop a job gone from the session crons ends, a new one is added', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  tools(on)
  core(on)
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: '/babysit-prs' })
  await $.tool.call({
    tool: 'ScheduleWakeup',
    delaySeconds: 60,
    reason: 'r',
    prompt: '/loop x',
    noop: false,
  })
  await clock.set(9000)
  await $.classic.Stop({
    stop_hook_active: false,
    session_crons: [
      { id: 'c2', schedule: '30 14 28 2 *', recurring: false, prompt: 'remind me' },
      { id: 'w1', schedule: '1 0 1 1 *', recurring: false, prompt: '/loop x' },
    ],
  })
  const items = state['rabe.items']?.value as { id: string; status: string }[]
  expect(items.map(item => [item.id, item.status])).toEqual([
    ['cron:c1', 'done'],
    ['cron:wakeup-61000', 'running'],
    ['cron:c2', 'running'],
  ])
})

const lines = { seen: 1, lines: [{ at: 1, text: 'ready' }] }
const turns = [{ index: 1, at: 1, text: 'done', tools: [] }]

// The oldest ended item is the agent, then shell s1; the cap holds exactly MAX_ENDED.
function full(): RabeItem[] {
  const ended: RabeItem[] = Array.from({ length: MAX_ENDED }, (_, n) =>
    n === 0
      ? {
          id: 'agent:a0',
          kind: 'agent',
          title: 'a0',
          status: 'done',
          seenAt: 1,
          endedAt: 1,
          detail: { agentId: 'a0' },
        }
      : {
          id: `shell:s${n}`,
          kind: 'shell',
          title: `s${n}`,
          status: 'done',
          seenAt: 1,
          endedAt: n + 1,
          detail: { command: `s${n}` },
        },
  )
  const cron = (id: string): RabeItem => ({
    id: `cron:${id}`,
    kind: 'cron',
    title: id,
    status: 'running',
    seenAt: 1,
    detail: { jobId: id, prompt: id, schedule: '* * * * *' },
  })

  return [...ended, cron('c1'), cron('c2')]
}

test('an item a hook write pushes out loses its lines and turns, though its output never changed', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const state = memoryState(on)
  state['rabe.items'] = { value: full(), version: 1 }
  state['rabe.lines'] = { value: { 'shell:s1': lines, 'shell:s5': lines }, version: 1 }
  state['rabe.turns'] = { value: { 'agent:a0': turns }, version: 1 }
  tools(on)

  // A cron job ending pushes the oldest ended item, an agent, out of the list.
  await $.tool.call({ tool: 'CronDelete', id: 'c1' })
  expect(state['rabe.turns']?.value).toEqual({})
  expect(state['rabe.lines']?.value).toEqual({ 'shell:s1': lines, 'shell:s5': lines })

  // The next one pushes out shell s1: its lines go, those of s5 stay.
  await $.tool.call({ tool: 'CronDelete', id: 'c2' })
  expect(state['rabe.lines']?.value).toEqual({ 'shell:s5': lines })
})

test('a write that drops nothing leaves lines and turns alone', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const state = memoryState(on)
  state['rabe.items'] = { value: full().slice(1), version: 1 }
  state['rabe.lines'] = { value: { 'shell:s1': lines }, version: 1 }
  state['rabe.turns'] = { value: {}, version: 1 }
  tools(on)
  await $.tool.call({ tool: 'CronDelete', id: 'c1' })
  expect(state['rabe.lines']).toEqual({ value: { 'shell:s1': lines }, version: 1 })
  expect(state['rabe.turns']).toEqual({ value: {}, version: 1 })
})

test('pruning after a write keeps the output of an item a later write added', async ($, on) => {
  mock.clock(on, { now: 5000 })
  let release = () => {}
  let reached = () => {}
  const paused = new Promise<void>(resolve => {
    reached = resolve
  })
  let gated = false
  on('state.get', { plugin: 'rabe', key: 'lines' }, async (_$, e, next) => {
    if (gated) return next(e)
    gated = true
    reached()
    await new Promise<void>(resolve => {
      release = resolve
    })
    return next(e)
  })
  const state = memoryState(on)
  state['rabe.items'] = { value: full(), version: 1 }
  state['rabe.lines'] = { value: { 'shell:s1': lines }, version: 1 }
  state['rabe.turns'] = { value: { 'agent:a0': turns }, version: 1 }
  tools(on)

  // The write that ends c1 lands and drops agent a0. Before it prunes, another
  // task is added and stores its output, and a0 runs again under the same id.
  const ending = $.tool.call({ tool: 'CronDelete', id: 'c1' })
  await paused
  const items = state['rabe.items']?.value as RabeItem[]
  expect(items.some(item => item.id === 'agent:a0')).toBe(false)
  const added = { ...items[1], id: 'shell:new' } as RabeItem
  const back = { ...full()[0], status: 'running' } as RabeItem
  state['rabe.items'] = { value: [...items, added, back], version: 9 }
  state['rabe.lines'] = { value: { 'shell:s1': lines, 'shell:new': lines }, version: 9 }
  state['rabe.turns'] = { value: { 'agent:a0': turns, 'shell:new': turns }, version: 9 }
  release()
  await ending
  expect(state['rabe.lines']?.value).toEqual({ 'shell:s1': lines, 'shell:new': lines })
  expect(state['rabe.turns']?.value).toEqual({ 'agent:a0': turns, 'shell:new': turns })
})

test('pruning after a write still drops the entries of the item it dropped', async ($, on) => {
  mock.clock(on, { now: 5000 })
  const state = memoryState(on)
  state['rabe.items'] = { value: full(), version: 1 }
  state['rabe.turns'] = { value: { 'agent:a0': turns, 'shell:new': turns }, version: 1 }
  tools(on)
  await $.tool.call({ tool: 'CronDelete', id: 'c1' })
  expect(state['rabe.turns']?.value).toEqual({ 'shell:new': turns })
})
