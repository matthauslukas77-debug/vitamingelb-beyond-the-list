import { generateTransactions, type Merchant, type Series } from '../generate'
import type { Account, Persona } from '../types'
import { TODAY } from '../types'

const PRIVATE = 'fritz-private'
const SAVINGS = 'fritz-savings-bkb'
const FROM = '2025-08-01'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH63 0900 0000 2500 9779 8',
    kind: 'private',
    currency: 'CHF',
    balance: 284_050,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH21 0077 0016 0512 3456 7',
    kind: 'savings',
    currency: 'CHF',
    balance: 1_240_000,
    source: { type: 'external', bank: 'BKB' },
  },
]

/** Fritz: «Abos? Tonnenweise.» — rund CHF 300 im Monat, eines davon still teurer geworden. */
const series: Series[] = [
  { id: 'f-salary', text: 'LOHN AUGUST / Arbeitgeber AG', category: 'income', amount: 421_500, dayOfMonth: 25 },
  { id: 'f-rent', text: 'MIETZINS / Verwaltung Iseli', category: 'housing', amount: -95_000, dayOfMonth: 1 },
  { id: 'f-health', text: 'KRANKENKASSE PRAEMIE', category: 'insurance', amount: -31_040, dayOfMonth: 5 },
  {
    id: 'f-adobe',
    text: 'ADOBE *CREATIVE CLOUD',
    category: 'subscriptions',
    amount: -7_190,
    dayOfMonth: 14,
    // Die schleichende Erhöhung — im Interview beschrieben, hier im Datensatz angelegt.
    raise: { fromIso: '2026-03-01', amount: -7_990 },
  },
  { id: 'f-openai', text: 'OPENAI *CHATGPT SUBSCR', category: 'subscriptions', amount: -2_300, dayOfMonth: 9 },
  { id: 'f-spotify', text: 'SPOTIFY AB', category: 'subscriptions', amount: -1_295, dayOfMonth: 17 },
  { id: 'f-mobile', text: 'SALT MOBILE SA', category: 'subscriptions', amount: -5_900, dayOfMonth: 3 },
  { id: 'f-icloud', text: 'APPLE.COM/BILL ITUNES.COM', category: 'subscriptions', amount: -490, dayOfMonth: 11 },
  { id: 'f-gym', text: 'ACTIV FITNESS BERN', category: 'leisure', amount: -8_900, dayOfMonth: 2 },
  { id: 'f-savings', text: 'SPARAUFTRAG', category: 'transfer', amount: -30_000, dayOfMonth: 26, counterAccountId: SAVINGS },
]

const merchants: Merchant[] = [
  { name: 'COOP-2504 BERN BAHNHOF', kind: 'pos', applePay: true, category: 'groceries', min: 1240, max: 6800, brand: { bg: '#FFFFFF', fg: '#E2001A', short: 'coop' } },
  { name: 'MIGROS M BERN WANKDORF', kind: 'pos', applePay: true, category: 'groceries', min: 980, max: 5400, brand: { bg: '#FF6600', fg: '#FFFFFF', short: 'M' } },
  { name: 'SIX Payment 88214 / BERN', kind: 'service', category: 'eatingOut', min: 1450, max: 3900 },
  { name: 'TWINT ACQ / Kebap Haus', kind: 'service', category: 'eatingOut', min: 1200, max: 2800, brand: { bg: '#000000', fg: '#FFFFFF', short: 'tw' } },
  { name: 'DIGITEC GALAXUS AG', kind: 'online', category: 'shopping', min: 4900, max: 68000, brand: { bg: '#0E1A24', fg: '#FFFFFF', short: 'd' } },
  { name: 'PAYPAL *STEAM GAMES', kind: 'online', category: 'leisure', min: 1900, max: 7900, brand: { bg: '#003087', fg: '#FFFFFF', short: 'PP' } },
  { name: 'SBB CFF FFS Mobile Tic', kind: 'service', applePay: true, category: 'transport', min: 480, max: 4600, brand: { bg: '#EB0000', fg: '#FFFFFF', short: '✚' } },
  { name: 'APPLE.COM/BILL', kind: 'online', category: 'subscriptions', min: 490, max: 2900, brand: { bg: '#111111', fg: '#FFFFFF', short: '' } },
]

export const fritz: Persona = {
  id: 'fritz',
  name: 'Fritz Wolmert',
  role: '22 · Informatiker · kein Budget, Bauchgefühl',
  quote: '«Ich komme gut durch, aber ich habe einfach noch nie so geplant.»',
  source: 'Interview 01',
  accounts,
  transactions: generateTransactions({
    accountId: PRIVATE,
    currency: 'CHF',
    seed: 1_001,
    fromIso: FROM,
    toIso: TODAY,
    series,
    merchants,
    perWeek: 6,
  }),
  standingOrders: [
    { id: 'f-so-1', accountId: PRIVATE, recipient: 'Sparkonto BKB', amount: -30_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'f-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Dr. Vogt', amount: -18_500, currency: 'CHF', execution: '2026-08-25' },
  ],
}
