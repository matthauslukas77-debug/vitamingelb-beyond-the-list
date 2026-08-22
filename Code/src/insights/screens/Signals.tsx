import { useMemo, useState } from 'react'
import { TODAY } from '../../data/types'
import { formatDate, formatPeriod } from '../../lib/date'
import { formatAmount } from '../../lib/money'
import { useSession } from '../../app/session'
import { Icon, type IconName } from '../../app/shell/Icon'
import { Sheet } from '../../app/shell/Sheet'
import { budgetPerCategory, signalsForPersona, type Signal, type SignalKind } from '../signals/engine'
import {
  loadDismissed,
  openSignals,
  saveDismissed,
  withDismissed,
  withRestored,
  type Dismissed,
} from '../signals/storage'
import { loadBudget } from '../budget/storage'
import { fingerprintOf, loadAssignments } from '../budget/assign'
import { openAssignments } from '../budget/review'
import { fullMonthWindow } from '../budget/derive'
import {
  DEFAULT_SPREAD_MONTHS,
  loadMarkings,
  markingOf,
  saveMarkings,
  withMarking,
  type Marking,
  type Markings,
} from '../budget/markings'
import '../budget/budget.css'
import '../budget/screens/assign.css'
import './signals.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Signale — was sich verändert hat, und was man dagegen tun kann.
 *
 * Das Gegenstück zum Cockpit: Dort stehen die Instrumente, hier die Leuchten.
 * Das Cockpit zeigt den Zustand, dieser Bildschirm die Veränderung.
 *
 * Zwei Dinge tragen ihn:
 *
 *   **Jede Karte nennt ihren Beleg.** Kein Satz ohne die Buchungen, aus denen
 *   er stammt — dieselbe Doktrin wie beim Budget.
 *
 *   **Jede Karte lässt sich erledigen.** Ohne das füllt sich der Bildschirm
 *   nach drei Tagen mit Gelesenem und wird nie wieder geöffnet. Erst dadurch
 *   bedeutet der rote Punkt auf Home etwas.
 *
 * Die Aktionen sind der eigentliche Punkt. «Du hast CHF 800 mehr bekommen» ist
 * eine Feststellung; «CHF 500 aufs Sparkonto» mit einem Tap in den fertigen
 * Zahlungsfluss ist eine Antwort.
 */

const ICONS: Record<SignalKind, IconName> = {
  incomeExtra: 'banknoteIn',
  incomeSwitch: 'transfer',
  incomeAnnual: 'calendar',
  incomeChange: 'trendUp',
  priceUp: 'invest',
  outlier: 'support',
  newSeries: 'clock',
  subscriptionSuspect: 'support',
  missed: 'billPending',
}

/** Ein Verdacht sieht anders aus als eine Messung. */
function toneOf(signal: Signal): string {
  if (signal.kind === 'incomeExtra' || signal.kind === 'incomeChange') return 'good'
  if (signal.kind === 'incomeSwitch' || signal.kind === 'incomeAnnual') return 'good'
  if (signal.confidence < 0.7) return 'soft'
  return 'warn'
}

/**
 * Das Blatt, das die Einordnung erfragt.
 *
 * Drei Antworten, weil es drei Fälle sind — die Begründung steht in
 * `budget/markings.ts`. Der Text nennt beim Verteilen ausdrücklich, was
 * danach im Monat steht: Wer «CHF 3'950 auf 12 Monate» wählt, soll die
 * CHF 329 sehen, bevor er tippt.
 */
function ClassifySheet({
  amount,
  current,
  onChoose,
  onClose,
}: {
  amount: number
  current: Marking
  onChoose: (marking: Marking) => void
  onClose: () => void
}) {
  const perMonth = Math.round(amount / DEFAULT_SPREAD_MONTHS)
  const options: { marking: Marking; title: string; body: string }[] = [
    {
      marking: { kind: 'normal' },
      title: 'Gehört so dazu',
      body: 'Zählt im August gegen dein Budget, wie jede andere Buchung.',
    },
    {
      marking: { kind: 'extraordinary' },
      title: 'War einmalig',
      body: 'Zählt nicht gegen das Monatsbudget. Steht weiterhin als ausserordentliche Ausgabe da — verschwindet also nicht.',
    },
    {
      marking: { kind: 'spread', months: DEFAULT_SPREAD_MONTHS },
      title: `Auf ${DEFAULT_SPREAD_MONTHS} Monate verteilen`,
      body: `Jahresrechnung oder Anschaffung: ${formatAmount(perMonth, { sign: false })} pro Monat statt alles im August.`,
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

export function Signals() {
  const { persona, pop, push } = useSession()
  const [dismissed, setDismissed] = useState<Dismissed>(() => loadDismissed(persona.id))
  const [markings, setMarkings] = useState<Markings>(() => loadMarkings(persona.id))
  /* Gelesen, nicht gehalten: Geändert wird auf dem Zuordnungsbrett, und dieser
     Bildschirm bleibt darunter gemountet — ein Zustand hier zeigte nach der
     Rückkehr die alte Zahl. Der Fingerabdruck hält die Identität stabil,
     damit die teuren Berechnungen darunter nicht bei jedem Rendern laufen. */
  const fingerprint = fingerprintOf(loadAssignments(persona.id))
  const assignments = useMemo(() => loadAssignments(persona.id), [persona.id, fingerprint])
  const [classify, setClassify] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const signals = useMemo(
    () =>
      signalsForPersona(persona, {
        today: TODAY,
        markings,
        assignments,
        budget: budgetPerCategory(persona, TODAY, markings, loadBudget(persona.id), assignments),
      }),
    [persona, markings, assignments],
  )

  /* Die offenen Quellen. Kein Signal, sondern eine stehende Aufgabe: Sie
     beschreibt keine Veränderung, sie verschwindet erst, wenn sie erledigt
     ist — und darf deshalb weder wegsortiert noch weggeklickt werden. */
  const window12 = fullMonthWindow(TODAY, 12)
  const unassigned = useMemo(
    () =>
      openAssignments(persona.transactions, persona.accounts, {
        from: window12.from,
        to: TODAY,
        ownName: persona.name,
        assignments,
      }),
    [persona, assignments, window12.from],
  )
  const unassignedBookings = unassigned.reduce((sum, group) => sum + group.count, 0)
  const unassignedTotal = unassigned.reduce((sum, group) => sum + group.total, 0)

  const open = openSignals(signals, dismissed)
  const done = signals.filter((signal) => !open.includes(signal))

  function dismiss(id: string) {
    const next = withDismissed(dismissed, id, TODAY)
    setDismissed(next)
    saveDismissed(persona.id, next)
  }

  function restore(id: string) {
    const next = withRestored(dismissed, id)
    setDismissed(next)
    saveDismissed(persona.id, next)
  }

  function mark(transactionId: string, marking: Marking) {
    const next = withMarking(markings, transactionId, marking)
    setMarkings(next)
    saveMarkings(persona.id, next)
    setClassify(null)
  }

  const transaction = classify
    ? persona.transactions.find((tx) => tx.id === classify)
    : undefined

  return (
    <Sheet title="Signale" onBack={pop}>
      <div className="screen__inner sig">
        {/* Die stehende Aufgabe, immer zuoberst. Sie steht vor den Signalen,
            weil sie deren Grundlage ist: Solange Buchungen im falschen Topf
            liegen, misst jede Budgetaussage darunter am falschen Mass. */}
        {unassigned.length > 0 && (
          <button className="asg-task" onClick={() => push({ name: 'assign' })}>
            <span className="asg-task__icon">
              <Icon name="sliders" size={20} />
            </span>
            <span className="asg-task__text">
              <span className="asg-task__title">
                {unassigned.length === 1
                  ? 'Eine Quelle ohne klare Kategorie'
                  : `${unassigned.length} Quellen ohne klare Kategorie`}
              </span>
              <span className="asg-task__body">
                {unassignedBookings} Buchungen, {formatAmount(unassignedTotal, { sign: false })}{' '}
                seit {formatPeriod(window12.from, window12.from)}. Zuordnen dauert{' '}
                {unassigned.length === 1 ? 'einen Zug' : `${unassigned.length} Züge`}.
              </span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        )}

        {open.length === 0 ? (
          <div className="sig-empty">
            <Icon name="check" size={28} />
            <span className="sig-empty__title">Nichts Auffälliges</span>
            <span className="sig-empty__body">
              Wir schauen weiter — bei neuen Abos, Preisänderungen und Buchungen, die aus der
              Reihe fallen.
            </span>
          </div>
        ) : (
          <p className="sig-lead">
            {open.length === 1 ? 'Eine Sache' : `${open.length} Sachen`}, die aufgefallen sind.
            Jede Zahl stammt aus deinen Buchungen.
          </p>
        )}

        {open.map((signal) => (
          <section className={`sig-card sig-card--${toneOf(signal)}`} key={signal.id}>
            <div className="sig-card__head">
              <span className="sig-card__icon">
                <Icon name={ICONS[signal.kind]} size={20} />
              </span>
              <span className="sig-card__title">{signal.title}</span>
              <span className="sig-card__date">{formatDate(signal.date).slice(0, 6)}</span>
            </div>

            <p className="sig-card__body">{signal.body}</p>

            {/* Der Beleg. Ohne ihn ist die Karte eine Behauptung. */}
            <span className="sig-card__proof">
              {signal.transactionIds.length === 1
                ? '1 Buchung'
                : `${signal.transactionIds.length} Buchungen`}{' '}
              dahinter
            </span>

            <div className="sig-card__actions">
              {signal.actions.map((action) => {
                if (action.kind === 'save') {
                  return (
                    <button
                      key="save"
                      className="sig-action sig-action--primary"
                      onClick={() => push({ name: 'pay', save: action.amount })}
                    >
                      {formatAmount(action.amount, { sign: false })} sparen
                    </button>
                  )
                }
                if (action.kind === 'classify') {
                  return (
                    <button
                      key="classify"
                      className="sig-action sig-action--primary"
                      onClick={() => setClassify(action.transactionId)}
                    >
                      Einordnen
                    </button>
                  )
                }
                if (action.kind === 'openSeries') {
                  return (
                    <button
                      key="series"
                      className="sig-action"
                      onClick={() => push({ name: 'series', seriesKey: action.seriesKey })}
                    >
                      Abo ansehen
                    </button>
                  )
                }
                if (action.kind === 'openTransaction') {
                  return (
                    <button
                      key="tx"
                      className="sig-action"
                      onClick={() => push({ name: 'transaction', transactionId: action.transactionId })}
                    >
                      Buchung ansehen
                    </button>
                  )
                }
                return (
                  <button
                    key="budget"
                    className="sig-action"
                    onClick={() => push({ name: 'cockpit', view: 'budget' })}
                  >
                    Budget ansehen
                  </button>
                )
              })}
              <button className="sig-action sig-action--quiet" onClick={() => dismiss(signal.id)}>
                Erledigt
              </button>
            </div>
          </section>
        ))}

        {done.length > 0 && (
          <>
            <button className="sig-more" onClick={() => setShowDone(!showDone)}>
              {done.length} erledigt
              <Icon name={showDone ? 'chevronDown' : 'chevronRight'} size={14} />
            </button>
            {showDone &&
              done.map((signal) => (
                <div className="sig-done" key={signal.id}>
                  <span>{signal.title}</span>
                  <button onClick={() => restore(signal.id)}>zurückholen</button>
                </div>
              ))}
          </>
        )}
      </div>

      {transaction && (
        <ClassifySheet
          amount={Math.abs(transaction.amount)}
          current={markingOf(markings, transaction.id)}
          onChoose={(marking) => mark(transaction.id, marking)}
          onClose={() => setClassify(null)}
        />
      )}
    </Sheet>
  )
}
