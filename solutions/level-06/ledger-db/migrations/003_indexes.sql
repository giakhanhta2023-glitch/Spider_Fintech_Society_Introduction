-- 003: the indexes, and the reason for each one.
--
-- Postgres indexes a primary key automatically and a foreign key not at all.
-- That asymmetry is the single most common cause of a ledger that gets slower
-- every week: the referencing column is the one you query through.

-- The balance query: sum every entry for one account.
-- Measured on 398,003 entries, this took a parallel sequential scan of 3,317
-- buffers and 31.4 ms before it existed, and a bitmap heap scan of 206 buffers
-- and 0.39 ms afterwards.
create index entries_account_id_idx on entries (account_id);

-- The covering index. It carries amount_minor in the leaf, so the balance
-- query is answered from the index alone with Heap Fetches: 0, at 6 buffers
-- and 0.118 ms.
--
-- It is not free, and the sizes are the interesting part. On the same data:
--
--   entries_account_id_idx        2,688 kB
--   entries_account_covering_idx     12 MB
--
-- The plain index is small because account_id repeats about 200 times per
-- account and Postgres deduplicates runs of equal keys in the leaf pages.
-- Adding amount_minor makes every entry distinct, deduplication stops
-- applying, and the index grows four and a half times. That is the trade:
-- 34 times fewer buffers on read, for four and a half times the index, and a
-- larger write cost on every insert.
create index entries_account_covering_idx on entries (account_id) include (amount_minor);

-- The foreign key index that Postgres does not create for you. Needed by the
-- balance trigger, by every statement query, and by any delete of a
-- transaction, which without it scans the whole entries table per row.
create index entries_transaction_id_idx on entries (transaction_id);

-- Statements are read by date range for one account, so the order of the
-- columns matters: account first, because it is the equality, then time.
create index entries_account_created_at_idx on entries (account_id, created_at);
