import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Kopfzeile: links ein Platz, rechts die Such-Pille.
 *
 * Der linke Platz ist bewusst nicht belegt — im Nachbau steht dort nichts.
 * Was dort erscheint, kommt von aussen (`leading`), damit dieser Baustein
 * nichts von unserer Schicht weiss.
 */
export function TopBar({ onSearch, leading }: {
  onSearch: () => void
  leading?: ReactNode
}) {
  return (
    <div className="topbar">
      <span className="topbar__leading">{leading}</span>
      <button className="topbar__pill" onClick={onSearch}>
        <Icon name="search" size={16} />
        Suchen
      </button>
    </div>
  )
}

export interface CircleAction {
  icon: IconName
  label: string
  /** Gelb gefüllt — die primäre Aktion des Bildschirms. */
  primary?: boolean
  outline?: boolean
  onClick?: () => void
}

export function CircleRow({ actions }: { actions: CircleAction[] }) {
  return (
    <div className="circles">
      {actions.map((action) => (
        <button className="circle" key={action.label} onClick={action.onClick}>
          <span
            className={
              'circle__disc' +
              (action.primary ? ' circle__disc--action' : '') +
              (action.outline ? ' circle__disc--outline' : '')
            }
          >
            <Icon name={action.icon} size={24} />
          </span>
          <span className="circle__label">{action.label}</span>
        </button>
      ))}
    </div>
  )
}

export function SectionHead({ title, value }: { title: string; value?: string }) {
  return (
    <div className="section-head">
      <span className="section-head__title">{title}</span>
      {value && <span className="section-head__value num">{value}</span>}
    </div>
  )
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="card">
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  )
}

/** Listenzeile. Als Button, sobald `onClick` gesetzt ist. */
export function Row({
  icon,
  iconAccent,
  title,
  sub,
  badge,
  amount,
  credit,
  chevron,
  onClick,
}: {
  icon?: IconName
  /** Gelbes Akzentdetail im Symbol, wie in der offiziellen Icon-Bibliothek. */
  iconAccent?: boolean
  title: ReactNode
  sub?: ReactNode
  badge?: string
  amount?: string
  credit?: boolean
  chevron?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      {icon && (
        <span className="tx-icon">
          <Icon name={icon} size={22} accent={iconAccent} />
        </span>
      )}
      <span className="row__main">
        <span className="row__line">
          <span className="row__title">{title}</span>
          {amount && (
            <span className={'row__amount num' + (credit ? ' row__amount--credit' : '')}>{amount}</span>
          )}
        </span>
        {sub && <span className="row__sub">{sub}</span>}
        {badge && <span className="badge">{badge}</span>}
      </span>
      {chevron && (
        <span className="row__chevron">
          <Icon name="chevronRight" size={18} />
        </span>
      )}
    </>
  )

  return onClick ? (
    <button className="row" onClick={onClick}>{content}</button>
  ) : (
    <div className="row">{content}</div>
  )
}
