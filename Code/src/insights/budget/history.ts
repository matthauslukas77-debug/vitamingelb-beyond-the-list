import type { Persona } from '../../data/types'
import { spendByCategory } from './derive'
import type { CategoryKey } from './slots'
import { NO_ASSIGNMENTS, type Assignments } from './assign'
import { NO_MARKINGS, type Markings } from './markings'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Verlauf einer Kategorie über zwölf Monate.
 *
 * Die Blase auf der Übersicht kann eine Frage nicht beantworten, und es ist
 * die erste, die jemand stellt, der sie rot sieht: **ist das dieser Monat oder
 * ist das immer so?** Ein Balken pro Monat beantwortet sie in einem Blick, und
 * ohne diese Antwort ist jede Überschreitung eine Behauptung.
 *
 * Gerechnet wird über `spendByCategory` — zwölfmal, einmal pro Monatsfenster.
 * Bewusst nicht mit einer eigenen, schnelleren Schleife: Die Zuordnung, der
 * Geldflussfilter, die Umlage einer Jahresrechnung und der TWINT-Saldo unter
 * Privaten müssen hier **exakt** dasselbe ergeben wie in der Blase darüber.
 * Zwei Wege zu derselben Zahl wären zwei Wahrheiten über dasselbe Konto — und
 * ein Balken, der neben seiner eigenen Blase nicht aufgeht, ist schlimmer als
 * kein Balken.
 *
 * Der Preis dafür sind zwölf Durchläufe über alle Buchungen. Bei den grössten
 * Personas sind das ein paar Zehntausend Schritte, einmal beim Öffnen der
 * Seite und danach gemerkt — das ist der billigere Fehler.
 */

export interface MonthPoint {
  /** `2026-08` — der Monat selbst. */
  month: string
  /** Erster Tag des Monats, ISO. */
  from: string
  /** Letzter berücksichtigter Tag: Monatsende, im laufenden Monat heute. */
  to: string
  /** Ausgegeben in diesem Monat, Rappen, positiv. */
  spent: number
  /**
   * Der laufende Monat — noch nicht zu Ende und deshalb nicht vergleichbar.
   * Ein Balken, der am 8. neben elf ganzen Monaten steht, sieht wie ein guter
   * Monat aus und ist bloss ein angefangener.
   */
  partial: boolean
}

/** Letzter Tag des Monats, in dem `iso` liegt. */
function monthEnd(iso: string): string {
  const [year, month] = iso.split('-').map(Number)
  const days = new Date(year, month, 0).getDate()
  return `${iso.slice(0, 7)}-${String(days).padStart(2, '0')}`
}

/** Das Monatsfenster `back` Monate vor dem Monat von `today`. */
function windowBack(today: string, back: number): { month: string; from: string; to: string; partial: boolean } {
  const [year, month] = today.slice(0, 7).split('-').map(Number)
  const date = new Date(year, month - 1 - back, 1)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const from = `${key}-01`
  const partial = back === 0
  return { month: key, from, to: partial ? today : monthEnd(from), partial }
}

export interface HistoryOptions {
  /** Stichtag, ISO. */
  today: string
  /** Wie viele Monate einschliesslich des laufenden. Vorgabe 12. */
  months?: number
  assignments?: Assignments
  markings?: Markings
}

/**
 * Ein Punkt pro Monat, ältester zuerst — der laufende Monat steht am Ende und
 * ist als `partial` gekennzeichnet.
 */
export function categoryHistory(
  persona: Persona,
  category: CategoryKey,
  { today, months = 12, assignments = NO_ASSIGNMENTS, markings = NO_MARKINGS }: HistoryOptions,
): MonthPoint[] {
  const points: MonthPoint[] = []
  for (let back = months - 1; back >= 0; back--) {
    const window = windowBack(today, back)
    const totals = spendByCategory(persona.transactions, persona.accounts, {
      from: window.from,
      to: window.to,
      ownName: persona.name,
      markings,
      assignments,
    })
    points.push({ ...window, spent: totals[category] })
  }
  return points
}

/**
 * Der übliche Monat — der **Median** der abgeschlossenen Monate.
 *
 * Median und nicht Mittelwert, und das ist hier der ganze Punkt: Eine einzige
 * Jahresrechnung im März zieht den Mittelwert über elf Monate hoch und macht
 * damit genau die Aussage kaputt, für die die Zahl da ist. Der Median merkt
 * einen Ausreisser nicht — er ist die Antwort auf «wie ist es normalerweise».
 *
 * Der laufende Monat zählt nicht mit: Er ist noch nicht fertig.
 */
export function typicalMonth(points: MonthPoint[]): number {
  const done = points.filter((point) => !point.partial).map((point) => point.spent).sort((a, b) => a - b)
  if (done.length === 0) return 0
  const middle = Math.floor(done.length / 2)
  return done.length % 2 === 1 ? done[middle] : Math.round((done[middle - 1] + done[middle]) / 2)
}

/**
 * Wo der laufende Monat landet, wenn es so weitergeht — Rappen.
 *
 * Lineare Fortschreibung über den Monatsfortschritt. Sie ist bei Fixkosten zu
 * hoch (die Miete ist am 1. bezahlt und kommt nicht wieder) und bei
 * Konsumkategorien recht nah dran. Deshalb steht sie auf der Detailseite nur
 * dort, wo sie etwas heisst, und immer mit dem Wort «bei diesem Tempo».
 */
export function projectedMonth(spent: number, progress: number): number {
  if (progress <= 0) return spent
  return Math.round(spent / Math.min(1, progress))
}
