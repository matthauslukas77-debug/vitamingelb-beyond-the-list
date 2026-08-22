import { resolveBrand } from '../../data/brands'
import type { Transaction } from '../../data/types'
import { normaliseMerchant } from '../../domain/recurring'
import { parseBooking, prettyName } from '../../domain/booking'
import { pretty } from '../../app/screens/Recurring'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Wer steht hinter einer Buchung — als Name und als Schlüssel.
 *
 * Eigene Datei, weil zwei Richtungen darauf zugreifen: `mapping.ts` ordnet
 * damit zu, `assign.ts` merkt sich damit die Zuordnung von Hand. Lägen beide
 * Seiten in `mapping.ts`, importierten sie einander im Kreis.
 *
 * Der **Schlüssel** ist die eigentliche Erfindung hier. Die heutige App lässt
 * eine Kategorie pro *Buchung* setzen — neunzehn LANDI-Einkäufe sind neunzehn
 * Handgriffe, und der zwanzigste kommt wieder falsch herein. Ein Schlüssel pro
 * *Quelle* macht daraus einen Handgriff, der auch für die Zukunft gilt.
 */

/**
 * Bargeldbezug am Automaten — die Verwendung steht nirgends.
 *
 * Stand vorher in `mapping.ts`. Hier, weil beide Seiten dieselbe Grenze
 * ziehen müssen: Was als Bargeld gilt, bekommt einen gemeinsamen Schlüssel
 * statt eines pro Automat.
 */
export const CASH = /(BARGELDBEZUG|POSTOMAT|BANCOMAT|GELDAUTOMAT|ATM)/i

export function isCashWithdrawal(tx: Transaction): boolean {
  return tx.category === 'cash' || CASH.test(tx.text)
}

/**
 * Der lesbare Name der Gegenpartei — eine Stelle für alle, die ihn brauchen.
 *
 * Erst die Marke aus der Registry: Sie kennt den Namen besser als der
 * Buchungstext («Adobe Creative Cloud» statt «ADOBE *CREATIVE CLOUD INC»).
 * Sonst der Händler, den `parseBooking` aus dem Text schneidet — er steht in
 * der Zeile ganz hinten, hinter Zahlungsart, Datum und Kartennummer. Ohne
 * diesen Schritt steht auf einer Signalkarte «Kauf/online-shopping VOM
 * 07.08.2026 Karten NR. Xxxx9042 Microspot» statt «Microspot».
 */
export function merchantName(tx: Transaction): string {
  const brand = resolveBrand(tx.text)
  if (brand) return brand.brand.name
  const counterparty = parseBooking(tx).counterparty
  if (counterparty) return prettyName(counterparty)
  return pretty(tx.text)
}

/**
 * Der Schlüssel, unter dem eine Zuordnung von Hand gemerkt wird.
 *
 * Er ist bewusst **genau das, was auf dem Chip steht**. Wer «LANDI» in einen
 * Topf zieht, soll nicht raten müssen, welche anderen Buchungen mitgehen: Es
 * sind die, die auch «LANDI» heissen. Ein Schlüssel aus dem Rohtext wäre
 * feiner, aber «LANDI BERN» und «LANDI THUN» wären zwei Quellen — zwei
 * Handgriffe für dieselbe Entscheidung.
 *
 * Drei Stufen, in dieser Reihenfolge:
 *   1. **Bargeld** — alle Bezüge sind eine einzige Quelle. Der Automat, an
 *      dem man stand, sagt nichts darüber, wofür das Geld ausgegeben wurde.
 *   2. **Marke** — stabil über Filialen und Schreibweisen hinweg, denn die
 *      Registry löst sie alle auf denselben Eintrag auf.
 *   3. **Name** — der aufgeräumte Text, gross geschrieben.
 */
export function merchantKey(tx: Transaction): string {
  if (isCashWithdrawal(tx)) return 'bargeld'
  const brand = resolveBrand(tx.text)
  if (brand) return `marke:${brand.brand.key}`
  const name = merchantName(tx).toUpperCase().trim()
  /* Ein leerer Name käme von einer Buchung ohne erkennbare Gegenpartei. Ihr
     einen Schlüssel zu geben, hiesse alle davon in einen Topf zu werfen —
     lieber der Rohtext, dann bleibt sie für sich. */
  return name ? `name:${name}` : `text:${normaliseMerchant(tx.text)}`
}

/**
 * Was auf dem Chip steht.
 *
 * Bargeld heisst «Bargeld» und nicht «Die Post»: Der Postomat löst über die
 * Markenregistry auf die Post auf, aber niemand hat bei der Post eingekauft.
 * Kurz gehalten, weil zwei Chips nebeneinander stehen — «Bargeld am Automaten»
 * bräche auf jedem Telefon ab.
 */
export function merchantLabel(tx: Transaction): string {
  return isCashWithdrawal(tx) ? 'Bargeld' : merchantName(tx)
}
