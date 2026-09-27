package finquest.card;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import finquest.money.Currency;
import finquest.money.Money;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The sealed interface, exercised. The compile failure it is really for cannot be a
 * test, because a test that does not compile is not a test: it is in
 * docs/compile-failure.md with the exact javac output.
 */
class OutcomesTest {

    @Test
    @DisplayName("every outcome has a next step, and none of them is a default branch")
    void everyOutcomeIsHandled() {
        AuthResult approved =
                new AuthResult.Approved("auth_1", Money.of(1999, Currency.USD));
        AuthResult soft =
                new AuthResult.Declined("auth_2", DeclineCode.INSUFFICIENT_FUNDS);
        AuthResult hard = new AuthResult.Declined("auth_3", DeclineCode.STOLEN_CARD);
        AuthResult unknown = new AuthResult.Unknown("auth_4", "read timeout");

        assertTrue(Outcomes.nextStep(approved).startsWith("capture $19.99"));
        assertEquals("retry later: INSUFFICIENT_FUNDS", Outcomes.nextStep(soft));
        assertEquals("stop, and do not retry: STOLEN_CARD", Outcomes.nextStep(hard));
        assertTrue(Outcomes.nextStep(unknown).startsWith("ask the network"));
    }

    @Test
    @DisplayName("a hard decline is never retried and an unknown is never retried blindly")
    void retryPolicy() {
        assertTrue(Outcomes.mayRetry(
                new AuthResult.Declined("a", DeclineCode.ISSUER_UNAVAILABLE)));
        assertFalse(Outcomes.mayRetry(
                new AuthResult.Declined("a", DeclineCode.EXPIRED_CARD)));
        assertFalse(Outcomes.mayRetry(new AuthResult.Unknown("a", "timeout")),
                "retrying an unknown can charge a customer twice");
        assertFalse(Outcomes.mayRetry(
                new AuthResult.Approved("a", Money.of(1, Currency.USD))));
    }
}
