-- The outbox in Postgres. The Python in core.py models these semantics; this
-- is what they look like against a real database, and the measurements below
-- were taken on Postgres 18.

-- ---------------------------------------------------------------- the table
create table outbox (
    id           bigserial primary key,
    aggregate_id text        not null,      -- the payment. Also the partition key
    event_type   text        not null,
    event_id     text        not null unique,  -- what a consumer deduplicates on
    payload      jsonb       not null,
    created_at   timestamptz not null default now(),
    published_at timestamptz,
    attempts     int         not null default 0
);

-- The index that makes the publisher's poll cheap forever.
--
-- Partial, on unpublished rows only, so its size depends on the size of the
-- BACKLOG rather than on the size of the table. The outbox table grows without
-- bound; this index does not.
--
-- Measured on 5,000 rows with 10 unpublished:
--
--   partial index on (id) where published_at is null
--       Index Scan, 2 buffers, no sort                        128 kB
--
--   composite index on (published_at, id)
--       Index Scan + a quicksort, 4 buffers                   328 kB
--
-- The composite works and the planner will use it. The partial one is smaller,
-- needs no sort, and stays the same size when the table reaches a hundred
-- million rows, because it only indexes what has not been sent yet.
create index outbox_unpublished on outbox (id) where published_at is null;


-- ------------------------------------------------- writing it, and the point
-- The event goes in the SAME transaction as the business change. That is the
-- whole pattern. There is no window in which the payment exists and the event
-- does not, because they commit together or not at all.
--
--   begin;
--     insert into payments (...) values (...);
--     insert into outbox (aggregate_id, event_type, event_id, payload)
--          values (...);
--   commit;


-- ------------------------------------------------------------- the publisher
-- for update skip locked is what lets two publishers run at once. A row
-- another worker holds is skipped rather than waited for, so they share the
-- backlog instead of colliding on it or queueing behind each other.
--
-- Verified: with the partial index this plans as
--   Limit -> LockRows -> Index Scan using outbox_unpublished
-- at 2 buffers for the index scan.
select id, aggregate_id, event_type, event_id, payload
  from outbox
 where published_at is null
 order by id
   for update skip locked
 limit 500;

-- Then send, THEN mark. In that order.
--
-- Sending before marking means a crash in between produces a duplicate.
-- Marking before sending means the same crash produces a loss. Between a
-- message delivered twice and a message never delivered, at-least-once is the
-- one the consumer can fix, so the order is deliberate.
update outbox set published_at = now() where id = any($1);


-- --------------------------------------------------- the consumer's side
-- For a handler whose work is not naturally repeatable. The insert is the
-- deduplication: if the row is already there, this event has been applied and
-- the handler is skipped.
create table processed_event (
    event_id    text primary key,
    consumer    text        not null,
    applied_at  timestamptz not null default now()
);

--   begin;
--     insert into processed_event (event_id, consumer) values ($1, $2)
--       on conflict do nothing;
--     -- if that inserted 0 rows, stop here: already done
--     update merchant_totals set total_minor = total_minor + $3 where ...;
--   commit;
--
-- Both statements in one transaction, or the marker can be written for work
-- that then fails, and the event is lost in a way that looks like success.


-- ------------------------------------------------------------ dead letters
create table dead_letter (
    id          bigserial primary key,
    event_id    text        not null,
    partition   int         not null,
    "offset"    bigint      not null,
    payload     jsonb       not null,   -- so it can be replayed
    error       text        not null,   -- so somebody knows what broke
    attempts    int         not null,
    created_at  timestamptz not null default now()
);

-- The payload, the error and the offset. The offset matters more than it
-- looks: when the cause turns out to be the message BEFORE this one, the
-- offset is how you find it.
