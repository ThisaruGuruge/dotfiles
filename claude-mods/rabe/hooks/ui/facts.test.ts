import { expect, test } from 'claude-code/testing'

import { facts } from './facts'
import { ALL, babysit, ci, dev, explore, lint, NOW, plan, review, verify } from './fixtures'

test('agent facts show type, model, worktree and start; spend is in the detail', () => {
  const { title, status, lines, long } = facts(explore, NOW, ALL)
  expect(title).toBe('claude · Explore verifyToken')
  expect(status).toBe('◐ running')
  expect(lines).toEqual([
    'Explore · opus-5-5 · worktree pkg-db',
    'branch worktree-agent-a1',
    'agent a1',
    'started by main session',
    'ran 10:50:48 → now · 1m12s',
  ])
  expect(long).toBe('transcript /t/agent-a1.jsonl')
})

test('missing data shows n/a', () => {
  expect(facts(plan, NOW, ALL, '/repo').lines).toContain('Plan · n/a · main tree')
  expect(facts(dev, NOW, ALL).lines).toContain('started before Rabe loaded · start time not known')
  expect(facts(verify, NOW, ALL).lines[0]).toBe('n/a · n/a · tree n/a')
})

test('codex facts show model, effort, sandbox, job and the session file', () => {
  expect(facts(review, NOW, ALL).lines.slice(0, 2)).toEqual([
    'model gpt-6.1-sol · effort high · sandbox n/a',
    'job task-1 · thread n/a · session file read',
  ])
})

test('shell, monitor and cron facts', () => {
  expect(facts(lint, NOW, ALL).status).toBe('✗ failed · exit 2')
  expect(facts(lint, NOW, ALL).lines).toContain('exit code 2')
  expect(facts(ci, NOW, ALL).status).toBe('◉ watching')
  expect(facts(ci, NOW, ALL).lines).toContain('timeout 30m00s · 22m00s left')
  expect(facts(babysit, NOW, ALL).status).toBe('⟳ next 10:55')
  expect(facts(babysit, NOW, ALL).lines[0]).toBe('schedule */5 * * * * · every 5 minutes')
})

// Only the meta file names a worktree: a cwd that is not the session's may be
// a worktree or a subfolder, so its tree is not known.
test('an agent outside the session folder without a worktree shows tree n/a', () => {
  const sub = { ...plan, detail: { ...plan.detail, cwd: '/repo/packages/api' } } as typeof plan
  expect(facts(sub, NOW, ALL, '/repo').lines[0]).toBe('Plan · n/a · tree n/a')
  expect(facts(plan, NOW, ALL).lines[0]).toBe('Plan · n/a · tree n/a')
})
