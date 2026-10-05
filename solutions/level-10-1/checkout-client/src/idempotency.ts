/**
 * One key per attempt, not one key per click.
 *
 * Level 8 made the server safe to retry: the same Idempotency-Key returns the
 * first answer instead of charging again. That is half the mechanism. The half
 * people forget lives here, and it is that the key has to be the SAME key.
 *
 * A key generated inside the click handler is a new key on every click, and two
 * clicks are two payments with the server working exactly as designed.
 *
 * sessionStorage rather than localStorage on purpose: the key must outlive a
 * reload and must not outlive the purchase. A key kept for weeks eventually
 * makes a genuine second purchase of the same cart return the first payment.
 */

const slot = (cartId: string): string => `idem:${cartId}`;

/** A tiny store so the module works in Node, where sessionStorage is absent. */
export interface KeyStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStore(): KeyStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const fallback = memoryStore();

function store(): KeyStore {
  return typeof sessionStorage === "undefined" ? fallback : sessionStorage;
}

/** The same string every time, until endAttempt is called for this cart. */
export function keyForAttempt(cartId: string): string {
  const existing = store().getItem(slot(cartId));
  if (existing) return existing;

  const key = crypto.randomUUID();
  store().setItem(slot(cartId), key);
  return key;
}

/**
 * Call this only when the attempt has truly ended: succeeded, or failed in a
 * way that is not worth retrying. A pending payment keeps its key, because the
 * retry that matters most is the one after a reload.
 */
export function endAttempt(cartId: string): void {
  store().removeItem(slot(cartId));
}
