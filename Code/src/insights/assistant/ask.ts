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
const FENCES: { pattern: RegExp; text: string }[] = [
  {
    pattern: /\b(anleg|investier|aktie|aktien|fonds|etf|krypto|bitcoin|rendite|kaufen soll|verkaufen soll|3a|saeule 3a|hypothek|zins)\b/,
    text:
      'Zu Anlagen, Vorsorge und Hypotheken sage ich nichts — dafür bin ich nicht gebaut, und eine ' +
      'halbe Antwort wäre hier schlechter als keine. Was ich kann: zeigen, was du hast, was ' +
      'regelmässig abgeht und was sich verändert hat.',
  },
  {
    /* Michaels Frage trifft keines der Fachwörter oben — sie lautet «wo
       bekomme ich die am schlausten her». Gefährlich ist nicht die Vokabel,
       sondern die **Form**: eine Optimierungsfrage mit Betrag und Termin.
       Genau die beantwortet man entweder richtig oder gar nicht. */
    pattern: /\b(wo|woher)\s+(bekomme|kriege|nehme|hole)\s+ich\b|\bam (schlausten|klugsten|besten|cleversten)\b|\bwie komme ich (an|zu)\b/,
    text:
      'Wo Geld am besten hinkommt oder herkommt, sage ich nicht — das ist eine Beratungsfrage, ' +
      'und eine halbe Antwort wäre hier schlechter als keine. Was ich dazu beitragen kann: was ' +
      'du heute zur Seite legst, was regelmässig abgeht und was am Monatsende übrig bleibt.',
  },
  {
    pattern: /\b(was fuer ein typ|persoenlichkeit|charakter|bin ich (geizig|sparsam|schlecht|gut) mit geld)\b/,
    text:
      'Über dich als Person sage ich nichts. Ich rechne mit deinen Buchungen, und daraus lässt ' +
      'sich kein Urteil ableiten — nur Beträge, Rhythmen und Veränderungen.',
  },
  {
    pattern: /\b(soll ich|was soll ich|empfiehlst du|wuerdest du mir raten|rat|tipp geben)\b.*\b(kaufen|kuendigen|abschliessen|wechseln)\b/,
    text:
      'Was du tun sollst, entscheidest du. Ich lege die Zahlen daneben, die dafür nötig sind — ' +
      'frag mich nach dem Betrag, der Häufigkeit oder der Veränderung.',
  },
]

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
  const q = plain(raw)
  for (const fence of FENCES) {
    if (fence.pattern.test(q)) return { kind: 'refused', text: fence.text }
  }

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
