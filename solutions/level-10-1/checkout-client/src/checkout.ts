/**
 * The checkout, as five states that cannot be wrong at once.
 *
 * The usual way to hold this is four booleans: loading, error, redirectUrl,
 * payment. That is sixteen combinations of which four are real, and nothing
 * stops a screen being loading and succeeded and declined simultaneously.
 *
 * A discriminated union says the five real states and nothing else, and each
 * one carries exactly the data that state has. There is no redirectUrl to read
 * when you are not redirecting, because in that branch the field does not exist
 * as far as the compiler is concerned.
 */

import {
  createPayment, getPayment, reasonFor, RETRYABLE,
  type Payment,
} from "./api.js";
import { endAttempt, keyForAttempt } from "./idempotency.js";

export type Checkout =
  | { kind: "idle" }
  | { kind: "submitting"; idempotencyKey: string }
  | { kind: "action_required"; redirectUrl: string; paymentId: string }
  | { kind: "settled"; payment: Payment }
  | { kind: "failed"; reason: string; retryable: boolean };

/**
 * The exhaustiveness check is the `never` assignment in the default branch. Add
 * a sixth member to the union without handling it here and this stops
 * compiling, with an error naming the state that reached it.
 *
 * Relying on the return type instead would be weaker: a function that sets the
 * document rather than returning a string has return type void, so a missing
 * case is valid code that silently does nothing for one state.
 */
export function label(state: Checkout): string {
  switch (state.kind) {
    case "idle":            return "Pay";
    case "submitting":      return "Working...";
    case "action_required": return "Confirm with your bank";
    case "settled":         return "Paid";
    case "failed":          return state.retryable ? "Try again" : state.reason;
    default: {
      const unreachable: never = state;
      throw new Error(`unhandled checkout state ${JSON.stringify(unreachable)}`);
    }
  }
}

export function isFinal(state: Checkout): boolean {
  return state.kind === "settled" || (state.kind === "failed" && !state.retryable);
}

/**
 * Start or retry a payment attempt.
 *
 * Three things here are the level, and all three are about what NOT to do:
 * the body carries no amount, a request already in flight is not sent again,
 * and a thrown fetch is not a failed payment.
 */
export async function pay(cartId: string, state: Checkout): Promise<Checkout> {
  if (state.kind === "submitting") return state;

  const idempotencyKey = keyForAttempt(cartId);

  let payment: Payment;
  try {
    payment = await createPayment(cartId, idempotencyKey);
  } catch {
    // A request that never came back does not mean the payment did not happen.
    // It means you do not know, which is the level 9 timeout from this side.
    // Saying "failed" here invites the customer to pay a second time, and
    // keeping the key is what makes that second attempt harmless.
    return { kind: "submitting", idempotencyKey };
  }

  switch (payment.status) {
    case "action_required":
      return payment.redirect_url
        ? { kind: "action_required", redirectUrl: payment.redirect_url, paymentId: payment.id }
        : { kind: "submitting", idempotencyKey };

    case "succeeded":
      endAttempt(cartId);
      return { kind: "settled", payment };

    case "failed": {
      const retryable = RETRYABLE.has(payment.decline_code ?? "");
      if (!retryable) endAttempt(cartId);
      return { kind: "failed", reason: reasonFor(payment.decline_code), retryable };
    }

    case "pending":
      return { kind: "submitting", idempotencyKey };

    default: {
      const unreachable: never = payment.status;
      throw new Error(`unknown payment status ${String(unreachable)}`);
    }
  }
}

/**
 * After the bank sends the customer back, you know nothing: the return URL can
 * be typed, bookmarked or shared, and the bank does not report to you through
 * the customer. So ask your own server, with the gaps getting longer.
 *
 * `get` and `sleep` are parameters with defaults because that is the cheapest
 * way to make a timing dependent function testable. A test passes its own and
 * seven backoff steps run instantly instead of taking thirty-one seconds.
 *
 * This loop is a convenience for one customer looking at one screen. It is not
 * how the system learns the outcome: that is the webhook. If the browser never
 * polled at all, the ledger would still be right.
 */
export async function waitForOutcome(
  paymentId: string,
  get: (id: string) => Promise<Payment> = getPayment,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Payment> {
  const gaps = [500, 1000, 2000, 4000, 8000, 8000, 8000];

  for (const gap of gaps) {
    const payment = await get(paymentId);
    if (payment.status !== "pending") return payment;
    await sleep(gap);
  }
  return get(paymentId);
}
