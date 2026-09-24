-- Five migrations, all one line, all on the same table.
-- Three are free and two are outages, and the diff does not tell you which.
--
-- Every migration in this repository starts with these two lines.
set lock_timeout = '3s';
set statement_timeout = '30s';
--
-- lock_timeout is the one that matters, and it is worth being precise about
-- what it prevents. Postgres lock queues are FAIR: a migration waiting for
-- ACCESS EXCLUSIVE makes every query that arrives after it wait too, even the
-- ones that would not have conflicted with each other. A one second migration
-- behind a four minute reporting query takes the table down for four minutes
-- while executing nothing at all.
--
-- Three seconds, because that is long enough to acquire a lock on a healthy
-- system and short enough that failing costs nothing: the deploy tool retries.
-- Failing is fine. Queueing is not.


-- ------------------------------------------------------- the measurements
-- Each of these was timed with clock_timestamp() around it and the write
-- ahead log measured with pg_current_wal_insert_lsn(), on 415,554 rows.

alter table pay_plain add column region text;
--  0.7 ms, 504 bytes of log. Catalog only, brief exclusive lock.

alter table pay_plain add column tier text not null default 'standard';
--  0.6 ms, 2,208 bytes. ALSO catalog only: since Postgres 11 a constant
--  default is recorded once and applied as rows are read.

alter table pay_plain add column token uuid not null default gen_random_uuid();
--  1,526 ms, 70 MB of log. FULL TABLE REWRITE under ACCESS EXCLUSIVE.
--
--  The previous statement and this one differ by one word. gen_random_uuid()
--  is VOLATILE, so it has to produce a different value per row, so Postgres
--  rewrites the entire table while holding a lock that blocks every reader
--  and every writer.

alter table pay_plain alter column amount_minor type numeric(18,2);
--  837 ms, 67 MB of log. Full rewrite, and every index rebuilt.

create index pay_plain_merch on pay_plain (merchant_id);
--  254 ms. Writes blocked for exactly that long; reads fine.
--  Use CREATE INDEX CONCURRENTLY in production: more work, two passes, cannot
--  run in a transaction, and it never blocks writes. If it fails it leaves an
--  invalid index behind, so check pg_index.indisvalid rather than assuming.


-- ------------------------------------------------------- the scale problem
-- That 1,526 ms is on 415,554 rows. At two hundred million it is closer to
-- twelve minutes, and twelve minutes of ACCESS EXCLUSIVE on the payments
-- table is a full outage of the product.


-- ---------------------------------------------- reproducing the lock queue
-- Three psql sessions. This is worth doing once with your own hands, because
-- reading about it does not produce the same alarm.
--
--   session 1:  begin;
--               select count(*) from pay_plain;   -- holds ACCESS SHARE
--               -- leave the transaction open
--
--   session 2:  alter table pay_plain add column x int;
--               -- waits. It wants ACCESS EXCLUSIVE and cannot have it.
--
--   session 3:  select 1 from pay_plain limit 1;
--               -- ALSO waits, behind session 2, although it conflicts with
--               -- nothing session 1 is doing. The table is now unusable and
--               -- the migration has not touched a row.
--
--   session 3:  select * from pg_locks where not granted;   -- see the queue
--
-- Now repeat it with `set lock_timeout = '3s';` in session 2. It gives up
-- after three seconds, session 3 never queues, and the deploy tool retries.
