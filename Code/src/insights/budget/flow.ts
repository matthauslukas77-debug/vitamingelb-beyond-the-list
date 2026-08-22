import type { Account, Transaction } from '../../data/types'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Geldfluss-Achse: Was ist wirklich weg, und was hat nur den Platz
 * gewechselt?
 *
 * Das ist die teuerste einzelne Verbesserung am heutigen Stand. Die App zählt
 * jede Belastung als Ausgabe — auch den Dauerauftrag aufs eigene Sparkonto.
 * Livia im Interview 05, wörtlich:
 *
 *   «500 Franken aufs Sparkonto — dann ist das wie quasi als Ausgabe,
 *    obwohl es eigentlich gar nicht aus ist.»
 *
 * Bei ihr sind das CHF 479 im Monat, bei Reto 1'198, bei Bruno 1'792. Wer das
 * mitzählt, sagt nicht bloss eine ungenaue Zahl — er sagt etwas Falsches über
 * die Vermögenslage. Ein Budget, das darauf aufbaut, ist unbrauchbar.
 *
 * Fünf Zustände:
 *
 *   out      Geld ist weg. Zählt ins Budget.
 *   in       Geld ist gekommen. Zählt ins Einkommen.
 *   moved    Zwischen eigenen Konten verschoben. Zählt nirgends —
 *            aber wird als «wirklich gespart» getrennt ausgewiesen.
 *   settled  Rückerstattung oder Kreditkartenrechnung: mindert eine frühere
 *            Ausgabe oder wiederholt sie. Zählt nicht noch einmal.
 *   lent     Ausgelegt und zurückerhalten (TWINT unter Privaten).
 *            Nur der Saldo zählt.
 *
 * Die Reihenfolge der Prüfungen ist Absicht: das härteste Signal zuerst
 * (das Gegenkonto steht in den Daten), der Buchungstext zuletzt. Die teuren
 * Fehler gehören zuerst ausgeschlossen.
 */

export type MoneyFlow = 'out' | 'in' | 'moved' | 'settled' | 'lent'

export interface FlowResult {
  flow: MoneyFlow
  /** Woran es erkannt wurde — steht später im «warum steht das hier?». */
  reason: string
}

export interface FlowContext {
  /** Die Konten der Persona, um ein Gegenkonto einordnen zu können. */
  accounts: Account[]
  /** Eigener Name, für Überträge auf ein Konto bei einer anderen Bank. */
  ownName?: string
}

/** Geld an eine Privatperson gesendet oder von ihr empfangen. */
const TWINT_PEER = /TWINT GELD (GESENDET|EMPFANGEN)/i

/** Rückerstattung auf einen früheren Kartenkauf. */
const REFUND = /GUTSCHRIFT R(Ü|UE)CKERSTATTUNG/i

/** Die monatliche Kreditkartenabrechnung — die Käufe stehen einzeln im Auszug. */
const CARD_SETTLEMENT = /(KREDITKARTEN?ABRECHNUNG|KARTENRECHNUNG|VISA RECHNUNG|MASTERCARD RECHNUNG)/i

/** Übertrag auf ein eigenes Konto, ohne dass ein Gegenkonto hinterlegt wäre. */
const OWN_TRANSFER = /(DAUERAUFTRAG SPARKONTO|SPARAUFTRAG|(Ü|UE)BERTRAG AUF (EIGENES )?(SPAR)?KONTO|EIGEN(ES|E) KONTO)/i

/**
 * Einzahlung in die Säule 3a.
 *
 * Streng genommen ist das verschobenes Geld — es landet auf einem eigenen
 * Konto. Der PostFinance-Budgetrechner führt es trotzdem als Ausgabe
 * («Beiträge private Vorsorge», `insurance.1`), und das aus gutem Grund: bis
 * zur Pensionierung ist es gebunden, es steht diesen Monat nicht zur
 * Verfügung. Wir folgen dem Original, sonst wäre der Vergleich gegen den
 * Richtwert schief. Der Dauerauftrag aufs freie Sparkonto bleibt `moved`.
 */
const PILLAR_3A = /(VORSORGE 3A|S(Ä|AE)ULE 3A|3A[- ]KONTO|VORSORGEKONTO)/i

/**
 * Ordnet eine einzelne Buchung ein.
 *
 * Reihenfolge:
 *   1. Säule 3a — bevor das Gegenkonto greift, sonst verschwindet sie als `moved`.
 *   2. Gegenkonto — steht in den Daten, härtestes Signal.
 *   3. Kreditkartenabrechnung und Rückerstattung.
 *   4. TWINT unter Privaten.
 *   5. Buchungstext für Überträge ohne hinterlegtes Gegenkonto.
 *   6. Vorzeichen.
 */
export function moneyFlow(tx: Transaction, context: FlowContext): FlowResult {
  const text = tx.text

  if (PILLAR_3A.test(text)) {
    return { flow: 'out', reason: 'Säule 3a — im Budgetrechner eine Ausgabe' }
  }

  if (tx.counterAccountId) {
    const target = context.accounts.find((account) => account.id === tx.counterAccountId)
    if (target?.kind === 'retirement3a') {
      return { flow: 'out', reason: 'Einzahlung Vorsorgekonto 3a' }
    }
    /* Auch ein Gegenkonto, das nicht in der Kontoliste steht, ist ein eigenes:
       Retos Sparkonto liegt bei der BKB und wird hier nicht aggregiert. Die
       Buchung trägt das Gegenkonto trotzdem. */
    return {
      flow: 'moved',
      reason: target
        ? `Übertrag auf «${target.name}» — eigenes Konto`
        : 'Übertrag auf ein eigenes Konto bei einer anderen Bank',
    }
  }

  if (CARD_SETTLEMENT.test(text)) {
    return { flow: 'settled', reason: 'Kreditkartenrechnung — die Käufe stehen einzeln im Auszug' }
  }

  if (REFUND.test(text)) {
    return { flow: 'settled', reason: 'Rückerstattung — mindert die frühere Ausgabe' }
  }

  if (TWINT_PEER.test(text)) {
    return { flow: 'lent', reason: 'TWINT unter Privaten — nur der Saldo zählt' }
  }

  if (OWN_TRANSFER.test(text)) {
    return { flow: 'moved', reason: 'Übertrag auf ein eigenes Konto (aus dem Buchungstext)' }
  }

  if (context.ownName && isOwnName(text, context.ownName)) {
    return { flow: 'moved', reason: 'Gegenpartei ist die Kontoinhaberin selbst' }
  }

  /* `transfer` ist die Kategorie, die die Bank selbst für Umbuchungen
     vergibt. Sie kommt zuletzt, weil sie weicher ist als alles darüber. */
  if (tx.category === 'transfer') {
    return { flow: 'moved', reason: 'von der Bank als Umbuchung kategorisiert' }
  }

  return tx.amount > 0
    ? { flow: 'in', reason: 'Gutschrift' }
    : { flow: 'out', reason: 'Belastung' }
}

/** Steht der eigene Name als Gegenpartei im Buchungstext? */
function isOwnName(text: string, ownName: string): boolean {
  const parts = ownName.split(/\s+/).filter((part) => part.length > 2)
  if (parts.length === 0) return false
  const upper = text.toUpperCase()
  return parts.every((part) => upper.includes(part.toUpperCase()))
}

/** Zählt diese Buchung als Ausgabe ins Budget? */
export function isBudgetExpense(flow: MoneyFlow): boolean {
  return flow === 'out'
}

export interface FlowTotals {
  /** Je Zustand die Summe der Beträge (Rappen, vorzeichenrichtig) und die Anzahl. */
  out: number
  in: number
  moved: number
  settled: number
  lent: number
  counts: Record<MoneyFlow, number>
  /**
   * Was ein naives «alle Belastungen zusammenzählen» ergäbe — die Zahl, die
   * die App heute zeigt. Positiv.
   */
  naiveExpenses: number
  /** Was wirklich weg ist. Positiv. */
  realExpenses: number
  /** Die Differenz zwischen beidem: die vermiedene Doppelzählung. Positiv. */
  avoidedDoubleCount: number
  /** Was auf eigene Konten gegangen ist, netto. Positiv = gespart. */
  movedToSavings: number
}

/**
 * Summiert eine Buchungsliste über die Geldfluss-Achse.
 *
 * `lent` wird netto gerechnet: Wer 200 auslegt und 180 zurückbekommt, hat 20
 * ausgegeben — und die stehen dann in `out`, nicht in `lent`. Ein negativer
 * Netto-Saldo aus TWINT ist eine echte Ausgabe, ein positiver eine Einnahme.
 */
export function flowTotals(transactions: Transaction[], context: FlowContext): FlowTotals {
  const sums: Record<MoneyFlow, number> = { out: 0, in: 0, moved: 0, settled: 0, lent: 0 }
  const counts: Record<MoneyFlow, number> = { out: 0, in: 0, moved: 0, settled: 0, lent: 0 }
  let naive = 0

  for (const tx of transactions) {
    const { flow } = moneyFlow(tx, context)
    sums[flow] += tx.amount
    counts[flow] += 1
    if (tx.amount < 0) naive += -tx.amount
  }

  const lentNet = sums.lent
  const realExpenses = -sums.out + (lentNet < 0 ? -lentNet : 0)

  return {
    ...sums,
    counts,
    naiveExpenses: naive,
    realExpenses,
    avoidedDoubleCount: naive - realExpenses,
    movedToSavings: -sums.moved,
  }
}
