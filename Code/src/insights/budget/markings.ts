import type { Transaction } from '../../data/types'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * «Gehört das ins Monatsbudget?» — die Einordnung einer einzelnen Buchung.
 *
 * Der Anlass sind Buchungen wie Brunos Anzahlung Heizung: CHF 12'000 am
 * 11. August, bei einem Wohnbudget von CHF 1'463. Ohne Einordnung steht seine
 * Wohnblase auf 920 % und der Monat sieht aus wie eine Katastrophe. Mit
 * Einordnung steht sie auf 100 %, und die 12'000 stehen daneben — sichtbar,
 * aber nicht als Budgetüberschreitung verkauft.
 *
 * Drei Antworten, weil es wirklich drei Fälle sind:
 *
 *   **normal**         zählt in dem Monat, in dem sie fällt
 *   **extraordinary**  einmalig — eigener Block, zählt nicht gegen das Budget
 *   **spread**         Jahresrechnung — auf N Monate umgelegt
 *
 * Der Unterschied zwischen den letzten beiden ist der Punkt. Brunos Anzahlung
 * Heizung ist einmalig. Sein Generalabonnement über CHF 3'950 ist es **nicht** —
 * das ist die Mobilität eines ganzen Jahres, einmal bezahlt. Wer es
 * ausklammert, versteckt eine echte Ausgabe; wer es voll in den Januar
 * schreibt, macht aus einem normalen Monat einen Ausreisser.
 *
 * ── Die Regel, die die Statistik schützt ──────────────────────────────────
 *
 * **Nichts verschwindet.** Jede Buchung liegt in genau einem Topf, und die
 * Töpfe summieren sich über den ganzen Zeitraum exakt auf das, was das Konto
 * verlassen hat:
 *
 *     budget + extraordinary + carry  ==  alle Belastungen
 *
 * `carry` ist der Teil verteilter Buchungen, der ausserhalb des betrachteten
 * Fensters liegt. Über die volle Reichweite ist er null — Geld wird verschoben,
 * nie entfernt. Genau das prüft `__tests__/markings.test.ts`.
 *
 * Der Nachbau bleibt unberührt: Kontostand, Analysen und die Ein-/Ausgaben-
 * Detailseiten rechnen weiter mit allen Buchungen. Die Einordnung wirkt
 * ausschliesslich in unserer Budget- und Signalschicht.
 */

export type MarkingKind = 'normal' | 'extraordinary' | 'spread'

export interface Marking {
  kind: MarkingKind
  /** Nur bei `spread`: über wie viele Monate umgelegt wird. */
  months?: number
}

export const MARKING_VERSION = 1
export const DEFAULT_SPREAD_MONTHS = 12

export interface Markings {
  version: number
  /** Buchungs-Id → Einordnung. Fehlt ein Eintrag, gilt `normal`. */
  byTransaction: Record<string, Marking>
}

export const NO_MARKINGS: Markings = { version: MARKING_VERSION, byTransaction: {} }

export function markingOf(markings: Markings, transactionId: string): Marking {
  return markings.byTransaction[transactionId] ?? { kind: 'normal' }
}

export function withMarking(markings: Markings, transactionId: string, marking: Marking): Markings {
  const next = { ...markings.byTransaction }
  if (marking.kind === 'normal') delete next[transactionId]
  else next[transactionId] = marking
  return { version: MARKING_VERSION, byTransaction: next }
}

// ───────────────────────────────────────────────────────────────────────────
// Anwendung auf ein Zeitfenster
// ───────────────────────────────────────────────────────────────────────────

/** `YYYY-MM` → laufende Monatsnummer, damit sich Zeiträume rechnen lassen. */
function monthIndex(iso: string): number {
  const [year, month] = iso.split('-').map(Number)
  return year * 12 + (month - 1)
}

/**
 * Wie viele Monate zweier Bereiche sich überschneiden.
 * Beide Grenzen einschliessend, gerechnet auf Kalendermonaten.
 */
function overlapMonths(aFrom: number, aTo: number, bFrom: number, bTo: number): number {
  return Math.max(0, Math.min(aTo, bTo) - Math.max(aFrom, bFrom) + 1)
}

export interface Window {
  /** ISO-Datum, einschliessend. */
  from: string
  to: string
}

/**
 * Was diese Buchung im Fenster zum **Budget** beiträgt. Immer positiv.
 *
 * `normal` zählt im Monat der Buchung, `extraordinary` gar nicht, `spread`
 * anteilig in jedem Monat seiner Reichweite — auch wenn die Buchung selbst
 * längst vor dem Fenster lag. Deshalb bekommt diese Funktion alle Buchungen
 * und nicht nur die des Fensters.
 */
export function budgetShare(tx: Transaction, marking: Marking, window: Window): number {
  const amount = Math.abs(tx.amount)
  if (amount === 0) return 0

  if (marking.kind === 'extraordinary') return 0

  if (marking.kind === 'spread') {
    const months = Math.max(1, marking.months ?? DEFAULT_SPREAD_MONTHS)
    const start = monthIndex(tx.date)
    const covered = overlapMonths(start, start + months - 1, monthIndex(window.from), monthIndex(window.to))
    return (amount / months) * covered
  }

  return tx.date >= window.from && tx.date <= window.to ? amount : 0
}

/** Was diese Buchung im Fenster als **ausserordentlich** beiträgt. */
export function extraordinaryShare(tx: Transaction, marking: Marking, window: Window): number {
  if (marking.kind !== 'extraordinary') return 0
  return tx.date >= window.from && tx.date <= window.to ? Math.abs(tx.amount) : 0
}

export interface Split {
  /** Belastet das Budget im Fenster, Rappen. */
  budget: number
  /** Ausserordentlich im Fenster, Rappen. */
  extraordinary: number
  /**
   * Der Teil verteilter Buchungen, der ausserhalb des Fensters liegt —
   * abzüglich dessen, was von früher hereinragt. Über die volle Reichweite
   * null: Geld wird verschoben, nie entfernt.
   */
  carry: number
  /** Was im Fenster wirklich vom Konto ging, Rappen. Die Gegenprobe. */
  outInWindow: number
}

/**
 * Die Kontrollrechnung für ein Fenster.
 *
 * `transactions` sind **alle** Buchungen, die als Ausgabe gelten (Geldfluss
 * `out`) — nicht nur die des Fensters, weil verteilte Buchungen von aussen
 * hereinwirken. Es gilt immer:
 *
 *     budget + extraordinary + carry === outInWindow
 */
export function splitOf(transactions: Transaction[], markings: Markings, window: Window): Split {
  let budget = 0
  let extraordinary = 0
  let outInWindow = 0

  for (const tx of transactions) {
    const marking = markingOf(markings, tx.id)
    budget += budgetShare(tx, marking, window)
    extraordinary += extraordinaryShare(tx, marking, window)
    if (tx.date >= window.from && tx.date <= window.to) outInWindow += Math.abs(tx.amount)
  }

  return {
    budget,
    extraordinary,
    carry: outInWindow - budget - extraordinary,
    outInWindow,
  }
}

/** Wie viele Buchungen im Fenster ausserordentlich eingeordnet sind. */
export function extraordinaryIn(
  transactions: Transaction[],
  markings: Markings,
  window: Window,
): Transaction[] {
  return transactions.filter(
    (tx) =>
      markingOf(markings, tx.id).kind === 'extraordinary' &&
      tx.date >= window.from &&
      tx.date <= window.to,
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Speicherung
// ───────────────────────────────────────────────────────────────────────────

const KEY = 'beyond-the-list.markings'

export function loadMarkings(personaId: string): Markings {
  try {
    const raw = window.localStorage.getItem(`${KEY}.${personaId}`)
    if (!raw) return NO_MARKINGS
    const stored = JSON.parse(raw) as Partial<Markings>
    if (stored.version !== MARKING_VERSION || !stored.byTransaction) return NO_MARKINGS
    return { version: MARKING_VERSION, byTransaction: { ...stored.byTransaction } }
  } catch {
    /* Privates Fenster, gesperrter Speicher, kaputtes JSON — ohne Einordnung
       zählt alles normal, und das ist ein gültiger Zustand. */
    return NO_MARKINGS
  }
}

export function saveMarkings(personaId: string, markings: Markings): void {
  try {
    window.localStorage.setItem(`${KEY}.${personaId}`, JSON.stringify(markings))
  } catch {
    /* siehe oben */
  }
}
