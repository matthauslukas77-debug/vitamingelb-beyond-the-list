import { describe, expect, it } from 'vitest'
import { BRANDS } from '../brands.data'
import { LOGO_BACKGROUNDS } from '../logo-backgrounds'
import { resolveBrand } from '../brands'

/**
 * Die Scheibenfarben sind erzeugt (siehe `logo-backgrounds.ts`). Geprüft wird
 * hier nicht, ob eine Farbe die *richtige* ist — das entscheidet das Auge am
 * Kontaktbogen. Geprüft wird, dass die Tabelle zum Markenverzeichnis passt und
 * die Fälle drinstehen, um die es ging.
 */

const logos = new Set(BRANDS.map((brand) => brand.logo))

describe('LOGO_BACKGROUNDS', () => {
  it('nennt nur Logos, die es im Markenverzeichnis gibt', () => {
    const fremd = Object.keys(LOGO_BACKGROUNDS).filter((file) => !logos.has(file))
    expect(fremd).toEqual([])
  })

  it('enthält lauter gültige Hex-Farben in Grossschreibung', () => {
    for (const [file, hex] of Object.entries(LOGO_BACKGROUNDS)) {
      expect(hex, file).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('führt Weiss nicht auf — das ist der Standard der Scheibe', () => {
    const weiss = Object.entries(LOGO_BACKGROUNDS).filter(([, hex]) => hex === '#FFFFFF')
    expect(weiss).toEqual([])
  })

  /**
   * Der Anlass für das Ganze: TWINT ist eine breite Wortmarke auf Schwarz. Auf
   * der weissen Scheibe schaute oben und unten das Weiss heraus — als eckiges
   * Logo im runden Feld. Jetzt ist die Scheibe schwarz.
   */
  it('gibt der breiten TWINT-Wortmarke ihr Schwarz', () => {
    expect(LOGO_BACKGROUNDS['twint.svg']).toBe('#000000')
  })

  /**
   * Die Gegenprobe des Erzeugers: Das «n» von Negishi läuft selbst bis an den
   * Rand. Seine Randfarbe ist die des Zeichens — die Scheibe darin würde das
   * Logo auslöschen. Deshalb steht es bewusst NICHT in der Tabelle.
   */
  it('lässt Logos aus, die von ihrer eigenen Randfarbe verschluckt würden', () => {
    expect(LOGO_BACKGROUNDS['negishi.svg']).toBeUndefined()
  })

  it('reicht die Farbe bis zum Markentreffer durch', () => {
    /* Eine gesendete TWINT-Zahlung: Hier steht wirklich TWINT dahinter.
       Der Kauf im Laden dagegen gehört dem Laden — «TWINT KAUF/DIENSTLEISTUNG
       VOM … BURGER LAB BERN» löst absichtlich nicht mehr auf TWINT auf, sonst
       sammelt eine Blase 64 Einkäufe an 20 Orten (siehe `PROCESSORS`). */
    const twint = resolveBrand('TWINT GELD GESENDET VOM 22.08.2026 AN SVEN AEBI')
    expect(twint?.bg).toBe('#000000')
    expect(resolveBrand('TWINT KAUF/DIENSTLEISTUNG VOM 22.08.2026 BURGER LAB BERN (CH)')).toBeNull()
  })

  it('lässt die Farbe weg, wo keine gemessen wurde', () => {
    const match = resolveBrand('SPOTIFY AB')
    expect(match?.brand.key).toBe('spotify')
    expect(match?.bg).toBe(LOGO_BACKGROUNDS['spotify.png'])
  })
})
