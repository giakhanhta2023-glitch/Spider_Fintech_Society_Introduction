package finquest.card;

/**
 * Decline codes, and whether retrying one is worth anything.
 *
 * <p>The distinction is the whole value of the enum. A soft decline can succeed on
 * a retry; a hard decline cannot, and retrying it costs a fee per attempt and
 * annoys the issuer. Level 9 measured the retry policy against a week of traffic.
 */
public enum DeclineCode {
    INSUFFICIENT_FUNDS(true),
    ISSUER_UNAVAILABLE(true),
    TRY_AGAIN_LATER(true),
    EXPIRED_CARD(false),
    STOLEN_CARD(false),
    DO_NOT_HONOUR(false);

    private final boolean retryable;

    DeclineCode(boolean retryable) {
        this.retryable = retryable;
    }

    public boolean retryable() {
        return retryable;
    }
}
