import { addDays, parseIso } from '../../lib/date'
import type { Account, PendingOrder, Transaction } from '../../data/types'
import { detectRecurring, type RecurringSeries } from '../../domain/recurring'

/**
 * Kontostand über die Zeit — rückwärts aus den Buchungen, vorwärts aus den
 * bekannten Verpflichtungen.
 *
 * Grundsatz für den vorderen Teil: Prognostiziert wird ausschliesslich, was
 * bereits feststeht — erkannte Zahlungsreihen und pendente Aufträge. Keine
 * Hochrechnung von Gewohnheiten. Bruno im Interview 07: «Einfach plausibel
 * müsste es sein.» Eine Kurve, die rät, verliert genau dieses Vertrauen.
 */

export interface Point {
  date: string
  /** Kontostand am Ende des Tages, in Rappen. */
  balance: number
}

export interface ForecastEvent {
  date: string
  label: string
  amount: number
  kind: 'income' | 'payment'
}

export interface BalanceTimeline {
  history: Point[]
  forecast: Point[]
  events: ForecastEvent[]
  /** Tiefster Punkt der Prognose — die Zahl, die zählt. */
  low: Point
  /** Nächster Geldeingang, falls im Fenster. */
  nextIncome?: ForecastEvent
  /** Belastungen bis zum nächsten Eingang — das Fenster, das zu überstehen ist. */
  paymentsBeforeIncome: ForecastEvent[]
  /** Ob der Verlauf überhaupt genug Bewegung hat, um eine Kurve zu rechtfertigen. */
  hasMovement: boolean
  min: number
  max: number
}

/**
 * Rückwärts vom heutigen Saldo: Der Stand am Ende von Tag d ist der heutige
 * Saldo abzüglich aller Buchungen, die nach d gekommen sind.
 */
export function history(
  balanceToday: number,
  transactions: Transaction[],
  fromIso: string,
  todayIso: string,
): Point[] {
  const byDay = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.date > todayIso || tx.date < fromIso) continue
    byDay.set(tx.date, (byDay.get(tx.date) ?? 0) + tx.amount)
  }

  const days: Point[] = []
  let balance = balanceToday
  for (let iso = todayIso; iso >= fromIso; iso = addDays(iso, -1)) {
    days.push({ date: iso, balance })
    balance -= byDay.get(iso) ?? 0
  }
  return days.reverse()
}

/**
 * Projiziert jede erkannte Reihe ab ihrem nächsten Termin im eigenen Rhythmus
 * weiter, ergänzt um pendente Aufträge.
 */
export function futureEvents(
  series: RecurringSeries[],
  pending: PendingOrder[],
  todayIso: string,
  untilIso: string,
): ForecastEvent[] {
  const events: ForecastEvent[] = []

  for (const entry of series) {
    let date = entry.nextExpected
    // Reihen, deren Termin schon verstrichen ist, auf den nächsten schieben.
    while (date < todayIso) date = addDays(date, entry.intervalDays)
    while (date <= untilIso) {
      events.push({
        date,
        label: entry.label,
        amount: entry.amount,
        kind: entry.amount > 0 ? 'income' : 'payment',
      })
      date = addDays(date, entry.intervalDays)
    }
  }

  for (const order of pending) {
    if (order.execution >= todayIso && order.execution <= untilIso) {
      events.push({
        date: order.execution,
        label: order.recipient,
        amount: order.amount,
        kind: order.amount > 0 ? 'income' : 'payment',
      })
    }
  }

  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Vorwärts: heutiger Saldo plus alles, was bis zum jeweiligen Tag ansteht. */
export function forecast(
  balanceToday: number,
  events: ForecastEvent[],
  todayIso: string,
  untilIso: string,
): Point[] {
  const byDay = new Map<string, number>()
  for (const event of events) {
    byDay.set(event.date, (byDay.get(event.date) ?? 0) + event.amount)
  }

  const days: Point[] = []
  let balance = balanceToday
  for (let iso = todayIso; iso <= untilIso; iso = addDays(iso, 1)) {
    balance += byDay.get(iso) ?? 0
    days.push({ date: iso, balance })
  }
  return days
}

/** Bis Ende des übernächsten Monats — deckt den nächsten Lohn und die Miete danach. */
export function forecastHorizon(todayIso: string): string {
  const date = parseIso(todayIso)
  const end = new Date(date.getFullYear(), date.getMonth() + 2, 0)
  const m = String(end.getMonth() + 1).padStart(2, '0')
  return `${end.getFullYear()}-${m}-${String(end.getDate()).padStart(2, '0')}`
}

/**
 * Konten ohne eigene Buchungen aus den Gegenbuchungen ableiten.
 *
 * Ein Sparkonto hat im Datenbestand keine eigenen Zeilen — die Bewegung steht
 * als «UEBERTRAG AUF SPARKONTO» im Privatkonto und trägt dort das Gegenkonto.
 * Aus demselben Vorgang, umgekehrt vorzeichenbehaftet, entsteht der Verlauf
 * des Sparkontos. Erfunden wird dabei nichts.
 */
export function mirrored(accountId: string, all: Transaction[]): Transaction[] {
  return all
    .filter((tx) => tx.counterAccountId === accountId)
    .map((tx) => ({
      ...tx,
      id: `${tx.id}-gegen`,
      accountId,
      amount: -tx.amount,
      counterAccountId: tx.accountId,
    }))
}

export interface TimelineOptions {
  account: Account
  transactions: Transaction[]
  pendingOrders: PendingOrder[]
  today: string
  /** Wie weit zurück der Verlauf reicht. */
  historyDays?: number
}

/** Setzt Verlauf, Prognose und die Kennzahlen zu einer Zeitreihe zusammen. */
export function buildTimeline({
  account,
  transactions,
  pendingOrders,
  today,
  historyDays = 90,
}: TimelineOptions): BalanceTimeline {
  const direct = transactions.filter((tx) => tx.accountId === account.id)
  const own = direct.length > 0 ? direct : mirrored(account.id, transactions)
  const from = addDays(today, -historyDays)
  const until = forecastHorizon(today)

  const past = history(account.balance, own, from, today)
  const series = detectRecurring(own, { today })
  const events = futureEvents(series, pendingOrders.filter((o) => o.accountId === account.id), today, until)
  const ahead = forecast(account.balance, events, today, until)

  // Der tiefste Punkt der Zukunft — heute zählt nicht mit, sonst lautet die
  // Antwort bei steigendem Verlauf immer «heute» und sagt nichts.
  const future = ahead.slice(1)
  let low = future[0] ?? ahead[0]
  for (const point of future) if (point.balance < low.balance) low = point

  const nextIncome = events.find((event) => event.kind === 'income')
  const paymentsBeforeIncome = events.filter(
    (event) => event.kind === 'payment' && (!nextIncome || event.date <= nextIncome.date),
  )

  const all = [...past, ...ahead]
  const min = Math.min(...all.map((p) => p.balance))
  const max = Math.max(...all.map((p) => p.balance))

  return {
    history: past,
    forecast: ahead,
    events,
    low,
    nextIncome,
    paymentsBeforeIncome,
    // Ein Sparkonto ohne Bewegung ergibt eine gerade Linie. Dafür braucht es
    // keine Kurve — dann bleibt die schlichte Zeile stehen.
    hasMovement: own.length >= 4 && max - min > 5_000,
    min,
    max,
  }
}
