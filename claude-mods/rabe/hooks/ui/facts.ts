import type { RabeItem } from '../model'
import { clockTime, duration } from './format'
import { children, forwarderOf, glyph, KIND_LABEL, nextAt, statusLabel } from './lists'

// `long` is the last fact, drawn in full across lines: a path that a cut would lose.
export type Facts = { title: string; status: string; lines: string[]; long?: string }

const na = (value: unknown) => (value === undefined || value === '' ? 'n/a' : String(value))
const base = (path: string) => path.split('/').filter(Boolean).at(-1) ?? path

function statusWord(item: RabeItem, now: number): string {
  if (item.status !== 'running') {
    const exit = item.kind === 'shell' && item.detail.exitCode !== undefined
    return exit ? `${item.status} · exit ${item.detail.exitCode}` : statusLabel(item)
  }
  if (item.kind === 'monitor') return 'watching'
  if (item.kind === 'cron') {
    const at = nextAt(item, now)
    return at === 'n/a' ? 'scheduled' : at === 'due' ? 'due' : `next ${at}`
  }

  return 'running'
}

function ran(item: RabeItem, now: number): string {
  if (item.startedAt === undefined) return 'started before Rabe loaded · start time not known'
  const end = item.endedAt ?? now
  const span = `${clockTime(item.startedAt)} → ${item.endedAt ? clockTime(end) : 'now'}`

  return `ran ${span} · ${duration(end - item.startedAt)}`
}

export function facts(item: RabeItem, now: number, items: RabeItem[], cwd?: string): Facts {
  const parent = items.find(one => one.id === item.parentId)
  const by = `started by ${parent ? `${KIND_LABEL[parent.kind]} ${parent.title}` : 'main session'}`
  const lines: string[] = []
  let long: string | undefined
  switch (item.kind) {
    case 'agent': {
      const d = item.detail
      const tree = d.worktreePath
        ? `worktree ${base(d.worktreePath)}`
        : d.cwd && d.cwd === cwd
          ? 'main tree'
          : 'tree n/a'
      lines.push(`${na(d.type)} · ${na(d.model)} · ${tree}`)
      if (d.worktreeBranch) lines.push(`branch ${d.worktreeBranch}`)
      if (d.workflowPhase) lines.push(`phase ${d.workflowPhase}`)
      lines.push(`agent ${d.agentId}`, by, ran(item, now))
      long = `transcript ${na(d.transcriptPath)}`
      break
    }
    case 'codex': {
      const d = item.detail
      const file = d.isSessionMissing
        ? 'gone'
        : d.isSessionPartial
          ? 'partial'
          : d.sessionPath
            ? 'read'
            : 'n/a'
      lines.push(`model ${na(d.model)} · effort ${na(d.effort)} · sandbox ${na(d.sandbox)}`)
      const forwarder = forwarderOf(item, items)
      lines.push(
        `job ${d.jobId} · thread ${na(d.threadId)} · session file ${file}`,
        forwarder ? `forwarded by claude ${forwarder.title} · its tokens count here` : by,
        ran(item, now),
      )
      break
    }
    case 'workflow': {
      const d = item.detail
      lines.push(`run ${d.runId} · ${children(items, item.id).length} agents`)
      if (d.scriptPath) lines.push(`script ${d.scriptPath}`)
      lines.push(ran(item, now))
      break
    }
    case 'shell': {
      const d = item.detail
      lines.push(`command ${d.command}`, `task ${na(d.taskId)}`, by, ran(item, now))
      if (d.exitCode !== undefined) lines.push(`exit code ${d.exitCode}`)
      if (d.port !== undefined) lines.push(`port :${d.port}`)
      break
    }
    case 'monitor': {
      const d = item.detail
      if (d.description) lines.push(`description ${d.description}`)
      lines.push(`command ${d.command}`, by, ran(item, now))
      if (d.timeoutMs !== undefined) {
        const left =
          item.startedAt === undefined
            ? ''
            : ` · ${duration(item.startedAt + d.timeoutMs - now)} left`
        lines.push(`timeout ${duration(d.timeoutMs)}${item.status === 'running' ? left : ''}`)
      }
      lines.push(
        `persistent ${d.isPersistent === undefined ? 'n/a' : d.isPersistent ? 'yes' : 'no'}`,
      )
      break
    }
    case 'cron': {
      const d = item.detail
      if (d.scheduledFor !== undefined) lines.push(`fires at ${clockTime(d.scheduledFor)}`)
      else lines.push(`schedule ${na(d.schedule)}${d.humanSchedule ? ` · ${d.humanSchedule}` : ''}`)
      lines.push(
        `prompt ${d.prompt}`,
        `job ${d.jobId}`,
        `created ${clockTime(item.seenAt)} · ${by}`,
      )
      break
    }
  }

  return {
    title: `${KIND_LABEL[item.kind]} · ${item.title}`,
    status: `${glyph(item)} ${statusWord(item, now)}`,
    lines,
    ...(long !== undefined && { long }),
  }
}
