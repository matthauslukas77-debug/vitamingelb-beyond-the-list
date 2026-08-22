import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../../../data/types'
import { flowTotals, moneyFlow } from '../flow'
import { PERSONAS } from '../../../data/personas'

const accounts: Account[] = [
  { id: 'privat', name: 'Privatkonto', iban: 'CH00', kind: 'private', currency: 'CHF', balance: 0, source: { type: 'postfinance' } },
  { id: 'spar', name: 'Sparkonto', iban: 'CH01', kind: 'savings', currency: 'CHF', balance: 0, source: { type: 'postfinance' } },
  { id: 'vorsorge', name: 'Vorsorgekonto 3a', iban: 'CH02', kind: 'retirement3a', currency: 'CHF', balance: 0, source: { type: 'postfinance' } },
]

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 't', accountId: 'privat', date: '2026-08-01', text: '', amount: -1000,
    currency: 'CHF', category: 'other', ...partial,
  }
}

describe('Geldfluss-Achse', () => {
  it('erkennt den Übertrag aufs eigene Sparkonto als verschoben, nicht als Ausgabe', () => {
    const result = moneyFlow(
      tx({ text: 'DAUERAUFTRAG SPARKONTO', amount: -50_000, category: 'transfer', counterAccountId: 'spar' }),
      { accounts },
    )
    expect(result.flow).toBe('moved')
  })

  it('erkennt ein Gegenkonto bei einer anderen Bank ebenfalls als eigenes', () => {
    // Retos Sparkonto liegt bei der BKB und steht nicht in seiner Kontoliste.
    const result = moneyFlow(
      tx({ text: 'SPARAUFTRAG', amount: -30_000, category: 'transfer', counterAccountId: 'reto-savings-bkb' }),
      { accounts },
    )
    expect(result.flow).toBe('moved')
    expect(result.reason).toMatch(/anderen Bank/)
  })

  it('führt die Säule 3a als Ausgabe — so wie der Budgetrechner selbst', () => {
    const result = moneyFlow(
      tx({ text: 'EINZAHLUNG VORSORGE 3A', amount: -58_800, category: 'transfer', counterAccountId: 'vorsorge' }),
      { accounts },
    )
    expect(result.flow).toBe('out')
  })

  it('trennt TWINT unter Privaten vom TWINT-Kauf', () => {
    expect(moneyFlow(tx({ text: 'TWINT GELD GESENDET VOM 02.09.2024 AN RAFAEL SIEBER' }), { accounts }).flow).toBe('lent')
    expect(moneyFlow(tx({ text: 'TWINT KAUF/DIENSTLEISTUNG VOM 11.09.2024 PUBLIBIKE BERN (CH)' }), { accounts }).flow).toBe('out')
  })

  it('zählt eine Rückerstattung nicht als Einnahme', () => {
    const result = moneyFlow(
      tx({ text: 'GUTSCHRIFT RÜCKERSTATTUNG VOM 03.02.2026 KARTEN NR. XXXX2264 DIGITEC', amount: 8_990 }),
      { accounts },
    )
    expect(result.flow).toBe('settled')
  })

  it('lässt eine gewöhnliche Belastung eine Ausgabe sein', () => {
    expect(moneyFlow(tx({ text: 'MIGROS BERN', category: 'groceries' }), { accounts }).flow).toBe('out')
  })

  it('kennt jede Buchung genau einen Zustand — die Summe der Anzahlen stimmt', () => {
    for (const persona of PERSONAS) {
      const totals = flowTotals(persona.transactions, { accounts: persona.accounts, ownName: persona.name })
      const counted = Object.values(totals.counts).reduce((a, b) => a + b, 0)
      expect(counted, persona.id).toBe(persona.transactions.length)
    }
  })

  it('vermeidet bei jeder Persona mit Sparauftrag echte Doppelzählung', () => {
    // Livia, Reto und Bruno haben einen Dauerauftrag aufs eigene Konto.
    // Genau dieser Betrag darf nicht als Ausgabe erscheinen.
    for (const id of ['livia', 'reto', 'bruno']) {
      const persona = PERSONAS.find((entry) => entry.id === id)!
      const totals = flowTotals(persona.transactions, { accounts: persona.accounts, ownName: persona.name })
      expect(totals.avoidedDoubleCount, id).toBeGreaterThan(0)
      expect(totals.realExpenses, id).toBeLessThan(totals.naiveExpenses)
    }
  })
})
