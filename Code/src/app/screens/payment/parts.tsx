import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../shell/Icon'

/**
 * Bausteine, die sich die vier Schritte teilen.
 * Vorlage: fehlendeDetailseiten/Zahlung/IMG_5014–5020.
 */

/* ── Kopffläche ──────────────────────────────────────────────────────────── */

/** Fortschritt, Titel und die Zeile «an <Empfänger>» — auf jedem Schritt gleich. */
export function StepHead({
  step,
  title,
  sub,
  below,
  onBack,
  onClose,
}: {
  /** 1–4. Der erste Schritt zeigt in der Vorlage noch keinen Fortschritt. */
  step: number
  title: string
  sub?: ReactNode
  /** Was noch auf die getönte Fläche gehört — auf Schritt 3 der Umschalter. */
  below?: ReactNode
  onBack?: () => void
  onClose: () => void
}) {
  return (
    <div className="pay__head">
      <div className="pay__steps" aria-hidden="true">
        {[1, 2, 3, 4].map((index) => (
          <span key={index} className={'pay__step' + (index === step ? ' is-active' : '')} />
        ))}
      </div>

      <div className="pay__bar">
        <button className="pay__icon" onClick={onBack} disabled={!onBack} aria-label="Zurück">
          <Icon name="chevronLeft" size={24} />
        </button>
        <h1 className="pay__title">{title}</h1>
        <button className="pay__icon" onClick={onClose} aria-label="Zahlung abbrechen">
          <Icon name="close" size={22} />
        </button>
      </div>

      {sub && <p className="pay__sub">{sub}</p>}
      {below}
    </div>
  )
}

/* ── Feldzeile ──────────────────────────────────────────────────────────── */

/**
 * Eine Zeile mit Haarlinie darunter. `accent` färbt die Linie gelb — so zeigt
 * die Vorlage, welches Feld gerade dran ist (IMG_5016 der Betrag, IMG_5017
 * das Belastungskonto).
 */
export function Field({
  label,
  sub,
  chevron,
  accent,
  muted,
  right,
  onClick,
}: {
  label: ReactNode
  sub?: ReactNode
  chevron?: 'up' | 'down'
  accent?: boolean
  muted?: boolean
  right?: ReactNode
  onClick?: () => void
}) {
  const className =
    'pay-field' + (accent ? ' pay-field--accent' : '') + (muted ? ' pay-field--muted' : '')
  const inner = (
    <>
      <span className="pay-field__main">
        <span className="pay-field__label">{label}</span>
        {sub && <span className="pay-field__sub">{sub}</span>}
      </span>
      {right}
      {chevron && (
        <span className={'pay-field__chevron' + (chevron === 'up' ? ' pay-field__chevron--up' : '')}>
          <Icon name="chevronDown" size={22} />
        </span>
      )}
    </>
  )
  return onClick ? (
    <button className={className} onClick={onClick}>{inner}</button>
  ) : (
    <div className={className}>{inner}</div>
  )
}

/** Schalter wie in IMG_5018. Ausgegraut, wenn er nichts bewirken kann. */
export function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange?: (next: boolean) => void
}) {
  return (
    <button
      className="pay-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    />
  )
}

/* ── Auswahlblatt ───────────────────────────────────────────────────────── */

/**
 * Das Blatt, das von unten hereinfährt. In der Vorlage trägt es zweierlei:
 * die zwei Wege nach der Empfängerwahl (IMG_5015) und die Kontoauswahl
 * (IMG_5017). Der abgedunkelte Hintergrund schliesst es wieder.
 */
export function BottomSheet({
  title,
  label,
  onClose,
  children,
}: {
  title?: string
  /** Beschriftung ohne sichtbare Überschrift — die Kontoauswahl in IMG_5017. */
  label?: string
  onClose: () => void
  children: ReactNode
}) {
  /* Escape schliesst — im Browser die naheliegende Geste, und der Prototyp
     läuft auch am Laptop. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="pay-scrim" onClick={onClose} />
      <div className="pay-sheet" role="dialog" aria-modal="true" aria-label={title ?? label}>
        <div className="pay-sheet__grab"><span /></div>
        {title && <h2 className="pay-sheet__title">{title}</h2>}
        {children}
      </div>
    </>
  )
}

/** Eine Zeile im Auswahlblatt. */
export function SheetOption({
  icon,
  label,
  hint,
  amount,
  selected,
  onClick,
}: {
  icon?: IconName
  label: ReactNode
  hint?: ReactNode
  amount?: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button className="pay-sheet__option" aria-selected={selected} onClick={onClick}>
      {icon && <span className="pay-sheet__icon"><Icon name={icon} size={26} /></span>}
      <span className="pay-sheet__main">
        <span className="pay-sheet__label">{label}</span>
        {hint && <span className="pay-sheet__hint">{hint}</span>}
      </span>
      {amount && <span className="pay-sheet__amount num">{amount}</span>}
    </button>
  )
}

/* ── Ziffernblock ───────────────────────────────────────────────────────── */

const KEYS: { digit: string; letters?: string }[] = [
  { digit: '1' }, { digit: '2', letters: 'ABC' }, { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' }, { digit: '5', letters: 'JKL' }, { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' }, { digit: '8', letters: 'TUV' }, { digit: '9', letters: 'WXYZ' },
]

/**
 * Der Block aus der Vorlage. Dort ist es die Systemtastatur — im Nachbau muss
 * er selbst gezeichnet werden, sonst liesse sich im Telefonrahmen am Laptop
 * kein Betrag eingeben. Die Zifferntastatur nimmt zusätzlich die echte
 * Tastatur an.
 */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) onKey(event.key)
      else if (event.key === '.' || event.key === ',') onKey('.')
      else if (event.key === 'Backspace') onKey('back')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKey])

  return (
    <div className="pay-keys" role="group" aria-label="Ziffernblock">
      {KEYS.map((key) => (
        <button className="pay-key" key={key.digit} onClick={() => onKey(key.digit)}>
          <span className="pay-key__digit">{key.digit}</span>
          {key.letters && <span className="pay-key__letters">{key.letters}</span>}
        </button>
      ))}
      <button className="pay-key pay-key--flat" onClick={() => onKey('.')} aria-label="Punkt">
        <span className="pay-key__digit">.</span>
      </button>
      <button className="pay-key" onClick={() => onKey('0')}>
        <span className="pay-key__digit">0</span>
      </button>
      <button className="pay-key pay-key--flat" onClick={() => onKey('back')} aria-label="Löschen">
        <Icon name="backspace" size={26} />
      </button>
    </div>
  )
}

/* ── Wischen zum Ausführen ──────────────────────────────────────────────── */

/**
 * Die Geste am Ende der Vorlage (IMG_5019 → IMG_5020): Der weisse Knauf wird
 * nach rechts gezogen, erst am Anschlag wird ausgeführt.
 *
 * Bewusst kein Knopf. Wer nur tippt, löst nichts aus — genau das macht die
 * Sicherung aus, und deshalb steht sie in der Vorlage.
 */
export function SlideToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [done, setDone] = useState(false)

  /** Wie weit der Knauf laufen kann: Bahnbreite minus Knauf und beide Ränder. */
  const span = () => Math.max(0, (track.current?.clientWidth ?? 0) - 52 - 12)

  const move = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    setOffset(Math.min(span(), Math.max(0, clientX - box.left - 32)))
  }

  const release = () => {
    if (offset >= span() - 4) {
      setDone(true)
      setOffset(span())
      onConfirm()
    } else {
      setOffset(0)
    }
  }

  const progress = span() > 0 ? offset / span() : 0

  return (
    <div className={'pay-slide' + (done ? ' is-done' : '')} ref={track}>
      {/* Die Beschriftung blendet aus, während der Knauf darüber läuft. */}
      <span className="pay-slide__label" style={{ opacity: 1 - progress * 1.6 }}>{label}</span>
      <button
        className="pay-slide__knob"
        style={{ left: 6 + offset }}
        aria-label={label}
        onPointerDown={(event) => {
          if (done) return
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (done || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          move(event.clientX)
        }}
        onPointerUp={() => { if (!done) release() }}
        onPointerCancel={() => { if (!done) setOffset(0) }}
        /* Ohne Zeigegerät — Tastatur, Vorlesehilfe — bleibt die Aktion sonst
           unerreichbar. */
        onKeyDown={(event) => {
          if (done || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          setDone(true)
          setOffset(span())
          onConfirm()
        }}
      >
        <Icon name="chevronRight" size={24} />
      </button>
    </div>
  )
}
