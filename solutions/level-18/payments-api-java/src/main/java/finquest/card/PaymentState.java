package finquest.card;

import java.util.Set;

/**
 * The eight states a payment can be in, and the transitions that exist.
 *
 * <p>Level 9's table, as an enum. The illegal transitions are the point: capturing
 * an expired authorisation, voiding a captured payment, refunding a chargeback. In
 * Python that was a dictionary and a test; here {@link #next} is the only way to
 * move and it throws on anything not in the table.
 */
public enum PaymentState {
    REQUESTED,
    AUTHORIZED,
    CAPTURED,
    REFUNDED,
    VOIDED,
    EXPIRED,
    DECLINED,
    CHARGED_BACK,
    UNKNOWN;

    /**
     * The transition table, read as "from this state, these events are legal".
     *
     * <p>REFUNDED to CHARGED_BACK is in here because it happens: a customer can
     * dispute a payment that was already refunded, and a state machine that refuses
     * it produces a support ticket nobody can close.
     */
    public PaymentState next(PaymentEvent event) {
        Set<PaymentState> allowed = switch (event) {
            case AUTHORIZE -> Set.of(REQUESTED);
            case CAPTURE -> Set.of(AUTHORIZED);
            case VOID -> Set.of(AUTHORIZED);
            case EXPIRE -> Set.of(AUTHORIZED);
            case REFUND -> Set.of(CAPTURED);
            case CHARGEBACK -> Set.of(CAPTURED, REFUNDED);
            case DECLINE -> Set.of(REQUESTED, UNKNOWN);
            case RESOLVE_UNKNOWN -> Set.of(UNKNOWN);
        };
        if (!allowed.contains(this)) {
            throw new IllegalTransition(this, event);
        }
        return switch (event) {
            case AUTHORIZE -> AUTHORIZED;
            case CAPTURE -> CAPTURED;
            case VOID -> VOIDED;
            case EXPIRE -> EXPIRED;
            case REFUND -> REFUNDED;
            case CHARGEBACK -> CHARGED_BACK;
            case DECLINE -> DECLINED;
            case RESOLVE_UNKNOWN -> AUTHORIZED;
        };
    }

    public boolean isFinal() {
        return switch (this) {
            case REFUNDED, VOIDED, EXPIRED, DECLINED, CHARGED_BACK -> true;
            case REQUESTED, AUTHORIZED, CAPTURED, UNKNOWN -> false;
        };
    }
}
