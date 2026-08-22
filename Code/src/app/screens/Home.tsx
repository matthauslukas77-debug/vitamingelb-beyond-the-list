import { formatMoney } from '../../lib/money'
import { useSession } from '../session'
import { Icon } from '../shell/Icon'
import { Slot } from '../shell/Slot'
import { Card, CircleRow, Row, SectionHead, TopBar } from '../shell/parts'

/**
 * Home — Tab 1.
 * Vorlage: PREP/07_screenshots/IMG_1674.PNG (echter Screenshot, v6)
 */
export function Home() {
  const { accountGroups, totalChf, push, toggleTheme, theme } = useSession()

  return (
    <div className="screen screen--tinted">
      <TopBar onSearch={() => push({ name: 'search' })} onToggleTheme={toggleTheme} theme={theme} />
      <h1 className="screen__title">Home</h1>

      <CircleRow
        actions={[
          { icon: 'scan', label: 'Scannen', primary: true, onClick: () => push({ name: 'scan' }) },
          { icon: 'pay', label: 'Zahlen', onClick: () => push({ name: 'pay' }) },
          { icon: 'transfer', label: 'Übertragen', onClick: () => push({ name: 'transfer' }) },
          { icon: 'analysis', label: 'Analysen', onClick: () => push({ name: 'analysis' }) },
        ]}
      />

      <div className="screen__inner">
        <Slot name="home.aboveAccounts" />

        {accountGroups.map((group, index) => (
          <div key={group.title}>
            <SectionHead
              title={index === 0 ? 'Konten und Depots' : group.title}
              value={index === 0 ? formatMoney(totalChf, 'CHF') : undefined}
            />
            {group.accounts.map((account) => (
              <div className="account-slot" key={account.id}>
              <Slot
                name="home.accountRow"
                account={account}
                onOpen={() => push({ name: 'account', accountId: account.id })}
                fallback={
                  <Card>
                    <Row
                      icon="accountPerson"
                      iconAccent
                      title={account.name}
                      sub={account.iban}
                      badge={account.source.type === 'external' ? account.source.bank : undefined}
                      amount={formatMoney(account.balance, account.currency)}
                      onClick={() => push({ name: 'account', accountId: account.id })}
                    />
                  </Card>
                }
              />
              </div>
            ))}
          </div>
        ))}

        <div style={{ display: 'grid', placeItems: 'center', paddingTop: 'var(--s-7)' }}>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--s-4)',
              padding: '16px 32px',
              borderRadius: 'var(--CornerRadius-R-100)',
              background: 'var(--surface-card)',
              color: 'var(--text-strong)',
              fontSize: 16,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <Icon name="plus" size={22} />
            Produkt hinzufügen
          </button>
        </div>

        <Slot name="home.belowAccounts" />
      </div>
    </div>
  )
}
