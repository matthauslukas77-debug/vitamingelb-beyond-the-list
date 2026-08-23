#!/usr/bin/env node
/**
 * Zeigt den selbstausfüllenden Budget-Wizard an echten Buchungen.
 *
 *   node derive.mjs                       # Mia Keller, 24 Monate synthetisch
 *   node derive.mjs --months 24
 *   node derive.mjs --csv <pfad.csv>      # eigener Datensatz im selben Schema
 *
 * Läuft ohne Toolchain: Node führt die TypeScript-Module aus src/ direkt aus.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveBudget } from './src/derive.ts';
import { moneyFlow } from './src/transactions.ts';
import { EXPENSE_CATEGORIES, formatAmount, topTip, bottomTip } from './src/model.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = join(HERE, '../postfinance_template_data/transactions_synthetic.csv');
const DEFAULT_PERSONA = join(HERE, '../postfinance_template_data/persona.json');

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const csvPath = resolve(argOf('--csv', DEFAULT_CSV));
const months = Number(argOf('--months', '12'));
/** `--rules-only` ignoriert die Kategorie, die die Bank schon vergeben hat. */
const useBankCategory = !argv.includes('--rules-only');

// --- CSV → NormalizedTx -----------------------------------------------------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows;
  return body
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

/** Adapter: Schema des Template-Datensatzes → NormalizedTx. */
function toNormalized(record) {
  return {
    id: record.id,
    date: record.booking_date,
    amount: Number(record.amount_chf),
    text: record.description || '',
    merchant: record.merchant || undefined,
    counterparty: record.counterparty || undefined,
    counterpartyAccount: record.counterparty_account || undefined,
    message: record.message || undefined,
    txType: record.tx_type || undefined,
    paymentMethod: record.payment_method || undefined,
    source: record.source_type?.startsWith('kreditkarte') ? 'card' : 'account',
    account: record.account,
    bankCategory: useBankCategory ? record.category || undefined : undefined,
  };
}

const records = parseCsv(readFileSync(csvPath, 'utf8'));
const txs = records.map(toNormalized);

let persona = null;
try { persona = JSON.parse(readFileSync(DEFAULT_PERSONA, 'utf8')); } catch { /* optional */ }

const context = persona
  ? {
      ownName: persona.persona.name,
      ownAccounts: persona.accounts.filter((a) => a.iban).map((a) => a.iban),
      cardAccounts: persona.accounts.filter((a) => a.card_id).map((a) => a.card_id),
    }
  : {};

// --- Kontrollrechnung: stimmt der Saldo? ------------------------------------

const accountTxs = records.filter((r) => r.source_type === 'privatkonto_synthetic');
if (accountTxs.length && persona) {
  const opening = Number(persona.accounts[0].opening_balance);
  const sum = accountTxs.reduce((acc, r) => acc + Number(r.amount_chf), 0);
  const closing = Number(accountTxs[accountTxs.length - 1].balance_after);
  const delta = Math.abs(opening + sum - closing);
  console.log(
    `Kontrollrechnung Privatkonto: ${opening.toFixed(2)} ${sum >= 0 ? '+' : '−'} ${Math.abs(sum).toFixed(2)} = ` +
      `${(opening + sum).toFixed(2)} · Auszug ${closing.toFixed(2)} · Differenz ${delta.toFixed(2)}\n`,
  );
}

// --- Ableitung --------------------------------------------------------------

const derived = deriveBudget(txs, {
  months,
  context,
  // Was die Bank aus dem Kundenprofil kennt und nicht fragen muss:
  known: { civilStatus: '1', children: '0', year: 1995, denomination: '4' },
});

const { budget, benchmark, income, period } = derived;
const chf = (v) => `${Math.round(v).toLocaleString('de-CH')}`.padStart(7);

console.log(`Beobachtungsfenster  ${period.from} … ${period.to}  (${period.months} Monate, ${txs.length} Buchungen)\n`);

console.log('GELDFLUSS — wo ist das Geld hin?');
const flowLabel = {
  in: 'rein (Einnahmen)',
  out: 'weg (echte Ausgaben)',
  moved: 'umgezogen (eigenes Konto)',
  settled: 'ausgeglichen (KK-Rechnung, Refunds)',
  lent: 'ausgelegt (TWINT privat)',
};
for (const [flow, { amountMonth, count }] of Object.entries(derived.moneyFlow)) {
  if (count === 0) continue;
  console.log(`  ${flowLabel[flow].padEnd(28)} ${chf(amountMonth)} CHF/Mt  (${count} Buchungen)`);
}

const inWindow = txs.filter((t) => t.date > period.from && t.date <= period.to);
const naive = inWindow.filter((t) => t.amount < 0).reduce((sum, t) => sum + -t.amount, 0) / period.months;
console.log(
  `\n  Naiv «alle Belastungen zusammenzählen»: ${chf(naive)} CHF/Mt` +
    `\n  Ehrlich (ohne Sparen, ohne Doppelzählung): ${chf(budget.sumExpensesMonth)} CHF/Mt` +
    `\n  → Der naive Weg überschätzt die Ausgaben um ${chf(naive - budget.sumExpensesMonth)} CHF/Mt.\n`,
);

console.log('EINKOMMEN');
for (const s of income.sources.slice(0, 5)) {
  const rhythm = s.medianIntervalDays ? `alle ${s.medianIntervalDays} Tage` : 'einmalig';
  console.log(`  ${s.name.slice(0, 34).padEnd(34)} ${chf(s.amountYear / period.months)} CHF/Mt  ${s.kind.padEnd(9)} ${rhythm}`);
}
console.log(`  ${'→ Nettoeinkommen'.padEnd(34)} ${chf(income.netMonth)} CHF/Mt`);
console.log(`  ${'→ daraus zurückgerechnetes Brutto'.padEnd(34)} ${chf(income.impliedGrossYear / 12)} CHF/Mt\n`);

console.log('BUDGET — Ist aus Buchungen vs. PostFinance-Richtwert');
console.log(`  ${'Kategorie'.padEnd(30)} ${'Ist'.padStart(9)} ${'Richtwert'.padStart(11)} ${'Delta'.padStart(9)}`);
for (const cat of EXPENSE_CATEGORIES) {
  const own = budget[`${cat.key}MonthAmount`];
  const ref = benchmark ? benchmark[`${cat.key}MonthAmount`] : null;
  const delta = ref === null ? '' : chf(own - ref);
  console.log(`  ${cat.key.padEnd(30)} ${chf(own)} ${ref === null ? '—'.padStart(11) : chf(ref).padStart(11)} ${delta.padStart(9)}`);
}
console.log(`  ${'─'.repeat(62)}`);
console.log(
  `  ${'Ausgaben total'.padEnd(30)} ${chf(budget.sumExpensesMonth)} ${benchmark ? chf(benchmark.sumExpensesMonth).padStart(11) : ''}`,
);
console.log(`  ${'Nettoeinkommen'.padEnd(30)} ${chf(budget.householdIncomeNetMonth)}`);
console.log(`  ${'Überschuss'.padEnd(30)} ${chf(budget.savingQuoteMonth)}   ${formatAmount(budget.savingQuoteMonth, { signed: true })}`);
console.log(`  ${'davon wirklich gespart'.padEnd(30)} ${chf(derived.actualSavingsMonth)}   (Dauerauftrag Sparkonto)\n`);

console.log('DETAILFELDER — alle 19, vorbefüllt statt leer');
for (const cat of EXPENSE_CATEGORIES) {
  const rows = derived.evidence.filter((e) => e.category === cat.key);
  if (!rows.length) continue;
  console.log(`  ${cat.title}`);
  for (const e of rows.sort((a, b) => a.field - b.field)) {
    const source = e.topMerchants.map((m) => m.name).slice(0, 2).join(', ');
    const flag = e.confidence < 0.6 ? ' ⚠' : '';
    console.log(
      `    ${cat.fieldLabels[e.field].padEnd(38)} ${chf(e.amountMonth)} CHF/Mt` +
        `  ${String(e.count).padStart(4)} Bch · ${e.monthsSeen}/${period.months} Mt · Konf. ${e.confidence}${flag}` +
        `  ← ${source.slice(0, 40)}`,
    );
  }
}

console.log('\nTIPPS (Logik des Originals, auf echten Zahlen)');
console.log(`  oben:  ${topTip(budget) ?? '—'}`);
console.log(`  unten: ${bottomTip(budget) ?? '—'}`);

if (derived.openQuestions.length) {
  console.log('\nOFFENE FRAGEN — das ist alles, was die App noch fragen muss');
  for (const q of derived.openQuestions) {
    console.log(`  • ${q.question}${q.suggestion !== undefined ? `  (Vorschlag: ${q.suggestion})` : ''}`);
    console.log(`    ${q.reason}`);
  }
} else {
  console.log('\nOFFENE FRAGEN — keine. Der Wizard füllt sich vollständig selbst.');
}

if (derived.needsReview.length) {
  const total = derived.needsReview.reduce((sum, r) => sum + Math.abs(r.tx.amount), 0);
  console.log(
    `\nZUR BESTÄTIGUNG: ${derived.needsReview.length} Buchungen (${chf(total / period.months)} CHF/Mt) ohne sichere Zuordnung`,
  );
  const byReason = new Map();
  for (const r of derived.needsReview) {
    const key = r.guess.matchedBy;
    byReason.set(key, (byReason.get(key) ?? 0) + Math.abs(r.tx.amount));
  }
  for (const [reason, amount] of [...byReason].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(34)} ${chf(amount / period.months)} CHF/Mt`);
  }
  console.log('  Beispiele:');
  for (const r of derived.needsReview.slice(0, 5)) {
    console.log(`    ${r.tx.date}  ${String(Math.abs(r.tx.amount).toFixed(2)).padStart(8)}  ${(r.tx.merchant ?? r.tx.text).slice(0, 52)}`);
  }
}

for (const w of derived.warnings) console.log(`\n⚠ ${w}`);

// --- Abdeckung: wie viel Franken trifft eine echte Regel? -------------------

let ruled = 0;
let guessed = 0;
for (const tx of inWindow) {
  if (tx.amount >= 0) continue;
  if (moneyFlow(tx, context).flow !== 'out') continue;
  const { needsReview } = (await import('./src/categorize.ts')).categorize(tx);
  if (needsReview) guessed += -tx.amount;
  else ruled += -tx.amount;
}
const share = (ruled / (ruled + guessed)) * 100;
console.log(
  `\nABDECKUNG (${useBankCategory ? 'Regeln + Bankkategorie' : 'nur Regeln'}): ` +
    `${share.toFixed(1)} % der Ausgabenfranken sind sicher zugeordnet, ${(100 - share).toFixed(1)} % gehen in den Review.`,
);
