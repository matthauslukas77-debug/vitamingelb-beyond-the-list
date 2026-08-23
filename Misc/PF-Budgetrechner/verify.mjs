#!/usr/bin/env node
/**
 * Prüft das lokale Modell gegen die 2'513 gesampelten Live-Antworten.
 *
 *   node verify.mjs           # Offline-Validierung
 *   node verify.mjs --live    # zusätzlich ein Live-Call gegen postfinance.ch
 *
 * Reines JS, keine Abhängigkeiten — die TypeScript-Module in src/ implementieren
 * dieselbe Logik für die App.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ref = JSON.parse(readFileSync(join(HERE, 'data/reference.json'), 'utf8'));
const CATS = ['reside', 'insurance', 'health', 'mobility', 'consumption'];

// --- Modell -----------------------------------------------------------------

export function netIncomeYear(gross, birthYear, currentYear = 2026) {
  if (!gross) return 0;
  let d = 0.074 * gross;
  d += 0.035 * Math.max(0, Math.min(gross, 148200) - 90720);
  d += 0.014 * Math.max(0, gross - 148200);
  const age = currentYear - birthYear;
  const rate = age < 25 ? 0 : age < 35 ? 0.07 : age < 45 ? 0.1 : age < 55 ? 0.15 : 0.18;
  if (rate && gross >= 22680) d += (rate / 2) * Math.min(Math.max(gross - 26460, 3780), 64260);
  return gross - d;
}

export function expenseClass(civilStatus, children, netMonth) {
  const classes = ref.expenseClasses[`${civilStatus}|${children}`];
  return (
    classes.find((c) => netMonth >= c.netLowerBound && (c.netUpperBound === null || netMonth < c.netUpperBound)) ??
    classes.at(-1)
  );
}

export function taxYear({ taxLocationId, civilStatus, children, householdGross, denomination, earners }) {
  const perLoc = ref.taxByLocation[String(taxLocationId)];
  const pts = perLoc[`${civilStatus}|${children}|${earners}`] ?? perLoc[`${civilStatus}|${children}|${earners === 1 ? 2 : 1}`];
  const [firstX, firstY] = pts[0];
  const [lastX, lastY] = pts.at(-1);
  let v;
  if (householdGross <= firstX) v = firstX > 0 ? (firstY * householdGross) / firstX : 0;
  else if (householdGross >= lastX) {
    const [px, py] = pts.at(-2);
    v = lastY + ((lastY - py) / (lastX - px)) * (householdGross - lastX);
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (householdGross >= x0 && householdGross <= x1) {
        v = y0 + ((y1 - y0) * (householdGross - x0)) / (x1 - x0);
        break;
      }
    }
  }
  const f = ref.denominationFactor[String(taxLocationId)]?.[denomination] ?? 1;
  return Math.max(0, v * f);
}

export function estimateBudget(form, currentYear = 2026) {
  const children = Number(form.children);
  const partnerGross = form.civilStatus !== '1' ? (form.grossYearIncomePartner ?? 0) : 0;
  const netY =
    netIncomeYear(form.grossYearIncome, form.year, currentYear) +
    (partnerGross ? netIncomeYear(partnerGross, form.yearPartner, currentYear) : 0);
  const netMonth = Math.round(Math.round(netY) / 12);

  const cls = expenseClass(form.civilStatus, children, netMonth);
  const sumExpensesMonth = Math.round(cls.expenseRatio * netMonth);
  const taxesMonth = Math.round(
    taxYear({
      taxLocationId: form.taxLocationId,
      civilStatus: form.civilStatus,
      children,
      householdGross: form.grossYearIncome + partnerGross,
      denomination: form.denomination,
      earners: partnerGross > 0 ? 2 : 1,
    }) / 12,
  );
  const rest = Math.max(0, sumExpensesMonth - taxesMonth);

  const out = {
    householdIncomeNetMonth: netMonth,
    householdIncomeNetYear: Math.round(netY),
    sumExpensesMonth,
    savingQuoteMonth: netMonth - sumExpensesMonth,
    taxesMonthAmount: taxesMonth,
  };
  for (const c of CATS) out[`${c}MonthAmount`] = Math.round(cls.shares[c] * rest);
  return out;
}

// --- Validierung ------------------------------------------------------------

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

function validate() {
  const raw = gunzipSync(readFileSync(join(HERE, 'data/samples.jsonl.gz'))).toString('utf8');
  const rows = raw
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => r.out);

  const errs = { netto: [], sumExpenses: [], taxes: [], taxesAbs: [] };
  for (const c of CATS) errs[c] = [];

  for (const { in: form, out } of rows) {
    const p = estimateBudget(form);
    errs.netto.push(Math.abs(p.householdIncomeNetMonth - out.householdIncomeNetMonth));
    errs.sumExpenses.push(Math.abs(p.sumExpensesMonth - out.sumExpensesMonth) / Math.max(1, out.sumExpensesMonth));
    errs.taxesAbs.push(Math.abs(p.taxesMonthAmount - out.taxesMonthAmount));
    errs.taxes.push(Math.abs(p.taxesMonthAmount - out.taxesMonthAmount) / Math.max(1, out.taxesMonthAmount));
    for (const c of CATS) {
      const key = `${c}MonthAmount`;
      errs[c].push(Math.abs(p[key] - out[key]) / Math.max(1, out[key]));
    }
  }

  console.log(`Lokales Modell gegen ${rows.length} Live-Samples\n`);
  console.log(`  Nettoeinkommen/Mt : max. Abweichung ${Math.max(...errs.netto)} CHF`);
  const tAbs = errs.taxesAbs.sort((a, b) => a - b);
  console.log(
    `  Steuern/Mt        : Median ${quantile(tAbs, 0.5)} CHF · p90 ${quantile(tAbs, 0.9)} CHF · p99 ${quantile(tAbs, 0.99)} CHF`,
  );
  for (const k of ['sumExpenses', ...CATS]) {
    const v = errs[k].sort((a, b) => a - b);
    console.log(
      `  ${k.padEnd(18)}: Median ${(quantile(v, 0.5) * 100).toFixed(2)} % · p90 ${(quantile(v, 0.9) * 100).toFixed(2)} % · p99 ${(quantile(v, 0.99) * 100).toFixed(2)} %`,
    );
  }
  return rows.length;
}

// --- Live-Abgleich ----------------------------------------------------------

const DEMO_FORM = {
  civilStatus: '2',
  children: '2',
  zipCode: '3011',
  city: 'Bern',
  taxLocationId: 301100000,
  sex: '1',
  year: 2008,
  grossYearIncome: 95000,
  denomination: '4',
  sexPartner: '2',
  yearPartner: 2008,
  grossYearIncomePartner: 55000,
  denominationPartner: '4',
};

async function live() {
  const res = await fetch(
    'https://www.postfinance.ch/pfch/rest/api/calculator/logicalc/finance/budget-calculator/calculateBudget',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(DEMO_FORM) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { result } = await res.json();
  const local = estimateBudget(DEMO_FORM);

  console.log('\nLive-Abgleich — Ehepaar, 2 Kinder, 95k + 55k, Bern\n');
  console.log('  Position              PostFinance      lokal     Delta');
  const line = (label, a, b) =>
    console.log(`  ${label.padEnd(20)} ${String(a).padStart(9)} ${String(b).padStart(10)} ${String(b - a).padStart(9)}`);
  line('Nettoeinkommen/Mt', result.householdIncomeNetMonth, local.householdIncomeNetMonth);
  line('Ausgaben/Mt', result.sumExpensesMonth, local.sumExpensesMonth);
  line('Überschuss/Mt', result.savingQuoteMonth, local.savingQuoteMonth);
  for (const c of ['taxes', ...CATS]) {
    line(c, result[`${c}MonthAmount`], local[`${c}MonthAmount`]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validate();
  if (process.argv.includes('--live')) await live();
}
