import type { Account, Persona, StandingOrder } from '../types'
import { miaTransactions } from './mia.data'

/**
 * Mia Keller — die Persona mit echtem Datenumfang.
 *
 * Anders als fritz/janic/katja/michael sind ihre Buchungen nicht generiert,
 * sondern kommen aus dem synthetischen PostFinance-Template-Datensatz:
 * 2418 echte Buchungen über 24 volle Monate, mit konsistentem Saldo,
 * Fremdwährungen, Reisen und Rückerstattungen.
 *
 * Sie ist der Belastungstest für alles, was wir bauen — Reihenerkennung,
 * Jahresvergleich und Kategorien müssen auch bei diesem Volumen stimmen.
 * Quelle: WORKSPACE/04_experiments/postfinance_template_data/
 */

const PRIVATE = 'mia-private'
const SAVINGS = 'mia-savings'
const CARD = 'mia-card'

const accounts: Account[] = [
  {
    id: PRIVATE,
    name: 'Privatkonto',
    iban: 'CH67 0900 0000 0871 2345 51',
    kind: 'private',
    currency: 'CHF',
    balance: 1_086_817,
    source: { type: 'postfinance' },
  },
  {
    id: SAVINGS,
    name: 'Sparkonto',
    iban: 'CH66 0900 0000 0871 2345 69',
    kind: 'savings',
    currency: 'CHF',
    balance: 1_760_000,
    source: { type: 'postfinance' },
  },
  {
    id: CARD,
    name: 'PostFinance Kreditkarte',
    iban: '550020DEMO0004821',
    kind: 'card',
    currency: 'CHF',
    // Was seit der letzten Monatsrechnung aufgelaufen und noch nicht belastet ist.
    balance: -11_370,
    source: { type: 'postfinance' },
    furtherProduct: true,
  },
]

const standingOrders: StandingOrder[] = [
  { id: 'mia-so-1', accountId: "mia-private", recipient: "Immoverwaltung Bern AG", amount: -165000, currency: 'CHF', nextExecution: '2026-09-01' },
  { id: 'mia-so-2', accountId: "mia-private", recipient: "Sparkonto", amount: -50000, currency: 'CHF', nextExecution: '2026-08-24' },
  { id: 'mia-so-3', accountId: "mia-private", recipient: "Salt Mobile SA", amount: -995, currency: 'CHF', nextExecution: '2026-09-03' },
]

export const mia: Persona = {
  id: 'mia',
  name: 'Mia Keller',
  role: '24 Monate Kontodaten · 2418 Buchungen',
  quote: '«Der Belastungstest: zwei Jahre echter Datenumfang statt sechs Monate Demo.»',
  source: 'PostFinance-Template-Datensatz (synthetisch)',
  accounts,
  transactions: miaTransactions,
  standingOrders,
  pendingOrders: [],
}
