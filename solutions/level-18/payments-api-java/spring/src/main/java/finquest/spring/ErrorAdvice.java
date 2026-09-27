package finquest.spring;

/*
 * One error shape for the whole service. Never compiled: see NOT_BUILT.md.
 *
 * The reason this class exists rather than a try/catch per controller: Spring throws
 * several of these before any of your code runs, and without one place to handle
 * them a client sees Spring's default error body for a validation failure and yours
 * for everything else. Two shapes is worse than either.
 *
 * The rule the body follows: a code a client can branch on, a detail a human can
 * read, and nothing from an exception message. An exception message can contain a
 * connection string, a card number that should never have been in scope, or a stack
 * frame that tells an attacker which library version you are on.
 */

import finquest.card.IllegalTransition;
import finquest.money.CurrencyMismatch;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ErrorAdvice {

    private static final Logger log = LoggerFactory.getLogger(ErrorAdvice.class);

    public record ErrorBody(String code, String detail, Map<String, String> fields,
            Instant at) {
        static ErrorBody of(String code, String detail) {
            return new ErrorBody(code, detail, Map.of(), Instant.now());
        }
    }

    private static ResponseEntity<Map<String, ErrorBody>> body(HttpStatus status,
            ErrorBody error) {
        // Wrapped in an "error" object rather than returned bare, so a client can
        // tell an error from a successful response by shape as well as by status.
        return ResponseEntity.status(status).body(Map.of("error", error));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<Map<String, ErrorBody>> missingHeader(
            MissingRequestHeaderException exception) {
        return body(HttpStatus.BAD_REQUEST,
                ErrorBody.of("missing_header", exception.getHeaderName() + " is required"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, ErrorBody>> invalid(
            MethodArgumentNotValidException exception) {
        Map<String, String> fields = exception.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        error -> error.getField(),
                        error -> error.getDefaultMessage() == null
                                ? "is invalid" : error.getDefaultMessage(),
                        (first, second) -> first));
        return body(HttpStatus.UNPROCESSABLE_ENTITY,
                new ErrorBody("invalid_request", "the request body is not valid",
                        fields, Instant.now()));
    }

    @ExceptionHandler(CurrencyMismatch.class)
    public ResponseEntity<Map<String, ErrorBody>> currency(CurrencyMismatch exception) {
        return body(HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorBody.of("currency_mismatch", exception.getMessage()));
    }

    @ExceptionHandler(IllegalTransition.class)
    public ResponseEntity<Map<String, ErrorBody>> transition(IllegalTransition exception) {
        // 409 rather than 400: the request is well formed and the payment is in the
        // wrong state for it. A client retrying a 400 is confused; a client seeing a
        // 409 knows to re-read the payment.
        return body(HttpStatus.CONFLICT,
                ErrorBody.of("illegal_transition", exception.getMessage()));
    }

    @ExceptionHandler(PaymentService.NotFound.class)
    public ResponseEntity<Map<String, ErrorBody>> notFound(PaymentService.NotFound e) {
        return body(HttpStatus.NOT_FOUND, ErrorBody.of("not_found", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, ErrorBody>> unexpected(Exception exception) {
        // Logged with the stack trace, returned without it. The client gets a code
        // and nothing else, because this is the handler that catches the exception
        // nobody anticipated and its message is not under anybody's control.
        log.error("unhandled exception", exception);
        return body(HttpStatus.INTERNAL_SERVER_ERROR,
                ErrorBody.of("internal_error", "the request could not be completed"));
    }
}
