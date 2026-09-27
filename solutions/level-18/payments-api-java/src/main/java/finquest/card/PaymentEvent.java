package finquest.card;

/** The events that move a payment. Level 9's vocabulary, unchanged. */
public enum PaymentEvent {
    AUTHORIZE,
    CAPTURE,
    VOID,
    EXPIRE,
    REFUND,
    CHARGEBACK,
    DECLINE,
    RESOLVE_UNKNOWN
}
