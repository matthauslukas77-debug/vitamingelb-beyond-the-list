import { generateTransactions, type Merchant, type Series } from '../generate'
import type { Account, Persona } from '../types'
import { TODAY } from '../types'

const PRIVATE = 'katja-private'
const SAVINGS = 'katja-savings'
const FROM = '2025-08-01'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH88 0900 0000 1600 4412 3',
    kind: 'youth',
    currency: 'CHF',
    balance: 142_380,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH19 0900 0000 1600 4412 4',
    kind: 'savings',
    currency: 'CHF',
    // Ziel: 50'000 bis Lehrende — siehe Interview 05.
    balance: 1_845_000,
    source: { type: 'postfinance' },
  },
]

/**
 * Katja spart diszipliniert per Dauerauftrag auf ihr EIGENES Sparkonto.
 * In der heutigen Auswertung zählt diese Umbuchung als Ausgabe und verfälscht
 * ihre Zahlen — genau der Punkt aus Interview 05. Der Nachbau zeigt den
 * Ist-Zustand; die Kategorie `transfer` markiert die Stelle bereits.
 */
const series: Series[] = [
  { id: 'k-salary', text: 'LEHRLINGSLOHN / Raiffeisen', category: 'income', amount: 118_000, dayOfMonth: 25 },
  { id: 'k-savings', text: 'DAUERAUFTRAG SPARKONTO', category: 'transfer', amount: -50_000, dayOfMonth: 26, counterAccountId: SAVINGS },
  { id: 'k-mobile', text: 'WINGO / MOBILE ABO', category: 'subscriptions', amount: -2_500, dayOfMonth: 4 },
  { id: 'k-netflix', text: 'NETFLIX.COM', category: 'subscriptions', amount: -1_990, dayOfMonth: 12 },
  { id: 'k-gym', text: 'MIGROS FITNESSPARK', category: 'leisure', amount: -6_900, dayOfMonth: 2 },
  { id: 'k-ga', text: 'SBB HALBTAX ABO', category: 'transport', amount: -1_900, dayOfMonth: 8 },
  {
    id: 'k-app',
    text: 'GOOGLE *PLAY APPS',
    category: 'subscriptions',
    amount: -890,
    dayOfMonth: 19,
    // Nach der Kündigung weitergelaufen — im Interview erwähnt.
    raise: { fromIso: '2026-05-01', amount: -890 },
  },
]

const merchants: Merchant[] = [
  { name: 'COOP PRONTO 4102 SCHWARZENBURG', kind: 'pos', applePay: true, category: 'groceries', min: 480, max: 2900, brand: { bg: '#FFFFFF', fg: '#E2001A', short: 'coop' } },
  { name: 'ZALANDO SE', kind: 'online', category: 'shopping', min: 3900, max: 14900, brand: { bg: '#FF6900', fg: '#FFFFFF', short: 'Z' } },
  { name: 'ABOUT YOU GMBH', kind: 'online', category: 'shopping', min: 2900, max: 11500 },
  { name: 'SIX Payment 33071 / BERN', kind: 'service', category: 'eatingOut', min: 890, max: 2400 },
  { name: 'kkiosk 355.78', kind: 'service', applePay: true, category: 'eatingOut', min: 450, max: 1600, brand: { bg: '#2AA3D8', fg: '#FFFFFF', short: 'k' } },
  { name: 'SBB CFF FFS Mobile Tic', kind: 'service', applePay: true, category: 'transport', min: 320, max: 2800, brand: { bg: '#EB0000', fg: '#FFFFFF', short: '✚' } },
  { name: 'DM DROGERIE MARKT', kind: 'pos', applePay: true, category: 'health', min: 890, max: 4200 },
]

export const katja: Persona = {
  id: 'katja',
  name: 'Katja Berger',
  role: 'Lernende bei einer Bank · spart auf 50’000',
  quote: '«500 Franken aufs Sparkonto — dann ist das wie quasi als Ausgabe.»',
  source: 'Interview 05',
  accounts,
  transactions: generateTransactions({
    accountId: PRIVATE,
    currency: 'CHF',
    seed: 5_005,
    fromIso: FROM,
    toIso: TODAY,
    series,
    merchants,
    perWeek: 4,
  }),
  standingOrders: [
    { id: 'k-so-1', accountId: PRIVATE, recipient: 'Sparkonto', amount: -50_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [],
}
