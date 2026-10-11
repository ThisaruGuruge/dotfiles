import { DEFAULT, type Style } from './palette'

// A fixed grid of terminal cells, row-major, three u32 per cell:
// [codePoint, foreground, background], as a Raster's `cells` hold them.
export type Grid = { readonly columns: number; readonly rows: number; readonly cells: Uint32Array }

export type Cell = [codePoint: number, fg: number, bg: number]

const SPACE = 32
const STAND_IN = '?'

// An allow list: code points terminals draw one cell wide. ASCII, Latin-1
// letters and punctuation, Latin Extended-A and B, Greek, Cyrillic, general
// punctuation, currency signs, arrows, box drawing and block elements.
const WIDTH_1: [number, number][] = [
  [0x0020, 0x007e],
  [0x00a1, 0x024f],
  [0x0370, 0x03ff],
  [0x0400, 0x0482],
  [0x048a, 0x04ff],
  [0x2010, 0x2027],
  [0x2030, 0x205e],
  [0x20a0, 0x20c0],
  [0x2190, 0x21ff],
  [0x2500, 0x259f],
]

// The glyphs Rabe draws outside those ranges.
const GLYPHS = '≈≥⎇⎿■▶▸▾◂◉●◐◷⚠✓✗✻⟳⧉'
const OWN = new Set([...GLYPHS].map(ch => ch.codePointAt(0)))

// Unassigned code points, marks and format and control characters take no cell.
const NO_CELL = /[\p{Cn}\p{M}\p{Cf}\p{Cc}]/u

function isWidth1(code: number): boolean {
  if (NO_CELL.test(String.fromCodePoint(code))) return false

  return OWN.has(code) || WIDTH_1.some(([from, to]) => code >= from && code <= to)
}

// One character per cell: whitespace becomes a space, anything not on the
// allow list becomes the stand-in.
export function safe(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? SPACE
    out += /\s/.test(ch) ? ' ' : isWidth1(code) ? ch : STAND_IN
  }

  return out
}

export function fit(text: string, width: number): string {
  if (width <= 0) return ''
  const chars = [...safe(text)]
  if (chars.length > width) return `${chars.slice(0, width - 1).join('')}…`

  return chars.join('').padEnd(width)
}

export function grid(columns: number, rows: number, style: Style = {}): Grid {
  const width = Math.max(0, Math.floor(columns))
  const height = Math.max(0, Math.floor(rows))
  const cells = new Uint32Array(width * height * 3)
  for (let i = 0; i < cells.length; i += 3) {
    cells[i] = SPACE
    cells[i + 1] = style.fg ?? DEFAULT
    cells[i + 2] = style.bg ?? DEFAULT
  }

  return { columns: width, rows: height, cells }
}

// The most a Raster takes: 512 columns, 256 rows.
export const MAX_COLUMNS = 512
export const MAX_ROWS = 256

// The grid cut to what a Raster takes; a grid that fits comes back as is.
export function clamp(g: Grid): Grid {
  if (g.columns <= MAX_COLUMNS && g.rows <= MAX_ROWS) return g
  const out = grid(Math.min(g.columns, MAX_COLUMNS), Math.min(g.rows, MAX_ROWS))
  paste(out, g, 0, 0)

  return out
}

function put(g: Grid, x: number, y: number, code: number, style: Style): void {
  if (x < 0 || y < 0 || x >= g.columns || y >= g.rows) return
  const i = (y * g.columns + x) * 3
  g.cells[i] = code
  if (style.fg !== undefined) g.cells[i + 1] = style.fg
  if (style.bg !== undefined) g.cells[i + 2] = style.bg
}

export function cell(g: Grid, x: number, y: number): Cell {
  const i = (y * g.columns + x) * 3

  return [g.cells[i] ?? SPACE, g.cells[i + 1] ?? DEFAULT, g.cells[i + 2] ?? DEFAULT]
}

// Writes text from (x, y) to the right; a style leaves the colors it does not
// name as they are. Returns the column after the text, also when it was clipped.
export function write(g: Grid, x: number, y: number, text: string, style: Style = {}): number {
  let at = x
  for (const ch of safe(text)) {
    put(g, at, y, ch.codePointAt(0) ?? SPACE, style)
    at += 1
  }

  return at
}

const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']

// A bar of `value / max` over `width` cells, in eighths of a block, padded.
export function bar(value: number, max: number, width: number): string {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const eighths = Math.round(share * width * 8)
  const text = `${'█'.repeat(Math.floor(eighths / 8))}${EIGHTHS[eighths % 8]}`

  return text.padEnd(width)
}

export function paste(g: Grid, src: Grid, x: number, y: number): void {
  for (let row = 0; row < src.rows; row++) {
    for (let col = 0; col < src.columns; col++) {
      const [code, fg, bg] = cell(src, col, row)
      put(g, x + col, y + row, code, { fg, bg })
    }
  }
}

// The text of each row, trailing spaces cut: the text fallback and the tests.
export function lines(g: Grid): string[] {
  const out: string[] = []
  for (let row = 0; row < g.rows; row++) {
    let text = ''
    for (let col = 0; col < g.columns; col++) text += String.fromCodePoint(cell(g, col, row)[0])
    out.push(text.trimEnd())
  }

  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function bytes(g: Grid): Uint8Array {
  const out = new Uint8Array(g.cells.length * 4)
  g.cells.forEach((word, i) => {
    out[i * 4] = word & 0xff
    out[i * 4 + 1] = (word >>> 8) & 0xff
    out[i * 4 + 2] = (word >>> 16) & 0xff
    out[i * 4 + 3] = (word >>> 24) & 0xff
  })

  return out
}

// The Raster `cells` string: little-endian u32 triplets in padded base64.
export function encode(g: Grid): string {
  const b = bytes(g)
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = ((b[i] ?? 0) << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[(n >>> 18) & 63]
    out += B64[(n >>> 12) & 63]
    out += i + 1 < b.length ? B64[(n >>> 6) & 63] : '='
    out += i + 2 < b.length ? B64[n & 63] : '='
  }

  return out
}

export function decode(columns: number, rows: number, base64: string): Grid {
  const clean = base64.replace(/=+$/, '')
  const b = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let at = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].reduce(
      (sum, k) => (sum << 6) | Math.max(0, B64.indexOf(clean[i + k] ?? 'A')),
      0,
    )
    for (const shift of [16, 8, 0]) if (at < b.length) b[at++] = (n >>> shift) & 0xff
  }
  const cells = new Uint32Array(columns * rows * 3)
  for (let i = 0; i < cells.length; i++) {
    cells[i] =
      ((b[i * 4] ?? 0) |
        ((b[i * 4 + 1] ?? 0) << 8) |
        ((b[i * 4 + 2] ?? 0) << 16) |
        ((b[i * 4 + 3] ?? 0) << 24)) >>>
      0
  }

  return { columns, rows, cells }
}

// A run of text in one style; a row is a list of spans.
export type Span = [text: string, style?: Style]

// Writes spans from (x, y), cut at `width` cells with an ellipsis. Returns the
// column after the last cell written.
export function spans(g: Grid, x: number, y: number, list: Span[], width = g.columns - x): number {
  let at = x
  const end = x + width
  for (const [text, style] of list) {
    const room = end - at
    if (room <= 0) break
    const chars = [...safe(text)]
    const shown = chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : chars.join('')
    at = write(g, at, y, shown, style)
  }

  return at
}

// Splits text into lines of at most `width` cells, at spaces where it can.
// After `safe` each character is one UTF-16 unit, so string indexes are cells.
export function wrap(text: string, width: number): string[] {
  if (width <= 0) return []
  const out: string[] = []
  for (const para of text.split('\n')) {
    let rest = safe(para).trimEnd()
    while (rest.length > width) {
      const cut = rest.slice(0, width + 1).lastIndexOf(' ')
      const at = cut > 0 && !/^\s*(?:[-*+]|\d+\.)$/.test(rest.slice(0, cut)) ? cut : width
      out.push(rest.slice(0, at).trimEnd())
      rest = rest.slice(at).trimStart()
    }
    out.push(rest)
  }

  return out
}
