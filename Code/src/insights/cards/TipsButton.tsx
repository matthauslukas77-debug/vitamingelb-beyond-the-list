import { useSession } from '../../app/session'
import { loadSeen, unseenCount } from '../tips/seen'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Einstieg zu «Das kann die App» — neben dem Signal-Knopf.
 *
 * Warum hierher und nicht in die Einstellungen: Nach «Profil und
 * Einstellungen» sucht, wer etwas ändern will. Wer nicht weiss, dass es etwas
 * gibt, sucht gar nicht — der Hinweis muss dort stehen, wo man ohnehin
 * hinschaut, und das ist die Kopfzeile von Home.
 *
 * Das Zeichen ist eine Glühbirne, von Hand gezeichnet wie die Bögen am
 * Signal-Knopf, damit die Strichstärke zu `Icon` passt. Bewusst kein
 * Fragezeichen: Ein «?» verspricht Hilfe bei einem Problem. Hier gibt es kein
 * Problem, sondern etwas zu entdecken.
 *
 * Der Punkt zählt, was noch niemand aufgeklappt hat, und verschwindet, wenn
 * alles gelesen ist. Ein Hinweis, der immer leuchtet, bedeutet nach zwei Tagen
 * nichts mehr — dieselbe Regel wie bei den Signalen.
 */
export function TipsButton() {
  const { persona, push } = useSession()
  const unseen = unseenCount(loadSeen(persona.id))

  return (
    <button
      className="topbar__icon"
      onClick={() => push({ name: 'tips' })}
      aria-label={unseen > 0 ? `Das kann die App, ${unseen} noch nicht angesehen` : 'Das kann die App'}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {/* Kolben und Sockel — zwei Striche, kein Strahlenkranz: Der wirkt bei
            18px wie Schmutz und nicht wie Licht. */}
        <path d="M9 17.2a5.6 5.6 0 1 1 6 0v1.3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 18.5v-1.3Z" />
        <path d="M10.2 17.3h3.6" />
      </svg>
      {unseen > 0 && <span className="topbar__dot" />}
    </button>
  )
}
