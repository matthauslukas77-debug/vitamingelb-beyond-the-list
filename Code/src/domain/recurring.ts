import { addDays, parseIso } from '../lib/date'
import type { Category, Transaction } from '../data/types'

/**
 * Erkennung wiederkehrender Zahlungen.
 *
 * PostFinance hat diese Funktion bereits («Meine Abos — Wiederkehrende
 * Transaktionen erkunden»), deshalb gehört sie in den Nachbau und nicht in
 * unsere Insights-Schicht. Was daraus entsteht, ist die Grundlage für alles
 * Weitere: Was läuft regelmässig, was kommt als Nächstes, was hat sich
 * still verändert.
 *
 * Bewusst wird NICHT die `seriesId` aus den Mock-Daten gelesen — die gibt es
 * in echten Kontodaten nicht. Erkannt wird aus dem, was eine Bank wirklich
 * sieht: Buchungstext, Betrag und Abstand. Die `seriesId` dient in den Tests
 * als Referenz, um zu prüfen, ob die Erkennung das Richtige findet.
 */

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export type SeriesKind = 'subscription' | 'standingOrder' | 'income' | 'bill' | 'other'

export interface RecurringSeries {
  /** Normalisierter Händlerschlüssel — die Gruppierungsgrundlage. */
  key: string
  /** Lesbare Bezeichnung, aus der jüngsten Buchung. */
  label: string
  kind: SeriesKind
  category: Category
  cadence: Cadence
  /** Median-Abstand in Tagen — die gemessene Grundlage der Einstufung. */
  intervalDays: number
  /** Aktueller Betrag in Rappen (negativ = Belastung). */
  amount: number
  /** Auf einen Monat umgerechnet, damit Wöchentliches vergleichbar wird. */
  monthlyAmount: number
  occurrences: number
  firstSeen: string
  lastSeen: string
  /** Voraussichtlich nächste Belastung. */
  nextExpected: string
  /**
   * Gesetzt, wenn sich der Betrag im Verlauf verändert hat — die schleichende
   * Preiserhöhung, die im Interview niemand bemerkt hat.
   */
  priceChange?: { from: number; to: number; since: string }
  transactionIds: string[]
}

const CADENCES: { cadence: Cadence; days: number; tolerance: number }[] = [
  { cadence: 'weekly', days: 7, tolerance: 2 },
  { cadence: 'biweekly', days: 14, tolerance: 3 },
  { cadence: 'monthly', days: 30.4, tolerance: 4 },
  { cadence: 'quarterly', days: 91.3, tolerance: 9 },
  { cadence: 'semiannual', days: 182.6, tolerance: 15 },
  { cadence: 'yearly', days: 365, tolerance: 25 },
]

const DAYS_PER_MONTH = 30.44

/**
 * Reduziert einen Buchungstext auf den Händler.
 *
 * «Apple Pay Kauf/Dienstleistung vom 21.08.2026, kkiosk 355.78» → «KKIOSK»
 *
 * Datum und Terminal-Nummern fallen weg: Genau sie unterscheiden sonst zwei
 * Buchungen desselben Abos voneinander.
 */
export function normaliseMerchant(text: string): string {
  return text
    .replace(/^apple pay\s+/i, '')
    .replace(/^kauf(\/\w+)?\s+vom\s+\d{2}\.\d{2}\.\d{4},\s*/i, '')
    .replace(/\d{2}\.\d{2}\.\d{4}/g, ' ')
    .toUpperCase()
    .replace(/\d[\d'.,-]*/g, ' ')
    .replace(/[*/\\|,.:;_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Median einer nicht leeren Zahlenreihe. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000)
}

function classify(intervalDays: number): Cadence | null {
  for (const entry of CADENCES) {
    if (Math.abs(intervalDays - entry.days) <= entry.tolerance) return entry.cadence
  }
  return null
}

/**
 * Einordnung einer erkannten Reihe.
 * Alles, was regelmässig abgeht und keine Rechnung und kein Dauerauftrag ist,
 * gilt als Abo — ein Fitnessabo ist eines, auch wenn die Bank es unter
 * «Freizeit» verbucht.
 */
function kindOf(category: Category, amount: number): SeriesKind {
  if (category === 'income' || amount > 0) return 'income'
  if (category === 'transfer') return 'standingOrder'
  if (category === 'housing' || category === 'insurance' || category === 'taxes') return 'bill'
  return 'subscription'
}

/**
 * Sucht die Preisänderung: der jüngste Betrag gegenüber dem, der davor
 * am häufigsten vorkam. Toleranz 1 %, damit Rundungen nicht als Änderung gelten.
 */
function findPriceChange(entries: { date: string; amount: number }[]) {
  if (entries.length < 3) return undefined
  const latest = entries[entries.length - 1].amount

  const counts = new Map<number, number>()
  for (const entry of entries.slice(0, -1)) {
    counts.set(entry.amount, (counts.get(entry.amount) ?? 0) + 1)
  }
  let previous = latest
  let best = 0
  for (const [amount, count] of counts) {
    if (count > best) {
      best = count
      previous = amount
    }
  }

  if (previous === latest) return undefined
  if (Math.abs(latest - previous) / Math.max(Math.abs(previous), 1) < 0.01) return undefined

  const since = entries.find((entry) => entry.amount === latest)?.date
  return since ? { from: previous, to: latest, since } : undefined
}

export interface DetectOptions {
  /** Stichtag für `nextExpected`. */
  today: string
  /** Wie viele Buchungen eine Reihe mindestens braucht. */
  minOccurrences?: number
}

/**
 * Findet alle wiederkehrenden Zahlungsreihen in einer Buchungsliste.
 * Sortiert nach monatlicher Belastung, grösste zuerst.
 */
export function detectRecurring(
  transactions: Transaction[],
  { today, minOccurrences = 3 }: DetectOptions,
): RecurringSeries[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    const key = normaliseMerchant(tx.text)
    if (!key) continue
    const bucket = groups.get(key)
    if (bucket) bucket.push(tx)
    else groups.set(key, [tx])
  }

  const out: RecurringSeries[] = []

  for (const [key, items] of groups) {
    if (items.length < minOccurrences) continue

    const sorted = [...items].sort((a, b) => (a.date < b.date ? -1 : 1))
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }
    if (gaps.length === 0) continue

    const interval = median(gaps)
    const cadence = classify(interval)
    if (!cadence) continue

    // Die Abstände müssen zueinander passen, sonst ist es nur Zufall:
    // ein Laden, in dem jemand oft, aber unregelmässig einkauft.
    const consistent = gaps.filter((gap) => Math.abs(gap - interval) <= Math.max(4, interval * 0.2))
    if (consistent.length / gaps.length < 0.7) continue

    // Ebenso der Betrag: eine Reihe darf sich ändern, aber nicht schwanken.
    const amounts = sorted.map((tx) => tx.amount)
    const typical = median(amounts)
    const stable = amounts.filter(
      (amount) => Math.abs(amount - typical) <= Math.max(200, Math.abs(typical) * 0.25),
    )
    if (stable.length / amounts.length < 0.6) continue

    const last = sorted[sorted.length - 1]
    const perMonth = Math.round(last.amount * (DAYS_PER_MONTH / interval))

    out.push({
      key,
      label: last.text,
      kind: kindOf(last.category, last.amount),
      category: last.category,
      cadence,
      intervalDays: Math.round(interval),
      amount: last.amount,
      monthlyAmount: perMonth,
      occurrences: sorted.length,
      firstSeen: sorted[0].date,
      lastSeen: last.date,
      nextExpected: addDays(last.date, Math.round(interval)),
      priceChange: findPriceChange(sorted.map((tx) => ({ date: tx.date, amount: tx.amount }))),
      transactionIds: sorted.map((tx) => tx.id),
    })
  }

  void today
  return out.sort((a, b) => a.monthlyAmount - b.monthlyAmount)
}

/** Was in den nächsten `days` Tagen ansteht — Grundlage der Prognose. */
export function upcoming(series: RecurringSeries[], today: string, days: number) {
  const until = addDays(today, days)
  return series
    .filter((entry) => entry.nextExpected >= today && entry.nextExpected <= until)
    .sort((a, b) => (a.nextExpected < b.nextExpected ? -1 : 1))
}
