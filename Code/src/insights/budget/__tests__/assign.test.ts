import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../../data/personas'
import { TODAY, type Persona, type Transaction } from '../../../data/types'
import { categorize } from '../mapping'
import { isCashWithdrawal, merchantKey, merchantLabel } from '../merchant'
import {
  fingerprintOf,
  NO_ASSIGNMENTS,
  withAssignment,
  withoutAssignment,
  type Assignments,
} from '../assign'
import { MAX_ON_BOARD, needsAssignment, openAssignments } from '../review'
import { fullMonthWindow, spendByCategory } from '../derive'
import { CATEGORY_KEYS, slotKey, type CategoryKey } from '../slots'

/**
 * Das Zuordnungsbrett.
 *
 * Zwei Dinge muss es können, und das zweite ist das wichtigere:
 *
 *   1. **Eine Antwort gilt für die ganze Quelle.** Sonst ist es dasselbe
 *      Dropdown wie heute, nur bunter.
 *   2. **Es verschiebt Geld, es erzeugt keines.** Dieselbe Zusage wie bei den
 *      Einordnungen in `markings.test.ts`: Was in einen Topf hineinkommt, muss
 *      aus einem anderen herausgekommen sein. Ohne diesen Test wäre eine
 *      falsche Zuordnung nicht bloss falsch einsortiert, sondern eine
 *      Budgetsumme, die niemand nachrechnen kann.
 */

const persona = (id: string): Persona => PERSONAS.find((entry) => entry.id === id)!

const bruno = persona('bruno')
const livia = persona('livia')

const WINDOW = fullMonthWindow(TODAY, 12)

function openFor(target: Persona, assignments: Assignments = NO_ASSIGNMENTS) {
  return openAssignments(target.transactions, target.accounts, {
    from: WINDOW.from,
    to: TODAY,
    ownName: target.name,
    assignments,
  })
}

function spend(target: Persona, assignments: Assignments): Record<CategoryKey, number> {
  return spendByCategory(target.transactions, target.accounts, {
    from: WINDOW.from,
    to: WINDOW.to,
    ownName: target.name,
    assignments,
  })
}

const totalOf = (byCategory: Record<CategoryKey, number>) =>
  CATEGORY_KEYS.reduce((sum, key) => sum + byCategory[key], 0)

describe('Der Händlerschlüssel', () => {
  it('fasst alle Bezüge am Automaten zu einer Quelle zusammen', () => {
    /* Sonst stünden zwanzig Automaten auf dem Brett, und keiner von ihnen
       verrät, wofür das Geld ausgegeben wurde. */
    const cash = bruno.transactions.filter(isCashWithdrawal)
    expect(cash.length).toBeGreaterThan(5)
    expect(new Set(cash.map(merchantKey)).size).toBe(1)
  })

  it('nennt den Bezug Bargeld und nicht «Die Post»', () => {
    /* Der Postomat löst über die Markenregistry auf «Die Post» auf. Auf dem
       Brett stünde dann eine Quelle, bei der niemand eingekauft hat. */
    const withdrawal = bruno.transactions.find(isCashWithdrawal)!
    expect(merchantLabel(withdrawal)).toBe('Bargeld')
  })

  it('gibt derselben Marke in verschiedenen Filialen denselben Schlüssel', () => {
    const one = { id: 'a', date: '2026-01-05', text: 'COOP PRONTO BERN BAHNHOF', amount: -1200 }
    const two = { id: 'b', date: '2026-02-05', text: 'COOP PRONTO THUN', amount: -900 }
    expect(merchantKey(one as Transaction)).toBe(merchantKey(two as Transaction))
  })
})

describe('Die Zuordnung von Hand', () => {
  it('schlägt das Regelwerk', () => {
    /* HORNBACH trifft eine Regel und landet in «Weitere Ausgaben». Für einen
       Hauseigentümer ist es Unterhalt — und was er sagt, gilt. */
    const purchase = bruno.transactions.find((tx) => /HORNBACH/i.test(tx.text))!
    expect(slotKey(categorize(purchase))).toBe('consumption.3')

    const assignments = withAssignment(NO_ASSIGNMENTS, merchantKey(purchase), {
      category: 'reside',
      field: 2,
    })
    const assigned = categorize(purchase, assignments)
    expect(slotKey(assigned)).toBe('reside.2')
    expect(assigned.confidence).toBe(1)
    expect(assigned.matchedBy).toBe('von dir zugeordnet')
  })

  it('gilt für alle Buchungen der Quelle, nicht nur für die angefasste', () => {
    const landi = bruno.transactions.filter((tx) => /LANDI/i.test(tx.text))
    expect(landi.length).toBeGreaterThan(10)

    const assignments = withAssignment(NO_ASSIGNMENTS, merchantKey(landi[0]), {
      category: 'reside',
      field: 2,
    })
    /* Das ist der ganze Punkt: **eine** Antwort, neunzehn erledigte Buchungen. */
    expect(landi.every((tx) => slotKey(categorize(tx, assignments)) === 'reside.2')).toBe(true)
  })

  it('lässt sich zurücknehmen und stellt dann genau den alten Zustand her', () => {
    const purchase = bruno.transactions.find((tx) => /HORNBACH/i.test(tx.text))!
    const before = categorize(purchase)
    const key = merchantKey(purchase)
    const after = withoutAssignment(
      withAssignment(NO_ASSIGNMENTS, key, { category: 'reside', field: 2 }),
      key,
    )
    expect(categorize(purchase, after)).toEqual(before)
  })

  it('ändert die Buchung selbst nicht', () => {
    /* Der Nachbau in `src/app/` zeigt weiter den Ist-Zustand. Die Zuordnung
       lebt daneben — sonst wäre der Vergleich, um den es in diesem Projekt
       geht, nicht mehr möglich. */
    const purchase = bruno.transactions.find((tx) => /LANDI/i.test(tx.text))!
    const original = purchase.category
    categorize(purchase, withAssignment(NO_ASSIGNMENTS, merchantKey(purchase), {
      category: 'reside',
      field: 2,
    }))
    expect(purchase.category).toBe(original)
  })
})

describe('Was auf dem Brett landet', () => {
  it('legt eine Quelle einmal hin, nicht einmal pro Buchung', () => {
    const groups = openFor(bruno)
    const landi = groups.find((group) => group.label === 'LANDI')
    expect(landi).toBeDefined()
    expect(landi!.count).toBeGreaterThan(10)
    /* Die eingesparte Mühe in einer Zahl: so viele Dropdowns wären es heute. */
    expect(landi!.transactionIds).toHaveLength(landi!.count)
  })

  it('nennt die grösste Quelle zuerst', () => {
    const groups = openFor(bruno)
    const totals = groups.map((group) => group.total)
    expect([...totals].sort((a, b) => b - a)).toEqual(totals)
  })

  it('lässt zu, was eine benannte Regel in einen eigenen Topf gelegt hat', () => {
    /* «Tibits» trifft eine Gastro-Regel und liegt in «Ferien, Hobbies,
       Kultur». Das ist eine Aussage über diesen Händler, keine Verlegenheit —
       und gehört deshalb nicht aufs Brett. Ohne diese Grenze stünden dreissig
       Quellen da und niemand fasste sie an. */
    expect(needsAssignment(categorize({ text: 'TIBITS BERN', category: 'eatingOut' } as Transaction)))
      .toBe(false)
  })

  it('legt hin, was nur aus der groben Bankkategorie kommt', () => {
    /* Livias You.com-Abo wird über «shopping» zu «Kleider und Schuhe». */
    const groups = openFor(livia)
    expect(groups.map((group) => group.label)).toContain('You.com')
  })

  it('verschwindet, sobald die Frage beantwortet ist', () => {
    const before = openFor(bruno)
    const landi = before.find((group) => group.label === 'LANDI')!
    const after = openFor(bruno, withAssignment(NO_ASSIGNMENTS, landi.key, {
      category: 'reside',
      field: 2,
    }))
    expect(after.map((group) => group.label)).not.toContain('LANDI')
    expect(after).toHaveLength(before.length - 1)
  })

  it('passt bei jeder Persona auf ein einziges Brett', () => {
    /* Die Zusage an den Nutzer: einmal durchziehen, fertig. Wären es dreissig
       Quellen, wäre das Brett eine Liste mit Extraschritten und niemand käme
       bis zum Ende. Fällt dieser Test, ist das kein Fehler im Code — dann hat
       eine Persona mehr offene Quellen bekommen, und es braucht eine zweite
       Runde. Der Bildschirm kann das; der Satz «X weitere folgen danach» ist
       dann eben zu sehen. */
    for (const target of PERSONAS) {
      const groups = openFor(target)
      expect(groups.length, `${target.name}: offene Quellen`).toBeLessThanOrEqual(MAX_ON_BOARD)
    }
  })

  it('lässt niemanden mit einer leeren Aufgabe zurück', () => {
    /* Jede Quelle auf dem Brett muss mindestens eine Buchung und einen Betrag
       tragen — sonst stünde da ein Chip, dessen Zuordnung nichts bewegt. */
    for (const target of PERSONAS) {
      for (const group of openFor(target)) {
        expect(group.count, `${target.name}/${group.label}`).toBeGreaterThan(0)
        expect(group.total, `${target.name}/${group.label}`).toBeGreaterThan(0)
        expect(group.reason.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('Die Statistik bleibt heil', () => {
  it('verschiebt Geld zwischen Töpfen, statt welches zu erzeugen', () => {
    /* Die Zusage aus `markings.ts`, hier für die andere Richtung: Dort geht es
       um **ob** eine Buchung zählt, hier um **wohin**. Die Summe darf sich
       nicht bewegen — sonst stimmte hinterher keine Ausgabenzahl mehr. */
    const before = spend(bruno, NO_ASSIGNMENTS)
    const landi = openFor(bruno).find((group) => group.label === 'LANDI')!
    const after = spend(
      bruno,
      withAssignment(NO_ASSIGNMENTS, landi.key, { category: 'reside', field: 2 }),
    )

    expect(totalOf(after)).toBe(totalOf(before))
    expect(after.reside).toBeGreaterThan(before.reside)
    expect(after.consumption).toBeLessThan(before.consumption)
    /* Und zwar genau um denselben Betrag. */
    expect(after.reside - before.reside).toBe(before.consumption - after.consumption)
  })

  it('lässt die Summe auch dann stehen, wenn alle Quellen zugeordnet sind', () => {
    for (const target of PERSONAS) {
      const before = spend(target, NO_ASSIGNMENTS)
      let assignments = NO_ASSIGNMENTS
      for (const group of openFor(target)) {
        assignments = withAssignment(assignments, group.key, { category: 'health', field: 2 })
      }
      const after = spend(target, assignments)
      expect(totalOf(after), `${target.name}: Summe nach dem Zuordnen`).toBe(totalOf(before))
    }
  })
})

describe('Der Fingerabdruck', () => {
  it('ändert sich mit dem Inhalt, nicht mit der Reihenfolge', () => {
    const slot = { category: 'reside', field: 2 } as const
    const one = withAssignment(withAssignment(NO_ASSIGNMENTS, 'a', slot), 'b', slot)
    const two = withAssignment(withAssignment(NO_ASSIGNMENTS, 'b', slot), 'a', slot)
    expect(fingerprintOf(one)).toBe(fingerprintOf(two))
    expect(fingerprintOf(withAssignment(one, 'c', slot))).not.toBe(fingerprintOf(one))
  })
})
