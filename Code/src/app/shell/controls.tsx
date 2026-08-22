import type { ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Bedienelemente für Einstellungsbildschirme: Schalter, segmentierte Auswahl,
 * Eingabefeld. Bewusst hier und nicht in `parts.tsx` — `parts.tsx` baut
 * Anzeigezeilen nach, das hier ist die Ebene, auf der etwas verändert wird.
 * Die späteren Feature-Schalter greifen auf dieselben Bausteine zurück.
 */

/** Ein-/Ausschalter im iOS-Stil. Zustand steht in `aria-checked`. */
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Für die Vorlesehilfe, wenn der Schalter allein steht. */
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  )
}

/** Zeile mit Beschriftung links und Schalter rechts. */
export function SwitchRow({ title, sub, checked, onChange, disabled }: {
  title: string
  sub?: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="set-row">
      <span className="set-row__main">
        <span className="set-row__title">{title}</span>
        {sub && <span className="set-row__sub">{sub}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  )
}

/** Zeile, die einen Wert zeigt — mit Pfeil, sobald sie etwas öffnet. */
export function ValueRow({ title, sub, value, onClick }: {
  title: string
  sub?: ReactNode
  value?: ReactNode
  onClick?: () => void
}) {
  const content = (
    <>
      <span className="set-row__main">
        <span className="set-row__title">{title}</span>
        {sub && <span className="set-row__sub">{sub}</span>}
      </span>
      {value && <span className="set-row__value">{value}</span>}
      {onClick && (
        <span className="set-row__chevron">
          <Icon name="chevronRight" size={16} />
        </span>
      )}
    </>
  )

  return onClick ? (
    <button type="button" className="set-row" onClick={onClick}>{content}</button>
  ) : (
    <div className="set-row">{content}</div>
  )
}

/** Auswahl unter wenigen Möglichkeiten — Design, Lieferart, Sprache. */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]
  value: T
  onChange: (next: T) => void
  label?: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className="segmented__item"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Beschriftetes Eingabefeld. */
export function Field({ label, value, onChange, placeholder, inputMode }: {
  label: string
  value: string
  onChange: (next: string) => void
  placeholder?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal'
}) {
  return (
    <label className="set-field">
      <span className="set-field__label">{label}</span>
      <input
        className="set-field__input"
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

/** Zustandschip: «aktiv» oder «nicht aktiviert». */
export function State({ on, children }: { on?: boolean; children: ReactNode }) {
  return <span className={'state' + (on ? ' state--on' : '')}>{children}</span>
}
