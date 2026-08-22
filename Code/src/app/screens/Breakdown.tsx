import { useMemo } from 'react'
import { TODAY } from '../../data/types'
import {
  computeBreakdown,
  type Breakdown as BreakdownData,
  type BreakdownDirection,
  type BreakdownSlice,
} from '../../domain/breakdown'
import { formatPeriod } from '../../lib/date'
import { formatAmount } from '../../lib/money'
import { useSession } from '../session'
import { Icon, type IconName } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'
import { CircleRow } from '../shell/parts'

/**
 * Einnahmen und Ausgaben im Detail — die beiden Bildschirme hinter den
 * Legendenzeilen der Analysen.
 *
 * Vorlage: fehlendeDetailseiten/einkommen/IMG_1696 (Einnahmen), IMG_1697 und
 * IMG_1698 (Ausgaben) — echte Bildschirmfotos vom August 2026.
 *
 * Aufbau der Vorlage, von oben:
 *   · Kopfzeile mit Zurück, Titel und Reglersymbol
 *   · Auswahl «Kategorien»
 *   · ein Donut, in Segmente pro Oberkategorie geteilt
 *   · in der Mitte Zeitraum, Total und Durchschnitt pro Monat
 *   · der Kreis «Suchen», genau auf der Kante zur weissen Fläche
 *   · darunter je eine Karte pro Oberkategorie mit Sinnbild und Betrag
 *
 * Beide Richtungen teilen sich diese Komponente: In der Vorlage unterscheiden
 * sie sich nur in Titel, Töpfen und Farbrampe.
 */

/** Sinnbild pro Topf, wie in der Vorlage. */
const SLICE_ICONS: Record<string, IconName> = {
  wohnen: 'sofa',
  einkaufen: 'bag',
  leben: 'heartPulse',
  freizeit: 'ball',
  mobilitaet: 'tram',
  finanzen: 'bank',
  einkommen: 'banknoteIn',
  rueckerstattungen: 'banknoteIn',
}

function iconFor(slice: BreakdownSlice, direction: BreakdownDirection): IconName {
  if (SLICE_ICONS[slice.key]) return SLICE_ICONS[slice.key]
  // «Sonstige» gibt es auf beiden Seiten — der Pfeil zeigt die Richtung an.
  return direction === 'income' ? 'banknoteIn' : 'banknoteOut'
}

/**
 * Die Farbe hängt am Rang im vollständigen Topf-Verzeichnis, nicht an der
 * Position in der gefilterten Liste: «Wohnen» ist bei jeder Persona derselbe
 * Ton, auch wenn bei ihr ein Topf leer bleibt.
 *
 * Abgemessen an der Vorlage: Ausgaben laufen die Petrol-Rampe von 9 nach 3
 * hinunter, Einnahmen die Hellblau-Rampe von 8 nach 3.
 */
const RAMPS: Record<BreakdownDirection, string[]> = {
  expenses: ['petrol9', 'petrol8', 'petrol7', 'petrol6', 'petrol5', 'petrol4', 'petrol3'],
  income: ['hellblau8', 'hellblau7', 'hellblau6', 'hellblau5', 'hellblau4', 'hellblau3'],
}

function colorFor(slice: BreakdownSlice, direction: BreakdownDirection): string {
  const ramp = RAMPS[direction]
  return `var(--${ramp[Math.min(slice.rank, ramp.length - 1)]})`
}

/**
 * Der Donut. Ein Ring, ein Segment pro Topf, dazwischen eine schmale Lücke —
 * in der Vorlage sind die Trennstellen deutlich zu sehen.
 *
 * Die Segmente entstehen aus `strokeDasharray`: Jeder Kreis zeichnet genau
 * einen Strich seiner Länge und wird per `strokeDashoffset` an seine Stelle
 * gedreht. Deshalb braucht es kein Diagrammpaket und keine Pfadmathematik.
 */
function Donut({ data }: { data: BreakdownData }) {
  // Abgemessen an der Vorlage: Aussendurchmesser ~290, Ringbreite ~39.
  const size = 290
  const stroke = 39
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  /** Bogenlänge der Lücke zwischen zwei Segmenten. */
  const gap = 4

  let start = 0
  const segments = data.slices.map((slice) => {
    const full = circumference * slice.share
    const offset = start
    start += full
    // Bei einem einzigen Topf gibt es keine Nachbarn — dann auch keine Lücke.
    const length = data.slices.length === 1 ? circumference : Math.max(full - gap, 1)
    return { slice, length, offset }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={
        data.direction === 'income'
          ? 'Einnahmen nach Oberkategorie'
          : 'Ausgaben nach Oberkategorie'
      }
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map(({ slice, length, offset }) => (
          <circle
            key={slice.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorFor(slice, data.direction)}
            strokeWidth={stroke}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
          />
        ))}
      </g>
    </svg>
  )
}

/** Eine Karte der Liste: Scheibe mit Sinnbild, fetter Name, Betrag rechts. */
function SliceCard({ slice, direction }: { slice: BreakdownSlice; direction: BreakdownDirection }) {
  return (
    <div className="slice">
      {/* In der Vorlage sind alle Sinnbilder gleich dunkel — die Segmentfarbe
          steht nur im Donut, nicht in der Liste. */}
      <span className="slice__icon">
        <Icon name={iconFor(slice, direction)} size={29} accent />
      </span>
      <span className="slice__label">{slice.label}</span>
      <span className="slice__amount num">
        <span className="slice__cur">CHF</span> {formatAmount(slice.amount, { sign: false })}
      </span>
    </div>
  )
}

export function Breakdown({ direction }: { direction: BreakdownDirection }) {
  const { persona, pop, push } = useSession()

  // Gleicher Zeitraum wie «Zusammengefasst» in den Analysen: das laufende Jahr.
  const from = `${TODAY.slice(0, 4)}-01-01`
  const data = useMemo(
    () => computeBreakdown(persona.transactions, { direction, from, to: TODAY }),
    [persona, direction, from],
  )

  return (
    <Sheet
      title={direction === 'income' ? 'Einnahmen' : 'Ausgaben'}
      onBack={pop}
      action={<Icon name="sliders" size={20} />}
    >
      <div className="analysis">
        <div className="analysis__top breakdown__top">
          <button className="pill-select" style={{ width: 'auto', margin: '0 auto', padding: '0 24px' }}>
            Kategorien
            <Icon name="chevronDown" size={16} />
          </button>

          <div className="analysis__ring">
            <Donut data={data} />
            <div className="analysis__center">
              <div className="analysis__period">{formatPeriod(data.from, data.to)}</div>
              <div className="analysis__balance num">
                <span style={{ fontWeight: 400 }}>CHF </span>
                {formatAmount(data.total, { sign: false })}
              </div>
              <div className="analysis__period">Durchschnitt pro Monat</div>
              <div className="analysis__avg num">
                <span style={{ fontWeight: 400 }}>CHF </span>
                {formatAmount(data.perMonth, { sign: false })}
              </div>
            </div>
          </div>

          {/* Der Kreis sitzt in der Vorlage auf der Kante zur weissen Fläche. */}
          <div className="breakdown__seam">
            <CircleRow
              actions={[
                { icon: 'search', label: 'Suchen', outline: true, onClick: () => push({ name: 'search' }) },
              ]}
            />
          </div>
        </div>

        <div className="analysis__bottom breakdown__bottom">
          {data.slices.length === 0 ? (
            <p className="empty">
              {direction === 'income'
                ? 'Keine Einnahmen in diesem Zeitraum.'
                : 'Keine Ausgaben in diesem Zeitraum.'}
            </p>
          ) : (
            data.slices.map((slice) => (
              <SliceCard key={slice.key} slice={slice} direction={direction} />
            ))
          )}
        </div>
      </div>
    </Sheet>
  )
}
