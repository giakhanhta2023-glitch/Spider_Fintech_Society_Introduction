package finquest.money;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Money as a record over {@code long} minor units. Level 5, on the JVM.
 *
 * <p>Three decisions, and each one is a bug somebody has already shipped.
 *
 * <p><b>{@code long}, never {@code int}.</b> {@code Integer.MAX_VALUE} is
 * 2,147,483,647 minor units, which is $21,474,836.47, and an int that passes it
 * wraps to negative silently. A payments system holding a customer's lifetime
 * volume in an int is a system with a ceiling nobody documented. {@code long}
 * reaches $92 quadrillion, which is enough.
 *
 * <p><b>Minor units, never a floating point type.</b> The same rule as level 2 in
 * a different language: 0.1 + 0.2 is not 0.3 in any binary floating point type,
 * and no amount of rounding at the edges fixes an arithmetic done in the middle.
 *
 * <p><b>{@code Math.addExact}, never {@code +}.</b> Java wraps on overflow and
 * says nothing. {@code addExact} throws, and an exception at the moment of the
 * error beats a negative balance discovered by a customer.
 *
 * <p>A record rather than a class: the equality, the hash code and the accessors
 * are generated, they are correct, and a reviewer does not have to read them.
 */
public record Money(long minor, Currency currency) implements Comparable<Money> {

    /**
     * The compact constructor validates. A record with an invalid state is a
     * record that has to be checked at every use site instead of once.
     */
    public Money {
        Objects.requireNonNull(currency, "currency");
    }

    public static Money of(long minor, Currency currency) {
        return new Money(minor, currency);
    }

    public static Money zero(Currency currency) {
        return new Money(0L, currency);
    }

    /**
     * Parse a major unit string exactly. {@code "19.99"} becomes 1999 minor units.
     *
     * <p>{@code new BigDecimal(String)} rather than {@code BigDecimal.valueOf} of a
     * double, because the double has already lost the value by the time the
     * BigDecimal sees it. {@code MoneyTest} has that as its own test.
     */
    public static Money parse(String major, Currency currency) {
        BigDecimal scaled = new BigDecimal(major)
                .movePointRight(currency.decimalPlaces())
                .setScale(0, RoundingMode.UNNECESSARY);
        return new Money(scaled.longValueExact(), currency);
    }

    public Money plus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.addExact(minor, other.minor), currency);
    }

    public Money minus(Money other) {
        requireSameCurrency(other);
        return new Money(Math.subtractExact(minor, other.minor), currency);
    }

    /**
     * Multiply by a whole number of times, which is the only multiplication money
     * has. A rate is not a multiplier: applying 2.9% is {@link #percentage} so the
     * rounding is a decision rather than an accident.
     */
    public Money times(long factor) {
        return new Money(Math.multiplyExact(minor, factor), currency);
    }

    /**
     * A percentage in basis points, rounded half up, in integer arithmetic.
     *
     * <p>290 basis points is 2.9%. The {@code + 5_000} before the divide is the
     * round half up: it is worth writing out rather than reaching for a floating
     * point type, because this is the line that decides whether the company charges
     * a cent too little on every payment it takes. Level 17 found exactly that bug
     * in its own fee function.
     */
    public Money percentage(long basisPoints) {
        long product = Math.multiplyExact(minor, basisPoints);
        return new Money((product + 5_000) / 10_000, currency);
    }

    /**
     * Split into parts by ratio, losing nothing.
     *
     * <p>The remainder goes to the earliest parts, one minor unit each, in order.
     * Dropping it loses money; giving it all to the first part is a visible
     * unfairness; distributing it is what every payment processor does. The level 5
     * property test ports unchanged: the parts always sum to the original.
     */
    public List<Money> allocate(int... ratios) {
        if (ratios.length == 0) {
            throw new IllegalArgumentException("allocate needs at least one ratio");
        }
        long total = 0;
        for (int ratio : ratios) {
            if (ratio < 0) {
                throw new IllegalArgumentException("a ratio cannot be negative: " + ratio);
            }
            total = Math.addExact(total, ratio);
        }
        if (total == 0) {
            throw new IllegalArgumentException("the ratios sum to zero");
        }

        List<Money> parts = new ArrayList<>(ratios.length);
        long allocated = 0;
        for (int ratio : ratios) {
            long share = minor * ratio / total;      // floor division, on purpose
            parts.add(new Money(share, currency));
            allocated += share;
        }

        long remainder = minor - allocated;
        for (int i = 0; remainder > 0; i = (i + 1) % ratios.length) {
            parts.set(i, new Money(parts.get(i).minor() + 1, currency));
            remainder--;
        }
        return List.copyOf(parts);
    }

    /** For display only. Never for arithmetic, which is the whole point. */
    public BigDecimal toMajor() {
        return BigDecimal.valueOf(minor, currency.decimalPlaces());
    }

    public String format() {
        return currency.symbol() + toMajor().toPlainString();
    }

    @Override
    public int compareTo(Money other) {
        requireSameCurrency(other);
        return Long.compare(minor, other.minor);
    }

    private void requireSameCurrency(Money other) {
        Objects.requireNonNull(other, "other");
        if (!currency.equals(other.currency)) {
            throw new CurrencyMismatch(currency, other.currency);
        }
    }
}
