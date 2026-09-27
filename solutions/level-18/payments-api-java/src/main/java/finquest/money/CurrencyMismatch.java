package finquest.money;

/**
 * Adding dollars to euros. A runtime exception rather than a checked one, because
 * there is no sensible recovery: the code is wrong.
 *
 * <p>Named for what happened rather than ending in Exception, because it is read in
 * a log line during an incident. {@code CurrencyMismatch: cannot combine USD and
 * EUR} is a sentence.
 */
public class CurrencyMismatch extends RuntimeException {

    public CurrencyMismatch(Currency left, Currency right) {
        super("cannot combine " + left + " and " + right);
    }
}
