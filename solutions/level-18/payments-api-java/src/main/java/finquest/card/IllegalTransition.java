package finquest.card;

/** A transition the table does not contain. Refused before anything is written. */
public class IllegalTransition extends RuntimeException {

    public IllegalTransition(PaymentState from, PaymentEvent event) {
        super("cannot " + event + " a payment that is " + from);
    }
}
