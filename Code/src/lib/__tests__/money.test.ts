import { describe, expect, it } from 'vitest'
import { formatAmount, formatMoney, sum } from '../money'

describe('formatAmount', () => {
  it('setzt den Apostroph als Tausendertrenner', () => {
    expect(formatAmount(123_456_78)).toBe('123’456.78+')
  })

  it('nutzt das echte Minuszeichen als Suffix', () => {
    expect(formatAmount(-9_500)).toBe('95.00−')
    expect(formatAmount(-9_500).endsWith('−')).toBe(true)
  })

  it('füllt Rappen zweistellig auf', () => {
    expect(formatAmount(1_205)).toBe('12.05+')
    expect(formatAmount(1_200)).toBe('12.00+')
  })

  it('kann das Vorzeichen weglassen', () => {
    expect(formatAmount(-50_000, { sign: false })).toBe('500.00')
  })

  it('behandelt null ohne Sonderfall', () => {
    expect(formatAmount(0)).toBe('0.00+')
  })
})

describe('formatMoney', () => {
  it('stellt die Währung voran', () => {
    expect(formatMoney(284_050, 'CHF')).toBe('CHF 2’840.50+')
    expect(formatMoney(-1_400_000, 'EUR')).toBe('EUR 14’000.00−')
  })
})

describe('sum', () => {
  it('summiert Rappen ohne Rundungsfehler', () => {
    expect(sum([10, 20, 30])).toBe(60)
    expect(sum([])).toBe(0)
  })
})
