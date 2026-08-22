import { useEffect, useRef } from 'react'
import { SHEET_MS } from '../session'

/**
 * Fokus erst setzen, wenn der Bildschirm angekommen ist.
 *
 * `autoFocus` setzt den Fokus im Augenblick des Einhängens — also dann, wenn
 * die Ebene noch ganz rechts steht und erst losfährt. Auf dem Telefon fährt
 * die Tastatur dadurch hoch, während die Seite noch hereingleitet: Die Fläche
 * ändert mitten in der Bewegung ihre Höhe, der Browser rollt das Feld
 * zusätzlich ins Bild, und der Eintritt sieht aus, als käme die Seite
 * verpackt und schief von der Seite herein.
 *
 * Gemessen: Beim Öffnen der Suche hatte das Eingabefeld den Fokus bereits,
 * als die Ebene noch bei `translateX(382px)` stand — praktisch ausserhalb des
 * Bildschirms.
 *
 * Deshalb warten wir das Ende der Push-Animation ab. Das ist kein geratener
 * Zeitwert, sondern das Ereignis der Ebene selbst; `SHEET_MS` dient nur als
 * Netz, falls gar nicht animiert wird.
 *
 * Preis dieser Lösung: Der Fokus fällt aus der Berührung heraus, mit der er
 * ausgelöst wurde. iOS Safari zeigt die Tastatur dann unter Umständen erst
 * nach einem Tippen ins Feld. Der Bildschirm kommt dafür sauber herein.
 */
export function useFocusWhenSettled<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const field = ref.current
    if (!field) return

    let done = false
    const focus = () => {
      if (done) return
      done = true
      /* `preventScroll`: Das Feld steht ohnehin im Bild. Ohne das rückt der
         Browser die Ebene zusätzlich zurecht — sichtbar als Ruck. */
      field.focus({ preventScroll: true })
    }

    /* Ohne Ebene gibt es nichts abzuwarten: Dann steht der Bildschirm schon. */
    const layer = field.closest<HTMLElement>('.layer')
    if (!layer) {
      focus()
      return
    }

    const onEnd = (event: AnimationEvent) => {
      /* Nur die Ebene selbst. Animationen von Kindern steigen hier auch
         vorbei und dürfen den Fokus nicht vorzeitig auslösen. */
      if (event.target === layer) focus()
    }
    layer.addEventListener('animationend', onEnd)

    /* Netz für den Fall, dass keine Animation läuft — abgeschaltete Bewegung,
       oder die Ebene stand schon, als das Feld dazukam. */
    const timer = window.setTimeout(focus, SHEET_MS + 60)

    return () => {
      layer.removeEventListener('animationend', onEnd)
      window.clearTimeout(timer)
    }
  }, [])

  return ref
}
