import { describe, expect, it } from 'vitest'
/* Als Text eingelesen statt über das Dateisystem: `?raw` kennt Vite von
   Haus aus, und die App braucht dafür keine Node-Typen. */
import budgetCss from '../budget.css?raw'
import signalsCss from '../../screens/signals.css?raw'
import shellCss from '../../../app/shell/shell.css?raw'

/**
 * Wache über die Stilvorlagen unserer Schicht.
 *
 * Anlass ist ein Fehler, der bis auf die Live-Seite durchgerutscht ist: Beim
 * Umbau der Blasen wurde ein Block ersetzt, der weiter unten in der Datei ein
 * zweites Mal stand. Ergebnis war eine Datei mit dem halben Inhalt doppelt —
 * und die alte Kopie überschrieb als spätere und speziellere Regel die neue.
 * Sichtbar wurde es erst am Bildschirm: rote statt gelber Blasen.
 *
 * Typprüfung und Tests fangen so etwas nicht, weil CSS für beide unsichtbar
 * ist. Diese Prüfungen springen dort ein.
 */

const files: [name: string, css: string][] = [
  ['budget.css', budgetCss],
  ['signals.css', signalsCss],
]

/** Die Abschnittsüberschriften der Form `── Titel ──`. Der Titel selbst
 *  enthält keine Striche, sonst fände der Ausdruck sich in den Trennlinien. */
function sections(css: string): string[] {
  return [...css.matchAll(/──\s*([^─\n]+?)\s*─{3,}/g)].map((match) => match[1].trim())
}

describe.each(files)('%s', (_name, css) => {
  it('führt jeden Abschnitt genau einmal', () => {
    const seen = new Map<string, number>()
    for (const title of sections(css)) seen.set(title, (seen.get(title) ?? 0) + 1)
    const doubled = [...seen.entries()].filter(([, count]) => count > 1)
    expect(doubled.map(([title]) => title), 'doppelte Abschnitte').toEqual([])
  })

  it('gibt jedem dehnbaren Kind ein `min-width`', () => {
    /* Die häufigste Ursache für seitliches Scrollen in einer App: Ein
       Flex-Kind mit `flex: 1` darf ohne `min-width: 0` nicht unter seine
       Inhaltsbreite schrumpfen. Eine einzige Zelle mit «bisher 189'800.00»
       schiebt so den ganzen Bildschirm zur Seite — genau das ist im Ausblick
       passiert. Die Regel gilt ohne Ausnahme; auf einem Element ohne Inhalt
       kostet sie nichts. */
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const offenders = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, , body]) => /(^|[;\s])flex\s*:\s*1\b/.test(body) && !/min-width\s*:/.test(body))
      .map(([, selector]) => selector.trim())
    expect(offenders, 'flex: 1 ohne min-width').toEqual([])
  })

  it('enthält keine Farbwerte ausserhalb der Tokens', () => {
    /* Erlaubt bleiben rgba() für Schatten und Schleier — dafür gibt es keine
       Tokens, und sie hängen an der Deckkraft, nicht an der Marke. */
    const hex = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, 'Hexfarben gehören nach theme/tokens.css').toEqual([])
  })
})

describe('Die Hülle scrollt nicht zur Seite', () => {
  it('klemmt die Querachse in der Scrollfläche ab', () => {
    /* Die Zusage der Hülle. Ein zu breiter Inhalt bleibt ein Fehler und wird
       dort behoben — aber er darf nie dazu führen, dass man den halben
       Bildschirm wegwischen kann. */
    expect(shellCss).toMatch(/\.screen\s*\{[^}]*overflow-x:\s*hidden/)
  })
})

describe('budget.css — die Blasen', () => {
  const css = budgetCss

  it('hat keine Regel aus der alten Ampelfassung mehr', () => {
    // Grün gibt es in der Marke nicht; `--ok` war der Zustandsname davor.
    expect(css).not.toMatch(/--success\d/)
    expect(css).not.toMatch(/bub__g--ok|bub-legend__row--ok/)
  })

  it('setzt die Füllung der Blase an genau einer Stelle', () => {
    /* Genau das war der Fehler: zwei Regeln für dieselbe Fläche, und die
       falsche gewann. Die Farbe kommt aus der Rampe, sonst nirgendwo her. */
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const blocks = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    const setsFill = blocks.filter(
      ([, selector, body]) => /\.bub__fill\b/.test(selector) && /(^|[;\s])fill\s*:/.test(body),
    )
    expect(setsFill, 'Regeln, die .bub__fill einfärben').toHaveLength(1)
    expect(setsFill[0][2]).toMatch(/color-mix/)
  })
})
