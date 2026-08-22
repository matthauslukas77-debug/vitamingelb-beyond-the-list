/**
 * ── Der Werkzeugkatalog, wie ihn das Modell sieht ──────────────────────────
 * **Erzeugt aus `src/insights/assistant/tools.ts` — nicht von Hand ändern.**
 *
 * Warum eine Kopie: Die Edge Function läuft in Deno und kann `tools.ts` nicht
 * laden — das Modul hängt am halben Motor. Warum ein TypeScript-Modul und
 * keine JSON-Datei: `supabase functions deploy` lädt nur `.ts` hoch. Der erste
 * Versuch las `./catalog.json` zur Laufzeit und starb beim ersten Aufruf mit
 * `WORKER_ERROR` — die Datei war nie mit deployt worden.
 *
 * Ein Test in `src/insights/assistant/__tests__/router.test.ts` vergleicht
 * diese Datei Zeichen für Zeichen mit `routerSchema()`. Weicht sie ab, fällt
 * er.
 */

export interface CatalogEntry {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: { type: string; properties: Record<string, unknown>; required: string[] }
  }
}

export const CATALOG: CatalogEntry[] = [
  {
    "type": "function",
    "function": {
      "name": "subscriptions",
      "description": "Alle wiederkehrenden Belastungen — Abos, Daueraufträge, regelmässige Rechnungen — mit Monats- und Jahressumme. Für «Welche Abos habe ich?», «Was zahle ich jeden Monat?», «Was läuft automatisch ab?».",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "budgetStatus",
      "description": "Stand des laufenden Monats gegen das gesetzte Budget, je Kategorie. Für «Wie steht mein Budget?», «Bin ich im Plan?», «Halte ich mein Budget ein?», «Wie viel habe ich noch?».",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "whatsUnusual",
      "description": "Was sich verändert hat oder aus der Reihe fällt: neue Abos, Preiserhöhungen, ungewöhnlich grosse Buchungen, ausgebliebene Zahlungen. Für «Was ist ungewöhnlich?», «War dieser Monat normal?», «Ist mir etwas entgangen?», «Hat sich etwas verändert?».",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "extraordinary",
      "description": "Die grössten EINZELNEN Buchungen der letzten zwölf Monate, nach Betrag. Für «Was war meine grösste Ausgabe?», «Was war das Teuerste, das ich gekauft habe?», «Welche einmaligen Ausgaben hatte ich?». NICHT für Kategorien — dafür gibt es topSpending.",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "topSpending",
      "description": "Rangliste der Ausgaben-KATEGORIEN: wofür im Schnitt am meisten Geld pro Monat draufgeht. Für «Wofür gebe ich am meisten aus?», «Wo geht mein Geld hin?», «Was kostet mich am meisten?». NICHT für eine einzelne Buchung — dafür gibt es extraordinary.",
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "merchantLookup",
      "description": "Erklärt EINEN bestimmten Händler oder Buchungstext: wer das ist, wie oft und wie viel dorthin ging. Für «Wer ist X?», «Was ist diese Buchung von X?», «Wie viel habe ich bei X ausgegeben?». Nur wählen, wenn in der Frage ein konkreter Name vorkommt.",
      "parameters": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Der gesuchte Händler oder Buchungstext."
          }
        },
        "required": [
          "name"
        ]
      }
    }
  }
]
