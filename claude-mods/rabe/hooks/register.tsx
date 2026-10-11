import type { Register } from 'claude-code'

import { sources } from './sources'
import { band } from './ui/band'
import { builtin } from './ui/builtin'
import { pane } from './ui/pane'
import { hoursOf } from './ui/views/timeline'

export const register: Register = (on, options) => {
  sources(on, String(options.pricesFile ?? ''))
  band(on)
  pane(on, hoursOf(options.timelineHours))
  if (options.hideBuiltinTasks !== false) builtin(on)
}
