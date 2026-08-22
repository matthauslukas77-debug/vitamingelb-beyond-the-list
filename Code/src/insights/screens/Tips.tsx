import { useMemo, useState } from 'react'
import { TODAY } from '../../data/types'
import { useSession } from '../../app/session'
import { Icon } from '../../app/shell/Icon'
import { Sheet } from '../../app/shell/Sheet'
import { resolvedTips, type ResolvedTip } from '../tips/tips'
import { isSeen, loadSeen, saveSeen, withSeen, type Seen } from '../tips/seen'
import './tips.css'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * «Das kann die App» — unsere Funktionen, in je einem Satz.
 *
 * Die Interviews sind eindeutig: geöffnet wird für den Saldo, danach wieder zu.
 * Was tiefer liegt, findet niemand. Dieser Bildschirm ist die Antwort darauf,
 * und er ist bewusst kein Hilfetext:
 *
 *   · **Scannbar zuerst.** Jede Zeile trägt einen Satz, der beantwortet «gibt
 *     es das?». Wer nur überfliegt, hat danach den Überblick — und das ist der
 *     eigentliche Zweck. Die Anleitung kommt erst auf Wunsch.
 *   · **Zwei Ebenen, nicht drei.** Antippen klappt «So geht's» auf. Mehr
 *     Ebenen wären ein Handbuch, und Handbücher liest niemand.
 *   · **Immer einen Tipp entfernt.** Jede Zeile hat den Sprung zur echten
 *     Funktion. Eine Erklärung ohne Weg dorthin ist eine Ausrede.
 *   · **Neu heisst neu für dich.** Was aufgeklappt wurde, rutscht nach unten
 *     zu «Kennst du schon». Die Liste schrumpft mit der Zeit, statt immer
 *     gleich dazustehen.
 *
 * Titel, Weg, Symbol und Ziel kommen aus dem Suchkatalog, nicht von hier —
 * sonst gäbe es zwei Listen unserer Funktionen, die auseinanderlaufen. Siehe
 * `insights/tips/tips.ts`.
 */

function TipRow({ tip, open, seen, onToggle, onOpen }: {
  tip: ResolvedTip
  open: boolean
  seen: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <div className={'tip' + (open ? ' tip--open' : '')}>
      <button
        className="tip__head"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`tip-body-${tip.id}`}
      >
        <span className="tip__icon"><Icon name={tip.entry.icon} size={20} /></span>
        <span className="tip__main">
          <span className="tip__title">
            {tip.entry.title}
            {!seen && <span className="tip__new" aria-label="noch nicht angesehen" />}
          </span>
          <span className="tip__what">{tip.what}</span>
        </span>
        <span className="tip__chevron" aria-hidden>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {open && (
        <div className="tip__body" id={`tip-body-${tip.id}`}>
          <p className="tip__how">
            <span className="tip__how-label">So geht’s</span>
            {tip.how}
          </p>
          <button className="tip__go" onClick={onOpen}>
            {tip.entry.title} öffnen
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export function Tips() {
  const { persona, pop, push, setTab } = useSession()

  const tips = useMemo(() => resolvedTips(), [])
  const [seen, setSeen] = useState<Seen>(() => loadSeen(persona.id))
  const [open, setOpen] = useState<string | null>(null)

  /* Aufklappen gilt als «gesehen». Nur eine Zeile ist gleichzeitig offen —
     bei acht Einträgen sonst eine Wand aus Text, durch die man scrollen muss,
     statt die Liste zu überblicken. */
  function toggle(id: string) {
    setOpen((current) => (current === id ? null : id))
    if (!isSeen(seen, id)) {
      const next = withSeen(seen, id, TODAY)
      setSeen(next)
      saveSeen(persona.id, next)
    }
  }

  function go(tip: ResolvedTip) {
    if (tip.entry.target.type === 'tab') setTab(tip.entry.target.tab)
    else push(tip.entry.target.screen)
  }

  /* Die Trennung entsteht aus dem Zustand beim Öffnen des Bildschirms und
     nicht aus `seen`: Sonst springt eine Zeile beim Aufklappen in die andere
     Gruppe, und man verliert die Stelle, an der man gerade liest. */
  const [wasNew] = useState<Set<string>>(
    () => new Set(tips.filter((tip) => !isSeen(loadSeen(persona.id), tip.id)).map((tip) => tip.id)),
  )
  const fresh = tips.filter((tip) => wasNew.has(tip.id))
  const known = tips.filter((tip) => !wasNew.has(tip.id))

  const rows = (list: ResolvedTip[]) =>
    list.map((tip) => (
      <TipRow
        key={tip.id}
        tip={tip}
        open={open === tip.id}
        seen={isSeen(seen, tip.id)}
        onToggle={() => toggle(tip.id)}
        onOpen={() => go(tip)}
      />
    ))

  return (
    <Sheet title="Das kann die App" onBack={pop}>
      <div className="screen__inner">
        <p className="tips__lead">
          Acht Funktionen, die es in der App heute nicht gibt. Je ein Satz — und der Weg dorthin.
        </p>

        {fresh.length > 0 && (
          <>
            <div className="section-head">
              <span className="section-head__title">Neu für dich</span>
              <span className="section-head__value">{fresh.length}</span>
            </div>
            <div className="tips">{rows(fresh)}</div>
          </>
        )}

        {known.length > 0 && (
          <>
            <div className="section-head">
              <span className="section-head__title">Kennst du schon</span>
              <span className="section-head__value">{known.length}</span>
            </div>
            <div className="tips">{rows(known)}</div>
          </>
        )}
      </div>
    </Sheet>
  )
}
