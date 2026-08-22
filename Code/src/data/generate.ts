/**
 * Kleine Helfer für Buchungslisten.
 *
 * Hier stand bis zuletzt auch ein Zufallsgenerator für Persona-Daten. Er ist
 * weg: die Buchungen kommen jetzt fertig aus
 * WORKSPACE/04_experiments/postfinance_template_data/_generator/ und liegen
 * als `<persona>.data.ts` daneben — 24 Monate statt sechs, und die
 * Buchungstexte sehen aus wie im echten Auszug.
 */

import type { Transaction } from './types'

export function sortByDateDesc(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1,
  )
}

/** Buchungen nach Tag gruppieren, für die Tagesüberschriften der Liste. */
export function groupByDay(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups = new Map<string, Transaction[]>()
  for (const tx of sortByDateDesc(transactions)) {
    const bucket = groups.get(tx.date)
    if (bucket) bucket.push(tx)
    else groups.set(tx.date, [tx])
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }))
}
