import { describe, expect, it } from 'vitest'
import { findPersona } from '../../../data/personas'
import { TODAY, type Transaction } from '../../../data/types'
import { monthStart } from '../derive'
import { moneyFlow } from '../flow'
import { outlierLimit, outliersIn, OUTLIER_MIN } from '../outliers'
import { NO_MARKINGS, withMarking } from '../markings'
import { CATEGORY_KEYS, type CategoryKey } from '../slots'
import { reachableReserve, savingsBalance } from '../forecast'

/** Ein Budget je Kategorie, alle gleich — für die Schwellenrechnung. */
function flat(rappen: number): Record<CategoryKey, number> {
  return Object.fromEntries(CATEGORY_KEYS.map((key) => [key, rappen])) as Record<CategoryKey, number>
}

const bruno = findPersona('bruno')!
const window = { from: monthStart(TODAY), to: TODAY, ownName: bruno.name }

describe('Die Schwelle', () => {
  it('ist das Doppelte des Kategoriebudgets', () => {
    expect(outlierLimit(300_000)).toBe(600_000)
  })

  it('fällt nie unter den Mindestbetrag', () => {
    /* Ninos Mobilitätsbudget ist rund CHF 110. Das Doppelte wären CHF 220 —
       jede zweite Fahrkarte wäre ein «Ausreisser», und nach drei Fragen
       beantwortet er keine mehr. */
    expect(outlierLimit(11_000)).toBe(OUTLIER_MIN)
    expect(outlierLimit(0)).toBe(OUTLIER_MIN)
  })
})

describe('Die auffälligen Buchungen', () => {
  it('findet Brunos Anzahlung Heizung im Wohnen', () => {
    const found = outliersIn(bruno.transactions, bruno.accounts, {
      ...window,
      budget: flat(146_300),
      category: 'reside',
    })
    expect(found.map((entry) => entry.amount)).toContain(1_200_000)
    expect(found[0].tx.text).toContain('ANZAHLUNG HEIZUNG')
    expect(found[0].marking.kind).toBe('normal')
  })

  it('sortiert die grösste nach vorne', () => {
    const found = outliersIn(bruno.transactions, bruno.accounts, { ...window, budget: flat(0) })
    const amounts = found.map((entry) => entry.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
  })

  it('gibt die schon eingeordneten mit ihrer Antwort zurück', () => {
    /* Der Signale-Bildschirm filtert die beantworteten weg, die Detailseite
       zeigt sie weiter — sonst wäre die Einordnung eine Falltür, die man nicht
       wiederfindet. */
    const heating = outliersIn(bruno.transactions, bruno.accounts, {
      ...window,
      budget: flat(146_300),
      category: 'reside',
    })[0]
    const markings = withMarking(NO_MARKINGS, heating.tx.id, { kind: 'extraordinary' })
    const again = outliersIn(bruno.transactions, bruno.accounts, {
      ...window,
      markings,
      budget: flat(146_300),
      category: 'reside',
    })
    expect(again.find((entry) => entry.tx.id === heating.tx.id)?.marking.kind).toBe('extraordinary')
  })

  it('lässt Steuern aus', () => {
    /* Sie werden in der Ableitung über die volle Historie geglättet. Eine
       Steuerrate ist der Normalfall dieser Kategorie, keine Überraschung. */
    const found = outliersIn(bruno.transactions, bruno.accounts, { ...window, budget: flat(0) })
    expect(found.map((entry) => entry.category)).not.toContain('taxes')
  })

  it('nimmt nur Geld, das das Konto wirklich verlässt', () => {
    /* Ein Übertrag aufs eigene Sparkonto ist keine Ausgabe, und eine
       Kartenabrechnung zählt nicht zweimal. Ohne diesen Filter wäre jede
       Vermögensumschichtung ein Ausreisser — gemessen an `moneyFlow`, nicht an
       einer eigenen Vermutung darüber, was ein eigenes Konto ist. */
    const found = outliersIn(bruno.transactions, bruno.accounts, { ...window, budget: flat(0) })
    // Sonst liefe die Prüfung über eine leere Liste und wäre keine.
    expect(found.length).toBeGreaterThan(0)
    for (const entry of found) {
      const { flow } = moneyFlow(entry.tx, { accounts: bruno.accounts, ownName: bruno.name })
      expect(flow, entry.tx.text).toBe('out')
    }

    /* Und der Gegenbeweis, gebaut statt an der Persona gemessen: ein Übertrag
       über CHF 20'000 auf das eigene Sparkonto. Er liegt weit über jeder
       Schwelle und darf trotzdem nicht in der Liste stehen. Gebaut, weil das
       sonst an Testdaten hängt, die sich ändern — und dann prüft der Test
       irgendwann nichts mehr. */
    const savings = bruno.accounts.find((account) => account.kind === 'savings')!
    const transfer: Transaction = {
      id: 'probe-transfer',
      accountId: bruno.accounts[0].id,
      date: TODAY,
      text: 'ÜBERTRAG AUF SPARKONTO',
      amount: -2_000_000,
      currency: 'CHF',
      category: 'transfer',
      counterAccountId: savings.id,
    }
    const withTransfer = outliersIn([...bruno.transactions, transfer], bruno.accounts, {
      ...window,
      budget: flat(0),
    })
    expect(withTransfer.some((entry) => entry.tx.id === 'probe-transfer')).toBe(false)
  })

  it('bleibt im Fenster', () => {
    const found = outliersIn(bruno.transactions, bruno.accounts, { ...window, budget: flat(0) })
    expect(found.length).toBeGreaterThan(0)
    for (const entry of found) {
      expect(entry.tx.date >= window.from && entry.tx.date <= window.to).toBe(true)
    }
  })
})

describe('Die erreichbare Reserve', () => {
  it('zählt Sparkonten, aber nicht das gebundene 3a', () => {
    /* Brunos Anzahlung Heizung kann nicht aus einem Vorsorgekonto bezahlt
       werden, das bis zur Pensionierung gebunden ist. Eine Anzeige, die es
       als Deckung ausgibt, hilft niemandem. */
    expect(reachableReserve(bruno.accounts)).toBeLessThan(savingsBalance(bruno.accounts))
    expect(reachableReserve(bruno.accounts)).toBe(
      bruno.accounts
        .filter((account) => account.kind === 'savings')
        .reduce((total, account) => total + (account.balanceChf ?? account.balance), 0),
    )
  })

  it('sagt null, wo es kein Sparkonto gibt', () => {
    /* Gebaut statt an einer Persona gemessen: Wer nur ein Privatkonto und ein
       3a hat, hat keine erreichbare Reserve — und dieser Fall muss geprüft
       bleiben, auch wenn morgen jede Persona ein Sparkonto bekommt. */
    const accounts = bruno.accounts.filter((account) => account.kind !== 'savings')
    expect(accounts.some((account) => account.kind === 'retirement3a')).toBe(true)
    expect(reachableReserve(accounts)).toBe(0)
  })
})
