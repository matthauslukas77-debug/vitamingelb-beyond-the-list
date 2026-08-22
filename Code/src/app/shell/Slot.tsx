import type { ReactNode } from 'react'
import { SLOT_CONTENT, type SlotName } from '../../insights/registry'
import { useSession } from '../session'

/**
 * Einhängepunkt für unsere eigenen Funktionen.
 *
 * Die Replika-Screens bleiben unverändert und rendern an definierten Stellen
 * einen benannten Slot. Alles Neue wird in `src/insights/registry.tsx`
 * registriert — so ist jederzeit sichtbar, was PostFinance heute ist und was
 * von uns kommt.
 *
 * Mit `fallback` ersetzt der Slot einen bestehenden Baustein, statt nur etwas
 * hinzuzufügen: Ist nichts registriert, rendert der Nachbau; sonst unsere
 * Fassung. Damit lässt sich «heute» gegen «unser Vorschlag» umschalten,
 * ohne dass die Replika davon weiss.
 */
export function Slot({
  name,
  fallback = null,
  ...props
}: {
  name: SlotName
  fallback?: ReactNode
  [key: string]: unknown
}) {
  const session = useSession()
  const entries = SLOT_CONTENT[name]
  if (!entries || entries.length === 0) return <>{fallback}</>
  // `fallback` geht auch an die registrierte Komponente: So kann sie im
  // Einzelfall entscheiden, dass der Nachbau die bessere Antwort ist.
  return (
    <>
      {entries.map((Entry, index) => (
        <Entry key={index} session={session} fallback={fallback} {...props} />
      ))}
    </>
  )
}
