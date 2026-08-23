import type { Account, Persona, Transaction } from '../types'
import { retoTransactions } from './reto.data'
import { retoBeneficiaries } from './reto.beneficiaries'
import { withJobChange, withRenamed, withVariants } from './events'

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

/**
 * Was jede Person zahlt und der Generator nicht kennt: die Steuern.
 *
 * Ohne sie steht die grösste seiner sechs Budgetkategorien auf null — bei
 * einem Informatiker mit CHF 4'635 netto ist das keine Lücke im Bild, sondern
 * ein falsches Bild. Der Rhythmus ist der schweizerische: Akonto im November,
 * Schlussrechnung im März der Folgeperiode. `deriveBudget` glättet Steuern
 * über die volle Historie, weil sie der Steuerperiode folgen und nicht dem
 * Budgetjahr — vier Raten über zwei Jahre ergeben rund CHF 300 im Monat.
 *
 * Die Summe ist mit Absicht so gewählt, dass sein Bild aufgeht: Einnahmen
 * minus Budget liegt danach knapp über dem, was per Dauerauftrag aufs
 * Sparkonto geht. Reto «kommt gut durch» — das soll die Zahl auch zeigen, und
 * der Ausblick lebt von genau dieser kleinen Lücke zwischen dem, was übrig
 * bleibt, und dem, was er wirklich zurücklegt.
 *
 * **Keine Haftpflicht.** Sie stand hier und ist wieder gegangen: Mit CHF 22 im
 * Monat in der Kategorie «Versicherungen und Vorsorgen» wechselt der
 * Budgetrechner vom Tipp «keine private Vorsorge erkannt» zu «Vorsorge
 * ausbaufähig» (`bottomTip` in `pf-model.ts`). Der erste ist für einen
 * 22-Jährigen ohne Säule 3a die stärkere Aussage — und Reto ist die einzige
 * Persona, die ihn auslösen kann.
 *
 * Nebenbei erkennt die App an den Steuern seinen Kanton: «BE, erkannt aus
 * deiner Steuerbuchung» stand vorher nur bei Bruno.
 */
const bills: Transaction[] = [
  {
    id: 'reto-EV-2024-11-steuern',
    accountId: PRIVATE,
    date: '2024-11-27',
    text: 'STEUERVERWALTUNG KT. BERN / AKONTO 2024',
    amount: -182_000,
    currency: 'CHF',
    category: 'taxes',
  },
  {
    id: 'reto-EV-2025-03-steuern',
    accountId: PRIVATE,
    date: '2025-03-14',
    text: 'STEUERVERWALTUNG KT. BERN / SCHLUSSRECHNUNG 2024',
    amount: -190_000,
    currency: 'CHF',
    category: 'taxes',
  },
  {
    id: 'reto-EV-2025-11-steuern',
    accountId: PRIVATE,
    date: '2025-11-26',
    text: 'STEUERVERWALTUNG KT. BERN / AKONTO 2025',
    amount: -190_000,
    currency: 'CHF',
    category: 'taxes',
  },
  {
    id: 'reto-EV-2026-03-steuern',
    accountId: PRIVATE,
    date: '2026-03-16',
    text: 'STEUERVERWALTUNG KT. BERN / SCHLUSSRECHNUNG 2025',
    amount: -193_000,
    currency: 'CHF',
    category: 'taxes',
  },
]

/**
 * Drei Quellen, die nur er selbst zuordnen kann.
 *
 * Das Zuordnungsbrett kannte bei ihm genau einen Eintrag — «Bargeld» — und
 * damit war die Funktion, die eine Antwort pro *Quelle* statt pro *Buchung*
 * verlangt, nicht vorführbar. Beide Fälle hier stehen so in `mapping.ts`:
 * Ein Baumarkt ist beim Eigentümer Unterhalt und beim Mieter Konsum, und
 * hinter PayPal steht ein Laden, den die Buchung nicht nennt.
 */
const board: Transaction[] = [
  {
    id: 'reto-EV-2026-06-jumbo',
    accountId: PRIVATE,
    date: '2026-06-12',
    text: 'KAUF/DIENSTLEISTUNG VOM 12.06.2026 KARTEN NR. XXXX7731 JUMBO BERN (CH)',
    amount: -12_840,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'reto-EV-2026-05-paypal',
    accountId: PRIVATE,
    date: '2026-05-21',
    text: 'KAUF/ONLINE-SHOPPING VOM 21.05.2026 KARTEN NR. XXXX7731 PAYPAL EUROPE S.A.R.L.',
    amount: -6_450,
    currency: 'CHF',
    category: 'shopping',
  },
  {
    id: 'reto-EV-2026-07-paypal',
    accountId: PRIVATE,
    date: '2026-07-08',
    text: 'KAUF/ONLINE-SHOPPING VOM 08.07.2026 KARTEN NR. XXXX7731 PAYPAL EUROPE S.A.R.L.',
    amount: -4_990,
    currency: 'CHF',
    category: 'shopping',
  },
]

/**
 * Die letzten Tage — Vielfalt statt Menge.
 *
 * Reto hat in der laufenden Woche zwölf Buchungen, aber nur fünf
 * Gegenparteien: fünfmal Migros, dazu Publibike, k kiosk, SBB, Spotify. Das
 * Blasenfeld im Zeitraum «Woche» zeigt entsprechend fünf Kreise. Diese drei
 * Buchungen sind kein Füllmaterial: Sie bringen drei Branchen ins Bild, die es
 * bei ihm wirklich gibt — auswärts essen, Apotheke, Sport — und geben der
 * Wochenansicht damit dieselbe Aussagekraft wie der Monatsansicht.
 */
const recentDays: Transaction[] = [
  {
    id: 'reto-EV-2026-08-tibits',
    accountId: PRIVATE,
    date: '2026-08-18',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 18.08.2026 KARTEN NR. XXXX7731 TIBITS BERN (CH)',
    amount: -2_680,
    currency: 'CHF',
    category: 'eatingOut',
  },
  {
    id: 'reto-EV-2026-08-amavita',
    accountId: PRIVATE,
    date: '2026-08-20',
    text: 'KAUF/DIENSTLEISTUNG VOM 20.08.2026 KARTEN NR. XXXX7731 AMAVITA APOTHEKE BERN (CH)',
    amount: -3_450,
    currency: 'CHF',
    category: 'health',
  },
  {
    id: 'reto-EV-2026-08-ochsner',
    accountId: PRIVATE,
    date: '2026-08-21',
    text: 'APPLE PAY KAUF/DIENSTLEISTUNG VOM 21.08.2026 KARTEN NR. XXXX7731 OCHSNER SPORT BERN (CH)',
    amount: -8_990,
    currency: 'CHF',
    category: 'shopping',
  },
]

/**
 * Wechsel per Ende Februar 2026: CHF 4'635 statt CHF 4'215.
 *
 * Dazu die Krankenkasse beim Namen: Der Generator schreibt «KRANKENKASSE
 * PRAEMIE», ein echter LSV-Auszug nennt die Kasse. Reto ist bei der CSS —
 * damit trägt seine zweitgrösste Blase ein Logo statt eines Sinnbilds.
 */
const transactions = [
  ...withVariants(
    withRenamed(
      withJobChange(retoTransactions, {
        since: '2026-02-01',
        match: /^LOHN \/ Arbeitgeber AG$/,
        text: 'LOHN / Nordlicht Software AG',
        amount: 463_500,
        idPrefix: 'reto-EV-lohn',
      }),
      { match: /^KRANKENKASSE PRAEMIE$/, text: 'CSS VERSICHERUNG AG / PRAEMIE' },
    ),
    {
      /* 34 Buchungen am selben Terminal — als eine Blase «Six Payment 88214»
         war das der grösste Posten ohne Aussage. Jede vierte bleibt stehen. */
      match: /SIX PAYMENT 88214 BERN/,
      text: (merchant, date) =>
        `KAUF/DIENSTLEISTUNG VOM ${date} KARTEN NR. XXXX7731 ${merchant} (CH)`,
      variants: [
        { merchant: 'TIBITS BERN' },
        { merchant: 'BREZELKOENIG BERN' },
        { merchant: 'STARBUCKS BERN' },
        { merchant: 'MCDONALDS BERN WANKDORF' },
        { merchant: 'BAECKEREI GLATZ BERN' },
      ],
      keepEvery: 4,
    },
  ),
  ...events,
  ...bills,
  ...board,
  ...recentDays,
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
