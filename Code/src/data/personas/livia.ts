import type { Account, Persona, Transaction } from '../types'
import { liviaTransactions } from './livia.data'
import { liviaBeneficiaries } from './livia.beneficiaries'
import { monthly, withRaise, withVariants } from './events'

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
    /* CHF 1'490, nicht 1'290: Die Ausreisser-Erkennung schlägt ab dem
       Doppelten des Kategorienbudgets an, und ihr Konsumbudget ist mit den
       neuen Buchungen gewachsen. Bei 1'290 fiel die Karte «CHF 1'290 sprengen
       Konsum und Freizeit» knapp unter die Schwelle — dabei ist genau sie der
       Anlass, das Notebook als ausserordentlich einzuordnen. */
    text: 'KAUF/ONLINE-SHOPPING VOM 07.08.2026 KARTEN NR. XXXX9042 MICROSPOT',
    amount: -149_000,
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

/**
 * Die Haftpflicht — die einzige Rechnung, die auch bei ihr kommt.
 *
 * Steuern zahlt eine Lernende mit CHF 1'380 im Monat keine; ihre
 * Steuerkategorie bleibt deshalb bewusst leer, und das ist kein Loch im Bild,
 * sondern ihr Bild. Eine Privathaftpflicht dagegen hat in der Schweiz fast
 * jede und jeder — CHF 145 im Jahr, einmal im Januar abgebucht. Die Ableitung
 * legt sie auf CHF 12 im Monat um und füllt damit die vierte ihrer sechs
 * Kategorien.
 */
const bills: Transaction[] = [
  {
    id: 'livia-EV-2026-01-haftpflicht',
    accountId: PRIVATE,
    date: '2026-01-20',
    text: 'DIE MOBILIAR / HAFTPFLICHT UND HAUSRAT',
    amount: -14_500,
    currency: 'CHF',
    category: 'insurance',
  },
]

/**
 * Zwei Quellen fürs Zuordnungsbrett.
 *
 * Das Möbelhaus ist der Fall aus dem Regelwerk — beim Eigentümer Unterhalt,
 * beim Mieter Konsum, und bei einer 18-Jährigen im Elternhaus weiss das
 * niemand ausser ihr. Hinter PayPal steht ein Laden, den die Buchung nicht
 * nennt.
 */
const board: Transaction[] = [
  {
    id: 'livia-EV-2026-06-ikea',
    accountId: PRIVATE,
    date: '2026-06-27',
    text: 'KAUF/DIENSTLEISTUNG VOM 27.06.2026 KARTEN NR. XXXX9042 IKEA LYSSACH (CH)',
    amount: -16_500,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'livia-EV-2026-05-paypal',
    accountId: PRIVATE,
    date: '2026-05-09',
    text: 'KAUF/ONLINE-SHOPPING VOM 09.05.2026 KARTEN NR. XXXX9042 PAYPAL EUROPE S.A.R.L.',
    amount: -6_490,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'livia-EV-2026-07-paypal',
    accountId: PRIVATE,
    date: '2026-07-11',
    text: 'KAUF/ONLINE-SHOPPING VOM 11.07.2026 KARTEN NR. XXXX9042 PAYPAL EUROPE S.A.R.L.',
    amount: -4_750,
    currency: 'CHF',
    category: 'shopping',
  },
]

/*
 * 18 Buchungen am selben Terminal in Bern — der Klumpen ist bei ihr der
 * kleinste, aber dieselbe Sache: Aus «Six Payment 33071» werden die Läden,
 * bei denen eine Lernende in der Mittagspause wirklich steht. Jede vierte
 * bleibt anonym.
 */
const withShopsNamed = withVariants(liviaTransactions, {
  match: /SIX PAYMENT 33071 BERN/,
  text: (merchant, date) =>
    `KAUF/DIENSTLEISTUNG VOM ${date} KARTEN NR. XXXX9042 ${merchant} (CH)`,
  variants: [
    { merchant: 'BREZELKOENIG BERN' },
    { merchant: 'STARBUCKS BERN' },
    { merchant: 'COOP PRONTO BERN', category: 'groceries' },
    { merchant: 'BAECKEREI ZBINDEN BERN' },
  ],
  keepEvery: 4,
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
    ...withRaise(withShopsNamed, {
      since: '2026-07-01',
      match: /^LEHRLINGSLOHN \/ Raiffeisen$/,
      amount: 138_000,
      idPrefix: 'livia-EV-lohn',
    }),
    ...events,
    ...bills,
    ...board,
    ...newSubscription,
  ],
  beneficiaries: liviaBeneficiaries,
  standingOrders: [
    { id: 'k-so-1', accountId: PRIVATE, recipient: 'Sparkonto', amount: -50_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [],
}
