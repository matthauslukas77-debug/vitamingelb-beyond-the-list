/**
 * Was die Nutzerin unter «Profil und Einstellungen» selbst setzen kann.
 *
 * Vorlage: fehlendeDetailseiten/Profil und Einstellungen/IMG_5013.PNG — die
 * neun Einträge dort sind die neun Abschnitte hier. Ein flaches Objekt statt
 * verschachtelter Bereiche: Eine Einstellung ist genau ein Schlüssel, und ein
 * Schalter braucht nichts als `settings.pushEnabled` und `setSetting`.
 *
 * Die Werte liegen im `localStorage`, getrennt pro Persona. So bleibt eine
 * gesetzte Einstellung über den Neuladen hinweg stehen — wichtig, wenn in der
 * Demo jemand etwas umstellt und danach durch die App läuft.
 */

/** Die neun Unterseiten. Reihenfolge wie in der Vorlage. */
export type SettingsSection =
  | 'profile'
  | 'login'
  | 'notifications'
  | 'accounts'
  | 'payments'
  | 'invest'
  | 'orders'
  | 'app'
  | 'twint'

export type DocumentDelivery = 'electronic' | 'paper'
export type InvestorProfile = 'income' | 'balanced' | 'growth'
export type Language = 'de' | 'fr' | 'it' | 'en'

export interface Settings {
  /* Login und Sicherheit */
  biometrics: boolean
  mobileId: boolean
  /** Saldo schon vor dem Login sichtbar. */
  quickBalance: boolean

  /* Benachrichtigungen */
  pushEnabled: boolean
  emailEnabled: boolean
  notifyIncoming: boolean
  notifyCard: boolean
  notifyEbill: boolean
  notifyLowBalance: boolean
  /** Schwelle der Kontostand-Warnung, in Franken. */
  lowBalanceChf: number
  notifyOffers: boolean

  /* Konten und Bankpakete */
  documentDelivery: DocumentDelivery
  /** Eigene Kontobezeichnungen, je Konto-Id. Leer = Name der Bank. */
  accountLabels: Record<string, string>

  /* Zahlungen */
  ebill: boolean
  twint: boolean
  postfinancePay: boolean
  ezag: boolean

  /* Anlegen */
  investorProfile: InvestorProfile
  etradingEnabled: boolean
  priceAlerts: boolean

  /* App-Einstellungen */
  language: Language
  phone: string

  /* PostFinance TWINT */
  twintLimitChf: number
}

export const DEFAULT_SETTINGS: Settings = {
  biometrics: true,
  mobileId: false,
  quickBalance: false,

  pushEnabled: true,
  emailEnabled: false,
  notifyIncoming: true,
  notifyCard: true,
  notifyEbill: true,
  notifyLowBalance: false,
  lowBalanceChf: 200,
  notifyOffers: false,

  documentDelivery: 'electronic',
  accountLabels: {},

  ebill: true,
  twint: true,
  postfinancePay: false,
  ezag: false,

  investorProfile: 'balanced',
  etradingEnabled: false,
  priceAlerts: false,

  language: 'de',
  phone: '+41 79 000 00 00',

  twintLimitChf: 3000,
}

const KEY = 'beyond-the-list.settings'

function storageKey(personaId: string): string {
  return `${KEY}.${personaId}`
}

/**
 * Gespeicherte Einstellungen lesen. Unbekannte oder fehlende Schlüssel fallen
 * auf die Vorgabe zurück — so überlebt ein alter Eintrag im Browser eine neue
 * Einstellung, ohne dass ein Bildschirm auf `undefined` läuft.
 */
export function loadSettings(personaId: string): Settings {
  try {
    const raw = window.localStorage.getItem(storageKey(personaId))
    if (!raw) return DEFAULT_SETTINGS
    const stored = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...stored, accountLabels: { ...stored.accountLabels } }
  } catch {
    /* Privates Fenster, gesperrter Speicher, kaputtes JSON — die Vorgabe
       genügt, ein Fehler an dieser Stelle darf die App nicht aufhalten. */
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(personaId: string, settings: Settings): void {
  try {
    window.localStorage.setItem(storageKey(personaId), JSON.stringify(settings))
  } catch {
    /* Nicht speichern können ist hier kein Fehler, den die Nutzerin sehen muss. */
  }
}

export function clearSettings(personaId: string): void {
  try {
    window.localStorage.removeItem(storageKey(personaId))
  } catch {
    /* siehe oben */
  }
}
