/**
 * ═══════════════════════════════════════════════════════════════════════════
 * `explain` — Apertus formuliert, gerechnet wird woanders.
 *
 * Diese Funktion nimmt **fertig gerechnete Befunde** entgegen und gibt einen
 * Satz zurück. Sie nimmt keinen Prompt entgegen, keine Buchungen und keine
 * freien Texte: Der Prompt entsteht hier, aus einer typisierten Nutzlast.
 * Wer die Funktion aufruft, kann bestimmen *worüber* geschrieben wird, nicht
 * *was* geschrieben wird.
 *
 * Warum überhaupt eine Edge Function und nicht direkt aus dem Browser?
 *   1. **Der Schlüssel.** Alles mit `VITE_`-Präfix landet im Bundle und ist
 *      damit öffentlich. Der Apertus-Key liegt hier als Function-Secret und
 *      verlässt den Server nie.
 *   2. **Der Prompt.** Läge er im Browser, könnte ihn jeder ersetzen. Hier ist
 *      er festverdrahtet.
 *   3. **CORS.** postfinance-fremde LLM-Endpunkte schicken keine CORS-Header.
 *
 * Grundlage: `WORKSPACE/03_research/16_Tooling_und_Zugaenge/APERTUS_CAPABILITY_TEST.md`
 * Daraus die vier Regeln, die hier eingebaut sind:
 *   · **Das Modell darf nicht rechnen.** Beide Apertus-Grössen addieren 14
 *     Zahlen falsch — jedes Mal. Der 70B liegt plausibel nah dran, und das ist
 *     der gefährlichste Fehlertyp in einer Banking-App.
 *   · **Nie `response_format` an den 70B.** Das Gateway prefillt eine
 *     zusätzliche `{` und liefert kaputtes JSON, reproduzierbar 5 von 5.
 *   · **Aus fertigem Fakt formuliert es sauber** und erfindet keine Zahlen.
 *   · **Fallback bereitlegen**, falls der Endpunkt klemmt.
 *
 * Die dritte Regel wird hier nicht geglaubt, sondern **geprüft**: Die
 * Zahlenwache unten vergleicht jede Zahl im Antworttext gegen die Zahlen, die
 * wir geschickt haben. Passt eine nicht, fliegt die Antwort weg und der
 * Aufrufer nimmt seinen eigenen, gerechneten Satz. Ein halluzinierter Betrag
 * erreicht so nie einen Bildschirm.
 *
 * Deployment:
 *   supabase secrets set APERTUS_URL=… APERTUS_KEY=… APERTUS_MODEL=…
 *   supabase functions deploy explain
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { allowedNumbers, hasOnlyKnownNumbers } from './guard.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Was der Aufrufer schicken darf. Alles andere wird abgewiesen. */
interface ExplainRequest {
  kind: 'budget-summary'
  /** Ganze Franken pro Monat. */
  facts: {
    incomeMonth: number
    expensesMonth: number
    surplusMonth: number
    actualSavedMonth: number
    /** Je Kategorie: Ist und Richtwert, ganze Franken pro Monat. */
    categories: { label: string; actual: number; benchmark: number }[]
    /** Ausgabenfranken ohne sichere Zuordnung, ganze Franken pro Monat. */
    unassignedMonth: number
    /** Vermiedene Doppelzählung, ganze Franken pro Monat. */
    avoidedDoubleCount: number
    /**
     * Der eine Befund, über den geschrieben wird — im Client gerechnet und
     * ausgewählt. Das Modell sucht ihn nicht selbst.
     */
    headline: string
  }
}

const MAX_LABEL = 48
const MAX_HEADLINE = 400
const MAX_CATEGORIES = 8
const MAX_TOKENS = 260
/** Der 70B liefert ~29 tok/s. 260 Token brauchen also gut 9 Sekunden. */
const TIMEOUT_MS = 20_000

/**
 * Prüft die Nutzlast, statt ihr zu vertrauen.
 * Gibt die Fehlermeldung zurück, oder `null`, wenn alles stimmt.
 */
function validate(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'Kein Objekt'
  const request = body as Partial<ExplainRequest>
  if (request.kind !== 'budget-summary') return 'Unbekanntes kind'
  const facts = request.facts
  if (typeof facts !== 'object' || facts === null) return 'facts fehlt'

  const numbers = [
    facts.incomeMonth, facts.expensesMonth, facts.surplusMonth,
    facts.actualSavedMonth, facts.unassignedMonth, facts.avoidedDoubleCount,
  ]
  if (numbers.some((value) => !Number.isFinite(value))) return 'facts enthält keine Zahlen'
  if (typeof facts.headline !== 'string' || facts.headline.length === 0) return 'headline fehlt'
  if (facts.headline.length > MAX_HEADLINE) return 'headline zu lang'
  if (!Array.isArray(facts.categories)) return 'categories fehlt'
  if (facts.categories.length > MAX_CATEGORIES) return 'zu viele Kategorien'
  for (const category of facts.categories) {
    if (typeof category?.label !== 'string' || category.label.length > MAX_LABEL) return 'Kategoriename ungültig'
    if (!Number.isFinite(category.actual) || !Number.isFinite(category.benchmark)) return 'Kategorienbetrag ungültig'
  }
  return null
}

const SYSTEM = `Du bist die Stimme einer Schweizer Banking-App. Du schreibst auf Deutsch, in der Du-Form, nüchtern, in kurzen Sätzen.

REGELN, die du niemals brichst:
1. Du rechnest nicht. Du verwendest ausschliesslich Zahlen, die im Text unten wörtlich vorkommen.
2. Du rundest nicht und schätzt nicht. Keine Näherungen wie «fast», «rund», «etwa», «knapp», «gut», «ein Drittel». Jeder Betrag steht exakt so da, wie er dir gegeben wurde.
3. Du stellst fest, du folgerst nicht. Keine Ursache, keine Wirkung, keine Prognose. Nicht «das führt zu», nicht «deshalb».
4. Du bewertest weder die Person noch ihre Lebensweise. Kein «sparsam», kein «fragwürdig», kein «untypisch», kein Lob, kein Tadel.
5. Du spekulierst nicht über Gründe. Steht ein Posten auf 0, stellst du das fest — du erklärst nicht, warum.
6. Du nennst kein Produkt und sagst niemandem, was er tun soll.
7. Zwei Sätze. Höchstens drei.

Du schreibst über GENAU EINEN BEFUND. Er steht dir vorgegeben — du suchst ihn nicht selbst. Die Tabelle darunter ist nur Kontext, damit dein Satz stimmt.`

/**
 * Aus dem Befund einen Prompt bauen. Der Aufrufer sieht diesen Text nie.
 *
 * Welcher Befund erzählt wird, entscheidet der Client — deterministisch, aus
 * gerechneten Zahlen. Das Modell bekommt ihn vorgesetzt. Als der 70B ihn
 * selbst wählen durfte, schrieb er bei einem Haushalt, tiefere Konsumausgaben
 * als der Vergleichswert würden «den Überschuss am stärksten reduzieren» —
 * sprachlich sauber, sachlich verkehrt. Ausgewählt wird deshalb im Code.
 */
function buildPrompt(facts: ExplainRequest['facts']): string {
  const rows = facts.categories
    .map((category) => {
      const delta = category.actual - category.benchmark
      const richtung = delta > 0 ? 'über' : 'unter'
      return `- ${category.label}: du CHF ${category.actual}, vergleichbarer Haushalt CHF ${category.benchmark} (CHF ${Math.abs(delta)} ${richtung} dem Vergleich)`
    })
    .join('\n')

  return `BEFUND, über den du schreibst:
${facts.headline}

KONTEXT, alle Beträge in Franken pro Monat, bereits fertig gerechnet:
Einnahmen CHF ${facts.incomeMonth} · Ausgaben CHF ${facts.expensesMonth} · Überschuss CHF ${facts.surplusMonth}
Davon wirklich auf ein Sparkonto gegangen: CHF ${facts.actualSavedMonth}
Ausgaben ohne sichere Zuordnung: CHF ${facts.unassignedMonth}

Ist gegen den Richtwert für einen vergleichbaren Haushalt:
${rows}

Schreib zwei Sätze über den BEFUND.`
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') {
    return json({ error: 'Nur POST' }, 405)
  }

  const url = Deno.env.get('APERTUS_URL')
  const key = Deno.env.get('APERTUS_KEY')
  const model = Deno.env.get('APERTUS_MODEL')
  if (!url || !key || !model) {
    /* Nicht konfiguriert ist kein Fehler, sondern ein Zustand: Der Aufrufer
       zeigt dann seinen eigenen, gerechneten Satz. */
    return json({ text: null, reason: 'not-configured' }, 200)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Kein gültiges JSON' }, 400)
  }

  const problem = validate(body)
  if (problem) return json({ error: problem }, 400)
  const { facts } = body as ExplainRequest

  const prompt = buildPrompt(facts)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
        /* Bewusst KEIN response_format — der 70B-Gateway prefillt sonst eine
           zusätzliche öffnende Klammer und liefert kaputte Antworten. */
      }),
    })

    if (!response.ok) {
      return json({ text: null, reason: `upstream-${response.status}` }, 200)
    }

    const payload = await response.json()
    const text: string = payload?.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) return json({ text: null, reason: 'empty' }, 200)

    if (!hasOnlyKnownNumbers(text, allowedNumbers(prompt))) {
      /* Das Modell hat eine Zahl genannt, die wir nicht geliefert haben.
         Wir zeigen sie nicht — auch dann nicht, wenn sie plausibel aussieht. */
      return json({ text: null, reason: 'unknown-number' }, 200)
    }

    return json({ text, model }, 200)
  } catch (error) {
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network'
    return json({ text: null, reason }, 200)
  } finally {
    clearTimeout(timer)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
