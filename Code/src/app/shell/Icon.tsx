/**
 * UI-Glyphen im PostFinance-Stil: Petrol-Outline, 1.6px, runde Enden,
 * ein gelbes Akzentdetail wo die Vorlage eines hat.
 *
 * Die 228 offiziellen SVGs im PREP-Dossier sind 96px-Produktillustrationen
 * und für eine Tab-Bar zu detailliert — deshalb hier ein kleiner, eigener Satz.
 */
export type IconName =
  | 'home' | 'payments' | 'invest' | 'offers' | 'services'
  | 'scan' | 'pay' | 'transfer' | 'analysis' | 'settings'
  | 'search' | 'chevronDown' | 'chevronRight' | 'chevronLeft'
  | 'more' | 'co2' | 'card' | 'bell' | 'document' | 'person' | 'support'
  | 'clock' | 'billPending' | 'sun' | 'moon'
  /* «Profil und Einstellungen» — Vorlage IMG_5013 */
  | 'lock' | 'accounts' | 'trendUp' | 'list' | 'twint'
  | 'plus' | 'globe' | 'calendar' | 'accountPerson' | 'logout' | 'discover'
  /* Oberkategorien der Aufteilung — Vorlage IMG_1696–1698 */
  | 'sliders' | 'sofa' | 'bag' | 'heartPulse' | 'ball' | 'tram' | 'bank'
  | 'banknoteIn' | 'banknoteOut'

const P: Record<IconName, string> = {
  home: 'M3 10.2 12 3l9 7.2M5.6 8.6V20h12.8V8.6M9.8 20v-5.4h4.4V20',
  payments: 'M3.4 8.6h14M14 5.4l3.4 3.2L14 11.8M20.6 15.4h-14M10 12.2 6.6 15.4 10 18.6',
  invest: 'M3.6 19.6V9.8M8.6 19.6v-6.2M13.6 19.6v-9M18.6 19.6V6.2M3.6 6.6 9 4.4l4.2 2.6L20.4 3',
  offers: 'M5.6 8.4h12.8l1 11.2H4.6l1-11.2ZM9 8.4V6.2a3 3 0 0 1 6 0v2.2',
  services: 'M9.4 11.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8ZM3 20.2c0-3.2 2.9-5.4 6.4-5.4M17.4 14.2v1.2M17.4 19.8V21M14.9 15.8l.9.9M19 20l.9.9M13.6 18.4h1.2M20 18.4h1.2M14.9 21l.9-.9M19 16.7l.9-.9',
  scan: 'M4 8.6V5.4A1.4 1.4 0 0 1 5.4 4h3.2M15.4 4h3.2A1.4 1.4 0 0 1 20 5.4v3.2M20 15.4v3.2a1.4 1.4 0 0 1-1.4 1.4h-3.2M8.6 20H5.4A1.4 1.4 0 0 1 4 18.6v-3.2M7.6 7.6h3v3h-3zM13.4 7.6h3v3h-3zM7.6 13.4h3v3h-3zM13.4 13.4h1.4M16 13.4h.4M13.4 16h3',
  pay: 'M4 12h15M14.4 7.4 19.6 12l-5.2 4.6',
  transfer: 'M4.6 7.4h11.2M13 4.8l2.8 2.6L13 10M19.4 16.6H8.2M11 14l-2.8 2.6L11 19.2',
  analysis: 'M4.6 19.4V12M9.4 19.4V7.6M14.2 19.4v-4.2M19 19.4V4.6',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM19.4 12c0-.6-.1-1.1-.2-1.6l1.8-1.3-1.9-3.2-2.1.8a7.4 7.4 0 0 0-2.8-1.6L13.9 3h-3.8l-.3 2.1a7.4 7.4 0 0 0-2.8 1.6l-2.1-.8-1.9 3.2 1.8 1.3a7 7 0 0 0 0 3.2l-1.8 1.3 1.9 3.2 2.1-.8a7.4 7.4 0 0 0 2.8 1.6l.3 2.1h3.8l.3-2.1a7.4 7.4 0 0 0 2.8-1.6l2.1.8 1.9-3.2-1.8-1.3c.1-.5.2-1 .2-1.6Z',
  search: 'M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6ZM15.8 15.8 20 20',
  chevronDown: 'm6 9.4 6 5.6 6-5.6',
  chevronRight: 'm9.4 6 5.6 6-5.6 6',
  chevronLeft: 'M14.6 6 9 12l5.6 6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  co2: 'M6.4 16.6a3.4 3.4 0 0 1 .5-6.8 4.8 4.8 0 0 1 9.2-1.2 3.6 3.6 0 0 1 1.5 7',
  card: 'M3.4 7.4A1.4 1.4 0 0 1 4.8 6h14.4a1.4 1.4 0 0 1 1.4 1.4v9.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4V7.4ZM3.4 10.4h17.2M6.4 14.6h3.2',
  bell: 'M12 3.6a5.4 5.4 0 0 0-5.4 5.4c0 4.2-1.6 5.6-1.6 5.6h14s-1.6-1.4-1.6-5.6A5.4 5.4 0 0 0 12 3.6ZM10.4 17.8a1.8 1.8 0 0 0 3.2 0',
  document: 'M13.4 3.6H6.8a1.4 1.4 0 0 0-1.4 1.4v14a1.4 1.4 0 0 0 1.4 1.4h10.4a1.4 1.4 0 0 0 1.4-1.4V8.6l-5.2-5ZM13.2 3.8v4.8h5M8.6 13h6.8M8.6 16.4h6.8',
  person: 'M12 12.2a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6ZM4.8 20.4c0-3.6 3.2-6.2 7.2-6.2s7.2 2.6 7.2 6.2',
  support: 'M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8ZM9.6 9.8a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6v.4M12 17.2h.01',
  clock: 'M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8ZM12 7.4V12l3 1.8',
  billPending: 'M3.6 7.6a1.4 1.4 0 0 1 1.4-1.4h11a1.4 1.4 0 0 1 1.4 1.4v5.2M3.6 7.6v8.8a1.4 1.4 0 0 0 1.4 1.4h6.4M6.6 10.4h5',
  sun: 'M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8ZM12 2.6v2M12 19.4v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.6 12h2M19.4 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z',
  plus: 'M12 5.2v13.6M5.2 12h13.6',
  globe: 'M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8ZM3.6 12h16.8M12 3.6a13 13 0 0 1 0 16.8 13 13 0 0 1 0-16.8Z',
  calendar: 'M4.6 7.6A1.4 1.4 0 0 1 6 6.2h12a1.4 1.4 0 0 1 1.4 1.4v10.8a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4V7.6ZM8 4.4v3.4M16 4.4v3.4M9 12.6h.01M15 12.6h.01',
  accountPerson: 'M11 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM4.4 19.6c0-3.2 2.9-5.4 6.6-5.4',
  logout: 'M13.4 4.6H6.8a1.4 1.4 0 0 0-1.4 1.4v12a1.4 1.4 0 0 0 1.4 1.4h6.6M15 8.6l3.4 3.4-3.4 3.4M10.4 12h8',
  discover: 'M11 17.6a6.6 6.6 0 1 0 0-13.2 6.6 6.6 0 0 0 0 13.2ZM15.8 15.8 20 20M8.4 11.6l2-2.2 1.8 1.6 2.2-2.6',

  /* ── Profil und Einstellungen ──────────────────────────────────
     Die neun Einträge der Vorlage brauchen fünf Glyphen, die es noch nicht gab.
     Bell, Doppelpfeil und Zahnrad stehen schon oben. */
  lock:
    'M6.4 10.6h11.2a1.2 1.2 0 0 1 1.2 1.2v6.8a1.2 1.2 0 0 1-1.2 1.2H6.4a1.2 1.2 0 0 1-1.2-1.2v-6.8a1.2 1.2 0 0 1 1.2-1.2Z' +
    'M8.8 10.6V7.9a3.2 3.2 0 0 1 6.4 0v2.7M12 14.2v2.2',
  /* Konten und Bankpakete: die vordere Karte, dahinter der Rand der zweiten. */
  accounts:
    'M4.6 8.8h14.8a1.2 1.2 0 0 1 1.2 1.2v6.6a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2V10a1.2 1.2 0 0 1 1.2-1.2Z' +
    'M6 6.2h12',
  trendUp: 'M3.6 16.8 9.2 11.2l3.2 2.8 5-6M14.4 7.6h3.6v3.6',
  list: 'M8.6 7h11.4M8.6 12h11.4M8.6 17h11.4M4.4 7h.01M4.4 12h.01M4.4 17h.01',
  /* TWINT: das Sechseck der Marke, darin das W — als Outline, damit es zu den
     übrigen Glyphen passt. */
  twint:
    'M12 3.4 19.2 7.4v9.2L12 20.6 4.8 16.6V7.4L12 3.4Z' +
    'M8.4 10.2l1.9 3.6 1.7-2.7 1.7 2.7 1.9-3.6',

  /* ── Oberkategorien der Aufteilung ──────────────────────────────────────
     Regler oben rechts, dann je ein Sinnbild pro Topf. Vorlage IMG_1696–1698. */
  sliders:
    'M3.4 7.4h3.8M11 7.4h9.6M3.4 12h9.6M16.4 12h4.2M3.4 16.6h3.8M11 16.6h9.6' +
    'M9.1 5.6a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z' +
    'M14.6 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z' +
    'M9.1 14.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z',
  sofa:
    'M5.6 11.2V8a1.6 1.6 0 0 1 1.6-1.6h9.6A1.6 1.6 0 0 1 18.4 8v3.2' +
    'M3.4 12.6a1.6 1.6 0 0 1 3.2 0v3.8h10.8v-3.8a1.6 1.6 0 0 1 3.2 0v4.6' +
    'a1.2 1.2 0 0 1-1.2 1.2H4.6a1.2 1.2 0 0 1-1.2-1.2v-4.6Z' +
    'M6.6 18.4V20M17.4 18.4V20' +
    'M9.4 9h.01M12 9h.01M14.6 9h.01',
  /* Der Bügel steckt in ACCENT — in der Vorlage ist er gelb, der Korpus nicht. */
  bag: 'M5.6 8.4h12.8l1 11.2H4.6l1-11.2Z',
  heartPulse:
    'M12 19.8 5 12.8a4.4 4.4 0 0 1 6.2-6.2l.8.8.8-.8a4.4 4.4 0 0 1 6.2 6.2l-7 7Z',
  ball:
    'M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8Z' +
    'M12 7.8 16 10.7l-1.5 4.7h-5L8 10.7 12 7.8Z' +
    'M12 7.8V3.6M16 10.7 20 9.4M14.5 15.4l2.4 3.4M9.5 15.4l-2.4 3.4M8 10.7 4 9.4',
  tram:
    'M7.4 4.8h9.2A1.6 1.6 0 0 1 18.2 6.4v9.6a1.6 1.6 0 0 1-1.6 1.6H7.4a1.6 1.6 0 0 1-1.6-1.6V6.4' +
    'a1.6 1.6 0 0 1 1.6-1.6ZM6 10h12M12 4.8V2.8M8.8 17.6 7.2 21M15.2 17.6 16.8 21',
  bank: 'M3.2 9.6 12 4.6l8.8 5M5.2 9.8v7.8M9.7 9.8v7.8M14.3 9.8v7.8M18.8 9.8v7.8M3 19.4h18',
  banknoteIn: 'M6.2 6.4h12.8A1.4 1.4 0 0 1 20.4 7.8v5.4a1.4 1.4 0 0 1-1.4 1.4H6.2A1.4 1.4 0 0 1 4.8 13.2V7.8A1.4 1.4 0 0 1 6.2 6.4ZM7.6 9h3.4M7.6 11.4h1.8',
  banknoteOut: 'M6.2 6.4h12.8A1.4 1.4 0 0 1 20.4 7.8v5.4a1.4 1.4 0 0 1-1.4 1.4H6.2A1.4 1.4 0 0 1 4.8 13.2V7.8A1.4 1.4 0 0 1 6.2 6.4ZM7.6 9h3.4M7.6 11.4h1.8',
}

/** Gefüllte Varianten für den aktiven Reiter — so macht es die echte App. */
const FILLED: Partial<Record<IconName, string>> = {
  home: 'M12 2.9 2.4 10.6a1 1 0 0 0 .6 1.8h1.2V20a1 1 0 0 0 1 1h4v-5.6h5.6V21h4a1 1 0 0 0 1-1v-7.6H21a1 1 0 0 0 .6-1.8L12 2.9Z',
  offers: 'M5.6 7.4h12.8a1 1 0 0 1 1 1.1l-1 11.2a1 1 0 0 1-1 .9H5.6a1 1 0 0 1-1-.9l-1-11.2a1 1 0 0 1 1-1.1ZM8.4 8.4V6.2a3.6 3.6 0 0 1 7.2 0v2.2',
  services: 'M9.4 11.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM2.6 20.4c0-3.4 3-5.8 6.8-5.8 1.2 0 2.3.2 3.3.7',
}

/** Glyphen mit gelbem Akzentdetail — wie in der offiziellen Icon-Bibliothek. */
const ACCENT: Partial<Record<IconName, string>> = {
  invest: 'M20.4 3h-4M20.4 3v4',
  accountPerson: 'M16.6 19.8a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z',
  billPending: 'M16.6 20.4a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6ZM16.6 15.4v1.8l1.2.8',

  /* Oberkategorien: In der Vorlage trägt jedes dieser Sinnbilder genau ein
     gelbes Detail — Bügel, Pulslinie, Lichter, Richtungspfeil. */
  bag: 'M9 8.4V6.2a3 3 0 0 1 6 0v2.2',
  heartPulse: 'M6.8 12.4h2.4l1.4-2.6 1.8 4.6 1.4-2h3.4',
  tram: 'M8.9 13.6h.01M15.1 13.6h.01',
  banknoteIn:
    'M5.6 21.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM7.2 17.8H4M5.4 16.4 4 17.8l1.4 1.4',
  banknoteOut:
    'M19.6 21.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2ZM18 17.8h3.2M19.8 16.4l1.4 1.4-1.4 1.4',
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 1.6,
  accent = false,
  filled = false,
}: {
  name: IconName
  size?: number
  strokeWidth?: number
  /** Akzentdetail in PostFinance-Gelb mitzeichnen. */
  accent?: boolean
  /** Gefüllte Variante, falls vorhanden — für den aktiven Reiter. */
  filled?: boolean
}) {
  const solid = filled ? FILLED[name] : undefined
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {solid ? (
        <path d={solid} fill="currentColor" stroke="none" />
      ) : (
        <path d={P[name]} strokeWidth={filled ? strokeWidth + 0.6 : strokeWidth} />
      )}
      {accent && ACCENT[name] && (
        <path d={ACCENT[name]} stroke="var(--postfinancegelb)" strokeWidth={strokeWidth + 0.2} />
      )}
    </svg>
  )
}
