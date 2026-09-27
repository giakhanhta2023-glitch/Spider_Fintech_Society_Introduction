package finquest.money;

/**
 * A currency and how many decimal places it has.
 *
 * <p>An enum rather than a string, because "USD" as a string is a value that can be
 * mistyped, lowercased, or read from a config file that has drifted. The compiler
 * can check an enum.
 *
 * <p>The decimal places matter more than people expect. JPY has none, so 1000 JPY
 * is 1000 minor units rather than 100,000, and a system that assumes two decimal
 * places everywhere overcharges Japanese customers by a factor of a hundred. KWD
 * has three. Both are in here because both break the assumption.
 */
public enum Currency {
    USD("$", 2),
    EUR("\u20ac", 2),
    GBP("\u00a3", 2),
    JPY("\u00a5", 0),
    KWD("KD", 3);

    private final String symbol;
    private final int decimalPlaces;

    Currency(String symbol, int decimalPlaces) {
        this.symbol = symbol;
        this.decimalPlaces = decimalPlaces;
    }

    public String symbol() {
        return symbol;
    }

    public int decimalPlaces() {
        return decimalPlaces;
    }
}
