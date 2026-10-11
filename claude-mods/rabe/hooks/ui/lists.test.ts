import { expect, test } from 'claude-code/testing'

import type { RabeItem } from '../model'
import { C } from './cells/palette'

import {
  ALL,
  babysit,
  ci,
  dev,
  explore,
  flow,
  lint,
  NOW,
  plan,
  review,
  reviewed,
  verify,
} from './fixtures'
import {
  bandRows,
  bar,
  byParent,
  byTokens,
  costLine,
  forwarderOf,
  grouped,
  groupNote,
  kept,
  matches,
  nameSpans,
  nextAt,
  orderOf,
  phaseProgress,
  phases,
  previousOf,
  share,
  shown,
  stable,
  timeLabel,
  totals,
  touched,
  tree,
  treeOf,
  withForwarder,
  worktreeRows,
} from './lists'

test('groups put failed first and running before ended', () => {
  const groups = grouped(ALL)
  expect(groups.map(g => g.id)).toEqual(['failed', 'agents', 'shells', 'monitors', 'cron'])
  expect(groups[0]?.items).toEqual([lint])
  expect(groups[1]?.items.at(-1)).toBe(plan)
  expect(groupNote('agents', groups[1]?.items ?? [])).toBe(
    '4 running · 2 ended · 4 claude · 1 codex · 1 workflow',
  )
  expect(groupNote('shells', [dev, { ...dev, status: 'done' }])).toBe('1 running · 1 ended')
})

test('a held order keeps rows in place: new items go to their kind group after the held rows, status changes move nothing', () => {
  const order = orderOf(ALL)
  expect(order.failed).toEqual([lint.id])
  expect(order.agents?.at(-1)).toBe(plan.id)
  expect(order.cost?.[0]).toBe(explore.id)
  const ended = ALL.map(item =>
    item === dev ? { ...dev, status: 'failed' as const, endedAt: NOW } : item,
  )
  const fresh: RabeItem = { ...dev, id: 'shell:new', title: 'new', startedAt: NOW }
  const older: RabeItem = { ...dev, id: 'shell:old', title: 'old', startedAt: NOW - 99 * 60_000 }
  const groups = grouped([...ended, fresh, older], order)
  expect(groups.find(g => g.id === 'failed')?.items).toEqual([lint])
  expect(groups.find(g => g.id === 'shells')?.items.map(item => item.id)).toEqual([
    dev.id,
    fresh.id,
    older.id,
  ])
  expect(
    grouped(ended)
      .find(g => g.id === 'failed')
      ?.items.map(item => item.id),
  ).toEqual([dev.id, lint.id])
})

test('stable sorts a list nobody has seen and keeps a held one', () => {
  const sort = (list: RabeItem[]) => list.toSorted((a, b) => a.seenAt - b.seenAt)
  expect(stable([dev, ci, babysit], undefined, sort)).toEqual([dev, babysit, ci])
  expect(stable([dev, ci, babysit], [ci.id], sort)).toEqual([ci, dev, babysit])
})

test('byParent puts the shells of the main session first, then a block per agent', () => {
  const mine: RabeItem = { ...dev, id: 'shell:m', parentId: explore.id }
  const theirs: RabeItem = { ...ci, id: 'monitor:w', parentId: verify.id }
  const lost: RabeItem = { ...dev, id: 'shell:l', parentId: 'agent:gone' }
  const blocks = byParent([mine, dev, theirs, lost, ci], ALL)
  expect(blocks.map(block => [block.title, block.items.map(item => item.id)])).toEqual([
    ['', [dev.id, ci.id]],
    ['Explore verifyToken', [mine.id]],
    ['review-changes › verify:db.ts', [theirs.id]],
    ['agent n/a', [lost.id]],
  ])
  expect(blocks[1]?.parent).toBe(explore)
  expect(byParent([dev], ALL).map(block => block.title)).toEqual([''])
})

test('time labels say running time, age, the next run or n/a', () => {
  expect(timeLabel(explore, NOW)).toBe('1m12s')
  expect(timeLabel(dev, NOW)).toBe('≥ 40m')
  expect(timeLabel(lint, NOW)).toBe('2m ago')
  expect(timeLabel(babysit, NOW)).toBe('next 10:55')
  expect(timeLabel({ ...plan, endedAt: undefined }, NOW)).toBe('n/a')
})

// A countdown in m:ss (`next 15:44`) read like a clock time that went back on
// each drawing; the next run is its clock time, strictly after now.
test('the next run of a cron job is its clock time, the same all through a minute', () => {
  for (const s of [0, 1, 30, 59]) expect(nextAt(babysit, NOW + s * 1000)).toBe('10:55')
  expect(nextAt(babysit, NOW + 3 * 60_000 - 1)).toBe('10:55')
  expect(nextAt(babysit, NOW + 3 * 60_000)).toBe('11:00')
  const wakeup = { ...babysit, detail: { jobId: 'wakeup-1', prompt: 'go', scheduledFor: NOW } }
  expect(nextAt(wakeup as RabeItem, NOW - 60_000)).toBe('10:52')
  expect(nextAt(wakeup as RabeItem, NOW)).toBe('due')
  expect(timeLabel(wakeup as RabeItem, NOW + 5_000)).toBe('due')
})

test('names add the port and the exit code of shells', () => {
  expect(nameSpans(dev)).toEqual([
    ['bun run dev', {}],
    [' :5173', { fg: C.blue }],
  ])
  expect(nameSpans(lint)).toEqual([
    ['bun run lint', {}],
    [' exit 2', { fg: C.red }],
  ])
})

test('search matches title, kind and command', () => {
  expect(matches(dev, 'DEV')).toBe(true)
  expect(matches(review, 'codex')).toBe(true)
  expect(matches(ci, 'gh run')).toBe(true)
  expect(matches(ci, 'nope')).toBe(false)
})

test('the band counts each kind that runs, failed first', () => {
  const rows = bandRows(ALL, NOW)
  expect(rows.map(row => [row.kind, row.glyph, row.count])).toEqual([
    ['shell', '✗', 1],
    ['agent', '◐', 2],
    ['codex', '◐', 1],
    ['workflow', '⧉', 1],
    ['shell', '▶', 1],
    ['monitor', '◉', 1],
    ['cron', '⟳', 1],
  ])
  expect(bandRows([{ ...lint, endedAt: NOW - 11 * 60_000 }], NOW)).toEqual([])
})

test('agent group note splits running and ended counts like the other groups', () => {
  expect(groupNote('agents', [explore, review, plan])).toBe(
    '2 running · 1 ended · 2 claude · 1 codex',
  )
})

test('cost totals sum tokens and dollars and count unknowns', () => {
  expect(totals(ALL)).toMatchObject({ tokens: 91_000, unknown: 2, codex: 0.09 })
  expect(byTokens(ALL).slice(0, 3)).toEqual([explore, review, verify])
  expect(share(ALL, explore)).toBe('45%')
  expect(share(ALL, plan)).toBe('n/a')
})

test('a worker with tokens but no price makes its side and the sum n/a, not smaller', () => {
  const unpriced = ALL.map(item => (item.id === verify.id ? { ...item, costUsd: undefined } : item))
  expect(totals(unpriced)).toEqual({ tokens: 91_000, unknown: 2, codex: 0.09 })
  expect(costLine(unpriced)).toBe('session n/a · bg 91k tok, 20% cached')
})

test('a worker without a dollar amount, tokens or not, makes its side n/a', () => {
  // plan and review:bugs ended without token data: what they spent is unknown
  const priced = ALL.filter(item => item.id !== plan.id && item.id !== reviewed.id)
  expect(totals(priced)).toMatchObject({ usd: 0.31, claude: 0.22, codex: 0.09 })
  expect(totals(ALL)).toEqual({ tokens: 91_000, unknown: 2, codex: 0.09 })
  // a Codex job whose session file is gone
  const gone = { ...review, costUsd: undefined, tokens: undefined } as RabeItem
  expect(totals([...priced.filter(item => item.id !== review.id), gone])).toEqual({
    tokens: 63_000,
    unknown: 1,
    claude: 0.22,
  })
})

test('without any dollar amount the cost is n/a, not $0.00', () => {
  const unpriced = ALL.map(({ costUsd: _, ...item }) => item as RabeItem)
  expect(totals(unpriced)).toEqual({ tokens: 91_000, unknown: 2 })
  expect(costLine(unpriced)).toBe('session n/a · bg 91k tok, 20% cached')
  expect(costLine(unpriced, 0.41)).toBe('session ≈ $0.41 · bg 91k tok, 20% cached')
})

test('the band reports the cached share of background tokens', () => {
  expect(
    costLine([{ ...explore, tokens: { input: 457_000, output: 59_000, cached: 417_000 } }], 0.16),
  ).toBe('session ≈ $0.16 · bg 516k tok, 81% cached')
})

test('workflow phases follow the agents in them', () => {
  expect(phases(ALL, flow).map(p => [p.name, p.state, p.agents.length])).toEqual([
    ['Review', 'done', 1],
    ['Verify', 'running', 1],
    ['Report', 'waiting', 0],
  ])
  expect(phaseProgress(ALL, flow)).toBe('Verify 2/3')
})

test('the tree nests items under their parent', () => {
  expect(
    tree([flow, verify, reviewed, dev]).map(line => `${line.prefix}${line.item.title}`),
  ).toEqual(['├─ review-changes', '│  ├─ verify:db.ts', '│  └─ review:bugs', '└─ bun run dev'])
})

test('a bar marks the part of the window an item ran', () => {
  expect(bar(0, 50, 0, 100, 10)).toBe('█████     ')
  expect(bar(99, 100, 0, 100, 4)).toBe('   █')
})

const TREES = [
  { path: '/repo', branch: 'main', isMain: true },
  { path: '/repo/.worktrees/fix', branch: 'fix/login' },
  { path: '/repo/.worktrees/fix/inner', isDetached: true },
]

test('a path belongs to the worktree with the longest matching prefix', () => {
  expect(treeOf('/repo/src/a.ts', TREES)?.path).toBe('/repo')
  expect(treeOf('/repo/.worktrees/fix/src/a.ts', TREES)?.path).toBe('/repo/.worktrees/fix')
  expect(treeOf('/repo/.worktrees/fix/inner/a.ts', TREES)?.path).toBe('/repo/.worktrees/fix/inner')
  expect(treeOf('/repo/.worktrees/fixed/a.ts', TREES)?.path).toBe('/repo')
  expect(treeOf('/repo/.worktrees/fix', TREES)?.path).toBe('/repo/.worktrees/fix')
  expect(treeOf('/tmp/a.ts', TREES)).toBeUndefined()
  expect(treeOf('src/a.ts', TREES)).toBeUndefined()
})

// Windows: git prints C:/…, the tools pass C:\…, and case does not count.
test('a Windows path belongs to its worktree whatever its slashes and case', () => {
  const trees = [
    { path: 'C:/Users/me/repo', branch: 'main', isMain: true },
    { path: 'C:/Users/me/repo/.worktrees/fix', branch: 'fix' },
    { path: '//host/share/repo', branch: 'unc' },
  ]
  expect(treeOf('C:\\Users\\me\\repo\\src\\a.ts', trees)?.branch).toBe('main')
  expect(treeOf('c:\\users\\ME\\Repo\\.worktrees\\fix\\a.ts', trees)?.branch).toBe('fix')
  expect(treeOf('\\\\host\\share\\repo\\a.ts', trees)?.branch).toBe('unc')
  expect(treeOf('C:\\Users\\me\\repo2\\a.ts', trees)).toBeUndefined()
  // a POSIX path keeps its case
  expect(treeOf('/Repo/a.ts', [{ path: '/repo' }])).toBeUndefined()
  const path = 'C:\\Users\\me\\repo\\src\\a.ts'
  const agent = { ...explore, detail: { agentId: 'a1', edits: [{ path, at: NOW }] } } as RabeItem
  const [file] = touched([agent], [{ path: 'c:/users/me/repo/src/a.ts', at: NOW + 1 }], '', trees)
  expect(file).toMatchObject({ rel: 'src\\a.ts', isConflict: true, tree: { branch: 'main' } })
})

test('with git each file is relative to its worktree, also a main session file', () => {
  const main = [
    { path: '/repo/.worktrees/fix/src/login.ts', at: NOW },
    { path: '/repo/src/app.ts', at: NOW + 1 },
    { path: '/tmp/out.txt', at: NOW + 2 },
  ]
  const files = touched([], main, '/repo', TREES)
  expect(files.map(file => [file.rel, file.tree?.path])).toEqual([
    ['src/login.ts', '/repo/.worktrees/fix'],
    ['src/app.ts', '/repo'],
    ['/tmp/out.txt', undefined],
  ])
  expect(touched([], main, '/repo').map(file => file.rel)).toEqual([
    '.worktrees/fix/src/login.ts',
    'src/app.ts',
    '/tmp/out.txt',
  ])
})

test('without git the worktrees come from agent metadata, the main tree counted', () => {
  expect(worktreeRows(ALL, [], undefined, '/repo')).toEqual({
    rows: [
      { name: '.claude/worktrees/pkg-db', branch: 'worktree-agent-a1', who: [explore.title] },
      { name: 'main tree', who: [plan.title] },
    ],
    unknown: ALL.filter(
      item => item.kind === 'agent' && !item.detail.cwd && !item.detail.worktreePath,
    ).length,
  })
  expect(worktreeRows([], [])).toEqual({ rows: [], unknown: 0 })
})

test('with git each worktree edited in lists its editors, the main session included', () => {
  const inFix = {
    ...plan,
    id: 'agent:f1',
    title: 'fixer',
    detail: {
      agentId: 'f1',
      cwd: '/repo',
      edits: [{ path: '/repo/.worktrees/fix/a.ts', at: NOW }],
    },
  } as RabeItem
  const idle = {
    ...plan,
    id: 'agent:i1',
    title: 'idle',
    detail: { agentId: 'i1', cwd: '/repo/.worktrees/fix' },
  } as RabeItem
  const away = {
    ...plan,
    id: 'agent:o1',
    title: 'away',
    detail: { agentId: 'o1', cwd: '/elsewhere' },
  } as RabeItem
  const main = [{ path: '/repo/.worktrees/fix/b.ts', at: NOW }]
  const items = [explore, inFix, idle, away]
  const files = touched(items, main, '/repo', TREES)
  expect(worktreeRows(items, files, TREES)).toEqual({
    rows: [
      { name: 'fix', branch: 'fix/login', who: ['fixer', 'main session', 'idle'] },
      { name: '.claude/worktrees/pkg-db', branch: 'worktree-agent-a1', who: [explore.title] },
    ],
    unknown: 1,
  })
  const own = touched([], [{ path: '/repo/x.ts', at: NOW }], '/repo', TREES)
  expect(worktreeRows([], own, TREES).rows).toEqual([
    { name: 'main tree', branch: 'main', who: ['main session'] },
  ])
  expect(worktreeRows([], [], TREES)).toEqual({ rows: [], unknown: 0 })
})

// The start event's cwd of an agent in a subfolder is no worktree: git places
// it, and without git its tree is not known.
test('an agent in a subfolder is placed in the worktree that holds it, never its own', () => {
  const api = {
    ...plan,
    id: 'agent:s1',
    title: 'api',
    detail: { agentId: 's1', cwd: '/repo/packages/api' },
  } as RabeItem
  const edited = {
    ...api,
    detail: { ...api.detail, edits: [{ path: '/repo/packages/api/x.ts', at: NOW }] },
  } as RabeItem
  const one = { rows: [{ name: 'main tree', branch: 'main', who: ['api'] }], unknown: 0 }
  expect(worktreeRows([edited], touched([edited], [], '/repo', TREES), TREES, '/repo')).toEqual(one)
  expect(worktreeRows([api], [], TREES, '/repo')).toEqual(one)
  expect(worktreeRows([api], [], undefined, '/repo')).toEqual({ rows: [], unknown: 1 })
})

test('previousOf sums a session up: counts per kind, tokens, cost, failed titles', () => {
  const summary = previousOf(ALL, NOW, { startedAt: NOW - 3_600_000, usd: 0.32 })
  expect(summary).toEqual({
    endedAt: NOW,
    startedAt: NOW - 3_600_000,
    counts: { agent: 4, codex: 1, shell: 2, monitor: 1, cron: 1, workflow: 1 },
    tokens: 91_000,
    usd: 0.32,
    failed: ['bun run lint'],
  })
  expect(previousOf([], NOW, {}, 'sess-1').sessionId).toBe('sess-1')
})

test('items Rabe saw after the open go to the group of their kind, failed or not, and keep it', () => {
  const order = orderOf([explore])
  const older: RabeItem = { ...dev, id: 'shell:a', startedAt: NOW - 9 * 60_000 }
  const newer: RabeItem = { ...dev, id: 'shell:b', startedAt: NOW - 60_000 }
  const watch: RabeItem = { ...ci, id: 'monitor:b', startedAt: NOW - 60_000 }
  const fails: RabeItem = { ...review, id: 'codex:x', status: 'failed', endedAt: NOW }
  const ids = (items: RabeItem[]) => grouped(items, order).map(g => [g.id, g.items.map(i => i.id)])
  const running = [explore, older, newer, ci, watch, fails]
  expect(ids(running)).toEqual([
    ['agents', [explore.id, fails.id]],
    ['shells', [older.id, newer.id]],
    ['monitors', [ci.id, watch.id]],
  ])
  const ended = running.map(item =>
    item === newer || item === watch ? { ...item, status: 'done' as const, endedAt: NOW } : item,
  )
  expect(ids(ended)).toEqual(ids(running))
})

// Issue #13: removed rows stay hidden for the session, also when a poll finds
// them again; an item that runs again shows.
test('kept hides removed items that ended and keeps running ones', () => {
  const removed = [lint.id, plan.id, dev.id]
  const ids = kept(ALL, removed).map(item => item.id)
  expect(ids).not.toContain(lint.id)
  expect(ids).not.toContain(plan.id)
  expect(ids).toContain(dev.id)
  expect(kept(ALL, [])).toEqual(ALL)
  expect(kept(ALL)).toEqual(ALL)
})

const call = { at: NOW - 60_000, command: 'task' as const, text: 'codex-companion.mjs task x' }

// A Claude agent that only forwarded to the Codex companion, and its job.
const forwarder = {
  ...explore,
  id: 'agent:f1',
  title: 'Codex rescue',
  tokens: { input: 4_000, output: 1_000, cached: 3_000 },
  costUsd: 0.01,
  detail: { agentId: 'f1', toolCount: 1, codexCalls: [call] },
} as RabeItem
const job: RabeItem = { ...review, parentId: forwarder.id }

test('a forwarder folds into its Codex job, which counts its tokens', () => {
  const items = [explore, forwarder, job]
  expect(shown(items)).toEqual([explore, job])
  expect(forwarderOf(job, items)).toBe(forwarder)
  const sum = withForwarder(job, items)
  expect(sum.tokens).toEqual({ input: 29_000, output: 4_000, cached: 21_000 })
  expect(Math.round((sum.costUsd ?? 0) * 100)).toBe(10)
  expect(withForwarder(explore, items)).toBe(explore)
  expect(orderOf(items).agents).toEqual([job.id, explore.id])
  expect(bandRows(items, NOW).find(row => row.kind === 'agent')?.count).toBe(1)
  // a job not linked, an agent that also did other work, or one whose tool count is not known
  const unlinked = [forwarder, review]
  const busy = { ...forwarder, detail: { ...forwarder.detail, toolCount: 3 } } as RabeItem
  const unknown = {
    ...forwarder,
    detail: { ...forwarder.detail, toolCount: undefined },
  } as RabeItem
  for (const list of [unlinked, [busy, job], [unknown, job]]) {
    expect(shown(list)).toEqual(list)
    expect(withForwarder(list[1] as RabeItem, list)).toBe(list[1])
  }
})

test('a Codex job sorts under the agent that started it and also did other work', () => {
  const busy = { ...forwarder, detail: { ...forwarder.detail, toolCount: 3 } } as RabeItem
  const child = { ...job, startedAt: NOW - 1000 } as RabeItem
  const items = [busy, explore, plan, child]
  const agents = grouped(items)
    .find(g => g.id === 'agents')
    ?.items.map(i => i.id)
  expect(agents?.indexOf(child.id)).toBe((agents?.indexOf(busy.id) ?? 0) + 1)
  expect(orderOf(items).agents).toEqual(agents)
})

test('a Codex job found while the order is held joins its agent, after the jobs held there', () => {
  const busy = { ...forwarder, detail: { ...forwarder.detail, toolCount: 3 } } as RabeItem
  const first = { ...job, id: 'codex:first' } as RabeItem
  const order = { agents: [busy.id, first.id, explore.id, plan.id] }
  const later = { ...job, id: 'codex:later' } as RabeItem
  const other = { ...job, id: 'codex:other', parentId: undefined } as RabeItem
  const agents = grouped([busy, explore, plan, first, later, other], order)
    .find(g => g.id === 'agents')
    ?.items.map(i => i.id)
  expect(agents).toEqual([busy.id, first.id, later.id, explore.id, plan.id, other.id])
  // a held job keeps its place, also once it is linked to an agent
  const linked = { ...other, parentId: plan.id } as RabeItem
  const held = { agents: [explore.id, linked.id, plan.id] }
  expect(
    grouped([explore, plan, linked], held)
      .find(g => g.id === 'agents')
      ?.items.map(i => i.id),
  ).toEqual(held.agents)
})

test('a forwarder whose cost or tokens are not known makes its job’s not known', () => {
  const blind = { ...job, tokens: undefined, costUsd: undefined } as RabeItem
  const sum = withForwarder(blind, [forwarder, blind])
  expect(sum.tokens).toBeUndefined()
  expect(sum.costUsd).toBeUndefined()
  const unpriced = { ...forwarder, tokens: undefined, costUsd: undefined } as RabeItem
  const other = withForwarder(job, [unpriced, job])
  expect(other.tokens).toBeUndefined()
  expect(other.costUsd).toBeUndefined()
})

test('only cron jobs still running count as ended with the session', () => {
  const ended = ['done', 'stopped', 'failed'].map(status => ({
    ...babysit,
    id: `cron:${status}`,
    status,
    endedAt: NOW,
  })) as RabeItem[]
  expect(previousOf([...ended, babysit], NOW, {}).counts.cron).toBe(1)
  expect(previousOf(ended, NOW, {}).counts.cron ?? 0).toBe(0)
})
