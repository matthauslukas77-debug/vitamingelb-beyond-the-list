import { useId, useMemo, useState, type CSSProperties } from 'react'
import { formatAmount } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { TODAY } from '../../data/types'
import { Icon, type IconName } from '../../app/shell/Icon'
import type { useSession } from '../../app/session'
import { boundsOf, packCircles, radiusFor } from '../budget/pack'
import { categoryDef } from '../budget/slots'
import {
  merchantFlow,
  PERIOD_LABEL,
  type MerchantSpend,
  type Period,
} from '../engine/merchantFlow'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * «Nach Unternehmen» — eine Blase je Empfänger, so gross wie der Betrag.
 *
 * Die Analysen der App fassen nach Kategorie zusammen. Niemand im Interview
 * hat nach Kategorien gefragt. Gefragt wurde nach Empfängern: *«Was ist das
 * Unnötigste, was ich ausgebe?»* (Nino) und *«bei welchen Firmen gebe ich
 * immer wieder Geld aus?»* (Silvan). Ein Logo beantwortet das in einem Blick,
 * eine Kategorie nie — «Lebensmittel 480.–» sagt nicht, dass 300 davon an
 * einen einzigen Laden gingen.
 *
 * **Die Fläche ist proportional, nicht der Radius** — `radiusFor` rechnet über
 * die Wurzel. Bei proportionalem Radius sähe der doppelte Betrag viermal so
 * gross aus; das ist der häufigste Fehler in Blasendiagrammen.
 *
 * **Jede Blase ist eine Scheibe, kein Rahmen.** Sie trägt entweder das Logo
 * der Marke oder — wo keines bekannt ist — das Sinnbild der Kategorie, in der
 * das Geld liegt. Beides folgt der Regel, die die Buchungsliste schon benutzt
 * (`BrandAvatar`): Die Scheibe nimmt die Randfarbe des Logos an, damit eine
 * quadratische Kachel im Kreis keine Kante hinterlässt. Kürzel wie «MI» oder
 * «KR» standen vorher da, wo ein Logo fehlte — sie sind kein Wiedererkennen,
 * sondern ein Rätsel.
 *
 * Zur Barrierefreiheit: Das SVG trägt eine Zusammenfassung, bedient wird über
 * die Liste darunter. Eine Grafik, die man nur mit dem Finger treffen kann,
 * wäre für die Hälfte der Leute keine Anzeige.
 */

const MAX_RADIUS = 62
const MIN_RADIUS = 17
const PADDING = 2.5

const PERIODS: Period[] = ['week', 'month', 'year']

/**
 * Wo das Logo in der Scheibe sitzt: Kantenlänge des Bildes und Radius des
 * Schnitts, beides in Nutzerkoordinaten um den Mittelpunkt der Blase.
 *
 * **Geschnitten wird immer auf der Bildkante**, nie auf der Scheibe. Damit ist
 * ein eckiges Logo im runden Feld strukturell ausgeschlossen — auch dort, wo
 * die Randfarbe nicht gemessen werden konnte, weil das Logo einen Verlauf oder
 * mehrere Farben am Rand hat (`hornbach.svg` etwa). Ein Kreis, der die
 * Bildkante berührt, kappt an den Ecken höchstens zwei Prozent einer breiten
 * Wortmarke: Sie ist eingepasst, liegt also mittig, und der Schnitt trifft nur
 * das, was oben und ganz aussen zugleich steht.
 *
 * Wie viel Platz das Bild bekommt, hängt an zwei Dingen:
 *
 *   **Kachel** — die Randfarbe ist gemessen (`logo-backgrounds.ts`), die
 *   Scheibe trägt sie. Das Bild darf fast bis an den Rand, die Grenze zwischen
 *   Bild und Scheibe ist unsichtbar.
 *
 *   **Freigestellt** — das Zeichen steht auf Weiss und bekommt Luft.
 *
 * Wortmarken (die breiten SVG) stehen enger, weil sie ihre Fläche in die
 * Breite ziehen und sonst an den Kreis stossen — dieselbe Regel wie bei der
 * runden Scheibe der Buchungsliste.
 */
function placeLogo(entry: MerchantSpend, r: number): { box: number; clip: number } {
  const wordmark = entry.logo?.endsWith('.svg') ?? false
  const share = entry.bg ? (wordmark ? 0.88 : 0.96) : wordmark ? 0.74 : 0.82
  const box = 2 * r * share
  return { box, clip: box / 2 }
}

/**
 * Das Sinnbild, wo kein Logo bekannt ist — die Kategorie, in der dieser
 * Empfänger das meiste Geld kostet. «Miete» wird damit ein Sofa und
 * «Krankenkasse» ein Puls, statt beide ein zweibuchstabiges Kürzel.
 */
function iconFor(entry: MerchantSpend): IconName {
  if (entry.isCash) return 'banknoteOut'
  if (entry.key === 'rest') return 'more'
  return entry.category ? categoryDef(entry.category).icon : 'bag'
}

/** «in der letzten Woche», «im letzten Monat» — für Vorlesehilfe und Leerfall. */
const PERIOD_SPAN: Record<Period, string> = {
  week: 'in der letzten Woche',
  month: 'im letzten Monat',
  year: 'im letzten Jahr',
}

/** Anteil am Zeitfenster, für Liste und Vorlesetext. */
function share(entry: MerchantSpend, total: number): number {
  return total > 0 ? entry.total / total : 0
}

export function MoneyFlow({ session }: { session: ReturnType<typeof useSession> }) {
  const [period, setPeriod] = useState<Period>('month')
  const [selected, setSelected] = useState<string | null>(null)
  /* Die Schnittmasken brauchen Kennungen, die auch dann eindeutig sind, wenn
     der Bildschirm zweimal im Baum steht. `useId` liefert sie; die Doppelpunkte
     darin haben in einer URL-Referenz nichts verloren. */
  const uid = useId().replace(/[^\w-]/g, '')

  const result = useMemo(
    () =>
      merchantFlow({
        transactions: session.persona.transactions,
        accounts: session.persona.accounts,
        today: TODAY,
        period,
      }),
    [session.persona, period],
  )

  const entries = useMemo(
    () => [...result.merchants, ...(result.rest ? [result.rest] : [])],
    [result],
  )

  const packed = useMemo(() => {
    if (entries.length === 0) return []
    const max = Math.max(...entries.map((entry) => entry.total), 1)
    return packCircles(
      entries.map((entry) => ({
        r: radiusFor(entry.total, max, MAX_RADIUS, MIN_RADIUS) + PADDING,
        data: entry,
      })),
    )
  }, [entries])

  if (entries.length === 0) {
    return <p className="empty">Keine Ausgaben {PERIOD_SPAN[period]}.</p>
  }

  const box = boundsOf(packed)
  /* Luft für den Auswahlring, der aussen um die Blase liegt. */
  const view = { x: box.minX - 6, y: box.minY - 6, width: box.width + 12, height: box.height + 12 }
  const active = entries.find((entry) => entry.key === selected) ?? entries[0]

  const summary = entries
    .slice(0, 5)
    .map((entry) => `${entry.label}: ${Math.round(share(entry, result.total) * 100)} Prozent`)
    .join('. ')

  return (
    <div className="flow">
      <div className="flow__periods">
        {PERIODS.map((entry) => (
          <button
            key={entry}
            className={'flow__period' + (entry === period ? ' is-active' : '')}
            onClick={() => { setPeriod(entry); setSelected(null) }}
          >
            {PERIOD_LABEL[entry]}
          </button>
        ))}
      </div>

      <div className="flow__head">
        <span className="flow__total num">{formatAmount(-result.total)}</span>
        <span className="flow__range">
          {formatDate(result.from)} – {formatDate(result.to)} · {entries.length} Empfänger
        </span>
      </div>

      <svg
        className="flow__field"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="img"
        aria-label={`Ausgaben nach Unternehmen ${PERIOD_SPAN[period]}. ${summary}.`}
      >
        {/* Ein Schnitt je Blase, im Nullpunkt: Die Gruppe darunter ist an ihren
            Mittelpunkt verschoben, also gilt er genau dort. */}
        <defs>
          {packed.map((circle, index) => (
            <clipPath key={circle.data.key} id={`${uid}-${index}`}>
              <circle r={placeLogo(circle.data, circle.r - PADDING).clip} />
            </clipPath>
          ))}
        </defs>

        {packed.map((circle, index) => {
          const entry = circle.data
          const r = circle.r - PADDING
          const isActive = entry.key === active.key
          const spot = placeLogo(entry, r)
          const icon = Math.round(r * 0.86)

          return (
            /* Zwei Gruppen wie bei den Budgetblasen: die äussere setzt den
               Platz, die innere trägt Auswahl und Bewegung. So wächst die
               Blase aus ihrer eigenen Mitte statt aus dem Nullpunkt. */
            <g key={entry.key} transform={`translate(${circle.x} ${circle.y})`}>
              <g
                className={'flow__b' + (isActive ? ' is-active' : '')}
                style={{ '--i': index } as CSSProperties}
                onClick={() => setSelected(entry.key)}
              >
                <circle
                  className={'flow__disc' + (entry.logo ? '' : ' flow__disc--plain')}
                  r={r}
                  style={entry.bg ? { fill: entry.bg } : undefined}
                />

                {entry.logo ? (
                  <image
                    href={entry.logo}
                    x={-spot.box / 2}
                    y={-spot.box / 2}
                    width={spot.box}
                    height={spot.box}
                    clipPath={`url(#${uid}-${index})`}
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  /* `accent` mitzeichnen: Bügel, Pulslinie und Pfeil stecken in
                     der Icon-Bibliothek im gelben Detail. Ohne sie bleibt vom
                     Einkaufskorb ein Trapez übrig — bei 22 px verzeihlich, bei
                     50 px nicht mehr. */
                  <g className="flow__icon" transform={`translate(${-icon / 2} ${-icon / 2})`}>
                    <Icon name={iconFor(entry)} size={icon} accent />
                  </g>
                )}

                {/* Die Auswahl liegt aussen um die Scheibe, nicht auf ihr: ein
                    Ring auf dem Logo wäre ein Rahmen um das Logo. Zwei Ringe,
                    weil der Haufen dicht gepackt ist — der weisse innen
                    schneidet die Nachbarblase weg, damit der petrolfarbene
                    aussen auch auf einer schwarzen Scheibe eine Kante hat. */}
                {isActive && (
                  <>
                    <circle className="flow__sel-gap" r={r + 1.4} />
                    <circle className="flow__sel" r={r + 3.4} />
                  </>
                )}
              </g>
            </g>
          )
        })}
      </svg>

      {/* Die ausgewählte Blase im Klartext — die Grafik allein nennt keine Zahl. */}
      <div className="flow__pick">
        <span className="flow__pick-name">{active.label}</span>
        <span className="flow__pick-meta">
          {active.count} {active.count === 1 ? 'Zahlung' : 'Zahlungen'} ·{' '}
          {Math.round(share(active, result.total) * 100)} % der Ausgaben
        </span>
        <span className="flow__pick-amount num">{formatAmount(-active.total)}</span>
      </div>

      <ul className="flow__list">
        {entries.map((entry) => (
          <li key={entry.key}>
            <button
              className={'flow__row' + (entry.key === active.key ? ' is-active' : '')}
              onClick={() => setSelected(entry.key)}
            >
              <span
                className={'flow__logo' + (entry.bg ? ' flow__logo--filled' : '')}
                style={entry.bg ? { background: entry.bg } : undefined}
              >
                {entry.logo ? (
                  <img src={entry.logo} alt="" width={28} height={28} loading="lazy" />
                ) : (
                  <Icon name={iconFor(entry)} size={16} accent />
                )}
              </span>
              <span className="flow__name">{entry.label}</span>
              <span className="flow__bar" aria-hidden="true">
                <span style={{ width: `${share(entry, result.total) * 100}%` }} />
              </span>
              <span className="flow__amount num">{formatAmount(-entry.total, { sign: false })}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
