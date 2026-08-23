import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../../data/types'
import { formatAmount } from '../../lib/money'
import { useSession } from '../../app/session'
import { Icon } from '../../app/shell/Icon'
import { fingerprintOf, loadAssignments } from '../budget/assign'
import { loadMarkings } from '../budget/markings'
import { loadBudget } from '../budget/storage'
import { ask, NO_ANSWER, type AskOutcome } from './ask'
import { askRouted } from './router'
import { TOOLS, type AskContext } from './tools'
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
 * «twint» tippt, bekommt weiterhin die Funktion.
 *
 * ── Zwei Stufen, und die erste trägt allein ───────────────────────────────
 *
 * Die Muster antworten sofort und ohne Netz. Erst wenn sie aufgeben, fragt
 * `askRouted` den Apertus 8B nach dem passenden Werkzeug — gerechnet wird
 * auch dann hier, aus dem Motor, der die Blasen zeichnet. Deshalb steht unter
 * einer Antwort nie ein Satz, den ein Modell geschrieben hat.
 */

/** Beispielfragen für das leere Feld — aus den Werkzeugen selbst. */
export const SUGGESTED_QUESTIONS: string[] = TOOLS.flatMap((tool) => tool.examples.slice(0, 1))

/**
 * So lange wird nach dem letzten Tastendruck gewartet, bevor die Frage das
 * Gerät verlässt. Ohne das ginge jeder Buchstabe einzeln über die Leitung.
 */
const SETTLE_MS = 450

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

  /* Der Fingerabdruck hält die Identität stabil, damit die Berechnungen nicht
     bei jedem Rendern neu laufen — dieselbe Begründung wie auf dem
     Signale-Bildschirm. */
  const fingerprint = fingerprintOf(loadAssignments(persona.id))
  const context = useMemo<AskContext>(
    () => ({
      persona,
      today: TODAY,
      markings: loadMarkings(persona.id),
      assignments: loadAssignments(persona.id),
      budget: loadBudget(persona.id),
    }),
    [persona, fingerprint],
  )

  const local = useMemo(() => ask(question, context), [question, context])

  const [routed, setRouted] = useState<{ outcome: AskOutcome; by: 'muster' | 'apertus' } | null>(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    /* Nur was die Muster nicht können, geht ans Modell. Eine Absage schon gar
       nicht — die Frage soll das Gerät gar nicht erst verlassen. */
    setRouted(null)
    if (local.kind !== 'unknown') {
      setWaiting(false)
      return
    }

    let alive = true
    setWaiting(true)
    const timer = window.setTimeout(() => {
      askRouted(question, context)
        .then((result) => {
          if (!alive) return
          setRouted(result.outcome.kind === 'answer' ? result : null)
          setWaiting(false)
        })
        .catch(() => alive && setWaiting(false))
    }, SETTLE_MS)

    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [question, context, local])

  const outcome = routed?.outcome ?? local

  /* Dieselbe Überschrift wie über jeder anderen Gruppe im Suchbildschirm.
     So meldet sich in dieser App ein Abschnitt — nicht mit einer Farbfläche. */
  const head = (
    <div className="section-head">
      <span className="section-head__title">Antwort</span>
    </div>
  )

  if (outcome.kind === 'unknown') {
    return (
      <>
        {head}
        <section className="ask">
          <p className="ask__text">{waiting ? 'Einen Moment — ich schaue nach.' : NO_ANSWER}</p>
        </section>
      </>
    )
  }

  /* Eine Absage ist keine Panne, sondern eine Aussage — sie bekommt deshalb
     dieselbe Fläche wie eine Antwort und nicht eine Fehlermeldung. */
  if (outcome.kind === 'refused') {
    return (
      <>
        {head}
        <section className="ask">
          <p className="ask__text">{outcome.text}</p>
          <div className="ask__foot">
            <span className="ask__badge">Dazu sage ich nichts</span>
          </div>
        </section>
      </>
    )
  }

  const { result } = outcome
  const proof =
    result.transactionIds.length > 0
      ? `gerechnet · ${result.transactionIds.length} ${
          result.transactionIds.length === 1 ? 'Buchung' : 'Buchungen'
        }`
      : 'gerechnet'

  return (
    <>
      {head}
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
            Doktrin wie auf jeder Signalkarte und im Budget. Dass Apertus die
            Frage verstanden hat, steht daneben und nicht davor: Gerechnet hat
            es nicht das Modell. */}
          <span className="ask__badge">
            {routed?.by === 'apertus' ? 'Apertus · ' : ''}
            {proof}
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
    </>
  )
}
