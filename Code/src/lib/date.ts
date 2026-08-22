const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Parst `YYYY-MM-DD` ohne Zeitzonen-Überraschungen. */
export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/** `22.08.2026` */
export function formatDate(iso: string): string {
  const date = parseIso(iso)
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}.${m}.${date.getFullYear()}`
}

/** Tagesüberschrift in der Buchungsliste: «Heute», «Gestern» oder «22. August 2026». */
export function formatDayHeading(iso: string, today: string): string {
  if (iso === today) return 'Heute'
  if (iso === addDays(today, -1)) return 'Gestern'
  const date = parseIso(iso)
  return `${date.getDate()}. ${MONTHS_DE[date.getMonth()]} ${date.getFullYear()}`
}

export function formatMonth(iso: string): string {
  const date = parseIso(iso)
  return `${MONTHS_DE[date.getMonth()]} ${date.getFullYear()}`
}
