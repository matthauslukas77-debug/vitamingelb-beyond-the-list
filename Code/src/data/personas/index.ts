import type { Persona } from '../types'
import { fritz } from './fritz'
import { janic } from './janic'
import { katja } from './katja'
import { michael } from './michael'

/**
 * Die vier Demo-Personas. Jede bildet eine Person aus unseren Interviews ab —
 * inklusive des Musters, das im Gespräch aufgetaucht ist. Siehe
 * WORKSPACE/02_design_thinking/interviews/.
 *
 * Die Buchungen liegen daneben in `<id>.data.ts` und sind generiert:
 * 24 Monate im PostFinance-Format aus
 * WORKSPACE/04_experiments/postfinance_template_data/_generator/.
 */
export const PERSONAS: Persona[] = [fritz, janic, katja, michael]

export function findPersona(id: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.id === id)
}
