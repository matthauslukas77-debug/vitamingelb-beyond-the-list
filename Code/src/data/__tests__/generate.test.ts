import { describe, expect, it } from 'vitest'
import { groupByDay, sortByDateDesc } from '../generate'
import { PERSONAS } from '../personas'
import type { Transaction } from '../types'

/** Vier Buchungen, absichtlich unsortiert und mit zwei am selben Tag. */
const sample: Transaction[] = [
  { id: '1', accountId: 'a', date: '2026-03-04', text: 'A', amount: -100, currency: 'CHF', category: 'other' },
  { id: '2', accountId: 'a', date: '2026-03-06', text: 'B', amount: -200, currency: 'CHF', category: 'other' },
  { id: '3', accountId: 'a', date: '2026-03-04', text: 'C', amount: -300, currency: 'CHF', category: 'other' },
  { id: '4', accountId: 'a', date: '2026-02-28', text: 'D', amount: -400, currency: 'CHF', category: 'other' },
]

describe('sortByDateDesc', () => {
  it('sortiert neueste zuerst', () => {
    const sorted = sortByDateDesc(sample)
    expect(sorted.map((tx) => tx.date)).toEqual(['2026-03-06', '2026-03-04', '2026-03-04', '2026-02-28'])
  })
})

describe('groupByDay', () => {
  it('fasst Buchungen desselben Tages zusammen', () => {
    const groups = groupByDay(sortByDateDesc(sample))
    expect(groups.map((group) => group.date)).toEqual(['2026-03-06', '2026-03-04', '2026-02-28'])
    expect(groups[1].items).toHaveLength(2)
  })
})

describe('Personas', () => {
  it('haben eindeutige Buchungs-IDs', () => {
    for (const persona of PERSONAS) {
      const ids = persona.transactions.map((tx) => tx.id)
      expect(new Set(ids).size, `${persona.id} hat doppelte IDs`).toBe(ids.length)
    }
  })

  it('verweisen nur auf eigene Konten', () => {
    for (const persona of PERSONAS) {
      const known = new Set(persona.accounts.map((account) => account.id))
      for (const tx of persona.transactions) expect(known.has(tx.accountId)).toBe(true)
    }
  })

  it('tragen jede ein Muster aus den Interviews', () => {
    const byId = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona]))
    // Reto: das Abo, das still teurer wurde
    const adobe = byId.reto.transactions.filter((tx) => tx.seriesId === 'f-adobe')
    expect(new Set(adobe.map((tx) => tx.amount)).size).toBe(2)
    // Livia: Dauerauftrag auf das eigene Sparkonto
    expect(byId.livia.transactions.some((tx) => tx.category === 'transfer' && tx.counterAccountId)).toBe(true)
    // Bruno: der grosse Jahresposten
    expect(byId.bruno.transactions.some((tx) => tx.category === 'taxes' && tx.amount < -1_000_000)).toBe(true)
  })
})
