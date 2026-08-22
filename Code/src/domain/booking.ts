import type { Transaction } from '../data/types'

/**
 * Zerlegt den Buchungstext, wie PostFinance ihn liefert.
 *
 * «APPLE PAY KAUF/DIENSTLEISTUNG VOM 03.09.2024 KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)»
 *
 * Alles steckt in dieser einen Zeile: Zahlungsart, Kaufdatum, Karte, Händler,
 * Land — und bei Auslandzahlungen zusätzlich Betrag, Kurs und Zuschlag. In der
 * Liste ist davon nur der Anfang zu sehen, der Händler steht ganz hinten und
 * fällt weg. Genau das haben vier von sechs Interviewten beschrieben.
 *
 * Die Detailansicht kann den Text lesen, weil sie ihn hier zerlegt. Es sind
 * dieselben Daten — nur anders präsentiert.
 */

export type BookingChannel = 'Apple Pay' | 'TWINT' | 'Karte' | null

export interface ParsedBooking {
  channel: BookingChannel
  /** «Kauf/Dienstleistung», «Geld gesendet» … in lesbarer Form. */
  kind: string
  /** Tag des Kaufs, ISO — kann vor dem Buchungstag liegen. */
  paidOn?: string
  /** Maskierte Kartennummer, z. B. XXXX7731. */
  card?: string
  /** Händler oder Gegenpartei. */
  counterparty?: string
  /** Ländercode aus der Klammer am Ende. */
  country?: string
  /** Bei Fremdwährung: Originalbetrag, Kurs und Bearbeitungszuschlag. */
  foreign?: { currency: string; amount: string; rate: string; fee?: string }
  /** Der Rohtext, zeilenweise für den Abschnitt «Buchungsdetails». */
  lines: string[]
}

const KIND_LABEL: Record<string, string> = {
  'KAUF/DIENSTLEISTUNG': 'Kauf / Dienstleistung',
  'KAUF/ONLINE-SHOPPING': 'Kauf / Online-Shopping',
  'GELD GESENDET': 'Geld gesendet',
  'GELD EMPFANGEN': 'Geld empfangen',
}

function isoFrom(swiss: string): string {
  const [d, m, y] = swiss.split('.')
  return `${y}-${m}-${d}`
}

/** Bricht den Rohtext an den bekannten Schlüsselwörtern um, wie in der App. */
function toLines(text: string): string[] {
  return text
    .replace(/ (VOM \d{2}\.\d{2}\.\d{4})/, '\n$1')
    .replace(/ (KARTEN NR\. \S+)/, '\n$1')
    .replace(/ (EUR|USD|GBP) (\d)/, '\n$1 $2')
    .replace(/ (ZUM KURS VON)/, '\n$1')
    .replace(/ (BETRAG IN KONTOWÄHRUNG)/, '\n$1')
    .replace(/ (\d+(?:\.\d+)?% BEARBEITUNGSZUSCHLAG)/, '\n$1')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function parseBooking(tx: Transaction): ParsedBooking {
  const text = tx.text
  const lines = toLines(text)

  let rest = text
  let channel: BookingChannel = null
  if (rest.startsWith('APPLE PAY ')) {
    channel = 'Apple Pay'
    rest = rest.slice(10)
  } else if (rest.startsWith('TWINT ')) {
    channel = 'TWINT'
    rest = rest.slice(6)
  }

  const kindMatch = rest.match(/^(KAUF\/[A-Z-]+|GELD GESENDET|GELD EMPFANGEN)\s+VOM\s+(\d{2}\.\d{2}\.\d{4})\s*/)
  if (!kindMatch) {
    // Dauerauftrag, Lohn, Abo — der Text ist bereits der Name.
    return { channel, kind: 'Buchung', counterparty: text, lines }
  }

  const kind = KIND_LABEL[kindMatch[1]] ?? kindMatch[1]
  const paidOn = isoFrom(kindMatch[2])
  rest = rest.slice(kindMatch[0].length)

  let foreign: ParsedBooking['foreign']
  const fx = rest.match(/^([A-Z]{3}) ([\d.]+) ZUM KURS VON ([\d.]+)(?: BETRAG IN KONTOWÄHRUNG [\d.]+)?(?: ([\d.]+)% BEARBEITUNGSZUSCHLAG [\d.]+)?\s*/)
  if (fx) {
    foreign = { currency: fx[1], amount: fx[2], rate: fx[3], fee: fx[4] }
    rest = rest.slice(fx[0].length)
  }

  const cardMatch = rest.match(/^KARTEN NR\.\s+(\S+)\s*/)
  const card = cardMatch?.[1]
  if (cardMatch) rest = rest.slice(cardMatch[0].length)

  // «AN SVEN AEBI» / «VON SVEN AEBI»
  rest = rest.replace(/^(AN|VON)\s+/, '')

  const countryMatch = rest.match(/\(([A-Z]{2})\)\s*$/)
  const country = countryMatch?.[1]
  const counterparty = rest.replace(/\s*\([A-Z]{2}\)\s*$/, '').trim() || undefined

  return {
    channel: channel ?? (card ? 'Karte' : null),
    kind,
    paidOn,
    card,
    counterparty,
    country,
    foreign,
    lines,
  }
}

/** Aus «COOP BERN BAHNHOF» wird «Coop Bern Bahnhof». */
export function prettyName(name: string): string {
  return name
    .split(' ')
    .map((word) =>
      word.length > 2 && word === word.toUpperCase() && /[A-ZÄÖÜ]/.test(word)
        ? word.charAt(0) + word.slice(1).toLowerCase()
        : word,
    )
    .join(' ')
}
