package finquest.tx;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * The annotation, with the one attribute whose default causes the second trap.
 *
 * <p>Spring's {@code @Transactional} rolls back on a {@code RuntimeException} and
 * <b>commits</b> on a checked exception unless {@code rollbackFor} says otherwise.
 * That default is thirty years old, it is documented, and it still surprises
 * everybody, which is why it is reproduced here rather than described.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Transactional {

    /** Exactly Spring's default: checked exceptions commit. */
    Class<? extends Throwable>[] rollbackFor() default {};
}
