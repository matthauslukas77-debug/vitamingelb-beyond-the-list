import { useSession, type Screen } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { TopBar } from '../shell/parts'

/**
 * Services — Tab 5. Schlichte Liste: Symbol, fette Bezeichnung, sonst nichts.
 * Keine getönten Kreise, keine Pfeile, keine Trennlinien.
 * Vorlage: PREP/07_screenshots/IMG_1679.PNG
 */
const ENTRIES: { icon: IconName; label: string; dot?: boolean; open?: Screen }[] = [
  { icon: 'card', label: 'Karten' },
  /* Die Benachrichtigungen sind zugleich eine der neun Unterseiten von
     «Profil und Einstellungen» — beide Wege führen auf denselben Bildschirm. */
  { icon: 'bell', label: 'Benachrichtigungen', dot: true, open: { name: 'settingsSection', section: 'notifications' } },
  { icon: 'document', label: 'Dokumente' },
  { icon: 'settings', label: 'Profil und Einstellungen', open: { name: 'settings' } },
  { icon: 'support', label: 'Kontakt und Support' },
]

function ServiceRow({ icon, label, dot, onClick }: {
  icon: IconName
  label: string
  dot?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-6)',
        width: '100%',
        padding: '22px var(--s-6)',
        color: 'var(--text-strong)',
      }}
    >
      <span style={{ position: 'relative', display: 'grid', placeItems: 'center', flex: 'none' }}>
        <Icon name={icon} size={26} />
        {dot && (
          <span style={{ position: 'absolute', top: -2, right: -3, width: 9, height: 9, borderRadius: '50%', background: 'var(--danger3)' }} />
        )}
      </span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

export function Services() {
  const { push, leave, toggleTheme, theme } = useSession()

  return (
    <div className="screen">
      <TopBar onSearch={() => push({ name: 'search' })} onToggleTheme={toggleTheme} theme={theme} />
      <h1 className="screen__title">Services</h1>

      <div className="screen__inner">
        <section className="card">
          {ENTRIES.map((entry) => (
            <ServiceRow
              key={entry.label}
              icon={entry.icon}
              label={entry.label}
              dot={entry.dot}
              onClick={entry.open ? () => push(entry.open!) : undefined}
            />
          ))}
        </section>

        <section className="card">
          <ServiceRow icon="logout" label="Logout" onClick={leave} />
        </section>

        <p className="empty" style={{ fontSize: 12 }}>
          Prototyp · BärnHäckt 2026 · Daten sind erfunden
        </p>
      </div>
    </div>
  )
}
