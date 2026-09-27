package finquest.tx;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

/**
 * A transaction manager built on a JDK dynamic proxy, which is the mechanism Spring
 * uses and the reason both traps exist.
 *
 * <p>Spring wraps your bean in a proxy. The proxy reads the annotation, opens a
 * transaction, calls your method and commits or rolls back. Everything that
 * surprises people about {@code @Transactional} follows from that one sentence:
 *
 * <p><b>Trap one: an internal call bypasses the proxy.</b> {@code this.other()}
 * inside your class is a direct call on the target object, so the proxy never sees
 * it and no transaction is opened. The annotation is on a method nothing goes
 * through.
 *
 * <p><b>Trap two: a checked exception commits.</b> The default
 * {@code rollbackFor} is empty, which the manager below implements exactly, so a
 * checked exception propagates to the caller <i>after the transaction has
 * committed</i>: the caller sees a failure and the database has the write.
 *
 * <p>This is thirty lines rather than Spring's several thousand, and it reproduces
 * both traps faithfully because both come from the proxy rather than from Spring.
 */
public final class TransactionManager {

    /** What happened, in order, so a test can assert on it rather than on a log. */
    private final List<String> journal = new ArrayList<>();
    private int depth;

    public List<String> journal() {
        return List.copyOf(journal);
    }

    public boolean inTransaction() {
        return depth > 0;
    }

    @SuppressWarnings("unchecked")
    public <T> T proxy(Class<T> contract, T target) {
        return (T) Proxy.newProxyInstance(
                contract.getClassLoader(),
                new Class<?>[] {contract},
                new Handler(target));
    }

    private final class Handler implements InvocationHandler {

        private final Object target;

        private Handler(Object target) {
            this.target = target;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] arguments)
                throws Throwable {
            Method implementation = target.getClass()
                    .getMethod(method.getName(), method.getParameterTypes());
            Transactional annotation = implementation.getAnnotation(Transactional.class);

            if (annotation == null) {
                // No annotation on the method the proxy can see. Spring behaves
                // exactly this way, and it is why moving an annotation to a private
                // or an internal method silently does nothing.
                return call(implementation, arguments);
            }

            depth++;
            journal.add("begin");
            try {
                Object result = call(implementation, arguments);
                journal.add("commit");
                return result;
            } catch (Throwable thrown) {
                if (shouldRollBack(thrown, annotation)) {
                    journal.add("rollback: " + thrown.getClass().getSimpleName());
                } else {
                    // The trap. The write is durable and the caller sees an
                    // exception, which is the worst of both.
                    journal.add("commit despite " + thrown.getClass().getSimpleName());
                }
                throw thrown;
            } finally {
                depth--;
            }
        }

        private Object call(Method method, Object[] arguments) throws Throwable {
            try {
                return method.invoke(target, arguments);
            } catch (InvocationTargetException wrapped) {
                throw wrapped.getCause();
            }
        }

        private boolean shouldRollBack(Throwable thrown, Transactional annotation) {
            if (thrown instanceof RuntimeException || thrown instanceof Error) {
                return true;            // Spring's default, and the sensible half
            }
            for (Class<? extends Throwable> kind : annotation.rollbackFor()) {
                if (kind.isInstance(thrown)) {
                    return true;
                }
            }
            return false;               // a checked exception, and the default commits
        }
    }
}
