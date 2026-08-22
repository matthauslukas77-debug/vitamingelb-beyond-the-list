import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona } from '../derive'
import { toFrancs, toRappen } from '../benchmark'
import { sliderMax, sliderStep } from '../ui/Slider'

/**
 * Der Regler.
 *
 * Anlass ist ein Fehler, der bis in die Demo gekommen ist: Die Obergrenze
 * wurde aus `max(Vorschlag, aktueller Wert)` gerechnet. Wer den Regler ans
 * Ende zog, verdoppelte damit die Grenze und konnte erneut ans Ende ziehen —
 * nach acht Zügen stand ein Steuerbudget von CHF 1'154 bei CHF 307'200.
 */
describe('Die Obergrenze der Schiene', () => {
  it('reagiert nicht auf ihren eigenen Wert', () => {
    /* Der eigentliche Test: Wer zehnmal ans Ende zieht, landet zehnmal an
       derselben Stelle. Eine Grenze, die mitwächst, ist keine. */
    const suggestion = toRappen(1_154)
    const income = toRappen(9_338)
    const first = sliderMax(suggestion, income)

    let value = first
    for (let round = 0; round < 10; round++) {
      const max = sliderMax(suggestion, income)
      expect(max, `Runde ${round}`).toBe(first)
      value = Math.min(value, max)
    }
    expect(value).toBe(first)
  })

  it('lässt Luft nach oben, ohne den Vorschlag an den Rand zu drängen', () => {
    const income = toRappen(5_000)
    const suggestion = toRappen(950)
    const max = sliderMax(suggestion, income)
    expect(max).toBeGreaterThanOrEqual(suggestion * 3)
    expect(max).toBeLessThanOrEqual(suggestion * 6)
  })

  it('bleibt auch ohne Vorschlag bedienbar', () => {
    // Wer nie Miete gezahlt hat, soll trotzdem eine eintragen können.
    expect(sliderMax(0, toRappen(5_000))).toBeGreaterThanOrEqual(toRappen(1_000))
    expect(sliderMax(0, 0)).toBeGreaterThanOrEqual(toRappen(1_000))
  })

  it('endet auf glatten Hundertern', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, { today: TODAY, months: 12 })
      for (const slot of derived.slots) {
        const max = sliderMax(slot.monthly, derived.incomeMonth)
        expect(toFrancs(max) % 100, `${persona.id}`).toBe(0)
      }
    }
  })

  it('bleibt bei jeder Persona in einer Grössenordnung, die ein Mensch schiebt', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, { today: TODAY, months: 12 })
      for (const slot of derived.slots) {
        const max = sliderMax(slot.monthly, derived.incomeMonth)
        expect(toFrancs(max), `${persona.id}`).toBeLessThanOrEqual(50_000)
      }
    }
  })
})

describe('Die Schrittweite', () => {
  it('hält die Zahl der Rasten in einem Bereich, in dem der Daumen etwas trifft', () => {
    for (let francs = 1_000; francs <= 60_000; francs += 100) {
      const max = toRappen(francs)
      const steps = max / sliderStep(max)
      expect(steps, `${francs} CHF`).toBeGreaterThan(20)
      expect(steps, `${francs} CHF`).toBeLessThanOrEqual(200)
    }
  })

  it('bleibt bei runden Beträgen', () => {
    for (const francs of [1_000, 5_000, 20_000]) {
      expect(toFrancs(sliderStep(toRappen(francs))) % 10).toBe(0)
    }
  })
})
