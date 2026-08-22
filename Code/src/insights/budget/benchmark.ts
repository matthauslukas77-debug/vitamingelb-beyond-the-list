import type { Persona } from '../../data/types'
import { CATEGORY_KEYS, type CategoryKey } from './slots'
import {
  Denomination,
  Display,
  grossFromNet,
  updateBudget,
  type Budget,
  type CivilStatus,
  type InformationForm,
} from './pf-model'
import { estimateBudget, loadReference, taxLocationOf, type TaxLocation } from './pf-reference'
import type { DerivedBudget } from './derive'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Grenze zwischen zwei Zahlensystemen — und die einzige Stelle, an der
 * umgerechnet wird.
 *
 * Die App führt Beträge durchgehend als **ganzzahlige Rappen**
 * (`src/lib/money.ts`), das portierte PostFinance-Modell rechnet in **ganzen
 * Franken**, weil seine Formel gegen 2'513 Live-Messpunkte geprüft ist und
 * genau so bleiben soll. Beide Welten treffen sich hier, nirgends sonst.
 * Darum hängt an dieser Datei ein Test.
 */

const RAPPEN_PER_FRANC = 100

/** Rappen → ganze Franken, kaufmännisch gerundet. */
export function toFrancs(rappen: number): number {
  return Math.round(rappen / RAPPEN_PER_FRANC)
}

/** Ganze Franken → Rappen. */
export function toRappen(francs: number): number {
  return Math.round(francs * RAPPEN_PER_FRANC)
}

/** Was der Wizard fragen muss, weil es nicht in den Buchungen steht. */
export interface Answers {
  civilStatus: CivilStatus
  /** «0»–«5», wie die API es will. */
  children: string
  denomination: Denomination
  /** Kantonskürzel des Steuerorts. */
  canton: string
  /** Nur bei Partnerschaft: Bruttojahreslohn der zweiten Person, Franken. */
  partnerGrossYear?: number
  /** Nur bei Partnerschaft. */
  partnerBirthYear?: number
}

export const DEFAULT_ANSWERS: Answers = {
  civilStatus: '1',
  children: '0',
  /* Konfessionslos als Vorgabe: Es ist die Antwort, die keine Kirchensteuer
     hinzurechnet, und damit die vorsichtigere. Die Frage steht im Wizard. */
  denomination: Denomination.konfessionslos,
  canton: 'BE',
}

/**
 * Baut das Step-1-Formular des Originals — aber gefüllt aus dem, was die Bank
 * schon weiss.
 *
 * Zwei Stellen, an denen wir es besser machen als die Live-Webapp:
 *
 *   · **Der Jahrgang.** Das Original setzt ihn fix auf «aktuelles Jahr − 18»
 *     und rechnet damit für alle ohne BVG-Abzug — bei 40 Jahren und 85'000
 *     Brutto sind das CHF 244 im Monat zu viel Nettoeinkommen. Wir kennen ihn
 *     (`persona.birthYear`).
 *   · **Das Einkommen.** Das Original fragt nach dem Bruttolohn. Wir messen
 *     das Netto an den Lohngutschriften und rechnen die Formel rückwärts
 *     (`grossFromNet`) — niemand muss seinen Lohnausweis holen.
 */
export function informationFormFrom(
  persona: Persona,
  derived: DerivedBudget,
  answers: Answers,
  taxLocation: TaxLocation,
  currentYear: number,
): InformationForm {
  const netYearFrancs = toFrancs(derived.incomeMonth) * 12
  const age = currentYear - persona.birthYear

  return {
    civilStatus: answers.civilStatus,
    children: answers.children,
    zipCode: taxLocation.zipCode,
    city: taxLocation.city,
    taxLocationId: taxLocation.taxLocationID,
    sex: '1',
    year: persona.birthYear,
    grossYearIncome: grossFromNet(netYearFrancs, age),
    denomination: answers.denomination,
    sexPartner: '2',
    yearPartner: answers.partnerBirthYear ?? persona.birthYear,
    grossYearIncomePartner: answers.partnerGrossYear ?? null,
    denominationPartner: answers.denomination,
  }
}

/** Ein Kategorienpaar: was du zahlst gegen was ein vergleichbarer Haushalt zahlt. */
export interface CategoryComparison {
  key: CategoryKey
  /** Rappen pro Monat. */
  actual: number
  benchmark: number
  /** actual − benchmark, Rappen pro Monat. Positiv = du zahlst mehr. */
  delta: number
}

export interface Benchmark {
  /** Der Richtwert im Format des Originals, in Franken. */
  budget: Budget
  /** Derselbe Richtwert je Kategorie, in Rappen pro Monat. */
  perCategory: Record<CategoryKey, number>
  /** Richtwert-Ausgabentotal, Rappen pro Monat. */
  expensesMonth: number
  /** Nettoeinkommen nach der Formel des Originals, Rappen pro Monat. */
  incomeMonth: number
  /** Der Steuerort, mit dem gerechnet wurde. */
  taxLocation: TaxLocation
  /** Das Formular, das dahintersteht — für «woher kommt diese Zahl?». */
  form: InformationForm
}

/**
 * Holt den Richtwert für diesen Haushalt.
 *
 * `interpolate: true` glättet den Stufensprung des Originals: dort kann CHF 1
 * mehr Einkommen die «typischen» Ausgaben um CHF 1'159 im Monat senken, weil
 * die Richtwerte ein Stufenmodell über fünf Einkommensklassen sind. Für einen
 * Vergleich neben echten Zahlen wäre dieser Sprung sinnlos.
 */
export async function benchmarkFor(
  persona: Persona,
  derived: DerivedBudget,
  answers: Answers,
  currentYear: number,
): Promise<Benchmark> {
  const reference = await loadReference()
  const canton = derived.detectedCanton?.canton ?? answers.canton
  const taxLocation = taxLocationOf(reference, canton) ?? taxLocationOf(reference, 'BE')!
  const form = informationFormFrom(persona, derived, answers, taxLocation, currentYear)
  const budget = estimateBudget(reference, form, { currentYear, interpolate: true })

  const perCategory = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      toRappen((budget as unknown as Record<string, number>)[`${key}MonthAmount`]),
    ]),
  ) as Record<CategoryKey, number>

  return {
    budget,
    perCategory,
    expensesMonth: toRappen(budget.sumExpensesMonth),
    incomeMonth: toRappen(budget.householdIncomeNetMonth),
    taxLocation,
    form,
  }
}

/** Ist gegen Richtwert, Kategorie für Kategorie. */
export function compare(derived: DerivedBudget, benchmark: Benchmark): CategoryComparison[] {
  return CATEGORY_KEYS.map((key) => ({
    key,
    actual: derived.categoryTotals[key],
    benchmark: benchmark.perCategory[key],
    delta: derived.categoryTotals[key] - benchmark.perCategory[key],
  }))
}

/**
 * Verpackt unsere abgeleiteten Zahlen im `Budget`-Format des Originals.
 *
 * Damit laufen `topTip`, `bottomTip` und `updateBudget` auf **unseren**
 * Zahlen — die Tippbox «keine private Vorsorge erkannt» feuert dann, weil in
 * den Buchungen wirklich keine 3a-Einzahlung steht, und nicht, weil ein
 * Richtwert das annimmt.
 */
export function budgetFromDerived(derived: DerivedBudget, display: Display = Display.month): Budget {
  const incomeMonthFrancs = toFrancs(derived.incomeMonth)
  const budget = {
    display,
    householdIncomeNetMonth: incomeMonthFrancs,
    householdIncomeNetYear: incomeMonthFrancs * 12,
    sumExpensesMonth: 0,
    sumExpensesYear: 0,
    savingQuoteMonth: 0,
    savingQuoteYear: 0,
  } as Budget

  const record = budget as unknown as Record<string, number>
  for (const key of CATEGORY_KEYS) {
    const month = toFrancs(derived.categoryTotals[key])
    record[`${key}MonthAmount`] = month
    record[`${key}YearAmount`] = month * 12
  }
  /* Die Monatsansicht ist die führende — sie kommt aus den Buchungen. Die
     Jahreszahlen leitet `updateBudget` daraus ab, genau wie im Original. */
  return updateBudget({ ...budget, display: Display.month })
}
