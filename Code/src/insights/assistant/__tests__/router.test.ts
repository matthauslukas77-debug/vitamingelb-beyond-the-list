import { describe, expect, it } from 'vitest'
import { CATALOG as catalog } from '../../../../supabase/functions/ask/catalog'
import { NONE, cleanArgs, readChoice } from '../../../../supabase/functions/ask/reader'
import { routerSchema, TOOLS } from '../tools'

/**
 * Stufe 2 — der Router.
 *
 * Zwei Dinge werden hier festgehalten:
 *
 *   1. **Eine Wahrheit über den Katalog.** Die Edge Function läuft in Deno und
 *      kann `tools.ts` nicht laden — es hinge am halben Motor. Sie führt
 *      deshalb eine erzeugte Kopie. Ohne diesen Test driftet die Kopie
 *      irgendwann ab, und das Modell wählt Werkzeuge, die es nicht mehr gibt.
 *
 *   2. **Der nachsichtige Leser.** Gemessen am echten 8B kamen von sechzehn
 *      richtigen Werkzeugwahlen nur sieben als sauberes `tool_calls` zurück.
 *      Die Beispiele unten sind wörtliche Antworten aus diesen Läufen.
 */

const NAMES = TOOLS.map((tool) => tool.name)
const argsOf = (name: string) => Object.keys(TOOLS.find((t) => t.name === name)?.parameters.properties ?? {})

describe('Katalog und Kopie', () => {
  it('sind Zeichen für Zeichen dasselbe', () => {
    /* Nicht nur die Namen: Auch die Beschreibungen entscheiden, was das Modell
       wählt. Weicht die Kopie ab, routet die Live-App anders als der Test. */
    expect(catalog).toEqual(JSON.parse(JSON.stringify(routerSchema())))
  })

  it('nennt jedes Werkzeug genau einmal', () => {
    const names = catalog.map((entry) => entry.function.name)
    expect(new Set(names).size).toBe(names.length)
    expect([...names].sort()).toEqual([...NAMES].sort())
  })

  it('beschreibt jedes Werkzeug ausführlich genug, um es zu unterscheiden', () => {
    /* «Welche grossen Einzelbuchungen aus dem Rahmen fallen» hat in der ersten
       Messung nicht gereicht — auf «Was war die teuerste Sache?» antwortete
       das Modell KEINS. Erst Beschreibungen mit Beispielfragen trafen. */
    for (const entry of catalog) {
      expect(entry.function.description.length, entry.function.name).toBeGreaterThan(80)
      expect(entry.function.description, entry.function.name).toContain('«')
    }
  })
})

describe('Der nachsichtige Leser', () => {
  it('nimmt einen sauberen Tool-Call', () => {
    const choice = readChoice(
      { tool_calls: [{ function: { name: 'merchantLookup', arguments: '{"name":"SumUp"}' } }] },
      NAMES,
      argsOf,
    )
    expect(choice).toEqual({ name: 'merchantLookup', args: { name: 'SumUp' }, via: 'tool_call' })
  })

  it('holt den Namen aus blossem Text — der häufigste Fall', () => {
    /* Wörtlich so gemessen. Ohne diesen Zweig wären neun von sechzehn
       richtigen Wahlen weggeworfen worden. */
    for (const text of ['subscriptions', 'subscriptions()', ' budgetStatus ']) {
      const choice = readChoice({ content: text }, NAMES, argsOf)
      expect(choice.via, text).toBe('text')
      expect(NAMES, text).toContain(choice.name)
    }
  })

  it('übersteht das durchgesickerte Vorlagen-Token', () => {
    /* Der 8B-Zwilling des 70B-Klammerfehlers, wörtlich aus einem Lauf. */
    const choice = readChoice(
      { content: 'extraordinary<|tools_prefix|>[{"extraordinary": }]' },
      NAMES,
      argsOf,
    )
    expect(choice.name).toBe('extraordinary')
  })

  it('nimmt KEINS als Absage und nicht als Werkzeugnamen', () => {
    expect(readChoice({ content: NONE }, NAMES, argsOf).name).toBeNull()
    expect(readChoice({ content: 'KEINS, dazu sage ich nichts.' }, NAMES, argsOf).via).toBe('keins')
  })

  it('lässt einen erfundenen Werkzeugnamen nicht durch', () => {
    /* Der Katalog ist die Grenze. Was das Modell sonst erfindet, gilt nicht. */
    expect(readChoice({ tool_calls: [{ function: { name: 'transferAllMoney', arguments: '{}' } }] }, NAMES, argsOf).name)
      .toBeNull()
    expect(readChoice({ content: 'deleteAccount' }, NAMES, argsOf).name).toBeNull()
  })

  it('wirft die richtige Wahl nicht wegen kaputter Argumente weg', () => {
    const choice = readChoice(
      { tool_calls: [{ function: { name: 'merchantLookup', arguments: '{"name": ' } }] },
      NAMES,
      argsOf,
    )
    expect(choice.name).toBe('merchantLookup')
    expect(choice.args).toEqual({})
  })

  it('siebt Argumente, die im Schema nicht stehen', () => {
    expect(cleanArgs({ name: 'Coop', rm: '-rf /', months: 12 }, ['name'])).toEqual({ name: 'Coop' })
    expect(cleanArgs({ name: 'x' }, ['name'])).toEqual({})
    expect(cleanArgs('nicht mal ein Objekt', ['name'])).toEqual({})
  })

  it('lässt kein Argument durch, das nicht in der Frage steht', () => {
    /*
     * Gemessen: Auf «Kannst du mir diesen Namen auflösen?» antwortete der 8B
     * mit `{"name":"UBS"}`, im nächsten Lauf mit `{"name":"Amazon"}`. Beide
     * kommen in der Frage nicht vor. Ein ausdrückliches Verbot im Systemtext
     * hat es nicht verhindert — deshalb prüft der Leser gegen die Frage.
     */
    const frage = 'kannstdumirdiesennamenaufloesen'
    const erfunden = readChoice(
      { tool_calls: [{ function: { name: 'merchantLookup', arguments: '{"name":"UBS"}' } }] },
      NAMES,
      argsOf,
      frage,
    )
    expect(erfunden.name).toBe('merchantLookup')
    expect(erfunden.args, 'erfundener Händler').toEqual({})

    /* Was wirklich in der Frage steht, darf zurückkommen. */
    const echt = readChoice(
      { tool_calls: [{ function: { name: 'merchantLookup', arguments: '{"name":"Coop Pronto"}' } }] },
      NAMES,
      argsOf,
      'wieviel habe ich bei coop pronto ausgegeben'.replace(/[^a-z0-9]/g, ''),
    )
    expect(echt.args).toEqual({ name: 'Coop Pronto' })
  })

  it('gibt bei Prosa nichts zurück, statt zu raten', () => {
    const choice = readChoice({ content: 'Gerne helfe ich dir mit deinen Finanzen!' }, NAMES, argsOf)
    expect(choice.name).toBeNull()
    expect(choice.via).toBe('prosa')
  })
})
