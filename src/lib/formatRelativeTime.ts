const MINUTE_MS = 60_000
const DIVISIONS: { limitMs: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limitMs: MINUTE_MS, unit: "second" },
  { limitMs: 60 * MINUTE_MS, unit: "minute" },
  { limitMs: 24 * 60 * MINUTE_MS, unit: "hour" },
  { limitMs: 30 * 24 * 60 * MINUTE_MS, unit: "day" },
  { limitMs: 365 * 24 * 60 * MINUTE_MS, unit: "month" },
  { limitMs: Infinity, unit: "year" },
]

const UNIT_MS: Record<string, number> = {
  second: 1000,
  minute: MINUTE_MS,
  hour: 60 * MINUTE_MS,
  day: 24 * 60 * MINUTE_MS,
  month: 30 * 24 * 60 * MINUTE_MS,
  year: 365 * 24 * 60 * MINUTE_MS,
}

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const elapsedMs = new Date(isoDate).getTime() - now.getTime()
  if (Number.isNaN(elapsedMs)) return "unknown"

  const division = DIVISIONS.find((d) => Math.abs(elapsedMs) < d.limitMs) ?? DIVISIONS.at(-1)!
  const value = Math.round(elapsedMs / UNIT_MS[division.unit])
  return formatter.format(value, division.unit)
}
