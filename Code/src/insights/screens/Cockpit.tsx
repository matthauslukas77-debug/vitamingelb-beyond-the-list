import { useState } from 'react'
import { useSession, type CockpitView } from '../../app/session'
import { AnalysisContent } from '../../app/screens/Analysis'
import { RecurringContent } from '../../app/screens/Recurring'
import { Icon } from '../../app/shell/Icon'
import { Sheet } from '../../app/shell/Sheet'
import { BudgetView } from '../budget/screens/BudgetView'
import '../budget/budget.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das Cockpit — was aus den «Analysen» wird.
 *
 * Der heutige Bildschirm heisst «Analysen» und kann eines: beschreiben. Er
 * zeigt einen Doppelring über das laufende Jahr, darunter Einnahmen, Ausgaben,
 * einen leeren Budget-Platzhalter und die wiederkehrenden Buchungen. Nino im
 * Interview 04: *«Die Ausgaben sind so verdammt stur in einer Liste
 * aufgeführt.»*
 *
 * Das Cockpit ist dasselbe Material unter drei Pillen — und die erste davon
 * ist neu:
 *
 *   **Budget**       aus den Buchungen abgeleitet, gegen den Richtwert gestellt
 *   **Analyse**      der Ist-Zustand, unverändert
 *   **Wiederkehrend** was regelmässig kommt und geht
 *
 * Warum die Analyse-Ansicht wörtlich bleibt: Sie ist ab jetzt der Vergleich.
 * Wer im Pitch zwischen «Budget» und «Analyse» hin- und herschaltet, sieht in
 * zwei Klicks, was dazugekommen ist — ohne Folie daneben.
 *
 * Zur Trennlinie im Repo: Dieser Bildschirm liegt in `src/insights/`, weil er
 * unserer ist. Er rendert den Nachbau als eine seiner Ansichten
 * (`AnalysisContent`, `RecurringContent`), statt ihn zu verändern. In
 * `src/app/` steht dadurch weiterhin keine einzige eigene Idee.
 */

const PILLS: { view: CockpitView; label: string }[] = [
  { view: 'budget', label: 'Budget' },
  { view: 'analysis', label: 'Analyse' },
  { view: 'recurring', label: 'Wiederkehrend' },
]

export function Cockpit({ view: initial = 'budget' }: { view?: CockpitView }) {
  const { pop } = useSession()
  const [view, setView] = useState<CockpitView>(initial)

  return (
    <Sheet title="Cockpit" onBack={pop} action={<Icon name="settings" size={20} />}>
      {/* Die Pillen ersetzen die Auswahl «Zusammengefasst» des Nachbaus. Sie
          bleiben oben stehen, damit der Wechsel nicht scrollt. */}
      <div className="cockpit__pills" role="tablist" aria-label="Ansicht">
        {PILLS.map((pill) => (
          <button
            key={pill.view}
            role="tab"
            className="cockpit__pill"
            aria-selected={view === pill.view}
            onClick={() => setView(pill.view)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {view === 'budget' && <BudgetView />}
      {view === 'analysis' && <AnalysisContent />}
      {view === 'recurring' && <RecurringContent />}
    </Sheet>
  )
}
