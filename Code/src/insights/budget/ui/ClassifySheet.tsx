import { Icon } from '../../../app/shell/Icon'
import { formatAmount } from '../../../lib/money'
import { formatMonth } from '../../../lib/date'
import { DEFAULT_SPREAD_MONTHS, type Marking } from '../markings'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das Blatt, das die Einordnung erfragt: «Gehört das ins Monatsbudget?»
 *
 * Stand vorher in `screens/Signals.tsx` und war damit nur von dort erreichbar.
 * Gebraucht wird es an zwei Stellen: dort, wo die Signalkarte auf die Frage
 * hinweist — und dort, wo die Zahl steht, die sie aufwirft, nämlich auf der
 * Detailseite einer Budgetkategorie. Zwei Blätter mit zwei Formulierungen
 * derselben Frage wären zwei Angebote, und der Nutzer müsste raten, ob sie
 * dasselbe tun.
 *
 * Drei Antworten, weil es drei Fälle sind — die Begründung steht in
 * `markings.ts`. Der Text nennt beim Verteilen ausdrücklich, was danach im
 * Monat steht: Wer «CHF 3'950 auf 12 Monate» wählt, soll die CHF 329 sehen,
 * bevor er tippt.
 *
 * Die `sig-`Klassen sind die Blatt-Konvention der App, nicht ein Überrest der
 * Signale: `budget/screens/Assign.tsx` zeichnet sein Blatt schon genauso.
 */
export function ClassifySheet({
  amount,
  date,
  current,
  onChoose,
  onClose,
}: {
  /** Betrag der Buchung, Rappen, positiv. */
  amount: number
  /**
   * Datum der Buchung, ISO. Der Text nennt den Monat, in dem sie fällt — er
   * stand hier bis jetzt als «August» im Klartext und wäre im September
   * falsch gewesen.
   */
  date: string
  current: Marking
  onChoose: (marking: Marking) => void
  onClose: () => void
}) {
  const perMonth = Math.round(amount / DEFAULT_SPREAD_MONTHS)
  const month = formatMonth(date).split(' ')[0]

  const options: { marking: Marking; title: string; body: string }[] = [
    {
      marking: { kind: 'normal' },
      title: 'Gehört so dazu',
      body: `Zählt im ${month} gegen dein Budget, wie jede andere Buchung.`,
    },
    {
      marking: { kind: 'extraordinary' },
      title: 'War einmalig',
      body: 'Zählt nicht gegen das Monatsbudget. Steht weiterhin als ausserordentliche Ausgabe da — verschwindet also nicht.',
    },
    {
      marking: { kind: 'spread', months: DEFAULT_SPREAD_MONTHS },
      title: `Auf ${DEFAULT_SPREAD_MONTHS} Monate verteilen`,
      body: `Jahresrechnung oder Anschaffung: ${formatAmount(perMonth, { sign: false })} pro Monat statt alles im ${month}.`,
    },
  ]

  return (
    <>
      <div className="sig-scrim" onClick={onClose} aria-hidden />
      <div className="sig-sheet" role="dialog" aria-label="Gehört das ins Monatsbudget?">
        <h3 className="sig-sheet__title">Gehört das ins Monatsbudget?</h3>
        {options.map((option) => (
          <button
            key={option.title}
            className={'sig-choice' + (option.marking.kind === current.kind ? ' is-current' : '')}
            onClick={() => onChoose(option.marking)}
          >
            <span className="sig-choice__main">
              <span className="sig-choice__title">{option.title}</span>
              <span className="sig-choice__body">{option.body}</span>
            </span>
            {option.marking.kind === current.kind && <Icon name="check" size={18} />}
          </button>
        ))}
      </div>
    </>
  )
}
