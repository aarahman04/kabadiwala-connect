/**
 * Postgres schema — single source of truth, as ordered sections.
 *
 *  - The API server runs every section not marked supabaseOnly on boot
 *    (all idempotent), so a fresh Supabase/Railway database just works.
 *  - `npm run db:sql` writes each section to database/NN_name.sql for pasting
 *    into the Supabase SQL editor in order.
 *
 * Each table keeps the full app record in `data` (jsonb, exactly what the app
 * syncs) plus GENERATED columns extracted from it, so the tables are queryable
 * like normal relational tables without a mapping layer that could drift.
 * Tables are prefixed kc_ to stay clear of anything else in the database.
 */

export interface SchemaSection {
  file: string;
  title: string;
  sql: string;
  /** Needs Supabase's auth schema — not run by the server on plain Postgres. */
  supabaseOnly?: boolean;
}

export const SCHEMA_SECTIONS: SchemaSection[] = [
  {
    file: '01_users.sql',
    title: 'Users / profiles (Supabase Auth)',
    supabaseOnly: true,
    sql: `
-- User profiles for Supabase Auth (e.g. Google sign-in).
-- One row per signed-in person; the role decides which side of the app they
-- see. Kept minimal on purpose (problem statement: avoid unnecessary personal
-- information) — no phone, no address, no name required.
create table if not exists public.kc_profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               text not null default 'collector' check (role in ('collector', 'recycler', 'admin')),
  preferred_language text not null default 'hi' check (preferred_language in ('en', 'hi', 'mr')),
  operating_location text,
  collector_id       text unique,  -- the app's device-generated collector ID, once linked
  recycler_id        text,         -- kc_recyclers.recycler_id when role = 'recycler'
  recycler_verified  boolean not null default false,  -- set by an admin, never by the user
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.kc_profiles enable row level security;

-- A signed-in user can read and edit only their own row, and can only pick
-- collector/recycler for themselves (admin is granted from the dashboard).
drop policy if exists "kc_profiles: read own" on public.kc_profiles;
create policy "kc_profiles: read own" on public.kc_profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "kc_profiles: update own" on public.kc_profiles;
create policy "kc_profiles: update own" on public.kc_profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and role in ('collector', 'recycler'));

-- Users may change only these columns; recycler_verified stays admin-only.
revoke update on public.kc_profiles from authenticated;
grant update (role, preferred_language, operating_location, collector_id, recycler_id)
  on public.kc_profiles to authenticated;

-- Create the profile automatically when someone signs up.
create or replace function public.kc_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.kc_profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists kc_on_auth_user_created on auth.users;
create trigger kc_on_auth_user_created
  after insert on auth.users
  for each row execute function public.kc_handle_new_user();

create or replace function public.kc_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists kc_profiles_touch on public.kc_profiles;
create trigger kc_profiles_touch
  before update on public.kc_profiles
  for each row execute function public.kc_touch_updated_at();
`,
  },
  {
    file: '02_helpers.sql',
    title: 'Helper functions',
    sql: `
-- Epoch milliseconds (as the app stores time) -> timestamptz. IMMUTABLE so it
-- can be used in generated columns.
create or replace function kc_ms(v jsonb) returns timestamptz
language sql immutable as $fn$ select to_timestamp((v #>> '{}')::double precision / 1000) $fn$;
`,
  },
  {
    file: '03_recyclers.sql',
    title: 'Recycler / aggregator dataset',
    sql: `
-- Recycler / aggregator dataset
create table if not exists kc_recyclers (
  recycler_id          text primary key,
  data                 jsonb not null,
  name                 text    generated always as (data->>'name') stored,
  authorization_status text    generated always as (data->>'authorizationStatus') stored,
  authorization_id     text    generated always as (data->>'authorizationId') stored,
  address              text    generated always as (data#>>'{location,address}') stored,
  lat                  double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng                  double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  pickup_available     boolean generated always as ((data->>'pickupAvailable')::boolean) stored,
  service_area         text    generated always as (data->>'serviceArea') stored,
  contact              text    generated always as (data->>'contact') stored,
  updated_at           timestamptz not null default now()
);
`,
  },
  {
    file: '04_prices.sql',
    title: 'Price dataset',
    sql: `
-- Price dataset (market observations + recycler quotes + completed sales)
create table if not exists kc_prices (
  price_key        text primary key,            -- md5 of the row; rows are append-only
  data             jsonb not null,
  category         text    generated always as (data->>'category') stored,
  sub_category     text    generated always as (data->>'subCategory') stored,
  location         text    generated always as (data->>'location') stored,
  observed_at      timestamptz generated always as (kc_ms(data->'date')) stored,
  buying_price     numeric generated always as ((data->>'buyingPrice')::numeric) stored,
  quoted_price     numeric generated always as ((data->>'quotedPrice')::numeric) stored,
  unit             text    generated always as (data->>'unit') stored,
  recycler_id      text    generated always as (data->>'recyclerId') stored,
  market_range_low  numeric generated always as ((data->>'marketRangeLow')::numeric) stored,
  market_range_high numeric generated always as ((data->>'marketRangeHigh')::numeric) stored
);
create index if not exists kc_prices_category_time on kc_prices (category, observed_at);
`,
  },
  {
    file: '05_materials.sql',
    title: 'Material dataset (lots)',
    sql: `
-- Material dataset (one row per collected lot)
create table if not exists kc_lots (
  lot_id          text primary key,
  data            jsonb not null,
  collector_id    text    generated always as (data->>'collectorId') stored,
  category        text    generated always as (data->>'category') stored,
  sub_category    text    generated always as (data->>'subCategory') stored,
  description     text    generated always as (data->>'description') stored,
  condition       text    generated always as (data->>'condition') stored,
  source_type     text    generated always as (data->>'sourceType') stored,
  weight_kg       numeric generated always as ((data->>'approxWeightKg')::numeric) stored,
  estimated_value numeric generated always as ((data->>'estimatedValue')::numeric) stored,
  status          text    generated always as (data->>'status') stored,
  created_at      timestamptz generated always as (kc_ms(data->'createdAt')) stored,
  lat             double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng             double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  updated_at      timestamptz not null default now()
);
create index if not exists kc_lots_collector on kc_lots (collector_id);

-- Image-classifier suggestion next to the collector's chosen category: a
-- growing labelled dataset (photo thumbnail + human label + model guess).
alter table kc_lots add column if not exists ai_label text
  generated always as (data#>>'{aiSuggestion,label}') stored;
alter table kc_lots add column if not exists ai_confidence numeric
  generated always as ((data#>>'{aiSuggestion,confidence}')::numeric) stored;
alter table kc_lots add column if not exists ai_model text
  generated always as (data#>>'{aiSuggestion,model}') stored;
`,
  },
  {
    file: '06_transactions.sql',
    title: 'Transaction dataset',
    sql: `
-- Transaction dataset
create table if not exists kc_transactions (
  transaction_id     text primary key,
  data               jsonb not null,
  lot_id             text    generated always as (data->>'lotId') stored,
  collector_id       text    generated always as (data->>'collectorId') stored,
  recycler_id        text    generated always as (data->>'recyclerId') stored,
  quoted_price       numeric generated always as ((data->>'quotedPrice')::numeric) stored,
  final_price        numeric generated always as ((data->>'finalPrice')::numeric) stored,
  payment_status     text    generated always as (data->>'paymentStatus') stored,
  transaction_status text    generated always as (data->>'transactionStatus') stored,
  occurred_at        timestamptz generated always as (kc_ms(data->'dateTime')) stored,
  collection_lat     double precision generated always as ((data#>>'{collectionLocation,lat}')::double precision) stored,
  collection_lng     double precision generated always as ((data#>>'{collectionLocation,lng}')::double precision) stored,
  handover_lat       double precision generated always as ((data#>>'{handoverLocation,lat}')::double precision) stored,
  handover_lng       double precision generated always as ((data#>>'{handoverLocation,lng}')::double precision) stored,
  updated_at         timestamptz not null default now()
);
create index if not exists kc_transactions_collector on kc_transactions (collector_id);
create index if not exists kc_transactions_recycler on kc_transactions (recycler_id);

-- Pickup lifecycle (requested -> accepted -> on_the_way -> arriving -> completed | declined).
-- Added with ALTER so databases created before pickups existed are upgraded in place.
alter table kc_transactions add column if not exists pickup_status text
  generated always as (data#>>'{pickup,status}') stored;
alter table kc_transactions add column if not exists pickup_requested_at timestamptz
  generated always as (kc_ms(data#>'{pickup,requestedAt}')) stored;
alter table kc_transactions add column if not exists pickup_updated_at timestamptz
  generated always as (kc_ms(data#>'{pickup,updatedAt}')) stored;
create index if not exists kc_transactions_pickup on kc_transactions (recycler_id, pickup_status);
`,
  },
  {
    file: '07_traceability.sql',
    title: 'Traceability dataset + recycler confirmations',
    sql: `
-- Traceability dataset (verifiable handover records)
create table if not exists kc_traceability (
  handover_reference   text primary key,         -- KC-XXXXXX
  data                 jsonb not null,           -- includes photoThumbnails (small data URLs)
  lot_id               text    generated always as (data->>'lotId') stored,
  transaction_id       text    generated always as (data->>'transactionId') stored,
  collector_id         text    generated always as (data->>'collectorId') stored,
  recycler_id          text    generated always as (data->>'recyclerId') stored,
  handover_hash        text    generated always as (data->>'handoverHash') stored,
  weight_kg            numeric generated always as ((data->>'weight')::numeric) stored,
  recorded_at          timestamptz generated always as (kc_ms(data->'timestamp')) stored,
  lat                  double precision generated always as ((data#>>'{location,lat}')::double precision) stored,
  lng                  double precision generated always as ((data#>>'{location,lng}')::double precision) stored,
  location_approximate boolean generated always as (coalesce((data->>'locationApproximate')::boolean, false)) stored,
  status               text    generated always as (data->>'status') stored,
  confirmed_by         text    generated always as (data#>>'{recyclerConfirmation,confirmedBy}') stored,
  confirmed_at         timestamptz generated always as (kc_ms(data#>'{recyclerConfirmation,confirmedAt}')) stored,
  updated_at           timestamptz not null default now()
);

-- Recycler confirmations (may arrive before the handover record syncs)
create table if not exists kc_confirmations (
  handover_reference text primary key,
  data               jsonb not null,
  confirmed_by       text    generated always as (data->>'confirmedBy') stored,
  confirmed_at       timestamptz generated always as (kc_ms(data->'confirmedAt')) stored,
  final_price        numeric generated always as ((data->>'finalPrice')::numeric) stored,
  payment_status     text    generated always as (data->>'paymentStatus') stored
);
`,
  },
  {
    file: '08_flags_audit.sql',
    title: 'Anomaly flags + audit trail',
    sql: `
-- Abnormal transaction flags (anomaly detection output)
create table if not exists kc_flags (
  transaction_id text primary key,
  data           jsonb not null,
  reason         text    generated always as (data->>'reason') stored,
  deviation_pct  numeric generated always as ((data->>'deviationPct')::numeric) stored,
  flagged_at     timestamptz generated always as (kc_ms(data->'at')) stored
);

-- Audit trail of every accepted write
create table if not exists kc_audit (
  seq  bigint primary key,
  data jsonb not null,
  kind text generated always as (data->>'kind') stored,
  ref  text generated always as (data->>'ref') stored,
  at   timestamptz generated always as (kc_ms(data->'at')) stored
);
`,
  },
  {
    file: '09_collectors.sql',
    title: 'Collector dataset (view)',
    sql: `
-- Collector dataset: minimal by design (pseudonymous device ID, no name/phone).
create or replace view kc_collectors as
select l.collector_id,
       count(distinct l.lot_id)                                                   as lots,
       count(distinct t.transaction_id)                                           as transactions,
       coalesce(sum(coalesce(t.final_price, t.quoted_price))
                filter (where t.payment_status <> 'pending'), 0)                  as earnings_settled,
       coalesce(sum(coalesce(t.final_price, t.quoted_price))
                filter (where t.payment_status = 'pending'
                          and t.transaction_status <> 'pending'), 0)              as dues_pending,
       min(l.created_at)                                                          as first_seen,
       max(l.created_at)                                                          as last_seen
from kc_lots l
left join kc_transactions t on t.lot_id = l.lot_id
group by l.collector_id;
`,
  },
  {
    file: '10_security.sql',
    title: 'Row Level Security',
    sql: `
-- Supabase exposes the public schema over its REST API. Row Level Security
-- with no policies blocks that path entirely; the app server connects as the
-- database owner and is unaffected.
alter table kc_recyclers     enable row level security;
alter table kc_prices        enable row level security;
alter table kc_lots          enable row level security;
alter table kc_transactions  enable row level security;
alter table kc_traceability  enable row level security;
alter table kc_confirmations enable row level security;
alter table kc_flags         enable row level security;
alter table kc_audit         enable row level security;
`,
  },
];

/** What the server applies on boot. */
export const SCHEMA_SQL = SCHEMA_SECTIONS.filter((s) => !s.supabaseOnly)
  .map((s) => s.sql)
  .join('\n');

/** Tables in load/save order, with the key each app record is stored under. */
export const TABLES = {
  recyclers: 'kc_recyclers',
  prices: 'kc_prices',
  lots: 'kc_lots',
  transactions: 'kc_transactions',
  traceability: 'kc_traceability',
  confirmations: 'kc_confirmations',
  flags: 'kc_flags',
  audit: 'kc_audit',
} as const;
