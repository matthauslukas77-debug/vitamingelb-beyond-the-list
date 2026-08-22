import { describe, expect, it } from 'vitest'
import { bucketsFor, computeBreakdown, monthsBetween } from '../breakdown'
import { PERSONAS } from '../../data/personas'
import { TODAY } from '../../data/types'
import type { Category, Transaction } from '../../data/types'

let counter = 0
function tx(amount: number, category: Category, date = '2026-03-15'): Transaction {
  counter += 1
  return {
    id: `t${counter}`,
    accountId: 'a1',
    date,
    text: 'TEST',
    amount,
    currency: 'CHF',
    category,
  }
}

const YEAR = { from: '2026-01-01', to: TODAY }

describe('monthsBetween', () => {
  it('zählt angebrochene Monate', () => {
    // Gegenprobe an der Vorlage: 31'475.09 / 3'934.39 = 8 für Jan.–Aug.
    expect(monthsBetween('2026-01-01', '2026-08-22')).toBe(8)
    expect(monthsBetween('2026-08-01', '2026-08-22')).toBe(1)
    expect(monthsBetween('2025-11-01', '2026-02-05')).toBe(4)
  })

  it('gibt nie null zurück', () => {
    expect(monthsBetween('2026-08-22', '2026-08-01')).toBe(1)
  })
})

describe('computeBreakdown', () => {
  it('teilt Ausgaben auf die sieben Töpfe der Vorlage auf', () => {
    expect(bucketsFor('expenses').map((b) => b.label)).toEqual([
      'Wohnen', 'Einkaufen', 'Leben', 'Freizeit', 'Mobilität', 'Finanzen', 'Sonstige Ausgaben',
    ])
  })

  it('teilt Einnahmen auf die drei Töpfe der Vorlage auf', () => {
    expect(bucketsFor('income').map((b) => b.label)).toEqual([
      'Einkommen', 'Rückerstattungen', 'Sonstige Einnahmen',
    ])
  })

  it('summiert pro Topf und behält die feste Reihenfolge', () => {
    const result = computeBreakdown(
      [
        tx(-1000, 'housing'),
        tx(-500, 'subscriptions'),
        tx(-2000, 'groceries'),
        tx(-300, 'transport'),
      ],
      { direction: 'expenses', ...YEAR },
    )
    expect(result.slices.map((s) => [s.label, s.amount])).toEqual([
      ['Wohnen', 1500],
      ['Einkaufen', 2000],
      ['Mobilität', 300],
    ])
    expect(result.total).toBe(3800)
  })

  it('lässt leere Töpfe weg, behält aber deren Rang für die Farbe', () => {
    const result = computeBreakdown([tx(-100, 'transport')], { direction: 'expenses', ...YEAR })
    expect(result.slices).toHaveLength(1)
    // «Mobilität» ist der fünfte Topf — die Farbe hängt am Rang, nicht am Index.
    expect(result.slices[0].rank).toBe(4)
  })

  it('entscheidet nach Vorzeichen, nicht nach Kategorie', () => {
    const rows = [tx(-8000, 'health'), tx(2000, 'health')]
    expect(computeBreakdown(rows, { direction: 'expenses', ...YEAR }).total).toBe(8000)
    // Die Gutschrift in einer Ausgabenkategorie ist eine Rückerstattung.
    const income = computeBreakdown(rows, { direction: 'income', ...YEAR })
    expect(income.total).toBe(2000)
    expect(income.slices[0].label).toBe('Rückerstattungen')
  })

  it('zählt die Umbuchung aufs eigene Konto als Ausgabe — wie die App heute', () => {
    const result = computeBreakdown([tx(-50000, 'transfer')], { direction: 'expenses', ...YEAR })
    expect(result.slices[0].label).toBe('Sonstige Ausgaben')
    expect(result.total).toBe(50000)
  })

  it('achtet auf die Zeitraumgrenzen', () => {
    const rows = [tx(-100, 'groceries', '2025-12-31'), tx(-200, 'groceries', '2026-01-01')]
    expect(computeBreakdown(rows, { direction: 'expenses', ...YEAR }).total).toBe(200)
  })

  it('rechnet den Durchschnitt über die angebrochenen Monate', () => {
    const result = computeBreakdown([tx(-80000, 'housing')], { direction: 'expenses', ...YEAR })
    expect(result.months).toBe(8)
    expect(result.perMonth).toBe(10000)
  })

  it('bleibt bei leerer Eingabe heil', () => {
    const result = computeBreakdown([], { direction: 'expenses', ...YEAR })
    expect(result.total).toBe(0)
    expect(result.perMonth).toBe(0)
    expect(result.slices).toEqual([])
  })

  it('summiert die Anteile auf 1', () => {
    const result = computeBreakdown(
      [tx(-1000, 'housing'), tx(-3000, 'groceries'), tx(-500, 'transport')],
      { direction: 'expenses', ...YEAR },
    )
    const sum = result.slices.reduce((total, s) => total + s.share, 0)
    expect(sum).toBeCloseTo(1, 10)
  })
})

describe('gegen die echten Personas', () => {
  it.each(PERSONAS.map((p) => [p.name, p] as const))(
    '%s: Töpfe ergeben zusammen das Total der Analysen',
    (_name, persona) => {
      const inYear = persona.transactions.filter((t) => t.date >= YEAR.from && t.date <= YEAR.to)
      const expected = {
        income: inYear.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
        expenses: inYear.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
      }
      for (const direction of ['income', 'expenses'] as const) {
        const result = computeBreakdown(persona.transactions, { direction, ...YEAR })
        // Keine Buchung darf durch das Raster fallen: Jede Kategorie ist einem
        // Topf zugeordnet, also muss die Summe der Töpfe das Total treffen.
        expect(result.total).toBe(expected[direction])
        expect(result.slices.reduce((s, x) => s + x.amount, 0)).toBe(expected[direction])
        expect(result.slices.length).toBeGreaterThan(0)
      }
    },
  )
})
