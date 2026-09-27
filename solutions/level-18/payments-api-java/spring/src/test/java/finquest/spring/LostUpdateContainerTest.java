package finquest.spring;

/*
 * The level 8 race against a real Postgres. Never run: see NOT_BUILT.md, and
 * docs/lost-update.md for the version that was run and what it proved.
 *
 * Why Testcontainers rather than an in memory database: H2 and SQLite do not
 * implement `select ... for update` the way Postgres does, and the whole question
 * here is what the database does under concurrency. A test that passes on H2 and
 * ships the bug is worse than no test, and this is the single most common place that
 * happens.
 *
 * `disabledWithoutDocker = true` so the test skips loudly rather than passing
 * quietly on a machine with no container runtime, which is this one.
 */

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class LostUpdateContainerTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    DataSource dataSource;

    JdbcTemplate jdbc;

    private static final int THREADS = 16;
    private static final int PER_THREAD = 50;

    @BeforeEach
    void schema() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("drop table if exists accounts");
        jdbc.execute("""
                create table accounts (
                  id      text primary key,
                  balance bigint not null,
                  version bigint not null default 0
                )""");
        jdbc.update("insert into accounts (id, balance) values ('acct_1', 0)");
    }

    private void hammer(Runnable deposit) throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(THREADS)) {
            CountDownLatch start = new CountDownLatch(1);
            for (int t = 0; t < THREADS; t++) {
                pool.submit(() -> {
                    start.await();
                    for (int i = 0; i < PER_THREAD; i++) {
                        deposit.run();
                    }
                    return null;
                });
            }
            start.countDown();
            pool.shutdown();
            assertThat(pool.awaitTermination(60, TimeUnit.SECONDS)).isTrue();
        }
    }

    private long balance() {
        return jdbc.queryForObject("select balance from accounts where id = 'acct_1'",
                Long.class);
    }

    @Test
    @DisplayName("read, add, write in separate statements loses updates")
    void theRaceReproduces() throws Exception {
        hammer(() -> {
            Long current = jdbc.queryForObject(
                    "select balance from accounts where id = 'acct_1'", Long.class);
            jdbc.update("update accounts set balance = ? where id = 'acct_1'",
                    current + 1);
        });

        assertThat(balance())
                .as("expected to lose updates against a real Postgres")
                .isLessThan((long) THREADS * PER_THREAD);
    }

    @Test
    @DisplayName("select for update fixes it: the row is held for the whole decision")
    void pessimisticFix() throws Exception {
        hammer(() -> new org.springframework.transaction.support.TransactionTemplate(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(dataSource))
                .execute(status -> {
                    Long current = jdbc.queryForObject(
                            "select balance from accounts where id = 'acct_1' for update",
                            Long.class);
                    jdbc.update("update accounts set balance = ? where id = 'acct_1'",
                            current + 1);
                    return null;
                }));

        assertThat(balance()).isEqualTo((long) THREADS * PER_THREAD);
    }

    @Test
    @DisplayName("a version column fixes it too, and the retries are the price")
    void optimisticFix() throws Exception {
        hammer(() -> {
            while (true) {
                var row = jdbc.queryForMap(
                        "select balance, version from accounts where id = 'acct_1'");
                long balance = ((Number) row.get("balance")).longValue();
                long version = ((Number) row.get("version")).longValue();
                int updated = jdbc.update("""
                        update accounts set balance = ?, version = version + 1
                         where id = 'acct_1' and version = ?""", balance + 1, version);
                // Zero rows means somebody else wrote first. An application that
                // ignores this count has optimistic locking in the schema and none
                // in the behaviour.
                if (updated == 1) {
                    return;
                }
            }
        });

        assertThat(balance()).isEqualTo((long) THREADS * PER_THREAD);
    }
}
