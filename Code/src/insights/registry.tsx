import type { ComponentType, ReactNode } from 'react'
import type { Account } from '../data/types'
import type { useSession } from '../app/session'
import { AccountBalanceCard } from './cards/AccountBalanceCard'
import { TODAY } from '../data/types'
import { buildTimeline } from './engine/balance'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Ordner `src/insights/` enthält alles, was NICHT Teil der heutigen
 * PostFinance-App ist. `src/app/` bleibt der reine Nachbau.
 *
 * Eine neue Funktion einhängen:
 *   1. Komponente in `src/insights/cards/` schreiben
 *   2. unten unter dem passenden Slot-Namen eintragen
 *
 * Ist eine Liste leer, rendert der Nachbau seinen eigenen Baustein
 * (der `fallback` des Slots) — der Prototyp zeigt dann exakt den Ist-Zustand.
 */

export type SlotName =
  | 'home.accountRow'
  | 'home.aboveAccounts'
  | 'home.belowAccounts'
  | 'account.aboveTransactions'
  | 'account.belowHeader'
  | 'analysis.aboveDonut'
  | 'analysis.belowLegend'
  | 'payments.top'

export type SlotProps = {
  session: ReturnType<typeof useSession>
  /** Was der Nachbau an dieser Stelle rendern würde. */
  fallback?: ReactNode
  /** Nur bei `home.accountRow` gesetzt. */
  account?: Account
  onOpen?: () => void
}

export type SlotComponent = ComponentType<SlotProps>

/**
 * Die Kontozeile auf Home wird durch die Karte mit Verlauf und Prognose ersetzt —
 * aber nur, wo es etwas zu zeigen gibt. Ein Sparkonto ohne Bewegung behält die
 * schlichte Zeile; eine flache Linie wäre keine Aussage, nur Dekoration.
 */
const AccountRow: SlotComponent = ({ session, account, onOpen, fallback }) => {
  if (!account) return <>{fallback}</>
  const timeline = buildTimeline({
    account,
    transactions: session.persona.transactions,
    pendingOrders: session.pendingOrders,
    today: TODAY,
  })
  if (!timeline.hasMovement) return <>{fallback}</>
  return <AccountBalanceCard account={account} session={session} onOpen={onOpen ?? (() => {})} />
}

export const SLOT_CONTENT: Record<SlotName, SlotComponent[]> = {
  'home.accountRow': [AccountRow],
  'home.aboveAccounts': [],
  'home.belowAccounts': [],
  'account.aboveTransactions': [],
  'account.belowHeader': [],
  'analysis.aboveDonut': [],
  'analysis.belowLegend': [],
  'payments.top': [],
}
