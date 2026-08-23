/**
 * Rechenlogik des PostFinance-Budgetrechners — lokal nachgebaut.
 *
 * Drei Teile:
 *   1. `netIncome()`      — exakt (gegen 1'216 API-Samples verifiziert, ±1 CHF/Jahr)
 *   2. `updateBudget()`   — exakt (reine Arithmetik, wie der gleichnamige Endpoint)
 *   3. Kategorien, Tipps, Formatierung — 1:1 aus dem Bundle
 *
 * Die *Richtwerte* pro Kategorie (`calculateBudget`) stammen aus einer gesampelten
 * Referenztabelle, siehe `reference.ts`.
 */

import {
  CATEGORY_KEYS,
  type Budget,
  type CategoryDef,
  type CategoryKey,
  type CivilStatus,
  Display,
  type InformationForm,
} from './types.ts';

// ---------------------------------------------------------------------------
// Konstanten aus dem Bundle
// ---------------------------------------------------------------------------

/** Debounce vor dem Nachrechnen, wenn der User Beträge editiert. */
export const UPDATE_DEBOUNCE_MS = 300;
/** Ab diesem Überschuss zeigt der Rechner «Sparpotenzial» statt «Spielraum». */
export const SAVING_POTENTIAL_THRESHOLD = 100;
/** Vorsorge-Richtwert pro Monat (≈ 3a-Maximum / 12). */
export const PROVISION_REFERENCE_MONTH = 605;
/** Wohnkosten-Regel: Nettoeinkommen / Wohnkosten muss ≥ 3 sein (⇒ max. 33 %). */
export const LIVING_COST_FACTOR = 3;

export const MAX_AMOUNT_MONTH = 5_000_000;
export const MAX_AMOUNT_YEAR = 60_000_000;

/** Kategorien inkl. Detailfelder — Reihenfolge wie im Original. */
export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { key: 'taxes', title: 'CategoryTaxes', icon: 'calculator_moneyBag', fieldLabels: ['CategoryTaxes'] },
  {
    key: 'reside',
    title: 'CategoryReside',
    icon: 'houseWindows',
    fieldLabels: ['CategoryResideRent', 'CategoryResideMortgageInterest', 'CategoryResideAdditionalCosts'],
  },
  {
    key: 'insurance',
    title: 'CategoryInsurance',
    icon: 'handshake',
    fieldLabels: [
      'CategoryInsuranceLiabilityHousehold',
      'CategoryInsurancePrivatePension',
      'CategoryInsuranceOtherInsurances',
    ],
  },
  {
    key: 'health',
    title: 'CategoryHealth',
    icon: 'personMedal',
    fieldLabels: ['CategoryHealthInsurance', 'CategoryHealthMedication', 'CategoryHealthMedicalCare'],
  },
  {
    key: 'mobility',
    title: 'CategoryMobility',
    icon: 'train',
    fieldLabels: [
      'CategoryMobilityVehicles',
      'CategoryMobilityVehicleInsurance',
      'CategoryMobilityFuelMaintenance',
      'CategoryMobilityPublicTransport',
      'CategoryMobilityCommunication',
    ],
  },
  {
    key: 'consumption',
    title: 'CategoryConsumption',
    icon: 'shoppingBasketGroceries',
    fieldLabels: [
      'CategoryConsumptionFood',
      'CategoryConsumptionClothing',
      'CategoryConsumptionLeisure',
      'CategoryConsumptionOther',
    ],
  },
];

// ---------------------------------------------------------------------------
// 1. Nettoeinkommen
// ---------------------------------------------------------------------------

/**
 * Sozialabzüge, wie sie der PostFinance-Rechner rechnet.
 *
 * Aus 1'216 Messpunkten zurückgerechnet, maximale Abweichung 1 CHF/Jahr (Rundung):
 *   - 7.4 % auf dem ganzen Bruttolohn         (AHV/IV/EO + ALV + NBU)
 *   - + 3.5 % auf dem Teil zwischen 90'720 und 148'200
 *   - + 1.4 % auf dem Teil über 148'200
 *   - + halber BVG-Satz auf dem koordinierten Lohn, altersabhängig
 *
 * BVG-Parameter 2026: Eintrittsschwelle 22'680, Koordinationsabzug 26'460,
 * koordinierter Lohn min. 3'780 / max. 64'260.
 * Altersstaffel (Arbeitnehmeranteil = halber Satz): <25 → 0 %, 25–34 → 7 %,
 * 35–44 → 10 %, 45–54 → 15 %, ab 55 → 18 %.
 */
export const SOCIAL_DEDUCTION_BASE_RATE = 0.074;
export const UPPER_BAND_RATE = 0.035;
export const TOP_BAND_RATE = 0.014;
export const BVG_ENTRY_THRESHOLD = 22_680;
export const BVG_COORDINATION_DEDUCTION = 26_460;
export const BVG_MIN_COORDINATED = 3_780;
export const BVG_MAX_COORDINATED = 64_260;
export const UPPER_BAND_FLOOR = 90_720;
export const UPPER_BAND_CEILING = 148_200;

export function bvgRate(age: number): number {
  if (age < 25) return 0;
  if (age < 35) return 0.07;
  if (age < 45) return 0.1;
  if (age < 55) return 0.15;
  return 0.18;
}

/** Nettojahreseinkommen einer Person (ungerundet). */
export function netIncomeYear(grossYearIncome: number | null | undefined, age: number): number {
  const gross = grossYearIncome ?? 0;
  if (gross <= 0) return 0;

  let deductions = SOCIAL_DEDUCTION_BASE_RATE * gross;
  deductions += UPPER_BAND_RATE * Math.max(0, Math.min(gross, UPPER_BAND_CEILING) - UPPER_BAND_FLOOR);
  deductions += TOP_BAND_RATE * Math.max(0, gross - UPPER_BAND_CEILING);

  const rate = bvgRate(age);
  if (rate > 0 && gross >= BVG_ENTRY_THRESHOLD) {
    const coordinated = Math.min(
      Math.max(gross - BVG_COORDINATION_DEDUCTION, BVG_MIN_COORDINATED),
      BVG_MAX_COORDINATED,
    );
    deductions += (rate / 2) * coordinated;
  }
  return gross - deductions;
}

/** Nettojahreseinkommen des Haushalts (gerundet, wie die API). */
export function householdNetIncomeYear(form: InformationForm, currentYear = new Date().getFullYear()): number {
  const own = netIncomeYear(form.grossYearIncome, currentYear - form.year);
  const partner = hasPartner(form.civilStatus)
    ? netIncomeYear(form.grossYearIncomePartner, currentYear - form.yearPartner)
    : 0;
  return Math.round(own + partner);
}

export function hasPartner(civilStatus: CivilStatus | null): boolean {
  return civilStatus !== null && civilStatus !== '1';
}

// ---------------------------------------------------------------------------
// 2. updateBudget — identisch zum Endpoint
// ---------------------------------------------------------------------------

const amountField = (key: CategoryKey, display: Display) =>
  `${key}${display === Display.month ? 'Month' : 'Year'}Amount` as keyof Budget;

/**
 * Rechnet das Budget nach einer User-Änderung konsistent nach — exakt das
 * Verhalten des `updateBudget`-Endpoints.
 *
 * Die aktuell angezeigte Ansicht (`display`) ist führend: ihre Beträge bleiben
 * stehen, die Gegenansicht wird daraus abgeleitet (×12 bzw. ÷12).
 */
export function updateBudget(budget: Budget): Budget {
  const next: Budget = { ...budget };
  const monthLeading = budget.display === Display.month;

  for (const key of CATEGORY_KEYS) {
    const month = `${key}MonthAmount` as keyof Budget;
    const year = `${key}YearAmount` as keyof Budget;
    if (monthLeading) {
      (next[year] as number) = (next[month] as number) * 12;
    } else {
      (next[month] as number) = Math.round((next[year] as number) / 12);
    }
  }

  const sumMonth = CATEGORY_KEYS.reduce((acc, k) => acc + (next[`${k}MonthAmount` as keyof Budget] as number), 0);
  const sumYear = CATEGORY_KEYS.reduce((acc, k) => acc + (next[`${k}YearAmount` as keyof Budget] as number), 0);

  next.sumExpensesMonth = monthLeading ? sumMonth : Math.round(sumYear / 12);
  next.sumExpensesYear = monthLeading ? sumMonth * 12 : sumYear;
  next.savingQuoteMonth = next.householdIncomeNetMonth - next.sumExpensesMonth;
  next.savingQuoteYear = next.householdIncomeNetYear - next.sumExpensesYear;
  return next;
}

/** Betrag einer Kategorie in der aktuellen Ansicht. */
export function categoryAmount(budget: Budget, key: CategoryKey): number {
  return budget[amountField(key, budget.display)] as number;
}

/** Setzt den Betrag einer Kategorie in der aktuellen Ansicht (ohne Nachrechnen). */
export function withCategoryAmount(budget: Budget, key: CategoryKey, amount: number): Budget {
  const max = budget.display === Display.month ? MAX_AMOUNT_MONTH : MAX_AMOUNT_YEAR;
  const clamped = Math.min(Math.max(Math.round(amount), 0), max);
  return { ...budget, [amountField(key, budget.display)]: clamped };
}

// ---------------------------------------------------------------------------
// 3. Ergebnis-Ableitungen
// ---------------------------------------------------------------------------

export function netIncomeOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.householdIncomeNetMonth : budget.householdIncomeNetYear;
}
export function expensesOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.sumExpensesMonth : budget.sumExpensesYear;
}
export function savingQuoteOfView(budget: Budget): number {
  return budget.display === Display.month ? budget.savingQuoteMonth : budget.savingQuoteYear;
}

/** i18n-Key der dritten Ergebniszeile. */
export function savingQuoteLabelKey(budget: Budget): 'IncomeSurplus' | 'Overspending' {
  return savingQuoteOfView(budget) < 0 ? 'Overspending' : 'IncomeSurplus';
}

export type TipKey =
  | 'scrHintSavingPotential'
  | 'scrHintLeeway'
  | 'scrHintProvisionsPotential'
  | 'scrHintProvisionsStart'
  | 'scrHintLivingExpensesHigh';

/** Tippbox über den Kategorien. */
export function topTip(budget: Budget): TipKey | null {
  const diff = netIncomeOfView(budget) - expensesOfView(budget);
  if (diff > SAVING_POTENTIAL_THRESHOLD) return 'scrHintSavingPotential';
  if (diff > 0) return 'scrHintLeeway';
  return null;
}

/** Tippbox unter den Kategorien. */
export function bottomTip(budget: Budget): TipKey | null {
  const diff = netIncomeOfView(budget) - expensesOfView(budget);
  const insurance = categoryAmount(budget, 'insurance');
  const reside = categoryAmount(budget, 'reside');

  if (diff > 0) {
    if (insurance > 0 && insurance < PROVISION_REFERENCE_MONTH) return 'scrHintProvisionsPotential';
    if (insurance === 0) return 'scrHintProvisionsStart';
    return null;
  }
  if (reside > 0 && netIncomeOfView(budget) / reside < LIVING_COST_FACTOR) return 'scrHintLivingExpensesHigh';
  return null;
}

/** Formatierung wie im Original: de-CH, keine Nachkommastellen, Suffix CHF. */
export function formatAmount(value: number, opts: { signed?: boolean } = {}): string {
  const formatted = value.toLocaleString('de-CH', {
    maximumFractionDigits: 0,
    useGrouping: true,
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  });
  return `${formatted} CHF`;
}

/** Leeres Step-1-Formular mit den Original-Defaults. */
export function emptyInformationForm(currentYear = new Date().getFullYear()): InformationForm {
  return {
    civilStatus: null,
    children: '0',
    zipCode: null,
    city: null,
    taxLocationId: null,
    sex: '1',
    year: currentYear - 18,
    grossYearIncome: null,
    denomination: null,
    sexPartner: '2',
    yearPartner: currentYear - 18,
    grossYearIncomePartner: null,
    denominationPartner: null,
  };
}
