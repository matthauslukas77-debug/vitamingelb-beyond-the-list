import { useState } from 'react'
import { TODAY } from '../../../data/types'
import {
  centsToRaw,
  newDraft,
  orderFromDraft,
  rawToCents,
  type PaymentDraft,
  type Recipient,
} from '../../../domain/payment'
import { useSession } from '../../session'
import { RecipientStep } from './RecipientStep'
import { AmountStep } from './AmountStep'
import { ExecutionStep } from './ExecutionStep'
import { SummaryStep } from './SummaryStep'
import { DoneStep } from './DoneStep'
import './payment.css'

/**
 * Der Zahlungsauftrag — vier Schritte plus Bestätigung.
 * Vorlage: fehlendeDetailseiten/Zahlung/IMG_5014–5020.
 *
 * Vorher stand hier ein flaches Formular mit dem Hinweis «Im Prototyp wird
 * keine Zahlung ausgelöst». Jetzt läuft der Fluss durch: Am Ende entsteht ein
 * Auftrag, der im Zahlungen-Reiter unter «Pendente Aufträge» beziehungsweise
 * «Daueraufträge» steht und in die Prognose auf Home eingeht.
 *
 * Ein eigener kleiner Schrittzähler statt eines Routers — dieselbe Entscheidung
 * wie beim Bildschirmstapel in `session.tsx`, und der Zurück-Pfeil verhält sich
 * wie in der App.
 */

type Step = 1 | 2 | 3 | 4 | 'done'

/** Läuft nur in der Sitzung — reicht, um Aufträge auseinanderzuhalten. */
let counter = 0

export function Pay() {
  const session = useSession()
  const { persona, pop, addOrder, setTab } = session
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<PaymentDraft | null>(null)

  const pick = (recipient: Recipient, copy: boolean) => {
    const next = newDraft(recipient, persona, TODAY)
    /* «Daten der bestehenden Zahlung kopieren» übernimmt den Betrag der letzten
       Zahlung — nur ihn: Datum und Konto gehören zum neuen Auftrag. */
    const amount = copy && recipient.last ? rawToCents(centsToRaw(recipient.last.amount)) : 0
    setDraft({ ...next, amount })
    setStep(2)
  }

  const confirm = () => {
    if (!draft) return
    counter += 1
    addOrder(orderFromDraft(draft, `${persona.id}-neu-${counter}`))
    setStep('done')
  }

  /* Fertig heisst: zurück in den Zahlungen-Reiter, wo der neue Auftrag steht. */
  const finish = () => {
    setTab('payments')
    pop()
  }

  if (step === 1 || !draft) {
    return <RecipientStep onPick={pick} onCancel={pop} />
  }

  const change = (next: PaymentDraft) => setDraft(next)

  switch (step) {
    case 2:
      return (
        <AmountStep
          draft={draft}
          onChange={change}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          onClose={pop}
        />
      )
    case 3:
      return (
        <ExecutionStep
          draft={draft}
          onChange={change}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
          onClose={pop}
        />
      )
    case 4:
      return (
        <SummaryStep
          draft={draft}
          onEdit={setStep}
          onConfirm={confirm}
          onBack={() => setStep(3)}
          onClose={pop}
        />
      )
    case 'done':
      return <DoneStep draft={draft} onFinish={finish} />
  }
}
