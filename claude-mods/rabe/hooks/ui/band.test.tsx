import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { RabeItem } from '../model'
import { ALL, dev, NOW, PRICED, screen } from './fixtures'

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  plugin: 'rabe',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

function holdItems(on: On, items: RabeItem[]) {
  mock.clock(on, { now: NOW })
  on('state.get', async (_$, e, next) =>
    e.plugin === 'rabe' && e.key === 'items' ? { value: { value: items, version: 1 } } : next(e),
  )
}

test('the band draws nothing while nothing runs on every surface', async ($, on) => {
  holdItems(on, [{ ...dev, status: 'done', endedAt: NOW }])
  on('ui.render', { component: 'AbovePrompt' }, async () => ({
    type: 'Box',
    props: { key: 'engine' },
  }))
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ surface, ...BAND } as never)
    expect(await ui.find({ key: 'engine' })).toBeDefined()
    expect(await screen(ui)).toEqual([])
    await ui.unmount()
  }
})

test('the band is one line of count chips and the cost under an empty row on every surface', async ($, on) => {
  holdItems(on, PRICED)
  on('session.usage', async () => ({ value: { cost: { usd: 0.31 } } }) as never)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ surface, ...BAND } as never)
    const shown = await screen(ui)
    expect(shown).toHaveLength(2)
    expect(shown[0]?.trim()).toBe('')
    expect(shown[1]).toMatch(/^ session ≈ \$0\.31 ✗ 1 shell failed/)
    expect(shown[1]).toContain('◐ 2 agent')
    await ui.unmount()
  }
})

test('the band is a Raster exactly as wide as the band body on the terminal', async ($, on) => {
  holdItems(on, ALL)
  const ui = await $.ui.mount({ surface: 'terminal', ...BAND } as never)
  const raster = await ui.find({ type: 'Raster' })
  expect(raster?.props.columns).toBe(120)
  expect(raster?.props.rows).toBe(2)
  await ui.unmount()
})

test('a narrow band, as beside an open pane, fits its width on every surface', async ($, on) => {
  holdItems(on, ALL)
  for (const surface of SURFACES) {
    const props = { ...BAND.props, bodyColumns: 24 }
    const ui = await $.ui.mount({ surface, ...BAND, props } as never)
    const shown = await screen(ui)
    expect(shown).toHaveLength(2)
    expect(shown[1]?.trim()).not.toBe('')
    for (const line of shown) expect(line.length).toBeLessThanOrEqual(24)
    await ui.unmount()
  }
})

test('a short band stays one line under the gap on every surface', async ($, on) => {
  holdItems(on, ALL)
  for (const surface of SURFACES) {
    const props = { ...BAND.props, maxRows: 3 }
    const ui = await $.ui.mount({ surface, ...BAND, props } as never)
    expect(await screen(ui)).toHaveLength(2)
    await ui.unmount()
  }
})
