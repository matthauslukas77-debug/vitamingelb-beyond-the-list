import { TODAY } from '../../data/types'
import { formatAmount } from '../../lib/money'
import { useSession } from '../../app/session'
import { Icon } from '../../app/shell/Icon'
import { loadMarkings } from '../budget/markings'
import { loadAssignments } from '../budget/assign'
import { loadBudget } from '../budget/storage'
import { ask, NO_ANSWER } from './ask'
import { TOOLS } from './tools'
import './assistant.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Antwort über der Trefferliste.
 *
 * Kein eigener Bildschirm, kein siebter Reiter, kein Sprechblasensymbol. Der
 * Grund steht in der Interviewsynthese: Die Analysen sind faktisch tot —
 * Fritz «versteckt, untergegangen», Lukas drei- bis viermal in Jahren, Janic
 * nie. Ein Assistent als weitere Kachel wäre dasselbe Angebot noch einmal.
 *
 * Das Suchfeld dagegen wird benutzt, liegt auf Home und ist ein
 * Texteingabefeld. Wer eine Frage tippt, bekommt oben eine Antwort; wer
 * «twint» tippt, bekommt weiterhin die Funktion. Dieselbe Zeile, zwei
 * Absichten — das kostet keine neue Navigation.
 *
 * Was hier **nicht** passiert: rechnen und formulieren. Der Satz kommt fertig
 * aus `tools.ts`, und jede Zahl darin stammt aus dem Motor, der auch die
 * Blasen zeichnet. Diese Datei zeigt ihn nur an.
 */

/** Beispielfragen für das leere Feld — aus den Werkzeugen selbst. */
export const SUGGESTED_QUESTIONS: string[] = TOOLS.flatMap((tool) => tool.examples.slice(0, 1))

export function AskSuggestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <>
      <div className="section-head">
        <span className="section-head__title">Frag deine Zahlen</span>
      </div>
      {/* Ayana konnte auf «Was müsste in einem Dashboard stehen?» nur
          antworten: «Eine gute Frage.» Von Nutzern die Spezifikation eines
          Features zu erwarten, das sie nie gesehen haben, führt ins Leere —
          also zeigen wir, was geht, statt danach zu fragen. */}
      <div className="ask-chips">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button key={question} className="ask-chip" onClick={() => onPick(question)}>
            {question}
          </button>
        ))}
      </div>
    </>
  )
}

export function AskAnswer({ question }: { question: string }) {
  const { persona, push } = useSession()

  const outcome = ask(question, {
    persona,
    today: TODAY,
    markings: loadMarkings(persona.id),
    assignments: loadAssignments(persona.id),
    budget: loadBudget(persona.id),
  })

  if (outcome.kind === 'unknown') {
    return (
      <section className="ask ask--quiet">
        <p className="ask__text">{NO_ANSWER}</p>
      </section>
    )
  }

  /* Eine Absage ist keine Panne, sondern eine Aussage — sie bekommt deshalb
     dieselbe Fläche wie eine Antwort und nicht eine Fehlermeldung. */
  if (outcome.kind === 'refused') {
    return (
      <section className="ask ask--quiet">
        <p className="ask__text">{outcome.text}</p>
        <span className="ask__badge">Dazu sage ich nichts</span>
      </section>
    )
  }

  const { result } = outcome

  return (
    <section className="ask">
      <p className="ask__text">{result.text}</p>

      {result.rows && result.rows.length > 0 && (
        <ul className="ask-rows">
          {result.rows.slice(0, 6).map((row, index) => (
            <li className="ask-row" key={`${row.label}-${index}`}>
              <span className="ask-row__label">{row.label}</span>
              {row.sub && <span className="ask-row__sub">{row.sub}</span>}
              <span className="ask-row__amount num">{formatAmount(row.amount, { sign: false })}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="ask__foot">
        {/* Der Beleg. Ohne ihn ist die Antwort eine Behauptung — dieselbe
            Doktrin wie auf jeder Signalkarte und im Budget. */}
        <span className="ask__badge">
          {result.transactionIds.length > 0
            ? `gerechnet aus ${result.transactionIds.length} ${
                result.transactionIds.length === 1 ? 'Buchung' : 'Buchungen'
              }`
            : 'gerechnet'}
          {result.period ? ` · ${result.period}` : ''}
        </span>

        {result.link && (
          <button className="ask__link" onClick={() => push(result.link!.screen)}>
            {result.link.label}
            <Icon name="chevronRight" size={15} />
          </button>
        )}
      </div>
    </section>
  )
}
