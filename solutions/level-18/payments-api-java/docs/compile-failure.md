# The compile failure that is the point of the sealed interface

This is the level's fifth test: **removing or adding a case to an outcome switch
fails compilation.** A test cannot assert that, because a test that does not
compile does not run, so the demonstration is this document and the command that
produces it.

## The change

`AuthResult` is a sealed interface permitting three outcomes. Add a fourth, as
somebody would when the card network starts sending one:

```java
 public sealed interface AuthResult
-        permits AuthResult.Approved, AuthResult.Declined, AuthResult.Unknown {
+        permits AuthResult.Approved, AuthResult.Declined, AuthResult.Unknown,
+                AuthResult.Reversed {

     record Unknown(String reference, String detail) implements AuthResult {}
+
+    /** A new outcome: the network reversed the authorisation on its own. */
+    record Reversed(String reference, String why) implements AuthResult {}
 }
```

Nothing else changed. No call site was touched.

## What javac says

```
$ javac -d out $(find java -name "*.java")

java\finquest\card\Outcomes.java:21: error: the switch expression does not cover all possible input values
        return switch (result) {
               ^
java\finquest\card\Outcomes.java:35: error: the switch expression does not cover all possible input values
        return switch (result) {
               ^
2 errors
```

Run on Temurin 21.0.12.1, and reproducible: `docs/reproduce-compile-failure.sh`
makes a copy of `src/main/java`, adds the outcome, and compiles.

## Why this is the reason to be on the JVM

Two errors, both with a file and a line, before anything ran. The equivalent in a
dynamic language is a `KeyError` in production, or worse, a `default:` branch that
treated a network reversal as a retryable decline and retried a payment that had
already been reversed.

Three details make it work, and dropping any one of them silently removes the
check:

**`sealed ... permits`.** Without it the compiler cannot know the set of outcomes
is closed, so it cannot know whether a switch is exhaustive.

**A switch *expression* rather than a statement.** `switch (x) { case ... }` as a
statement has no exhaustiveness requirement: it just does nothing for an unhandled
value. `return switch (x) { ... }` must produce a value for every input, and that
is what makes the check happen.

**No `default` branch.** A default satisfies the compiler for every possible new
outcome, forever, which is exactly the protection being given up. `Outcomes.java`
has no default and says so in a comment, because a later reader adding one to
"make the build pass" is the failure mode.

## What it does not catch

It is worth being precise about the limit of this, because the enthusiasm for
sealed types tends to overstate it.

- It catches an **unhandled** outcome. It does not catch an outcome handled
  **wrongly**: mapping `Reversed` to "retry" compiles perfectly.
- It only checks code that is compiled against the new interface. A service in
  another repository, or a JSON payload deserialised into a string, gets no check
  at all. The boundary of the type system is the boundary of the guarantee.
- It says nothing at runtime. A payload containing `"REVERSED"` from a network
  that upgraded before you did is still a runtime problem, and the answer to that
  is the same in every language: parse into a closed set and fail loudly on
  anything else.
