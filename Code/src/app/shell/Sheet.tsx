import type { ReactNode } from 'react'
import { Icon } from './Icon'

/** Bildschirm, der über den Tabs liegt — mit Zurück-Pfeil in der Kopfzeile. */
export function Sheet({
  title,
  onBack,
  action,
  children,
}: {
  title: string
  onBack: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="sheet">
      <div className="sheet__bar">
        <button className="sheet__action" onClick={onBack} aria-label="Zurück">
          <Icon name="chevronLeft" size={22} />
        </button>
        <h1 className="sheet__title">{title}</h1>
        <span className="sheet__action">{action}</span>
      </div>
      <div className="screen">{children}</div>
    </div>
  )
}
