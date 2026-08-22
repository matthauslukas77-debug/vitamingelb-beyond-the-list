import { useState } from 'react'
import { TODAY, type Account } from '../../data/types'
import { formatMoney } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { useSession } from '../session'
import type { SettingsSection } from '../settings'
import { Icon, type IconName } from '../shell/Icon'
import { Sheet } from '../shell/Sheet'
import { Field, Segmented, State, SwitchRow, ValueRow } from '../shell/controls'
import { pretty } from './Recurring'

/**
 * «Profil und Einstellungen» — der vierte Eintrag unter Services.
 *
 * Vorlage: fehlendeDetailseiten/Profil und Einstellungen/IMG_5013.PNG. Die
 * Übersicht ist eine schlichte Liste ohne Karte: Symbol, fette Bezeichnung,
 * darunter die Stichworte. Neun Einträge, dieselbe Reihenfolge.
 *
 * Jeder Eintrag führt auf eine eigene Unterseite. Was dort steht, lässt sich
 * tatsächlich verstellen: Der Zustand liegt in `src/app/settings.ts` und
 * überlebt im `localStorage` das Neuladen. Nichts davon geht an eine Bank —
 * es ist ein Prototyp, und die Zahlen sind erfunden.
 *
 * Die Schalter dafür, welche Funktionen unserer Schicht mitlaufen, kommen
 * später dazu; der Speicher ist darauf vorbereitet.
 */

interface Entry {
  icon: IconName
  title: string
  sub: string
  section: SettingsSection
  dot?: boolean
}

const ENTRIES: Entry[] = [
  { icon: 'person', title: 'Profil', sub: 'Kontaktdaten, Adressen, Vollmachten', section: 'profile' },
  { icon: 'lock', title: 'Login und Sicherheit', sub: 'Benutzername, Passwort, Login-Varianten', section: 'login' },
  { icon: 'bell', title: 'Benachrichtigungen', sub: 'Push- und E-Mail-Benachrichtigungen', section: 'notifications' },
  { icon: 'accounts', title: 'Konten und Bankpakete', sub: 'Kontobezeichnung, Lieferart der Dokumente', section: 'accounts' },
  { icon: 'payments', title: 'Zahlungen', sub: 'eBill, PostFinance TWINT, PostFinance Pay, EZAG', section: 'payments' },
  { icon: 'trendUp', title: 'Anlegen', sub: 'Anlegerprofile, E-Trading Funktionen', section: 'invest' },
  { icon: 'list', title: 'Serviceaufträge', sub: 'Bestellübersicht, Bestellstatus, Details', section: 'orders' },
  { icon: 'settings', title: 'App-Einstellungen', sub: 'Design, Mobiltelefonnummer', section: 'app' },
  { icon: 'twint', title: 'PostFinance TWINT', sub: 'Limite, Bewegungen', section: 'twint' },
]

const TITLES: Record<SettingsSection, string> = {
  profile: 'Profil',
  login: 'Login und Sicherheit',
  notifications: 'Benachrichtigungen',
  accounts: 'Konten und Bankpakete',
  payments: 'Zahlungen',
  invest: 'Anlegen',
  orders: 'Serviceaufträge',
  app: 'App-Einstellungen',
  twint: 'PostFinance TWINT',
}

function MenuRow({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  return (
    <button className="menu__row" onClick={onClick}>
      <span className="menu__icon">
        <Icon name={entry.icon} size={26} />
        {entry.dot && <span className="menu__dot" />}
      </span>
      <span className="menu__main">
        <span className="menu__title">{entry.title}</span>
        <span className="menu__sub">{entry.sub}</span>
      </span>
    </button>
  )
}

/** Die Übersicht — Vorlage IMG_5013. */
export function ProfileSettings() {
  const { pop, push } = useSession()

  return (
    <Sheet title="Profil und Einstellungen" onBack={pop}>
      <div className="menu">
        {ENTRIES.map((entry) => (
          <MenuRow
            key={entry.section}
            entry={entry}
            onClick={() => push({ name: 'settingsSection', section: entry.section })}
          />
        ))}
        <p className="empty" style={{ fontSize: 12 }}>
          Prototyp · Änderungen bleiben nur auf diesem Gerät
        </p>
      </div>
    </Sheet>
  )
}

/* ── Die neun Unterseiten ──────────────────────────────────────────────── */

/**
 * Die Adresse steht in der Persona (`src/data/types.ts`). Geburtsdatum und
 * E-Mail braucht kein anderer Bildschirm — die stehen deshalb hier, erfunden,
 * aber zur Person passend. Bei einer unbekannten Persona greift die Ableitung
 * aus dem Namen.
 */
const CONTACT: Record<string, { email: string; birthday: string; customer: string }> = {
  reto: { email: 'reto.buehler@example.ch', birthday: '14.03.2004', customer: '4812 6033 91' },
  nino: { email: 'nino.roth@example.ch', birthday: '02.11.2006', customer: '4913 7741 02' },
  livia: { email: 'livia.berger@example.ch', birthday: '27.06.2005', customer: '5027 1188 46' },
  bruno: { email: 'bruno.aebischer@example.ch', birthday: '09.05.1967', customer: '3164 9052 77' },
}

function contactFor(personaId: string, name: string) {
  return (
    CONTACT[personaId] ?? {
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.ch`,
      birthday: '01.01.1990',
      customer: '0000 0000 00',
    }
  )
}

function Profil() {
  const { persona, settings, setSetting } = useSession()
  const contact = contactFor(persona.id, persona.name)

  return (
    <div className="screen__inner">
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-strong)' }}>{persona.name}</div>
          <div style={{ marginTop: 2, fontSize: 14, color: 'var(--text-muted)' }}>
            Geburtsdatum {contact.birthday}
          </div>
        </div>
        <ValueRow title="Kundennummer" value={contact.customer} />
      </section>

      <div className="section-head"><span className="section-head__title">Kontaktdaten</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)', paddingBottom: 'var(--s-2)' }}>
          <Field
            label="Mobiltelefon"
            value={settings.phone}
            onChange={(next) => setSetting('phone', next)}
            inputMode="tel"
          />
          <p className="set-note">Wird gespeichert und für Bestätigungen verwendet.</p>
        </div>
        {/* Die E-Mail-Adresse ändert man in der echten App über einen
            bestätigten Auftrag — hier steht sie deshalb nur da. */}
        <ValueRow title="E-Mail" sub="Änderung nur über einen Auftrag" value={contact.email} />
      </section>

      <div className="section-head"><span className="section-head__title">Adressen</span></div>
      <section className="card">
        <ValueRow
          title="Wohnadresse"
          sub={`${persona.address.street} · ${persona.address.place}`}
        />
        <ValueRow title="Korrespondenzadresse" sub="gleich wie Wohnadresse" />
      </section>

      <div className="section-head"><span className="section-head__title">Vollmachten</span></div>
      <section className="card">
        <ValueRow title="Erteilte Vollmachten" value="keine" />
        <ValueRow title="Erhaltene Vollmachten" value="keine" />
      </section>
    </div>
  )
}

function LoginSicherheit() {
  const { persona, settings, setSetting } = useSession()

  return (
    <div className="screen__inner">
      <section className="card">
        <ValueRow title="Benutzername" value={`${persona.id}.${persona.name.split(' ')[1].toLowerCase()}`} />
        <ValueRow title="Passwort" sub="zuletzt geändert am 04.02.2026" value="••••••••" />
      </section>

      <div className="section-head"><span className="section-head__title">Login-Varianten</span></div>
      <section className="card">
        <SwitchRow
          title="Face ID"
          sub="Login mit dem Gesicht statt mit dem Passwort"
          checked={settings.biometrics}
          onChange={(next) => setSetting('biometrics', next)}
        />
        <SwitchRow
          title="Mobile ID"
          sub="Bestätigung über die SIM-Karte"
          checked={settings.mobileId}
          onChange={(next) => setSetting('mobileId', next)}
        />
        <SwitchRow
          title="Saldo vor dem Login"
          sub="Kontostand schon auf dem Startbildschirm zeigen"
          checked={settings.quickBalance}
          onChange={(next) => setSetting('quickBalance', next)}
        />
      </section>

      <div className="section-head"><span className="section-head__title">Angemeldete Geräte</span></div>
      <section className="card">
        <ValueRow title="iPhone 15 · dieses Gerät" sub={`aktiv seit ${formatDate(TODAY)}`} value="aktiv" />
        <ValueRow title="iPad Air" sub="letzter Login 11.08.2026" />
      </section>
      <p className="empty" style={{ fontSize: 12 }}>Im Prototyp ist kein echter Login hinterlegt.</p>
    </div>
  )
}

function Benachrichtigungen() {
  const { settings, setSetting } = useSession()
  const off = !settings.pushEnabled && !settings.emailEnabled

  return (
    <div className="screen__inner">
      <section className="card">
        <SwitchRow
          title="Push auf dieses Gerät"
          checked={settings.pushEnabled}
          onChange={(next) => setSetting('pushEnabled', next)}
        />
        <SwitchRow
          title="E-Mail"
          checked={settings.emailEnabled}
          onChange={(next) => setSetting('emailEnabled', next)}
        />
      </section>

      <div className="section-head">
        <span className="section-head__title">Wofür</span>
        {off && <span className="section-head__value">nichts aktiv</span>}
      </div>
      <section className="card">
        <SwitchRow
          title="Zahlungseingang"
          sub="Lohn, Rückerstattungen, Gutschriften"
          checked={settings.notifyIncoming}
          onChange={(next) => setSetting('notifyIncoming', next)}
          disabled={off}
        />
        <SwitchRow
          title="Kartenzahlungen"
          sub="jede Belastung mit Karte oder Handy"
          checked={settings.notifyCard}
          onChange={(next) => setSetting('notifyCard', next)}
          disabled={off}
        />
        <SwitchRow
          title="Neue eBill-Rechnung"
          checked={settings.notifyEbill}
          onChange={(next) => setSetting('notifyEbill', next)}
          disabled={off}
        />
        <SwitchRow
          title="Kontostand-Warnung"
          sub={`meldet sich unter CHF ${settings.lowBalanceChf}`}
          checked={settings.notifyLowBalance}
          onChange={(next) => setSetting('notifyLowBalance', next)}
          disabled={off}
        />
        {settings.notifyLowBalance && (
          <div className="set-row">
            <span className="set-row__main">
              <span className="set-row__title">Schwelle</span>
            </span>
            <Segmented
              label="Schwelle der Kontostand-Warnung"
              value={String(settings.lowBalanceChf)}
              options={[
                { value: '100', label: '100' },
                { value: '200', label: '200' },
                { value: '500', label: '500' },
              ]}
              onChange={(next) => setSetting('lowBalanceChf', Number(next))}
            />
          </div>
        )}
        <SwitchRow
          title="Angebote und Tipps"
          checked={settings.notifyOffers}
          onChange={(next) => setSetting('notifyOffers', next)}
          disabled={off}
        />
      </section>
      <p className="empty" style={{ fontSize: 12 }}>Im Prototyp wird nichts versendet.</p>
    </div>
  )
}

/** «Privatkonto · Valiant» oder «Sparkonto · …4419» — beides kommt doppelt vor. */
function accountLabel(account: Account): string {
  const tail =
    account.source.type === 'external'
      ? account.source.bank
      : `…${account.iban.replace(/\s/g, '').slice(-4)}`
  return `${account.name} · ${tail}`
}

function KontenUndBankpakete() {
  const { persona, settings, setSetting } = useSession()

  const rename = (account: Account, label: string) =>
    setSetting('accountLabels', { ...settings.accountLabels, [account.id]: label })

  return (
    <div className="screen__inner">
      <div className="section-head"><span className="section-head__title">Lieferart der Dokumente</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Segmented
            label="Lieferart der Dokumente"
            value={settings.documentDelivery}
            options={[
              { value: 'electronic', label: 'Elektronisch' },
              { value: 'paper', label: 'Papier' },
            ]}
            onChange={(next) => setSetting('documentDelivery', next)}
          />
          <p className="set-note">
            {settings.documentDelivery === 'electronic'
              ? 'Kontoauszüge und Belege liegen nur in der App — ohne Gebühr.'
              : 'Kontoauszüge kommen zusätzlich per Post. In der echten App kostenpflichtig.'}
          </p>
        </div>
      </section>

      <div className="section-head">
        <span className="section-head__title">Kontobezeichnung</span>
        <span className="section-head__value">{persona.accounts.length}</span>
      </div>
      <section className="card">
        <div className="card__body" style={{ display: 'grid', gap: 18, paddingTop: 'var(--s-6)' }}>
          {persona.accounts.map((account) => (
            <Field
              key={account.id}
              label={accountLabel(account)}
              value={settings.accountLabels[account.id] ?? ''}
              placeholder={account.name}
              onChange={(next) => rename(account, next)}
            />
          ))}
        </div>
        <p className="set-note" style={{ padding: '0 var(--s-6) var(--s-6)', margin: 0 }}>
          Eine eigene Bezeichnung ersetzt den Namen der Bank in allen Listen.
        </p>
      </section>
    </div>
  )
}

function Zahlungen() {
  const { settings, setSetting } = useSession()

  return (
    <div className="screen__inner">
      <section className="card">
        <SwitchRow
          title="eBill"
          sub="Rechnungen kommen direkt in die App statt per Post"
          checked={settings.ebill}
          onChange={(next) => setSetting('ebill', next)}
        />
        <SwitchRow
          title="PostFinance TWINT"
          sub="Zahlen mit dem Handy, Geld an Freunde"
          checked={settings.twint}
          onChange={(next) => setSetting('twint', next)}
        />
        <SwitchRow
          title="PostFinance Pay"
          sub="Bezahlen im Online-Shop ohne Karte"
          checked={settings.postfinancePay}
          onChange={(next) => setSetting('postfinancePay', next)}
        />
        <SwitchRow
          title="EZAG"
          sub="Sammelaufträge aus einer Software einliefern"
          checked={settings.ezag}
          onChange={(next) => setSetting('ezag', next)}
        />
      </section>

      <div className="section-head"><span className="section-head__title">Zahlungslimiten</span></div>
      <section className="card">
        <ValueRow title="Zahlungen pro Tag" value="CHF 10’000" />
        <ValueRow title="Zahlungen ins Ausland" value="CHF 5’000" />
      </section>
      <p className="empty" style={{ fontSize: 12 }}>Im Prototyp wird keine Zahlung ausgelöst.</p>
    </div>
  )
}

const PROFILE_LABEL = {
  income: 'Ertrag',
  balanced: 'Ausgewogen',
  growth: 'Wachstum',
} as const

const PROFILE_NOTE = {
  income: 'Wenig Schwankung, wenig Aussicht. Vor allem Obligationen.',
  balanced: 'Aktien und Obligationen gemischt — der übliche Mittelweg.',
  growth: 'Hoher Aktienanteil. Über Jahre mehr Aussicht, dazwischen mehr Ausschläge.',
} as const

function Anlegen() {
  const { persona, settings, setSetting } = useSession()
  const custody = persona.accounts.find((account) => account.kind === 'custody')

  return (
    <div className="screen__inner">
      <div className="section-head"><span className="section-head__title">Anlegerprofil</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Segmented
            label="Anlegerprofil"
            value={settings.investorProfile}
            options={[
              { value: 'income', label: PROFILE_LABEL.income },
              { value: 'balanced', label: PROFILE_LABEL.balanced },
              { value: 'growth', label: PROFILE_LABEL.growth },
            ]}
            onChange={(next) => setSetting('investorProfile', next)}
          />
          <p className="set-note">{PROFILE_NOTE[settings.investorProfile]}</p>
        </div>
      </section>

      <div className="section-head"><span className="section-head__title">E-Trading Funktionen</span></div>
      <section className="card">
        <SwitchRow
          title="E-Trading"
          sub={custody ? `Depot ${custody.name}` : 'Kein Depot eröffnet'}
          checked={settings.etradingEnabled}
          onChange={(next) => setSetting('etradingEnabled', next)}
        />
        <SwitchRow
          title="Kursmeldungen"
          sub="Meldung, wenn ein Titel eine Schwelle erreicht"
          checked={settings.priceAlerts}
          onChange={(next) => setSetting('priceAlerts', next)}
          disabled={!settings.etradingEnabled}
        />
      </section>
      {custody && (
        <>
          <div className="section-head"><span className="section-head__title">Depot</span></div>
          <section className="card">
            <ValueRow
              title={custody.name}
              sub={custody.iban}
              value={formatMoney(custody.balance, custody.currency, { sign: false })}
            />
          </section>
        </>
      )}
    </div>
  )
}

/**
 * Serviceaufträge — Bestellübersicht, Status, Details. Drei erfundene Aufträge,
 * damit die Seite den Aufbau der echten zeigt: was bestellt, wann, wie weit.
 */
const ORDERS: { title: string; date: string; state: string; done?: boolean; detail: string }[] = [
  { title: 'Neue Debitkarte', date: '2026-08-14', state: 'in Bearbeitung', detail: 'Ersatz für abgelaufene Karte · Zustellung in 5 Arbeitstagen' },
  { title: 'Kontoauszug 2025 als PDF', date: '2026-07-02', state: 'erledigt', done: true, detail: 'Liegt unter Dokumente' },
  { title: 'Adressänderung', date: '2026-03-19', state: 'erledigt', done: true, detail: 'Übernommen auf allen Konten' },
]

function Serviceauftraege() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="screen__inner">
      <div className="section-head">
        <span className="section-head__title">Bestellübersicht</span>
        <span className="section-head__value">{ORDERS.length}</span>
      </div>
      <section className="card">
        {ORDERS.map((order) => (
          <button
            key={order.title}
            className="set-row"
            onClick={() => setOpen((current) => (current === order.title ? null : order.title))}
          >
            <span className="set-row__main">
              <span className="set-row__title">{order.title}</span>
              <span className="set-row__sub">
                Bestellt am {formatDate(order.date)}
                {open === order.title ? ` · ${order.detail}` : ''}
              </span>
            </span>
            <State on={!order.done}>{order.state}</State>
          </button>
        ))}
      </section>
      <p className="empty" style={{ fontSize: 12 }}>
        Erfundene Aufträge — im Prototyp wird nichts bestellt.
      </p>
    </div>
  )
}

function AppEinstellungen() {
  const { settings, setSetting, theme, setTheme } = useSession()

  return (
    <div className="screen__inner">
      <div className="section-head"><span className="section-head__title">Design</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Segmented
            label="Design"
            value={theme}
            options={[
              { value: 'light', label: 'Hell' },
              { value: 'dark', label: 'Dunkel' },
            ]}
            onChange={setTheme}
          />
          <p className="set-note">Gilt sofort für die ganze App.</p>
        </div>
      </section>

      <div className="section-head"><span className="section-head__title">Mobiltelefonnummer</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Field
            label="Nummer für Bestätigungen"
            value={settings.phone}
            onChange={(next) => setSetting('phone', next)}
            inputMode="tel"
          />
        </div>
      </section>

      <div className="section-head"><span className="section-head__title">Sprache</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Segmented
            label="Sprache"
            value={settings.language}
            options={[
              { value: 'de', label: 'DE' },
              { value: 'fr', label: 'FR' },
              { value: 'it', label: 'IT' },
              { value: 'en', label: 'EN' },
            ]}
            onChange={(next) => setSetting('language', next)}
          />
          <p className="set-note">
            Der Prototyp ist auf Deutsch aufgebaut; die Wahl wird gespeichert, aber noch
            nicht angewendet.
          </p>
        </div>
      </section>

      <section className="card">
        <ValueRow title="Version" value="0.1.0 · BärnHäckt 2026" />
      </section>
    </div>
  )
}

const TWINT_LIMITS = [1000, 3000, 5000]

/**
 * Was in der Zeile steht. Der Buchungstext kennt zwei Formen:
 * «TWINT GELD GESENDET VOM 03.08.2026 AN RUTH AEBISCHER» und
 * «TWINT KAUF/DIENSTLEISTUNG VOM 22.08.2026 BURGER LAB BERN (CH)».
 */
function twintTitle(text: string): string {
  const person = text.match(/\b(?:AN|VON)\s+([A-ZÄÖÜ][A-ZÄÖÜ'\- ]+)$/)
  if (person) {
    const direction = /EMPFANGEN/.test(text) ? 'Empfangen von' : 'Gesendet an'
    return `${direction} ${pretty(person[1])}`
  }
  const shop = text.replace(/^TWINT.*?vom \d{2}\.\d{2}\.\d{4}\s*/i, '')
  return pretty(shop.replace(/\s*\(CH\)$/, '')) || 'TWINT'
}

function Twint() {
  const { persona, settings, setSetting, push } = useSession()

  /* Bewegungen sind keine erfundene Liste, sondern die echten TWINT-Buchungen
     der Persona — so stimmt die Seite mit der Kontoansicht zusammen. */
  const movements = persona.transactions
    .filter((tx) => /TWINT/i.test(tx.text))
    .slice(-6)
    .reverse()

  return (
    <div className="screen__inner">
      <section className="card">
        <SwitchRow
          title="PostFinance TWINT"
          sub={settings.twint ? 'Aktiviert für dieses Gerät' : 'Nicht aktiviert'}
          checked={settings.twint}
          onChange={(next) => setSetting('twint', next)}
        />
      </section>

      <div className="section-head"><span className="section-head__title">Limite pro Monat</span></div>
      <section className="card">
        <div className="card__body" style={{ paddingTop: 'var(--s-6)' }}>
          <Segmented
            label="Limite pro Monat"
            value={String(settings.twintLimitChf)}
            options={TWINT_LIMITS.map((limit) => ({
              value: String(limit),
              label: `CHF ${limit.toLocaleString('de-CH')}`,
            }))}
            onChange={(next) => setSetting('twintLimitChf', Number(next))}
          />
          <p className="set-note">
            Gilt für Zahlungen im Laden und für Geld an Freunde zusammen.
          </p>
        </div>
      </section>

      <div className="section-head">
        <span className="section-head__title">Bewegungen</span>
        <span className="section-head__value">{movements.length}</span>
      </div>
      <section className="card">
        {movements.length > 0 ? (
          movements.map((tx) => (
            <button
              key={tx.id}
              className="set-row"
              onClick={() => push({ name: 'transaction', transactionId: tx.id })}
            >
              <span className="set-row__main">
                <span className="set-row__title">{twintTitle(tx.text)}</span>
                <span className="set-row__sub">{formatDate(tx.date)}</span>
              </span>
              <span className="set-row__value num">{formatMoney(tx.amount, tx.currency)}</span>
              <span className="set-row__chevron">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          ))
        ) : (
          <p className="empty">Keine TWINT-Bewegungen in den letzten Monaten.</p>
        )}
      </section>
    </div>
  )
}

/** Verteiler auf die neun Unterseiten. */
export function SettingsSectionScreen({ section }: { section: SettingsSection }) {
  const { pop } = useSession()

  const body =
    section === 'profile' ? <Profil />
    : section === 'login' ? <LoginSicherheit />
    : section === 'notifications' ? <Benachrichtigungen />
    : section === 'accounts' ? <KontenUndBankpakete />
    : section === 'payments' ? <Zahlungen />
    : section === 'invest' ? <Anlegen />
    : section === 'orders' ? <Serviceauftraege />
    : section === 'app' ? <AppEinstellungen />
    : <Twint />

  return (
    <Sheet title={TITLES[section]} onBack={pop}>
      {body}
    </Sheet>
  )
}
