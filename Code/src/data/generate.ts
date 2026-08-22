import { addDays, parseIso, toIso } from '../lib/date'
import { createRng, intBetween, pick } from '../lib/rng'
import type { Category, Currency, Transaction } from './types'

/**
 * Ein Händler, wie er in der Buchungsliste erscheint.
 *
 * Die App setzt den Buchungstext aus Bausteinen zusammen, zum Beispiel
 * «Apple Pay Kauf/Dienstleistung vom 21.08.2026, kkiosk 355.78».
 * Der Händlername steht ganz hinten und wird bei langen Texten abgeschnitten —
 * genau der Frust, den vier von sechs Interviewten beschrieben haben.
 * Vorlage: PREP/07_screenshots/IMG_1675.PNG
 */
export interface Merchant {
  /** Der rohe Händlerstring, so wie ihn das Terminal liefert. */
  name: string
  /** Art des Kaufs — bestimmt den Textbaustein. */
  kind: 'online' | 'service' | 'pos'
  /** Über Apple Pay bezahlt: Der Text bekommt ein Präfix. */
  applePay?: boolean
  category: Category
  /** Betragsspanne in Rappen. */
  min: number
  max: number
  /** Farbige Scheibe als Ersatz für das echte Händlerlogo. */
  brand?: { bg: string; fg: string; short: string }
}

const KIND_LABEL: Record<Merchant['kind'], string> = {
  online: 'Kauf/Onlineshopping',
  service: 'Kauf/Dienstleistung',
  pos: 'Kauf',
}

/** Baut den Buchungstext so zusammen, wie die App ihn anzeigt. */
export function merchantText(merchant: Merchant, iso: string): string {
  const [y, m, d] = iso.split('-')
  const prefix = merchant.applePay ? 'Apple Pay ' : ''
  return `${prefix}${KIND_LABEL[merchant.kind]} vom ${d}.${m}.${y}, ${merchant.name}`
}

/** Wiederkehrende Zahlung: Abo, Dauerauftrag, Lohn. */
export interface Series {
  id: string
  text: string
  category: Category
  /** Betrag in Rappen, negativ für Belastungen. */
  amount: number
  /** Tag im Monat, an dem gebucht wird. */
  dayOfMonth: number
  /** Ab diesem Monat gilt ein anderer Betrag — die schleichende Erhöhung. */
  raise?: { fromIso: string; amount: number }
  counterAccountId?: string
}

export interface GenerateOptions {
  accountId: string
  currency: Currency
  /** Fixer Seed pro Persona: gleiche Daten bei jedem Start. */
  seed: number
  /** Zeitraum, beide Enden inklusive. */
  fromIso: string
  toIso: string
  series: Series[]
  merchants: Merchant[]
  /** Wie viele unregelmässige Buchungen pro Woche. */
  perWeek: number
}

/**
 * Erzeugt die Buchungsliste eines Kontos: erst die wiederkehrenden Zahlungen,
 * dann die unregelmässigen Ausgaben. Deterministisch über den Seed.
 */
export function generateTransactions(options: GenerateOptions): Transaction[] {
  const { accountId, currency, seed, fromIso, series, merchants, perWeek } = options
  const rng = createRng(seed)
  const out: Transaction[] = []
  const start = parseIso(fromIso)
  const end = parseIso(options.toIso)

  // 1. Wiederkehrendes — exakt am Stichtag jedes Monats.
  for (const entry of series) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end) {
      const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
      const day = Math.min(entry.dayOfMonth, lastDay)
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day)
      if (date >= start && date <= end) {
        const iso = toIso(date)
        const raised = entry.raise && iso >= entry.raise.fromIso
        out.push({
          id: `${entry.id}-${iso}`,
          accountId,
          date: iso,
          text: entry.text,
          amount: raised ? entry.raise!.amount : entry.amount,
          currency,
          category: entry.category,
          seriesId: entry.id,
          counterAccountId: entry.counterAccountId,
        })
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  // 2. Unregelmässiges — gleichmässig über die Wochen verteilt.
  if (merchants.length > 0 && perWeek > 0) {
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
    const count = Math.round((days / 7) * perWeek)
    for (let i = 0; i < count; i++) {
      const iso = addDays(fromIso, intBetween(rng, 0, days))
      const merchant = pick(rng, merchants)
      out.push({
        id: `tx-${seed}-${i}`,
        accountId,
        date: iso,
        text: merchantText(merchant, iso),
        amount: -intBetween(rng, merchant.min, merchant.max),
        currency,
        category: merchant.category,
        brand: merchant.brand,
      })
    }
  }

  return sortByDateDesc(out)
}

/** Neueste zuerst; bei gleichem Datum stabil nach id. */
export function sortByDateDesc(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
  )
}

/** Buchungen nach Tag gruppieren, für die Tagesüberschriften der Liste. */
export function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of sortByDateDesc(transactions)) {
    const bucket = groups.get(tx.date)
    if (bucket) bucket.push(tx)
    else groups.set(tx.date, [tx])
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }))
}
