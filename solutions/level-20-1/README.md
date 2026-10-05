# Level 20.1: Ruby, and the rules that change every week

> **A refund policy a risk lead can read** · build project · difficulty 6/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Every payments company has a file that decides who gets their money back, it changes most weeks, and the people who change it are not all engineers. Build that file as a small language of its own: rules that read as sentences, every decision explained well enough to show the customer, all rules evaluated rather than the first failure, and an engine that holds a refund rather than approving one when something is broken.

**Scope:** Uses levels 4 and 9 for the ledger and the card lifecycle. Ruby 3.1 or later and minitest, which ships with Ruby. No Rails, no gems, no database. **This is the only Ruby in the course** and it is an aside rather than a rung, so nothing later depends on it. It is here because Stripe, Shopify and GitHub run on Ruby and the track had none.

## Files here

| File | What it is |
|------|------------|
| `refund-policy/lib/refunds/money.rb` | frozen, currency aware, and raising rather than guessing |
| `refund-policy/lib/refunds/policy.rb` | the DSL, the context a rule runs against, and the engine |
| `refund-policy/lib/refunds/rules.rb` | the policy itself: the file that is actually the deliverable |
| `refund-policy/test/test_refunds.rb` | 30 tests, 87 assertions |
| `refund-policy/demo.rb` | fifteen requests, every rule exercised at least once |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
cd refund-policy && ruby -Ilib -Itest test/test_refunds.rb && ruby -Ilib demo.rb
```

## Why the solution is shaped this way

- The DSL is two nested instance_eval calls and nothing more exotic. The outer one lets the policy block say `rule` with no receiver; the inner one lets each rule block say `because` and `refuse_when`. Every configuration block you have seen in Ruby, in Rails routes, in RSpec, in a Gemfile, is this.
- `valid!` runs when a rule is defined rather than when it is evaluated, so a rule with no reason stops the file loading instead of failing on a Tuesday with a customer waiting. A rule that cannot explain itself never reaches production.
- Every rule is evaluated on every decision rather than stopping at the first refusal. `pay_14` in the demo breaks six rules and reports six. The boolean version of this policy would have returned false. Support asking a customer to fix one thing at a time, three times, is how a two minute job becomes a week.
- A rule that raises becomes a refusal carrying the error, never a skip. Skipping is the dangerous one, because a check that was skipped looks exactly like a check that passed, and the money leaves. Fail closed is right here specifically because a wrong yes costs money and a wrong no costs an apology; on a card authorisation the trade runs the other way.
- Two bugs were found by running this rather than by reading it, and both are in the tests now. Evaluating every rule meant a currency mismatch still reached the amount comparison, and `Money#<=>` raises on mixed currencies, so the engine crashed instead of refusing. And the review thresholds were written as `money("500.00")` inside the rules, which parses in whatever currency the payment is in: `"500.00"` is not a yen amount, so an ordinary yen refund was held by a rule that could not run. The thresholds are a per currency table now, which is also the honest statement that 500 of one currency is not 500 of another.
- The demo prints the rules that never fired. A rule nothing can reach is dead policy nobody has checked, and a threshold from two years ago that no current payment can reach still looks like a working control in a review.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| `if balance` lets a zero through | Only `nil` and `false` are falsey in Ruby. `0` is true, `""` is true, `[]` is true. This is the first thing that bites a Python programmer here. |
| `undefined method` naming a class you did not write | You are inside an `instance_eval` block, so `self` is the builder rather than the enclosing object. That is the cost of the DSL, and it is why it is worth paying only for a file somebody else reads. |
| A yen amount raises from a line nobody touched | A default like `refunded: "0.00"` is not a legal JPY amount. Use `Money.zero(currency)`, which knows how many decimal places the currency has. |
| Two rules with the same name and only one ever reported | A copy and paste that survives review because both halves look right. The builder rejects duplicates for this reason. |

## Self-checks the solution satisfies

- Money.parse("12.99").cents == 1299 and Money.parse("1299", "JPY").cents == 1299
- Money.parse("12.99", "JPY") raises, naming the number of decimal places
- Money.parse("1.00", "USD") + Money.parse("1.00", "EUR") raises
- A Money built with 10**20 cents adds correctly: Integer does not run out
- A rule defined without because() raises at definition time, naming the rule
- A duplicate rule name raises
- An ordinary partial refund inside the window is allowed, with no findings
- A refund of exactly what remains is allowed; one cent more is refused
- A capture 120 days ago is not refused by the window rule; 121 days is
- A payment in an unconfigured currency is refused, and the reason names the currency
- A request breaking three rules returns three findings
- A refusal and a review together is a refusal
- A policy whose only rule raises returns a refusal whose reason contains the error
- Every rule in the shipped policy has a reason longer than twenty characters

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The rules read as rules | Somebody who does not write Ruby can read the policy file and tell you what it does. |
| 20 | Every decision explains itself | Every refusal and review carries a sentence that could be shown to the customer. No rule can load without one. |
| 20 | Fail closed | A rule that raises refuses rather than being skipped, and a test proves it. |
| 15 | All findings, not the first | A request breaking three rules reports three. |
| 10 | Money | Frozen, whole minor units, currency aware, and raising rather than guessing on a mismatch. |
| 10 | The day | Fifteen requests, every rule exercised, and the unexercised list printed. |

---

Part of [FinQuest](../../README.md) · Level 20.1
