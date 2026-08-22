import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona } from '../derive'
import { DEFAULT_ANSWERS, toRappen } from '../benchmark'
import { Display } from '../pf-model'
import {
  BUDGET_VERSION,
  amountOf,
  budgetFromDerivation,
  clearBudget,
  loadBudget,
  refreshed,
  resetAmount,
  saveBudget,
  totalOf,
  withAmount,
} from '../storage'
import { SLOT_COUNT } from '../slots'

/** Ein `localStorage`, das im Testlauf (Node) genügt. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

const derived = deriveForPersona(findPersona('reto')!, { today: TODAY, months: 12 })
const fresh = () => budgetFromDerivation(derived, DEFAULT_ANSWERS, TODAY)

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() })
})

describe('Das gespeicherte Budget', () => {
  it('übernimmt beim Anlegen jedes der neunzehn Felder', () => {
    const budget = fresh()
    expect(Object.keys(budget.amounts)).toHaveLength(SLOT_COUNT)
    expect(budget.edited).toHaveLength(0)
    expect(totalOf(budget)).toBe(derived.expensesMonth)
  })

  it('übersteht das Speichern und Laden', () => {
    const budget = withAmount(fresh(), 'reside.0', toRappen(1_800), TODAY)
    saveBudget('reto', budget)
    const back = loadBudget('reto')
    expect(back?.amounts['reside.0']).toBe(toRappen(1_800))
    expect(back?.edited).toEqual(['reside.0'])
    expect(back?.display).toBe(Display.month)
  })

  it('gibt null zurück, wo nichts gespeichert ist', () => {
    expect(loadBudget('niemand')).toBeNull()
  })

  it('verwirft einen Eintrag aus einer älteren Fassung, statt ihn halb zu lesen', () => {
    // Ein Budget mit fehlenden Feldern zeigt falsche Summen — schlimmer als
    // ein leerer Zustand.
    window.localStorage.setItem(
      'beyond-the-list.budget.reto',
      JSON.stringify({ version: BUDGET_VERSION - 1, amounts: { 'reside.0': 1 } }),
    )
    expect(loadBudget('reto')).toBeNull()
  })

  it('merkt sich, welches Feld von Hand kommt — und lässt es zurücksetzen', () => {
    const edited = withAmount(fresh(), 'consumption.0', toRappen(300), TODAY)
    expect(edited.edited).toContain('consumption.0')

    const back = resetAmount(edited, 'consumption.0', derived, TODAY)
    expect(back.edited).not.toContain('consumption.0')
    expect(amountOf(back, 'consumption.0')).toBe(
      derived.slots.find((entry) => entry.slot.category === 'consumption' && entry.slot.field === 0)!.monthly,
    )
  })

  it('lässt negative Beträge gar nicht erst entstehen', () => {
    expect(amountOf(withAmount(fresh(), 'reside.0', -5_000, TODAY), 'reside.0')).toBe(0)
  })

  it('rechnet beim nächsten Monat die eigene Eingabe NICHT wieder weg', () => {
    /* Das ist das Versprechen des Wizards: «Was du änderst, bleibt geändert.»
       Ein Budget, das die Eingabe beim nächsten Lauf überschreibt, wird einmal
       benutzt und nie wieder. */
    const budget = withAmount(fresh(), 'reside.0', toRappen(1_800), TODAY)
    const later = refreshed(budget, derived, TODAY)

    expect(amountOf(later, 'reside.0')).toBe(toRappen(1_800))
    // Alles andere folgt weiterhin der Ableitung.
    const groceries = derived.slots.find(
      (entry) => entry.slot.category === 'consumption' && entry.slot.field === 0,
    )!
    expect(amountOf(later, 'consumption.0')).toBe(groceries.monthly)
    expect(Object.keys(later.amounts)).toHaveLength(SLOT_COUNT)
  })

  it('lässt sich löschen', () => {
    saveBudget('reto', fresh())
    clearBudget('reto')
    expect(loadBudget('reto')).toBeNull()
  })

  it('hält die App am Leben, wenn der Speicher gesperrt ist', () => {
    // Privates Fenster: jeder Zugriff wirft. Das darf keinen Bildschirm kosten.
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('gesperrt') },
        setItem: () => { throw new Error('gesperrt') },
        removeItem: () => { throw new Error('gesperrt') },
      } as unknown as Storage,
    })
    expect(loadBudget('reto')).toBeNull()
    expect(() => saveBudget('reto', fresh())).not.toThrow()
    expect(() => clearBudget('reto')).not.toThrow()
  })
})
