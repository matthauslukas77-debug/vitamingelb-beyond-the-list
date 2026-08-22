import { useState } from 'react'
import { AppShell } from './app/AppShell'
import { PersonaPicker } from './app/PersonaPicker'
import type { Screen, Tab } from './app/session'
import type { SettingsSection } from './app/settings'
import { findPersona } from './data/personas'
import type { Persona } from './data/types'

/**
 * `?persona=reto` öffnet die App direkt, `&screen=cockpit` zusätzlich einen
 * bestimmten Bildschirm. Praktisch für Demo, Videoaufnahme und Screenshots.
 */
const TABS: Tab[] = ['home', 'payments', 'invest', 'offers', 'services']

const SECTIONS: SettingsSection[] = [
  'profile', 'login', 'notifications', 'accounts', 'payments',
  'invest', 'orders', 'app', 'twint',
]

function readSettingsScreen(section: string | null): Screen {
  const match = SECTIONS.find((entry) => entry === section)
  return match ? { name: 'settingsSection', section: match } : { name: 'settings' }
}

function readUrl(): { persona: Persona | null; tab?: Tab; screen?: Screen } {
  const params = new URLSearchParams(window.location.search)
  const persona = findPersona(params.get('persona') ?? '') ?? null
  const tab = TABS.find((entry) => entry === params.get('tab'))
  const name = params.get('screen')
  if (!persona || !name) return { persona, tab }

  return { persona, tab, screen: readScreen(name, params, persona) }
}

/**
 * `?screen=…` auf einen Bildschirm abbilden.
 *
 * Bewusst frühe Rückgaben statt einer Kette von Fragezeichen: Es sind
 * inzwischen zehn Fälle, und mehrere davon brauchen einen zweiten Parameter.
 */
function readScreen(name: string, params: URLSearchParams, persona: Persona): Screen | undefined {
  if (name === 'account') {
    return { name: 'account', accountId: params.get('account') ?? persona.accounts[0].id }
  }

  /* Das Cockpit hiess «analysis», solange es nur die Analysen der App war.
     Alte Demo-Links bleiben gültig; `&view=` wählt die Pille. */
  if (name === 'cockpit' || name === 'analysis') {
    const view = params.get('view')
    const known = view === 'budget' || view === 'analysis' || view === 'recurring'
    /* `?screen=analysis` ohne `view` meint den alten Bildschirm — also die
       Analyse-Ansicht, nicht das Budget. */
    return { name: 'cockpit', view: known ? view : name === 'analysis' ? 'analysis' : 'budget' }
  }

  /* Der Wizard direkt — für Demo und Videoaufnahme. */
  if (name === 'budget') return { name: 'budgetWizard' }
  if (name === 'signals') return { name: 'signals' }

  /* «subscriptions» bleibt gültig: der Bildschirm hiess mal «Meine Abos». */
  if (name === 'subscriptions' || name === 'recurring') return { name: 'recurring' }

  /* Eine einzelne wiederkehrende Reihe. Der Schlüssel ist der normalisierte
     Händlername, wie ihn `detectRecurring` bildet:
     `?screen=series&series=SPOTIFY%20AB`. */
  if (name === 'series' && params.get('series')) {
    return { name: 'series', seriesKey: params.get('series')! }
  }

  /* Die beiden Detailseiten der Analysen heissen in der URL nach ihrer
     Richtung — «income» und «expenses» statt eines Parameters. */
  if (name === 'income' || name === 'expenses') return { name: 'breakdown', direction: name }

  if (name === 'scan' || name === 'pay' || name === 'transfer' || name === 'search') return { name }

  /* «Profil und Einstellungen» und die neun Unterseiten daraus:
     `?screen=settings` öffnet die Übersicht,
     `?screen=settings&section=notifications` direkt den Abschnitt. */
  if (name === 'settings') return readSettingsScreen(params.get('section'))

  return undefined
}

function writeUrl(persona: Persona | null) {
  const url = new URL(window.location.href)
  if (persona) url.searchParams.set('persona', persona.id)
  else {
    for (const key of ['persona', 'tab', 'screen', 'account', 'series', 'section', 'view']) url.searchParams.delete(key)
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
