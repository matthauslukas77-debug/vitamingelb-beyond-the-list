import type { Persona } from '../data/types'
import { SessionProvider, useSession, type Screen, type Tab } from './session'
import { Icon, type IconName } from './shell/Icon'
import { AccountDetail } from './screens/AccountDetail'
import { Breakdown } from './screens/Breakdown'
import { Scan, Transfer } from './screens/Flows'
import { Pay } from './screens/payment/PaymentFlow'
import { Home } from './screens/Home'
import { Invest } from './screens/Invest'
import { Offers } from './screens/Offers'
import { Payments } from './screens/Payments'
import { Recurring } from './screens/Recurring'
import { BudgetWizard } from '../insights/budget/screens/Wizard'
import { Cockpit } from '../insights/screens/Cockpit'
import { Signals } from '../insights/screens/Signals'
import { Assign } from '../insights/budget/screens/Assign'
import { SeriesDetail } from '../insights/screens/SeriesDetail'
import { TransactionDetail } from './screens/TransactionDetail'
import { Services } from './screens/Services'
import { ProfileSettings, SettingsSectionScreen } from './screens/Settings'
import { SearchScreen } from './search/SearchScreen'

const TABS: { id: Tab; label: string; icon: IconName; dot?: boolean }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'payments', label: 'Zahlungen', icon: 'payments' },
  { id: 'invest', label: 'Anlegen', icon: 'invest' },
  { id: 'offers', label: 'Angebote', icon: 'offers' },
  { id: 'services', label: 'Services', icon: 'services', dot: true },
]

function TabBar() {
  const { tab, setTab } = useSession()
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {TABS.map((entry) => (
        <button
          key={entry.id}
          className="tab"
          aria-current={tab === entry.id ? 'page' : undefined}
          onClick={() => setTab(entry.id)}
        >
          <span className="tab__disc">
            <Icon
              name={entry.icon}
              size={26}
              accent={entry.id === 'invest'}
              filled={tab === entry.id}
            />
            {entry.dot && <span className="tab__dot" />}
          </span>
          <span className="tab__label">{entry.label}</span>
        </button>
      ))}
    </nav>
  )
}

function CurrentTab() {
  const { tab } = useSession()
  switch (tab) {
    case 'home': return <Home />
    case 'payments': return <Payments />
    case 'invest': return <Invest />
    case 'offers': return <Offers />
    case 'services': return <Services />
  }
}

/**
 * Ein Bildschirm des Stapels. Die Zuordnung Name → Komponente steht nur hier;
 * neue Bildschirme kommen als weiterer Fall dazu.
 */
function screenFor(screen: Screen) {
  switch (screen.name) {
    case 'account': return <AccountDetail accountId={screen.accountId} />
    case 'cockpit': return <Cockpit view={screen.view} />
    case 'budgetWizard': return <BudgetWizard />
    case 'signals': return <Signals />
    case 'assign': return <Assign />
    case 'scan': return <Scan />
    case 'pay': return <Pay save={screen.save} />
    case 'transfer': return <Transfer />
    case 'search': return <SearchScreen />
    case 'recurring': return <Recurring />
    case 'series': return <SeriesDetail seriesKey={screen.seriesKey} />
    case 'transaction': return <TransactionDetail transactionId={screen.transactionId} />
    case 'breakdown': return <Breakdown direction={screen.direction} />
    case 'settings': return <ProfileSettings />
    case 'settingsSection': return <SettingsSectionScreen section={screen.section} />
  }
}

/**
 * Alle Bildschirme des Stapels als Ebenen übereinander — nicht nur der oberste.
 *
 * Vorher war nur der oberste gemountet. Ein Klick hat den bisherigen Bildschirm
 * dann ausgehängt und den neuen eingehängt: Es schob sich nichts über etwas,
 * es wurde getauscht. Bei zwei ähnlich gebauten Bildschirmen — Analysen und
 * Ausgaben haben beide Pille, grossen Ring und weisse Fläche — liest das Auge
 * das nicht als Seitenwechsel, sondern als Zucken: Der Ring ändert seine
 * Grösse, die weisse Kante springt.
 *
 * Jetzt bleibt die darunterliegende Ebene stehen, und die neue gleitet vom
 * rechten Rand darüber. Das ist zugleich das Verhalten, das der Rahmen
 * imitiert: eine Push-Navigation wie in der echten App.
 */
function Sheets() {
  const { stack, leaving } = useSession()
  if (stack.length === 0 && !leaving) return null

  return (
    <>
      {stack.map((screen, index) => (
        <div
          /* Der Index als Schlüssel ist hier richtig: Beim Zurückgehen
             schrumpft der Stapel von hinten, die verbleibenden Ebenen behalten
             ihren Index und werden deshalb nicht neu aufgebaut. */
          key={index}
          className={'layer' + (index < stack.length - 1 ? ' layer--under' : '')}
          style={{ zIndex: 10 + index }}
          /* `inert` statt `aria-hidden`: Es nimmt die Ebene zugleich aus dem
             Fokuszug und aus dem Barrierefreiheitsbaum. Mit `aria-hidden`
             allein blieben die Knöpfe darunter per Tabulator erreichbar —
             man landet auf etwas, das man nicht sieht. */
          inert={index < stack.length - 1 || undefined}
        >
          {screenFor(screen)}
        </div>
      ))}
      {leaving && (
        <div className="layer layer--leaving" style={{ zIndex: 10 + stack.length }} inert>
          {screenFor(leaving)}
        </div>
      )}
    </>
  )
}

function Screen() {
  const { theme, stack } = useSession()
  return (
    /* `--pushed`, solange ein Blatt darüberliegt: Dann weicht der Reiterinhalt
       um die halbe Breite nach links aus, wie in der echten App. Beim
       Zurückgehen fällt die Klasse weg und er gleitet zurück — das erledigt
       das `transition` in `shell.css`. */
    <div className={'phone__screen' + (stack.length > 0 ? ' phone__screen--pushed' : '')} data-theme={theme}>
      <span className="phone__notch" />
      <CurrentTab />
      <Sheets />
      <TabBar />
    </div>
  )
}

/** Die App einer Persona, im Telefonrahmen. */
export function AppShell({
  persona,
  initialTab,
  initialScreen,
  onLeave,
}: {
  persona: Persona
  initialTab?: Tab
  initialScreen?: Screen
  onLeave: () => void
}) {
  return (
    <SessionProvider
      persona={persona}
      initialTab={initialTab}
      initialScreen={initialScreen}
      onLeave={onLeave}
    >
      <div className="stage">
        <div className="phone">
          <Screen />
        </div>
      </div>
    </SessionProvider>
  )
}
