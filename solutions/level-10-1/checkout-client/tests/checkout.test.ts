/**
 * The tests. Each one is a way a checkout loses money.
 *
 *     npm test
 *
 * Two are worth reading even if you never run them. "never sends an amount" is
 * the one a reviewer at a payments company looks for, and the @ts-expect-error
 * tests assert something that has no run time existence at all: they fail the
 * build if a guarantee is ever loosened.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { add, cents, decimalsFor, format } from "../src/money.js";
import { PaymentSchema, createPayment, PaymentError, type Payment } from "../src/api.js";
import { endAttempt, keyForAttempt } from "../src/idempotency.js";
import { isFinal, label, pay, waitForOutcome, type Checkout } from "../src/checkout.js";

const succeeded: Payment = {
  id: "pay_1f3c", status: "succeeded", amount_minor: 129900, currency: "USD",
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok, status,
    json: async () => body,
  } as unknown as Response;
}

// --------------------------------------------------------------- the money
describe("money", () => {
  it("rejects anything that is not whole cents", () => {
    expect(() => cents(12.99)).toThrow(/whole cents/);
    expect(() => cents(Number.MAX_SAFE_INTEGER + 2)).toThrow(/safe integer/);
    expect(cents(129900)).toBe(129900);
  });

  it("formats dollars", () => {
    expect(format(cents(129900))).toBe("$1,299.00");
  });

  it("knows yen has no decimal places", () => {
    expect(decimalsFor("JPY")).toBe(0);
    expect(decimalsFor("USD")).toBe(2);
    // 1299 yen is 1299 yen, not 12.99 of anything
    expect(format(cents(1299), "JPY", "en-US")).toContain("1,299");
    expect(format(cents(1299), "JPY", "en-US")).not.toContain(".00");
  });

  it("adding stays whole", () => {
    expect(add(cents(1999), cents(1))).toBe(2000);
  });

  it("a plain number is not money", () => {
    // @ts-expect-error a number must go through cents() before it is money
    format(1299);
    // @ts-expect-error and arithmetic cannot smuggle one in either
    add(1299, cents(1));
  });
});

// ----------------------------------------------------------- the boundary
describe("the API client", () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it("never sends an amount", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(succeeded));
    vi.stubGlobal("fetch", fetchMock);

    await createPayment("cart_8f21", "key_1");

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body).toEqual({ cart_id: "cart_8f21" });
    expect(Object.keys(body)).not.toContain("amount");
    expect(Object.keys(body)).not.toContain("amount_minor");
    expect(Object.keys(body)).not.toContain("currency");
  });

  it("sends the idempotency key as a header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(succeeded));
    vi.stubGlobal("fetch", fetchMock);

    await createPayment("cart_8f21", "key_abc");

    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key_abc");
  });

  it("refuses a response that is the wrong shape, naming the field", () => {
    const missingStatus = { id: "pay_1", amount_minor: 100, currency: "USD" };
    expect(() => PaymentSchema.parse(missingStatus)).toThrow(/status/);
  });

  it("carries the request id out of an error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(
      { error: { code: "card_declined", message: "declined" }, request_id: "req_77" },
      false, 402,
    )));

    await expect(createPayment("cart_1", "key_1")).rejects.toMatchObject({
      code: "card_declined",
      requestId: "req_77",
    });
    await expect(createPayment("cart_1", "key_1")).rejects.toBeInstanceOf(PaymentError);
  });
});

// --------------------------------------------------------- the same key
describe("idempotency", () => {
  it("returns the same key for one attempt", () => {
    const first = keyForAttempt("cart_8f21");
    const second = keyForAttempt("cart_8f21");
    expect(second).toBe(first);
  });

  it("gives a new key once the attempt has ended", () => {
    const first = keyForAttempt("cart_new");
    endAttempt("cart_new");
    expect(keyForAttempt("cart_new")).not.toBe(first);
  });

  it("keeps separate carts separate", () => {
    expect(keyForAttempt("cart_a")).not.toBe(keyForAttempt("cart_b"));
  });
});

// ------------------------------------------------------- the state machine
describe("the checkout", () => {
  beforeEach(() => { vi.unstubAllGlobals(); endAttempt("cart_x"); });

  it("labels every state, and the union is exhaustive", () => {
    const states: Checkout[] = [
      { kind: "idle" },
      { kind: "submitting", idempotencyKey: "k" },
      { kind: "action_required", redirectUrl: "https://bank.example/3ds", paymentId: "pay_1" },
      { kind: "settled", payment: succeeded },
      { kind: "failed", reason: "declined", retryable: false },
    ];
    expect(states.map(label)).toEqual([
      "Pay", "Working...", "Confirm with your bank", "Paid", "declined",
    ]);
  });

  it("a network failure is an unknown payment, not a failed one", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));

    const key = keyForAttempt("cart_x");
    const state = await pay("cart_x", { kind: "idle" });

    expect(state.kind).toBe("submitting");
    expect(state.kind === "submitting" && state.idempotencyKey).toBe(key);
    // and the key survives, so the retry is harmless
    expect(keyForAttempt("cart_x")).toBe(key);
  });

  it("does not send a second request while one is in flight", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(succeeded));
    vi.stubGlobal("fetch", fetchMock);

    const state = await pay("cart_x", { kind: "submitting", idempotencyKey: "k" });

    expect(state).toEqual({ kind: "submitting", idempotencyKey: "k" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a redirect becomes action_required, carrying the URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...succeeded, status: "action_required", redirect_url: "https://bank.example/3ds",
    })));

    const state = await pay("cart_x", { kind: "idle" });
    expect(state).toEqual({
      kind: "action_required",
      redirectUrl: "https://bank.example/3ds",
      paymentId: "pay_1f3c",
    });
    expect(isFinal(state)).toBe(false);
  });

  it("a retryable decline keeps the key, a final one clears it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...succeeded, status: "failed", decline_code: "insufficient_funds",
    })));
    const key = keyForAttempt("cart_x");
    const soft = await pay("cart_x", { kind: "idle" });
    expect(soft).toMatchObject({ kind: "failed", retryable: true });
    expect(keyForAttempt("cart_x")).toBe(key);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      ...succeeded, status: "failed", decline_code: "stolen_card",
    })));
    const hard = await pay("cart_x", { kind: "idle" });
    expect(hard).toMatchObject({ kind: "failed", retryable: false });
    expect(isFinal(hard)).toBe(true);
    expect(keyForAttempt("cart_x")).not.toBe(key);
  });

  it("success clears the attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(succeeded)));
    const key = keyForAttempt("cart_x");

    const state = await pay("cart_x", { kind: "idle" });
    expect(state).toEqual({ kind: "settled", payment: succeeded });
    expect(keyForAttempt("cart_x")).not.toBe(key);
  });
});

// ------------------------------------------------------------ the polling
describe("waiting for the outcome", () => {
  it("stops at the first answer that is not pending", async () => {
    const answers: Payment[] = [
      { ...succeeded, status: "pending" },
      { ...succeeded, status: "pending" },
      succeeded,
    ];
    const get = vi.fn(async () => answers.shift()!);
    const slept: number[] = [];

    const out = await waitForOutcome("pay_1f3c", get, async (ms) => { slept.push(ms); });

    expect(out.status).toBe("succeeded");
    expect(get).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([500, 1000]);      // it waited twice, then got an answer
  });

  it("backs off and gives up without hanging", async () => {
    const get = vi.fn(async (): Promise<Payment> => ({ ...succeeded, status: "pending" }));
    const slept: number[] = [];

    const out = await waitForOutcome("pay_1f3c", get, async (ms) => { slept.push(ms); });

    expect(out.status).toBe("pending");      // still pending is a true answer
    expect(slept).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
    expect(get).toHaveBeenCalledTimes(8);    // seven gaps, then one last look
  });
});
