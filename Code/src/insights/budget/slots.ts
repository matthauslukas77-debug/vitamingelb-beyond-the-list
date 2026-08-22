import type { IconName } from '../../app/shell/Icon'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Die Struktur des PostFinance-Budgetrechners: sechs Kategorien, neunzehn
 * Detailfelder.
 *
 * Nicht erfunden, sondern gemessen. Rekonstruiert aus dem Angular-Bundle des
 * öffentlichen Rechners (`/pfch/ui/main.js`, Webapp 219) plus 2'513
 * Messpunkten seiner API — siehe
 * `WORKSPACE/04_experiments/pf-budget-wizard/SPEC.md`. Reihenfolge, Schlüssel
 * und Beschriftungen stehen hier genau so, wie sie dort stehen; die Texte
 * kommen wörtlich aus `data/labels.de.json` (161 Original-Labels je Sprache).
 *
 * Warum diese Struktur und nicht unsere eigenen vierzehn Kategorien aus
 * `src/data/categories.ts`? Weil der Vergleichswert daran hängt. Nur wenn
 * unsere abgeleiteten Zahlen in denselben Töpfen liegen wie die Richtwerte des
 * Rechners, ist «du zahlst 340 mehr fürs Wohnen als ein vergleichbarer
 * Haushalt» eine Aussage und keine Behauptung.
 */

/** Die sechs Kategorien, in der Reihenfolge des Originals. */
export const CATEGORY_KEYS = [
  'taxes',
  'reside',
  'insurance',
  'health',
  'mobility',
  'consumption',
] as const

export type CategoryKey = (typeof CATEGORY_KEYS)[number]

/**
 * Ein Detailfeld: Kategorie plus Position in ihrer Feldliste.
 * `taxes` hat nur eines, `mobility` deren fünf — zusammen neunzehn.
 */
export interface BudgetSlot {
  category: CategoryKey
  field: number
}

export interface CategoryDef {
  key: CategoryKey
  /** Titel wie im Original. */
  title: string
  /**
   * Sinnbild. Das Original nennt hier `calculator_moneyBag`, `houseWindows`,
   * `handshake`, `personMedal`, `train`, `shoppingBasketGroceries` — Namen aus
   * der PostFinance-Icon-Bibliothek, die uns nicht vorliegt. Genommen wird das
   * nächstliegende Zeichen aus `src/app/shell/Icon.tsx`.
   */
  icon: IconName
  /** Die Detailfelder, in Original-Reihenfolge. */
  fields: string[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'taxes',
    title: 'Steuern',
    icon: 'bank',
    fields: ['Steuern'],
  },
  {
    key: 'reside',
    title: 'Wohnen',
    icon: 'sofa',
    fields: ['Miete', 'Hypothekarzinsen', 'Neben- und Unterhaltskosten'],
  },
  {
    key: 'insurance',
    title: 'Versicherungen und Vorsorgen',
    icon: 'document',
    fields: ['Haftpflicht und Hausrat', 'Beiträge private Vorsorge', 'Weitere Versicherungen'],
  },
  {
    key: 'health',
    title: 'Gesundheitskosten',
    icon: 'heartPulse',
    fields: ['Krankenkasse', 'Medikamente, Franchise', 'Arzt, Spital, Therapie'],
  },
  {
    key: 'mobility',
    title: 'Mobilität und Kommunikation',
    icon: 'tram',
    fields: [
      'Fahrzeug, Leasing',
      'Fahrzeugversicherung',
      'Treibstoff und Unterhalt',
      'Öffentlicher Verkehr',
      'Telefon, TV, Radio, Internet',
    ],
  },
  {
    key: 'consumption',
    title: 'Konsum und Freizeit',
    icon: 'bag',
    fields: ['Nahrungsmittel', 'Kleider und Schuhe', 'Ferien, Hobbies, Kultur', 'Weitere Ausgaben'],
  },
]

const BY_KEY = new Map<CategoryKey, CategoryDef>(CATEGORIES.map((entry) => [entry.key, entry]))

export function categoryDef(key: CategoryKey): CategoryDef {
  const found = BY_KEY.get(key)
  if (!found) throw new Error(`Unbekannte Budgetkategorie: ${key}`)
  return found
}

/** «Wohnen · Miete» — die Beschriftung eines einzelnen Feldes. */
export function slotLabel(slot: BudgetSlot): string {
  const category = categoryDef(slot.category)
  const field = category.fields[slot.field]
  if (!field) throw new Error(`Feld ${slot.field} gibt es in ${slot.category} nicht`)
  // Bei Steuern hiesse es sonst «Steuern · Steuern».
  return field === category.title ? field : `${category.title} · ${field}`
}

/** Nur das Feld, ohne die Kategorie davor. */
export function fieldLabel(slot: BudgetSlot): string {
  return categoryDef(slot.category).fields[slot.field]
}

/** Stabiler Schlüssel für Speicherung und Vergleiche: `reside.0`. */
export function slotKey(slot: BudgetSlot): string {
  return `${slot.category}.${slot.field}`
}

export function parseSlotKey(key: string): BudgetSlot {
  const [category, field] = key.split('.')
  return { category: category as CategoryKey, field: Number(field) }
}

/** Alle neunzehn Felder, in Original-Reihenfolge. */
export function allSlots(): BudgetSlot[] {
  return CATEGORIES.flatMap((category) =>
    category.fields.map((_, field) => ({ category: category.key, field })),
  )
}

export const SLOT_COUNT = allSlots().length
