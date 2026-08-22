import { TIPS } from './tips'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Welche Funktionen jemand schon gesehen hat.
 *
 * Ohne diese Datei ist die Tippliste ein Handbuch: immer gleich, einmal
 * geöffnet, nie wieder. Mit ihr ist sie eine Entdeckung — «neu für dich»
 * schrumpft, während man die App kennenlernt, und der Punkt am Knopf
 * verschwindet, wenn nichts mehr neu ist.
 *
 * Gemerkt wird die Katalog-Kennung, dasselbe Muster wie bei den erledigten
 * Signalen. Kommt später eine Funktion dazu, ist genau sie wieder neu — und
 * nicht die ganze Liste.
 *
 * Als gesehen gilt eine Funktion, wenn man ihre Erklärung aufgeklappt hat.
 * Nicht schon beim Öffnen des Bildschirms: Wer die Liste einmal überfliegt,
 * hat nichts gelernt, und ein Punkt, der beim Hinschauen verschwindet, hätte
 * nie einer sein müssen.
 */

export const SEEN_VERSION = 1

export interface Seen {
  version: number
  /** Katalog-Kennung → ISO-Datum, an dem sie aufgeklappt wurde. */
  ids: Record<string, string>
}

export const NOTHING_SEEN: Seen = { version: SEEN_VERSION, ids: {} }

const KEY = 'beyond-the-list.tips'

export function loadSeen(personaId: string): Seen {
  try {
    const raw = window.localStorage.getItem(`${KEY}.${personaId}`)
    if (!raw) return NOTHING_SEEN
    const stored = JSON.parse(raw) as Partial<Seen>
    if (stored.version !== SEEN_VERSION || !stored.ids) return NOTHING_SEEN
    return { version: SEEN_VERSION, ids: { ...stored.ids } }
  } catch {
    /* Ohne Gedächtnis ist wieder alles neu. Das ist der harmlose Fall. */
    return NOTHING_SEEN
  }
}

export function saveSeen(personaId: string, seen: Seen): void {
  try {
    window.localStorage.setItem(`${KEY}.${personaId}`, JSON.stringify(seen))
  } catch {
    /* Privater Modus, voller Speicher — kein Grund, den Bildschirm zu verlieren. */
  }
}

export function withSeen(seen: Seen, id: string, on: string): Seen {
  return { version: SEEN_VERSION, ids: { ...seen.ids, [id]: on } }
}

export function isSeen(seen: Seen, id: string): boolean {
  return id in seen.ids
}

/** Wie viele Funktionen noch niemand aufgeklappt hat — die Zahl am Knopf. */
export function unseenCount(seen: Seen): number {
  return TIPS.filter((tip) => !isSeen(seen, tip.id)).length
}
