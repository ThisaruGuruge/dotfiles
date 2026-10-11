import type { RenderSurface } from 'claude-code'

import type { RabeItem, RabeItemKind } from '../../model'

// The terminal's own color: plain text and background use it, so the pane
// follows the person's theme.
export const DEFAULT = 0x01000000

// Every other color is one of the xterm-256 colors 16 to 255, as 0x00RRGGBB:
// a cube color (each channel 0, 95, 135, 175, 215 or 255) or a grey (8 + 10n).
// Under tmux the engine reduces a hex color to 256 colors coarsely (#203020
// and #402040 both became 59), so the Box and Text colors go out as
// `ansi256(n)` and a Raster's cells keep the exact entry, which the reduction
// maps to itself. The 16 base colors are left out: each theme draws its own.
export const C = {
  text: DEFAULT,
  bg: DEFAULT,
  dim: 0x8a8a8a, // 245
  bright: 0xeeeeee, // 255
  orange: 0xd7875f, // 173
  yellow: 0xd7af5f, // 179
  green: 0x87af5f, // 107
  red: 0xd75f5f, // 167
  blue: 0x5fafff, // 75
  purple: 0xd787d7, // 176
  cyan: 0x5fafaf, // 73
  grey: 0xd0d0d0, // 252
  // backgrounds
  selected: 0x444444, // 238
  panel: 0x303030, // 236
  raised: 0x262626, // 235
  rule: 0x4e4e4e, // 239
} as const

export type Style = { fg?: number; bg?: number }

// A chip: a light tint of the kind's color on the dark cube color of its hue.
export const CHIP = {
  agent: { fg: 0xffaf87, bg: 0x875f00 }, // 216 on 94
  codex: { fg: 0x87d7d7, bg: 0x005f5f }, // 116 on 23
  workflow: { fg: 0xafd787, bg: 0x005f00 }, // 150 on 22
  shell: { fg: 0xffd787, bg: 0x5f5f00 }, // 222 on 58
  monitor: { fg: 0x87d7ff, bg: 0x00005f }, // 117 on 17
  cron: { fg: 0xd7afff, bg: 0x5f005f }, // 183 on 53
  failed: { fg: 0xff8787, bg: 0x5f0000 }, // 210 on 52
  done: { fg: 0xafd787, bg: 0x005f00 }, // 150 on 22
  cost: { fg: 0xd0d0d0, bg: 0x3a3a3a }, // 252 on 237
} as const satisfies Record<RabeItemKind | 'failed' | 'done' | 'cost', Required<Style>>

const LEVELS = [0, 95, 135, 175, 215, 255]

// The xterm-256 index of an exact palette entry; undefined for any other color.
export function xterm(rgb: number): number | undefined {
  if (rgb < 0 || rgb > 0xffffff) return undefined
  const [r, g, b] = [rgb >> 16, (rgb >> 8) & 0xff, rgb & 0xff] as const
  const [i, j, k] = [r, g, b].map(one => LEVELS.indexOf(one)) as [number, number, number]
  if (i >= 0 && j >= 0 && k >= 0) return 16 + 36 * i + 6 * j + k
  const n = (r - 8) / 10

  return r === g && g === b && Number.isInteger(n) && n >= 0 && n < 24 ? 232 + n : undefined
}

// A color as Box and Text take it: absent for the terminal's own, `ansi256(n)`
// on the terminal, hex on every other surface.
export function paint(rgb: number | undefined, surface: RenderSurface): string | undefined {
  if (rgb === undefined || rgb === DEFAULT) return undefined
  const n = xterm(rgb)
  if (surface === 'terminal' && n !== undefined) return `ansi256(${n})`

  return `#${rgb.toString(16).padStart(6, '0')}`
}

const RUNNING: Record<RabeItemKind, number> = {
  agent: C.yellow,
  codex: C.cyan,
  workflow: C.green,
  shell: C.yellow,
  monitor: C.blue,
  cron: C.purple,
}

// The glyph color of an item: its kind while it runs, else its end.
export function tone(item: RabeItem): number {
  if (item.status === 'failed') return C.red
  if (item.status === 'done') return C.green
  if (item.status === 'stopped') return C.dim

  return RUNNING[item.kind]
}
