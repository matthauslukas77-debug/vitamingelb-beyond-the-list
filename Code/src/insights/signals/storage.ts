import type { Signal } from './engine'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Weggeklickte Signale.
 *
 * Ohne diese Datei füllt sich der Bildschirm nach drei Tagen mit Meldungen,
 * die man schon gelesen hat, und wird danach nie wieder geöffnet. «Erledigt»
 * ist keine Bequemlichkeit, sondern die Bedingung dafür, dass der rote Punkt
 * auf Home etwas bedeutet.
 *
 * Gemerkt wird die Signal-Id, und die ist absichtlich aus Inhalt gebaut —
 * `priceUp:SPOTIFY:2026-03-14`, `outlier:bruno-PK-2026-08-0042`. Dadurch:
 *
 *   · Dasselbe Signal kommt nach dem Wegklicken nicht wieder.
 *   · Wird dieselbe Reihe **erneut** teurer, entsteht eine neue Id mit einem
 *     neuen Datum — und die Meldung kommt zu Recht wieder.
 *
 * Eine Id, die auf einem Zähler oder einem Zeitstempel beruhte, könnte
 * keines von beidem.
 */

export const DISMISSED_VERSION = 1

export interface Dismissed {
  version: number
  /** Signal-Id → ISO-Datum, an dem sie weggeklickt wurde. */
  ids: Record<string, string>
}

export const NONE_DISMISSED: Dismissed = { version: DISMISSED_VERSION, ids: {} }

const KEY = 'beyond-the-list.signals'

export function loadDismissed(personaId: string): Dismissed {
  try {
    const raw = window.localStorage.getItem(`${KEY}.${personaId}`)
    if (!raw) return NONE_DISMISSED
    const stored = JSON.parse(raw) as Partial<Dismissed>
    if (stored.version !== DISMISSED_VERSION || !stored.ids) return NONE_DISMISSED
    return { version: DISMISSED_VERSION, ids: { ...stored.ids } }
  } catch {
    /* Ohne Gedächtnis erscheinen alle Signale wieder. Unschön, aber kein
       Zustand, der einen Bildschirm kosten darf. */
    return NONE_DISMISSED
  }
}

export function saveDismissed(personaId: string, dismissed: Dismissed): void {
  try {
    window.localStorage.setItem(`${KEY}.${personaId}`, JSON.stringify(dismissed))
  } catch {
    /* siehe oben */
  }
}

export function withDismissed(dismissed: Dismissed, id: string, on: string): Dismissed {
  return { version: DISMISSED_VERSION, ids: { ...dismissed.ids, [id]: on } }
}

export function withRestored(dismissed: Dismissed, id: string): Dismissed {
  const ids = { ...dismissed.ids }
  delete ids[id]
  return { version: DISMISSED_VERSION, ids }
}

export function isDismissed(dismissed: Dismissed, id: string): boolean {
  return id in dismissed.ids
}

/** Was noch offen ist — die Zahl am roten Punkt. */
export function openSignals(signals: Signal[], dismissed: Dismissed): Signal[] {
  return signals.filter((signal) => !isDismissed(dismissed, signal.id))
}
