package finquest.race;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Level 8's lost update, reproduced with real threads, then fixed three ways.
 *
 * <p><b>What this is and is not.</b> The level asks for the race against a real
 * Postgres through Testcontainers. Testcontainers needs Docker and there is none on
 * this machine, so this reproduces the race in the JVM against a shared balance,
 * which is the same race with the same three fixes and none of the SQL. The SQL
 * versions were run against PostgreSQL 18.6 and are recorded in
 * {@code docs/lost-update.md} with their output; the Testcontainers test is in
 * {@code spring/} and has never been run. That split is stated in the README rather
 * than blurred.
 *
 * <p>The race: read a balance, decide, write it back. Two threads interleave between
 * the read and the write, and one update is lost with no error anywhere.
 */
class LostUpdateTest {

    private static final int THREADS = 16;
    private static final int PER_THREAD = 200;
    private static final int STARTING_BALANCE = 0;

    /**
     * The bug: read, add, write, with nothing holding the pair together.
     *
     * <p>{@code Thread.yield()} between the read and the write rather than
     * {@code onSpinWait()}. The first version used the spin hint, which the JIT is
     * free to compile to nothing, and the race then failed to reproduce in eight
     * attempts about one suite run in three. A yield asks the scheduler to run
     * somebody else, which is what opens the window reliably.
     *
     * <p>The yield does not cause the bug. Without it the race still happens and
     * less often, which is worse: it then happens in production instead of in a
     * test.
     */
    static final class UnsafeBalance {
        private long balance = STARTING_BALANCE;

        void deposit(long amount) {
            long current = balance;          // read
            Thread.yield();                  // the window, made reliable
            balance = current + amount;      // write, based on a value that has moved
        }

        long balance() {
            return balance;
        }
    }

    /** Fix one: a lock around the read and the write. Postgres: SELECT FOR UPDATE. */
    static final class LockedBalance {
        private final ReentrantLock lock = new ReentrantLock();
        private long balance = STARTING_BALANCE;

        void deposit(long amount) {
            lock.lock();
            try {
                long current = balance;
                Thread.onSpinWait();
                balance = current + amount;
            } finally {
                lock.unlock();
            }
        }

        long balance() {
            return balance;
        }
    }

    /**
     * Fix two: compare and set, retrying on conflict. Postgres: a version column
     * and {@code where version = ?}, which is optimistic locking.
     */
    static final class OptimisticBalance {
        private final AtomicLong balance = new AtomicLong(STARTING_BALANCE);
        private final AtomicInteger retries = new AtomicInteger();

        void deposit(long amount) {
            while (true) {
                long current = balance.get();
                Thread.yield();
                if (balance.compareAndSet(current, current + amount)) {
                    return;
                }
                retries.incrementAndGet();   // the cost of being optimistic
            }
        }

        long balance() {
            return balance.get();
        }

        int retries() {
            return retries.get();
        }
    }

    private static void hammer(Runnable deposit) throws InterruptedException {
        try (ExecutorService pool = Executors.newFixedThreadPool(THREADS)) {
            CountDownLatch start = new CountDownLatch(1);
            for (int t = 0; t < THREADS; t++) {
                pool.submit(() -> {
                    try {
                        start.await();
                    } catch (InterruptedException interrupted) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                    for (int i = 0; i < PER_THREAD; i++) {
                        deposit.run();
                    }
                });
            }
            start.countDown();               // every thread starts at once
            pool.shutdown();
            assertTrue(pool.awaitTermination(30, TimeUnit.SECONDS));
        }
    }

    private static final long EXPECTED = (long) THREADS * PER_THREAD;

    /** Attempts before giving up on a race showing itself. See the test below. */
    private static final int ATTEMPTS = 8;

    @Test
    @DisplayName("the lost update reproduces: money disappears with no error")
    void theRaceReproduces() throws InterruptedException {
        // Retried, because a race is a race. The first version of this test ran the
        // experiment once and asserted that money was lost, and it failed about one
        // run in four: with the rest of the suite loading the machine, the scheduler
        // sometimes runs the sixteen threads nearly sequentially and nothing
        // interleaves. A flaky test proving a real bug is worse than no test,
        // because it teaches people to re-run the suite.
        //
        // What is asserted is therefore: in at most eight attempts, money vanished
        // and nothing complained. A machine where that never happens in eight
        // attempts is one where this code would still be wrong and the window is
        // simply closed, and that is worth failing on.
        long worst = EXPECTED;
        int attempt = 0;
        while (attempt < ATTEMPTS && worst == EXPECTED) {
            attempt++;
            UnsafeBalance unsafe = new UnsafeBalance();
            hammer(() -> unsafe.deposit(1));
            worst = Math.min(worst, unsafe.balance());
        }

        assertTrue(worst < EXPECTED,
                "no updates were lost in " + ATTEMPTS + " attempts, which means the "
                        + "window never opened rather than that the code is safe");
        System.out.printf("lost update: %d of %d deposits survived (%.1f%% lost) "
                        + "on attempt %d of %d%n",
                worst, EXPECTED, 100.0 * (EXPECTED - worst) / EXPECTED, attempt, ATTEMPTS);
    }

    @Test
    @DisplayName("pessimistic locking fixes it: SELECT FOR UPDATE, in the JVM")
    void pessimisticFix() throws InterruptedException {
        LockedBalance locked = new LockedBalance();
        hammer(() -> locked.deposit(1));
        assertEquals(EXPECTED, locked.balance());
    }

    @Test
    @DisplayName("optimistic locking fixes it too, and the retries are the price")
    void optimisticFix() throws InterruptedException {
        // The balance is asserted every attempt, because that must always hold. The
        // retry count is the thing that needs contention to appear at all, so it is
        // given the same eight attempts as the race above.
        int retries = 0;
        int attempt = 0;
        while (attempt < ATTEMPTS && retries == 0) {
            attempt++;
            OptimisticBalance optimistic = new OptimisticBalance();
            hammer(() -> optimistic.deposit(1));
            assertEquals(EXPECTED, optimistic.balance(),
                    "compare and set must never lose a deposit, contention or not");
            retries = optimistic.retries();
        }

        assertTrue(retries > 0,
                "no retries in " + ATTEMPTS + " attempts means no contention, so this "
                        + "measured nothing about optimistic locking under load");
        System.out.printf("optimistic: %d retries for %d deposits on attempt %d of %d%n",
                retries, EXPECTED, attempt, ATTEMPTS);
    }

    @Test
    @DisplayName("and the one line that avoids the question entirely")
    void doTheArithmeticInTheDatabase() throws InterruptedException {
        // `update accounts set balance = balance + 1 where id = ?` has no read, so
        // there is no window to lose an update in. In the JVM the equivalent is an
        // atomic add. It is the best fix when it is available, and it is not
        // available when the new value depends on a decision rather than on
        // arithmetic, which is why the other two exist.
        AtomicLong atomic = new AtomicLong();
        hammer(() -> atomic.incrementAndGet());
        assertEquals(EXPECTED, atomic.get());
    }

    @Test
    @DisplayName("the three fixes agree about the final balance")
    void allFixesAgree() throws InterruptedException {
        LockedBalance locked = new LockedBalance();
        OptimisticBalance optimistic = new OptimisticBalance();
        AtomicLong atomic = new AtomicLong();

        hammer(() -> locked.deposit(1));
        hammer(() -> optimistic.deposit(1));
        hammer(() -> atomic.incrementAndGet());

        assertEquals(List.of(EXPECTED, EXPECTED, EXPECTED),
                List.of(locked.balance(), optimistic.balance(), atomic.get()));
    }
}
