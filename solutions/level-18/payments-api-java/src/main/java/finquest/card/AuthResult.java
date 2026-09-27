package finquest.card;

import finquest.money.Money;

/**
 * What the card network said, as a sealed interface.
 *
 * <p>This is the reason to be on the JVM rather than a preference about syntax. A
 * sealed interface plus a switch expression means <b>adding an outcome breaks the
 * build</b> at every place that handles outcomes, rather than falling through to a
 * default branch that treats a new kind of decline as an approval.
 *
 * <p>The demonstration is in {@code docs/compile-failure.md}: adding a sixth
 * outcome and running javac produces
 * "the switch expression does not cover all possible input values", with the file
 * and line. That error is the feature.
 *
 * <p>Level 9's state machine had the same shape in Python, enforced by a dictionary
 * and a test. Here the compiler does it, and the difference is when you find out.
 */
public sealed interface AuthResult
        permits AuthResult.Approved, AuthResult.Declined, AuthResult.Unknown {

    /** The network approved and is holding the amount. */
    record Approved(String reference, Money held) implements AuthResult {}

    /**
     * The network said no, with a code. {@code retryable} is part of the type
     * rather than a lookup at the call site, because level 9 measured what happens
     * when a hard decline is retried: nothing, thirteen times, and then a fee.
     */
    record Declined(String reference, DeclineCode code) implements AuthResult {
        public boolean retryable() {
            return code.retryable();
        }
    }

    /**
     * No answer. Not an approval and not a decline.
     *
     * <p>The state level 9 insists on: a timeout means the network may or may not
     * be holding the money, so the only correct next action is to ask, using a
     * reference generated before the first attempt. A system whose type system
     * cannot express "unknown" will guess, and in level 9's week it would have
     * guessed 159 times with $11,477.03 at stake.
     */
    record Unknown(String reference, String detail) implements AuthResult {}
}
