# The Spring layer, and why it has never been compiled

Everything in `spring/` is written, reviewed and **not built**. There is no Maven on
the machine this solution was written on, no way to resolve Spring Boot's dependency
tree, and Testcontainers needs a container runtime that also is not here. Shipping
it as if it compiled would be the one dishonest thing in this repository.

What exists instead, and does run:

| The level asks for | Where it is, verified |
|---|---|
| The level 7 HTTP contract | `src/main/java/finquest/api/PaymentApi.java`, on the JDK's own server, 9 tests over real HTTP |
| Constructor injection with final fields | The same file: every dependency is a final field set in the constructor, which is what the Spring rule is actually asking for |
| One error shape from a `@ControllerAdvice` | One `catch` chain in `PaymentApi.route`, asserted by the tests: every error is `{"error":{"code":...,"detail":...}}` |
| The two `@Transactional` traps | `finquest/tx/`, with a real JDK dynamic proxy. Four tests, and both traps fail exactly as the level says they will |
| The level 8 lost update | `finquest/race/LostUpdateTest.java`, real threads, 91% of deposits lost, three fixes. The SQL fixes verified on PostgreSQL 18.6 |

What the Spring files add that the running code cannot show: the annotations
themselves, the Hikari configuration, and the Testcontainers wiring. Read them as a
design under review.

## How to build and run them

```bash
mvn -f spring/pom.xml verify        # needs Maven and about 100 MB of jars
mvn -f spring/pom.xml spring-boot:run
```

`verify` will run `LostUpdateContainerTest`, which needs Docker. Without it the test
is skipped rather than passing quietly, which is `@Testcontainers(disabledWithoutDocker = true)`
in the file.

## The three things worth reading in there

**`application.yml`** has `open-in-view: false` and a pool size with the arithmetic
in a comment rather than a number somebody liked.

**`ErrorAdvice.java`** is one class producing one shape for every error in the
service, including the ones Spring throws before your code runs.

**`PaymentController.java`** has constructor injection and final fields, and no
`@Autowired` anywhere, which is not a style preference: a field injected bean cannot
be constructed in a test without a container.
