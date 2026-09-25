-- Deploy 1. Migration only, no code change.
--
-- Add the new column, nullable, with no default that rewrites the table. The
-- running code does not know it exists, which is the definition of a safe
-- migration: it can be applied at any time, including twenty minutes before the
-- code that needs it, and rolled back by dropping a column nothing reads.
--
-- `fee_bps` is the old representation, basis points as an integer. `fee_minor` is
-- the new one, the actual money in minor units, which is what every other table
-- in the system uses and what level 4's ledger can balance against.

begin;

alter table l17_payments
  add column if not exists fee_minor bigint;

-- No NOT NULL and no DEFAULT here on purpose. On PostgreSQL 11 and later a
-- constant default is metadata only and does not rewrite the table, but NOT NULL
-- still requires every existing row to satisfy it, which means a full scan under
-- an ACCESS EXCLUSIVE lock. Level 13 measured what that costs on 415,554 rows.
-- The constraint arrives in deploy 6, when every row has a value.

comment on column l17_payments.fee_minor is
  'Fee in minor units. Replaces fee_bps. Written from deploy 2, read from deploy 4.';

commit;
