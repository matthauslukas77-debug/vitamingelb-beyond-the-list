import type { Account } from '../../data/types'
import { parseIso, toIso } from '../../lib/date'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Wenn du das Budget hältst — wie sieht es in ein paar Jahren aus?
 *
 * Bewusst die einfachste Rechnung, die stimmt: Startguthaben plus Überschuss
 * mal Monate. Kein Zins, keine Rendite, keine Teuerung.
 *
 * Das ist eine Entscheidung, keine Bequemlichkeit. Sobald eine Prognose einen
 * Zinssatz annimmt, hängt ihr Ergebnis an einer Zahl, die niemand kennt — und
 * bei fünf Jahren macht die Annahme mehr aus als das Sparverhalten. Bruno im
 * Interview 07: «Einfach plausibel müsste es sein.» Eine gerade Linie ist
 * plausibel und im Kopf nachrechenbar; eine Zinseszinskurve sieht nur so aus.
 * Dieselbe Haltung steht schon hinter `engine/balance.ts`: prognostiziert wird,
 * was feststeht.
 *
 * Zwei Linien, nicht eine — das ist der eigentliche Inhalt:
 *
 *   **Plan**  was das Budget verspricht (Einnahmen minus geplante Ausgaben)
 *   **Ist**   was in den letzten zwölf Monaten wirklich aufs Sparkonto ging
 *
 * Wer nur die Planlinie zeigt, verkauft einen Vorsatz als Tatsache. Der
 * Abstand zwischen beiden ist die ehrliche Aussage — und bei Reto sind das
 * CHF 140 im Monat, die jeden Monat unbemerkt liegenbleiben.
 *
 * Alle Beträge in ganzzahligen Rappen.
 */

export interface ProjectionPoint {
  /** Monate ab heute, 0 = jetzt. */
  month: number
  /** ISO-Datum des Monatsendes. */
  date: string
  balance: number
}

export interface Projection {
  /** Guthaben heute, Rappen. */
  start: number
  /** Veränderung pro Monat, Rappen. Negativ = es schmilzt. */
  perMonth: number
  points: ProjectionPoint[]
  /** Stand nach so vielen Monaten, Rappen. */
  at(months: number): number
}

/**
 * Das Guthaben, auf dem die Projektion aufsetzt.
 *
 * Gezählt werden Spar- und Vorsorgekonten, nicht das Privatkonto: Was dort
 * liegt, ist der laufende Monat und kein Vermögen. Hat jemand kein Sparkonto —
 * Nino zum Beispiel —, startet die Linie bei null und zeigt trotzdem das
 * Richtige, nämlich was sich aufbauen würde.
 */
export function savingsBalance(accounts: Account[]): number {
  return accounts
    .filter((account) => account.kind === 'savings' || account.kind === 'retirement3a')
    .reduce((total, account) => total + (account.balanceChf ?? account.balance), 0)
}

/** Letzter Tag des Monats, `count` Monate nach dem Stichtag. */
function monthEnd(today: string, count: number): string {
  const date = parseIso(today)
  return toIso(new Date(date.getFullYear(), date.getMonth() + count + 1, 0))
}

export function project(
  start: number,
  perMonth: number,
  { months, today }: { months: number; today: string },
): Projection {
  const points: ProjectionPoint[] = []
  for (let month = 0; month <= months; month++) {
    points.push({ month, date: monthEnd(today, month), balance: start + perMonth * month })
  }
  return {
    start,
    perMonth,
    points,
    at: (count) => start + perMonth * count,
  }
}

export interface Milestone {
  label: string
  months: number
  /** Was der Plan verspricht, Rappen. */
  plan: number
  /** Was das bisherige Sparverhalten ergäbe, Rappen. */
  actual: number
}

export const MILESTONES: { label: string; months: number }[] = [
  { label: 'in 1 Jahr', months: 12 },
  { label: 'in 3 Jahren', months: 36 },
  { label: 'in 5 Jahren', months: 60 },
]

export function milestones(plan: Projection, actual: Projection): Milestone[] {
  return MILESTONES.map((entry) => ({
    ...entry,
    plan: plan.at(entry.months),
    actual: actual.at(entry.months),
  }))
}

/**
 * Wann das Guthaben aufgebraucht wäre — nur bei negativem Verlauf.
 *
 * Die Zahl, die zählt, wenn es nicht aufgeht. Ohne sie sagt ein
 * Ausgabenüberschuss «minus 23 im Monat», was nach nichts klingt; mit ihr sagt
 * er «in 14 Monaten ist das Sparkonto leer».
 */
export function monthsUntilEmpty(projection: Projection): number | null {
  if (projection.perMonth >= 0 || projection.start <= 0) return null
  return Math.ceil(projection.start / -projection.perMonth)
}
