import type { Persona } from '../data/types'
import { SessionProvider, useSession, type Screen, type Tab } from './session'
import { Icon, type IconName } from './shell/Icon'
import { AccountDetail } from './screens/AccountDetail'
import { Analysis } from './screens/Analysis'
import { Pay, Scan, Search, Transfer } from './screens/Flows'
import { Home } from './screens/Home'
import { Invest } from './screens/Invest'
import { Offers } from './screens/Offers'
import { Payments } from './screens/Payments'
import { Subscriptions } from './screens/Subscriptions'
import { TransactionDetail } from './screens/TransactionDetail'
import { Services } from './screens/Services'

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

/** Der oberste Bildschirm des Stacks liegt über den Tabs. */
function CurrentSheet() {
  const { stack } = useSession()
  const top = stack[stack.length - 1]
  if (!top) return null
  switch (top.name) {
    case 'account': return <AccountDetail accountId={top.accountId} />
    case 'analysis': return <Analysis />
    case 'scan': return <Scan />
    case 'pay': return <Pay />
    case 'transfer': return <Transfer />
    case 'search': return <Search />
    case 'subscriptions': return <Subscriptions />
    case 'transaction': return <TransactionDetail transactionId={top.transactionId} />
  }
}

function Screen() {
  const { theme } = useSession()
  return (
    <div className="phone__screen" data-theme={theme}>
      <span className="phone__notch" />
      <CurrentTab />
      <CurrentSheet />
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
