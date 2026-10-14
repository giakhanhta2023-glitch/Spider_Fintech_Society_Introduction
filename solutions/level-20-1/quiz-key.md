# Level 20.1: Ruby, and the rules that change every week: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **D** |
| 3 | **A** |
| 4 | **C** |
| 5 | **B** |
| 6 | **A** |
| 7 | **C** |
| 8 | **D** |
| 9 | **B** |
| 10 | **A** |
| 11 | **C** |
| 12 | **D** |
| 13 | **A** |
| 14 | **B** |
| 15 | **C** |

---

### 1. Why would a payments company run its core API on Ruby rather than Go?

- A. Ruby is faster for IO bound work
- **B. Because the expensive resource is how quickly a business rule can be read and changed, and the core is mostly waiting on other systems anyway** ✅
- C. Ruby uses less memory per request
- D. Go cannot talk to Postgres

**Why:** Pick per workload. The same company writes Go for the webhook sender, where throughput is the whole job.

### 2. In Ruby, which of these is falsey?

- A. `0`
- B. `""`
- C. `[]`
- **D. `nil`** ✅

**Why:** Only `nil` and `false`. A guard written the Python way lets a zero amount straight through.

### 3. What does `yield` do inside a method?

- **A. Runs the block the caller passed in** ✅
- B. Returns a value and pauses, like a Python generator
- C. Hands control to another thread
- D. Declares the method takes a block

**Why:** Ruby has `Enumerator` for the generator idea. `yield` is simply "run the block I was given".

### 4. Why does a rule store its condition as a block rather than evaluating it at definition time?

- A. Blocks are faster than method calls
- B. To avoid a circular import
- **C. Because the condition is written now and run later, against a payment that does not exist yet** ✅
- D. Because Ruby cannot evaluate a condition outside a method

**Why:** The whole policy is defined at load, and runs thousands of times afterwards against payments nobody has seen.

### 5. What does `instance_eval` change about the block it is given?

- A. It makes the block run in a new thread
- **B. It changes `self`, so the block can call the target object's methods with no receiver** ✅
- C. It copies the block so the original cannot be mutated
- D. It defers the block until the object is frozen

**Why:** That is the entire mechanism behind Rails routes, RSpec, a Gemfile, and this policy.

### 6. What is the real cost of building a DSL with `instance_eval`?

- **A. `self` is not what the surrounding file says, so errors name unfamiliar classes and editors cannot complete the vocabulary** ✅
- B. It is significantly slower at run time
- C. It prevents the object from being frozen
- D. It only works at the top level of a file

**Why:** Worth paying for a file of business rules read by non programmers. Not worth paying anywhere else.

### 7. Money as whole cents in a Ruby `Integer` is exact up to what?

- A. 2^53, as in JavaScript
- B. 2^63, then it wraps negative
- **C. There is no limit. `Integer` is arbitrary precision** ✅
- D. 2^31 on a 32 bit build

**Why:** A genuine advantage over level 10.1 and level 18, and it removes an overflow check that was catching other mistakes.

### 8. Why must `Money#<=>` raise when the currencies differ, rather than return false?

- A. Because Comparable requires an exception
- B. To make the error message nicer
- C. Because false would sort EUR before USD
- **D. Because comparing 50 EUR with 200 USD is meaningless rather than false, and guessing an answer hides the bug** ✅

**Why:** And the raise is what the engine then has to handle, which is the last section of this level.

### 9. The engine evaluates every rule instead of stopping at the first refusal. Why?

- A. Rules may depend on each other
- **B. So a refund that breaks three rules reports three, instead of support asking the customer to fix one thing at a time, three times** ✅
- C. To make the timing predictable
- D. Because `filter_map` cannot stop early

**Why:** The cost is that a rule can now be reached with data it cannot handle, which is why fail closed matters.

### 10. A rule raises an exception. What should the engine do?

- **A. Record a refusal naming the rule and carrying the error** ✅
- B. Skip that rule and decide on the others
- C. Let the exception propagate and fail the request
- D. Retry the rule three times

**Why:** Skipping is the dangerous one: a check that was skipped looks exactly like a check that passed, and the money leaves.

### 11. What does "fail closed" mean, and when is it wrong?

- A. Close the connection on error; wrong for long lived sockets
- B. Stop the process on error; wrong in a web server
- **C. When the decider is broken the answer is no; wrong where a false no is costlier than a false yes, like declining real cards during an outage** ✅
- D. Roll back the transaction; wrong when there is no transaction

**Why:** Refunds are money leaving, so a wrong yes is expensive and a wrong no is an apology. Authorisations are the other way round.

### 12. Why does the policy keep thresholds in a per currency table rather than writing `money("500.00")` inside the rule?

- A. It is easier to read
- B. It avoids parsing on every decision
- C. Hashes are faster than string parsing
- **D. `"500.00"` is parsed in whatever currency the payment is in, and it is not a yen amount at all** ✅

**Why:** And separately, 500 of one currency is simply not 500 of another, which the table states out loud.

### 13. Why does `valid!` run when a rule is defined rather than when it is evaluated?

- **A. So a rule missing its reason stops the file loading, instead of failing later with a customer waiting** ✅
- B. Because conditions cannot be inspected at run time
- C. To let the JIT optimise the block
- D. Because `freeze` would otherwise fail

**Why:** The same argument as a type error at build time rather than at 3am. Push the failure as early as it will go.

### 14. The demo prints "rules never exercised". Why is that worth printing?

- A. It measures test coverage of the engine
- **B. A rule nothing can reach is dead policy nobody has checked, and policy files quietly accumulate them** ✅
- C. It shows which rules are slowest
- D. It is required for the audit

**Why:** A threshold from two years ago that no current payment can reach still looks like a working control in a review.

### 15. What is the third outcome, besides allow and refuse?

- A. Retry
- B. Defer
- **C. Review, where a person decides, and where most real policy time goes** ✅
- D. Partial

**Why:** A policy with only two answers pushes every borderline case into one of them, and both choices are wrong often enough to matter.
