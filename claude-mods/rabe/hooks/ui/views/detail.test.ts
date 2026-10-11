import { expect, test } from 'claude-code/testing'

import type { RabeItem } from '../../model'
import { cell, type Grid, lines } from '../cells/grid'
import { C } from '../cells/palette'
import {
  ALL,
  babysit,
  ci,
  dev,
  explore,
  flow,
  gridOf,
  lint,
  NOW,
  plan,
  review,
  reviewed,
  verify,
} from '../fixtures'
import { isPress, type Model, NO_SELECTION, rowKeys, type Size } from '../view'
import { detailLines, detailView } from './detail'
import { itemsView } from './items'
import { paneView } from './pane'

const TERMINAL: Size = { columns: 60, rows: 30, surface: 'terminal', hasInput: false }

function model(items: RabeItem[] = ALL, extra: Partial<Model> = {}): Model {
  return { items, turns: {}, lines: {}, now: NOW, ...extra }
}

function open(m: Model, id: string, size: Size = TERMINAL) {
  return gridOf(detailView(m, size, { ...NO_SELECTION, open: id }))
}

// The row and column where `text` starts.
function find(g: Grid, text: string): [x: number, y: number] {
  const shown = lines(g)
  const y = shown.findIndex(line => line.includes(text))
  if (y === -1) throw new Error(`"${text}" not in:\n${shown.join('\n')}`)

  return [shown[y]?.indexOf(text) ?? -1, y]
}

const fg = (g: Grid, at: [number, number]) => cell(g, at[0], at[1])[1]
const bg = (g: Grid, at: [number, number]) => cell(g, at[0], at[1])[2]

test('an opened agent keeps every turn in a 17-row inline pane at 100 terminal columns', () => {
  const agent = {
    ...explore,
    status: 'done',
    detail: { ...explore.detail, transcriptPath: `/session/${'deep/'.repeat(20)}agent-a1.jsonl` },
  } as RabeItem
  const m = model([agent], {
    turns: {
      [agent.id]: Array.from({ length: 20 }, (_, i) => ({
        index: i + 1,
        at: NOW,
        text: i === 19 ? 'Final report.' : `Turn ${i + 1}.`,
        tools: [],
      })),
    },
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const drawn = paneView(
      m,
      { ...TERMINAL, columns: 96, rows: 17, surface },
      { ...NO_SELECTION, open: agent.id, isFocused: true },
    )
    const shown = lines(gridOf(drawn).grid)
    expect(shown).toContain('1  ● Turn 1.')
    expect(shown).toContain('20 ● Final report.')
    expect(shown.some(line => line.includes('↑↓ scroll'))).toBe(true)
    expect(shown.length).toBeGreaterThan(17)
  }
})

test('an agent shows a cost box, its brief and its turns from rabe.turns', () => {
  const agent = {
    ...explore,
    detail: { ...explore.detail, description: 'Find verifyToken.', lastToolAt: NOW - 3000 },
  } as RabeItem
  const m = model([agent], {
    turns: {
      [agent.id]: [
        {
          index: 1,
          at: NOW - 30_000,
          text: 'Searching.',
          tools: [{ name: 'Grep', summary: 'verifyToken' }],
        },
        {
          index: 2,
          at: NOW - 5000,
          text: 'Reading verify.ts.',
          tools: [{ name: 'Read', summary: 'verify.ts' }],
        },
      ],
    },
  })
  const { grid: g, buttons } = open(m, agent.id)
  const cost = find(g, '≈ $0.16   in 36k  out 5k')
  expect(fg(g, cost)).toBe(C.bright)
  expect(bg(g, [0, cost[1]])).toBe(C.panel)
  expect(lines(g).some(line => /^ 100% of session +active just now$/.test(line))).toBe(true)
  expect(fg(g, find(g, 'active'))).toBe(C.green)
  expect(fg(g, find(g, '▸ brief'))).toBe(C.blue)
  expect(lines(g)).toContain('  Find verifyToken.')
  const first = find(g, '1  ● Searching.')
  expect(fg(g, first)).toBe(C.dim)
  expect(fg(g, [first[0] + 3, first[1]])).toBe(C.orange)
  expect(lines(g)).toContain('     ⎿ Grep verifyToken')
  // The running turn is raised; the ones before are not.
  expect(bg(g, [0, first[1]])).not.toBe(C.raised)
  expect(bg(g, [0, find(g, '2  ● Reading verify.ts.')[1]])).toBe(C.raised)
  expect(bg(g, [0, find(g, '⎿ Read verify.ts')[1]])).toBe(C.raised)
  expect(buttons.find(b => b.key === `stop:${explore.id}`)?.label).toBe('x: stop')
})

test('an opened detail only hints at scrolling when it overflows', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    for (const rows of [10, 30]) {
      const drawn = paneView(
        model([ci]),
        { ...TERMINAL, rows, surface },
        { ...NO_SELECTION, open: ci.id, isFocused: true },
      )
      const hint = lines(gridOf(drawn).grid).at(-1)?.trim()
      expect(hint).toBe(rows === 10 ? '↑↓ scroll · b back · esc close' : 'b back · esc close')
    }
  }
})

test('an agent preview skips older turns once the newest text fills its rows', () => {
  const m = model([explore], {
    turns: {
      [explore.id]: [
        {
          index: 1,
          at: NOW,
          get text(): string {
            throw new Error('The preview must not wrap this older turn.')
          },
          tools: [],
        },
        { index: 2, at: NOW, text: `${'word '.repeat(3200)}\nReport end.`, tools: [] },
      ],
    },
  })
  const preview = detailLines(m, explore, 17, 72)
  const shown = lines(gridOf({ nodes: preview, buttons: [] }).grid)
  expect(shown).toContain('Older text hidden · enter opens full detail')
  expect(shown).toContain('     Report end.')
  expect(shown.length).toBe(17)
})

test('an agent preview skips text when the newest tools fill its rows', () => {
  const m = model([explore], {
    turns: {
      [explore.id]: [
        {
          index: 1,
          at: NOW,
          get text(): string {
            throw new Error('Tool rows leave no room to wrap this text.')
          },
          tools: Array.from({ length: 20 }, (_, i) => ({ name: 'Read', summary: `file-${i}.ts` })),
        },
      ],
    },
  })
  const preview = detailLines(m, explore, 17, 72)
  const shown = lines(gridOf({ nodes: preview, buttons: [] }).grid)
  expect(shown).toContain('Older text hidden · enter opens full detail')
  expect(shown).toContain('     ⎿ Read file-19.ts')
  expect(shown.length).toBe(17)
})

test('the brief of an agent is the prompt it was given when Rabe saw the spawn', () => {
  const agent = {
    ...explore,
    detail: { ...explore.detail, description: 'Find it', prompt: 'Find verifyToken in src.' },
  } as RabeItem
  const shown = lines(open(model([agent]), agent.id).grid)
  expect(shown[shown.indexOf('▸ brief') + 1]).toBe('  Find verifyToken in src.')
})

test('a long brief keeps three lines', () => {
  const agent = {
    ...explore,
    detail: { ...explore.detail, description: 'word '.repeat(60) },
  } as RabeItem
  const shown = lines(open(model([agent]), agent.id).grid)
  const at = shown.indexOf('▸ brief')
  expect(shown[at + 3]?.endsWith('…')).toBe(true)
  expect(shown[at + 4]).toBe('')
})

test('an opened final report keeps its end and no list marker stands alone', () => {
  const agent = { ...explore, status: 'done' } as RabeItem
  const path = `/abs/${'long-path/'.repeat(20)}file.ts`
  const m = model([agent], {
    turns: {
      [agent.id]: [
        { index: 1, at: NOW, text: `**Files:**\n- \`${path}\`\nReport end.`, tools: [] },
      ],
    },
  })
  for (const columns of [72, 196]) {
    const shown = lines(open(m, agent.id, { ...TERMINAL, columns }).grid)
    expect(shown.some(line => line.trim() === '-')).toBe(false)
    expect(shown).toContain('     Report end.')
    expect(shown.some(line => line.includes('- `/abs/'))).toBe(true)
  }
})

test('an agent without turns and a price says n/a', () => {
  const bare = { ...verify, costUsd: undefined }
  const shown = lines(open(model([bare]), verify.id).grid)
  expect(shown).toContain('Turns n/a: none seen since Rabe loaded.')
  expect(shown).toContain(' cost n/a   in 19k  out 3k')
  expect(shown.some(line => line.includes('active n/a'))).toBe(true)
})

test('a codex job shows its steps with the running command raised and an x: stop', () => {
  const job = {
    ...review,
    detail: {
      ...review.detail,
      sandbox: 'read-only',
      commandCount: 2,
      sessionUpdatedAt: NOW - 20_000,
      steps: [
        ...(review.kind === 'codex' ? (review.detail.steps ?? []) : []),
        { kind: 'command', text: 'bun test auth', exitCode: 1 },
        { kind: 'command', text: 'rg -n redact', isRunning: true },
      ],
    },
  } as RabeItem
  const { grid: g, buttons } = open(model([job]), job.id)
  const shown = lines(g)
  expect(shown).toContain('model gpt-6.1-sol · effort high · sandbox read-only')
  expect(shown).toContain('job task-1 · thread n/a · session file read')
  expect(shown).toContain(' ≈ $0.09   in 25k  out 3k  cached 18k')
  expect(shown.some(line => line.startsWith(' 2 commands  100% of session'))).toBe(true)
  expect(shown.some(line => line.endsWith('active 20s ago'))).toBe(true)
  expect(shown).toContain('  Review middleware/auth.ts for token-expiry bugs.')
  expect(fg(g, find(g, '● Reading the diff.'))).toBe(C.cyan)
  expect(shown).toContain('  thinking: Diff first.')
  expect(fg(g, find(g, '✓ exit 0 · 1 line'))).toBe(C.green)
  expect(fg(g, find(g, '✗ exit 1'))).toBe(C.red)
  const running = find(g, '◐ running')
  expect(fg(g, running)).toBe(C.yellow)
  expect(bg(g, [0, running[1]])).toBe(C.raised)
  expect(buttons.find(b => b.key === `stop:${job.id}`)).toMatchObject({
    label: 'x: stop',
    hotkey: 'x',
    action: { type: 'stop', ids: [job.id] },
  })
})

test('a codex job whose session file is gone says so', () => {
  const job = {
    ...review,
    status: 'done',
    detail: { jobId: 'task-9', isSessionMissing: true },
  } as RabeItem
  const { grid: g, buttons } = open(model([job]), job.id)
  expect(lines(g)).toContain('job task-9 · thread n/a · session file gone')
  expect(buttons.find(b => b.key === `stop:${job.id}`)).toMatchObject({
    dim: true,
    action: { type: 'none' },
  })
})

test('a workflow shows its phases and each agent with tokens and time', () => {
  const drawn = open(model(), flow.id)
  const { grid: g, buttons } = drawn
  const shown = lines(g)
  expect(shown).toContain('✓ Review → ◐ Verify → · Report')
  expect(shown).toContain(' 2 agents')
  // review:bugs ended without token data, so the sum is not known
  expect(shown.some(line => line.startsWith(' cost n/a   in 19k'))).toBe(true)
  expect(fg(g, find(g, 'VERIFY'))).toBe(C.green)
  expect(shown.some(line => /◐ verify:db\.ts +22k · 40s$/.test(line))).toBe(true)
  expect(shown.some(line => /✓ review:bugs +n\/a · 3m ago$/.test(line))).toBe(true)
  expect(rowKeys(drawn)).toContain(`row:${verify.id}`)
  expect(buttons.find(b => b.key === `stop-run:${flow.id}`)?.label).toBe('g: stop run')
})

test('a workflow sums the cost of its agents once each one has a price', () => {
  const priced = { ...reviewed, tokens: { input: 1_000, output: 0 }, costUsd: 0.01 }
  const items = ALL.map(item => (item.id === reviewed.id ? priced : item))
  const shown = lines(open(model(items), flow.id).grid)
  expect(shown.some(line => line.startsWith(' ≈ $0.07   in 20k'))).toBe(true)
})

test('a workflow with an agent that has tokens but no price shows cost n/a', () => {
  const items = ALL.map(item => (item.id === verify.id ? { ...item, costUsd: undefined } : item))
  const shown = lines(open(model(items), flow.id).grid)
  expect(shown.some(line => line.startsWith(' cost n/a   in 19k'))).toBe(true)
})

test('a shell shows its output tail and its exit code in color', () => {
  const m = model(ALL, {
    lines: {
      [lint.id]: {
        seen: 87,
        lines: [
          { at: NOW, text: 'pkg/auth/verify.ts' },
          { at: NOW, text: ' 42:5 error Unexpected any' },
        ],
      },
    },
  })
  const { grid: g } = open(m, lint.id)
  const shown = lines(g)
  expect(fg(g, find(g, '▸ output · newest last · 87 lines'))).toBe(C.blue)
  expect(shown).toContain(' 42:5 error Unexpected any')
  expect(shown.findLast(line => line !== '')).toBe('✗ exit 2')
  expect(fg(g, find(g, '✗ exit 2'))).toBe(C.red)
})

test('a shell that printed one line says 1 line', () => {
  const m = model([lint], {
    lines: { [lint.id]: { seen: 1, lines: [{ at: NOW, text: 'seeding' }] } },
  })
  expect(lines(open(m, lint.id).grid)).toContain('▸ output · newest last · 1 line')
})

test('a shell without lines says no output yet', () => {
  expect(lines(open(model(), dev.id).grid)).toContain('No output yet')
})

test('agent turn summaries show project-relative paths', () => {
  const m = model([explore], {
    cwd: '/repo',
    turns: {
      [explore.id]: [
        {
          index: 1,
          at: NOW,
          text: 'Done.',
          tools: [{ name: 'Write', summary: '/repo/src/deep/file.ts' }],
        },
      ],
    },
  })
  expect(lines(open(m, explore.id).grid)).toContain('     ⎿ Write src/deep/file.ts')
})

test('a monitor shows each line with the time it was received', () => {
  const m = model(ALL, {
    lines: { [ci.id]: { seen: 1, lines: [{ at: NOW - 60_000, text: 'build ✓ success' }] } },
  })
  const { grid: g } = open(m, ci.id)
  expect(lines(g)).toContain('▸ lines received · newest last')
  const at = find(g, '10:51:00 build ✓ success')
  expect(fg(g, at)).toBe(C.dim)
  expect(fg(g, [at[0] + 9, at[1]])).toBe(C.text)
})

test('a cron job lists its next runs with the pane duration format', () => {
  const shown = lines(open(model(), babysit.id).grid)
  expect(shown).toContain('▸ next runs')
  expect(shown).toContain('  10:55  in 3m00s')
  expect(shown).toContain('  11:15  in 23m00s')
})

test('an ended cron has no forecast and keeps an inert delete slot', () => {
  for (const status of ['stopped', 'done'] as const) {
    const item = {
      ...babysit,
      status,
      endedAt: NOW,
      detail: { ...babysit.detail, isDeleted: status === 'stopped' },
    } as RabeItem
    const m = model([item])
    const drawn = detailView(m, TERMINAL, { ...NO_SELECTION, open: item.id, isArmed: true })
    const shown = lines(gridOf(drawn).grid).join('\n')
    expect(shown).not.toContain('next runs')
    expect(shown).not.toContain('  in ')
    expect(shown).toContain(status === 'stopped' ? 'deleted' : 'done')
    expect(drawn.buttons.find(button => button.key === `delete:${item.id}`)).toEqual({
      key: `delete:${item.id}`,
      label: 'd: delete job',
      action: { type: 'none' },
      dim: true,
    })
    expect(lines(gridOf(itemsView(m, TERMINAL, { ...NO_SELECTION })).grid).join('\n')).toContain(
      status === 'stopped' ? 'deleted' : 'done',
    )
  }
})

test('a wakeup shows the one time it fires', () => {
  const wake = {
    ...babysit,
    detail: { jobId: 'w', prompt: 'check', scheduledFor: NOW + 90_000 },
  } as RabeItem
  expect(lines(open(model([wake]), wake.id).grid)).toContain('  10:53  in 1m30s')
})

test('an agent turn with only tools shows its tool line without an empty header', () => {
  const m = model([explore], {
    turns: {
      [explore.id]: [
        { index: 1, at: NOW, text: '', tools: [{ name: 'Read', summary: 'file.ts' }] },
      ],
    },
  })
  const shown = lines(open(m, explore.id).grid)
  expect(shown).toContain('     ⎿ Read file.ts')
  expect(shown.some(line => line.includes('(tools only)'))).toBe(false)
  expect(shown.some(line => line.includes('●'))).toBe(false)
})

test('a short opened shell keeps its head and every output line for scrolling', () => {
  const m = model(ALL, {
    lines: {
      [lint.id]: {
        seen: 40,
        lines: Array.from({ length: 40 }, (_, i) => ({ at: NOW, text: `line ${i}` })),
      },
    },
  })
  const { grid: g } = open(m, lint.id, { ...TERMINAL, rows: 14 })
  const shown = lines(g)
  expect(g.rows).toBeGreaterThan(14)
  expect(shown[0]).toMatch(/^✗ shell · bun run lint/)
  expect(shown).toContain('▸ output · newest last · 40 lines')
  expect(shown).toContain('line 39')
  expect(shown).toContain('line 0')
})

test('an opened monitor keeps all eight lines in a short pane at both widths', () => {
  const m = model([ci], {
    lines: {
      [ci.id]: {
        seen: 8,
        lines: Array.from({ length: 8 }, (_, i) => ({ at: NOW, text: `output ${i + 1}` })),
      },
    },
  })
  for (const columns of [96, 196]) {
    const shown = lines(open(m, ci.id, { ...TERMINAL, columns, rows: 10 }).grid)
    expect(shown.filter(line => /output \d/.test(line))).toHaveLength(8)
  }
  for (const rows of [1, 10]) {
    const preview = detailLines(m, ci, rows, 96)
    const shown = lines(gridOf({ nodes: preview, buttons: [] }).grid)
    const hidden = Number(shown.join('\n').match(/(\d+) older lines hidden/)?.[1] ?? 0)
    expect(hidden).toBeGreaterThan(0)
    expect(hidden + shown.filter(line => /output \d/.test(line)).length).toBe(8)
    expect(shown.some(line => line.includes('enter opens full detail'))).toBe(true)
  }
})

test('the split shows the same detail beside the list', () => {
  const { grid: g } = gridOf(
    itemsView(model(), { ...TERMINAL, columns: 120 }, { ...NO_SELECTION, selected: review.id }),
  )
  expect(lines(g).some(line => line.endsWith('● Reading the diff.'))).toBe(true)
  expect(lines(g).some(line => line.includes('│ ▸ prompt'))).toBe(true)
})

test('a codex job without a command count says n/a', () => {
  const shown = lines(open(model([review]), review.id).grid)
  expect(shown.some(line => /^ commands n\/a {2}100% of session +active n\/a$/.test(line))).toBe(
    true,
  )
})

test('a workflow agent offers no own stop or message, only stopping its run', () => {
  const size: Size = { ...TERMINAL, hasInput: true }
  const { buttons } = open(model(), verify.id, size)
  expect(buttons.find(b => b.key.startsWith('message'))).toBeUndefined()
  expect(open(model(), verify.id, size).inputs ?? []).toHaveLength(0)
  expect(buttons.find(b => b.key === `stop-run:${flow.id}`)).toMatchObject({
    label: 'g: stop run',
    hotkey: 'g',
    action: { type: 'stop', ids: [flow.id] },
  })
})

test('a workflow agent whose run cannot be stopped keeps a dim stop that does nothing', () => {
  const run = { ...flow, detail: { runId: 'wf1', phases: [] } } as RabeItem
  const { buttons } = open(model([run, verify]), verify.id)
  expect(buttons.find(b => b.key === `stop-run:${run.id}`)).toEqual({
    key: `stop-run:${run.id}`,
    label: 'g: stop run',
    action: { type: 'none' },
    dim: true,
  })
})

const older = {
  ...verify,
  id: 'agent:w2',
  title: 'verify:auth.ts',
  status: 'done',
  startedAt: NOW - 90_000,
  endedAt: NOW - 50_000,
  detail: { agentId: 'w2', workflowPhase: 'Verify' },
} as RabeItem

test('a workflow lists the agents of a phase in start order, whatever their status', () => {
  const keys = rowKeys(
    detailView(model([flow, verify, older]), TERMINAL, { ...NO_SELECTION, open: flow.id }),
  )
  expect(keys).toEqual([`row:${older.id}`, `row:${verify.id}`])
})

test('a workflow keeps the held order, so a row never moves under the focus', () => {
  const sel = { ...NO_SELECTION, open: flow.id, order: { timeline: [verify.id, older.id] } }
  const late = { ...older, id: 'agent:w3', startedAt: NOW - 200_000 } as RabeItem
  const keys = rowKeys(detailView(model([flow, verify, older, late]), TERMINAL, sel))
  expect(keys).toEqual([`row:${verify.id}`, `row:${older.id}`, `row:${late.id}`])
})

test('the workflow agent row that holds the focus is marked; the others are dim', () => {
  const sel = { ...NO_SELECTION, open: flow.id, selected: verify.id }
  const drawn = detailView(model([flow, verify, older]), TERMINAL, sel)
  const { grid: g } = gridOf(drawn)
  const y = find(g, '▌◐ verify:db.ts')[1]
  expect(cell(g, 0, y)).toEqual(['▌'.codePointAt(0), C.orange, C.selected])
  const other = find(g, ' ✓ verify:auth.ts')[1]
  expect(bg(g, [0, other])).not.toBe(C.selected)
  expect(fg(g, [3, other])).toBe(C.dim)
  // b: back keeps the one autoFocus of the drawing.
  const presses = drawn.nodes.flatMap(node => ('spans' in node ? node.spans.filter(isPress) : []))
  expect(presses.some(p => p.autoFocus)).toBe(false)
})

test('a workflow draws every agent row, also past the rows of the pane', () => {
  const many = Array.from(
    { length: 30 },
    (_, i) => ({ ...older, id: `agent:m${i}`, startedAt: NOW - 100_000 + i }) as RabeItem,
  )
  const drawn = detailView(
    model([flow, ...many]),
    { ...TERMINAL, rows: 12 },
    {
      ...NO_SELECTION,
      open: flow.id,
    },
  )
  expect(rowKeys(drawn)).toHaveLength(30)
  expect(lines(gridOf(drawn).grid)[0]).toMatch(/^⧉ workflow · review-changes/)
})

// A control that acts on an item carries that item in its key, so a new
// target is a new key, which the held focus order puts at the end.
test('every control of a detail that acts on an item names it in its key', () => {
  const size: Size = { ...TERMINAL, hasInput: true }
  const keysOf = (id: string) => {
    const drawn = detailView(model(), size, { ...NO_SELECTION, open: id })
    return [...drawn.buttons, ...(drawn.inputs ?? [])].map(one => one.key)
  }
  expect(keysOf(explore.id)).toEqual([
    'back',
    `copy:${explore.id}`,
    `message-agent:${explore.id}`,
    `stop:${explore.id}`,
    `message:${explore.id}`,
  ])
  expect(keysOf(dev.id)).toEqual(['back', `copy:${dev.id}`, `stop:${dev.id}`])
  expect(keysOf(babysit.id)).toEqual(['back', `copy:${babysit.id}`, `delete:${babysit.id}`])
  expect(keysOf(verify.id)).toEqual(['back', `copy:${verify.id}`, `stop-run:${flow.id}`])
  const drawn = detailView(model(), size, { ...NO_SELECTION, open: explore.id })
  expect(drawn.buttons.find(one => one.hotkey === 'm')?.action).toEqual({
    type: 'focus',
    key: `message:${explore.id}`,
  })
})

test('an agent shows its id and transcript, and c copies the id', () => {
  const { grid: g, buttons } = open(model([explore]), explore.id)
  expect(lines(g)).toContain('agent a1')
  expect(lines(g)).toContain('transcript /t/agent-a1.jsonl')
  expect(buttons.find(b => b.key === `copy:${explore.id}`)).toMatchObject({
    label: 'c: copy id',
    hotkey: 'c',
    action: { type: 'copy', text: 'a1' },
  })
  const bare = { ...plan, detail: { agentId: 'a2' } } as RabeItem
  const bareLines = lines(open(model([bare]), bare.id).grid)
  expect(bareLines).toContain('agent a2')
  expect(bareLines).toContain('transcript n/a')
})

// The whole path, with the agent file's name at its end, at any width.
test('an agent shows its transcript path in full, across lines', () => {
  const path = `/home/me/.claude/projects/-home-me-src-app/${'0'.repeat(36)}/subagents/agent-a1.jsonl`
  const agent = { ...explore, detail: { ...explore.detail, transcriptPath: path } } as RabeItem
  const joined = (shown: string[]) => {
    const at = shown.findIndex(line => line.trim().startsWith('transcript '))
    return shown
      .slice(at, at + 4)
      .map(line => line.trim())
      .join('')
  }
  expect(joined(lines(open(model([agent]), agent.id).grid))).toContain(`transcript ${path}`)
  const split = gridOf(
    itemsView(
      model([agent]),
      { ...TERMINAL, columns: 120 },
      { ...NO_SELECTION, selected: agent.id },
    ),
  )
  const right = lines(split.grid).map(line => line.slice(line.indexOf('│') + 1))
  expect(joined(right)).toContain(`transcript ${path}`)
  // a short pane keeps the whole head and scrolls it, in full and in the split
  const short = { ...TERMINAL, columns: 80, rows: 6 }
  expect(joined(lines(open(model([agent]), agent.id, short).grid))).toContain(`transcript ${path}`)
  const low = gridOf(
    itemsView(model([agent]), { ...short, columns: 120 }, { ...NO_SELECTION, selected: agent.id }),
  )
  const side = lines(low.grid).map(line => line.slice(line.indexOf('│') + 1))
  expect(joined(side)).toContain(`transcript ${path}`)
})

test('a codex job shows its thread, and c copies the command that resumes it', () => {
  const job = { ...review, detail: { ...review.detail, threadId: 'th-1' } } as RabeItem
  const { grid: g, buttons } = open(model([job]), job.id)
  expect(lines(g)).toContain('job task-1 · thread th-1 · session file read')
  expect(buttons.find(b => b.hotkey === 'c')).toEqual({
    key: 'resume:th-1',
    label: 'c: copy resume',
    hotkey: 'c',
    action: { type: 'copy', text: 'codex resume th-1' },
  })
  const { grid: none, buttons: without } = open(model([review]), review.id)
  expect(lines(none)).toContain('job task-1 · thread n/a · session file read')
  expect(without.some(b => b.hotkey === 'c' || b.key.startsWith('resume:'))).toBe(false)
})

test('a codex job counts the tokens of the agent that only forwarded it', () => {
  const call = { at: NOW - 60_000, command: 'task' as const, text: 'codex-companion.mjs task' }
  const forwarder = {
    ...explore,
    id: 'agent:f1',
    title: 'Codex rescue',
    tokens: { input: 4_000, output: 1_000, cached: 3_000 },
    costUsd: 0.01,
    detail: { agentId: 'f1', toolCount: 1, codexCalls: [call] },
  } as RabeItem
  const job = { ...review, parentId: forwarder.id } as RabeItem
  const shown = lines(open(model([forwarder, job]), job.id).grid)
  expect(shown).toContain('forwarded by claude Codex rescue · its tokens count here')
  expect(shown).toContain(' ≈ $0.10   in 29k  out 4k  cached 21k')
})

// The folded agent has no row: its job's detail opens it, with its turns, id and transcript.
test('a codex job opens the agent that only forwarded it', () => {
  const call = { at: NOW - 60_000, command: 'task' as const, text: 'codex-companion.mjs task' }
  const forwarder = {
    ...explore,
    id: 'agent:f1',
    title: 'Codex rescue',
    detail: { agentId: 'f1', toolCount: 1, codexCalls: [call] },
  } as RabeItem
  const job = { ...review, parentId: forwarder.id } as RabeItem
  expect(open(model([forwarder, job]), job.id).buttons).toContainEqual({
    key: 'forwarder:agent:f1',
    label: 'f: open forwarder',
    hotkey: 'f',
    action: { type: 'open', id: 'agent:f1' },
  })
  const busy = {
    ...forwarder,
    detail: { ...forwarder.detail, toolCount: 3 },
  } as RabeItem
  for (const items of [
    [busy, job],
    [forwarder, review],
  ]) {
    const { buttons } = open(model(items), job.id)
    expect(buttons.some(b => b.key.startsWith('forwarder:'))).toBe(false)
  }
})

// Issue #13: a removed agent keeps counting in its run, but has no row there.
test('a workflow counts a removed agent in its phases and tokens but draws no row for it', () => {
  const done = { ...reviewed, tokens: { input: 30_000, output: 2_000 } }
  const items = ALL.map(item => (item.id === reviewed.id ? done : item))
  const drawn = open(model(items, { removed: [done.id] }), flow.id)
  const shown = lines(drawn.grid)
  expect(shown).toContain('✓ Review → ◐ Verify → · Report')
  expect(shown.some(line => line.includes('REVIEW 1 done'))).toBe(true)
  expect(shown.some(line => line.startsWith(' cost n/a   in 49k'))).toBe(true)
  expect(rowKeys(drawn)).not.toContain(`row:${done.id}`)
  expect(rowKeys(drawn)).toContain(`row:${verify.id}`)
})
