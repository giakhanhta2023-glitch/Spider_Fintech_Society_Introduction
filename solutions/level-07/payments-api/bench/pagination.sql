-- The two pagination plans, run them yourself.
--
-- Against the level 6 ledger with 398,003 entries, asking for the rows that a
-- caller would see on page 4,001 with a page size of 50.

-- 1. OFFSET. Reads every row it is skipping and discards it.
explain (analyze, buffers, costs off)
select id, created_at, account_id, amount_minor
  from entries
 order by created_at, id
 offset 200000 limit 50;

--  Limit (actual time=113.613..113.638 rows=50.00 loops=1)
--    Buffers: shared hit=101691 read=769
--    ->  Index Scan using entries_created_at_id_idx on entries
--          (actual time=0.054..103.364 rows=200050.00 loops=1)
--  Execution Time: 113.684 ms
--
--  Read 200,050 rows to return 50.

-- 2. Keyset. Asks the index for the place it left off.
explain (analyze, buffers, costs off)
select id, created_at, account_id, amount_minor
  from entries
 where (created_at, id) > (timestamptz '2025-07-03 00:00:00+00', 185234)
 order by created_at, id
 limit 50;

--  Limit (actual time=0.016..0.063 rows=50.00 loops=1)
--    Buffers: shared hit=30
--    ->  Index Scan using entries_created_at_id_idx on entries
--          Index Cond: (ROW(created_at, id) > ROW('2025-07-03 00:00:00+00', 185234))
--  Execution Time: 0.101 ms
--
--  Read 50 rows to return 50.

-- The index both of them need. Without it the OFFSET version also sorts the
-- whole table, and the keyset version has nothing to seek into.
-- create index entries_created_at_id_idx on entries (created_at, id);
