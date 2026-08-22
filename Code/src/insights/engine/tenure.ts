import { parseIso } from '../../lib/date'
import type { Transaction } from '../../data/types'
import type { RecurringSeries } from '../../domain/recurring'

/**
 * Wie lange läuft diese Reihe schon, und was hat sie insgesamt gekostet?
 *
 * Die Abo-Liste der App beantwortet «was kommt als Nächstes» — nicht «seit
 * wann zahle ich das eigentlich». Genau das ist die Frage, die im Gespräch
 * niemand beantworten konnte: Fritz schätzte seine Abos auf «tonnenweise, ca.
 * 300 im Monat», aber niemand rechnet 31 × 12.95 im Kopf zusammen.
 *
 * Es kommt kein neues Feld dazu: `RecurringSeries` trägt `firstSeen`,
 * `occurrences`, `priceChange` und `transactionIds` bereits. Hier wird nur
 * summiert und in Zeiträume umgerechnet — deterministisch, testbar, keine KI.
 */

/** Ein Abschnitt gleichen Betrags — «12 × 10.95, dann 18 × 12.95». */
export interface AmountPhase {
  amount: number
  from: string
  to: string
  count: number
}

export interface SeriesTenure {
  /** Tage seit der ersten gefundenen Buchung. */
  days: number
  /** Volle Monate seit der ersten gefundenen Buchung. */
  months: number
  /** «2 Jahre 6 Monate» — die Angabe, die auf den Bildschirm gehört. */
  label: string
  since: string
  /**
   * Die erste gefundene Buchung liegt am Rand des Datenfensters: Die Reihe ist
   * vermutlich älter, wir können es aber nicht belegen. Dann heisst es auf dem
   * Bildschirm «seit mindestens …».
   */
  atWindowEdge: boolean
  occurrences: number
  /** Summe aller Buchungen der Reihe in Rappen (negativ = bezahlt). */
  total: number
  /** Aktueller Betrag × Häufigkeit im Jahr. */
  perYear: number
  /** Betragsabschnitte, ältester zuerst. */
  phases: AmountPhase[]
  /** Was die Preiserhöhung im Jahr ausmacht, positiv = teurer geworden. */
  extraPerYear?: number
}

/**
 * Wie oft eine Reihe im Jahr kommt — aus dem erkannten Rhythmus, nicht über den
 * Median-Abstand. Sonst stünde bei einem Monatsabo von 79.90 «941.52 im Jahr»,
 * weil der gemessene Abstand 31 statt 30.44 Tage ist. Eine Zahl, die der Nutzer
 * im Kopf nachrechnet, muss aufgehen: 12 × 79.90 = 958.80.
 */
const PER_YEAR: Record<RecurringSeries['cadence'], number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  yearly: 1,
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000)
}

/**
 * Volle Kalendermonate zwischen zwei Daten. Kalendarisch, nicht durch 30.44
 * geteilt: «seit dem 14. Februar» sind am 13. August fünf Monate, nicht sechs.
 */
export function monthsBetween(fromIso: string, toIso: string): number {
  const a = parseIso(fromIso)
  const b = parseIso(toIso)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  return Math.max(0, months)
}

/** «14 Tage» · «1 Monat» · «7 Monate» · «1 Jahr 3 Monate» · «2 Jahre» */
export function durationLabel(days: number, months: number): string {
  if (months < 1) return days === 1 ? '1 Tag' : `${days} Tage`
  if (months < 12) return months === 1 ? '1 Monat' : `${months} Monate`

  const years = Math.floor(months / 12)
  const rest = months % 12
  const yearPart = years === 1 ? '1 Jahr' : `${years} Jahre`
  if (rest === 0) return yearPart
  return `${yearPart} ${rest === 1 ? '1 Monat' : `${rest} Monate`}`
}

/**
 * Fasst gleich hohe Buchungen zu Abschnitten zusammen. Toleranz 1 % (mindestens
 * 20 Rappen), damit eine Rundung keinen neuen Abschnitt erzeugt — dieselbe
 * Schwelle, mit der `recurring.ts` eine Preisänderung erkennt.
 */
export function amountPhases(entries: { date: string; amount: number }[]): AmountPhase[] {
  const phases: AmountPhase[] = []
  for (const entry of entries) {
    const current = phases[phases.length - 1]
    const tolerance = current ? Math.max(20, Math.abs(current.amount) * 0.01) : 0
    if (current && Math.abs(entry.amount - current.amount) <= tolerance) {
      current.to = entry.date
      current.count += 1
    } else {
      phases.push({ amount: entry.amount, from: entry.date, to: entry.date, count: 1 })
    }
  }
  return phases
}

export interface TenureOptions {
  today: string
  /**
   * Erste Buchung, die im Datensatz überhaupt vorliegt. Alles, was hier
   * anfängt, ist womöglich älter als der Datensatz.
   */
  windowStart: string
}

export function seriesTenure(
  series: RecurringSeries,
  transactions: Transaction[],
  { today, windowStart }: TenureOptions,
): SeriesTenure {
  const ids = new Set(series.transactionIds)
  const entries = transactions
    .filter((tx) => ids.has(tx.id))
    .map((tx) => ({ date: tx.date, amount: tx.amount }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const days = daysBetween(series.firstSeen, today)
  const months = monthsBetween(series.firstSeen, today)

  // Fängt die Reihe im ersten Rhythmus des Datenfensters an, kann sie älter
  // sein. Mindestens 35 Tage, damit auch Monatsabos am Rand erfasst werden.
  const edge = Math.max(35, series.intervalDays * 1.5)
  const atWindowEdge = daysBetween(windowStart, series.firstSeen) <= edge

  const change = series.priceChange
  const extraPerYear = change
    ? (Math.abs(change.to) - Math.abs(change.from)) * PER_YEAR[series.cadence]
    : undefined

  return {
    days,
    months,
    label: durationLabel(days, months),
    since: series.firstSeen,
    atWindowEdge,
    occurrences: entries.length || series.occurrences,
    total: entries.reduce((sum, entry) => sum + entry.amount, 0),
    perYear: series.amount * PER_YEAR[series.cadence],
    phases: amountPhases(entries),
    extraPerYear,
  }
}

/** Frühestes Buchungsdatum im Datensatz — der Rand, an dem unser Wissen endet. */
export function dataWindowStart(transactions: Transaction[]): string {
  let earliest = transactions[0]?.date ?? ''
  for (const tx of transactions) if (tx.date < earliest) earliest = tx.date
  return earliest
}
