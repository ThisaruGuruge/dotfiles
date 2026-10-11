import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { core, memoryState } from '../testing'
import { parseWorktrees } from './worktrees'

const PORCELAIN = [
  'worktree /repo',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/main',
  '',
  'worktree /repo/.worktrees/fix',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/fix/login',
  'locked',
  '',
  'worktree /tmp/spike',
  'HEAD 3333333333333333333333333333333333333333',
  'detached',
  '',
].join('\n')

test('the porcelain list gives each worktree with its branch, the first one main', () => {
  expect(parseWorktrees(PORCELAIN)).toEqual([
    { path: '/repo', branch: 'main', isMain: true },
    { path: '/repo/.worktrees/fix', branch: 'fix/login' },
    { path: '/tmp/spike', isDetached: true },
  ])
})

test('bare, quoted and relative entries are left out; nothing parses to nothing', () => {
  const text = [
    'worktree /srv/repo.git',
    'bare',
    '',
    'worktree "/repo/odd\\tname"',
    'HEAD 1',
    'branch refs/heads/odd',
    '',
    'worktree repo',
    '',
    'worktree /repo/b',
    'HEAD 2',
    'branch refs/heads/b',
  ].join('\n')
  expect(parseWorktrees(text)).toEqual([{ path: '/repo/b', branch: 'b' }])
  // Git for Windows prints drive paths with forward slashes, and UNC paths
  expect(parseWorktrees('worktree C:/Users/me/repo\nbranch refs/heads/main\n')).toEqual([
    { path: 'C:/Users/me/repo', branch: 'main', isMain: true },
  ])
  expect(parseWorktrees('worktree //host/share/repo/\n\nworktree D:/\n')).toEqual([
    { path: '//host/share/repo', isMain: true },
    { path: 'D:/' },
  ])
  expect(parseWorktrees('worktree C:repo\n')).toEqual([])
  expect(parseWorktrees('')).toEqual([])
  expect(parseWorktrees('{}')).toEqual([])
})

function git(on: On, answer: () => { exitCode: number; stdout: string } | Error) {
  const runs: string[][] = []
  on('process.run', async (_$, e) => {
    runs.push([...e.argv])
    const out = answer()
    if (out instanceof Error) throw out

    return { value: { ...out, stderr: '' } } as never
  })

  return runs
}

const START = { cwd: '/repo', surface: 'terminal', isInteractive: true } as const

test('the session start lists the worktrees and a poll writes only a change', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  core(on)
  let stdout = PORCELAIN
  const runs = git(on, () => ({ exitCode: 0, stdout }))
  await $.session.start(START)
  await clock.advance(0)
  expect(runs[0]).toEqual(['git', 'worktree', 'list', '--porcelain'])
  expect(state['rabe.worktrees']?.value).toEqual(parseWorktrees(PORCELAIN))
  expect(state['rabe.worktrees']?.version).toBe(1)
  await clock.advance(10_000)
  expect(runs.length).toBeGreaterThan(1)
  expect(state['rabe.worktrees']?.version).toBe(1)
  stdout = PORCELAIN.split('\n\n').slice(0, 2).join('\n\n')
  await clock.advance(10_000)
  expect(state['rabe.worktrees']?.value).toEqual(parseWorktrees(PORCELAIN).slice(0, 2))
  expect(state['rabe.worktrees']?.version).toBe(2)
})

test('without git, outside a repository or with a cut output nothing is written', async ($, on) => {
  const clock = mock.clock(on, { now: 1000 })
  const state = memoryState(on)
  core(on)
  const answers = [
    new Error('spawn git ENOENT'),
    { exitCode: 128, stdout: '' },
    { exitCode: 0, stdout: PORCELAIN, isStdoutTruncated: true },
  ]
  let n = 0
  git(on, () => answers[Math.min(n++, answers.length - 1)] as never)
  await $.session.start(START)
  await clock.advance(0)
  await clock.advance(10_000)
  await clock.advance(10_000)
  expect(n).toBe(3)
  expect(state['rabe.worktrees']).toBeUndefined()
})
