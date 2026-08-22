import { useMemo } from 'react'
import type { Account } from '../../data/types'
import { TODAY } from '../../data/types'
import { formatDayHeading } from '../../lib/date'
import { formatAmount, formatMoney } from '../../lib/money'
import { Icon } from '../../app/shell/Icon'
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
    <button className="balance-card" onClick={onOpen}>
      <span className="balance-card__head">
        <span className="balance-card__line">
          <span className="balance-card__name">{account.name}</span>
          <span className="balance-card__now num">
            {formatMoney(account.balance, account.currency)}
          </span>
        </span>
        <span className="balance-card__iban">{account.iban}</span>
      </span>

      <BalanceChart timeline={timeline} />

      <span className={'balance-card__verdict' + (critical ? ' is-critical' : tight ? ' is-tight' : '')}>
        <Icon name={critical ? 'bell' : 'analysis'} size={16} />
        <span>
          Tiefster Stand <strong className="num">{formatAmount(low.balance, { sign: false })}</strong>{' '}
          am {formatDayHeading(low.date, TODAY).replace(/ \d{4}$/, '')}
          {count > 0 && ` · ${count} ${count === 1 ? 'Zahlung' : 'Zahlungen'} vorher`}
        </span>
      </span>

      <span className="balance-card__rows">
        {nextIncome && (
          <span className="balance-card__row">
            <span className="balance-card__dot" style={{ background: 'var(--info2)' }} />
            <span className="balance-card__label">
              Nächster Eingang · {formatDayHeading(nextIncome.date, TODAY).replace(/ \d{4}$/, '')}
            </span>
            <span className="balance-card__value num" style={{ color: 'var(--text-credit)' }}>
              {formatAmount(nextIncome.amount)}
            </span>
          </span>
        )}
        {count > 0 && (
          <span className="balance-card__row">
            <span className="balance-card__dot" style={{ background: 'var(--postfinancegelb)' }} />
            <span className="balance-card__label">
              Geplant bis dahin · {count} {count === 1 ? 'Zahlung' : 'Zahlungen'}
            </span>
            <span className="balance-card__value num">{formatAmount(plannedSum)}</span>
          </span>
        )}
      </span>
    </button>
  )
}
