/**
 * Der selbstausfüllende Budget-Wizard.
 *
 * Aus Buchungen wird ein fertiges Budget: Einkommen, sechs Kategorien, alle 19
 * Detailfelder — mit Beleg pro Zahl und einer kurzen Liste dessen, was die App
 * wirklich nicht wissen kann.
 *
 * Der PostFinance-Richtwert (`reference.ts`) verschwindet dabei nicht, er wechselt
 * die Rolle: vom **Eingabeersatz** zum **Vergleichsmassstab**.
 */

import { categorize, type Categorization } from './categorize.ts';
import { EXPENSE_CATEGORIES, netIncomeYear } from './model.ts';
import { estimateBudget, taxLocationByCanton, type EstimateOptions } from './reference.ts';
import {
  isBudgetExpense,
  moneyFlow,
  YYYY_MM,
  type HouseholdContext,
  type MoneyFlow,
  type NormalizedTx,
} from './transactions.ts';
import {
  CATEGORY_KEYS,
  type Budget,
  type CategoryKey,
  type CivilStatus,
  type Denomination,
  Display,
  type InformationForm,
} from './types.ts';

// ---------------------------------------------------------------------------
// Ergebnis-Typen
// ---------------------------------------------------------------------------

export interface SlotEvidence {
  category: CategoryKey;
  field: number;
  /** i18n-Key des Detailfelds, z.B. `CategoryResideRent`. */
  label: string;
  /** Ermittelter Monatsbetrag (CHF, positiv). */
  amountMonth: number;
  /** Anzahl Buchungen, die dahinterstehen. */
  count: number;
  /** In wie vielen der beobachteten Monate kam der Posten vor. */
  monthsSeen: number;
  /** Höchster Einzelbetrag — verrät Jahresrechnungen. */
  largestSingle: number;
  /** Die drei grössten Gegenparteien, für «woher kommt diese Zahl?». */
  topMerchants: { name: string; amountMonth: number }[];
  /** 0–1, gewichteter Mittelwert der Regel-Konfidenzen. */
  confidence: number;
  /** Buchungen, die der Nutzer bestätigen sollte. */
  reviewCount: number;
}

export interface IncomeSource {
  name: string;
  /** `salary` = wiederkehrend und monatlich, `irregular` = alles andere. */
  kind: 'salary' | 'irregular' | 'refund';
  amountYear: number;
  count: number;
  /** Median-Abstand in Tagen (nur bei `salary` aussagekräftig). */
  medianIntervalDays: number | null;
}

export interface OpenQuestion {
  field: keyof InformationForm | 'confirm';
  /** Was die App fragen muss, in einem Satz. */
  question: string;
  /** Vorschlag, den die App aus den Daten ableiten konnte (falls vorhanden). */
  suggestion?: string | number;
  /** Warum sie es nicht selbst weiss. */
  reason: string;
}

export interface DerivedBudget {
  /** Beobachtungsfenster. */
  period: { from: string; to: string; months: number };
  /** Das Ist-Budget im Format des PostFinance-Rechners. */
  budget: Budget;
  /** Der PostFinance-Richtwert zum selben Haushalt — oder `null`, wenn das Profil fehlt. */
  benchmark: Budget | null;
  /** Beleg je Detailfeld. */
  evidence: SlotEvidence[];
  income: {
    netYear: number;
    netMonth: number;
    sources: IncomeSource[];
    /** Aus dem Netto zurückgerechnetes Bruttojahreseinkommen (für den Richtwert). */
    impliedGrossYear: number;
  };
  moneyFlow: Record<MoneyFlow, { amountMonth: number; count: number }>;
  /** Was tatsächlich aufs eigene Sparkonto ging (nicht: was übrig blieb). */
  actualSavingsMonth: number;
  openQuestions: OpenQuestion[];
  /** Buchungen ohne verlässliche Zuordnung — Basis für den Review-Screen. */
  needsReview: { tx: NormalizedTx; guess: Categorization }[];
  warnings: string[];
}

export interface DeriveOptions extends EstimateOptions {
  /** Beobachtungsfenster in Monaten. Default 12. */
  months?: number;
  /** Bezugsdatum (Ende des Fensters). Default: letzte Buchung. */
  asOf?: string;
  context?: HouseholdContext;
  /** Was der Nutzer schon beantwortet hat. */
  known?: Partial<Pick<InformationForm, 'civilStatus' | 'children' | 'denomination' | 'taxLocationId' | 'zipCode' | 'city' | 'year'>>;
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function shiftMonths(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, d));
  return date.toISOString().slice(0, 10);
}

/**
 * Kehrt die Nettoformel um: welches Bruttoeinkommen ergibt dieses Netto?
 * Monoton in `gross`, also reicht eine Bisektion.
 */
export function grossFromNet(netYear: number, age: number): number {
  if (netYear <= 0) return 0;
  let lo = 0;
  let hi = Math.max(1000, netYear * 2);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netIncomeYear(mid, age) < netYear) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}

// ---------------------------------------------------------------------------
// Einkommenserkennung
// ---------------------------------------------------------------------------

const SALARY_HINT = /\bLOHN\b|\bSALAIRE\b|\bGEHALT\b|\bSALÄR\b|\bPAYROLL\b/i;
const REFUND_HINT = /R[ÜU]CKERSTATTUNG|REMBOURSEMENT|STEUERR[ÜU]CK/i;

function detectIncome(txs: NormalizedTx[]): IncomeSource[] {
  const groups = new Map<string, NormalizedTx[]>();
  for (const tx of txs) {
    if (tx.amount <= 0) continue;
    const key = (tx.counterparty || tx.merchant || 'unbekannt').toUpperCase().trim();
    const list = groups.get(key);
    if (list) list.push(tx);
    else groups.set(key, [tx]);
  }

  const sources: IncomeSource[] = [];
  for (const [name, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    const medianGap = gaps.length ? median(gaps) : null;

    const amountYear = sorted.reduce((sum, tx) => sum + tx.amount, 0);
    const looksLikeSalary =
      sorted.length >= 3 && medianGap !== null && medianGap >= 26 && medianGap <= 34;
    const textHint = sorted.some((tx) => SALARY_HINT.test(`${tx.text} ${tx.message ?? ''}`));
    const isRefund = sorted.every((tx) => REFUND_HINT.test(`${tx.text} ${tx.message ?? ''}`));

    sources.push({
      name,
      kind: isRefund ? 'refund' : looksLikeSalary || textHint ? 'salary' : 'irregular',
      amountYear: Math.round(amountYear),
      count: sorted.length,
      medianIntervalDays: medianGap,
    });
  }
  return sources.sort((a, b) => b.amountYear - a.amountYear);
}

// ---------------------------------------------------------------------------
// Steuerort aus den Steuerzahlungen
// ---------------------------------------------------------------------------

const CANTON_PATTERNS: [RegExp, string][] = [
  [/KANTONS?\s+BERN|STEUERVERWALTUNG\s+BERN/i, 'BE'],
  [/KANTONS?\s+Z[ÜU]RICH|STEUERAMT\s+Z[ÜU]RICH/i, 'ZH'],
  [/KANTONS?\s+LUZERN/i, 'LU'],
  [/KANTONS?\s+AARGAU/i, 'AG'],
  [/KANTONS?\s+ST\.?\s?GALLEN/i, 'SG'],
  [/KANTONS?\s+BASEL-?STADT/i, 'BS'],
  [/KANTONS?\s+BASEL-?LAND/i, 'BL'],
  [/KANTONS?\s+WAADT|CANTON\s+DE\s+VAUD/i, 'VD'],
  [/KANTONS?\s+GENF|CANTON\s+DE\s+GEN[ÈE]VE/i, 'GE'],
  [/KANTONS?\s+TESSIN|CANTONE\s+TICINO/i, 'TI'],
  [/KANTONS?\s+WALLIS|CANTON\s+DU\s+VALAIS/i, 'VS'],
  [/KANTONS?\s+FREIBURG|CANTON\s+DE\s+FRIBOURG/i, 'FR'],
  [/KANTONS?\s+SOLOTHURN/i, 'SO'],
  [/KANTONS?\s+THURGAU/i, 'TG'],
  [/KANTONS?\s+GRAUB[ÜU]NDEN/i, 'GR'],
  [/KANTONS?\s+ZUG/i, 'ZG'],
  [/KANTONS?\s+SCHWYZ/i, 'SZ'],
  [/KANTONS?\s+NEUENBURG|CANTON\s+DE\s+NEUCH[ÂA]TEL/i, 'NE'],
  [/KANTONS?\s+SCHAFFHAUSEN/i, 'SH'],
  [/KANTONS?\s+JURA/i, 'JU'],
  [/KANTONS?\s+GLARUS/i, 'GL'],
  [/KANTONS?\s+URI/i, 'UR'],
  [/KANTONS?\s+OBWALDEN/i, 'OW'],
  [/KANTONS?\s+NIDWALDEN/i, 'NW'],
  [/KANTONS?\s+APPENZELL/i, 'AI'],
];

/** Kanton aus dem Empfänger der Steuerzahlung. */
export function detectCanton(txs: NormalizedTx[]): { canton: string; evidence: string } | null {
  for (const tx of txs) {
    const haystack = `${tx.counterparty ?? ''} ${tx.text}`;
    if (!/STEUER/i.test(haystack)) continue;
    for (const [pattern, canton] of CANTON_PATTERNS) {
      if (pattern.test(haystack)) return { canton, evidence: (tx.counterparty || tx.text).slice(0, 80) };
    }
  }
  return null;
}

/** PLZ/Ort aus Buchungstexten — Fallback, wenn keine Steuerzahlung vorliegt. */
export function detectZipCity(txs: NormalizedTx[], ownName?: string): { zipCode: string; city: string } | null {
  if (!ownName) return null;
  const upper = ownName.toUpperCase();
  for (const tx of txs) {
    if (!tx.text.toUpperCase().includes(upper)) continue;
    const match = /\b(\d{4})\s+([A-ZÄÖÜ][A-ZÄÖÜa-zäöü .-]{2,25})\b/.exec(tx.text);
    if (match) return { zipCode: match[1], city: match[2].trim() };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hauptfunktion
// ---------------------------------------------------------------------------

export function deriveBudget(allTxs: NormalizedTx[], options: DeriveOptions = {}): DerivedBudget {
  if (allTxs.length === 0) throw new Error('Keine Buchungen übergeben');

  const months = options.months ?? 12;
  const sortedAll = [...allTxs].sort((a, b) => a.date.localeCompare(b.date));
  const asOf = options.asOf ?? sortedAll[sortedAll.length - 1].date;
  const from = shiftMonths(asOf, -months);
  const txs = sortedAll.filter((tx) => tx.date > from && tx.date <= asOf);

  const warnings: string[] = [];
  if (txs.length === 0) throw new Error(`Keine Buchungen im Fenster ${from} … ${asOf}`);
  const distinctMonths = new Set(txs.map((tx) => YYYY_MM(tx.date))).size;
  if (distinctMonths < months) {
    warnings.push(
      `Nur ${distinctMonths} von ${months} Monaten belegt — Jahresrechnungen (Steuern, Serafe, Versicherungen) können fehlen.`,
    );
  }

  // ── Geldfluss ───────────────────────────────────────────────────────────
  const flows: Record<MoneyFlow, { amountMonth: number; count: number }> = {
    out: { amountMonth: 0, count: 0 },
    in: { amountMonth: 0, count: 0 },
    moved: { amountMonth: 0, count: 0 },
    settled: { amountMonth: 0, count: 0 },
    lent: { amountMonth: 0, count: 0 },
  };

  const expenses: NormalizedTx[] = [];
  const incomeTxs: NormalizedTx[] = [];
  const lentTxs: NormalizedTx[] = [];
  const refundTxs: NormalizedTx[] = [];
  let movedYear = 0;

  for (const tx of txs) {
    const { flow } = moneyFlow(tx, options.context);
    flows[flow].amountMonth += Math.abs(tx.amount) / months;
    flows[flow].count += 1;

    if (flow === 'moved' && tx.amount < 0) movedYear += -tx.amount;
    if (isBudgetExpense(flow) && tx.amount < 0) expenses.push(tx);
    if (flow === 'settled' && tx.txType === 'card_refund' && tx.amount > 0) refundTxs.push(tx);
    if (flow === 'in' && tx.amount > 0) incomeTxs.push(tx);
    if (flow === 'lent') lentTxs.push(tx);
  }

  // ── Einkommen ───────────────────────────────────────────────────────────
  const sources = detectIncome(incomeTxs);
  const refundYear = sources.filter((s) => s.kind === 'refund').reduce((sum, s) => sum + s.amountYear, 0);
  const netYearRaw = sources
    .filter((s) => s.kind !== 'refund')
    .reduce((sum, s) => sum + s.amountYear, 0);
  const netYear = Math.round((netYearRaw / months) * 12);
  const netMonth = Math.round(netYear / 12);
  if (sources.every((s) => s.kind !== 'salary')) {
    warnings.push('Kein monatlich wiederkehrender Lohneingang erkannt — Einkommen bitte prüfen.');
  }

  // ── Ausgaben je Detailfeld ──────────────────────────────────────────────
  interface Bucket {
    total: number;
    count: number;
    months: Set<string>;
    largest: number;
    merchants: Map<string, number>;
    confidenceSum: number;
    reviewCount: number;
  }
  const buckets = new Map<string, Bucket>();
  const needsReview: { tx: NormalizedTx; guess: Categorization }[] = [];

  const bucketOf = (key: string): Bucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { total: 0, count: 0, months: new Set(), largest: 0, merchants: new Map(), confidenceSum: 0, reviewCount: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  for (const tx of expenses) {
    const guess = categorize(tx);
    const bucket = bucketOf(`${guess.category}|${guess.field}`);
    const value = Math.abs(tx.amount);
    bucket.total += value;
    bucket.count += 1;
    bucket.months.add(YYYY_MM(tx.date));
    bucket.largest = Math.max(bucket.largest, value);
    bucket.confidenceSum += guess.confidence * value;
    const name = tx.merchant || tx.counterparty || 'unbekannt';
    bucket.merchants.set(name, (bucket.merchants.get(name) ?? 0) + value);
    if (guess.needsReview) {
      bucket.reviewCount += 1;
      needsReview.push({ tx, guess });
    }
  }

  // Rückerstattungen mindern die Ausgabe, in die sie gehören — statt als Einkommen zu zählen.
  const reduceBucket = (key: string, amount: number) => {
    const bucket = buckets.get(key);
    if (!bucket || amount <= 0) return;
    const factor = bucket.total > 0 ? Math.max(0, bucket.total - amount) / bucket.total : 0;
    bucket.total *= factor;
    bucket.confidenceSum *= factor;
  };

  for (const tx of refundTxs) {
    const guess = categorize(tx);
    reduceBucket(`${guess.category}|${guess.field}`, tx.amount);
  }

  // Steuerrückerstattungen mindern die Steuerlast.
  if (refundYear > 0) reduceBucket('taxes|0', (refundYear / 12) * months);

  // TWINT netto: was per Saldo rausging, landet in «Weitere Ausgaben».
  const lentNet = lentTxs.reduce((sum, tx) => sum + tx.amount, 0);
  if (lentNet < 0) {
    const other = bucketOf('consumption|3');
    other.total += -lentNet;
    other.count += lentTxs.length;
    other.confidenceSum += 0.6 * -lentNet;
    other.merchants.set('TWINT (netto an Private)', -lentNet);
    for (const tx of lentTxs) other.months.add(YYYY_MM(tx.date));
  }

  const evidence: SlotEvidence[] = [];
  const amounts: Record<CategoryKey, number> = {
    taxes: 0,
    reside: 0,
    insurance: 0,
    health: 0,
    mobility: 0,
    consumption: 0,
  };

  for (const category of EXPENSE_CATEGORIES) {
    category.fieldLabels.forEach((label, field) => {
      const bucket = buckets.get(`${category.key}|${field}`);
      if (!bucket || bucket.total === 0) return;
      const amountMonth = Math.round(bucket.total / months);
      amounts[category.key] += amountMonth;
      evidence.push({
        category: category.key,
        field,
        label,
        amountMonth,
        count: bucket.count,
        monthsSeen: bucket.months.size,
        largestSingle: Math.round(bucket.largest),
        topMerchants: [...bucket.merchants.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, total]) => ({ name, amountMonth: Math.round(total / months) })),
        confidence: bucket.total > 0 ? Number((bucket.confidenceSum / bucket.total).toFixed(2)) : 0,
        reviewCount: bucket.reviewCount,
      });
    });
  }

  const sumExpensesMonth = CATEGORY_KEYS.reduce((sum, key) => sum + amounts[key], 0);

  const budget = { display: Display.month } as Budget;
  budget.householdIncomeNetMonth = netMonth;
  budget.householdIncomeNetYear = netYear;
  budget.sumExpensesMonth = sumExpensesMonth;
  budget.sumExpensesYear = sumExpensesMonth * 12;
  budget.savingQuoteMonth = netMonth - sumExpensesMonth;
  budget.savingQuoteYear = netYear - sumExpensesMonth * 12;
  for (const key of CATEGORY_KEYS) {
    (budget as unknown as Record<string, unknown>)[`${key}UUID`] = `derived-${key}`;
    (budget as unknown as Record<string, unknown>)[`${key}MonthAmount`] = amounts[key];
    (budget as unknown as Record<string, unknown>)[`${key}YearAmount`] = amounts[key] * 12;
  }

  // ── Profil: was wir sehen, was wir fragen müssen ─────────────────────────
  const known = options.known ?? {};
  const openQuestions: OpenQuestion[] = [];

  const canton = detectCanton(txs);
  const zipCity = detectZipCity(txs, options.context?.ownName) ?? undefined;

  if (known.taxLocationId === undefined && !canton) {
    openQuestions.push({
      field: 'zipCode',
      question: 'In welcher Gemeinde bist du steuerpflichtig?',
      reason: 'Keine Steuerzahlung im Beobachtungszeitraum gefunden.',
    });
  }
  if (known.civilStatus === undefined) {
    openQuestions.push({
      field: 'civilStatus',
      question: 'Lebst du allein oder mit Partner:in?',
      reason: 'Aus Buchungen nicht erkennbar — ein gemeinsames Konto sieht aus wie ein einzelnes.',
    });
  }
  if (known.children === undefined) {
    openQuestions.push({
      field: 'children',
      question: 'Hast du unterstützungspflichtige Kinder?',
      suggestion: 0,
      reason: 'Keine Kita-, Schul- oder Kinderzulagen-Buchungen gefunden.',
    });
  }
  if (known.year === undefined) {
    openQuestions.push({
      field: 'year',
      question: 'Welcher Jahrgang?',
      reason: 'Bestimmt den BVG-Abzug. Die Bank kennt ihn aus dem Kundenprofil.',
    });
  }
  if (known.denomination === undefined) {
    openQuestions.push({
      field: 'denomination',
      question: 'Konfession?',
      suggestion: '4',
      reason: 'Beeinflusst die Steuern um bis zu 11 %. Nur relevant für den Vergleichswert.',
    });
  }

  const currentYear = options.currentYear ?? new Date(asOf).getFullYear();
  const age = known.year ? currentYear - known.year : 18;
  const impliedGrossYear = grossFromNet(netYear, age);

  // ── Richtwert zum selben Haushalt ───────────────────────────────────────
  let benchmark: Budget | null = null;
  const taxLocationId = known.taxLocationId ?? (canton ? cantonTaxLocationId(canton.canton) : null);
  if (taxLocationId !== null && known.civilStatus !== undefined) {
    try {
      benchmark = estimateBudget(
        {
          civilStatus: known.civilStatus as CivilStatus,
          children: String(known.children ?? 0),
          zipCode: known.zipCode ?? zipCity?.zipCode ?? null,
          city: known.city ?? zipCity?.city ?? null,
          taxLocationId,
          sex: '1',
          year: known.year ?? currentYear - 18,
          grossYearIncome: impliedGrossYear,
          denomination: (known.denomination ?? '4') as Denomination,
          sexPartner: '2',
          yearPartner: known.year ?? currentYear - 18,
          grossYearIncomePartner: null,
          denominationPartner: null,
        },
        options,
      );
    } catch (error) {
      warnings.push(`Richtwert nicht berechenbar: ${(error as Error).message}`);
    }
  }

  return {
    period: { from, to: asOf, months },
    budget,
    benchmark,
    evidence: evidence.sort((a, b) => b.amountMonth - a.amountMonth),
    income: {
      netYear,
      netMonth,
      sources,
      impliedGrossYear,
    },
    moneyFlow: flows,
    actualSavingsMonth: Math.round(movedYear / months),
    openQuestions,
    needsReview,
    warnings,
  };
}

/** Referenz-Steuerort des Kantons (ein Ort pro Kanton aus `reference.json`). */
function cantonTaxLocationId(canton: string): number | null {
  return taxLocationByCanton(canton)?.taxLocationID ?? null;
}
