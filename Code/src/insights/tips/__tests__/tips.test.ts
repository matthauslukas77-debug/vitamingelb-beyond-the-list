import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../../app/search/catalog'
import { TIPS, resolvedTips } from '../tips'
import { NOTHING_SEEN, isSeen, unseenCount, withSeen } from '../seen'

/**
 * Die Tippliste borgt Titel, Weg, Symbol und Sprungziel aus dem Suchkatalog und
 * hält nur die zwei Erklärsätze selbst. Verbunden wird über die Kennung — also
 * über eine Zeichenkette, die kein Compiler prüft.
 *
 * Genau das prüfen diese Tests. Wer im Katalog eine Kennung umbenennt, sieht es
 * hier und nicht erst, wenn im Demo-Gespräch eine Zeile fehlt.
 */

describe('Tipps und Katalog', () => {
  it('jede Tipp-Kennung gibt es im Katalog', () => {
    const known = new Set(CATALOG.map((entry) => entry.id))
    const missing = TIPS.filter((tip) => !known.has(tip.id)).map((tip) => tip.id)
    expect(missing).toEqual([])
  })

  it('löst alle Tipps auf — keiner fällt still weg', () => {
    expect(resolvedTips()).toHaveLength(TIPS.length)
  })

  it('keine Kennung doppelt', () => {
    const ids = TIPS.map((tip) => tip.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('jeder Tipp hat beide Sätze, und sie sind ganze Sätze', () => {
    for (const tip of TIPS) {
      expect(tip.what.length, `what fehlt bei ${tip.id}`).toBeGreaterThan(20)
      expect(tip.how.length, `how fehlt bei ${tip.id}`).toBeGreaterThan(20)
      /* Ein Satz endet mit einem Punkt. Halbe Sätze lesen sich wie Notizen. */
      expect(tip.what.trimEnd().endsWith('.'), `what ohne Punkt bei ${tip.id}`).toBe(true)
      expect(tip.how.trimEnd().endsWith('.'), `how ohne Punkt bei ${tip.id}`).toBe(true)
    }
  })

  it('nennt nur eigene Funktionen, keine Einstellungen', () => {
    for (const tip of resolvedTips()) {
      expect(tip.entry.kind, `${tip.id} ist keine Funktion`).toBe('function')
    }
  })
})

describe('gesehen-Merker', () => {
  it('zählt am Anfang alle als neu', () => {
    expect(unseenCount(NOTHING_SEEN)).toBe(TIPS.length)
  })

  it('merkt eine aufgeklappte Funktion und zählt sie ab', () => {
    const seen = withSeen(NOTHING_SEEN, TIPS[0].id, '2026-08-22')
    expect(isSeen(seen, TIPS[0].id)).toBe(true)
    expect(unseenCount(seen)).toBe(TIPS.length - 1)
  })

  it('lässt den Merker unberührt, statt ihn zu verändern', () => {
    const before = { ...NOTHING_SEEN.ids }
    withSeen(NOTHING_SEEN, 'fn.analysis', '2026-08-22')
    expect(NOTHING_SEEN.ids).toEqual(before)
  })
})
