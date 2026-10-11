import type { EngineInterface, On } from 'claude-code'

import { type EndStatus, itemId, type RabeItem, type RabeItemOf } from '../model'
import { addItem, type Change, commit, endItem, prune, updateItem } from '../registry'

const LOOP_SENTINEL = '<<autonomous-loop-dynamic>>'
const SENTINEL = /^<<[\w.-]+>>$/
const WAKEUP = 'wakeup-'
// A wakeup fires when the session is idle, up to 90 s early for :00 and :30.
const FIRE_SLACK_MS = 90_000

// Each event takes one hook without a matcher per plugin; these match every event.
const ANY_START = { isInteractive: [true, false] }
const ANY_STOP = { stop_hook_active: [true, false] }

type Job = { id: string; schedule: string; prompt: string; humanSchedule?: string }

async function write($: Pick<EngineInterface, 'state'>, change: Change): Promise<void> {
  for (;;) {
    const { value, version } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = commit(value, change)
    if (next === undefined) return
    const { isSet } = await $.state.set({ plugin: 'rabe', key: 'items' }, next.items, {
      ifVersion: version,
    })
    if (isSet) return forget($, next.dropped)
  }
}

// Drops the lines and turns of the items a write dropped.
async function forget($: Pick<EngineInterface, 'state'>, dropped: string[]): Promise<void> {
  if (dropped.length === 0) return
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'lines' })
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = prune(value, dropped, items)
    if (next === value) break
    const lines = await $.state.set({ plugin: 'rabe', key: 'lines' }, next, { ifVersion: version })
    if (lines.isSet) break
  }
  for (;;) {
    const { value = {}, version } = await $.state.get({ plugin: 'rabe', key: 'turns' })
    const { value: items = [] } = await $.state.get({ plugin: 'rabe', key: 'items' })
    const next = prune(value, dropped, items)
    if (next === value) return
    const turns = await $.state.set({ plugin: 'rabe', key: 'turns' }, next, { ifVersion: version })
    if (turns.isSet) return
  }
}

function runningCrons(items: RabeItem[]): RabeItemOf<'cron'>[] {
  return items.flatMap(item => (item.kind === 'cron' && item.status === 'running' ? [item] : []))
}

function isWakeup(item: RabeItemOf<'cron'>): boolean {
  return item.detail.jobId.startsWith(WAKEUP)
}

function endWakeups(items: RabeItem[], status: EndStatus, now: number, until = Infinity) {
  return dueWakeups(items, until).reduce((next, item) => endItem(next, item.id, status, now), items)
}

function dueWakeups(items: RabeItem[], until: number) {
  return runningCrons(items).filter(
    item => isWakeup(item) && (item.detail.scheduledFor ?? 0) <= until,
  )
}

// A due wakeup ends only on evidence that it fired: its own prompt, or the
// sentinel it was given (`<<autonomous-loop-dynamic>>`), which its expanded
// tick names. Other text, such as a recurring loop's tick, ends none.
function fired(items: RabeItem[], text: string, now: number): RabeItem[] {
  const prompt = text.trim()
  const ends = dueWakeups(items, now + FIRE_SLACK_MS).filter(item => {
    const own = item.detail.prompt.trim()

    return own === prompt || (SENTINEL.test(own) && text.includes(own))
  })

  return ends.reduce((next, item) => endItem(next, item.id, 'done', now), items)
}

function sync(items: RabeItem[], jobs: Job[], now: number): RabeItem[] {
  const listed = new Set(jobs.map(job => itemId('cron', job.id)))
  const running = runningCrons(items)
  const wakeupPrompts = new Set(running.filter(isWakeup).map(item => item.detail.prompt))
  const ended = running
    .filter(item => !isWakeup(item) && !listed.has(item.id))
    .reduce((next, item) => endItem(next, item.id, 'done', now), items)

  return jobs.reduce((next, job) => {
    const id = itemId('cron', job.id)
    if (wakeupPrompts.has(job.prompt) || next.some(item => item.id === id)) return next

    return addItem(
      next,
      {
        id,
        kind: 'cron',
        title: job.prompt,
        status: 'running',
        detail: {
          jobId: job.id,
          prompt: job.prompt,
          schedule: job.schedule,
          ...(job.humanSchedule && { humanSchedule: job.humanSchedule }),
        },
      },
      now,
    )
  }, ended)
}

async function list($: EngineInterface): Promise<void> {
  try {
    const answer = await $.tool.call({ tool: 'CronList' })
    if (!answer.result || answer.isError) return
    const jobs = answer.result.jobs.map(job => ({
      id: job.id,
      schedule: job.cron,
      prompt: job.prompt,
      humanSchedule: job.humanSchedule,
    }))
    const now = await $.clock.now()
    await write($, held => sync(held, jobs, now))
  } catch {}
}

export function crons(on: On): void {
  on('tool.call', { tool: 'CronCreate' }, async ($, e, next) => {
    const answer = await next(e)
    try {
      if (e.tool === 'CronCreate' && answer.result && !answer.isError) {
        const { id, humanSchedule } = answer.result as { id: string; humanSchedule?: string }
        const now = await $.clock.now()
        await write($, held =>
          addItem(
            held,
            {
              id: itemId('cron', id),
              kind: 'cron',
              title: e.prompt,
              status: 'running',
              startedAt: now,
              ...(e.agentId && { parentId: itemId('agent', e.agentId) }),
              detail: {
                jobId: id,
                prompt: e.prompt,
                schedule: e.cron,
                ...(humanSchedule && { humanSchedule }),
              },
            },
            now,
          ),
        )
      }
    } catch {}

    return answer
  })

  on('tool.call', { tool: 'CronDelete' }, async ($, e, next) => {
    const answer = await next(e)
    try {
      if (e.tool === 'CronDelete' && answer.result && !answer.isError) {
        const now = await $.clock.now()
        const id = itemId('cron', e.id)
        await write($, held =>
          updateItem(endItem(held, id, 'stopped', now), id, { detail: { isDeleted: true } }),
        )
      }
    } catch {}

    return answer
  })

  on('tool.call', { tool: 'ScheduleWakeup' }, async ($, e, next) => {
    const answer = await next(e)
    try {
      if (e.tool === 'ScheduleWakeup' && answer.result && !answer.isError) {
        const { scheduledFor, stopped } = answer.result as {
          scheduledFor: number
          stopped?: boolean
        }
        const now = await $.clock.now()
        const prompt = e.prompt ?? ''
        await write($, held =>
          stopped || e.stop
            ? endWakeups(held, 'stopped', now)
            : addItem(
                endWakeups(held, 'done', now),
                {
                  id: itemId('cron', `${WAKEUP}${scheduledFor}`),
                  kind: 'cron',
                  title: prompt === LOOP_SENTINEL ? 'autonomous loop' : prompt,
                  status: 'running',
                  startedAt: now,
                  ...(e.agentId && { parentId: itemId('agent', e.agentId) }),
                  detail: { jobId: `${WAKEUP}${scheduledFor}`, prompt, scheduledFor },
                },
                now,
              ),
        )
      }
    } catch {}

    return answer
  })

  on('prompt.submit', { origin: { kind: 'scheduled-trigger' } }, async ($, e, next) => {
    try {
      const now = await $.clock.now()
      await write($, held => fired(held, e.text, now))
    } catch {}

    return next(e)
  })

  on('classic.Stop', ANY_STOP, async ($, e, next) => {
    try {
      if (e.session_crons) {
        const jobs = e.session_crons.map(job => ({
          id: job.id,
          schedule: job.schedule,
          prompt: job.prompt,
        }))
        const now = await $.clock.now()
        await write($, held => sync(held, jobs, now))
      }
    } catch {}

    return next(e)
  })

  on('session.start', ANY_START, async ($, e, next) => {
    await list($)

    return next(e)
  })
}
