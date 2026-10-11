import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { compactPoint } from './register'

// A 500k compaction window (autoCompactWindow) on a 1M model, as /context reports it
const CATEGORIES = [
  { name: 'System prompt', tokens: 4000, color: 'x', isDeferred: false, kind: 'used' },
  { name: 'Messages', tokens: 96000, color: 'x', isDeferred: false, kind: 'used' },
  { name: 'MCP tools', tokens: 9000, color: 'x', isDeferred: true, kind: 'deferred' },
  { name: 'Free space', tokens: 367000, color: 'x', isDeferred: false, kind: 'free' },
  { name: 'Autocompact buffer', tokens: 33000, color: 'x', isDeferred: false, kind: 'buffer' },
] as const
const rows = CATEGORIES.map(({ name, tokens, color, kind }) => ({ name, tokens, color, kind }))

test('compactPoint takes Claude Code’s own threshold', () => {
  expect(compactPoint({ categories: rows, autoCompactThreshold: 467000, isAutoCompactEnabled: true }, 75)).toBe(467000)
})

test('compactPoint falls back to the window less its reserve, then to the percent', () => {
  expect(compactPoint({ categories: rows, isAutoCompactEnabled: true }, 75)).toBe(467000)
  // A threshold past the window the rows add up to does not fit them: use the reserve
  expect(compactPoint({ categories: rows, autoCompactThreshold: 967000 }, 75)).toBe(467000)
  const noReserve = rows.filter(r => r.kind !== 'buffer')
  expect(compactPoint({ categories: noReserve }, 75)).toBe(((4000 + 96000 + 367000) * 75) / 100)
})

test('compactPoint is null when auto-compaction is off', () => {
  expect(compactPoint({ categories: rows, isAutoCompactEnabled: false }, 75)).toBeNull()
})

const BAND = {
  plugin: 'statusbar',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 160, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

function usage(on: On, breakdown: Record<string, unknown>) {
  on('clock.now', () => ({ value: 1_000 }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        tokens: 100000,
        window: 1000000,
        percent: 10,
        breakdown: { categories: CATEGORIES, totalTokens: 100000, maxTokens: 500000, rawMaxTokens: 500000, ...breakdown },
      },
      rateLimits: [],
      cost: { usd: 0.5 },
    },
  }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
}

const finish = { answer: 'done', durationMs: 2000, isAborted: false, turnId: 't1', reason: 'answer' } as never

test('the band keeps what other mods draw beneath it and marks Claude’s threshold', async ($, on) => {
  usage(on, { autoCompactThreshold: 467000, isAutoCompactEnabled: true, autocompactSource: 'settings' })
  on('ui.render', { component: 'AbovePrompt' }, async () => ({ type: 'Box', props: { key: 'below' } }) as never)
  await $.turn.complete(finish)

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface } as never)
    expect(await band.find({ key: 'below' })).toBeDefined()
    expect(await band.find({ type: 'Text', text: 'compact 467k' })).toBeDefined()
    await band.unmount()
  }
})

test('no compaction marker when auto-compaction is off', async ($, on) => {
  usage(on, { isAutoCompactEnabled: false, autocompactSource: 'auto' })
  on('ui.render', { component: 'AbovePrompt' }, async () => ({ type: 'Box', props: { key: 'engine' } }) as never)
  await $.turn.complete(finish)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
  expect(await band.find({ type: 'Text', text: /^compact / })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /messages 96k/ })).toBeDefined()
})
