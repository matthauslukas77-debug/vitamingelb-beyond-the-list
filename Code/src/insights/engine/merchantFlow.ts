import { resolveBrand } from '../../data/brands'
import type { Account, Transaction } from '../../data/types'
import { isBudgetExpense, moneyFlow, type FlowContext } from '../budget/flow'
import { categorize } from '../budget/mapping'
import { isCashWithdrawal, merchantKey, merchantLabel } from '../budget/merchant'
import type { CategoryKey } from '../budget/slots'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Wohin das Geld fliesst — nach Empfänger, nicht nach Kategorie.
 *
 * Die Analysen der App fassen nach Kategorie zusammen: «Lebensmittel 480.–».
 * Das beantwortet nicht die Frage, die im Interview gestellt wurde. Nino
 * wollte wissen: *«Was ist das Unnötigste, was ich ausgebe?»* und Silvan
 * *«bei welchen Firmen gebe ich immer wieder Geld aus?»* — beides sind
 * Fragen nach dem **Empfänger**.
 *
 * Gezählt wird nur, was wirklich weg ist: `flow.ts` sortiert Überträge auf
 * eigene Konten, Kreditkartenabrechnungen und Rückerstattungen aus. Ein
 * Sparauftrag ist kein Empfänger.
 */

export interface MerchantSpend {
  key: string
  label: string
  /** Summe in Rappen, positiv. */
  total: number
  count: number
  /** Logo unter /logos/, falls die Registry die Marke kennt. */
  logo?: string
  /** Markenfarbe, für den Ring wenn kein Logo da ist. */
  color?: string
  /**
   * Die Randfarbe des Logos (`logo-backgrounds.ts`). Die Scheibe nimmt sie an,
   * sonst schaut um eine quadratische Kachel herum das Weiss heraus — genau
   * das, was die runde Scheibe in der Buchungsliste schon vermeidet.
   */
  bg?: string
  /**
   * Die Budgetkategorie, in der dieser Empfänger das meiste Geld kostet.
   * Sie liefert das Sinnbild für Empfänger ohne Logo: «Miete» wird ein Sofa
   * und nicht das Kürzel «MI».
   */
  category?: CategoryKey
  isCash: boolean
  firstSeen: string
  lastSeen: string
}

export type Period = 'week' | 'month' | 'year'

export const PERIOD_LABEL: Record<Period, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
}

const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 }

/** Beginn des Zeitfensters, `days` vor dem Stichtag. */
export function periodStart(today: string, period: Period): string {
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(y, m - 1, d - PERIOD_DAYS[period] + 1)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}

export interface FlowOptions {
  transactions: Transaction[]
  accounts: Account[]
  today: string
  period: Period
  /** Wie viele Empfänger einzeln erscheinen; der Rest wird zusammengefasst. */
  limit?: number
}

export interface MerchantFlowResult {
  merchants: MerchantSpend[]
  /** Zusammenfassung der Empfänger jenseits von `limit`. */
  rest?: MerchantSpend
  total: number
  from: string
  to: string
}

/** Die Kategorie mit dem grössten Betrag. Bei Gleichstand die erste — die Map
 *  behält die Einfügereihenfolge, das Ergebnis ist also reproduzierbar. */
function heaviest(spend: Map<CategoryKey, number> | undefined): CategoryKey | undefined {
  if (!spend) return undefined
  let best: CategoryKey | undefined
  let max = -1
  for (const [category, amount] of spend) {
    if (amount > max) {
      max = amount
      best = category
    }
  }
  return best
}

/**
 * Fasst die Ausgaben des Zeitfensters nach Empfänger zusammen, grösste zuerst.
 *
 * Über `limit` hinaus wird zu einer Sammelblase «Übrige» verdichtet. Ohne das
 * zerfällt das Bild in dreissig kaum sichtbare Punkte — und eine Blase, die
 * man nicht treffen kann, ist keine Information.
 */
export function merchantFlow({
  transactions,
  accounts,
  today,
  period,
  limit = 12,
}: FlowOptions): MerchantFlowResult {
  const from = periodStart(today, period)
  const context: FlowContext = { accounts }
  const groups = new Map<string, MerchantSpend>()
  /* Je Empfänger, wie viel in welcher Kategorie liegt. Ein Empfänger kann in
     mehreren stecken — die Migros verkauft Lebensmittel und Kleider —, das
     Sinnbild zeigt die schwerste davon. */
  const categories = new Map<string, Map<CategoryKey, number>>()

  for (const tx of transactions) {
    if (tx.date < from || tx.date > today) continue
    if (tx.amount >= 0) continue
    if (!isBudgetExpense(moneyFlow(tx, context).flow)) continue

    const key = merchantKey(tx)
    const category = categorize(tx).category
    const perCategory = categories.get(key) ?? new Map<CategoryKey, number>()
    perCategory.set(category, (perCategory.get(category) ?? 0) + -tx.amount)
    categories.set(key, perCategory)

    const found = groups.get(key)
    if (found) {
      found.total += -tx.amount
      found.count += 1
      if (tx.date < found.firstSeen) found.firstSeen = tx.date
      if (tx.date > found.lastSeen) found.lastSeen = tx.date
      continue
    }

    const brand = isCashWithdrawal(tx) ? null : resolveBrand(tx.text)
    groups.set(key, {
      key,
      label: brand?.brand.name ?? merchantLabel(tx),
      total: -tx.amount,
      count: 1,
      logo: brand?.logo,
      color: brand?.brand.color,
      bg: brand?.bg,
      isCash: isCashWithdrawal(tx),
      firstSeen: tx.date,
      lastSeen: tx.date,
    })
  }

  for (const entry of groups.values()) {
    entry.category = heaviest(categories.get(entry.key))
  }

  const sorted = [...groups.values()].sort((a, b) => b.total - a.total)
  const total = sorted.reduce((sum, entry) => sum + entry.total, 0)
  const head = sorted.slice(0, limit)
  const tail = sorted.slice(limit)

  const rest: MerchantSpend | undefined = tail.length
    ? {
        key: 'rest',
        label: `${tail.length} weitere`,
        total: tail.reduce((sum, entry) => sum + entry.total, 0),
        count: tail.reduce((sum, entry) => sum + entry.count, 0),
        isCash: false,
        firstSeen: tail.reduce((min, e) => (e.firstSeen < min ? e.firstSeen : min), today),
        lastSeen: tail.reduce((max, e) => (e.lastSeen > max ? e.lastSeen : max), from),
      }
    : undefined

  return { merchants: head, rest, total, from, to: today }
}
