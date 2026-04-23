-- User custom drink presets — synced across devices
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

create table if not exists user_customs (
  id         uuid primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  vol        numeric not null,
  abv        numeric not null,
  icon       text default '🥤',
  created_at timestamptz default now()
);

create index if not exists user_customs_user on user_customs (user_id);

alter table user_customs enable row level security;

create policy "own customs"
  on user_customs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
