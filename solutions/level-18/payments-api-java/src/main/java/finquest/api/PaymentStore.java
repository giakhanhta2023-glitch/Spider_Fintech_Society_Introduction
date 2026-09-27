package finquest.api;

import finquest.card.PaymentEvent;
import finquest.card.PaymentState;
import finquest.money.Currency;
import finquest.money.Money;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;

/**
 * The store, with the idempotency key as the mechanism rather than as a lookup.
 *
 * <p>The lock is held across the "does this key exist, and if not create it" pair,
 * because that pair is the whole of idempotency and doing it in two steps is the
 * level 8 race. In Postgres the same thing is a unique constraint and an
 * {@code on conflict}, which is better because it survives two processes.
 */
public final class PaymentStore {

    private static final long FEE_BASIS_POINTS = 290;

    private final Map<String, Payment> byId = new LinkedHashMap<>();
    private final Map<String, String> byIdempotencyKey = new LinkedHashMap<>();
    private final ReentrantLock lock = new ReentrantLock();
    private final AtomicLong sequence = new AtomicLong();

    /**
     * Take a payment, or return the one this key already created.
     *
     * <p>The boolean says which happened, because the API returns 201 for a new
     * payment and 200 for a replay, and a caller that cannot tell them apart
     * cannot log honestly.
     */
    public Created takePayment(String merchantId, Money amount, String token, String key) {
        lock.lock();
        try {
            String existing = byIdempotencyKey.get(key);
            if (existing != null) {
                return new Created(byId.get(existing), false);
            }

            String id = "pay_" + String.format("%08d", sequence.incrementAndGet());
            Payment payment = new Payment(
                    id,
                    merchantId,
                    amount,
                    amount.percentage(FEE_BASIS_POINTS),
                    PaymentState.REQUESTED.next(PaymentEvent.AUTHORIZE),
                    token,
                    key,
                    Instant.now());
            byId.put(id, payment);
            byIdempotencyKey.put(key, id);
            return new Created(payment, true);
        } finally {
            lock.unlock();
        }
    }

    public Optional<Payment> byId(String id) {
        lock.lock();
        try {
            return Optional.ofNullable(byId.get(id));
        } finally {
            lock.unlock();
        }
    }

    /** Move a payment, through the state machine, or throw. */
    public Payment apply(String id, PaymentEvent event) {
        lock.lock();
        try {
            Payment payment = byId.get(id);
            if (payment == null) {
                throw new NotFound("no such payment: " + id);
            }
            PaymentState next = payment.state().next(event);
            Payment moved = new Payment(payment.id(), payment.merchantId(),
                    payment.amount(), payment.fee(), next, payment.token(),
                    payment.idempotencyKey(), payment.createdAt());
            byId.put(id, moved);
            return moved;
        } finally {
            lock.unlock();
        }
    }

    /**
     * A page of payments, newest first, by cursor rather than by offset.
     *
     * <p>Offset paging shifts every later page when a payment arrives mid read, so a
     * client sees one twice and misses another. On a payment list that is a support
     * ticket about missing money.
     */
    public Page page(String merchantId, String cursor, int limit) {
        lock.lock();
        try {
            List<Payment> all = new ArrayList<>(byId.values());
            all.removeIf(p -> !p.merchantId().equals(merchantId));
            all.sort((a, b) -> b.id().compareTo(a.id()));

            int start = 0;
            if (cursor != null && !cursor.isBlank()) {
                start = -1;
                for (int i = 0; i < all.size(); i++) {
                    if (all.get(i).id().equals(cursor)) {
                        start = i + 1;
                        break;
                    }
                }
                if (start < 0) {
                    throw new BadRequest("cursor does not match any payment");
                }
            }
            List<Payment> window = all.subList(Math.min(start, all.size()),
                    Math.min(start + limit, all.size()));
            String next = (start + limit) < all.size() && !window.isEmpty()
                    ? window.get(window.size() - 1).id()
                    : null;
            return new Page(List.copyOf(window), next);
        } finally {
            lock.unlock();
        }
    }

    public int size() {
        lock.lock();
        try {
            return byId.size();
        } finally {
            lock.unlock();
        }
    }

    public static Money dollars(String major) {
        return Money.parse(major, Currency.USD);
    }

    public record Created(Payment payment, boolean isNew) {}

    public record Page(List<Payment> payments, String nextCursor) {}

    public static class NotFound extends RuntimeException {
        public NotFound(String message) {
            super(message);
        }
    }

    public static class BadRequest extends RuntimeException {
        public BadRequest(String message) {
            super(message);
        }
    }
}
