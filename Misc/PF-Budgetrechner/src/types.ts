/**
 * Typen des PostFinance-Budgetrechners (Webapp 219).
 * 1:1 aus dem Angular-Bundle rekonstruiert — Feldnamen entsprechen exakt der API.
 * Siehe ../SPEC.md und ../API.md.
 */

export const CivilStatus = {
  alleinstehend: '1',
  verheiratet: '2',
  konkubinat: '3',
  eingetragenePartnerschaft: '4',
} as const;
export type CivilStatus = (typeof CivilStatus)[keyof typeof CivilStatus];

export const Denomination = {
  reformiert: '1',
  roemischKatholisch: '2',
  christKatholisch: '3',
  konfessionslos: '4',
  andere: '9',
} as const;
export type Denomination = (typeof Denomination)[keyof typeof Denomination];

export const Sex = { maennlich: '1', weiblich: '2' } as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

/** Anzeigemodus des Ergebnisses. */
export const Display = { month: '1', year: '2' } as const;
export type Display = (typeof Display)[keyof typeof Display];

/** Die sechs Ausgabenkategorien — Reihenfolge wie im Original. */
export const CATEGORY_KEYS = [
  'taxes',
  'reside',
  'insurance',
  'health',
  'mobility',
  'consumption',
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export interface CategoryDef {
  key: CategoryKey;
  /** i18n-Key des Kategorientitels. */
  title: string;
  /** PostFinance-Icon-Name. */
  icon: string;
  /** i18n-Keys der Detailfelder, in Original-Reihenfolge. */
  fieldLabels: string[];
}

/** Step 1 — `informationForm`, exakt der Request-Body von `calculateBudget`. */
export interface InformationForm {
  civilStatus: CivilStatus | null;
  /** String! "0"–"5". */
  children: string;
  zipCode: string | null;
  city: string | null;
  taxLocationId: number | null;
  /** Im Original nie gerendert, Default "1". */
  sex: Sex;
  /** Im Original nie gerendert, Default: aktuelles Jahr − 18. */
  year: number;
  grossYearIncome: number | null;
  denomination: Denomination | null;
  sexPartner: Sex;
  yearPartner: number;
  grossYearIncomePartner: number | null;
  denominationPartner: Denomination | null;
}

/** Step 2 — `budgetForm`, Antwort von `calculateBudget` / `updateBudget`. */
export interface Budget {
  display: Display;
  householdIncomeNetYear: number;
  householdIncomeNetMonth: number;
  sumExpensesYear: number;
  sumExpensesMonth: number;
  savingQuoteYear: number;
  savingQuoteMonth: number;

  taxesUUID: string;
  taxesYearAmount: number;
  taxesMonthAmount: number;
  resideUUID: string;
  resideYearAmount: number;
  resideMonthAmount: number;
  insuranceUUID: string;
  insuranceYearAmount: number;
  insuranceMonthAmount: number;
  healthUUID: string;
  healthYearAmount: number;
  healthMonthAmount: number;
  mobilityUUID: string;
  mobilityYearAmount: number;
  mobilityMonthAmount: number;
  consumptionUUID: string;
  consumptionYearAmount: number;
  consumptionMonthAmount: number;
}

export interface TaxLocation {
  canton: string;
  city: string;
  taxLocationID: number;
  zipCode: string;
}

/** Feldfehler aus der 422-Antwort. */
export interface FieldError {
  fieldName: string;
  /** z.B. ErrorNotEmpty, ErrorNotNull, ErrorTaxlocationCombo, ErrorBudgetCalculatorAge */
  translationKey: string;
  text: string;
  /** "501" = globaler Fehler, sonst Feldfehler. */
  code: string;
}

export class BudgetValidationError extends Error {
  readonly fieldErrors: FieldError[];
  readonly globalErrors: FieldError[];

  constructor(fieldErrors: FieldError[], globalErrors: FieldError[]) {
    super(`Budgetrechner-Validierung fehlgeschlagen: ${fieldErrors.map((e) => e.fieldName).join(', ')}`);
    this.name = 'BudgetValidationError';
    this.fieldErrors = fieldErrors;
    this.globalErrors = globalErrors;
  }
}
