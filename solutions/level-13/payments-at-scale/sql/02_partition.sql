-- The same data, partitioned by month, and both halves of what that costs.

create table pay_part (
    id           bigserial,
    merchant_id  int         not null,
    amount_minor bigint      not null,
    status       text        not null,
    created_at   timestamptz not null,
    -- The partition key has to be in every unique index. This is not a
    -- formality: it means a unique constraint on `reference` alone becomes
    -- unique on (reference, created_at), which is a different promise, and
    -- level 7's idempotency key needs rethinking because of it.
    primary key (id, created_at)
) partition by range (created_at);

do $$
declare m int;
begin
  for m in 1..12 loop
    execute format(
      'create table pay_part_2025_%s partition of pay_part for values from (%L) to (%L)',
      lpad(m::text, 2, '0'),
      make_date(2025, m, 1),
      case when m < 12 then make_date(2025, m + 1, 1) else make_date(2026, 1, 1) end);
  end loop;
end $$;

insert into pay_part (merchant_id, amount_minor, status, created_at)
select merchant_id, amount_minor, status, created_at from pay_plain;

create index pay_part_created on pay_part (created_at);
create index pay_part_merch   on pay_part (merchant_id);
analyze pay_part;


-- ----------------------------------------------------- what it buys you
explain (analyze, buffers, costs off)
select status, count(*), sum(amount_minor)
  from pay_part
 where created_at >= '2025-07-01' and created_at < '2025-08-01'
 group by status;

--  HashAggregate (actual time=13.699..13.700 rows=3 loops=1)
--    Buffers: shared hit=396
--    ->  Seq Scan on pay_part_2025_07 pay_part (rows=42920)
--  Execution Time: 13.739 ms
--
--                   plain table        partitioned
--   pages touched         4,729                396
--   execution time      19.7 ms            13.7 ms
--
--  The time is not the interesting column: the pages are. July IS a table
--  now, so its rows are physically next to each other and the same answer
--  costs a twelfth of the reads. That ratio grows with the table, because the
--  pruned scan stays the size of one month forever.
--
--  If the plan names more than one partition, the filter is not on the
--  partition key, or it is wrapped in a function that hides it.


-- -------------------------------------------------------- what it costs
explain (analyze, buffers, costs off, summary on)
select count(*), sum(amount_minor) from pay_part where merchant_id = 1234;

--  Aggregate (actual time=0.274..0.277 rows=1 loops=1)
--    Buffers: shared hit=64 read=20
--    ->  Append (rows=67)
--          ->  Bitmap Heap Scan on pay_part_2025_01 ...
--          ->  Bitmap Heap Scan on pay_part_2025_02 ...
--          ... ten of them
--  Planning Time: 0.898 ms
--  Execution Time: 0.342 ms
--
--                   plain table        partitioned
--   index scans               1                 10
--   planning time      0.188 ms           0.898 ms
--   execution time     0.222 ms           0.342 ms
--
--  Read the planning row. The planner opens ten partitions and ten indexes to
--  plan a query that executes in a third of a millisecond, so PLANNING NOW
--  COSTS MORE THAN THE WORK. With a hundred partitions it is worse, and this
--  is the moment somebody discovers their busiest endpoint got slower after
--  the migration that was supposed to speed everything up.


-- ------------------------------------------------- retention, the real reason
do $$
declare t0 timestamptz; l0 pg_lsn; sz0 bigint;
begin
  sz0 := pg_total_relation_size('pay_part_2025_04');
  l0 := pg_current_wal_insert_lsn(); t0 := clock_timestamp();
  drop table pay_part_2025_04;
  raise notice 'dropped a month in % ms, % of log, % returned',
    round(extract(epoch from clock_timestamp() - t0) * 1000, 1),
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_insert_lsn(), l0)),
    pg_size_pretty(sz0);
end $$;

--  dropped a month in 0.9 ms, 5400 bytes of log, 5336 kB returned
--
--   removing one month      DELETE          DROP partition
--   time                    47.2 ms         0.9 ms
--   write ahead log         2,947 kB        5,400 bytes
--   disk returned           none            all of it, immediately
--   left behind             dead rows       nothing
--
--  Fifty times faster, five hundred times less log, and the space actually
--  comes back. Scale that to a real table and it is the difference between a
--  nightly delete job that runs for hours and bloats the table, and one
--  statement that finishes before you let go of the return key.
