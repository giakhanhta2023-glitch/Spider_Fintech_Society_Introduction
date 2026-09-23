# race-lab

Eight requests, one balance, and a bug that reads like the business rule.

```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql://localhost/race_lab
python -m race.setup
python -m race --mode naive         # watch it overdraw
python -m race --mode row_lock      # and then not
python -m race.pool_bench
pytest                              # skipped without DATABASE_URL, on purpose
```

## The bug

```python
balance = select balance from accounts where id = 1     # both read 10,000
if balance >= amount:                                   # both say yes
    update accounts set balance = balance - amount      # both write 9,000
```

Two workers, one spend recorded, two spends made. Nothing in that code looks
wrong, which is why it is the version everybody writes first.

Measured with eight workers each spending 1,000 from a starting balance of
10,000, against a hosted Postgres:

| Mode | Succeeded | Final balance | Correct? |
|---|---|---|---|
| `naive` | 8 | **7,000** | No: eight spends of 1,000 recorded as 3,000 |
| `row_lock` | 8 | 2,000 | Yes |
| `optimistic` | 8 | 2,000 | Yes |
| `serializable` | 8 | 2,000 | Yes |

The naive row is the level's title: the balance ends 5,000 higher than the
money that actually left, because five of the eight writes were made against a
value that another worker had already replaced.

**The rig is the part people get wrong.** Every worker opens its connection
*before* the barrier. Connect after it, and the first worker is committing
while the eighth is still doing a TLS handshake: the window never overlaps, the
naive mode passes, and you have built a test that produces confidence instead
of information.

## Three fixes, and when each is right

| | How | Cost | Use when |
|---|---|---|---|
| **Row lock** | `select ... for update`, then decide | Workers queue on the hot row | The default for money. One account, one spend at a time, is a trade you want |
| **Optimistic** | A `version` column; write only if it has not moved | Retries, and wasted work under contention | Conflicts are rare. Degrades badly on one hot row |
| **Serializable** | `set transaction isolation level serializable` and retry on `40001` | Every transaction may fail and must be retried | Complex invariants across several rows, where a lock is hard to place |

**The choice for this service is the row lock**, and the defence is that the
contended object is one account balance. The whole question is "can two people
spend the same money", the answer has to be no, and serialising access to one
row is the cheapest way to say no that does not require every caller to
implement a retry loop correctly. Optimistic locking is the right answer when
the conflict is rare, and a balance on a busy merchant is exactly where it is
not rare. Serializable is the right answer when the invariant spans rows, and
here it does not.

All three were paired with the constraint below, which is not optional.

## The measurement that surprised me

`serializable` has to be set on the **transaction**, not the session. Against a
pooled connection:

```
set session characteristics as transaction isolation level serializable;
select current_setting('transaction_isolation');   ->  read committed
```

Nothing failed. Nothing warned. `application_name` on that backend was
`pgbouncer`: the pooler hands the next statement to a different backend, so the
session setting went to a connection that was then handed back to the pool.
Code that believes it is serialisable and is not will pass every test that does
not check, and the lost update it was supposed to prevent comes back.

So `serializable()` reads the level back **from inside its own transaction** and
returns it, and a test asserts it. That is requirement 6, and it exists because
this is a real trap rather than a hypothetical one.

## The constraint is not a fix, and you still want it

```sql
alter table accounts add constraint balance_never_negative check (balance_minor >= 0);
```

Verified: `update accounts set balance_minor = balance_minor - 99999` is
refused, and the balance stays where it was.

This does not stop the race. Two workers still both believe they succeeded, and
the recorded balance is still wrong by one spend. What it stops is the
consequence reaching the database, because a check constraint is evaluated
against the row as it actually is at write time, not against what the
application read a moment ago.

Pair it with whichever fix you chose. The fix stops the race you thought of;
the constraint stops the one you did not.

## The pool

`python -m race.pool_bench` runs the same workload three ways and reports p50,
p95, throughput, and separately **the time spent waiting for a connection**.

That last column is the one that is usually missing, and without it a too-small
pool looks exactly like a slow database. The query time is unchanged; the
request is queueing before the query starts. Teams spend weeks optimising a
query that was never slow.

The arithmetic to do before tuning anything, from `api_guard.py`:

```
max_size x instances   <   the database's max_connections, with room left over
max_size / query time  =   requests per second one instance can serve

8 x 6 instances = 48 connections against a Postgres allowing 100
8 / 0.004 s = 2,000 req/s per instance
```

Connecting is not free, which is the whole reason the pool exists. Measured in
level 7 against the same hosted database: a new connection per query took a
median of **63.259 ms** against **1.365 ms** on a connection already open.

## Wired into the API

Two failures, two answers, and telling them apart is the job:

| What happened | Status | Why |
|---|---|---|
| The customer does not have the money | `422 insufficient_funds` | Their problem, permanent, retrying will not help |
| No connection was free | `503` with `Retry-After` | Our problem, temporary, retrying is exactly right |

Returning 500 for the second tells the caller to give up when they should come
back in a second. Hanging until the pool frees is worse: the caller times out
with no information, and the request keeps a slot after nobody is waiting for
it.

## What was verified where

Being precise about this, because the difference matters.

**Verified directly against Postgres 18 while writing this:** the optimistic
mechanism (a stale write updates 0 rows, balance 9,000, version 1), the check
constraint refusing an overdraw, and the pooler discarding a session level
isolation setting (`read committed` immediately after setting `serializable`,
`application_name = pgbouncer`).

**Measured earlier in the same lab, against the same database:** the four mode
results in the table above, and the connection cost.

**Written and not executed here:** the threaded rig needs a connection string
on the machine running it, which this environment would not permit. Run
`pytest` with `DATABASE_URL` set and it exercises all ten of the level's tests;
they skip rather than pass when it is unset, because a concurrency test that
silently does not run is worse than one that fails.

## Limitations

- One account, one currency. The interesting case is contention on one row, and
  adding more rows makes the bug harder to reproduce rather than more realistic.
- `pool_bench` needs a database you do not mind loading, and it will open a
  connection per request in the first configuration on purpose.
- The serializable mode retries up to ten times and then gives up. A real
  service needs a budget across all requests, not per request, which is level 14.
