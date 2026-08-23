import type { Persona, Transaction } from '../../data/types'
import type { Screen } from '../../app/session'
import { detectRecurring, type RecurringSeries } from '../../domain/recurring'
import { resolveBrand } from '../../data/brands'
import { formatAmount } from '../../lib/money'
import { formatDate } from '../../lib/date'
import { categoryDef, CATEGORY_KEYS, slotKey, type CategoryKey } from '../budget/slots'
import { deriveForPersona, fullMonthWindow, monthStart, spendByCategory } from '../budget/derive'
import { merchantName } from '../budget/merchant'
import { moneyFlow } from '../budget/flow'
import { markingOf, type Markings } from '../budget/markings'
import type { Assignments } from '../budget/assign'
import { categorize } from '../budget/mapping'
import { amountOf, type SavedBudget } from '../budget/storage'
import { budgetPerCategory, signalsForPersona } from '../signals/engine'
import { loadDismissed, openSignals } from '../signals/storage'

/**
 * ── Unsere Schicht ─────────────────────────────────────────────────────────
 * Der Werkzeugkatalog des Assistenten.
 *
 * Die Regel, aus der alles andere folgt: **Der Assistent sieht nie eine
 * Buchung.** Er wählt ein Werkzeug, das Werkzeug rechnet, und über das
 * Ergebnis wird geredet. Nichts hier fragt ein Modell, und nichts hier
 * rechnet selbst — jede Zahl kommt aus dem Motor, der auch die Blasen und
 * den Wizard speist.
 *
 * Das ist keine Vorsicht, sondern das Ergebnis unserer eigenen Messung
 * (`WORKSPACE/03_research/16_Tooling_und_Zugaenge/APERTUS_CAPABILITY_TEST.md`):
 * Auf 90 Rohtransaktionen hielten **beide** Apertus-Grössen die monatliche
 * Lohnzahlung für das Ungewöhnlichste am Konto — das Regelmässigste, was es
 * auf einem Konto gibt. Und beide addieren vierzehn Beträge falsch, jedes Mal.
 *
 * ── Warum jedes Werkzeug zwei Eingänge hat ────────────────────────────────
 *
 * `match()` erkennt die Absicht im Code, über Muster. Das ist Stufe 1: Sie
 * läuft ohne Netz, ohne Schlüssel und ohne Modell — wenn am Sonntag der
 * Endpunkt klemmt, funktioniert der Assistent trotzdem.
 *
 * `parameters` ist dasselbe Werkzeug als JSON-Schema, wie es der Apertus 8B
 * für einen Tool-Call braucht. Der 8B ist der Einzige der beiden, der saubere
 * `tool_calls` liefert (5/5 im Test, der 70B antwortet nur Prosa). Stufe 2
 * setzt ihn vor dieselbe Liste; ausgeführt wird weiterhin hier, im Browser,
 * mit demselben Motor. So gibt es keine zweite Implementierung derselben Zahl.
 *
 * ── Was ein Werkzeug zurückgibt ───────────────────────────────────────────
 *
 * Einen fertigen Satz, die Zahlen dahinter und **die Buchungen als Beleg**.
 * Dieselbe Doktrin wie auf jeder Signalkarte: kein Satz ohne die Buchungen,
 * aus denen er stammt.
 */

export interface AskContext {
  persona: Persona
  today: string
  markings: Markings
  assignments: Assignments
  /** Das gespeicherte Budget, wenn es eines gibt. */
  budget: SavedBudget | null
}

/** Eine Zeile unter der Antwort — die Aufschlüsselung. */
export interface AnswerRow {
  label: string
  /** Rappen. Positiv. */
  amount: number
  sub?: string
}

export interface ToolResult {
  /** Der gerechnete Satz. Ohne Modell ist das bereits die Antwort. */
  text: string
  rows?: AnswerRow[]
  /** Die Buchungen dahinter. Ohne sie ist die Antwort eine Behauptung. */
  transactionIds: string[]
  /** Wohin die Antwort weiterführt. */
  link?: { label: string; screen: Screen }
  /** Welcher Zeitraum gemeint war — steht klein unter der Antwort. */
  period?: string
}

export interface Tool {
  name: string
  /** Was das Werkzeug beantwortet. In Stufe 2 die Beschreibung fürs Modell. */
  purpose: string
  /** JSON-Schema der Argumente — für den Tool-Call des 8B. */
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string }>
    required: string[]
  }
  /** Beispielfragen. Dienen zugleich als Vorschläge im Suchfeld. */
  examples: string[]
  /** Absichtserkennung im Code. `null` heisst: nicht gemeint. */
  match: (question: string) => Record<string, string> | null
  run: (args: Record<string, string>, context: AskContext) => ToolResult | null
}

// ───────────────────────────────────────────────────────────────────────────
// Hilfen
// ───────────────────────────────────────────────────────────────────────────

/**
 * Kleinschreibung ohne Umlaute und Satzzeichen — die Vergleichsform.
 *
 * `normalize('NFKD')` und das Löschen der Kombinationszeichen davor: Sonst
 * kommt ein «e» mit angehängtem Akzent durch, wo ein «é» geprüft wurde, und
 * ein Zaun, der «investier» sucht, sieht «ínvestier» nicht.
 */
export function plain(text: unknown): string {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    /* Erst nach der Umschrift zerlegen: NFKD spaltet «ä» in a + Trema, und
       das Trema fällt zwei Zeilen später weg — die Umschrift käme dann nie
       zum Zug und «Wofür» hiesse «wofur». Gemessen, nicht vermutet. */
    .normalize('NFKD')
    .replace(/[\u0300-\u036F\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}


/**
 * Wörter, die als Händlername gemeint sein könnten, aber nie einer sind.
 * «Wer ist das?» darf nicht die halbe Kontobewegung als Händler ausgeben.
 */
const STOPWORDS = new Set([
  'das', 'die', 'der', 'den', 'dem', 'ein', 'eine', 'einen', 'und', 'oder',
  'vom', 'von', 'bei', 'fuer', 'mit', 'auf', 'aus', 'ich', 'mir', 'mich',
  'mein', 'meine', 'meinem', 'meiner', 'diese', 'dieser', 'dieses', 'dass',
  'was', 'wer', 'wie', 'wo', 'geld', 'buchung', 'zahlung', 'konto', 'firma',
])

const chf = (rappen: number) => formatAmount(Math.round(rappen), { sign: false })

/** Das Fenster, über das gerechnet wird: zwölf volle Monate. */
function window12(today: string) {
  return fullMonthWindow(today, 12)
}

/** Nur Ausgaben — eine Umbuchung aufs eigene Sparkonto ist keine. */
function expensesOf(context: AskContext, from: string, to: string): Transaction[] {
  const { persona } = context
  return persona.transactions.filter(
    (tx) =>
      tx.date >= from &&
      tx.date <= to &&
      moneyFlow(tx, { accounts: persona.accounts, ownName: persona.name }).flow === 'out',
  )
}

// ───────────────────────────────────────────────────────────────────────────
// 1 · Wofür geht das meiste Geld?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Frage, die vier von acht Gesprächspartnern als erste stellen — wörtlich
 * und unabhängig voneinander. Fritz, Lukas, Janic und Katja.
 */
const topSpending: Tool = {
  name: 'topSpending',
  purpose:
    'Rangliste der Ausgaben-KATEGORIEN: wofür im Schnitt am meisten Geld pro Monat draufgeht. ' +
    'Für «Wofür gebe ich am meisten aus?», «Wo geht mein Geld hin?», «Was kostet mich am meisten?». ' +
    'NICHT für eine einzelne Buchung — dafür gibt es extraordinary.',
  /* Kein `months`: Das Werkzeug rechnet fest über zwölf volle Monate. Ein
     Argument anzubieten, das niemand liest, lädt das Modell ein, es zu
     setzen — und der Nutzer bekäme einen Zeitraum, den er nicht bekommt. */
  parameters: { type: 'object', properties: {}, required: [] },
  examples: ['Wofür gebe ich am meisten aus?', 'Wo geht mein Geld hin?'],
  match(question) {
    const q = plain(question)
    if (/\b(abo|abos|abonnement)\b/.test(q)) return null
    const asksWhere = /(wofuer|wo fuer|wohin|wo geht|worin|welche kategorie)/.test(q)
    const asksMost = /(am meisten|das meiste|meiste geld|groesste ausgabe|groessten ausgaben)/.test(q)
    return asksWhere || asksMost ? {} : null
  },
  run(_args, context) {
    /*
     * `deriveForPersona` und nicht `spendByCategory` — obwohl das eine Zeile
     * kürzer wäre und dieselbe Frage zu beantworten scheint.
     *
     * Der Unterschied sind die Steuern. Brunos Schlussrechnung und eine
     * Akontorate fallen zufällig beide in dasselbe Zwölfmonatsfenster; roh
     * gerechnet ergibt das CHF 1'883 im Monat und macht die Steuern zu seinem
     * grössten Posten. Die Ableitung glättet sie über die volle Historie auf
     * CHF 1'154 — dann führt Konsum, und das stimmt.
     *
     * Beide Zahlen sind für ihr Fenster richtig. Aber das Cockpit zeigt die
     * geglättete, und zwei Antworten auf dieselbe Frage sind schlimmer als
     * eine ungenaue. Es gilt die Zahl, die auch auf dem Bildschirm steht.
     */
    const derived = deriveForPersona(context.persona, {
      today: context.today,
      months: 12,
      markings: context.markings,
      assignments: context.assignments,
    })

    const ranked = CATEGORY_KEYS.map((key) => ({ key, month: derived.categoryTotals[key] }))
      .filter((entry) => entry.month > 0)
      .sort((a, b) => b.month - a.month)

    if (ranked.length === 0) return null

    const rows: AnswerRow[] = ranked.map((entry) => ({
      label: categoryDef(entry.key).title,
      amount: entry.month,
    }))

    const first = ranked[0]
    const second = ranked[1]
    const lead = `Am meisten geht in ${categoryDef(first.key).title}: ${chf(first.month)} im Monat.`
    const follow = second ? ` Danach ${categoryDef(second.key).title} mit ${chf(second.month)}.` : ''

    return {
      text: lead + follow,
      rows,
      transactionIds: expensesOf(context, derived.from, derived.to).map((tx) => tx.id),
      period: '12 Monate',
      link: { label: 'Im Cockpit ansehen', screen: { name: 'cockpit', view: 'budget' } },
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 2 · Welche Abos habe ich?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der härteste Befund der Interviews: Lukas ist PostFinance-Kunde, die
 * Abo-Übersicht **existiert**, und er kennt sie nicht — «Es wäre noch geil,
 * wenn ich sehen würde, welche ich genau habe.»
 *
 * Dieses Werkzeug baut deshalb nichts Neues. Es beantwortet die Frage und
 * führt in den Bildschirm, den es längst gibt.
 */
const subscriptions: Tool = {
  name: 'subscriptions',
  purpose:
    'Alle wiederkehrenden Belastungen — Abos, Daueraufträge, regelmässige Rechnungen — mit Monats- ' +
    'und Jahressumme. Für «Welche Abos habe ich?», «Was zahle ich jeden Monat?», «Was läuft automatisch ab?».',
  parameters: { type: 'object', properties: {}, required: [] },
  examples: ['Welche Abos habe ich?', 'Was zahle ich monatlich?'],
  match(question) {
    const q = plain(question)
    /* «Ist eines von meinen Abos teurer geworden?» handelt von einer
       Veränderung und nicht von einer Liste — das ist whatsUnusual. */
    if (/(teurer|gestiegen|erhoeht|erhoehung|aufgeschlagen|veraendert|\bneue?\b)/.test(q)) return null
    /* Wo «Budget» steht, ist der Budgetstand gemeint. */
    if (/budget/.test(q)) return null
    /* Das Abo-Wort entscheidet und steht deshalb **vor** den Ausnahmen unten:
       «Was ist mein teuerstes Abo?» ist eine Abofrage, obwohl sie mit «was
       ist» beginnt. Stämme ohne Schluss-Wortgrenze — «monatlichen» ist
       «monatlich» plus Endung und traf mit `\b` dahinter nicht. */
    if (/(abo|abonnement|wiederkehrend|regelmaessig|dauerauftrag)/.test(q)) return {}
    /* «Wer ist das schon wieder, das kommt jeden Monat.» fragt dagegen nach
       dem Händler, auch wenn ein Rhythmus darin vorkommt. */
    if (/^(wer|was) (ist|war|sind)/.test(q)) return null
    /* «monatlich» allein ist zu schwach — «Was zahle ich monatlich fürs
       Essen?» ist eine Kategoriefrage. Nur, wenn kein Ziel genannt wird. */
    return /(monatlich|jeden monat|fixe|fixen)/.test(q) && !/ fuer | fuers /.test(q)
      ? {}
      : null
  },
  run(_args, context) {
    const series = detectRecurring(context.persona.transactions, { today: context.today })
    const paid = series.filter(
      (entry: RecurringSeries) => entry.amount < 0 && entry.kind !== 'income',
    )
    if (paid.length === 0) return null

    const subs = paid.filter((entry) => entry.kind === 'subscription')
    const shown = (subs.length > 0 ? subs : paid).sort(
      (a, b) => Math.abs(b.monthlyAmount) - Math.abs(a.monthlyAmount),
    )
    const perMonth = shown.reduce((sum, entry) => sum + Math.abs(entry.monthlyAmount), 0)

    const label = subs.length > 0 ? 'Abos' : 'wiederkehrende Belastungen'
    const name = (entry: RecurringSeries) =>
      resolveBrand(entry.label)?.brand.name ?? merchantName({ text: entry.label } as Transaction)

    return {
      text:
        `${shown.length} ${label} für ${chf(perMonth)} im Monat, ` +
        `${chf(perMonth * 12)} im Jahr. Das grösste ist ${name(shown[0])} mit ${chf(Math.abs(shown[0].monthlyAmount))}.`,
      rows: shown.map((entry) => ({
        label: name(entry),
        amount: Math.abs(entry.monthlyAmount),
        sub: `zuletzt ${formatDate(entry.lastSeen)}`,
      })),
      transactionIds: shown.flatMap((entry) => entry.transactionIds),
      period: 'pro Monat',
      link: { label: 'Alle wiederkehrenden ansehen', screen: { name: 'recurring' } },
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 3 · Wer ist das?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der einzige Schmerz, der wirklich täglich auftritt: unverständliche
 * Händlernamen. Lukas und Janic googeln sie, Ayana hat sich damit abgefunden
 * («Ich schaue es nicht genau an»). Alle drei lösen es ausserhalb der App.
 */
const merchantLookup: Tool = {
  name: 'merchantLookup',
  purpose:
    'Erklärt EINEN bestimmten Händler oder Buchungstext: wer das ist, wie oft und wie viel dorthin ging. ' +
    'Für «Wer ist X?», «Was ist diese Buchung von X?», «Wie viel habe ich bei X ausgegeben?». ' +
    'Nur wählen, wenn in der Frage ein konkreter Name vorkommt.',
  parameters: {
    type: 'object',
    properties: { name: { type: 'string', description: 'Der gesuchte Händler oder Buchungstext.' } },
    required: ['name'],
  },
  examples: ['Wer ist Digitec?', 'Was ist SumUp?'],
  match(question) {
    const q = question.trim()
    /*
     * Ein Händlername ist kurz und hat höchstens drei Wörter. Ohne diese
     * Grenze wurde «Was sind meine fixen monatlichen Kosten?» zur Suche nach
     * dem Händler «meine fixen monatlichen Kosten» — der Satz passt formal
     * auf «was sind X».
     */
    const asked =
      /^(?:wer|was)\s+(?:ist|war|sind|waren)\s+(?:das|der|die|denn)?\s*([\wÄÖÜäöü.&'-]+(?:\s+[\wÄÖÜäöü.&'-]+){0,2})\s*\??$/i.exec(q)
    if (asked) return { name: asked[1] }
    const spent = /^(wie ?viel|wieviel)\s+(?:habe ich\s+)?(?:bei|f(ü|u)r|an)\s+(.{2,40}?)\s*(?:ausgegeben|bezahlt|gezahlt)?\s*\??$/i.exec(q)
    return spent ? { name: spent[3] } : null
  },
  run(args, context) {
    const needle = plain(args.name ?? '')
    /*
     * Drei Zeilen gegen einen Streuschuss. Gemessen an Bruno traf «ch» als
     * Teilzeichenkette **289 Buchungen** — die Antwort hätte «CH» zu einem
     * Händler erklärt und eine Jahressumme dazu behauptet.
     *
     *   · unter drei Zeichen ist kein Name,
     *   · gesucht wird an der Wortgrenze statt irgendwo im Text,
     *   · und wer über vierzig Buchungen trifft, hat keinen Händler benannt.
     */
    if (needle.length < 3 || STOPWORDS.has(needle)) return null

    const boundary = new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    const { from } = window12(context.today)
    const hits = expensesOf(context, from, context.today).filter((tx) => {
      const brand = resolveBrand(tx.text)?.brand.name ?? ''
      return boundary.test(plain(`${tx.text} ${brand}`))
    })
    /* Kein Deckel auf der Trefferzahl: Coop hat bei Bruno 63 Buchungen, und
       genau nach solchen Händlern wird gefragt. Die Vagheit wird am Suchwort
       begrenzt, nicht am Ergebnis. */
    if (hits.length === 0) return null

    const total = hits.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
    const latest = hits.reduce((newest, tx) => (tx.date > newest.date ? tx : newest), hits[0])
    const brand = resolveBrand(latest.text)
    const label = brand?.brand.name ?? merchantName(latest)
    const slot = categorize(latest, context.assignments)

    /* Woher der Name kommt, gehört dazu: Der ganze Punkt dieses Werkzeugs ist,
       dass man den Buchungstext nicht mehr googeln muss. */
    const origin = brand
      ? `${label} — erkannt am Buchungstext «${brand.pattern}».`
      : `${label} — so steht es im Buchungstext.`

    return {
      text:
        `${origin} ${hits.length === 1 ? 'Eine Buchung' : `${hits.length} Buchungen`} ` +
        `über ${chf(total)}, zuletzt am ${formatDate(latest.date)}. ` +
        `Zählt bei dir zu ${categoryDef(slot.category).title}.`,
      rows: hits
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 6)
        .map((tx) => ({
          label: formatDate(tx.date),
          amount: Math.abs(tx.amount),
          sub: tx.text.length > 44 ? `${tx.text.slice(0, 44)}…` : tx.text,
        })),
      transactionIds: hits.map((tx) => tx.id),
      period: '12 Monate',
      link: { label: 'Buchung öffnen', screen: { name: 'transaction', transactionId: latest.id } },
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 4 · Wie steht mein Budget?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Katjas Frage, und sie ist im Sample einzigartig: Sie will die Zahlen nicht
 * gegen die Vergangenheit rechnen lassen, sondern **gegen einen Plan** —
 * «vielleicht einfach noch so ein bisschen mit dem Budget abgleichen … wo man
 * Anpassungen vornehmen müsste».
 */
const budgetStatus: Tool = {
  name: 'budgetStatus',
  purpose:
    'Stand des laufenden Monats gegen das gesetzte Budget, je Kategorie. ' +
    'Für «Wie steht mein Budget?», «Bin ich im Plan?», «Halte ich mein Budget ein?», «Wie viel habe ich noch?».',
  parameters: { type: 'object', properties: {}, required: [] },
  examples: ['Wie steht mein Budget?', 'Bin ich im Budget?'],
  match(question) {
    const q = plain(question)
    return /\bbudget\b/.test(q) || /(im plan|halte ich (mich|es))/.test(q) ? {} : null
  },
  run(_args, context) {
    const from = monthStart(context.today)
    const spent = spendByCategory(context.persona.transactions, context.persona.accounts, {
      from,
      to: context.today,
      ownName: context.persona.name,
      markings: context.markings,
      assignments: context.assignments,
    })

    if (!context.budget) {
      const total = CATEGORY_KEYS.reduce((sum, key) => sum + spent[key], 0)
      return {
        text:
          `Du hast noch kein Budget gesetzt. Diesen Monat sind bisher ${chf(total)} ausgegeben. ` +
          `Der Wizard baut dir in drei Schritten eines aus deinen Buchungen.`,
        transactionIds: expensesOf(context, from, context.today).map((tx) => tx.id),
        period: `seit ${formatDate(from)}`,
        link: { label: 'Budget erstellen', screen: { name: 'budgetWizard' } },
      }
    }

    const planned = Object.fromEntries(
      CATEGORY_KEYS.map((key) => [
        key,
        CATEGORY_KEYS.includes(key)
          ? categoryDef(key).fields.reduce(
              (sum, _field, index) => sum + amountOf(context.budget!, slotKey({ category: key, field: index })),
              0,
            )
          : 0,
      ]),
    ) as Record<CategoryKey, number>

    const over = CATEGORY_KEYS.map((key) => ({ key, spent: spent[key], planned: planned[key] }))
      .filter((entry) => entry.planned > 0 && entry.spent > entry.planned)
      .sort((a, b) => b.spent - b.planned - (a.spent - a.planned))

    const totalSpent = CATEGORY_KEYS.reduce((sum, key) => sum + spent[key], 0)
    const totalPlanned = CATEGORY_KEYS.reduce((sum, key) => sum + planned[key], 0)

    const text =
      over.length === 0
        ? `Diesen Monat sind ${chf(totalSpent)} von ${chf(totalPlanned)} verbraucht. Keine Kategorie ist über ihrem Budget.`
        : `${categoryDef(over[0].key).title} liegt ${chf(over[0].spent - over[0].planned)} über dem Budget: ` +
          `${chf(over[0].spent)} statt ${chf(over[0].planned)}. ` +
          `Insgesamt sind ${chf(totalSpent)} von ${chf(totalPlanned)} verbraucht.`

    return {
      text,
      rows: CATEGORY_KEYS.filter((key) => planned[key] > 0 || spent[key] > 0).map((key) => ({
        label: categoryDef(key).title,
        amount: spent[key],
        sub: `von ${chf(planned[key])}`,
      })),
      transactionIds: expensesOf(context, from, context.today).map((tx) => tx.id),
      period: `seit ${formatDate(from)}`,
      link: { label: 'Budget ansehen', screen: { name: 'cockpit', view: 'budget' } },
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 5 · Was ist ungewöhnlich?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die einzige der drei Challenge-Fragen, auf die es heute gar keine Antwort
 * gibt — und die, an der beide Apertus-Grössen im Test gescheitert sind: Sie
 * nannten den Lohn. Hier antwortet der Signalmotor, nicht das Modell.
 */
const whatsUnusual: Tool = {
  name: 'whatsUnusual',
  purpose:
    'Was sich verändert hat oder aus der Reihe fällt: neue Abos, Preiserhöhungen, ungewöhnlich grosse ' +
    'Buchungen, ausgebliebene Zahlungen. Für «Was ist ungewöhnlich?», «War dieser Monat normal?», ' +
    '«Ist mir etwas entgangen?», «Hat sich etwas verändert?».',
  parameters: { type: 'object', properties: {}, required: [] },
  examples: ['Was ist ungewöhnlich?', 'War dieser Monat normal?'],
  match(question) {
    const q = plain(question)
    /* «komisch» steht bewusst nicht in dieser Liste: «Da steht so ein
       komischer Firmenname» meint den Händler, nicht die Veränderung. */
    return /(ungewoehnlich|auffaellig|aufgefallen|normal|veraender|verschoben|anders als sonst|aus der reihe|aus dem rahmen|teurer|gestiegen|erhoeh|eingeschlichen)/.test(q)
      ? {}
      : null
  },
  run(_args, context) {
    const signals = signalsForPersona(context.persona, {
      today: context.today,
      markings: context.markings,
      assignments: context.assignments,
      budget: budgetPerCategory(
        context.persona,
        context.today,
        context.markings,
        context.budget,
        context.assignments,
      ),
    })
    const open = openSignals(signals, loadDismissed(context.persona.id))
    if (open.length === 0) {
      return {
        text: 'Nichts Auffälliges. Keine neue Reihe, keine Preiserhöhung, keine Buchung, die aus dem Rahmen fällt.',
        transactionIds: [],
        link: { label: 'Signale ansehen', screen: { name: 'signals' } },
      }
    }

    const top = open[0]
    return {
      text: `${top.title}. ${top.body}`,
      rows: open.slice(1, 4).map((signal) => ({ label: signal.title, amount: signal.amount })),
      transactionIds: top.transactionIds,
      period: open.length > 1 ? `${open.length} offene Signale` : undefined,
      link: { label: 'Signale ansehen', screen: { name: 'signals' } },
    }
  },
}

// ───────────────────────────────────────────────────────────────────────────
// 6 · Was ist ausserordentlich?
// ───────────────────────────────────────────────────────────────────────────

/**
 * Gabriel und Michael, unabhängig voneinander: Einmaliges verfälscht die
 * Statistik. «Wenn du jetzt irgendetwas Einmaliges hast … 5'000 Franken … das
 * willst du nicht drin haben.» Die Einordnung dafür gibt es schon
 * (`markings.ts`) — dieses Werkzeug zeigt, was darin liegt.
 */
const extraordinary: Tool = {
  name: 'extraordinary',
  purpose:
    'Die grössten EINZELNEN Buchungen der letzten zwölf Monate, nach Betrag. ' +
    'Für «Was war meine grösste Ausgabe?», «Was war das Teuerste, das ich gekauft habe?», ' +
    '«Welche einmaligen Ausgaben hatte ich?». NICHT für Kategorien — dafür gibt es topSpending.',
  parameters: { type: 'object', properties: {}, required: [] },
  examples: ['Was war meine grösste Ausgabe?', 'Welche einmaligen Ausgaben hatte ich?'],
  match(question) {
    const q = plain(question)
    /* «einzeln» trennt diese Frage von der Kategorien-Rangliste: «Welche
       einzelne Zahlung hat mich am meisten gekostet?» meint eine Buchung. */
    return /(einzel|einmalig|ausserordentlich|teuerste|dickste|groesste (buchung|rechnung|belastung|zahlung))/.test(q)
      ? {}
      : null
  },
  run(_args, context) {
    const { from } = window12(context.today)
    const biggest = expensesOf(context, from, context.today)
      .slice()
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5)
    if (biggest.length === 0) return null

    const top = biggest[0]
    const marking = markingOf(context.markings, top.id)
    const note =
      marking.kind === 'extraordinary'
        ? ' Du hast sie als einmalig eingeordnet, sie zählt nicht gegen das Monatsbudget.'
        : marking.kind === 'spread'
          ? ` Du hast sie auf ${marking.months ?? 12} Monate verteilt.`
          : ''

    return {
      text:
        `Die grösste Einzelbuchung war ${merchantName(top)} am ${formatDate(top.date)} ` +
        `über ${chf(Math.abs(top.amount))}.${note}`,
      rows: biggest.map((tx) => ({
        label: merchantName(tx),
        amount: Math.abs(tx.amount),
        sub: formatDate(tx.date),
      })),
      transactionIds: biggest.map((tx) => tx.id),
      period: '12 Monate',
      link: { label: 'Buchung öffnen', screen: { name: 'transaction', transactionId: top.id } },
    }
  },
}

/**
 * Die Reihenfolge entscheidet: Es gewinnt das erste Werkzeug, das zusagt.
 * `merchantLookup` steht deshalb hinter den engeren Mustern — «Was ist mein
 * Budget?» ist eine Budgetfrage und keine Händlersuche.
 */
export const TOOLS: Tool[] = [
  subscriptions,
  budgetStatus,
  whatsUnusual,
  extraordinary,
  topSpending,
  merchantLookup,
]

/**
 * Der Katalog als OpenAI-Werkzeugliste — was der Apertus 8B zu sehen bekommt.
 *
 * Erzeugt aus derselben Liste, die der Browser ausführt. Die Edge Function
 * führt eine Kopie davon (`supabase/functions/ask/catalog.ts`), weil Deno
 * dieses Modul nicht laden kann — es hinge am halben Motor. Ein Test hält die
 * beiden zusammen: Weicht ein Name ab, fällt er.
 */
export function routerSchema() {
  return TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.purpose,
      parameters: tool.parameters,
    },
  }))
}
