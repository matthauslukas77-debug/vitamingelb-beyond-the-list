import { useMemo } from 'react'
import { TODAY } from '../../data/types'
import { detectRecurring, upcoming, type RecurringSeries, type SeriesKind } from '../../domain/recurring'
import { formatAmount } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { useSession } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'

/**
 * Meine Abos — «Wiederkehrende Transaktionen erkunden».
 *
 * Die Liste entsteht aus `src/domain/recurring.ts`: Der Buchungstext wird auf
 * den Händler reduziert, Buchungen werden gruppiert und nur behalten, wenn
 * Abstand und Betrag zueinander passen. Keine hinterlegte Kennung, keine
 * Pflege durch die Nutzerin.
 *
 * Was hier steht, ist zugleich die Grundlage für die Prognose: Alles mit einem
 * `nextExpected` ist eine bekannte Verpflichtung.
 */

const KIND_LABEL: Record<SeriesKind, string> = {
  income: 'Einnahmen',
  subscription: 'Abos',
  bill: 'Rechnungen',
  standingOrder: 'Daueraufträge',
  other: 'Übriges',
}

const KIND_ICON: Record<SeriesKind, IconName> = {
  income: 'billPending',
  subscription: 'clock',
  bill: 'document',
  standingOrder: 'transfer',
  other: 'payments',
}

const ORDER: SeriesKind[] = ['subscription', 'standingOrder', 'bill', 'income', 'other']

const CADENCE_LABEL: Record<RecurringSeries['cadence'], string> = {
  weekly: 'wöchentlich',
  biweekly: 'alle zwei Wochen',
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  semiannual: 'halbjährlich',
  yearly: 'jährlich',
}

/** Aus «ADOBE *CREATIVE CLOUD» wird «Adobe Creative Cloud». */
function pretty(label: string): string {
  const merchant = label.replace(/^.*vom \d{2}\.\d{2}\.\d{4},\s*/i, '')
  return merchant
    .replace(/[*_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) =>
      word.length > 3 && word === word.toUpperCase()
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ')
}

function SeriesRow({ series }: { series: RecurringSeries }) {
  return (
    <div className="abo">
      <span className="abo__icon">
        <Icon name={KIND_ICON[series.kind]} size={22} />
      </span>
      <span className="abo__main">
        <span className="abo__title">{pretty(series.label)}</span>
        <span className="abo__sub">
          {CADENCE_LABEL[series.cadence]} · nächste am {formatDate(series.nextExpected)}
        </span>
        {series.priceChange && (
          <span className="abo__change">
            <Icon name="invest" size={13} />
            Teurer seit {formatDate(series.priceChange.since).slice(0, 6)}
            {formatDate(series.priceChange.since).slice(6)} ·{' '}
            {formatAmount(series.priceChange.from, { sign: false })} →{' '}
            {formatAmount(series.priceChange.to, { sign: false })}
          </span>
        )}
      </span>
      <span className={'abo__amount num' + (series.amount > 0 ? ' abo__amount--credit' : '')}>
        {formatAmount(series.amount)}
      </span>
    </div>
  )
}

export function Subscriptions() {
  const { persona, pop } = useSession()

  const series = useMemo(
    () => detectRecurring(persona.transactions, { today: TODAY }),
    [persona],
  )

  const next30 = upcoming(series, TODAY, 30)
  const monthlyOut = series
    .filter((entry) => entry.monthlyAmount < 0)
    .reduce((total, entry) => total + entry.monthlyAmount, 0)
  const subscriptionCount = series.filter((entry) => entry.kind === 'subscription').length

  const grouped = ORDER.map((kind) => ({
    kind,
    entries: series.filter((entry) => entry.kind === kind),
  })).filter((group) => group.entries.length > 0)

  return (
    <Sheet title="Meine Abos" onBack={pop}>
      <div className="screen__inner">
        <section className="card">
          <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 15, color: 'var(--text-body)' }}>Fix pro Monat</span>
              <span className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)' }}>
                {formatAmount(monthlyOut)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 15, color: 'var(--text-body)' }}>
                Nächste 30 Tage · {next30.length} Zahlungen
              </span>
              <span className="num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>
                {formatAmount(next30.reduce((total, entry) => total + entry.amount, 0))}
              </span>
            </div>
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.45, color: 'var(--text-muted)' }}>
              {series.length} wiederkehrende Zahlungen erkannt, davon {subscriptionCount} Abos —
              aus Buchungstext, Betrag und Abstand. Nichts davon ist hinterlegt oder gepflegt.
            </p>
          </div>
        </section>

        {grouped.map((group) => (
          <div key={group.kind}>
            <div className="section-head">
              <span className="section-head__title">{KIND_LABEL[group.kind]}</span>
              <span className="section-head__value">{group.entries.length}</span>
            </div>
            <section className="card">
              <div style={{ padding: 'var(--s-2) var(--s-5)' }}>
                {group.entries.map((entry) => (
                  <SeriesRow key={entry.key} series={entry} />
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
