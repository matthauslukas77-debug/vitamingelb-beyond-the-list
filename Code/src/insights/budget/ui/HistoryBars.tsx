import type { MonthPoint } from '../history'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Zwölf Monate einer Kategorie als Balken.
 *
 * Die Blase auf der Übersicht sagt, wie voll dieser Monat ist. Sie kann nicht
 * sagen, ob das ungewöhnlich ist — und das ist die erste Frage, die jemand
 * stellt, der sie rot sieht. Ein roter Monat neben elf ruhigen ist ein
 * Ausrutscher. Ein roter Monat neben elf roten ist ein Budget, das nicht
 * stimmt. Dieselbe Farbe, zwei völlig verschiedene Handlungen.
 *
 * Drei Dinge liegen in der Grafik, und mehr soll sie nicht:
 *
 *   **Die Balken** — was in jedem Monat wirklich weg war.
 *   **Die Strichlinie** — der übliche Monat, der Median der abgeschlossenen.
 *   **Der letzte Balken** — angefangen, nicht fertig, und deshalb schraffiert
 *   statt voll. Ein halber Monat, der neben ganzen als niedriger Balken steht,
 *   ist die häufigste stille Lüge in solchen Grafiken.
 *
 * Von Hand gezeichnet wie Donut, Blasen und Verlaufskurve — die App hat keine
 * Diagrammbibliothek, und für zwölf Rechtecke braucht sie auch keine.
 */

/* Das Koordinatensystem. Breite und Höhe sind Verhältnisse, keine Pixel: Das
   SVG skaliert über `width: 100%`. */
const WIDTH = 320
const HEIGHT = 96
/** Platz unter der Grundlinie für die Monatsbeschriftung. */
const FOOT = 16
const GAP = 4
/** Damit ein Monat mit 0 nicht ganz verschwindet. */
const MIN_BAR = 1.5

export function HistoryBars({
  points,
  typical,
  format,
}: {
  points: MonthPoint[]
  /** Der übliche Monat, Rappen — die Strichlinie. 0 blendet sie aus. */
  typical: number
  /** Rappen → Text, für die Beschriftung der Strichlinie. */
  format: (rappen: number) => string
}) {
  if (points.length === 0) return null

  /* Die Skala richtet sich nach dem grössten Monat **und** der Strichlinie:
     Läge die Linie über allen Balken, stünde sie sonst ausserhalb des Bildes. */
  const peak = Math.max(...points.map((point) => point.spent), typical, 1)
  const plot = HEIGHT - FOOT
  const slot = WIDTH / points.length
  const bar = slot - GAP

  const y = (rappen: number) => plot - Math.max(MIN_BAR, (rappen / peak) * plot)
  const line = plot - (typical / peak) * plot

  const summary = points
    .map((point) => `${point.month}: ${format(point.spent)}${point.partial ? ', laufend' : ''}`)
    .join('. ')

  return (
    <svg
      className="hbar"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Verlauf über ${points.length} Monate. ${summary}.`}
    >
      {/* Die Schraffur des laufenden Monats. Ein eigenes Muster statt einer
          blassen Füllung: Blass liest sich als «wenig», schraffiert als
          «noch nicht fertig», und genau das ist gemeint. */}
      <defs>
        <pattern id="hbar-partial" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" className="hbar__hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="5" className="hbar__hatch" />
        </pattern>
      </defs>

      {points.map((point, index) => {
        const x = index * slot + GAP / 2
        const top = y(point.spent)
        return (
          <g key={point.month}>
            <rect
              className={'hbar__bar' + (point.partial ? ' hbar__bar--partial' : '')}
              x={x}
              y={top}
              width={bar}
              height={plot - top}
              rx="2"
            />
            {/* Nur jeder dritte Monat wird beschriftet, der laufende immer.
                Zwölf Beschriftungen nebeneinander sind auf einem Telefon eine
                graue Linie und keine Achse. */}
            {(point.partial || index % 3 === 0) && (
              <text className="hbar__tick" x={x + bar / 2} y={HEIGHT - 4} textAnchor="middle">
                {monthTick(point.month)}
              </text>
            )}
          </g>
        )
      })}

      {/* Die Grundlinie — ohne sie schweben die Balken. */}
      <line className="hbar__base" x1="0" y1={plot} x2={WIDTH} y2={plot} />

      {typical > 0 && (
        <>
          <line className="hbar__typical" x1="0" y1={line} x2={WIDTH} y2={line} />
          <text className="hbar__typical-label" x="0" y={Math.max(9, line - 4)}>
            üblich {format(typical)}
          </text>
        </>
      )}
    </svg>
  )
}

const TICKS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/**
 * Ein Buchstabe pro Monat, im Januar die Jahreszahl dazu.
 *
 * Auf 320 Einheiten Breite ist «Sept.» kein Achsenbeschriftung, sondern ein
 * Balken aus Text. Der Jahreswechsel ist die einzige Stelle, an der mehr nötig
 * ist — sonst weiss niemand, ob der Januar vorne oder hinten liegt.
 */
function monthTick(month: string): string {
  const [year, index] = month.split('-').map(Number)
  return index === 1 ? `${TICKS[0]} ${String(year).slice(2)}` : TICKS[index - 1]
}
