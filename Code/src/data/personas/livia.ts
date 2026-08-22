import type { Account, Persona } from '../types'
import { liviaTransactions } from './livia.data'
import { liviaBeneficiaries } from './livia.beneficiaries'

const PRIVATE = 'livia-private'
const SAVINGS = 'livia-savings'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH49 0900 0000 1600 4412 3',
    kind: 'youth',
    currency: 'CHF',
    balance: 142_380,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH22 0900 0000 1600 4412 4',
    kind: 'savings',
    currency: 'CHF',
    // Ziel: 50'000 bis Lehrende — siehe Interview 05.
    balance: 1_845_000,
    source: { type: 'postfinance' },
  },
]

export const livia: Persona = {
  id: 'livia',
  name: 'Livia Berger',
  role: 'Lernende bei einer Bank · spart auf 50’000',
  quote: '«500 Franken aufs Sparkonto — dann ist das wie quasi als Ausgabe.»',
  source: 'Interview 05',
  birthYear: 2008,
  address: { street: 'Wachthausgasse 6', place: '3150 Schwarzenburg', country: 'Schweiz' },
  accounts,
  transactions: liviaTransactions,
  beneficiaries: liviaBeneficiaries,
  standingOrders: [
    { id: 'k-so-1', accountId: PRIVATE, recipient: 'Sparkonto', amount: -50_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [],
}
