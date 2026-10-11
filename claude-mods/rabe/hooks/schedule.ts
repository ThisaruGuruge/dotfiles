const MINUTE = 60_000
// ponytail: walks minute, hour and day steps; four years covers 29 Feb, then gives up
const HORIZON = 4 * 366 * 24 * 60 * MINUTE

const RANGES: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
]

function field(text: string, [min, max]: [number, number]): Set<number> | undefined {
  const values = new Set<number>()
  for (const part of text.split(',')) {
    const match = part.match(/^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/)
    if (!match) return undefined
    const [, all, from, to, step] = match
    const start = all === '*' ? min : Number(from)
    const end = all === '*' || (step && to === undefined) ? max : Number(to ?? from)
    const by = Number(step ?? 1)
    if (start < min || end > max || start > end || by < 1) return undefined
    for (let value = start; value <= end; value += by) values.add(value)
  }

  return values
}

type Fields = [Set<number>, Set<number>, Set<number>, Set<number>, Set<number>]

type Cron = { fields: Fields; isDayOfMonthAny: boolean; isDayOfWeekAny: boolean }

function parse(expr: string): Cron | undefined {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return undefined
  const fields = parts.map((part, index) => field(part, RANGES[index] as [number, number]))
  if (fields.some(one => one === undefined)) return undefined
  const days = fields[4] as Set<number>
  if (days.has(7)) days.add(0)

  return {
    fields: fields as Fields,
    isDayOfMonthAny: parts[2] === '*',
    isDayOfWeekAny: parts[4] === '*',
  }
}

function isDay(cron: Cron, date: Date): boolean {
  const [, , dayOfMonth, , dayOfWeek] = cron.fields
  const isMonthDay = dayOfMonth.has(date.getDate())
  const isWeekDay = dayOfWeek.has(date.getDay())
  if (cron.isDayOfMonthAny || cron.isDayOfWeekAny) return isMonthDay && isWeekDay

  return isMonthDay || isWeekDay
}

function next(cron: Cron, from: number): number | undefined {
  const [minutes, hours, , months] = cron.fields
  const date = new Date(Math.floor(from / MINUTE) * MINUTE + MINUTE)
  while (date.getTime() - from < HORIZON) {
    if (!months.has(date.getMonth() + 1)) {
      date.setMonth(date.getMonth() + 1, 1)
      date.setHours(0, 0)
    } else if (!isDay(cron, date)) {
      date.setDate(date.getDate() + 1)
      date.setHours(0, 0)
    } else if (!hours.has(date.getHours())) {
      date.setHours(date.getHours() + 1, 0)
    } else if (!minutes.has(date.getMinutes())) {
      date.setTime(date.getTime() + MINUTE)
    } else {
      return date.getTime()
    }
  }

  return undefined
}

export function nextRun(expr: string, from: number): number | undefined {
  const cron = parse(expr)

  return cron && next(cron, from)
}

export function nextRuns(expr: string, from: number, count: number): number[] {
  const cron = parse(expr)
  const runs: number[] = []
  for (let time = cron && next(cron, from); time !== undefined && runs.length < count; ) {
    runs.push(time)
    time = next(cron as Cron, time)
  }

  return runs
}
