import type { Register } from 'claude-code'

import { redactBlocks, redactDeep, summary, total, withhold, redactText } from './patterns'
import type { Counts } from './patterns'
import { READ_ONLY_TOOLS, denyMessage, findInlineSecrets, modeOf } from './guard'

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

export const register: Register = (on, options) => {
  const mode = modeOf(options.denyInlineSecrets)

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

  // The tool's structured record (`toolUseResult` in the transcript: Bash's stdout and
  // stderr, a Read's file content, an Edit's patch), which `session.append` stores as made.
  // A rewritten `result` is validated, mapped for the model and recorded in its place. Only a
  // tool that answered is rewritten, and only when something was hidden, so a clean result keeps
  // core's own messages (`ref`). A scan that fails withholds the result.
  //
  // Before that, a call whose own input holds a secret literal is refused (`denyInlineSecrets`,
  // guard.ts), since the input cannot be rewritten. A guard that throws lets the call through:
  // refusing on a scanner fault would stop all work, and the result record is still scanned below.
  on('tool.call', async ($, e, next) => {
    if (mode !== 'off' && !READ_ONLY_TOOLS.has(e.tool)) {
      let found: Counts = {}
      try {
        found = findInlineSecrets(e as unknown as Record<string, unknown>)
      } catch {
        found = {}
      }
      if (total(found) > 0) {
        if (mode === 'deny') {
          $.ui.toast(`redact: blocked a ${e.tool} call holding ${summary(found)}`)
          return { deny: denyMessage(e.tool, found) }
        }
        $.ui.toast(`redact: ${e.tool} call holds ${summary(found)} (warn only)`)
      }
    }
    const r = await next(e)
    if (r.deny !== undefined || r.isError) return r
    const counts: Counts = {}
    const result = redactDeep(r.result, counts)
    const context = r.context?.map(c => redactText(c, counts))
    if (total(counts) === 0) return r
    $.ui.toast(`redact: hid ${total(counts)} secret(s) from a tool's result record (${summary(counts)})`)
    return { result, ...(context ? { context } : {}) } as typeof r
  }).catch(($, e, next) =>
    next.called ? { deny: 'redact: could not scan the result, so it was withheld.' } : next(e),
  )
}
