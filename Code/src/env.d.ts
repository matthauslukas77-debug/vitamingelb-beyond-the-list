/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase-Projekt-URL, z. B. https://xxxx.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/publishable key — öffentlich, durch RLS geschützt. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
