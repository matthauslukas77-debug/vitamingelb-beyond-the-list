import { useMemo, useState } from 'react'
import { TODAY } from '../../data/types'
import type { RecurringSeries } from '../../domain/recurring'
import { formatAmount } from '../../lib/money'
import { parseIso } from '../../lib/date'
import { Icon, type IconName } from '../../app/shell/Icon'
import type { SlotProps } from '../registry'
import { commitmentsOf, gaugeWidths, recurringFinding, sharePercent } from '../engine/commitments'
import { signalsForPersona, type SignalKind } from '../signals/engine'
import { loadDismissed, openSignals } from '../signals/storage'
import './recurring-summary.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Kopf über den wiederkehrenden Buchungen.
 *
 * Er ersetzt den schlichten Kopf des Nachbaus (Slot `recurring.summary`) und
 * beantwortet drei Dinge, die dort vorher als Absatz standen:
 *
 *   1. **Wie viel ist schon vergeben?** Ein Balken statt einer Zahl. 2'728.94
 *      ist ohne Bezugsgrösse keine Auskunft — 31 % von dem, was regelmässig
 *      hereinkommt, ist eine. Der hellere Abschnitt darin ist das, was auf ein
 *      eigenes Konto geht: abgegangen, aber nicht weg.
 *   2. **Was ist neu?** Genau ein Befund, aus der Signal-Erkennung
 *      (`insights/signals/engine.ts`) und nach ihrem Rang. Antippen führt zur
 *      Reihe, um die es geht. Weggeklickte Signale bleiben weg — dieselbe
 *      Liste wie auf dem Signal-Bildschirm.
 *   3. **Woher kommt das alles?** Die Herkunft steht hinter dem ⓘ, nicht in
 *      drei Zeilen Kleingedrucktem über der Liste. In der Demo tippt man sie
 *      bewusst an; im Alltag steht sie im Weg.
 *
 * Was hier bewusst NICHT steht: ein Hinweis, dass man die Zeilen antippen
 * kann. Das sagen die Pfeile. Ein Satz, der eine Geste erklärt, ist ein
 * Eingeständnis, dass die Geste nicht sichtbar ist.
 */

/* `lib/date` kennt nur «August 2026» und «Aug. 2026» — hier steht der Monat
   ohne Jahr, weil es das laufende ist. */
const MONTH = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Das Zeichen am Befund — passend zur Art, nicht ein Symbol für alles. */
const FINDING_ICON: Record<string, IconName> = {
  /* Dasselbe Zeichen wie am Preis-Hinweis in der Zeile (`abo__change`), damit
     Karte und Zeile als dieselbe Aussage lesbar sind. */
  priceUp: 'invest',
  newSeries: 'plus',
  subscriptionSuspect: 'clock',
  missed: 'billPending',
}

function iconFor(kind: SignalKind): IconName {
  return FINDING_ICON[kind] ?? 'invest'
}

/**
 * Nur zwei Arten bekommen den warmen Ton: teurer geworden und ausgeblieben.
 * Eine neue Reihe ist eine Feststellung — sie in Orange zu setzen hiesse, dass
 * ein neues Abo an sich ein Fehler ist. Das entscheidet nicht die App.
 */
function isWarning(kind: SignalKind): boolean {
  return kind === 'priceUp' || kind === 'missed'
}

/** Das ⓘ von Hand gezeichnet — wie das Signal-Zeichen, damit die Strichstärke passt. */
function InfoMark() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 11v5.6" />
      <path d="M12 7.4v.1" />
    </svg>
  )
}

export function RecurringSummaryCard({ session, series = [] }: SlotProps & { series?: RecurringSeries[] }) {
  const { persona, push } = session
  const [showOrigin, setShowOrigin] = useState(false)

  const totals = useMemo(
    () =>
      commitmentsOf({
        series,
        transactions: persona.transactions,
        accounts: persona.accounts,
        ownName: persona.name,
        today: TODAY,
      }),
    [series, persona],
  )

  /* Die Signale rechnen ohne Budget: Ausreisser gehören nicht auf diesen
     Bildschirm, und ohne `budget` überspringt die Erkennung sie von selbst.
     Das spart die ganze Ableitung — hier zählt nur, was an Reihen hängt. */
  const finding = useMemo(() => {
    const signals = signalsForPersona(persona, { today: TODAY })
    return recurringFinding(openSignals(signals, loadDismissed(persona.id)))
  }, [persona])

  const share = totals.committedShare
  const percent = share === null ? null : sharePercent(share)
  const over = share !== null && share > 1
  const widths = gaugeWidths(totals)

  const openFinding = () => {
    const target = finding?.actions.find((action) => action.kind === 'openSeries')
    if (target && target.kind === 'openSeries') push({ name: 'series', seriesKey: target.seriesKey })
    else push({ name: 'signals' })
  }

  return (
    <section className="card recsum">
      <div className="card__body">
        <div className="recsum__head">
          <span className="recsum__label">Fix pro Monat</span>
          <span className="recsum__total num">{formatAmount(totals.fixedMonthly)}</span>
        </div>

        {percent !== null && (
          <div className={'recsum__gauge' + (over ? ' recsum__gauge--over' : '')}>
            <div className="recsum__track" aria-hidden="true">
              <div className="recsum__fill" style={{ width: `${widths.spent}%` }} />
              {/* Der hellere Abschnitt: geht ab, ist aber nicht ausgegeben. */}
              {widths.moved > 0 && (
                <div className="recsum__fill recsum__fill--moved" style={{ width: `${widths.moved}%` }} />
              )}
            </div>
            <p className="recsum__gaugeline">
              <strong className="recsum__gaugehead">
                {over ? 'mehr als was hereinkommt' : `${percent} % schon vergeben`}
              </strong>
              <span className="recsum__gaugesub">
                von {formatAmount(totals.incomingMonthly, { sign: false })} herein
                {totals.movedMonthly < 0 && (
                  <>
                    {' · '}
                    {formatAmount(totals.movedMonthly, { sign: false })} davon auf eigene Konten
                  </>
                )}
              </span>
            </p>
          </div>
        )}

        <div className="recsum__next">
          <span className="recsum__nextlabel">
            Bis Ende {MONTH[parseIso(TODAY).getMonth()]}
            {totals.restOfMonth.count > 0 && (
              <>
                {' · '}
                {totals.restOfMonth.count}{' '}
                {totals.restOfMonth.count === 1 ? 'Belastung' : 'Belastungen'}
              </>
            )}
          </span>
          {/* «0.00+» wäre falsch (ein Plus auf einer Null) und nichtssagend.
              Dass nichts mehr abgeht, ist eine Auskunft — also steht sie da. */}
          {totals.restOfMonth.count > 0 ? (
            <span className="recsum__nextvalue num">{formatAmount(totals.restOfMonth.total)}</span>
          ) : (
            <span className="recsum__nextnone">geht nichts mehr ab</span>
          )}
        </div>

        {finding && (
          <button
            className={'recsum__finding' + (isWarning(finding.kind) ? ' recsum__finding--warn' : '')}
            onClick={openFinding}
          >
            <span className="recsum__findicon">
              <Icon name={iconFor(finding.kind)} size={15} />
            </span>
            <span className="recsum__findmain">
              <span className="recsum__findtitle">{finding.title}</span>
              <span className="recsum__findbody">{finding.body}</span>
            </span>
            <span className="recsum__findchevron">
              <Icon name="chevronRight" size={14} />
            </span>
          </button>
        )}

        <div className="recsum__foot">
          <button
            className="recsum__origin"
            aria-expanded={showOrigin}
            onClick={() => setShowOrigin((on) => !on)}
          >
            <InfoMark />
            erkannt
          </button>
          <span className="recsum__counts">
            {totals.counts.series} Reihen · {totals.counts.subscriptions} Abos
          </span>
        </div>

        {showOrigin && (
          <p className="recsum__note">
            Erkannt aus Buchungstext, Betrag und Abstand — nichts davon ist hinterlegt oder von
            dir gepflegt. Dieselbe Erkennung trägt die Vorschau auf dem Kontostand.
          </p>
        )}
      </div>
    </section>
  )
}
