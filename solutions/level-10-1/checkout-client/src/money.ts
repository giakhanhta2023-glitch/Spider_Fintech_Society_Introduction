/**
 * Money, as a type a plain number cannot pass for.
 *
 * JavaScript has one numeric type and it is the float64 from level 1, so the
 * answer is the one from level 5: whole minor units. An integer `number` is
 * exact to 2^53 - 1, which is about ninety thousand billion dollars in cents.
 * `bigint` would be correct and is not needed for a checkout.
 *
 * The brand is the part worth stealing. `Cents` compiles to `number` and costs
 * nothing at run time; all it does is make the compiler refuse when an unchecked
 * number tries to pass as money, which is the one mistake that is otherwise
 * invisible until a customer is charged 1299 dollars instead of 12.99.
 */

export type Cents = number & { readonly __brand: "Cents" };

/** The only way to make a Cents. Every amount in the program passes here once. */
export function cents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new RangeError(`money must be whole cents, got ${n}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`amount beyond the safe integer range: ${n}`);
  }
  return n as Cents;
}

/**
 * Format for a human. Intl knows that yen has no decimal places and dinars have
 * three, which is why this is not `"$" + (n / 100).toFixed(2)`.
 */
export function format(amount: Cents, currency = "USD", locale = "en-US"): string {
  const digits = decimalsFor(currency);
  return new Intl.NumberFormat(locale, { style: "currency", currency })
    .format(amount / 10 ** digits);
}

/**
 * How many decimal places this currency has: 2 for dollars, 0 for yen, 3 for
 * dinars. `maximumFractionDigits` is typed `number | undefined` because the
 * option is optional on the way in, so it has to be handled rather than
 * assumed. Two is the right fallback: it is what every currency Intl does not
 * recognise is formatted with anyway.
 */
export function decimalsFor(currency: string): number {
  const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
  return fmt.resolvedOptions().maximumFractionDigits ?? 2;
}

export function add(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subtract(a: Cents, b: Cents): Cents {
  return cents(a - b);
}
