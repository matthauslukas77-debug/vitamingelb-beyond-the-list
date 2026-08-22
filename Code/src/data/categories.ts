import type { Category } from './types'

/** Kategorienamen wie in den «Analysen» der App. */
export const CATEGORY_LABELS: Record<Category, string> = {
  income: 'Einkommen',
  groceries: 'Lebensmittel',
  eatingOut: 'Restaurants',
  shopping: 'Shopping',
  transport: 'Verkehr',
  housing: 'Wohnen & Hypothek',
  health: 'Gesundheit',
  subscriptions: 'Abos & Gebühren',
  leisure: 'Freizeit',
  taxes: 'Steuern',
  insurance: 'Versicherungen',
  transfer: 'Umbuchung',
  cash: 'Bargeld',
  other: 'Übriges',
}

/** Farben der Donut-Segmente, aus der Petrol-/Hellblau-Rampe der Tokens. */
export const CATEGORY_COLORS: Record<Category, string> = {
  income: 'var(--hellblau)',
  groceries: 'var(--petrol8)',
  eatingOut: 'var(--petrol6)',
  shopping: 'var(--petrol4)',
  transport: 'var(--hellblau5)',
  housing: 'var(--petrol9)',
  health: 'var(--hellblau3)',
  subscriptions: 'var(--postfinancegelb)',
  leisure: 'var(--petrol5)',
  taxes: 'var(--petrol10)',
  insurance: 'var(--hellblau7)',
  transfer: 'var(--grau3)',
  cash: 'var(--grau5)',
  other: 'var(--petrol3)',
}

/**
 * Die App zeigt Kategorien zweistufig: Oberkategorie in Grau, darunter die
 * genaue in Fett — «Mobilität / Öffentlicher Verkehr».
 * Vorlage: examples2/IMG_1691.
 */
export const CATEGORY_GROUP: Record<Category, string> = {
  income: 'Einkommen',
  groceries: 'Haushalt',
  eatingOut: 'Freizeit',
  shopping: 'Lebensstil',
  transport: 'Mobilität',
  housing: 'Wohnen',
  health: 'Gesundheit',
  subscriptions: 'Wohnen',
  leisure: 'Freizeit',
  taxes: 'Abgaben',
  insurance: 'Versicherungen',
  transfer: 'Eigene Konten',
  cash: 'Bargeld',
  other: 'Übriges',
}

/**
 * Umbuchungen auf eigene Konten sind kein Konsum.
 * Die heutige Auswertung zählt sie trotzdem mit — genau das hat Livia im
 * Interview 05 beschrieben. Der Nachbau bildet den Ist-Zustand ab; die
 * Unterscheidung existiert hier nur als Flag, damit wir sie später nutzen können.
 */
export function isSpending(category: Category): boolean {
  return category !== 'income' && category !== 'transfer'
}
