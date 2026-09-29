# three-statement

Fifteen months of forecast from the September balance sheet, in four scenarios.
**Sixty forecast months, and every one of them balances to the cent.**

```bash
python -m model.forecast                      # the base case
python -m model.forecast --scenario stress    # the one that needs the facility
python -m model.sensitivity                   # twenty models, as one table
pytest -q                                     # 14 tests, under a second
```

## The four cases

| Case | FY2026 revenue | FY2026 EBITDA | Margin | Revolver drawn | Peak drawn |
|---|---|---|---|---|---|
| base | 49.0m | 9.5m | 19.3% | never | 0 |
| upside | 52.6m | 11.6m | 22.0% | never | 0 |
| downside | 42.7m | 5.2m | 12.1% | never | 0 |
| **stress** | 36.6m | 0.4m | 1.2% | **September 2026** | **1,001,355** |

The stress case is the one the model exists for. A large merchant leaves, pricing
is conceded to keep the next one, the merchants that stay pay two weeks later, and
hiring carries on because it was approved last year. Not one of those is dramatic
on its own. Together they take EBITDA to 1.2% and put the company on its facility
eleven months out.

## What makes it a model rather than a spreadsheet of hopes

**Cash is an output.** The most common error in a first model is to forecast cash
and then wonder why the balance sheet will not balance. Here cash is the closing
line of the cash flow statement, and `test_cash_is_the_closing_line_of_the_cash_flow`
asserts it every month of every scenario. The balance sheet is then an identity
rather than a hope.

**Every driver says where it came from.** `drivers.py` holds each assumption with
its evidence, and three of them are marked as judgements rather than measurements:

```
take_rate       0.0058    judgement   the last twelve months of actual transaction
                                      fees over actual volume. The plan assumed
                                      0.62% and the business has not run at that
                                      since January
dso_days        38        measured    receivables over revenue, times days,
                                      unchanged across the history
minimum_cash    5,000,000 judgement   the board's stated floor, which is what makes
                                      the revolver draw
```

`test_every_driver_says_where_it_came_from` fails if any driver has a blank source.
A model that cannot separate its facts from its opinions gets believed too much.

**Scenarios are multiples of the base, not retyped models.** `base.scaled("stress",
take_rate=0.85, dso_days=1.55, ...)` means a correction to a measured driver flows
into all four cases, and the only difference between them stays the thing being
varied. Four separate spreadsheets drift apart in the second month.

**The circular reference is solved and counted.** A revolver draw costs interest,
interest costs cash, less cash means a bigger draw. Excel solves this with an
iterative calculation checkbox most people never find, and silently reports a
stale number when it does not converge. Here it is a loop that runs until the draw
stops moving, capped at 50 passes:

```
balance sheet ties in every month, worst case 5 passes to resolve the circularity
```

Five, in the stress case. `test_the_circularity_converges_and_does_not_just_stop`
asserts both that it iterates at all, because a case that never loops proves
nothing, and that it never hits the cap.

## The sensitivity table, and the finding in it

```
FY2026 EBITDA, by take rate and monthly volume growth

   growth            0.50%        0.54%        0.58%        0.62%        0.66%
    -0.50%            1.6m         3.4m         5.3m         7.2m         9.0m
     0.50%            2.7m         4.7m         6.7m         8.8m        10.8m
     2.15%            4.7m         7.1m         9.5m        11.8m        14.2m
     3.00%            5.9m         8.5m        11.0m        13.6m        16.2m
```

Twenty full fifteen month models, all balancing, in about a second.

Read across and then down. **Sixteen basis points of take rate is worth more than
three and a half points of monthly volume growth**: 0.50% to 0.66% at the base
growth rate moves FY2026 EBITDA from 4.7m to 14.2m, while moving growth from
-0.5% to 3.0% at the base rate moves it from 5.3m to 11.0m. The company argues
about volume in every sales meeting and about pricing almost never, and the table
says that is the wrong way round.

That is the entire purpose of a sensitivity table: not to widen the forecast into
a range, but to say which argument is worth having.

## What is not here

- **No Excel file.** The model is Python because that is what can be tested, and
  the identities in `tests/` are worth more than a workbook that has never been
  checked. A real job will want it in Excel, and the structure transfers: inputs
  with sources, one calculation block, outputs that read from it.
- **No terminal value, no valuation.** This forecasts the business, and stops. A
  DCF on top of a fifteen month forecast would be a spreadsheet exercise in
  compounding an opinion.
- **No revenue by merchant.** The forecast drives revenue from volume and take
  rate, which is how the business is managed. Forecasting 235 merchants
  individually would be more detailed and no more accurate.

---

Part of [FinQuest](../../../README.md), analyst track, level 04.
