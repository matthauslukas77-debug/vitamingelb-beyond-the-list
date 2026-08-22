import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account, PendingOrder, Persona, StandingOrder, Transaction } from '../data/types'
import type { BreakdownDirection } from '../domain/breakdown'
import { sortByDateDesc } from '../data/generate'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings, type SettingsSection } from './settings'

/** Die fünf Tabs der v6-Navigation. */
export type Tab = 'home' | 'payments' | 'invest' | 'offers' | 'services'

/**
 * Die Ansichten des Cockpits. «analysis» ist der unveränderte Ist-Zustand —
 * derselbe Doppelring, dieselben Zahlen, als Vergleichsansicht neben unserer.
 */
export type CockpitView = 'budget' | 'analysis' | 'recurring'

/**
 * Bildschirme, die über den Tabs liegen (Push-Navigation wie in der App).
 * Bewusst ein kleiner eigener Stack statt eines Routers: kein zusätzliches
 * Paket, und Vor/Zurück verhält sich wie nativ.
 */

export type Screen =
  | { name: 'account'; accountId: string }
  /* Hiess «analysis», solange der Bildschirm nur die Analysen der App war.
     Jetzt ist er das Dach über Budget, Analyse und wiederkehrenden Buchungen —
     alte Demo-Links auf `?screen=analysis` funktionieren weiter. */
  | { name: 'cockpit'; view?: CockpitView }
  /* Der Budget-Wizard. Eigener Bildschirm, weil er einen eigenen Stapel hat:
     «Zurück» geht im Wizard einen Schritt zurück, nicht aus ihm heraus. */
  | { name: 'budgetWizard' }
  /* Signale — was sich verändert hat. Das Gegenstück zum Cockpit: dort die
     Instrumente, hier die Leuchten. */
  | { name: 'signals' }
  /* Das Zuordnungsbrett. Eigener Bildschirm, weil er als einziger nicht
     scrollt: Quellen und Töpfe müssen gleichzeitig sichtbar sein. */
  | { name: 'assign' }
  | { name: 'scan' }
  /* `save` belegt den Zahlungsfluss vor — gesetzt von einer Signalkarte. */
  | { name: 'pay'; save?: number }
  | { name: 'transfer' }
  | { name: 'search' }
  | { name: 'recurring' }
  | { name: 'series'; seriesKey: string }
  | { name: 'transaction'; transactionId: string }
  | { name: 'breakdown'; direction: BreakdownDirection }
  /* «Profil und Einstellungen» aus dem Services-Reiter und die neun
     Unterseiten daraus — Vorlage IMG_5013. */
  | { name: 'settings' }
  | { name: 'settingsSection'; section: SettingsSection }

/**
 * Dauer des Bildschirmwechsels. Muss zu `--sheet-ms` in `shell/shell.css`
 * passen: Die Animation läuft dort, hier wird nur so lange gewartet, bis der
 * zurückgehende Bildschirm abgeräumt werden darf.
 */
export const SHEET_MS = 420

export type Theme = 'light' | 'dark'

interface Session {
  persona: Persona
  tab: Tab
  stack: Screen[]
  /** Der Bildschirm, der gerade nach rechts hinausgleitet. */
  leaving: Screen | null
  theme: Theme
  setTab: (tab: Tab) => void
  push: (screen: Screen) => void
  pop: () => void
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  leave: () => void
  /** Was unter «Profil und Einstellungen» gesetzt wurde. */
  settings: Settings
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
  /**
   * Bezeichnung eines Kontos — die eigene aus den Einstellungen, sonst die der
   * Bank. Jede Liste, die einen Kontonamen zeigt, geht darüber.
   */
  accountName: (account: Account) => string
  /** Konten nach der Gruppierung der App: «Konten» und «Weitere Produkte». */
  accountGroups: { title: string; accounts: Account[] }[]
  transactionsFor: (accountId: string) => Transaction[]
  totalChf: number
  /**
   * Pendente Aufträge und Daueraufträge — die der Persona plus die, die im
   * Zahlungsfluss erfasst wurden. Jede Liste und jede Prognose liest sie hier,
   * nicht direkt an der Persona: Eine gerade ausgelöste Zahlung soll sofort im
   * Zahlungen-Reiter und im Verlauf auf Home stehen.
   */
  pendingOrders: PendingOrder[]
  standingOrders: StandingOrder[]
  /** Einen im Fluss erfassten Auftrag übernehmen. */
  addOrder: (order: { pending: PendingOrder } | { standing: StandingOrder }) => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({
  persona,
  initialTab = 'home',
  initialScreen,
  onLeave,
  children,
}: {
  persona: Persona
  /** Startreiter aus der URL. */
  initialTab?: Tab
  /** Startbildschirm aus der URL — die App öffnet direkt dort. */
  initialScreen?: Screen
  onLeave: () => void
  children: ReactNode
}) {
  const [tab, setTabState] = useState<Tab>(initialTab)
  const [stack, setStack] = useState<Screen[]>(initialScreen ? [initialScreen] : [])
  const [theme, setTheme] = useState<Theme>('light')
  /* Der Anbieter lebt genau so lange wie die Sitzung einer Persona — beim
     Wechsel läuft die App über den Auswahlbildschirm, der ihn abbaut. Deshalb
     genügt es, die Einstellungen beim Aufbau einmal zu lesen. */
  const [settings, setSettings] = useState<Settings>(() => loadSettings(persona.id))
  /* Was im Zahlungsfluss dazukommt. Bewusst nur im Speicher: Ein Neuladen
     stellt den Demo-Zustand wieder her. */
  const [ownPending, setOwnPending] = useState<PendingOrder[]>([])
  const [ownStanding, setOwnStanding] = useState<StandingOrder[]>([])

  /**
   * Der Bildschirm, der gerade zurückgeht. Er bleibt für die Dauer der
   * Rückwärtsanimation gemountet — sonst verschwände er beim Klick auf «Zurück»
   * ohne Übergang, statt nach rechts hinauszugleiten.
   */
  const [leaving, setLeaving] = useState<Screen | null>(null)

  const setTab = useCallback((next: Tab) => {
    /* Ein Reiterwechsel ist kein «Zurück»: Der Stapel fällt weg, ohne dass
       etwas hinausgleitet. */
    setStack([])
    setLeaving(null)
    setTabState(next)
  }, [])

  const push = useCallback((screen: Screen) => setStack((s) => [...s, screen]), [])

  /* Liest den Stapel aus dem Abschluss statt aus der Aktualisierungsfunktion:
     So lässt sich der oberste Bildschirm im selben Zug als «geht zurück»
     merken, ohne einen Nebeneffekt in den Zustandsreduzierer zu legen. */
  const pop = useCallback(() => {
    if (stack.length === 0) return
    setLeaving(stack[stack.length - 1])
    setStack(stack.slice(0, -1))
  }, [stack])

  /* Nach der Animation abräumen. Ohne das bliebe der Bildschirm für immer
     gemountet und finge unter der Oberfläche weiter Klicks ab. */
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => setLeaving(null), SHEET_MS)
    return () => window.clearTimeout(timer)
  }, [leaving])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((current) => ({ ...current, [key]: value })),
    [],
  )
  const resetSettings = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  const addOrder = useCallback(
    (order: { pending: PendingOrder } | { standing: StandingOrder }) => {
      if ('pending' in order) setOwnPending((list) => [...list, order.pending])
      else setOwnStanding((list) => [...list, order.standing])
    },
    [],
  )

  /* Gesetzte Einstellungen überleben das Neuladen — in der Demo stellt jemand
     etwas um und läuft danach durch die App. */
  useEffect(() => saveSettings(persona.id, settings), [persona.id, settings])

  /* Das Thema auch am Dokument setzen: So stimmen der Hintergrund hinter der
     App und die Farbe der iOS-Statusleiste, wenn die App vom Home-Bildschirm
     läuft. */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#00292E' : '#E4F2F2')
    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  const value = useMemo<Session>(() => {
    const own = persona.accounts.filter((a) => !a.furtherProduct)
    const further = persona.accounts.filter((a) => a.furtherProduct)
    const groups = [{ title: 'Konten', accounts: own }]
    if (further.length > 0) groups.push({ title: 'Weitere Produkte', accounts: further })

    return {
      persona,
      tab,
      stack,
      leaving,
      theme,
      setTab,
      push,
      pop,
      toggleTheme,
      setTheme,
      leave: onLeave,
      settings,
      setSetting,
      resetSettings,
      accountName: (account) => settings.accountLabels[account.id]?.trim() || account.name,
      accountGroups: groups,
      transactionsFor: (accountId) =>
        sortByDateDesc(persona.transactions.filter((tx) => tx.accountId === accountId)),
      totalChf: own.reduce((total, a) => total + (a.balanceChf ?? a.balance), 0),
      pendingOrders: [...persona.pendingOrders, ...ownPending].sort((a, b) =>
        a.execution.localeCompare(b.execution),
      ),
      standingOrders: [...persona.standingOrders, ...ownStanding].sort((a, b) =>
        a.nextExecution.localeCompare(b.nextExecution),
      ),
      addOrder,
    }
  }, [persona, tab, stack, leaving, theme, setTab, push, pop, toggleTheme, onLeave, settings, setSetting, resetSettings, ownPending, ownStanding, addOrder])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession muss innerhalb von <SessionProvider> stehen')
  return session
}
