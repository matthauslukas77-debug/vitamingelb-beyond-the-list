import type { Category, Transaction } from '../data/types'
import { parseIso } from '../lib/date'

/**
 * Aufteilung der Einnahmen und Ausgaben auf Oberkategorien — die Datenbasis der
 * beiden Detailseiten hinter der Legende in den Analysen.
 *
 * Vorlage: fehlendeDetailseiten/einkommen/IMG_1696 (Einnahmen), IMG_1697 und
 * IMG_1698 (Ausgaben) — echte Bildschirmfotos, August 2026.
 *
 * Wichtig: Das ist eine ANDERE, gröbere Einteilung als `CATEGORY_GROUP` in
 * `src/data/categories.ts`. Die dortige zweistufige Taxonomie
 * («Mobilität / Öffentlicher Verkehr») steht in den Bewegungsdetails. Hier
 * fasst die App auf sieben Ausgaben- und drei Einnahmen-Töpfe zusammen.
 * Beide Einteilungen existieren in der echten App parallel.
 */

export type BreakdownDirection = 'income' | 'expenses'

interface BucketDef {
  key: string
  label: string
  categories: Category[]
}

/**
 * Die sieben Ausgaben-Töpfe in genau der Reihenfolge der Vorlage — nicht nach
 * Betrag sortiert. In IMG_1698 steht «Leben» mit CHF 321.81 zwischen
 * «Einkaufen» (5'797.31) und «Freizeit» (2'153.16); die Ordnung ist also fest.
 */
const EXPENSE_BUCKETS: BucketDef[] = [
  { key: 'wohnen', label: 'Wohnen', categories: ['housing', 'subscriptions'] },
  { key: 'einkaufen', label: 'Einkaufen', categories: ['groceries', 'shopping'] },
  { key: 'leben', label: 'Leben', categories: ['health'] },
  { key: 'freizeit', label: 'Freizeit', categories: ['eatingOut', 'leisure'] },
  { key: 'mobilitaet', label: 'Mobilität', categories: ['transport'] },
  { key: 'finanzen', label: 'Finanzen', categories: ['taxes', 'insurance'] },
  { key: 'sonstige', label: 'Sonstige Ausgaben', categories: ['cash', 'transfer', 'other'] },
]

/**
 * Die drei Einnahmen-Töpfe. Die Einteilung ist bewusst nicht spiegelbildlich:
 * Eine Gutschrift in einer AUSGABEN-Kategorie ist eine Rückerstattung — die
 * Apotheke erstattet, die Krankenkasse zahlt zurück, ein Kauf wird retourniert.
 * Deshalb sammelt «Rückerstattungen» genau jene Kategorien, die auf der
 * Ausgabenseite Töpfe bilden.
 */
const INCOME_BUCKETS: BucketDef[] = [
  { key: 'einkommen', label: 'Einkommen', categories: ['income'] },
  {
    key: 'rueckerstattungen',
    label: 'Rückerstattungen',
    categories: [
      'groceries', 'shopping', 'health', 'eatingOut', 'leisure',
      'transport', 'housing', 'subscriptions', 'taxes', 'insurance',
    ],
  },
  { key: 'sonstige', label: 'Sonstige Einnahmen', categories: ['transfer', 'cash', 'other'] },
]

export function bucketsFor(direction: BreakdownDirection): readonly BucketDef[] {
  return direction === 'income' ? INCOME_BUCKETS : EXPENSE_BUCKETS
}

export interface BreakdownSlice {
  key: string
  label: string
  /** Immer positiv, in Rappen. */
  amount: number
  count: number
  /** Anteil am Gesamttotal, 0..1. */
  share: number
  /**
   * Position im vollständigen Topf-Verzeichnis, nicht in der gefilterten Liste.
   * Daran hängt die Farbe: «Wohnen» ist bei jeder Persona derselbe Ton, auch
   * wenn bei ihr ein Topf leer bleibt.
   */
  rank: number
}

export interface Breakdown {
  direction: BreakdownDirection
  /** Summe aller Töpfe, positiv, in Rappen. */
  total: number
  /** Total geteilt durch die Zahl der angebrochenen Monate. */
  perMonth: number
  months: number
  from: string
  to: string
  /** Nur Töpfe mit Betrag, in der festen Reihenfolge der Vorlage. */
  slices: BreakdownSlice[]
  count: number
}

/**
 * Zahl der angebrochenen Monate im Zeitraum — der Divisor für «Durchschnitt pro
 * Monat». Gegenprobe an der Vorlage: 31'475.09 / 3'934.39 = 8, und
 * Jan.–Aug. sind acht angebrochene Monate.
 */
export function monthsBetween(from: string, to: string): number {
  const a = parseIso(from)
  const b = parseIso(to)
  const months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1
  return Math.max(months, 1)
}

/**
 * Fasst die Buchungen eines Zeitraums zu Töpfen zusammen.
 *
 * Das Vorzeichen entscheidet über die Seite, nicht die Kategorie: Eine
 * Gutschrift in `health` ist eine Rückerstattung und landet bei den Einnahmen,
 * eine Belastung in `health` bei den Ausgaben. Genau so rechnet die App heute —
 * inklusive der Umbuchung aufs eigene Sparkonto, die als Ausgabe zählt.
 */
export function computeBreakdown(
  transactions: Transaction[],
  { direction, from, to }: { direction: BreakdownDirection; from: string; to: string },
): Breakdown {
  const buckets = bucketsFor(direction)

  /* Kategorie → Topf. Aus den Definitionen abgeleitet, damit die Zuordnung nur
     an einer Stelle steht. */
  const bucketOf = new Map<Category, number>()
  buckets.forEach((bucket, index) => {
    for (const category of bucket.categories) bucketOf.set(category, index)
  })

  const sums = buckets.map(() => ({ amount: 0, count: 0 }))
  let total = 0
  let count = 0

  for (const tx of transactions) {
    if (tx.date < from || tx.date > to) continue
    if (direction === 'income' ? tx.amount <= 0 : tx.amount >= 0) continue
    const index = bucketOf.get(tx.category)
    if (index === undefined) continue
    const value = Math.abs(tx.amount)
    sums[index].amount += value
    sums[index].count += 1
    total += value
    count += 1
  }

  const months = monthsBetween(from, to)

  return {
    direction,
    total,
    perMonth: total === 0 ? 0 : Math.round(total / months),
    months,
    from,
    to,
    count,
    slices: buckets
      .map((bucket, index) => ({
        key: bucket.key,
        label: bucket.label,
        amount: sums[index].amount,
        count: sums[index].count,
        share: total === 0 ? 0 : sums[index].amount / total,
        rank: index,
      }))
      .filter((slice) => slice.amount > 0),
  }
}
