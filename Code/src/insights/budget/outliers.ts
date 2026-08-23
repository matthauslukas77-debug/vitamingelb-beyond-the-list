import type { Account, Transaction } from '../../data/types'
import { moneyFlow } from './flow'
import { categorize } from './mapping'
import { markingOf, NO_MARKINGS, type Marking, type Markings } from './markings'
import { NO_ASSIGNMENTS, type Assignments } from './assign'
import type { CategoryKey } from './slots'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Welche einzelne Buchung ihre Kategorie sprengt — und deshalb eine Antwort
 * braucht.
 *
 * Die Regel stand bisher in `signals/engine.ts` und galt damit nur für die
 * Signalkarten. Gebraucht wird sie an zwei Stellen: dort, **und** auf der
 * Detailseite einer Kategorie, wo die 920 % stehen. Zwei Schwellen für
 * dieselbe Frage wären zwei Meinungen darüber, was ein Ausreisser ist —
 * deshalb liegt sie hier und wird von beiden importiert.
 *
 * Der Anlass ist immer derselbe: Brunos Anzahlung Heizung, CHF 12'000 am
 * 11. August, bei einem Wohnbudget von CHF 1'463. Ohne Antwort steht seine
 * Wohnblase den ganzen Monat auf 920 %, und ein Budget, das 920 % anzeigt,
 * ist kein Überblick mehr — es ist eine Zahl, die man wegsieht.
 */

/** Ab dem Wievielfachen des Monatsbudgets eine einzelne Buchung auffällt. */
export const OUTLIER_FACTOR = 2
/** Und mindestens so viel, damit kleine Budgets nicht ständig Alarm schlagen. */
export const OUTLIER_MIN = 50_000

/**
 * Die Schwelle einer Kategorie, ab der eine einzelne Buchung auffällt.
 *
 * Der Mindestbetrag ist der wichtigere Teil: Ninos Mobilitätsbudget ist
 * CHF 108, das Doppelte davon wären CHF 216 — jede zweite Zugfahrkarte wäre
 * ein «Ausreisser», und nach drei Fragen beantwortet er keine mehr.
 */
export function outlierLimit(categoryBudget: number): number {
  return Math.max(categoryBudget * OUTLIER_FACTOR, OUTLIER_MIN)
}

export interface Outlier {
  tx: Transaction
  category: CategoryKey
  /** Betrag, Rappen, positiv. */
  amount: number
  /** Wie sie **heute** eingeordnet ist. `normal` heisst: noch unbeantwortet. */
  marking: Marking
}

export interface OutlierOptions {
  from: string
  to: string
  ownName?: string
  markings?: Markings
  assignments?: Assignments
  /** Budget je Kategorie, Rappen pro Monat. Ohne das gibt es keine Schwelle. */
  budget: Record<CategoryKey, number>
  /** Nur diese Kategorie — für die Detailseite. Ohne Angabe alle. */
  category?: CategoryKey
}

/**
 * Die auffälligen Buchungen im Fenster, grösste zuerst.
 *
 * Zurückgegeben werden **auch die schon eingeordneten**: Der Signale-Bildschirm
 * filtert die beantworteten weg, die Detailseite zeigt sie weiter an. Wer
 * CHF 12'000 als einmalig eingeordnet hat, muss die Entscheidung wiederfinden
 * und zurücknehmen können — sonst ist sie eine Falltür.
 *
 * Steuern sind ausgenommen. Sie werden in der Ableitung ohnehin über die volle
 * Historie geglättet; eine Steuerrate ist keine Überraschung, sondern der
 * Normalfall dieser Kategorie.
 */
export function outliersIn(
  transactions: Transaction[],
  accounts: Account[],
  {
    from,
    to,
    ownName,
    markings = NO_MARKINGS,
    assignments = NO_ASSIGNMENTS,
    budget,
    category,
  }: OutlierOptions,
): Outlier[] {
  const found: Outlier[] = []

  for (const tx of transactions) {
    if (tx.date < from || tx.date > to) continue
    if (moneyFlow(tx, { accounts, ownName }).flow !== 'out') continue

    const key = categorize(tx, assignments).category
    if (key === 'taxes') continue
    if (category && key !== category) continue

    const amount = Math.abs(tx.amount)
    if (amount < outlierLimit(budget[key])) continue

    found.push({ tx, category: key, amount, marking: markingOf(markings, tx.id) })
  }

  return found.sort((a, b) => b.amount - a.amount)
}
