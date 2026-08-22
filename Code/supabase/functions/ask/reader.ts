/**
 * ── Der nachsichtige Leser ─────────────────────────────────────────────────
 * Aus allem, was der Apertus 8B zurückschickt, den Werkzeugnamen holen.
 *
 * Der Grund ist gemessen, nicht befürchtet. In 21 Läufen gegen den 8B kamen
 * von 16 richtigen Werkzeugwahlen **nur 7 als sauberes `tool_calls`** zurück.
 * Die anderen 9 standen als blosser Text im `content`:
 *
 *     subscriptions
 *     subscriptions()
 *     extraordinary<|tools_prefix|>[{"extraordinary": }]
 *
 * Das Modell hat also fast immer richtig gewählt und fast nie richtig
 * verpackt. Das letzte Beispiel ist der 8B-Zwilling des bekannten
 * 70B-Fehlers: Ein Vorlagen-Token des Chat-Templates sickert in die Antwort
 * durch, und das JSON dahinter ist kaputt.
 *
 * Wer hier nur `tool_calls` liest, wirft mehr als die Hälfte der richtigen
 * Antworten weg. Deshalb liest diese Datei nachsichtig — und prüft dafür
 * streng: Der Name muss aus dem Katalog stammen, sonst gilt er nicht.
 *
 * Was sie **nicht** tut: Text durchreichen. Es kommt ein Werkzeugname heraus
 * oder nichts. Ein Satz, den das Modell formuliert hat, erreicht auf diesem
 * Weg nie einen Bildschirm.
 */

export interface RouterChoice {
  /** Name aus dem Katalog, oder `null`. */
  name: string | null
  /** Argumente, soweit erkennbar. Nie ungeprüft übernommen. */
  args: Record<string, string>
  /** Auf welchem Weg gelesen — für die Messung, nicht für die Anzeige. */
  via: 'tool_call' | 'text' | 'keins' | 'leer' | 'prosa'
}

/** Was der Router auf «passt nichts» antworten soll. */
export const NONE = 'KEINS'

interface ModelMessage {
  content?: unknown
  tool_calls?: { function?: { name?: unknown; arguments?: unknown } }[]
}

/** Nur Zeichen, die in einem Händlernamen vorkommen dürfen. */
function cleanArg(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 40)
  return trimmed.length >= 2 ? trimmed : null
}

/**
 * Argumente gegen das Schema des Werkzeugs sieben.
 *
 * Was das Modell schickt, ist eine Behauptung. Übernommen wird nur, was im
 * Katalog als Eigenschaft steht — alles andere fällt weg, statt ungeprüft in
 * eine Suche zu laufen.
 */
export function cleanArgs(
  raw: unknown,
  allowed: string[],
  /** Die Frage in Vergleichsform. Fehlt sie, wird nicht gegengeprüft. */
  haystack?: string,
): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, string> = {}
  for (const key of allowed) {
    const value = cleanArg((raw as Record<string, unknown>)[key])
    if (value === null) continue
    /*
     * Dieselbe Regel wie bei der Zahlenwache in `explain`: **Was wir
     * geschickt haben, darf zurückkommen — sonst nichts.**
     *
     * Der Anlass ist gemessen. Auf «Kannst du mir diesen Namen auflösen?»
     * antwortete der 8B mit `{"name":"UBS"}`, in einem zweiten Lauf mit
     * `{"name":"Amazon"}` — beide stehen nirgends in der Frage. Ohne diese
     * Prüfung suchte die App nach einem Händler, den niemand genannt hat,
     * und behauptete eine Jahressumme dazu. Ein ausdrückliches Verbot im
     * Systemtext hat es nicht verhindert.
     */
    if (haystack !== undefined && !haystack.includes(compare(value))) continue
    out[key] = value
  }
  return out
}

/** Grobe Vergleichsform für den Abgleich gegen die Frage. */
function compare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Den Werkzeugnamen lesen.
 *
 * `known` ist der Katalog: Nur diese Namen zählen. `argsOf` liefert die
 * erlaubten Argumentnamen je Werkzeug.
 */
export function readChoice(
  message: ModelMessage | undefined,
  known: string[],
  argsOf: (name: string) => string[],
  /** Die gestellte Frage, in Vergleichsform. Gegen sie werden Argumente geprüft. */
  haystack?: string,
): RouterChoice {
  const call = message?.tool_calls?.[0]?.function
  if (call && typeof call.name === 'string' && known.includes(call.name)) {
    let parsed: unknown = {}
    try {
      parsed = typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments
    } catch {
      /* Kaputte Argumente sind kein Grund, die richtige Werkzeugwahl
         wegzuwerfen — das Werkzeug läuft dann ohne sie. */
    }
    return { name: call.name, args: cleanArgs(parsed, argsOf(call.name), haystack), via: 'tool_call' }
  }

  const text = typeof message?.content === 'string' ? message.content.trim() : ''
  if (text === '') return { name: null, args: {}, via: 'leer' }
  if (new RegExp(`^${NONE}\\b`, 'i').test(text)) return { name: null, args: {}, via: 'keins' }

  /* Der Name als blosser Text. An Wortgrenzen gesucht, damit «subscriptions»
     nicht in einem Satz über Abonnements zufällig trifft. */
  for (const name of known) {
    if (new RegExp(`(^|[^A-Za-z])${name}([^A-Za-z]|$)`).test(text)) {
      /* Manchmal steht im durchgesickerten Halb-JSON noch ein Argument. */
      const found = /"([A-Za-z_]{2,20})"\s*:\s*"([^"]{2,40})"/.exec(text)
      const args = found ? cleanArgs({ [found[1]]: found[2] }, argsOf(name), haystack) : {}
      return { name, args, via: 'text' }
    }
  }

  return { name: null, args: {}, via: 'prosa' }
}
