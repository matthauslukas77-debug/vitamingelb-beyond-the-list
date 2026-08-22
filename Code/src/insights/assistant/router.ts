import { getSupabase, isSupabaseConfigured } from '../../lib/supabase'
import { ask, type AskOutcome } from './ask'
import { TOOLS, type AskContext } from './tools'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Stufe 2: der Apertus 8B als Router — aber erst, wenn die Muster aufgeben.
 *
 * ── Warum die Muster zuerst laufen ────────────────────────────────────────
 *
 * Nicht aus Misstrauen, sondern weil es die bessere Reihenfolge ist. Die
 * häufigen Fragen — «Welche Abos habe ich?», «Wofür gebe ich am meisten
 * aus?» — beantwortet der Code in **null Millisekunden, ohne Netz und ohne
 * Schlüssel**. Sie deshalb trotzdem über eine Leitung zu schicken, wäre
 * langsamer, teurer und fragiler, ohne dass die Antwort besser würde.
 *
 * Das Modell kommt dort zum Zug, wo die Muster ehrlich versagen. Gemessen an
 * echten Formulierungen sind das genau die interessanten Fälle:
 *
 *     «wo verpulvere ich mein geld»                  → topSpending
 *     «Wer ist eigentlich dieser SumUp auf meiner
 *      Abrechnung?»                                  → merchantLookup, name=SumUp
 *
 * Beide trifft kein Muster, das ich von Hand schreiben würde, ohne hundert
 * weitere zu übersehen. Der 8B trifft sie, und er zieht «SumUp» aus dem Satz —
 * das ist der Teil, den Sprachverständnis wirklich besser kann.
 *
 * ── Was der Router nicht darf ─────────────────────────────────────────────
 *
 * Er liefert einen **Werkzeugnamen**, keinen Satz. Der Text entsteht danach
 * aus dem Motor. Und der Themenzaun aus `ask.ts` läuft **vor** dem Netzaufruf:
 * Eine Anlagefrage verlässt das Gerät gar nicht erst.
 */

/**
 * Länger warten, als der Nutzer zu tippen braucht, hilft niemandem.
 *
 * Die Edge Function hat ihre eigene Frist gegen den Modellendpunkt. Diese hier
 * gilt der Leitung dorthin: `functions.invoke` nimmt kein Abbruchsignal, und
 * eine hängende Verbindung liesse die Antwort für immer leer stehen.
 */
const TIMEOUT_MS = 6_000

function withTimeout<T>(work: Promise<T>): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
  ])
}

export interface RoutedOutcome {
  outcome: AskOutcome
  /** Wer die Werkzeugwahl getroffen hat — für das Abzeichen unter der Antwort. */
  by: 'muster' | 'apertus'
}

interface RouterReply {
  tool?: string | null
  args?: Record<string, string>
  via?: string
}

/**
 * Fragt die Edge Function nach einem Werkzeug.
 *
 * Gibt `null` zurück, wenn es keines gibt oder etwas schiefgeht — nie einen
 * Fehler, den der Bildschirm zeigen müsste. Ohne Supabase-Konfiguration läuft
 * die App vollständig weiter; das ist die Zusage aus `lib/supabase.ts`, und
 * sie gilt hier genauso.
 */
async function routeRemote(question: string): Promise<RouterReply | null> {
  if (!isSupabaseConfigured()) return null
  try {
    const supabase = await getSupabase()
    const reply = await withTimeout(
      supabase.functions.invoke<RouterReply>('ask', { body: { question } }),
    )
    if (!reply || reply.error) return null
    return reply.data ?? null
  } catch {
    return null
  }
}

/**
 * Die vollständige Kette: Muster, dann Modell, dann derselbe Motor.
 *
 * Der Rückgabewert ist immer ein gültiges `AskOutcome` — auch wenn Netz,
 * Schlüssel und Endpunkt fehlen. Das ist die Zusage von Stufe 1, und Stufe 2
 * darf sie nicht aufweichen.
 */
export async function askRouted(question: string, context: AskContext): Promise<RoutedOutcome> {
  const local = ask(question, context)

  /* Eine Absage ist eine Entscheidung, keine Lücke: Die Frage geht dann
     nicht ans Modell. Und was die Muster beantworten können, ist sofort da. */
  if (local.kind === 'answer' || local.kind === 'refused') {
    return { outcome: local, by: 'muster' }
  }

  const reply = await routeRemote(question)
  if (!reply?.tool) return { outcome: local, by: 'muster' }

  const tool = TOOLS.find((entry) => entry.name === reply.tool)
  if (!tool) return { outcome: local, by: 'muster' }

  /* Argumente aus dem Modell sind ein Vorschlag. Fehlen sie, versucht das
     Werkzeug es mit dem, was die Muster aus der Frage lesen. */
  const args = { ...(tool.match(question) ?? {}), ...(reply.args ?? {}) }
  const result = tool.run(args, context)
  if (!result) return { outcome: local, by: 'muster' }

  return { outcome: { kind: 'answer', tool: tool.name, result }, by: 'apertus' }
}
