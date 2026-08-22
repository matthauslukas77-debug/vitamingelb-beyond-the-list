import { describe, expect, it } from 'vitest'
import { addDays, formatDate, formatDayHeading, formatMonth, toIso } from '../date'

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
