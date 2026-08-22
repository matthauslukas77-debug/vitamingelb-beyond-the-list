import { describe, expect, it } from 'vitest'
import { addDays, formatDate, formatDayHeading, formatMonth, formatMonthShort,
  formatUntil, formatWeekdayDate, toIso } from '../date'

describe('addDays', () => {
  it('rechnet über Monatsgrenzen', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('rechnet über Jahresgrenzen', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
  })
})

describe('formatDate', () => {
  it('schreibt Schweizer Datumsformat mit führenden Nullen', () => {
    expect(formatDate('2026-08-05')).toBe('05.08.2026')
  })
})

describe('formatDayHeading', () => {
  const today = '2026-08-22'
  it('benennt heute und gestern', () => {
    expect(formatDayHeading(today, today)).toBe('Heute')
    expect(formatDayHeading('2026-08-21', today)).toBe('Gestern')
  })

  it('schreibt ältere Tage aus', () => {
    expect(formatDayHeading('2026-08-14', today)).toBe('14. August 2026')
  })
})

describe('formatMonth', () => {
  it('nennt Monat und Jahr', () => {
    expect(formatMonth('2026-06-01')).toBe('Juni 2026')
  })
})

describe('toIso', () => {
  it('bleibt ohne Zeitzonenverschiebung stabil', () => {
    expect(toIso(new Date(2026, 0, 1))).toBe('2026-01-01')
  })
})

describe('formatWeekdayDate', () => {
  /* Der Wochentag ist im Zahlungsfluss die eigentliche Aussage: Er zeigt,
     warum eine Zahlung am Samstag erst am Montag ausgeführt wird. */
  it('stellt den Wochentag vor das Datum', () => {
    expect(formatWeekdayDate('2026-08-22')).toBe('Samstag, 22.08.2026')
    expect(formatWeekdayDate('2026-08-24')).toBe('Montag, 24.08.2026')
  })
})

describe('formatMonthShort', () => {
  it('kürzt die langen Monatsnamen ab', () => {
    expect(formatMonthShort('2024-09-02')).toBe('Sept. 2024')
    expect(formatMonthShort('2026-03-01')).toBe('März 2026')
  })
})

describe('formatUntil', () => {
  const today = '2026-08-22'

  it('nennt heute und morgen beim Namen', () => {
    expect(formatUntil(today, today)).toBe('heute')
    expect(formatUntil(today, '2026-08-23')).toBe('morgen')
  })

  it('zählt kurze Fristen in Tagen', () => {
    expect(formatUntil(today, '2026-09-02')).toBe('in 11 Tagen')
  })

  /* «in 340 Tagen» beantwortet die Frage vor einem Jahresabo nicht. */
  it('stellt ab zwei vollen Monaten auf Monate um', () => {
    expect(formatUntil(today, '2026-10-22')).toBe('in 2 Monaten')
    expect(formatUntil(today, '2027-01-22')).toBe('in 5 Monaten')
    expect(formatUntil(today, '2027-08-21')).toBe('in 11 Monaten')
    expect(formatUntil(today, '2027-08-22')).toBe('in einem Jahr')
  })

  /* Die Umschaltung hängt an vollen Monaten, nicht an einer Tagesschwelle:
     60 Tage über einen kurzen Monat sind erst ein Monat — «in 1 Monaten»
     darf dabei nicht herauskommen. */
  it('sagt nie «in 1 Monaten»', () => {
    expect(formatUntil('2026-12-01', '2027-01-30')).toBe('in 60 Tagen')
    expect(formatUntil('2026-01-31', '2026-03-30')).toBe('in 58 Tagen')
  })

  it('fällt bei vergangenen Terminen auf heute zurück', () => {
    expect(formatUntil(today, '2026-08-01')).toBe('heute')
  })
})
