import type { RabeItem } from '../model'
import { decode, type Grid, grid, lines, paste, type Span, spans } from './cells/grid'
import { C } from './cells/palette'
import { type Drawn, isPress, type Press } from './view'

export const NOW = new Date(2026, 9, 8, 10, 52, 0).getTime()

const min = 60_000

export const explore: RabeItem = {
  id: 'agent:a1',
  kind: 'agent',
  title: 'Explore verifyToken',
  status: 'running',
  seenAt: NOW - 2 * min,
  startedAt: NOW - 72_000,
  tokens: { input: 36_000, output: 5_000 },
  costUsd: 0.16,
  detail: {
    agentId: 'a1',
    type: 'Explore',
    model: 'opus-5-5',
    transcriptPath: '/t/agent-a1.jsonl',
    worktreePath: '/repo/.claude/worktrees/pkg-db',
    worktreeBranch: 'worktree-agent-a1',
  },
}

export const plan: RabeItem = {
  id: 'agent:a2',
  kind: 'agent',
  title: 'Plan auth split',
  status: 'done',
  seenAt: NOW - 10 * min,
  startedAt: NOW - 10 * min,
  endedAt: NOW - 6 * min,
  detail: { agentId: 'a2', type: 'Plan', cwd: '/repo' },
}

export const review: RabeItem = {
  id: 'codex:task-1',
  kind: 'codex',
  title: 'review auth.ts',
  status: 'running',
  seenAt: NOW - min,
  startedAt: NOW - 52_000,
  tokens: { input: 25_000, output: 3_000, cached: 18_000 },
  costUsd: 0.09,
  detail: {
    jobId: 'task-1',
    model: 'gpt-6.1-sol',
    effort: 'high',
    prompt: 'Review middleware/auth.ts for token-expiry bugs.',
    sessionPath: '/c/rollout-1.jsonl',
    steps: [
      { kind: 'reasoning', text: 'Diff first.' },
      { kind: 'message', text: 'Reading the diff.' },
      { kind: 'command', text: 'git diff', exitCode: 0, lines: 1 },
    ],
  },
}

export const dev: RabeItem = {
  id: 'shell:bg_2',
  kind: 'shell',
  title: 'bun run dev',
  status: 'running',
  seenAt: NOW - 40 * min,
  detail: { command: 'bun run dev', taskId: 'bg_2', port: 5173, outputPath: '/t/bg_2.output' },
}

export const lint: RabeItem = {
  id: 'shell:bg_3',
  kind: 'shell',
  title: 'bun run lint',
  status: 'failed',
  seenAt: NOW - 3 * min,
  startedAt: NOW - 3 * min,
  endedAt: NOW - 2 * min,
  detail: { command: 'bun run lint', taskId: 'bg_3', exitCode: 2, outputPath: '/t/bg_3.output' },
}

export const ci: RabeItem = {
  id: 'monitor:bg_4',
  kind: 'monitor',
  title: 'CI run #482',
  status: 'running',
  seenAt: NOW - 8 * min,
  startedAt: NOW - 8 * min,
  detail: {
    command: 'gh run watch 482',
    description: 'wait until CI run #482 finishes',
    taskId: 'bg_4',
    timeoutMs: 30 * min,
    isPersistent: false,
  },
}

export const babysit: RabeItem = {
  id: 'cron:c1',
  kind: 'cron',
  title: '/babysit-prs',
  status: 'running',
  seenAt: NOW - 30 * min,
  detail: {
    jobId: 'c1',
    prompt: '/babysit-prs',
    schedule: '*/5 * * * *',
    humanSchedule: 'every 5 minutes',
  },
}

export const flow: RabeItem = {
  id: 'workflow:wf1',
  kind: 'workflow',
  title: 'review-changes',
  status: 'running',
  seenAt: NOW - 6 * min,
  startedAt: NOW - 6 * min,
  detail: { runId: 'wf1', taskId: 'wf_task', phases: ['Review', 'Verify', 'Report'] },
}

export const verify: RabeItem = {
  id: 'agent:w1',
  kind: 'agent',
  title: 'verify:db.ts',
  status: 'running',
  seenAt: NOW - min,
  startedAt: NOW - 40_000,
  parentId: flow.id,
  tokens: { input: 19_000, output: 3_000 },
  costUsd: 0.06,
  detail: { agentId: 'w1', workflowPhase: 'Verify' },
}

export const reviewed: RabeItem = {
  id: 'agent:w0',
  kind: 'agent',
  title: 'review:bugs',
  status: 'done',
  seenAt: NOW - 5 * min,
  startedAt: NOW - 5 * min,
  endedAt: NOW - 3 * min,
  parentId: flow.id,
  detail: { agentId: 'w0', workflowPhase: 'Review' },
}

export const ALL: RabeItem[] = [
  explore,
  plan,
  review,
  dev,
  lint,
  ci,
  babysit,
  flow,
  verify,
  reviewed,
]

// ALL without the agents that ended without token data, whose spend is unknown.
export const PRICED: RabeItem[] = ALL.filter(item => item !== plan && item !== reviewed)

type Drawing = { type: string; props?: Record<string, unknown>; children?: unknown[] }
type Mount = { drawn: () => Promise<unknown> }

const isDrawing = (one: unknown): one is Drawing =>
  typeof one === 'object' && one !== null && 'type' in one

// The text an element shows on one line.
function inline(one: unknown): string {
  if (typeof one === 'string') return one
  if (!isDrawing(one)) return ''
  if (one.type === 'Button') return String(one.props?.label ?? '')

  return (one.children ?? []).map(inline).join('')
}

function walk(one: unknown, out: string[]): void {
  if (!isDrawing(one)) return
  const { type, props = {}, children = [] } = one
  if (type === 'Raster') {
    const { columns, rows, cells } = props as { columns: number; rows: number; cells: string }
    out.push(...lines(decode(columns, rows, cells)))
  } else if (
    type === 'Box' &&
    props.flexDirection === 'row' &&
    !String(props.key).startsWith('controls')
  ) {
    out.push(inline(one).trimEnd())
  } else if (type === 'Box') {
    for (const child of children) walk(child, out)
  } else if (type !== 'Input') {
    out.push(inline(one).trimEnd())
  }
}

// What a drawing shows, line by line: each row Box as one line (its Texts and
// Button labels), a Raster's cells decoded, and each control Button alone.
export async function screen(ui: Mount): Promise<string[]> {
  const out: string[] = []
  walk(await ui.drawn(), out)

  return out
}

// A plain Button's label as the terminal draws it: `c: label` with a hotkey.
const drawnLabel = (part: Press) => (part.hotkey ? `${part.hotkey}: ${part.label}` : part.label)

const widthOf = (drawn: Drawn) =>
  Math.max(
    1,
    ...drawn.nodes.map(node =>
      'chart' in node
        ? node.chart.columns
        : node.spans.reduce(
            (n, part) => n + [...(isPress(part) ? drawnLabel(part) : part[0])].length,
            0,
          ),
    ),
  )

// A view's body as one grid, the way the terminal lays it out (as wide as its
// widest line): for the view tests, which read text and colors at positions.
// A dim Button reads C.dim.
export function raster(drawn: Drawn, columns = widthOf(drawn)): Grid {
  const rows = drawn.nodes.reduce((n, node) => n + ('chart' in node ? node.chart.rows : 1), 0)
  const g = grid(columns, rows)
  let y = 0
  for (const node of drawn.nodes) {
    if ('chart' in node) {
      paste(g, node.chart, 0, y)
      y += node.chart.rows
      continue
    }
    if (node.bg !== undefined) spans(g, 0, y, [[' '.repeat(columns), { bg: node.bg }]])
    const list = node.spans.map(
      (part): Span =>
        isPress(part)
          ? [
              drawnLabel(part),
              { ...(part.dim && { fg: C.dim }), ...(part.bg !== undefined && { bg: part.bg }) },
            ]
          : part,
    )
    spans(g, 0, y, list)
    y += 1
  }

  return g
}

// A view's output with its body as a grid, for the view tests.
export const gridOf = (drawn: Drawn) => ({ ...drawn, grid: raster(drawn) })
