import { groupByDay } from '../../data/generate'
import { TODAY, type Transaction } from '../../data/types'
import { formatDate, formatDayHeading } from '../../lib/date'
import { formatAmount, sum } from '../../lib/money'
import { useSession } from '../session'
import { BrandAvatar } from '../shell/BrandAvatar'
import { Icon, type IconName } from '../shell/Icon'
import { Slot } from '../shell/Slot'
import { CircleRow } from '../shell/parts'

/** Symbol pro Kategorie, wie die getönten Kreise in der Vorlage. */
const CATEGORY_ICONS: Partial<Record<Transaction['category'], IconName>> = {
  transfer: 'transfer',
  subscriptions: 'clock',
  cash: 'card',
  shopping: 'offers',
  groceries: 'offers',
  transport: 'payments',
  housing: 'home',
  health: 'support',
  insurance: 'document',
  taxes: 'document',
  leisure: 'invest',
  eatingOut: 'card',
}

function iconFor(tx: Transaction): IconName {
  if (tx.amount > 0) return 'billPending'
  return CATEGORY_ICONS[tx.category] ?? 'payments'
}

/**
 * Kontodetail — der Bildschirm, den die Challenge meint, wenn sie von
 * «Transaktionslisten» spricht.
 * Vorlage: PREP/03_Screens_and_Assets/appstore_ios/de_PFApp_Screen2_Overview.png
 */
export function AccountDetail({ accountId }: { accountId: string }) {
  const { persona, transactionsFor, accountName, pendingOrders, pop, push } = useSession()
  const account = persona.accounts.find((a) => a.id === accountId)
  if (!account) return null

  const transactions = transactionsFor(accountId)
  const pending = pendingOrders.filter((order) => order.accountId === accountId)
  const days = groupByDay(transactions).slice(0, 40)

  return (
    <div className="sheet">
      <div className="sheet__topbar">
        <button className="sheet__back" onClick={pop} aria-label="Zurück">
          <Icon name="chevronLeft" size={22} />
        </button>
        <button className="sheet__grabber" onClick={pop} aria-label="Schliessen">
          <Icon name="chevronDown" size={22} />
        </button>
      </div>

      <div className="screen">
        <div className="screen__inner account-header">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '4px 0 20px' }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-strong)' }}>
              {accountName(account)}
            </h1>
            <span className="num" style={{ fontSize: 24, color: 'var(--text-strong)' }}>
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{account.currency} </span>
              {formatAmount(account.balance)}
            </span>
          </div>
        </div>

        <CircleRow
          actions={[
            { icon: 'transfer', label: 'Zahlungen', primary: true, onClick: () => push({ name: 'pay' }) },
            { icon: 'search', label: 'Suchen', outline: true, onClick: () => push({ name: 'search' }) },
            { icon: 'more', label: 'Details', outline: true },
          ]}
        />

        <div className="screen__inner">
          <Slot name="account.belowHeader" />

          {pending.length > 0 && (
            <div style={{ background: 'var(--surface-sunken)', borderRadius: 'var(--CornerRadius-R-20)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>
                  Pendente Aufträge anzeigen
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Bis zum {formatDate(pending[pending.length - 1].execution)}
                </span>
              </span>
              <span className="num" style={{ fontSize: 15, color: 'var(--text-strong)' }}>
                {formatAmount(sum(pending.map((order) => order.amount)), { sign: false })}
              </span>
            </div>
          )}

          <Slot name="account.aboveTransactions" />

          {days.map((day) => (
            <div key={day.date}>
              <div className="day-head">{formatDayHeading(day.date, TODAY)}</div>
              <div className="tx-list">
                {day.items.map((tx) => (
                  <button
                    className="tx"
                    key={tx.id}
                    onClick={() => push({ name: 'transaction', transactionId: tx.id })}
                  >
                    <BrandAvatar tx={tx} fallbackIcon={iconFor(tx)} />
                    <span className="tx__main">
                      <span className="tx__text">{tx.text}</span>
                    </span>
                    <span className={'tx__amount num' + (tx.amount > 0 ? ' tx__amount--credit' : '')}>
                      {formatAmount(tx.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
