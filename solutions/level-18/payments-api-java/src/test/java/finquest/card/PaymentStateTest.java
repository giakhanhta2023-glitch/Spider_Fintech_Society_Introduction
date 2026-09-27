package finquest.card;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Level 9's transition table, enforced by the type rather than by a dictionary. */
class PaymentStateTest {

    @Test
    @DisplayName("the happy path")
    void happyPath() {
        PaymentState state = PaymentState.REQUESTED
                .next(PaymentEvent.AUTHORIZE)
                .next(PaymentEvent.CAPTURE);
        assertEquals(PaymentState.CAPTURED, state);
        assertFalse(state.isFinal(), "a captured payment can still be refunded");
    }

    @ParameterizedTest
    @CsvSource({
            "EXPIRED, CAPTURE",
            "DECLINED, CAPTURE",
            "VOIDED, CAPTURE",
            "CAPTURED, VOID",
            "CAPTURED, AUTHORIZE",
            "REQUESTED, CAPTURE",
            "CHARGED_BACK, REFUND",
    })
    @DisplayName("every illegal transition in the table is refused")
    void illegalTransitionsAreRefused(PaymentState from, PaymentEvent event) {
        IllegalTransition thrown =
                assertThrows(IllegalTransition.class, () -> from.next(event));
        assertTrue(thrown.getMessage().contains(event.toString()));
    }

    @Test
    @DisplayName("a refunded payment can still be disputed, because that happens")
    void refundedCanBeChargedBack() {
        assertEquals(PaymentState.CHARGED_BACK,
                PaymentState.REFUNDED.next(PaymentEvent.CHARGEBACK));
    }

    @Test
    @DisplayName("an unknown payment is resolved rather than guessed")
    void unknownIsResolvable() {
        assertEquals(PaymentState.AUTHORIZED,
                PaymentState.UNKNOWN.next(PaymentEvent.RESOLVE_UNKNOWN));
        assertEquals(PaymentState.DECLINED,
                PaymentState.UNKNOWN.next(PaymentEvent.DECLINE));
        assertFalse(PaymentState.UNKNOWN.isFinal(), "unknown is not an ending");
    }
}
