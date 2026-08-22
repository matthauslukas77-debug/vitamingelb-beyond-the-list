import { useMemo } from 'react'
import type { Account } from '../../data/types'
import { TODAY } from '../../data/types'
import { formatDayHeading } from '../../lib/date'
import { formatAmount, formatMoney } from '../../lib/money'
import type { useSession } from '../../app/session'
import { buildTimeline } from '../engine/balance'
import { BalanceChart } from '../charts/BalanceChart'

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
  const timeline = useMemo(
    () =>
      buildTimeline({
        account,
        transactions: session.persona.transactions,
        pendingOrders: session.persona.pendingOrders,
        today: TODAY,
      }),
    [account, session.persona],
  )

  const { low, nextIncome, paymentsBeforeIncome } = timeline
  const critical = low.balance < 0
  const tight = !critical && low.balance < 50_000
  const plannedSum = paymentsBeforeIncome.reduce((total, event) => total + event.amount, 0)
  const count = paymentsBeforeIncome.length

  return (
    <div className="balance-card">
      <button className="balance-card__head" onClick={onOpen}>
        <span className="balance-card__line">
          <span className="balance-card__name">{account.name}</span>
          <span className="balance-card__now num">
            {formatMoney(account.balance, account.currency)}
          </span>
        </span>
        <span className="balance-card__iban">{account.iban}</span>
      </button>

      <BalanceChart timeline={timeline} />

      <span className={'liquidity' + (critical ? ' is-critical' : tight ? ' is-tight' : '')}>
        <span className="liquidity__cell">
          <span className="liquidity__label">Tiefster Stand</span>
          <span className="liquidity__value num">{formatAmount(low.balance, { sign: false })}</span>
          <span className="liquidity__when">
            {formatDayHeading(low.date, TODAY).replace(/ \d{4}$/, '')}
            {count > 0 && ` · nach ${count} ${count === 1 ? 'Zahlung' : 'Zahlungen'}`}
          </span>
        </span>

        {nextIncome && (
          <span className="liquidity__cell">
            <span className="liquidity__label">Nächster Eingang</span>
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
