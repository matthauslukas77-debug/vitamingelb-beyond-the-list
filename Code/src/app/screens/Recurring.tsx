import { useMemo } from 'react'
import { resolveBrand } from '../../data/brands'
import { TODAY } from '../../data/types'
import { detectRecurring, upcoming, type RecurringSeries, type SeriesKind } from '../../domain/recurring'
import { formatAmount } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { useSession } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'

/**
 * Wiederkehrende Buchungen — alles, was regelmässig kommt oder geht.
 *
 * Bewusst nicht «Meine Abos»: Der Lohn, die Miete und der Dauerauftrag aufs
 * Sparkonto sind genauso wiederkehrend wie Netflix, und wer wissen will, ob es
 * bis Ende Monat reicht, braucht beide Seiten. Was für eine Art es ist, steht
 * an der Zeile — erkannt, nicht hinterlegt.
 *
 * Die Liste entsteht aus `src/domain/recurring.ts`: Der Buchungstext wird auf
 * den Händler reduziert, Buchungen werden gruppiert und nur behalten, wenn
 * Abstand und Betrag zueinander passen. Keine hinterlegte Kennung, keine
 * Pflege durch die Nutzerin.
 *
 * Was hier steht, ist zugleich die Grundlage für die Prognose: Alles mit einem
 * `nextExpected` ist eine bekannte Verpflichtung.
 */

const GROUP_LABEL: Record<SeriesKind, string> = {
  income: 'Einnahmen',
  subscription: 'Abos',
  bill: 'Rechnungen',
  standingOrder: 'Daueraufträge',
  other: 'Übriges',
}

/** Was an der einzelnen Zeile steht — Einzahl, und beim Lohn beim Namen genannt. */
export function kindLabel(series: RecurringSeries): string {
  if (series.kind === 'income') return /LOHN|SALAER|SALAIRE/.test(series.key) ? 'Lohn' : 'Einnahme'
  if (series.kind === 'subscription') return 'Abo'
  if (series.kind === 'standingOrder') return 'Dauerauftrag'
  if (series.kind === 'bill') return 'Rechnung'
  return 'Wiederkehrend'
}

export const KIND_ICON: Record<SeriesKind, IconName> = {
  income: 'billPending',
  subscription: 'clock',
  bill: 'document',
  standingOrder: 'transfer',
  other: 'payments',
}

const ORDER: SeriesKind[] = ['subscription', 'standingOrder', 'bill', 'income', 'other']

export const CADENCE_LABEL: Record<RecurringSeries['cadence'], string> = {
  weekly: 'wöchentlich',
  biweekly: 'alle zwei Wochen',
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  semiannual: 'halbjährlich',
  yearly: 'jährlich',
}

/**
 * Aus «ADOBE *CREATIVE CLOUD» wird «Adobe Creative Cloud».
 *
 * Nur für Buchungen ohne erkannte Marke — sonst nimmt die Zeile den Markennamen
 * aus der Registry, der immer besser ist als alles, was sich aus dem
 * Buchungstext ableiten lässt.
 */

/** Umlaute, die der Auszug als Digraph schreibt. Bewusst eine kurze Liste:
 *  «UE» blind zu ersetzen macht aus AEBISCHER ein ÄBISCHER. */
const SPELLING: Record<string, string> = {
  UEBERTRAG: 'Übertrag',
  PRAEMIE: 'Prämie',
  MAHNGEBUEHR: 'Mahngebühr',
  GEBAEUDEVERSICHERUNG: 'Gebäudeversicherung',
  KONTOUEBERZUG: 'Kontoüberzug',
  SALAER: 'Salär',
}

/** Bindewörter bleiben klein, sonst steht dort «Uebertrag AUF Sparkonto». */
const LOWERCASE = new Set(['AUF', 'AN', 'VON', 'UND', 'FUER', 'PER', 'IM', 'DER', 'DIE', 'DAS', 'MIT'])

export function pretty(label: string): string {
  const merchant = label.replace(/^.*vom \d{2}\.\d{2}\.\d{4},\s*/i, '')
  return merchant
    .replace(/[*_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => {
      if (SPELLING[word]) return SPELLING[word]
      if (LOWERCASE.has(word)) return word === 'FUER' ? 'für' : word.toLowerCase()
      return word.length > 3 && word === word.toUpperCase()
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word
    })
    .join(' ')
}

/* Die Zeile führt neu auf die Detailansicht der Reihe (`src/insights/screens/
   SeriesDetail.tsx`): seit wann, wie oft, insgesamt. Das ist der einzige
   Eingriff unserer Schicht in diesen Bildschirm — die Liste selbst bleibt der
   Nachbau. */
function SeriesRow({ series, onOpen }: { series: RecurringSeries; onOpen: () => void }) {
  const match = resolveBrand(series.label)
  // Die Marke kennt den Namen besser als der Buchungstext: «Adobe Creative
  // Cloud» statt «Adobe *creative Cloud Inc».
  const title = match ? match.brand.name : pretty(series.label)

  return (
    <button className="abo abo--tap" onClick={onOpen}>
      {match ? (
        <span className={'abo__icon abo__icon--logo' + (match.logo.endsWith('.svg') ? ' abo__icon--wordmark' : '')}>
          <img src={match.logo} alt="" loading="lazy" width={40} height={40} />
        </span>
      ) : (
        <span className="abo__icon">
          <Icon name={KIND_ICON[series.kind]} size={22} />
        </span>
      )}
      <span className="abo__main">
        <span className="abo__title">{title}</span>
        <span className="abo__sub">
          <span className={`kind kind--${series.kind}`}>{kindLabel(series)}</span>
          {CADENCE_LABEL[series.cadence]} · nächste {formatDate(series.nextExpected).slice(0, 6)}
          {series.nextExpected.slice(0, 4) !== TODAY.slice(0, 4) && formatDate(series.nextExpected).slice(6)}
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
      <span className="abo__chevron">
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

export function Recurring() {
  const { persona, pop, push } = useSession()

  const series = useMemo(
    () => detectRecurring(persona.transactions, { today: TODAY }),
    [persona],
  )

  const next30 = upcoming(series, TODAY, 30)
  const monthlyOut = series
    .filter((entry) => entry.monthlyAmount < 0)
    .reduce((total, entry) => total + entry.monthlyAmount, 0)
  const monthlyIn = series
    .filter((entry) => entry.monthlyAmount > 0)
    .reduce((total, entry) => total + entry.monthlyAmount, 0)
  const subscriptionCount = series.filter((entry) => entry.kind === 'subscription').length

  const grouped = ORDER.map((kind) => ({
    kind,
    entries: series.filter((entry) => entry.kind === kind),
  })).filter((group) => group.entries.length > 0)

  return (
    <Sheet title="Wiederkehrende Buchungen" onBack={pop}>
      <div className="screen__inner">
        <section className="card">
          <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 15, color: 'var(--text-body)' }}>Fix pro Monat</span>
              <span className="num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)' }}>
                {formatAmount(monthlyOut)}
              </span>
            </div>
            {monthlyIn > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 15, color: 'var(--text-body)' }}>Regelmässig herein</span>
                <span className="num abo__amount--credit" style={{ fontSize: 17, fontWeight: 700 }}>
                  {formatAmount(monthlyIn)}
                </span>
              </div>
            )}
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
              aus Buchungstext, Betrag und Abstand. Nichts davon ist hinterlegt oder gepflegt.{' '}
              <strong style={{ fontWeight: 700, color: 'var(--text-body)' }}>
                Antippen zeigt, seit wann du zahlst und was es insgesamt war.
              </strong>
            </p>
          </div>
        </section>

        {grouped.map((group) => (
          <div key={group.kind}>
            <div className="section-head">
              <span className="section-head__title">{GROUP_LABEL[group.kind]}</span>
              <span className="section-head__value">{group.entries.length}</span>
            </div>
            <section className="card">
              <div style={{ padding: 'var(--s-2) var(--s-5)' }}>
                {group.entries.map((entry) => (
                  <SeriesRow
                    key={entry.key}
                    series={entry}
                    onOpen={() => push({ name: 'series', seriesKey: entry.key })}
                  />
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
