import { addDays, parseIso } from '../lib/date'
import type {
  Account,
  Address,
  BankRef,
  Beneficiary,
  Currency,
  PendingOrder,
  Persona,
  StandingOrder,
  Transaction,
} from '../data/types'

/**
 * Der Zahlungsauftrag als Fachlogik — ohne React.
 *
 * Die vier Schritte des Flusses (Empfänger, Betrag, Ausführung,
 * Zusammenfassung) arbeiten alle auf demselben Entwurf. Was daraus am Ende
 * wird, entscheidet `orderFromDraft`: ein pendenter Auftrag oder ein
 * Dauerauftrag — genau die zwei Listen, die der Zahlungen-Reiter schon zeigt.
 *
 * Vorlage: fehlendeDetailseiten/Zahlung/IMG_5014–5020.
 */

/* ── Empfänger ─────────────────────────────────────────────────────────────
   Der Fluss kennt zwei Sorten: Adressbucheinträge und eigene Konten. In der
   Vorlage stehen sie in derselben Liste, nur mit unterschiedlichem Symbol —
   deshalb hier eine gemeinsame Form statt zwei Codewege. */

export interface Recipient {
  id: string
  name: string
  iban: string
  address: Address
  bank: BankRef
  /** Eigenes Konto: die Zeile mit dem Übertragungssymbol in der Vorlage. */
  own: boolean
  /** Bei eigenen Konten das Zielkonto — sonst leer. */
  accountId?: string
  /** Letzte Zahlung an diesen Empfänger, aus den Buchungen der Persona. */
  last?: { amount: number; date: string }
}

/** Die Bank eines eigenen Kontos, hergeleitet aus `account.source`. */
function bankOf(account: Account): BankRef {
  return account.source.type === 'postfinance'
    ? { name: 'PostFinance AG', place: 'Bern', country: 'Schweiz' }
    : { name: account.source.bank, place: '', country: 'Schweiz' }
}

/**
 * Letzte Zahlung an einen Empfänger. Gesucht wird über `beneficiary.match` im
 * Buchungstext — daraus wird «Daten der bestehenden Zahlung kopieren».
 *
 * Nur Belastungen zählen: Bei einer TWINT-Bekanntschaft stehen Gesendet und
 * Empfangen im selben Konto, und kopieren lässt sich nur, was man selbst
 * gezahlt hat.
 */
export function lastPaymentTo(
  beneficiary: Beneficiary,
  transactions: Transaction[],
): { amount: number; date: string } | undefined {
  const needle = beneficiary.match.toLowerCase()
  let found: Transaction | undefined
  for (const tx of transactions) {
    if (tx.amount >= 0) continue
    if (!tx.text.toLowerCase().includes(needle)) continue
    if (!found || tx.date > found.date) found = tx
  }
  return found ? { amount: -found.amount, date: found.date } : undefined
}

/**
 * «Empfohlene Empfänger» — zuerst das Adressbuch, nach der letzten Zahlung
 * sortiert, dann die eigenen Konten. So steht oben, wen die Persona zuletzt
 * bezahlt hat, und unten die Umbuchung auf sich selbst.
 */
export function recommendedRecipients(persona: Persona): Recipient[] {
  const book = persona.beneficiaries
    .map<Recipient>((beneficiary) => ({
      id: beneficiary.id,
      name: beneficiary.name,
      iban: beneficiary.iban,
      address: beneficiary.address,
      bank: beneficiary.bank,
      own: false,
      last: lastPaymentTo(beneficiary, persona.transactions),
    }))
    .sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''))

  const own = persona.accounts
    .filter((account) => account.source.type === 'postfinance')
    .map<Recipient>((account) => ({
      id: `own-${account.id}`,
      name: persona.name,
      iban: account.iban,
      address: persona.address,
      bank: bankOf(account),
      own: true,
      accountId: account.id,
    }))

  return [...book, ...own]
}

/** Suche über Name und IBAN — die Vorlage nennt im Feld beides. */
export function filterRecipients(recipients: Recipient[], query: string): Recipient[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, '')
  if (needle.length === 0) return recipients
  return recipients.filter(
    (recipient) =>
      recipient.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      recipient.iban.toLowerCase().replace(/\s+/g, '').includes(needle),
  )
}

/** Konten, die belastet werden können: eigene, ohne Depot und Hypothek. */
export function debitAccounts(persona: Persona): Account[] {
  return persona.accounts.filter(
    (account) =>
      account.source.type === 'postfinance' &&
      account.kind !== 'custody' &&
      account.kind !== 'loan',
  )
}

/* ── Ausführungsdatum ──────────────────────────────────────────────────────
   In der Vorlage ist «Sofortige Ausführung» ausgegraut mit dem Hinweis
   «Annahmeschlusszeiten überschritten», und als Datum steht der nächste
   Bankwerktag: Samstag, 22.08.2026 → Montag, 24.08.2026. */

/** Bankfeiertage im Kanton Bern, so weit der Prototyp vorausschaut. */
const HOLIDAYS = new Set([
  '2026-01-01', '2026-01-02', '2026-04-03', '2026-04-06', '2026-05-14',
  '2026-05-25', '2026-08-01', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-01-02', '2027-03-26', '2027-03-29', '2027-05-06',
  '2027-05-17', '2027-08-01', '2027-12-25', '2027-12-26',
])

export function isBankingDay(iso: string): boolean {
  const day = parseIso(iso).getDay()
  return day !== 0 && day !== 6 && !HOLIDAYS.has(iso)
}

/** Der nächste Tag, an dem eine Zahlung ausgeführt werden kann. */
export function nextBankingDay(iso: string): string {
  let candidate = iso
  while (!isBankingDay(candidate)) candidate = addDays(candidate, 1)
  return candidate
}

/** Die nächsten Bankwerktage ab heute — Auswahl hinter dem Kalendersymbol. */
export function bankingDays(from: string, count: number): string[] {
  const days: string[] = []
  let candidate = nextBankingDay(from)
  while (days.length < count) {
    days.push(candidate)
    candidate = nextBankingDay(addDays(candidate, 1))
  }
  return days
}

/* ── Entwurf und Auftrag ───────────────────────────────────────────────── */

export type OrderKind = 'single' | 'standing'
export type Interval = 'monthly' | 'quarterly' | 'yearly'

export const INTERVAL_LABELS: Record<Interval, string> = {
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  yearly: 'Jährlich',
}

export interface PaymentDraft {
  recipient: Recipient
  /** Rappen, immer positiv. 0 = noch nichts eingegeben. */
  amount: number
  currency: Currency
  debitAccountId: string
  kind: OrderKind
  interval: Interval
  execution: string
  /** «Zahlungsbestätigung» — in der Vorlage standardmässig ein. */
  confirmation: boolean
  /** Mitteilung an den Empfänger (optional). */
  message: string
  /** Buchungstext für die eigene Liste (optional). */
  bookingText: string
}

export function newDraft(recipient: Recipient, persona: Persona, today: string): PaymentDraft {
  const debit = debitAccounts(persona)
  return {
    recipient,
    amount: 0,
    currency: 'CHF',
    // Bei einer Umbuchung auf ein eigenes Konto wäre dasselbe Konto auf beiden
    // Seiten unsinnig — dann das nächste nehmen.
    debitAccountId:
      (recipient.own
        ? debit.find((account) => account.id !== recipient.accountId)?.id
        : undefined) ?? debit[0].id,
    kind: 'single',
    interval: 'monthly',
    execution: nextBankingDay(today),
    confirmation: true,
    message: '',
    bookingText: '',
  }
}

/** Was der Entwurf beim Ausführen wird — die Sicht der beiden Listen. */
export function orderFromDraft(
  draft: PaymentDraft,
  id: string,
): { pending: PendingOrder } | { standing: StandingOrder } {
  const shared = {
    id,
    accountId: draft.debitAccountId,
    recipient: draft.recipient.name,
    // Belastungen sind im Datenmodell negativ.
    amount: -draft.amount,
    currency: draft.currency,
  }
  return draft.kind === 'standing'
    ? { standing: { ...shared, nextExecution: draft.execution } }
    : { pending: { ...shared, execution: draft.execution } }
}

/* ── Betragseingabe ────────────────────────────────────────────────────────
   Die Vorlage hat einen Ziffernblock mit Punkt und Rückschritt. Der Entwurf
   hält den Betrag in Rappen, die Anzeige den rohen Tastendruck — «20» bleibt
   «20», bis der Schritt verlassen wird und «20.00» daraus wird. */

/** Einen Tastendruck auf die rohe Eingabe anwenden. Ungültiges wird verworfen. */
export function pressKey(raw: string, key: string): string {
  if (key === 'back') return raw.slice(0, -1)
  if (key === '.') return raw.includes('.') ? raw : (raw === '' ? '0.' : `${raw}.`)
  const [, rappen] = raw.split('.')
  if (rappen !== undefined && rappen.length >= 2) return raw
  if (raw === '0') return key
  if (raw.replace('.', '').length >= 9) return raw
  return raw + key
}

/** Rohe Eingabe in Rappen. Rundet nicht — die Eingabe hat höchstens zwei Stellen. */
export function rawToCents(raw: string): number {
  if (raw === '' || raw === '.') return 0
  const [francs, rappen = ''] = raw.split('.')
  return Number(francs || '0') * 100 + Number(rappen.padEnd(2, '0'))
}

/** Rappen in die rohe Eingabe — für «Daten der bestehenden Zahlung kopieren». */
export function centsToRaw(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}
