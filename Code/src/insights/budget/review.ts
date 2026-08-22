import type { Account, Transaction } from '../../data/types'
import { moneyFlow, type FlowContext } from './flow'
import { categorize, type Categorization } from './mapping'
import { merchantKey, merchantLabel } from './merchant'
import { slotLabel, type BudgetSlot } from './slots'
import { NO_ASSIGNMENTS, type Assignments } from './assign'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Welche Quellen auf eine Antwort warten.
 *
 * Die Gegenseite von `assign.ts`: Dort liegt, was der Nutzer entschieden hat,
 * hier steht, was ihn noch niemand gefragt hat. Getrennt, weil `mapping.ts`
 * den Antwortspeicher braucht und diese Datei umgekehrt `mapping.ts` — in
 * einer Datei wäre das ein Importkreis.
 */

/**
 * Wie viele Quellen gleichzeitig auf dem Brett liegen.
 *
 * Die Zahl ist keine Willkür, sondern die Grenze der Geste: Das Brett scrollt
 * nicht, weil man sonst nirgendwohin ziehen kann — also muss alles gleichzeitig
 * sichtbar sein. Zehn Chips und sechs Töpfe passen auf ein Telefon, mehr nicht.
 * Was darüber hinausgeht, kommt in der nächsten Runde, und das steht auch da.
 *
 * Gemessen: Alle vier Personas liegen darunter, die grösste bei neun. Die
 * Runden sind also keine Theorie, aber heute braucht sie niemand.
 */
export const MAX_ON_BOARD = 10

// ───────────────────────────────────────────────────────────────────────────
// Was noch offen ist
// ───────────────────────────────────────────────────────────────────────────

/**
 * Braucht diese Zuordnung eine menschliche Antwort?
 *
 * Nicht «ist sie falsch» — das weiss nur der Nutzer. Sondern: **kann nur er
 * sie beantworten?** Drei Fälle:
 *
 *   1. **Es hängt an der Person.** Ein Baumarkt ist beim Eigentümer Unterhalt
 *      und beim Mieter Konsum; ein Zahlungsdienst verrät den Laden nicht. Die
 *      Regel sagt das selbst — siehe `ambiguous` in `mapping.ts`.
 *   2. **Konfidenz unter 0.6** — Bargeld und Buchungen ohne jeden Regeltreffer.
 *   3. **Nur die grobe Bankkategorie.** «shopping» wird zu «Kleider und
 *      Schuhe»; bei Livias You.com-Abo ist das erkennbar daneben.
 *
 * ── Was hier ausdrücklich **nicht** mehr steht ────────────────────────────
 *
 * «Liegt in der Schublade» war einmal ein vierter Fall, und er war falsch.
 * «Konsum · Weitere Ausgaben» ist im Budgetrechner der richtige Topf für
 * Elektronik, Software-Abos und Bankgebühren — digitec, Adobe und ChatGPT
 * landeten damit auf dem Brett, obwohl das Regelwerk sie beim Namen kennt und
 * korrekt einsortiert hat. Wer nach etwas fragt, das er weiss, verbrennt die
 * Bereitschaft, die er für die echte Frage braucht.
 *
 * Eine Zuordnung von Hand fällt nie darunter: Sie hat Konfidenz 1.
 */
export function needsAssignment(entry: Categorization): boolean {
  if (entry.confidence >= 1) return false
  if (entry.ambiguous) return true
  if (entry.confidence < 0.6) return true
  return entry.matchedBy.startsWith('Kategorie der Bank') && entry.confidence < 0.8
}

/**
 * Unter diesem Jahresbetrag wird nicht gefragt.
 *
 * Eine Quelle mit CHF 30 im Jahr verschiebt keine Zahl, die jemand ansieht —
 * sie kostet nur einen Platz auf dem Brett, den die CHF 5'338 von HORNBACH
 * besser gebrauchen. Sie bleibt in ihrem Vorgabetopf und darf dort liegen.
 */
export const MIN_RELEVANT = 10_000

/** Warum diese Quelle auf dem Brett liegt — ein Halbsatz, kein Vorwurf. */
function reasonOf(entry: Categorization): string {
  /* Die Regel bringt ihre Begründung selbst mit, wenn sie eine hat. */
  if (entry.ambiguous) return entry.ambiguous
  if (entry.matchedBy.startsWith('Bargeld')) return 'Am Automaten bezogen — wofür, steht nirgends.'
  if (entry.matchedBy === 'kein Regeltreffer') return 'Diese Quelle kennen wir noch nicht.'
  if (entry.matchedBy.startsWith('Kategorie der Bank')) {
    return `Nur aus der groben Kategorie der Bank abgeleitet — daher «${slotLabel(entry)}».`
  }
  return `Liegt in «${slotLabel(entry)}», und das ist nur geraten.`
}

/** Eine Quelle, die auf eine Kategorie wartet. */
export interface AssignGroup {
  /** Der Händlerschlüssel — daran hängt die gespeicherte Antwort. */
  key: string
  /** Was auf dem Chip steht. */
  label: string
  /** Wie viele Buchungen mitgehen. Das ist die eingesparte Mühe. */
  count: number
  /** Summe im Fenster, Rappen, positiv. */
  total: number
  /** Wo es heute liegt. */
  current: BudgetSlot
  reason: string
  /** Eine Buchung als Beleg — für Logo und Rohtext. */
  sample: Transaction
  transactionIds: string[]
  lastDate: string
}

export interface OpenOptions {
  from: string
  to: string
  ownName?: string
  assignments?: Assignments
}

/**
 * Die offenen Quellen im Fenster, nach Betrag absteigend.
 *
 * Nur Ausgaben (`flow === 'out'`): Eine Umbuchung aufs eigene Sparkonto
 * gehört in keinen Budgettopf, und eine Gutschrift erst recht nicht. Ohne
 * diese Zeile stünde der halbe Kontoauszug auf dem Brett.
 */
export function openAssignments(
  transactions: Transaction[],
  accounts: Account[],
  { from, to, ownName, assignments = NO_ASSIGNMENTS }: OpenOptions,
): AssignGroup[] {
  const context: FlowContext = { accounts, ownName }
  const groups = new Map<string, AssignGroup>()

  for (const tx of transactions) {
    if (tx.date < from || tx.date > to) continue
    if (moneyFlow(tx, context).flow !== 'out') continue

    const entry = categorize(tx, assignments)
    if (!needsAssignment(entry)) continue

    const key = merchantKey(tx)
    const found = groups.get(key)
    if (found) {
      found.count += 1
      found.total += Math.abs(tx.amount)
      found.transactionIds.push(tx.id)
      if (tx.date > found.lastDate) {
        found.lastDate = tx.date
        found.sample = tx
      }
      continue
    }
    groups.set(key, {
      key,
      label: merchantLabel(tx),
      count: 1,
      total: Math.abs(tx.amount),
      current: { category: entry.category, field: entry.field },
      reason: reasonOf(entry),
      sample: tx,
      transactionIds: [tx.id],
      lastDate: tx.date,
    })
  }

  return [...groups.values()]
    .filter((group) => group.total >= MIN_RELEVANT)
    .sort((a, b) => b.total - a.total)
}
