# The two minute video

**Not recorded.** A video cannot be written into a repository, and this is the
shot list and the script for the one the level asks for. It is here because the
plan is most of the work: the recordings that go wrong are the ones made without
one.

Two minutes, no slides, no face, no music. A terminal and a browser. The rule that
makes it watchable: **every claim is on screen while it is spoken.**

## The shot list

| Time | On screen | Said |
|---|---|---|
| 0:00 | `ARCHITECTURE.md` diagram | "Six services. A payment goes through the gateway, the vault, the ledger and an event stream, and a worker pays the merchant." |
| 0:12 | `python seed.py`, running | "One command starts it and takes a payment end to end. The card number goes into one service and comes back as a token." |
| 0:28 | The output, with `ledger total 0` highlighted | "The ledger balances. That is checked on every transaction, and nothing can write an unbalanced one." |
| 0:40 | `python -m bench.load --minutes 60` output | "An hour at fifty payments a second. p50 and p99, and goodput rather than throughput, because a response after the caller gave up is not a success." |
| 0:58 | `python -m chaos.scenarios`, first block | "Now the database goes away under load. Every payment is refused within a millisecond, nothing is half written, and the alert fires in twenty seven." |
| 1:15 | The bank scenario block | "The bank stops answering. Payouts go to unknown rather than failed, and the sweeper resolves every one by asking the bank about a reference that existed before the first attempt." |
| 1:32 | `reconciliation: zero breaks` | "After all four failures, the reconciliation is zero. That is the whole claim." |
| 1:42 | `python -m migrate.under_load` | "And a schema migration with traffic on it. Six deploys, eleven hundred requests, none failed." |
| 1:55 | The README's five results | "Every number here is a command in the repository." |

## What to say if it goes wrong while recording

Keep going and say what happened. A recording where the chaos runner finds a real
break and the narrator says "that is a genuine failure, here is what it means" is
more convincing than a clean take, and the temptation to re-record until it is
perfect is how a two minute video takes a day.

## What not to do

- No slides. The level says so and it is right: slides are what people make
  instead of running the thing.
- No music, no transitions, no logo. Two minutes is not enough time to spend four
  seconds on a title card.
- Do not read the README aloud. Show the commands and say what the output means.
- Do not apologise for the in process platform. State it once, in one sentence,
  and move on: "this runs in one process, and the decision record says what that
  does not prove."

## The single most important second

0:58, when the database is killed. That is the moment somebody watching decides
whether this is a demo or a system, and it works only because the terminal shows
the refusals and the alert time next to each other.
