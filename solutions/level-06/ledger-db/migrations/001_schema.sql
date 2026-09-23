-- 001: the three tables.
--
-- Every rule that can be a constraint is a constraint. Application code is
-- allowed to be wrong; the database is the thing that has to refuse.
--
--   accounts      who holds money
--   transactions  one business event, with the idempotency key on it
--   entries       the movements, always at least two, always summing to zero

create table accounts (
    id            bigserial primary key,
    name          text        not null,
    kind          text        not null check (kind in ('asset', 'liability', 'equity', 'income', 'expense')),
    currency      char(3)     not null,
    -- A cache, maintained by a trigger in migration 004. The entries remain
    -- the truth; this column exists so that a balance lookup is one row read
    -- rather than an aggregate over the account's whole history.
    balance_minor bigint      not null default 0,
    created_at    timestamptz not null default now()
);

create table transactions (
    id              bigserial primary key,
    -- The caller's key. Unique, so a retried request cannot create a second
    -- transaction: the database refuses it rather than the application
    -- remembering to check.
    idempotency_key text        not null,
    reference       text,
    description     text        not null,
    created_at      timestamptz not null default now(),
    constraint transactions_idempotency_key_unique unique (idempotency_key)
);

create table entries (
    id             bigserial   primary key,
    transaction_id bigint      not null references transactions (id),
    account_id     bigint      not null references accounts (id),
    -- Minor units, never a float and never a numeric with a default scale.
    -- bigint holds 92 quadrillion minor units, which is enough.
    amount_minor   bigint      not null,
    created_at     timestamptz not null default now(),
    -- A zero movement is not a movement. Allowing it means rows that look like
    -- activity and change nothing, which is how a reconciliation break gets
    -- explained away rather than investigated.
    constraint entries_amount_not_zero check (amount_minor <> 0)
);

comment on column accounts.balance_minor is
    'Cached. The entries table is the truth; see migration 004 and reconcile.py.';
comment on table entries is
    'Append only. Nothing in this project updates or deletes an entry.';
