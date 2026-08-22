import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY, type Transaction } from '../../../data/types'
import { moneyFlow } from '../flow'
import { deriveForPersona, monthStart, spendByCategory } from '../derive'
import { CATEGORY_KEYS } from '../slots'
import {
  MARKING_VERSION,
  NO_MARKINGS,
  budgetShare,
  extraordinaryIn,
  loadMarkings,
  markingOf,
  saveMarkings,
  splitOf,
  withMarking,
  type Markings,
} from '../markings'

/** Alle Buchungen einer Persona, die als Ausgabe gelten. */
function outgoing(personaId: string): Transaction[] {
  const persona = findPersona(personaId)!
  const context = { accounts: persona.accounts, ownName: persona.name }
  return persona.transactions.filter((tx) => moneyFlow(tx, context).flow === 'out')
}

/** Brunos Anzahlung Heizung: CHF 12'000 am 11.08.2026 bei CHF 1'463 Wohnbudget. */
function brunoHeating(): Transaction {
  return findPersona('bruno')!.transactions.find((tx) => /ANZAHLUNG HEIZUNG/i.test(tx.text))!
}

/**
 * Brunos Generalabonnemente: je rund CHF 3'900, Januar 2025 und Januar 2026.
 * Ein Jahr Mobilität, einmal bezahlt — der Musterfall für «verteilen».
 */
function brunoGas(): Transaction[] {
  return findPersona('bruno')!.transactions.filter((tx) => /GENERALABONNEMENT/i.test(tx.text))
}

/** Das jüngste — es liegt im Ableitungsfenster. */
function brunoGa(): Transaction {
  const all = brunoGas()
  return all[all.length - 1]
}

const FULL = { from: '2000-01-01', to: '2099-12-31' }

describe('Einordnung einer Buchung', () => {
  it('zählt ohne Eintrag normal', () => {
    expect(markingOf(NO_MARKINGS, 'irgendwas')).toEqual({ kind: 'normal' })
  })

  it('nimmt einen Eintrag wieder heraus, statt «normal» zu speichern', () => {
    const marked = withMarking(NO_MARKINGS, 'x', { kind: 'extraordinary' })
    expect(Object.keys(marked.byTransaction)).toEqual(['x'])
    const back = withMarking(marked, 'x', { kind: 'normal' })
    expect(back.byTransaction).toEqual({})
  })

  it('lässt Ausserordentliches nicht ins Budget', () => {
    const tx = brunoHeating()
    expect(budgetShare(tx, { kind: 'normal' }, { from: '2026-08-01', to: '2026-08-31' })).toBe(1_200_000)
    expect(budgetShare(tx, { kind: 'extraordinary' }, { from: '2026-08-01', to: '2026-08-31' })).toBe(0)
  })

  it('legt eine Jahresrechnung auf zwölf Monate um — auch rückwirkend gelesen', () => {
    // Das GA wurde im Januar bezahlt. Im August belastet es das Budget mit
    // einem Zwölftel, obwohl im August keine solche Buchung steht.
    const tx = brunoGa()
    const spread = { kind: 'spread' as const, months: 12 }
    const august = { from: '2026-08-01', to: '2026-08-31' }
    const januar = { from: '2026-01-01', to: '2026-01-31' }

    expect(budgetShare(tx, spread, august)).toBeCloseTo(Math.abs(tx.amount) / 12, 6)
    expect(budgetShare(tx, spread, januar)).toBeCloseTo(Math.abs(tx.amount) / 12, 6)
    // Und im Monat davor gar nicht.
    expect(budgetShare(tx, spread, { from: '2025-12-01', to: '2025-12-31' })).toBe(0)
  })

  it('endet die Verteilung nach der gesetzten Zahl von Monaten', () => {
    const tx = brunoGa()
    expect(tx.date.slice(0, 7)).toBe('2026-01')
    const spread = { kind: 'spread' as const, months: 12 }
    // Januar 2026 plus elf Monate = bis Dezember 2026. Januar 2027 nicht mehr.
    expect(budgetShare(tx, spread, { from: '2026-12-01', to: '2026-12-31' })).toBeGreaterThan(0)
    expect(budgetShare(tx, spread, { from: '2027-01-01', to: '2027-01-31' })).toBe(0)
  })
})

describe('Die Kontrollrechnung — nichts verschwindet', () => {
  /**
   * Die eigentliche Zusage hinter der Einordnung: Geld wird verschoben, nie
   * entfernt. Über die volle Reichweite muss die Summe der Töpfe exakt das
   * ergeben, was das Konto verlassen hat.
   */
  it('geht bei jeder Persona ohne Einordnung auf den Rappen auf', () => {
    for (const persona of PERSONAS) {
      const split = splitOf(outgoing(persona.id), NO_MARKINGS, FULL)
      expect(split.budget, persona.id).toBe(split.outInWindow)
      expect(split.extraordinary, persona.id).toBe(0)
      expect(split.carry, persona.id).toBe(0)
    }
  })

  it('geht auch mit Ausserordentlichem und Verteiltem auf', () => {
    const bruno = findPersona('bruno')!
    const markings = withMarking(
      withMarking(NO_MARKINGS, brunoHeating().id, { kind: 'extraordinary' }),
      brunoGa().id,
      { kind: 'spread', months: 12 },
    )
    const split = splitOf(outgoing('bruno'), markings, FULL)

    expect(split.budget + split.extraordinary + split.carry).toBeCloseTo(split.outInWindow, 6)
    expect(split.carry).toBeCloseTo(0, 6)
    expect(split.extraordinary).toBe(Math.abs(brunoHeating().amount))
    void bruno
  })

  it('verschiebt bei einem engeren Fenster nur, statt zu verlieren', () => {
    /* Ein Fenster, das die Verteilung abschneidet: Der abgeschnittene Teil
       muss als `carry` auftauchen — nicht verschwinden. */
    const markings = withMarking(NO_MARKINGS, brunoGa().id, { kind: 'spread', months: 12 })
    const januar = { from: '2026-01-01', to: '2026-01-31' }
    const split = splitOf(outgoing('bruno'), markings, januar)

    expect(split.budget + split.extraordinary + split.carry).toBeCloseTo(split.outInWindow, 6)
    // Elf Zwölftel des GA liegen ausserhalb des Januars.
    expect(split.carry).toBeCloseTo((Math.abs(brunoGa().amount) * 11) / 12, 6)
  })

  it('summiert sich Monat für Monat auf dasselbe wie über den ganzen Zeitraum', () => {
    const markings = withMarking(NO_MARKINGS, brunoGa().id, { kind: 'spread', months: 12 })
    const out = outgoing('bruno')

    let sum = 0
    for (let year = 2024; year <= 2027; year++) {
      for (let month = 1; month <= 12; month++) {
        const key = `${year}-${String(month).padStart(2, '0')}`
        const last = new Date(year, month, 0).getDate()
        sum += splitOf(out, markings, { from: `${key}-01`, to: `${key}-${last}` }).budget
      }
    }
    expect(sum).toBeCloseTo(splitOf(out, markings, FULL).budget, 4)
  })
})

describe('Wirkung auf Budget und Blasen', () => {
  it('nimmt eine als einmalig eingeordnete Zahlung aus dem Budgetvorschlag', () => {
    /* Brunos Generalabonnement über CHF 3'950 macht rund CHF 329 im Monat
       seines Mobilitätsbudgets aus. Als einmalig eingeordnet fällt es heraus.
       (Ob das *richtig* wäre, ist eine andere Frage — siehe den Test darunter.
       Hier geht es nur darum, dass die Einordnung wirkt.) */
    const bruno = findPersona('bruno')!
    const before = deriveForPersona(bruno, { today: TODAY, months: 12 })
    const after = deriveForPersona(bruno, {
      today: TODAY,
      months: 12,
      markings: withMarking(NO_MARKINGS, brunoGa().id, { kind: 'extraordinary' }),
    })

    const oev = (derived: typeof before) =>
      derived.slots.find((entry) => entry.slot.category === 'mobility' && entry.slot.field === 3)!.monthly

    expect(oev(before) - oev(after)).toBeGreaterThan(30_000)
    expect(after.extraordinaryMonth).toBeGreaterThan(0)
    expect(before.extraordinaryMonth).toBe(0)
  })

  it('lässt «verteilen» den Jahresschnitt in Ruhe und ändert nur den Monat', () => {
    /* Das ist der Kern des Unterschieds zwischen den beiden Antworten.
     *
     * Der Zwölfmonatsschnitt enthält eine Jahresrechnung ohnehin genau
     * einmal — er *verteilt* bereits. Wer alle Vorkommen als «verteilt»
     * einordnet, ändert daran fast nichts: CHF 3'900 im Januar 2025 und
     * CHF 3'950 im Januar 2026 ergeben so oder so rund CHF 328 im Monat.
     *
     * Die laufende Monatsansicht dagegen ändert sich vollständig — dort steht
     * ohne Verteilung im Januar der ganze Betrag und in allen anderen Monaten
     * null. Genau dafür gibt es die Einordnung. */
    const bruno = findPersona('bruno')!
    let markings = NO_MARKINGS
    for (const ga of brunoGas()) markings = withMarking(markings, ga.id, { kind: 'spread', months: 12 })

    const plain = deriveForPersona(bruno, { today: TODAY, months: 12 })
    const spread = deriveForPersona(bruno, { today: TODAY, months: 12, markings })
    const oev = (derived: typeof plain) =>
      derived.slots.find((entry) => entry.slot.category === 'mobility' && entry.slot.field === 3)!.monthly

    expect(Math.abs(oev(plain) - oev(spread))).toBeLessThan(2_000)

    // Der Januar dagegen: ohne Verteilung der volle Betrag, mit einem Zwölftel.
    const januar = { from: '2026-01-01', to: '2026-01-31', ownName: bruno.name }
    const before = spendByCategory(bruno.transactions, bruno.accounts, januar)
    const after = spendByCategory(bruno.transactions, bruno.accounts, { ...januar, markings })
    expect(before.mobility - after.mobility).toBeGreaterThan(300_000)
  })

  it('holt die Wohnblase aus dem Rot zurück', () => {
    const bruno = findPersona('bruno')!
    const window = { from: monthStart(TODAY), to: TODAY, ownName: bruno.name }

    const before = spendByCategory(bruno.transactions, bruno.accounts, window)
    const after = spendByCategory(bruno.transactions, bruno.accounts, {
      ...window,
      markings: withMarking(NO_MARKINGS, brunoHeating().id, { kind: 'extraordinary' }),
    })

    expect(before.reside).toBeGreaterThan(1_200_000)
    expect(after.reside).toBeLessThan(200_000)
  })

  it('zeigt die ausserordentliche Buchung weiterhin — sie ist nicht weg', () => {
    const bruno = findPersona('bruno')!
    const markings = withMarking(NO_MARKINGS, brunoHeating().id, { kind: 'extraordinary' })
    const found = extraordinaryIn(bruno.transactions, markings, { from: monthStart(TODAY), to: TODAY })

    expect(found).toHaveLength(1)
    expect(found[0].text).toMatch(/ANZAHLUNG HEIZUNG/i)
  })

  it('lässt die Kategorien ohne Einordnung unverändert', () => {
    for (const persona of PERSONAS) {
      const plain = deriveForPersona(persona, { today: TODAY, months: 12 })
      const empty = deriveForPersona(persona, { today: TODAY, months: 12, markings: NO_MARKINGS })
      for (const key of CATEGORY_KEYS) {
        expect(empty.categoryTotals[key], `${persona.id}/${key}`).toBe(plain.categoryTotals[key])
      }
    }
  })
})

describe('Speicherung', () => {
  beforeEach(() => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => map.get(key) ?? null,
        setItem: (key: string, value: string) => void map.set(key, value),
        removeItem: (key: string) => void map.delete(key),
      },
    })
  })

  it('übersteht das Speichern und Laden', () => {
    saveMarkings('bruno', withMarking(NO_MARKINGS, 'tx-1', { kind: 'spread', months: 24 }))
    expect(loadMarkings('bruno').byTransaction['tx-1']).toEqual({ kind: 'spread', months: 24 })
  })

  it('verwirft eine ältere Fassung, statt sie halb zu lesen', () => {
    window.localStorage.setItem(
      'beyond-the-list.markings.bruno',
      JSON.stringify({ version: MARKING_VERSION - 1, byTransaction: { 'tx-1': { kind: 'extraordinary' } } }),
    )
    expect(loadMarkings('bruno')).toEqual(NO_MARKINGS)
  })

  it('hält die App am Leben, wenn der Speicher gesperrt ist', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('gesperrt') },
        setItem: () => { throw new Error('gesperrt') },
      },
    })
    expect(loadMarkings('bruno')).toEqual(NO_MARKINGS)
    expect(() => saveMarkings('bruno', NO_MARKINGS as Markings)).not.toThrow()
  })
})
