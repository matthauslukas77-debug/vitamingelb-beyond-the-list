import { useCallback, useMemo, useRef, useState } from 'react'
import { formatAmount } from '../../lib/money'
import { parseIso } from '../../lib/date'
import type { BalanceTimeline } from '../engine/balance'
import { areaPath, resample, smoothPath, type Pt } from './smooth'

/**
 * Kontostand über die Zeit, zum Abtasten.
 *
 * Links von der Gegenwart liegt, was war — durchgezogen und gefüllt.
 * Rechts liegt, was feststeht — gestrichelt und heller.
 *
 * Mit dem Finger über die Kurve fahren zeigt den Stand an jedem Tag. Das ist
 * der Unterschied zwischen einem Bild und einer Auskunft: Die Frage «wie viel
 * habe ich am 24.?» lässt sich damit direkt stellen.
 */

const W = 358
const H = 168
const PAD_TOP = 16
const PAD_BOTTOM = 20
const PAD_LEFT = 40

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Runde Schrittweite für die Achse — 1, 2 oder 5 mal Zehnerpotenz. */
function niceStep(span: number, targetLines: number): number {
  const raw = span / targetLines
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (magnitude * factor >= raw) return magnitude * factor
  }
  return magnitude * 10
}

/** Kurze Achsenbeschriftung: 12'500 → 12.5k */
function axisLabel(cents: number): string {
  const francs = cents / 100
  if (Math.abs(francs) >= 1000) {
    const k = francs / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return String(Math.round(francs))
}

/** Schmalster Abstand zwischen zwei Monatsnamen, in Einheiten der viewBox.
    «Mär» ist bei 9px Schrift rund 20 Einheiten breit — 34 lässt Luft. */
const MIN_TICK_GAP = 34

/**
 * Monatsnamen ausdünnen, bis sie nebeneinander Platz haben.
 *
 * Bei «Max» liegen gut zwei Jahre auf 318 Einheiten Breite: 25 Monatsnamen mit
 * 13 Einheiten Abstand, die übereinander drucken und unlesbar werden.
 *
 * Ausgedünnt wird mit einer festen Schrittweite — jeder zweite, jeder dritte
 * Monat — und nicht mit «nimm, was noch passt». Ein gleichmässiger Rhythmus
 * liest sich als Achse; ungleiche Abstände sehen nach Zufall aus.
 */
function thinTicks(all: { x: number; label: string }[]): { x: number; label: string }[] {
  if (all.length < 2) return all

  const gap = (all[all.length - 1].x - all[0].x) / (all.length - 1)
  const stride = gap > 0 ? Math.max(1, Math.ceil(MIN_TICK_GAP / gap)) : 1

  return all
    .filter((_, index) => index % stride === 0)
    // Am Rand bliebe der Name halb ausserhalb stehen oder klebte an der
    // Betragsachse — dort lassen wir ihn weg.
    .filter((tick) => tick.x >= PAD_LEFT + 12 && tick.x <= W - 12)
}

export type ChartTone = 'petrol' | 'hellblau'

const TONES: Record<ChartTone, { line: string; ahead: string; fill: string }> = {
  petrol: { line: 'var(--petrol8)', ahead: 'var(--petrol5)', fill: 'var(--petrol6)' },
  hellblau: { line: 'var(--hellblau6)', ahead: 'var(--hellblau3)', fill: 'var(--hellblau4)' },
}

/**
 * Kurze Rückmeldung beim Wechsel des Tages.
 * Auf Android liefert das die Vibration API; iOS Safari kennt sie nicht —
 * dort bleibt es wirkungslos, ohne dass etwas kaputtgeht.
 */
function tick() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(8) } catch { /* nicht unterstützt */ }
  }
}

export function BalanceChart({
  timeline,
  tone = 'petrol',
  id,
}: {
  timeline: BalanceTimeline
  tone?: ChartTone
  /** Eindeutig je Karte — sonst teilen sich zwei Diagramme einen Verlauf. */
  id: string
}) {
  const colors = TONES[tone]
  const { history, forecast, events, low, min, max } = timeline
  const svgRef = useRef<SVGSVGElement>(null)
  const [cursor, setCursor] = useState<number | null>(null)

  const geometry = useMemo(() => {
    const all = [...history, ...forecast]
    if (all.length < 2) return null

    // Die Skala folgt den Daten. Die Null wird nur einbezogen, wenn sie
    // tatsächlich in der Nähe liegt — sonst steht die Kurve im oberen Drittel
    // und darunter ist nur Leere.
    const span = Math.max(max - min, 1)
    const nearZero = min <= 0 || min < span * 0.4
    const bottom = nearZero ? Math.min(0, min - span * 0.1) : min - span * 0.22
    const top = max + span * 0.16

    const plotW = W - PAD_LEFT
    const plotH = H - PAD_TOP - PAD_BOTTOM
    const x = (index: number) => PAD_LEFT + (index / (all.length - 1)) * plotW
    const y = (value: number) => PAD_TOP + (1 - (value - bottom) / (top - bottom)) * plotH

    const pastPts: Pt[] = history.map((point, i) => ({ x: x(i), y: y(point.balance) }))
    const aheadPts: Pt[] = forecast.map((point, i) => ({
      x: x(history.length - 1 + i),
      y: y(point.balance),
    }))

    // Gitterlinien auf runden Beträgen.
    const step = niceStep(top - bottom, 3)
    const lines: number[] = []
    for (let value = Math.ceil(bottom / step) * step; value <= top; value += step) {
      lines.push(value)
    }

    return {
      x, y, all, bottom, top, lines,
      baseline: H - PAD_BOTTOM,
      zeroInRange: bottom <= 0 && top >= 0,
      past: resample(pastPts, 42),
      ahead: resample(aheadPts, 24),
      todayIndex: history.length - 1,
    }
  }, [history, forecast, min, max])

  /** Zeigerposition auf einen Index der Zeitreihe abbilden. */
  const locate = useCallback((clientX: number) => {
    const svg = svgRef.current
    if (!svg || !geometry) return
    const rect = svg.getBoundingClientRect()
    const viewX = ((clientX - rect.left) / rect.width) * W
    const ratio = (viewX - PAD_LEFT) / (W - PAD_LEFT)
    const index = Math.round(ratio * (geometry.all.length - 1))
    const next = Math.max(0, Math.min(geometry.all.length - 1, index))
    setCursor((previous) => {
      if (previous !== next) tick()
      return next
    })
  }, [geometry])

  if (!geometry) return null
  const { x, y, all, baseline, lines, zeroInRange, past, ahead, todayIndex } = geometry

  const activeIndex = cursor ?? todayIndex
  const active = all[activeIndex]
  const activeX = x(activeIndex)
  const activeY = y(active.balance)
  const isForecast = activeIndex > todayIndex

  const lowIndex = all.findIndex((point) => point.date === low.date)
  const lowCritical = low.balance < 0

  const monthFirsts: { x: number; label: string }[] = []
  for (let i = 1; i < all.length; i++) {
    const date = parseIso(all[i].date)
    if (date.getDate() === 1) monthFirsts.push({ x: x(i), label: MONTHS[date.getMonth()] })
  }
  const ticks = thinTicks(monthFirsts)

  const activeDate = parseIso(active.date)
  // Das Etikett steht neben dem Punkt, nicht am oberen Rand — und kippt nach
  // unten, wenn oben kein Platz mehr ist.
  const labelLeft = Math.min(Math.max((activeX / W) * 100, 17), 83)
  const above = activeY > 52
  const labelTop = ((activeY + (above ? -10 : 14)) / H) * 100

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Kontostand-Verlauf und Prognose. Tiefster Stand ${formatAmount(low.balance)} am ${low.date}.`}
        style={{ display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          locate(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') locate(e.clientX)
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId)
          // Ohne Berührung verschwindet das Etikett wieder — es verdeckt sonst
          // den Verlauf und wiederholt nur die Zahl aus der Kopfzeile.
          setCursor(null)
        }}
        onPointerCancel={() => setCursor(null)}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <linearGradient id={`bc-past-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fill} stopOpacity="0.30" />
            <stop offset="100%" stopColor={colors.fill} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`bc-ahead-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.ahead} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colors.ahead} stopOpacity="0" />
          </linearGradient>
        </defs>

        {lines.map((value) => (
          <g key={value}>
            <line x1={PAD_LEFT} y1={y(value)} x2={W} y2={y(value)}
                  stroke="var(--line)" strokeWidth="1" />
            <text x={PAD_LEFT - 6} y={y(value) + 3} textAnchor="end"
                  fontSize="9" fill="var(--text-muted)">
              {axisLabel(value)}
            </text>
          </g>
        ))}

        {zeroInRange && (
          <line x1={PAD_LEFT} y1={y(0)} x2={W} y2={y(0)}
                stroke="var(--danger2)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {ticks.map((tick) => (
          <text key={tick.label + tick.x} x={tick.x} y={H - 5} textAnchor="middle"
                fontSize="9" fill="var(--text-muted)">
            {tick.label}
          </text>
        ))}

        <path d={areaPath(past, baseline)} fill={`url(#bc-past-${id})`} />
        <path d={areaPath(ahead, baseline)} fill={`url(#bc-ahead-${id})`} />
        <path d={smoothPath(past)} fill="none" stroke={colors.line} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothPath(ahead)} fill="none" stroke={colors.ahead} strokeWidth="2"
              strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />

        {/* Gegenwart */}
        <line x1={x(todayIndex)} y1={PAD_TOP - 8} x2={x(todayIndex)} y2={baseline}
              stroke="var(--line-strong)" strokeWidth="1" />

        {/* Was ansteht */}
        {events.map((event) => {
          const index = all.findIndex((point) => point.date === event.date)
          if (index < 0) return null
          return (
            <circle key={event.date + event.label} cx={x(index)} cy={y(all[index].balance)} r="2.6"
                    fill={event.kind === 'income' ? 'var(--info2)' : 'var(--postfinancegelb)'} />
          )
        })}

        {/* Tiefster Punkt */}
        {lowIndex >= 0 && (
          <circle cx={x(lowIndex)} cy={y(low.balance)} r="4"
                  fill={lowCritical ? 'var(--danger3)' : 'var(--petrol8)'} />
        )}

        {/* Abtaststelle — nur während der Berührung */}
        {cursor !== null && (
          <>
            <line x1={activeX} y1={PAD_TOP - 8} x2={activeX} y2={baseline}
                  stroke={colors.line} strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={activeX} cy={activeY} r="5.5" fill="var(--surface-card)"
                    stroke={isForecast ? colors.ahead : colors.line} strokeWidth="2.4" />
          </>
        )}
        {/* Heute bleibt immer markiert */}
        <circle cx={x(todayIndex)} cy={y(all[todayIndex].balance)} r="4"
                fill="var(--surface-card)" stroke={colors.line} strokeWidth="2.2" />
      </svg>

      {cursor !== null && (
        <div
          className="chart__tip"
          style={{
            left: `${labelLeft}%`,
            top: `${labelTop}%`,
            translate: above ? '-50% -100%' : '-50% 0',
          }}
        >
          <span className="chart__tip-value num">{formatAmount(active.balance)}</span>
          <span className="chart__tip-date">
            {activeDate.getDate()}. {MONTHS[activeDate.getMonth()]}
            {isForecast && ' · erwartet'}
          </span>
        </div>
      )}
    </div>
  )
}
