import { expect, test } from 'claude-code/testing'

import type { RabeEdit, RabeTurn } from '../../../types'
import type { RabeItem } from '../../model'
import { cell, lines } from '../cells/grid'
import { C, CHIP } from '../cells/palette'
import { ALL, dev, explore, gridOf, NOW, plan, review } from '../fixtures'
import { orderOf } from '../lists'
import { isPress, type Model, NO_SELECTION, type Press, rowKeys, type Size, stepRow } from '../view'
import { effectsView } from './effects'

const SIZE: Size = { columns: 90, rows: 30, surface: 'terminal', hasInput: false }

const api: RabeItem = {
  id: 'agent:a3',
  kind: 'agent',
  title: 'logger in api',
  status: 'running',
  seenAt: NOW - 60_000,
  startedAt: NOW - 60_000,
  detail: { agentId: 'a3', cwd: '/repo' },
}

// Edits the engine ran, kept on each agent; a turn's tool calls are only asked for.
const editing = (agent: RabeItem, ...edits: [at: number, ...paths: string[]][]): RabeItem =>
  ({
    ...agent,
    detail: {
      ...agent.detail,
      edits: edits.flatMap(([at, ...paths]) => paths.map(path => ({ path, at }))),
    },
  }) as RabeItem

const ITEMS = [
  ...ALL.map(item =>
    item.id === plan.id
      ? editing(plan, [NOW - 8 * 60_000, '/repo/src/logger.ts', '/repo/src/cli/main.ts'])
      : item.id === explore.id
        ? editing(explore, [NOW - 60_000, '/repo/.claude/worktrees/pkg-db/src/db/pool.ts'])
        : item,
  ),
  editing(
    api,
    [NOW - 30_000, '/repo/src/logger.ts'],
    [NOW - 10_000, '/repo/src/logger.ts', '/repo/src/api/server.ts'],
  ),
]

// Asked for, never run: the Effects tab leaves these out.
const TURNS: Record<string, RabeTurn[]> = {
  [api.id]: [
    {
      index: 1,
      at: NOW - 20_000,
      text: '',
      tools: [
        { name: 'Read', summary: '/repo/x.ts' },
        { name: 'Edit', summary: '/repo/denied.ts' },
      ],
    },
  ],
}

const MODEL: Model = { items: ITEMS, turns: TURNS, lines: {}, now: NOW, cwd: '/repo' }

test('a file edited by two agents in one tree heads the tab as a conflict', () => {
  const { grid } = gridOf(effectsView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(grid)
  expect(shown[0]).toBe(' ⚠ conflict  src/logger.ts is edited by Plan auth split and logger in api')
  expect(cell(grid, 1, 0)).toEqual(['⚠'.codePointAt(0), C.red, CHIP.failed.bg])
  expect(cell(grid, 89, 0)[2]).toBe(CHIP.failed.bg)
})

test('files touched list each file with who edited it and how often, conflicts first', () => {
  const { grid } = gridOf(effectsView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(grid)
  const head = shown.indexOf('FILES TOUCHED 4  from edits, Codex and shell commands')
  expect(head).toBeGreaterThan(0)
  expect(shown[head + 1]).toMatch(/^ {2}FILE +BY +CHANGE$/)
  expect(shown[head + 2]).toMatch(
    /^▌ src\/logger\.ts +Plan auth split, logger in api +3 changes: edit$/,
  )
  expect(shown[head + 3]).toMatch(/^ {2}src\/api\/server\.ts +logger in api +edit$/)
  expect(shown.some(line => /^ {2}src\/db\/pool\.ts +Explore verifyToken +edit$/.test(line))).toBe(
    true,
  )
  expect(shown.some(line => line.includes('x.ts') || line.includes('denied.ts'))).toBe(false)
})

test('worktrees show the path, branch and agents, then the main tree, each counted', () => {
  const shown = lines(gridOf(effectsView(MODEL, SIZE, NO_SELECTION)).grid)
  const head = shown.indexOf('WORKTREES 2  from agent metadata, running agents included')
  expect(head).toBeGreaterThan(0)
  expect(shown[head + 1]).toMatch(
    /^ {2}⎇ \.claude\/worktrees\/pkg-db +worktree-agent-a1 · Explore verifyToken$/,
  )
  expect(shown[head + 2]).toMatch(/^ {2}⎇ main tree +Plan auth split, logger in api$/)
})

const presses = (drawn: { nodes: unknown[] }) =>
  (drawn.nodes as { spans?: Parameters<typeof isPress>[0][] }[]).flatMap(node =>
    (node.spans ?? []).filter(isPress),
  )

test('each file row is a Button that opens the agent that edited it last', () => {
  const drawn = gridOf(effectsView(MODEL, SIZE, NO_SELECTION))
  const files = rowKeys(drawn).filter(key => key.startsWith('row:file:'))
  expect(files.slice(0, 2)).toEqual([
    'row:file:/repo/src/logger.ts',
    'row:file:/repo/src/api/server.ts',
  ])
  const logger = presses(drawn).find(one => one.key === 'row:file:/repo/src/logger.ts')
  expect(logger).toMatchObject({ label: 'src/logger.ts', action: { type: 'open', id: api.id } })
  const pool = presses(drawn).find(one => one.key.endsWith('/src/db/pool.ts'))
  expect(pool?.action).toEqual({ type: 'open', id: explore.id })
})

test('the selected file row has the marker and the focus; the others are dim', () => {
  const sel = { ...NO_SELECTION, selected: 'file:/repo/src/api/server.ts' }
  const drawn = gridOf(effectsView(MODEL, SIZE, sel))
  const rows = presses(drawn).filter(one => one.key.startsWith('row:'))
  expect(rows.filter(one => one.autoFocus).map(one => one.key)).toEqual([
    'row:file:/repo/src/api/server.ts',
  ])
  expect(rows.filter(one => !one.dim).map(one => one.key)).toEqual([
    'row:file:/repo/src/api/server.ts',
  ])
  const y = lines(drawn.grid).findIndex(line => line.includes('src/api/server.ts'))
  expect(cell(drawn.grid, 0, y)).toEqual(['▌'.codePointAt(0), C.orange, C.selected])
  const first = gridOf(effectsView(MODEL, SIZE, NO_SELECTION))
  const own = presses(first).find((one): one is Press => one.autoFocus === true)
  expect(own?.key).toBe('row:file:/repo/src/logger.ts')
})

test('a held order keeps the files in place as new edits come in', () => {
  const order = orderOf(ITEMS)
  const later = ITEMS.map(item =>
    item.id === api.id
      ? editing(
          api,
          [NOW - 30_000, '/repo/src/logger.ts'],
          [NOW - 10_000, '/repo/src/logger.ts', '/repo/src/api/server.ts'],
          [NOW, '/repo/src/new.ts'],
        )
      : item,
  )
  const model = { ...MODEL, items: later }
  const keys = (sel: typeof NO_SELECTION) =>
    rowKeys(effectsView(model, SIZE, sel)).filter(key => key.startsWith('row:file:'))
  expect(keys(NO_SELECTION)[1]).toBe('row:file:/repo/src/new.ts')
  expect(keys({ ...NO_SELECTION, order })).toEqual([
    ...rowKeys(effectsView(MODEL, SIZE, NO_SELECTION)).filter(key => key.startsWith('row:file:')),
    'row:file:/repo/src/new.ts',
  ])
})

test('ports show the command and the ssh line, a Button that copies; c presses the first', () => {
  const drawn = gridOf(effectsView(MODEL, SIZE, NO_SELECTION))
  const shown = lines(drawn.grid)
  const head = shown.indexOf('PORTS 1  found in shell output, may miss some')
  expect(shown[head + 1]).toBe('  :5173  bun run dev')
  expect(shown[head + 2]).toBe('   c: ssh -L 5173:localhost:5173 <your-host>')
  expect(cell(drawn.grid, 0, head + 2)[2]).toBe(CHIP.monitor.bg)
  expect(cell(drawn.grid, 89, head + 2)[2]).toBe(CHIP.monitor.bg)
  expect(presses(drawn).find(one => one.key === 'row:ssh:5173')).toMatchObject({
    label: 'ssh -L 5173:localhost:5173 <your-host>',
    hotkey: 'c',
    dim: true,
    action: { type: 'copy', text: 'ssh -L 5173:localhost:5173 <your-host>' },
  })
  expect(drawn.buttons).toEqual([])
})

test('with no edits, agents or ports each section says so', () => {
  const drawn = gridOf(
    effectsView({ items: [], turns: {}, lines: {}, now: NOW }, SIZE, NO_SELECTION),
  )
  const shown = lines(drawn.grid)
  expect(shown[0]).toBe('FILES TOUCHED 0  from edits, Codex and shell commands')
  expect(shown).toContain('  No file changed yet.')
  expect(shown).toContain('  No agents yet.')
  expect(shown).toContain('  No open port found.')
  expect(drawn.buttons).toEqual([])
})

test('a long file list is drawn whole; the tab scrolls to the ports', () => {
  const many = Array.from({ length: 40 }, (_, i) => `/repo/f${i}.ts`)
  const model = { ...MODEL, items: [editing(api, [NOW, ...many]), dev], turns: {} }
  const drawn = effectsView(model, { ...SIZE, rows: 16 }, NO_SELECTION)
  expect(rowKeys(drawn).filter(key => key.startsWith('row:file:'))).toHaveLength(40)
  expect(lines(gridOf(drawn).grid)).toContain('  :5173  bun run dev')
})

const serve = (port: number, id = `p${port}`): RabeItem =>
  ({
    ...dev,
    id: `shell:${id}`,
    detail: { command: `serve ${port}`, taskId: id, port },
  }) as RabeItem
const ten = Array.from({ length: 10 }, (_, i) => `/repo/f${i}.ts`)
const before = (key: string, drawn: Parameters<typeof rowKeys>[0]) =>
  rowKeys(drawn).slice(0, rowKeys(drawn).indexOf(key))

test('rows above a focused ssh line stay while shells and conflicts come and go', () => {
  const editors = [editing(api, [NOW, ...ten])]
  const items = [...editors, serve(5173), serve(3000)]
  const order = orderOf(items)
  const small = { ...SIZE, columns: 100, rows: 18 }
  const draw = (list: RabeItem[], selected: string) =>
    effectsView({ ...MODEL, items: list }, small, { ...NO_SELECTION, selected, order })
  const ended = (port: number) =>
    items.map(item => (item.id === `shell:p${port}` ? { ...item, status: 'done' as const } : item))
  const at5173 = before('row:ssh:5173', draw(items, 'ssh:5173'))
  expect(at5173).toHaveLength(10)
  expect(before('row:ssh:5173', draw(ended(3000), 'ssh:5173'))).toEqual(at5173)
  const at3000 = before('row:ssh:3000', draw(items, 'ssh:3000'))
  // A port whose shell ended leaves; `hold` in render.tsx keeps its row's place.
  expect(rowKeys(draw(ended(5173), 'ssh:3000'))).not.toContain('row:ssh:5173')
  const conflict = [editing(plan, [NOW, '/repo/f1.ts']), ...items]
  expect(before('row:ssh:3000', draw(conflict, 'ssh:3000'))).toEqual(at3000)
})

test('two shells on one port draw one ssh line, so the arrows reach the next port', () => {
  const items = [serve(5173, 'a'), serve(5173, 'b'), serve(3000)]
  const drawn = effectsView({ ...MODEL, items }, SIZE, NO_SELECTION)
  const keys = rowKeys(drawn)
  expect(keys).toEqual(['row:ssh:5173', 'row:ssh:3000'])
  expect(stepRow(keys, 'ssh:5173', 1)).toBe('row:ssh:3000')
  expect(lines(gridOf(drawn).grid)).toContain('PORTS 2  found in shell output, may miss some')
  const held = { ...NO_SELECTION, order: orderOf([serve(5173, 'a')]) }
  const later = [{ ...serve(5173, 'a'), status: 'done' as const }, serve(5173, 'b')]
  const again = effectsView({ ...MODEL, items: later }, SIZE, held)
  expect(rowKeys(again)).toEqual(['row:ssh:5173'])
  expect(lines(gridOf(again).grid)).toContain('  :5173  serve 5173')
})

test('a pane too short for every section scrolls to the ssh rows instead of losing them', () => {
  const shells = [5173, 3000, 8080, 9229].map((port, i) => ({
    ...dev,
    id: `shell:p${i}`,
    detail: { command: `serve ${port}`, taskId: `p${i}`, port },
  })) as RabeItem[]
  for (const [items, rows] of [
    [[...ITEMS.filter(item => item.kind !== 'shell'), dev], 7],
    [[...ITEMS.filter(item => item.kind !== 'shell'), ...shells], 13],
  ] as const) {
    const drawn = effectsView({ ...MODEL, items: [...items] }, { ...SIZE, rows }, NO_SELECTION)
    const ssh = rowKeys(drawn).filter(key => key.startsWith('row:ssh:'))
    expect(ssh).toHaveLength(items.filter(item => item.kind === 'shell').length)
  }
})

const waiting = (id: string): RabeItem =>
  ({ ...dev, id: `shell:${id}`, detail: { command: `serve ${id}`, taskId: id } }) as RabeItem
const found = (item: RabeItem, port: number, at: number): RabeItem =>
  ({ ...item, detail: { ...item.detail, port, portAt: at } }) as RabeItem

test('a port found after the open keeps its place, whichever shell found it', () => {
  const [a, b] = [waiting('a'), waiting('b')]
  const old = { ...serve(4000, 'o'), status: 'done' as const, endedAt: NOW - 1000 }
  const order = orderOf([serve(5173), a, b, old])
  const draw = (list: RabeItem[]) =>
    effectsView({ ...MODEL, items: list }, SIZE, { ...NO_SELECTION, selected: 'ssh:3000', order })
  expect(rowKeys(draw([serve(5173), a, found(b, 3000, NOW), old]))).toEqual([
    'row:ssh:5173',
    'row:ssh:3000',
  ])
  const both = [serve(5173), found(a, 8080, NOW + 1000), found(b, 3000, NOW), old]
  expect(rowKeys(draw(both))).toEqual(['row:ssh:5173', 'row:ssh:3000', 'row:ssh:8080'])
  const late = found(waiting('c'), 9229, NOW + 2000)
  expect(rowKeys(draw([...both, late])).at(-1)).toBe('row:ssh:9229')
})

test('rows found after the open go to their section after the held rows, in the order they were found', () => {
  const items = [editing(api, [NOW, '/repo/a.ts']), serve(5173), serve(3000)]
  const order = orderOf(items)
  const draw = (list: RabeItem[]) =>
    effectsView({ ...MODEL, items: list }, SIZE, { ...NO_SELECTION, selected: 'ssh:5173', order })
  const at5173 = before('row:ssh:5173', draw(items))
  const later = (fileAt: number) => [
    editing(api, [NOW, '/repo/a.ts'], [fileAt, '/repo/b.ts']),
    serve(5173),
    found(waiting('c'), 8080, NOW + 2000),
    serve(3000),
  ]
  const drawn = draw(later(NOW + 1000))
  expect(before('row:ssh:5173', drawn).filter(key => key !== 'row:file:/repo/b.ts')).toEqual(at5173)
  expect(rowKeys(drawn)).toEqual([
    'row:file:/repo/a.ts',
    'row:file:/repo/b.ts',
    'row:ssh:5173',
    'row:ssh:3000',
    'row:ssh:8080',
  ])
  expect(lines(gridOf(drawn).grid).some(line => line.includes('NEW'))).toBe(false)
  expect(rowKeys(draw(later(NOW + 3000)))).toEqual(rowKeys(drawn))
})

// The other editors: a Codex job, the main session, an agent's shell command.
const job = {
  ...review,
  detail: {
    ...review.detail,
    workspaceRoot: '/repo',
    edits: [
      { path: '/repo/src/gen.ts', at: NOW - 5000, via: 'codex', change: 'add' },
      { path: '/repo/src/old.ts', at: NOW - 4000, via: 'codex', change: 'delete' },
    ],
  },
} as RabeItem
const shell = {
  ...plan,
  detail: {
    ...(plan as typeof plan & { kind: 'agent' }).detail,
    edits: [
      { path: '/home/u/.agents/skills/demo/SKILL.md', at: NOW - 3000, via: 'shell' },
      { path: 'out/notes.md', at: NOW - 2500, via: 'shell' },
    ],
  },
} as RabeItem
const MAIN: RabeEdit[] = [
  { path: '/repo/src/gen.ts', at: NOW - 2000, via: 'edit' },
  { path: '/repo/plan.md', at: NOW - 1000, via: 'write' },
]
const OTHERS: Model = {
  items: [job, shell],
  turns: {},
  lines: {},
  now: NOW,
  edits: MAIN,
  cwd: '/repo',
}

test('files from Codex jobs, the main session and shell commands show who and how', () => {
  const shown = lines(gridOf(effectsView(OTHERS, SIZE, NO_SELECTION)).grid)
  const row = (name: string) =>
    shown.find(line => line.includes(name) && !line.includes('conflict')) ?? ''
  expect(row('src/gen.ts')).toMatch(
    /src\/gen\.ts +review auth\.ts, main session +2 changes: codex add, edit$/,
  )
  expect(row('src/old.ts')).toMatch(/src\/old\.ts +review auth\.ts +deleted · codex delete$/)
  expect(row('SKILL.md')).toMatch(/\/home\/u\/.*…demo\/SKILL\.md +Plan auth split +via shell$/)
  expect(row('notes.md')).toMatch(/ out\/notes\.md +Plan auth split +via shell$/)
  expect(row('plan.md')).toMatch(/^ {2}plan\.md +main session +write$/)
  expect(shown[0]).toBe(' ⚠ conflict  src/gen.ts is edited by review auth.ts and main session')
})

test('a long path keeps both its start and file name', () => {
  const long = editing(api, [NOW, `/outside/${'folder/'.repeat(12)}final.ts`])
  const shown = lines(
    gridOf(effectsView({ ...OTHERS, items: [long], edits: [] }, SIZE, NO_SELECTION)).grid,
  )
  expect(
    shown.some(
      line => line.includes('/outside/') && line.includes('…') && line.includes('final.ts'),
    ),
  ).toBe(true)
})

test('a main session row copies the path; a Codex row opens the job', () => {
  const drawn = effectsView(OTHERS, SIZE, NO_SELECTION)
  expect(presses(drawn).find(one => one.key === 'row:file:/repo/plan.md')?.action).toEqual({
    type: 'copy',
    text: '/repo/plan.md',
  })
  expect(presses(drawn).find(one => one.key === 'row:file:/repo/src/old.ts')?.action).toEqual({
    type: 'open',
    id: review.id,
  })
})

test('two editors of one relative path are no conflict: the cwd is not known', () => {
  const edits = [{ path: 'out/notes.md', at: NOW, via: 'shell' }]
  const one = { ...plan, detail: { ...plan.detail, edits } } as RabeItem
  const other = { ...one, id: 'agent:a9', title: 'other' } as RabeItem
  const shown = lines(
    gridOf(effectsView({ ...OTHERS, items: [one, other], edits: [] }, SIZE, NO_SELECTION)).grid,
  )
  expect(shown.some(line => line.includes('conflict'))).toBe(false)
})

test('a main session file found after the open goes after the held files', () => {
  const order = orderOf(OTHERS.items, OTHERS.edits)
  const later = {
    ...OTHERS,
    edits: [...MAIN, { path: '/repo/late.md', at: NOW, via: 'write' as const }],
  }
  const keys = rowKeys(effectsView(later, SIZE, { ...NO_SELECTION, order }))
  const held = rowKeys(effectsView(OTHERS, SIZE, { ...NO_SELECTION, order }))
  const files = held.filter(key => key.startsWith('row:file:')).length
  expect(keys).toEqual([...held.slice(0, files), 'row:file:/repo/late.md', ...held.slice(files)])
})

// Issue 19: the main session edits a file in a second worktree by its full
// path; git's worktree list places it there.
test('with git a file shows relative to its worktree, and the worktree lists the main session', () => {
  const trees = [
    { path: '/repo', branch: 'main', isMain: true },
    { path: '/repo/.worktrees/fix', branch: 'fix/login' },
  ]
  const edits: RabeEdit[] = [{ path: '/repo/.worktrees/fix/src/login.ts', at: NOW, via: 'edit' }]
  const model: Model = { items: [], turns: {}, lines: {}, now: NOW, edits, cwd: '/repo' }
  const before = lines(gridOf(effectsView(model, SIZE, NO_SELECTION)).grid)
  expect(before.some(line => line.includes('.worktrees/fix/src/login.ts'))).toBe(true)
  expect(before).toContain('WORKTREES 0  from agent metadata, running agents included')
  const shown = lines(gridOf(effectsView({ ...model, worktrees: trees }, SIZE, NO_SELECTION)).grid)
  expect(shown.find(line => line.includes('login.ts'))).toMatch(
    /^▌ src\/login\.ts +main session +edit$/,
  )
  const head = shown.indexOf('WORKTREES 1  from git and agent metadata')
  expect(head).toBeGreaterThan(0)
  expect(shown[head + 1]).toMatch(/^ {2}⎇ fix +fix\/login · main session$/)
})

test('a conflict in a git worktree names that worktree', () => {
  const trees = [
    { path: '/repo', branch: 'main', isMain: true },
    { path: '/repo/.worktrees/fix', branch: 'fix/login' },
  ]
  const path = '/repo/.worktrees/fix/a.ts'
  const agent = { ...plan, detail: { agentId: 'a2', cwd: '/repo', edits: [{ path, at: NOW }] } }
  const model: Model = {
    items: [agent as RabeItem],
    turns: {},
    lines: {},
    now: NOW,
    edits: [{ path, at: NOW + 1 }],
    cwd: '/repo',
    worktrees: trees,
  }
  const shown = lines(gridOf(effectsView(model, SIZE, NO_SELECTION)).grid)
  expect(shown[0]).toBe(' ⚠ conflict  a.ts is edited by Plan auth split and main session in fix')
})

// The banner names a tree only when it is proven to hold the file: git lists
// it, or the editor's worktree from Claude Code's metadata contains the path.
test('a conflict names the main tree only when git places the file there', () => {
  const draw = (path: string, worktrees?: Model['worktrees'], worktreePath?: string) => {
    const detail = { agentId: 'a2', cwd: '/repo', worktreePath, edits: [{ path, at: NOW }] }
    const model: Model = {
      items: [{ ...plan, detail } as RabeItem],
      turns: {},
      lines: {},
      now: NOW,
      edits: [{ path, at: NOW + 1 }],
      cwd: '/repo',
      ...(worktrees && { worktrees }),
    }
    return lines(gridOf(effectsView(model, SIZE, NO_SELECTION)).grid)[0]
  }
  const main = [{ path: '/repo', branch: 'main', isMain: true }]
  const by = ' ⚠ conflict  shared.txt is edited by Plan auth split and main session'
  expect(draw('/tmp/shared.txt', main)).toBe(by.replace('shared.txt', '/tmp/shared.txt'))
  expect(draw('/repo/shared.txt', main)).toBe(`${by} in the main tree`)
  expect(draw('/repo/shared.txt')).toBe(by)
  expect(draw('/repo/.wt/fix/shared.txt', undefined, '/repo/.wt/fix')).toBe(`${by} in fix`)
  expect(draw('/repo/shared.txt', undefined, '/repo/.wt/fix')).toBe(
    by.replace('shared.txt', '/repo/shared.txt'),
  )
})
