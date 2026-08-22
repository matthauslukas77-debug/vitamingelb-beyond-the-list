import { useMemo } from 'react'
import { formatAmount } from '../../lib/money'
import { parseIso } from '../../lib/date'
import type { BalanceTimeline } from '../engine/balance'
import { areaPath, resample, smoothPath, type Pt } from './smooth'

/**
 * Kontostand über die Zeit.
 *
 * Links von der Gegenwart liegt, was war — durchgezogen und gefüllt.
 * Rechts liegt, was feststeht — gestrichelt und heller. Diese eine Trennung
 * macht aus einer Linie eine Aussage.
 *
 * Farben folgen der App: Gutschriften sind dort blau, also sind es die
 * erwarteten Eingänge auch. Gelb heisst «hier hinschauen».
 */

const W = 358
const H = 148
const PAD_TOP = 14
const PAD_BOTTOM = 22
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function BalanceChart({ timeline }: { timeline: BalanceTimeline }) {
  const { history, forecast, events, low, min, max } = timeline

  const geometry = useMemo(() => {
    const all = [...history, ...forecast]
    if (all.length < 2) return null

    // Etwas Luft, damit die Kurve die Ränder nicht berührt.
    const span = Math.max(max - min, 1)
    const top = max + span * 0.18
    const bottom = Math.min(min - span * 0.12, 0)

    const x = (index: number) => (index / (all.length - 1)) * W
    const y = (value: number) =>
      PAD_TOP + (1 - (value - bottom) / (top - bottom)) * (H - PAD_TOP - PAD_BOTTOM)

    const pastPts: Pt[] = history.map((point, i) => ({ x: x(i), y: y(point.balance) }))
    const aheadPts: Pt[] = forecast.map((point, i) => ({
      x: x(history.length - 1 + i),
      y: y(point.balance),
    }))

    const baseline = H - PAD_BOTTOM
    return {
      x,
      y,
      baseline,
      zeroY: bottom < 0 ? y(0) : null,
      past: resample(pastPts, 46),
      ahead: resample(aheadPts, 26),
      todayX: x(history.length - 1),
      all,
    }
  }, [history, forecast, min, max])

  if (!geometry) return null
  const { past, ahead, baseline, todayX, zeroY, x, y, all } = geometry

  const lowIndex = all.findIndex((point) => point.date === low.date)
  const lowX = lowIndex >= 0 ? x(lowIndex) : todayX
  const lowY = y(low.balance)
  const lowCritical = low.balance < 0

  // Monatswechsel als dezente Beschriftung.
  const ticks: { x: number; label: string }[] = []
  for (let i = 1; i < all.length; i++) {
    const date = parseIso(all[i].date)
    if (date.getDate() === 1 && date.getMonth() % 2 === 0) {
      ticks.push({ x: x(i), label: MONTHS[date.getMonth()] })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      role="img"
      aria-label={`Kontostand-Verlauf und Prognose. Tiefster Stand ${formatAmount(low.balance)}.`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="bc-past" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--petrol6)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--petrol6)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bc-ahead" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--petrol4)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--petrol4)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <text key={tick.label + tick.x} x={tick.x} y={H - 4} textAnchor="middle"
              fontSize="10" fill="var(--text-muted)">
          {tick.label}
        </text>
      ))}

      {zeroY !== null && (
        <line x1="0" y1={zeroY} x2={W} y2={zeroY}
              stroke="var(--danger2)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      )}

      {/* Vergangenheit */}
      <path d={areaPath(past, baseline)} fill="url(#bc-past)" />
      <path d={smoothPath(past)} fill="none" stroke="var(--petrol8)" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />

      {/* Prognose */}
      <path d={areaPath(ahead, baseline)} fill="url(#bc-ahead)" />
      <path d={smoothPath(ahead)} fill="none" stroke="var(--petrol5)" strokeWidth="2"
            strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Die Gegenwart */}
      <line x1={todayX} y1={PAD_TOP - 6} x2={todayX} y2={baseline}
            stroke="var(--line-strong)" strokeWidth="1" />
      <circle cx={todayX} cy={y(history[history.length - 1].balance)} r="4"
              fill="var(--surface-card)" stroke="var(--petrol8)" strokeWidth="2.2" />

      {/* Was ansteht */}
      {events.map((event) => {
        const index = all.findIndex((point) => point.date === event.date)
        if (index < 0) return null
        return (
          <circle
            key={event.date + event.label}
            cx={x(index)}
            cy={y(all[index].balance)}
            r="2.6"
            fill={event.kind === 'income' ? 'var(--info2)' : 'var(--postfinancegelb)'}
          />
        )
      })}

      {/* Der tiefste Punkt */}
      <circle cx={lowX} cy={lowY} r="4.5" fill={lowCritical ? 'var(--danger3)' : 'var(--petrol8)'} />
      <circle cx={lowX} cy={lowY} r="8" fill="none"
              stroke={lowCritical ? 'var(--danger3)' : 'var(--petrol8)'} strokeWidth="1" opacity="0.35" />
    </svg>
  )
}
