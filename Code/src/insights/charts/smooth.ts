/**
 * Glatte Kurve durch eine Punktreihe.
 *
 * Catmull-Rom-Splines laufen exakt durch jeden Stützpunkt und lassen sich
 * direkt in kubische Bézier-Segmente umrechnen — das ist es, was einer
 * SVG-Kurve ihre weiche Form gibt.
 *
 * Mit einer Einschränkung: Ein ungebremster Spline schwingt zwischen zwei
 * Punkten über. Bei einem Kontostand hiesse das, die Kurve fällt sichtbar
 * unter einen Wert, den es nie gab. Deshalb werden die Kontrollpunkte auf die
 * Spanne des jeweiligen Segments begrenzt. Die Kurve bleibt weich, kann aber
 * nichts behaupten, was in den Daten nicht steht.
 */

export interface Pt {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/**
 * Reduziert eine lange Reihe auf `count` Stützpunkte.
 * Tageswerte eines Kontos sind eine Treppe; direkt geglättet ergibt das
 * unruhige Zacken. Vorher zusammenfassen ergibt die ruhige Welle.
 */
export function resample(points: Pt[], count: number): Pt[] {
  if (points.length <= count) return points
  const out: Pt[] = []
  const step = (points.length - 1) / (count - 1)
  for (let i = 0; i < count; i++) {
    const position = i * step
    const low = Math.floor(position)
    const high = Math.min(low + 1, points.length - 1)
    const t = position - low
    out.push({
      x: points[low].x + (points[high].x - points[low].x) * t,
      y: points[low].y + (points[high].y - points[low].y) * t,
    })
  }
  return out
}

/**
 * Baut den SVG-Pfad. `tension` 0 ergibt einen Polygonzug, 1 die volle
 * Catmull-Rom-Rundung; 0.85 kommt der Vorlage am nächsten.
 */
export function smoothPath(points: Pt[], tension = 0.85): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  const round = (n: number) => Math.round(n * 100) / 100
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? points[i + 1]

    const lo = Math.min(p1.y, p2.y)
    const hi = Math.max(p1.y, p2.y)

    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = clamp(p1.y + ((p2.y - p0.y) / 6) * tension, lo, hi)
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = clamp(p2.y - ((p3.y - p1.y) / 6) * tension, lo, hi)

    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`
  }

  return d
}

/** Derselbe Pfad, unten geschlossen — für die Fläche unter der Kurve. */
export function areaPath(points: Pt[], baselineY: number, tension = 0.85): string {
  if (points.length < 2) return ''
  const line = smoothPath(points, tension)
  const first = points[0]
  const last = points[points.length - 1]
  const round = (n: number) => Math.round(n * 100) / 100
  return `${line} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(baselineY)} Z`
}
