import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../data/types'
import type { RecurringSeries } from '../../domain/recurring'
import {
  amountPhases,
  dataWindowStart,
  durationLabel,
  monthsBetween,
  seriesTenure,
} from '../engine/tenure'

function tx(id: string, date: string, amount: number): Transaction {
  return { id, accountId: 'a', date, text: 'SPOTIFY AB', amount, currency: 'CHF', category: 'subscriptions' }
}

/** Zwei Jahre Spotify, im März 2025 von 10.95 auf 12.95 erhöht. */
const bookings: Transaction[] = []
for (let i = 0; i < 24; i++) {
  const month = ((8 + i) % 12) + 1
  const year = 2024 + Math.floor((8 + i) / 12)
  const iso = `${year}-${String(month).padStart(2, '0')}-14`
  bookings.push(tx(`s${i}`, iso, iso >= '2025-03-01' ? -1295 : -1095))
}

const series: RecurringSeries = {
  key: 'SPOTIFY AB',
  label: 'SPOTIFY AB',
  kind: 'subscription',
  category: 'subscriptions',
  cadence: 'monthly',
  intervalDays: 30,
  amount: -1295,
  monthlyAmount: -1295,
  occurrences: bookings.length,
  firstSeen: bookings[0].date,
  lastSeen: bookings[bookings.length - 1].date,
  nextExpected: '2026-09-14',
  priceChange: { from: -1095, to: -1295, since: '2025-03-14' },
  transactionIds: bookings.map((entry) => entry.id),
}

describe('monthsBetween', () => {
  it('zählt kalendarisch, nicht in 30-Tage-Blöcken', () => {
    expect(monthsBetween('2024-02-14', '2024-08-14')).toBe(6)
  })

  it('zählt den laufenden Monat erst, wenn der Tag erreicht ist', () => {
    expect(monthsBetween('2024-02-14', '2024-08-13')).toBe(5)
  })

  it('wird nie negativ', () => {
    expect(monthsBetween('2026-08-22', '2024-01-01')).toBe(0)
  })
})

describe('durationLabel', () => {
  it('bleibt unter einem Monat bei Tagen', () => {
    expect(durationLabel(14, 0)).toBe('14 Tage')
  })

  it('nennt den Einzahl-Monat', () => {
    expect(durationLabel(31, 1)).toBe('1 Monat')
  })

  it('nennt Jahre und Restmonate', () => {
    expect(durationLabel(910, 29)).toBe('2 Jahre 5 Monate')
  })

  it('lässt den Rest weg, wenn er null ist', () => {
    expect(durationLabel(730, 24)).toBe('2 Jahre')
  })
})

describe('amountPhases', () => {
  it('fasst gleiche Beträge zusammen und trennt bei der Erhöhung', () => {
    const phases = amountPhases(bookings.map((b) => ({ date: b.date, amount: b.amount })))
    expect(phases).toHaveLength(2)
    expect(phases[0].amount).toBe(-1095)
    expect(phases[1].amount).toBe(-1295)
    expect(phases[0].count + phases[1].count).toBe(bookings.length)
  })

  it('erzeugt für eine Rundungsdifferenz keinen neuen Abschnitt', () => {
    const phases = amountPhases([
      { date: '2026-01-01', amount: -1295 },
      { date: '2026-02-01', amount: -1296 },
    ])
    expect(phases).toHaveLength(1)
    expect(phases[0].count).toBe(2)
  })
})

describe('seriesTenure', () => {
  const opts = { today: '2026-08-22', windowStart: '2024-09-01' }

  it('summiert genau die Buchungen der Reihe', () => {
    const t = seriesTenure(series, bookings, opts)
    expect(t.occurrences).toBe(24)
    expect(t.total).toBe(bookings.reduce((sum, b) => sum + b.amount, 0))
  })

  it('ignoriert fremde Buchungen mit gleichem Text', () => {
    const withStranger = [...bookings, tx('fremd', '2026-08-20', -9900)]
    expect(seriesTenure(series, withStranger, opts).occurrences).toBe(24)
  })

  it('nennt die Dauer in Jahren und Monaten', () => {
    expect(seriesTenure(series, bookings, opts).label).toBe('1 Jahr 11 Monate')
  })

  /* Ein gekündigtes Abo, ein alter Arbeitgeber: Der Zeitraum endet mit der
     letzten Zahlung. Bis heute weiterzuzählen hiesse, eine Reihe wachsen zu
     lassen, die es nicht mehr gibt. */
  it('zählt bei beendeten Reihen nur bis zur letzten Buchung', () => {
    const ended = { ...series, lastSeen: '2026-02-25', nextExpected: '2026-03-27' }
    expect(seriesTenure(ended, bookings, opts).label).toBe('1 Jahr 5 Monate')
  })

  it('zählt bis heute, solange die nächste Buchung noch aussteht', () => {
    const live = { ...series, nextExpected: '2026-08-25' }
    expect(seriesTenure(live, bookings, opts).label).toBe('1 Jahr 11 Monate')
  })

  it('markiert den Rand des Datenfensters', () => {
    expect(seriesTenure(series, bookings, opts).atWindowEdge).toBe(true)
  })

  it('markiert nicht, was mitten im Fenster beginnt', () => {
    const t = seriesTenure(series, bookings, { ...opts, windowStart: '2023-01-01' })
    expect(t.atWindowEdge).toBe(false)
  })

  it('rechnet den Jahresbetrag aus dem Rhythmus, nicht aus dem Median-Abstand', () => {
    // 12 × 12.95 — die Zahl muss im Kopf aufgehen.
    expect(seriesTenure(series, bookings, opts).perYear).toBe(-15540)
  })

  it('rechnet die Erhöhung mit derselben Häufigkeit wie den Jahresbetrag', () => {
    // 2.00 mehr, zwölfmal im Jahr. Muss zum Jahresbetrag passen, sonst gehen
    // die beiden Zahlen auf dem Bildschirm nicht zusammen auf.
    const t = seriesTenure(series, bookings, opts)
    expect(t.extraPerYear).toBe(2400)
    // Der alte Preis, zwölfmal: der Jahresbetrag minus die Mehrkosten.
    expect(t.perYear + (t.extraPerYear ?? 0)).toBe(-1095 * 12)
  })
})

describe('dataWindowStart', () => {
  it('findet das früheste Datum', () => {
    expect(dataWindowStart(bookings)).toBe('2024-09-14')
  })
})
