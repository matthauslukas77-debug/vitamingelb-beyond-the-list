import { describe, expect, it } from 'vitest'
import { generateTransactions, groupByDay, sortByDateDesc, type Series } from '../generate'
import { PERSONAS } from '../personas'

const series: Series[] = [
  { id: 'salary', text: 'LOHN', category: 'income', amount: 400_000, dayOfMonth: 25 },
  {
    id: 'abo',
    text: 'ADOBE *CREATIVE CLOUD',
    category: 'subscriptions',
    amount: -7_190,
    dayOfMonth: 14,
    raise: { fromIso: '2026-03-01', amount: -7_990 },
  },
]

const options = {
  accountId: 'a',
  currency: 'CHF' as const,
  seed: 42,
  fromIso: '2026-01-01',
  toIso: '2026-06-30',
  series,
  merchants: [],
  perWeek: 0,
}

describe('generateTransactions', () => {
  it('erzeugt bei gleichem Seed identische Daten', () => {
    expect(generateTransactions(options)).toEqual(generateTransactions(options))
  })

  it('bucht wiederkehrende Zahlungen einmal pro Monat', () => {
    const salary = generateTransactions(options).filter((tx) => tx.seriesId === 'salary')
    expect(salary).toHaveLength(6)
  })

  it('wendet die Preiserhöhung ab dem Stichmonat an', () => {
    const abo = generateTransactions(options).filter((tx) => tx.seriesId === 'abo')
    expect(abo.find((tx) => tx.date === '2026-02-14')?.amount).toBe(-7_190)
    expect(abo.find((tx) => tx.date === '2026-04-14')?.amount).toBe(-7_990)
  })

  it('bleibt innerhalb des Zeitraums', () => {
    for (const tx of generateTransactions(options)) {
      expect(tx.date >= options.fromIso && tx.date <= options.toIso).toBe(true)
    }
  })

  it('kürzt den Stichtag auf den letzten Tag kurzer Monate', () => {
    const result = generateTransactions({
      ...options,
      fromIso: '2026-02-01',
      toIso: '2026-02-28',
      series: [{ id: 'x', text: 'X', category: 'other', amount: -100, dayOfMonth: 31 }],
    })
    expect(result[0].date).toBe('2026-02-28')
  })
})

describe('sortByDateDesc', () => {
  it('sortiert neueste zuerst', () => {
    const sorted = sortByDateDesc(generateTransactions(options))
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].date >= sorted[i].date).toBe(true)
    }
  })
})

describe('groupByDay', () => {
  it('fasst Buchungen desselben Tages zusammen', () => {
    const groups = groupByDay(generateTransactions(options))
    const dates = groups.map((group) => group.date)
    expect(new Set(dates).size).toBe(dates.length)
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
    // Fritz: das Abo, das still teurer wurde
    const adobe = byId.fritz.transactions.filter((tx) => tx.seriesId === 'f-adobe')
    expect(new Set(adobe.map((tx) => tx.amount)).size).toBe(2)
    // Katja: Dauerauftrag auf das eigene Sparkonto
    expect(byId.katja.transactions.some((tx) => tx.category === 'transfer' && tx.counterAccountId)).toBe(true)
    // Michael: der grosse Jahresposten
    expect(byId.michael.transactions.some((tx) => tx.category === 'taxes' && tx.amount < -1_000_000)).toBe(true)
  })
})
