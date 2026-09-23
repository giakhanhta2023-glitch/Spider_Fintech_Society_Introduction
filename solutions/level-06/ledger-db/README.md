# ledger-db

A double-entry ledger in Postgres, where every rule that can be a constraint is
a constraint, and the query plans are measured rather than assumed.

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql://localhost/ledger
python -m ledger.migrate      # applies each file once, forward only
python -m ledger.seed         # 2,000 accounts, 400,000 balanced entries
python -m ledger.bench        # the three plans below
python -m ledger.reconcile    # exits non-zero if the cache ever disagrees
python -m ledger.statement 137
```

## The schema

Three tables. `accounts` holds a cached balance, `transactions` holds one
business event with the idempotency key on it, and `entries` holds the
movements. Entries are append only: nothing in this project updates or deletes
one.

What the database refuses, so that application code does not have to remember:

| Rule | Enforced by |
|---|---|
| An entry cannot be zero | `check (amount_minor <> 0)` |
| An entry cannot name an account that does not exist | Foreign key |
| The same idempotency key cannot create two transactions | Unique index |
| A transaction's entries must sum to zero | Deferred constraint trigger |
| The cached balance must follow every entry | `AFTER INSERT` trigger, same transaction |

The balance rule has to be a trigger rather than a `CHECK`, because a `CHECK`
sees one row and the rule is about a set of rows. It has to be
`DEFERRABLE INITIALLY DEFERRED`, because halfway through writing a transfer the
transaction genuinely does not balance yet. Deferred means it runs at `COMMIT`,
so a refusal rolls back the transaction row along with the entries.

Verified on Postgres 18, 398,003 entries:

```
insert an unbalanced transaction   ->  ERROR: transaction 2 does not balance:
                                              entries sum to 1000
transactions left behind by it     ->  0
entries left behind by it          ->  0
ledger total after                 ->  0
```

That last pair is the property worth testing. The failure leaves nothing to
clean up.

## The three plans

`select coalesce(sum(amount_minor), 0) from entries where account_id = 137`,
over 398,003 entries, 200 of which belong to that account. Warm cache, measured
with `EXPLAIN (ANALYZE, BUFFERS)`:

| Index | Plan | Buffers | Time |
|---|---|---|---|
| None | Parallel Seq Scan | 3,317 | 31.437 ms |
| `(account_id)` | Bitmap Heap Scan | 206 | 0.390 ms |
| `(account_id) include (amount_minor)` | **Index Only Scan**, `Heap Fetches: 0` | **6** | **0.118 ms** |

Without the index, Postgres reads every one of the 398,003 rows and throws away
397,803 of them: `Rows Removed by Filter: 132,601` per worker, across three
workers. The plain index finds the 200 rows through the index and then visits
200 heap blocks to read `amount_minor`. The covering index carries
`amount_minor` in the leaf, so the heap is never touched at all, which is what
`Heap Fetches: 0` means.

### What the covering index costs

| Index | Size |
|---|---|
| `entries` heap | 26 MB |
| `entries_pkey` | 9,192 kB |
| `entries_account_id_idx` | **2,688 kB** |
| `entries_account_covering_idx` | **12 MB** |

The plain index on `account_id` alone is small because each account appears
about 200 times and Postgres deduplicates runs of equal keys in the leaf pages.
Adding `amount_minor` makes every leaf entry distinct, deduplication stops
applying, and the index becomes four and a half times larger than the one it
replaces.

So the trade is: 34 times fewer buffers on the read, for four and a half times
the index size and a larger write cost on every insert. For a balance query on
a hot path that is worth it. For a query that runs twice a day it is not, and
the honest answer to "should I add a covering index" is to measure both.

## The cached balance

`accounts.balance_minor` is a cache of `sum(entries.amount_minor)`, maintained
by a trigger inside the same transaction as the entry. There is no window in
which an entry exists and the balance does not reflect it.

The entries remain the truth, and `reconcile.py` checks. Measured:

```
cached balance before a +500 entry   -64,000
cached balance after                 -63,500
accounts disagreeing with entries          0
```

And three independent routes to the same number for one account:

```
statement window function ends at   -63,500
cached balance                      -63,500
summed from entries                 -63,500
```

## Seeding, and the trigger that had to be turned off

The balanced check is a per-row deferred trigger, so loading 400,000 entries in
one transaction queues 400,000 checks to run at `COMMIT`, each summing its
transaction's entries. The seed disables it for the bulk load and then verifies
the result with two queries that are stronger than the checks it skipped: every
transaction sums to zero, and the ledger as a whole sums to zero. If either
fails, nothing is committed.

This is a real decision, not a shortcut, and it is the kind of thing worth
saying out loud in a review: the constraint protects the application's writes,
and a one-off bulk load verified afterwards is a different situation with a
different correct answer.

## What I would change at a hundred million rows

The schema above is fine to about ten million entries on one machine. Past
that, in the order I would do them:

1. **Partition `entries` by month**, and keep the same constraints on each
   partition. Retention then becomes dropping a partition rather than a delete
   that returns no disk, and every statement query is already filtered by date.
   Level 13 measures this: a month removed in 0.9 ms against 47.2 ms, with
   5,400 bytes of write ahead log against 2,947 kB.
2. **Reconsider the per-row balance trigger.** At high write rates it makes the
   `accounts` row a contention point, because every entry updates it and two
   transfers touching the same account serialise. The alternatives are a
   periodic rollup with the trigger removed, or moving hot accounts to a
   sharded counter. Level 8 is about exactly this contention.
3. **Split the covering index by recency.** Most balance queries are about the
   last few months, so a partial index on recent entries gives the same plan
   for a fraction of the size.
4. **Stop storing a cached balance at all** and store daily closing balances
   instead, with a statement computed as a closing balance plus the entries
   since. That is what a bank does, and it is the version that survives a
   hundred million rows without a hot row anywhere.

None of that is worth doing at 400,000 rows, and doing it early is how a schema
becomes unreadable for a problem nobody had.

## Limitations

- One currency per account, and no check that the entries of a transaction all
  share a currency. Adding it is a constraint, and the level 9 schema does.
- The balance trigger handles `INSERT` only, because entries are append only.
  If that rule is ever relaxed the trigger becomes wrong, and the right fix is
  to keep the rule.
- `bench.py` drops and recreates indexes, so do not point it at a database
  anybody is using.
