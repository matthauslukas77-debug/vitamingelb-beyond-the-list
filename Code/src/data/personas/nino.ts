import type { Account, Persona } from '../types'
import { ninoTransactions } from './nino.data'
import { ninoBeneficiaries } from './nino.beneficiaries'

const PRIVATE = 'nino-private'
const CUSTODY = 'nino-custody'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH61 0900 0000 3100 7788 1',
    kind: 'youth',
    currency: 'CHF',
    // Knapp — Nino war «wirklich viel im Minus» (Interview 04).
    balance: 4_270,
    source: { type: 'postfinance' },
  },
  {
    id: CUSTODY,
    name: 'Wertschriftendepot',
    iban: 'CH34 0483 5099 1234 5678 9',
    kind: 'custody',
    currency: 'CHF',
    balance: 312_400,
    source: { type: 'external', bank: 'Capital' },
    furtherProduct: true,
  },
]

export const nino: Persona = {
  id: 'nino',
  name: 'Nino Roth',
  role: '19 · Mediamatiker · war oft im Minus',
  quote: '«Die Ausgaben sind so verdammt stur in einer Liste aufgeführt.»',
  source: 'Interview 04',
  birthYear: 2007,
  address: { street: 'Länggassstrasse 63', place: '3012 Bern', country: 'Schweiz' },
  accounts,
  transactions: ninoTransactions,
  beneficiaries: ninoBeneficiaries,
  standingOrders: [],
  pendingOrders: [
    { id: 'j-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Lehmann', amount: -34_500, currency: 'CHF', execution: '2026-08-24' },
  ],
}
