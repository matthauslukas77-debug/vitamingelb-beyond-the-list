import type { Currency } from '../data/types'

/**
 * PostFinance schreibt Beträge als `1'234.50` — Apostroph als Tausendertrenner,
 * Vorzeichen als Suffix (`+` Gutschrift, `−` Belastung, echtes Minuszeichen U+2212).
 */
export function formatAmount(cents: number, opts: { sign?: boolean } = {}): string {
  const { sign = true } = opts
  const abs = Math.abs(cents)
  const francs = Math.floor(abs / 100)
  const rappen = String(abs % 100).padStart(2, '0')
  const grouped = String(francs).replace(/\B(?=(\d{3})+(?!\d))/g, '’')
  const body = `${grouped}.${rappen}`
  if (!sign) return body
  return cents < 0 ? `${body}−` : `${body}+`
}

/** `CHF 1'234.50+` — Währung vorangestellt, wie in der App. */
export function formatMoney(cents: number, currency: Currency, opts?: { sign?: boolean }): string {
  return `${currency} ${formatAmount(cents, opts)}`
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
