/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Kreise dicht packen, ohne dass sie sich überlappen.
 *
 * Das Verfahren stammt aus Wang et al., «Visualization of Large Hierarchical
 * Data by Circle Packing» (CHI 2006), und ist dasselbe, das `d3-hierarchy`
 * benutzt. Hier steht es ausgeschrieben, weil die App bewusst ohne
 * Diagrammpaket auskommt: Donut und Verlaufskurve sind ebenfalls von Hand
 * gezeichnet, damit die Farben exakt den Tokens folgen.
 *
 * Die Idee in drei Sätzen:
 *
 *   Die ersten drei Kreise werden aneinandergelegt. Danach hält der
 *   Algorithmus eine **Frontkette** — die Kreise, die aussen am Haufen
 *   liegen. Jeder neue Kreis wird an ein benachbartes Paar dieser Kette
 *   angelegt; überschneidet er dabei einen anderen Kettenkreis, wird die
 *   Kette an dieser Stelle gekürzt und noch einmal versucht.
 *
 * Das Ergebnis ist der organische Haufen, den man aus Blasendiagrammen kennt:
 * dicht, ohne Raster, ohne Lücken — und ohne dass irgendwo eine Zahl gerundet
 * werden müsste, damit es aufgeht.
 *
 * **Deterministisch.** `d3` mischt die Eingabe mit einem Zufallsgenerator.
 * Wir sortieren stattdessen nach Radius absteigend: Das ergibt eine dichte
 * Packung mit den grossen Kreisen in der Mitte — und bei jedem Aufruf
 * dieselbe. Eine Demo, die zweimal anders aussieht, kostet mehr, als die
 * letzten Prozent Dichte bringen.
 */

export interface PackedCircle<T = unknown> {
  x: number
  y: number
  r: number
  data: T
}

/** Rundungsschlupf. Zwei Kreise, die sich rechnerisch berühren, überlappen nicht. */
const EPSILON = 1e-6

interface Node {
  circle: { x: number; y: number; r: number }
  previous: Node
  next: Node
}

/**
 * Legt `c` so, dass er `a` und `b` von aussen berührt.
 *
 * Der Schnittpunkt zweier Kreise um `a` und `b` mit den Radien `a.r + c.r`
 * bzw. `b.r + c.r`. Von den beiden Lösungen wird die genommen, die im
 * Gegenuhrzeigersinn liegt — so wächst der Haufen in eine Richtung, statt sich
 * selbst zu überlagern.
 */
function place(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
  c: { x: number; y: number; r: number },
): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d2 = dx * dx + dy * dy

  if (d2 === 0) {
    /* `a` und `b` liegen aufeinander — kann bei gleich grossen Kreisen zu
       Beginn vorkommen. Dann einfach daneben legen. */
    c.x = a.x + a.r + c.r
    c.y = a.y
    return
  }

  const ra = (a.r + c.r) ** 2
  const rb = (b.r + c.r) ** 2

  if (ra > rb) {
    const x = (d2 + rb - ra) / (2 * d2)
    const y = Math.sqrt(Math.max(0, rb / d2 - x * x))
    c.x = b.x - x * dx - y * dy
    c.y = b.y - x * dy + y * dx
  } else {
    const x = (d2 + ra - rb) / (2 * d2)
    const y = Math.sqrt(Math.max(0, ra / d2 - x * x))
    c.x = a.x + x * dx - y * dy
    c.y = a.y + x * dy + y * dx
  }
}

function intersects(a: { x: number; y: number; r: number }, b: { x: number; y: number; r: number }): boolean {
  const dr = a.r + b.r - EPSILON
  const dx = b.x - a.x
  const dy = b.y - a.y
  return dr > 0 && dr * dr > dx * dx + dy * dy
}

/**
 * Wie weit das Paar (`node`, `node.next`) vom Ursprung weg liegt — gewichtet
 * nach Radius. Der neue Kreis wird immer an das innenliegendste Paar der
 * Frontkette gelegt, sonst franst der Haufen aus.
 */
function score(node: Node): number {
  const a = node.circle
  const b = node.next.circle
  const sum = a.r + b.r
  const x = (a.x * b.r + b.x * a.r) / sum
  const y = (a.y * b.r + b.y * a.r) / sum
  return x * x + y * y
}

/**
 * Packt Kreise mit gegebenen Radien dicht um den Ursprung.
 *
 * Die Reihenfolge der Rückgabe entspricht der Eingabe — sortiert wird nur
 * intern. Wer die Kreise zeichnet, kann sich also auf seine eigene
 * Reihenfolge verlassen.
 */
export function packCircles<T>(input: { r: number; data: T }[]): PackedCircle<T>[] {
  const n = input.length
  if (n === 0) return []

  /* Gross nach klein. Stabil über den Eingabeindex, damit zwei gleich grosse
     Kreise nicht je nach Sortierverfahren die Plätze tauschen. */
  const order = input
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.r - a.entry.r || a.index - b.index)

  const circles = order.map(({ entry }) => ({ x: 0, y: 0, r: entry.r }))

  if (n === 1) {
    circles[0].x = 0
    circles[0].y = 0
  } else {
    circles[0].x = -circles[1].r
    circles[0].y = 0
    circles[1].x = circles[0].r
    circles[1].y = 0

    if (n > 2) {
      place(circles[1], circles[0], circles[2])

      /* Die Frontkette als Ringliste. Sie enthält genau die Kreise, an die
         von aussen noch etwas angelegt werden kann. */
      let a: Node = { circle: circles[0] } as Node
      let b: Node = { circle: circles[1] } as Node
      let c: Node = { circle: circles[2] } as Node
      a.next = c.previous = b
      b.next = a.previous = c
      c.next = b.previous = a

      outer: for (let i = 3; i < n; i++) {
        place(a.circle, b.circle, circles[i])
        c = { circle: circles[i] } as Node

        /* Von beiden Enden aus die Kette entlanglaufen und prüfen, ob der neue
           Kreis jemanden schneidet. Es wird immer die kürzere Seite zuerst
           weiterverfolgt — deshalb die beiden Summen `sj` und `sk`. */
        let j = b.next
        let k = a.previous
        let sj = b.circle.r
        let sk = a.circle.r

        do {
          if (sj <= sk) {
            if (intersects(j.circle, c.circle)) {
              /* Überschneidung vorn: Kette bis dorthin kürzen und diesen
                 Kreis noch einmal versuchen. */
              b = j
              a.next = b
              b.previous = a
              i--
              continue outer
            }
            sj += j.circle.r
            j = j.next
          } else {
            if (intersects(k.circle, c.circle)) {
              a = k
              a.next = b
              b.previous = a
              i--
              continue outer
            }
            sk += k.circle.r
            k = k.previous
          }
        } while (j !== k.next)

        // Passt: zwischen a und b einhängen.
        c.previous = a
        c.next = b
        a.next = c
        b.previous = c
        b = c

        /* Das neue innenliegendste Paar suchen — dort wächst der Haufen als
           Nächstes weiter. */
        let best = score(a)
        let cursor = c
        while ((cursor = cursor.next) !== b) {
          const value = score(cursor)
          if (value < best) {
            best = value
            a = cursor
          }
        }
        b = a.next
      }
    }
  }

  /* Zurück in die Eingabereihenfolge. */
  const out: PackedCircle<T>[] = new Array(n)
  order.forEach(({ entry, index }, position) => {
    out[index] = { ...circles[position], data: entry.data }
  })
  return out
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

/**
 * Das umschliessende Rechteck der Packung.
 *
 * Bewusst kein minimal umschliessender Kreis (Welzl): Gezeichnet wird in ein
 * rechteckiges `viewBox`, und ein Kreis darum würde oben und unten Luft
 * lassen, die niemand braucht.
 */
export function boundsOf(circles: PackedCircle<unknown>[]): Bounds {
  if (circles.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const circle of circles) {
    minX = Math.min(minX, circle.x - circle.r)
    minY = Math.min(minY, circle.y - circle.r)
    maxX = Math.max(maxX, circle.x + circle.r)
    maxY = Math.max(maxY, circle.y + circle.r)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY }
}

/**
 * Radius aus einem Betrag: **die Fläche** ist proportional, nicht der Radius.
 *
 * Ein doppelt so grosses Budget muss doppelt so gross aussehen. Wer den Radius
 * proportional setzt, macht daraus optisch das Vierfache — der häufigste
 * Fehler in Blasendiagrammen und der Grund, warum sie oft lügen.
 */
export function radiusFor(amount: number, maxAmount: number, maxRadius: number, minRadius: number): number {
  if (maxAmount <= 0) return minRadius
  return minRadius + (maxRadius - minRadius) * Math.sqrt(Math.max(0, amount) / maxAmount)
}
