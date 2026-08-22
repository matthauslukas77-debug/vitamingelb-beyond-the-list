import type { Account, Persona, Transaction } from '../types'
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

/**
 * Ereignisse, die den Signalen zugrunde liegen — siehe `reto.ts` für das Warum.
 *
 * Nino, Interview 04: war oft im Minus. Ein Abo, das sich im Juli
 * eingeschlichen hat, ist bei ihm kein Randfall, sondern der Anfang des
 * Problems. Zwei Buchungen sind kein Muster — die App fragt deshalb, statt zu
 * behaupten.
 */
const events: Transaction[] = [
  {
    id: 'nino-EV-2026-07-abo',
    accountId: PRIVATE,
    date: '2026-07-11',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 11.07.2026 KARTEN NR. XXXX2264 CRUNCHYROLL',
    amount: -2_490,
    currency: 'CHF',
    category: 'subscriptions',
  },
  {
    id: 'nino-EV-2026-08-abo',
    accountId: PRIVATE,
    date: '2026-08-11',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 11.08.2026 KARTEN NR. XXXX2264 CRUNCHYROLL',
    amount: -2_490,
    currency: 'CHF',
    category: 'subscriptions',
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
  transactions: [...ninoTransactions, ...events],
  beneficiaries: ninoBeneficiaries,
  standingOrders: [],
  pendingOrders: [
    { id: 'j-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Lehmann', amount: -34_500, currency: 'CHF', execution: '2026-08-24' },
  ],
}
