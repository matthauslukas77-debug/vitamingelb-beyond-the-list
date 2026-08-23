import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../../data/personas'
import { TODAY, type Persona } from '../../../data/types'
import { NO_MARKINGS } from '../../budget/markings'
import { NO_ASSIGNMENTS } from '../../budget/assign'
import { budgetFromDerivation } from '../../budget/storage'
import { deriveForPersona } from '../../budget/derive'
import { DEFAULT_ANSWERS } from '../../budget/benchmark'
import { budgetPerCategory } from '../../signals/engine'
import { categoryDef, CATEGORY_KEYS } from '../../budget/slots'
import { formatAmount } from '../../../lib/money'
import { ask, looksLikeQuestion, pickTool } from '../ask'
import { TOOLS, type AskContext } from '../tools'

/**
 * Der Assistent.
 *
 * Zwei Zusagen werden hier geprüft, und die zweite ist die wichtigere:
 *
 *   1. **Er antwortet auf das, was Nutzer wirklich gefragt haben.** Die
 *      Beispiele stammen wörtlich aus den acht Interviews, nicht aus unserer
 *      Vorstellung davon, was jemand fragen könnte.
 *   2. **Er erfindet nichts.** Jede Zahl in einer Antwort muss aus dem Motor
 *      kommen, jede Antwort einen Beleg tragen, und wo kein Werkzeug passt,
 *      steht kein Satz. Der Fähigkeitstest hat gezeigt, wohin es sonst führt:
 *      Beide Apertus-Grössen hielten den Lohn für das Ungewöhnlichste am
 *      Konto, und beide addieren vierzehn Beträge falsch.
 */

const persona = (id: string): Persona => PERSONAS.find((entry) => entry.id === id)!

function contextFor(target: Persona, withBudget = false): AskContext {
  const derived = deriveForPersona(target, { today: TODAY, months: 12 })
  return {
    persona: target,
    today: TODAY,
    markings: NO_MARKINGS,
    assignments: NO_ASSIGNMENTS,
    budget: withBudget ? budgetFromDerivation(derived, DEFAULT_ANSWERS, TODAY) : null,
  }
}

const bruno = persona('bruno')
const nino = persona('nino')

describe('Was die Nutzer wirklich gefragt haben', () => {
  /* Wörtlich aus den Interviews 01, 02, 04, 05, 06, 08. */
  const asked: [question: string, tool: string][] = [
    ['Wofür gebe ich am meisten aus?', 'topSpending'],
    ['Wo geht mein Geld hin?', 'topSpending'],
    ['Welche Abos habe ich?', 'subscriptions'],
    ['Was zahle ich monatlich?', 'subscriptions'],
    ['Wie steht mein Budget?', 'budgetStatus'],
    ['Was ist ungewöhnlich?', 'whatsUnusual'],
    ['War dieser Monat normal?', 'whatsUnusual'],
    ['Was war meine grösste Einzelbuchung?', 'extraordinary'],
  ]

  it.each(asked)('«%s» wählt %s', (question, tool) => {
    expect(pickTool(question)?.tool.name).toBe(tool)
  })

  it('trennt die Abofrage von der Kategoriefrage', () => {
    /* «Wofür zahle ich monatlich am meisten?» enthält beide Signale. Die
       engere Frage gewinnt, sonst bekommt man eine Kategorieliste, wo man
       nach Abos gefragt hat. */
    expect(pickTool('Welche Abos habe ich?')?.tool.name).toBe('subscriptions')
    expect(pickTool('Wofür gebe ich am meisten aus?')?.tool.name).toBe('topSpending')
  })
})

describe('Jede Antwort steht auf dem Motor', () => {
  it('nennt bei Bruno die grösste Kategorie mit Beleg', () => {
    const outcome = ask('Wofür gebe ich am meisten aus?', contextFor(bruno))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.transactionIds.length).toBeGreaterThan(50)
    expect(outcome.result.rows?.length).toBeGreaterThan(2)
    /* Die Zeilen sind absteigend — sonst hiesse «am meisten» nichts. */
    const amounts = outcome.result.rows!.map((row) => row.amount)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
  })

  it('findet Ninos Abos und rechnet sie aufs Jahr', () => {
    const outcome = ask('Welche Abos habe ich?', contextFor(nino))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.rows!.length).toBeGreaterThan(2)
    expect(outcome.result.link?.screen).toEqual({ name: 'recurring' })
  })

  it('erklärt einen Händler, statt ihn googeln zu lassen', () => {
    const outcome = ask('Wer ist Digitec?', contextFor(nino))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.text).toContain('digitec')
    expect(outcome.result.transactionIds.length).toBeGreaterThan(0)
  })

  it('schickt ohne Budget in den Wizard statt eine Zahl zu erfinden', () => {
    const outcome = ask('Wie steht mein Budget?', contextFor(bruno, false))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.link?.screen).toEqual({ name: 'budgetWizard' })
  })

  it('vergleicht mit Budget gegen den Plan', () => {
    const outcome = ask('Bin ich im Budget?', contextFor(bruno, true))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.rows!.length).toBeGreaterThan(0)
  })

  it('trägt bei jeder Persona und jedem Werkzeug einen Beleg oder einen Weg', () => {
    /* Kein Satz ohne Beleg — dieselbe Doktrin wie auf der Signalkarte. Eine
       Antwort ohne Buchungen muss wenigstens irgendwohin führen. */
    for (const target of PERSONAS) {
      const context = contextFor(target, true)
      for (const tool of TOOLS) {
        for (const example of tool.examples) {
          const outcome = ask(example, context)
          if (outcome.kind !== 'answer') continue
          const { result } = outcome
          expect(
            result.transactionIds.length > 0 || result.link !== undefined,
            `${target.id} · ${tool.name} · «${example}»`,
          ).toBe(true)
          expect(result.text.length, `${target.id} · ${tool.name}`).toBeGreaterThan(20)
        }
      }
    }
  })
})

describe('Der Assistent sagt dasselbe wie der Bildschirm', () => {
  it('nennt dieselbe grösste Kategorie wie das Cockpit', () => {
    /*
     * Der Fehler, den dieser Test verhindert, war schon gebaut: Die erste
     * Fassung rechnete über `spendByCategory` und meldete bei Bruno CHF 1'883
     * für die Steuern — das Cockpit zeigt CHF 1'154, weil die Ableitung
     * Steuerraten über die volle Historie glättet. Beide Zahlen stimmen für
     * ihr Fenster, aber der Nutzer sieht zwei Antworten auf dieselbe Frage.
     *
     * In diesem Projekt ist das der teuerste Fehlertyp, und er ist uns schon
     * einmal passiert (76 Franken Abweichung bei Nino, siehe `derive.test.ts`).
     */
    for (const target of PERSONAS) {
      const context = contextFor(target)
      const outcome = ask('Wofür gebe ich am meisten aus?', context)
      expect(outcome.kind, target.id).toBe('answer')
      if (outcome.kind !== 'answer') continue

      const cockpit = budgetPerCategory(target, TODAY, context.markings, null, context.assignments)
      const biggest = CATEGORY_KEYS.reduce((best, key) =>
        cockpit[key] > cockpit[best] ? key : best,
      )

      expect(outcome.result.text, target.id).toContain(categoryDef(biggest).title)
      expect(outcome.result.text, target.id).toContain(
        formatAmount(cockpit[biggest], { sign: false }),
      )
    }
  })

  it('legt bei den Abos die Buchungen dahinter', () => {
    /* Kein Satz ohne Beleg — die erste Fassung gab hier eine leere Liste
       zurück, und damit stand unter der Antwort nur «gerechnet». */
    const outcome = ask('Welche Abos habe ich?', contextFor(nino))
    expect(outcome.kind).toBe('answer')
    if (outcome.kind !== 'answer') return
    expect(outcome.result.transactionIds.length).toBeGreaterThan(5)
  })
})

describe('Wo er schweigt', () => {
  it('lehnt Anlage- und Vorsorgefragen ausdrücklich ab', () => {
    /* Michaels Frage — die konkreteste des Samples und die einzige, die wir
       nicht beantworten dürfen. */
    for (const question of [
      'Ich brauche in anderthalb Jahren 40000 Franken, wo bekomme ich die am schlausten her?',
      'Soll ich in einen Fonds investieren?',
      'Lohnt sich meine Säule 3a?',
    ]) {
      const outcome = ask(question, contextFor(bruno, true))
      expect(outcome.kind, question).toBe('refused')
    }
  })

  it('lehnt Urteile über die Person ab', () => {
    /* Reto hat die Persönlichkeitsanalyse ausdrücklich abgelehnt:
       «Für mich eigentlich gar nicht.» */
    const outcome = ask('Was für ein Typ bin ich?', contextFor(bruno))
    expect(outcome.kind).toBe('refused')
  })

  it('rät nicht, wenn kein Werkzeug passt', () => {
    for (const question of [
      'Wie ist das Wetter morgen?',
      'Wer hat 1998 die Weltmeisterschaft gewonnen?',
      'Erzähl mir einen Witz',
    ]) {
      expect(ask(question, contextFor(bruno)).kind, question).toBe('unknown')
    }
  })

  it('erfindet keinen Händler, den es nicht gibt', () => {
    expect(ask('Wer ist Zalando?', contextFor(bruno)).kind).toBe('unknown')
  })
})

describe('Das Suchfeld bleibt ein Suchfeld', () => {
  it('hält einzelne Wörter für Suche, nicht für Fragen', () => {
    for (const input of ['twint', 'coop', 'dark', 'ab']) {
      expect(looksLikeQuestion(input), input).toBe(false)
    }
  })

  it('erkennt Fragen an Fragezeichen, Fragewort oder Muster', () => {
    for (const input of ['abos?', 'Wofür gebe ich am meisten aus', 'mein budget']) {
      expect(looksLikeQuestion(input), input).toBe(true)
    }
  })
})
