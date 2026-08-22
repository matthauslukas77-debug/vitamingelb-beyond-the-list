import type { Account, Persona } from '../types'
import { brunoTransactions } from './bruno.data'
import { brunoBeneficiaries } from './bruno.beneficiaries'

const PRIVATE = 'bruno-private'
const SAVINGS = 'bruno-savings'
const VALIANT = 'bruno-valiant'
const PILLAR3A = 'bruno-3a'
const MORTGAGE = 'bruno-mortgage'

/** Bruno: «sehr verteilt» — sechs Beziehungen über mehrere Institute (Interview 07). */
const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH17 0900 0000 3040 1122 6',
    kind: 'private',
    currency: 'CHF',
    balance: 1_284_600,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH87 0900 0000 3040 1122 7',
    kind: 'savings',
    currency: 'CHF',
    balance: 4_120_000,
    source: { type: 'postfinance' },
  },
  {
    id: VALIANT,
    name: 'Privatkonto',
    iban: 'CH66 0630 0016 1234 5678 9',
    kind: 'private',
    currency: 'CHF',
    balance: 862_300,
    source: { type: 'external', bank: 'Valiant' },
  },
  {
    id: PILLAR3A,
    name: 'Vorsorgekonto 3a',
    iban: 'CH98 0900 0000 3040 9988 1',
    kind: 'retirement3a',
    currency: 'CHF',
    balance: 7_240_000,
    source: { type: 'postfinance' },
    furtherProduct: true,
  },
  {
    id: MORTGAGE,
    name: 'Hypothek',
    iban: 'CH95 0630 0016 9911 2233 4',
    kind: 'loan',
    currency: 'CHF',
    balance: -42_000_000,
    source: { type: 'external', bank: 'Valiant' },
    furtherProduct: true,
  },
]

export const bruno: Persona = {
  id: 'bruno',
  name: 'Bruno Aebischer',
  role: '59 · angestellt · sechs Bankbeziehungen',
  quote: '«Vom Verhältnis her sind die schönen Charts dann ein bisschen misleading.»',
  source: 'Interview 07',
  address: { street: 'Mettstrasse 88', place: '2504 Biel/Bienne', country: 'Schweiz' },
  accounts,
  transactions: brunoTransactions,
  beneficiaries: brunoBeneficiaries,
  standingOrders: [
    { id: 'm-so-1', accountId: PRIVATE, recipient: 'Vorsorgekonto 3a', amount: -60_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'm-po-1', accountId: PRIVATE, recipient: 'Zahnarzt Dr. med. dent. Reber', amount: -42_000, currency: 'CHF', execution: '2026-08-25' },
    { id: 'm-po-2', accountId: PRIVATE, recipient: 'IG Heizung Nachbarschaft', amount: -80_000, currency: 'CHF', execution: '2026-09-01' },
  ],
}
