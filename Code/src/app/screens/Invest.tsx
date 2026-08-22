import { formatMoney } from '../../lib/money'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Card, CircleRow, Row, SectionHead, TopBar } from '../shell/parts'

/**
 * Anlegen — Tab 3.
 * Vorlage: PREP/03_Screens_and_Assets/playstore_android/postfinance_app/05.png
 */
export function Invest() {
  const { persona, accountName, push, toggleTheme, theme } = useSession()
  const products = persona.accounts.filter(
    (account) => account.kind === 'custody' || account.kind === 'retirement3a',
  )
  const total = products.reduce((sum, account) => sum + account.balance, 0)

  return (
    <div className="screen screen--tinted">
      <TopBar onSearch={() => push({ name: 'search' })} onToggleTheme={toggleTheme} theme={theme} />
      <h1 className="screen__title">Anlegen und Vorsorgen</h1>

      <CircleRow
        actions={[
          { icon: 'discover', label: 'Entdecken', primary: true },
          { icon: 'globe', label: 'Marktübersicht' },
          { icon: 'calendar', label: 'Beratung' },
        ]}
      />

      <div className="screen__inner">
        {products.length > 0 && (
          <SectionHead title="Anlegen und Vorsorgen" value={formatMoney(total, 'CHF', { sign: false })} />
        )}
        {products.length === 0 ? (
          <Card>
            <div className="card__body" style={{ textAlign: 'center', paddingTop: 'var(--s-8)' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 96, height: 96, margin: '0 auto var(--s-6)', borderRadius: '50%', background: 'var(--surface-sunken)', color: 'var(--text-strong)' }}>
                <Icon name="invest" size={44} accent />
              </span>
              <p style={{ margin: '0 0 var(--s-3)', fontSize: 19, fontWeight: 700, color: 'var(--text-strong)' }}>
                Kein Anlage- oder Vorsorgeprodukt
              </p>
              <p style={{ margin: '0 0 var(--s-7)', fontSize: 16, lineHeight: 1.4, color: 'var(--text-body)' }}>
                Entdecken Sie die Anlage- und Vorsorgeprodukte von PostFinance
              </p>
              <button style={{ width: '100%', padding: '18px', borderRadius: 'var(--CornerRadius-R-100)', background: 'var(--action)', color: 'var(--action-ink)', fontSize: 17, textAlign: 'center' }}>
                Produkte entdecken
              </button>
            </div>
          </Card>
        ) : (
          <Card>
            {products.map((account) => (
              <Row
                key={account.id}
                title={accountName(account)}
                sub={account.source.type === 'external' ? account.source.bank : account.iban}
                amount={formatMoney(account.balance, account.currency)}
                chevron
              />
            ))}
          </Card>
        )}

        <SectionHead title="Fonds-Self-Service" />
        <Card>
          <Row title="Fondssparplan eröffnen" sub="Ab CHF 20 pro Monat" chevron />
          <Row title="Vorsorgefonds 3a" sub="Steuern sparen, langfristig anlegen" chevron />
          <Row title="E-Trading" sub="Selbst handeln" chevron />
        </Card>
      </div>
    </div>
  )
}
