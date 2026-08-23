/**
 * Lokaler Ersatz für `calculateBudget` — kein Netzwerk, gleiche Zahlen.
 *
 * Grundlage: `data/reference.json`, gesampelt aus 2'513 Live-Antworten des
 * PostFinance-Budgetrechners. Herleitung und Messfehler: ../MODELL.md
 *
 * Genauigkeit gegen alle 2'513 Samples:
 *   Nettoeinkommen  exakt (±1 CHF/Jahr Rundung)
 *   Ausgabentotal   Median 0.00 %, p99 0.03 %
 *   Kategorien      Median 0.00 %, p99 2.4 %
 *   Steuern         Median 0 CHF/Mt, p90 12 CHF/Mt, p99 219 CHF/Mt
 */

import referenceData from '../data/reference.json' with { type: 'json' };
import { householdNetIncomeYear, hasPartner } from './model.ts';
import {
  CATEGORY_KEYS,
  type Budget,
  type CategoryKey,
  type CivilStatus,
  type Denomination,
  Display,
  type InformationForm,
  type TaxLocation,
} from './types.ts';

interface ExpenseClass {
  netLowerBound: number;
  netUpperBound: number | null;
  expenseRatio: number;
  shares: Record<Exclude<CategoryKey, 'taxes'>, number>;
  n: number;
}

interface Reference {
  expenseClasses: Record<string, ExpenseClass[]>;
  /** `${taxLocationId}` → `${civilStatus}|${children}|${earners}` → [[hhGross, taxYear], …] */
  taxByLocation: Record<string, Record<string, [number, number][]>>;
  denominationFactor: Record<string, Record<string, number>>;
  taxLocations: Record<string, TaxLocation>;
}

const reference = referenceData as unknown as Reference;

const NON_TAX_CATEGORIES = CATEGORY_KEYS.filter((k): k is Exclude<CategoryKey, 'taxes'> => k !== 'taxes');

/** Steuerorte (ein Referenzort pro Kanton) für Offline-Autocomplete. */
export function taxLocations(): TaxLocation[] {
  return Object.values(reference.taxLocations);
}

export function taxLocationByCanton(canton: string): TaxLocation | undefined {
  return reference.taxLocations[canton];
}

/**
 * Einkommensklasse des Haushalts.
 *
 * Achtung — Eigenheit des Originals: die Klassen sind **Stufen**, kein stetiger
 * Verlauf. An einer Klassengrenze springt das Ausgabentotal um bis zu 20 %
 * (CHF 1 mehr Einkommen ⇒ CHF 1'159 weniger «typische» Ausgaben). Wer das im
 * eigenen Wizard nicht will, interpoliert zwischen den Klassen (siehe
 * `interpolate`-Option).
 */
export function expenseClass(
  civilStatus: CivilStatus,
  children: number,
  netIncomeMonth: number,
): ExpenseClass {
  const classes = reference.expenseClasses[`${civilStatus}|${children}`];
  if (!classes) throw new Error(`Kein Referenzprofil für ${civilStatus}|${children}`);
  return (
    classes.find(
      (c) => netIncomeMonth >= c.netLowerBound && (c.netUpperBound === null || netIncomeMonth < c.netUpperBound),
    ) ?? classes[classes.length - 1]
  );
}

/** Steuern pro Jahr, linear interpoliert auf dem gesampelten Raster. */
export function estimateTaxYear(args: {
  taxLocationId: number;
  civilStatus: CivilStatus;
  children: number;
  householdGrossYear: number;
  denomination: Denomination;
  earners: 1 | 2;
}): number {
  const perLocation = reference.taxByLocation[String(args.taxLocationId)];
  if (!perLocation) throw new Error(`Kein Steuerraster für taxLocationId ${args.taxLocationId}`);

  const points =
    perLocation[`${args.civilStatus}|${args.children}|${args.earners}`] ??
    perLocation[`${args.civilStatus}|${args.children}|${args.earners === 1 ? 2 : 1}`];
  if (!points) throw new Error(`Kein Steuerraster für ${args.civilStatus}|${args.children}`);

  const gross = args.householdGrossYear;
  let value: number;
  const [firstX, firstY] = points[0];
  const [lastX, lastY] = points[points.length - 1];

  if (gross <= firstX) {
    value = firstX > 0 ? (firstY * gross) / firstX : 0;
  } else if (gross >= lastX) {
    const [prevX, prevY] = points[points.length - 2];
    value = lastY + ((lastY - prevY) / (lastX - prevX)) * (gross - lastX);
  } else {
    value = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      if (gross >= x0 && gross <= x1) {
        value = y0 + ((y1 - y0) * (gross - x0)) / (x1 - x0);
        break;
      }
    }
  }

  const factor = reference.denominationFactor[String(args.taxLocationId)]?.[args.denomination] ?? 1;
  return Math.max(0, value * factor);
}

export interface EstimateOptions {
  /** Referenzjahr für die Altersberechnung. Default: aktuelles Jahr. */
  currentYear?: number;
  /**
   * Zwischen den Einkommensklassen interpolieren statt zu springen.
   * Default `false` = exakt wie PostFinance.
   */
  interpolate?: boolean;
}

/**
 * Lokales Gegenstück zu `BudgetCalculatorClient.calculateBudget()`.
 * Liefert dasselbe `Budget`-Objekt (UUIDs sind lokale Platzhalter).
 */
export function estimateBudget(form: InformationForm, options: EstimateOptions = {}): Budget {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  if (form.civilStatus === null) throw new Error('civilStatus fehlt');
  if (form.grossYearIncome === null) throw new Error('grossYearIncome fehlt');
  if (form.denomination === null) throw new Error('denomination fehlt');
  if (form.taxLocationId === null) throw new Error('taxLocationId fehlt');

  const children = Number(form.children);
  const netYear = householdNetIncomeYear(form, currentYear);
  const netMonth = Math.round(netYear / 12);

  const partnerGross = hasPartner(form.civilStatus) ? (form.grossYearIncomePartner ?? 0) : 0;
  const householdGross = form.grossYearIncome + partnerGross;
  const earners: 1 | 2 = partnerGross > 0 ? 2 : 1;

  const cls = expenseClass(form.civilStatus, children, netMonth);
  const ratio = options.interpolate
    ? interpolatedRatio(form.civilStatus, children, netMonth)
    : cls.expenseRatio;

  const sumExpensesMonth = Math.round(ratio * netMonth);
  const taxesMonth = Math.round(
    estimateTaxYear({
      taxLocationId: form.taxLocationId,
      civilStatus: form.civilStatus,
      children,
      householdGrossYear: householdGross,
      denomination: form.denomination,
      earners,
    }) / 12,
  );

  const rest = Math.max(0, sumExpensesMonth - taxesMonth);
  const amounts: Record<CategoryKey, number> = {
    taxes: taxesMonth,
    reside: 0,
    insurance: 0,
    health: 0,
    mobility: 0,
    consumption: 0,
  };
  for (const key of NON_TAX_CATEGORIES) amounts[key] = Math.round(cls.shares[key] * rest);

  const budget = {
    display: Display.month,
    householdIncomeNetMonth: netMonth,
    householdIncomeNetYear: Math.round(netYear),
    sumExpensesMonth,
    sumExpensesYear: sumExpensesMonth * 12,
    savingQuoteMonth: netMonth - sumExpensesMonth,
    savingQuoteYear: Math.round(netYear) - sumExpensesMonth * 12,
  } as Budget;

  for (const key of CATEGORY_KEYS) {
    (budget as unknown as Record<string, unknown>)[`${key}UUID`] = `local-${key}`;
    (budget as unknown as Record<string, unknown>)[`${key}MonthAmount`] = amounts[key];
    (budget as unknown as Record<string, unknown>)[`${key}YearAmount`] = amounts[key] * 12;
  }
  return budget;
}

/** Stetige Variante: linear zwischen den Klassenmitten statt Stufensprung. */
function interpolatedRatio(civilStatus: CivilStatus, children: number, netMonth: number): number {
  const classes = reference.expenseClasses[`${civilStatus}|${children}`];
  const centers = classes.map((c) => ({
    x: c.netUpperBound === null ? c.netLowerBound * 1.4 : (c.netLowerBound + c.netUpperBound) / 2,
    y: c.expenseRatio,
  }));
  if (netMonth <= centers[0].x) return centers[0].y;
  if (netMonth >= centers[centers.length - 1].x) return centers[centers.length - 1].y;
  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    if (netMonth >= a.x && netMonth <= b.x) {
      return a.y + ((b.y - a.y) * (netMonth - a.x)) / (b.x - a.x);
    }
  }
  return centers[centers.length - 1].y;
}
