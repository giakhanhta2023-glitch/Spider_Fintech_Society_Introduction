/**
 * The client for the level 7 API, which does not believe anything it is told.
 *
 * `res.json()` is typed `any`, so writing `const p: Payment = await res.json()`
 * compiles and promises nothing. The body is taken as `unknown` and parsed, so
 * a server that changes shape fails here, at the boundary, naming the field,
 * rather than three functions later at a line that looks innocent.
 *
 * zod is used the way pydantic was used in level 7: the shape is written once
 * and the TypeScript type is derived from it, so the check and the type cannot
 * drift apart.
 */

import { z } from "zod";

export const PaymentSchema = z.object({
  id: z.string().startsWith("pay_"),
  status: z.enum(["pending", "action_required", "succeeded", "failed"]),
  amount_minor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  redirect_url: z.string().url().optional(),
  decline_code: z.string().optional(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
  request_id: z.string(),
});

/**
 * Carries the level 7 request id, which is the one string that finds the right
 * line in the server logs when a customer reports a failure.
 */
export class PaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

/**
 * Create a payment. Note what is NOT in the body: the amount. The client names
 * a cart and the server prices it, because the client is the customer's machine
 * and anything it sends is a value the customer chose.
 */
export async function createPayment(cartId: string, idempotencyKey: string): Promise<Payment> {
  const res = await fetch("/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ cart_id: cartId }),
  });

  const body: unknown = await res.json();

  if (!res.ok) {
    const err = ApiErrorSchema.parse(body);
    throw new PaymentError(err.error.code, err.error.message, err.request_id);
  }
  return PaymentSchema.parse(body);
}

export async function getPayment(paymentId: string): Promise<Payment> {
  const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`);
  const body: unknown = await res.json();

  if (!res.ok) {
    const err = ApiErrorSchema.parse(body);
    throw new PaymentError(err.error.code, err.error.message, err.request_id);
  }
  return PaymentSchema.parse(body);
}

/**
 * Which declines are worth a second attempt. This is the level 9 table, not a
 * guess: an issuer short of funds may approve the same card tomorrow, and an
 * issuer reporting a stolen card must never be asked again.
 */
export const RETRYABLE = new Set([
  "insufficient_funds",
  "issuer_unavailable",
  "processing_error",
  "try_again_later",
]);

export function reasonFor(code: string | undefined): string {
  switch (code) {
    case "insufficient_funds": return "That card does not have enough available.";
    case "issuer_unavailable": return "Your bank did not answer. Try again in a moment.";
    case "processing_error":   return "Something went wrong on our side.";
    case "try_again_later":    return "Your bank asked us to try again later.";
    case "stolen_card":
    case "lost_card":
    case "do_not_honor":       return "Your bank declined this payment.";
    default:                   return "That payment could not be completed.";
  }
}
