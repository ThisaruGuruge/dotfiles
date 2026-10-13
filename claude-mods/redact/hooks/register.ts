import type { Register } from 'claude-code'

import { redactBlocks, redactText, summary, total, withhold } from './patterns'
import type { Counts } from './patterns'

/**
 * The rows scanned before they are stored and sent, by the door they come in
 * by, and what the toast calls each. `command` is a slash command's record and
 * output and, for `!` bash mode, the `<bash-input>`, `<bash-stdout>` and
 * `<bash-stderr>` rows.
 */
const DOORS = ['tool-result', 'attachment', 'hook-context', 'command'] as const
const WHAT: Record<string, string> = {
  'tool-result': 'a tool result',
  attachment: 'an attachment',
  'hook-context': 'hook context',
  command: 'command output',
}

export const register: Register = on => {
  // The prompt, and context attached to it, before the model reads them.
  on('prompt.submit', ($, e, next) => {
    const counts: Counts = {}
    const text = redactText(e.text, counts)
    const context = e.context?.map(c => redactText(c, counts))

    if (total(counts) === 0) {
      return next(e)
    }
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from your prompt (${summary(counts)})`)
    return next({ ...e, text, ...(context ? { context } : {}) })
  }).catch(($, e, next) =>
    next.called ? next(e) : { drop: 'redact: could not scan the prompt, so it was not sent.' },
  )

  // Tool results, injected attachments, hook context and command output, before they are
  // stored and sent. A scan that throws or runs out of time withholds the row's text
  // rather than letting it through unscanned.
  on('session.append', { door: DOORS }, ($, e, next) => {
    const counts: Counts = {}
    const content = redactBlocks(e.message.content, counts)
    if (total(counts) === 0) return next(e)
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from ${WHAT[e.door] ?? 'a row'} (${summary(counts)})`)
    return next({ ...e, message: { ...e.message, content } })
  }).catch(($, e, next) =>
    next.called ? next(e) : next({ ...e, message: { ...e.message, content: withhold(e.message.content) } }),
  )
}
