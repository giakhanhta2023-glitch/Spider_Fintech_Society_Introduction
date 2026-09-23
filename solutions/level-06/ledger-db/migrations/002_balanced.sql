-- 002: the constraint that makes this a ledger rather than a table of numbers.
--
-- Every transaction's entries must sum to zero. This cannot be a CHECK, because
-- a CHECK sees one row and the rule is about a set of rows. It has to be a
-- constraint trigger, and it has to be DEFERRABLE INITIALLY DEFERRED, because
-- while the first entry of a pair is being inserted the transaction is halfway
-- written and does not balance yet.
--
-- Deferred means it runs at COMMIT. If it fails, the whole transaction is
-- rolled back, so an unbalanced transfer leaves no transaction row and no
-- entries: there is nothing to clean up afterwards, which is the property a
-- test should assert.

create or replace function assert_transaction_balances() returns trigger
language plpgsql as $$
declare
    imbalance bigint;
begin
    select coalesce(sum(amount_minor), 0)
      into imbalance
      from entries
     where transaction_id = coalesce(new.transaction_id, old.transaction_id);

    if imbalance <> 0 then
        raise exception
            'transaction % does not balance: entries sum to %',
            coalesce(new.transaction_id, old.transaction_id), imbalance
            using errcode = 'check_violation';
    end if;

    return null;
end;
$$;

create constraint trigger entries_must_balance
    after insert or update or delete on entries
    deferrable initially deferred
    for each row
    execute function assert_transaction_balances();

-- A transaction with no entries at all is also not a transaction. This one can
-- be deferred too, and it catches the case where code opens a transaction row
-- and then fails before writing any movements.
create or replace function assert_transaction_has_entries() returns trigger
language plpgsql as $$
begin
    if not exists (select 1 from entries where transaction_id = new.id) then
        raise exception 'transaction % has no entries', new.id
            using errcode = 'check_violation';
    end if;
    return null;
end;
$$;

create constraint trigger transactions_must_have_entries
    after insert on transactions
    deferrable initially deferred
    for each row
    execute function assert_transaction_has_entries();
