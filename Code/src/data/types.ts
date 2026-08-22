/** Fachliche Typen des Nachbaus. Bewusst schmal gehalten: nur was ein Screen zeigt. */

export type Currency = 'CHF' | 'EUR'

export type AccountKind =
  | 'private'
  | 'savings'
  | 'youth'
  | 'foreign'
  | 'retirement3a'
  | 'card'
  | 'loan'
  | 'custody'

/** Woher der Datensatz stammt. `external` = über Multibanking aggregiert. */
export type AccountSource = { type: 'postfinance' } | { type: 'external'; bank: string }

export interface Account {
  id: string
  name: string
  iban: string
  kind: AccountKind
  currency: Currency
  /** Saldo in Rappen/Cents. Ganzzahlig, damit nichts rundet. */
  balance: number
  /** Nur bei Fremdwährung: Gegenwert in CHF, ebenfalls in Rappen. */
  balanceChf?: number
  source: AccountSource
  /** Unter «Weitere Produkte» statt unter «Konten» einsortieren. */
  furtherProduct?: boolean
}

export type Category =
  | 'income'
  | 'groceries'
  | 'eatingOut'
  | 'shopping'
  | 'transport'
  | 'housing'
  | 'health'
  | 'subscriptions'
  | 'leisure'
  | 'taxes'
  | 'insurance'
  | 'transfer'
  | 'cash'
  | 'other'

export interface Transaction {
  id: string
  accountId: string
  /** ISO-Datum, YYYY-MM-DD. */
  date: string
  /** Text so, wie ihn die Bank heute anzeigt — inklusive kryptischer Händlernamen. */
  text: string
  /** Betrag in Rappen. Negativ = Belastung, positiv = Gutschrift. */
  amount: number
  currency: Currency
  category: Category
  /** Gegenkonto bei Umbuchungen auf eigene Konten. */
  counterAccountId?: string
  /** Gehört zu einer erkannten Zahlungsreihe (Abo, Dauerauftrag). */
  seriesId?: string
  pending?: boolean
  /** Steht anstelle des echten Händlerlogos in der Liste. */
  brand?: { bg: string; fg: string; short: string }
}

/** Postadresse, wie die Zusammenfassung einer Zahlung sie zeilenweise ausgibt. */
export interface Address {
  street: string
  /** PLZ und Ort in einer Zeile — so steht es auf dem Einzahlungsschein. */
  place: string
  country: string
}

/** Bank des Empfängers, ebenfalls Zeile für Zeile in der Zusammenfassung. */
export interface BankRef {
  name: string
  place: string
  country: string
}

/**
 * Ein Empfänger im Adressbuch der Persona.
 *
 * Jeder Eintrag steht für eine Gegenpartei, die in den Buchungen dieser Persona
 * wirklich vorkommt. `match` ist das Textfragment, über das frühere Zahlungen an
 * sie gefunden werden — daraus speist sich «Daten der bestehenden Zahlung
 * kopieren» im Zahlungsfluss.
 */
export interface Beneficiary {
  id: string
  name: string
  iban: string
  address: Address
  bank: BankRef
  /** Kommt im Buchungstext früherer Zahlungen an diesen Empfänger vor. */
  match: string
}

export interface StandingOrder {
  id: string
  accountId: string
  recipient: string
  amount: number
  currency: Currency
  /** ISO-Datum der nächsten Ausführung. */
  nextExecution: string
}

export interface PendingOrder {
  id: string
  accountId: string
  recipient: string
  amount: number
  currency: Currency
  execution: string
}

export interface Persona {
  id: string
  /** Anzeigename in der App. */
  name: string
  /** Kurzprofil für den Auswahlbildschirm. */
  role: string
  /** Ein Satz aus dem Interview — verbindet den Prototyp mit der Recherche. */
  quote: string
  /** Auf welches Interviewdokument sich diese Persona stützt. */
  source: string
  /** Wohnadresse — steht in der Zusammenfassung, wenn auf ein eigenes Konto geht. */
  address: Address
  accounts: Account[]
  transactions: Transaction[]
  /** Adressbuch: Gegenparteien, die in `transactions` wirklich auftauchen. */
  beneficiaries: Beneficiary[]
  standingOrders: StandingOrder[]
  pendingOrders: PendingOrder[]
}

/** Alle Beträge in Rappen; `today` fixiert den Demo-Zeitpunkt. */
export const TODAY = '2026-08-22'
