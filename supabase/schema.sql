-- ─── Vesti — Supabase Schema ──────────────────────────────────────────────────
-- Run this in the Supabase SQL editor to set up the database.
-- Enables Row-Level Security (RLS) on all user-data tables.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. Profiles (extends Supabase Auth users) ────────────────────────────────
create table if not exists profiles (
  id                     uuid references auth.users primary key,
  email                  text,
  full_name              text,
  avatar_url             text,
  plan                   text not null default 'free',      -- 'free' | 'pro'
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  subscription_status    text,                               -- 'active' | 'canceled' | 'past_due' | null
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Auto-create profile row when a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table profiles enable row level security;
create policy "Users can read own profile"   on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
-- Service role can upsert (used by Stripe webhook)
create policy "Service role can upsert profiles" on profiles for all using (auth.role() = 'service_role');


-- ── 2. Wardrobe Items ─────────────────────────────────────────────────────────
create table if not exists wardrobe_items (
  id            text not null,
  user_id       uuid not null references auth.users on delete cascade,
  name          text not null,
  category      text,
  color         text,
  layer         text,
  brand         text,
  image_url     text,
  is_travel     boolean not null default true,
  is_in_capsule boolean not null default false,
  source        text not null default 'manual',   -- 'manual' | 'sheets_import'
  metadata      jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key   (id, user_id)
);

alter table wardrobe_items enable row level security;
create policy "Users can CRUD own wardrobe items" on wardrobe_items
  for all using (auth.uid() = user_id);


-- ── 3. Trips ──────────────────────────────────────────────────────────────────
create table if not exists trips (
  id          text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  destination text,
  start_date  date,
  end_date    date,
  days        jsonb,    -- array of { id, date, city, weather, ... }
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table trips enable row level security;
create policy "Users can CRUD own trips" on trips
  for all using (auth.uid() = user_id);


-- ── 4. Outfits (per user, per trip day) ──────────────────────────────────────
create table if not exists outfits (
  id          text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  trip_id     text references trips on delete cascade,
  day_id      text not null,
  daytime     jsonb,
  evening     jsonb,
  breakfast   jsonb,
  sleepwear   jsonb,
  flight      jsonb,
  activity    jsonb,
  is_frozen   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (user_id, trip_id, day_id)
);

alter table outfits enable row level security;
create policy "Users can CRUD own outfits" on outfits
  for all using (auth.uid() = user_id);


-- ── 5. Capsule Items (per user, per trip) ─────────────────────────────────────
create table if not exists capsule_items (
  user_id    uuid not null references auth.users on delete cascade,
  trip_id    text references trips on delete cascade,
  item_id    text not null,
  added_at   timestamptz not null default now(),
  primary key (user_id, trip_id, item_id)
);

alter table capsule_items enable row level security;
create policy "Users can CRUD own capsule items" on capsule_items
  for all using (auth.uid() = user_id);


-- ── 6. AI Preview Cache (per user, per outfit hash) ───────────────────────────
-- Stores cached AI-generated preview image URLs to avoid redundant generation.
create table if not exists ai_preview_cache (
  user_id     uuid not null references auth.users on delete cascade,
  cache_key   text not null,    -- hash of tripId + dayId + outfitSlotHash
  image_url   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  primary key (user_id, cache_key)
);

alter table ai_preview_cache enable row level security;
create policy "Users can read own preview cache" on ai_preview_cache
  for all using (auth.uid() = user_id);


-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_wardrobe_user   on wardrobe_items (user_id);
create index if not exists idx_trips_user      on trips (user_id);
create index if not exists idx_outfits_user    on outfits (user_id);
create index if not exists idx_outfits_trip    on outfits (trip_id);
create index if not exists idx_capsule_user    on capsule_items (user_id);
create index if not exists idx_preview_user    on ai_preview_cache (user_id);
create index if not exists idx_preview_expires on ai_preview_cache (expires_at);
