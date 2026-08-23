import type { Account, Persona, Transaction } from '../types'
import { liviaTransactions } from './livia.data'
import { liviaBeneficiaries } from './livia.beneficiaries'
import { monthly, withRaise } from './events'

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

/**
 * Ereignisse, die den Signalen zugrunde liegen — siehe `reto.ts` für das Warum.
 *
 * Livia, Interview 05: spart auf 50'000 und rechnet genau. Das Notebook für
 * die Lehre ist eine echte Anschaffung, aber kein Konsummonat — ohne
 * Einordnung stünde ihre Konsumblase den ganzen August auf Rot. Sie ist der
 * zweite Beleg dafür, dass die Einordnung nicht nur Brunos Sonderfall löst.
 */
const events: Transaction[] = [
  {
    id: 'livia-EV-2026-08-notebook',
    accountId: PRIVATE,
    date: '2026-08-07',
    text: 'KAUF/ONLINE-SHOPPING VOM 07.08.2026 KARTEN NR. XXXX9042 MICROSPOT',
    amount: -129_000,
    currency: 'CHF',
    category: 'shopping',
  },
  /*
   * Zwei Buchungen der laufenden Woche.
   *
   * Livias Wochenansicht kannte vier Gegenparteien, davon zweimal
   * Lebensmittel. Schuhe und ein Kaffee sind bei einer 18-Jährigen keine
   * Erfindung — sie machen aus vier Blasen sechs und bringen zwei Marken ins
   * Bild, die die Registry kennt.
   */
  {
    id: 'livia-EV-2026-08-dosenbach',
    accountId: PRIVATE,
    date: '2026-08-18',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 18.08.2026 KARTEN NR. XXXX9042 DOSENBACH KOENIZ (CH)',
    amount: -6_990,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'livia-EV-2026-08-starbucks',
    accountId: PRIVATE,
    date: '2026-08-21',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 21.08.2026 KARTEN NR. XXXX9042 STARBUCKS BERN (CH)',
    amount: -760,
    currency: 'CHF',
    category: 'eatingOut',
  },
]

/**
 * Das Abo, das im Juni dazugekommen ist.
 *
 * Drei Buchungen — und genau darauf kommt es an: `detectRecurring` nimmt ab
 * drei Vorkommen eine Reihe an, und `newSeriesSignals` vergleicht mit dem
 * Stand von Ende Juli. Damals waren es zwei, heute sind es drei. Also ist es
 * heute eine Reihe, die es letzten Monat noch nicht gab — die Signalart, die
 * in keiner anderen Persona vorkam.
 *
 * Warum Babbel: Livia spart auf 50'000 und rechnet genau (Interview 05). Ein
 * Sprachkurs für CHF 12.90 ist die Art Abo, die man abschliesst und dann
 * vergisst — und das ist die Frage, die die Karte stellt.
 */
const newSubscription = monthly({
  idPrefix: 'livia-EV-babbel',
  accountId: PRIVATE,
  text: 'BABBEL GMBH',
  amount: -1_290,
  category: 'subscriptions',
  day: 12,
  from: '2026-06',
  to: '2026-08',
})

export const livia: Persona = {
  id: 'livia',
  name: 'Livia Berger',
  role: 'Lernende bei einer Bank · spart auf 50’000',
  quote: '«500 Franken aufs Sparkonto — dann ist das wie quasi als Ausgabe.»',
  source: 'Interview 05',
  birthYear: 2008,
  address: { street: 'Wachthausgasse 6', place: '3150 Schwarzenburg', country: 'Schweiz' },
  accounts,
  /*
   * Die Lohnerhöhung ins dritte Lehrjahr: CHF 1'380 statt CHF 1'180 ab Juli.
   *
   * Dieselbe Reihe, nur ein anderer Betrag — deshalb `withRaise` und nicht
   * `withJobChange`. Der Motor liest daraus «CHF 200 mehr Lohn» und bietet an,
   * die Differenz beiseitezulegen, bevor sie im Monat aufgeht. Für die Person,
   * die auf 50'000 spart, ist das die Karte mit der grössten Wirkung.
   */
  transactions: [
    ...withRaise(liviaTransactions, {
      since: '2026-07-01',
      match: /^LEHRLINGSLOHN \/ Raiffeisen$/,
      amount: 138_000,
      idPrefix: 'livia-EV-lohn',
    }),
    ...events,
    ...newSubscription,
  ],
  beneficiaries: liviaBeneficiaries,
  standingOrders: [
    { id: 'k-so-1', accountId: PRIVATE, recipient: 'Sparkonto', amount: -50_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [],
}
