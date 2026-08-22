import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../../data/personas'
import { LOGO_BACKGROUNDS } from '../../../data/logo-backgrounds'
import { TODAY } from '../../../data/types'
import { CATEGORY_KEYS } from '../../budget/slots'
import { merchantFlow, periodStart, type Period } from '../merchantFlow'

const persona = PERSONAS[0]
const base = { transactions: persona.transactions, accounts: persona.accounts, today: TODAY }

describe('periodStart', () => {
  it('spannt Woche, Monat und Jahr auf', () => {
    expect(periodStart('2026-08-22', 'week')).toBe('2026-08-16')
    expect(periodStart('2026-08-22', 'month')).toBe('2026-07-24')
    expect(periodStart('2026-08-22', 'year')).toBe('2025-08-23')
  })

  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(periodStart('2026-01-03', 'week')).toBe('2025-12-28')
  })
})

describe('merchantFlow', () => {
  it('bleibt im Zeitfenster', () => {
    const result = merchantFlow({ ...base, period: 'month' })
    expect(result.from).toBe(periodStart(TODAY, 'month'))
    expect(result.to).toBe(TODAY)
  })

  it('sortiert die grössten Empfänger nach vorn', () => {
    const { merchants } = merchantFlow({ ...base, period: 'year' })
    expect(merchants.length).toBeGreaterThan(3)
    for (let i = 1; i < merchants.length; i++) {
      expect(merchants[i - 1].total).toBeGreaterThanOrEqual(merchants[i].total)
    }
  })

  it('zählt keine Überträge auf eigene Konten mit', () => {
    // Ein Sparauftrag ist kein Empfänger — er taucht in keiner Blase auf.
    const { merchants, rest } = merchantFlow({ ...base, period: 'year', limit: 40 })
    const labels = [...merchants, ...(rest ? [rest] : [])].map((m) => m.label.toLowerCase())
    for (const label of labels) {
      expect(label).not.toContain('sparauftrag')
      expect(label).not.toContain('übertrag')
    }
  })

  it('fasst über das Limit hinaus zusammen', () => {
    const result = merchantFlow({ ...base, period: 'year', limit: 5 })
    expect(result.merchants).toHaveLength(5)
    expect(result.rest).toBeDefined()
    expect(result.rest!.total).toBeGreaterThan(0)
    // Die Summe bleibt vollständig, egal wie das Limit gewählt ist.
    const wide = merchantFlow({ ...base, period: 'year', limit: 99 })
    expect(result.total).toBe(wide.total)
  })

  it('summiert Filialen derselben Marke zusammen', () => {
    // Coop Bern Bahnhof und Coop Pronto sind derselbe Empfänger.
    const { merchants, rest } = merchantFlow({ ...base, period: 'year', limit: 40 })
    const all = [...merchants, ...(rest ? [rest] : [])]
    const keys = all.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gibt Bargeld eine eigene Blase', () => {
    const cash = PERSONAS.flatMap((p) =>
      merchantFlow({ transactions: p.transactions, accounts: p.accounts, today: TODAY, period: 'year', limit: 40 })
        .merchants.filter((m) => m.isCash),
    )
    if (cash.length > 0) expect(cash[0].label).toBe('Bargeld')
  })

  it('trägt Logos, wo die Registry die Marke kennt', () => {
    const { merchants } = merchantFlow({ ...base, period: 'year' })
    expect(merchants.filter((m) => m.logo).length).toBeGreaterThan(0)
  })

  it('liefert für jede Persona und jedes Fenster ein Ergebnis', () => {
    for (const p of PERSONAS) {
      for (const period of ['week', 'month', 'year'] as Period[]) {
        const result = merchantFlow({
          transactions: p.transactions, accounts: p.accounts, today: TODAY, period,
        })
        expect(result.total).toBeGreaterThanOrEqual(0)
        for (const m of result.merchants) {
          expect(m.total).toBeGreaterThan(0)
          expect(m.label.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

/**
 * Was die Blase zum Zeichnen braucht: eine Farbe für die Scheibe und, wo kein
 * Logo bekannt ist, eine Kategorie fürs Sinnbild. Ohne beides stünde dort
 * wieder ein zweibuchstabiges Kürzel.
 */
describe('was die Blase zum Zeichnen braucht', () => {
  it('reicht die gemessene Randfarbe des Logos durch', () => {
    const withBg = PERSONAS.flatMap((p) =>
      merchantFlow({
        transactions: p.transactions, accounts: p.accounts, today: TODAY, period: 'year', limit: 40,
      }).merchants.filter((m) => m.bg),
    )
    expect(withBg.length).toBeGreaterThan(0)
    for (const entry of withBg) {
      // Die Farbe ist nicht erfunden: Sie steht unter dem Dateinamen des Logos.
      const file = entry.logo!.replace('/logos/', '')
      expect(entry.bg).toBe(LOGO_BACKGROUNDS[file])
    }
  })

  it('gibt jedem Empfänger die Kategorie, in der er am schwersten wiegt', () => {
    for (const p of PERSONAS) {
      const { merchants } = merchantFlow({
        transactions: p.transactions, accounts: p.accounts, today: TODAY, period: 'year', limit: 40,
      })
      expect(merchants.length).toBeGreaterThan(0)
      for (const entry of merchants) {
        expect(CATEGORY_KEYS).toContain(entry.category)
      }
    }
  })

  it('lässt die Sammelblase ohne Kategorie — sie ist keine', () => {
    const { rest } = merchantFlow({
      transactions: PERSONAS[0].transactions, accounts: PERSONAS[0].accounts,
      today: TODAY, period: 'year', limit: 3,
    })
    expect(rest?.category).toBeUndefined()
  })
})
