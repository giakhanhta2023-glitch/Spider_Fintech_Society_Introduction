package finquest.tx;

/** What the traps are demonstrated against. Two methods, one annotation each. */
public interface Ledger {

    void postWithInternalCall(String reference);

    void postDirectly(String reference);

    void postThenThrowChecked(String reference) throws AccountClosed;

    void postThenThrowCheckedWithRollbackFor(String reference) throws AccountClosed;

    int written();

    class AccountClosed extends Exception {
        public AccountClosed(String message) {
            super(message);
        }
    }
}
