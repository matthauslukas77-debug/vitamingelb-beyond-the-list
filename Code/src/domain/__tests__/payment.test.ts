import { describe, expect, it } from 'vitest'
import { PERSONAS } from '../../data/personas'
import { TODAY } from '../../data/types'
import {
  bankingDays,
  centsToRaw,
  debitAccounts,
  filterRecipients,
  isBankingDay,
  lastPaymentTo,
  newDraft,
  nextBankingDay,
  orderFromDraft,
  pressKey,
  rawToCents,
  recommendedRecipients,
} from '../payment'

/** Prüfziffern einer IBAN nach ISO 7064 Mod 97-10. */
function ibanIsValid(iban: string): boolean {
  const flat = iban.replace(/\s+/g, '').toUpperCase()
  const rearranged = flat.slice(4) + flat.slice(0, 4)
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rest = 0
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97
  return rest === 1
}

describe('Adressbuch der Personas', () => {
  for (const persona of PERSONAS) {
    it(`${persona.name}: jeder Empfänger hat eine gültige IBAN`, () => {
      expect(persona.beneficiaries.length).toBeGreaterThan(0)
      for (const beneficiary of persona.beneficiaries) {
        expect(ibanIsValid(beneficiary.iban), beneficiary.name).toBe(true)
      }
      for (const account of persona.accounts) {
        expect(ibanIsValid(account.iban), account.name).toBe(true)
      }
    })

    /**
     * Der Punkt des Adressbuchs: Es erfindet keine Gegenparteien, sondern
     * benennt die, die in den Buchungen dieser Persona wirklich stehen. Die
     * beiden Zahnarztrechnungen sind die Ausnahme — sie stehen als pendenter
     * Auftrag und wurden noch nie bezahlt.
     */
    it(`${persona.name}: jeder Empfänger kommt in Buchungen oder Aufträgen vor`, () => {
      for (const beneficiary of persona.beneficiaries) {
        const inBookings = lastPaymentTo(beneficiary, persona.transactions) !== undefined
        const inOrders = [...persona.pendingOrders, ...persona.standingOrders].some((order) =>
          order.recipient.toLowerCase().includes(beneficiary.match.toLowerCase()),
        )
        expect(inBookings || inOrders, beneficiary.name).toBe(true)
      }
    })
  }
})

describe('lastPaymentTo', () => {
  const nino = PERSONAS.find((p) => p.id === 'nino')!

  it('findet die jüngste Belastung an den Empfänger', () => {
    const wg = nino.beneficiaries.find((b) => b.id === 'j-be-wg')!
    const last = lastPaymentTo(wg, nino.transactions)
    expect(last).toBeDefined()
    // Miete: die letzte im Datensatz, Betrag positiv als Zahlbetrag.
    expect(last!.amount).toBeGreaterThan(0)
    const dates = nino.transactions
      .filter((tx) => tx.text.includes('WG Länggasse') && tx.amount < 0)
      .map((tx) => tx.date)
    expect(last!.date).toBe(dates.sort().at(-1))
  })

  it('lässt Gutschriften aussen vor — kopieren lässt sich nur eine Zahlung', () => {
    const frei = nino.beneficiaries.find((b) => b.id === 'j-be-frei')!
    const last = lastPaymentTo(frei, nino.transactions)!
    const tx = nino.transactions.find((entry) => entry.date === last.date && entry.text.includes('TOBIAS FREI'))!
    expect(tx.text).toContain('GESENDET')
  })

  it('bleibt leer, wenn der Empfänger nie bezahlt wurde', () => {
    const reto = PERSONAS.find((p) => p.id === 'reto')!
    const vogt = reto.beneficiaries.find((b) => b.id === 'f-be-vogt')!
    expect(lastPaymentTo(vogt, reto.transactions)).toBeUndefined()
  })
})

describe('recommendedRecipients', () => {
  const bruno = PERSONAS.find((p) => p.id === 'bruno')!

  it('stellt das Adressbuch vor die eigenen Konten', () => {
    const list = recommendedRecipients(bruno)
    const firstOwn = list.findIndex((entry) => entry.own)
    expect(firstOwn).toBeGreaterThan(0)
    expect(list.slice(firstOwn).every((entry) => entry.own)).toBe(true)
  })

  it('nimmt als eigene Konten nur die von PostFinance', () => {
    const own = recommendedRecipients(bruno).filter((entry) => entry.own)
    // Valiant-Privatkonto und Valiant-Hypothek sind aggregiert, nicht belastbar.
    expect(own.map((entry) => entry.accountId)).toEqual([
      'bruno-private', 'bruno-savings', 'bruno-3a',
    ])
  })

  it('sortiert das Adressbuch nach der letzten Zahlung, jüngste zuerst', () => {
    const book = recommendedRecipients(bruno).filter((entry) => !entry.own)
    const dates = book.map((entry) => entry.last?.date ?? '')
    expect([...dates].sort().reverse()).toEqual(dates)
  })
})

describe('filterRecipients', () => {
  const livia = PERSONAS.find((p) => p.id === 'livia')!
  const all = recommendedRecipients(livia)

  it('findet über den Namen', () => {
    expect(filterRecipients(all, 'zbind').map((r) => r.name)).toEqual(['Jana Zbinden'])
  })

  it('findet über die IBAN, auch ohne Leerzeichen', () => {
    const target = all.find((r) => r.name === 'Jana Zbinden')!
    expect(filterRecipients(all, target.iban.replace(/\s+/g, '').slice(0, 12))).toEqual([target])
  })

  it('gibt ohne Eingabe die ganze Liste zurück', () => {
    expect(filterRecipients(all, '   ')).toEqual(all)
  })
})

describe('debitAccounts', () => {
  it('lässt Depot und Hypothek weg', () => {
    const bruno = PERSONAS.find((p) => p.id === 'bruno')!
    expect(debitAccounts(bruno).map((a) => a.id)).toEqual([
      'bruno-private', 'bruno-savings', 'bruno-3a',
    ])
    const nino = PERSONAS.find((p) => p.id === 'nino')!
    expect(debitAccounts(nino).map((a) => a.id)).toEqual(['nino-private'])
  })
})

describe('Ausführungsdatum', () => {
  it('kennt Wochenenden und Bankfeiertage', () => {
    expect(isBankingDay('2026-08-21')).toBe(true)   // Freitag
    expect(isBankingDay('2026-08-22')).toBe(false)  // Samstag — der Demo-Tag
    expect(isBankingDay('2026-08-23')).toBe(false)  // Sonntag
    expect(isBankingDay('2026-08-01')).toBe(false)  // Nationalfeiertag
  })

  /** Genau der Fall der Vorlage: Samstag 22.08. → Montag 24.08.2026. */
  it('verschiebt vom Demo-Tag auf den nächsten Bankwerktag', () => {
    expect(nextBankingDay(TODAY)).toBe('2026-08-24')
  })

  it('lässt einen Bankwerktag stehen', () => {
    expect(nextBankingDay('2026-08-25')).toBe('2026-08-25')
  })

  it('liefert lauter verschiedene, aufsteigende Bankwerktage', () => {
    const days = bankingDays(TODAY, 6)
    expect(days).toHaveLength(6)
    expect(new Set(days).size).toBe(6)
    expect([...days].sort()).toEqual(days)
    expect(days.every(isBankingDay)).toBe(true)
  })
})

describe('newDraft', () => {
  const nino = PERSONAS.find((p) => p.id === 'nino')!
  const livia = PERSONAS.find((p) => p.id === 'livia')!

  it('startet leer, auf dem ersten belastbaren Konto, am nächsten Bankwerktag', () => {
    const draft = newDraft(recommendedRecipients(nino)[0], nino, TODAY)
    expect(draft.amount).toBe(0)
    expect(draft.debitAccountId).toBe('nino-private')
    expect(draft.execution).toBe('2026-08-24')
    expect(draft.kind).toBe('single')
    expect(draft.confirmation).toBe(true)
  })

  it('belastet bei einer Umbuchung nicht das Zielkonto selbst', () => {
    const toPrivate = recommendedRecipients(livia).find((r) => r.accountId === 'livia-private')!
    expect(newDraft(toPrivate, livia, TODAY).debitAccountId).toBe('livia-savings')
  })
})

describe('orderFromDraft', () => {
  const nino = PERSONAS.find((p) => p.id === 'nino')!
  const base = newDraft(recommendedRecipients(nino)[0], nino, TODAY)

  it('macht aus einem Einzelauftrag einen pendenten Auftrag, Betrag negativ', () => {
    const result = orderFromDraft({ ...base, amount: 2_000 }, 'x-1')
    expect(result).toEqual({
      pending: {
        id: 'x-1',
        accountId: 'nino-private',
        recipient: base.recipient.name,
        amount: -2_000,
        currency: 'CHF',
        execution: '2026-08-24',
      },
    })
  })

  it('macht aus einem Dauerauftrag einen Dauerauftrag', () => {
    const result = orderFromDraft({ ...base, amount: 5_000, kind: 'standing' }, 'x-2')
    expect(result).toEqual({
      standing: {
        id: 'x-2',
        accountId: 'nino-private',
        recipient: base.recipient.name,
        amount: -5_000,
        currency: 'CHF',
        nextExecution: '2026-08-24',
      },
    })
  })
})

describe('Betragseingabe', () => {
  it('tippt Ziffern an', () => {
    expect(['2', '0'].reduce(pressKey, '')).toBe('20')
  })

  it('nimmt höchstens einen Punkt und zwei Rappenstellen', () => {
    expect(['1', '.', '.', '5', '0', '7'].reduce(pressKey, '')).toBe('1.50')
  })

  it('setzt vor einen führenden Punkt eine Null', () => {
    expect(pressKey('', '.')).toBe('0.')
  })

  it('ersetzt die führende Null statt sie stehen zu lassen', () => {
    expect(pressKey('0', '5')).toBe('5')
  })

  it('nimmt mit Rückschritt Zeichen weg', () => {
    expect(pressKey('20.5', 'back')).toBe('20.')
    expect(pressKey('', 'back')).toBe('')
  })

  it('rechnet in Rappen und zurück', () => {
    expect(rawToCents('20')).toBe(2_000)
    expect(rawToCents('20.5')).toBe(2_050)
    expect(rawToCents('0.05')).toBe(5)
    expect(rawToCents('')).toBe(0)
    expect(rawToCents('.')).toBe(0)
    expect(centsToRaw(40_000)).toBe('400')
    expect(centsToRaw(2_050)).toBe('20.50')
  })

  it('überlebt die Runde durch beide Richtungen', () => {
    for (const cents of [1, 5, 99, 2_000, 40_000, 123_456]) {
      expect(rawToCents(centsToRaw(cents))).toBe(cents)
    }
  })
})
