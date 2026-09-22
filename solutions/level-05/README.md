# Level 5: The money library everything else imports

> **moneykit: the library every later level imports** · build project · difficulty 5/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Write the money library that levels 6 to 20 will actually use. It has to be exact, it has to refuse to mix currencies, it has to split amounts without losing a cent, and somebody who has never spoken to you has to be able to install it from GitHub and use it. This is the first repository on your CV that a backend reviewer will open.

**Scope:** Uses levels 1 to 4 plus this level. The package itself depends on the standard library only: pytest, Hypothesis, mypy and ruff are development dependencies. No database, no network.

## Files here

| File | What it is |
|------|------------|
| `src/moneykit/currency.py` | Currency, the ISO 4217 exponents, and nothing else |
| `src/moneykit/money.py` | the frozen Money type: parse, format, arithmetic, comparisons |
| `src/moneykit/allocation.py` | allocate() by largest remainder |
| `tests/test_properties.py` | the Hypothesis properties, including conservation of money |
| `.github/workflows/ci.yml` | ruff, mypy --strict and pytest on a clean machine |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
pip install -e ".[dev]" && ruff check . && mypy src/moneykit --strict && pytest -q --cov=moneykit
```

## Why the solution is shaped this way

- Money and Currency are frozen dataclasses. Every operation returns a new value, so no two parts of a program can hold the same amount and disagree about it.
- Amounts are integer minor units everywhere they are stored or returned. Decimal appears only inside a calculation that has a fractional unit in the middle of it, and the result is quantized back to an integer before it leaves.
- The exponent lives on Currency, so nothing in the library divides by 100. That is what makes JPY and BHD work without a single special case.
- __add__ calls _same_currency first, so mixing currencies raises rather than producing a number. There is deliberately no __float__: an easy way out of the type would make every guarantee optional.
- allocate uses largest remainder: whole parts first, then the leftover units to whoever was cut by the most, ties broken by index so the result is deterministic. Refunds have to reverse the exact split that happened, which is impossible if the split is not repeatable.
- Rounding is an argument, never a default buried in the function. The caller states ROUND_HALF_UP or ROUND_HALF_EVEN, because the right answer depends on the tax rules, not on the library.
- Properties carry the weight: money is conserved under allocation, add and subtract undo each other, and format then parse round trips for every currency in the table. The example tests are there to document intent.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Shares do not add back to the total | Each share was rounded on its own. Take the whole parts with integer division and hand out the remainder afterwards. |
| `Decimal(2.675)` is not 2.675 | It was built from a float that was already wrong. Build from a string. |
| JPY prints as 10.00 instead of 1,000 | Something divided by 100 instead of by 10 ** exponent. |
| mypy passes locally, fails in the pipeline | A dependency is installed on your machine and missing from pyproject.toml. The clean machine is right. |
| Coverage is high and a bug shipped anyway | Coverage counts lines that ran, not assertions that checked. Add a property. |

## Self-checks the solution satisfies

- Money.parse("19.99", "USD").minor_units == 1999
- Money.parse("1000", "JPY").minor_units == 1000, and printing it shows 1,000 rather than 10.00
- Money.parse("19.999", "USD") raises InvalidAmount
- USD + EUR raises CurrencyMismatch, and so does comparing them
- allocate(10000, [1, 1, 1]) == [3334, 3333, 3333]
- allocate(5, [3, 7]) == [2, 3]
- allocate(1999, [1, 2, 3]) == [333, 666, 1000]
- Property: for any total and any weights, the shares sum exactly to the total
- Property: allocate is deterministic, the same inputs always give the same answer
- Property: (a + b) - b == a for any two amounts in one currency
- Property: Money.parse(str(m)) == m for every currency in the table
- 8.25% of $19.99 is $1.65, and the rounding rule is an argument the caller can see rather than a hidden default
- Converting $100.00 to VND at 25,480 gives 2,548,000 dong, and the result records the rate used
- mypy --strict, ruff and pytest all pass in the pipeline on a clean machine

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | Correct by construction | Immutable types, integer storage, Decimal only inside calculations, currency mixing impossible rather than unlikely. |
| 25 | Allocation and rounding | Largest remainder implemented and proved, rounding rules explicit arguments, the exponent respected everywhere. |
| 20 | Tested like money code | Examples plus at least five properties, with the shrunk failure from a deliberate bug shown in the README or a commit. |
| 15 | Shipped as a library | Editable install works from a clean clone, mypy --strict and ruff clean, pipeline green, semantic version and changelog. |
| 15 | Readable by a stranger | README understood in two minutes, typed public functions with docstrings, and an honest limitations section. |

---

Part of [FinQuest](../../README.md) · Level 5 of 10
