# Four workloads, four stores, one reason each

The interview question behind "relational and NoSQL databases" is never which
is better. It is **which access pattern you have**, because that is what
decides. Volume is the reason people think they need something else; the access
pattern is the reason they actually might.

Four workloads from this platform, and where each belongs.

## 1. The ledger: **Postgres**, and it is not close

The invariant is that every transaction's entries sum to zero. That is a
constraint I want the database to enforce rather than one I hope my code
maintains, and level 6 enforces it with a deferred constraint trigger that
refuses the write at commit.

No wide column store can express it. DynamoDB has transactions across a limited
number of items and conditional writes, so it is not incapable, but nothing in
it can say "these rows must sum to zero", and I would be reimplementing
constraints in application code that the database already does correctly.

The storage arithmetic settles the scale argument before it starts: 130 million
payments a month at about 1.5 kB each is 195 GB a month and **2.3 TB a year**,
which fits on one machine for years. The write throughput was never the
constraint, so trading away constraints to gain it is paying a real price for
nothing.

## 2. The rate limiter: **Redis**

Counters, hot, small, and losable. A rate limiter that forgets its counters
during a failover lets through a few extra requests for a few seconds, which is
a shrug. A rate limiter in Postgres is a single hot row that every request
updates, and level 8 is thirty pages on what happens next.

The rule that keeps this safe: **everything in Redis must be losable.** If
losing a key costs money, it belongs in Postgres. Counters qualify; balances do
not.

## 3. The token lookup: **a wide column store**, honestly

This is the one where the usual answer is wrong. Level 15's vault maps a token
to an encrypted card number: one key, one value, billions of times, with no
cross row invariant and no query that is not "give me this key".

That is a DynamoDB shaped problem, and putting it in the main Postgres because
that is where everything else lives is its own mistake. It is the highest
volume lookup in the platform, it has no relationships, and it would be a table
that only ever grows sitting next to the ledger competing for the same buffer
cache.

The same reasoning covers idempotency key storage, session state, and device
fingerprint history.

## 4. The analytics copy: **a column store**, fed by change data capture

Counting and summing over hundreds of millions of rows, a few columns at a
time, with no single row writes. That is what a column store is for, and asking
the transactional database to do it means analytics queries competing with
payments for the same resources at month end, which is exactly when both matter
most.

It is fed by the change data capture from level 13 rather than by the outbox
from level 11, and that distinction is the rule of thumb worth remembering:
**outbox for things that react, change data capture for things that copy.** A
warehouse wants a current copy of your tables. A service that needs to know a
payment was captured wants your event.

## The answer that loses the interview

"We would use DynamoDB for the ledger, for scale."

It is wrong on the mechanism, because nothing enforces that every transaction
balances. It is wrong on the arithmetic, because a few terabytes a year does
not need it. And it is wrong on the shape of the question, because a ledger is
defined by its invariants and a store with no invariants is not a ledger, it is
a list of numbers that usually agree.
