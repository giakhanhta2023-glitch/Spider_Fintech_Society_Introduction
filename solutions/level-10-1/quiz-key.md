# Level 10.1: The half of the payment the customer can see: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **A** |
| 3 | **B** |
| 4 | **D** |
| 5 | **A** |
| 6 | **C** |
| 7 | **B** |
| 8 | **A** |
| 9 | **D** |
| 10 | **B** |
| 11 | **C** |
| 12 | **A** |
| 13 | **B** |
| 14 | **C** |
| 15 | **D** |

---

### 1. Your checkout posts `{"cart_id": "c_1", "amount": 129900}` and the server charges the amount it was sent. What is the flaw?

- A. The field name should be amount_minor
- B. It needs an Idempotency-Key as well
- **C. The amount came from the customer, who can change it to anything** ✅
- D. JSON is the wrong format for money

**Why:** The request is made by the customer's machine, so any value in it is a value they chose. The server must price the cart itself.

### 2. In TypeScript, what does `await res.json()` return?

- **A. `any`, which turns the checker off for everything downstream** ✅
- B. The type you annotated the variable with
- C. `unknown`, forcing you to check
- D. A validated object

**Why:** Which is why `const p: Payment = await res.json()` compiles while promising nothing. Type it `unknown` and parse it.

### 3. What makes a union "discriminated"?

- A. Every member has the same fields
- **B. Every member carries a literal tag field, so checking it narrows the type** ✅
- C. It is declared with `enum`
- D. The members are all objects

**Why:** The tag is what the compiler reads in a switch to know which member you are holding in that branch.

### 4. Why assign the switch value to `const unreachable: never` in the default branch?

- A. It makes the switch faster
- B. It stops the function returning undefined
- C. It documents the states for other readers
- **D. Adding a new union member becomes a compile error naming the state you forgot** ✅

**Why:** Without it a new state is a silent gap, and in a function returning void the compiler has nothing else to complain about.

### 5. An amount is held as a `number` of whole cents. Up to roughly what value is it exact?

- **A. About ninety thousand billion dollars, the safe integer limit** ✅
- B. About twenty-one million
- C. $999,999.99
- D. There is no limit, JavaScript numbers are arbitrary precision

**Why:** 2^53 minus 1 cents. Far past any amount a checkout handles, which is why bigint is not needed here.

### 6. What does a branded `Cents` type cost at run time?

- A. A wrapper object per amount
- B. One property lookup per operation
- **C. Nothing. It is a number once the types are stripped** ✅
- D. A small allocation on every format call

**Why:** The brand exists only for the compiler. The emitted JavaScript sees plain numbers.

### 7. Why are card fields served in an iframe from the payment company rather than being inputs on your page?

- A. They render faster
- **B. Your JavaScript cannot read them, which keeps card numbers out of your PCI scope** ✅
- C. It lets the processor style them
- D. Browsers block card inputs on third party pages

**Why:** The same origin policy is doing the work. You cannot leak what you were never able to see.

### 8. Where should the idempotency key be generated?

- **A. Once when the payment attempt begins, and stored so retries reuse it** ✅
- B. Inside the click handler, fresh each time
- C. On the server, returned in the response
- D. From a hash of the amount and the time

**Why:** A fresh key per click is two different payments as far as the server is concerned, and the server is right.

### 9. Why `sessionStorage` rather than `localStorage` for that key?

- A. localStorage is not available in all browsers
- B. sessionStorage is encrypted
- C. localStorage has a smaller quota
- **D. It should outlive a reload and not outlive the purchase** ✅

**Why:** A key kept for weeks eventually makes a genuine second purchase of the same cart return the first payment.

### 10. Your request to create a payment times out with no response. What state is the checkout in?

- A. Failed, and the customer should be told to try again
- **B. Unknown. The payment may well have been taken, so keep the key and ask the server** ✅
- C. Succeeded, because the server usually processes before responding
- D. Idle, because nothing was recorded

**Why:** This is the level 9 timeout from the browser side. Calling it failed invites a second charge.

### 11. The customer returns to your return URL after a 3-D Secure redirect. What do you know?

- A. The payment succeeded
- B. The payment is still pending
- **C. Nothing. You have to ask your own server** ✅
- D. The payment failed if there is no query parameter

**Why:** The URL can be typed, bookmarked or shared, and the bank does not report to you through the customer.

### 12. What finally decides that a payment succeeded?

- **A. Your server, from the processor webhook, written to your ledger** ✅
- B. The browser reaching the success page
- C. The redirect query string
- D. The polling loop returning succeeded

**Why:** The polling loop is a convenience for one screen. Turn the browser off and the ledger must still be right.

### 13. What does `noUncheckedIndexedAccess` change?

- A. It forbids array indexing entirely
- **B. `rows[0]` becomes `Row | undefined`, because an index can miss** ✅
- C. It checks array bounds at run time
- D. It makes arrays readonly

**Why:** One of the few settings that catches real bugs in real code, and it is not included in `strict`.

### 14. What does `// @ts-expect-error` above a line assert?

- A. That the line will throw when it runs
- B. That the error should be logged
- **C. That the line does not compile, and the build fails if it ever starts to** ✅
- D. That the checker should skip the file

**Why:** It is a test for a guarantee with no run time existence: loosen `format` to accept any number and the build breaks.

### 15. Why does the polling function take `sleep` as a parameter with a default?

- A. To support browsers without setTimeout
- B. To let the caller choose the backoff curve
- C. Because vitest cannot mock globals
- **D. So a test can inject its own clock and run seven backoff steps instantly** ✅

**Why:** The cheapest way to make a timing dependent function testable, and it costs the normal caller nothing.
