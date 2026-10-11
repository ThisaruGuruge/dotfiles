import type { On } from 'claude-code'

import { render } from './render'
import { bounded, NO_SELECTION } from './view'
import { bandView } from './views/band'

export function band(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const { value: removed = [] } = await $.state.get({ plugin: 'rabe', key: 'removed' })
    if (!items.some(item => item.status === 'running')) return next(e)
    const usage = await $.session.usage().catch(() => undefined)
    const model = {
      items,
      removed,
      turns: {},
      lines: {},
      now: await $.clock.now(),
      usd: usage?.cost?.usd,
    }
    const size = bounded({
      columns: e.props.bodyColumns,
      rows: e.props.maxRows,
      surface: e.surface,
      hasInput: false,
    })

    return render($.ui.resolve(e), e.surface, bandView(model, size, NO_SELECTION), () => {}, 'band')
  })
}
