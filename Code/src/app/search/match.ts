/**
 * Das Zuordnen von Suchbegriff zu Eintrag — ohne React, damit es prüfbar ist.
 *
 * Zwei Dinge, die eine deutsche Banksuche können muss und eine naive
 * `includes`-Suche nicht kann:
 *
 *  1. Umlaute falten. Wer «uebertragen» oder «ubertragen» tippt, meint
 *     «Übertragen». Der Buchungstext des Auszugs schreibt ohnehin «UEBERTRAG».
 *  2. Mehrere Wörter. «twint limite» soll die TWINT-Limite finden, obwohl kein
 *     Feld beide Wörter am Stück enthält.
 *
 * Absichtlich keine Tippfehlertoleranz: Bei neun Einstellungsseiten und rund
 * vierzig Einträgen bringt sie mehr Falschtreffer als Nutzen, und ein
 * Falschtreffer ganz oben ist teurer als ein fehlender Treffer.
 */

/** Mindestlänge, ab der gesucht wird. Darunter ist jede Liste Rauschen. */
export const MIN_QUERY = 2

export interface Searchable {
  /** Was in der Zeile steht. */
  title: string
  /** Wo es liegt, z.B. «Profil und Einstellungen · Login und Sicherheit». */
  path?: string
  /** Begriffe, unter denen gesucht wird, die aber nicht im Titel stehen. */
  keywords?: string[]
}

const UMLAUTS: Record<string, string> = {
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss',
  à: 'a', á: 'a', â: 'a', è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ò: 'o', ó: 'o', ô: 'o', ù: 'u', ú: 'u', û: 'u', ç: 'c',
}

/**
 * Vergleichsform eines Textes: klein, ohne Akzente, ohne Satzzeichen.
 *
 * Umlaute werden zuerst ausgeschrieben (ü → ue) und danach das «e» getilgt
 * (ue → u). So landen «über», «ueber» und «uber» auf derselben Form — sonst
 * findet nur eine der drei Schreibweisen den Eintrag.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äöüßàáâèéêëìíîòóôùúûç]/g, (char) => UMLAUTS[char] ?? char)
    .replace(/([aou])e/g, '$1')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Suchbegriff in einzelne Wörter zerlegen, jedes schon in Vergleichsform. */
export function tokenize(query: string): string[] {
  const folded = fold(query)
  return folded.length === 0 ? [] : folded.split(' ')
}

/* Wie gut ein einzelnes Wort in ein einzelnes Feld passt. Ein Treffer am
   Wortanfang wiegt doppelt, ein Feld, das genau dem Wort entspricht, dreifach:
   Wer «twint» tippt, will die TWINT-Seite und nicht die Zeile, in der TWINT
   irgendwo in einem Nebensatz vorkommt. */
function quality(field: string, token: string): number {
  if (field === token) return 3
  if (field.startsWith(token) || field.includes(` ${token}`)) return 2
  return field.includes(token) ? 1 : 0
}

const WEIGHT = { title: 100, keyword: 40, path: 15 } as const

/**
 * Punktzahl eines Eintrags. 0 heisst: kein Treffer.
 *
 * Jedes Wort des Suchbegriffs muss irgendwo vorkommen (UND, nicht ODER) —
 * «twint limite» darf nicht jede TWINT-Zeile zurückgeben. Pro Wort zählt das
 * beste Feld, die Werte werden addiert.
 */
export function score(item: Searchable, tokens: string[]): number {
  if (tokens.length === 0) return 0

  const title = fold(item.title)
  const path = item.path ? fold(item.path) : ''
  const keywords = (item.keywords ?? []).map(fold)

  let total = 0
  for (const token of tokens) {
    const best = Math.max(
      quality(title, token) * WEIGHT.title,
      ...keywords.map((keyword) => quality(keyword, token) * WEIGHT.keyword),
      quality(path, token) * WEIGHT.path,
    )
    if (best === 0) return 0
    total += best
  }

  /* Bei gleicher Punktzahl gewinnt der knappere und der höher gelegene
     Eintrag: «eBill» vor «Neue eBill-Rechnung», «Einstellungen» im Reiter
     Services vor «App-Einstellungen» zwei Ebenen tiefer. Der Abzug bleibt
     unter 0.5 und kann deshalb keine Gewichtsstufe kippen. */
  return total - (Math.min(title.length, 20) + Math.min(path.length, 40) / 2) / 100
}

/** Die Treffer, absteigend nach Punktzahl. Ohne Treffer eine leere Liste. */
export function searchList<T extends Searchable>(items: T[], query: string, limit?: number): T[] {
  const folded = fold(query)
  if (folded.length < MIN_QUERY) return []
  const tokens = folded.split(' ')

  const hits: { item: T; points: number }[] = []
  for (const item of items) {
    const points = score(item, tokens)
    if (points > 0) hits.push({ item, points })
  }

  hits.sort((a, b) => b.points - a.points)
  return (limit ? hits.slice(0, limit) : hits).map((hit) => hit.item)
}

/** Ob ein freier Text (Buchungstext, Kontoname) alle Wörter enthält. */
export function matchesText(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  const folded = fold(text)
  return tokens.every((token) => folded.includes(token))
}
