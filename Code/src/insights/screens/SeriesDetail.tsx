import { useMemo } from 'react'
import { resolveBrand } from '../../data/brands'
import { CATEGORY_LABELS } from '../../data/categories'
import { TODAY } from '../../data/types'
import { detectRecurring } from '../../domain/recurring'
import { formatDate, formatMonth } from '../../lib/date'
import { formatAmount } from '../../lib/money'
import { useSession } from '../../app/session'
import { CADENCE_LABEL, KIND_ICON, kindLabel, pretty } from '../../app/screens/Recurring'
import { Icon, type IconName } from '../../app/shell/Icon'
import { Sheet } from '../../app/shell/Sheet'
import { dataWindowStart, seriesTenure } from '../engine/tenure'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Detail einer wiederkehrenden Buchung.
 *
 * Die Abo-Liste der App sagt, was als Nächstes kommt. Sie sagt nicht, seit wann
 * man zahlt und was das insgesamt war — und genau das ist die Zahl, die im
 * Gespräch die Reaktion auslöst: Ein Abo für 12.95 klingt nach nichts, 31 × 12.95
 * ist eine Entscheidung.
 *
 * Alles hier ist gerechnet, nichts formuliert. Die Reihe wird bei jedem Aufruf
 * neu erkannt (`detectRecurring`), damit es keinen zweiten Datenstand gibt.
 */

/**
 * Eine Zeile der Kennzahlen: Symbol, Bezeichnung, Wert.
 *
 * Vorher standen die vier Zahlen als 2×2-Kacheln, jede mit einer grauen
 * Erklärzeile darunter. Das hatte zwei Nachteile: Die längste Erklärung zog
 * die ganze Rasterzeile hoch und liess neben sich ein Loch, und vier
 * Kleingedruckte auf engem Raum liest niemand — sie machten die vier Zahlen
 * unübersichtlich, um die es eigentlich geht.
 *
 * Jetzt vier gleich hohe Zeilen: links das Symbol als Anker fürs Auge, rechts
 * der Wert. Was einschränkt statt erklärt, steht gesammelt als eine Fussnote
 * unter der Karte — einmal statt viermal.
 */
function Metric({ icon, label, value, sub, credit }: {
  icon: IconName
  label: string
  value: string
  /** Kurze Ergänzung direkt am Wert, nicht als eigene Zeile. */
  sub?: string
  credit?: boolean
}) {
  return (
    <div className="metric">
      <span className="metric__icon"><Icon name={icon} size={18} /></span>
      <span className="metric__label">{label}</span>
      <span className={'metric__value' + (credit ? ' metric__value--credit' : '')}>
        <span className="num">{value}</span>
        {sub && <span className="metric__sub">{sub}</span>}
      </span>
    </div>
  )
}

export function SeriesDetail({ seriesKey }: { seriesKey: string }) {
  const { persona, pop, push } = useSession()

  const series = useMemo(
    () => detectRecurring(persona.transactions, { today: TODAY }).find((entry) => entry.key === seriesKey),
    [persona, seriesKey],
  )

  const tenure = useMemo(
    () =>
      series
        ? seriesTenure(series, persona.transactions, {
            today: TODAY,
            windowStart: dataWindowStart(persona.transactions),
          })
        : undefined,
    [series, persona],
  )

  if (!series || !tenure) {
    return (
      <Sheet title="Wiederkehrende Buchung" onBack={pop}>
        <p className="empty">Diese Reihe ist nicht mehr erkennbar.</p>
      </Sheet>
    )
  }

  const match = resolveBrand(series.label)
  const title = match ? match.brand.name : pretty(series.label)
  const income = series.amount > 0

  // Die Buchungen der Reihe, jüngste zuerst — dieselbe Reihenfolge wie in der
  // Kontoliste.
  const ids = new Set(series.transactionIds)
  const bookings = persona.transactions
    .filter((tx) => ids.has(tx.id))
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  const phases = [...tenure.phases].reverse()

  return (
    <Sheet title="Wiederkehrende Buchung" onBack={pop}>
      <div className="detail__hero">
        <span
          className={'detail__logo' + (match ? ' detail__logo--brand' : '')}
          style={match?.bg ? { background: match.bg } : undefined}
        >
          {match ? (
            <img src={match.logo} alt="" width={72} height={72} />
          ) : (
            <Icon name={KIND_ICON[series.kind]} size={32} />
          )}
        </span>

        <span className="detail__amount num">
          <span className="detail__cur">CHF</span> {formatAmount(series.amount)}
        </span>
        <span className="detail__meta">
          <strong>{title}</strong> · {CADENCE_LABEL[series.cadence]}
        </span>
        <span className="detail__meta">
          <span className={`kind kind--${series.kind}`}>{kindLabel(series)}</span>
          {CATEGORY_LABELS[series.category]}
        </span>
      </div>

      <div className="detail__body">
        {/* Die vier Zahlen, die es in der App heute nicht gibt. */}
        <div className="metrics">
          <Metric
            icon="clock"
            label="Dabei seit"
            value={(tenure.atWindowEdge ? 'mind. ' : '') + tenure.label}
          />
          <Metric
            icon="list"
            label={income ? 'Eingänge' : 'Belastungen'}
            value={`${tenure.occurrences} ×`}
            sub={`alle ${series.intervalDays} Tage`}
          />
          <Metric
            icon={income ? 'banknoteIn' : 'banknoteOut'}
            label={income ? 'Insgesamt erhalten' : 'Insgesamt bezahlt'}
            value={formatAmount(tenure.total, { sign: false })}
            credit={income}
          />
          <Metric
            icon="calendar"
            label="Pro Jahr"
            value={formatAmount(tenure.perYear, { sign: false })}
            sub={CADENCE_LABEL[series.cadence]}
            credit={income}
          />
        </div>

        {/* Einmal statt viermal: Woher die Zahlen kommen und wo sie aufhören. */}
        <p className="metrics__note">
          {tenure.atWindowEdge
            ? `Älteste Buchung ${formatMonth(tenure.since)} — weiter zurück reichen die Daten nicht, «Dabei seit» und «Insgesamt» sind deshalb Mindestwerte.`
            : `Erste Buchung ${formatDate(tenure.since)}. «Pro Jahr» rechnet mit dem aktuellen Betrag.`}
        </p>

        {series.priceChange && tenure.extraPerYear !== undefined && (
          <div className="detail__notice">
            <span className="detail__notice-icon"><Icon name="invest" size={18} /></span>
            <span>
              Seit {formatMonth(series.priceChange.since)} teurer:{' '}
              <strong>{formatAmount(series.priceChange.from, { sign: false })}</strong> →{' '}
              <strong>{formatAmount(series.priceChange.to, { sign: false })}</strong>. Das sind{' '}
              <strong>{formatAmount(tenure.extraPerYear, { sign: false })}</strong> mehr im Jahr.
            </span>
          </div>
        )}

        {phases.length > 1 && (
          <div className="detail__section">
            <div className="detail__label">Betragsverlauf</div>
            {phases.map((phase) => (
              <div className="phase" key={phase.from}>
                <span className="phase__main">
                  <span className="phase__amount num">{formatAmount(phase.amount, { sign: false })}</span>
                  <span className="phase__when">
                    {formatMonth(phase.from)}
                    {phase.from !== phase.to && ` – ${formatMonth(phase.to)}`}
                  </span>
                </span>
                <span className="phase__count">{phase.count} ×</span>
              </div>
            ))}
          </div>
        )}

        <div className="detail__section">
          <div className="detail__label">Nächste erwartete Buchung</div>
          <div className="detail__row">
            <span className="detail__icon"><Icon name="calendar" size={22} accent /></span>
            <span className="detail__main">
              <strong className="detail__strong">{formatDate(series.nextExpected)}</strong>
              <span className="detail__sub">
                Erwartet, nicht angekündigt — gerechnet aus dem Abstand der letzten Buchungen
              </span>
            </span>
          </div>
        </div>

        <div className="detail__section">
          <div className="detail__label">
            Alle {bookings.length} Buchungen dieser Reihe
          </div>
          {bookings.map((tx) => (
            <button
              className="phase phase--tap"
              key={tx.id}
              onClick={() => push({ name: 'transaction', transactionId: tx.id })}
            >
              <span className="phase__main">
                <span className="phase__when">{formatDate(tx.date)}</span>
              </span>
              <span className={'phase__amount num' + (tx.amount > 0 ? ' phase__amount--credit' : '')}>
                {formatAmount(tx.amount)}
              </span>
              <span className="row__chevron"><Icon name="chevronRight" size={18} /></span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
