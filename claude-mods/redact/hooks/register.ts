import type { Register } from 'claude-code'

import { redactBlocks, redactText, summary, total } from './patterns'
import type { Counts } from './patterns'

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

  // Tool results, injected attachments and hook context, before they are stored and sent.
  on('session.append', { door: 'tool-result' }, ($, e, next) => {
    const counts: Counts = {}
    const content = redactBlocks(e.message.content, counts)
    if (total(counts) === 0) return next(e)
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from a tool result (${summary(counts)})`)
    return next({ ...e, message: { ...e.message, content } })
  })

  on('session.append', { door: 'attachment' }, ($, e, next) => {
    const counts: Counts = {}
    const content = redactBlocks(e.message.content, counts)
    if (total(counts) === 0) return next(e)
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from an attachment (${summary(counts)})`)
    return next({ ...e, message: { ...e.message, content } })
  })

  on('session.append', { door: 'hook-context' }, ($, e, next) => {
    const counts: Counts = {}
    const content = redactBlocks(e.message.content, counts)
    if (total(counts) === 0) return next(e)
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from hook context (${summary(counts)})`)
    return next({ ...e, message: { ...e.message, content } })
  })
}
