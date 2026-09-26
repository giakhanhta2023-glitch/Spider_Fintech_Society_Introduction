# Review: "add fees to payments"

Approving reviewers are not the audience for this. The author is, and they are
going to read it at four in the afternoon, so the comments are ordered by what
would hurt and each one says what to do rather than only what is wrong.

Two things before the list, because tone is part of the exercise. The change does
what it says, the background task is a good instinct, and the migration being a
separate file at all is better than most first attempts. None of that makes the
blocking comments negotiable.

## Blocking

**1. `payments/api.py:15` The fee is a float, and it is money.**

```python
FEE_RATE = 0.029
fee = body.amount_minor * FEE_RATE
```

`1999 * 0.029` is `57.971000000000004`, and it is then subtracted from an integer
amount, so the ledger receives a float. Every downstream sum inherits it and the
trial balance stops balancing by fractions of a cent that nobody can find.

Use integer arithmetic with an explicit rounding mode:

```python
FEE_BASIS_POINTS = 290
fee_minor = (amount_minor * FEE_BASIS_POINTS + 5_000) // 10_000   # half up
```

**2. `payments/api.py:18` The card number is logged.**

```python
log.info(f"took payment {payment.id} for card {card} fee {fee}")
```

That is a PAN in the log aggregator, replicated, retained, and indexed. It is the
single most expensive line in the diff: it puts the log platform in PCI scope and
it is a reportable incident if it reaches production.

Log the token, the BIN and the last four. There is an allowlist logger for exactly
this, and adding the field to the allowlist is not the fix.

**3. `payments/api.py:17` The PAN is being stored in the ledger.**

```python
payment = ledger.record(..., pan=card)
```

The vault exists so that one service holds card numbers. This puts them in the
ledger, its read replica, the reporting warehouse and every backup of all three.
Pass the token from the vault instead.

**4. `payments/api.py:17` The fee is subtracted from the amount recorded.**

The ledger now records net rather than gross, so the amount in our system no
longer matches the amount the customer was charged or the amount the processor
will settle. Reconciliation will break on every row.

The fee is its own entry. Gross in, fee out, and both sum to zero, which is the
double entry rule the ledger already enforces everywhere else.

**5. `infra/iam.tf:10` `s3:*` on `*`.**

```hcl
actions   = ["s3:*"]
resources = ["*"]
```

This grants the task read and write and delete on every bucket in the account,
including the state bucket and other teams' data. If the change needs `PutObject`,
add `PutObject` on the one bucket prefix. If it does not, this is a revert.

**6. `migrations/014_add_fee.sql` Three statements, and all three are hazards.**

```sql
alter table payments add column fee_minor bigint not null default 0;
update payments set fee_minor = amount_minor * 0.029;
alter table payments drop column legacy_fee;
```

- `not null default 0` on a large table: on PostgreSQL 11+ the default itself is
  metadata only, and the `not null` still requires validating every row under an
  `ACCESS EXCLUSIVE` lock. On the payments table that is an outage.
- The `update` is one statement over every row: one transaction, one lock, the
  whole table rewritten, and not resumable. In batches of ten thousand the lock is
  held for milliseconds at a time. Measured on 415,554 rows: 5,622 ms in one
  statement against a longest single lock of 280 ms in batches.
- `0.029` again, this time in SQL, so the backfill and the application disagree
  about halves of cents. Use integer arithmetic here too.
- `drop column legacy_fee` in the same migration as the code change means the
  rollback of this deploy leaves code reading a column that no longer exists. Drop
  it days later, in its own migration, once nothing reads it.

## Worth fixing before merge

**7. `payments/reporting.py:33` A query per payment.**

```python
for row in rows:
    refunds = db.query("select * from refunds where payment_id = %s", row["id"])
```

For a merchant with 40,000 payments that is 40,001 queries. One query with a join,
or one `where payment_id = any(%s)` and a group by in Python. Measured shape from
the same lesson: filtering per group took 12,723 ms against 123 ms for one pass, a
factor of 104.

**8. `payments/reporting.py:37` `merchant_id` as a metric tag.**

```python
metrics.gauge("merchant_total", total, tags={"merchant_id": merchant_id})
```

One time series per merchant, forever. At 500 merchants that is 500 series for one
gauge and it multiplies with every other label. Measured: 200,000 series cost
203.8 MB and a 15.7 second scrape against a 15 second interval, at which point the
monitoring is the outage. This belongs in a log line or a database query.

**9. `payments/api.py:19` The background task can be lost.**

`background.add_task` runs after the response and dies with the process. If
notifying the merchant matters, it needs the outbox: same transaction as the
payment, delivered by a separate worker. If it does not matter, say so in a
comment so the next person does not have to guess.

**10. `select *` in both queries.** It returns columns the code does not use,
breaks when a column is added, and prevents an index only scan.

## Questions rather than objections

- Is 2.9% every merchant, or is a negotiated rate coming? If it is coming, the
  constant is the wrong shape and now is the cheap time to change it.
- Is `fee_minor` derived or stored? If it is derived from the rate at the time of
  the payment, the rate has to be stored with the payment, or last year's
  statements change when the rate does.

## What I would say in person

The two card number comments are the ones I would rather say out loud than write,
because a written comment about a PAN in a log reads as an accusation and it is
not one. It is the single most common mistake in payments code and it is why the
allowlist logger exists.
