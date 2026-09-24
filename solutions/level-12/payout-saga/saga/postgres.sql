-- The payouts table, and the two things about it that are not obvious.

create table payouts (
    id           bigserial primary key,
    -- Generated once, at creation, and stored before the first attempt.
    -- A reference generated per attempt turns one payout into several and
    -- makes recovery impossible: this is the single most common way payout
    -- systems pay twice.
    our_ref      text        not null unique,
    merchant_id  bigint      not null,
    amount_minor bigint      not null check (amount_minor > 0),
    state        text        not null default 'requested',
    bank_ref     text,
    debited      boolean     not null default false,
    attempts     int         not null default 0,
    -- Every state change writes this. A payout in 'submitting' for 30 seconds
    -- is normal; one that has been there for an hour is stuck, and the only
    -- thing that tells them apart is when it got there.
    updated_at   timestamptz not null default now()
);

-- The sweeper queries only unfinished payouts, and there should never be many
-- of those however large the table grows. A partial index means its size
-- tracks the backlog rather than the table, exactly as in level 11.
create index payouts_unfinished on payouts (state, updated_at)
    where state not in ('paid', 'compensated', 'rejected', 'failed');

-- Compensations, idempotent by constraint rather than by care.
--
-- The unique key is the mechanism. compensate() inserts here first, and only
-- posts the ledger entries when the insert actually created a row. Run it
-- three times and the merchant is credited once, and that is enforced by the
-- database rather than by the caller remembering.
create table compensations (
    id         bigserial primary key,
    payout_id  bigint      not null references payouts (id),
    kind       text        not null,
    created_at timestamptz not null default now(),
    unique (payout_id, kind)
);

--   insert into compensations (payout_id, kind) values ($1, 'refund_debit')
--   on conflict (payout_id, kind) do nothing
--   returning id;
--   -- ledger entries are posted only when a row came back


-- ------------------------------------------------------------- the sweeper
-- skip locked so several sweepers can run without two of them resolving the
-- same payout, which is how a compensation and a completion race each other.
select id, our_ref, state
  from payouts
 where state not in ('paid', 'compensated', 'rejected', 'failed')
   and updated_at < now() - interval '2 minutes'
 order by updated_at
   for update skip locked
 limit 100;

-- The two minutes has to be comfortably longer than the slowest normal
-- completion, so the sweeper never races a request that is simply slow.
-- Against a real bank it might be an hour. It is configuration either way.


-- -------------------------------------------------------- stuck detection
-- The query that should always return nothing.
--
-- Fifteen minutes, because that is seven sweeper intervals: anything still
-- here has been past the sweeper seven times and is not going to resolve
-- itself. Alert on any row, and put the oldest age on a dashboard.
select state, count(*), min(updated_at) as oldest
  from payouts
 where state not in ('paid', 'compensated', 'rejected', 'failed')
   and updated_at < now() - interval '15 minutes'
 group by state;
