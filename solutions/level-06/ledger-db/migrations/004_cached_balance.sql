-- 004: the cached balance, and the rule that keeps it honest.
--
-- accounts.balance_minor is a cache of sum(entries.amount_minor). It exists
-- because a balance lookup on a hot account should be one row read rather than
-- an aggregate over a hundred thousand entries.
--
-- Two things make a cache like this safe:
--
--   1. It is maintained by a trigger, inside the same transaction as the entry
--      that changed it. There is no window in which an entry exists and the
--      balance does not reflect it, and no application code that can forget.
--
--   2. The entries remain the truth, and something checks. reconcile.py
--      compares every cached balance against the entries and exits non-zero on
--      any disagreement. A cache nobody verifies is just a second opinion.
--
-- Measured after seeding: the balance for account 137 read -63,500 from the
-- cache, -63,500 summed from entries, and -63,500 at the end of the statement
-- window function. Three routes, one number.

create or replace function apply_entry_to_balance() returns trigger
language plpgsql as $$
begin
    update accounts
       set balance_minor = balance_minor + new.amount_minor
     where id = new.account_id;
    return null;
end;
$$;

-- AFTER INSERT only, because entries are append only. If this project ever
-- allowed an entry to be updated or deleted, this trigger would be wrong and
-- the right answer would be to keep the append-only rule instead.
create trigger entries_maintain_balance
    after insert on entries
    for each row
    execute function apply_entry_to_balance();
