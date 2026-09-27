package finquest.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The level 7 contract, over real HTTP, against the running service.
 *
 * <p>The level asks for the Python integration suite to pass against this service
 * with only the base URL changed. These are the same assertions in Java: the same
 * routes, the same status codes, the same idempotency behaviour and the same error
 * shape. Running the Python suite itself against this process is a line in the
 * README and needs both languages on the same machine, which is exactly what the
 * benchmark does.
 */
class PaymentApiTest {

    private PaymentApi api;
    private HttpClient client;
    private String base;

    @BeforeEach
    void start() throws IOException {
        api = new PaymentApi(new PaymentStore(), 0, true);
        api.start();
        base = "http://127.0.0.1:" + api.port();
        client = HttpClient.newBuilder()
                // A timeout on the client as well as the server, because level 14's
                // lesson applies to test clients too: a hung request in a suite is a
                // suite that hangs.
                .connectTimeout(Duration.ofSeconds(2))
                .build();
    }

    @AfterEach
    void stop() {
        api.stop();
    }

    private HttpResponse<String> post(String path, String body, String key)
            throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(base + path))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
        if (key != null) {
            request.header("Idempotency-Key", key);
        }
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> get(String path) throws IOException, InterruptedException {
        return client.send(
                HttpRequest.newBuilder(URI.create(base + path))
                        .timeout(Duration.ofSeconds(5)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private static String payment(long minor) {
        return "{\"merchant_id\":\"mer_0001\",\"amount_minor\":" + minor + "}";
    }

    @Test
    @DisplayName("a payment is created with 201 and the fee is computed")
    void createPayment() throws Exception {
        HttpResponse<String> response = post("/payments", payment(1999), "idem_1");

        assertEquals(201, response.statusCode());
        assertTrue(response.body().contains("\"amount_minor\":1999"));
        assertTrue(response.body().contains("\"fee_minor\":58"), response.body());
        assertTrue(response.body().contains("\"net_minor\":1941"));
        assertTrue(response.body().contains("\"state\":\"AUTHORIZED\""));
    }

    @Test
    @DisplayName("the same idempotency key returns the same payment with 200")
    void idempotency() throws Exception {
        HttpResponse<String> first = post("/payments", payment(1999), "idem_same");
        HttpResponse<String> second = post("/payments", payment(1999), "idem_same");

        assertEquals(201, first.statusCode());
        assertEquals(200, second.statusCode(), "a replay is not a new payment");
        assertEquals(first.body(), second.body(), "and it returns the original");

        HttpResponse<String> list = get("/payments?merchant_id=mer_0001");
        assertTrue(list.body().contains("\"count\":1"), "one payment, not two");
    }

    @Test
    @DisplayName("different keys are different payments")
    void differentKeys() throws Exception {
        String first = post("/payments", payment(1999), "idem_a").body();
        String second = post("/payments", payment(1999), "idem_b").body();
        assertNotEquals(first, second);
    }

    @Test
    @DisplayName("a missing idempotency key is refused")
    void missingKey() throws Exception {
        HttpResponse<String> response = post("/payments", payment(1999), null);
        assertEquals(400, response.statusCode());
        assertTrue(response.body().contains("\"code\":\"bad_request\""));
        assertTrue(response.body().contains("Idempotency-Key"));
    }

    @Test
    @DisplayName("an invalid amount is 422 with the one error shape")
    void invalidAmount() throws Exception {
        HttpResponse<String> response = post("/payments", payment(0), "idem_zero");
        assertEquals(422, response.statusCode());
        assertTrue(response.body().startsWith("{\"error\":{\"code\":"));
    }

    @Test
    @DisplayName("an illegal transition is 409 rather than 400 or 500")
    void illegalTransition() throws Exception {
        String body = post("/payments", payment(1999), "idem_flow").body();
        String id = body.substring(body.indexOf("pay_"), body.indexOf("pay_") + 12);

        assertEquals(200, post("/payments/" + id + "/capture", "", null).statusCode());
        HttpResponse<String> again = post("/payments/" + id + "/capture", "", null);

        assertEquals(409, again.statusCode());
        assertTrue(again.body().contains("illegal_transition"));
    }

    @Test
    @DisplayName("an unknown payment is 404 and an unknown route is 404")
    void notFound() throws Exception {
        assertEquals(404, get("/payments/pay_99999999").statusCode());
        assertEquals(404, get("/nothing/here").statusCode());
    }

    @Test
    @DisplayName("paging is by cursor, and a bad cursor is an error rather than an empty page")
    void paging() throws Exception {
        for (int i = 0; i < 5; i++) {
            post("/payments", payment(1000 + i), "idem_page_" + i);
        }

        HttpResponse<String> first = get("/payments?merchant_id=mer_0001&limit=2");
        assertEquals(200, first.statusCode());
        assertTrue(first.body().contains("\"count\":2"));
        assertTrue(first.body().contains("\"next_cursor\":\"pay_"));

        String cursor = first.body().split("\"next_cursor\":\"")[1].split("\"")[0];
        HttpResponse<String> second =
                get("/payments?merchant_id=mer_0001&limit=2&cursor=" + cursor);
        assertTrue(second.body().contains("\"count\":2"));

        assertEquals(400, get("/payments?merchant_id=mer_0001&cursor=nonsense").statusCode());
        assertEquals(400, get("/payments?merchant_id=mer_0001&limit=500").statusCode());
        assertEquals(400, get("/payments?limit=10").statusCode());
    }

    @Test
    @DisplayName("health is live without touching anything")
    void health() throws Exception {
        assertEquals(200, get("/healthz").statusCode());
    }
}
