import { useEffect, useRef, useState } from 'react'
import { toFrancs, toRappen } from '../benchmark'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Ein Betrag, den man schieben oder tippen kann.
 *
 * Gebaut auf `<input type="range">` und nicht auf einem eigenen Ziehgriff.
 * Das native Element bringt Tastaturbedienung, VoiceOver und die richtige
 * Trefferfläche auf dem Handy von selbst mit — nachgebaut wäre das eine halbe
 * Seite Code, die drei Dinge schlechter kann.
 *
 * Die Zahl daneben ist ein Eingabefeld. Wer weiss, dass die Miete 1'650 ist,
 * schiebt nicht dorthin, sondern tippt es. Beides schreibt denselben Wert.
 *
 * Es gibt bewusst **keine Verzögerung**: Der Originalrechner schickt für jede
 * Zahländerung einen Server-Aufruf mit 300 ms Debounce
 * (`pf-budget-wizard/SPEC.md`, 3.3). Hier rechnet dieselbe Formel lokal, also
 * bewegt sich die Summe unten, während der Daumen noch auf dem Regler liegt.
 */

export interface SliderProps {
  label: string
  /** Rappen. */
  value: number
  /** Rappen. */
  max: number
  onChange: (rappen: number) => void
  /** Zweite Zeile unter der Beschriftung — der Beleg zur Zahl. */
  hint?: string
  /** Der abgeleitete Wert, als Marke auf der Schiene. Rappen. */
  suggestion?: number
  /** Von Hand gesetzt — dann steht es dran und lässt sich zurücksetzen. */
  edited?: boolean
  onReset?: () => void
}

export function Slider({
  label,
  value,
  max,
  onChange,
  hint,
  suggestion,
  edited,
  onReset,
}: SliderProps) {
  /* Während des Tippens steht im Feld der Rohtext — sonst kann man die 1'650
     nicht auf 165 kürzen, weil jeder Tastendruck sofort formatiert würde. */
  const [typing, setTyping] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (document.activeElement !== input.current) setTyping(null)
  }, [value])

  const francs = toFrancs(value)
  const markLeft = suggestion !== undefined && max > 0 ? Math.min(100, (suggestion / max) * 100) : null

  /* Getippte Beträge werden auf dieselbe Obergrenze begrenzt wie der Regler.
     Sonst stünde im Feld eine Zahl, die der Daumen daneben nicht erreicht —
     und die Summe unten würde etwas anderes zeigen als die Schiene. */
  function commit(raw: string) {
    const cleaned = raw.replace(/[^\d]/g, '').slice(0, 7)
    const rappen = cleaned === '' ? 0 : toRappen(Number(cleaned))
    onChange(Math.min(rappen, max))
  }

  return (
    <div className={'sld' + (edited ? ' sld--edited' : '')}>
      <div className="sld__top">
        <span className="sld__main">
          <span className="sld__label">{label}</span>
          {hint && <span className="sld__hint">{hint}</span>}
        </span>

        <span className="sld__value">
          <span className="sld__cur">CHF</span>
          <input
            ref={input}
            className="sld__input num"
            inputMode="numeric"
            aria-label={`${label}, Betrag in Franken`}
            value={typing ?? francs.toLocaleString('de-CH').replace(/\s/g, '’')}
            onChange={(event) => {
              setTyping(event.target.value)
              commit(event.target.value)
            }}
            onFocus={() => setTyping(String(francs))}
            onBlur={() => setTyping(null)}
          />
        </span>
      </div>

      <div className="sld__track">
        <input
          className="sld__range"
          type="range"
          min={0}
          max={max}
          step={sliderStep(max)}
          value={Math.min(value, max)}
          aria-label={label}
          aria-valuetext={`${toFrancs(value).toLocaleString('de-CH')} Franken`}
          onChange={(event) => onChange(Math.min(Number(event.target.value), max))}
        />
        {/* Die Marke zeigt, was aus den Buchungen kam. Wer weit davon
            wegschiebt, sieht es, statt es zu erraten. */}
        {markLeft !== null && <span className="sld__mark" style={{ left: `${markLeft}%` }} aria-hidden />}
      </div>

      {edited && (
        <button className="sld__reset" onClick={onReset}>
          von dir gesetzt · zurück auf {suggestion !== undefined ? toFrancs(suggestion).toLocaleString('de-CH').replace(/\s/g, '’') : '0'}
        </button>
      )}
    </div>
  )
}

/**
 * Die Obergrenze der Schiene — **unabhängig vom aktuellen Wert**.
 *
 * Genau daran ist die erste Fassung gescheitert: Sie rechnete die Grenze aus
 * `max(Vorschlag, aktueller Wert)`. Wer den Regler ans Ende zog, verdoppelte
 * damit die Grenze, konnte erneut ans Ende ziehen und wieder verdoppeln. Nach
 * acht Zügen stand ein Steuerbudget von CHF 1'154 bei CHF 307'200. Eine
 * Obergrenze, die auf ihren eigenen Wert reagiert, ist keine.
 *
 * Sie kommt jetzt aus zwei festen Grössen:
 *
 *   · dem **Vierfachen des abgeleiteten Werts** — genug Luft, um eine Kategorie
 *     zu vervielfachen, ohne dass der abgeleitete Wert am linken Rand klebt;
 *   · einem **Viertel des Monatseinkommens** als Boden, damit auch ein Feld
 *     ohne Vorschlag bedienbar ist. Wer nie Miete gezahlt hat, soll trotzdem
 *     eine eintragen können.
 *
 * Aufgerundet auf glatte Hunderter, damit die Schiene nicht bei 1'347 endet.
 */
export function sliderMax(suggestion: number, incomeMonth: number): number {
  const raw = Math.max(suggestion * 4, incomeMonth * 0.25, toRappen(1000))
  return toRappen(Math.ceil(toFrancs(raw) / 100) * 100)
}

/**
 * Die Schrittweite, passend zur Länge der Schiene.
 *
 * Zehnerschritte auf einer kurzen Schiene sind fein genug; auf einer langen
 * wären es tausend Rasten, zwischen denen der Daumen nichts mehr trifft. Ziel
 * sind rund zweihundert Stufen — genug für flüssiges Ziehen, wenig genug für
 * runde Zahlen.
 */
export function sliderStep(max: number): number {
  const target = toFrancs(max) / 200
  const sizes = [10, 20, 50, 100, 200, 500]
  return toRappen(sizes.find((size) => size >= target) ?? 1000)
}
