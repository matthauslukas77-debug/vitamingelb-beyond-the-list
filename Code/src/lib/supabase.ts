import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../data/database.types'

/**
 * Supabase — optionale Datenschicht.
 *
 * Der Prototyp läuft vollständig ohne Backend: Alle Personas und Buchungen
 * entstehen lokal aus einem festen Startwert (`src/data/`). Supabase kommt erst
 * dazu, wenn wir etwas speichern müssen, das einen Neustart überdauert.
 *
 * Wichtig für die Tech-Jury: `npm install && npm run dev` funktioniert ohne
 * jeden Schlüssel. Fehlt die Konfiguration, ist `isConfigured` einfach false —
 * es gibt keinen Absturz und keine leere Seite.
 *
 * Verwendung:
 *   import { getSupabase, isSupabaseConfigured } from './lib/supabase'
 *   if (isSupabaseConfigured()) {
 *     const db = await getSupabase()
 *     const { data } = await db.from('feedback').select()
 *   }
 */

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** True, sobald beide Variablen gesetzt sind (siehe .env.example). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** Typisiert gegen das echte Schema — erzeugt mit `npm run db:types`. */
export type Db = SupabaseClient<Database>

let client: Promise<Db> | null = null

/**
 * Liefert den Client und lädt die Bibliothek erst beim ersten Aufruf nach.
 * Dadurch bleibt sie aus dem Haupt-Bundle, solange niemand sie braucht.
 */
export function getSupabase(): Promise<Db> {
  if (!isSupabaseConfigured()) {
    return Promise.reject(
      new Error(
        'Supabase ist nicht konfiguriert. .env.example nach .env.local kopieren ' +
          'und VITE_SUPABASE_URL sowie VITE_SUPABASE_ANON_KEY setzen.',
      ),
    )
  }
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url!, anonKey!, { auth: { persistSession: false } }),
  )
  return client
}
