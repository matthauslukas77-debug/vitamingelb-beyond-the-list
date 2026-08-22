import { describe, expect, it } from 'vitest'
import { allowedNumbers, hasOnlyKnownNumbers, numbersIn } from '../../../../supabase/functions/explain/guard'
import { findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona } from '../derive'
import { DEFAULT_ANSWERS, benchmarkFor, compare } from '../benchmark'
import { headlineOf } from '../explain'

/**
 * Die Zahlenwache der Edge Function.
 *
 * Sie liegt in `supabase/functions/explain/guard.ts` und läuft auf dem Server —
 * getestet wird sie hier, weil das der Ort ist, an dem `npm test` sie findet.
 * Sie ist die einzige Stelle, die zwischen einem Modell und einem Bildschirm
 * steht: Was sie durchlässt, sieht jemand.
 */
describe('Zahlenwache', () => {
  it('liest Beträge mit Apostroph, Punkt und Leerzeichen', () => {
    expect(numbersIn('CHF 1’390 und CHF 1 250.')).toEqual([1390, 1250])
    expect(numbersIn('kein Betrag hier')).toEqual([])
  })

  it('lässt durch, was im Prompt stand', () => {
    const allowed = allowedNumbers('Überschuss CHF 1390, gespart CHF 1250')
    expect(hasOnlyKnownNumbers('Von CHF 1’390 gehen CHF 1’250 aufs Sparkonto.', allowed)).toBe(true)
  })

  it('hält die gerundete Näherung auf, die der 70B im Test produziert hat', () => {
    // Echter Fall aus dem ersten Lauf: Die Differenz war 349, das Modell
    // schrieb «fast CHF 400». Sprachlich eine Näherung, in einem Budget eine
    // Zahl, die nirgends steht.
    const allowed = allowedNumbers('Mobilität: du CHF 640, Vergleich CHF 989 (CHF 349 unter dem Vergleich)')
    expect(hasOnlyKnownNumbers('Die Mobilitätskosten liegen fast CHF 400 darunter.', allowed)).toBe(false)
    expect(hasOnlyKnownNumbers('Die Mobilitätskosten liegen CHF 349 darunter.', allowed)).toBe(true)
  })

  it('lässt kleine Zahlen bis 12 zu — Monate und Aufzählungen', () => {
    const allowed = allowedNumbers('Überschuss CHF 500')
    expect(hasOnlyKnownNumbers('Über 12 Monate gesehen bleiben CHF 500.', allowed)).toBe(true)
    expect(hasOnlyKnownNumbers('Über 24 Monate gesehen bleiben CHF 500.', allowed)).toBe(false)
  })

  it('erlaubt jede Zahl aus einem echten Befund', async () => {
    // Der Befund geht selbst in den Prompt. Was darin steht, muss deshalb
    // auch zurückkommen dürfen — sonst verwirft die Wache die eigene Vorlage.
    for (const id of ['reto', 'nino', 'livia', 'bruno']) {
      const persona = findPersona(id)!
      const derived = deriveForPersona(persona, { today: TODAY, months: 12 })
      const benchmark = await benchmarkFor(persona, derived, DEFAULT_ANSWERS, 2026)
      const headline = headlineOf(derived, compare(derived, benchmark))
      expect(hasOnlyKnownNumbers(headline, allowedNumbers(headline)), id).toBe(true)
    }
  })
})
