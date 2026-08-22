import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../data/personas'
import { TODAY } from '../../data/types'
import { detectRecurring, normaliseMerchant, upcoming } from '../recurring'

const byId = Object.fromEntries(PERSONAS.map((persona) => [persona.id, persona]))

describe('normaliseMerchant', () => {
  it('entfernt Präfix, Datum und Terminalnummer', () => {
    expect(normaliseMerchant('Apple Pay Kauf/Dienstleistung vom 21.08.2026, kkiosk 355.78'))
      .toBe('KKIOSK')
    expect(normaliseMerchant('Kauf/Onlineshopping vom 22.08.2026, PAYPAL *PADDLE.NET'))
      .toBe('PAYPAL PADDLE NET')
  })

  it('führt dieselbe Zahlung an verschiedenen Tagen auf denselben Schlüssel', () => {
    const a = normaliseMerchant('Apple Pay Kauf/Dienstleistung vom 03.01.2026, COOP-2504 BERN')
    const b = normaliseMerchant('Apple Pay Kauf/Dienstleistung vom 19.07.2026, COOP-2504 BERN')
    expect(a).toBe(b)
  })

  it('unterscheidet verschiedene Händler', () => {
    expect(normaliseMerchant('SPOTIFY AB')).not.toBe(normaliseMerchant('NETFLIX.COM'))
  })
})

describe('detectRecurring — gegen die Referenz aus den Mock-Daten', () => {
  /**
   * Die Erkennung liest die `seriesId` NICHT. Hier dient sie als Referenz:
   * Findet der Algorithmus wirklich die Zahlungsreihen, die es tatsächlich gibt?
   */
  for (const persona of PERSONAS) {
    it(`findet bei ${persona.name} die echten Reihen wieder`, () => {
      const detected = detectRecurring(persona.transactions, { today: TODAY })
      const detectedKeys = new Set(detected.map((entry) => entry.key))

      // Alle Reihen, die im Datensatz mindestens dreimal vorkommen.
      const counts = new Map<string, number>()
      for (const tx of persona.transactions) {
        if (tx.seriesId) counts.set(tx.seriesId, (counts.get(tx.seriesId) ?? 0) + 1)
      }
      const realSeries = [...counts].filter(([, count]) => count >= 3).map(([id]) => id)
      expect(realSeries.length).toBeGreaterThan(3)

      for (const seriesId of realSeries) {
        const sample = persona.transactions.find((tx) => tx.seriesId === seriesId)!
        const key = normaliseMerchant(sample.text)
        expect(detectedKeys.has(key), `${seriesId} («${sample.text}») nicht erkannt`).toBe(true)
      }
    })
  }

  it('hält unregelmässige Einkäufe heraus', () => {
    // Zufallskäufe bei Coop/Migros dürfen nicht als Abo durchgehen.
    const detected = detectRecurring(byId.reto.transactions, { today: TODAY })
    const seriesIds = new Set(
      byId.reto.transactions.filter((tx) => tx.seriesId).map((tx) => normaliseMerchant(tx.text)),
    )
    const falsePositives = detected.filter((entry) => !seriesIds.has(entry.key))
    expect(falsePositives.map((entry) => entry.key)).toEqual([])
  })
})

describe('detectRecurring — Eigenschaften der Reihen', () => {
  const reto = detectRecurring(byId.reto.transactions, { today: TODAY })

  it('erkennt den monatlichen Rhythmus', () => {
    const adobe = reto.find((entry) => entry.key.includes('ADOBE'))!
    expect(adobe.cadence).toBe('monthly')
    expect(adobe.intervalDays).toBeGreaterThanOrEqual(28)
    expect(adobe.intervalDays).toBeLessThanOrEqual(32)
  })

  it('findet die stille Preiserhöhung', () => {
    // Reto' Adobe-Abo steigt im März von 71.90 auf 79.90 (Interview 01).
    const adobe = reto.find((entry) => entry.key.includes('ADOBE'))!
    expect(adobe.priceChange).toBeDefined()
    expect(adobe.priceChange!.from).toBe(-7_190)
    expect(adobe.priceChange!.to).toBe(-7_990)
    expect(adobe.priceChange!.since >= '2026-03-01').toBe(true)
  })

  it('meldet keine Preisänderung, wo der Betrag gleich blieb', () => {
    const spotify = reto.find((entry) => entry.key.includes('SPOTIFY'))!
    expect(spotify.priceChange).toBeUndefined()
  })

  it('trennt Lohn, Dauerauftrag, Rechnung und Abo', () => {
    expect(reto.find((entry) => entry.key.includes('LOHN'))?.kind).toBe('income')
    expect(reto.find((entry) => entry.key.includes('SPARAUFTRAG'))?.kind).toBe('standingOrder')
    expect(reto.find((entry) => entry.key.includes('MIETZINS'))?.kind).toBe('bill')
    expect(reto.find((entry) => entry.key.includes('SPOTIFY'))?.kind).toBe('subscription')
    // Fitnessabo: die Bank verbucht es unter Freizeit, es ist trotzdem ein Abo.
    expect(reto.find((entry) => entry.key.includes('FITNESS'))?.kind).toBe('subscription')
  })

  it('rechnet auf den Monat um', () => {
    const spotify = reto.find((entry) => entry.key.includes('SPOTIFY'))!
    expect(spotify.monthlyAmount).toBeCloseTo(spotify.amount, -2)
  })

  it('sagt die nächste Belastung nach dem letzten Vorkommen voraus', () => {
    for (const entry of reto) {
      expect(entry.nextExpected > entry.lastSeen).toBe(true)
    }
  })

  it('sortiert die teuersten Belastungen nach oben', () => {
    const expenses = reto.filter((entry) => entry.monthlyAmount < 0)
    for (let i = 1; i < expenses.length; i++) {
      expect(expenses[i - 1].monthlyAmount <= expenses[i].monthlyAmount).toBe(true)
    }
  })
})

describe('upcoming', () => {
  it('liefert nur, was im Fenster liegt, chronologisch', () => {
    const series = detectRecurring(byId.bruno.transactions, { today: TODAY })
    const next = upcoming(series, TODAY, 30)
    for (const entry of next) {
      expect(entry.nextExpected >= TODAY).toBe(true)
    }
    for (let i = 1; i < next.length; i++) {
      expect(next[i - 1].nextExpected <= next[i].nextExpected).toBe(true)
    }
  })
})
