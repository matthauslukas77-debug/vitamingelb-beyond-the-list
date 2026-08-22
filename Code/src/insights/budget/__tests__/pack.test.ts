import { describe, expect, it } from 'vitest'
import { boundsOf, packCircles, radiusFor, type PackedCircle } from '../pack'
import { bubbleTotals, overshootOf, shareOf, stateOf } from '../ui/BubbleField'

/** Überlappen sich zwei Kreise wirklich — mit etwas Luft für Rundung? */
function overlaps(a: PackedCircle<unknown>, b: PackedCircle<unknown>): boolean {
  const distance = Math.hypot(b.x - a.x, b.y - a.y)
  return distance < a.r + b.r - 1e-6
}

function noOverlaps(circles: PackedCircle<unknown>[]): void {
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const distance = Math.hypot(circles[j].x - circles[i].x, circles[j].y - circles[i].y)
      expect(
        overlaps(circles[i], circles[j]),
        `Kreis ${i} (r=${circles[i].r.toFixed(1)}) und ${j} (r=${circles[j].r.toFixed(1)}) ` +
          `überlappen: Abstand ${distance.toFixed(3)} < ${(circles[i].r + circles[j].r).toFixed(3)}`,
      ).toBe(false)
    }
  }
}

const radii = (values: number[]) => values.map((r, index) => ({ r, data: index }))

describe('Circle Packing', () => {
  it('kommt mit null und einem Kreis zurecht', () => {
    expect(packCircles([])).toEqual([])
    const one = packCircles(radii([12]))
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ x: 0, y: 0, r: 12 })
  })

  it('legt zwei Kreise nebeneinander, nicht ineinander', () => {
    const packed = packCircles(radii([10, 20]))
    noOverlaps(packed)
    expect(Math.hypot(packed[1].x - packed[0].x, packed[1].y - packed[0].y)).toBeCloseTo(30, 6)
  })

  it('lässt bei keiner Grössenverteilung zwei Kreise überlappen', () => {
    const cases: number[][] = [
      [30, 30, 30, 30, 30, 30],                 // alle gleich
      [60, 5, 5, 5, 5, 5],                      // einer dominiert
      [50, 44, 38, 31, 22, 9],                  // typisch für ein Budget
      [1, 2, 3, 5, 8, 13, 21, 34],              // stark gestaffelt
      [40, 40, 3, 40, 3, 40, 3],                // abwechselnd
      Array.from({ length: 19 }, (_, i) => 5 + i * 2), // alle 19 Detailfelder
    ]
    for (const values of cases) {
      const packed = packCircles(radii(values))
      expect(packed, JSON.stringify(values)).toHaveLength(values.length)
      noOverlaps(packed)
    }
  })

  it('behält die Eingabereihenfolge bei, obwohl intern sortiert wird', () => {
    const packed = packCircles([
      { r: 5, data: 'klein' },
      { r: 40, data: 'gross' },
      { r: 20, data: 'mittel' },
    ])
    expect(packed.map((circle) => circle.data)).toEqual(['klein', 'gross', 'mittel'])
    expect(packed[1].r).toBe(40)
  })

  it('liefert bei jedem Lauf dasselbe Ergebnis', () => {
    // Eine Demo, die zweimal anders aussieht, kostet mehr als die letzten
    // Prozent Packungsdichte bringen.
    const input = radii([50, 44, 38, 31, 22, 9])
    const first = packCircles(input)
    for (let i = 0; i < 5; i++) {
      expect(packCircles(input)).toEqual(first)
    }
  })

  it('packt dicht — der Haufen füllt mehr als die Hälfte seines Rechtecks', () => {
    const values = [50, 44, 38, 31, 22, 9]
    const packed = packCircles(radii(values))
    const area = values.reduce((total, r) => total + Math.PI * r * r, 0)
    const box = boundsOf(packed)
    expect(area / (box.width * box.height)).toBeGreaterThan(0.5)
  })

  it('legt die grössten Kreise in die Mitte', () => {
    const packed = packCircles(radii([60, 40, 30, 20, 15, 10]))
    const box = boundsOf(packed)
    const cx = (box.minX + box.maxX) / 2
    const cy = (box.minY + box.maxY) / 2
    const distanceOf = (index: number) => Math.hypot(packed[index].x - cx, packed[index].y - cy)
    // Der grösste liegt näher an der Mitte als der kleinste.
    expect(distanceOf(0)).toBeLessThan(distanceOf(5))
  })
})

describe('Das umschliessende Rechteck', () => {
  it('umfasst jeden Kreis vollständig', () => {
    const packed = packCircles(radii([50, 44, 38, 31, 22, 9]))
    const box = boundsOf(packed)
    for (const circle of packed) {
      expect(circle.x - circle.r).toBeGreaterThanOrEqual(box.minX - 1e-9)
      expect(circle.x + circle.r).toBeLessThanOrEqual(box.maxX + 1e-9)
      expect(circle.y - circle.r).toBeGreaterThanOrEqual(box.minY - 1e-9)
      expect(circle.y + circle.r).toBeLessThanOrEqual(box.maxY + 1e-9)
    }
  })

  it('ist bei leerer Eingabe leer statt unendlich', () => {
    expect(boundsOf([])).toMatchObject({ width: 0, height: 0 })
  })
})

describe('Radius aus Betrag', () => {
  it('macht die Fläche proportional, nicht den Radius', () => {
    // Der häufigste Fehler in Blasendiagrammen: Bei proportionalem Radius
    // sieht das doppelte Budget viermal so gross aus.
    const klein = radiusFor(100, 400, 40, 0)
    const gross = radiusFor(400, 400, 40, 0)
    expect(gross).toBeCloseTo(40, 6)
    // Vierfacher Betrag → doppelter Radius → vierfache Fläche.
    expect(gross / klein).toBeCloseTo(2, 6)
  })

  it('hält den Mindestradius ein, damit auch kleine Posten sichtbar bleiben', () => {
    expect(radiusFor(0, 1000, 40, 8)).toBe(8)
    expect(radiusFor(1, 1000, 40, 8)).toBeGreaterThan(8)
  })

  it('fällt bei einem Maximum von null nicht auf NaN', () => {
    expect(radiusFor(0, 0, 40, 8)).toBe(8)
  })

  it('behandelt einen negativen Betrag wie null', () => {
    expect(radiusFor(-500, 1000, 40, 8)).toBe(8)
  })
})

describe('Der Zustand einer Blase', () => {
  /* Die sechs Stufen des Entwurfs — `states_sheet.png` zeigt genau diese
     Prozentwerte, deshalb stehen sie hier als Prüfpunkte. */
  it('läuft bis zum Limit die Petrol-Rampe hinauf', () => {
    expect(stateOf(0)).toBe('empty')
    expect(stateOf(0.3)).toBe('low')
    expect(stateOf(0.6)).toBe('mid')
    expect(stateOf(0.85)).toBe('high')
  })

  it('wechselt erst kurz vor dem Limit die Achse', () => {
    expect(stateOf(0.9)).toBe('high')
    expect(stateOf(0.97)).toBe('tight')
    expect(stateOf(1)).toBe('tight')
    expect(stateOf(1.35)).toBe('over')
    expect(stateOf(9.2)).toBe('over')
  })

  it('lässt den roten Bogen die Überschreitung messen, nicht den Verbrauch', () => {
    expect(overshootOf(0.5)).toBe(0)
    expect(overshootOf(1)).toBe(0)
    expect(overshootOf(1.35)).toBeCloseTo(0.35, 6)
    // Ab doppelt so viel ist der Bogen voll und hätte nichts mehr zu wachsen.
    expect(overshootOf(2)).toBe(1)
    expect(overshootOf(9.2)).toBe(1)
  })

  it('rechnet ohne Budget keinen Anteil aus, statt durch null zu teilen', () => {
    expect(shareOf({ key: 'taxes', budget: 0, spent: 50_000 })).toBe(0)
    expect(stateOf(shareOf({ key: 'taxes', budget: 0, spent: 50_000 }))).toBe('empty')
  })

  it('summiert Budget und Verbrauch über alle Blasen', () => {
    const totals = bubbleTotals([
      { key: 'reside', budget: 100_000, spent: 95_000 },
      { key: 'health', budget: 50_000, spent: 30_000 },
    ])
    expect(totals).toMatchObject({ budget: 150_000, spent: 125_000 })
    expect(totals.share).toBeCloseTo(125 / 150, 6)
  })
})

describe('Die Skala der Blasen', () => {
  it('richtet sich nach den Budgets, nicht nach dem Verbrauch', () => {
    /* Bruno zahlt im August CHF 13'463 fürs Wohnen bei CHF 1'463 Budget.
       Nähme die Blase den Verbrauch als Grösse, wäre sie neunmal so gross wie
       alle anderen zusammen — und der Ring bedeutete plötzlich zweierlei. */
    const budgets = [115_400, 146_300, 60_000, 81_100, 64_000, 168_300]
    const maxBudget = Math.max(...budgets)
    const packed = packCircles(
      budgets.map((budget, index) => ({ r: radiusFor(budget, maxBudget, 62, 20) + 3, data: index })),
    )
    noOverlaps(packed)
    const radii = packed.map((circle) => circle.r)
    // Kein Kreis ist mehr als doppelt so gross wie der kleinste — die Anzeige
    // bleibt lesbar, auch wenn eine Kategorie neunfach überzogen ist.
    expect(Math.max(...radii) / Math.min(...radii)).toBeLessThan(2)
  })
})
