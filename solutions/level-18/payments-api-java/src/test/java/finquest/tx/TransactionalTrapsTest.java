package finquest.tx;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The level's two required demonstrations. Both fail in the way the level says they
 * will, and the assertions say what the proxy actually did rather than what the
 * annotation looks like it says.
 */
class TransactionalTrapsTest {

    @Test
    @DisplayName("an internal call bypasses the proxy, so no transaction is opened")
    void internalCallBypassesTheProxy() {
        TransactionManager manager = new TransactionManager();
        Ledger ledger = manager.proxy(Ledger.class, new LedgerService());

        ledger.postWithInternalCall("txn_1");

        assertEquals(1, ledger.written(), "the write happened");
        assertEquals(List.of(), manager.journal(),
                "and no transaction was ever opened, because `this.postDirectly()` "
                        + "never goes through the proxy");
        assertFalse(manager.inTransaction());
    }

    @Test
    @DisplayName("the same method called through the proxy does open a transaction")
    void theProxyWorksWhenItIsActuallyUsed() {
        TransactionManager manager = new TransactionManager();
        Ledger ledger = manager.proxy(Ledger.class, new LedgerService());

        ledger.postDirectly("txn_1");

        assertEquals(List.of("begin", "commit"), manager.journal());
    }

    @Test
    @DisplayName("a checked exception commits under the default rollbackFor")
    void checkedExceptionCommits() {
        TransactionManager manager = new TransactionManager();
        Ledger ledger = manager.proxy(Ledger.class, new LedgerService());

        assertThrows(Ledger.AccountClosed.class, () -> ledger.postThenThrowChecked("txn_1"));

        assertEquals(1, ledger.written(),
                "the entry is still there: the caller saw a failure and the database "
                        + "kept the write");
        assertEquals(List.of("begin", "commit despite AccountClosed"), manager.journal());
    }

    @Test
    @DisplayName("naming the checked exception in rollbackFor fixes it")
    void rollbackForFixesIt() {
        TransactionManager manager = new TransactionManager();
        Ledger ledger = manager.proxy(Ledger.class, new LedgerService());

        assertThrows(Ledger.AccountClosed.class,
                () -> ledger.postThenThrowCheckedWithRollbackFor("txn_1"));

        assertEquals(List.of("begin", "rollback: AccountClosed"), manager.journal());
    }

    @Test
    @DisplayName("a runtime exception rolls back without being asked")
    void runtimeExceptionRollsBack() {
        TransactionManager manager = new TransactionManager();
        Ledger ledger = manager.proxy(Ledger.class, new ThrowingLedger());

        assertThrows(IllegalStateException.class, () -> ledger.postDirectly("txn_1"));
        assertTrue(manager.journal().get(1).startsWith("rollback"));
    }

    /**
     * Its own class rather than an anonymous subclass, because LedgerService is
     * final: a class that is not designed to be extended says so, and a test that
     * wants different behaviour implements the interface instead.
     */
    static final class ThrowingLedger implements Ledger {

        @Override
        public void postWithInternalCall(String reference) {
            postDirectly(reference);
        }

        @Override
        @Transactional
        public void postDirectly(String reference) {
            throw new IllegalStateException("something went wrong");
        }

        @Override
        @Transactional
        public void postThenThrowChecked(String reference) throws AccountClosed {
            throw new AccountClosed("not used here");
        }

        @Override
        @Transactional(rollbackFor = AccountClosed.class)
        public void postThenThrowCheckedWithRollbackFor(String reference)
                throws AccountClosed {
            throw new AccountClosed("not used here");
        }

        @Override
        public int written() {
            return 0;
        }
    }
}
