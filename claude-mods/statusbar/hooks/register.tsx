import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Last, Limit, Row, Snap } from '../types'

const snap = atom({ plugin: 'statusbar', key: 'snap' } as const, null)
const rows = atom({ plugin: 'statusbar', key: 'rows' } as const, null)
const history = atom({ plugin: 'statusbar', key: 'history' } as const, [])
const last = atom({ plugin: 'statusbar', key: 'last' } as const, null)
const isHidden = atom({ plugin: 'statusbar', key: 'isHidden' } as const, false)
const isLegend = atom({ plugin: 'statusbar', key: 'isLegend' } as const, true)
const warned = atom({ plugin: 'statusbar', key: 'warned' } as const, [])
const now = atom({ plugin: 'statusbar', key: 'now' } as const, 0)

const AMBER = '#c98500'
const RED = '#e66767'
const FREE = '#45475a'
const RESERVE = '#6c7086'
const OTHER = '#9399b2'

// Category colors validated for a dark surface (lightness band, CVD separation)
const PALETTE: [RegExp, string, string, string][] = [
  [/system prompt/i, '#e66767', 'system', 'sys'],
  [/tools/i, '#9085e9', 'tools', 'tools'],
  [/mcp/i, '#d55181', 'MCP', 'mcp'],
  [/agent/i, '#c98500', 'agents', 'agents'],
  [/memory/i, '#199e70', 'memory', 'mem'],
  [/skill/i, '#d95926', 'skills', 'skills'],
  [/messages/i, '#3987e5', 'messages', 'msg'],
]

export const fmt = (n: number): string => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

export const eta = (resetsAt: string | undefined, at: number): string => {
  if (!resetsAt) return ''
  const s = Math.floor((Date.parse(resetsAt) - at) / 1000)
  if (!Number.isFinite(s)) return ''
  if (s <= 0) return 'now'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d${h % 24}h`
  if (h > 0) return `${h}h${m}m`
  return `${m}m`
}

export const paint = (r: Row): { color: string; name: string; short: string } => {
  if (r.kind === 'free') return { color: FREE, name: 'free', short: 'free' }
  if (r.kind === 'buffer') return { color: RESERVE, name: 'reserve', short: 'reserve' }
  for (const [re, color, name, short] of PALETTE) {
    if (re.test(r.name)) return { color, name, short }
  }
  return { color: OTHER, name: r.name.toLowerCase(), short: r.name.toLowerCase() }
}

type Cell = { ch: string; color: string; dim: boolean }

export const barCells = (list: Row[], width: number, markerAt: number): Cell[] => {
  const shown = list.filter(r => r.kind !== 'deferred')
  const total = shown.reduce((a, r) => a + r.tokens, 0) || 1
  const cells: Cell[] = []
  const counts = new Map<Row, number>()
  for (const r of shown.filter(x => x.kind !== 'free')) {
    counts.set(r, r.tokens > 0 ? Math.max(1, Math.round((r.tokens / total) * width)) : 0)
  }
  const used = [...counts.values()].reduce((a, n) => a + n, 0)
  for (const r of shown.filter(x => x.kind === 'free')) counts.set(r, Math.max(0, width - used))
  for (const r of shown) {
    const n = counts.get(r) ?? 0
    const ch = r.kind === 'free' ? '░' : r.kind === 'buffer' ? '▒' : '█'
    for (let i = 0; i < n && cells.length < width; i++) {
      cells.push({ ch, color: paint(r).color, dim: false })
    }
  }
  while (cells.length < width) cells.push({ ch: '░', color: FREE, dim: false })
  if (markerAt >= 0 && markerAt < width) cells[markerAt] = { ch: '┃', color: '#cdd6f4', dim: false }
  return cells
}

const runs = (cells: Cell[]): { text: string; color: string }[] => {
  const out: { text: string; color: string }[] = []
  for (const c of cells) {
    const p = out[out.length - 1]
    if (p && p.color === c.color && !(c.ch === '┃')) p.text += c.ch
    else out.push({ text: c.ch, color: c.color })
  }
  return out
}

export type LegendItem = { key: string; swatch: string; color: string; text: string }

export const legendItems = (
  list: Row[],
  window: number,
  isNarrow: boolean,
  minShare = 0.005,
): LegendItem[] => {
  const used = list.filter(r => r.kind === 'used' && r.tokens > 0).sort((a, b) => b.tokens - a.tokens)
  const big = used.filter(r => r.tokens / window >= minShare)
  const small = used.filter(r => r.tokens / window < minShare)
  const out: LegendItem[] = big.map(r => {
    const p = paint(r)
    const label = isNarrow ? p.short : p.name
    return { key: p.name, swatch: '■', color: p.color, text: `${label} ${fmt(r.tokens)}` }
  })
  if (small.length > 0) {
    const t = small.reduce((a, r) => a + r.tokens, 0)
    out.push({ key: 'other', swatch: '■', color: OTHER, text: `other ${fmt(t)}` })
  }
  for (const r of list) {
    if (r.kind === 'buffer' || r.kind === 'free') {
      const p = paint(r)
      out.push({
        key: p.name,
        swatch: r.kind === 'free' ? '░' : '▒',
        color: p.color,
        text: `${isNarrow ? p.short : p.name} ${fmt(r.tokens)}`,
      })
    }
  }
  return out
}

// One ladder for context and limits, always on what is left
export const leftColor = (leftPercent: number): string =>
  leftPercent >= 50 ? 'text' : leftPercent >= 20 ? AMBER : RED

export const hitColor = (hit: number): string => (hit >= 90 ? 'text' : hit >= 50 ? AMBER : RED)

export const limitBar = (left: number, cells: number): string => {
  const filled = Math.max(0, Math.min(cells, Math.round((left / 100) * cells)))
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled)
}

export const cacheState = (
  left: number | null,
): { glyph: string; color: string; text: string } | null => {
  if (left === null) return null
  if (left <= 0) return { glyph: '○', color: RED, text: 'cold' }
  const t = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return left < 60 ? { glyph: '◐', color: AMBER, text: t } : { glyph: '●', color: '#199e70', text: t }
}

// Turns until the context reaches the compact point, from the last 6 turns' growth.
// Null when there is too little data, the growth is noise (under 200 tokens a turn),
// or the answer is too far off to mean anything (over 60 turns).
export const turnsLeft = (used: number[], threshold: number): number | null => {
  const pts = used.slice(-6)
  if (pts.length < 3) return null
  const growth = (pts[pts.length - 1] - pts[0]) / (pts.length - 1)
  if (growth < 200) return null
  const remaining = threshold - pts[pts.length - 1]
  if (remaining <= 0) return 0
  const n = Math.ceil(remaining / growth)
  return n > 60 ? null : n
}

export const tier = (cols: number): 'wide' | 'mid' | 'narrow' =>
  cols >= 150 ? 'wide' : cols >= 130 ? 'mid' : 'narrow'

async function refreshUsage($: EngineInterface): Promise<Snap> {
  const u = await $.session.usage({ breakdown: 'summary' })
  const s: Snap = {
    tokens: u.context.tokens,
    window: u.context.window,
    percent: u.context.percent,
    limits: u.rateLimits,
    usd: u.cost?.usd,
  }
  await update($, snap, () => s)
  const cats = u.context.breakdown?.categories
  await update($, rows, () =>
    cats
      ? cats.map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind }))
      : null,
  )
  return s
}

export const register: Register = (on, options) => {
  const autocompact = Number(options.autocompactPercent ?? 75)
  const ttl = Number(options.cacheTtlSeconds ?? 3600)
  let tools = 0
  let prevUsd = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'statusbar',
      description: 'Show or hide the status band above the prompt',
    })
    await $.command.register({
      name: 'context-bar',
      description: 'Toggle the legend under the context bar',
    })
    const started = await next(e)
    await refreshUsage($)
    $.clock.every(10000, async () => {
      const l = await read($, last)
      if (l) {
        const t = await $.clock.now()
        await update($, now, () => t)
      }
    })
    return started
  })

  on('command.run', { command: 'statusbar' }, async $ => {
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)
    return { text: hidden ? 'Status band shown.' : 'Status band hidden.' }
  })

  on('command.run', { command: 'context-bar' }, async $ => {
    const shown = await read($, isLegend)
    await update($, isLegend, () => !shown)
    return { text: shown ? 'Legend hidden.' : 'Legend shown.' }
  })

  on('prompt.submit', async ($, e, next) => {
    tools = 0
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    tools += 1
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    const s = await refreshUsage($)
    const at = await $.clock.now()
    const usd = s.usd ?? 0
    const u = e.usage
    const inTok = u ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens : 0
    const entry: Last = {
      seconds: Math.round(e.durationMs / 1000),
      tools,
      usd: Math.max(0, usd - prevUsd),
      outTokens: u?.output_tokens ?? 0,
      cacheHitPercent: inTok > 0 && u ? Math.round((u.cache_read_input_tokens / inTok) * 100) : 0,
      endedAt: at,
    }
    prevUsd = usd
    await update($, last, () => entry)
    if (s.tokens !== undefined) {
      const tokensNow = s.tokens
      await update($, history, h => [...h, tokensNow].slice(-6))
    }
    await update($, now, () => at)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const active: Record<string, string> = {}
    const pct = e.context.percent ?? 0
    if (pct >= 90) active.ctx90 = `Context at ${Math.round(pct)}%`
    else if (pct >= autocompact) active.ctx75 = `Context at ${Math.round(pct)}%: compaction is close`
    for (const l of e.rateLimits as Limit[]) {
      const name = l.kind === 'five_hour' ? '5h' : l.kind === 'seven_day' ? '7d' : l.kind
      if (l.percentUsed >= 95) active[`${name}95`] = `${name} limit ${Math.round(l.percentUsed)}% used`
      else if (l.percentUsed >= 80) active[`${name}80`] = `${name} limit ${Math.round(l.percentUsed)}% used`
    }
    const before = await read($, warned)
    for (const k of Object.keys(active).filter(k => !before.includes(k))) $.ui.toast(active[k])
    await update($, warned, () => Object.keys(active))
    await update($, snap, s => ({
      tokens: e.context.tokens,
      window: e.context.window,
      percent: e.context.percent,
      limits: e.rateLimits as Limit[],
      usd: e.cost?.usd ?? s?.usd,
    }))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const s = await read($, snap)
    if (!s) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const [list, l, legend, hist] = await Promise.all([
      read($, rows),
      read($, last),
      read($, isLegend),
      read($, history),
    ])
    await read($, now)
    const wall = await $.clock.now()
    const cols = e.props.bodyColumns
    const t = tier(cols)
    const isNarrow = t === 'narrow'
    const isTiny = cols < 120
    const pct = Math.round(s.percent ?? 0)
    const shown = (list ?? []).filter(r => r.kind !== 'deferred')
    const total = shown.reduce((a, r) => a + r.tokens, 0)
    const threshold = (total * autocompact) / 100
    const left = list ? turnsLeft(hist, threshold) : null
    const leftText =
      left === null ? '' : left === 0 ? 'compact due' : left < 3 ? `${left} turns left` : `~${left} turns left`
    const width = Math.max(10, cols - 3 - leftText.length - 6)
    const markerAt = Math.floor((autocompact / 100) * width)
    const cells = list
      ? barCells(list, width, markerAt)
      : barCells(
          [
            { name: 'messages', tokens: pct, color: '', kind: 'used' },
            { name: 'free', tokens: 100 - pct, color: '', kind: 'free' },
          ],
          width,
          markerAt,
        )
    const items = list ? legendItems(list, total || 1, isTiny, isTiny ? 0.01 : 0.005) : []
    if (list) items.push({ key: 'compact', swatch: '┃', color: '#cdd6f4', text: `compact ${fmt(Math.round(threshold))}` })
    const cacheLeft = l ? Math.round(ttl - (wall - l.endedAt) / 1000) : null
    const cache = cacheState(cacheLeft)
    const limitCells = cols < 100 ? 6 : 10
    const gap = isNarrow ? 2 : 3
    const rowGap = isNarrow ? 3 : 4
    const blank = 0

    const limitNodes = s.limits.map(x => {
      const name = x.kind === 'five_hour' ? '5h' : x.kind === 'seven_day' ? '7d' : x.kind
      const left = Math.max(0, 100 - Math.round(x.percentUsed))
      const color = leftColor(left)
      return (
        <Text key={x.kind}>
          {name} <Text color={color}>{limitBar(left, limitCells)}</Text>{' '}
          <Text color={color}>{left}%</Text> <Text dimColor>{eta(x.resetsAt, wall)}</Text>
        </Text>
      )
    })

    const turnNodes = l
      ? [
          <Text key="s">{l.seconds}s</Text>,
          <Text key="t">{l.tools} {l.tools === 1 ? 'tool' : 'tools'}</Text>,
          <Text key="c">${l.usd.toFixed(2)}</Text>,
          <Text key="o">↑{fmt(l.outTokens)}</Text>,
          <Text key="h" color={l.cacheHitPercent >= 90 ? undefined : hitColor(l.cacheHitPercent)} dimColor={l.cacheHitPercent >= 90}>⚡ {l.cacheHitPercent}% cache</Text>,
          cache ? (
            <Text key="k">
              <Text color={cache.color}>{cache.glyph}</Text>{' '}
              <Text color={cache.glyph === '○' ? RED : undefined} dimColor={cache.glyph === '●'}>{cache.text}</Text>
              {cache.glyph === '○' && !isNarrow && <Text color={RED}> ⚠ next re-reads full</Text>}
            </Text>
          ) : (
            <Text key="k"> </Text>
          ),
        ]
      : []

    const lane = (nodes: unknown[]) =>
      nodes.map((n, i) => <Box key={String(i)}>{n as never}</Box>)

    return (
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Box width={3}><Text dimColor>◔</Text></Box>
          <Box flexDirection="row" columnGap={2}>
            <Box flexDirection="row">
              {runs(cells).map((r, i) => (
                <Text key={String(i)} color={r.color}>{r.text}</Text>
              ))}
            </Box>
            {leftText !== '' && (
              <Text color={left !== null && left < 3 ? RED : undefined} dimColor={left !== null && left >= 3}>
                {leftText}
              </Text>
            )}
          </Box>
        </Box>
        {legend && cols >= 80 && items.length > 0 && (
          <Box flexDirection="row">
            <Box width={3}><Text> </Text></Box>
            <Box flexDirection="row" flexWrap="wrap" columnGap={gap}>
              {lane(
                items.map(it => (
                  <Text key={it.key}>
                    <Text color={it.color}>{it.swatch}</Text> <Text dimColor>{it.text}</Text>
                  </Text>
                )),
              )}
            </Box>
          </Box>
        )}
        <Box flexDirection="row" marginTop={blank}>
          <Box width={3}><Text dimColor>⏱</Text></Box>
          <Box flexDirection="row" columnGap={rowGap}>
            {lane(
              limitNodes.flatMap((n, i) => (i === 0 ? [n] : [<Text key={`d${i}`} dimColor>·</Text>, n])),
            )}
          </Box>
        </Box>
        {l && (
          <Box flexDirection="row" marginTop={blank}>
            <Box width={3}><Text dimColor>↻</Text></Box>
            <Box flexDirection="row" columnGap={rowGap}>
              {lane(turnNodes)}
            </Box>
          </Box>
        )}
      </Box>
    )
  })
}
