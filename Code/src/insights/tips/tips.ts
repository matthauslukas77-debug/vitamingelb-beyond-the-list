import { CATALOG, type CatalogEntry } from '../../app/search/catalog'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Was wir gebaut haben, in einem Satz — und wie man hinkommt.
 *
 * Aus den Interviews: Die App wird geöffnet, der Saldo gelesen, die App wird
 * geschlossen. Wer so hineinschaut, findet nichts, was tiefer liegt. Eine
 * Funktion, die niemand findet, ist keine Funktion.
 *
 * Deshalb steht hier NICHT eine zweite Liste unserer Bildschirme. Titel, Weg,
 * Symbol und Sprungziel stehen schon im Suchkatalog — dort müssen sie stehen,
 * damit die Suche sie findet. Hier kommen nur die zwei Sätze dazu, die der
 * Katalog nicht hat:
 *
 *   `what`  Ein Satz, den man beim Überfliegen liest. Antwortet auf «gibt es
 *           das?» und nicht auf «wie heisst das?».
 *   `how`   Was man tut, wenn man es ausprobieren will. Erst der Ort, dann die
 *           Handlung — in dieser Reihenfolge sucht man.
 *
 * Verbunden wird über die Kennung. Läuft eine Kennung im Katalog weg, fällt es
 * im Test auf (`__tests__/tips.test.ts`) und nicht erst im Demo-Gespräch.
 */

export interface Tip {
  /** Kennung eines Eintrags in `CATALOG`. */
  id: string
  /** Der Satz für die Liste — was es ist, nicht wie es heisst. */
  what: string
  /** Der Weg dorthin und die erste Handlung. */
  how: string
}

/**
 * Reihenfolge ist Absicht und nicht Alphabet: Zuerst das Dach (Cockpit), dann
 * die Leuchten (Signale), dann das, was man selbst einstellt. Wer die Liste von
 * oben liest, bekommt die Funktionen in der Reihenfolge, in der sie aufeinander
 * aufbauen.
 */
export const TIPS: Tip[] = [
  {
    id: 'fn.analysis',
    what: 'Regelmässiges, Ungewöhnliches und die Prognose für einen Monat.',
    how: 'Home, in der Kreisreihe auf «Cockpit». Oben umschalten zwischen Budget, Analyse und Wiederkehrend.',
  },
  {
    id: 'fn.signals',
    what: 'Was sich verändert hat: teurere Abos, höherer Lohn, fehlende Zahlung.',
    how: 'Home oben links, neben der Suche. Der rote Punkt erscheint nur, wenn etwas offen ist — Erledigtes verschwindet.',
  },
  {
    id: 'fn.recurring',
    what: 'Alle Abos an einem Ort — mit dem Betrag pro Jahr, nicht pro Monat.',
    how: 'Cockpit, Reiter «Wiederkehrend». Eine Zeile antippen zeigt, seit wann du zahlst und was es insgesamt war.',
  },
  {
    id: 'fn.budget',
    what: 'Ein Budget aus deinen Buchungen statt aus einem Durchschnitt.',
    how: 'Cockpit, Reiter «Budget». Jede Zahl ist überschreibbar, und daneben steht, woher sie kommt.',
  },
  {
    id: 'fn.budgetWizard',
    what: 'Zwei Fragen, den Rest wissen wir schon. Danach steht das Budget.',
    how: 'Cockpit, Budget, dann «Budget einrichten». Der Rechner auf der Website fragt sieben Dinge — fünf davon stehen in deinen Buchungen.',
  },
  {
    id: 'fn.assign',
    what: 'Buchungen ohne klare Kategorie zuordnen — darauf stehen alle Zahlen.',
    how: 'Über ein Signal oder direkt aus dem Cockpit. Quelle nehmen, in einen Topf ziehen — mehr ist es nicht.',
  },
  {
    id: 'fn.breakdown.expenses',
    what: 'Wofür das Geld weggeht — und was davon nur eine eigene Umbuchung war.',
    how: 'Cockpit, Reiter «Analyse», dann auf den Ring. Eine Kategorie antippen zeigt die Buchungen darin.',
  },
  {
    id: 'fn.breakdown.income',
    what: 'Woher das Geld kommt, und wie viel davon am Lohn hängt.',
    how: 'Cockpit, Reiter «Analyse», dann auf «Einnahmen» umschalten.',
  },
]

/** Ein Tipp mit dem, was der Katalog dazu weiss. */
export interface ResolvedTip extends Tip {
  entry: CatalogEntry
}

/**
 * Die Tipps mit ihrem Katalogeintrag. Was sich nicht auflösen lässt, fällt
 * still weg: Ein fehlender Eintrag darf den Bildschirm nicht leer machen —
 * dafür ist der Test da, nicht die Laufzeit.
 */
export function resolvedTips(): ResolvedTip[] {
  return TIPS.flatMap((tip) => {
    const entry = CATALOG.find((candidate) => candidate.id === tip.id)
    return entry ? [{ ...tip, entry }] : []
  })
}
