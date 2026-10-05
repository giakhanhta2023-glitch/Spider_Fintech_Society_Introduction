/* =========================================================================
   LEVEL 10.1: the browser half of a payment.

   An aside rather than a rung. It sits after level 10 because it needs the API
   from level 7, the idempotency rules from level 8 and the lifecycle from
   level 9, and it is numbered 10.1 so that nothing after it moves and level 11
   still opens on level 10.
   ========================================================================= */
FQ.registerLevel({
  id: 10.1,
  position: '10.1',
  aside: true,
  codename: 'checkout-client',
  title: 'The half of the payment the customer can see',
  tagline: 'Everything so far has been servers talking to servers. This is the other end of the wire: a checkout in TypeScript that never knows the amount, never touches a card number, and cannot charge somebody twice because they pressed the button twice.',
  difficulty: 6,
  minutes: 300,
  tags: ['typescript', 'checkout', 'client side', 'pci'],
  summary: 'Levels 7 to 10 built a payments API, made it safe to retry, modelled the card lifecycle and reconciled the ' +
           'result. No customer has seen any of it. This level is the browser: a typed checkout that asks for a cart ' +
           'rather than an amount, keeps card numbers out of your code on purpose, carries one idempotency key across ' +
           'a reload, and treats pending as a real answer. It is the only JavaScript in the course, which is why it is ' +
           '10.1 and not 11: skip it and level 11 still opens.',

  objectives: [
    'Say why a browser is never allowed to send an amount, and what it sends instead',
    'Keep card numbers out of your own code, and your company out of most of PCI scope',
    'Model the level 9 lifecycle as a TypeScript union that will not compile when you miss a case',
    'Carry one idempotency key across a reload, so pressing Pay twice charges once',
    'Treat pending as a state rather than a spinner, and handle the return from a redirect',
    'Name the thing a browser is never allowed to decide, and say what decides it instead'
  ],

  knowledge: [
    { h: 'The browser is somebody else\'s computer' },
    { p: 'Every line of JavaScript you ship is a suggestion. The person running it can read it, change it, delete it, ' +
         'and send whatever they like to your server instead. Browser developer tools are not a hacking tool, they ' +
         'ship with the browser, and editing a form field in them takes about four seconds.' },
    { p: 'So there is one rule the rest of this level hangs off, and almost every beginner payment integration gets it ' +
         'wrong at least once:' },
    { warn: '**The client says what it wants to buy. The server decides what it costs.** A checkout that posts ' +
            '`{"amount": 129900}` is a checkout where a customer can buy a laptop for a penny, and no amount of ' +
            'validation in your JavaScript changes that, because your JavaScript is not the thing making the request.' },
    { p: 'The fix is not more checking in the browser. It is giving the browser nothing worth changing. The request ' +
         'carries a cart id or a price id, the server looks the price up in its own database, and the amount never ' +
         'crosses the wire in that direction at all:' },
    { code: '// Wrong. The amount came from the page, and the page belongs to the customer.\nPOST /v1/checkout  { "item": "laptop", "amount": 129900 }\n\n// Right. The amount is not an input.\nPOST /v1/checkout  { "cart_id": "cart_8f21" }\n// the server reads the cart, prices it, and returns what it will charge', lang: 'text' },
    { p: 'The same rule applies to anything else worth money: the currency, the discount code, the shipping tier, the ' +
         'customer id. The browser names things. The server values them.' },
    { check: {
      q: 'Your checkout sends `{"cart_id": "cart_8f21"}` and the server prices it. A customer edits the request to ' +
         'send a cart id that is not theirs. What stops them?',
      a: 'Nothing in this design, which is why the rule is only half the job. The server has to price the cart **and** ' +
         'check it belongs to the session making the request. Authentication says who you are, and authorisation says ' +
         'which rows you are allowed to name. Taking the amount out of the request closes the loophole where a stranger ' +
         'sets the price; it does not close the one where a logged in customer names somebody else\'s basket.'
    }},

    { h: 'TypeScript, for somebody who already writes Python' },
    { p: 'You know Python with type hints from level 5, and mypy reading them. TypeScript is the same arrangement with ' +
         'the volume turned up: annotations that the runtime ignores completely, and a checker that refuses to build ' +
         'when they contradict each other. Five differences actually matter here.' },
    { table: {
      head: ['Python, as you know it', 'TypeScript', 'Why it matters today'],
      rows: [
        ['Hints are optional and mypy is a separate step somebody might skip', '`tsc` is the build. There is no build output if the types do not check', 'A type error cannot reach production by nobody running the checker'],
        ['`isinstance` checks a class', 'Types are **structural**: anything with the right fields fits', 'You describe the shape of a payment, not a class it has to inherit from'],
        ['`int` and `float` are different types', 'There is one `number`, and it is a float64', 'The level 1 problem again. Money is still whole minor units'],
        ['`Any` is a cop out you can grep for', '`any` turns the checker off silently, and `JSON.parse` returns it', 'A typed API response is a lie until something validates it at the boundary'],
        ['`Union[A, B]` plus `if isinstance`', '`A | B` plus a check that **narrows** the type in that branch', 'This is the whole trick behind the next section']
      ]
    }},
    { p: 'The fourth row is the one that bites. `const payment: Payment = await res.json()` compiles perfectly and ' +
         'promises nothing: `json()` is typed as `any`, so you have told the checker what you hope is there. If the ' +
         'server sends something else, your code finds out three functions later, at a line that looks innocent.' },
    { p: 'Level 7 solved the same problem on the server with pydantic. The browser needs the same thing, and the usual ' +
         'answer is **zod**: you write the shape once, it gives you both a runtime check and the TypeScript type, so ' +
         'the two cannot drift apart.' },
    { code: 'import { z } from "zod";\n\nconst Payment = z.object({\n  id: z.string(),\n  status: z.enum(["requires_action", "pending", "succeeded", "failed"]),\n  amount_minor: z.number().int().nonnegative(),\n  currency: z.string().length(3),\n});\n\ntype Payment = z.infer<typeof Payment>;   // the type, derived from the check\n\nconst res = await fetch("/api/payments/" + id);\nconst payment = Payment.parse(await res.json());   // throws if the server lied', lang: 'typescript' },
    { tip: 'Turn on `strict` in `tsconfig.json` on the first day of a project. Turning it on later means fixing every ' +
           'file at once, which is why so many codebases never do.' },

    { h: 'Making the impossible states not compile' },
    { p: 'Level 9 gave you the lifecycle: authorised, captured, voided, refunded, charged back, expired. In the browser ' +
         'you hold a smaller version of the same thing, and the usual way people hold it is a bag of booleans:' },
    { code: '// Four booleans. Sixteen combinations. Four of them are real.\nlet loading = false;\nlet error: string | null = null;\nlet redirectUrl: string | null = null;\nlet payment: Payment | null = null;\n\n// What does this screen show? Nobody knows.\nloading = true; error = "card declined"; payment = succeeded;', lang: 'typescript' },
    { p: 'A **discriminated union** says the four real states and nothing else. Each member carries exactly the data ' +
         'that state has, so there is no `redirectUrl` to read when you are not redirecting:' },
    { code: 'type Checkout =\n  | { kind: "idle" }\n  | { kind: "submitting"; idempotencyKey: string }\n  | { kind: "action_required"; redirectUrl: string; paymentId: string }\n  | { kind: "settled"; payment: Payment }\n  | { kind: "failed"; reason: string; retryable: boolean };\n\nfunction render(state: Checkout): string {\n  switch (state.kind) {\n    case "idle":            return "Pay";\n    case "submitting":      return "Working...";\n    case "action_required": return "Your bank needs to check this";\n    case "settled":         return "Paid " + format(state.payment.amount_minor);\n    case "failed":          return state.reason;\n  }\n}', lang: 'typescript' },
    { p: 'Inside `case "action_required"` the checker knows `state.redirectUrl` exists, and inside `case "idle"` it ' +
         'knows it does not. That is narrowing, and it is the TypeScript version of level 18\'s sealed interface.' },
    { p: 'The payoff is what happens when the business adds a state. Add `{ kind: "disputed"; ... }` to the union and ' +
         '`render` stops compiling, because its return type is no longer guaranteed. The same addition in the four ' +
         'booleans version compiles fine and shows a blank screen in production. To make the failure explicit rather ' +
         'than incidental, add a default branch that cannot be reached:' },
    { code: 'default: {\n  const unreachable: never = state;      // every case handled, so this is `never`\n  throw new Error("unhandled state " + JSON.stringify(unreachable));\n}', lang: 'typescript' },
    { p: 'If a new member is ever added to the union and not handled above, `state` is not `never` any more and that ' +
         'line is a compile error naming the state you forgot.' },
    { check: {
      q: 'Why is the `never` assignment better than just letting the missing return type error do the work?',
      a: 'Because the return type only catches it when the function returns something. A `render` that sets the ' +
         'document instead of returning a string has return type `void`, so a missing case is perfectly valid code ' +
         'that silently does nothing for one state. The `never` assignment fails regardless of what the function ' +
         'returns, and the error message names the type that reached it, so you are told which state you forgot ' +
         'rather than that something is wrong.'
    }},

    { h: 'Money in TypeScript' },
    { p: 'There is one numeric type in JavaScript and it is the same float64 that opened level 1. The demonstration is ' +
         'identical:' },
    { code: '> 0.1 + 0.2\n0.30000000000000004\n\n> (19.99 * 100)\n1998.9999999999998          // and Math.round of that is fine, but only by luck\n\n> 0.1 + 0.2 === 0.3\nfalse', lang: 'text' },
    { p: 'So the answer is the one from level 5: whole minor units. An integer `number` is exact up to 2^53, which is ' +
         '9,007,199,254,740,991, or about ninety thousand billion dollars in cents. That is enough. Reach for `bigint` ' +
         'only when it genuinely is not, which for a checkout it never is.' },
    { p: 'TypeScript adds one thing Python makes hard: a **branded type**, so cents and dollars cannot be confused even ' +
         'though both are numbers underneath.' },
    { code: 'type Cents = number & { readonly __brand: "Cents" };\n\nfunction cents(n: number): Cents {\n  if (!Number.isInteger(n)) throw new Error("money must be whole cents: " + n);\n  return n as Cents;\n}\n\nfunction format(amount: Cents, currency = "USD"): string {\n  return new Intl.NumberFormat("en-US", { style: "currency", currency })\n    .format(amount / 100);\n}\n\nconst total = cents(129900);\nformat(total);          // "$1,299.00"\n\nconst wrong: Cents = 1299.5;   // does not compile\nformat(1299);                  // does not compile either: that is a number, not Cents', lang: 'typescript' },
    { p: 'The brand costs nothing at run time. `Cents` is a `number` once the types are stripped, and the object in the ' +
         'type is never created. All it does is make the compiler refuse when a plain number tries to pass as money, ' +
         'which is the one mistake that is otherwise invisible.' },
    { p: '`Intl.NumberFormat` is in every browser and knows about currency symbols, digit grouping and how many decimal ' +
         'places a currency has. Writing `"$" + (n / 100).toFixed(2)` works for dollars and is wrong for yen, which ' +
         'has none, and for dinars, which have three.' },

    { h: 'Never touch a card number' },
    { p: 'The rule that shapes every real checkout: **if a card number passes through your code, you are in scope for ' +
         'PCI DSS**, the card industry\'s security standard. In scope means an audit, a questionnaire with hundreds of ' +
         'controls, scanning, and a long conversation with your own compliance people.' },
    { p: 'So nobody does it. The card fields are served by the payment company, from the payment company\'s domain, ' +
         'inside an iframe on your page. The browser\'s same origin policy means your JavaScript cannot read what is ' +
         'typed into them, which sounds like a limitation and is the entire point: you cannot leak what you cannot ' +
         'see. The processor hands your page a **token**, and the token is what you send to your own server.' },
    { table: {
      head: ['What you handle', 'What that makes you', 'Roughly'],
      rows: [
        ['Card numbers in your own form, your own server', 'Full PCI scope', 'Hundreds of controls, an audit, a dedicated team'],
        ['A hosted field you cannot read, and a token', 'The small questionnaire', 'A form you fill in once a year'],
        ['A token that is useless to anybody else', 'The thing you store', 'Safe in your database, worthless if stolen']
      ]
    }},
    { p: 'This is also why the course does not ask you to build a card form. There is nothing to learn from typing one ' +
         'that you would never be allowed to ship, and a tutorial that teaches you to collect card numbers is teaching ' +
         'you a fireable habit. The build uses a fake tokeniser with the same shape as a real one, and the swap to a ' +
         'real processor is a different URL.' },
    { warn: 'A token is not a card number, and it is also not nothing. It usually buys exactly one charge, to exactly ' +
            'your account. Treat it as a credential: never log it, never put it in a URL, never email it to yourself ' +
            'while debugging.' },

    { h: 'They pressed Pay twice' },
    { p: 'Level 8 made the server safe to retry: the same `Idempotency-Key` returns the first answer rather than ' +
         'charging again. That is half the mechanism. The other half is in the browser, and it is the half people ' +
         'forget: **the key has to be the same key**.' },
    { p: 'Generate it when the customer starts the attempt, not when you send the request. A key generated inside the ' +
         'click handler is a new key on every click, and two clicks are two charges with the server working exactly as ' +
         'designed.' },
    { code: '// Wrong: a fresh key per click, so the server sees two different payments\nasync function pay() {\n  const key = crypto.randomUUID();\n  await post("/api/payments", { cart_id }, key);\n}\n\n// Right: one key per attempt, reused by every retry of that attempt\nfunction keyForAttempt(cartId: string): string {\n  const slot = "idem:" + cartId;\n  let key = sessionStorage.getItem(slot);\n  if (!key) {\n    key = crypto.randomUUID();\n    sessionStorage.setItem(slot, key);\n  }\n  return key;\n}', lang: 'typescript' },
    { p: 'Storing it is what makes a reload safe. The customer clicks Pay, the connection stalls, they refresh the page ' +
         'and click again: same key, and level 8\'s server returns the original answer instead of taking the money ' +
         'twice. Clear the slot when the attempt reaches a final state, so the next genuine purchase gets a new key.' },
    { tip: 'Disable the button while a request is in flight as well. That is a courtesy rather than a mechanism: it ' +
           'stops the common case before it reaches the network. The key is what saves you when the button was not ' +
           'enough, which is every time the customer reloads.' },

    { h: 'Pending is an answer' },
    { p: 'Most payments do not finish inside the request that starts them. The bank wants the customer to confirm in ' +
         'their banking app, so your page gets back a URL to send them to, and the real outcome arrives minutes later ' +
         'at a webhook. A checkout with two states, worked and failed, cannot represent this, so it shows a spinner ' +
         'until something times out.' },
    { p: 'Hence `action_required` in the union above. It is not a loading state. It is an answer, with a URL in it, and ' +
         'it means the payment is genuinely in progress somewhere you cannot see.' },
    { p: 'When the customer comes back to your return URL, you know nothing yet. The browser was redirected by the bank ' +
         'and the bank does not report to you through the customer. Ask your own server:' },
    { code: 'GET /api/payments/pay_1f3c      -> { "status": "pending" }\n// wait a moment and ask again, with the gaps getting longer\nGET /api/payments/pay_1f3c      -> { "status": "succeeded" }', lang: 'text' },
    { warn: '**The browser is never the source of truth about money.** It is a screen. A customer closing the tab does ' +
            'not cancel a payment, a customer reaching your success page does not mean you were paid, and a success ' +
            'page reached by typing the URL means nothing at all. The webhook from the processor, written into your ' +
            'own ledger, is the truth. The page just reports what the server already believes.' },
    { p: 'This is the same lesson as level 10, from the other side. There you reconciled what the processor said ' +
         'against what your ledger said. Here you are deciding what the screen is allowed to claim, and the answer is ' +
         'nothing your server has not already recorded.' },
    { check: {
      q: 'Your checkout marks the order as paid when the browser reaches the return URL, because that is where the ' +
         'bank sends successful payments. What goes wrong, and when?',
      a: 'Two things, and the first one is free money for anybody who notices. The return URL is a URL: a customer can ' +
         'type it, bookmark it, or share it, and your order is marked paid without a payment. The second is quieter. ' +
         'The redirect also fires for payments that are still pending, and for some that will fail a moment later, so ' +
         'even honest traffic marks orders paid that were never paid. You find out at the month end reconciliation ' +
         'from level 10, which is a bad day to find out.'
    }}
  ],

  tutorial: {
    intro: 'A checkout, built in TypeScript, talking to the API you already wrote. Everything runs locally and nothing ' +
           'touches a real card. Node 20 or later.',
    steps: [
      {
        t: 'A project that refuses sloppiness',
        blocks: [
          { p: 'Three files and one install. The settings in `tsconfig.json` are the level: `strict` turns on every ' +
               'check, and the other two close the holes `strict` leaves open.' },
          { code: 'npm init -y\nnpm install --save-dev typescript vitest @types/node\nnpm install zod\nnpx tsc --init', lang: 'bash' },
          { code: '{\n  "compilerOptions": {\n    "target": "ES2022",\n    "module": "ES2022",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "noUncheckedIndexedAccess": true,\n    "exactOptionalPropertyTypes": true,\n    "noEmitOnError": true,\n    "outDir": "dist"\n  },\n  "include": ["src", "tests"]\n}', lang: 'json' },
          { p: '`strict` is the one everybody knows. `noUncheckedIndexedAccess` is the one that catches real bugs: it ' +
               'makes `rows[0]` have type `Row | undefined` rather than `Row`, because an array index can miss. ' +
               '`noEmitOnError` means a type error produces no output at all, so a broken build cannot be run by ' +
               'accident.' },
          { tip: 'Add `"typecheck": "tsc --noEmit"` and `"test": "vitest run"` to the scripts in `package.json`. Those ' +
                 'two commands are what the pipeline from level 17 would run.' }
        ],
        check: '`npx tsc --noEmit` runs and reports nothing.'
      },
      {
        t: 'Money you cannot misuse',
        blocks: [
          { code: 'export type Cents = number & { readonly __brand: "Cents" };\n\nexport function cents(n: number): Cents {\n  if (!Number.isInteger(n)) throw new RangeError("money must be whole cents, got " + n);\n  if (!Number.isSafeInteger(n)) throw new RangeError("amount beyond safe integer range");\n  return n as Cents;\n}\n\nexport function format(amount: Cents, currency = "USD", locale = "en-US"): string {\n  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 100);\n}\n\nexport function add(a: Cents, b: Cents): Cents {\n  return cents(a + b);\n}', lang: 'typescript' },
          { p: 'Only `cents()` can make a `Cents`, so every amount in the program has passed the whole number check ' +
               'exactly once, at the edge. `add` returns through `cents()` again, which costs nothing and means an ' +
               'overflow past the safe range throws where it happened rather than quietly rounding.' },
          { p: 'Try to break it and the compiler stops you before the test does:' },
          { code: 'format(1299);          // Argument of type \'number\' is not assignable to parameter of type \'Cents\'\ncents(12.99);          // compiles, then throws: money must be whole cents, got 12.99', lang: 'typescript' },
          { warn: 'The second line is the important distinction. A branded type stops a plain number at compile time. ' +
                  'It cannot stop a value that arrives from the network at run time, because the compiler never sees ' +
                  'that value. That is what the next two steps are for.' }
        ],
        check: 'format(cents(129900)) returns "$1,299.00", and format(1299) does not compile.'
      },
      {
        t: 'The lifecycle, as a union',
        blocks: [
          { code: 'import type { Payment } from "./api";\n\nexport type Checkout =\n  | { kind: "idle" }\n  | { kind: "submitting"; idempotencyKey: string }\n  | { kind: "action_required"; redirectUrl: string; paymentId: string }\n  | { kind: "settled"; payment: Payment }\n  | { kind: "failed"; reason: string; retryable: boolean };\n\nexport function label(state: Checkout): string {\n  switch (state.kind) {\n    case "idle":            return "Pay";\n    case "submitting":      return "Working...";\n    case "action_required": return "Confirm with your bank";\n    case "settled":         return "Paid";\n    case "failed":          return state.retryable ? "Try again" : state.reason;\n    default: {\n      const unreachable: never = state;\n      throw new Error("unhandled checkout state " + JSON.stringify(unreachable));\n    }\n  }\n}', lang: 'typescript' },
          { p: 'Note `state.retryable` inside the failed branch and nowhere else. Outside that case the field does not ' +
               'exist as far as the compiler is concerned, so there is no way to read it on a state that has no such ' +
               'idea. The four booleans version has no equivalent.' },
          { p: 'Which failures are retryable is the level 9 decline table, not a guess: an issuer saying "insufficient ' +
               'funds" may be worth trying later, and one saying "stolen card" must never be retried.' }
        ],
        check: 'Adding a sixth member to the union makes `label` fail to compile, naming the state you did not handle.'
      },
      {
        t: 'A client that does not believe the server',
        blocks: [
          { p: 'The level 7 API returns one error shape and a request id on every response. Model both, parse both, and ' +
               'the rest of the program can stop checking.' },
          { code: 'import { z } from "zod";\n\nexport const Payment = z.object({\n  id: z.string().startsWith("pay_"),\n  status: z.enum(["pending", "action_required", "succeeded", "failed"]),\n  amount_minor: z.number().int().nonnegative(),\n  currency: z.string().length(3),\n  redirect_url: z.string().url().optional(),\n  decline_code: z.string().optional(),\n});\nexport type Payment = z.infer<typeof Payment>;\n\nexport const ApiError = z.object({\n  error: z.object({ code: z.string(), message: z.string() }),\n  request_id: z.string(),\n});\n\nexport async function createPayment(cartId: string, key: string): Promise<Payment> {\n  const res = await fetch("/api/payments", {\n    method: "POST",\n    headers: { "Content-Type": "application/json", "Idempotency-Key": key },\n    body: JSON.stringify({ cart_id: cartId }),      // no amount. ever.\n  });\n  const body: unknown = await res.json();\n  if (!res.ok) {\n    const err = ApiError.parse(body);\n    throw new PaymentError(err.error.code, err.error.message, err.request_id);\n  }\n  return Payment.parse(body);\n}', lang: 'typescript' },
          { p: 'Two details worth copying. The body is typed `unknown` rather than left as the `any` that `json()` ' +
               'returns, so the compiler forces you through a parse before you touch it. And the request id from the ' +
               'error travels into the exception, so when a customer reports a failure you have the one string that ' +
               'finds the line in your logs from level 7.' },
          { tip: 'Keep these schemas in one file. When the API changes, one file fails to parse in your tests and tells ' +
                 'you exactly what moved, rather than six components rendering `undefined`.' }
        ],
        check: 'A response with a missing field throws from `Payment.parse`, and the message names the field.'
      },
      {
        t: 'One key per attempt',
        blocks: [
          { code: 'const SLOT = (cartId: string) => "idem:" + cartId;\n\nexport function keyForAttempt(cartId: string): string {\n  const existing = sessionStorage.getItem(SLOT(cartId));\n  if (existing) return existing;\n  const key = crypto.randomUUID();\n  sessionStorage.setItem(SLOT(cartId), key);\n  return key;\n}\n\nexport function endAttempt(cartId: string): void {\n  sessionStorage.removeItem(SLOT(cartId));\n}', lang: 'typescript' },
          { p: 'Call `keyForAttempt` when the checkout opens and again on every retry: it hands back the same string ' +
               'until the attempt ends. Call `endAttempt` only when the payment reaches a final state, which means ' +
               'succeeded, or failed in a way that is not retryable. A pending payment keeps its key, because the ' +
               'retry that matters most is the one after a reload.' },
          { p: '`crypto.randomUUID()` is in every current browser and in Node 19 and later. It is a version 4 UUID, ' +
               'which is 122 random bits: enough that two attempts colliding is not a thing that happens.' },
          { warn: '`sessionStorage` is per tab and cleared when the tab closes, which is the behaviour you want: the ' +
                  'key should outlive a reload and not outlive the purchase. `localStorage` would survive for weeks ' +
                  'and eventually make a genuine second purchase of the same cart return the first payment.' }
        ],
        check: 'Calling keyForAttempt twice for the same cart returns the same string; after endAttempt it returns a new one.'
      },
      {
        t: 'The checkout, as a state machine',
        blocks: [
          { code: 'export async function pay(cartId: string, state: Checkout): Promise<Checkout> {\n  if (state.kind === "submitting") return state;      // already in flight\n\n  const idempotencyKey = keyForAttempt(cartId);\n  try {\n    const payment = await createPayment(cartId, idempotencyKey);\n\n    if (payment.status === "action_required" && payment.redirect_url) {\n      return { kind: "action_required", redirectUrl: payment.redirect_url, paymentId: payment.id };\n    }\n    if (payment.status === "succeeded") {\n      endAttempt(cartId);\n      return { kind: "settled", payment };\n    }\n    if (payment.status === "failed") {\n      const retryable = RETRYABLE.has(payment.decline_code ?? "");\n      if (!retryable) endAttempt(cartId);\n      return { kind: "failed", reason: reasonFor(payment.decline_code), retryable };\n    }\n    return { kind: "submitting", idempotencyKey };       // still pending: keep the key\n  } catch (err) {\n    // A network failure is NOT a failed payment. It is an unknown payment.\n    return { kind: "submitting", idempotencyKey };\n  }\n}', lang: 'typescript' },
          { p: 'The `catch` is the line to read twice. A request that never came back does not mean the payment did not ' +
               'happen, it means you do not know, which is exactly the timeout case from level 9. Showing "payment ' +
               'failed" there is a lie that invites the customer to pay again, and keeping the key is what makes that ' +
               'second attempt harmless.' },
          { p: 'Nothing in this function writes "paid" anywhere except on a `succeeded` the server sent.' }
        ],
        check: 'Dropping the network mid-request leaves the checkout in submitting, with the key intact.'
      },
      {
        t: 'Coming back from the bank',
        blocks: [
          { p: 'After `action_required` you send the customer to `redirectUrl`. They come back to your return URL ' +
               'knowing nothing useful, so ask the server, with the gaps getting longer so a slow bank does not turn ' +
               'into a thousand requests:' },
          { code: 'export async function waitForOutcome(\n  paymentId: string,\n  get = getPayment,\n  sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),\n): Promise<Payment> {\n  const gaps = [500, 1000, 2000, 4000, 8000, 8000, 8000];\n  for (const gap of gaps) {\n    const payment = await get(paymentId);\n    if (payment.status !== "pending") return payment;\n    await sleep(gap);\n  }\n  return get(paymentId);       // one last look, then let the caller decide\n}', lang: 'typescript' },
          { p: 'The `get` and `sleep` parameters have defaults, which is the cheapest way to make a timing dependent ' +
               'function testable: the tests pass their own, and a test for seven backoff steps runs in no time at all ' +
               'instead of thirty seconds.' },
          { p: 'If it is still pending when the gaps run out, say so. "We are still confirming this payment and will ' +
               'email you" is true, and it is better than either lie.' },
          { warn: 'This loop is a convenience for one customer looking at one screen. It is not how your system learns ' +
                  'the outcome. That is the webhook, and if the browser never polled at all your ledger would still be ' +
                  'correct. Build it in that order, or you will ship a system that only works while somebody is ' +
                  'watching.' }
        ],
        check: 'The polling test runs instantly with an injected clock, and stops at the first non-pending status.'
      },
      {
        t: 'Tests, including the ones that are type errors',
        blocks: [
          { code: 'import { describe, expect, it, vi } from "vitest";\n\nit("never sends an amount", async () => {\n  const fetchMock = vi.fn().mockResolvedValue(okResponse(succeededPayment));\n  vi.stubGlobal("fetch", fetchMock);\n\n  await createPayment("cart_8f21", "key_1");\n\n  const body = JSON.parse(fetchMock.mock.calls[0]![1].body);\n  expect(body).toEqual({ cart_id: "cart_8f21" });\n  expect(Object.keys(body)).not.toContain("amount");\n});\n\nit("pressing pay twice sends one key", async () => {\n  const first = keyForAttempt("cart_8f21");\n  const second = keyForAttempt("cart_8f21");\n  expect(second).toBe(first);\n});\n\nit("a plain number is not money", () => {\n  // @ts-expect-error money must be branded\n  format(1299);\n});', lang: 'typescript' },
          { p: 'That last test is the TypeScript idiom worth taking away. `@ts-expect-error` asserts that the next line ' +
               '**does not** compile: if somebody later loosens `format` to accept any number, the comment becomes ' +
               'unused and the build fails. It is a test for a guarantee that normally has no run time existence.' },
          { tip: 'Write the "never sends an amount" test first and keep it forever. It is the one line of this level ' +
                 'that a reviewer at a payments company will look for.' }
        ],
        check: 'vitest run passes, tsc --noEmit reports nothing, and removing the brand from format breaks the build.'
      }
    ]
  },

  glossary: [
    { t: 'Discriminated union', d: 'A type made of several shapes, each tagged by a literal field, so checking the tag tells the compiler which shape you have.' },
    { t: 'Narrowing', d: 'The compiler reducing a value\'s possible types inside a branch, because of a check you wrote.' },
    { t: 'Branded type', d: 'A primitive given a fake extra property in the type system only, so it cannot be mixed up with a plain one. Free at run time.' },
    { t: 'Structural typing', d: 'Two types match if their fields match. No inheritance or declaration is needed.' },
    { t: 'Hosted field', d: 'An input served by the payment company inside an iframe, which your JavaScript cannot read.' },
    { t: 'Tokenisation', d: 'Exchanging a card number for a reference that is useless outside your account.' },
    { t: 'PCI DSS', d: 'The card industry security standard. Handling card numbers yourself puts you fully in its scope.' },
    { t: 'Same origin policy', d: 'The browser rule that stops a page reading content served from another domain. What makes hosted fields safe.' },
    { t: '3-D Secure', d: 'The step where the issuer asks the cardholder to confirm, usually by redirect. The source of the action_required state.' },
    { t: 'Return URL', d: 'Where the bank sends the customer afterwards. Carries no proof of anything.' },
    { t: 'Exhaustiveness check', d: 'Assigning the checked value to `never` in a default branch, so a new unhandled case becomes a compile error.' },
    { t: 'Backoff', d: 'Waiting longer between each retry, so a slow dependency is not turned into a flood.' }
  ],

  quiz: [
    { q: 'Your checkout posts `{"cart_id": "c_1", "amount": 129900}` and the server charges the amount it was sent. What is the flaw?',
      options: ['The field name should be amount_minor', 'It needs an Idempotency-Key as well', 'The amount came from the customer, who can change it to anything', 'JSON is the wrong format for money'],
      answer: 2,
      why: 'The request is made by the customer\'s machine, so any value in it is a value they chose. The server must price the cart itself.' },

    { q: 'In TypeScript, what does `await res.json()` return?',
      options: ['`any`, which turns the checker off for everything downstream', 'The type you annotated the variable with', '`unknown`, forcing you to check', 'A validated object'],
      answer: 0,
      why: 'Which is why `const p: Payment = await res.json()` compiles while promising nothing. Type it `unknown` and parse it.' },

    { q: 'What makes a union "discriminated"?',
      options: ['Every member has the same fields', 'Every member carries a literal tag field, so checking it narrows the type', 'It is declared with `enum`', 'The members are all objects'],
      answer: 1,
      why: 'The tag is what the compiler reads in a switch to know which member you are holding in that branch.' },

    { q: 'Why assign the switch value to `const unreachable: never` in the default branch?',
      options: ['It makes the switch faster', 'It stops the function returning undefined', 'It documents the states for other readers', 'Adding a new union member becomes a compile error naming the state you forgot'],
      answer: 3,
      why: 'Without it a new state is a silent gap, and in a function returning void the compiler has nothing else to complain about.' },

    { q: 'An amount is held as a `number` of whole cents. Up to roughly what value is it exact?',
      options: ['About ninety thousand billion dollars, the safe integer limit', 'About twenty-one million', '$999,999.99', 'There is no limit, JavaScript numbers are arbitrary precision'],
      answer: 0,
      why: '2^53 minus 1 cents. Far past any amount a checkout handles, which is why bigint is not needed here.' },

    { q: 'What does a branded `Cents` type cost at run time?',
      options: ['A wrapper object per amount', 'One property lookup per operation', 'Nothing. It is a number once the types are stripped', 'A small allocation on every format call'],
      answer: 2,
      why: 'The brand exists only for the compiler. The emitted JavaScript sees plain numbers.' },

    { q: 'Why are card fields served in an iframe from the payment company rather than being inputs on your page?',
      options: ['They render faster', 'Your JavaScript cannot read them, which keeps card numbers out of your PCI scope', 'It lets the processor style them', 'Browsers block card inputs on third party pages'],
      answer: 1,
      why: 'The same origin policy is doing the work. You cannot leak what you were never able to see.' },

    { q: 'Where should the idempotency key be generated?',
      options: ['Once when the payment attempt begins, and stored so retries reuse it', 'Inside the click handler, fresh each time', 'On the server, returned in the response', 'From a hash of the amount and the time'],
      answer: 0,
      why: 'A fresh key per click is two different payments as far as the server is concerned, and the server is right.' },

    { q: 'Why `sessionStorage` rather than `localStorage` for that key?',
      options: ['localStorage is not available in all browsers', 'sessionStorage is encrypted', 'localStorage has a smaller quota', 'It should outlive a reload and not outlive the purchase'],
      answer: 3,
      why: 'A key kept for weeks eventually makes a genuine second purchase of the same cart return the first payment.' },

    { q: 'Your request to create a payment times out with no response. What state is the checkout in?',
      options: ['Failed, and the customer should be told to try again', 'Unknown. The payment may well have been taken, so keep the key and ask the server', 'Succeeded, because the server usually processes before responding', 'Idle, because nothing was recorded'],
      answer: 1,
      why: 'This is the level 9 timeout from the browser side. Calling it failed invites a second charge.' },

    { q: 'The customer returns to your return URL after a 3-D Secure redirect. What do you know?',
      options: ['The payment succeeded', 'The payment is still pending', 'Nothing. You have to ask your own server', 'The payment failed if there is no query parameter'],
      answer: 2,
      why: 'The URL can be typed, bookmarked or shared, and the bank does not report to you through the customer.' },

    { q: 'What finally decides that a payment succeeded?',
      options: ['Your server, from the processor webhook, written to your ledger', 'The browser reaching the success page', 'The redirect query string', 'The polling loop returning succeeded'],
      answer: 0,
      why: 'The polling loop is a convenience for one screen. Turn the browser off and the ledger must still be right.' },

    { q: 'What does `noUncheckedIndexedAccess` change?',
      options: ['It forbids array indexing entirely', '`rows[0]` becomes `Row | undefined`, because an index can miss', 'It checks array bounds at run time', 'It makes arrays readonly'],
      answer: 1,
      why: 'One of the few settings that catches real bugs in real code, and it is not included in `strict`.' },

    { q: 'What does `// @ts-expect-error` above a line assert?',
      options: ['That the line will throw when it runs', 'That the error should be logged', 'That the line does not compile, and the build fails if it ever starts to', 'That the checker should skip the file'],
      answer: 2,
      why: 'It is a test for a guarantee with no run time existence: loosen `format` to accept any number and the build breaks.' },

    { q: 'Why does the polling function take `sleep` as a parameter with a default?',
      options: ['To support browsers without setTimeout', 'To let the caller choose the backoff curve', 'Because vitest cannot mock globals', 'So a test can inject its own clock and run seven backoff steps instantly'],
      answer: 3,
      why: 'The cheapest way to make a timing dependent function testable, and it costs the normal caller nothing.' }
  ],

  project: {
    title: 'A checkout that cannot be talked into charging the wrong amount',
    story: 'The payments API from levels 7 to 10 has never had a customer in front of it. Build the front half: a typed ' +
           'checkout that asks for a cart and is told the price, holds one idempotency key per attempt, handles the ' +
           'bank sending the customer away and back, and never claims a payment succeeded on its own authority. ' +
           'Everything runs locally against a small server you also write, because the browser is not allowed to hold ' +
           'your API key.',
    scope: 'Uses levels 7, 8, 9 and 10. TypeScript 5 with `strict`, vitest, zod. No framework is required and no UI ' +
           'library is allowed: this is about the types and the state machine, not about components. **This is the ' +
           'only JavaScript in the course**, and it is an aside rather than a rung, so level 11 opens on level 10 ' +
           'whether you do this or not. The card form is a fake tokeniser with the shape of a real one, because a ' +
           'tutorial that teaches you to collect card numbers is teaching you a habit that gets people fired.',
    requirements: [
      'A TypeScript project with `strict`, `noUncheckedIndexedAccess` and `noEmitOnError`, where `tsc --noEmit` is clean',
      'A branded `Cents` type with a single constructor that rejects anything not a safe whole number',
      'Formatting through `Intl.NumberFormat`, with a test proving yen renders with no decimal places',
      'The checkout lifecycle as a discriminated union of at least five states, with an exhaustiveness check against `never`',
      'A test that adds a sixth state and shows the build failing, recorded in the README as the error message',
      'zod schemas for the payment and the error shape, parsed at every boundary, with the response body typed `unknown` first',
      'The level 7 request id carried from the error body into your own exception type',
      'A request that sends `cart_id` and never an amount, with a test asserting the posted body has no amount key',
      'One idempotency key per attempt, stored so a reload reuses it, cleared only on a final state',
      'A network failure leaving the checkout in a non-final state with the key intact, with a test',
      'A backoff poller taking its clock as a parameter, tested with an injected one',
      'A tiny Node server holding the API key and forwarding to the level 7 API, so the browser never sees it',
      'A fake tokeniser endpoint returning `tok_` references, and a note in the README on what a real hosted field changes',
      'At least two `@ts-expect-error` tests covering guarantees that have no run time existence',
      'A README with the state diagram, the five states, and a paragraph on what the browser is not allowed to decide',
      'The repository public on GitHub as `checkout-client-ts`'
    ],
    starter: {
      lang: 'typescript',
      code: '// src/money.ts\nexport type Cents = number & { readonly __brand: "Cents" };\n\nexport function cents(n: number): Cents {\n  // TODO: reject non-integers and anything past Number.MAX_SAFE_INTEGER\n  return n as Cents;\n}\n\nexport function format(amount: Cents, currency = "USD", locale = "en-US"): string {\n  // TODO: Intl.NumberFormat. Remember yen has no decimal places.\n  return "";\n}\n\n\n// src/checkout.ts\nimport type { Payment } from "./api";\n\nexport type Checkout =\n  | { kind: "idle" }\n  // TODO: submitting, action_required, settled, failed\n  ;\n\nexport function label(state: Checkout): string {\n  switch (state.kind) {\n    case "idle": return "Pay";\n    // TODO: the rest, then a default branch that assigns to never\n  }\n}\n\nexport async function pay(cartId: string, state: Checkout): Promise<Checkout> {\n  // TODO: one key per attempt; no amount in the body; a thrown fetch is\n  // NOT a failed payment\n  return state;\n}\n\n\n// src/idempotency.ts\nexport function keyForAttempt(cartId: string): string {\n  // TODO: generate once, store, return the same value until endAttempt\n  return "";\n}\n\nexport function endAttempt(cartId: string): void {\n  // TODO\n}\n'
    },
    tests: [
      'tsc --noEmit reports nothing, and removing the brand from format makes a @ts-expect-error test fail the build',
      'cents(12.99) throws, cents(129900) does not, and format(cents(129900)) is "$1,299.00"',
      'format(cents(1299), "JPY", "ja-JP") renders 1,299 yen with no decimal places',
      'The body posted by createPayment is exactly { cart_id } with no amount key',
      'keyForAttempt returns the same string twice for one cart, and a different one after endAttempt',
      'A rejected fetch leaves the state as submitting, with the same idempotency key',
      'A failed payment with a non-retryable decline code clears the attempt; a retryable one does not',
      'label() stops compiling when a sixth state is added to the union',
      'Payment.parse rejects a response with a missing status and names the field',
      'waitForOutcome stops at the first non-pending status and runs instantly with an injected clock'
    ],
    rubric: [
      { pts: 25, t: 'The amount is never an input', d: 'No path sends an amount from the client, and a test asserts the posted body.' },
      { pts: 20, t: 'States that cannot be wrong', d: 'A real discriminated union with an exhaustiveness check, and no bag of booleans anywhere.' },
      { pts: 20, t: 'Retries are safe', d: 'One key per attempt, surviving a reload, cleared only when the attempt truly ends.' },
      { pts: 15, t: 'Boundaries are validated', d: 'Every response parsed before use; nothing typed by assertion alone.' },
      { pts: 10, t: 'Unknown is not failed', d: 'A timeout or network error leaves the payment unknown and the key intact.' },
      { pts: 10, t: 'The README', d: 'The state diagram, the build error from the missing case, and what the browser may not decide.' }
    ],
    stretch: [
      'Swap the fake tokeniser for a real processor test mode and keep every test passing with only a URL change',
      'Add a second currency end to end, and prove the formatting and the decimal places follow it',
      'Render the same state machine in a framework you have never used, and report how much of the code moved',
      'Add a webhook endpoint to the small server and show the ledger reaching the right state with the browser closed'
    ],
    solutionPath: 'solutions/level-10-1'
  },

  faq: [
    { q: 'Why is this 10.1 and not level 11?',
      a: 'Because it is the only JavaScript in the course and not everybody needs it. A decimal number means nothing ' +
         'after it moved, every sentence in later levels citing a level number is still right, and level 11 opens on ' +
         'level 10 whether you clear this or not. The rank ladder still has twenty rungs.' },
    { q: 'Why no React, Vue or Svelte?',
      a: 'Because the interesting part of a checkout is the state machine and the types, and a framework would hide ' +
         'both behind its own vocabulary. Everything here moves into any framework unchanged, which is the point of ' +
         'the last stretch goal. Learn a framework separately; it will take an afternoon once you have this.' },
    { q: 'Is TypeScript worth it over plain JavaScript for a page this small?',
      a: 'For a page, arguably not. For money, yes, and the specific reasons are in this level rather than in general: ' +
         'a branded amount, a union that will not compile with a missing state, and a parsed boundary. Those three ' +
         'catch the mistakes that cost money, and none of them exists in plain JavaScript.' },
    { q: 'Can I point this at a real Stripe or Adyen test account?',
      a: 'Yes, and it is a good use of an afternoon once the tests pass locally. Their test mode gives you real hosted ' +
         'fields and a real 3-D Secure redirect, which is the one part a fake cannot teach you the feel of. Keep the ' +
         'keys in environment variables and out of the repository, exactly as level 15 says.' }
  ]
});
