-- Deploy 6. Migration only, days later, once nothing reads fee_bps.
--
-- Two checks before this runs, both of which have to be evidence rather than
-- belief:
--
--   1. No code path reads fee_bps. A grep across every repository, not just this
--      one: the reporting job, the finance export and the support tool are the
--      three that get forgotten.
--   2. No query has read it recently. pg_stat_statements is the evidence:
--
--      select query, calls from pg_stat_statements
--       where query ilike '%fee_bps%' and calls > 0;

begin;

-- The constraint arrives now, when every row has a value and nothing writes the
-- old column. Adding NOT NULL still scans the table, so it goes in a maintenance
-- window or uses the check constraint trick: add a NOT VALID check constraint,
-- validate it concurrently, then convert. On a small table, just take the lock.
alter table l17_payments
  alter column fee_minor set not null;

alter table l17_payments
  drop column if exists fee_bps;

commit;

-- Dropping a column does not reclaim the space; it marks the column dropped and
-- leaves the data in the pages until the rows are rewritten. `vacuum full` or
-- pg_repack reclaims it, both of which need a lock or an extension. For most
-- tables the answer is to let autovacuum get there eventually and not care.
