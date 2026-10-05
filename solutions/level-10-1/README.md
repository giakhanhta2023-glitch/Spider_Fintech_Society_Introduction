# Level 10.1: The half of the payment the customer can see

> **A checkout that cannot be talked into charging the wrong amount** · build project · difficulty 6/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

The payments API from levels 7 to 10 has never had a customer in front of it. Build the front half: a typed checkout that asks for a cart and is told the price, holds one idempotency key per attempt, handles the bank sending the customer away and back, and never claims a payment succeeded on its own authority. Everything runs locally against a small server you also write, because the browser is not allowed to hold your API key.

**Scope:** Uses levels 7, 8, 9 and 10. TypeScript 5 with `strict`, vitest, zod. No framework is required and no UI library is allowed: this is about the types and the state machine, not about components. **This is the only JavaScript in the course**, and it is an aside rather than a rung, so level 11 opens on level 10 whether you do this or not. The card form is a fake tokeniser with the shape of a real one, because a tutorial that teaches you to collect card numbers is teaching you a habit that gets people fired.

## Files here

| File | What it is |
|------|------------|
| `checkout-client/src/money.ts` | a branded Cents a plain number cannot pass for |
| `checkout-client/src/api.ts` | zod schemas, parsed at the boundary, and the level 7 request id |
| `checkout-client/src/idempotency.ts` | one key per attempt, surviving a reload |
| `checkout-client/src/checkout.ts` | five states, an exhaustiveness check, and the backoff poller |
| `checkout-client/tests/checkout.test.ts` | 20 tests, two of which are compile errors |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
cd checkout-client && npm install && npm run typecheck && npm test
```

## Why the solution is shaped this way

- The branded `Cents` costs nothing at run time. It compiles to a plain number, and the object in the type is never created. All it buys is the compiler refusing when an unchecked number tries to pass as money, which is the one mistake that is otherwise invisible until somebody is charged 1299 dollars instead of 12.99.
- The response body is taken as `unknown` rather than left as the `any` that `res.json()` returns, so the compiler forces a parse before anything touches it. `const p: Payment = await res.json()` compiles and promises nothing, which is the most common way a TypeScript codebase is typed and wrong at the same time.
- The `catch` in `pay()` returns `submitting`, not `failed`. A request that never came back does not mean the payment did not happen: it means you do not know, which is the level 9 timeout seen from the browser. Calling it failed invites a second charge, and keeping the key is what makes that second attempt harmless.
- `waitForOutcome` takes its clock as a parameter with a default. That is the cheapest way to make a timing dependent function testable: the test for all seven backoff steps runs in 53ms instead of 31 seconds, and the normal caller passes nothing.
- Two guarantees in this solution have no run time existence, so they were proven by breaking them rather than asserted. Changing `format(amount: Cents)` to `format(amount: number)` gives `tests/checkout.test.ts(55,5): error TS2578: Unused '@ts-expect-error' directive.` Adding a sixth member to the `Checkout` union without handling it gives `src/checkout.ts(45,13): error TS2322: Type '{ kind: "disputed"; disputeId: string; }' is not assignable to type 'never'.` Both of those are real output from running `tsc` on this code.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| `npm install` exits non-zero but the packages are there | A blocked postinstall script, usually esbuild. `tsc` does not need it and vitest usually still runs. Check with `npx vitest run` before assuming the install failed. |
| The idempotency test passes alone and fails in the suite | `sessionStorage` is shared between tests in one file. Clear the slot in `beforeEach`, which is what this suite does. |
| `format(1299)` compiles in your copy | The brand was lost somewhere, usually by annotating a parameter `number` for convenience. The `@ts-expect-error` test is there to fail the build when that happens. |
| Yen renders as 12.99 | You divided by 100 regardless of currency. `decimalsFor` reads the real number of places from Intl: 0 for yen, 3 for dinars. |

## Self-checks the solution satisfies

- tsc --noEmit reports nothing, and removing the brand from format makes a @ts-expect-error test fail the build
- cents(12.99) throws, cents(129900) does not, and format(cents(129900)) is "$1,299.00"
- format(cents(1299), "JPY", "ja-JP") renders 1,299 yen with no decimal places
- The body posted by createPayment is exactly { cart_id } with no amount key
- keyForAttempt returns the same string twice for one cart, and a different one after endAttempt
- A rejected fetch leaves the state as submitting, with the same idempotency key
- A failed payment with a non-retryable decline code clears the attempt; a retryable one does not
- label() stops compiling when a sixth state is added to the union
- Payment.parse rejects a response with a missing status and names the field
- waitForOutcome stops at the first non-pending status and runs instantly with an injected clock

## How it is marked

| Points | Criterion | Meaning |
|--------|-----------|---------|
| 25 | The amount is never an input | No path sends an amount from the client, and a test asserts the posted body. |
| 20 | States that cannot be wrong | A real discriminated union with an exhaustiveness check, and no bag of booleans anywhere. |
| 20 | Retries are safe | One key per attempt, surviving a reload, cleared only when the attempt truly ends. |
| 15 | Boundaries are validated | Every response parsed before use; nothing typed by assertion alone. |
| 10 | Unknown is not failed | A timeout or network error leaves the payment unknown and the key intact. |
| 10 | The README | The state diagram, the build error from the missing case, and what the browser may not decide. |

---

Part of [FinQuest](../../README.md) · Level 10.1
