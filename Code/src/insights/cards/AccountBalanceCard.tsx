import { useMemo, useState } from 'react'
import type { Account } from '../../data/types'
import { TODAY } from '../../data/types'
import { formatDayHeading } from '../../lib/date'
import { formatAmount, formatMoney } from '../../lib/money'
import type { useSession } from '../../app/session'
import { buildTimeline } from '../engine/balance'
import { BalanceChart, type ChartTone } from '../charts/BalanceChart'

/**
 * Zeitfenster für den Verlauf. Die Chip-Reihe gibt es in der App bereits —
 * auf dem Krypto-Bildschirm als `24H 1W 1M 3M 1Y YTD Max`.
 */
const RANGES = [
  { key: '1M', days: 31 },
  { key: '3M', days: 92 },
  { key: '6M', days: 183 },
  { key: '1J', days: 366 },
  { key: 'Max', days: 760 },
] as const

/**
 * Die Kontokarte auf Home — statt einer Zeile mit einer Zahl.
 *
 * Sechs von sechs Interviewten öffnen die App, schauen den Saldo an und
 * schliessen sie wieder. Der Saldo sagt, wie viel übrig ist, nie warum.
 * Diese Karte beantwortet an derselben Stelle drei Fragen: Wo stehe ich,
 * wo geht es hin, und wann wird es knapp.
 */
export function AccountBalanceCard({
  account,
  session,
  onOpen,
}: {
  account: Account
  session: ReturnType<typeof useSession>
  onOpen: () => void
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3M')
  const historyDays = RANGES.find((entry) => entry.key === range)!.days

  const timeline = useMemo(
    () =>
      buildTimeline({
        account,
        transactions: session.persona.transactions,
        pendingOrders: session.pendingOrders,
        today: TODAY,
        historyDays,
      }),
    [account, session.persona, session.pendingOrders, historyDays],
  )

  // Sparen bekommt den blauen Ton, der Alltag den petrolfarbenen — so sind die
  // beiden Karten auf einen Blick auseinanderzuhalten.
  const tone: ChartTone = account.kind === 'savings' || account.kind === 'retirement3a'
    ? 'hellblau'
    : 'petrol'

  const { low, nextIncome, paymentsBeforeIncome } = timeline
  const critical = low.balance < 0
  const tight = !critical && low.balance < 50_000
  const plannedSum = paymentsBeforeIncome.reduce((total, event) => total + event.amount, 0)
  const count = paymentsBeforeIncome.length
  const isSaving = tone === 'hellblau'
  const growth = account.balance - timeline.history[0].balance

  return (
    <div className="balance-card">
      <button className="balance-card__head" onClick={onOpen}>
        <span className="balance-card__line">
          <span className="balance-card__name">{session.accountName(account)}</span>
          <span className="balance-card__now num">
            {formatMoney(account.balance, account.currency)}
          </span>
        </span>
        <span className="balance-card__iban">{account.iban}</span>
      </button>

      <BalanceChart timeline={timeline} tone={tone} id={account.id} />

      <span className="ranges">
        {RANGES.map((entry) => (
          <button
            key={entry.key}
            className={'ranges__chip' + (entry.key === range ? ' is-active' : '')}
            onClick={() => setRange(entry.key)}
          >
            {entry.key}
          </button>
        ))}
      </span>

      <span className={'liquidity' + (isSaving ? '' : critical ? ' is-critical' : tight ? ' is-tight' : '')}>
        {isSaving ? (
          <span className="liquidity__cell">
            <span className="liquidity__label">Zuwachs im Zeitraum</span>
            <span className="liquidity__value num" style={{ color: growth >= 0 ? 'var(--text-credit)' : undefined }}>
              {formatAmount(growth)}
            </span>
            <span className="liquidity__when">seit {formatDayHeading(timeline.history[0].date, TODAY).replace(/ \d{4}$/, '')}</span>
          </span>
        ) : (
        <span className="liquidity__cell">
          <span className="liquidity__label">Tiefster Stand</span>
          <span className="liquidity__value num">{formatAmount(low.balance, { sign: false })}</span>
          <span className="liquidity__when">
            {formatDayHeading(low.date, TODAY).replace(/ \d{4}$/, '')}
            {count > 0 && ` · nach ${count} ${count === 1 ? 'Zahlung' : 'Zahlungen'}`}
          </span>
        </span>
        )}

        {nextIncome && (
          <span className="liquidity__cell">
            <span className="liquidity__label">{isSaving ? 'Nächste Einzahlung' : 'Nächster Eingang'}</span>
            <span className="liquidity__value num" style={{ color: 'var(--text-credit)' }}>
              {formatAmount(nextIncome.amount)}
            </span>
            <span className="liquidity__when">
              {formatDayHeading(nextIncome.date, TODAY).replace(/ \d{4}$/, '')}
              {count > 0 && ` · ${formatAmount(plannedSum, { sign: false })} vorher`}
            </span>
          </span>
        )}
      </span>
    </div>
  )
}
