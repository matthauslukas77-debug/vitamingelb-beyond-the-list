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

/**
 * `Montag, 24.08.2026` — so steht das Ausführungsdatum im Zahlungsfluss
 * (Vorlage IMG_5018). Der Wochentag ist dort die eigentliche Information:
 * Er zeigt, warum eine Zahlung am Samstag erst am Montag rausgeht.
 */
const WEEKDAYS_DE = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag',
]

export function formatWeekdayDate(iso: string): string {
  return `${WEEKDAYS_DE[parseIso(iso).getDay()]}, ${formatDate(iso)}`
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

/** Kurzformen für die Zeitraumangabe über dem Total in den Analysen. */
const MONTHS_SHORT_DE = [
  'Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni',
  'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.',
]

/** «Sept. 2024» — Monat und Jahr, wo die ausgeschriebene Form die Zeile sprengt. */
export function formatMonthShort(iso: string): string {
  const date = parseIso(iso)
  return `${MONTHS_SHORT_DE[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Wie weit ein Termin weg ist, in der Form, in der man es sagt: «heute»,
 * «morgen», «in 11 Tagen», «in 5 Monaten».
 *
 * Ab zwei vollen Monaten wird auf Monate umgestellt — «in 340 Tagen» ist keine
 * Antwort auf die Frage, die jemand vor einem Jahresabo hat. Die Umschaltung
 * hängt an den vollen Monaten und nicht an einer Tagesschwelle, sonst käme bei
 * 60 Tagen über einen kurzen Monat «in 1 Monaten» heraus.
 *
 * Liegt `toIso` in der Vergangenheit, ist die Angabe sinnlos — das prüft der
 * Aufrufer, hier kommt dann `heute` zurück.
 */
export function formatUntil(fromIso: string, toIso: string): string {
  const from = parseIso(fromIso)
  const to = parseIso(toIso)
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  if (days <= 0) return 'heute'
  if (days === 1) return 'morgen'

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (to.getDate() < from.getDate()) months -= 1
  if (months < 2) return `in ${days} Tagen`
  return months >= 12 ? 'in einem Jahr' : `in ${months} Monaten`
}

/**
 * Zeitraum wie in den Analysen: «Jan. – Aug. 2026». Ein einzelner Monat steht
 * ohne Bindestrich da, ein Zeitraum über den Jahreswechsel mit beiden Jahren.
 */
export function formatPeriod(from: string, to: string): string {
  const a = parseIso(from)
  const b = parseIso(to)
  if (a.getFullYear() !== b.getFullYear()) {
    return `${MONTHS_SHORT_DE[a.getMonth()]} ${a.getFullYear()} – ${MONTHS_SHORT_DE[b.getMonth()]} ${b.getFullYear()}`
  }
  if (a.getMonth() === b.getMonth()) return `${MONTHS_SHORT_DE[b.getMonth()]} ${b.getFullYear()}`
  return `${MONTHS_SHORT_DE[a.getMonth()]} – ${MONTHS_SHORT_DE[b.getMonth()]} ${b.getFullYear()}`
}
