import { expect, test } from 'claude-code/testing'

import type { RabeCodexCall } from '../types'
import { companionCall, companionOutput, linkForwarders } from './forwarders'
import type { RabeItem } from './model'

const SCRIPT =
  'node "/home/me/.claude/plugins/cache/openai-codex/codex/1.0.6/scripts/codex-companion.mjs"'

test('a companion call that starts a job names its subcommand', () => {
  expect(companionCall(`${SCRIPT} task --write "Fix the pool"`)).toEqual({
    command: 'task',
    text: `${SCRIPT} task --write "Fix the pool"`,
  })
  expect(companionCall(`${SCRIPT} adversarial-review --base main`)?.command).toBe(
    'adversarial-review',
  )
  expect(companionCall(`node codex-companion.mjs review`)?.command).toBe('review')
  expect(companionCall(`${SCRIPT} status --json`)).toBeUndefined()
  expect(companionCall(`${SCRIPT} task-resume-candidate --json`)).toBeUndefined()
  expect(companionCall('echo task')).toBeUndefined()
  expect(companionCall(`${SCRIPT} task "${'x'.repeat(900)}"`)?.text).toHaveLength(600)
})

test('the output names the background job, or the thread of a foreground run', () => {
  expect(
    companionOutput(
      'Codex Task started in the background as task-mg1-ab12cd. Check /codex:status task-mg1-ab12cd for progress.\n',
    ),
  ).toEqual({ jobId: 'task-mg1-ab12cd' })
  expect(
    companionOutput('[codex] Starting Codex task thread.\n[codex] Thread ready (01a0-b3e6).\nDone'),
  ).toEqual({ threadId: '01a0-b3e6' })
  expect(companionOutput('nothing here')).toEqual({})
})

const NOW = 1_000_000

const forwarder = (id: string, calls: RabeCodexCall[]): RabeItem => ({
  id: `agent:${id}`,
  kind: 'agent',
  title: `forward ${id}`,
  status: 'running',
  seenAt: NOW,
  detail: { agentId: id, toolCount: calls.length, codexCalls: calls },
})

const job = (id: string, extra: Partial<RabeItem & { kind: 'codex' }> = {}, detail = {}) =>
  ({
    id: `codex:${id}`,
    kind: 'codex',
    title: 'Fix the pool',
    status: 'running',
    seenAt: NOW,
    startedAt: NOW + 500,
    ...extra,
    detail: { jobId: id, jobKind: 'rescue', ...detail },
  }) as RabeItem

const call = (extra: Partial<RabeCodexCall> = {}): RabeCodexCall => ({
  at: NOW,
  command: 'task',
  text: `${SCRIPT} task --write "Fix the pool"`,
  ...extra,
})

const parentOf = (items: RabeItem[], id: string) => items.find(one => one.id === id)?.parentId

test('a background launch links its job by id', () => {
  const items = [forwarder('f1', [call({ jobId: 'j1', endedAt: NOW + 50 })]), job('j1')]
  expect(parentOf(linkForwarders(items), 'codex:j1')).toBe('agent:f1')
})

test('a foreground run in flight links the job it started by kind, time and prompt', () => {
  const items = [forwarder('f1', [call()]), job('j1')]
  expect(parentOf(linkForwarders(items), 'codex:j1')).toBe('agent:f1')
  const quoted = `${SCRIPT} task "Don\\'t \\"break\\"\n   the pool"`
  const odd = [
    forwarder('f1', [call({ text: quoted })]),
    job('j1', { title: `Don't "break" the pool` }),
  ]
  expect(parentOf(linkForwarders(odd), 'codex:j1')).toBe('agent:f1')
  const cut = [
    forwarder('f1', [call({ text: `${SCRIPT} task "${'a'.repeat(120)}"` })]),
    job('j1', { title: `${'a'.repeat(93)}...` }),
  ]
  expect(parentOf(linkForwarders(cut), 'codex:j1')).toBe('agent:f1')
})

test('a finished foreground run links the job of its thread', () => {
  const done = call({
    endedAt: NOW + 9000,
    threadId: 'th1',
    text: `${SCRIPT} task --prompt-file p`,
  })
  const items = [forwarder('f1', [done]), job('j1', {}, { threadId: 'th1' })]
  expect(parentOf(linkForwarders(items), 'codex:j1')).toBe('agent:f1')
  const other = [forwarder('f1', [done]), job('j1', {}, { threadId: 'th2' })]
  expect(linkForwarders(other)).toBe(other)
})

test('without proof a job keeps no parent and the list stays the same', () => {
  const cases: RabeItem[][] = [
    // another prompt
    [forwarder('f1', [call()]), job('j1', { title: 'Something else' })],
    // started before the call
    [forwarder('f1', [call()]), job('j1', { startedAt: NOW - 1 })],
    // after the call returned
    [forwarder('f1', [call({ endedAt: NOW + 100 })]), job('j1')],
    // another kind of job
    [forwarder('f1', [call()]), job('j1', {}, { jobKind: 'review' })],
    // kind or start not known
    [forwarder('f1', [call()]), job('j1', {}, { jobKind: undefined })],
    [forwarder('f1', [call()]), job('j1', { startedAt: undefined })],
    // two forwarders could have started it
    [forwarder('f1', [call()]), forwarder('f2', [call()]), job('j1')],
    // one call, two jobs that fit
    [forwarder('f1', [call()]), job('j1'), job('j2')],
    // the background launch named another job
    [forwarder('f1', [call({ jobId: 'j9' })]), job('j1')],
  ]
  for (const items of cases) expect(linkForwarders(items)).toBe(items)
})

test('a second job that fits the same call drops the link: no guess', () => {
  const items = [
    forwarder('f1', [call()]),
    job('j1', { parentId: 'agent:f1' }),
    job('j2', { startedAt: NOW + 900 }),
  ]
  const out = linkForwarders(items)
  expect(parentOf(out, 'codex:j1')).toBeUndefined()
  expect(parentOf(out, 'codex:j2')).toBeUndefined()
})

// The main session started a job with the forwarder's prompt before the
// forwarder's own job showed: the prompt linked the wrong one.
test('the thread a call returns moves its link to the job it started', () => {
  const main = job('jm', { parentId: 'agent:f1' }, { threadId: 'th-main' })
  const own = job('jf', { startedAt: NOW + 900 }, { threadId: 'th-own' })
  const done = call({ endedAt: NOW + 9000, threadId: 'th-own' })
  const out = linkForwarders([forwarder('f1', [done]), main, own])
  expect(parentOf(out, 'codex:jm')).toBeUndefined()
  expect(parentOf(out, 'codex:jf')).toBe('agent:f1')
  expect(linkForwarders(out)).toBe(out)
})

test('the job id a background launch returns moves its link to that job', () => {
  const main = job('jm', { parentId: 'agent:f1' })
  const own = job('jf', { startedAt: NOW + 900 })
  const done = call({ endedAt: NOW + 950, jobId: 'jf' })
  const out = linkForwarders([forwarder('f1', [done]), main, own])
  expect(parentOf(out, 'codex:jm')).toBeUndefined()
  expect(parentOf(out, 'codex:jf')).toBe('agent:f1')
})
