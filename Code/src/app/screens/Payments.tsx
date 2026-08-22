import { formatDate } from '../../lib/date'
import { formatMoney } from '../../lib/money'
import { useSession } from '../session'
import { Slot } from '../shell/Slot'
import { Card, CircleRow, Row, TopBar } from '../shell/parts'

/**
 * Zahlungen — Tab 2.
 * Vorlage: PREP/03_Screens_and_Assets/playstore_android/postfinance_app/04.png
 */
export function Payments() {
  const { persona, push, toggleTheme, theme } = useSession()

  return (
    <div className="screen screen--tinted">
      <TopBar onSearch={() => push({ name: 'search' })} onToggleTheme={toggleTheme} theme={theme} />
      <h1 className="screen__title">Zahlungen</h1>

      <CircleRow
        actions={[
          { icon: 'scan', label: 'Scannen', primary: true, onClick: () => push({ name: 'scan' }) },
          { icon: 'pay', label: 'Zahlen', onClick: () => push({ name: 'pay' }) },
          { icon: 'transfer', label: 'Übertragen', onClick: () => push({ name: 'transfer' }) },
          { icon: 'settings', label: 'Einstellungen' },
        ]}
      />

      <div className="screen__inner">
        <Slot name="payments.top" />

        <Card title="eBill">
          <div className="card__body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: '50%', background: 'var(--hellblau3)', color: 'var(--weiss)', fontSize: 12, fontWeight: 700, flex: 'none' }}>
                eBill
              </span>
              <span style={{ fontSize: 15, color: 'var(--text-body)' }}>
                Rechnungen elektronisch erhalten und bezahlen.
              </span>
            </div>
            <button className="soft-button">eBill aktivieren</button>
          </div>
        </Card>

        <Card title="Pendente Aufträge">
          {persona.pendingOrders.length === 0 ? (
            <p className="empty">Keine pendenten Aufträge.</p>
          ) : (
            persona.pendingOrders.map((order) => (
              <Row
                key={order.id}
                icon="billPending"
                title={order.recipient}
                sub={`Ausführung ${formatDate(order.execution)}`}
                amount={formatMoney(order.amount, order.currency, { sign: false })}
              />
            ))
          )}
        </Card>

        <Card title="Daueraufträge">
          {persona.standingOrders.length === 0 ? (
            <p className="empty">Keine Daueraufträge.</p>
          ) : (
            persona.standingOrders.map((order) => (
              <Row
                key={order.id}
                icon="clock"
                title={order.recipient}
                sub={`Nächste Ausführung ${formatDate(order.nextExecution)}`}
                amount={formatMoney(order.amount, order.currency, { sign: false })}
              />
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
