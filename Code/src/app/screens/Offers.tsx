import { useSession } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { Card, Row, SectionHead, TopBar } from '../shell/parts'

/**
 * Angebote — Tab 4. Statt Kreisreihe ein 2×3-Raster.
 * Vorlage: PREP/03_Screens_and_Assets/playstore_android/postfinance_app/06.png
 */
const PRODUCTS: { icon: IconName; label: string }[] = [
  { icon: 'card', label: 'Kreditkarte' },
  { icon: 'invest', label: 'Anlegen' },
  { icon: 'home', label: 'Hypothek' },
  { icon: 'person', label: 'Vorsorge 3a' },
  { icon: 'payments', label: 'Konto eröffnen' },
  { icon: 'support', label: 'Beratung' },
]

const VOUCHERS = ['Coop', 'Disney+', 'Zalando', 'SBB']

export function Offers() {
  const { push, toggleTheme, theme } = useSession()

  return (
    <div className="screen screen--tinted">
      <TopBar onSearch={() => push({ name: 'search' })} onToggleTheme={toggleTheme} theme={theme} />
      <h1 className="screen__title">Angebote</h1>

      <div className="screen__inner">
        <Card title="Produkte hinzufügen">
          <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {PRODUCTS.map((product) => (
              <button
                key={product.label}
                style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '16px 4px', borderRadius: 'var(--CornerRadius-R-16)', background: 'var(--surface-sunken)', color: 'var(--text-strong)' }}
              >
                <Icon name={product.icon} size={26} accent />
                <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>{product.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 0 var(--s-6)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--petrol6)' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--grau5)' }} />
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: 'var(--s-6) var(--s-6) var(--s-2)' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' }}>
              Gutschein kaufen und verschenken
            </span>
            <span style={{ fontSize: 14, color: 'var(--text-strong)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Alle anzeigen
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: 'var(--s-4) var(--s-6) var(--s-6)' }}>
            {VOUCHERS.map((voucher) => (
              <div
                key={voucher}
                style={{ flex: 'none', width: 148, height: 92, borderRadius: 'var(--CornerRadius-R-16)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}
              >
                {voucher}
              </div>
            ))}
          </div>
        </Card>

        <SectionHead title="Für dich" />
        <Card>
          <Row title="Prepaid-Guthaben aufladen" sub="Handy sofort aufladen" chevron />
          <Row title="PostFinance Pay" sub="Online bezahlen ohne Kartennummer" chevron />
        </Card>
      </div>
    </div>
  )
}
