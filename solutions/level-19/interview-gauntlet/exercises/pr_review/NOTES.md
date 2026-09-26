# Submission note: the pull request review

Forty minutes, which is longer than a review of 68 lines should take and about
right for a review of 68 lines of payments code.

## How I read it

1. **The migration first.** It is the only part of the diff that cannot be
   reverted by reverting the diff, so it gets read before anything else.
2. **Then anything touching money.** The fee calculation and the ledger call.
3. **Then anything touching card data.** One grep for `card`, `pan`, and the log
   lines.
4. **Then the infrastructure.** A one line IAM change is where the worst
   permissions come from.
5. **Then performance.** The query per payment and the metric label, both of which
   are real and neither of which is an outage today.

That order is deliberate: irreversible, then wrong money, then leaked data, then
privileges, then speed.

## What I skipped commenting on, deliberately

- Naming, formatting and import order. A linter's job, and comments about them
  crowd out the six that matter.
- The `BackgroundTasks` style, beyond the durability point. It is a reasonable
  instinct for a first version.
- My preference for returning results over raising. Not this pull request.

Ten comments is already a lot. If I had found twenty, I would have written the six
blocking ones and asked for a conversation, because nobody reads a review with
twenty comments on it. They survive it.

## What I would do next, with more time

Reproduce comment 1 in a test and attach it. "This is a float" is an argument, and
a failing test showing the trial balance off by 0.004 is not.
