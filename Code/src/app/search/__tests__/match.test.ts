import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { fold, matchesText, score, searchList, tokenize } from '../match'

describe('fold', () => {
  it('legt Umlaut, Umschrift und blosse Schreibweise zusammen', () => {
    expect(fold('Übertragen')).toBe(fold('Uebertragen'))
    expect(fold('Übertragen')).toBe(fold('ubertragen'))
    expect(fold('Serviceaufträge')).toBe(fold('Serviceauftraege'))
  })

  it('wirft Satzzeichen weg und lässt einzelne Wörter stehen', () => {
    expect(fold('E-Mail-Adresse')).toBe('e mail adresse')
    expect(fold('  Face  ID  ')).toBe('face id')
  })
})

describe('tokenize', () => {
  it('zerlegt in Wörter', () => {
    expect(tokenize('twint limite')).toEqual(['twint', 'limite'])
  })

  it('gibt für einen leeren Begriff nichts zurück', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('score', () => {
  const item = { title: 'Kontostand-Warnung', path: 'Benachrichtigungen', keywords: ['schwelle'] }

  it('wertet den Titel höher als das Stichwort und das Stichwort höher als den Weg', () => {
    expect(score(item, ['kontostand'])).toBeGreaterThan(score(item, ['schwelle']))
    expect(score(item, ['schwelle'])).toBeGreaterThan(score(item, ['benachrichtigungen']))
  })

  it('verlangt jedes Wort — nicht irgendeines', () => {
    expect(score(item, ['kontostand', 'schwelle'])).toBeGreaterThan(0)
    expect(score(item, ['kontostand', 'hypothek'])).toBe(0)
  })

  it('ist ohne Begriff null', () => {
    expect(score(item, [])).toBe(0)
  })
})

/** Was jemand tippt → was ganz oben stehen muss. */
const EXPECTED: [string, string][] = [
  ['twint', 'set.twint'],
  ['dark mode', 'set.app.theme'],
  ['dunkel', 'set.app.theme'],
  ['face id', 'set.login.faceid'],
  ['fingerabdruck', 'set.login.faceid'],
  ['sprache', 'set.app.language'],
  ['passwort', 'set.login.password'],
  ['ebill', 'set.pay.ebill'],
  ['adresse', 'set.profile.address'],
  ['scannen', 'fn.scan'],
  ['qr', 'fn.scan'],
  ['abo', 'fn.recurring'],
  ['ubertragen', 'fn.transfer'],
  ['einstellungen', 'fn.settings'],
]

describe('searchList über den Katalog', () => {
  for (const [query, id] of EXPECTED) {
    it(`«${query}» führt auf ${id}`, () => {
      const hits = searchList(CATALOG, query)
      expect(hits[0]?.id).toBe(id)
    })
  }

  it('trennt zwei Wörter, die einzeln zu viel finden würden', () => {
    const broad = searchList(CATALOG, 'limite')
    const narrow = searchList(CATALOG, 'twint limite')
    expect(broad.length).toBeGreaterThan(narrow.length)
    expect(narrow[0]?.id).toBe('set.twint.limit')
  })

  it('sucht erst ab zwei Zeichen', () => {
    expect(searchList(CATALOG, 'e')).toEqual([])
    expect(searchList(CATALOG, '')).toEqual([])
  })

  it('hält die Obergrenze ein', () => {
    expect(searchList(CATALOG, 'zahlung', 3).length).toBeLessThanOrEqual(3)
  })

  it('vergibt keine zwei gleichen Kennungen', () => {
    const ids = CATALOG.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('matchesText', () => {
  it('findet den Buchungstext des Auszugs trotz Umschrift', () => {
    expect(matchesText('UEBERTRAG AUF SPARKONTO', tokenize('übertrag'))).toBe(true)
    expect(matchesText('TWINT KAUF/DIENSTLEISTUNG VOM 22.08.2026 BURGER LAB BERN (CH)', tokenize('burger lab'))).toBe(true)
  })

  it('verlangt alle Wörter', () => {
    expect(matchesText('MIGROS BERN', tokenize('migros zurich'))).toBe(false)
  })

  it('ist ohne Begriff falsch', () => {
    expect(matchesText('MIGROS BERN', [])).toBe(false)
  })
})
