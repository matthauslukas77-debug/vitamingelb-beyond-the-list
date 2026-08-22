/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Rechenlogik des PostFinance-Budgetrechners.
 *
 * **Portiert, nicht nachgebaut.** Herkunft:
 * `WORKSPACE/04_experiments/pf-budget-wizard/src/model.ts`, dort rekonstruiert
 * aus dem Angular-Bundle des öffentlichen Rechners und gegen **2'513
 * Live-Messpunkte** seiner API geprüft. Maximale Abweichung beim
 * Nettoeinkommen: 1 CHF im Jahr, und das ist Rundung. Die Prüfung läuft dort
 * weiterhin mit `node verify.mjs`.
 *
 * ACHTUNG — die Einheit ist hier **ganze Franken**, nicht Rappen.
 * Der Rest der App führt Beträge als ganzzahlige Rappen (`src/lib/money.ts`).
 * Diese Datei ist bewusst die Ausnahme: Sie bleibt Zeichen für Zeichen die
 * Formel des Originals, damit die Prüfung gegen die 2'513 Samples gültig
 * bleibt. Umgerechnet wird an genau einer Stelle — in `benchmark.ts`, und dort
 * hängt ein Test daran.
 */

import type { CategoryKey } from './slots'
import { CATEGORY_KEYS } from './slots'

// ───────────────────────────────────────────────────────────────────────────
// Enums des Originals. Die Werte sind Strings, weil die API sie so erwartet.
// ───────────────────────────────────────────────────────────────────────────

export const CivilStatus = {
  alleinstehend: '1',
  verheiratet: '2',
  konkubinat: '3',
  eingetragenePartnerschaft: '4',
} as const
export type CivilStatus = (typeof CivilStatus)[keyof typeof CivilStatus]

export const Denomination = {
  reformiert: '1',
  roemischKatholisch: '2',
  christKatholisch: '3',
  konfessionslos: '4',
  andere: '9',
} as const
export type Denomination = (typeof Denomination)[keyof typeof Denomination]

/** Monats- oder Jahresansicht. Beide werden geführt, eine ist führend. */
export const Display = { month: '1', year: '2' } as const
export type Display = (typeof Display)[keyof typeof Display]

/** Step 1 des Originals — zugleich der Request-Body von `calculateBudget`. */
export interface InformationForm {
  civilStatus: CivilStatus | null
  /** String, «0»–«5» — so will es die API. */
  children: string
  zipCode: string | null
  city: string | null
  taxLocationId: number | null
  sex: '1' | '2'
  /** Jahrgang. Das Original setzt hier fix «aktuelles Jahr − 18». Wir nicht. */
  year: number
  grossYearIncome: number | null
  denomination: Denomination | null
  sexPartner: '1' | '2'
  yearPartner: number
  grossYearIncomePartner: number | null
  denominationPartner: Denomination | null
}

/** Step 2 des Originals — die Antwort von `calculateBudget`. Alles in Franken. */
export interface Budget {
  display: Display
  householdIncomeNetYear: number
  householdIncomeNetMonth: number
  sumExpensesYear: number
  sumExpensesMonth: number
  savingQuoteYear: number
  savingQuoteMonth: number

  taxesYearAmount: number
  taxesMonthAmount: number
  resideYearAmount: number
  resideMonthAmount: number
  insuranceYearAmount: number
  insuranceMonthAmount: number
  healthYearAmount: number
  healthMonthAmount: number
  mobilityYearAmount: number
  mobilityMonthAmount: number
  consumptionYearAmount: number
  consumptionMonthAmount: number
}

// ───────────────────────────────────────────────────────────────────────────
// Die Magic Numbers des Bundles. Sie stehen hier benannt, damit niemand
// später rätselt, woher die 605 kommt.
// ───────────────────────────────────────────────────────────────────────────

/** Ab diesem Überschuss zeigt das Original «Sparpotenzial nutzen». */
export const SAVING_POTENTIAL_THRESHOLD = 100
/** Maximaler 3a-Bezug pro Monat (7'258 / 12), Schwelle der Vorsorge-Tippbox. */
export const PROVISION_REFERENCE_MONTH = 605
/** Kehrwert der 33-%-Wohnkostenregel. */
export const LIVING_COST_FACTOR = 3
export const MAX_AMOUNT_MONTH = 5_000_000
export const MAX_AMOUNT_YEAR = 60_000_000

/**
 * Sozialabzüge, wie sie der Rechner rechnet — aus 1'216 Messpunkten
 * zurückgerechnet:
 *   7.4 % auf dem ganzen Bruttolohn      (AHV/IV/EO + ALV + NBU)
 *   + 3.5 % auf dem Teil 90'720 … 148'200
 *   + 1.4 % auf dem Teil über 148'200
 *   + halber BVG-Satz auf dem koordinierten Lohn, altersabhängig
 * BVG-Parameter 2026.
 */
export const SOCIAL_DEDUCTION_BASE_RATE = 0.074
export const UPPER_BAND_RATE = 0.035
export const TOP_BAND_RATE = 0.014
export const UPPER_BAND_FLOOR = 90_720
export const UPPER_BAND_CEILING = 148_200
export const BVG_ENTRY_THRESHOLD = 22_680
export const BVG_COORDINATION_DEDUCTION = 26_460
export const BVG_MIN_COORDINATED = 3_780
export const BVG_MAX_COORDINATED = 64_260

/** Arbeitnehmeranteil = halber Satz. Unter 25 gibt es keinen Sparbeitrag. */
export function bvgRate(age: number): number {
  if (age < 25) return 0
  if (age < 35) return 0.07
  if (age < 45) return 0.1
  if (age < 55) return 0.15
  return 0.18
}

/** Nettojahreseinkommen einer Person, in Franken, ungerundet. */
export function netIncomeYear(grossYearIncome: number | null | undefined, age: number): number {
  const gross = grossYearIncome ?? 0
  if (gross <= 0) return 0

  let deductions = SOCIAL_DEDUCTION_BASE_RATE * gross
  deductions += UPPER_BAND_RATE * Math.max(0, Math.min(gross, UPPER_BAND_CEILING) - UPPER_BAND_FLOOR)
  deductions += TOP_BAND_RATE * Math.max(0, gross - UPPER_BAND_CEILING)

  const rate = bvgRate(age)
  if (rate > 0 && gross >= BVG_ENTRY_THRESHOLD) {
    const coordinated = Math.min(
      Math.max(gross - BVG_COORDINATION_DEDUCTION, BVG_MIN_COORDINATED),
      BVG_MAX_COORDINATED,
    )
    deductions += (rate / 2) * coordinated
  }
  return gross - deductions
}

export function hasPartner(civilStatus: CivilStatus | null): boolean {
  return civilStatus !== null && civilStatus !== '1'
}

/** Nettojahreseinkommen des Haushalts, gerundet wie die API. */
export function householdNetIncomeYear(form: InformationForm, currentYear: number): number {
  const own = netIncomeYear(form.grossYearIncome, currentYear - form.year)
  const partner = hasPartner(form.civilStatus)
    ? netIncomeYear(form.grossYearIncomePartner, currentYear - form.yearPartner)
    : 0
  return Math.round(own + partner)
}

/**
 * Kehrt die Nettoformel um: Welcher Bruttolohn ergibt dieses Netto?
 *
 * Gebraucht, weil wir das Netto **messen** (Lohngutschriften) und den
 * Richtwert brauchen, der nach Brutto fragt. Binäre Suche statt Algebra — die
 * Formel ist stückweise linear mit Deckeln, das lässt sich nicht sauber
 * auflösen, und 60 Halbierungen kosten nichts.
 */
export function grossFromNet(netYear: number, age: number): number {
  if (netYear <= 0) return 0
  let low = 0
  let high = Math.max(netYear * 2, 10_000)
  while (netIncomeYear(high, age) < netYear) high *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2
    if (netIncomeYear(mid, age) < netYear) low = mid
    else high = mid
  }
  return Math.round(high)
}

// ───────────────────────────────────────────────────────────────────────────
// updateBudget — identisch zum Endpoint
// ───────────────────────────────────────────────────────────────────────────

const amountField = (key: CategoryKey, display: Display) =>
  `${key}${display === Display.month ? 'Month' : 'Year'}Amount` as keyof Budget

/**
 * Rechnet das Budget nach einer Änderung konsistent nach.
 *
 * Die angezeigte Ansicht ist führend: ihre Beträge bleiben stehen, die
 * Gegenansicht wird daraus abgeleitet (×12 bzw. ÷12). Genau so verhält sich
 * der `updateBudget`-Endpoint — dort kostet jede Zahländerung einen
 * Server-Aufruf mit 300 ms Verzögerung. Hier ist es eine Funktion.
 */
export function updateBudget(budget: Budget): Budget {
  const next: Budget = { ...budget }
  const monthLeading = budget.display === Display.month

  for (const key of CATEGORY_KEYS) {
    const month = `${key}MonthAmount` as keyof Budget
    const year = `${key}YearAmount` as keyof Budget
    if (monthLeading) (next[year] as number) = (next[month] as number) * 12
    else (next[month] as number) = Math.round((next[year] as number) / 12)
  }

  const sumMonth = CATEGORY_KEYS.reduce(
    (total, key) => total + (next[`${key}MonthAmount` as keyof Budget] as number),
    0,
  )
  const sumYear = CATEGORY_KEYS.reduce(
    (total, key) => total + (next[`${key}YearAmount` as keyof Budget] as number),
    0,
  )

  next.sumExpensesMonth = monthLeading ? sumMonth : Math.round(sumYear / 12)
  next.sumExpensesYear = monthLeading ? sumMonth * 12 : sumYear
  next.savingQuoteMonth = next.householdIncomeNetMonth - next.sumExpensesMonth
  next.savingQuoteYear = next.householdIncomeNetYear - next.sumExpensesYear
  return next
}

export function categoryAmount(budget: Budget, key: CategoryKey): number {
  return budget[amountField(key, budget.display)] as number
}

/** Setzt den Betrag einer Kategorie in der aktuellen Ansicht, ohne nachzurechnen. */
export function withCategoryAmount(budget: Budget, key: CategoryKey, amount: number): Budget {
  const max = budget.display === Display.month ? MAX_AMOUNT_MONTH : MAX_AMOUNT_YEAR
  const clamped = Math.min(Math.max(Math.round(amount), 0), max)
  return { ...budget, [amountField(key, budget.display)]: clamped }
}

export function netIncomeOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.householdIncomeNetMonth : budget.householdIncomeNetYear
}
export function expensesOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.sumExpensesMonth : budget.sumExpensesYear
}
export function savingQuoteOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.savingQuoteMonth : budget.savingQuoteYear
}

// ───────────────────────────────────────────────────────────────────────────
// Die Tippboxen des Originals
// ───────────────────────────────────────────────────────────────────────────

export type TipKey =
  | 'scrHintSavingPotential'
  | 'scrHintLeeway'
  | 'scrHintProvisionsPotential'
  | 'scrHintProvisionsStart'
  | 'scrHintLivingExpensesHigh'

export function topTip(budget: Budget): TipKey | null {
  const diff = netIncomeOfView(budget) - expensesOfView(budget)
  if (diff > SAVING_POTENTIAL_THRESHOLD) return 'scrHintSavingPotential'
  if (diff > 0) return 'scrHintLeeway'
  return null
}

export function bottomTip(budget: Budget): TipKey | null {
  const diff = netIncomeOfView(budget) - expensesOfView(budget)
  const insurance = categoryAmount(budget, 'insurance')
  const reside = categoryAmount(budget, 'reside')

  if (diff > 0) {
    if (insurance > 0 && insurance < PROVISION_REFERENCE_MONTH) return 'scrHintProvisionsPotential'
    if (insurance === 0) return 'scrHintProvisionsStart'
    return null
  }
  if (reside > 0 && netIncomeOfView(budget) / reside < LIVING_COST_FACTOR) return 'scrHintLivingExpensesHigh'
  return null
}

/**
 * Der Text zur Tippbox, gekürzt auf den Satz, der zählt.
 *
 * Das Original liefert hier ganze HTML-Fragmente mit eingebettetem Stylesheet
 * (`data/labels.de.json`, Keys `scrHint*`). Was davon bleibt, ist die Aussage.
 * Keine Produktempfehlung — das ist der Entscheid aus M6, siehe
 * `WORKSPACE/08_features/03_BUDGET_WIZARD.md`, Abschnitt 9.
 */
export const TIP_TEXT: Record<TipKey, { title: string; body: string }> = {
  scrHintSavingPotential: {
    title: 'Sparpotenzial',
    body: 'Es bleibt jeden Monat etwas übrig. Ein Dauerauftrag am Zahltag legt es beiseite, bevor es weg ist.',
  },
  scrHintLeeway: {
    title: 'Wenig Spielraum',
    body: 'Es geht knapp auf. Einzelne Posten anzuschauen lohnt sich mehr als überall ein bisschen zu sparen.',
  },
  scrHintProvisionsPotential: {
    title: 'Vorsorge nicht ausgeschöpft',
    body: 'Der Beitrag an die private Vorsorge liegt unter dem, was steuerlich möglich wäre (CHF 605 pro Monat).',
  },
  scrHintProvisionsStart: {
    title: 'Keine private Vorsorge erkannt',
    body: 'In den Buchungen taucht keine Einzahlung in die Säule 3a auf.',
  },
  scrHintLivingExpensesHigh: {
    title: 'Wohnkosten über einem Drittel',
    body: 'Die Wohnkosten liegen über 33 % des Nettoeinkommens — das ist die Faustregel, an der auch der Rechner misst.',
  },
}
