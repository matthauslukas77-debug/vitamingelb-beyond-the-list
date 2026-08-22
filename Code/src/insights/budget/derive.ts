import type { Account, Persona, Transaction } from '../../data/types'
import { detectRecurring, normaliseMerchant, type Cadence } from '../../domain/recurring'
import { pretty } from '../../app/screens/Recurring'
import { categorize } from './mapping'
import { merchantName } from './merchant'
import { NO_ASSIGNMENTS, type Assignments } from './assign'
import { flowTotals, moneyFlow, type FlowContext, type FlowTotals } from './flow'
import { allSlots, slotKey, type BudgetSlot, type CategoryKey } from './slots'
import { CATEGORY_KEYS } from './slots'
import { budgetShare, extraordinaryShare, markingOf, NO_MARKINGS, type Markings } from './markings'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das Budget aus den Buchungen ableiten.
 *
 * Der Original-Wizard fragt sieben Dinge und schätzt daraus sechs Kategorien
 * aus einer Haushaltstabelle. Eine Banking-App braucht die Schätzung nicht —
 * sie hat 24 Monate echte Buchungen. Was hier entsteht, ist das **Ist**; der
 * Richtwert (`pf-reference.ts`) steht daneben als Vergleich, nicht als Ergebnis.
 *
 * Drei Dinge, die dabei richtig sein müssen, sonst ist die erste Zahl falsch:
 *
 *   1. **Nicht doppelt zählen.** Der Dauerauftrag aufs eigene Sparkonto ist
 *      keine Ausgabe (`flow.ts`).
 *   2. **Rhythmus statt Summe.** Die Hausratversicherung kommt einmal im Jahr.
 *      Sie wird auf den Monat umgelegt, sonst fehlt sie im Budget.
 *   3. **Ausreisser ausweisen.** Ein Möbelkauf im März darf «Kleider und
 *      Schuhe» nicht für immer hochsetzen — er wird nicht versteckt, sondern
 *      benannt (`largestSingle`, `needsReview`).
 *
 * Alle Beträge hier sind **ganzzahlige Rappen**, wie überall sonst in der App.
 * Die Franken-Grenze zum PostFinance-Modell liegt allein in `benchmark.ts`.
 */

/** Was hinter einer einzelnen Zahl steht. */
export interface SlotEvidence {
  slot: BudgetSlot
  /** Vorschlag pro Monat, Rappen, positiv. */
  monthly: number
  /** Summe im ganzen Zeitraum, Rappen, positiv. */
  total: number
  count: number
  /** In wie vielen Monaten des Zeitraums überhaupt etwas kam. */
  monthsSeen: number
  /** Grösste Einzelbuchung, Rappen, positiv. */
  largestSingle: number
  /** Gewichteter Mittelwert der Einzelkonfidenzen, 0..1. */
  confidence: number
  /** Die häufigsten Gegenparteien, lesbar. Höchstens drei. */
  sources: string[]
  transactionIds: string[]
  /** Als monatliche Reihe erkannt — dann ist es eine Fixkost. */
  recurring: boolean
  /** Zur Bestätigung vorlegen statt still übernehmen. */
  needsReview: boolean
  /** Warum es zur Bestätigung vorgelegt wird. Leer, wenn nicht nötig. */
  reviewReason?: string
  /**
   * Über wie viele Monate gemittelt wurde, wenn das mehr sind als das
   * Beobachtungsfenster. Nur bei den Steuern gesetzt — siehe `deriveBudget`.
   */
  smoothedOver?: number
}

export interface IncomeSource {
  label: string
  /** Rappen pro Monat, positiv. */
  monthly: number
  count: number
  cadence?: Cadence
}

export interface OpenQuestion {
  key: 'civilStatus' | 'children' | 'cash' | 'canton'
  question: string
  /** Warum die App das nicht selbst wissen kann. Steht so im Wizard. */
  why: string
}

export interface Coverage {
  /** Ausgabenfranken mit sicherer Zuordnung (Konfidenz ≥ 0.6), Rappen/Monat. */
  assigned: number
  /** Der Rest, Rappen/Monat. */
  review: number
  /** Anteil sicher zugeordnet, 0..1. */
  share: number
}

export interface DerivedBudget {
  from: string
  to: string
  months: number
  /** Nettoeinkommen aus echten Gutschriften, Rappen/Monat. */
  incomeMonth: number
  incomeSources: IncomeSource[]
  /** Alle neunzehn Felder, auch die leeren — die Struktur bleibt vollständig. */
  slots: SlotEvidence[]
  /** Je Kategorie die Summe ihrer Felder, Rappen/Monat. */
  categoryTotals: Record<CategoryKey, number>
  /** Summe aller Kategorien, Rappen/Monat. */
  expensesMonth: number
  /** Einkommen − Ausgaben, Rappen/Monat. Negativ = Ausgabenüberschuss. */
  surplusMonth: number
  /** Was tatsächlich auf eigene Konten ging, Rappen/Monat. */
  actualSavedMonth: number
  flow: FlowTotals
  coverage: Coverage
  openQuestions: OpenQuestion[]
  /** Wie viele der neunzehn Felder einen Betrag haben. */
  filledSlots: number
  /** Steuerkanton, wenn er aus einer Steuerbuchung hervorgeht. */
  detectedCanton?: { canton: string; evidence: string }
  /**
   * Was im Zeitraum als ausserordentlich eingeordnet wurde, auf den Monat
   * umgelegt. Fällt nicht ins Budget, verschwindet aber auch nicht: Der
   * Ausblick rechnet damit, sonst wäre er zu optimistisch.
   */
  extraordinaryMonth: number
}

export interface DeriveOptions {
  /** Wie viele Monate zurück. Vorgabe 12. */
  months?: number
  /** Stichtag, ISO. */
  today: string
  /**
   * Was der Nutzer eingeordnet hat. Ausserordentliches fällt aus dem
   * Vorschlag heraus — sonst bläht eine einmalige Zahlung das Budget für
   * immer auf: Brunos Anzahlung Heizung würde seine Nebenkosten dauerhaft mit
   * CHF 1'000 im Monat belasten, obwohl sie einmal vorkam.
   */
  markings?: Markings
  /**
   * Was der Nutzer zugeordnet hat. Schlägt das Regelwerk — siehe `assign.ts`.
   * Ohne diesen Durchreicher zeigte das Brett eine Zuordnung, die im Budget
   * nirgends ankäme.
   */
  assignments?: Assignments
}

/**
 * Die Kantone, wie sie in einer Steuerbuchung stehen können.
 *
 * Gesucht wird der blosse Ortsname, nicht «Kanton X»: Der Auszug schreibt mal
 * «STEUERVERWALTUNG DES KANTONS BERN», mal «STEUERVERWALTUNG KT. BERN». Dass
 * «Bern» auch eine Stadt ist, stört hier nicht — in einer Steuerbuchung meint
 * der Ort die Steuerhoheit.
 */
const CANTONS: [RegExp, string][] = [
  [/\bBERN\b|\bBE\b/i, 'BE'],
  [/\bZ(Ü|UE)RICH\b|\bZH\b/i, 'ZH'],
  [/\bLUZERN\b|\bLU\b/i, 'LU'],
  [/\bAARGAU\b|\bAG\b/i, 'AG'],
  [/\bST\.? ?GALLEN\b|\bSG\b/i, 'SG'],
  [/\bBASEL-?STADT\b|\bBS\b/i, 'BS'],
  [/\bBASEL-?LAND(SCHAFT)?\b|\bBL\b/i, 'BL'],
  [/\bSOLOTHURN\b|\bSO\b/i, 'SO'],
  [/\bFREIBURG\b|\bFRIBOURG\b|\bFR\b/i, 'FR'],
  [/\bWALLIS\b|\bVALAIS\b|\bVS\b/i, 'VS'],
  [/\bWAADT\b|\bVAUD\b|\bVD\b/i, 'VD'],
  [/\bNEUENBURG\b|\bNEUCH(Â|A)TEL\b|\bNE\b/i, 'NE'],
  [/\bGENF\b|\bGEN(È|E)VE\b|\bGE\b/i, 'GE'],
  [/\bTESSIN\b|\bTICINO\b|\bTI\b/i, 'TI'],
  [/\bGRAUB(Ü|UE)NDEN\b|\bGR\b/i, 'GR'],
  [/\bTHURGAU\b|\bTG\b/i, 'TG'],
  [/\bZUG\b|\bZG\b/i, 'ZG'],
  [/\bSCHWYZ\b|\bSZ\b/i, 'SZ'],
]

/** Nur diese Buchungen werden nach dem Kanton durchsucht. */
const TAX_BOOKING = /STEUER(VERWALTUNG|AMT|N)\b/i

/**
 * Steuerkanton aus einer Steuerbuchung.
 *
 * Bewusst **nur** daraus und nicht aus der Postleitzahl: 2504 ist Biel und
 * liegt im Kanton Bern, 2000 ist Neuenburg und liegt im Kanton Neuenburg —
 * beide beginnen mit 2. Eine geratene Steuerhoheit wäre der teuerste Fehler im
 * ganzen Budget, weil die Steuerzahl daran hängt. Wer keine Steuerbuchung hat,
 * wird gefragt.
 */
export function detectCanton(transactions: Transaction[]): { canton: string; evidence: string } | undefined {
  for (const tx of transactions) {
    if (!TAX_BOOKING.test(tx.text)) continue
    for (const [pattern, canton] of CANTONS) {
      if (pattern.test(tx.text)) return { canton, evidence: pretty(tx.text) }
    }
  }
  return undefined
}

/** Hinweise auf Kinder im Haushalt — Kita, Schule, Kinderzulage. */
const CHILD_HINT = /(KITA|KINDERKRIPPE|TAGESSCHULE|KINDERZULAGE|FAMILIENZULAGE|HORT|SPIELGRUPPE)/i

/**
 * Leitet das Budget aus den Buchungen einer Persona ab.
 *
 * `accounts` wird gebraucht, um ein Gegenkonto einordnen zu können — daran
 * hängt die Unterscheidung zwischen «ausgegeben» und «verschoben».
 */
export function deriveBudget(
  transactions: Transaction[],
  accounts: Account[],
  { months = 12, today, markings = NO_MARKINGS, assignments = NO_ASSIGNMENTS }: DeriveOptions,
  ownName?: string,
): DerivedBudget {
  /* Ganze Kalendermonate, und der laufende zählt nicht mit.
     Der 22. August ist erst zu zwei Dritteln vorbei — wer ihn mitrechnet und
     durch 12 teilt, meldet für jede Kategorie zu wenig. Das Fenster endet
     deshalb am letzten Tag des Vormonats und umfasst exakt `months` volle
     Monate. Dann stimmt auch «12 von 12 Monaten gesehen». */
  const { from, to } = fullMonthWindow(today, months)
  const window = transactions.filter((tx) => tx.date >= from && tx.date <= to)
  const actualMonths = months

  const context: FlowContext = { accounts, ownName }
  const flow = flowTotals(window, context)

  /* Die erkannten Reihen dienen zwei Zwecken: sie sagen, was eine Fixkost ist,
     und sie liefern die Kadenz der Lohngutschriften. Erkannt wird auf dem
     ganzen Bestand, nicht nur im Fenster — eine Jahresrechnung braucht mehr
     als zwölf Monate, um als Reihe sichtbar zu werden. */
  const series = detectRecurring(transactions, { today })
  const recurringKeys = new Set(series.filter((entry) => entry.amount < 0).map((entry) => entry.key))
  const cadenceByKey = new Map(series.map((entry) => [entry.key, entry.cadence]))

  // ── Ausgaben auf die neunzehn Felder ────────────────────────────────────
  interface Bucket {
    total: number
    count: number
    months: Set<string>
    largest: number
    weightedConfidence: number
    sources: Map<string, number>
    ids: string[]
    recurring: boolean
    reviewAmount: number
    /** Gesetzt, wenn über mehr Monate gemittelt wurde als das Fenster hat. */
    smoothedOver?: number
  }
  const buckets = new Map<string, Bucket>()
  const bucketOf = (slot: BudgetSlot): Bucket => {
    const key = slotKey(slot)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = {
        total: 0, count: 0, months: new Set(), largest: 0,
        weightedConfidence: 0, sources: new Map(), ids: [], recurring: false, reviewAmount: 0,
      }
      buckets.set(key, bucket)
    }
    return bucket
  }

  let assigned = 0
  let review = 0
  let extraordinary = 0

  /* Verteilte Buchungen wirken auch von ausserhalb des Fensters herein —
     deshalb läuft die Schleife über alle Buchungen und nicht nur über das
     Fenster. `budgetShare` entscheidet, was davon hier zählt. */
  for (const tx of transactions) {
    const { flow: kind } = moneyFlow(tx, context)
    if (kind !== 'out') continue

    const marking = markingOf(markings, tx.id)
    extraordinary += extraordinaryShare(tx, marking, { from, to })
    const amount = Math.round(budgetShare(tx, marking, { from, to }))
    if (amount === 0) continue

    const slot = categorize(tx, assignments)
    const bucket = bucketOf(slot)
    bucket.total += amount
    bucket.count += 1
    bucket.months.add(tx.date.slice(0, 7))
    bucket.largest = Math.max(bucket.largest, amount)
    bucket.weightedConfidence += amount * slot.confidence
    bucket.ids.push(tx.id)
    if (recurringKeys.has(normaliseMerchant(tx.text))) bucket.recurring = true
    const label = merchantName(tx)
    bucket.sources.set(label, (bucket.sources.get(label) ?? 0) + amount)
    if (slot.confidence >= 0.6) assigned += amount
    else {
      review += amount
      bucket.reviewAmount += amount
    }
  }

  /* Der TWINT-Saldo unter Privaten: Wer mehr auslegt als zurückbekommt, hat
     die Differenz ausgegeben. Sie landet unter «Weitere Ausgaben», weil
     niemand weiss, wofür — und wird als unsicher ausgewiesen. */
  if (flow.lent < 0) {
    const bucket = bucketOf({ category: 'consumption', field: 3 })
    const amount = -flow.lent
    bucket.total += amount
    bucket.weightedConfidence += amount * 0.4
    bucket.sources.set('TWINT unter Privaten (netto)', amount)
    review += amount
  }

  /*
   * Steuern über die volle Historie glätten.
   *
   * Steuerraten folgen der Steuerperiode, nicht dem Kalender: Brunos
   * Schlussrechnung 2025 und eine Akontorate fallen zufällig beide in dasselbe
   * Zwölfmonatsfenster und ergeben CHF 1'883 im Monat — im Fenster daneben
   * wären es CHF 0. Beides ist falsch. Über 24 Monate gemittelt kommt heraus,
   * was er wirklich zahlt.
   *
   * Das ist die einzige Kategorie mit dieser Sonderbehandlung, und sie hat
   * einen sachlichen Grund: Sie ist die einzige, deren Rhythmus von einer
   * Periode bestimmt wird, die nicht das Budgetjahr ist.
   */
  const taxKey = slotKey({ category: 'taxes', field: 0 })
  const taxBucket = buckets.get(taxKey)
  if (taxBucket) {
    const history = transactions.filter((tx) => tx.date <= to && tx.amount < 0)
    /* Nicht auf eine sortierte Liste verlassen — der älteste Tag wird gesucht. */
    const oldest = history.reduce((min, tx) => (tx.date < min ? tx.date : min), to)
    const historyMonths = monthSpan(oldest, to)
    if (historyMonths > actualMonths) {
      let total = 0
      const monthsSeen = new Set<string>()
      for (const tx of history) {
        if (moneyFlow(tx, context).flow !== 'out') continue
        const slot = categorize(tx, assignments)
        if (slot.category !== 'taxes') continue
        total += Math.abs(tx.amount)
        monthsSeen.add(tx.date.slice(0, 7))
      }
      /* `total` und `months` erzählen ab hier den längeren Zeitraum — deshalb
         wird beides zusammen gesetzt, sonst stimmt die Division nicht. */
      taxBucket.total = Math.round((total / historyMonths) * actualMonths)
      taxBucket.smoothedOver = historyMonths
      taxBucket.months = monthsSeen
      taxBucket.weightedConfidence = taxBucket.total * 0.95
    }
  }

  const slots: SlotEvidence[] = allSlots().map((slot) => {
    const bucket = buckets.get(slotKey(slot))
    if (!bucket || bucket.total === 0) {
      return {
        slot, monthly: 0, total: 0, count: 0, monthsSeen: 0, largestSingle: 0,
        confidence: 0, sources: [], transactionIds: [], recurring: false, needsReview: false,
      }
    }
    const monthly = Math.round(bucket.total / actualMonths)
    const confidence = bucket.weightedConfidence / bucket.total

    /* Zwei Gründe für eine Rückfrage, beide benannt statt versteckt: die
       Zuordnung ist unsicher, oder eine einzelne Buchung trägt den halben
       Betrag und es gibt kein Muster dahinter. */
    let reviewReason: string | undefined
    if (confidence < 0.6) reviewReason = 'Zuordnung unsicher'
    else if (
      !bucket.smoothedOver &&
      bucket.largest > bucket.total * 0.5 &&
      bucket.months.size <= 2 &&
      !bucket.recurring
    ) {
      reviewReason = 'eine einzelne grosse Buchung — kein Muster'
    }

    return {
      slot,
      monthly,
      total: bucket.total,
      count: bucket.count,
      monthsSeen: bucket.months.size,
      largestSingle: bucket.largest,
      confidence,
      sources: [...bucket.sources.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label]) => label),
      transactionIds: bucket.ids,
      recurring: bucket.recurring,
      needsReview: reviewReason !== undefined,
      reviewReason,
      smoothedOver: bucket.smoothedOver,
    }
  })

  const categoryTotals = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      slots.filter((entry) => entry.slot.category === key).reduce((total, entry) => total + entry.monthly, 0),
    ]),
  ) as Record<CategoryKey, number>

  const expensesMonth = CATEGORY_KEYS.reduce((total, key) => total + categoryTotals[key], 0)

  // ── Einkommen ────────────────────────────────────────────────────────────
  const incomeGroups = new Map<string, { total: number; count: number; key: string }>()
  for (const tx of window) {
    if (moneyFlow(tx, context).flow !== 'in') continue
    const key = normaliseMerchant(tx.text)
    const label = merchantName(tx)
    const group = incomeGroups.get(label) ?? { total: 0, count: 0, key }
    group.total += tx.amount
    group.count += 1
    incomeGroups.set(label, group)
  }
  const incomeSources: IncomeSource[] = [...incomeGroups.entries()]
    .map(([label, group]) => ({
      label,
      monthly: Math.round(group.total / actualMonths),
      count: group.count,
      cadence: cadenceByKey.get(group.key),
    }))
    .sort((a, b) => b.monthly - a.monthly)
  const incomeMonth = Math.round(flow.in / actualMonths)

  // ── Offene Fragen ────────────────────────────────────────────────────────
  const openQuestions: OpenQuestion[] = [
    {
      key: 'civilStatus',
      question: 'Lebst du allein oder mit Partner:in?',
      why: 'Aus Buchungen nicht erkennbar — ein gemeinsames Konto sieht aus wie ein einzelnes.',
    },
  ]
  if (!window.some((tx) => CHILD_HINT.test(tx.text))) {
    openQuestions.push({
      key: 'children',
      question: 'Hast du unterstützungspflichtige Kinder?',
      why: 'Keine Kita-, Schul- oder Kinderzulagen-Buchungen gefunden.',
    })
  }

  const detectedCanton = detectCanton(window)
  if (!detectedCanton) {
    openQuestions.push({
      key: 'canton',
      question: 'In welchem Kanton bist du steuerpflichtig?',
      why: 'Im Zeitraum steht keine Steuerzahlung, aus der sich der Kanton ergäbe.',
    })
  }

  const cashMonth = Math.round(
    window
      .filter((tx) => tx.amount < 0 && (tx.category === 'cash' || /BARGELDBEZUG|POSTOMAT/i.test(tx.text)))
      .reduce((total, tx) => total - tx.amount, 0) / actualMonths,
  )
  if (cashMonth > 0 && cashMonth > expensesMonth * 0.03) {
    openQuestions.push({
      key: 'cash',
      question: `Deine CHF ${Math.round(cashMonth / 100)} Bargeld pro Monat — eher Essen oder eher Freizeit?`,
      why: 'Ein Bezug am Automaten sagt nicht, wofür das Geld ausgegeben wurde. Eine Frage, danach ist die grösste Unschärfe weg.',
    })
  }

  const totalExpenseFrancs = assigned + review

  return {
    from,
    to,
    months: actualMonths,
    incomeMonth,
    incomeSources,
    slots,
    categoryTotals,
    expensesMonth,
    surplusMonth: incomeMonth - expensesMonth,
    actualSavedMonth: Math.round(flow.movedToSavings / actualMonths),
    flow,
    extraordinaryMonth: Math.round(extraordinary / actualMonths),
    coverage: {
      assigned: Math.round(assigned / actualMonths),
      review: Math.round(review / actualMonths),
      share: totalExpenseFrancs === 0 ? 0 : assigned / totalExpenseFrancs,
    },
    openQuestions,
    filledSlots: slots.filter((entry) => entry.monthly > 0).length,
    detectedCanton,
  }
}

/** Bequemer Einstieg für einen Bildschirm: alles aus der Persona. */
export function deriveForPersona(persona: Persona, options: DeriveOptions): DerivedBudget {
  return deriveBudget(persona.transactions, persona.accounts, options, persona.name)
}

/**
 * Die letzten `months` **vollen** Kalendermonate vor dem Stichtag.
 * Für den 22.08.2026 und 12 Monate: 01.08.2025 bis 31.07.2026.
 */
export function fullMonthWindow(today: string, months: number): { from: string; to: string } {
  const [year, month] = today.split('-').map(Number)
  const end = new Date(year, month - 1, 0) // letzter Tag des Vormonats
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1)
  return { from: iso(start), to: iso(end) }
}

/** Zahl der angebrochenen Kalendermonate zwischen zwei ISO-Daten. */
function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1)
}

function iso(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/**
 * Was in einem Zeitraum je Kategorie wirklich ausgegeben wurde.
 *
 * Dieselben zwei Schritte wie in `deriveBudget` — Geldfluss prüfen, dann auf
 * ein Detailfeld zuordnen —, nur ohne Belege und ohne Umlage auf den Monat.
 * Gebraucht für die Blasen im Cockpit: Dort steht das Budget gegen das, was
 * bis heute davon weg ist.
 *
 * Wichtig ist, dass es **dieselbe** Logik ist. Zwei Wege zu derselben Zahl
 * wären zwei Wahrheiten über dasselbe Konto.
 */
export function spendByCategory(
  transactions: Transaction[],
  accounts: Account[],
  {
    from,
    to,
    ownName,
    markings = NO_MARKINGS,
    assignments = NO_ASSIGNMENTS,
  }: {
    from: string
    to: string
    ownName?: string
    markings?: Markings
    assignments?: Assignments
  },
): Record<CategoryKey, number> {
  const context: FlowContext = { accounts, ownName }
  const totals = Object.fromEntries(CATEGORY_KEYS.map((key) => [key, 0])) as Record<CategoryKey, number>

  /* Über alle Buchungen, nicht nur über das Fenster: Eine auf zwölf Monate
     verteilte Jahresrechnung vom Januar belastet den August mit einem
     Zwölftel, obwohl sie im August nirgends steht. */
  for (const tx of transactions) {
    if (moneyFlow(tx, context).flow !== 'out') continue
    const amount = budgetShare(tx, markingOf(markings, tx.id), { from, to })
    if (amount === 0) continue
    totals[categorize(tx, assignments).category] += Math.round(amount)
  }
  const window = transactions.filter((tx) => tx.date >= from && tx.date <= to)

  /* Der TWINT-Saldo unter Privaten, genau wie in `deriveBudget`: Wer mehr
     auslegt als zurückbekommt, hat die Differenz ausgegeben. Ohne diese Zeile
     stünden im Cockpit andere Zahlen als im Wizard — bei Nino sind das CHF 76
     im Monat, und zwei Wahrheiten über dasselbe Konto sind schlimmer als eine
     ungenaue. */
  const lent = flowTotals(window, context).lent
  if (lent < 0) totals.consumption += -lent

  return totals
}

/**
 * Wie weit der laufende Monat schon vorbei ist, 0..1.
 *
 * Die Zahl, ohne die eine Verbrauchsanzeige mitten im Monat lügt: Am 8. sind
 * 25 % eines Budgets nicht «fast nichts», sondern Vorsprung — am 28. sind sie
 * es nicht mehr. Die Blasen tragen sie als feinen Ring.
 */
export function monthProgress(today: string): number {
  const [year, month, day] = today.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return Math.min(1, day / daysInMonth)
}

/** Erster Tag des Monats, in dem `today` liegt. */
export function monthStart(today: string): string {
  return `${today.slice(0, 7)}-01`
}
