import { useMemo, useRef, useState } from 'react'
import { TODAY } from '../../../data/types'
import { formatAmount } from '../../../lib/money'
import { useSession } from '../../../app/session'
import { Icon } from '../../../app/shell/Icon'
import { Sheet } from '../../../app/shell/Sheet'
import { resolveBrand } from '../../../data/brands'
import {
  loadAssignments,
  saveAssignments,
  withAssignment,
  withoutAssignment,
  type Assignments,
} from '../assign'
import { MAX_ON_BOARD, openAssignments, type AssignGroup } from '../review'
import { fullMonthWindow } from '../derive'
import { CATEGORIES, categoryDef, slotLabel, type BudgetSlot, type CategoryKey } from '../slots'
import { merchantLabel } from '../merchant'
import '../budget.css'
import './assign.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Das Zuordnungsbrett.
 *
 * Die Herausforderung nennt die Zuordnung falsch eingetragener Buchungen
 * «mühsam»: jede einzeln öffnen, Dropdown aufklappen, auswählen, zurück. Der
 * Grund ist nicht das Dropdown. Der Grund ist, dass die App **eine Buchung**
 * fragt, wo der Mensch **eine Quelle** meint. Wer weiss, dass LANDI zum Haus
 * gehört, weiss es für alle neunzehn Einkäufe — die App fragt ihn neunzehnmal.
 *
 * Also fragt dieses Brett einmal pro Quelle. Ein Zug, und alle Buchungen
 * dieser Quelle folgen, rückwirkend und künftig (`assign.ts`).
 *
 * ── Warum ein Brett und keine Liste ───────────────────────────────────────
 *
 * Der Bildschirm **scrollt nicht**. Oben liegen die offenen Quellen, unten die
 * sechs Töpfe — beides gleichzeitig sichtbar, sonst kann man nirgendwohin
 * ziehen. Eine Liste, die scrollt, während man den Finger unten hält, ist
 * keine. Passen mehr Quellen aufs Brett, als Platz haben, kommen die grössten
 * zuerst und der Rest danach; das steht dann auch da.
 *
 * ── Warum Ziehen **und** Tippen ───────────────────────────────────────────
 *
 * Ziehen ist die schnelle Geste, aber es ist nie die einzige: Tippen wählt
 * eine Quelle aus, der zweite Tipp auf einen Topf ordnet sie zu. Dieselben
 * zwei Schritte, nur ohne Präzisionsanspruch — und damit funktioniert das
 * Brett auch mit Tastatur und Screenreader. Gezogen wird mit Pointer Events,
 * nicht mit HTML5-Drag-and-Drop: Letzteres feuert auf Touchgeräten schlicht
 * nicht.
 */

/** Ab wie vielen Pixeln eine Berührung als Ziehen und nicht als Tippen gilt. */
const DRAG_THRESHOLD = 8

/**
 * Kurznamen für die Töpfe.
 *
 * `slots.ts` trägt die Titel des Originals — «Versicherungen und Vorsorgen»,
 * «Mobilität und Kommunikation». Die stehen dort zu Recht wörtlich so, aber in
 * einem Feld von 110 Pixeln brechen sie auf drei Zeilen und drücken das Symbol
 * aus der Mitte. Der volle Titel steht im Blatt danach.
 */
const SHORT: Record<CategoryKey, string> = {
  taxes: 'Steuern',
  reside: 'Wohnen',
  insurance: 'Versicherungen',
  health: 'Gesundheit',
  mobility: 'Mobilität',
  consumption: 'Konsum',
}

interface Drag {
  key: string
  x: number
  y: number
  over: CategoryKey | null
}

/** Das Logo der Quelle, sonst der Anfangsbuchstabe. Wie in der Buchungszeile. */
function GroupMark({ group }: { group: AssignGroup }) {
  const match = resolveBrand(group.sample.text)
  if (match) {
    return (
      <span
        className={'asg-chip__mark asg-chip__mark--logo' + (match.bg ? ' is-filled' : '')}
        style={match.bg ? { background: match.bg } : undefined}
      >
        <img src={match.logo} alt="" width={36} height={36} />
      </span>
    )
  }
  return <span className="asg-chip__mark">{group.label.slice(0, 1).toUpperCase()}</span>
}

/**
 * Die Feldwahl nach dem Zug.
 *
 * Sechs Töpfe sind die Geste, neunzehn Felder die Genauigkeit, die das Budget
 * braucht. Hat ein Topf nur ein Feld — die Steuern —, entfällt dieser Schritt;
 * eine Frage mit einer einzigen Antwort ist keine Frage.
 */
function FieldSheet({
  category,
  group,
  onPick,
  onClose,
}: {
  category: CategoryKey
  group: AssignGroup
  onPick: (slot: BudgetSlot) => void
  onClose: () => void
}) {
  const def = categoryDef(category)
  return (
    <>
      <div className="sig-scrim" onClick={onClose} aria-hidden />
      <div className="sig-sheet" role="dialog" aria-label={`${group.label} — wohin genau?`}>
        <h3 className="sig-sheet__title">
          {group.label} → {def.title}
        </h3>
        <p className="asg-sheet__lead">Wohin genau? Gilt für alle {group.count} Buchungen.</p>
        {def.fields.map((field, index) => (
          <button
            key={field}
            className="sig-choice"
            onClick={() => onPick({ category, field: index })}
          >
            <span className="sig-choice__main">
              <span className="sig-choice__title">{field}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  )
}

export function Assign() {
  const { persona, pop, push } = useSession()
  const [assignments, setAssignments] = useState<Assignments>(() => loadAssignments(persona.id))
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pending, setPending] = useState<{ group: AssignGroup; category: CategoryKey } | null>(null)
  /** Die letzte Zuordnung — solange sie oben steht, lässt sie sich zurücknehmen. */
  const [last, setLast] = useState<{ group: AssignGroup; slot: BudgetSlot } | null>(null)
  /** Antwort auf einen Tipp ins Leere. */
  const [hint, setHint] = useState<string | null>(null)

  /* Rechtecke der sechs Töpfe, einmal beim Anfassen gemessen. Bei jedem
     Pointer-Ereignis neu zu messen, hiesse das Layout sechzigmal pro Sekunde
     zu erzwingen — und das Brett bewegt sich während des Zugs ohnehin nicht. */
  const tiles = useRef(new Map<CategoryKey, DOMRect>())
  const start = useRef({ x: 0, y: 0 })
  const moved = useRef(false)

  /* Zwölf volle Monate plus der laufende: Was gestern falsch hereinkam, soll
     heute auf dem Brett liegen und nicht erst nächsten Monat. */
  const groups = useMemo(() => {
    const { from } = fullMonthWindow(TODAY, 12)
    return openAssignments(persona.transactions, persona.accounts, {
      from,
      to: TODAY,
      ownName: persona.name,
      assignments,
    })
  }, [persona, assignments])

  const board = groups.slice(0, MAX_ON_BOARD)
  const waiting = groups.length - board.length
  const openTotal = groups.reduce((sum, group) => sum + group.total, 0)

  function assign(group: AssignGroup, slot: BudgetSlot) {
    const next = withAssignment(assignments, group.key, slot)
    setAssignments(next)
    saveAssignments(persona.id, next)
    setSelected(null)
    setPending(null)
    setHint(null)
    setLast({ group, slot })
  }

  /** Ein Topf ist gewählt — entweder direkt fertig oder mit einer Rückfrage. */
  function drop(group: AssignGroup, category: CategoryKey) {
    const def = categoryDef(category)
    if (def.fields.length === 1) assign(group, { category, field: 0 })
    else setPending({ group, category })
  }

  function undo() {
    if (!last) return
    const next = withoutAssignment(assignments, last.group.key)
    setAssignments(next)
    saveAssignments(persona.id, next)
    setLast(null)
  }

  // ── Ziehen ───────────────────────────────────────────────────────────────

  function measureTiles() {
    tiles.current.clear()
    for (const category of CATEGORIES) {
      const node = document.querySelector(`[data-drop="${category.key}"]`)
      if (node) tiles.current.set(category.key, node.getBoundingClientRect())
    }
  }

  function overAt(x: number, y: number): CategoryKey | null {
    for (const [key, rect] of tiles.current) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return key
    }
    return null
  }

  function onPointerDown(event: React.PointerEvent, group: AssignGroup) {
    event.currentTarget.setPointerCapture(event.pointerId)
    measureTiles()
    start.current = { x: event.clientX, y: event.clientY }
    moved.current = false
    setDrag({ key: group.key, x: event.clientX, y: event.clientY, over: null })
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    if (!moved.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    moved.current = true
    setDrag({
      ...drag,
      x: event.clientX,
      y: event.clientY,
      over: overAt(event.clientX, event.clientY),
    })
  }

  function onPointerUp(event: React.PointerEvent, group: AssignGroup) {
    if (!drag) return
    const over = moved.current ? overAt(event.clientX, event.clientY) : null
    setDrag(null)
    if (over) drop(group, over)
    /* Kein Zug, sondern ein Tipp: auswählen — oder die Auswahl aufheben, wenn
       dieselbe Quelle nochmals getippt wird. */
    else if (!moved.current) {
      setHint(null)
      setSelected(selected === group.key ? null : group.key)
    }
  }

  const dragged = drag ? board.find((group) => group.key === drag.key) : undefined
  const active = selected ? board.find((group) => group.key === selected) : undefined
  const done = groups.length === 0

  return (
    <Sheet title="Zuordnen" onBack={pop}>
      <div className={'asg' + (drag ? ' is-dragging' : '')}>
        {done ? (
          <div className="asg-done">
            <span className="asg-done__mark">
              <Icon name="check" size={30} />
            </span>
            <span className="asg-done__title">Alles zugeordnet</span>
            <span className="asg-done__body">
              Jede Quelle liegt in einem Topf. Neue Buchungen derselben Quelle landen ab jetzt
              gleich richtig — du musst nicht noch einmal hierher.
            </span>
            <button className="wz-next" onClick={() => push({ name: 'cockpit', view: 'budget' })}>
              Budget ansehen
            </button>
          </div>
        ) : (
          <>
            <p className="asg-lead">
              Zieh jede Quelle in ihren Topf, oder tipp beide an. Die Zuordnung gilt für alle
              Buchungen dieser Quelle — auch für die nächsten.
            </p>

            <div className="asg-queue">
              {board.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className={
                    'asg-chip' +
                    (selected === group.key ? ' is-selected' : '') +
                    (drag?.key === group.key ? ' is-lifted' : '')
                  }
                  onPointerDown={(event) => onPointerDown(event, group)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(event) => onPointerUp(event, group)}
                  onPointerCancel={() => setDrag(null)}
                  aria-pressed={selected === group.key}
                >
                  <GroupMark group={group} />
                  <span className="asg-chip__text">
                    <span className="asg-chip__name">{group.label}</span>
                    <span className="asg-chip__meta">
                      {group.count}× · {formatAmount(group.total, { sign: false })}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Der Platz in der Mitte gehört der ausgewählten Quelle: was sie
                ist, wo sie heute liegt, warum sie hier steht — und der rohe
                Buchungstext als Beleg. Dieselbe Doktrin wie überall in dieser
                Schicht: kein Satz ohne die Buchung, aus der er stammt. Ein
                fester Platz, damit das Brett bei jeder Auswahl gleich bleibt. */}
            <div className={'asg-look' + (active ? ' is-open' : '')} aria-live="polite">
              {active ? (
                <>
                  <span className="asg-look__head">
                    <span className="asg-look__name">{merchantLabel(active.sample)}</span>
                    <span className="asg-look__sum num">
                      {active.count}× · {formatAmount(active.total, { sign: false })}
                    </span>
                  </span>
                  <span className="asg-look__now">
                    Liegt heute in <strong>{slotLabel(active.current)}</strong>
                  </span>
                  <span className="asg-look__why">{active.reason}</span>
                  <span className="asg-look__proof">{active.sample.text}</span>
                </>
              ) : (
                <span className="asg-look__hint">
                  {hint ??
                    (waiting > 0
                      ? `Die grössten ${board.length} zuerst — ${waiting} weitere folgen danach.`
                      : `${groups.length === 1 ? 'Eine Quelle' : `${groups.length} Quellen`} offen, zusammen ${formatAmount(openTotal, { sign: false })}.`)}
                </span>
              )}
            </div>

            <div className="asg-grid" role="group" aria-label="Töpfe">
              {CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  data-drop={category.key}
                  className={
                    'asg-tile' +
                    (drag?.over === category.key ? ' is-over' : '') +
                    (active || drag ? ' is-armed' : '')
                  }
                  aria-label={`${category.title} — Topf`}
                  onClick={() => {
                    /* Kein toter Knopf: Wer zuerst den Topf tippt, bekommt
                       gesagt, was fehlt, statt gar nichts. */
                    if (active) drop(active, category.key)
                    else setHint('Wähl zuerst eine Quelle oben — oder zieh sie direkt hierher.')
                  }}
                >
                  <Icon name={category.icon} size={26} />
                  <span className="asg-tile__title">{SHORT[category.key]}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Die Rücknahme. Ziehen daneben ist keine Katastrophe, wenn sie
            einen Tipp weit weg ist. */}
        {last && (
          <div className="asg-undo" role="status">
            <span>
              {last.group.label} → {slotLabel(last.slot)}
            </span>
            <button onClick={undo}>rückgängig</button>
          </div>
        )}
      </div>

      {/* Der Geist am Finger. `pointer-events: none`, sonst träfe die
          Trefferprüfung ihn statt den Topf darunter. */}
      {drag && dragged && moved.current && (
        <div className="asg-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          <GroupMark group={dragged} />
          <span className="asg-chip__name">{dragged.label}</span>
        </div>
      )}

      {pending && (
        <FieldSheet
          category={pending.category}
          group={pending.group}
          onPick={(slot) => assign(pending.group, slot)}
          onClose={() => setPending(null)}
        />
      )}
    </Sheet>
  )
}
