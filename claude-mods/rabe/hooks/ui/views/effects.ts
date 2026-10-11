import type { RabeOrder } from '../../../types'
import { isInside, type RabeItemOf } from '../../model'
import { fit, type Span } from '../cells/grid'
import { C, CHIP } from '../cells/palette'
import { byConflict, stable, type Touched, touched, worktreeRows } from '../lists'
import type { Drawn, Line, Model, View } from '../view'
import { fitLine, focusOn } from './lines'

const dim = { fg: C.dim }
const CHANGE = 29

const and = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? '')

function conflictLines(files: Touched[]): Line[] {
  const conflicts = files.filter(file => file.isConflict)
  const [first] = conflicts
  if (!first) return []
  // a tree only when it is proven to hold the file: git placed it, or an
  // editor's worktree (Claude Code's metadata) contains its path
  const own = first.by.find(editor => editor.tree && isInside(first.path, editor.tree))
  const tree = first.tree?.path ?? own?.tree
  const where = first.tree?.isMain
    ? ' in the main tree'
    : tree
      ? ` in ${tree.split(/[\\/]/).filter(Boolean).at(-1)}`
      : ''
  const more = conflicts.length > 1 ? ` · +${conflicts.length - 1} more` : ''

  return [
    {
      bg: CHIP.failed.bg,
      spans: [
        [' ⚠ conflict ', { fg: C.red }],
        [` ${first.rel}`, { fg: C.bright }],
        [' is edited by '],
        [and(first.by.map(editor => editor.title)), { fg: C.orange }],
        [`${where}${more}`, dim],
      ],
    },
    { spans: [] },
  ]
}

// A selectable row's start: the orange marker when selected, else a space.
const mark = (isSelected: boolean): Span => [isSelected ? '▌' : ' ', { fg: C.orange }]

type Widths = { file: number; by: number }

function widths(columns: number): Widths {
  const inner = Math.max(2, columns - 2 - Math.min(CHANGE, Math.floor(columns / 3)) - 2)
  const file = Math.ceil(inner * 0.47)

  return { file, by: inner - file }
}

// The start of a long path is cut, so the file name stays.
function middle(path: string, width: number): string {
  const chars = [...path]
  if (chars.length <= width) return path
  const left = Math.ceil((width - 1) / 2)
  const right = Math.floor((width - 1) / 2)
  return `${chars.slice(0, left).join('')}…${right ? chars.slice(-right).join('') : ''}`
}

// How the file changed; a shell write is a guess.
function how(file: Touched): string {
  const count = file.edits > 1 ? `${file.edits} changes: ` : ''

  return `${count}${file.hows.join(', ')}`
}

function fileRow(file: Touched, w: Widths, selected: string): Line {
  const isSelected = file.id === selected
  const name = middle(file.rel, w.file)
  const gone = 'deleted · '
  return {
    spans: [
      mark(isSelected),
      [' '],
      {
        key: `row:${file.id}`,
        label: name,
        action: file.last.item
          ? { type: 'open', id: file.last.item.id }
          : { type: 'copy', text: file.path },
        ...(!isSelected && { dim: true }),
      },
      [' '.repeat(w.file - [...name].length)],
      [` ${fit(file.by.map(editor => editor.title).join(', '), w.by)} `, dim],
      ...(file.isDeleted ? [[gone, { fg: C.red }] as Span] : []),
      [how(file)],
    ],
    ...(isSelected && { bg: C.selected }),
  }
}

function fileLines(files: Touched[], w: Widths, selected: string): Line[] {
  const title: Line = {
    spans: [
      [`FILES TOUCHED ${files.length}`, { fg: C.orange }],
      ['  from edits, Codex and shell commands', dim],
    ],
  }
  if (files.length === 0) return [title, { spans: [['  No file changed yet.', dim]] }]

  return [
    title,
    { spans: [[`  ${fit('FILE', w.file)} ${fit('BY', w.by)} CHANGE`, dim]] },
    ...files.map(file => fileRow(file, w, selected)),
  ]
}

function treeLines(model: Model, files: Touched[]): Line[] {
  const { rows, unknown } = worktreeRows(model.items, files, model.worktrees, model.cwd)
  const width = Math.min(34, Math.max(9, ...rows.map(row => row.name.length)))
  const row = (label: string, rest: string): Line => ({
    spans: [['  '], ['⎇', { fg: C.purple }], [` ${fit(label, width)}  `], [rest, dim]],
  })
  const isGit = (model.worktrees?.length ?? 0) > 0
  const empty = isGit ? '  No worktree in use yet.' : '  No agents yet.'

  return [
    {
      spans: [
        [`WORKTREES ${rows.length}`, { fg: C.purple }],
        [
          isGit
            ? '  from git and agent metadata'
            : '  from agent metadata, running agents included',
          dim,
        ],
      ],
    },
    ...rows.map(one => row(one.name, [one.branch, one.who.join(', ')].filter(Boolean).join(' · '))),
    ...(unknown ? [row('n/a', `${unknown} agent${unknown === 1 ? '' : 's'}: tree n/a`)] : []),
    ...(rows.length || unknown ? [] : [{ spans: [[empty, dim]] as Span[] }]),
  ]
}

const sshLine = (port: number) => `ssh -L ${port}:localhost:${port} <your-host>`

type Port = { item: RabeItemOf<'shell'>; port: number; at: number }

// The ports of the running shells, one per port. With an order, `held` are
// the ports of the shells that ran with one at the open, in that order, and
// `fresh` the others, in the order they were found. A port whose shell
// ended leaves; the renderer keeps its row's place (see `hold`).
function portsOf(model: Model, order?: RabeOrder): { held: Port[]; fresh: Port[] } {
  const shown = model.items.flatMap(item =>
    item.kind === 'shell' && item.detail.port !== undefined && item.status === 'running'
      ? [item]
      : [],
  )
  const byPort = (list: typeof shown): Port[] =>
    [...new Set(list.map(item => item.detail.port as number))].map(port => {
      const same = shown.filter(one => one.detail.port === port)
      const at = Math.min(...same.map(one => one.detail.portAt ?? one.startedAt ?? one.seenAt))
      return { item: same[0] as (typeof same)[0], port, at }
    })
  if (!order) return { held: byPort(shown), fresh: [] }
  const held = byPort(
    stable(
      shown.filter(item => order.ports?.includes(item.id)),
      order.ports,
      list => list,
    ),
  )

  return {
    held,
    fresh: byPort(shown.filter(item => !held.some(one => one.port === item.detail.port))).toSorted(
      (a, b) => a.at - b.at,
    ),
  }
}

function portRows({ item, port }: Port, hasHotkey: boolean, selected: string): Line[] {
  const isSelected = selected === `ssh:${port}`
  return [
    {
      spans: [['  '], [`:${port}`, { fg: C.blue }], [`  ${item.detail.command}`]],
    },
    {
      spans: [
        mark(isSelected),
        // The engine draws a plain Button's hotkey as `c: ` before its label.
        [hasHotkey ? '  ' : '     '],
        {
          key: `row:ssh:${port}`,
          label: sshLine(port),
          action: { type: 'copy', text: sshLine(port) },
          ...(hasHotkey && { hotkey: 'c' }),
          ...(!isSelected && { dim: true }),
        },
      ],
      ...((isSelected || hasHotkey) && { bg: isSelected ? C.selected : CHIP.monitor.bg }),
    },
  ]
}

// The Effects tab: a conflict when two agents edit one file in one tree, the
// files agents touched (each a row that opens the agent that edited it last),
// the worktrees, and the ports of shells, each with its ssh command as a row
// that copies it (`c` the first). While the pane is open the files and ports
// of the open hold their order (`stable`), and the rows found since follow
// them in their section, in the order they were found.
export const effectsView: View = (model, size, sel): Drawn => {
  const { order } = sel
  const all = touched(model.items, model.edits, model.cwd, model.worktrees)
  const files = stable(all, order?.files, byConflict)
  const ports = portsOf(model, order)
  const shown = [...ports.held, ...ports.fresh]
  const ids = [...files.map(file => file.id), ...shown.map(({ port }) => `ssh:${port}`)]
  const selected = ids.includes(sel.selected) ? sel.selected : (ids[0] ?? '')
  const hotkey = ports.held[0]?.port ?? ports.fresh[0]?.port
  const w = widths(size.columns)
  const portLines: Line[] = [
    {
      spans: [
        [`PORTS ${shown.length}`, { fg: C.blue }],
        ['  found in shell output, may miss some', dim],
      ],
    },
    ...shown.flatMap(port => portRows(port, port.port === hotkey, selected)),
    ...(shown.length ? [] : [{ spans: [['  No open port found.', dim]] as Span[] }]),
  ]
  const lines = focusOn(
    [
      ...conflictLines(byConflict(all)),
      ...fileLines(files, w, selected),
      { spans: [] },
      ...treeLines(model, all),
      { spans: [] },
      ...portLines,
    ],
    selected,
  )

  return { nodes: lines.map(line => fitLine(line, size.columns)), buttons: [] }
}
