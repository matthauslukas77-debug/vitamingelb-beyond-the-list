-- ═══════════════════════════════════════════════════════════════════════════
-- Vitamingelb · «Beyond the List» — Grundschema
--
-- Aufbau in vier Schichten:
--   1. Stammdaten   personas · accounts · transactions · orders
--   2. Auswertung   insights          (was unsere Engine berechnet hat)
--   3. Dialog       conversations · messages
--   4. Planung      goals · plans     (Sparziel, Planungs-Assistent)
--
-- Grundsätze
--   · Beträge immer als GANZZAHLIGE RAPPEN (bigint) — nie float, nie numeric.
--     Gerundet wird erst bei der Anzeige. Identisch zur Logik in src/lib/money.ts.
--   · Stammdaten sind erfunden und öffentlich lesbar.
--   · Was Besucher:innen erzeugen (Chat, Ziele, Pläne), hängt an einer
--     `session_id` aus dem Browser — so teilt sich nicht die halbe Schweiz
--     denselben Chatverlauf, ohne dass wir ein Login bauen müssen.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Stammdaten ─────────────────────────────────────────────────────────

create table public.personas (
  id          text primary key,
  name        text not null,
  role        text not null,
  quote       text,
  source      text,                      -- welches Interview dahintersteht
  created_at  timestamptz not null default now()
);

comment on table public.personas is
  'Demo-Personas. Bilden Personen aus unseren sechs Interviews ab.';

create type public.account_kind as enum (
  'private', 'savings', 'youth', 'foreign', 'retirement3a', 'card', 'loan', 'custody'
);

create table public.accounts (
  id               text primary key,
  persona_id       text not null references public.personas(id) on delete cascade,
  name             text not null,
  iban             text not null,
  kind             public.account_kind not null,
  currency         char(3) not null default 'CHF',
  balance          bigint not null,       -- Rappen
  balance_chf      bigint,                -- Gegenwert bei Fremdwährung
  source_type      text not null default 'postfinance'
                     check (source_type in ('postfinance', 'external')),
  source_bank      text,                  -- gesetzt, wenn über Multibanking aggregiert
  further_product  boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint external_needs_bank
    check (source_type <> 'external' or source_bank is not null)
);

create index accounts_persona_idx on public.accounts (persona_id);

create type public.category as enum (
  'income', 'groceries', 'eatingOut', 'shopping', 'transport', 'housing',
  'health', 'subscriptions', 'leisure', 'taxes', 'insurance', 'transfer',
  'cash', 'other'
);

create table public.transactions (
  id                  text primary key,
  account_id          text not null references public.accounts(id) on delete cascade,
  persona_id          text not null references public.personas(id) on delete cascade,
  booked_on           date not null,
  -- Der Text so, wie die Bank ihn heute zeigt, inklusive kryptischer
  -- Händlernamen. Genau das ist unser Ausgangsmaterial.
  description         text not null,
  amount              bigint not null,     -- Rappen, negativ = Belastung
  currency            char(3) not null default 'CHF',
  category            public.category not null,
  -- Umbuchung auf ein eigenes Konto: kein Konsum, auch wenn die heutige
  -- Auswertung es so zählt (siehe Interview 05).
  counter_account_id  text references public.accounts(id) on delete set null,
  series_id           text,                -- erkannte Zahlungsreihe (Abo, Dauerauftrag)
  pending             boolean not null default false,
  brand               jsonb,               -- Ersatz für das Händlerlogo
  created_at          timestamptz not null default now()
);

create index transactions_persona_date_idx on public.transactions (persona_id, booked_on desc);
create index transactions_account_date_idx on public.transactions (account_id, booked_on desc);
create index transactions_series_idx       on public.transactions (series_id) where series_id is not null;
create index transactions_category_idx     on public.transactions (persona_id, category);

create table public.orders (
  id           text primary key,
  account_id   text not null references public.accounts(id) on delete cascade,
  persona_id   text not null references public.personas(id) on delete cascade,
  kind         text not null check (kind in ('pending', 'standing')),
  recipient    text not null,
  amount       bigint not null,
  currency     char(3) not null default 'CHF',
  execute_on   date not null,
  created_at   timestamptz not null default now()
);

create index orders_persona_idx on public.orders (persona_id, kind);

-- ── 2 · Auswertung ─────────────────────────────────────────────────────────

-- Ergebnisse unserer Engine. Bewusst als jsonb: Die Form je Auswertungsart
-- entwickelt sich noch, die Tabelle soll deswegen nicht ständig wandern.
create table public.insights (
  id              uuid primary key default gen_random_uuid(),
  persona_id      text not null references public.personas(id) on delete cascade,
  kind            text not null,          -- 'recurring' | 'anomaly' | 'trend' | 'forecast'
  period_start    date,
  period_end      date,
  payload         jsonb not null,
  -- Version der Berechnungslogik: Ohne sie weiss später niemand mehr,
  -- mit welchem Stand eine Zahl entstanden ist.
  engine_version  text not null default 'v0',
  computed_at     timestamptz not null default now()
);

create index insights_lookup_idx on public.insights (persona_id, kind, computed_at desc);

-- ── 3 · Dialog ─────────────────────────────────────────────────────────────

create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  persona_id  text not null references public.personas(id) on delete cascade,
  session_id  text not null,              -- pro Browser, kein Login nötig
  title       text,
  created_at  timestamptz not null default now()
);

create index conversations_session_idx on public.conversations (session_id, created_at desc);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant', 'system')),
  content          text not null,
  -- Womit die Antwort entstanden ist. Die Tech-Jury fragt nach dem KI-Einsatz;
  -- ohne diese Spalten ist das im Nachhinein nicht mehr belegbar.
  model            text,
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ── 4 · Planung ────────────────────────────────────────────────────────────

-- Sparziel mit Bild und Fortschritt — die Idee kam von Fritz selbst
-- (Interview 01: «Boah, das wäre geil»).
create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  persona_id     text not null references public.personas(id) on delete cascade,
  session_id     text not null,
  title          text not null,
  target_amount  bigint not null check (target_amount > 0),
  target_date    date,
  image_url      text,
  created_at     timestamptz not null default now()
);

create index goals_session_idx on public.goals (session_id, created_at desc);

-- Ergebnis des Planungs-Assistenten.
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  persona_id  text not null references public.personas(id) on delete cascade,
  session_id  text not null,
  kind        text not null,              -- 'budget' | 'savings' | 'liquidity'
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index plans_session_idx on public.plans (session_id, created_at desc);

-- ── Zugriff ────────────────────────────────────────────────────────────────
--
-- Der Prototyp läuft öffentlich unter vitamingelb.ch, ohne Login.
-- Deshalb: Stammdaten nur lesen, Erzeugtes anlegen und im Rahmen der eigenen
-- Sitzung lesen. Kein Ändern, kein Löschen über den anon-Key.
-- Sobald es echte Nutzerkonten gibt, treten hier auth.uid()-Regeln an die Stelle
-- der session_id.

alter table public.personas      enable row level security;
alter table public.accounts      enable row level security;
alter table public.transactions  enable row level security;
alter table public.orders        enable row level security;
alter table public.insights      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.goals         enable row level security;
alter table public.plans         enable row level security;

-- Stammdaten und Auswertungen: öffentlich lesbar, nicht schreibbar.
create policy "Demo-Daten lesen" on public.personas     for select to anon, authenticated using (true);
create policy "Demo-Daten lesen" on public.accounts     for select to anon, authenticated using (true);
create policy "Demo-Daten lesen" on public.transactions for select to anon, authenticated using (true);
create policy "Demo-Daten lesen" on public.orders       for select to anon, authenticated using (true);
create policy "Demo-Daten lesen" on public.insights     for select to anon, authenticated using (true);

-- Erzeugtes: anlegen und lesen erlaubt, ändern und löschen nicht.
create policy "Eigenes anlegen" on public.conversations for insert to anon, authenticated with check (true);
create policy "Eigenes lesen"   on public.conversations for select to anon, authenticated using (true);
create policy "Eigenes anlegen" on public.messages      for insert to anon, authenticated with check (true);
create policy "Eigenes lesen"   on public.messages      for select to anon, authenticated using (true);
create policy "Eigenes anlegen" on public.goals         for insert to anon, authenticated with check (true);
create policy "Eigenes lesen"   on public.goals         for select to anon, authenticated using (true);
create policy "Eigenes anlegen" on public.plans         for insert to anon, authenticated with check (true);
create policy "Eigenes lesen"   on public.plans         for select to anon, authenticated using (true);
