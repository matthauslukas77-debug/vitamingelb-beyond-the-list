import { useMemo } from 'react'
import { TODAY, type Transaction } from '../../data/types'
import { formatAmount } from '../../lib/money'
import { parseIso } from '../../lib/date'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Slot } from '../shell/Slot'
import { Sheet } from '../shell/Sheet'
import { CircleRow } from '../shell/parts'

/**
 * Analysen — der Bildschirm, um den es in der Challenge geht.
 * Vorlage: PREP/07_screenshots (echtes Bildschirmfoto, August 2026)
 *
 * Aufbau der echten Ansicht:
 *   · Auswahl «Zusammengefasst»
 *   · Doppelring: aussen die Einnahmen, innen die Ausgaben plus der Saldo in Gelb
 *   · Mitte: Zeitraum, Saldo, Durchschnitt pro Monat
 *   · Legende, dann Budgets und «Meine Abos»
 *
 * Bewusst rein deskriptiv — genau das ist der Ist-Zustand, den wir übertreffen wollen.
 */

const RING_GAP = 6

interface Totals {
  income: number
  expenses: number
  incomeCount: number
  expenseCount: number
  months: number
}

function totalsOf(transactions: Transaction[], months: number): Totals {
  let income = 0
  let expenses = 0
  let incomeCount = 0
  let expenseCount = 0
  for (const tx of transactions) {
    if (tx.amount > 0) {
      income += tx.amount
      incomeCount += 1
    } else {
      expenses += -tx.amount
      expenseCount += 1
    }
  }
  return { income, expenses, incomeCount, expenseCount, months }
}

/**
 * Doppelring.
 * Aussen die Einnahmen als voller Kreis — der Massstab.
 * Innen die Ausgaben im Verhältnis dazu, der Rest ist der Saldo in Gelb.
 */
function DoubleRing({ totals }: { totals: Totals }) {
  // Gemessen am echten Bildschirmfoto: Aussendurchmesser ~273, Loch ~189.
  const size = 276
  const outerStroke = 20
  const innerStroke = 20
  const outerR = (size - outerStroke) / 2
  const innerR = outerR - outerStroke / 2 - RING_GAP - innerStroke / 2
  const innerC = 2 * Math.PI * innerR

  const reference = Math.max(totals.income, totals.expenses, 1)
  const spentShare = Math.min(totals.expenses / reference, 1)
  const spentLength = innerC * spentShare

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
         aria-label="Einnahmen und Ausgaben im Verhältnis">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {/* Aussen: Einnahmen */}
        <circle cx={size / 2} cy={size / 2} r={outerR} fill="none"
                stroke="var(--hellblau5)" strokeWidth={outerStroke} />
        {/* Innen: der Saldo als Grundfarbe … */}
        <circle cx={size / 2} cy={size / 2} r={innerR} fill="none"
                stroke="var(--postfinancegelb)" strokeWidth={innerStroke} />
        {/* … darüber die Ausgaben */}
        <circle cx={size / 2} cy={size / 2} r={innerR} fill="none"
                stroke="var(--petrol9)" strokeWidth={innerStroke}
                strokeDasharray={`${spentLength} ${innerC}`} />
      </g>
    </svg>
  )
}

export function Analysis() {
  const { persona, pop, push } = useSession()

  // «Zusammengefasst» zeigt das laufende Jahr.
  const from = `${TODAY.slice(0, 4)}-01-01`
  const recent = useMemo(
    () => persona.transactions.filter((tx) => tx.date >= from && tx.date <= TODAY),
    [persona, from],
  )

  const months = parseIso(TODAY).getMonth() + 1
  const totals = totalsOf(recent, months)
  const balance = totals.income - totals.expenses
  const perMonth = Math.round(balance / totals.months)

  return (
    <Sheet title="Analysen" onBack={pop} action={<Icon name="settings" size={20} />}>
      <div className="analysis">
        <div className="analysis__top">
          <button className="pill-select" style={{ width: 'auto', margin: '0 auto', padding: '0 24px' }}>
            Zusammengefasst
            <Icon name="chevronDown" size={16} />
          </button>

          <Slot name="analysis.aboveDonut" />

          <div className="analysis__ring">
            <DoubleRing totals={totals} />
            <div className="analysis__center">
              <div className="analysis__period">Jan. – Aug. {TODAY.slice(0, 4)}</div>
              <div className="analysis__balance num">
                <span style={{ fontWeight: 400 }}>CHF </span>
                {formatAmount(balance)}
              </div>
              <div className="analysis__period">Durchschnitt pro Monat</div>
              <div className="analysis__avg num">
                <span style={{ fontWeight: 400 }}>CHF </span>
                {formatAmount(perMonth)}
              </div>
            </div>
          </div>

          <CircleRow
            actions={[
              { icon: 'search', label: 'Suchen', outline: true, onClick: () => push({ name: 'search' }) },
              { icon: 'co2', label: 'CO₂ Fussabdruck', outline: true },
            ]}
          />
        </div>

        <div className="analysis__bottom">
          <div className="legend">
            <span className="legend__dot" style={{ background: 'var(--hellblau5)' }} />
            <span className="legend__main">
              <span className="legend__title">Einnahmen</span>
              <span className="legend__sub">{totals.incomeCount} Transaktionen</span>
            </span>
            <span className="legend__amount num">
              <span className="legend__cur">CHF</span> {formatAmount(totals.income, { sign: false })}
            </span>
          </div>

          <div className="legend">
            <span className="legend__dot" style={{ background: 'var(--petrol9)' }} />
            <span className="legend__main">
              <span className="legend__title">Ausgaben</span>
              <span className="legend__sub">{totals.expenseCount} Transaktionen</span>
            </span>
            <span className="legend__amount num">
              <span className="legend__cur">CHF</span> {formatAmount(totals.expenses, { sign: false })}
            </span>
          </div>

          <button className="listrow">
            <span className="listrow__icon"><Icon name="document" size={24} accent /></span>
            <span>
              <span className="listrow__title">Keine aktiven Budgets</span>
              <span className="listrow__sub">
                Budgets erfassen, um Ausgaben in Bezug auf Kategorien oder Labels nachzuverfolgen.
              </span>
            </span>
          </button>

          <button className="listrow" onClick={() => push({ name: 'subscriptions' })}>
            <span className="listrow__icon"><Icon name="calendar" size={24} accent /></span>
            <span>
              <span className="listrow__title">Meine Abos</span>
              <span className="listrow__sub">Wiederkehrende Transaktionen erkunden</span>
            </span>
          </button>

          <Slot name="analysis.belowLegend" />
        </div>
      </div>
    </Sheet>
  )
}

