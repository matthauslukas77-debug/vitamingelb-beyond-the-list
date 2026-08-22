import type { Transaction } from '../../data/types'
import { merchantKey } from './merchant'
import { parseSlotKey, slotKey, type BudgetSlot } from './slots'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Zuordnung von Hand — und zwar pro **Quelle**, nicht pro Buchung.
 *
 * Der Anlass steht in der Herausforderung: «Die Zuordnung falsch eingetragener
 * Buchungen ist mühsam, man muss jede einzeln öffnen und aus dem Dropdown
 * auswählen.» Das ist die richtige Beobachtung, aber die Mühsal liegt nicht im
 * Dropdown — sie liegt daran, dass die Antwort **nicht behalten** wird. Bruno
 * hat neunzehn Einkäufe bei LANDI in zwölf Monaten. Neunzehn Dropdowns für
 * eine einzige Entscheidung, und der zwanzigste Einkauf kommt wieder falsch
 * herein.
 *
 * Deshalb ist die gespeicherte Einheit hier der Händlerschlüssel
 * (`merchant.ts`). Ein Zug, und alle Buchungen dieser Quelle folgen —
 * rückwirkend und künftig.
 *
 * ── Was diese Datei ausdrücklich nicht tut ────────────────────────────────
 *
 * Sie ändert **keine Buchung**. `tx.category` bleibt, was die Bank geliefert
 * hat; der Nachbau in `src/app/` zeigt weiter den Ist-Zustand. Die Zuordnung
 * lebt daneben und wirkt nur dort, wo `categorize()` gefragt wird — im Budget,
 * in den Blasen, in den Signalen. Wer sie zurücknimmt, bekommt exakt die alte
 * Ansicht zurück.
 *
 * Sie ist auch etwas anderes als die Einordnung in `markings.ts`. Dort geht es
 * um **ob** eine Buchung ins Monatsbudget zählt, hier um **wohin** sie zählt.
 * Beide zusammen: Brunos Anzahlung Heizung ist ausserordentlich (Marking) und
 * gehört zu Wohnen · Nebenkosten (Assignment).
 *
 * Diese Datei kennt das Regelwerk **nicht** — sie ist der Antwortspeicher,
 * sonst nichts. Wer die offenen Fragen sucht, findet sie in `review.ts`. Die
 * Trennung ist keine Kosmetik: `mapping.ts` fragt hier nach der Antwort, und
 * `review.ts` fragt `mapping.ts` nach der Frage. Lägen beide Seiten in einer
 * Datei, importierten sie einander im Kreis.
 */

export const ASSIGNMENT_VERSION = 1

export interface Assignments {
  version: number
  /** Händlerschlüssel → Feldschlüssel (`reside.2`). */
  byMerchant: Record<string, string>
}

export const NO_ASSIGNMENTS: Assignments = { version: ASSIGNMENT_VERSION, byMerchant: {} }

/** Das von Hand gesetzte Feld einer Buchung, oder `null`. */
export function assignedSlot(tx: Transaction, assignments: Assignments): BudgetSlot | null {
  const stored = assignments.byMerchant[merchantKey(tx)]
  return stored ? parseSlotKey(stored) : null
}

export function withAssignment(
  assignments: Assignments,
  key: string,
  slot: BudgetSlot,
): Assignments {
  return {
    version: ASSIGNMENT_VERSION,
    byMerchant: { ...assignments.byMerchant, [key]: slotKey(slot) },
  }
}

/**
 * Ein Wert, der sich genau dann ändert, wenn sich die Zuordnungen ändern.
 *
 * Die Bildschirme lesen den Speicher bei jedem Aufbau — sie bleiben gemountet,
 * während das Brett darüber liegt, und hielten sonst eine überholte Zahl fest.
 * Ein frisch gelesenes Objekt ist aber bei jedem Rendern ein neues, und damit
 * liefe jede `useMemo` darunter jedes Mal neu. Der Fingerabdruck ist die
 * stabile Grösse dazwischen.
 */
export function fingerprintOf(assignments: Assignments): string {
  return Object.keys(assignments.byMerchant)
    .sort()
    .map((key) => `${key}=${assignments.byMerchant[key]}`)
    .join('|')
}

export function withoutAssignment(assignments: Assignments, key: string): Assignments {
  const byMerchant = { ...assignments.byMerchant }
  delete byMerchant[key]
  return { version: ASSIGNMENT_VERSION, byMerchant }
}

// ───────────────────────────────────────────────────────────────────────────
// Speicherung
// ───────────────────────────────────────────────────────────────────────────

const KEY = 'beyond-the-list.assignments'

export function loadAssignments(personaId: string): Assignments {
  try {
    const raw = window.localStorage.getItem(`${KEY}.${personaId}`)
    if (!raw) return NO_ASSIGNMENTS
    const stored = JSON.parse(raw) as Partial<Assignments>
    if (stored.version !== ASSIGNMENT_VERSION || !stored.byMerchant) return NO_ASSIGNMENTS
    return { version: ASSIGNMENT_VERSION, byMerchant: { ...stored.byMerchant } }
  } catch {
    /* Privates Fenster, gesperrter Speicher, kaputtes JSON — ohne Zuordnungen
       gilt wieder das Regelwerk, und das ist ein gültiger Zustand. */
    return NO_ASSIGNMENTS
  }
}

export function saveAssignments(personaId: string, assignments: Assignments): void {
  try {
    window.localStorage.setItem(`${KEY}.${personaId}`, JSON.stringify(assignments))
  } catch {
    /* siehe oben */
  }
}
