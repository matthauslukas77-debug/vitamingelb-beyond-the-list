import type { Persona } from '../types'
import { fritz } from './fritz'
import { janic } from './janic'
import { katja } from './katja'
import { mia } from './mia'
import { michael } from './michael'

/**
 * Die Demo-Personas.
 *
 * fritz/janic/katja/michael bilden je eine Person aus unseren Interviews ab —
 * inklusive des Musters, das im Gespräch aufgetaucht ist. Siehe
 * WORKSPACE/02_design_thinking/interviews/.
 *
 * mia ist keine Interviewperson, sondern der Datenumfang: 2418 Buchungen über
 * 24 Monate aus dem PostFinance-Template-Datensatz. Sie steht bewusst zuletzt,
 * weil sie zum Testen da ist und nicht zum Erzählen.
 */
export const PERSONAS: Persona[] = [fritz, janic, katja, michael, mia]

export function findPersona(id: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.id === id)
}
