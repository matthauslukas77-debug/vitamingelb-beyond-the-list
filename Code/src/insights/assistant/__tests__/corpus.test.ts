import { describe, expect, it } from 'vitest'
import { fenceFor, normalise } from '../../../../supabase/functions/ask/fences'
import { pickTool } from '../ask'
import { plain } from '../tools'
import { CORPUS } from './corpus'

/**
 * Der Prüfkorpus — 149 Formulierungen aus den acht Interviews.
 *
 * Was hier gemessen wird, ist **nicht** «die Muster erkennen alles». Das
 * sollen sie gar nicht. Gemessen wird, wo sie tragen und wo der
 * Apertus-Router seinen Platz verdient — und dass sie an keiner Stelle das
 * *falsche* Werkzeug wählen.
 *
 * Die Unterscheidung ist der ganze Punkt:
 *
 *   **Nichts erkannt** ist harmlos. Die Frage geht an den 8B, der versteht
 *   sie, und die Antwort kommt trotzdem aus dem Motor.
 *
 *   **Falsch erkannt** ist schädlich. Dann bekommt jemand eine Kategorieliste
 *   auf eine Abofrage — und der Router wird nie gefragt, weil die Muster
 *   zuerst laufen.
 *
 * Deshalb steht unten eine harte Grenze auf Fehlleitungen und nur eine weiche
 * auf Abdeckung.
 */

const ALL = CORPUS.flatMap((entry) =>
  entry.phrasings.map((question) => ({ question, expected: entry.tool })),
)

describe('Die Muster gegen echte Formulierungen', () => {
  /**
   * Zwei Fragen sind wirklich mehrdeutig, und beide Antworten wären richtig.
   * Sie stehen hier benannt, statt die Muster um sie herum zu verbiegen —
   * eine Regel, die nur einen Satz rettet, bricht zehn andere.
   */
  const MEHRDEUTIG = new Set([
    /* «aus dem Rahmen» ist die Sprache der Veränderung, «von der Höhe her»
       die der Einzelbuchung. Beide Werkzeuge antworten sinnvoll. */
    'Welche Zahlungen fallen aus dem Rahmen, so von der Höhe her?',
    /* Wer noch kein Budget hat, wird von budgetStatus in den Wizard
       geschickt — genau das ist hier gewollt. */
    'Hilf mir, ein Budget aufzustellen — ich habe noch keins.',
  ])

  it('wählt nie das falsche Werkzeug', () => {
    /* Die eine Zusage, die nicht verhandelbar ist. Ein Muster, das sich
       irrt, blockiert den Router — er wird ja nur gefragt, wenn die Muster
       aufgeben. */
    const wrong = ALL.filter(({ question }) => !MEHRDEUTIG.has(question)).map(({ question, expected }) => {
      const picked = pickTool(question)
      return picked && picked.tool.name !== expected
        ? `«${question}» → ${picked.tool.name}, erwartet ${expected}`
        : null
    }).filter(Boolean)

    expect(wrong, 'fehlgeleitete Fragen').toEqual([])
  })

  it('trägt den Kern allein — mindestens die Hälfte ohne Netz', () => {
    /* Weiche Grenze mit Absicht. Sie sichert zu, dass die App ohne Apertus
       brauchbar bleibt, und lädt nicht dazu ein, für jede Formulierung ein
       Muster nachzuschieben. */
    const hit = ALL.filter(({ question, expected }) => pickTool(question)?.tool.name === expected)
    const share = hit.length / ALL.length
    expect(share, `${hit.length} von ${ALL.length} erkannt`).toBeGreaterThan(0.5)
  })

  it('verwechselt die Nachbarn nicht', () => {
    /* Die Fragen, die ähnlich klingen und etwas anderes meinen. Hier zählt
       nur: nicht dem falschen Werkzeug zuschlagen. */
    const confused: string[] = []
    for (const entry of CORPUS) {
      for (const question of entry.nearMisses) {
        if (MEHRDEUTIG.has(question)) continue
        const picked = pickTool(question)
        if (picked?.tool.name === entry.tool) {
          confused.push(`«${question}» → ${entry.tool}, gehört dort nicht hin`)
        }
      }
    }
    expect(confused).toEqual([])
  })
})

describe('Der Zaun gegen die üblichen Wortformen', () => {
  /* Alle vier liefen in der ersten Fassung durch. Die Ursachen standen im
     Regex: ein abschliessendes `\b` tötet den Wortstamm, ein führendes
     verhindert den Treffer im deutschen Kompositum. */
  const refuse = [
    'Soll ich investieren?',
    'Wie lege ich mein Geld an?',
    'Was ist mit meiner Altersvorsorge?',
    'Wie hoch ist mein Hypothekarzins?',
    'Lohnt sich meine Säule 3a?',
    'Ist ein ETF sinnvoll für mich?',
    'Wie viel ist in meiner Pensionskasse?',
    'Ich brauche in anderthalb Jahren 40000 Franken, wo bekomme ich die am schlausten her?',
    'Was für ein Geldtyp bin ich?',
    'Bin ich sparsam?',
  ]

  it.each(refuse)('lehnt «%s» ab', (question) => {
    expect(fenceFor(normalise(question))).not.toBeNull()
  })

  it('lässt die 149 echten Fragen durch', () => {
    /* Ein Zaun, der die eigenen Nutzer aussperrt, ist keiner. Zwei
       Formulierungen dürfen hängen bleiben — sie handeln wirklich von
       Kündigen und Empfehlen. */
    const blocked = ALL.filter(({ question }) => fenceFor(normalise(question)) !== null)
    expect(blocked.length, blocked.map((b) => b.question).join(' · ')).toBeLessThanOrEqual(2)
  })
})

describe('Server und Browser prüfen denselben Text', () => {
  it('normalisieren zeichengleich', () => {
    /* Zwei Vergleichsformen wären zwei Zäune, und die Lücke dazwischen wäre
       der Angriffsweg. Beide Funktionen stehen bewusst getrennt — der Server
       darf nicht vom Browser-Bündel abhängen —, müssen aber gleich rechnen. */
    const proben = [
      'Wofür gebe ich am meisten aus?',
      'Säule 3a',
      'ungewöhnlich',
      'Grüezi — was isch mit em Budget?',
      'STRASSE  mit   Leerzeichen',
      'Ãœberraschung',
      '',
    ]
    for (const probe of proben) {
      expect(normalise(probe), probe).toBe(plain(probe))
    }
    expect(normalise(undefined)).toBe(plain(undefined as unknown as string))
  })

  it('erhält die Umlautumschrift', () => {
    /* Der Fehler, der beim Härten entstand: NFKD zerlegt «ä» in a + Trema,
       das Trema fiel weg, und «Wofür» wurde zu «wofur» — womit jedes Muster
       auf «wofuer» ins Leere lief. */
    expect(plain('Wofür')).toBe('wofuer')
    expect(plain('Säule 3a')).toBe('saeule 3a')
    expect(plain('ungewöhnlich')).toBe('ungewoehnlich')
  })
})
