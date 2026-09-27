package finquest.bench;

import finquest.api.PaymentApi;
import finquest.api.PaymentStore;
import finquest.money.Currency;
import finquest.money.Money;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * The warm up curve, measured twice, because the first attempt measured the wrong
 * thing and finding that out is the point of the file.
 *
 * <pre>
 *   java -cp target/classes finquest.bench.WarmUp
 * </pre>
 *
 * <p>The JVM interprets bytecode at first and compiles the hot paths as it runs, so
 * the first requests after a deploy are slower than the same requests a minute
 * later. A deploy that does not know that will send a new instance full production
 * traffic while it is at its slowest, and a canary window shorter than the curve
 * compares a warm old version against a cold new one.
 *
 * <p><b>Two phases, because the first version of this file only had the second and
 * concluded nothing.</b> Over HTTP on loopback, the p50 was 5 ms and the p99 was
 * 39 ms with no downward trend at all: those numbers are the socket, not the
 * compiler, and 39 ms next to 40 ms is the signature of delayed acknowledgement
 * meeting Nagle's algorithm. The JIT effect was real and two orders of magnitude
 * smaller than the noise it was hiding under.
 *
 * <p>So phase one measures the handler in process, where the compiler is the only
 * variable and the curve is visible, and phase two measures it over HTTP, where the
 * transport dominates. Both are true and they answer different questions: the first
 * is how long the JVM takes to get fast, and the second is what a client sees.
 */
public final class WarmUp {

    private static final int BUCKETS = 12;
    private static final int HANDLER_CALLS_PER_BUCKET = 20_000;
    private static final int HTTP_REQUESTS_PER_BUCKET = 400;

    private WarmUp() {
    }

    public static void main(String[] args) throws Exception {
        System.out.printf("JVM %s, %d processors%n%n",
                System.getProperty("java.version"),
                Runtime.getRuntime().availableProcessors());

        handlerCurve();
        System.out.println();
        httpCurve();
    }

    /** Phase one: the handler, in process. The compiler is the only variable. */
    private static void handlerCurve() {
        System.out.printf("phase 1: the handler in process, %,d calls per bucket%n",
                HANDLER_CALLS_PER_BUCKET);
        System.out.printf("%8s  %12s  %12s  %12s%n", "bucket", "p50 us", "p99 us", "max us");

        PaymentStore store = new PaymentStore();
        Money amount = Money.of(1999, Currency.USD);
        List<Double> first = null;
        List<Double> last = null;
        long started = System.nanoTime();

        for (int bucket = 0; bucket < BUCKETS; bucket++) {
            List<Double> micros = new ArrayList<>(HANDLER_CALLS_PER_BUCKET);
            for (int i = 0; i < HANDLER_CALLS_PER_BUCKET; i++) {
                long start = System.nanoTime();
                store.takePayment("mer_0001", amount, "tok_test",
                        "idem_h_" + bucket + "_" + i);
                micros.add((System.nanoTime() - start) / 1_000.0);
            }
            Collections.sort(micros);
            if (first == null) {
                first = micros;
            }
            last = micros;
            System.out.printf("%8d  %12.2f  %12.2f  %12.2f%n",
                    bucket + 1,
                    micros.get(micros.size() / 2),
                    micros.get((int) (micros.size() * 0.99)),
                    micros.get(micros.size() - 1));
        }

        double firstP50 = first.get(first.size() / 2);
        double lastP50 = last.get(last.size() / 2);
        double firstP99 = first.get((int) (first.size() * 0.99));
        double lastP99 = last.get((int) (last.size() * 0.99));
        System.out.printf("%np50 %.2f us to %.2f us (%.1fx), p99 %.2f us to %.2f us "
                        + "(%.1fx), over %.1f seconds%n",
                firstP50, lastP50, firstP50 / lastP50,
                firstP99, lastP99, firstP99 / lastP99,
                (System.nanoTime() - started) / 1e9);
    }

    /** Phase two: the same work over HTTP, which is what a client experiences. */
    private static void httpCurve() throws Exception {
        PaymentApi api = new PaymentApi(new PaymentStore(), 0, true);
        api.start();
        String base = "http://127.0.0.1:" + api.port();
        HttpClient client = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(2))
                .build();

        System.out.printf("phase 2: the same work over loopback HTTP, %d requests per bucket%n",
                HTTP_REQUESTS_PER_BUCKET);
        System.out.printf("%8s  %12s  %12s  %12s%n", "bucket", "p50 ms", "p99 ms", "max ms");

        List<Double> first = null;
        List<Double> last = null;

        try {
            for (int bucket = 0; bucket < BUCKETS; bucket++) {
                List<Double> millis = new ArrayList<>(HTTP_REQUESTS_PER_BUCKET);
                for (int i = 0; i < HTTP_REQUESTS_PER_BUCKET; i++) {
                    long start = System.nanoTime();
                    HttpRequest request = HttpRequest.newBuilder(URI.create(base + "/payments"))
                            .timeout(Duration.ofSeconds(10))
                            .header("Content-Type", "application/json")
                            .header("Idempotency-Key", "idem_n_" + bucket + "_" + i)
                            .POST(HttpRequest.BodyPublishers.ofString(
                                    "{\"merchant_id\":\"mer_0001\",\"amount_minor\":1999}"))
                            .build();
                    client.send(request, HttpResponse.BodyHandlers.discarding());
                    millis.add((System.nanoTime() - start) / 1e6);
                }
                Collections.sort(millis);
                if (first == null) {
                    first = millis;
                }
                last = millis;
                System.out.printf("%8d  %12.3f  %12.3f  %12.3f%n",
                        bucket + 1,
                        millis.get(millis.size() / 2),
                        millis.get((int) (millis.size() * 0.99)),
                        millis.get(millis.size() - 1));
            }
        } finally {
            api.stop();
        }

        double firstP50 = first.get(first.size() / 2);
        double lastP50 = last.get(last.size() / 2);
        System.out.printf("%np50 %.3f ms to %.3f ms. Compare with phase 1: the handler is%n",
                firstP50, lastP50);
        System.out.println("microseconds and the request is milliseconds, so what a client");
        System.out.println("sees here is almost entirely loopback socket behaviour. The p99");
        System.out.println("sitting near 40 ms is delayed acknowledgement meeting Nagle.");
        System.out.println();
        System.out.println("The readiness delay and the canary window come from phase 1, and");
        System.out.println("the reason to measure phase 2 as well is to find out that the");
        System.out.println("number you were about to quote was the network.");
    }
}
