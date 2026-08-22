import type { Account, Persona } from '../types'
import { janicTransactions } from './janic.data'

const PRIVATE = 'janic-private'
const CUSTODY = 'janic-custody'

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

export const janic: Persona = {
  id: 'janic',
  name: 'Janic Roth',
  role: '19 · Mediamatiker · war oft im Minus',
  quote: '«Die Ausgaben sind so verdammt stur in einer Liste aufgeführt.»',
  source: 'Interview 04',
  accounts,
  transactions: janicTransactions,
  standingOrders: [],
  pendingOrders: [
    { id: 'j-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Lehmann', amount: -34_500, currency: 'CHF', execution: '2026-08-24' },
  ],
}
