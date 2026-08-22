/**
 * Formulierungen aus den Interviews — der Prüfkorpus des Assistenten.
 *
 * Erzeugt aus den acht Gesprächen: je Werkzeug rund zwanzig Arten, dieselbe
 * Absicht auszudrücken, samt Tippfehlern, Mundartfärbung und Halbsätzen. Dazu
 * die gefährlichen Nachbarn — Fragen, die ähnlich klingen und etwas anderes
 * meinen.
 *
 * Der Korpus misst zwei Dinge: wie weit die Muster allein tragen, und wo der
 * Apertus-Router seinen Platz verdient. Er ist bewusst grösser als das, was
 * die Muster können — eine Abdeckung von 100 % wäre ein Zeichen dafür, dass
 * die Beispiele den Mustern nachgeschrieben wurden statt umgekehrt.
 */

export interface CorpusEntry {
  tool: string
  phrasings: string[]
  /** Klingt ähnlich, meint aber etwas anderes. */
  nearMisses: string[]
}

export const CORPUS: CorpusEntry[] = [
  {
    "tool": "topSpending",
    "phrasings": [
      "Wofür gebe ich am meisten aus?",
      "Wo geht mein Geld hin?",
      "Was habe ich am meisten ausgegeben?",
      "Für was habe ich am meisten Geld ausgegeben?",
      "Wo gebe ich am meisten Geld aus?",
      "Was ist meine grösste Ausgabe gewesen?",
      "wofür am meisten",
      "grösste posten?",
      "wo geht das ganze geld hin",
      "wofür gib ich am meisten geld aus",
      "wo geth das meiste geld hin?",
      "Wo geht bei mir am meisten raus?",
      "Welche Kategorie kostet mich im Monat am meisten?",
      "Zeig mir meine Ausgaben nach Kategorie.",
      "Wie viel geht pro Monat in welche Kategorie?",
      "Wofür geht mein Geld eigentlich alles drauf?",
      "Was frisst bei mir am meisten Geld?",
      "Wo verjubel ich mein Geld?",
      "Was leert mir am meisten das Portemonnaie?",
      "Geht bei mir wirklich am meisten fürs Essen drauf?",
      "Wär gäbig zu wissen, wofür wie viel rausgeht.",
      "Rangliste meiner Ausgabenkategorien bitte",
      "Was sind meine grössten Ausgabenposten im Monat?",
      "In welchen Bereich fliesst bei mir am meisten Geld?",
      "Sag mir mal, wo mein Geld hingeht."
    ],
    "nearMisses": [
      "Welche Abos habe ich eigentlich alle?",
      "Was war meine teuerste Einzelbuchung dieses Jahr?",
      "War dieser Monat eigentlich normal bei mir?",
      "Bin ich diesen Monat noch im Budget?",
      "Wie viel gebe ich eigentlich für Netflix aus?"
    ]
  },
  {
    "tool": "subscriptions",
    "phrasings": [
      "abos?",
      "Welche Abos habe ich?",
      "Welche Abos habe ich eigentlich alles am Laufen?",
      "Was zahle ich monatlich?",
      "abos anzeigen",
      "Zeig mir meine Abos und was sie kosten",
      "welche abbos laufen bei mir",
      "Was geht bei mir jeden Monat automatisch vom Konto?",
      "Abo Übersicht",
      "Es wäre noch gut, wenn ich sehen würde, welche Abos ich genau habe",
      "Was habe ich alles an wiederkehrenden Zahlungen?",
      "wiederkerende belastungen zeigen",
      "Wie viele Abos sind es und was kosten die zusammen im Monat?",
      "Was zieht mir jeden Monat Geld ab?",
      "Gib mir eine Liste von allem, was regelmässig abgebucht wird",
      "Habe ich noch irgendwo ein Abo am Laufen, das ich längst vergessen habe?",
      "Was kosten mich meine Abos aufs Jahr gerechnet?",
      "Netflix, Spotify und der ganze Rest — was läuft da alles bei mir?",
      "welche abonnemente hab ich",
      "Was sind meine fixen monatlichen Kosten?",
      "monatliche abbuchungen",
      "Was sind das für Sachen, wo jeden Monat abgehen?",
      "Wie viel ist jeden Monat schon weg für Abos, bevor ich überhaupt etwas ausgebe?",
      "Ich habe tonnenweise Abos — wie viel ist das eigentlich?"
    ],
    "nearMisses": [
      "Ist eines von meinen Abos teurer geworden?",
      "Was zahle ich monatlich fürs Essen?",
      "Wer ist die Firma, die da jeden Monat abbucht?",
      "Bin ich mit meinen fixen Sachen noch im Budget?",
      "Was war letztes Jahr meine grösste Belastung?"
    ]
  },
  {
    "tool": "merchantLookup",
    "phrasings": [
      "Wer ist das?",
      "Wer steckt hinter dieser Buchung?",
      "Da steht so ein komischer Firmenname, wer ist das?",
      "Was ist das für eine Firma, die da abbucht?",
      "Ich verstehe diesen Buchungstext nicht, kannst du ihn mir erklären?",
      "komischer name in der liste, wer isch das",
      "Da steht nur Apple, was ist das genau?",
      "Das ist doch der Name vom Kartenlesegerät und nicht vom Laden, wo war ich da?",
      "In der Buchung steht eine Adresse, wo ich gar nie eingekauft habe, was ist das?",
      "Muss ich das jetzt wieder googeln oder weisst du, wer das ist?",
      "Wer ist der Empfänger von dieser Zahlung?",
      "Wie viel habe ich bei Coop ausgegeben?",
      "wieviel bei migros augegeben dieses jahr",
      "Wie viel ist insgesamt an diese Firma gegangen?",
      "Wie viel habe ich bei diesem Händler über die Zeit gelassen?",
      "Wer ist Facebook auf meinem Konto und wie viel zieht der?",
      "Sag mir, wer das ist und wie viel dorthin geflossen ist.",
      "was ist das für ein laden",
      "Kannst du mir diesen Namen auflösen?",
      "Erklär mir bitte diese eine Buchung, den Namen kenne ich nicht.",
      "Bei welchem Geschäft war das, ich erkenne den Text nicht.",
      "Wie viel geht bei mir eigentlich an Apple?",
      "Wer ist das schon wieder, das kommt jeden Monat.",
      "Kenne ich diese Firma, und wie oft habe ich dort bezahlt?",
      "Wo genau habe ich das gekauft, es steht ein ganz anderer Name da."
    ],
    "nearMisses": [
      "Wofür gebe ich am meisten aus?",
      "Welche Abos habe ich eigentlich am Laufen?",
      "Wie viel kann ich diesen Monat noch ausgeben?",
      "Ist diesen Monat etwas Ungewöhnliches abgebucht worden?",
      "Wer hat mir da Geld überwiesen?"
    ]
  },
  {
    "tool": "budgetStatus",
    "phrasings": [
      "budget?",
      "bin ich im budget?",
      "budget ok diesen monat?",
      "wie steht mein budget?",
      "wie stehts mit mim budget",
      "bugdet stand bitte",
      "liege ich noch im plan?",
      "läuft der monat nach plan?",
      "halte ich mich diesen monat an mein budget?",
      "hab ich mein budget schon gesprengt?",
      "wie viel vom budget ist noch übrig?",
      "wieviel darf ich diesen monat noch ausgeben?",
      "wo bin ich über dem budget?",
      "welche kategorie ist über dem budget?",
      "kannst du das mal mit meinem budget abgleichen?",
      "vergleich das mit dem budget, wo müsste ich anpassen?",
      "bin ich drüber diesen monat?",
      "wie viel vom monatsbudget habe ich schon verbraucht?",
      "budget eingehalten bis jetzt?",
      "hab ich diesen monat zu viel ausgegeben, gemessen an dem was ich mir vorgenommen habe?",
      "bin ich beim essen schon über dem budget?",
      "wär noch gäbig zu wissen, ob ich diesen monat im budget bin",
      "zeig mir mal, wo ich im vergleich zum budget stehe",
      "ich glaube ich bin drüber, kannst du kurz schauen?",
      "stimmts noch mit dem was ich geplant hatte?"
    ],
    "nearMisses": [
      "Hilf mir, ein Budget aufzustellen — ich habe noch keins.",
      "Wofür gebe ich eigentlich am meisten aus?",
      "Wie viel zahle ich im Monat für meine Abos?",
      "War dieser Monat normal, oder ist etwas aus der Reihe gefallen?",
      "Reicht es noch bis Ende Monat?"
    ]
  },
  {
    "tool": "whatsUnusual",
    "phrasings": [
      "Was ist ungewöhnlich?",
      "auffälligkeiten?",
      "veränderungen?",
      "War dieser Monat normal?",
      "war der letzte monat normal oder nicht",
      "Was ist anders als sonst?",
      "Hat sich bei meinen Ausgaben etwas verändert?",
      "Gibt es etwas Komisches bei meinen Buchungen?",
      "Ist irgendwo etwas teuerer geworden?",
      "Ist ein Abo im Preis gestiegen, ohne dass ich es gemerkt habe?",
      "Zahle ich neu für etwas, das vorher nicht dabei war?",
      "Hat sich etwas eingeschlichen, das ich gar nicht mehr will?",
      "Gebe ich diesen Monat mehr aus als üblich?",
      "fällt irgendwas aus der reihe",
      "Sag mir, wenn etwas nicht stimmt.",
      "Sollte mir bei meinen Zahlungen etwas auffallen?",
      "Ist eine Zahlung ausgeblieben, die sonst immer kommt?",
      "Ist beim Lohn etwas anders als in den Monaten davor?",
      "was hat sich verändert seit letztem monat",
      "Gibt es neue regelmässige Belastungen bei mir?",
      "Ich habe das Gefühl, es geht mehr weg als sonst — stimmt das?",
      "hat sich in den letzten monaten etwas verschoben bei meinen ausgaben",
      "Ist da eine Buchung, die aus dem Rahmen fällt?",
      "Alles wie immer diesen Monat, oder gibt es etwas Auffälliges?",
      "Ist mir diesen Monat etwas durchgegangen?"
    ],
    "nearMisses": [
      "Was ist das für eine komische Buchung, die da gestern reingekommen ist?",
      "Bin ich diesen Monat noch im Rahmen mit meinem Budget?",
      "Welche Abos laufen bei mir alles, das sehe ich nicht so?",
      "Welche einmaligen Ausgaben hatte ich, die mir die Statistik verfälschen?",
      "Ist da eine verdächtige Abbuchung drauf, wurde meine Karte missbraucht?"
    ]
  },
  {
    "tool": "extraordinary",
    "phrasings": [
      "Was war meine grösste Einzelbuchung?",
      "grösste einzelne Zahlung im letzten Jahr?",
      "Welche einmaligen Ausgaben hatte ich?",
      "einmalige Sachen — was war da so?",
      "zeig mir die teuersten Buchungen",
      "teuerste Buchung?",
      "Was ist der grösste Batzen, der bei mir rausgegangen ist?",
      "Gab es bei mir grössere einmalige Zahlungen?",
      "Welche Zahlungen fallen aus dem Rahmen, so von der Höhe her?",
      "die fünf teuersten Ausgaben bitte",
      "grösste Rechnung, die ich bezahlt habe?",
      "Was war die dickste einzelne Belastung?",
      "Hatte ich irgendwo einen richtig grossen Posten?",
      "Wo ist mal richtig viel auf einmal weggegangen?",
      "grösste einzelbuchug",
      "Gib mir die Ausreisser bei den Ausgaben, also die grossen einzelnen",
      "Welche ausserordentlichen Ausgaben hatte ich dieses Jahr?",
      "Welche einzelne Zahlung hat mich am meisten gekostet?",
      "Gabs mal so einen richtig teuren Kauf bei mir?",
      "Welche Buchungen sind aussergewöhnlich hoch?",
      "Top 5 grösste Ausgaben, einzeln",
      "Was war der teuerste Einzelposten in den letzten zwölf Monaten?",
      "Hab ich letztes Jahr irgendwas einmalig Grosses bezahlt?",
      "welche einmalinge ausgaben hatte ich",
      "einmal was Grosses — wann war das bei mir?"
    ],
    "nearMisses": [
      "Wofür geht bei mir am meisten Geld weg?",
      "War der letzte Monat normal oder ist da etwas aus der Reihe gefallen?",
      "Was ist mein teuerstes Abo?",
      "Was ist das für eine grosse Buchung da, der Firmenname sagt mir gar nichts?",
      "Zieht mir diese eine grosse Rechnung jetzt das ganze Monatsbudget zusammen?"
    ]
  }
]
