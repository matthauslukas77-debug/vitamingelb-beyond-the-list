import { useState } from 'react'
import { AppShell } from './app/AppShell'
import { PersonaPicker } from './app/PersonaPicker'
import type { Screen, Tab } from './app/session'
import { findPersona } from './data/personas'
import type { Persona } from './data/types'

/**
 * `?persona=reto` öffnet die App direkt, `&screen=analysis` zusätzlich einen
 * bestimmten Bildschirm. Praktisch für Demo, Videoaufnahme und Screenshots.
 */
const TABS: Tab[] = ['home', 'payments', 'invest', 'offers', 'services']

function readUrl(): { persona: Persona | null; tab?: Tab; screen?: Screen } {
  const params = new URLSearchParams(window.location.search)
  const persona = findPersona(params.get('persona') ?? '') ?? null
  const tab = TABS.find((entry) => entry === params.get('tab'))
  const name = params.get('screen')
  if (!persona || !name) return { persona, tab }

  const screen: Screen | undefined =
    name === 'account'
      ? { name: 'account', accountId: params.get('account') ?? persona.accounts[0].id }
      : // «subscriptions» bleibt gültig: der Bildschirm hiess mal «Meine Abos»,
        // und alte Demo-Links sollen nicht ins Leere laufen.
        name === 'subscriptions' || name === 'recurring'
        ? { name: 'recurring' }
        : // Die beiden Detailseiten der Analysen heissen in der URL nach ihrer
          // Richtung — «income» und «expenses» statt eines Parameters.
          name === 'income' || name === 'expenses'
          ? { name: 'breakdown', direction: name }
          : name === 'analysis' || name === 'scan' || name === 'pay' ||
              name === 'transfer' || name === 'search'
            ? { name }
            : undefined

  return { persona, tab, screen }
}

function writeUrl(persona: Persona | null) {
  const url = new URL(window.location.href)
  if (persona) url.searchParams.set('persona', persona.id)
  else {
    for (const key of ['persona', 'tab', 'screen', 'account']) url.searchParams.delete(key)
  }
  window.history.replaceState(null, '', url)
}

export function App() {
  const [start] = useState(readUrl)
  const [persona, setPersona] = useState<Persona | null>(start.persona)

  const choose = (next: Persona | null) => {
    writeUrl(next)
    setPersona(next)
  }

  return persona ? (
    <AppShell
      persona={persona}
      initialTab={persona === start.persona ? start.tab : undefined}
      initialScreen={persona === start.persona ? start.screen : undefined}
      onLeave={() => choose(null)}
    />
  ) : (
    <PersonaPicker onChoose={choose} />
  )
}
