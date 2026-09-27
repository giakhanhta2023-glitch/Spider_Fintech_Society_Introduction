package finquest.bench;

import finquest.api.PaymentApi;
import finquest.api.PaymentStore;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Virtual threads on and off, at several concurrency levels.
 *
 * <pre>
 *   java -cp target/classes finquest.bench.VirtualThreads
 * </pre>
 *
 * <p>What is being compared: the same service, the same handler, the same work, with
 * the server's executor as either a fixed pool of 200 platform threads, which is the
 * Spring Boot default shape, or one virtual thread per request.
 *
 * <p>What to expect, and why the expectation matters more than the number: virtual
 * threads help when threads are <b>blocked</b> rather than busy. This handler holds a
 * lock for microseconds and does no I/O, so at low concurrency there is nothing to
 * win. The interesting column is the highest concurrency, where a pool of 200 is a
 * queue and a virtual thread per request is not.
 *
 * <p>Every number is printed with the JVM version and the processor count, because a
 * benchmark without its conditions is an anecdote.
 */
public final class VirtualThreads {

    private static final int[] CONCURRENCY = {1, 8, 64, 256, 1_000};
    private static final int REQUESTS_PER_LEVEL = 4_000;
    private static final int WARMUP_REQUESTS = 3_000;

    /** The blocking phase: fewer requests, because each one waits. */
    private static final int BLOCKING_REQUESTS_PER_LEVEL = 2_000;
    private static final long DEPENDENCY_MILLIS = 20;

    private VirtualThreads() {
    }

    public static void main(String[] args) throws Exception {
        System.out.printf("JVM %s on %s, %d processors%n",
                System.getProperty("java.version"),
                System.getProperty("os.name"),
                Runtime.getRuntime().availableProcessors());
        System.out.printf("%d requests per level, after %d warm up requests%n%n",
                REQUESTS_PER_LEVEL, WARMUP_REQUESTS);

        String firstFailure = null;

        System.out.printf("phase 1: a CPU bound handler, %,d requests per level%n",
                REQUESTS_PER_LEVEL);
        firstFailure = table(0L, REQUESTS_PER_LEVEL, firstFailure);

        System.out.printf("%nphase 2: the same handler waiting %d ms on a simulated "
                + "database, %,d requests per level%n", DEPENDENCY_MILLIS,
                BLOCKING_REQUESTS_PER_LEVEL);
        firstFailure = table(DEPENDENCY_MILLIS, BLOCKING_REQUESTS_PER_LEVEL, firstFailure);

        if (firstFailure != null) {
            System.out.printf("%nthe first failure, of the ones counted above: %s%n",
                    firstFailure);
        }

        System.out.println();
        System.out.println("Phase 1 is the honest disappointment: nothing blocks, so virtual");
        System.out.println("threads have nothing to win and their scheduling shows up as a");
        System.out.println("cost. A fixed pool of 200 is also admission control, which is why");
        System.out.println("it holds up better at a thousand concurrent requests.");
        System.out.println();
        System.out.println("Phase 2 is what they are for. With every request waiting 20 ms on");
        System.out.println("a dependency, a pool of 200 is a hard ceiling of 10,000 requests a");
        System.out.println("second in theory and a queue in practice, and a virtual thread per");
        System.out.println("request has no such ceiling.");
    }

    private static String table(long dependencyMillis, int requests, String firstFailure)
            throws Exception {
        System.out.printf("%12s  %14s  %10s  %10s  %10s  %9s%n",
                "concurrency", "executor", "p50 ms", "p99 ms", "req/s", "failed");

        for (int concurrency : CONCURRENCY) {
            for (boolean virtual : new boolean[] {false, true}) {
                Result result = measure(concurrency, virtual, dependencyMillis, requests);
                System.out.printf("%12d  %14s  %10.2f  %10.2f  %10.0f  %8.1f%%%n",
                        concurrency,
                        virtual ? "virtual" : "platform 200",
                        result.p50(), result.p99(), result.perSecond(),
                        result.failureRate() * 100);
                if (firstFailure == null && result.firstFailure() != null) {
                    firstFailure = result.firstFailure();
                }
            }
        }
        return firstFailure;
    }

    private record Result(List<Double> latencies, double seconds, int failures,
            String firstFailure) {

        double p50() {
            return percentile(50);
        }

        double p99() {
            return percentile(99);
        }

        double percentile(double p) {
            List<Double> sorted = new ArrayList<>(latencies);
            Collections.sort(sorted);
            return sorted.get(Math.min((int) (sorted.size() * p / 100), sorted.size() - 1));
        }

        double perSecond() {
            return latencies.size() / seconds;
        }

        double failureRate() {
            int total = latencies.size() + failures;
            return total == 0 ? 0 : (double) failures / total;
        }
    }

    private static Result measure(int concurrency, boolean virtual, long dependencyMillis,
            int requests) throws Exception {
        PaymentApi api = new PaymentApi(new PaymentStore(), 0, virtual, dependencyMillis);
        api.start();
        String base = "http://127.0.0.1:" + api.port();
        HttpClient client = HttpClient.newBuilder()
                .executor(Executors.newVirtualThreadPerTaskExecutor())
                .connectTimeout(Duration.ofSeconds(5))
                .build();

        try {
            // Warm up, and discard it. The JVM interprets first and compiles the hot
            // path as it runs, so a short measurement without a warm up is a
            // measurement of the interpreter. This is the single most common way a
            // JVM benchmark misleads.
            int warmup = dependencyMillis > 0 ? 500 : WARMUP_REQUESTS;
            fire(client, base, warmup, Math.min(concurrency, 64),
                    new AtomicInteger(), new Failures());

            AtomicInteger counter = new AtomicInteger();
            Failures failures = new Failures();
            long started = System.nanoTime();
            List<Double> latencies =
                    fire(client, base, requests, concurrency, counter, failures);
            double seconds = (System.nanoTime() - started) / 1e9;
            return new Result(latencies, seconds, failures.count.get(), failures.first);
        } finally {
            api.stop();
        }
    }

    /**
     * Failures, counted and named rather than folded into the latency numbers.
     *
     * <p>The first version of this benchmark recorded a failed request as a 10,000 ms
     * latency, so the p99 at high concurrency read exactly 10000.00 and looked like a
     * measurement. It was a marker for "this request did not happen", and mixing the
     * two is how a load test reports a latency for requests that were refused.
     */
    private static final class Failures {
        private final AtomicInteger count = new AtomicInteger();
        private volatile String first;

        void record(Exception failure) {
            count.incrementAndGet();
            if (first == null) {
                first = failure.getClass().getSimpleName() + ": " + failure.getMessage();
            }
        }
    }

    private static List<Double> fire(HttpClient client, String base, int requests,
            int concurrency, AtomicInteger sequence, Failures failures) throws Exception {
        List<Double> latencies = Collections.synchronizedList(new ArrayList<>(requests));
        try (ExecutorService pool = Executors.newFixedThreadPool(concurrency)) {
            CountDownLatch done = new CountDownLatch(requests);
            for (int i = 0; i < requests; i++) {
                pool.submit(() -> {
                    long start = System.nanoTime();
                    try {
                        HttpRequest request = HttpRequest.newBuilder(URI.create(base + "/payments"))
                                .timeout(Duration.ofSeconds(10))
                                .header("Content-Type", "application/json")
                                .header("Idempotency-Key", "idem_" + sequence.incrementAndGet())
                                .POST(HttpRequest.BodyPublishers.ofString(
                                        "{\"merchant_id\":\"mer_0001\",\"amount_minor\":1999}"))
                                .build();
                        client.send(request, HttpResponse.BodyHandlers.discarding());
                        latencies.add((System.nanoTime() - start) / 1e6);
                    } catch (IOException | InterruptedException failure) {
                        // Counted as a failure with its reason, and kept out of the
                        // latency percentiles. Both halves matter: a failure is not a
                        // slow success, and a benchmark that hides failures reports a
                        // healthy p99 during an outage.
                        failures.record(failure);
                    } finally {
                        done.countDown();
                    }
                });
            }
            if (!done.await(120, TimeUnit.SECONDS)) {
                throw new IllegalStateException("the load did not finish in two minutes");
            }
        }
        return new ArrayList<>(latencies);
    }
}
