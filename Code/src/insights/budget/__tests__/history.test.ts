import { describe, expect, it } from 'vitest'
import { PERSONAS, findPersona } from '../../../data/personas'
import { TODAY } from '../../../data/types'
import { monthProgress, monthStart, spendByCategory } from '../derive'
import { categoryHistory, projectedMonth, typicalMonth, type MonthPoint } from '../history'
import { CATEGORY_KEYS } from '../slots'

const point = (month: string, spent: number, partial = false): MonthPoint => ({
  month,
  from: `${month}-01`,
  to: `${month}-28`,
  spent,
  partial,
})

describe('Der Verlauf einer Kategorie', () => {
  it('gibt zwölf Monate, ältester zuerst, laufender zuletzt', () => {
    const history = categoryHistory(findPersona('reto')!, 'consumption', { today: '2026-08-22' })
    expect(history).toHaveLength(12)
    expect(history[0].month).toBe('2025-09')
    expect(history[11].month).toBe('2026-08')
    expect(history.map((entry) => entry.month)).toEqual([...history].sort((a, b) => a.month.localeCompare(b.month)).map((entry) => entry.month))
  })

  it('markiert nur den laufenden Monat als angefangen und schneidet ihn heute ab', () => {
    const history = categoryHistory(findPersona('reto')!, 'consumption', { today: '2026-08-22' })
    expect(history.filter((entry) => entry.partial)).toHaveLength(1)
    expect(history[11].to).toBe('2026-08-22')
    expect(history[10].to).toBe('2026-07-31')
  })

  it('trifft die Monatsenden auch im Februar und im Schaltjahr', () => {
    const reto = findPersona('reto')!
    expect(categoryHistory(reto, 'consumption', { today: '2026-03-05', months: 2 })[0].to).toBe('2026-02-28')
    expect(categoryHistory(reto, 'consumption', { today: '2024-03-05', months: 2 })[0].to).toBe('2024-02-29')
  })

  /**
   * Der Grund, warum der Verlauf über `spendByCategory` geht und nicht über
   * eine eigene, schnellere Schleife: Die Zahl im letzten Balken **muss** die
   * Zahl in der Blase darüber sein. Zwei Wege zu derselben Zahl wären zwei
   * Wahrheiten über dasselbe Konto.
   */
  it('nennt für den laufenden Monat genau das, was auch die Blase zeigt', () => {
    for (const persona of PERSONAS) {
      const spent = spendByCategory(persona.transactions, persona.accounts, {
        from: monthStart(TODAY),
        to: TODAY,
        ownName: persona.name,
      })
      for (const category of CATEGORY_KEYS) {
        const history = categoryHistory(persona, category, { today: TODAY })
        expect(history[history.length - 1].spent, `${persona.id}/${category}`).toBe(spent[category])
      }
    }
  })
})

describe('Der übliche Monat', () => {
  it('ist der Median und nicht der Mittelwert', () => {
    /* Eine Jahresrechnung im März. Der Mittelwert läge bei 2'200, der Median
       bei 100 — und nur Letzterer beantwortet «wie ist es normalerweise». */
    const points = [
      point('2026-01', 100),
      point('2026-02', 100),
      point('2026-03', 12_000),
      point('2026-04', 100),
      point('2026-05', 100),
    ]
    expect(typicalMonth(points)).toBe(100)
  })

  it('mittelt bei gerader Anzahl zwischen den beiden mittleren', () => {
    expect(typicalMonth([point('2026-01', 100), point('2026-02', 300)])).toBe(200)
  })

  it('lässt den angefangenen Monat aussen vor', () => {
    /* Ohne diese Zeile zöge ein am 3. des Monats noch leerer Balken den
       üblichen Monat nach unten — und die Seite meldete jeden Monatsanfang
       als Ausreisser nach oben. */
    const points = [point('2026-06', 500), point('2026-07', 500), point('2026-08', 10, true)]
    expect(typicalMonth(points)).toBe(500)
  })

  it('sagt null, wo es noch keinen abgeschlossenen Monat gibt', () => {
    expect(typicalMonth([point('2026-08', 400, true)])).toBe(0)
    expect(typicalMonth([])).toBe(0)
  })
})

describe('Die Hochrechnung aufs Monatsende', () => {
  it('schreibt das bisherige Tempo linear fort', () => {
    expect(projectedMonth(7_100, 0.71)).toBe(10_000)
    expect(projectedMonth(5_000, 0.5)).toBe(10_000)
  })

  it('rechnet am letzten Tag des Monats nichts mehr hinzu', () => {
    expect(projectedMonth(9_000, 1)).toBe(9_000)
    expect(projectedMonth(9_000, monthProgress('2026-08-31'))).toBe(9_000)
  })

  it('erfindet am Monatsanfang keine Zahl aus einer Division durch null', () => {
    expect(projectedMonth(4_200, 0)).toBe(4_200)
  })
})
