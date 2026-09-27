package finquest.tx;

import java.util.ArrayList;
import java.util.List;

/**
 * The implementation the traps are shown with. Read the first two methods together.
 */
public final class LedgerService implements Ledger {

    private final List<String> entries = new ArrayList<>();

    /**
     * Calls the annotated method on {@code this}, which is the trap.
     *
     * <p>No transaction is opened, because the call never leaves the object and the
     * proxy is only in front of it. The annotation on {@link #postDirectly} is
     * correct and irrelevant.
     */
    @Override
    public void postWithInternalCall(String reference) {
        postDirectly(reference);          // `this`, so no proxy, so no transaction
    }

    @Override
    @Transactional
    public void postDirectly(String reference) {
        entries.add(reference);
    }

    /**
     * Writes and then throws a checked exception. With Spring's default
     * {@code rollbackFor}, this commits.
     */
    @Override
    @Transactional
    public void postThenThrowChecked(String reference) throws AccountClosed {
        entries.add(reference);
        throw new AccountClosed("the merchant account is closed");
    }

    /** The same method with the fix: name the checked exception. */
    @Override
    @Transactional(rollbackFor = AccountClosed.class)
    public void postThenThrowCheckedWithRollbackFor(String reference) throws AccountClosed {
        entries.add(reference);
        throw new AccountClosed("the merchant account is closed");
    }

    @Override
    public int written() {
        return entries.size();
    }
}
