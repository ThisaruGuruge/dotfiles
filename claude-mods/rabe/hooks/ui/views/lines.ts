import type { RabeItem } from '../../model'
import { type Span, safe, wrap } from '../cells/grid'
import { C, type Style, tone } from '../cells/palette'
import { facts } from '../facts'
import { glyph, nameSpans, statusLabel, timeLabel } from '../lists'
import { isPress, type Line, type Model, type Part } from '../view'

// A plain Button with a hotkey draws `c: ` before its label.
const prefix = (part: Part) => (isPress(part) && part.hotkey ? part.hotkey.length + 2 : 0)

const width = (list: Part[]) =>
  list.reduce((n, part) => n + prefix(part) + [...(isPress(part) ? part.label : part[0])].length, 0)

export const cut = (text: string, room: number) => {
  const chars = [...safe(text)]
  return chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : chars.join('')
}

// A line exactly `width` cells wide, as a grid row was: the parts cut with `…`
// where they run out, the right part at the end, padded between. The line's
// background moves onto each part, so lines can be set side by side.
export function fitLine(line: Line, columns: number): Line {
  const right = line.right ?? []
  const rightWidth = width(right)
  const room = Math.max(0, columns - (rightWidth ? rightWidth + 1 : 0))
  const bg = line.bg
  const out: Part[] = []
  let used = 0
  const add = (part: Part, limit: number) => {
    if (used + prefix(part) >= limit) return
    const shown = cut(isPress(part) ? part.label : part[0], limit - used - prefix(part))
    if (!shown) return
    used += prefix(part) + [...shown].length
    if (isPress(part)) {
      out.push({
        ...part,
        label: shown,
        ...((part.bg ?? bg) !== undefined && { bg: part.bg ?? bg }),
      })
    } else {
      out.push([shown, { ...part[1], bg: part[1]?.bg ?? bg }])
    }
  }
  for (const part of line.spans) add(part, room)
  const start = Math.max(used + (rightWidth ? 1 : 0), columns - rightWidth)
  if (start > used) out.push([' '.repeat(start - used), { bg }])
  used = start
  for (const part of right) add(part, columns)

  return { spans: out }
}

// Two columns of lines as one: `left` cut to `leftWidth`, then `gap`, then
// `right` cut to `rightWidth`; the shorter side is padded with empty lines.
export function beside(
  left: Line[],
  leftWidth: number,
  gap: Span[],
  right: Line[],
  rightWidth: number,
): Line[] {
  const rows = Math.max(left.length, right.length)

  return Array.from({ length: rows }, (_, y) => ({
    spans: [
      ...fitLine(left[y] ?? { spans: [] }, leftWidth).spans,
      ...gap,
      ...fitLine(right[y] ?? { spans: [] }, rightWidth).spans,
    ],
  }))
}

export function text(
  value: string,
  width: number,
  style: Style = {},
  indent = '',
): (Line & { spans: Span[] })[] {
  return wrap(value, Math.max(1, width - indent.length)).map(one => ({
    spans: [[`${indent}${one}`, style]],
  }))
}

// An item's row: marker, glyph, the name as a plain Button that opens it, the
// port or exit code, and its time at the right end. The selected row (the one
// holding the focus) has an orange `▌` and a background; the other names are
// dim at rest.
export function itemLine(item: RabeItem, now: number, isSelected = false): Line {
  const time = timeLabel(item, now)
  const right = item.status === 'running' ? time : `${statusLabel(item)} ${time}`
  const [name, ...after] = nameSpans(item)

  return {
    spans: [
      [isSelected ? '▌' : ' ', { fg: C.orange }],
      [glyph(item), { fg: tone(item) }],
      [' '],
      {
        key: `row:${item.id}`,
        label: name?.[0] ?? item.title,
        action: { type: 'open', id: item.id },
        ...(!isSelected && { dim: true }),
      },
      ...after,
    ],
    right: [[`${right} `, { fg: isSelected ? C.text : C.dim }]],
    ...(isSelected && { bg: C.selected }),
  }
}

// An item's title, status word and fact lines, then an empty line. The long
// fact is cut into lines of `columns` cells, so none of it is lost.
export function headLines(model: Model, item: RabeItem, columns: number): Line[] {
  const f = facts(item, model.now, model.items, model.cwd)
  const chars = [...safe(f.long ?? '')]
  const n = Math.max(1, columns)
  const long = Array.from({ length: Math.ceil(chars.length / n) }, (_, i) =>
    chars.slice(i * n, (i + 1) * n).join(''),
  )

  return [
    {
      spans: [
        [`${glyph(item)} `, { fg: tone(item) }],
        [f.title, { fg: C.bright }],
      ],
      right: [[f.status.slice(2), { fg: tone(item) }]],
    },
    ...[...f.lines, ...long].map(line => ({ spans: [[line, { fg: C.dim }]] as Span[] })),
    { spans: [] },
  ]
}

// A line with its Buttons as text: a preview that takes no focus.
export function plain(line: Line): Line {
  return {
    ...line,
    spans: line.spans.map(
      (part): Span => (isPress(part) ? [part.label, part.dim ? { fg: C.dim } : {}] : part),
    ),
  }
}

// The row the focus starts on: the selected item's, else the first.
export function focusOn(lines: Line[], selected: string): Line[] {
  const rows = lines
    .flatMap(line => line.spans.filter(isPress))
    .filter(p => p.key.startsWith('row:'))
  const target = rows.find(p => p.key === `row:${selected}`) ?? rows[0]
  if (target) target.autoFocus = true

  return lines
}
