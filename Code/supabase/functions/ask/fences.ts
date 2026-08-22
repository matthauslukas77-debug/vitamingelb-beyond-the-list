/**
 * ── Der Themenzaun ─────────────────────────────────────────────────────────
 * Was der Assistent nicht bedient — und zwar ausdrücklich, nicht schlecht.
 *
 * Diese Datei liegt bei der Edge Function und nicht im Browser, obwohl beide
 * sie brauchen. Der Grund ist der Angriffsweg: Der Endpunkt ist öffentlich
 * erreichbar, und ein Zaun, der nur im Browser steht, ist mit einem `curl`
 * umgangen. Die Prüfung im Browser bleibt trotzdem — dort spart sie den
 * Netzaufruf und hält die Frage auf dem Gerät.
 *
 * ── Warum keine Wortgrenze am Ende ────────────────────────────────────────
 *
 * Die erste Fassung schrieb `\b(anleg|investier|…)\b`. Das abschliessende
 * `\b` verlangt eine Wortgrenze **nach** dem Stamm — und damit trifft
 * «investier» das Wort «investieren» nicht. Gemessen: «Soll ich investieren?»,
 * «Wie lege ich mein Geld an?», «Was ist mit meiner Altersvorsorge?» und
 * «Wie hoch ist mein Hypothekarzins?» liefen alle vier durch. Die eigenen
 * Tests hatten das nicht gemerkt, weil in ihren Beispielsätzen zufällig ein
 * anderes Wort der Liste stand («Fonds», «3a»).
 *
 * Stämme stehen deshalb ohne Schluss-`\b`. Der Preis sind Falschtreffer —
 * «Soll ich Netflix kündigen?» wird abgelehnt. Das ist der günstigere Fehler.
 *
 * ── Was der Zaun nicht leistet ────────────────────────────────────────────
 *
 * Er ist eine Sperrliste, und deutsche Wortbildung ist nicht abzählbar. Er
 * muss auch nicht dicht sein: Der Ausgang dieser Funktion ist ein
 * Werkzeugname aus einem Katalog von sechs oder gar nichts. Eine
 * durchgerutschte Anlagefrage kann höchstens eine gerechnete Zahl über die
 * eigenen Buchungen auslösen — nie eine Beratung.
 */

export interface Fence {
  pattern: RegExp
  text: string
}

export const FENCES: Fence[] = [
  {
    /* Stämme ohne Schluss-Wortgrenze. `fonds` statt `fond`, sonst trifft es
       Fondue; `hypothekarzins|zinssatz` statt `zins`, sonst trifft es den
       Buchungstext «Sollzins Kontoueberzug». */
    /* Ohne führende Wortgrenze, weil Deutsch zusammensetzt: «Altersvorsorge»
       trägt «vorsorg» in der Mitte, «Hypothekarzins» das «hypothek». Ein
       `\b` davor hätte beide durchgelassen — gemessen. */
    pattern:
      /(anlag|anleg|investier|investit|aktien|fonds|krypto|bitcoin|rendite|dividend|wertschrift|vorsorg|pensionskasse|freizuegigkeit|saeule 3|3 saeule|hypothek|zinssatz|steueroptimier)|\b(aktie|etf|3a|depot|zinsen)\b|\b(lege|legen|legt) ich? ?[a-z ]{0,20}an\b/,
    text:
      'Zu Anlagen, Vorsorge und Hypotheken sage ich nichts — dafür bin ich nicht gebaut, und eine ' +
      'halbe Antwort wäre hier schlechter als keine. Was ich kann: zeigen, was du hast, was ' +
      'regelmässig abgeht und was sich verändert hat.',
  },
  {
    /* Michaels Frage trifft keines der Fachwörter oben — sie lautet «wo
       bekomme ich die am schlausten her». Gefährlich ist nicht die Vokabel,
       sondern die Form: eine Optimierungsfrage mit Betrag und Termin. */
    pattern:
      /\b(wo|woher)\s+(bekomme|kriege|nehme|hole)\s+ich\b|\bam (schlausten|klugsten|besten|cleversten|guenstigsten)\b|\bwie komme ich (an|zu)\b/,
    text:
      'Wo Geld am besten hinkommt oder herkommt, sage ich nicht — das ist eine Beratungsfrage, ' +
      'und eine halbe Antwort wäre hier schlechter als keine. Was ich dazu beitragen kann: was ' +
      'du heute zur Seite legst, was regelmässig abgeht und was am Monatsende übrig bleibt.',
  },
  {
    pattern:
      /\b(was fuer ein (geld)?typ|persoenlichkeit|charakter|bin ich (geizig|sparsam|schlecht|gut|vernuenftig)|wie bin ich so mit geld)/,
    text:
      'Über dich als Person sage ich nichts. Ich rechne mit deinen Buchungen, und daraus lässt ' +
      'sich kein Urteil ableiten — nur Beträge, Rhythmen und Veränderungen.',
  },
  {
    /* Lookahead statt Reihenfolge: «Was würdest du mir raten zu kündigen?»
       und «Soll ich das kündigen?» sollen beide greifen. */
    pattern:
      /(?=.*\b(soll ich|sollte ich|empfiehlst du|empfehlung|wuerdest du|rat(e|en)? (mir|du)|tipp))(?=.*\b(kaufen|kuendig|abschliess|wechsel|umstell|aufloes))/,
    text:
      'Was du tun sollst, entscheidest du. Ich lege die Zahlen daneben, die dafür nötig sind — ' +
      'frag mich nach dem Betrag, der Häufigkeit oder der Veränderung.',
  },
]

/**
 * Prüft eine bereits normalisierte Frage gegen alle Zäune.
 * Gibt den Absagetext zurück, oder `null`, wenn nichts greift.
 */
export function fenceFor(normalised: string): string | null {
  for (const fence of FENCES) {
    if (fence.pattern.test(normalised)) return fence.text
  }
  return null
}

/**
 * Die Vergleichsform.
 *
 * Muss zeichengleich zu `plain()` im Browser sein — sonst prüft der Server
 * einen anderen Text als der Client, und genau in dieser Lücke sitzt der
 * nächste Fehler. Ein Test hält beide zusammen.
 */
export function normalise(text: unknown): string {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    /* Erst nach der Umschrift zerlegen: NFKD spaltet «ä» in a + Trema, und
       das Trema fällt zwei Zeilen später weg — die Umschrift käme dann nie
       zum Zug und «Wofür» hiesse «wofur». Gemessen, nicht vermutet. */
    .normalize('NFKD')
    .replace(/[\u0300-\u036F\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

