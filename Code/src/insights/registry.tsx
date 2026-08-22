import type { ComponentType, ReactNode } from 'react'
import type { Account } from '../data/types'
import type { RecurringSeries } from '../domain/recurring'
import type { useSession } from '../app/session'
import { AccountBalanceCard } from './cards/AccountBalanceCard'
import { MoneyFlow } from './screens/MoneyFlow'
import { RecurringSummaryCard } from './cards/RecurringSummaryCard'
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
  | 'analysis.view'
  | 'analysis.aboveDonut'
  | 'analysis.belowLegend'
  | 'payments.top'
  | 'recurring.summary'

export type SlotProps = {
  session: ReturnType<typeof useSession>
  /** Was der Nachbau an dieser Stelle rendern würde. */
  fallback?: ReactNode
  /** Nur bei `home.accountRow` gesetzt. */
  account?: Account
  /** Nur bei `recurring.summary` gesetzt — vom Nachbau schon erkannt. */
  series?: RecurringSeries[]
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

/**
 * Zusätzliche Ansichten der Analysen. Der Nachbau kennt nur
 * «Zusammengefasst»; jede weitere Ansicht kommt aus dieser Liste und
 * erscheint im Drop-down. Ist die Liste leer, hat das Drop-down einen
 * einzigen Eintrag und verhält sich wie heute.
 */
export interface AnalysisView {
  id: string
  label: string
  Component: SlotComponent
}

const MoneyFlowView: SlotComponent = ({ session }) => <MoneyFlow session={session} />

export const ANALYSIS_VIEWS: AnalysisView[] = [
  /* «Nach Unternehmen» steht im Drop-down neben «Zusammengefasst» — die Frage
     dahinter ist «bei welcher Firma gebe ich am meisten aus?», und die
     beantwortet ein Logo schneller als jede Kategorie. */
  { id: 'flow', label: 'Nach Unternehmen', Component: MoneyFlowView },
]

export const SLOT_CONTENT: Record<SlotName, SlotComponent[]> = {
  'home.accountRow': [AccountRow],
  'home.aboveAccounts': [],
  'home.belowAccounts': [],
  'account.aboveTransactions': [],
  'account.belowHeader': [],
  'analysis.view': [MoneyFlowView],
  'analysis.aboveDonut': [],
  'analysis.belowLegend': [],
  'payments.top': [],
  /* Der Kopf über den wiederkehrenden Buchungen: Anteil statt nur Summe, ein
     Befund statt eines Absatzes, Herkunft hinter dem ⓘ. Ohne diesen Eintrag
     zeigt der Nachbau seine schlichten drei Zahlen. */
  'recurring.summary': [RecurringSummaryCard],
}
