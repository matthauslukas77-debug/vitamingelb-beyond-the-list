import { generateTransactions, type Merchant, type Series } from '../generate'
import type { Account, Persona } from '../types'
import { TODAY } from '../types'

const PRIVATE = 'janic-private'
const CUSTODY = 'janic-custody'
const FROM = '2025-08-01'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH42 0900 0000 3100 7788 1',
    kind: 'youth',
    currency: 'CHF',
    // Knapp — Janic war «wirklich viel im Minus» (Interview 04).
    balance: 4_270,
    source: { type: 'postfinance' },
  },
  {
    id: CUSTODY,
    name: 'Wertschriftendepot',
    iban: 'CH70 0483 5099 1234 5678 9',
    kind: 'custody',
    currency: 'CHF',
    balance: 312_400,
    source: { type: 'external', bank: 'Capital' },
    furtherProduct: true,
  },
]

const series: Series[] = [
  { id: 'j-salary', text: 'LOHN / Agentur Meridian AG', category: 'income', amount: 238_000, dayOfMonth: 25 },
  { id: 'j-rent', text: 'MIETE ZIMMER / WG Länggasse', category: 'housing', amount: -68_000, dayOfMonth: 1 },
  { id: 'j-health', text: 'KRANKENKASSE PRAEMIE', category: 'insurance', amount: -28_600, dayOfMonth: 5 },
  { id: 'j-adobe', text: 'ADOBE *CREATIVE CLOUD', category: 'subscriptions', amount: -7_190, dayOfMonth: 14 },
  { id: 'j-openai', text: 'OPENAI *CHATGPT SUBSCR', category: 'subscriptions', amount: -2_300, dayOfMonth: 9 },
  { id: 'j-spotify', text: 'SPOTIFY AB', category: 'subscriptions', amount: -1_295, dayOfMonth: 17 },
  { id: 'j-mobile', text: 'SUNRISE GMBH', category: 'subscriptions', amount: -4_500, dayOfMonth: 3 },
  { id: 'j-icloud', text: 'APPLE.COM/BILL ITUNES.COM', category: 'subscriptions', amount: -1_290, dayOfMonth: 11 },
  { id: 'j-figma', text: 'FIGMA INC', category: 'subscriptions', amount: -1_450, dayOfMonth: 21 },
  { id: 'j-mma', text: 'MMA GYM BERN / MITGLIED', category: 'leisure', amount: -9_500, dayOfMonth: 2 },
]

const merchants: Merchant[] = [
  { name: 'MIGROS MM BERN ZENTRUM', kind: 'pos', applePay: true, category: 'groceries', min: 890, max: 4900, brand: { bg: '#FF6600', fg: '#FFFFFF', short: 'M' } },
  { name: 'SIX Payment 21903 / BERN', kind: 'service', category: 'eatingOut', min: 1600, max: 4800 },
  { name: 'TWINT ACQ / Burger Lab', kind: 'service', category: 'eatingOut', min: 1800, max: 3600, brand: { bg: '#000000', fg: '#FFFFFF', short: 'tw' } },
  { name: 'UBER *EATS', kind: 'online', category: 'eatingOut', min: 2400, max: 5200 },
  { name: 'DIGITEC GALAXUS AG', kind: 'online', category: 'shopping', min: 8900, max: 79000, brand: { bg: '#0E1A24', fg: '#FFFFFF', short: 'd' } },
  { name: 'PAYPAL *EPIC GAMES', kind: 'online', category: 'leisure', min: 1500, max: 6900, brand: { bg: '#003087', fg: '#FFFFFF', short: 'PP' } },
  { name: 'SBB CFF FFS Mobile Tic', kind: 'service', applePay: true, category: 'transport', min: 480, max: 3900, brand: { bg: '#EB0000', fg: '#FFFFFF', short: '✚' } },
]

const extra = [
  // Die vergessene Rechnung, die im Interview zur Mahnung geführt hat.
  {
    id: 'j-reminder',
    accountId: PRIVATE,
    date: '2026-08-18',
    text: 'MAHNGEBUEHR / Zahnarztpraxis Lehmann',
    amount: -2_000,
    currency: 'CHF' as const,
    category: 'health' as const,
  },
  {
    id: 'j-overdraft',
    accountId: PRIVATE,
    date: '2026-07-29',
    text: 'SOLLZINS KONTOUEBERZUG',
    amount: -1_140,
    currency: 'CHF' as const,
    category: 'other' as const,
  },
]

export const janic: Persona = {
  id: 'janic',
  name: 'Janic Roth',
  role: '19 · Mediamatiker · war oft im Minus',
  quote: '«Die Ausgaben sind so verdammt stur in einer Liste aufgeführt.»',
  source: 'Interview 04',
  accounts,
  transactions: [
    ...extra,
    ...generateTransactions({
      accountId: PRIVATE,
      currency: 'CHF',
      seed: 4_004,
      fromIso: FROM,
      toIso: TODAY,
      series,
      merchants,
      perWeek: 7,
    }),
  ],
  standingOrders: [],
  pendingOrders: [
    { id: 'j-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Lehmann', amount: -34_500, currency: 'CHF', execution: '2026-08-24' },
  ],
}
