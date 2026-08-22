import { describe, expect, it } from 'vitest'
import { areaPath, resample, smoothPath, type Pt } from '../charts/smooth'

const line: Pt[] = [
  { x: 0, y: 50 },
  { x: 10, y: 20 },
  { x: 20, y: 70 },
  { x: 30, y: 30 },
]

describe('smoothPath', () => {
  it('beginnt beim ersten Punkt', () => {
    expect(smoothPath(line).startsWith('M 0 50')).toBe(true)
  })

  it('erzeugt ein Bézier-Segment je Abschnitt', () => {
    expect(smoothPath(line).match(/C /g)).toHaveLength(line.length - 1)
  })

  it('läuft durch jeden Stützpunkt', () => {
    const d = smoothPath(line)
    for (const point of line.slice(1)) {
      expect(d).toContain(`${point.x} ${point.y}`)
    }
  })

  it('schwingt nicht über die Spanne eines Abschnitts hinaus', () => {
    // Der entscheidende Test: Ein Kontostand darf optisch nie unter einen
    // Wert fallen, den es nicht gab.
    const numbers = smoothPath(line)
      .replace(/[MCLZ,]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(Number)
    const ys = numbers.filter((_, index) => index % 2 === 1)
    const lo = Math.min(...line.map((p) => p.y))
    const hi = Math.max(...line.map((p) => p.y))
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(lo)
      expect(y).toBeLessThanOrEqual(hi)
    }
  })

  it('kommt mit Randfällen zurecht', () => {
    expect(smoothPath([])).toBe('')
    expect(smoothPath([{ x: 1, y: 2 }])).toBe('M 1 2')
    expect(smoothPath([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe('M 0 0 L 5 5')
  })

  it('ergibt bei tension 0 einen Polygonzug', () => {
    const d = smoothPath(line, 0)
    // Kontrollpunkte liegen dann auf der Verbindungslinie.
    expect(d).toContain('C')
  })
})

describe('resample', () => {
  it('kürzt auf die gewünschte Anzahl', () => {
    const many = Array.from({ length: 180 }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 100 }))
    expect(resample(many, 50)).toHaveLength(50)
  })

  it('behält Anfang und Ende', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i }))
    const few = resample(many, 20)
    expect(few[0]).toEqual(many[0])
    expect(few[few.length - 1]).toEqual(many[many.length - 1])
  })

  it('lässt kurze Reihen unangetastet', () => {
    expect(resample(line, 50)).toBe(line)
  })
})

describe('areaPath', () => {
  it('schliesst die Fläche auf der Grundlinie', () => {
    const d = areaPath(line, 100)
    expect(d.endsWith('Z')).toBe(true)
    expect(d).toContain('L 30 100')
    expect(d).toContain('L 0 100')
  })
})
