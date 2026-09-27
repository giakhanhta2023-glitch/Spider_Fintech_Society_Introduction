package finquest.api;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import finquest.card.PaymentEvent;
import finquest.money.Currency;
import finquest.money.CurrencyMismatch;
import finquest.money.Money;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The level 7 contract, on the JDK's built in HTTP server.
 *
 * <p><b>Why not Spring Boot.</b> There is no Maven on the machine this was written
 * on and no way to resolve Spring's dependency tree, so a Spring service here would
 * be code nobody had compiled. The Spring version of this controller, its
 * {@code @ControllerAdvice} and its Testcontainers test are in {@code spring/},
 * written and explicitly not built, and {@code README.md} says which is which. This
 * module runs, and its tests run against it over real HTTP.
 *
 * <p>What is the same either way: the routes, the status codes, the idempotency
 * behaviour, the cursor paging and the single error shape. What Spring would add is
 * the dependency injection and the annotation driven transaction management, and the
 * traps in the second of those are demonstrated in
 * {@code finquest.tx.TransactionalTraps} with a real proxy rather than described.
 *
 * <p>One executor choice worth reading: the server runs on virtual threads. A
 * platform thread pool of 200 is the Spring Boot default and it is a queue with a
 * ceiling; virtual threads make the ceiling the database pool instead, which is
 * where it belongs. {@code bench/VirtualThreads.java} measures both.
 */
public final class PaymentApi {

    private static final Pattern PAYMENT_PATH = Pattern.compile("^/payments/([a-z0-9_]+)$");
    private static final Pattern ACTION_PATH =
            Pattern.compile("^/payments/([a-z0-9_]+)/(capture|refund|void)$");

    private final PaymentStore store;
    private final HttpServer server;
    private final ExecutorService executor;
    private final long dependencyMillis;

    public PaymentApi(PaymentStore store, int port, boolean virtualThreads) throws IOException {
        this(store, port, virtualThreads, 0L);
    }

    /**
     * @param dependencyMillis how long the simulated database call blocks for. Zero
     *     means a purely CPU bound handler, which is what the level 7 contract is
     *     here; a non zero value is what a real handler does while it waits for
     *     Postgres, and it is the case virtual threads exist for. The benchmark
     *     measures both, because the answer is different and most write ups only
     *     measure the flattering one.
     */
    public PaymentApi(PaymentStore store, int port, boolean virtualThreads,
            long dependencyMillis) throws IOException {
        this.store = store;
        this.dependencyMillis = dependencyMillis;
        this.executor = virtualThreads
                ? Executors.newVirtualThreadPerTaskExecutor()
                : Executors.newFixedThreadPool(200);
        // A real accept backlog. `0` means the operating system default, which on
        // Windows is small enough that a thousand concurrent connections produce
        // ConnectException before the executor is ever the constraint: the first
        // virtual thread benchmark measured that and read it as a latency result.
        this.server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 1024);
        this.server.setExecutor(executor);
        this.server.createContext("/", this::route);
    }

    public void start() {
        server.start();
    }

    public void stop() {
        server.stop(0);
        executor.shutdownNow();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    // ------------------------------------------------------------- routing
    private void route(HttpExchange exchange) throws IOException {
        try {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();

            if (path.equals("/healthz") && method.equals("GET")) {
                respond(exchange, 200, "{\"status\":\"live\"}");
                return;
            }
            if (path.equals("/payments") && method.equals("POST")) {
                createPayment(exchange);
                return;
            }
            if (path.equals("/payments") && method.equals("GET")) {
                listPayments(exchange);
                return;
            }

            Matcher action = ACTION_PATH.matcher(path);
            if (action.matches() && method.equals("POST")) {
                applyEvent(exchange, action.group(1), action.group(2));
                return;
            }

            Matcher single = PAYMENT_PATH.matcher(path);
            if (single.matches() && method.equals("GET")) {
                getPayment(exchange, single.group(1));
                return;
            }

            error(exchange, 404, "not_found", "no route for " + method + " " + path);
        } catch (PaymentStore.NotFound notFound) {
            error(exchange, 404, "not_found", notFound.getMessage());
        } catch (PaymentStore.BadRequest badRequest) {
            error(exchange, 400, "bad_request", badRequest.getMessage());
        } catch (CurrencyMismatch mismatch) {
            error(exchange, 422, "currency_mismatch", mismatch.getMessage());
        } catch (IllegalArgumentException | ArithmeticException invalid) {
            error(exchange, 422, "invalid_amount", invalid.getMessage());
        } catch (finquest.card.IllegalTransition transition) {
            // 409 rather than 400: the request is well formed and the payment is in
            // the wrong state for it, which is a different thing and a different fix.
            error(exchange, 409, "illegal_transition", transition.getMessage());
        } catch (RuntimeException unexpected) {
            // One place, one shape, and the detail never reaches the client: an
            // exception message can contain anything, including a connection string.
            error(exchange, 500, "internal_error", "the request could not be completed");
        }
    }

    private void createPayment(HttpExchange exchange) throws IOException {
        Map<String, String> body = parse(readBody(exchange));
        block();
        String key = header(exchange, "Idempotency-Key")
                .orElseThrow(() -> new PaymentStore.BadRequest("Idempotency-Key is required"));

        String merchantId = required(body, "merchant_id");
        long minor = Long.parseLong(required(body, "amount_minor"));
        if (minor <= 0) {
            throw new IllegalArgumentException("amount_minor must be positive");
        }
        Currency currency = Currency.valueOf(body.getOrDefault("currency", "USD"));

        PaymentStore.Created created = store.takePayment(
                merchantId, Money.of(minor, currency), body.getOrDefault("token", "tok_test"), key);

        // 201 for a new payment, 200 for a replay. The body is identical, which is
        // the property that makes a retry safe, and the status is the only way a
        // client can tell that its retry was a retry.
        respond(exchange, created.isNew() ? 201 : 200, json(created.payment()));
    }

    private void getPayment(HttpExchange exchange, String id) throws IOException {
        Payment payment = store.byId(id)
                .orElseThrow(() -> new PaymentStore.NotFound("no such payment: " + id));
        respond(exchange, 200, json(payment));
    }

    private void applyEvent(HttpExchange exchange, String id, String action) throws IOException {
        PaymentEvent event = switch (action) {
            case "capture" -> PaymentEvent.CAPTURE;
            case "refund" -> PaymentEvent.REFUND;
            case "void" -> PaymentEvent.VOID;
            default -> throw new PaymentStore.BadRequest("unknown action: " + action);
        };
        respond(exchange, 200, json(store.apply(id, event)));
    }

    private void listPayments(HttpExchange exchange) throws IOException {
        Map<String, String> query = parseQuery(exchange.getRequestURI().getRawQuery());
        String merchantId = query.get("merchant_id");
        if (merchantId == null) {
            throw new PaymentStore.BadRequest("merchant_id is required");
        }
        int limit = Integer.parseInt(query.getOrDefault("limit", "25"));
        if (limit < 1 || limit > 100) {
            throw new PaymentStore.BadRequest("limit must be between 1 and 100");
        }
        PaymentStore.Page page = store.page(merchantId, query.get("cursor"), limit);

        StringBuilder out = new StringBuilder("{\"data\":[");
        for (int i = 0; i < page.payments().size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(json(page.payments().get(i)));
        }
        out.append("],\"meta\":{\"count\":").append(page.payments().size())
                .append(",\"next_cursor\":")
                .append(page.nextCursor() == null ? "null" : "\"" + page.nextCursor() + "\"")
                .append("}}");
        respond(exchange, 200, out.toString());
    }

    /**
     * The simulated dependency: a blocking wait, which is what a database call is.
     *
     * <p>`Thread.sleep` inside a virtual thread unmounts it from its carrier, which
     * is the entire mechanism: a thousand waiting virtual threads cost a thousand
     * continuations and no platform threads, while a thousand waiting platform
     * threads cost a thousand stacks and a scheduler that has to deal with them.
     */
    private void block() {
        if (dependencyMillis <= 0) {
            return;
        }
        try {
            Thread.sleep(dependencyMillis);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    // ------------------------------------------------------------ plumbing
    private static String json(Payment payment) {
        return "{\"id\":\"" + payment.id() + "\""
                + ",\"merchant_id\":\"" + payment.merchantId() + "\""
                + ",\"amount_minor\":" + payment.amount().minor()
                + ",\"fee_minor\":" + payment.fee().minor()
                + ",\"net_minor\":" + payment.net().minor()
                + ",\"currency\":\"" + payment.amount().currency() + "\""
                + ",\"state\":\"" + payment.state() + "\""
                + ",\"token\":\"" + payment.token() + "\"}";
    }

    private static void error(HttpExchange exchange, int status, String code, String detail)
            throws IOException {
        respond(exchange, status,
                "{\"error\":{\"code\":\"" + code + "\",\"detail\":\"" + detail + "\"}}");
    }

    private static void respond(HttpExchange exchange, int status, String body)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream in = exchange.getRequestBody()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static Optional<String> header(HttpExchange exchange, String name) {
        return Optional.ofNullable(exchange.getRequestHeaders().getFirst(name));
    }

    private static String required(Map<String, String> body, String field) {
        String value = body.get(field);
        if (value == null || value.isBlank()) {
            throw new PaymentStore.BadRequest(field + " is required");
        }
        return value;
    }

    /**
     * A deliberately small JSON reader for flat objects of strings and numbers.
     *
     * <p>Not a JSON library, because there is no dependency resolution here, and the
     * request body of this contract is four fields. A real service uses Jackson, and
     * the trade is written down rather than hidden: this parser would be the wrong
     * choice the moment a nested object appears.
     */
    private static Map<String, String> parse(String body) {
        Map<String, String> out = new java.util.LinkedHashMap<>();
        Matcher matcher = Pattern
                .compile("\"([a-z_]+)\"\\s*:\\s*(?:\"([^\"]*)\"|([0-9]+))")
                .matcher(body);
        while (matcher.find()) {
            out.put(matcher.group(1),
                    matcher.group(2) != null ? matcher.group(2) : matcher.group(3));
        }
        return out;
    }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> out = new java.util.LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        for (String pair : raw.split("&")) {
            int equals = pair.indexOf('=');
            if (equals > 0) {
                out.put(pair.substring(0, equals),
                        java.net.URLDecoder.decode(pair.substring(equals + 1),
                                StandardCharsets.UTF_8));
            }
        }
        return out;
    }
}
