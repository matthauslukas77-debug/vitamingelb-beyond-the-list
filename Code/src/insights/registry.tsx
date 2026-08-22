import type { ComponentType } from 'react'
import type { useSession } from '../app/session'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Ordner `src/insights/` enthält alles, was NICHT Teil der heutigen
 * PostFinance-App ist. `src/app/` bleibt der reine Nachbau.
 *
 * Eine neue Funktion einhängen:
 *   1. Komponente in `src/insights/cards/` schreiben
 *   2. unten unter dem passenden Slot-Namen eintragen
 *
 * Solange die Listen leer sind, zeigt der Prototyp exakt den Ist-Zustand.
 * Genau das ist der Ausgangspunkt für den Vergleich «heute» ↔ «unser Vorschlag».
 */

export type SlotName =
  | 'home.aboveAccounts'
  | 'home.belowAccounts'
  | 'account.aboveTransactions'
  | 'account.belowHeader'
  | 'analysis.aboveDonut'
  | 'analysis.belowLegend'
  | 'payments.top'

export type SlotComponent = ComponentType<{ session: ReturnType<typeof useSession> }>

export const SLOT_CONTENT: Record<SlotName, SlotComponent[]> = {
  'home.aboveAccounts': [],
  'home.belowAccounts': [],
  'account.aboveTransactions': [],
  'account.belowHeader': [],
  'analysis.aboveDonut': [],
  'analysis.belowLegend': [],
  'payments.top': [],
}
