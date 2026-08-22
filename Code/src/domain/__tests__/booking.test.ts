import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../data/personas'
import type { Transaction } from '../../data/types'
import { parseBooking, prettyName } from '../booking'

const tx = (text: string): Transaction => ({
  id: 't', accountId: 'a', date: '2024-09-03', text, amount: -4927,
  currency: 'CHF', category: 'groceries',
})

describe('parseBooking', () => {
  it('zerlegt eine Apple-Pay-Kartenzahlung', () => {
    const b = parseBooking(tx('APPLE PAY KAUF/DIENSTLEISTUNG VOM 03.09.2024 KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)'))
    expect(b.channel).toBe('Apple Pay')
    expect(b.kind).toBe('Kauf / Dienstleistung')
    expect(b.paidOn).toBe('2024-09-03')
    expect(b.card).toBe('XXXX7731')
    expect(b.counterparty).toBe('COOP BERN BAHNHOF')
    expect(b.country).toBe('CH')
  })

  it('erkennt Online-Shopping ohne Zahlungsart', () => {
    const b = parseBooking(tx('KAUF/ONLINE-SHOPPING VOM 05.09.2024 KARTEN NR. XXXX7731 ZALANDO (CH)'))
    expect(b.channel).toBe('Karte')
    expect(b.kind).toBe('Kauf / Online-Shopping')
    expect(b.counterparty).toBe('ZALANDO')
  })

  it('liest TWINT-Überweisungen mit Gegenpartei', () => {
    const sent = parseBooking(tx('TWINT GELD GESENDET VOM 01.09.2024 AN SVEN AEBI'))
    expect(sent.channel).toBe('TWINT')
    expect(sent.kind).toBe('Geld gesendet')
    expect(sent.counterparty).toBe('SVEN AEBI')

    const got = parseBooking(tx('TWINT GELD EMPFANGEN VOM 18.09.2024 VON SVEN AEBI'))
    expect(got.kind).toBe('Geld empfangen')
    expect(got.counterparty).toBe('SVEN AEBI')
  })

  it('zerlegt eine Fremdwährungszahlung samt Kurs und Zuschlag', () => {
    const b = parseBooking(tx(
      'APPLE PAY KAUF/DIENSTLEISTUNG VOM 12.07.2025 EUR 38.48 ZUM KURS VON 0.9486 ' +
      'BETRAG IN KONTOWÄHRUNG 36.49 1.5% BEARBEITUNGSZUSCHLAG 0.55 KARTEN NR. XXXX4417 CONAD BOLZANO (IT)',
    ))
    expect(b.foreign).toEqual({ currency: 'EUR', amount: '38.48', rate: '0.9486', fee: '1.5' })
    expect(b.card).toBe('XXXX4417')
    expect(b.counterparty).toBe('CONAD BOLZANO')
    expect(b.country).toBe('IT')
  })

  it('lässt Daueraufträge und Abos unangetastet', () => {
    const b = parseBooking(tx('ADOBE *CREATIVE CLOUD'))
    expect(b.kind).toBe('Buchung')
    expect(b.counterparty).toBe('ADOBE *CREATIVE CLOUD')
    expect(b.card).toBeUndefined()
  })

  it('bricht den Rohtext für die Buchungsdetails um', () => {
    const b = parseBooking(tx('APPLE PAY KAUF/DIENSTLEISTUNG VOM 03.09.2024 KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)'))
    expect(b.lines).toEqual([
      'APPLE PAY KAUF/DIENSTLEISTUNG',
      'VOM 03.09.2024',
      'KARTEN NR. XXXX7731 COOP BERN BAHNHOF (CH)',
    ])
  })

  it('kommt mit jeder Buchung im Datenbestand zurecht', () => {
    for (const persona of PERSONAS) {
      for (const transaction of persona.transactions) {
        const b = parseBooking(transaction)
        expect(b.lines.length, transaction.text).toBeGreaterThan(0)
        // Wo ein Kaufdatum steht, muss es ein gültiges Datum sein.
        if (b.paidOn) expect(b.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })

  it('findet in den echten Daten überall einen Händler', () => {
    const card = PERSONAS.flatMap((p) => p.transactions).filter((t) => t.text.includes('KARTEN NR.'))
    expect(card.length).toBeGreaterThan(100)
    for (const transaction of card) {
      expect(parseBooking(transaction).counterparty, transaction.text).toBeTruthy()
    }
  })
})

describe('prettyName', () => {
  it('macht aus Grossbuchstaben lesbare Namen', () => {
    expect(prettyName('COOP BERN BAHNHOF')).toBe('Coop Bern Bahnhof')
    expect(prettyName('SIX PAYMENT 88214 BERN')).toBe('Six Payment 88214 Bern')
  })
})
