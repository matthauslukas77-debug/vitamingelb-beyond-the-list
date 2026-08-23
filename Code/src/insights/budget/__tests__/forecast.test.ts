import { describe, expect, it } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona } from '../derive'
import { MILESTONES, milestones, monthsUntilEmpty, project, savingsBalance } from '../forecast'
import { toRappen } from '../benchmark'

const options = { months: 60, today: TODAY }

describe('Projektion', () => {
  it('rechnet die gerade Linie, die sie verspricht', () => {
    const plan = project(toRappen(10_000), toRappen(500), options)
    expect(plan.at(0)).toBe(toRappen(10_000))
    expect(plan.at(12)).toBe(toRappen(16_000))
    expect(plan.at(60)).toBe(toRappen(40_000))
    expect(plan.points).toHaveLength(61)
  })

  it('legt jeden Punkt auf ein Monatsende', () => {
    const plan = project(0, toRappen(100), { months: 3, today: '2026-08-22' })
    expect(plan.points.map((point) => point.date)).toEqual([
      '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30',
    ])
  })

  it('sagt bei negativem Verlauf, wann das Guthaben leer ist', () => {
    const plan = project(toRappen(1_200), toRappen(-100), options)
    expect(monthsUntilEmpty(plan)).toBe(12)
  })

  it('sagt nichts, wo nichts leer wird', () => {
    expect(monthsUntilEmpty(project(toRappen(1_000), toRappen(50), options))).toBeNull()
    expect(monthsUntilEmpty(project(0, toRappen(-50), options))).toBeNull()
  })

  it('nimmt Spar- und Vorsorgekonten als Start, nicht das Privatkonto', () => {
    // Bruno hat Privatkonto, Sparkonto, Vorsorgekonto 3a, Depot und Hypothek.
    const bruno = findPersona('bruno')!
    const start = savingsBalance(bruno.accounts)
    const privat = bruno.accounts.find((account) => account.kind === 'private')!
    expect(start).toBeGreaterThan(0)
    expect(start).not.toBe(privat.balance)

    // Nino hat kein Sparkonto — dann ist der Start null und die Linie zeigt,
    // was sich aufbauen würde.
    expect(savingsBalance(findPersona('nino')!.accounts)).toBe(0)
  })
})

describe('Die zwei Linien', () => {
  it('trennt das Versprechen des Budgets vom gemessenen Sparverhalten', () => {
    // Reto bleiben nach Budget rund CHF 1'270 im Monat, per Dauerauftrag legt
    // er davon 1'250 zurück. Genau diese Lücke ist die Aussage des Ausblicks.
    const reto = findPersona('reto')!
    const derived = deriveForPersona(reto, { today: TODAY, months: 12 })
    const start = savingsBalance(reto.accounts)

    const plan = project(start, derived.surplusMonth, options)
    const actual = project(start, derived.actualSavedMonth, options)

    expect(derived.surplusMonth).toBeGreaterThan(derived.actualSavedMonth)
    expect(plan.at(60)).toBeGreaterThan(actual.at(60))
  })

  it('liefert für jede Persona drei Meilensteine', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, { today: TODAY, months: 12 })
      const start = savingsBalance(persona.accounts)
      const marks = milestones(
        project(start, derived.surplusMonth, options),
        project(start, derived.actualSavedMonth, options),
      )
      expect(marks, persona.id).toHaveLength(MILESTONES.length)
      for (const mark of marks) {
        expect(Number.isFinite(mark.plan), `${persona.id}/${mark.label}`).toBe(true)
        expect(Number.isFinite(mark.actual), `${persona.id}/${mark.label}`).toBe(true)
      }
    }
  })
})
