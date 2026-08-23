/**
 * Client für die öffentliche PostFinance-Budgetrechner-API.
 *
 * Ohne Auth erreichbar (Stand 2026-08-22). Für die Demo trotzdem nur als
 * Referenz-/Abgleichpfad benutzen — der Live-Pfad hängt an fremder Infrastruktur.
 * Produktivpfad ist `estimateBudget()` aus `reference.ts`.
 */

import { BudgetValidationError, type Budget, type FieldError, type InformationForm, type TaxLocation } from './types.ts';

const BASE = 'https://www.postfinance.ch/pfch/rest/api';
const BUDGET = `${BASE}/calculator/logicalc/finance/budget-calculator`;
const GLOBAL_ERROR_CODE = '501';

export interface ClientOptions {
  /** Eigener fetch (Tests, Proxy, Node < 18). */
  fetch?: typeof globalThis.fetch;
  /** Default 20'000 ms — wie der Original-RestService. */
  timeoutMs?: number;
  /** Reverse-Proxy statt postfinance.ch (CORS!). */
  baseUrl?: string;
}

export class BudgetCalculatorClient {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly base: string;

  constructor(options: ClientOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.base = options.baseUrl ?? BASE;
  }

  /** Steuerort-Autocomplete. `searchText` = PLZ oder Ort. */
  async searchTaxLocation(searchText: string): Promise<TaxLocation[]> {
    const clean = searchText.replace(/['^`%|{}[\]]/g, '');
    const res = await this.request(
      'GET',
      `${this.base}/calculator/logicalc/tax/searchTaxLocation/${encodeURIComponent(clean)}`,
    );
    return (res.result ?? []) as TaxLocation[];
  }

  /** Step 1 → Step 2. Wirft `BudgetValidationError` bei HTTP 422. */
  async calculateBudget(form: InformationForm): Promise<Budget> {
    const res = await this.request('POST', `${this.budgetBase}/calculateBudget`, form);
    return res.result as Budget;
  }

  /** Nachrechnen nach einer Betragsänderung. Body = komplettes Budget inkl. UUIDs. */
  async updateBudget(budget: Budget): Promise<Budget> {
    const res = await this.request('POST', `${this.budgetBase}/updateBudget`, budget);
    return res.result as Budget;
  }

  /** Label-Bundle des Rechners. */
  async labels(lang: 'de' | 'en' | 'fr' | 'it' = 'de'): Promise<Record<string, unknown>> {
    const url = `https://www.postfinance.ch/pfch/keyvalue-provider/api/i18n/${lang}/webapps.calculator.logicalc.finance.budgetcalculator`;
    const res = await this.fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`i18n ${res.status}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  private get budgetBase(): string {
    return this.base === BASE ? BUDGET : `${this.base}/calculator/logicalc/finance/budget-calculator`;
  }

  private async request(method: 'GET' | 'POST', url: string, body?: unknown): Promise<{ result?: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept-Language': 'de-CH' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();

      if (res.status === 422) throw toValidationError(text);
      if (!res.ok) throw new Error(`Budgetrechner ${res.status}: ${text.slice(0, 200)}`);

      const json = JSON.parse(text) as { result?: unknown; error?: { code: string; text: string } };
      if (json.error) throw new Error(`Budgetrechner ${json.error.code}: ${json.error.text}`);
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
}

function toValidationError(text: string): BudgetValidationError {
  const parsed = JSON.parse(text) as {
    messages?: { error?: Array<{ code: string; text: string; data?: { fieldName?: string; translationKey?: string } }> };
  };
  const all: FieldError[] = (parsed.messages?.error ?? []).map((e) => ({
    fieldName: e.data?.fieldName ?? '',
    translationKey: e.data?.translationKey ?? '',
    text: e.text,
    code: e.code,
  }));
  return new BudgetValidationError(
    all.filter((e) => e.code !== GLOBAL_ERROR_CODE),
    all.filter((e) => e.code === GLOBAL_ERROR_CODE),
  );
}
