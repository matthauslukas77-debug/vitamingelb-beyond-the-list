import type { Transaction } from '../types'

/**
 * Werkzeug für die Ereignisse in den Persona-Dateien.
 *
 * Die generierten Buchungen in `<id>.data.ts` bilden den Alltag ab und sind
 * bewusst gleichmässig — jede Persona bekam über 23 Monate exakt denselben
 * Lohnbetrag. Was ihnen fehlt, ist das Unerwartete: ein Jobwechsel, ein
 * dreizehnter Monatslohn, ein Bonus. Genau darum geht es auf dem
 * Signale-Bildschirm.
 *
 * Diese Ereignisse stehen deshalb in der **von Hand gepflegten** Datei
 * `<id>.ts`, neben Konten und Daueraufträgen, jedes mit dem Muster, das es
 * belegen soll. Der Generator bleibt unangetastet.
 */

export interface JobChange {
  /** Ab diesem Datum zahlt der neue Arbeitgeber. */
  since: string
  /** Woran die alten Lohnbuchungen zu erkennen sind. */
  match: RegExp
  /** Der neue Buchungstext, im Format des Auszugs. */
  text: string
  /** Der neue Betrag in Rappen, positiv. */
  amount: number
  /** Präfix der neuen Buchungs-Ids. */
  idPrefix: string
}

/**
 * Ersetzt die Lohnbuchungen ab einem Datum durch die eines neuen Arbeitgebers.
 *
 * Bewusst als Ersetzung und nicht als Ergänzung: Wer den Arbeitgeber wechselt,
 * bekommt nicht zwei Löhne. Die neuen Buchungen übernehmen Datum und Konto der
 * alten, damit der Rhythmus stimmt — der 25. bleibt der 25.
 *
 * Der Kontostand von heute bleibt, wie er ist; er ist der Anker, von dem der
 * Verlauf rückwärts gerechnet wird (`insights/engine/balance.ts`). Was sich
 * ändert, ist die Vergangenheit — und das ist richtig so: Mit dem höheren Lohn
 * stand vorher weniger auf dem Konto.
 */
export function withJobChange(transactions: Transaction[], change: JobChange): Transaction[] {
  const replaced: Transaction[] = []

  const kept = transactions.filter((tx) => {
    const isOldSalary = tx.amount > 0 && tx.date >= change.since && change.match.test(tx.text)
    if (!isOldSalary) return true
    replaced.push({
      ...tx,
      id: `${change.idPrefix}-${tx.date}`,
      text: change.text,
      amount: change.amount,
    })
    return false
  })

  return [...kept, ...replaced]
}
