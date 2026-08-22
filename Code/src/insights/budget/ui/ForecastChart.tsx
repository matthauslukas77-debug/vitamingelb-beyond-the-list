import { formatAmount } from '../../../lib/money'
import type { Projection } from '../forecast'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Zwei Geraden: was der Plan verspricht, und was das bisherige Sparverhalten
 * ergäbe.
 *
 * Von Hand gezeichnetes SVG wie der Donut und die Verlaufskurve — kein
 * Diagrammpaket, damit die Farben exakt den Tokens folgen. Für zwei Geraden
 * braucht es ohnehin nur zwei `<line>`.
 *
 * Die Nulllinie wird gezeigt, sobald eine der beiden Linien sie schneidet.
 * Genau dort steht die Aussage, die zählt: wann das Guthaben aufgebraucht ist.
 */

const W = 320
const H = 130
const PAD_L = 8
const PAD_R = 8
const PAD_T = 12
const PAD_B = 20

export function ForecastChart({
  plan,
  actual,
  months,
}: {
  plan: Projection
  actual: Projection
  months: number
}) {
  const values = [plan.start, plan.at(months), actual.start, actual.at(months), 0]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const x = (month: number) => PAD_L + (month / months) * (W - PAD_L - PAD_R)
  const y = (value: number) => PAD_T + (1 - (value - min) / span) * (H - PAD_T - PAD_B)

  /* Die Nulllinie nur zeigen, wenn sie im Bild liegt — sonst ist sie eine
     Linie am Rand, die nichts bedeutet. */
  const showZero = min < 0 && max > 0

  return (
    <svg
      className="fc"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Guthaben über ${months / 12} Jahre: Plan gegen bisheriges Sparverhalten`}
    >
      {showZero && (
        <line x1={PAD_L} y1={y(0)} x2={W - PAD_R} y2={y(0)} className="fc__zero" />
      )}

      {/* Ist zuerst, damit der Plan darüber liegt. */}
      <line x1={x(0)} y1={y(actual.start)} x2={x(months)} y2={y(actual.at(months))} className="fc__actual" />
      <line x1={x(0)} y1={y(plan.start)} x2={x(months)} y2={y(plan.at(months))} className="fc__plan" />

      <circle cx={x(0)} cy={y(plan.start)} r={3.5} className="fc__dot" />
      <circle cx={x(months)} cy={y(plan.at(months))} r={3.5} className="fc__dot fc__dot--plan" />

      <text x={PAD_L} y={H - 4} className="fc__tick">heute</text>
      <text x={W - PAD_R} y={H - 4} textAnchor="end" className="fc__tick">
        in {months / 12} Jahren
      </text>
    </svg>
  )
}

/** Die Legende darunter — welche Linie welche ist, mit ihrer Endzahl. */
export function ForecastLegend({
  plan,
  actual,
  months,
}: {
  plan: Projection
  actual: Projection
  months: number
}) {
  return (
    <div className="fc-legend">
      <div className="fc-legend__row">
        <span className="fc-legend__dash fc-legend__dash--plan" />
        <span className="fc-legend__label">wenn du das Budget hältst</span>
        <span className="fc-legend__value num">{formatAmount(plan.at(months), { sign: false })}</span>
      </div>
      <div className="fc-legend__row">
        <span className="fc-legend__dash fc-legend__dash--actual" />
        <span className="fc-legend__label">wie die letzten 12 Monate</span>
        <span className="fc-legend__value num">{formatAmount(actual.at(months), { sign: false })}</span>
      </div>
    </div>
  )
}
