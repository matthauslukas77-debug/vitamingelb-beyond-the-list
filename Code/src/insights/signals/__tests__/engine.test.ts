import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { NO_MARKINGS, withMarking } from '../../budget/markings'
import { budgetPerCategory, signalsForPersona, suggestedSaving } from '../engine'
import {
  NONE_DISMISSED,
  isDismissed,
  loadDismissed,
  openSignals,
  saveDismissed,
  withDismissed,
  withRestored,
} from '../storage'

const budgetOf = (id: string) => budgetPerCategory(findPersona(id)!, TODAY)
const signalsOf = (id: string, extra = {}) =>
  signalsForPersona(findPersona(id)!, { today: TODAY, budget: budgetOf(id), ...extra })

describe('Signale — Schicht 1', () => {
  it('gibt jedem Signal einen Beleg und eine stabile Id', () => {
    for (const persona of PERSONAS) {
      for (const signal of signalsOf(persona.id)) {
        expect(signal.transactionIds.length, `${persona.id}/${signal.id}`).toBeGreaterThan(0)
        expect(signal.id, persona.id).toContain(':')
        expect(signal.body.length, `${persona.id}/${signal.id}`).toBeGreaterThan(10)
      }
    }
  })

  it('liefert bei jedem Lauf dieselben Signale in derselben Reihenfolge', () => {
    for (const persona of PERSONAS) {
      expect(signalsOf(persona.id)).toEqual(signalsOf(persona.id))
    }
  })

  it('sortiert nach Rang, nicht nach Erkennungsreihenfolge', () => {
    for (const persona of PERSONAS) {
      const scores = signalsOf(persona.id).map((signal) => signal.score)
      expect(scores, persona.id).toEqual([...scores].sort((a, b) => b - a))
    }
  })

  it('findet Retos Bonus und schlägt eine glatte Summe zum Sparen vor', () => {
    const signal = signalsOf('reto').find((entry) => entry.kind === 'incomeExtra')!
    expect(signal.title).toContain('800')
    const save = signal.actions.find((action) => action.kind === 'save')!
    expect(save).toMatchObject({ kind: 'save', amount: 50_000 })
  })

  it('findet Retos still teurer gewordenes Abo', () => {
    const signal = signalsOf('reto').find((entry) => entry.kind === 'priceUp')!
    expect(signal.body).toMatch(/im Jahr/)
    expect(signal.actions.some((action) => action.kind === 'openSeries')).toBe(true)
  })

  it('nennt den Preis auf den Rappen und rechnet das Jahr mit dem Rhythmus', () => {
    /* Der Satz steht auf demselben Bildschirm wie die Liste, in der «71.90 →
       79.90» stehen. Rundete er auf ganze Franken, stritte die Karte mit der
       Zeile darunter — und 12 × 8.00 muss 96.00 ergeben, nicht 94. */
    const signal = signalsOf('reto').find((entry) => entry.kind === 'priceUp')!
    expect(signal.body).toContain('CHF 79.90')
    expect(signal.body).toContain('CHF 71.90')
    expect(signal.body).toContain('CHF 96.00 mehr im Jahr')
  })

  it('fragt bei Ninos zwei Buchungen, statt ein Abo zu behaupten', () => {
    const signal = signalsOf('nino').find((entry) => entry.kind === 'subscriptionSuspect')!
    expect(signal.title).toMatch(/\?$/)
    expect(signal.body).toMatch(/sicher sind wir/)
    // Ein Verdacht steht tiefer als eine Messung.
    expect(signal.confidence).toBeLessThan(0.7)
  })

  it('meldet die Buchungen, die ihr Kategorienbudget sprengen', () => {
    for (const id of ['bruno', 'livia']) {
      const signal = signalsOf(id).find((entry) => entry.kind === 'outlier')!
      expect(signal, id).toBeTruthy()
      expect(signal.actions.some((action) => action.kind === 'classify'), id).toBe(true)
    }
  })

  it('schweigt zu einer Buchung, die schon eingeordnet ist', () => {
    /* Der Kreislauf: Das Signal findet den Ausreisser, der Nutzer ordnet ihn
       ein — und danach fragt die App nicht mehr. Ohne das wäre die Einordnung
       folgenlos und die Karte käme jeden Monat wieder. */
    const bruno = findPersona('bruno')!
    const before = signalsOf('bruno').find((entry) => entry.kind === 'outlier')!
    const markings = withMarking(NO_MARKINGS, before.transactionIds[0], { kind: 'extraordinary' })

    const after = signalsForPersona(bruno, {
      today: TODAY,
      budget: budgetPerCategory(bruno, TODAY, markings),
      markings,
    })
    expect(after.some((entry) => entry.id === before.id)).toBe(false)
  })

  it('lässt Steuern in Ruhe — eine Steuerrate ist kein Ausreisser', () => {
    // Sie werden in der Ableitung ohnehin über die volle Historie geglättet.
    for (const persona of PERSONAS) {
      const taxes = signalsOf(persona.id).filter(
        (entry) => entry.kind === 'outlier' && /Steuern/.test(entry.title),
      )
      expect(taxes, persona.id).toHaveLength(0)
    }
  })

  it('meldet ohne Budget keine Ausreisser, statt zu raten', () => {
    const signals = signalsForPersona(findPersona('bruno')!, { today: TODAY })
    expect(signals.some((entry) => entry.kind === 'outlier')).toBe(false)
  })
})

describe('Jobwechsel und Jahreszahlungen', () => {
  it('macht aus zwei Lohnreihen einen Wechsel statt zwei Meldungen', () => {
    /* Ohne diesen Erkenner zerfällt ein Jobwechsel in «Agentur Meridian ist
       ausgeblieben» und «Neu: Studio Kreis GmbH». Beide stimmen für sich und
       erzählen zusammen das Falsche. */
    for (const id of ['reto', 'nino']) {
      const signals = signalsOf(id)
      const change = signals.find((entry) => entry.kind === 'incomeSwitch')!
      expect(change, id).toBeTruthy()
      expect(change.title, id).toMatch(/mehr im Monat/)
      // Der Beleg umfasst beide Seiten des Wechsels.
      expect(change.transactionIds.length, id).toBeGreaterThan(2)
      // Und keine zweite Meldung über denselben Vorgang.
      expect(signals.filter((entry) => entry.kind === 'newSeries'), id).toHaveLength(0)
    }
  })

  it('meldet den alten Arbeitgeber nicht als ausgeblieben', () => {
    for (const id of ['reto', 'nino']) {
      expect(signalsOf(id).some((entry) => entry.kind === 'missed'), id).toBe(false)
    }
  })

  it('bietet beim Mehrverdienst an, einen Teil beiseitezulegen', () => {
    const change = signalsOf('nino').find((entry) => entry.kind === 'incomeSwitch')!
    const save = change.actions.find((action) => action.kind === 'save')
    expect(save).toMatchObject({ kind: 'save' })
  })

  it('sagt beim dreizehnten Monatslohn, wann er wiederkommt', () => {
    /* Zwei Vorkommen sind keine Reihe — `detectRecurring` verlangt drei. Der
       dreizehnte ist trotzdem ein Termin und keine Überraschung. */
    const signal = signalsOf('bruno').find((entry) => entry.kind === 'incomeAnnual')!
    expect(signal.title).toMatch(/kommen wieder/)
    expect(signal.body).toMatch(/Dezember 2025/)
    expect(signal.body).toMatch(/in \d+ Monaten/)
    // Ein Muster aus zwei Jahren ist kein Versprechen.
    expect(signal.confidence).toBeLessThan(0.7)
  })

  it('kündigt nichts an, was schon fällig gewesen wäre', () => {
    // Läge der nächste Termin in der Vergangenheit, wäre es keine Vorschau.
    for (const persona of PERSONAS) {
      for (const signal of signalsOf(persona.id).filter((entry) => entry.kind === 'incomeAnnual')) {
        expect(signal.body, persona.id).not.toMatch(/in 0 Monaten/)
      }
    }
  })
})

describe('Der Sparvorschlag', () => {
  it('nimmt 60 %, auf hundert Franken gerundet', () => {
    expect(suggestedSaving(80_000)).toBe(50_000)
    expect(suggestedSaving(120_000)).toBe(70_000)
    expect(suggestedSaving(10_000)).toBe(10_000)
  })

  it('schlägt nie mehr vor, als hereingekommen ist', () => {
    for (let amount = 1_000; amount <= 500_000; amount += 1_000) {
      expect(suggestedSaving(amount), String(amount)).toBeLessThanOrEqual(amount)
    }
  })

  it('bleibt bei Kleinbeträgen bei null statt bei Rappen', () => {
    expect(suggestedSaving(500)).toBe(0)
  })
})

describe('Weggeklickte Signale', () => {
  beforeEach(() => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
      },
    })
  })

  it('merkt sich, was erledigt ist, und lässt es sich zurückholen', () => {
    let dismissed = withDismissed(NONE_DISMISSED, 'priceUp:SPOTIFY:2026-03-14', TODAY)
    expect(isDismissed(dismissed, 'priceUp:SPOTIFY:2026-03-14')).toBe(true)
    dismissed = withRestored(dismissed, 'priceUp:SPOTIFY:2026-03-14')
    expect(isDismissed(dismissed, 'priceUp:SPOTIFY:2026-03-14')).toBe(false)
  })

  it('übersteht das Speichern und Laden', () => {
    saveDismissed('reto', withDismissed(NONE_DISMISSED, 'a:b:c', TODAY))
    expect(loadDismissed('reto').ids['a:b:c']).toBe(TODAY)
  })

  it('lässt dieselbe Reihe wieder melden, wenn sie erneut teurer wird', () => {
    /* Die Id trägt das Datum der Änderung. Ein zweiter Preissprung ergibt eine
       neue Id — und die Meldung kommt zu Recht wieder. */
    const dismissed = withDismissed(NONE_DISMISSED, 'priceUp:SPOTIFY:2026-03-14', TODAY)
    expect(isDismissed(dismissed, 'priceUp:SPOTIFY:2026-09-01')).toBe(false)
  })

  it('filtert die offenen Signale für den roten Punkt', () => {
    const signals = signalsOf('reto')
    expect(signals.length).toBeGreaterThan(1)
    const dismissed = withDismissed(NONE_DISMISSED, signals[0].id, TODAY)
    expect(openSignals(signals, dismissed)).toHaveLength(signals.length - 1)
  })
})
