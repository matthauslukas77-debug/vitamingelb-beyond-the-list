import type { Account, Persona, Transaction } from '../types'
import { retoTransactions } from './reto.data'
import { retoBeneficiaries } from './reto.beneficiaries'
import { withJobChange } from './events'

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

/**
 * Ereignisse, die den Signalen zugrunde liegen.
 *
 * Reto, Interview 01: kommt gut durch, hat aber noch nie geplant. Beide
 * Ereignisse sind Momente, in denen sich das entscheidet — der höhere Lohn
 * nach dem Wechsel und der Bonus gehen entweder aufs Sparkonto oder im Monat
 * auf. Genau dort setzt die Aktion «CHF 500 sparen» an.
 *
 * Warum bei ihm ein Jobwechsel: 22, Informatiker. In dieser Branche ist der
 * Wechsel nach zwei Jahren der Normalfall, nicht die Ausnahme.
 */
const events: Transaction[] = [
  {
    id: 'reto-EV-2026-08-bonus',
    accountId: PRIVATE,
    date: '2026-08-14',
    text: 'BONUS / Nordlicht Software AG',
    amount: 80_000,
    currency: 'CHF',
    category: 'income',
  },
]

/** Wechsel per Ende Februar 2026: CHF 4'635 statt CHF 4'215. */
const transactions = [
  ...withJobChange(retoTransactions, {
    since: '2026-02-01',
    match: /^LOHN \/ Arbeitgeber AG$/,
    text: 'LOHN / Nordlicht Software AG',
    amount: 463_500,
    idPrefix: 'reto-EV-lohn',
  }),
  ...events,
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
  transactions,
  beneficiaries: retoBeneficiaries,
  standingOrders: [
    { id: 'f-so-1', accountId: PRIVATE, recipient: 'Sparkonto BKB', amount: -30_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'f-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Dr. Vogt', amount: -18_500, currency: 'CHF', execution: '2026-08-25' },
  ],
}
