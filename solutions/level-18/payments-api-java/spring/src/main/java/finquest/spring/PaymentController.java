package finquest.spring;

/*
 * The level 7 contract as a Spring controller. Never compiled: see NOT_BUILT.md.
 *
 * The running version of this contract is src/main/java/finquest/api/PaymentApi.java,
 * which has nine tests against it over real HTTP. What this file adds is the shape a
 * reviewer expects to see in a Spring codebase, and three decisions worth defending:
 *
 * 1. Constructor injection with final fields. No @Autowired on a field anywhere. The
 *    reason is testability rather than taste: a class with final fields set in one
 *    constructor can be built in a test with `new`, and a field injected one cannot
 *    be built at all without a container.
 *
 * 2. The idempotency key is a required header rather than an optional one. A caller
 *    that does not send one cannot retry safely, and accepting the request anyway
 *    means the first retry is a second payment.
 *
 * 3. No @Transactional on the controller. Transactions belong in the service layer,
 *    because a transaction that spans HTTP serialisation holds a connection while
 *    the client reads the response slowly.
 */

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService payments;

    // One constructor, final field, no annotation needed since Spring 4.3.
    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    public record TakePayment(
            @NotBlank String merchantId,
            @Positive long amountMinor,
            @NotBlank String currency,
            @NotBlank String cardToken) {}

    @PostMapping
    public ResponseEntity<PaymentResponse> take(
            @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
            @Valid @RequestBody TakePayment request) {

        PaymentService.Result result = payments.take(request, idempotencyKey);

        // 201 for a new payment and 200 for a replay, with the same body. A client
        // that cannot tell them apart cannot log honestly, and a client that gets
        // 201 twice thinks it created two payments.
        return result.isNew()
                ? ResponseEntity.created(URI.create("/payments/" + result.payment().id()))
                        .body(result.payment())
                : ResponseEntity.ok(result.payment());
    }

    @GetMapping("/{id}")
    public PaymentResponse get(@PathVariable String id) {
        return payments.byId(id);
    }

    @GetMapping
    public PageResponse<PaymentResponse> list(
            @RequestParam String merchantId,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "25") int limit) {
        return payments.page(merchantId, cursor, limit);
    }

    @PostMapping("/{id}/capture")
    public PaymentResponse capture(@PathVariable String id) {
        return payments.capture(id);
    }

    @PostMapping("/{id}/refund")
    public PaymentResponse refund(@PathVariable String id) {
        return payments.refund(id);
    }
}
