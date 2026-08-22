import { DEFAULT_ANSWERS, type Answers } from './benchmark'
import { Display } from './pf-model'
import { allSlots, slotKey } from './slots'
import type { DerivedBudget } from './derive'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das gespeicherte Budget.
 *
 * Nach dem Muster von `src/app/settings.ts`: `localStorage`, getrennt pro
 * Persona, defensiv gelesen. Ein Budget, das ein Neuladen nicht übersteht,
 * taugt für keine Demo — und ein Budget, das die eigenen Eingaben beim
 * nächsten Lauf überschreibt, wird einmal benutzt und nie wieder.
 *
 * Deshalb steht in `edited` ausdrücklich, welche Felder von Hand gesetzt
 * wurden. Sie überstimmen die Ableitung und werden im Wizard als **«von dir
 * gesetzt»** markiert — später bleibt sichtbar, was gemessen und was gewollt
 * ist.
 */

export const BUDGET_VERSION = 1

export interface SavedBudget {
  version: number
  /** Rappen pro Monat, je Feldschlüssel (`reside.0`). */
  amounts: Record<string, number>
  /** Feldschlüssel, die von Hand gesetzt wurden. */
  edited: string[]
  /** Was der Wizard gefragt hat. */
  answers: Answers
  /** Zuletzt gewählte Ansicht — Monat oder Jahr. */
  display: Display
  /** ISO-Datum der letzten Änderung. */
  savedAt: string
}

const KEY = 'beyond-the-list.budget'

function storageKey(personaId: string): string {
  return `${KEY}.${personaId}`
}

/** Ein frisches Budget aus der Ableitung — noch nichts von Hand gesetzt. */
export function budgetFromDerivation(derived: DerivedBudget, answers: Answers, savedAt: string): SavedBudget {
  const amounts: Record<string, number> = {}
  for (const evidence of derived.slots) amounts[slotKey(evidence.slot)] = evidence.monthly
  return { version: BUDGET_VERSION, amounts, edited: [], answers, display: Display.month, savedAt }
}

export function loadBudget(personaId: string): SavedBudget | null {
  try {
    const raw = window.localStorage.getItem(storageKey(personaId))
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<SavedBudget>
    /* Ein Eintrag aus einer älteren Fassung wird verworfen statt halb gelesen:
       ein Budget mit fehlenden Feldern zeigt falsche Summen, und das ist
       schlimmer als ein leerer Zustand. */
    if (stored.version !== BUDGET_VERSION || !stored.amounts) return null
    return {
      version: BUDGET_VERSION,
      amounts: { ...stored.amounts },
      edited: stored.edited ?? [],
      answers: { ...DEFAULT_ANSWERS, ...stored.answers },
      display: stored.display === Display.year ? Display.year : Display.month,
      savedAt: stored.savedAt ?? '',
    }
  } catch {
    /* Privates Fenster, gesperrter Speicher, kaputtes JSON — kein Grund,
       die App aufzuhalten. */
    return null
  }
}

export function saveBudget(personaId: string, budget: SavedBudget): void {
  try {
    window.localStorage.setItem(storageKey(personaId), JSON.stringify(budget))
  } catch {
    /* Nicht speichern können ist hier kein Fehler, den jemand sehen muss. */
  }
}

export function clearBudget(personaId: string): void {
  try {
    window.localStorage.removeItem(storageKey(personaId))
  } catch {
    /* siehe oben */
  }
}

/** Betrag eines Feldes, Rappen pro Monat. */
export function amountOf(budget: SavedBudget, key: string): number {
  return budget.amounts[key] ?? 0
}

/** Setzt ein Feld und merkt sich, dass es von Hand kommt. */
export function withAmount(budget: SavedBudget, key: string, monthlyRappen: number, savedAt: string): SavedBudget {
  const clamped = Math.max(0, Math.round(monthlyRappen))
  return {
    ...budget,
    amounts: { ...budget.amounts, [key]: clamped },
    edited: budget.edited.includes(key) ? budget.edited : [...budget.edited, key],
    savedAt,
  }
}

/** Ein Feld auf den abgeleiteten Wert zurücksetzen. */
export function resetAmount(budget: SavedBudget, key: string, derived: DerivedBudget, savedAt: string): SavedBudget {
  const evidence = derived.slots.find((entry) => slotKey(entry.slot) === key)
  return {
    ...budget,
    amounts: { ...budget.amounts, [key]: evidence?.monthly ?? 0 },
    edited: budget.edited.filter((entry) => entry !== key),
    savedAt,
  }
}

/**
 * Die Ableitung neu einlesen, aber von Hand gesetzte Felder stehen lassen.
 * Das ist der Fall «nächster Monat, neue Buchungen».
 */
export function refreshed(budget: SavedBudget, derived: DerivedBudget, savedAt: string): SavedBudget {
  const amounts: Record<string, number> = {}
  for (const slot of allSlots()) {
    const key = slotKey(slot)
    amounts[key] = budget.edited.includes(key)
      ? (budget.amounts[key] ?? 0)
      : (derived.slots.find((entry) => slotKey(entry.slot) === key)?.monthly ?? 0)
  }
  return { ...budget, amounts, savedAt }
}

/** Summe aller Felder, Rappen pro Monat. */
export function totalOf(budget: SavedBudget): number {
  return Object.values(budget.amounts).reduce((total, value) => total + value, 0)
}
