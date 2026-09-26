# Submission note: the failing fee test

## How I found it

1. **Ran the tests first.** One failure, `fee_minor(1999)` expected 88 and got 87.
   A one cent difference is a rounding bug in almost every case, which narrowed it
   before I read the function.
2. **Read the failing function only.** Six lines. `int(amount_minor * PERCENT /
   100)` is the whole bug: `int()` truncates towards zero rather than rounding.
3. **Checked why the existing test passed.** It used 1000, where 2.9% is exactly
   29 and truncation and rounding agree. A test with round numbers cannot see this
   class of bug, which is worth saying in a review.

Eleven minutes, most of it in step 3, which is the step people skip.

## The fix

`Decimal` with an explicit `ROUND_HALF_UP`, rather than `round()`. Two reasons:

- `round()` in Python is banker's rounding, so `round(0.5)` is 0 and `round(1.5)`
  is 2. Correct for statistics, wrong for money, and surprising in a way that
  produces a support ticket every few thousand payments.
- The rounding mode is now written down in the code. Somebody reading it can see
  which way a half cent goes without running it, and a reviewer can disagree with
  the decision rather than with the arithmetic.

## What I skipped, and did not change on purpose

- **`fee_minor(0)` returns 30.** A zero amount payment carries the fixed fee,
  which is probably wrong and is a product decision. Changing it quietly inside a
  bug fix would be the wrong call: it is in this note instead, with a suggested
  answer of refusing zero amount payments at the boundary.
- **The rate constants.** They are in the module rather than in configuration,
  which will not survive the first merchant on a negotiated rate. Out of scope for
  a bug fix and worth a ticket.
- **The formatting of the file.** It is not the style I would have chosen and
  reformatting it inside a bug fix would bury the one line that matters in a
  diff nobody can read.

## What I would do next

A property test: for every amount from 1 to 100,000, the fee matches an
independently computed reference and the net plus the fee equals the amount. That
would have caught this on the first run, and it is four lines with Hypothesis,
which level 5 uses for exactly this.
