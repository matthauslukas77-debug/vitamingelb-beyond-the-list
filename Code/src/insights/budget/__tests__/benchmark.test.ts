import { describe, expect, it } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona } from '../derive'
import {
  DEFAULT_ANSWERS,
  benchmarkFor,
  budgetFromDerived,
  compare,
  toFrancs,
  toRappen,
} from '../benchmark'
import { Display, bottomTip, grossFromNet, netIncomeYear, topTip, updateBudget } from '../pf-model'
import { CATEGORY_KEYS } from '../slots'

const options = { today: TODAY, months: 12 }
const YEAR = Number(TODAY.slice(0, 4))

describe('Die Franken-Rappen-Grenze', () => {
  it('rechnet in beide Richtungen ohne Drift', () => {
    for (const francs of [0, 1, 42, 1_650, 99_999]) {
      expect(toFrancs(toRappen(francs))).toBe(francs)
    }
  })

  it('rundet Rappen kaufmännisch auf ganze Franken', () => {
    expect(toFrancs(164_949)).toBe(1_649)
    expect(toFrancs(164_950)).toBe(1_650)
  })
})

describe('Die portierte Nettolohn-Formel', () => {
  /**
   * Die Formel ist im Spike gegen 2'513 Live-Messpunkte geprüft
   * (`WORKSPACE/04_experiments/pf-budget-wizard`, `node verify.mjs`). Hier
   * stehen die Eckpunkte, damit eine Änderung an dieser Datei auffällt.
   */
  it('zieht unter 25 keinen BVG-Beitrag ab', () => {
    expect(Math.round(netIncomeYear(60_000, 22))).toBe(Math.round(60_000 * 0.926))
  })

  it('zieht ab 25 den halben BVG-Satz auf dem koordinierten Lohn ab', () => {
    expect(netIncomeYear(85_000, 40)).toBeLessThan(netIncomeYear(85_000, 24))
  })

  it('zeigt, was das fixe Alter 18 des Originals kostet', () => {
    // Die Live-Webapp setzt den Jahrgang auf «aktuelles Jahr − 18» und rechnet
    // damit für alle ohne BVG-Abzug. Bei 40 Jahren und 85'000 Brutto sind das
    // laut MODELL.md rund CHF 244 im Monat zu viel Nettoeinkommen.
    const proMonat = (netIncomeYear(85_000, 18) - netIncomeYear(85_000, 40)) / 12
    expect(Math.round(proMonat)).toBe(244)
  })

  it('kehrt sich sauber um — aus Netto wird wieder Brutto', () => {
    for (const gross of [40_000, 85_000, 150_000]) {
      for (const age of [22, 40, 58]) {
        const net = netIncomeYear(gross, age)
        expect(Math.abs(grossFromNet(net, age) - gross)).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('updateBudget rechnet wie der Endpoint', () => {
  it('leitet die Jahresansicht aus der führenden Monatsansicht ab', () => {
    const derived = deriveForPersona(findPersona('reto')!, options)
    const budget = budgetFromDerived(derived)
    const record = budget as unknown as Record<string, number>
    for (const key of CATEGORY_KEYS) {
      expect(record[`${key}YearAmount`]).toBe(record[`${key}MonthAmount`] * 12)
    }
    expect(budget.sumExpensesYear).toBe(budget.sumExpensesMonth * 12)
    expect(budget.savingQuoteMonth).toBe(budget.householdIncomeNetMonth - budget.sumExpensesMonth)
  })

  it('hält das Total gleich der Summe der Kategorien — in beiden Ansichten', () => {
    const derived = deriveForPersona(findPersona('bruno')!, options)
    for (const display of [Display.month, Display.year]) {
      const budget = updateBudget({ ...budgetFromDerived(derived), display })
      const record = budget as unknown as Record<string, number>
      const sumMonth = CATEGORY_KEYS.reduce((total, key) => total + record[`${key}MonthAmount`], 0)
      expect(budget.sumExpensesMonth).toBe(sumMonth)
    }
  })
})

describe('Der Richtwert für denselben Haushalt', () => {
  it('liefert für jede Persona einen vollständigen Vergleich', async () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      const benchmark = await benchmarkFor(persona, derived, DEFAULT_ANSWERS, YEAR)

      expect(benchmark.expensesMonth, persona.id).toBeGreaterThan(0)
      const rows = compare(derived, benchmark)
      expect(rows, persona.id).toHaveLength(CATEGORY_KEYS.length)
      for (const row of rows) {
        expect(row.delta, `${persona.id}/${row.key}`).toBe(row.actual - row.benchmark)
      }
    }
  })

  it('nimmt Brunos erkannten Kanton, nicht die Vorgabe im Formular', async () => {
    const bruno = findPersona('bruno')!
    const derived = deriveForPersona(bruno, options)
    const benchmark = await benchmarkFor(bruno, derived, { ...DEFAULT_ANSWERS, canton: 'ZH' }, YEAR)
    expect(benchmark.taxLocation.canton).toBe('BE')
  })

  it('rechnet mit dem echten Jahrgang, nicht mit 18', async () => {
    const bruno = findPersona('bruno')!
    const derived = deriveForPersona(bruno, options)
    const benchmark = await benchmarkFor(bruno, derived, DEFAULT_ANSWERS, YEAR)
    expect(benchmark.form.year).toBe(bruno.birthYear)
    expect(YEAR - benchmark.form.year).toBeGreaterThan(50)
  })

  it('zeigt bei Reto, dass der Richtwert ein Auto unterstellt, das er nicht hat', async () => {
    const reto = findPersona('reto')!
    const derived = deriveForPersona(reto, options)
    const benchmark = await benchmarkFor(reto, derived, DEFAULT_ANSWERS, YEAR)
    const mobility = compare(derived, benchmark).find((row) => row.key === 'mobility')!
    expect(mobility.actual).toBeLessThan(mobility.benchmark)
  })
})

describe('Die Tippboxen laufen auf unseren Zahlen', () => {
  it('meldet bei Reto Sparpotenzial — er hat wirklich Überschuss', () => {
    const derived = deriveForPersona(findPersona('reto')!, options)
    expect(derived.surplusMonth).toBeGreaterThan(0)
    expect(topTip(budgetFromDerived(derived))).toBe('scrHintSavingPotential')
  })

  it('meldet «keine private Vorsorge erkannt», wo wirklich keine 3a gebucht ist', () => {
    const reto = deriveForPersona(findPersona('reto')!, options)
    expect(reto.categoryTotals.insurance).toBe(0)
    expect(bottomTip(budgetFromDerived(reto))).toBe('scrHintProvisionsStart')
  })

  it('meldet bei Bruno keinen Vorsorge-Start — er zahlt 3a ein', () => {
    const bruno = deriveForPersona(findPersona('bruno')!, options)
    expect(bottomTip(budgetFromDerived(bruno))).not.toBe('scrHintProvisionsStart')
  })
})
