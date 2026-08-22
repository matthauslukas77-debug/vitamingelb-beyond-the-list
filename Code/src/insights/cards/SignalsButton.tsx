import { useMemo } from 'react'
import { TODAY } from '../../data/types'
import { useSession } from '../../app/session'
import { budgetPerCategory, signalsForPersona } from '../signals/engine'
import { loadDismissed, openSignals } from '../signals/storage'
import { loadBudget } from '../budget/storage'
import { loadMarkings } from '../budget/markings'
import '../screens/signals.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Einstieg zu den Signalen — oben links auf Home, gegenüber der Suche.
 *
 * Das Zeichen sind drei aufsteigende Bögen: ein Signal, das ausgesendet wird.
 * Bewusst keine Glocke — die steht in den Einstellungen schon für Push, und
 * zwei Glocken mit verschiedener Bedeutung wären eine zu viel.
 *
 * Der rote Punkt ist derselbe wie am Services-Reiter. Er erscheint nur, wenn
 * wirklich etwas offen ist; deshalb muss sich jedes Signal erledigen lassen,
 * sonst leuchtet er für immer und bedeutet nach einer Woche nichts mehr.
 *
 * Gerechnet wird bei jedem Aufbau des Startbildschirms neu. Das klingt nach
 * viel, sind aber ein paar Millisekunden auf zweitausend Buchungen — und es
 * spart einen zweiten Zustand, der mit den Buchungen aus dem Tritt geraten
 * könnte.
 */
export function SignalsButton() {
  const { persona, push } = useSession()

  const count = useMemo(() => {
    const markings = loadMarkings(persona.id)
    const signals = signalsForPersona(persona, {
      today: TODAY,
      markings,
      budget: budgetPerCategory(persona, TODAY, markings, loadBudget(persona.id)),
    })
    return openSignals(signals, loadDismissed(persona.id)).length
  }, [persona])

  return (
    <button
      className="topbar__icon"
      onClick={() => push({ name: 'signals' })}
      aria-label={count > 0 ? `Signale, ${count} offen` : 'Signale'}
    >
      {/* Drei aufsteigende Bögen — von Hand gezeichnet wie alles andere hier,
          damit die Strichstärke zu `Icon` passt. */}
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" stroke="none" />
        <path d="M5 13.4a5 5 0 0 1 5 5" />
        <path d="M5 8.6a9.8 9.8 0 0 1 9.8 9.8" />
        <path d="M5 3.8A15 15 0 0 1 20 18.8" />
      </svg>
      {count > 0 && <span className="topbar__dot" />}
    </button>
  )
}
