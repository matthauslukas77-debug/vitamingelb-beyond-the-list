import { SLOT_CONTENT, type SlotName } from '../../insights/registry'
import { useSession } from '../session'

/**
 * Einhängepunkt für unsere eigenen Funktionen.
 *
 * Die Replika-Screens bleiben unverändert und rendern an definierten Stellen
 * einen benannten Slot. Alles Neue wird in `src/insights/registry.tsx`
 * registriert — so ist jederzeit sichtbar, was PostFinance heute ist und was
 * von uns kommt. Im Modus «baseline» rendert jeder Slot nichts.
 */
export function Slot({ name }: { name: SlotName }) {
  const session = useSession()
  const entries = SLOT_CONTENT[name]
  if (!entries || entries.length === 0) return null
  return (
    <>
      {entries.map((Entry, index) => (
        <Entry key={index} session={session} />
      ))}
    </>
  )
}
