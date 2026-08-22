import { generateTransactions, type Merchant, type Series } from '../generate'
import type { Account, Persona } from '../types'
import { TODAY } from '../types'

const PRIVATE = 'michael-private'
const SAVINGS = 'michael-savings'
const VALIANT = 'michael-valiant'
const PILLAR3A = 'michael-3a'
const MORTGAGE = 'michael-mortgage'
const FROM = '2025-08-01'

/** Michael: «sehr verteilt» — sechs Beziehungen über mehrere Institute (Interview 07). */
const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH55 0900 0000 3040 1122 6',
    kind: 'private',
    currency: 'CHF',
    balance: 1_284_600,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH55 0900 0000 3040 1122 7',
    kind: 'savings',
    currency: 'CHF',
    balance: 4_120_000,
    source: { type: 'postfinance' },
  },
  {
    id: VALIANT,
    name: 'Privatkonto',
    iban: 'CH28 0630 0016 1234 5678 9',
    kind: 'private',
    currency: 'CHF',
    balance: 862_300,
    source: { type: 'external', bank: 'Valiant' },
  },
  {
    id: PILLAR3A,
    name: 'Vorsorgekonto 3a',
    iban: 'CH11 0900 0000 3040 9988 1',
    kind: 'retirement3a',
    currency: 'CHF',
    balance: 7_240_000,
    source: { type: 'postfinance' },
    furtherProduct: true,
  },
  {
    id: MORTGAGE,
    name: 'Hypothek',
    iban: 'CH90 0630 0016 9911 2233 4',
    kind: 'loan',
    currency: 'CHF',
    balance: -42_000_000,
    source: { type: 'external', bank: 'Valiant' },
    furtherProduct: true,
  },
]

const series: Series[] = [
  { id: 'm-salary', text: 'LOHN / Kantonale Organisation', category: 'income', amount: 862_000, dayOfMonth: 25 },
  { id: 'm-mortgage', text: 'HYPOTHEKARZINS / Valiant', category: 'housing', amount: -118_000, dayOfMonth: 1 },
  { id: 'm-health', text: 'KRANKENKASSE PRAEMIE 2P', category: 'insurance', amount: -78_400, dayOfMonth: 5 },
  { id: 'm-3a', text: 'EINZAHLUNG VORSORGE 3A', category: 'transfer', amount: -60_000, dayOfMonth: 26, counterAccountId: PILLAR3A },
  { id: 'm-building', text: 'GEBAEUDEVERSICHERUNG GVB', category: 'insurance', amount: -9_800, dayOfMonth: 7 },
  { id: 'm-mobile', text: 'SWISSCOM (SCHWEIZ) AG', category: 'subscriptions', amount: -12_900, dayOfMonth: 3 },
  { id: 'm-power', text: 'BKW ENERGIE AG / AKONTO', category: 'housing', amount: -18_500, dayOfMonth: 10 },
  { id: 'm-serafe', text: 'SERAFE AG / ABGABE', category: 'subscriptions', amount: -3_350, dayOfMonth: 15 },
]

const merchants: Merchant[] = [
  { name: 'COOP-1729 SCHAFISHEIM', kind: 'pos', applePay: true, category: 'groceries', min: 2400, max: 12800, brand: { bg: '#FFFFFF', fg: '#E2001A', short: 'coop' } },
  { name: 'SumUp *Hofladen Wyss', kind: 'service', category: 'groceries', min: 900, max: 4200 },
  { name: 'MIGROL SERVICE / TANKSTELLE', kind: 'pos', applePay: true, category: 'transport', min: 6800, max: 11900 },
  { name: 'SIX Payment 55210 / BIEL', kind: 'service', category: 'eatingOut', min: 1900, max: 8400 },
  { name: 'PAYPAL *BUCHHANDLUNG LUE', kind: 'online', category: 'leisure', min: 2400, max: 9800, brand: { bg: '#003087', fg: '#FFFFFF', short: 'PP' } },
  { name: 'HORNBACH BAUMARKT AG', kind: 'pos', applePay: true, category: 'housing', min: 3800, max: 42000 },
  { name: 'SBB CFF FFS Mobile Tic', kind: 'service', applePay: true, category: 'transport', min: 980, max: 6400, brand: { bg: '#EB0000', fg: '#FFFFFF', short: '✚' } },
]

/**
 * Der eine grosse Jahresposten. Michael im Interview: «Die Steuern … das ist bei
 * weitem die grösste Ausgabe, einmal pro Jahr, und das macht alles kaputt.»
 * Er verzerrt jede Kategorienauswertung — im Nachbau bewusst enthalten.
 */
const extra = [
  {
    id: 'm-tax-2026',
    accountId: PRIVATE,
    date: '2026-03-12',
    text: 'STEUERVERWALTUNG KT. BERN / SCHLUSSRECHNUNG',
    amount: -1_840_000,
    currency: 'CHF' as const,
    category: 'taxes' as const,
  },
  {
    id: 'm-tax-2025',
    accountId: PRIVATE,
    date: '2025-09-15',
    text: 'STEUERVERWALTUNG KT. BERN / AKONTO',
    amount: -420_000,
    currency: 'CHF' as const,
    category: 'taxes' as const,
  },
  {
    id: 'm-ga',
    accountId: PRIVATE,
    date: '2026-01-08',
    text: 'SBB GENERALABONNEMENT 2. KL',
    amount: -395_000,
    currency: 'CHF' as const,
    category: 'transport' as const,
  },
  {
    id: 'm-heating',
    accountId: PRIVATE,
    date: '2026-08-11',
    text: 'ANZAHLUNG HEIZUNG / IG Nachbarschaft',
    amount: -1_200_000,
    currency: 'CHF' as const,
    category: 'housing' as const,
  },
]

export const michael: Persona = {
  id: 'michael',
  name: 'Michael Aebischer',
  role: '59 · angestellt · sechs Bankbeziehungen',
  quote: '«Vom Verhältnis her sind die schönen Charts dann ein bisschen misleading.»',
  source: 'Interview 07',
  accounts,
  transactions: [
    ...extra,
    ...generateTransactions({
      accountId: PRIVATE,
      currency: 'CHF',
      seed: 7_007,
      fromIso: FROM,
      toIso: TODAY,
      series,
      merchants,
      perWeek: 5,
    }),
  ],
  standingOrders: [
    { id: 'm-so-1', accountId: PRIVATE, recipient: 'Vorsorgekonto 3a', amount: -60_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'm-po-1', accountId: PRIVATE, recipient: 'Zahnarzt Dr. med. dent. Reber', amount: -42_000, currency: 'CHF', execution: '2026-08-25' },
    { id: 'm-po-2', accountId: PRIVATE, recipient: 'IG Heizung Nachbarschaft', amount: -80_000, currency: 'CHF', execution: '2026-09-01' },
  ],
}
