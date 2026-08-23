import type { Account, Transaction } from '../../data/types'
import { upcoming, type RecurringSeries } from '../../domain/recurring'
import { parseIso } from '../../lib/date'
import { moneyFlow } from '../budget/flow'
import type { Signal, SignalKind } from '../signals/engine'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Wie viel vom Regelmässigen schon vergeben ist.
 *
 * Der Kopf der wiederkehrenden Buchungen zeigte bisher eine grosse Zahl —
 * «Fix pro Monat 2'728.94». Die Zahl ist richtig und sagt allein nichts: Ob
 * sie viel ist, hängt daran, was hereinkommt. Erst der **Anteil** ist eine
 * Auskunft, und er ist über die Personas hinweg der ganze Unterschied — bei
 * Reto knapp ein Drittel, bei Livia fast die Hälfte.
 *
 * Gerechnet wird nur auf erkannten Reihen, also auf dem, was mehrfach
 * vorgekommen ist. Einmalige Buchungen zählen bewusst nicht mit: «vergeben»
 * heisst hier, dass es auch nächsten Monat wieder abgeht.
 *
 * **Nicht alles, was abgeht, ist weg.** Livias Dauerauftrag landet auf ihrem
 * eigenen Sparkonto — das sind 36 ihrer 47 Prozent. Ein Balken, der
 * das als vergeben führt, sagt ihr das Gegenteil von dem, was stimmt. Erkannt
 * wird es nicht neu, sondern mit `moneyFlow` aus `insights/budget/flow.ts`:
 * dieselbe Unterscheidung, die auch das Budget die Doppelzählung vermeiden
 * lässt. Der Anteil bleibt vollständig — aber er ist zweifarbig.
 *
 * Ohne erkannte Einnahme gibt es keinen Nenner. Dann bleibt `committedShare`
 * `null` und der Balken entfällt — ein Anteil ohne Bezugsgrösse wäre eine
 * erfundene Zahl.
 */

export interface Commitments {
  /** Rappen pro Monat, negativ — alles, was regelmässig abgeht. */
  fixedMonthly: number
  /**
   * Der Teil von `fixedMonthly`, der auf ein eigenes Konto geht — negativ.
   * Steckt in `fixedMonthly` mit drin, ist aber nicht ausgegeben, sondern
   * verschoben.
   */
  movedMonthly: number
  /** Rappen pro Monat, positiv — alles, was regelmässig hereinkommt. */
  incomingMonthly: number
  /**
   * Anteil des regelmässigen Eingangs, der schon vergeben ist: 0.31 = 31 %.
   * Kann über 1 liegen — dann geht mehr fix ab, als regelmässig hereinkommt.
   * `null`, wenn keine Einnahmereihe erkannt ist.
   */
  committedShare: number | null
  /**
   * Was bis Ende dieses Monats noch abgeht — Belastungen, nicht netto.
   *
   * Zwei Fassungen davor sind gescheitert, beide sichtbar am Bildschirm:
   *
   *   1. **Netto über 30 Tage.** Der Lohn fiel ins Fenster, und über einer
   *      Liste von Verpflichtungen stand «11 Zahlungen · 1'855.85+».
   *   2. **Belastungen über 30 Tage.** Sobald jede Reihe monatlich ist, ist
   *      das dieselbe Zahl wie «Fix pro Monat» — bei Reto zweimal 2'779.15 auf
   *      einer Karte. Eine Zahl, die eine andere wiederholt, ist keine
   *      zweite Auskunft.
   *
   * Bis Monatsende ist die Frage, die im Interview wirklich gestellt wurde:
   * reicht es noch. Sie kann die Monatssumme nie erreichen und wird jeden Tag
   * kleiner.
   */
  restOfMonth: { count: number; total: number }
  /** Wie viele Reihen erkannt sind, und wie viele davon Abos. */
  counts: { series: number; subscriptions: number }
}

/**
 * Tage von heute bis einschliesslich zum letzten Tag des Monats.
 *
 * Lokale Zeit, wie `parseIso` — Tag 0 des nächsten Monats ist der letzte des
 * laufenden. UTC und lokal zu mischen verschiebt das Ergebnis um die
 * Zeitzone und damit gelegentlich um einen ganzen Tag.
 */
function daysToMonthEnd(today: string): number {
  const date = parseIso(today)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return Math.round((last.getTime() - date.getTime()) / 86_400_000)
}

function sumMonthly(series: RecurringSeries[]): number {
  return series.reduce((total, entry) => total + entry.monthlyAmount, 0)
}

export function commitmentsOf({
  series,
  transactions,
  accounts,
  ownName,
  today,
}: {
  series: RecurringSeries[]
  transactions: Transaction[]
  accounts: Account[]
  ownName?: string
  today: string
}): Commitments {
  const byId = new Map(transactions.map((entry) => [entry.id, entry]))

  /* Beurteilt wird die jüngste Buchung der Reihe: Ein Dauerauftrag, der heute
     aufs eigene Sparkonto geht, ist heute ein Übertrag — auch wenn er vor
     einem Jahr noch anders hiess. */
  const isMoved = (entry: RecurringSeries): boolean => {
    const last = entry.transactionIds
      .map((id) => byId.get(id))
      .filter((tx): tx is Transaction => tx !== undefined)
      .at(-1)
    return last ? moneyFlow(last, { accounts, ownName }).flow === 'moved' : false
  }

  const outgoing = series.filter((entry) => entry.monthlyAmount < 0)
  const fixedMonthly = sumMonthly(outgoing)
  const movedMonthly = sumMonthly(outgoing.filter(isMoved))
  const incomingMonthly = sumMonthly(series.filter((entry) => entry.monthlyAmount > 0))
  /* Bis zum letzten Tag dieses Monats — `upcoming` rechnet in Tagen, also wird
     der Abstand dorthin gerechnet statt ein zweites Fenster gebaut. */
  const daysLeft = daysToMonthEnd(today)
  const rest = upcoming(series, today, daysLeft).filter((entry) => entry.amount < 0)

  return {
    fixedMonthly,
    movedMonthly,
    incomingMonthly,
    committedShare: incomingMonthly > 0 ? Math.abs(fixedMonthly) / incomingMonthly : null,
    restOfMonth: {
      count: rest.length,
      total: rest.reduce((total, entry) => total + entry.amount, 0),
    },
    counts: {
      series: series.length,
      subscriptions: series.filter((entry) => entry.kind === 'subscription').length,
    },
  }
}

/** Ganze Prozent, wie sie am Balken stehen. */
export function sharePercent(share: number): number {
  return Math.round(share * 100)
}

/**
 * Die zwei Abschnitte des Balkens in Prozent der Breite.
 *
 * Zusammen nie mehr als 100: Wer mehr fix vergibt, als hereinkommt, füllt den
 * Balken — und die Zeile daneben sagt es in Worten. Ein Balken, der über den
 * Rand hinausläuft, sagt nichts, was die Zahl nicht besser sagt.
 */
export function gaugeWidths(totals: Commitments): { spent: number; moved: number } {
  const income = totals.incomingMonthly
  if (income <= 0) return { spent: 0, moved: 0 }

  const moved = Math.abs(totals.movedMonthly)
  const spent = Math.abs(totals.fixedMonthly) - moved
  const spentWidth = Math.min(100, Math.round((spent / income) * 100))
  return {
    spent: spentWidth,
    moved: Math.min(100 - spentWidth, Math.round((moved / income) * 100)),
  }
}

/**
 * Welche Signalarten auf diesen Bildschirm gehören.
 *
 * Nicht alle: Ein Ausreisser beim Einkaufen ist eine Sache der Analyse, nicht
 * der wiederkehrenden Buchungen. Hier stehen nur Befunde, die eine **Reihe**
 * betreffen — und die Karte darunter führt zu genau dieser Reihe.
 */
const ON_THIS_SCREEN: SignalKind[] = ['priceUp', 'newSeries', 'subscriptionSuspect', 'missed']

/**
 * Der eine Befund, der über der Liste steht.
 *
 * `detectSignals` liefert nach Rang sortiert — der erste Treffer ist damit der
 * höchstbewertete, ohne dass hier ein zweites Mal sortiert wird. Ausgewählt
 * wird im Code, nicht vom Modell; dieselbe Arbeitsteilung wie beim Budget
 * (siehe `insights/budget/explain.ts`).
 */
export function recurringFinding(signals: Signal[]): Signal | null {
  return signals.find((signal) => ON_THIS_SCREEN.includes(signal.kind)) ?? null
}
