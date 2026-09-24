-- Baseline on the plain table. Take these numbers BEFORE changing anything,
-- because the whole level is a comparison and there is nothing to compare to
-- afterwards.
--
-- Everything below was measured on Postgres 18 with 500,000 payments. Your
-- numbers will differ. The ratios are what carry over, and they get worse as
-- the table grows, never better.

-- ------------------------------------------------------------ the table
create table pay_plain (
    id           bigserial primary key,
    merchant_id  int         not null,
    amount_minor bigint      not null,
    status       text        not null,
    created_at   timestamptz not null
);

insert into pay_plain (merchant_id, amount_minor, status, created_at)
select (random() * 5000)::int,
       (random() * 50000)::bigint + 100,
       (array['captured','captured','captured','refunded','failed'])[(random()*4)::int + 1],
       timestamptz '2025-01-01' + (random() * 359) * interval '1 day'
  from generate_series(1, 500000);

create index pay_plain_created on pay_plain (created_at);
create index pay_plain_merch   on pay_plain (merchant_id);
analyze pay_plain;


-- -------------------------------------------------- 1. a monthly aggregate
explain (analyze, buffers, costs off)
select status, count(*), sum(amount_minor)
  from pay_plain
 where created_at >= '2025-07-01' and created_at < '2025-08-01'
 group by status;

--  HashAggregate (actual time=19.634..19.637 rows=3 loops=1)
--    Buffers: shared hit=4729
--    ->  Bitmap Heap Scan on pay_plain (rows=42920)
--          Heap Blocks: exact=4609
--  Execution Time: 19.681 ms
--
--  42,920 rows live in 4,609 separate heap blocks, because July is scattered
--  across the whole table. That scattering is what partitioning fixes.


-- -------------------------------------------------- 2. a merchant lookup
explain (analyze, buffers, costs off, summary on)
select count(*), sum(amount_minor) from pay_plain where merchant_id = 1234;

--  Aggregate (actual time=0.186..0.186 rows=1 loops=1)
--    Buffers: shared hit=69
--    ->  Bitmap Index Scan on pay_plain_merch (rows=67)
--  Planning Time: 0.188 ms
--  Execution Time: 0.222 ms
--
--  One index scan. Remember the planning time: it is the number that moves
--  after partitioning, and it moves in the wrong direction.


-- ------------------------------------------- 3. deleting one month, timed
do $$
declare t0 timestamptz; l0 pg_lsn; n bigint; sz0 bigint;
begin
  sz0 := pg_total_relation_size('pay_plain');
  l0 := pg_current_wal_insert_lsn(); t0 := clock_timestamp();

  delete from pay_plain where created_at >= '2025-04-01' and created_at < '2025-05-01';
  get diagnostics n = row_count;

  raise notice 'deleted % rows in % ms, % of write ahead log, table % -> %',
    n,
    round(extract(epoch from clock_timestamp() - t0) * 1000, 1),
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), l0)),
    pg_size_pretty(sz0),
    pg_size_pretty(pg_total_relation_size('pay_plain'));
end $$;

--  deleted 41567 rows in 47.2 ms, 2947 kB of write ahead log,
--  table 57 MB -> 57 MB
--
--  Note the last part. A DELETE does not shrink a table: it marks rows dead
--  and the space is reused for future rows. A table you delete from nightly
--  stays permanently large even though the row count is flat.
--
--  Use pg_current_wal_insert_lsn() rather than pg_current_wal_lsn(). The
--  second one reports the FLUSH position, which does not move inside an
--  uncommitted transaction, so it reports 0 bytes of log for work that
--  generated megabytes. That cost me a measurement.
