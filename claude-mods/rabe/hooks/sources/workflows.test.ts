import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { RabeItem } from '../model'
import { phaseNames } from './workflows'

const SCRIPT = `export const meta = {
  name: 'review-changes',
  description: 'Review, verify, report',
  phases: [
    { title: 'Review', detail: 'find bugs' },
    { title: "Verify" },
    { title: 'Report' },
  ],
}
await phase('Review', () => agent('look'))`

const NOTIFICATION = `<task-notification>
<task-id>w1</task-id>
<tool-use-id>toolu_1</tool-use-id>
<status>killed</status>
<summary>Workflow "review-changes" was stopped</summary>
</task-notification>`

type Held = { items?: RabeItem[] }

function engine(on: On): Held {
  const held: Held = {}
  mock.clock(on, { now: 7000 })
  on('state.set', async (_$, e, next) => {
    if (e.plugin === 'rabe' && e.key === 'items') held.items = e.value as RabeItem[]

    return next(e)
  })
  on('tool.call', async () => ({
    result: {
      status: 'async_launched' as const,
      taskId: 'w1',
      runId: 'wf_1',
      workflowName: 'review-changes',
      scriptPath: '/s/review.js',
      transcriptDir: '/s/subagents/workflows/wf_1',
    },
  }))
  on('fs.read', async (_$, e) => (e.path === '/s/review.js' ? { value: SCRIPT } : { deny: 'no' }))
  on('prompt.submit', async (_$, e) => ({ text: e.text }))

  return held
}

test('phase names come from the meta block, as objects or strings', () => {
  expect(phaseNames(SCRIPT)).toEqual(['Review', 'Verify', 'Report'])
  expect(phaseNames("export const meta = { name: 'x', phases: ['Plan', \"Build\"] }")).toEqual([
    'Plan',
    'Build',
  ])
  expect(phaseNames("export const meta = { name: 'x' }")).toBeUndefined()
})

test('phase names keep their order when strings and objects mix', () => {
  const script = "meta = { phases: ['Plan', { title: 'Build', detail: 'x' }, \"Test\"] }"
  expect(phaseNames(script)).toEqual(['Plan', 'Build', 'Test'])
})

test('a bracket inside a phase title keeps the list', () => {
  expect(phaseNames("export const meta = { phases: ['Review [fast]', 'Build'] }")).toEqual([
    'Review [fast]',
    'Build',
  ])
})

test('a workflow call adds a running run with its name, files and phases', async ($, on) => {
  const held = engine(on)
  await $.tool.call({ tool: 'Workflow', script: SCRIPT })
  expect(held.items).toEqual([
    {
      id: 'workflow:wf_1',
      kind: 'workflow',
      title: 'review-changes',
      status: 'running',
      seenAt: 7000,
      startedAt: 7000,
      detail: {
        runId: 'wf_1',
        taskId: 'w1',
        scriptPath: '/s/review.js',
        transcriptDir: '/s/subagents/workflows/wf_1',
        phases: ['Review', 'Verify', 'Report'],
      },
    },
  ])
})

test('the task notification of a run ends it', async ($, on) => {
  const held = engine(on)
  await $.tool.call({ tool: 'Workflow', script: SCRIPT })
  await $.prompt.submit({ text: NOTIFICATION, wait: false, origin: { kind: 'task-notification' } })
  expect(held.items?.[0]).toMatchObject({ status: 'stopped', endedAt: 7000 })
})

test('a run ends also when another task comes first in the same prompt', async ($, on) => {
  const held = engine(on)
  await $.tool.call({ tool: 'Workflow', script: SCRIPT })
  const shell = NOTIFICATION.replace('w1', 'bg_9').replace('killed', 'completed')
  const text = `${shell}\n${NOTIFICATION.replace('killed', 'failed')}`
  await $.prompt.submit({ text, wait: false, origin: { kind: 'task-notification' } })
  expect(held.items?.[0]).toMatchObject({ status: 'failed', endedAt: 7000 })
})

test('a prompt from the person ends nothing', async ($, on) => {
  const held = engine(on)
  await $.tool.call({ tool: 'Workflow', script: SCRIPT })
  await $.prompt.submit({ text: NOTIFICATION, wait: false, origin: { kind: 'composer' } })
  expect(held.items?.[0]?.status).toBe('running')
})
