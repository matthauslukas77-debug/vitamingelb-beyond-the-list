import { fenceFor } from '../../../supabase/functions/ask/fences'
import { plain, TOOLS, type AskContext, type Tool, type ToolResult } from './tools'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Frage auf ein Werkzeug abbilden — und schweigen, wenn keines passt.
 *
 * Das Schweigen ist der Teil, der zählt. Ein Assistent, der auf jede Frage
 * irgendetwas sagt, ist in einer Banking-App gefährlich; einer, der «das kann
 * ich aus deinen Buchungen nicht beantworten» sagt, ist brauchbar. Deshalb
 * gibt es hier keinen Zweig, der freien Text erzeugt.
 *
 * Drei Ausgänge, mehr nicht:
 *
 *   **answer**  — ein Werkzeug hat zugesagt und geliefert.
 *   **refused** — die Frage fällt in ein Gebiet, das wir nicht bedienen.
 *   **unknown** — kein Werkzeug passt. Kein Rateversuch.
 */

export type AskOutcome =
  | { kind: 'answer'; tool: string; result: ToolResult }
  | { kind: 'refused'; text: string }
  | { kind: 'unknown' }

/**
 * Der Zaun steht in `supabase/functions/ask/fences.ts` und nicht hier.
 *
 * Nicht aus Ordnungsliebe: Die Edge Function ist öffentlich erreichbar, und
 * ein Zaun, der nur im Browser läuft, ist mit einem `curl` umgangen. Beide
 * Seiten prüfen jetzt dieselbe Liste mit derselben Vergleichsform.
 *
 * Themen, die wir nicht bedienen — und zwar ausdrücklich, nicht schlecht.
 *
 * Michaels Frage ist die konkreteste des ganzen Samples: «Ich brauche in
 * anderthalb Jahren 40'000 Franken — wo bekomme ich die am schlausten her?»
 * Und sie ist die einzige, die wir nicht beantworten dürfen. Das ist
 * Anlageberatung, und M6 aus der Interviewsynthese ist eindeutig: Das
 * Misstrauen der Zielgruppe richtet sich gegen Beratung, nicht gegen
 * Werkzeuge. Eine halbe Antwort hier verbrennt alles andere.
 *
 * Die Absage nennt den Grund und bietet das, was wir wirklich können.
 */

/** Mindestlänge, ab der eine Eingabe überhaupt als Frage gilt. */
export const MIN_QUESTION = 4

/**
 * Sieht diese Eingabe nach einer Frage aus?
 *
 * Das Suchfeld bleibt in erster Linie ein Suchfeld: Wer «twint» tippt, will
 * die Funktion und keine Erklärung. Erst ein Fragezeichen, ein Fragewort oder
 * ein erkanntes Muster machen daraus eine Frage.
 */
export function looksLikeQuestion(input: string): boolean {
  const raw = input.trim()
  if (raw.length < MIN_QUESTION) return false
  if (raw.includes('?')) return true
  const q = plain(raw)
  if (/^(wie|was|wer|wo|wofuer|wohin|warum|wieso|welche|welches|wieviel|wie viel)\b/.test(q)) return true
  /* Mehrwortige Eingaben, auf die ein Werkzeug direkt zusagt — «abos», «mein
     budget». Ein einzelnes Wort bleibt Suche. */
  return q.includes(' ') && TOOLS.some((tool) => tool.match(raw) !== null)
}

/** Das erste Werkzeug, das zusagt. Reihenfolge siehe `TOOLS`. */
export function pickTool(question: string): { tool: Tool; args: Record<string, string> } | null {
  for (const tool of TOOLS) {
    const args = tool.match(question)
    if (args) return { tool, args }
  }
  return null
}

export function ask(question: string, context: AskContext): AskOutcome {
  const raw = question.trim()
  if (raw.length < MIN_QUESTION) return { kind: 'unknown' }

  /* Der Zaun steht vor der Werkzeugwahl. Sonst beantwortete «Wie viel gebe ich
     für meine Säule 3a aus?» eine Vorsorgefrage mit einer Kategoriesumme —
     formal richtig, aber es lädt zur nächsten Frage ein, die wir nicht
     beantworten dürfen. */
  const refusal = fenceFor(plain(raw))
  if (refusal !== null) return { kind: 'refused', text: refusal }

  const picked = pickTool(raw)
  if (!picked) return { kind: 'unknown' }

  const result = picked.tool.run(picked.args, context)
  /* Ein Werkzeug, das zusagt und dann nichts findet, ist kein Fehler — es
     heisst, dass die Daten die Frage nicht hergeben. Auch das ist «unknown»
     und nicht ein erfundener Satz. */
  if (!result) return { kind: 'unknown' }

  return { kind: 'answer', tool: picked.tool.name, result }
}

/** Der Satz, wenn nichts passt. Steht nur an einer Stelle. */
export const NO_ANSWER =
  'Das kann ich aus deinen Buchungen nicht beantworten. Frag mich nach Kategorien, Abos, ' +
  'einem Händler, deinem Budget oder danach, was sich verändert hat.'
