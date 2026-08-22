import type { IconName } from '../shell/Icon'
import type { Screen, Tab } from '../session'
import type { SettingsSection } from '../settings'

/**
 * Was die Suche ausser Buchungen noch kennen muss.
 *
 * In der echten App findet die Suchleiste nicht nur Zahlungen, sondern auch
 * Einstellungen — «twint», «dark mode», «face id» führen direkt auf die
 * passende Seite. Der Nachbau kann das bisher nicht: `screens/Flows.tsx`
 * durchsucht nur `persona.transactions`.
 *
 * Dieser Katalog ist die fehlende Hälfte. Er ist bewusst von Hand geschrieben
 * und nicht aus den Bildschirmen abgeleitet:
 *
 *  - Die Begriffe, unter denen jemand sucht, stehen nirgends im Code. Wer
 *    «dark mode» tippt, meint den Umschalter, der in der App «Design» heisst;
 *    wer «fingerabdruck» tippt, meint «Face ID». Solche Wörter kann nur eine
 *    gepflegte Liste liefern.
 *  - Ein Eintrag darf feiner sein als eine Seite. «Kontostand-Warnung» ist ein
 *    Schalter tief in den Benachrichtigungen — als Treffer muss er trotzdem
 *    einzeln auftauchen, mit dem Weg dorthin in der Unterzeile.
 *
 * Quelle für Titel und Reihenfolge: `screens/Settings.tsx` und
 * `fehlendeDetailseiten/Profil und Einstellungen/IMG_5013.PNG`. Wer dort etwas
 * ändert, ändert es hier mit — die Liste ist eine Kopie, keine Ableitung.
 */

/** Woher der Treffer kommt. Bestimmt die Gruppe in der Trefferliste. */
export type EntryKind = 'setting' | 'function'

/** Wohin ein Treffer führt: auf einen Bildschirm oder auf einen Reiter. */
export type Target =
  | { type: 'screen'; screen: Screen }
  | { type: 'tab'; tab: Tab }

export interface CatalogEntry {
  id: string
  kind: EntryKind
  title: string
  /** Der Weg dorthin, wie er unter dem Titel steht. */
  path: string
  /** Suchbegriffe, die nicht schon im Titel oder im Weg stehen. */
  keywords: string[]
  icon: IconName
  target: Target
}

const SETTINGS_ROOT = 'Profil und Einstellungen'

/** Kurzform für die neun Unterseiten — der häufigste Fall. */
function section(name: SettingsSection): Target {
  return { type: 'screen', screen: { name: 'settingsSection', section: name } }
}

/* ── Einstellungen ──────────────────────────────────────────────────────────
   Zuerst die neun Seiten selbst, danach die einzelnen Schalter und Felder
   darauf. Beide sind Treffer: Wer «benachrichtigungen» sucht, will die Seite,
   wer «kontostand warnung» sucht, will den Schalter. */

const SETTING_ENTRIES: CatalogEntry[] = [
  /* Die neun Seiten, in der Reihenfolge der Vorlage. */
  {
    id: 'set.profile',
    kind: 'setting',
    title: 'Profil',
    path: SETTINGS_ROOT,
    keywords: ['kontaktdaten', 'adressen', 'vollmachten', 'persönliche daten', 'konto inhaber'],
    icon: 'person',
    target: section('profile'),
  },
  {
    id: 'set.login',
    kind: 'setting',
    title: 'Login und Sicherheit',
    path: SETTINGS_ROOT,
    keywords: ['benutzername', 'passwort', 'anmeldung', 'sicherheit', 'zugang'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.notifications',
    kind: 'setting',
    title: 'Benachrichtigungen',
    path: SETTINGS_ROOT,
    keywords: ['push', 'mitteilungen', 'meldungen', 'alarm', 'e-mail'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.accounts',
    kind: 'setting',
    title: 'Konten und Bankpakete',
    path: SETTINGS_ROOT,
    keywords: ['kontobezeichnung', 'bankpaket', 'dokumente', 'kontoauszug'],
    icon: 'accounts',
    target: section('accounts'),
  },
  {
    id: 'set.payments',
    kind: 'setting',
    title: 'Zahlungen',
    path: SETTINGS_ROOT,
    keywords: ['ebill', 'twint', 'postfinance pay', 'ezag', 'zahlungsarten'],
    icon: 'payments',
    target: section('payments'),
  },
  {
    id: 'set.invest',
    kind: 'setting',
    title: 'Anlegen',
    path: SETTINGS_ROOT,
    keywords: ['anlegerprofil', 'e-trading', 'depot', 'börse'],
    icon: 'trendUp',
    target: section('invest'),
  },
  {
    id: 'set.orders',
    kind: 'setting',
    title: 'Serviceaufträge',
    path: SETTINGS_ROOT,
    keywords: ['bestellübersicht', 'bestellstatus', 'aufträge', 'bestellung'],
    icon: 'list',
    target: section('orders'),
  },
  {
    id: 'set.app',
    kind: 'setting',
    title: 'App-Einstellungen',
    path: SETTINGS_ROOT,
    keywords: ['design', 'sprache', 'mobiltelefonnummer', 'version'],
    icon: 'settings',
    target: section('app'),
  },
  {
    id: 'set.twint',
    kind: 'setting',
    title: 'PostFinance TWINT',
    path: SETTINGS_ROOT,
    keywords: ['limite', 'bewegungen', 'handy zahlen', 'twint aktivieren', 'geld an freunde'],
    icon: 'twint',
    target: section('twint'),
  },

  /* Profil */
  {
    id: 'set.profile.customer',
    kind: 'setting',
    title: 'Kundennummer',
    path: `${SETTINGS_ROOT} · Profil`,
    keywords: ['kundennummer', 'identifikation', 'nummer'],
    icon: 'person',
    target: section('profile'),
  },
  {
    id: 'set.profile.phone',
    kind: 'setting',
    title: 'Mobiltelefon',
    path: `${SETTINGS_ROOT} · Profil`,
    keywords: ['handynummer', 'telefonnummer', 'natel', 'nummer ändern'],
    icon: 'person',
    target: section('profile'),
  },
  {
    id: 'set.profile.email',
    kind: 'setting',
    title: 'E-Mail-Adresse',
    path: `${SETTINGS_ROOT} · Profil`,
    keywords: ['mail', 'e-mail ändern', 'kontaktdaten'],
    icon: 'person',
    target: section('profile'),
  },
  {
    id: 'set.profile.address',
    kind: 'setting',
    title: 'Adressen',
    path: `${SETTINGS_ROOT} · Profil`,
    keywords: ['wohnadresse', 'korrespondenzadresse', 'umzug', 'adressänderung', 'postadresse'],
    icon: 'person',
    target: section('profile'),
  },
  {
    id: 'set.profile.power',
    kind: 'setting',
    title: 'Vollmachten',
    path: `${SETTINGS_ROOT} · Profil`,
    keywords: ['bevollmächtigung', 'zugriff für andere', 'erteilte vollmacht'],
    icon: 'person',
    target: section('profile'),
  },

  /* Login und Sicherheit */
  {
    id: 'set.login.username',
    kind: 'setting',
    title: 'Benutzername',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['login name', 'anmeldename'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.login.password',
    kind: 'setting',
    title: 'Passwort',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['passwort ändern', 'kennwort', 'neues passwort'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.login.faceid',
    kind: 'setting',
    title: 'Face ID',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['biometrie', 'touch id', 'fingerabdruck', 'gesichtserkennung', 'ohne passwort'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.login.mobileid',
    kind: 'setting',
    title: 'Mobile ID',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['sim karte', 'bestätigung', 'zwei faktor'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.login.quickbalance',
    kind: 'setting',
    title: 'Saldo vor dem Login',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['quick balance', 'kontostand ohne login', 'startbildschirm'],
    icon: 'lock',
    target: section('login'),
  },
  {
    id: 'set.login.devices',
    kind: 'setting',
    title: 'Angemeldete Geräte',
    path: `${SETTINGS_ROOT} · Login und Sicherheit`,
    keywords: ['geräte', 'iphone', 'ipad', 'sitzungen abmelden'],
    icon: 'lock',
    target: section('login'),
  },

  /* Benachrichtigungen */
  {
    id: 'set.notify.push',
    kind: 'setting',
    title: 'Push auf dieses Gerät',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['push', 'mitteilungen', 'benachrichtigung ausschalten'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.email',
    kind: 'setting',
    title: 'E-Mail-Benachrichtigungen',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['mail', 'newsletter'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.incoming',
    kind: 'setting',
    title: 'Zahlungseingang',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['lohn', 'gutschrift', 'geld erhalten', 'rückerstattung'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.card',
    kind: 'setting',
    title: 'Kartenzahlungen',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['belastung', 'karte', 'jede zahlung melden'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.ebill',
    kind: 'setting',
    title: 'Neue eBill-Rechnung',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['rechnung', 'ebill meldung'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.lowbalance',
    kind: 'setting',
    title: 'Kontostand-Warnung',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['schwelle', 'zu wenig geld', 'limite', 'warnung', 'minus'],
    icon: 'bell',
    target: section('notifications'),
  },
  {
    id: 'set.notify.offers',
    kind: 'setting',
    title: 'Angebote und Tipps',
    path: `${SETTINGS_ROOT} · Benachrichtigungen`,
    keywords: ['werbung', 'marketing abschalten'],
    icon: 'bell',
    target: section('notifications'),
  },

  /* Konten und Bankpakete */
  {
    id: 'set.accounts.delivery',
    kind: 'setting',
    title: 'Lieferart der Dokumente',
    path: `${SETTINGS_ROOT} · Konten und Bankpakete`,
    keywords: ['papier', 'elektronisch', 'kontoauszug', 'post', 'beleg'],
    icon: 'document',
    target: section('accounts'),
  },
  {
    id: 'set.accounts.label',
    kind: 'setting',
    title: 'Kontobezeichnung',
    path: `${SETTINGS_ROOT} · Konten und Bankpakete`,
    keywords: ['konto umbenennen', 'eigener name', 'kontoname ändern'],
    icon: 'accounts',
    target: section('accounts'),
  },

  /* Zahlungen */
  {
    id: 'set.pay.ebill',
    kind: 'setting',
    title: 'eBill',
    path: `${SETTINGS_ROOT} · Zahlungen`,
    keywords: ['rechnungen elektronisch', 'ebill aktivieren'],
    icon: 'document',
    target: section('payments'),
  },
  {
    id: 'set.pay.pfpay',
    kind: 'setting',
    title: 'PostFinance Pay',
    path: `${SETTINGS_ROOT} · Zahlungen`,
    keywords: ['online shop', 'ohne karte bezahlen', 'checkout'],
    icon: 'payments',
    target: section('payments'),
  },
  {
    id: 'set.pay.ezag',
    kind: 'setting',
    title: 'EZAG',
    path: `${SETTINGS_ROOT} · Zahlungen`,
    keywords: ['sammelauftrag', 'lohnlauf', 'datei einliefern'],
    icon: 'payments',
    target: section('payments'),
  },
  {
    id: 'set.pay.limits',
    kind: 'setting',
    title: 'Zahlungslimiten',
    path: `${SETTINGS_ROOT} · Zahlungen`,
    keywords: ['limite', 'tageslimite', 'ausland', 'maximalbetrag'],
    icon: 'payments',
    target: section('payments'),
  },

  /* Anlegen */
  {
    id: 'set.invest.profile',
    kind: 'setting',
    title: 'Anlegerprofil',
    path: `${SETTINGS_ROOT} · Anlegen`,
    keywords: ['risiko', 'ertrag', 'ausgewogen', 'wachstum', 'strategie'],
    icon: 'trendUp',
    target: section('invest'),
  },
  {
    id: 'set.invest.etrading',
    kind: 'setting',
    title: 'E-Trading',
    path: `${SETTINGS_ROOT} · Anlegen`,
    keywords: ['selbst handeln', 'börse', 'aktien kaufen'],
    icon: 'trendUp',
    target: section('invest'),
  },
  {
    id: 'set.invest.alerts',
    kind: 'setting',
    title: 'Kursmeldungen',
    path: `${SETTINGS_ROOT} · Anlegen`,
    keywords: ['kursalarm', 'schwelle', 'titel beobachten'],
    icon: 'trendUp',
    target: section('invest'),
  },

  /* App-Einstellungen */
  {
    id: 'set.app.theme',
    kind: 'setting',
    title: 'Design — hell oder dunkel',
    path: `${SETTINGS_ROOT} · App-Einstellungen`,
    keywords: ['dark mode', 'darkmode', 'nachtmodus', 'darstellung', 'theme', 'hell', 'dunkel'],
    icon: 'moon',
    target: section('app'),
  },
  {
    id: 'set.app.language',
    kind: 'setting',
    title: 'Sprache',
    path: `${SETTINGS_ROOT} · App-Einstellungen`,
    keywords: ['deutsch', 'französisch', 'italienisch', 'englisch', 'language', 'langue'],
    icon: 'globe',
    target: section('app'),
  },
  {
    id: 'set.app.phone',
    kind: 'setting',
    title: 'Mobiltelefonnummer',
    path: `${SETTINGS_ROOT} · App-Einstellungen`,
    keywords: ['handynummer', 'natel', 'nummer für bestätigungen'],
    icon: 'settings',
    target: section('app'),
  },
  {
    id: 'set.app.version',
    kind: 'setting',
    title: 'Version',
    path: `${SETTINGS_ROOT} · App-Einstellungen`,
    keywords: ['app version', 'über die app', 'build'],
    icon: 'settings',
    target: section('app'),
  },

  /* PostFinance TWINT */
  {
    id: 'set.twint.limit',
    kind: 'setting',
    title: 'TWINT-Limite pro Monat',
    path: `${SETTINGS_ROOT} · PostFinance TWINT`,
    keywords: ['limite erhöhen', 'monatslimite', 'maximalbetrag twint'],
    icon: 'twint',
    target: section('twint'),
  },
  {
    id: 'set.twint.movements',
    kind: 'setting',
    title: 'TWINT-Bewegungen',
    path: `${SETTINGS_ROOT} · PostFinance TWINT`,
    keywords: ['twint zahlungen', 'gesendet', 'empfangen'],
    icon: 'twint',
    target: section('twint'),
  },

  /* Serviceaufträge */
  {
    id: 'set.orders.list',
    kind: 'setting',
    title: 'Bestellübersicht',
    path: `${SETTINGS_ROOT} · Serviceaufträge`,
    keywords: ['bestellstatus', 'neue karte bestellen', 'auftrag verfolgen'],
    icon: 'list',
    target: section('orders'),
  },
]

/* ── Funktionen ─────────────────────────────────────────────────────────────
   Alles, was man in der App tun oder öffnen kann. In der echten App liefert
   die Suche auch das — «scannen» führt auf die Kamera, nicht auf eine
   Buchung, in der «Scan» vorkommt. */

const FUNCTION_ENTRIES: CatalogEntry[] = [
  {
    id: 'fn.scan',
    kind: 'function',
    title: 'Scannen',
    path: 'Zahlungen',
    keywords: ['qr code', 'qr rechnung', 'einzahlungsschein', 'kamera', 'rechnung abfotografieren'],
    icon: 'scan',
    target: { type: 'screen', screen: { name: 'scan' } },
  },
  {
    id: 'fn.pay',
    kind: 'function',
    title: 'Zahlen',
    path: 'Zahlungen',
    keywords: ['neue zahlung', 'überweisung', 'iban', 'geld senden', 'einzahlung'],
    icon: 'pay',
    target: { type: 'screen', screen: { name: 'pay' } },
  },
  {
    id: 'fn.transfer',
    kind: 'function',
    title: 'Übertragen',
    path: 'Zahlungen',
    keywords: ['umbuchen', 'eigene konten', 'aufs sparkonto', 'kontoübertrag'],
    icon: 'transfer',
    target: { type: 'screen', screen: { name: 'transfer' } },
  },
  {
    id: 'fn.analysis',
    kind: 'function',
    title: 'Cockpit',
    path: 'Home',
    /* «Analysen» bleibt als Stichwort: Der Bildschirm hiess so, und wer ihn
       sucht, tippt weiterhin diesen Namen. */
    keywords: ['analysen', 'auswertung', 'statistik', 'wohin geht mein geld', 'übersicht ausgaben'],
    icon: 'analysis',
    target: { type: 'screen', screen: { name: 'cockpit' } },
  },
  {
    id: 'fn.budget',
    kind: 'function',
    title: 'Budget',
    path: 'Cockpit',
    keywords: ['budget', 'budgetrechner', 'was bleibt übrig', 'ausgaben planen', 'richtwert'],
    icon: 'document',
    target: { type: 'screen', screen: { name: 'cockpit', view: 'budget' } },
  },
  {
    id: 'fn.breakdown.expenses',
    kind: 'function',
    title: 'Ausgaben nach Kategorie',
    path: 'Cockpit',
    keywords: ['aufteilung', 'kategorien', 'wofür', 'einkaufen wohnen freizeit'],
    icon: 'banknoteOut',
    target: { type: 'screen', screen: { name: 'breakdown', direction: 'expenses' } },
  },
  {
    id: 'fn.breakdown.income',
    kind: 'function',
    title: 'Einnahmen nach Kategorie',
    path: 'Cockpit',
    keywords: ['aufteilung', 'lohn', 'woher kommt das geld'],
    icon: 'banknoteIn',
    target: { type: 'screen', screen: { name: 'breakdown', direction: 'income' } },
  },
  {
    id: 'fn.recurring',
    kind: 'function',
    title: 'Wiederkehrende Buchungen',
    path: 'Cockpit',
    keywords: ['abo', 'abos', 'abonnemente', 'fixkosten', 'daueraufträge', 'monatlich', 'kündigen'],
    icon: 'clock',
    target: { type: 'screen', screen: { name: 'recurring' } },
  },
  {
    id: 'fn.settings',
    kind: 'function',
    title: 'Profil und Einstellungen',
    path: 'Services',
    keywords: ['einstellungen', 'settings', 'optionen', 'konfiguration'],
    icon: 'settings',
    target: { type: 'screen', screen: { name: 'settings' } },
  },
  {
    id: 'fn.tab.home',
    kind: 'function',
    title: 'Home',
    path: 'Reiter',
    keywords: ['startseite', 'übersicht', 'konten', 'kontostand', 'saldo'],
    icon: 'home',
    target: { type: 'tab', tab: 'home' },
  },
  {
    id: 'fn.tab.payments',
    kind: 'function',
    title: 'Zahlungen',
    path: 'Reiter',
    keywords: ['pendente aufträge', 'daueraufträge', 'ebill'],
    icon: 'payments',
    target: { type: 'tab', tab: 'payments' },
  },
  {
    id: 'fn.tab.invest',
    kind: 'function',
    title: 'Anlegen',
    path: 'Reiter',
    keywords: ['depot', 'fonds', 'fondssparplan', 'vorsorge 3a', 'e-trading', 'wertschriften'],
    icon: 'invest',
    target: { type: 'tab', tab: 'invest' },
  },
  {
    id: 'fn.tab.offers',
    kind: 'function',
    title: 'Angebote',
    path: 'Reiter',
    keywords: ['kreditkarte', 'hypothek', 'vorsorge', 'konto eröffnen', 'beratung', 'produkte'],
    icon: 'offers',
    target: { type: 'tab', tab: 'offers' },
  },
  {
    id: 'fn.tab.services',
    kind: 'function',
    title: 'Services',
    path: 'Reiter',
    keywords: ['karten', 'dokumente', 'kontakt', 'support', 'hilfe', 'logout', 'abmelden'],
    icon: 'services',
    target: { type: 'tab', tab: 'services' },
  },
]

export const CATALOG: CatalogEntry[] = [...SETTING_ENTRIES, ...FUNCTION_ENTRIES]

/**
 * Was bei leerem Suchfeld dasteht. Die echte App zeigt dort zuletzt Gesuchtes;
 * der Prototyp merkt sich nichts, also stehen hier die Wege, die in der Demo
 * ohnehin gebraucht werden.
 */
export const SUGGESTED_IDS = [
  'fn.recurring',
  'set.app.theme',
  'set.notify.lowbalance',
  'fn.analysis',
  'set.twint',
] as const

export const SUGGESTIONS: CatalogEntry[] = SUGGESTED_IDS.map((id) =>
  CATALOG.find((entry) => entry.id === id),
).filter((entry): entry is CatalogEntry => entry !== undefined)
