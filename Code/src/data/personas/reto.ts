import type { Account, Persona } from '../types'
import { retoTransactions } from './reto.data'
import { retoBeneficiaries } from './reto.beneficiaries'

const PRIVATE = 'reto-private'
const SAVINGS = 'reto-savings-bkb'

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
    iban: 'CH31 0077 0016 0512 3456 7',
    kind: 'savings',
    currency: 'CHF',
    balance: 1_240_000,
    source: { type: 'external', bank: 'BKB' },
  },
]

export const reto: Persona = {
  id: 'reto',
  name: 'Reto Bühler',
  role: '22 · Informatiker · kein Budget, Bauchgefühl',
  quote: '«Ich komme gut durch, aber ich habe einfach noch nie so geplant.»',
  source: 'Interview 01',
  birthYear: 2004,
  address: { street: 'Sulgenauweg 21', place: '3007 Bern', country: 'Schweiz' },
  accounts,
  transactions: retoTransactions,
  beneficiaries: retoBeneficiaries,
  standingOrders: [
    { id: 'f-so-1', accountId: PRIVATE, recipient: 'Sparkonto BKB', amount: -30_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'f-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Dr. Vogt', amount: -18_500, currency: 'CHF', execution: '2026-08-25' },
  ],
}
