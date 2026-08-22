import { useMemo } from 'react'
import { Icon } from '../../../app/shell/Icon'
import { categoryDef, type CategoryKey } from '../slots'
import { boundsOf, packCircles, radiusFor } from '../pack'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Blasen — das Budget auf einen Blick.
 *
 * Eine Blase je Kategorie. Drei Dinge stecken in jeder:
 *
 *   **Der Ring** ist das Budget. Sein Durchmesser folgt der Wurzel des
 *   Betrags, damit die **Fläche** proportional ist — bei proportionalem
 *   Radius sähe ein doppeltes Budget viermal so gross aus. Das ist der
 *   häufigste Fehler in Blasendiagrammen und der Grund, warum sie oft lügen.
 *
 *   **Die Füllung** ist, was davon weg ist. Auch hier wächst die Fläche, nicht
 *   der Radius: halb voll heisst wirklich die Hälfte.
 *
 *   **Der feine Strichring** ist der Monatsfortschritt. Ohne ihn lügt jede
 *   Verbrauchsanzeige in der Monatsmitte: Am 8. sind 25 % eines Budgets kein
 *   Rückstand, sondern Vorsprung. Liegt die Füllung innerhalb des Strichrings,
 *   ist man vor der Zeit — liegt sie darüber, dahinter.
 *
 * **Die Farbe läuft die Petrol-Rampe der Marke hinauf**, statt eine eigene
 * Ampel aufzumachen: je voller, desto dunkler. petrol4 · petrol6 · petrol8,
 * dann Orange, dann Gelb mit rotem Bogen. Ein Budget zu zwei Dritteln
 * verbraucht ist kein Warnzustand, und eine grüne Blase wäre in dieser App
 * ein Fremdkörper — die Marke kennt kein Grün. Erst wo es eng wird, wechselt
 * die Achse.
 *
 * Vorlage: `circles_vorschlag bubbles screens/states_sheet.png`.
 *
 * Gepackt wird mit `pack.ts`, von Hand gezeichnet wie Donut und Verlaufskurve.
 *
 * Zur Barrierefreiheit: Das SVG trägt eine Zusammenfassung, die eigentliche
 * Bedienung ist die Liste darunter (`BubbleLegend`). Eine Grafik, die man nur
 * mit dem Finger treffen kann, wäre für die Hälfte der Leute keine Anzeige.
 */

export interface Bubble {
  key: CategoryKey
  /** Budgetiert pro Monat, Rappen. */
  budget: number
  /** Bereits ausgegeben in diesem Monat, Rappen. */
  spent: number
}

/** Wie voll eine Blase ist. Ohne Budget gibt es keinen Anteil. */
export function shareOf(bubble: Bubble): number {
  return bubble.budget > 0 ? bubble.spent / bubble.budget : 0
}

export type BubbleState = 'empty' | 'low' | 'mid' | 'high' | 'tight' | 'over'

/**
 * Sechs Stufen statt drei — die Farbskala des Entwurfs.
 *
 *   leer     nichts gebucht: Ring und Strichring, sonst nichts
 *   low      petrol4, hell
 *   mid      petrol6
 *   high     petrol8 — die letzte Petrolstufe, noch kein Alarm
 *   tight    Orange: knapp, aber innerhalb
 *   over     Gelb plus roter Bogen
 *
 * Bewusst am **Anteil am Budget** und nicht am Monatsfortschritt: Fixkosten
 * sind am 3. des Monats zu 100 % bezahlt, und eine Anzeige, die deshalb den
 * ganzen Monat leuchtet, wird nach zwei Tagen ignoriert. Die Frage, die die
 * Farbe beantwortet, ist «wie viel Spielraum habe ich noch», nicht «bin ich im
 * Zeitplan». Letzteres sagt der Strichring, und zwar leise.
 */
export function stateOf(share: number): BubbleState {
  if (share > 1) return 'over'
  if (share > 0.9) return 'tight'
  if (share > 0.7) return 'high'
  if (share > 0.45) return 'mid'
  if (share > 0) return 'low'
  return 'empty'
}

/**
 * Wie viel vom Ring der rote Bogen einnimmt, 0..1.
 *
 * Er misst die Überschreitung, nicht den Verbrauch: 135 % ergeben gut ein
 * Drittel, 200 % einen vollen Ring. Darüber bleibt er voll — Brunos 920 %
 * sehen aus wie 200 %, und die genaue Zahl steht in der Liste darunter. Ein
 * Bogen, der weiterwächst, hätte nichts mehr zu wachsen.
 */
export function overshootOf(share: number): number {
  return share <= 1 ? 0 : Math.min(1, share - 1)
}

/* Die Zeichenfläche. Das SVG skaliert über `width: 100%`; diese Zahlen
   bestimmen nur das Verhältnis von Blasengrösse zu Beschriftung. */
const MAX_RADIUS = 62
const MIN_RADIUS = 20
const PADDING = 3
/** Ab dieser Grösse passt ein Sinnbild hinein, darunter bliebe es ein Fleck. */
const ICON_RADIUS = 26
/**
 * Ab dieser Füllung liegt das Sinnbild darauf und braucht die Gegenfarbe.
 * Das Zeichen ist 22 px breit, seine Ecken liegen also gut 15 px von der Mitte
 * weg — darunter stünde ein weisses Symbol auf weissem Grund.
 */
const ICON_COVERED = 18

export function BubbleField({
  bubbles,
  progress,
  selected,
  onSelect,
}: {
  bubbles: Bubble[]
  /** Monatsfortschritt, 0..1. */
  progress: number
  selected?: CategoryKey | null
  onSelect?: (key: CategoryKey) => void
}) {
  const shown = bubbles.filter((bubble) => bubble.budget > 0 || bubble.spent > 0)

  const packed = useMemo(() => {
    /* Die Skala richtet sich **nur** nach den Budgets, nie nach dem Verbrauch.
       Sonst bedeutet der Ring zwei verschiedene Dinge: bei den einen das
       Budget, bei den anderen die Ausgabe. Bruno zahlt im August CHF 13'463
       fürs Wohnen bei CHF 1'463 Budget — nähme die Blase diese Zahl, wäre sie
       neunmal so gross wie alle anderen zusammen und die Anzeige unlesbar.
       Die Überschreitung sagt stattdessen die Farbe, der Bogen und die Liste. */
    const maxBudget = Math.max(...shown.map((bubble) => bubble.budget), 1)
    return packCircles(
      shown.map((bubble) => ({
        r: radiusFor(bubble.budget, maxBudget, MAX_RADIUS, MIN_RADIUS) + PADDING,
        data: bubble,
      })),
    )
  }, [shown])

  if (packed.length === 0) return null

  const box = boundsOf(packed)
  const view = {
    x: box.minX - 4,
    y: box.minY - 4,
    width: box.width + 8,
    height: box.height + 8,
  }

  const summary = shown
    .map((bubble) => {
      const share = Math.round(shareOf(bubble) * 100)
      return `${categoryDef(bubble.key).title}: ${share} Prozent verbraucht`
    })
    .join('. ')

  return (
    <svg
      className="bub"
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label={`Budget nach Kategorie. ${summary}.`}
    >
      {packed.map((circle) => {
        const bubble = circle.data
        const share = shareOf(bubble)
        const state = stateOf(share)
        const outer = circle.r - PADDING

        /* Flächentreu: Die Füllung nimmt den Anteil der Kreisfläche ein, den
           der Anteil des Budgets ausmacht. Über 100 % wird gedeckelt — was
           darüber hinausgeht, sagt der Überstandsbogen. */
        const fill = outer * Math.sqrt(Math.min(share, 1))
        const pace = outer * Math.sqrt(Math.min(progress, 1))
        const overshoot = overshootOf(share)
        const isSelected = selected === bubble.key

        return (
          <g
            key={bubble.key}
            className={`bub__g bub__g--${state}` + (isSelected ? ' is-selected' : '')}
            transform={`translate(${circle.x} ${circle.y})`}
            onClick={onSelect ? () => onSelect(bubble.key) : undefined}
          >
            {/* Der Ring: das Budget. */}
            <circle className="bub__ring" r={outer} />

            {/* Die Füllung: was weg ist. */}
            {fill > 0 && <circle className="bub__fill" r={fill} />}

            {/* Der Monatsfortschritt — nur, wo er etwas aussagt. */}
            {pace > 2 && pace < outer && <circle className="bub__pace" r={pace} />}

            {/* Über dem Limit: ein roter Bogen auf dem Ring, dessen Länge das
                Mass der Überschreitung ist. Die Blase selbst bleibt so gross
                wie ihr Budget — sonst bedeutete der Ring zweierlei. */}
            {overshoot > 0 && (
              <circle
                className="bub__over"
                r={outer}
                transform="rotate(-90)"
                strokeDasharray={`${overshoot * 2 * Math.PI * outer} ${2 * Math.PI * outer}`}
              />
            )}

            {outer >= ICON_RADIUS && (
              <g
                /* Liegt das Zeichen auf der Füllung, braucht es deren
                   Gegenfarbe — sonst steht Weiss auf Weiss. */
                className={'bub__icon' + (fill >= ICON_COVERED ? ' bub__icon--inverse' : '')}
                transform="translate(-11 -11)"
              >
                <Icon name={categoryDef(bubble.key).icon} size={22} />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Die Liste unter den Blasen.
 *
 * Sie ist nicht bloss Legende, sondern die eigentliche Bedienung: Hier stehen
 * die Zahlen im Klartext, hier ist der Tap-Bereich gross genug, und hier
 * findet eine Vorlesehilfe etwas vor. Die Grafik darüber zeigt das Verhältnis,
 * die Liste die Beträge — beide aus derselben Quelle, also nie zwei Wahrheiten.
 */
export function BubbleLegend({
  bubbles,
  selected,
  onSelect,
  format,
}: {
  bubbles: Bubble[]
  selected?: CategoryKey | null
  onSelect?: (key: CategoryKey) => void
  /** Rappen → Text. Kommt von aussen, damit die App eine Formatierung hat. */
  format: (rappen: number) => string
}) {
  return (
    <div className="bub-legend">
      {bubbles.map((bubble) => {
        const share = shareOf(bubble)
        const state = stateOf(share)
        const rest = bubble.budget - bubble.spent
        const isSelected = selected === bubble.key

        return (
          <button
            key={bubble.key}
            className={`bub-legend__row bub-legend__row--${state}` + (isSelected ? ' is-selected' : '')}
            aria-pressed={isSelected}
            onClick={() => onSelect?.(bubble.key)}
          >
            <span className="bub-legend__dot" />
            <span className="bub-legend__main">
              <span className="bub-legend__title">{categoryDef(bubble.key).title}</span>
              <span className="bub-legend__sub">
                {bubble.budget === 0
                  ? 'kein Budget gesetzt'
                  : rest >= 0
                    ? `${Math.round(share * 100)} % verbraucht · noch ${format(rest)}`
                    : `${format(-rest)} über dem Budget`}
              </span>
            </span>
            <span className="bub-legend__amount num">
              {format(bubble.spent)}
              {bubble.budget > 0 && (
                <span className="bub-legend__of">von {format(bubble.budget)}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Was zusammen budgetiert und verbraucht ist — die Zeile über der Liste. */
export function bubbleTotals(bubbles: Bubble[]): { budget: number; spent: number; share: number } {
  const budget = bubbles.reduce((total, bubble) => total + bubble.budget, 0)
  const spent = bubbles.reduce((total, bubble) => total + bubble.spent, 0)
  return { budget, spent, share: budget > 0 ? spent / budget : 0 }
}
