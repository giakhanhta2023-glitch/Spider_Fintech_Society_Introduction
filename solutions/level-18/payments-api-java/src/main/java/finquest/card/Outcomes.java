package finquest.card;

/**
 * Handling every outcome, exhaustively, with no default branch.
 *
 * <p>This class exists to be broken on purpose. Add a fourth record to
 * {@link AuthResult} and javac refuses to compile the switch below, naming this
 * file and this line. {@code docs/compile-failure.md} has the exact error.
 *
 * <p>A {@code default} branch here would make the compiler's check disappear, which
 * is why there is none: a new decline outcome falling into a default that treats it
 * as retryable is the bug the sealed interface exists to prevent.
 */
public final class Outcomes {

    private Outcomes() {
    }

    /** What to do next, as a sentence, for every outcome the type allows. */
    public static String nextStep(AuthResult result) {
        return switch (result) {
            case AuthResult.Approved approved ->
                    "capture " + approved.held().format() + " against " + approved.reference();
            case AuthResult.Declined declined when declined.retryable() ->
                    "retry later: " + declined.code();
            case AuthResult.Declined declined ->
                    "stop, and do not retry: " + declined.code();
            case AuthResult.Unknown unknown ->
                    "ask the network about " + unknown.reference() + " before anything else";
        };
    }

    /** Whether this outcome permits another attempt at all. */
    public static boolean mayRetry(AuthResult result) {
        return switch (result) {
            case AuthResult.Approved ignored -> false;
            case AuthResult.Declined declined -> declined.retryable();
            // An unknown must never be retried blindly: the money may already be
            // held. It is resolved by asking, which is a different operation.
            case AuthResult.Unknown ignored -> false;
        };
    }
}
