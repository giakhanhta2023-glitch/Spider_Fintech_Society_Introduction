package finquest.api;

import finquest.card.PaymentState;
import finquest.money.Money;
import java.time.Instant;

/**
 * A payment, as the API exposes it.
 *
 * <p>Mutable state in a record is a contradiction, so the state lives in
 * {@link PaymentStore} and this is the snapshot the API returns. That separation is
 * the level 7 contract: a response is a value, and the thing that changes is behind
 * a lock.
 */
public record Payment(
        String id,
        String merchantId,
        Money amount,
        Money fee,
        PaymentState state,
        String token,
        String idempotencyKey,
        Instant createdAt) {

    public Money net() {
        return amount.minus(fee);
    }
}
