/**
 * Buchung → PostFinance-Budgetkategorie und -Detailfeld.
 *
 * Regelbasiert, ohne Modell und ohne Netz. Zwei Lehren aus dem Spike
 * `WORKSPACE/04_experiments/merchant-resolver` sind eingebaut:
 *   1. **Längster Treffer gewinnt** — «COOP VITALITY» schlägt «COOP».
 *   2. **Nur an Wortgrenzen** — sonst steckt `FT` in `SPARAUFTRAG` und
 *      `EAT` in `CREATIVE`.
 *
 * Das Ziel ist nicht, PostFinances Auto-Kategorisierung nachzubauen (die ist
 * live und besser). Das Ziel ist, jede Buchung einem der **19 Detailfelder**
 * des Budgetrechners zuzuordnen — diese Zuordnung gibt es sonst nirgends.
 */

import type { CategoryKey } from './types.ts';
import type { NormalizedTx } from './transactions.ts';

/** Ein Detailfeld des Budgetrechners: Kategorie + Position in `fieldLabels`. */
export interface BudgetSlot {
  category: CategoryKey;
  field: number;
}

export interface Categorization extends BudgetSlot {
  confidence: number;
  /** Das Muster, das getroffen hat — für «warum steht das hier?». */
  matchedBy: string;
  /** true = Zuordnung geraten, im UI zur Bestätigung anbieten. */
  needsReview: boolean;
}

interface Rule {
  /** Wortgrenzen-Muster, Grossschreibung egal. */
  match: string;
  category: CategoryKey;
  field: number;
  confidence?: number;
}

const S = (category: CategoryKey, field: number, confidence = 0.95) => ({ category, field, confidence });

/**
 * Regelwerk. Reihenfolge ist egal — es gewinnt immer das längste Muster.
 * Bewusst schweizlastig; für die Demo reichen die grossen Ketten und die
 * Firmen, die auf jedem CH-Kontoauszug stehen.
 */
export const RULES: Rule[] = [
  // ── Steuern ───────────────────────────────────────────────────────────────
  ...['STEUERVERWALTUNG', 'STEUERAMT', 'KANTONALE STEUER', 'GEMEINDESTEUER', 'BUNDESSTEUER', 'QUELLENSTEUER'].map(
    (m) => ({ match: m, ...S('taxes', 0) }),
  ),

  // ── Wohnen ────────────────────────────────────────────────────────────────
  ...['IMMOVERWALTUNG', 'LIEGENSCHAFTSVERWALTUNG', 'IMMOBILIEN AG', 'WOHNBAUGENOSSENSCHAFT', 'MIETZINS', 'MIETE'].map(
    (m) => ({ match: m, ...S('reside', 0) }),
  ),
  ...['HYPOTHEK', 'HYPOTHEKARZINS'].map((m) => ({ match: m, ...S('reside', 1) })),
  ...[
    'ENERGIE WASSER BERN',
    'EWB',
    'EWZ',
    'IWB',
    'BKW',
    'AXPO',
    'ROMANDE ENERGIE',
    'SERVICES INDUSTRIELS',
    'NEBENKOSTEN',
    'HEIZKOSTEN',
    'GASVERBUND',
  ].map((m) => ({ match: m, ...S('reside', 2) })),

  // ── Versicherungen und Vorsorgen ──────────────────────────────────────────
  ...['MOBILIAR', 'ALLIANZ', 'GENERALI', 'VAUDOISE', 'BALOISE', 'BASLER VERSICHERUNG', 'SMILE DIRECT', 'HAUSRAT', 'HAFTPFLICHT'].map(
    (m) => ({ match: m, ...S('insurance', 0) }),
  ),
  ...['SÄULE 3A', 'SAEULE 3A', 'VORSORGESTIFTUNG', 'FREIZÜGIGKEIT', 'PENSIONSKASSE'].map((m) => ({
    match: m,
    ...S('insurance', 1),
  })),
  ...['RECHTSSCHUTZ', 'PROTEKTA', 'ORION RECHTSSCHUTZ', 'REISEVERSICHERUNG', 'TCS'].map((m) => ({
    match: m,
    ...S('insurance', 2),
  })),

  // ── Gesundheitskosten ─────────────────────────────────────────────────────
  ...[
    'CSS VERSICHERUNG',
    'CSS',
    'HELSANA',
    'SWICA',
    'SANITAS',
    'CONCORDIA',
    'VISANA',
    'KPT',
    'ASSURA',
    'GROUPE MUTUEL',
    'ATUPRI',
    'SYMPANY',
    'KRANKENKASSE',
    'KRANKENVERSICHERUNG',
  ].map((m) => ({ match: m, ...S('health', 0) })),
  ...['APOTHEKE', 'AMAVITA', 'DROPA', 'SUN STORE', 'COOP VITALITY', 'PHARMACIE', 'BENU'].map((m) => ({
    match: m,
    ...S('health', 1),
  })),
  ...[
    'ZAHNARZT',
    'ZAHNARZTPRAXIS',
    'ARZTPRAXIS',
    'HAUSARZT',
    'INSELSPITAL',
    'SPITAL',
    'KLINIK',
    'PHYSIOTHERAPIE',
    'PSYCHOTHERAPIE',
    'MEDBASE',
    'PERMANENCE',
  ].map((m) => ({ match: m, ...S('health', 2) })),

  // ── Mobilität und Kommunikation ───────────────────────────────────────────
  ...['EMIL FREY', 'AMAG', 'GARAGE', 'AUTOHAUS', 'LEASING', 'MULTILEASE'].map((m) => ({
    match: m,
    ...S('mobility', 0),
  })),
  ...['MOTORFAHRZEUGVERSICHERUNG', 'AXA VERSICHERUNG', 'ZURICH VERSICHERUNG'].map((m) => ({
    match: m,
    ...S('mobility', 1),
  })),
  ...['MIGROL', 'SOCAR', 'SHELL', 'AGROLA', 'TAMOIL', 'AVIA', 'RUEDI RÜSSEL', 'BP TANKSTELLE', 'AUTOWÄSCHE', 'PNEU'].map(
    (m) => ({ match: m, ...S('mobility', 2) }),
  ),
  ...[
    'SBB',
    'BLS',
    'BERNMOBIL',
    'POSTAUTO',
    'PUBLIBIKE',
    'VBZ',
    'ZVV',
    'TPG',
    'LIBERO',
    'MOBILITY',
    'RAILAWAY',
    'SWISSPASS',
  ].map((m) => ({ match: m, ...S('mobility', 3) })),
  ...[
    'SWISSCOM',
    'SALT MOBILE',
    'SALT',
    'SUNRISE',
    'WINGO',
    'YALLO',
    'INIT7',
    'QUICKLINE',
    'SERAFE',
    'BILLAG',
  ].map((m) => ({ match: m, ...S('mobility', 4) })),

  // ── Konsum und Freizeit ───────────────────────────────────────────────────
  ...[
    'COOP PRONTO',
    'COOP',
    'MIGROS',
    'MIGROLINO',
    'ALDI',
    'LIDL',
    'DENNER',
    'VOLG',
    'SPAR',
    'MANOR FOOD',
    'BÄCKEREI',
    'METZGEREI',
    'MARKTHALLE',
  ].map((m) => ({ match: m, ...S('consumption', 0) })),
  ...[
    'ZALANDO',
    'H&M',
    'ZARA',
    'C&A',
    'OCHSNER SPORT',
    'LOEB',
    'TOPSHOP',
    'DOSENBACH',
    'CHICORÉE',
    'SNIPES',
    'ONLINE-SHOPPING KLEIDER',
    'TALLY WEIJL',
  ].map((m) => ({ match: m, ...S('consumption', 1) })),
  ...[
    'NETFLIX',
    'SPOTIFY',
    'DISNEY PLUS',
    'BLUE TV',
    'SKY SHOW',
    'STEAM',
    'PLAYSTATION',
    'NINTENDO',
  ].map((m) => ({ match: m, ...S('consumption', 2, 0.9) })),
  ...[
    'DIGITEC',
    'GALAXUS',
    'BRACK',
    'MICROSPOT',
    'INTERDISCOUNT',
    'IKEA',
    'JUMBO',
    'HORNBACH',
    'POST CH AG',
    'DIE POST',
    'APPLE.COM',
    'ICLOUD',
    'GOOGLE',
    'NOTION',
    'OPENAI',
    'ADOBE',
    'MICROSOFT',
    'DROPBOX',
    'HOSTPOINT',
    'PAYPAL',
    'AMAZON',
    'ALIEXPRESS',
    'TEMU',
    'COIFFEUR',
    'KIOSK',
    'K KIOSK',
    'AVEC',
    'SELECTA',
  ].map((m) => ({ match: m, ...S('consumption', 3, 0.85) })),
  ...[
    'PATHÉ',
    'KINO',
    'TICKETCORNER',
    'KUNSTMUSEUM',
    'MUSEUM',
    'HALLENBAD',
    'BOWLING',
    'DAMPFZENTRALE',
    'FITNESSPARK',
    'FP BERN',
    'ACTIV FITNESS',
    'MIGROS FITNESSPARK',
    'HOTEL',
    'BOOKING.COM',
    'AIRBNB',
    'SWISS INTERNATIONAL',
    'EASYJET',
    'RESTAURANT',
    'TAKE AWAY',
    'TAKEAWAY',
    'BRASSERIE',
    'GASTHOF',
    'BEIZ',
    'BISTRO',
    'CAFE',
    'CAFÉ',
    'BAR',
    'PIZZERIA',
    'MCDONALD',
    'BURGER KING',
    'SUBWAY',
    'STARBUCKS',
    'TIBITS',
    'RICE UP',
    'HOLY COW',
    'DIECI',
    'MENSA',
    'KANTINE',
    'GELATERIA',
    'BOULANGERIE',
    'TRATTORIA',
  ].map((m) => ({ match: m, ...S('consumption', 2, 0.85) })),
];

/**
 * Kategorien, die die Bank bereits vergeben hat → Detailfeld.
 *
 * Zwei Namensräume: der Template-Datensatz (PostFinance-Auszugslogik) und der
 * `Category`-Typ der App (`SUBMISSION/Code/src/data/types.ts`). Beide sind
 * abgedeckt, damit derselbe Motor auf beiden Datenquellen läuft.
 *
 * `null` = die Bankkategorie ist zu grob, um ein Detailfeld zu bestimmen;
 * dann entscheiden die Regeln oder die Heuristik.
 */
export const BANK_CATEGORY_MAP: Record<string, (BudgetSlot & { confidence: number }) | null> = {
  // Template-Datensatz
  'Steuern/Amt': { category: 'taxes', field: 0, confidence: 0.9 },
  'Miete/Wohnen': { category: 'reside', field: 0, confidence: 0.9 },
  'Strom/Energie': { category: 'reside', field: 2, confidence: 0.9 },
  Versicherung: { category: 'insurance', field: 0, confidence: 0.9 },
  Krankenkasse: { category: 'health', field: 0, confidence: 0.9 },
  'Auto/Tanken': { category: 'mobility', field: 2, confidence: 0.9 },
  'ÖV/Velo': { category: 'mobility', field: 3, confidence: 0.9 },
  'Telekom/Internet': { category: 'mobility', field: 4, confidence: 0.9 },
  Lebensmittel: { category: 'consumption', field: 0, confidence: 0.9 },
  'Kiosk/Snacks': { category: 'consumption', field: 0, confidence: 0.75 },
  Shopping: { category: 'consumption', field: 1, confidence: 0.7 },
  'Restaurant/Cafe': { category: 'consumption', field: 2, confidence: 0.9 },
  'Freizeit/Kultur': { category: 'consumption', field: 2, confidence: 0.85 },
  Reisen: { category: 'consumption', field: 2, confidence: 0.85 },
  'Fitness/Gesundheit': null,
  'Online-Shop': { category: 'consumption', field: 3, confidence: 0.7 },
  'Tech/Software/Abo': { category: 'consumption', field: 3, confidence: 0.8 },
  'Post/Versand': { category: 'consumption', field: 3, confidence: 0.8 },
  Bankgebühr: { category: 'consumption', field: 3, confidence: 0.9 },
  Sonstiges: null,
  Bargeld: null,

  // Category-Typ der App
  groceries: { category: 'consumption', field: 0, confidence: 0.9 },
  eatingOut: { category: 'consumption', field: 2, confidence: 0.9 },
  shopping: { category: 'consumption', field: 1, confidence: 0.7 },
  transport: { category: 'mobility', field: 3, confidence: 0.85 },
  housing: { category: 'reside', field: 0, confidence: 0.9 },
  health: { category: 'health', field: 0, confidence: 0.85 },
  subscriptions: { category: 'consumption', field: 3, confidence: 0.8 },
  leisure: { category: 'consumption', field: 2, confidence: 0.85 },
  taxes: { category: 'taxes', field: 0, confidence: 0.9 },
  insurance: { category: 'insurance', field: 0, confidence: 0.85 },
  cash: null,
  other: null,
};

/** Nach Musterlänge absteigend — «längster Treffer gewinnt». */
const SORTED_RULES = [...RULES].sort((a, b) => b.match.length - a.match.length);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wortgrenzen-Test, der auch mit `&`, `.` und Umlauten funktioniert. */
function matchesAtWordBoundary(haystack: string, needle: string): boolean {
  const pattern = new RegExp(`(^|[^A-ZÄÖÜ0-9])${escapeRegExp(needle)}($|[^A-ZÄÖÜ0-9])`, 'i');
  return pattern.test(haystack);
}

/** Text, gegen den die Regeln laufen: Händler zuerst, dann Gegenpartei, dann Buchungstext. */
function haystackOf(tx: NormalizedTx): string {
  return [tx.merchant, tx.counterparty, tx.text, tx.message].filter(Boolean).join(' ').toUpperCase();
}

/**
 * Ordnet eine Buchung einem Detailfeld zu.
 * Ohne Regeltreffer greift eine Heuristik, die ihre Unsicherheit ausweist.
 */
export function categorize(tx: NormalizedTx): Categorization {
  const haystack = haystackOf(tx);

  for (const rule of SORTED_RULES) {
    if (matchesAtWordBoundary(haystack, rule.match)) {
      return {
        category: rule.category,
        field: rule.field,
        confidence: rule.confidence ?? 0.95,
        matchedBy: rule.match,
        needsReview: false,
      };
    }
  }

  // Zweite Quelle: die Kategorie, die die Bank schon vergeben hat.
  if (tx.bankCategory) {
    const slot = BANK_CATEGORY_MAP[tx.bankCategory];
    if (slot) {
      return {
        category: slot.category,
        field: slot.field,
        confidence: slot.confidence,
        matchedBy: `Bankkategorie «${tx.bankCategory}»`,
        needsReview: slot.confidence < 0.6,
      };
    }
  }

  // Bargeld: Zweck unbekannt. Ehrlich als «Weitere Ausgaben» führen und fragen.
  if (tx.txType === 'cash_withdrawal') {
    return {
      category: 'consumption',
      field: 3,
      confidence: 0.3,
      matchedBy: 'Bargeldbezug — Verwendung unbekannt',
      needsReview: true,
    };
  }

  // Bankgebühren sind keine Konsumausgabe, haben im PF-Raster aber kein Feld.
  if (tx.txType === 'bank_fee') {
    return { category: 'consumption', field: 3, confidence: 0.8, matchedBy: 'Bankgebühr', needsReview: false };
  }

  return {
    category: 'consumption',
    field: 3,
    confidence: 0.35,
    matchedBy: 'kein Regeltreffer',
    needsReview: true,
  };
}
