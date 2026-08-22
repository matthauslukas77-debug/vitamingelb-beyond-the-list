import type { Category, Transaction } from '../../data/types'
import { resolveBrand } from '../../data/brands'
import { parseBooking, prettyName } from '../../domain/booking'
import { pretty } from '../../app/screens/Recurring'
import type { BudgetSlot, CategoryKey } from './slots'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Buchung → eines der neunzehn Detailfelder des Budgetrechners.
 *
 * Das ist die Zuordnung, die es sonst nirgends gibt. PostFinance kategorisiert
 * seit Jahren automatisch — vierzehn Kategorien, sichtbar in jeder Buchung als
 * `tx.category`. Die bauen wir **nicht** nach, wir nehmen sie an. Was sie nicht
 * kann, ist die Feinheit: «Versicherung» ist im Budgetrechner entweder
 * Krankenkasse (`health.0`), Haftpflicht (`insurance.0`) oder
 * Fahrzeugversicherung (`mobility.1`) — drei verschiedene Töpfe, drei
 * verschiedene Richtwerte.
 *
 * Zwei Lehren aus dem Spike `WORKSPACE/04_experiments/merchant-resolver` sind
 * eingebaut und gelten hier genauso wie in `src/data/brands.ts`:
 *   1. **Längster Treffer gewinnt** — «COOP VITALITY» (Apotheke) schlägt «COOP».
 *   2. **Nur an Wortgrenzen** — sonst steckt «SPAR» in «SPARAUFTRAG» und
 *      «BAR» in «BARBARA».
 *
 * Gemessen am Datensatz: die Regeln allein ordnen 88 % der Ausgabenfranken
 * sicher zu, mit der Bankkategorie dazu 94.9 %. Was übrig bleibt, ist zu vier
 * Fünfteln Bargeld — und dafür gibt es keine Lösung ausser der Rückfrage.
 */

export interface Categorization extends BudgetSlot {
  /** 0..1. Steuert, was der Wizard still übernimmt und was er vorlegt. */
  confidence: number
  /** Das Muster, das getroffen hat — für «warum steht das hier?». */
  matchedBy: string
  /** Zuordnung geraten: im Wizard zur Bestätigung anbieten. */
  needsReview: boolean
}

interface Rule {
  match: string
  category: CategoryKey
  field: number
  confidence?: number
}

const S = (category: CategoryKey, field: number, confidence = 0.95) => ({ category, field, confidence })

/**
 * Das Regelwerk. Reihenfolge ist egal — es gewinnt immer das längste Muster.
 * Bewusst schweizlastig: die grossen Ketten und die Firmen, die auf jedem
 * CH-Kontoauszug stehen.
 */
export const RULES: Rule[] = [
  // ── Steuern ───────────────────────────────────────────────────────────────
  ...['STEUERVERWALTUNG', 'STEUERAMT', 'KANTONALE STEUER', 'GEMEINDESTEUER', 'BUNDESSTEUER', 'QUELLENSTEUER'].map(
    (m) => ({ match: m, ...S('taxes', 0) }),
  ),

  // ── Wohnen ────────────────────────────────────────────────────────────────
  ...['IMMOVERWALTUNG', 'LIEGENSCHAFTSVERWALTUNG', 'IMMOBILIEN AG', 'WOHNBAUGENOSSENSCHAFT', 'VERWALTUNG', 'MIETZINS', 'MIETE', 'WG'].map(
    (m) => ({ match: m, ...S('reside', 0) }),
  ),
  ...['HYPOTHEK', 'HYPOTHEKARZINS', 'AMORTISATION'].map((m) => ({ match: m, ...S('reside', 1) })),
  ...[
    'ENERGIE WASSER BERN', 'EWB', 'EWZ', 'IWB', 'BKW', 'AXPO', 'ALPIQ', 'ROMANDE ENERGIE',
    'SERVICES INDUSTRIELS', 'NEBENKOSTEN', 'HEIZKOSTEN', 'GASVERBUND', 'GEBÄUDEVERSICHERUNG',
    /* Die Muster sind Klartext, keine Ausdrücke — sie werden vor dem Vergleich
       maskiert. Umlautvarianten stehen deshalb einzeln da. */
    'KEHRICHT', 'ENTSORGUNG', 'HEIZUNG', 'HEIZÖL', 'HEIZOEL', 'WARMWASSER',
  ].map((m) => ({ match: m, ...S('reside', 2) })),

  // ── Versicherungen und Vorsorgen ──────────────────────────────────────────
  ...['MOBILIAR', 'ALLIANZ', 'GENERALI', 'VAUDOISE', 'BALOISE', 'BASLER VERSICHERUNG', 'SMILE DIRECT', 'HAUSRAT', 'HAFTPFLICHT'].map(
    (m) => ({ match: m, ...S('insurance', 0) }),
  ),
  ...['SÄULE 3A', 'SAEULE 3A', 'VORSORGE 3A', 'VORSORGEKONTO', 'VORSORGESTIFTUNG', 'FREIZÜGIGKEIT', 'PENSIONSKASSE'].map(
    (m) => ({ match: m, ...S('insurance', 1) }),
  ),
  ...['RECHTSSCHUTZ', 'PROTEKTA', 'ORION RECHTSSCHUTZ', 'REISEVERSICHERUNG', 'TCS', 'ACS'].map((m) => ({
    match: m,
    ...S('insurance', 2),
  })),

  // ── Gesundheitskosten ─────────────────────────────────────────────────────
  ...[
    'CSS VERSICHERUNG', 'CSS', 'HELSANA', 'SWICA', 'SANITAS', 'CONCORDIA', 'VISANA', 'KPT',
    'ASSURA', 'GROUPE MUTUEL', 'ATUPRI', 'SYMPANY', 'KRANKENKASSE', 'KRANKENVERSICHERUNG',
    'KRANKENKASSE PRAEMIE', 'PRAEMIE',
  ].map((m) => ({ match: m, ...S('health', 0) })),
  ...['APOTHEKE', 'AMAVITA', 'DROPA', 'SUN STORE', 'COOP VITALITY', 'PHARMACIE', 'BENU', 'DROGERIE', 'DM DROGERIE MARKT'].map((m) => ({
    match: m,
    ...S('health', 1),
  })),
  ...[
    'ZAHNARZT', 'ZAHNARZTPRAXIS', 'ARZTPRAXIS', 'HAUSARZT', 'INSELSPITAL', 'SPITAL', 'KLINIK',
    'PHYSIOTHERAPIE', 'PSYCHOTHERAPIE', 'MEDBASE', 'PERMANENCE', 'OPTIKER', 'FIELMANN', 'VISILAB',
  ].map((m) => ({ match: m, ...S('health', 2) })),

  // ── Mobilität und Kommunikation ───────────────────────────────────────────
  ...['EMIL FREY', 'AMAG', 'GARAGE', 'AUTOHAUS', 'LEASING', 'MULTILEASE', 'CARVOLUTION'].map((m) => ({
    match: m,
    ...S('mobility', 0),
  })),
  ...['MOTORFAHRZEUGVERSICHERUNG', 'AXA VERSICHERUNG', 'ZURICH VERSICHERUNG', 'STRASSENVERKEHRSAMT'].map(
    (m) => ({ match: m, ...S('mobility', 1) }),
  ),
  ...['MIGROL', 'SOCAR', 'SHELL', 'AGROLA', 'TAMOIL', 'AVIA', 'RUEDI RÜSSEL', 'BP TANKSTELLE', 'AUTOWÄSCHE', 'PNEU', 'PARKING', 'PARKHAUS'].map(
    (m) => ({ match: m, ...S('mobility', 2) }),
  ),
  ...[
    'SBB', 'BLS', 'BERNMOBIL', 'POSTAUTO', 'PUBLIBIKE', 'VBZ', 'ZVV', 'TPG', 'LIBERO',
    'MOBILITY', 'RAILAWAY', 'SWISSPASS',
  ].map((m) => ({ match: m, ...S('mobility', 3) })),
  ...[
    'SWISSCOM', 'SALT MOBILE', 'SALT', 'SUNRISE', 'WINGO', 'YALLO', 'INIT7', 'QUICKLINE',
    'SERAFE', 'BILLAG',
  ].map((m) => ({ match: m, ...S('mobility', 4) })),

  // ── Konsum und Freizeit ───────────────────────────────────────────────────
  ...[
    'COOP PRONTO', 'COOP', 'MIGROS', 'MIGROLINO', 'ALDI', 'LIDL', 'DENNER', 'VOLG', 'SPAR',
    'MANOR FOOD', 'BÄCKEREI', 'METZGEREI', 'MARKTHALLE',
  ].map((m) => ({ match: m, ...S('consumption', 0) })),
  ...[
    'ZALANDO', 'H&M', 'ZARA', 'C&A', 'OCHSNER SPORT', 'LOEB', 'DOSENBACH', 'CHICORÉE',
    'SNIPES', 'TALLY WEIJL', 'TRANSA', 'BAYARD',
  ].map((m) => ({ match: m, ...S('consumption', 1) })),
  ...[
    'DIGITEC', 'GALAXUS', 'BRACK', 'MICROSPOT', 'INTERDISCOUNT', 'IKEA', 'JUMBO', 'HORNBACH',
    'POST CH AG', 'DIE POST', 'APPLE.COM', 'ICLOUD', 'GOOGLE', 'NOTION', 'OPENAI', 'ADOBE',
    'MICROSOFT', 'DROPBOX', 'HOSTPOINT', 'PAYPAL', 'AMAZON', 'ALIEXPRESS', 'TEMU', 'COIFFEUR',
    'KIOSK', 'K KIOSK', 'AVEC', 'SELECTA', 'BREZELKOENIG', 'MAHNGEBUEHR', 'KONTOUEBERZUG',
  ].map((m) => ({ match: m, ...S('consumption', 3, 0.85) })),
  ...[
    'NETFLIX', 'SPOTIFY', 'DISNEY PLUS', 'BLUE TV', 'SKY SHOW', 'STEAM', 'PLAYSTATION', 'NINTENDO',
  ].map((m) => ({ match: m, ...S('consumption', 2, 0.9) })),
  ...[
    'PATHÉ', 'KINO', 'TICKETCORNER', 'KUNSTMUSEUM', 'MUSEUM', 'HALLENBAD', 'BOWLING',
    'DAMPFZENTRALE', 'FITNESSPARK', 'FP BERN', 'ACTIV FITNESS', 'MIGROS FITNESSPARK', 'BASEFIT',
    'HOTEL', 'BOOKING.COM', 'AIRBNB', 'SWISS INTERNATIONAL', 'EASYJET', 'RESTAURANT', 'TAKE AWAY',
    'TAKEAWAY', 'BRASSERIE', 'GASTHOF', 'BEIZ', 'BISTRO', 'CAFE', 'CAFÉ', 'PIZZERIA', 'MCDONALD',
    'BURGER KING', 'SUBWAY', 'STARBUCKS', 'TIBITS', 'RICE UP', 'HOLY COW', 'DIECI', 'MENSA',
    'KANTINE', 'GELATERIA', 'BOULANGERIE', 'TRATTORIA', 'NEGISHI', 'SPORTCLUB', 'TURNVEREIN',
  ].map((m) => ({ match: m, ...S('consumption', 2, 0.85) })),
]

/**
 * Die vierzehn Kategorien der App → Detailfeld.
 *
 * Zweite Quelle, wenn keine Regel greift. `null` heisst: zu grob, um ein
 * Detailfeld zu bestimmen — dann bleibt nur die ehrliche Rückfrage.
 *
 * Zwei Einträge verdienen eine Erklärung:
 *   · `insurance` landet auf «Haftpflicht und Hausrat», obwohl in dieser
 *     Kategorie bei allen vier Personas hauptsächlich die Krankenkasse liegt.
 *     Die Regeln fangen sie vorher ab (CSS, Helsana, …) und schicken sie nach
 *     `health.0`. Was danach noch hier ankommt, ist tatsächlich Sachversicherung.
 *   · `subscriptions` geht nach «Weitere Ausgaben» und nicht nach
 *     «Telefon, TV, Radio, Internet»: In der App liegen dort auch Serafe,
 *     Fitnessabo und Streaming. Die Regeln sortieren das auseinander.
 */
export const BANK_CATEGORY_MAP: Record<Category, (BudgetSlot & { confidence: number }) | null> = {
  income: null,
  groceries: { category: 'consumption', field: 0, confidence: 0.9 },
  eatingOut: { category: 'consumption', field: 2, confidence: 0.9 },
  shopping: { category: 'consumption', field: 1, confidence: 0.7 },
  transport: { category: 'mobility', field: 3, confidence: 0.8 },
  housing: { category: 'reside', field: 0, confidence: 0.9 },
  health: { category: 'health', field: 2, confidence: 0.8 },
  subscriptions: { category: 'consumption', field: 3, confidence: 0.75 },
  leisure: { category: 'consumption', field: 2, confidence: 0.85 },
  taxes: { category: 'taxes', field: 0, confidence: 0.9 },
  insurance: { category: 'insurance', field: 0, confidence: 0.8 },
  transfer: null,
  cash: null,
  other: null,
}

/** Nach Musterlänge absteigend — «längster Treffer gewinnt». */
const SORTED_RULES = [...RULES].sort((a, b) => b.match.length - a.match.length)

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Wortgrenzen-Test, der auch mit `&`, `.` und Umlauten funktioniert. */
function matchesAtWordBoundary(haystack: string, needle: string): boolean {
  const pattern = new RegExp(`(^|[^A-ZÄÖÜ0-9])${escapeRegExp(needle)}($|[^A-ZÄÖÜ0-9])`, 'i')
  return pattern.test(haystack)
}

/** Bargeldbezug am Automaten — Verwendung nicht erkennbar. */
const CASH = /(BARGELDBEZUG|POSTOMAT|BANCOMAT|GELDAUTOMAT|ATM)/i

/**
 * Der Text, gegen den die Regeln laufen. Der aufgelöste Markenname kommt
 * dazu — aus «ADOBE *CREATIVE CLOUD INC» macht die Registry «Adobe Creative
 * Cloud», und darauf greift eine Regel, die am Rohtext scheitern würde.
 */
function haystackOf(tx: Transaction): string {
  const brand = resolveBrand(tx.text)
  return [tx.text, brand?.brand.name].filter(Boolean).join(' ').toUpperCase()
}

/**
 * Ordnet eine Buchung einem Detailfeld zu.
 *
 * Reihenfolge: Regeln, dann die Kategorie der Bank, dann eine Heuristik, die
 * ihre Unsicherheit ausweist statt sie zu verstecken.
 */
export function categorize(tx: Transaction): Categorization {
  /* Bargeld zuerst, noch vor den Regeln. Sonst löst «BARGELDBEZUG POSTOMAT
     BERN» über die Markenregistry auf «Die Post» auf, trifft dort eine Regel
     und gilt plötzlich als sicher zugeordnete Konsumausgabe. Ein Bezug am
     Automaten ist ein Bezug am Automaten — der Zweck steht nirgends, egal an
     welchem Schalter. Das ist die grösste verbleibende Unschärfe und die
     einzige, die eine Rückfrage wert ist. */
  if (tx.category === 'cash' || CASH.test(tx.text)) {
    return {
      category: 'consumption',
      field: 3,
      confidence: 0.3,
      matchedBy: 'Bargeldbezug — Verwendung unbekannt',
      needsReview: true,
    }
  }

  const haystack = haystackOf(tx)

  for (const rule of SORTED_RULES) {
    if (matchesAtWordBoundary(haystack, rule.match)) {
      return {
        category: rule.category,
        field: rule.field,
        confidence: rule.confidence ?? 0.95,
        matchedBy: rule.match,
        needsReview: false,
      }
    }
  }

  const fromBank = BANK_CATEGORY_MAP[tx.category]
  if (fromBank) {
    return {
      category: fromBank.category,
      field: fromBank.field,
      confidence: fromBank.confidence,
      matchedBy: `Kategorie der Bank: ${tx.category}`,
      needsReview: fromBank.confidence < 0.6,
    }
  }

  return {
    category: 'consumption',
    field: 3,
    confidence: 0.35,
    matchedBy: 'kein Regeltreffer',
    needsReview: true,
  }
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
