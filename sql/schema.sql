-- FinQuest accounts and saved progress.
--
-- Run this once against your Neon database, from the Neon SQL editor or psql:
--   psql "$DATABASE_URL" -f sql/schema.sql
--
-- There are no passwords in here on purpose. Google verifies who the person is
-- and we store only what it tells us, so a leak of this database cannot leak a
-- password that was never ours to hold.

create table if not exists users (
  id           bigserial primary key,
  google_sub   text        not null unique,   -- Google's stable id for the account
  email        text        not null,
  name         text,
  picture      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per learner. The state is the same shape the browser already keeps in
-- localStorage: xp, badges, and a map of per level progress. Keeping it as one
-- document means the game rules stay in one place, in storage.js, instead of
-- being half in JavaScript and half in SQL.
create table if not exists progress (
  user_id    bigint      primary key references users(id) on delete cascade,
  state      jsonb       not null,
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (email);
