-- Deploy 3. Backfill the rows that existed before deploy 2.
--
-- In batches, with a bound, and resumable. Level 13 measured the difference on
-- 415,554 rows: one statement took 5,622 ms and held its lock for all of it;
-- batches of 10,000 took 5,980 ms and held the longest lock for 280 ms. The
-- total time is worse and the blast radius is twenty times smaller, which is the
-- trade worth taking every time.
--
-- The predicate is the resumability: `where fee_minor is null` means the job can
-- be killed at any point and restarted, and it does the same work either way.

do $$
declare
  updated integer;
  rounds  integer := 0;
begin
  loop
    update l17_payments
       set fee_minor = (amount_minor * fee_bps) / 10000
     where id in (
       select id from l17_payments
        where fee_minor is null
        limit 10000
     );

    get diagnostics updated = row_count;
    rounds := rounds + 1;
    exit when updated = 0;

    -- A real backfill commits between batches so nothing is held; a DO block
    -- cannot, which is why the production version of this is a script rather
    -- than a migration. The batching is the point either way.
    raise notice 'round %: % rows', rounds, updated;
  end loop;
end $$;

-- The check that decides whether deploy 4 may go out. Not a count of rows
-- updated, which says nothing: a count of rows still wrong.
select count(*) as rows_without_a_fee from l17_payments where fee_minor is null;
