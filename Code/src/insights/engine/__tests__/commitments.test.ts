import { describe, expect, it } from 'vitest'
import type { Account, Transaction } from '../../../data/types'
import type { RecurringSeries } from '../../../domain/recurring'
import type { Signal, SignalKind } from '../../signals/engine'
import { commitmentsOf, gaugeWidths, recurringFinding, sharePercent } from '../commitments'

const TODAY = '2026-08-22'

const ACCOUNTS: Account[] = [
  {
    id: 'priv',
    name: 'Privatkonto',
    iban: 'CH00',
    kind: 'private',
    currency: 'CHF',
    balance: 100_000,
    source: { type: 'postfinance' },
  },
]

/** Nur so viel Kontext, wie `moneyFlow` braucht. */
function totals(series: RecurringSeries[], transactions: Transaction[] = []) {
  return commitmentsOf({ series, transactions, accounts: ACCOUNTS, ownName: 'Livia Berger', today: TODAY })
}

function series(over: Partial<RecurringSeries> & { key: string }): RecurringSeries {
  return {
    label: over.key,
    kind: 'subscription',
    category: 'subscriptions',
    cadence: 'monthly',
    intervalDays: 30,
    amount: -1000,
    monthlyAmount: -1000,
    occurrences: 6,
    firstSeen: '2026-02-01',
    lastSeen: '2026-08-01',
    nextExpected: '2026-09-25',
    transactionIds: [],
    ...over,
  }
}

/** Lohn 8'000, Miete 2'000, Spotify 12.95 — alle erst nach dem 30-Tage-Fenster fällig. */
const BASE: RecurringSeries[] = [
  series({ key: 'LOHN', kind: 'income', category: 'income', amount: 800_000, monthlyAmount: 800_000 }),
  series({ key: 'MIETE', kind: 'standingOrder', category: 'housing', amount: -200_000, monthlyAmount: -200_000 }),
  series({ key: 'SPOTIFY', amount: -1295, monthlyAmount: -1295 }),
]

describe('commitmentsOf', () => {
  it('trennt Ein- und Ausgang nach dem Vorzeichen', () => {
    const sums = totals(BASE)
    expect(sums.fixedMonthly).toBe(-201_295)
    expect(sums.incomingMonthly).toBe(800_000)
  })

  it('rechnet den Anteil auf dem Eingang, nicht auf der Summe', () => {
    const sums = totals(BASE)
    expect(sums.committedShare).toBeCloseTo(201_295 / 800_000, 6)
    expect(sharePercent(sums.committedShare!)).toBe(25)
  })

  it('lässt den Anteil offen, wenn keine Einnahme erkannt ist', () => {
    /* Ohne Nenner gibt es keinen Anteil. Die Karte lässt den Balken dann weg,
       statt eine Bezugsgrösse zu erfinden. */
    const sums = totals(BASE.filter((entry) => entry.kind !== 'income'))
    expect(sums.committedShare).toBeNull()
  })

  it('kann über 100 % gehen', () => {
    const tight = [
      series({ key: 'LOHN', kind: 'income', category: 'income', amount: 100_000, monthlyAmount: 100_000 }),
      series({ key: 'MIETE', kind: 'standingOrder', category: 'housing', amount: -120_000, monthlyAmount: -120_000 }),
    ]
    expect(sharePercent(totals(tight).committedShare!)).toBe(120)
  })

  it('zählt bis Monatsende nur Belastungen in diesem Fenster', () => {
    /* Stichtag ist der 22.08. — das Fenster endet am 31.08. Die Steuerrechnung
       im November liegt weit dahinter, die Reihen der Basis im September. */
    const soon = [
      ...BASE,
      series({ key: 'SALT', amount: -5900, monthlyAmount: -5900, nextExpected: '2026-08-30' }),
      series({ key: 'STEUERN', cadence: 'yearly', intervalDays: 365, amount: -324_000, monthlyAmount: -27_000, nextExpected: '2026-11-30' }),
    ]
    const sums = totals(soon)
    expect(sums.restOfMonth.count).toBe(1)
    expect(sums.restOfMonth.total).toBe(-5900)
  })

  it('nimmt den letzten Tag des Monats mit', () => {
    const last = series({ key: 'MIETE', amount: -200_000, monthlyAmount: -200_000, nextExpected: '2026-08-31' })
    expect(totals([last]).restOfMonth).toEqual({ count: 1, total: -200_000 })
  })

  it('lässt den ersten Tag des nächsten Monats draussen', () => {
    /* Sonst wäre «bis Ende August» eine Zusage, die den September mitrechnet —
       genau der Fehler, den das 30-Tage-Fenster gemacht hat. */
    const next = series({ key: 'MIETE', amount: -200_000, monthlyAmount: -200_000, nextExpected: '2026-09-01' })
    expect(totals([next]).restOfMonth).toEqual({ count: 0, total: 0 })
  })

  it('lässt eine Gutschrift im Fenster aus der Fälligkeitszeile heraus', () => {
    /* Der Lohn fällt oft noch in diesen Monat. Zählte er mit, stünde über einer
       Liste von Verpflichtungen eine Gutschrift. */
    const withPay = [
      series({ key: 'LOHN', kind: 'income', category: 'income', amount: 800_000, monthlyAmount: 800_000, nextExpected: '2026-08-25' }),
      series({ key: 'SALT', amount: -5900, monthlyAmount: -5900, nextExpected: '2026-08-30' }),
    ]
    expect(totals(withPay).restOfMonth).toEqual({ count: 1, total: -5900 })
  })

  it('zählt die Reihen und die Abos darunter', () => {
    const sums = totals(BASE)
    expect(sums.counts).toEqual({ series: 3, subscriptions: 1 })
  })
})

describe('Übertrag auf ein eigenes Konto', () => {
  const order: RecurringSeries = series({
    key: 'DAUERAUFTRAG SPARKONTO',
    kind: 'standingOrder',
    category: 'transfer',
    amount: -50_000,
    monthlyAmount: -50_000,
    transactionIds: ['t1'],
  })
  const booking: Transaction = {
    id: 't1',
    accountId: 'priv',
    date: '2026-08-26',
    text: 'DAUERAUFTRAG SPARKONTO',
    amount: -50_000,
    currency: 'CHF',
    category: 'transfer',
  }
  const income = series({
    key: 'LOHN',
    kind: 'income',
    category: 'income',
    amount: 115_868,
    monthlyAmount: 115_868,
  })

  it('zählt ihn in `fixedMonthly` mit, aber getrennt aus', () => {
    /* Er geht ab — also gehört er in die Summe. Er ist nicht ausgegeben — also
       muss er sich davon abziehen lassen. Beides gleichzeitig. */
    const sums = totals([income, order], [booking])
    expect(sums.fixedMonthly).toBe(-50_000)
    expect(sums.movedMonthly).toBe(-50_000)
  })

  it('lässt ihn ohne Buchung als gewöhnliche Belastung stehen', () => {
    /* Ohne Beleg keine Behauptung: Wer die Buchung nicht sieht, kann nicht
       wissen, wohin das Geld geht. */
    expect(totals([income, order]).movedMonthly).toBe(0)
  })

  it('teilt den Balken in zwei Abschnitte', () => {
    const widths = gaugeWidths(totals([income, order], [booking]))
    expect(widths).toEqual({ spent: 0, moved: 43 })
  })

  it('lässt den Balken bei mehr als 100 % nicht überlaufen', () => {
    const heavy = [
      series({ key: 'LOHN', kind: 'income', category: 'income', amount: 100_000, monthlyAmount: 100_000 }),
      series({ key: 'MIETE', kind: 'standingOrder', category: 'housing', amount: -90_000, monthlyAmount: -90_000 }),
      { ...order, amount: -40_000, monthlyAmount: -40_000 },
    ]
    const widths = gaugeWidths(totals(heavy, [booking]))
    expect(widths.spent + widths.moved).toBe(100)
  })
})

function signal(kind: SignalKind, score: number): Signal {
  return {
    id: `${kind}:${score}`,
    kind,
    title: kind,
    body: '',
    date: '2026-08-01',
    amount: 1000,
    confidence: 0.9,
    transactionIds: [],
    actions: [],
    score,
  }
}

describe('recurringFinding', () => {
  it('nimmt den ersten Treffer, weil die Erkennung nach Rang liefert', () => {
    const found = recurringFinding([signal('priceUp', 90), signal('newSeries', 80)])
    expect(found?.kind).toBe('priceUp')
  })

  it('lässt Befunde weg, die nicht an einer Reihe hängen', () => {
    /* Ein Ausreisser beim Einkaufen ist eine Sache der Analyse. Stünde er
       hier, wäre die Karte über der Abo-Liste beliebig. */
    expect(recurringFinding([signal('outlier', 99), signal('incomeExtra', 98)])).toBeNull()
  })

  it('überspringt Fremdes und findet das Passende dahinter', () => {
    const found = recurringFinding([signal('outlier', 99), signal('missed', 10)])
    expect(found?.kind).toBe('missed')
  })

  it('gibt null, wenn nichts offen ist', () => {
    expect(recurringFinding([])).toBeNull()
  })
})
