import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Account, Persona, Transaction } from '../data/types'
import { sortByDateDesc } from '../data/generate'

/** Die fünf Tabs der v6-Navigation. */
export type Tab = 'home' | 'payments' | 'invest' | 'offers' | 'services'

/**
 * Bildschirme, die über den Tabs liegen (Push-Navigation wie in der App).
 * Bewusst ein kleiner eigener Stack statt eines Routers: kein zusätzliches
 * Paket, und Vor/Zurück verhält sich wie nativ.
 */
export type Screen =
  | { name: 'account'; accountId: string }
  | { name: 'analysis' }
  | { name: 'scan' }
  | { name: 'pay' }
  | { name: 'transfer' }
  | { name: 'search' }
  | { name: 'subscriptions' }
  | { name: 'transaction'; transactionId: string }

export type Theme = 'light' | 'dark'

interface Session {
  persona: Persona
  tab: Tab
  stack: Screen[]
  theme: Theme
  setTab: (tab: Tab) => void
  push: (screen: Screen) => void
  pop: () => void
  toggleTheme: () => void
  leave: () => void
  /** Konten nach der Gruppierung der App: «Konten» und «Weitere Produkte». */
  accountGroups: { title: string; accounts: Account[] }[]
  transactionsFor: (accountId: string) => Transaction[]
  totalChf: number
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

  const setTab = useCallback((next: Tab) => {
    setStack([])
    setTabState(next)
  }, [])

  const push = useCallback((screen: Screen) => setStack((s) => [...s, screen]), [])
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), [])
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), [])

  /* Das Thema auch am Dokument setzen: So stimmen der Hintergrund hinter der
     App und die Farbe der iOS-Statusleiste, wenn die App vom Home-Bildschirm
     läuft. */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'dark' ? '#00292E' : '#E9F3F2')
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
      theme,
      setTab,
      push,
      pop,
      toggleTheme,
      leave: onLeave,
      accountGroups: groups,
      transactionsFor: (accountId) =>
        sortByDateDesc(persona.transactions.filter((tx) => tx.accountId === accountId)),
      totalChf: own.reduce((total, a) => total + (a.balanceChf ?? a.balance), 0),
    }
  }, [persona, tab, stack, theme, setTab, push, pop, toggleTheme, onLeave])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession muss innerhalb von <SessionProvider> stehen')
  return session
}
