import { describe, expect, it } from 'vitest'
import tokensCss from '../tokens.css?raw'
import baseCss from '../base.css?raw'

/**
 * Wache über das Thema — hell und dunkel.
 *
 * Anlass ist ein Fehler, der lange unbemerkt blieb, weil er nur in **einer**
 * von vier Kombinationen auftritt. `base.css` kennt «dunkel» als
 * `[data-theme='dark']`; `tokens.css` kannte es als
 * `@media (prefers-color-scheme: dark)`. Beide Dateien meinten damit
 * Verschiedenes, und die Schnittmenge war: Die Akzentfarben kippten nur, wenn
 * das Betriebssystem *zusätzlich* dunkel steht.
 *
 * Wer im hellen System in der App auf Dunkel schaltete, bekam dunkle Flächen
 * und helle Akzente. Gemessen an der Frage auf der Budget-Detailseite:
 * Rostrot (#B12E02) auf petrol9 (#00373D) ergibt 1,3:1 — sichtbar wie nichts.
 *
 * Typprüfung und Tests fingen das nicht, weil CSS für beide unsichtbar ist,
 * und ein Blick auf den Bildschirm fing es nicht, weil der Entwicklungsrechner
 * dunkel eingestellt war. Diese Prüfungen springen dort ein.
 */

/** Alle Stilvorlagen der App, als Text. */
const FILES = import.meta.glob('../../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Kommentare weg — sonst zählt jede Erklärung als Regel mit. */
function bare(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Jede Regel als Paar aus Selektorliste und Rumpf. */
function rules(css: string): { selector: string; body: string }[] {
  return [...bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }))
}

describe('Die einzige Quelle der Wahrheit über das Thema', () => {
  it('lässt die Dunkelfassung am Attribut hängen, nicht am Betriebssystem', () => {
    /* Genau das war der Fehler. `SessionProvider` schreibt das Attribut bei
       jedem Themenwechsel — es ist die Angabe, die der Nutzer gemacht hat.
       Die Vorliebe des Systems ist es nicht. */
    expect(tokensCss).toMatch(/:root\[data-theme="dark"\]\s*\{/)
  })

  it('gattert keine Themenregel hinter eine Medienabfrage', () => {
    const declarations = bare(tokensCss)
    expect(declarations).not.toMatch(/@media[^{]*prefers-color-scheme/)
    expect(bare(baseCss)).not.toMatch(/@media[^{]*prefers-color-scheme/)
  })

  it('beschreibt in beiden Dateien dasselbe «dunkel»', () => {
    /* Zwei Dateien, ein Begriff. Weicht der Selektor auseinander, ist die
       Anzeige in einer Kombination wieder halb umgestellt. */
    const selectorsOf = (css: string) =>
      rules(css)
        .map((rule) => rule.selector)
        .filter((selector) => selector.includes('data-theme') && selector.includes('dark'))
    for (const [name, css] of [
      ['tokens.css', tokensCss],
      ['base.css', baseCss],
    ] as const) {
      const found = selectorsOf(css)
      expect(found.length, `${name} hat keinen Dunkel-Selektor`).toBeGreaterThan(0)
      for (const selector of found) {
        expect(selector, `${name}: ${selector}`).toMatch(/\[data-theme=['"]dark['"]\]/)
      }
    }
  })
})

describe('Jedes Paar-Token kippt wirklich', () => {
  /**
   * Ein `var(--pending3-pending2)`, das es nicht gibt, ist kein Fehler: Die
   * Regel fällt still aus, und der Text bleibt schwarz. Genau so ist es dieser
   * Datei schon einmal ergangen — siehe `budget/__tests__/stylesheet.test.ts`.
   */
  it('gibt jedem benutzten Paar eine helle und eine dunkle Fassung', () => {
    const used = new Set<string>()
    for (const css of Object.values(FILES)) {
      for (const match of bare(css).matchAll(/var\(\s*(--[a-z]+\d+-[a-z]+\d*)\s*\)/g)) {
        used.add(match[1])
      }
    }
    expect(used.size, 'keine Paare in Gebrauch — misst der Test noch etwas?').toBeGreaterThan(0)

    const dark = rules(tokensCss).find((rule) => /\[data-theme="dark"\]/.test(rule.selector))!
    const light = rules(tokensCss).find((rule) => rule.selector.trim() === ':root')!

    for (const name of [...used].sort()) {
      expect(light.body, `${name} ohne helle Fassung`).toContain(`${name}:`)
      expect(dark.body, `${name} ohne dunkle Fassung`).toContain(`${name}:`)
    }
  })

  it('gibt der dunklen Fassung einen anderen Wert als der hellen', () => {
    /* Ein Paar, das im Dunkeln auf denselben Wert zeigt, ist ein Paar mit
       einem Tippfehler — ausser `--pending2-pending2` und Geschwister, die
       ihren Wert absichtlich behalten. Das steht im Namen. */
    const dark = rules(tokensCss).find((rule) => /\[data-theme="dark"\]/.test(rule.selector))!
    for (const match of dark.body.matchAll(/(--([a-z]+\d+)-([a-z]+\d*))\s*:\s*var\((--[a-z]+\d*)\)/g)) {
      const [, name, from, to, value] = match
      if (from === to) continue
      expect(value, `${name} zeigt im Dunkeln auf die helle Stützstelle`).toBe(`--${to}`)
    }
  })
})

describe('Akzentfarben auf dunklem Grund', () => {
  /**
   * `--danger3` (#D80909) und `--pending3` (#B12E02) sind **dunkle** Farben.
   * Auf Weiss lesen sie gut, auf petrol9 (#00373D) ergeben sie 2 bis 3:1.
   *
   * Erlaubt bleiben sie dort, wo unter ihnen ein heller Chip liegt — dann ist
   * der Grund in beiden Themen hell und die Farbe richtig. Ohne Chip gehört
   * dorthin das Paar `--danger3-danger2` bzw. `--pending3-pending1`.
   */
  const CHIP = /background(-color)?\s*:\s*var\(--(pending|danger|success|info)1\)/

  it('setzt sie nur, wo ein heller Chip darunterliegt', () => {
    const offenders: string[] = []

    for (const [path, css] of Object.entries(FILES)) {
      const all = rules(css)
      for (const rule of all) {
        if (!/(^|[;\s])color\s*:\s*var\(--(pending3|danger3)\)/.test(rule.body)) continue
        if (CHIP.test(rule.body)) continue

        /* Der Chip darf auch am Vorfahren hängen: Bei der Liquiditätszelle
           färbt sich die Zelle, und die Beschriftung darin erbt den Grund. */
        const onAncestor = rule.selector.split(',').every((selector) => {
          const parts = selector.trim().split(/\s+/)
          for (let cut = parts.length - 1; cut > 0; cut--) {
            const prefix = parts.slice(0, cut).join(' ')
            if (all.some((other) => other.selector.split(',').some((s) => s.trim() === prefix) && CHIP.test(other.body))) {
              return true
            }
          }
          return false
        })
        if (onAncestor) continue

        offenders.push(`${path.replace('../../', '')}: ${rule.selector.replace(/\s+/g, ' ')}`)
      }
    }

    expect(offenders, 'dunkle Akzentfarbe ohne hellen Grund — nimm das Paar-Token').toEqual([])
  })
})
