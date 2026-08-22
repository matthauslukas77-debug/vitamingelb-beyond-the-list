import { describe, expect, it } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { deriveForPersona, monthProgress, monthStart, spendByCategory } from '../derive'
import { CATEGORY_KEYS, SLOT_COUNT, slotKey } from '../slots'
import { categorize } from '../mapping'

const options = { today: TODAY, months: 12 }

describe('Budget aus Buchungen ableiten', () => {
  it('liefert für jede Persona alle neunzehn Felder', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      expect(derived.slots, persona.id).toHaveLength(SLOT_COUNT)
      // Kein Feld doppelt.
      const keys = new Set(derived.slots.map((entry) => slotKey(entry.slot)))
      expect(keys.size, persona.id).toBe(SLOT_COUNT)
    }
  })

  it('rechnet die Kategorien als Summe ihrer Felder — die Anzeige kann nicht abweichen', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      for (const key of CATEGORY_KEYS) {
        const fromSlots = derived.slots
          .filter((entry) => entry.slot.category === key)
          .reduce((total, entry) => total + entry.monthly, 0)
        expect(derived.categoryTotals[key], `${persona.id}/${key}`).toBe(fromSlots)
      }
      const sum = CATEGORY_KEYS.reduce((total, key) => total + derived.categoryTotals[key], 0)
      expect(derived.expensesMonth, persona.id).toBe(sum)
    }
  })

  it('lässt den Dauerauftrag aufs eigene Sparkonto aus den Ausgaben heraus', () => {
    // Livia, Interview 05: «500 Franken aufs Sparkonto — dann ist das wie
    // quasi als Ausgabe, obwohl es eigentlich gar nicht aus ist.»
    const livia = findPersona('livia')!
    const derived = deriveForPersona(livia, options)

    expect(derived.actualSavedMonth).toBeGreaterThan(40_000)
    expect(derived.flow.avoidedDoubleCount).toBeGreaterThan(0)
    // Und die naive Summe liegt genau um die Verschiebungen darüber.
    expect(derived.flow.naiveExpenses).toBeGreaterThan(derived.flow.realExpenses)
  })

  it('führt Brunos Säule 3a als Vorsorgebeitrag, nicht als Verschiebung', () => {
    const bruno = findPersona('bruno')!
    const derived = deriveForPersona(bruno, options)
    const provision = derived.slots.find((entry) => slotKey(entry.slot) === 'insurance.1')!
    expect(provision.monthly).toBeGreaterThan(0)
  })

  it('erkennt Brunos Steuerkanton aus der Steuerbuchung', () => {
    const derived = deriveForPersona(findPersona('bruno')!, options)
    expect(derived.detectedCanton?.canton).toBe('BE')
    expect(derived.detectedCanton?.evidence).toMatch(/Steuer/i)
  })

  it('fragt nach dem Kanton, wo keine Steuerbuchung steht', () => {
    const derived = deriveForPersona(findPersona('livia')!, options)
    expect(derived.detectedCanton).toBeUndefined()
    expect(derived.openQuestions.map((entry) => entry.key)).toContain('canton')
  })

  it('fragt bei allen nach der Lebensform — die steht in keiner Buchung', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      expect(derived.openQuestions.map((entry) => entry.key), persona.id).toContain('civilStatus')
    }
  })

  it('ordnet mindestens 85 % der Ausgabenfranken sicher zu', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      expect(derived.coverage.share, `${persona.id}: ${(derived.coverage.share * 100).toFixed(1)} %`)
        .toBeGreaterThan(0.85)
    }
  })

  it('füllt die Felder, die im Original bei 0 starten', () => {
    // Im Original starten alle neunzehn bei 0. Wie viele wir füllen können,
    // hängt am Haushalt: Reto hat kein Auto, keine Hypothek, keine 3a — bei
    // ihm gibt es schlicht weniger zu füllen. Bruno führt einen ganzen
    // Haushalt und kommt deshalb am weitesten.
    const filled = Object.fromEntries(
      PERSONAS.map((persona) => [persona.id, deriveForPersona(persona, options).filledSlots]),
    )
    for (const [id, count] of Object.entries(filled)) {
      expect(count, `${id}: ${count}`).toBeGreaterThanOrEqual(7)
    }
    expect(filled.bruno, `bruno: ${filled.bruno}`).toBeGreaterThanOrEqual(13)
  })

  it('glättet die Steuern über die volle Historie statt über zwölf Monate', () => {
    // Brunos Schlussrechnung und eine Akontorate fallen zufällig in dasselbe
    // Zwölfmonatsfenster. Ungeglättet wären das CHF 1'883 im Monat — im
    // Fenster daneben CHF 0. Beides wäre falsch.
    const derived = deriveForPersona(findPersona('bruno')!, options)
    const taxes = derived.slots.find((entry) => slotKey(entry.slot) === 'taxes.0')!
    expect(taxes.smoothedOver).toBeGreaterThan(derived.months)
    expect(taxes.monthly).toBeLessThan(150_000)
    expect(taxes.monthly).toBeGreaterThan(0)
  })

  it('legt Jahresrechnungen auf den Monat um, statt sie wegzulassen', () => {
    // Retos Hausratversicherung kommt einmal im Jahr. Ein Feld, das nur in
    // einem von zwölf Monaten auftaucht, muss trotzdem einen Monatsbetrag
    // haben — sonst fehlt es im Budget komplett.
    const derived = deriveForPersona(findPersona('reto')!, options)
    const rare = derived.slots.filter((entry) => entry.monthsSeen > 0 && entry.monthsSeen <= 3)
    for (const entry of rare) expect(entry.monthly, slotKey(entry.slot)).toBeGreaterThan(0)
  })

  it('weist eine einzelne grosse Buchung als bestätigungsbedürftig aus', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      for (const entry of derived.slots) {
        if (entry.needsReview) expect(entry.reviewReason, slotKey(entry.slot)).toBeTruthy()
        else expect(entry.reviewReason).toBeUndefined()
      }
    }
  })

  it('umfasst genau ganze Kalendermonate — der laufende zählt nicht mit', () => {
    // Stichtag ist der 22.08.2026. Ein Fenster, das den angebrochenen August
    // mitrechnet und trotzdem durch 12 teilt, meldet überall zu wenig.
    const derived = deriveForPersona(findPersona('reto')!, { today: TODAY, months: 12 })
    expect(derived.from).toBe('2025-08-01')
    expect(derived.to).toBe('2026-07-31')
    for (const entry of derived.slots) {
      expect(entry.monthsSeen, slotKey(entry.slot)).toBeLessThanOrEqual(derived.months)
    }
  })

  it('erkennt das Einkommen aus echten Gutschriften', () => {
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      expect(derived.incomeMonth, persona.id).toBeGreaterThan(50_000)
      expect(derived.incomeSources[0].label, persona.id).toBeTruthy()
    }
  })
})

describe('Zuordnung auf die Detailfelder', () => {
  const cases: [string, string, string][] = [
    ['CSS Versicherung → Krankenkasse', 'KRANKENKASSE PRAEMIE CSS VERSICHERUNG', 'health.0'],
    ['Mobiliar → Haftpflicht und Hausrat', 'DIE MOBILIAR HAUSRATVERSICHERUNG', 'insurance.0'],
    ['SBB → Öffentlicher Verkehr', 'SBB MOBILE TICKET BERN', 'mobility.3'],
    ['Migrol → Treibstoff', 'MIGROL TANKSTELLE BERN', 'mobility.2'],
    ['Swisscom → Telefon, TV, Internet', 'SWISSCOM SCHWEIZ AG', 'mobility.4'],
    ['Coop → Nahrungsmittel', 'COOP BERN BAHNHOF (CH)', 'consumption.0'],
    ['Zalando → Kleider und Schuhe', 'ZALANDO SE', 'consumption.1'],
    ['Steuerverwaltung → Steuern', 'STEUERVERWALTUNG DES KANTONS BERN', 'taxes.0'],
    ['EWB → Nebenkosten', 'ENERGIE WASSER BERN EWB', 'reside.2'],
  ]

  for (const [name, text, expected] of cases) {
    it(name, () => {
      const result = categorize({
        id: 'x', accountId: 'a', date: '2026-01-01', text,
        amount: -1000, currency: 'CHF', category: 'other',
      })
      expect(slotKey(result)).toBe(expected)
      expect(result.needsReview).toBe(false)
    })
  }

  it('trennt COOP VITALITY (Apotheke) von COOP — längster Treffer gewinnt', () => {
    const apotheke = categorize({
      id: 'x', accountId: 'a', date: '2026-01-01', text: 'COOP VITALITY APOTHEKE BERN',
      amount: -1000, currency: 'CHF', category: 'other',
    })
    expect(slotKey(apotheke)).toBe('health.1')
  })

  it('lässt SPAR nicht in SPARAUFTRAG greifen — nur an Wortgrenzen', () => {
    const result = categorize({
      id: 'x', accountId: 'a', date: '2026-01-01', text: 'SPARAUFTRAG',
      amount: -1000, currency: 'CHF', category: 'transfer',
    })
    expect(slotKey(result)).not.toBe('consumption.0')
  })

  it('gibt Bargeld ehrlich als unsicher aus, statt es zu raten', () => {
    const result = categorize({
      id: 'x', accountId: 'a', date: '2026-01-01', text: 'BARGELDBEZUG POSTOMAT BERN',
      amount: -20_000, currency: 'CHF', category: 'cash',
    })
    expect(result.needsReview).toBe(true)
    expect(result.confidence).toBeLessThan(0.5)
  })
})

describe('Der laufende Monat', () => {
  it('kennt den Monatsfortschritt', () => {
    // Ohne diese Zahl lügt jede Verbrauchsanzeige in der Monatsmitte.
    expect(monthProgress('2026-08-22')).toBeCloseTo(22 / 31, 6)
    expect(monthProgress('2026-02-28')).toBe(1)
    expect(monthProgress('2026-01-01')).toBeCloseTo(1 / 31, 6)
    // Nie über 1, auch wenn ein Datum über das Monatsende hinausliegt.
    expect(monthProgress('2026-04-31')).toBe(1)
  })

  it('beginnt den Monat am Ersten', () => {
    expect(monthStart(TODAY)).toBe('2026-08-01')
  })

  it('rechnet den Verbrauch mit derselben Logik wie die Ableitung', () => {
    /* Zwei Wege zu derselben Zahl wären zwei Wahrheiten über dasselbe Konto.
       Deshalb: derselbe Zeitraum wie die Ableitung muss dieselbe Summe geben. */
    for (const persona of PERSONAS) {
      const derived = deriveForPersona(persona, options)
      const spent = spendByCategory(persona.transactions, persona.accounts, {
        from: derived.from,
        to: derived.to,
        ownName: persona.name,
      })
      for (const key of CATEGORY_KEYS) {
        /* Steuern werden in der Ableitung über die volle Historie geglättet —
           dort darf es abweichen, und genau deshalb steht es hier als Ausnahme. */
        if (key === 'taxes') continue
        /* Die Ableitung rundet je Detailfeld und summiert danach, hier wird
           einmal gerundet. Ein Rappen Unterschied je Feld ist die Folge und
           kein Widerspruch — mehr darf es nicht sein. */
        const perMonth = spent[key] / derived.months
        expect(
          Math.abs(perMonth - derived.categoryTotals[key]),
          `${persona.id}/${key}: ${perMonth} gegen ${derived.categoryTotals[key]}`,
        ).toBeLessThanOrEqual(5)
      }
    }
  })

  it('lässt Umbuchungen auch im Monatsverbrauch draussen', () => {
    /* Livias Dauerauftrag geht am 26. — im laufenden August (Stichtag der 22.)
       ist er also noch nicht gelaufen. Geprüft wird deshalb an einem vollen
       Monat; genau dafür gibt es den Strichring in den Blasen, der sagt, wie
       weit der Monat überhaupt ist. */
    const livia = findPersona('livia')!
    const july = { from: '2026-07-01', to: '2026-07-31', ownName: livia.name }
    const spent = spendByCategory(livia.transactions, livia.accounts, july)

    const total = CATEGORY_KEYS.reduce((sum, key) => sum + spent[key], 0)
    const naive = livia.transactions
      .filter((tx) => tx.date >= july.from && tx.date <= july.to && tx.amount < 0)
      .reduce((sum, tx) => sum - tx.amount, 0)

    expect(naive - total).toBeGreaterThan(40_000)
  })
})
