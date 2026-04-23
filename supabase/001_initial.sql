-- AlcoTrack database schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ── Drink log ──────────────────────────────────────────────────────────────

create table if not exists drink_log (
  id          uuid primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  logged_at   timestamptz not null,
  name        text not null,
  volume_ml   numeric not null,
  abv         numeric not null,
  cost        numeric default 0,
  created_at  timestamptz default now()
);

create index if not exists drink_log_user_time on drink_log (user_id, logged_at);

alter table drink_log enable row level security;

create policy "own drinks"
  on drink_log for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── User settings ──────────────────────────────────────────────────────────

create table if not exists user_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  gender       text        default 'male',
  weight_kg    numeric     default 75,
  weight_unit  text        default 'kg',
  bac_unit     text        default 'permille',
  vol_unit     text        default 'ml',
  currency     text        default '£',
  weekly_goal  numeric     default 14,
  legal_limit  numeric     default 0.80,
  updated_at   timestamptz default now()
);

alter table user_settings enable row level security;

create policy "own settings"
  on user_settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
