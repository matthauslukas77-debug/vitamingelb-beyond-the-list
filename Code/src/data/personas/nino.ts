import { TODAY, type Account, type Persona, type Transaction } from '../types'
import { ninoTransactions } from './nino.data'
import { ninoBeneficiaries } from './nino.beneficiaries'
import {
  withJobChange,
  withoutBookings,
  withRenamed,
  withShiftedDay,
  withVariants,
} from './events'

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
 * Nino, Interview 04: war oft im Minus. Zwei Dinge, die dazu gehören.
 *
 * Das Abo, das sich im Juli eingeschlichen hat, ist bei ihm kein Randfall,
 * sondern der Anfang des Problems. Zwei Buchungen sind kein Muster — die App
 * fragt deshalb, statt zu behaupten.
 *
 * Der Jobwechsel im Mai bringt CHF 260 mehr. Bei einem Konto, das dreimal im
 * Soll war, ist das der Unterschied zwischen knapp und nicht knapp — und
 * genau die Art Veränderung, die man selbst nicht bemerkt, weil der Lohn ja
 * weiterhin einfach kommt.
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
  /*
   * Der Sollzins im laufenden Monat — das dritte Mal in einem Jahr.
   *
   * Er steht hier und nicht in den generierten Daten, weil er zur selben
   * Geschichte gehört wie die ausgebliebene Lastschrift zwei Tage vorher: Bei
   * CHF 42.70 auf dem Konto ist beides dieselbe Ursache. Nino im Interview 04:
   * «Ich war wirklich viel im Minus.»
   */
  {
    id: 'nino-EV-2026-08-sollzins',
    accountId: PRIVATE,
    date: '2026-08-19',
    text: 'SOLLZINS KONTOUEBERZUG',
    amount: -1_420,
    currency: 'CHF',
    category: 'other',
  },
]

/**
 * Steuern und Haftpflicht — auch bei ihm, nur klein.
 *
 * Ein 19-Jähriger mit CHF 2'640 netto zahlt Steuern, aber wenig: zwei
 * Schlussrechnungen über zwei Jahre ergeben geglättet CHF 75 im Monat. Das
 * füllt die Kategorie, lässt die App seinen Steuerkanton erkennen — und kippt
 * seinen Monat ins Minus. Genau dort steht er: Nach Budget blieben ihm bisher
 * CHF 37, mit der Steuerrate sind es minus 38. Der Kontostand von CHF 42.70
 * ist die Folge davon, und jetzt rechnet sie sich auch nach.
 */
const bills: Transaction[] = [
  {
    id: 'nino-EV-2025-03-steuern',
    accountId: PRIVATE,
    date: '2025-03-20',
    text: 'STEUERVERWALTUNG KT. BERN / SCHLUSSRECHNUNG 2024',
    amount: -78_000,
    currency: 'CHF',
    category: 'taxes',
  },
  {
    id: 'nino-EV-2026-03-steuern',
    accountId: PRIVATE,
    date: '2026-03-18',
    text: 'STEUERVERWALTUNG KT. BERN / SCHLUSSRECHNUNG 2025',
    amount: -94_500,
    currency: 'CHF',
    category: 'taxes',
  },
  {
    id: 'nino-EV-2026-02-haftpflicht',
    accountId: PRIVATE,
    date: '2026-02-10',
    text: 'ZURICH VERSICHERUNG / HAFTPFLICHT',
    amount: -16_800,
    currency: 'CHF',
    category: 'insurance',
  },
]

/**
 * Drei Quellen fürs Zuordnungsbrett.
 *
 * Hinter PayPal steht ein Laden, den die Buchung nicht nennt; das Studio kennt
 * das Regelwerk nicht. Beides kann nur er beantworten — und beides zusammen
 * macht aus einem Brett mit einem einzigen Eintrag eines mit dreien.
 */
const board: Transaction[] = [
  {
    id: 'nino-EV-2026-06-paypal',
    accountId: PRIVATE,
    date: '2026-06-03',
    text: 'KAUF/ONLINE-SHOPPING VOM 03.06.2026 KARTEN NR. XXXX2264 PAYPAL EUROPE S.A.R.L.',
    amount: -6_850,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'nino-EV-2026-07-paypal',
    accountId: PRIVATE,
    date: '2026-07-22',
    text: 'KAUF/ONLINE-SHOPPING VOM 22.07.2026 KARTEN NR. XXXX2264 PAYPAL EUROPE S.A.R.L.',
    amount: -5_490,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'nino-EV-2026-05-studio',
    accountId: PRIVATE,
    date: '2026-05-16',
    text: 'TWINT KAUF/DIENSTLEISTUNG VOM 16.05.2026 STUDIO NORD TATTOO BERN (CH)',
    amount: -18_000,
    currency: 'CHF',
    category: 'other',
  },
]

/**
 * Wechsel per Ende Mai 2026: CHF 2'640 statt CHF 2'380.
 *
 * Drei weitere Eingriffe, alle aus derselben Geschichte:
 *
 *   **Die Kasse heisst Atupri.** Der Generator schreibt «KRANKENKASSE
 *   PRAEMIE»; ein LSV-Auszug nennt sie. Atupri sitzt in Bern — bei einem
 *   19-Jährigen aus der Länggasse ist das die naheliegende Kasse.
 *
 *   **Der Beitrag fürs Gym ist im August nicht abgebucht worden.** Bei CHF
 *   42.70 auf dem Konto ist das kein Zufall, sondern die Folge: Die
 *   Lastschrift ist mangels Deckung zurückgegangen. Der Motor erkennt sie als
 *   ausgeblieben (`missedSignals`) und fragt nach — die einzige Signalart, die
 *   sonst in keiner Persona vorkam.
 *
 *   **Das Handyabo liegt auf dem 27.** Vorher lagen alle seine Reihen am
 *   Monatsanfang, und die Karte «was bis Ende Monat noch abgeht» zeigte am 22.
 *   eine Null. Jetzt zeigt sie, was sie zeigen soll: die Belastung, die noch
 *   kommt, wenn ohnehin nichts mehr da ist.
 *
 * Nacheinander statt ineinander: Bei vier Eingriffen liest in einer
 * Verschachtelung niemand mehr, was zuerst passiert.
 */
const afterJobChange = withJobChange(ninoTransactions, {
  since: '2026-05-01',
  match: /^LOHN \/ Agentur Meridian AG$/,
  text: 'LOHN / Studio Kreis GmbH',
  amount: 264_000,
  idPrefix: 'nino-EV-lohn',
})

const withInsurerNamed = withRenamed(afterJobChange, {
  match: /^KRANKENKASSE PRAEMIE$/,
  text: 'ATUPRI GESUNDHEITSVERSICHERUNG / PRAEMIE',
})

const withoutGymInAugust = withoutBookings(withInsurerNamed, {
  match: /^MMA GYM BERN/,
  from: '2026-08-01',
})

const withMobileLate = withShiftedDay(withoutGymInAugust, {
  match: /^SUNRISE GMBH$/,
  day: 27,
  today: TODAY,
})

/*
 * 41 Buchungen am selben Terminal — bei ihm der grösste Klumpen von allen.
 * Sie wurden zu einer Blase «Six Payment 21903 Bern», die nichts sagt. Jede
 * vierte bleibt anonym: So sieht ein Kartenauszug wirklich aus.
 */
const withShopsNamed = withVariants(withMobileLate, {
  match: /SIX PAYMENT 21903 BERN/,
  text: (merchant, date) =>
    `KAUF/DIENSTLEISTUNG VOM ${date} KARTEN NR. XXXX2264 ${merchant} (CH)`,
  variants: [
    { merchant: 'RICE UP BERN' },
    { merchant: 'BREZELKOENIG BERN' },
    { merchant: 'MCDONALDS BERN' },
    { merchant: 'K KIOSK BERN BAHNHOF' },
    { merchant: 'TAKEAWAY SUSHI BERN' },
  ],
  keepEvery: 4,
})

const transactions = [...withShopsNamed, ...events, ...bills, ...board]

export const nino: Persona = {
  id: 'nino',
  name: 'Nino Roth',
  role: '19 · Mediamatiker · war oft im Minus',
  quote: '«Die Ausgaben sind so verdammt stur in einer Liste aufgeführt.»',
  source: 'Interview 04',
  birthYear: 2007,
  address: { street: 'Länggassstrasse 63', place: '3012 Bern', country: 'Schweiz' },
  accounts,
  transactions,
  beneficiaries: ninoBeneficiaries,
  standingOrders: [],
  pendingOrders: [
    { id: 'j-po-1', accountId: PRIVATE, recipient: 'Zahnarztpraxis Lehmann', amount: -34_500, currency: 'CHF', execution: '2026-08-24' },
  ],
}
