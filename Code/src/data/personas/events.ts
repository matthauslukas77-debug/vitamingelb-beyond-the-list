import type { Category, Transaction } from '../types'

/**
 * Werkzeug für die Ereignisse in den Persona-Dateien.
 *
 * Die generierten Buchungen in `<id>.data.ts` bilden den Alltag ab und sind
 * bewusst gleichmässig — jede Persona bekam über 23 Monate exakt denselben
 * Lohnbetrag. Was ihnen fehlt, ist das Unerwartete: ein Jobwechsel, ein
 * dreizehnter Monatslohn, ein Bonus. Genau darum geht es auf dem
 * Signale-Bildschirm.
 *
 * Diese Ereignisse stehen deshalb in der **von Hand gepflegten** Datei
 * `<id>.ts`, neben Konten und Daueraufträgen, jedes mit dem Muster, das es
 * belegen soll. Der Generator bleibt unangetastet.
 */

export interface JobChange {
  /** Ab diesem Datum zahlt der neue Arbeitgeber. */
  since: string
  /** Woran die alten Lohnbuchungen zu erkennen sind. */
  match: RegExp
  /** Der neue Buchungstext, im Format des Auszugs. */
  text: string
  /** Der neue Betrag in Rappen, positiv. */
  amount: number
  /** Präfix der neuen Buchungs-Ids. */
  idPrefix: string
}

/**
 * Ersetzt die Lohnbuchungen ab einem Datum durch die eines neuen Arbeitgebers.
 *
 * Bewusst als Ersetzung und nicht als Ergänzung: Wer den Arbeitgeber wechselt,
 * bekommt nicht zwei Löhne. Die neuen Buchungen übernehmen Datum und Konto der
 * alten, damit der Rhythmus stimmt — der 25. bleibt der 25.
 *
 * Der Kontostand von heute bleibt, wie er ist; er ist der Anker, von dem der
 * Verlauf rückwärts gerechnet wird (`insights/engine/balance.ts`). Was sich
 * ändert, ist die Vergangenheit — und das ist richtig so: Mit dem höheren Lohn
 * stand vorher weniger auf dem Konto.
 */
export function withJobChange(transactions: Transaction[], change: JobChange): Transaction[] {
  const replaced: Transaction[] = []

  const kept = transactions.filter((tx) => {
    const isOldSalary = tx.amount > 0 && tx.date >= change.since && change.match.test(tx.text)
    if (!isOldSalary) return true
    replaced.push({
      ...tx,
      id: `${change.idPrefix}-${tx.date}`,
      text: change.text,
      amount: change.amount,
    })
    return false
  })

  return [...kept, ...replaced]
}

export interface Rename {
  /** Woran die Buchungen zu erkennen sind. */
  match: RegExp
  /** Was stattdessen dasteht. */
  text: string
}

/**
 * Schreibt Buchungstexte um.
 *
 * Der Generator kennt die Gegenpartei nicht und schreibt «KRANKENKASSE
 * PRAEMIE». Ein echter LSV-Auszug nennt die Kasse beim Namen — und erst damit
 * findet die Markenregistry ein Logo, statt dass eine der grössten Blasen
 * jeder Person gesichtslos bleibt.
 *
 * Die Umbenennung steht hier und nicht in `<id>.data.ts`: Die generierte Datei
 * wird bei jedem Lauf neu geschrieben, und an dieser Stelle sieht man auf
 * einen Blick, welche Kasse zu welcher Person gehört.
 */
export function withRenamed(transactions: Transaction[], ...renames: Rename[]): Transaction[] {
  return transactions.map((tx) => {
    const hit = renames.find((rename) => rename.match.test(tx.text))
    return hit ? { ...tx, text: hit.text } : tx
  })
}

export interface Raise {
  /** Ab diesem Datum gilt der neue Betrag. */
  since: string
  /** Woran die Buchungen der Reihe zu erkennen sind. */
  match: RegExp
  /** Der neue Betrag in Rappen, positiv. */
  amount: number
  idPrefix: string
}

/**
 * Dieselbe Reihe, ab einem Datum mit einem anderen Betrag — die Lohnerhöhung.
 *
 * Der Unterschied zu `withJobChange` ist der Text: Er **bleibt**. Damit bleibt
 * es eine einzige Reihe, und `findPriceChange` sieht eine Veränderung statt
 * zweier Arbeitgeber. Auf der Signalkarte ist das der Unterschied zwischen
 * «CHF 200 mehr Lohn» und «neuer Arbeitgeber».
 */
export function withRaise(transactions: Transaction[], raise: Raise): Transaction[] {
  return transactions.map((tx) =>
    tx.amount > 0 && tx.date >= raise.since && raise.match.test(tx.text)
      ? { ...tx, id: `${raise.idPrefix}-${tx.date}`, amount: raise.amount }
      : tx,
  )
}

export interface Omission {
  /** Woran die Buchungen zu erkennen sind. */
  match: RegExp
  /** Ab diesem Datum, einschliesslich. */
  from: string
  /** Bis zu diesem Datum, einschliesslich. Fehlt es, bis ans Ende. */
  to?: string
}

/**
 * Lässt Buchungen weg — die Belastung, die nicht kam.
 *
 * Eine ausgebliebene Lastschrift ist kein fehlender Datensatz, sondern ein
 * Ereignis: Entweder wurde gekündigt, oder das Konto war leer. Der Motor
 * erkennt sie daran, dass eine monatliche Reihe ihren Termin überschritten hat
 * (`missedSignals`) — dafür muss die Buchung im Datensatz wirklich fehlen.
 */
export function withoutBookings(transactions: Transaction[], omission: Omission): Transaction[] {
  return transactions.filter(
    (tx) =>
      !(
        omission.match.test(tx.text) &&
        tx.date >= omission.from &&
        (omission.to === undefined || tx.date <= omission.to)
      ),
  )
}

/** Letzter Tag des Monats — `new Date(y, m, 0)` ist der Tag vor dem Ersten. */
function lastDayOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function isoDate(year: number, month: number, day: number): string {
  const clamped = Math.min(day, lastDayOf(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

export interface DayShift {
  /** Woran die Buchungen der Reihe zu erkennen sind. */
  match: RegExp
  /** Der neue Tag im Monat. Kürzere Monate kürzen ihn. */
  day: number
  /** Stichtag. Was danach zu liegen käme, ist noch nicht gebucht und fällt weg. */
  today: string
}

/**
 * Verschiebt eine Reihe auf einen anderen Tag im Monat.
 *
 * Wozu: «Was bis Ende Monat noch abgeht» kann nur zeigen, was noch aussteht.
 * Liegen alle Reihen einer Person am Monatsanfang, steht dort am 22. eine
 * Null — richtig gerechnet und trotzdem keine Auskunft.
 *
 * Was hinter den Stichtag fällt, wird **entfernt** statt datiert: Eine
 * Belastung, die erst in fünf Tagen kommt, steht nicht im Kontoauszug. Genau
 * so wird sie zur Erwartung, die die Karte anzeigt.
 */
export function withShiftedDay(transactions: Transaction[], shift: DayShift): Transaction[] {
  const out: Transaction[] = []
  for (const tx of transactions) {
    if (!shift.match.test(tx.text)) {
      out.push(tx)
      continue
    }
    const [year, month] = tx.date.split('-').map(Number)
    const date = isoDate(year, month, shift.day)
    if (date > shift.today) continue
    out.push({ ...tx, date })
  }
  return out
}

export interface MonthlySeries {
  idPrefix: string
  accountId: string
  /** Der Buchungstext, wie ihn der Auszug zeigt. */
  text: string
  /** Rappen. Negativ für eine Belastung. */
  amount: number
  category: Category
  /** Tag im Monat. Kürzere Monate kürzen ihn. */
  day: number
  /** Erster und letzter Monat, `YYYY-MM`, beide einschliesslich. */
  from: string
  to: string
  seriesId?: string
}

/**
 * Eine monatliche Reihe von Hand — für alles, was der Generator nicht kennt.
 *
 * Drei Buchungen reichen `detectRecurring` für eine Reihe; zwei erzeugen
 * bewusst nur den Abo-Verdacht. Wer hier ein Fenster wählt, wählt damit auch,
 * welche der beiden Karten erscheint.
 */
export function monthly(spec: MonthlySeries): Transaction[] {
  const [fromYear, fromMonth] = spec.from.split('-').map(Number)
  const [toYear, toMonth] = spec.to.split('-').map(Number)
  const out: Transaction[] = []

  for (let index = 0; ; index++) {
    const month = fromMonth + index
    const year = fromYear + Math.floor((month - 1) / 12)
    const inYear = ((month - 1) % 12) + 1
    if (year > toYear || (year === toYear && inYear > toMonth)) break

    const date = isoDate(year, inYear, spec.day)
    out.push({
      id: `${spec.idPrefix}-${date}`,
      accountId: spec.accountId,
      date,
      text: spec.text,
      amount: spec.amount,
      currency: 'CHF',
      category: spec.category,
      ...(spec.seriesId ? { seriesId: spec.seriesId } : {}),
    })
  }

  return out
}

export interface Variant {
  /** Der Laden, wie er im Auszug stünde — ohne Vorspann und ohne Land. */
  merchant: string
  /** Nur setzen, wo der Laden in eine andere Kategorie gehört als der Klumpen. */
  category?: Category
}

export interface Spread {
  /** Woran die Buchungen des Klumpens zu erkennen sind. */
  match: RegExp
  /** Wie der Auszug die Zeile baut. `date` kommt als «TT.MM.JJJJ». */
  text: (merchant: string, date: string) => string
  /** Die Läden, der Reihe nach durchgereicht. */
  variants: Variant[]
  /** Jede wievielte Buchung unverändert bleibt. 0 oder fehlend: keine. */
  keepEvery?: number
}

/**
 * Verteilt einen Klumpen anonymer Buchungen auf echte Läden.
 *
 * Wozu: «SIX PAYMENT 21903 BERN» ist der Acquirer, nicht der Laden — hinter
 * der Terminalnummer steht ein Café, ein Take-away, ein Kiosk. Im Datensatz
 * sind es 18 bis 41 Buchungen je Person, die zu **einer** bedeutungslosen
 * Blase verklumpen: der grösste Posten ohne Aussage.
 *
 * `keepEvery` lässt bewusst einen Teil stehen. Der anonyme Terminaltext ist
 * kein Mangel des Datensatzes, sondern die Wahrheit über Kartenzahlungen —
 * und das Argument der ganzen Challenge: Die App weiss selbst nicht, wo du
 * warst. Ein paar davon gehören ins Bild.
 *
 * Die Zuteilung läuft reihum über den Zähler der Treffer, nicht über den
 * Zufall: Derselbe Datensatz ergibt bei jedem Laden dieselbe Buchung.
 */
export function withVariants(transactions: Transaction[], spread: Spread): Transaction[] {
  let seen = -1
  return transactions.map((tx) => {
    if (!spread.match.test(tx.text)) return tx
    seen += 1
    if (spread.keepEvery && seen % spread.keepEvery === 0) return tx

    const variant = spread.variants[seen % spread.variants.length]
    const [year, month, day] = tx.date.split('-')
    return {
      ...tx,
      text: spread.text(variant.merchant, `${day}.${month}.${year}`),
      ...(variant.category ? { category: variant.category } : {}),
    }
  })
}

