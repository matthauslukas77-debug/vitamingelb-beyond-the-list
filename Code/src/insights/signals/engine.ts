import type { Account, Persona, Transaction } from '../../data/types'
import { resolveBrand } from '../../data/brands'
import { detectRecurring, normaliseMerchant, type RecurringSeries } from '../../domain/recurring'
import { addDays, parseIso } from '../../lib/date'
import { pretty } from '../../app/screens/Recurring'
import { categorize } from '../budget/mapping'
import { merchantName } from '../budget/merchant'
import { NO_ASSIGNMENTS, type Assignments } from '../budget/assign'
import { moneyFlow } from '../budget/flow'
import { deriveForPersona, monthStart } from '../budget/derive'
import { markingOf, NO_MARKINGS, type Markings } from '../budget/markings'
import { categoryDef, CATEGORY_KEYS, slotKey, type CategoryKey } from '../budget/slots'
import { amountOf, type SavedBudget } from '../budget/storage'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Signale — was sich verändert hat.
 *
 * Schicht 1 des Anomalie-Systems: Sie läuft vollständig auf dem, was
 * `detectRecurring` ohnehin erkennt, und braucht keine gespeicherte
 * Vorgeschichte.
 *
 * **Wie «neu» erkannt wird, ohne etwas zu speichern:** Die Reihen werden
 * zweimal erkannt — einmal über den ganzen Bestand, einmal über den Bestand
 * bis Ende Vormonat. Was nur im ersten Lauf vorkommt, ist neu. Deterministisch,
 * reproduzierbar, und es funktioniert beim allerersten Start. Eine gespeicherte
 * Momentaufnahme müsste für jede Demo erst befüllt werden und wäre eine zweite
 * Wahrheit neben den Buchungen.
 *
 * Vier Regeln, die für jedes Signal gelten:
 *
 *   1. **Kein Signal ohne Beleg.** Jedes trägt die Buchungen, aus denen es
 *      stammt — dieselbe Doktrin wie beim Budget.
 *   2. **Verdacht heisst Verdacht.** Zwei Buchungen sind kein Muster. Die
 *      Karte fragt dann, statt zu behaupten.
 *   3. **Rang statt Reihenfolge.** Sortiert wird nach Betrag, Konfidenz und
 *      Aktualität, nicht nach Erkennungsreihenfolge.
 *   4. **Alles lässt sich wegklicken.** Ohne das füllt sich der Bildschirm
 *      nach drei Tagen mit Rauschen und wird nie wieder geöffnet.
 */

export type SignalKind =
  /** Eine erkannte Reihe ist teurer geworden. */
  | 'priceUp'
  /** Der Lohn oder eine andere Einnahme hat sich dauerhaft verändert. */
  | 'incomeChange'
  /** Eine einmalige Gutschrift ausserhalb der bekannten Reihen. */
  | 'incomeExtra'
  /** Eine Lohnreihe endet, eine andere beginnt — ein neuer Arbeitgeber. */
  | 'incomeSwitch'
  /** Eine Sonderzahlung, die sich jährlich wiederholt — der dreizehnte Lohn. */
  | 'incomeAnnual'
  /** Eine Reihe, die es im Vormonat noch nicht gab. */
  | 'newSeries'
  /** Zwei gleichartige Buchungen im Monatsabstand — vielleicht ein Abo. */
  | 'subscriptionSuspect'
  /** Eine erwartete Belastung ist ausgeblieben. */
  | 'missed'
  /** Eine einzelne Buchung sprengt ihr Kategorienbudget. */
  | 'outlier'

/** Welche Aktion die Karte anbietet. Die Umsetzung liegt im Bildschirm. */
export type SignalAction =
  | { kind: 'save'; amount: number }
  | { kind: 'classify'; transactionId: string }
  | { kind: 'openSeries'; seriesKey: string }
  | { kind: 'openBudget'; category: CategoryKey }
  | { kind: 'openTransaction'; transactionId: string }

export interface Signal {
  /** Stabil über Läufe hinweg — daran hängt das Wegklicken. */
  id: string
  kind: SignalKind
  /** Die Überschrift der Karte. */
  title: string
  /** Ein bis zwei Sätze. Enthält nur gerechnete Zahlen. */
  body: string
  /** Datum, auf das sich das Signal bezieht. */
  date: string
  /** Betrag, um den es geht, Rappen. Positiv. Für den Rang. */
  amount: number
  /** 0..1. Ein Verdacht steht tiefer als eine Messung. */
  confidence: number
  /** Die Buchungen dahinter — der Beleg. */
  transactionIds: string[]
  actions: SignalAction[]
  /** Für den Rang: je höher, desto weiter oben. */
  score: number
}

export interface SignalOptions {
  today: string
  markings?: Markings
  /** Budget je Kategorie, Rappen pro Monat. Fehlt es, entfällt `outlier`. */
  budget?: Record<CategoryKey, number>
  /** Was der Nutzer zugeordnet hat — siehe `budget/assign.ts`. */
  assignments?: Assignments
}

/** Der Rang einer Karte: Betrag × Konfidenz, abgeschwächt mit dem Alter. */
function scoreOf(amount: number, confidence: number, date: string, today: string): number {
  const days = Math.max(0, (parseIso(today).getTime() - parseIso(date).getTime()) / 86_400_000)
  /* Nach 30 Tagen zählt ein Signal noch halb, nach 60 noch ein Viertel. Ohne
     diese Dämpfung stünde eine alte grosse Zahl für immer zuoberst. */
  const freshness = 1 / (1 + days / 30)
  return (amount / 100) * confidence * freshness
}

/** Lesbarer Name einer Reihe: erst die Marke, sonst der aufgeräumte Text. */
function seriesName(series: RecurringSeries): string {
  return resolveBrand(series.label)?.brand.name ?? pretty(series.label)
}

/**
 * Nur die Gegenpartei einer Lastschrift oder Gutschrift.
 *
 * Der Auszug schreibt sie als «ART / Gegenpartei» — «LOHN / Nordlicht Software
 * AG», «MIETZINS / Verwaltung Iseli». Wo der Satz die Art schon nennt («Seit
 * 25.02. kommt CHF 4'635 von …»), wäre sie ein zweites Mal überflüssig.
 */
function counterpartyOf(series: RecurringSeries): string {
  const name = seriesName(series)
  const slash = name.indexOf(' / ')
  return slash >= 0 ? name.slice(slash + 3) : name
}

/**
 * Wie viel vom Unerwarteten beiseitelegen: 60 %, auf hundert Franken gerundet.
 *
 * Nicht alles — wer den ganzen Bonus wegschiebt, hat ihn nie gehabt, und der
 * Vorschlag wird beim zweiten Mal ignoriert. Und eine glatte Zahl, weil
 * «CHF 483.20» niemand bestätigt.
 */
export function suggestedSaving(amount: number): number {
  const rounded = Math.round((amount * 0.6) / 10_000) * 10_000
  /* Nie mehr vorschlagen, als hereingekommen ist. Das Aufrunden auf hundert
     kann sonst darüber hinausschiessen: 60 % von CHF 90 sind 54, gerundet
     100. */
  return Math.max(0, Math.min(rounded, amount))
}

const chf = (rappen: number) => Math.round(Math.abs(rappen) / 100).toLocaleString('de-CH').replace(/\s/g, '’')

// ───────────────────────────────────────────────────────────────────────────
// Die einzelnen Erkenner
// ───────────────────────────────────────────────────────────────────────────

/** Teurer geworden — `priceChange` steht schon in jeder erkannten Reihe. */
function priceSignals(series: RecurringSeries[], today: string): Signal[] {
  return series
    .filter((entry) => entry.priceChange && entry.amount < 0)
    .map((entry) => {
      const change = entry.priceChange!
      const delta = Math.abs(change.to - change.from)
      const perYear = Math.round(delta * (365 / entry.intervalDays))
      return {
        id: `priceUp:${entry.key}:${change.since}`,
        kind: 'priceUp' as const,
        title: `${seriesName(entry)} ist teurer geworden`,
        body:
          `Seit ${change.since.slice(8, 10)}.${change.since.slice(5, 7)}. zahlst du CHF ${chf(change.to)} ` +
          `statt CHF ${chf(change.from)}. Das sind CHF ${chf(perYear)} mehr im Jahr.`,
        date: change.since,
        amount: perYear,
        confidence: 0.9,
        transactionIds: entry.transactionIds,
        actions: [{ kind: 'openSeries' as const, seriesKey: entry.key }],
        score: scoreOf(perYear, 0.9, change.since, today),
      }
    })
}

/**
 * Einnahme verändert — dieselbe Erkennung, andere Bedeutung.
 *
 * Das ist die Karte mit der stärksten Aktion: Wer diesen Monat CHF 800 mehr
 * bekommen hat, kann einen Teil davon gleich beiseitelegen. Vorgeschlagen wird
 * nicht alles, sondern ein glatter Anteil — wer alles wegschiebt, hat den
 * Bonus nie gehabt.
 */
function incomeSignals(series: RecurringSeries[], today: string): Signal[] {
  return series
    .filter((entry) => entry.kind === 'income' && entry.priceChange)
    .map((entry) => {
      const change = entry.priceChange!
      const delta = change.to - change.from
      const more = delta > 0
      const suggested = suggestedSaving(delta)

      return {
        id: `incomeChange:${entry.key}:${change.since}`,
        kind: 'incomeChange' as const,
        title: more
          ? `CHF ${chf(delta)} mehr ${seriesName(entry).toLowerCase().includes('lohn') ? 'Lohn' : 'Einnahmen'}`
          : `CHF ${chf(delta)} weniger als sonst`,
        body: more
          ? `${seriesName(entry)}: CHF ${chf(change.to)} statt der bisherigen CHF ${chf(change.from)}.` +
            (suggested > 0 ? ` Beiseitelegen, bevor es im Monat aufgeht?` : '')
          : `${seriesName(entry)}: CHF ${chf(change.to)} statt der bisherigen CHF ${chf(change.from)}.`,
        date: change.since,
        amount: Math.abs(delta),
        confidence: 0.9,
        transactionIds: entry.transactionIds,
        actions:
          more && suggested > 0 ? [{ kind: 'save' as const, amount: suggested }] : [],
        score: scoreOf(Math.abs(delta), 0.9, change.since, today),
      }
    })
}

/** Ab diesem Betrag ist eine einmalige Gutschrift eine Erwähnung wert. */
const EXTRA_INCOME_MIN = 20_000

/**
 * Eine einmalige Gutschrift — Bonus, dreizehnter Monatslohn, Rückerstattung.
 *
 * Das ist die Karte mit der stärksten Aktion, und sie braucht einen eigenen
 * Erkenner: Geld, das nur einmal kommt, bildet keine Reihe, also greift die
 * Preisänderungs-Erkennung nicht. Gesucht wird deshalb nach Gutschriften im
 * laufenden Monat, die zu keiner bekannten Reihe gehören.
 *
 * Vorgeschlagen wird nicht der ganze Betrag, sondern ein glatter Anteil davon.
 * Wer alles wegschiebt, hat den Bonus nie gehabt — und eine krumme Zahl wie
 * «CHF 533.33» bestätigt niemand.
 */
function extraIncomeSignals(
  transactions: Transaction[],
  series: RecurringSeries[],
  today: string,
): Signal[] {
  const known = new Set(series.map((entry) => entry.key))
  const from = monthStart(today)

  return transactions
    .filter(
      (tx) =>
        tx.amount >= EXTRA_INCOME_MIN &&
        tx.date >= from &&
        tx.date <= today &&
        !known.has(normaliseMerchant(tx.text)),
    )
    .map((tx) => {
      const name = merchantName(tx)
      const suggested = suggestedSaving(tx.amount)
      return {
        id: `incomeExtra:${tx.id}`,
        kind: 'incomeExtra' as const,
        title: `CHF ${chf(tx.amount)} zusätzlich hereingekommen`,
        body:
          `${name} am ${tx.date.slice(8, 10)}.${tx.date.slice(5, 7)}. — das gehört zu keiner ` +
          `regelmässigen Einnahme.` +
          (suggested > 0 ? ` Etwas davon beiseitelegen, bevor der Monat es aufbraucht?` : ''),
        date: tx.date,
        amount: tx.amount,
        confidence: 0.9,
        transactionIds: [tx.id],
        actions: suggested > 0 ? [{ kind: 'save' as const, amount: suggested }] : [],
        score: scoreOf(tx.amount, 0.9, tx.date, today),
      }
    })
}

/** Wie lange zwischen letztem alten und erstem neuem Lohn liegen darf. */
const SWITCH_MAX_GAP_DAYS = 70
/** Und wie weit die Beträge auseinanderliegen dürfen, damit es ein Lohn bleibt. */
const SWITCH_MAX_SPREAD = 0.5

/**
 * Ein neuer Arbeitgeber — eine Lohnreihe hört auf, eine andere fängt an.
 *
 * Ohne diesen Erkenner zerfällt ein Jobwechsel in zwei irreführende Meldungen:
 * «Agentur Meridian AG ist ausgeblieben» und «Neu: Studio Kreis GmbH». Beide
 * stimmen für sich und erzählen zusammen das Falsche. Was zählt, ist die
 * Differenz — bei Nino CHF 260 mehr im Monat, und das bei einem Konto, das
 * dreimal im Soll war.
 *
 * Erkannt wird am Muster, nicht am Arbeitgebernamen: eine Einnahmereihe, die
 * aufhört, und eine ähnlich grosse, die kurz darauf beginnt.
 */
function switchSignals(series: RecurringSeries[], today: string): Signal[] {
  const income = series.filter((entry) => entry.kind === 'income' && entry.cadence === 'monthly')
  const out: Signal[] = []

  for (const ended of income) {
    /* Läuft sie noch? Dann ist sie nicht zu Ende. */
    if (ended.lastSeen >= addDays(today, -SWITCH_MAX_GAP_DAYS)) continue

    const successor = income.find(
      (candidate) =>
        candidate.key !== ended.key &&
        candidate.firstSeen > ended.lastSeen &&
        candidate.firstSeen <= addDays(ended.lastSeen, SWITCH_MAX_GAP_DAYS) &&
        candidate.lastSeen > ended.lastSeen &&
        Math.abs(candidate.amount - ended.amount) / Math.max(ended.amount, 1) <= SWITCH_MAX_SPREAD,
    )
    if (!successor) continue

    const delta = successor.amount - ended.amount
    const more = delta > 0
    out.push({
      id: `incomeSwitch:${ended.key}:${successor.key}`,
      kind: 'incomeSwitch',
      title: more
        ? `Neuer Arbeitgeber — CHF ${chf(delta)} mehr im Monat`
        : `Neuer Arbeitgeber — CHF ${chf(delta)} weniger im Monat`,
      body:
        `Seit ${successor.firstSeen.slice(8, 10)}.${successor.firstSeen.slice(5, 7)}. kommen ` +
        `CHF ${chf(successor.amount)} von ${counterpartyOf(successor)}, davor CHF ${chf(ended.amount)} ` +
        `von ${counterpartyOf(ended)}.` +
        (more ? ' Das Budget kennt den Unterschied noch nicht.' : ''),
      date: successor.firstSeen,
      amount: Math.abs(delta),
      confidence: 0.85,
      transactionIds: [...ended.transactionIds.slice(-2), ...successor.transactionIds],
      actions: more
        ? [{ kind: 'save' as const, amount: suggestedSaving(delta) }, { kind: 'openBudget' as const, category: 'consumption' }]
        : [{ kind: 'openBudget' as const, category: 'consumption' }],
      score: scoreOf(Math.abs(delta), 0.85, successor.firstSeen, today),
    })
  }
  return out
}

/** Wie weit ein Jahresabstand danebenliegen darf. */
const ANNUAL_TOLERANCE_DAYS = 45

/**
 * Eine Sonderzahlung, die sich jährlich wiederholt — typisch der dreizehnte
 * Monatslohn.
 *
 * Sie bildet keine Reihe: `detectRecurring` verlangt drei Vorkommen, und in
 * zwei Jahren Historie steht ein Dezemberlohn zweimal da. Trotzdem ist sie
 * das Gegenteil einer Überraschung — sie ist ein Termin. Deshalb sagt die
 * Karte nicht, was war, sondern wann es wiederkommt: Das ist die Antwort auf
 * «was kommt als Nächstes», nicht auf «was war».
 */
function annualIncomeSignals(transactions: Transaction[], today: string): Signal[] {
  const byKey = new Map<string, Transaction[]>()
  for (const tx of transactions) {
    if (tx.amount < EXTRA_INCOME_MIN) continue
    const key = normaliseMerchant(tx.text)
    if (!key) continue
    const bucket = byKey.get(key)
    if (bucket) bucket.push(tx)
    else byKey.set(key, [tx])
  }

  const out: Signal[] = []
  for (const [key, items] of byKey) {
    if (items.length !== 2) continue
    const [first, last] = [...items].sort((a, b) => (a.date < b.date ? -1 : 1))

    const gap = Math.round((parseIso(last.date).getTime() - parseIso(first.date).getTime()) / 86_400_000)
    if (Math.abs(gap - 365) > ANNUAL_TOLERANCE_DAYS) continue

    /* Der nächste Termin: ein Jahr nach dem letzten. Liegt er in der
       Vergangenheit, ist die Zahlung überfällig und keine Vorschau mehr. */
    const next = addDays(last.date, 365)
    if (next <= today) continue
    const months = Math.round((parseIso(next).getTime() - parseIso(today).getTime()) / 86_400_000 / 30.44)

    out.push({
      id: `incomeAnnual:${key}:${next}`,
      kind: 'incomeAnnual',
      title: `CHF ${chf(last.amount)} kommen wieder`,
      body:
        `${merchantName(last)}: zuletzt im ${MONTHS[parseIso(last.date).getMonth()]} ` +
        `${last.date.slice(0, 4)}, davor im ${MONTHS[parseIso(first.date).getMonth()]} ` +
        `${first.date.slice(0, 4)}. Der nächste Termin ist in ${months} ` +
        `${months === 1 ? 'Monat' : 'Monaten'}.`,
      date: last.date,
      amount: last.amount,
      /* Zwei Vorkommen sind ein Muster, aber kein Versprechen. */
      confidence: 0.6,
      transactionIds: [first.id, last.id],
      actions: [{ kind: 'openTransaction' as const, transactionId: last.id }],
      score: scoreOf(last.amount, 0.6, last.date, today),
    })
  }
  return out
}

const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/**
 * Neu aufgetaucht — der Vergleich zweier Erkennungsläufe.
 *
 * Ohne gespeicherte Vorgeschichte: einmal über alles, einmal über alles bis
 * Ende Vormonat. Was im zweiten Lauf fehlt, ist neu.
 */
function newSeriesSignals(
  transactions: Transaction[],
  series: RecurringSeries[],
  today: string,
): Signal[] {
  const cutoff = addDays(monthStart(today), -1)
  const before = new Set(
    detectRecurring(
      transactions.filter((tx) => tx.date <= cutoff),
      { today: cutoff },
    ).map((entry) => entry.key),
  )

  return series
    .filter((entry) => !before.has(entry.key) && entry.amount < 0)
    .map((entry) => ({
      id: `newSeries:${entry.key}`,
      kind: 'newSeries' as const,
      title: `Neu: ${seriesName(entry)}`,
      body:
        `${entry.occurrences} Buchungen à CHF ${chf(entry.amount)}, seit ${entry.firstSeen.slice(8, 10)}.` +
        `${entry.firstSeen.slice(5, 7)}. Das macht CHF ${chf(entry.monthlyAmount)} im Monat.`,
      date: entry.lastSeen,
      amount: Math.abs(entry.monthlyAmount),
      confidence: 0.8,
      transactionIds: entry.transactionIds,
      actions: [{ kind: 'openSeries' as const, seriesKey: entry.key }],
      score: scoreOf(Math.abs(entry.monthlyAmount), 0.8, entry.lastSeen, today),
    }))
}

/** Toleranz für den Abo-Verdacht: gleicher Betrag auf 2 %, Abstand 30 ± 5 Tage. */
const SUSPECT_AMOUNT_TOLERANCE = 0.02
const SUSPECT_MIN_DAYS = 25
const SUSPECT_MAX_DAYS = 35
/** Unter diesem Betrag lohnt die Frage nicht. */
const SUSPECT_MIN_AMOUNT = 500

/**
 * Abo-Verdacht: **zwei** Buchungen, nicht drei.
 *
 * `detectRecurring` verlangt drei Vorkommen, bevor es eine Reihe annimmt — zu
 * Recht, denn zwei Buchungen sind kein Muster. Für die Frage «hast du gerade
 * ein Abo abgeschlossen?» reichen sie aber, und genau als Frage steht es dann
 * auch da.
 */
function suspectSignals(
  transactions: Transaction[],
  series: RecurringSeries[],
  today: string,
): Signal[] {
  const known = new Set(series.map((entry) => entry.key))
  const groups = new Map<string, Transaction[]>()

  for (const tx of transactions) {
    if (tx.amount >= 0 || Math.abs(tx.amount) < SUSPECT_MIN_AMOUNT) continue
    const key = normaliseMerchant(tx.text)
    if (!key || known.has(key)) continue
    const bucket = groups.get(key)
    if (bucket) bucket.push(tx)
    else groups.set(key, [tx])
  }

  const out: Signal[] = []
  for (const [key, items] of groups) {
    if (items.length !== 2) continue
    const [first, second] = [...items].sort((a, b) => (a.date < b.date ? -1 : 1))

    const gap = Math.round((parseIso(second.date).getTime() - parseIso(first.date).getTime()) / 86_400_000)
    if (gap < SUSPECT_MIN_DAYS || gap > SUSPECT_MAX_DAYS) continue

    const spread = Math.abs(second.amount - first.amount) / Math.abs(first.amount)
    if (spread > SUSPECT_AMOUNT_TOLERANCE) continue

    const name = merchantName(second)
    out.push({
      id: `subscriptionSuspect:${key}`,
      kind: 'subscriptionSuspect',
      title: `Ein neues Abo bei ${name}?`,
      body:
        `Zweimal CHF ${chf(second.amount)}, ${gap} Tage auseinander. ` +
        `Sieht nach einem Abo aus — sicher sind wir bei zwei Buchungen nicht.`,
      date: second.date,
      amount: Math.abs(second.amount),
      confidence: 0.5,
      transactionIds: [first.id, second.id],
      actions: [{ kind: 'openTransaction', transactionId: second.id }],
      score: scoreOf(Math.abs(second.amount), 0.5, second.date, today),
    })
  }
  return out
}

/** Wie lange nach dem erwarteten Termin eine Belastung als ausgefallen gilt. */
const MISSED_GRACE_DAYS = 5

/** Erwartet, aber nicht gekommen. */
function missedSignals(series: RecurringSeries[], today: string): Signal[] {
  return series
    .filter(
      (entry) =>
        entry.amount < 0 &&
        entry.cadence === 'monthly' &&
        entry.nextExpected < addDays(today, -MISSED_GRACE_DAYS),
    )
    .map((entry) => ({
      id: `missed:${entry.key}:${entry.nextExpected}`,
      kind: 'missed' as const,
      title: `${seriesName(entry)} ist ausgeblieben`,
      body:
        `Erwartet war CHF ${chf(entry.amount)} am ${entry.nextExpected.slice(8, 10)}.` +
        `${entry.nextExpected.slice(5, 7)}. — bisher ist nichts gekommen.`,
      date: entry.nextExpected,
      amount: Math.abs(entry.amount),
      confidence: 0.7,
      transactionIds: entry.transactionIds,
      actions: [{ kind: 'openSeries' as const, seriesKey: entry.key }],
      score: scoreOf(Math.abs(entry.amount), 0.7, entry.nextExpected, today),
    }))
}

/** Ab dem Wievielfachen des Monatsbudgets eine einzelne Buchung auffällt. */
const OUTLIER_FACTOR = 2
/** Und mindestens so viel, damit kleine Budgets nicht ständig Alarm schlagen. */
const OUTLIER_MIN = 50_000

/**
 * Eine einzelne Buchung sprengt ihre Kategorie.
 *
 * Das ist die Karte, an der die Einordnung hängt: Brunos Anzahlung Heizung
 * über CHF 12'000 bei einem Wohnbudget von CHF 1'463. Ohne Einordnung steht
 * seine Wohnblase den ganzen Monat auf 920 %.
 *
 * Steuern sind ausgenommen — die werden in der Ableitung ohnehin über die
 * volle Historie geglättet, eine Steuerrate ist kein Ausreisser.
 */
function outlierSignals(
  transactions: Transaction[],
  accounts: Account[],
  { today, markings = NO_MARKINGS, budget, assignments = NO_ASSIGNMENTS }: SignalOptions,
  ownName?: string,
): Signal[] {
  if (!budget) return []
  const from = monthStart(today)
  const out: Signal[] = []

  for (const tx of transactions) {
    if (tx.date < from || tx.date > today) continue
    if (moneyFlow(tx, { accounts, ownName }).flow !== 'out') continue
    /* Schon eingeordnet — dann hat der Nutzer die Frage beantwortet. */
    if (markingOf(markings, tx.id).kind !== 'normal') continue

    const { category } = categorize(tx, assignments)
    if (category === 'taxes') continue

    const amount = Math.abs(tx.amount)
    const limit = Math.max(budget[category] * OUTLIER_FACTOR, OUTLIER_MIN)
    if (amount < limit) continue

    const name = merchantName(tx)
    out.push({
      id: `outlier:${tx.id}`,
      kind: 'outlier',
      title: `CHF ${chf(amount)} sprengen ${categoryDef(category).title}`,
      body:
        `${name} am ${tx.date.slice(8, 10)}.${tx.date.slice(5, 7)}. ` +
        `Dein Budget für diese Kategorie ist CHF ${chf(budget[category])} im Monat. ` +
        `Gehört das so dazu, oder war es einmalig?`,
      date: tx.date,
      amount,
      confidence: 0.85,
      transactionIds: [tx.id],
      actions: [
        { kind: 'classify', transactionId: tx.id },
        { kind: 'openBudget', category },
      ],
      score: scoreOf(amount, 0.85, tx.date, today),
    })
  }
  return out
}

// ───────────────────────────────────────────────────────────────────────────

/** Alle Signale der Schicht 1, nach Rang sortiert. */
export function detectSignals(
  transactions: Transaction[],
  accounts: Account[],
  options: SignalOptions,
  ownName?: string,
): Signal[] {
  const series = detectRecurring(transactions, { today: options.today })

  const switches = switchSignals(series, options.today)

  return [
    ...switches,
    ...extraIncomeSignals(transactions, series, options.today),
    ...annualIncomeSignals(transactions, options.today),
    ...incomeSignals(series, options.today),
    ...priceSignals(series, options.today),
    ...outlierSignals(transactions, accounts, options, ownName),
    ...newSeriesSignals(transactions, series, options.today),
    ...suspectSignals(transactions, series, options.today),
    ...missedSignals(series, options.today),
  ].sort((a, b) => b.score - a.score)
}

/** Bequemer Einstieg: alles aus der Persona. */
export function signalsForPersona(persona: Persona, options: SignalOptions): Signal[] {
  return detectSignals(persona.transactions, persona.accounts, options, persona.name)
}

/**
 * Das Budget je Kategorie — die Messlatte der Ausreisser-Erkennung.
 *
 * Ein gesetztes Budget gilt. Gibt es keines, nimmt sie den Vorschlag aus den
 * Buchungen: Die Signale sollen auch vor dem ersten Wizard-Lauf etwas taugen,
 * und ein Zwölfmonatsschnitt ist eine ehrliche Messlatte.
 */
export function budgetPerCategory(
  persona: Persona,
  today: string,
  markings?: Markings,
  saved?: SavedBudget | null,
  assignments?: Assignments,
): Record<CategoryKey, number> {
  const derived = deriveForPersona(persona, { today, months: 12, markings, assignments })
  if (!saved) return derived.categoryTotals

  return Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      derived.slots
        .filter((entry) => entry.slot.category === key)
        .reduce((total, entry) => total + amountOf(saved, slotKey(entry.slot)), 0),
    ]),
  ) as Record<CategoryKey, number>
}
