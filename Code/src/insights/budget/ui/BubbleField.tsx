import { useMemo, type CSSProperties } from 'react'
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
 * Die Farbe der Füllung — stetig, nicht in Stufen.
 *
 * Die Zustände oben sind Entscheidungen (weisses oder dunkles Sinnbild, Punkt
 * in der Liste); die **Fläche** darf gleiten. Ein Budget wächst schliesslich
 * auch nicht in Sprüngen: Bei 44 % und bei 46 % ist gleich viel weg, und zwei
 * merklich verschiedene Farben dafür wären eine Behauptung.
 *
 * Zurückgegeben werden zwei **Tokennamen** und ein Mischverhältnis, nie ein
 * Farbwert. Gemischt wird in CSS mit `color-mix()` — so bleiben die Werte dort,
 * wo sie hingehören, in `theme/tokens.css`, und ein geändertes Token wirkt hier
 * mit.
 *
 * Die Stützstellen sind die des Entwurfs. Zwischen petrol8 und Orange liegt
 * bewusst nur ein schmales Band: Zwei so verschiedene Farben ergeben in der
 * Mitte einen stumpfen Ton, und der soll kein Dauerzustand sein. Innerhalb der
 * Petrol-Familie — dort, wo die meisten Werte liegen — gleitet es dagegen weit.
 */
const RAMP: { at: number; token: string }[] = [
  { at: 0, token: '--petrol3' },
  { at: 0.3, token: '--petrol4' },
  { at: 0.6, token: '--petrol6' },
  { at: 0.85, token: '--petrol8' },
  { at: 0.96, token: '--pending2' },
  { at: 1, token: '--postfinancegelb' },
]

export interface FillRamp {
  /** Tokenname der unteren Stützstelle. */
  from: string
  /** Tokenname der oberen. */
  to: string
  /** Anteil der oberen, 0..100. */
  mix: number
}

export function fillRamp(share: number): FillRamp {
  const value = Math.min(Math.max(share, 0), 1)
  for (let i = 0; i < RAMP.length - 1; i++) {
    const low = RAMP[i]
    const high = RAMP[i + 1]
    if (value <= high.at) {
      const span = high.at - low.at
      return {
        from: low.token,
        to: high.token,
        mix: span === 0 ? 100 : ((value - low.at) / span) * 100,
      }
    }
  }
  const last = RAMP[RAMP.length - 1]
  return { from: last.token, to: last.token, mix: 100 }
}

/**
 * Wie stark die Blase leuchtet, 0..1 — ebenfalls stetig.
 *
 * Der Schein setzt bei 85 % ein und ist bei 100 % voll. Er ist der einzige
 * Ort, an dem die Anzeige die Stimme hebt, und er soll sie heben, nicht
 * anschalten.
 */
export function glowOf(share: number): number {
  return Math.min(Math.max((share - 0.85) / 0.15, 0), 1)
}

/**
 * Steht das Sinnbild auf dunklem Grund und braucht deshalb Weiss?
 *
 * Zwei Bedingungen: Die Füllung muss überhaupt darunter liegen, und sie muss
 * dunkel genug sein. Die obere Grenze folgt der Rampe, nicht dem Zustand —
 * über 93 % ist die Farbe schon überwiegend Orange, und Weiss auf Orange liest
 * niemand. Genau so steht es im Entwurf: bei 85 % weiss, bei 97 % dunkel.
 */
export function iconOnDark(share: number, covered: boolean): boolean {
  return covered && share > 0.45 && share <= 0.93
}

/**
 * Auf welchem Grund die Beschriftung steht — und das ist der Punkt, an dem
 * hell und dunkel auseinandergehen.
 *
 * Die **Füllung** folgt der Markenrampe und ist in beiden Themen dieselbe
 * Farbe: petrol3 bleibt petrol3. Eine Beschriftung darauf braucht deshalb
 * keine Themenfarbe, sondern die Gegenfarbe zur Rampe — das entscheidet
 * `iconOnDark()`.
 *
 * Der **Ringinnenraum** ist `--surface-card` und kippt mit dem Thema: weiss im
 * Hellen, petrol9 im Dunkeln. Eine Beschriftung dort braucht `--text-strong`,
 * sonst steht petrol8 (#004B5A) auf petrol9 (#00373D) — gemessen 1,33:1, also
 * unsichtbar. Genau das war bei den leeren Blasen der Fall, und beim Sinnbild
 * der kleinen schon vorher.
 *
 * Ein blosser Token-Tausch hätte es nicht getan: Eine helle Grundfarbe wäre
 * auf der hellen Füllung einer Blase bei 30 bis 45 Prozent genauso unsichtbar
 * geworden. Deshalb zwei Fälle statt einer Farbe.
 */
export function labelOnSurface(covered: boolean): boolean {
  return !covered
}

/**
 * Liegt die Füllung **teilweise** unter der Beschriftung?
 *
 * Der eine Fall, für den es keine richtige Textfarbe gibt. Eine Füllung bei
 * rund 20 % reicht bis unter die Mitte der Zahl, aber nicht bis an ihre
 * Ränder: Die Zahl steht gleichzeitig auf hellem Petrol und auf der Karte
 * dahinter. Im Hellen fällt das nicht auf, weil beide Gründe hell sind — im
 * Dunkeln ist die Zahl in der Mitte weg.
 *
 * Dort, und nur dort, bekommt sie einen Saum (`.bub__pct--halo`).
 */
export function labelStraddles(fill: number, coveredAt: number): boolean {
  return fill > 0 && fill < coveredAt
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

/**
 * Ab dieser Grösse steht die **Zahl** in der Blase, mit dem Sinnbild darüber.
 *
 * Bis hierher war die Blase stumm: Sie trug ein Sinnbild, und die Zahl dazu
 * stand in der Liste darunter. Wer wissen wollte, wie voll die gelbe ist,
 * musste erst Symbol auf Zeile abbilden. Bei Reto sind fünf von sechs Blasen
 * fast gleich gelb — 96, 99, 100, 110 Prozent —, und dort trägt die Farbe die
 * Unterscheidung schon nicht mehr. Genau da muss die Zahl hin.
 *
 * Prozent und nicht Franken: Prozente sind über alle sechs Blasen
 * vergleichbar, Franken nicht. Dass Wohnen mehr Geld ist als Mobilität, sagt
 * schon die Fläche; was der Blick dort sucht, ist «wie viel Spielraum ist
 * noch».
 */
const LABEL_RADIUS = 32
/**
 * Ab dieser Füllung liegt die **zweizeilige** Beschriftung darauf.
 *
 * Höher als `ICON_COVERED`, weil Sinnbild plus Zahl gut 30 Einheiten hoch
 * stehen statt 22 — die untere Kante der Zahl liegt weiter draussen als die
 * Ecke eines Sinnbildes.
 */
const LABEL_COVERED = 30

/**
 * Was in der Blase steht — oder `null`, wo keine Zahl hineingehört.
 *
 * Ohne Budget gibt es keinen Anteil. Dort **schweigt** die Blase, statt «0 %»
 * zu behaupten: Wer nichts budgetiert hat, hat auch nichts zu 0 Prozent
 * verbraucht. Diese Blasen sind ohnehin die leeren Ringe im Bild.
 */
export function bubbleLabel(bubble: Bubble): string | null {
  if (bubble.budget <= 0) return null
  /* Schmales geschütztes Leerzeichen (U+202F) vor dem Prozentzeichen — die
     Schweizer Schreibweise, und im Kreis der Unterschied zwischen «96 %» und
     einer Zahl, die von ihrem Zeichen wegdriftet. */
  return `${Math.round(shareOf(bubble) * 100)}\u202f%`
}

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
      {packed.map((circle, index) => {
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
        const ramp = fillRamp(share)
        const isSelected = selected === bubble.key
        const circumference = 2 * Math.PI * outer

        return (
          /* Zwei Gruppen: die äussere setzt den Platz, die innere trägt
             Zustand und Bewegung. So skaliert die Animation um den Mittelpunkt
             der Blase, ohne die Position mitzuziehen. */
          <g key={bubble.key} transform={`translate(${circle.x} ${circle.y})`}>
          <g
            className={`bub__g bub__g--${state}` + (isSelected ? ' is-selected' : '')}
            style={
              {
                '--from': `var(${ramp.from})`,
                '--to': `var(${ramp.to})`,
                '--mix': `${ramp.mix.toFixed(1)}%`,
                '--glow': glowOf(share).toFixed(3),
                /* Versetzter Einsatz: Die Blasen ziehen nacheinander auf,
                   nicht alle im selben Moment. */
                '--i': index,
              } as CSSProperties
            }
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
                strokeDasharray={`${overshoot * circumference} ${circumference}`}
                /* Der Bogen zeichnet sich beim Aufziehen selbst. */
                style={{ '--arc': `${overshoot * circumference}` } as CSSProperties}
              />
            )}

            {/* Die Beschriftung, in drei Stufen nach Platz: Sinnbild und Zahl,
                nur Zahl, gar nichts. Beide Teile liegen in **einer** Gruppe
                und kippen deshalb gemeinsam auf Weiss — ein weisses Sinnbild
                über einer dunklen Zahl wäre zweierlei Grund für ein Ding. */}
            {(() => {
              const label = bubbleLabel(bubble)
              const twoLine = outer >= LABEL_RADIUS && label !== null
              if (outer < ICON_RADIUS) return null

              const coveredAt = twoLine ? LABEL_COVERED : ICON_COVERED
              const covered = fill >= coveredAt
              const halo = labelStraddles(fill, coveredAt) ? ' bub__pct--halo' : ''
              const inverse = iconOnDark(share, covered)
              const cls =
                'bub__label' +
                (inverse ? ' bub__label--inverse' : '') +
                (labelOnSurface(covered) ? ' bub__label--onsurface' : '')

              /* Nur Zahl: die kleineren Blasen. Das Sinnbild wäre dort neben
                 der Zahl ein Fleck, und die Zahl ist die Aussage. */
              if (!twoLine) {
                if (label === null) {
                  return (
                    <g className={cls} transform="translate(-11 -11)">
                      <Icon name={categoryDef(bubble.key).icon} size={22} />
                    </g>
                  )
                }
                return (
                  <g className={cls}>
                    <text className={'bub__pct' + halo} y="5" textAnchor="middle">
                      {label}
                    </text>
                  </g>
                )
              }

              return (
                <g className={cls}>
                  <g transform="translate(-8 -23)">
                    <Icon name={categoryDef(bubble.key).icon} size={16} />
                  </g>
                  {/* Eine Stufe kleiner, wo die Zahl sonst an den Ring stösst:
                      immer ab sechs Zeichen, in den kleineren Blasen schon ab
                      fünf — «104 %» in einer Blase mit Radius 34 lässt links
                      und rechts sonst kein Weiss mehr stehen. */}
                  <text
                    className={
                      'bub__pct' +
                      (label.length > 5 || (outer < 40 && label.length > 4) ? ' bub__pct--long' : '') +
                      halo
                    }
                    y="11"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              )
            })()}
          </g>
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
 *
 * Jede Zeile führt auf die Detailseite ihrer Kategorie, genau wie die Blase
 * darüber. Zwei Wege auf dasselbe Ziel, weil eine Blase mit Radius 29 kein
 * Tap-Ziel ist — die Grafik ist die schnelle Geste, die Liste die sichere.
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
            {/* Der Winkel sagt, dass hier etwas dahinterliegt. Ohne ihn ist die
                Zeile eine Anzeige, die sich zufällig antippen lässt. */}
            <span className="bub-legend__go">
              <Icon name="chevronRight" size={16} />
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
