import type { Account, Persona, Transaction } from '../types'
import { brunoTransactions } from './bruno.data'
import { brunoBeneficiaries } from './bruno.beneficiaries'
import { withRenamed, withVariants } from './events'

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

/**
 * Ereignisse, die den Signalen zugrunde liegen — siehe `reto.ts` für das Warum.
 *
 * Bruno, Interview 07: 59, angestellt bei einer kantonalen Organisation, sechs
 * Bankbeziehungen. Bei ihm ist der dreizehnte Monatslohn keine Überraschung,
 * sondern ein Termin — er kommt jeden Dezember, und er ist der grösste
 * einzelne Geldeingang des Jahres.
 *
 * Zweimal im Datensatz, Dezember 2024 und Dezember 2025. Damit ist es ein
 * Muster über zwei Jahre und keine Einzelbuchung — die App kann daraus sagen,
 * wann er wiederkommt, statt ihn nur im Rückblick zu erwähnen.
 */
const events: Transaction[] = [
  {
    id: 'bruno-EV-2024-12-13ter',
    accountId: PRIVATE,
    date: '2024-12-20',
    text: '13. MONATSLOHN / Kantonale Organisation',
    amount: 862_000,
    currency: 'CHF',
    category: 'income',
  },
  {
    id: 'bruno-EV-2025-12-13ter',
    accountId: PRIVATE,
    date: '2025-12-19',
    text: '13. MONATSLOHN / Kantonale Organisation',
    amount: 862_000,
    currency: 'CHF',
    category: 'income',
  },
  /*
   * Drei Buchungen der laufenden Woche.
   *
   * Bruno kaufte in der Woche fünfmal Lebensmittel und sonst nichts — das
   * Blasenfeld zeigte im Zeitraum «Woche» fünf Kreise, drei davon Coop und
   * Migros. Discounter, Baumarkt und Apotheke gehören bei einem
   * Hauseigentümer in Nidau dazu, und der LANDI-Einkauf ist zugleich der Fall,
   * an dem das Zuordnungsbrett seinen Sinn zeigt: Beim Eigentümer ist das
   * Unterhalt, beim Mieter Konsum — das kann nur er beantworten.
   */
  {
    id: 'bruno-EV-2026-08-denner',
    accountId: PRIVATE,
    date: '2026-08-18',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 18.08.2026 KARTEN NR. XXXX4417 DENNER NIDAU (CH)',
    amount: -4_215,
    currency: 'CHF',
    category: 'groceries',
  },
  {
    id: 'bruno-EV-2026-08-landi',
    accountId: PRIVATE,
    date: '2026-08-20',
    text: 'KAUF/DIENSTLEISTUNG VOM 20.08.2026 KARTEN NR. XXXX4417 LANDI BIEL (CH)',
    amount: -8_640,
    currency: 'CHF',
    category: 'other',
  },
  {
    id: 'bruno-EV-2026-08-vitality',
    accountId: PRIVATE,
    date: '2026-08-21',
    text: 'KAUF/DIENSTLEISTUNG VOM 21.08.2026 KARTEN NR. XXXX4417 COOP VITALITY APOTHEKE BIEL (CH)',
    amount: -5_380,
    currency: 'CHF',
    category: 'health',
  },
]

/*
 * Die Kasse beim Namen: Bruno und seine Frau sind bei der Visana, einer Berner
 * Kasse — «2 Personen» stand schon im Buchungstext, nur der Name der Kasse
 * fehlte. Damit trägt die drittgrösste Blase des Jahres ein Logo.
 */
const withInsurerNamed = withRenamed(brunoTransactions, {
  match: /^KRANKENKASSE PRAEMIE 2P$/,
  text: 'VISANA AG / PRAEMIE 2 PERSONEN',
})

/*
 * 27 Buchungen am Terminal in Biel. Bei Bruno ist der Klumpen besonders
 * schief: Er stand als «Six Payment 55210 Biel» im Blasenfeld neben Coop und
 * Migros, als wäre er ein Laden. Jede vierte bleibt anonym — er zahlt viel mit
 * Karte, und dass der Auszug den Laden verschweigt, ist sein Alltag.
 */
const withShopsNamed = withVariants(withInsurerNamed, {
  match: /SIX PAYMENT 55210 BIEL/,
  text: (merchant, date) =>
    `KAUF/DIENSTLEISTUNG VOM ${date} KARTEN NR. XXXX4417 ${merchant} (CH)`,
  variants: [
    { merchant: 'RESTAURANT SEELAND NIDAU' },
    { merchant: 'COOP PRONTO BIEL', category: 'groceries' },
    { merchant: 'MCDONALDS BIEL' },
    { merchant: 'BAECKEREI GLATZ BIEL' },
  ],
  keepEvery: 4,
})

export const bruno: Persona = {
  id: 'bruno',
  name: 'Bruno Aebischer',
  role: '59 · angestellt · sechs Bankbeziehungen',
  quote: '«Vom Verhältnis her sind die schönen Charts dann ein bisschen misleading.»',
  source: 'Interview 07',
  birthYear: 1967,
  address: { street: 'Mettstrasse 88', place: '2504 Biel/Bienne', country: 'Schweiz' },
  accounts,
  transactions: [...withShopsNamed, ...events],
  beneficiaries: brunoBeneficiaries,
  standingOrders: [
    { id: 'm-so-1', accountId: PRIVATE, recipient: 'Vorsorgekonto 3a', amount: -60_000, currency: 'CHF', nextExecution: '2026-08-26' },
  ],
  pendingOrders: [
    { id: 'm-po-1', accountId: PRIVATE, recipient: 'Zahnarzt Dr. med. dent. Reber', amount: -42_000, currency: 'CHF', execution: '2026-08-25' },
    { id: 'm-po-2', accountId: PRIVATE, recipient: 'IG Heizung Nachbarschaft', amount: -80_000, currency: 'CHF', execution: '2026-09-01' },
  ],
}
