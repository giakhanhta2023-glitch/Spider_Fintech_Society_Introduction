/* =========================================================================
   LEVEL 18: Java, for somebody who already writes Python
   ========================================================================= */
FQ.registerLevel({
  id: 18,
  codename: 'jvm',
  title: 'Java, for somebody who already writes Python',
  tagline: 'Capital One, Adyen, Goldman and most of the payments teams inside banks run on the JVM. You do not need to prefer it. You need to be able to be interviewed in it, and to port your own service to prove you can.',
  difficulty: 8,
  minutes: 480,
  tags: ['Java', 'Spring Boot', 'JVM', 'Go', 'Testcontainers'],
  summary: 'Thirteen levels of payments engineering in Python, ported. This level is not an introduction to programming ' +
           'in Java, because you can already program: it is the specific set of differences that matter when you move a ' +
           'money handling service onto the JVM, the parts of Spring Boot you will actually touch, the traps that catch ' +
           'people coming from Python, a benchmark you run yourself, and one small component written in Go, because the ' +
           'same job descriptions ask for that too.',

  objectives: [
    'Read and write Java at the level a payments service needs',
    'Represent money in Java without ever reaching for a floating point type',
    'Model a state machine with the type system rather than with strings',
    'Use the parts of Spring Boot that appear in every service',
    'Write tests against a real database with Testcontainers',
    'Explain what the JVM does at start, and why it changes your latency numbers',
    'Port your own payments API and benchmark both versions',
    'Write one concurrent component in Go, and say honestly what that proves'
  ],

  knowledge: [
    { h: 'Why this level exists' },
    { p: 'Python will get you interviews. For a large part of the payments industry, Java is what gets you *those* ' +
         'interviews: Capital One, Adyen, most bank payment platforms, Goldman, and a good share of the fintechs that ' +
         'sell to banks. Some of them will interview you in any language and some will not, and you do not find out ' +
         'which until you have applied.' },
    { p: 'You are not learning Java from nothing. You know types from level 5, concurrency from level 8, transactions ' +
         'from level 6 and HTTP from level 7. What follows is the difference list, not a tutorial, and the project is a ' +
         'port of something you have already built and understand.' },
    { warn: 'One honest note about the numbers in this level. Everywhere else in this course, every figure was measured ' +
            'before it was published. Here, the timings depend on your JVM version, your machine and your heap, so the ' +
            'numbers are yours to produce, and the level tells you exactly which ones to record. The arithmetic below, ' +
            'about what a type can hold, is exact and does not vary.' },

    { h: 'Five differences that actually matter' },
    { table: {
      head: ['Python', 'Java', 'What it means for you'],
      rows: [
        ['Types are optional and checked by a separate tool', 'Types are the language, checked by the compiler', 'Whole categories of test disappear, and refactoring becomes safe'],
        ['Functions live anywhere', 'Everything lives in a class', 'More ceremony per file, and more structure imposed for free'],
        ['One exception hierarchy, all unchecked', 'Checked exceptions must be declared or caught', 'The compiler makes you decide what can fail, which is useful for money'],
        ['`pip` and a virtual environment', 'Maven or Gradle, and a dependency tree', 'A build file rather than a requirements file, and transitive dependencies you should look at'],
        ['Interpreted, starts instantly', 'Compiled to bytecode, then compiled again at run time by the JIT', 'The first thousand requests are slower than the rest, which changes how you measure']
      ]
    }},
    { p: 'The last row is the one that surprises Python engineers, and it matters for everything you learned in level 14. ' +
         'The **JVM starts interpreting your bytecode and compiles the hot paths to machine code while it runs**, so a ' +
         'freshly started service is slow, then gets faster, then settles. A load test with no warm up measures the ' +
         'warm up, and a canary deploy that judges a new instance in its first thirty seconds will fail every healthy ' +
         'release.' },

    { h: 'Money in Java' },
    { p: 'Level 5 said never use a float for money, and the reason is the same in Java because it is the same IEEE 754 ' +
         'binary64 that Python uses. `0.1 + 0.2` is `0.30000000000000004` in both languages, for the same reason, and ' +
         'the nearest double to `0.1` is `0.10000000000000000555`.' },
    { p: 'Java gives you two correct options, and you will meet both:' },
    { code: '// 1. minor units in a long. Fast, exact, and what most payment APIs use.\nlong amountMinor = 149_99L;          // $149.99\n\n// 2. BigDecimal, when you need fractions of a cent or many currencies\nBigDecimal rate   = new BigDecimal("0.029");\nBigDecimal fee    = new BigDecimal("149.99")\n                      .multiply(rate)\n                      .setScale(2, RoundingMode.HALF_EVEN);   // always both', lang: 'java' },
    { ul: [
      '**`new BigDecimal("0.1")` is exact. `new BigDecimal(0.1)` is not,** because the second one is handed a double that was already wrong. Always construct from a string.',
      '**Always pass a scale and a rounding mode together.** `setScale(2, RoundingMode.HALF_EVEN)` says what you mean; leaving the rounding mode out throws when the value does not fit.',
      '**`equals` compares scale as well as value,** so `new BigDecimal("1.0").equals(new BigDecimal("1.00"))` is false. Use `compareTo(...) == 0`. This one costs everybody a day.',
      '**Never `double`, never `float`,** not for a total, not for a rate, not "just for display".'
    ]},
    { p: 'And a trap that does not exist in Python at all. Java\'s `int` is exactly 32 bits and **wraps silently** on ' +
         'overflow, while Python integers grow without limit. In minor units:' },
    { code: 'int  maximum   2,147,483,647 minor units  =  $21,474,836.47\nlong maximum   9,223,372,036,854,775,807   =  $92,233,720,368,547,760.00\n\n2147483647 + 1  ==  -2147483648        // no error, no warning', lang: 'text' },
    { p: 'An `int` column for a payment amount in cents fails at twenty one and a half million dollars, quietly, by ' +
         'becoming negative. Use `long` for minor units everywhere, including in the database, and if you want the ' +
         'compiler to shout instead of wrapping, `Math.addExact` throws on overflow.' },
    { check: {
      q: 'You are reviewing a Java service where a colleague stores fee percentages as `double` because "they are only ' +
         'used to compute the fee, and the fee itself is a BigDecimal". Is that safe?',
      a: 'No, and the argument has the right shape but the wrong conclusion. The moment the double enters the ' +
         'calculation, the result is wrong before BigDecimal ever sees it: a rate of 0.029 is not exactly representable, ' +
         'so the product is slightly off and the rounding to two decimal places can land on the wrong side of a half ' +
         'cent. It will agree with the correct answer on almost every transaction, which is what makes it dangerous: the ' +
         'failure appears as a handful of one cent reconciliation breaks a month, from level 10, and those take days to ' +
         'trace back to a type. The rule is that a value in a money calculation is exact from end to end, so the rate is ' +
         'a BigDecimal constructed from a string, or an integer of basis points, which is what many payment systems ' +
         'actually store.'
    }},

    { h: 'Using the type system on purpose' },
    { p: 'The reason to be on the JVM is the compiler, so use it. Three features do most of the work in a payments ' +
         'service:' },
    { code: '// a record: an immutable value object, in one line\nrecord Money(long minor, Currency currency) {\n    Money {\n        if (minor < 0) throw new IllegalArgumentException("negative");\n    }\n}\n\n// an enum: the level 9 states, so a typo is a compile error\nenum PaymentState { REQUESTED, AUTHORISED, CAPTURED, REFUNDED, VOIDED }\n\n// a sealed interface: every outcome enumerated, and the compiler checks\n// that you handled all of them\nsealed interface AuthResult permits Approved, Declined, Referred {}\n\nString message = switch (result) {\n    case Approved a  -> "approved " + a.code();\n    case Declined d  -> "declined " + d.reason();\n    case Referred r  -> "call the issuer";\n    // add a fourth outcome and this switch stops compiling. That is the point.\n};', lang: 'java' },
    { p: 'That last property is what people mean when they say a type system pays for itself. In Python, adding a new ' +
         'card outcome means finding every place that handles outcomes. In Java with a sealed interface, **the compiler ' +
         'finds them for you**, and it finds all of them.' },
    { p: 'Two more habits worth taking from Java back to your Python:' },
    { ul: [
      '**`Optional<Payment>` instead of returning null,** so the absence is in the type and the caller has to deal with it. It is the same discipline as a `Payment | None` annotation that is actually enforced.',
      '**Immutable value objects by default.** A `record` cannot be modified after construction, which removes a whole class of bug where something changed a payment halfway through a request.'
    ]},

    { h: 'Spring Boot, the parts you will touch' },
    { p: '**Spring Boot** is two ideas. **Dependency injection**: you declare what a class needs and the framework ' +
         'supplies it, so nothing constructs its own database connection and everything can be tested with a substitute. ' +
         '**Autoconfiguration**: adding a dependency configures it, so a Postgres driver on the classpath plus a URL in ' +
         'the configuration gives you a working connection pool with no code.' },
    { code: '@RestController\n@RequestMapping("/v1/payments")\nclass PaymentController {\n\n    private final PaymentService service;                 // injected, final\n\n    PaymentController(PaymentService service) {           // constructor injection\n        this.service = service;\n    }\n\n    @PostMapping\n    ResponseEntity<PaymentResponse> create(\n            @RequestHeader("Idempotency-Key") String key,   // level 7, unchanged\n            @Valid @RequestBody CreatePayment body) {\n        return ResponseEntity.status(201).body(service.create(key, body));\n    }\n}', lang: 'java' },
    { table: {
      head: ['Annotation', 'Does'],
      rows: [
        ['`@RestController`', 'This class handles HTTP and returns bodies rather than views'],
        ['`@Service`, `@Repository`', 'Register this class so it can be injected'],
        ['`@Valid`', 'Validate the request body against its constraints, like Pydantic in level 7'],
        ['`@Transactional`', 'Run this method in a database transaction'],
        ['`@ConfigurationProperties`', 'Bind configuration into a typed object, validated at start, as in level 17']
      ]
    }},
    { warn: 'Two `@Transactional` traps, and both bite everybody once. **Calling an annotated method from inside the ' +
            'same class does nothing,** because the annotation works through a proxy that an internal call bypasses. And ' +
            '**by default it rolls back on unchecked exceptions only**, so a checked exception commits the transaction ' +
            'you thought you had abandoned. For money, say what you mean: `@Transactional(rollbackFor = Exception.class)`.' },
    { p: 'Use constructor injection and `final` fields, as above. Field injection with `@Autowired` still exists in old ' +
         'code, and it hides dependencies, makes testing harder and allows a half constructed object. The constructor ' +
         'version is what a reviewer expects to see.' },

    { h: 'The database, and the same arithmetic as level 8' },
    { p: 'Spring Boot ships **HikariCP** as its connection pool, and everything level 8 measured applies unchanged: the ' +
         'pool is a queue, its size multiplied by the number of instances must stay under the database limit, and pool ' +
         'size divided by query time is the requests per second it can support.' },
    { code: 'spring:\n  datasource:\n    hikari:\n      maximum-pool-size: 10        # 10 x 6 instances = 60 connections\n      connection-timeout: 3000     # fail fast rather than queue (level 14)\n  jpa:\n    open-in-view: false            # turn this off. See below.', lang: 'text' },
    { p: 'For queries you will meet two styles. **JPA and Hibernate** map objects to rows and generate SQL for you, ' +
         'which is convenient and hides what the database is doing. **JdbcTemplate** or **jOOQ** keep the SQL visible. ' +
         'After level 6, you know why seeing the query matters, and for a ledger the explicit style is easier to defend ' +
         'in review.' },
    { ul: [
      '**`open-in-view: false`, always.** Left on, it holds a database connection for the whole request including the time spent writing the response, which quietly multiplies your pool requirement.',
      '**Watch for the N plus one query,** where loading a list then touching each item\'s relation runs one query per row. It is the ORM version of the missing index from level 6: correct output, quadratic cost.',
      '**Log the generated SQL in development** and read it once. It is usually the moment people stop trusting an ORM blindly.'
    ]},

    { h: 'Concurrency without a global lock' },
    { p: 'Python has a global interpreter lock, so threads do not run Python bytecode in parallel and the answer to CPU ' +
         'work is processes. **The JVM has no such lock**: threads genuinely run at the same time on different cores, ' +
         'which is faster and means shared mutable state is a real hazard rather than a mostly theoretical one.' },
    { table: {
      head: ['Need', 'Java'],
      rows: [
        ['Run tasks in a pool', '`ExecutorService` and `Future`'],
        ['Many blocking calls at once', 'Virtual threads, from Java 21. Millions of them, cheaply'],
        ['A counter several threads touch', '`AtomicLong`, never `long++`'],
        ['A map several threads touch', '`ConcurrentHashMap`'],
        ['A section only one thread may enter', '`synchronized`, or a `ReentrantLock` when you need a timeout']
      ]
    }},
    { p: '**Virtual threads** are the change worth understanding, because they remove the reason most Java services used ' +
         'asynchronous frameworks. A platform thread costs about a megabyte of stack, so a service can have a few ' +
         'thousand; a virtual thread costs a few hundred bytes and parks itself when it blocks on input or output. You ' +
         'write ordinary blocking code and get the concurrency of an asynchronous design.' },
    { p: 'None of this changes the database. The lost update from level 8 happens exactly the same way in Java, and the ' +
         'fix is still `select for update`, an optimistic version column or serialisable isolation. **Concurrency bugs ' +
         'in a payments service live in the database, not in the language.**' },

    { h: 'Testing: a real database, per test run' },
    { p: 'The Java ecosystem has one testing practice that is genuinely ahead of the Python default, and it is worth ' +
         'taking back with you. **Testcontainers** starts a real Postgres in Docker for your test run, so integration ' +
         'tests run against the database you actually ship with, rather than against an in memory substitute that ' +
         'behaves differently under exactly the conditions you care about.' },
    { code: '@Testcontainers\n@SpringBootTest\nclass LedgerTest {\n\n    @Container\n    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");\n\n    @Test\n    void concurrent_captures_do_not_double_spend() {\n        // the level 8 experiment, against a real Postgres, in CI\n    }\n}', lang: 'java' },
    { p: 'That is the level 8 race, the level 6 constraints and the level 13 migrations, all runnable in a pipeline. An ' +
         'in memory database would have passed the level 8 test and shipped the bug, because it does not implement the ' +
         'same locking.' },
    { check: {
      q: 'Your Java service is measurably faster than your Python one in a benchmark, and a colleague concludes the ' +
         'rewrite was worth it. What would you want to check before agreeing?',
      a: 'Several things, and the order matters. First, whether the benchmark warmed up: the JVM interprets before it ' +
         'compiles hot paths, so a short run measures the slow phase and a long one measures the fast phase, and the ' +
         'two can differ by a lot in either direction. Second, what the service actually spends its time on: if a ' +
         'payment is a few milliseconds of your code and forty milliseconds of database, the language was never the ' +
         'bottleneck and you have rewritten the cheap part. Third, whether the two versions are doing the same work, ' +
         'because a port usually drops a validation or a log line somewhere. And fourth, what the comparison cost: a ' +
         'rewrite spends months and reintroduces bugs that were fixed years ago. The honest version of the claim is ' +
         'usually "the JVM gives us better concurrency per instance and a type system we wanted", which is a real ' +
         'reason, rather than a latency number that was mostly database anyway.'
    }},

    { h: 'The JVM at run time' },
    { p: 'Three facts that change how you operate a Java service, all of which connect back to earlier levels:' },
    { ul: [
      '**Warm up.** Code starts interpreted and is compiled as it gets hot. Your level 14 load test needs a warm up phase before it records anything, and a canary that judges an instance too early rejects healthy releases.',
      '**Garbage collection.** Memory is reclaimed automatically, in pauses. Modern collectors keep them short, but they land in your p99, so a latency graph with regular small spikes usually has a collector underneath it.',
      '**Heap in a container.** The JVM sizes its heap from what it thinks the machine has. In a container it must be told, or it will size for the host and be killed by the memory limit, which looks like a random restart with no log line.'
    ]},
    { p: 'The commands worth knowing on day one: `jcmd` to ask a running JVM what it is doing, and a heap dump when a ' +
         'service is using more memory than it should. Both belong in the runbooks from level 16.' },

    { h: 'And Go, in an afternoon' },
    { p: 'Java is the large one. Go is the small one, and it sits on the same job descriptions: Capital One lists Java, ' +
         'Python and Go across its backend roles, and it is the usual choice for platform teams, infrastructure tooling ' +
         'and high throughput edge services. The useful thing about Go is that it is small enough to be productive in ' +
         'over a weekend, which is not true of Java, so it costs you very little to stop being unable to read it.' },
    { p: 'Three differences from what you already know, and they are the whole language for your purposes:' },
    { ul: [
      '**Concurrency is in the language.** `go doWork()` starts a goroutine, which costs a few kilobytes rather than a megabyte, and a **channel** is a typed pipe between them. Java\'s virtual threads are the same idea arriving much later.',
      '**Errors are values, not exceptions.** Every call that can fail returns an error beside its result and you check it. It is verbose on purpose: you cannot silently fail to handle something, which for money is the right trade.',
      '**No inheritance, and interfaces are implicit.** A type satisfies an interface by having the right methods, with nothing declared. Small interfaces, plain structs, and very little ceremony.'
    ]},
    { code: '// a worker pool: the shape you will actually write\nfunc sendAll(webhooks <-chan Webhook, workers int) {\n    var wg sync.WaitGroup\n    for i := 0; i < workers; i++ {\n        wg.Add(1)\n        go func() {                       // a goroutine, not a thread\n            defer wg.Done()\n            for w := range webhooks {     // reads until the channel closes\n                if err := send(w); err != nil {\n                    log.Printf("send failed ref=%s: %v", w.Ref, err)\n                    continue              // no exception to swallow it\n                }\n            }\n        }()\n    }\n    wg.Wait()\n}', lang: 'text' },
    { warn: 'Money in Go: `int64` minor units, exactly as in Java. There is no decimal type in the standard library, so ' +
            'it is either `int64` or a library such as `shopspring/decimal`. Never `float64`, for the same IEEE 754 ' +
            'reason as everywhere else in this course.' },
    { p: 'What to port is one component rather than the service. The right size is something with a queue coming in, ' +
         'HTTP going out, real concurrency and almost no domain logic, which means **the webhook sender or the outbox ' +
         'publisher from level 11**. Those are a day of work, they exercise goroutines, channels, timeouts, retries and ' +
         'graceful shutdown, and they sit in front of the Python service without disturbing it.' },
    { code: 'python payments service\n        |\n        v  outbox rows, or a queue\n   go webhook worker      <- this is the port. 200 lines, not 20,000\n        |\n        v\n   merchant endpoints', lang: 'text' },
    { p: 'And the honest framing for your CV, because the wrong one is easy to write. You are not demonstrating that Go ' +
         'is faster than Python. You are demonstrating that **you can pick up an unfamiliar language and ship a correct ' +
         'concurrent component in it**, which is the claim a hiring manager cares about and the one they will probe. ' +
         'Measure throughput, p99 and memory at a stated concurrency, say what the component does, and leave the ' +
         'language war alone.' },

    { h: 'What to port, and what to prove' },
    { p: 'Porting all thirteen levels would take a month and teach you nothing after the first one. Port the payments ' +
         'API from level 7, because it has an HTTP contract, validation, idempotency, a database and tests, which ' +
         'exercises everything above. Then prove two things with numbers you measured:' },
    { ul: [
      '**The behaviour is identical.** Run the same integration tests against both services, including the idempotency and concurrency tests. Identical responses, identical ledger entries.',
      '**The performance difference, honestly.** Use the open loop generator from level 14 against both, with a warm up, and report p50, p99 and goodput. Whatever it says, report it: a result that favours Python is just as interesting, and being able to explain why is the point.',
      '**One component in Go,** alongside the two services: the webhook sender, with goroutines, timeouts, retries and a graceful shutdown that drains what it is holding.'
    ]}
  ],

  tutorial: {
    intro: 'Java 21 or later, Maven, and Docker for Testcontainers. Use IntelliJ IDEA Community: the Java ecosystem ' +
           'assumes an IDE in a way Python does not, and refusing one makes this harder than it needs to be. Work in a ' +
           'repository called `payments-api-java`.',
    steps: [
      {
        t: 'A project, and the money type',
        blocks: [
          { p: 'Spring Initializr with web, validation, Postgres and Testcontainers. Then write `Money` as a record ' +
               'before anything else, with tests ported straight from level 5: allocation without losing a cent, ' +
               'rounding, and arithmetic that refuses to mix currencies.' },
          { code: 'record Money(long minor, Currency currency) {\n    Money {\n        Objects.requireNonNull(currency);\n    }\n    Money plus(Money other) {\n        if (!currency.equals(other.currency))\n            throw new IllegalArgumentException("currency mismatch");\n        return new Money(Math.addExact(minor, other.minor), currency);   // throws on overflow\n    }\n}', lang: 'java' },
          { warn: 'Write the test that proves `new BigDecimal(0.1)` and `new BigDecimal("0.1")` differ, and the one ' +
                  'that proves `equals` and `compareTo` disagree about `1.0` and `1.00`. Both will save you a day later.' }
        ],
        check: 'Your level 5 property tests pass unchanged in meaning, and an overflowing addition throws rather than wrapping.'
      },
      {
        t: 'The state machine, in types',
        blocks: [
          { p: 'Port the level 9 card lifecycle using an enum for the states and a sealed interface for the outcomes, ' +
               'so an unhandled case is a compile error rather than a test failure.' },
          { p: 'Then delete one case from a switch and confirm the compiler refuses. That refusal is the thing you came ' +
               'to Java for, and it is worth seeing once deliberately.' }
        ],
        check: 'Adding a new authorisation outcome breaks compilation everywhere it must be handled.'
      },
      {
        t: 'The API, with the level 7 contract',
        blocks: [
          { p: 'Same routes, same status codes, same idempotency behaviour, same error shape. Constructor injection, ' +
               '`@Valid` on the request bodies, and a `@ControllerAdvice` so errors come back in one consistent format.' },
          { p: 'Set `open-in-view: false` and a Hikari pool size you can justify with the arithmetic from level 8.' }
        ],
        check: 'The level 7 integration tests pass against the Java service with only the base URL changed.'
      },
      {
        t: 'Transactions, and the two traps',
        blocks: [
          { p: 'Put `@Transactional(rollbackFor = Exception.class)` where it belongs, then prove both traps exist by ' +
               'writing tests for them: one where an internal call bypasses the proxy, and one where a checked exception ' +
               'commits when the default configuration is used.' },
          { code: '// this does NOT open a transaction: the proxy is bypassed\npublic void outer() { this.inner(); }\n@Transactional public void inner() { ... }', lang: 'java' }
        ],
        check: 'You have two failing tests that demonstrate each trap, and they pass once the code is corrected.'
      },
      {
        t: 'Testcontainers, and the level 8 race',
        blocks: [
          { p: 'A real Postgres for the test run, then port the lost update experiment: several threads capturing the ' +
               'same payment, the bug reproduced, and then fixed with `select for update` and again with an optimistic ' +
               'version column.' },
          { p: 'This is the test that would not work against an in memory database, which is exactly why it is the one ' +
               'worth having.' }
        ],
        check: 'The race reproduces in CI, and both fixes make it stop.'
      },
      {
        t: 'Virtual threads',
        blocks: [
          { p: 'Turn them on, then measure the difference under the level 14 load generator with a dependency that ' +
               'blocks for 50 ms.' },
          { code: 'spring.threads.virtual.enabled: true', lang: 'text' },
          { p: 'Record throughput and p99 with them on and off, at several concurrency levels. Whatever you find, write ' +
               'it down with the JVM version and the machine, because that is what makes a benchmark quotable.' }
        ],
        check: 'You can state what virtual threads did for your service, with numbers and conditions.'
      },
      {
        t: 'Package it and warm it up',
        blocks: [
          { p: 'A multi stage Dockerfile from level 17, with the heap told what it may use, and a startup probe that ' +
               'tolerates the JVM taking longer to become ready than a Python service.' },
          { code: 'ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError"', lang: 'docker' },
          { p: 'Then measure the warm up: run the load generator from a cold start and plot p99 over the first two ' +
               'minutes. That curve is the reason your canary needs a warm up window.' }
        ],
        check: 'You have a graph of p99 against time from a cold start, and a readiness configuration that matches it.'
      },
      {
        t: 'One component in Go',
        blocks: [
          { p: 'The webhook sender, in Go, reading from the level 11 outbox and posting to merchant endpoints. Two ' +
               'hundred lines. A worker pool of goroutines, a timeout on every request, retries with backoff and ' +
               'jitter, and a graceful shutdown that finishes what it is holding before exiting.' },
          { code: 'go doWork()          a goroutine, a few kilobytes\nch := make(chan T)   a typed pipe between them\nif err != nil        every failure, checked, every time', lang: 'text' },
          { p: 'Then measure it at a stated concurrency: throughput, p99 and memory. Write the CV line as what it ' +
               'actually shows, which is that you shipped a correct concurrent component in an unfamiliar language.' },
          { warn: 'Graceful shutdown is the part that is worth the exercise. A worker killed mid send must not lose ' +
                  'the webhook, which means the row is only marked published after the send succeeds. That is level 11 ' +
                  'again, in a new language, and it is exactly what an interviewer will ask about.' }
        ],
        check: 'Killing the Go worker under load loses no webhooks and sends none twice that were not already at-least-once.'
      },
      {
        t: 'Benchmark both, honestly',
        blocks: [
          { p: 'Same hardware, same database, same load generator, both warmed up. Report p50, p99 and goodput for the ' +
               'Python service and the Java one, and state what share of a request is database time in each.' },
          { p: 'Then write the paragraph an interviewer wants: what the difference was, how much of it was the language ' +
               'at all, and what you would choose for a new service and why.' }
        ],
        check: 'Both services pass the same tests, and you can defend the benchmark including its limitations.'
      }
    ]
  },

  glossary: [
    { t: 'JVM', d: 'The virtual machine that runs Java bytecode, compiling hot paths to machine code as it goes.' },
    { t: 'JIT', d: 'Just in time compilation. Why a freshly started service is slower than a warm one.' },
    { t: 'Checked exception', d: 'One the compiler makes you declare or catch.' },
    { t: 'BigDecimal', d: 'Exact decimal arithmetic. Construct from a string, and always set scale with a rounding mode.' },
    { t: 'long', d: '64 bit integer. What minor units belong in, because `int` stops at $21,474,836.47.' },
    { t: 'record', d: 'An immutable value object declared in one line.' },
    { t: 'sealed interface', d: 'A type with a fixed set of implementations, so the compiler can check you handled all.' },
    { t: 'Optional', d: 'A type that says a value may be absent, instead of returning null.' },
    { t: 'Spring Boot', d: 'Dependency injection plus autoconfiguration, and the default way Java services are built.' },
    { t: 'Dependency injection', d: 'A class declares what it needs and the framework supplies it.' },
    { t: 'Constructor injection', d: 'Dependencies passed to the constructor and held in final fields. The reviewed default.' },
    { t: '@Transactional', d: 'Runs a method in a transaction. Bypassed by internal calls; set rollbackFor explicitly.' },
    { t: 'HikariCP', d: 'The connection pool Spring Boot ships. Same arithmetic as level 8.' },
    { t: 'open-in-view', d: 'A Spring default that holds a connection for the whole request. Turn it off.' },
    { t: 'N plus one', d: 'One query per row instead of one query. The ORM version of a missing index.' },
    { t: 'Virtual thread', d: 'A cheap thread that parks when it blocks. Blocking code, asynchronous concurrency.' },
    { t: 'Testcontainers', d: 'Real dependencies in Docker for the test run, instead of in memory substitutes.' },
    { t: 'Garbage collection pause', d: 'A brief stop to reclaim memory. It lands in your p99.' },
    { t: 'Goroutine', d: 'Go\'s lightweight thread. A few kilobytes, started with the word `go`.' },
    { t: 'Channel', d: 'A typed pipe between goroutines. How Go passes work around.' },
    { t: 'Errors as values', d: 'Go returns failures beside results instead of throwing, so each one is checked.' }
  ],

  quiz: [
    { q: "Why is `0.1 + 0.2` not `0.3` in Java?",
      options: [
        "Because it uses IEEE 754 binary64, exactly as Python does, and 0.1 is not representable in binary",
        "A Java specific rounding rule",
        "Because double has fewer bits than Python floats",
        "It is 0.3 in Java"
      ],
      answer: 0,
      why: "The nearest double to 0.1 is 0.10000000000000000555. Same hardware, same answer, same rule: never for money." },

    { q: "What is the largest amount an `int` can hold in minor units?",
      options: [
        "$2,147,483.64",
        "$214,748,364.70",
        "$21,474,836.47",
        "There is no limit"
      ],
      answer: 2,
      why: "And it wraps silently to negative after that. Use long, and Math.addExact when you want a throw instead." },

    { q: "Why must BigDecimal be constructed from a string?",
      options: [
        "It is faster",
        "Because the constructor requires it",
        "To set the scale",
        "Because `new BigDecimal(0.1)` is handed a double that is already wrong, so the exact type receives an inexact value"
      ],
      answer: 3,
      why: "Exactness has to start at the boundary. Once a double is involved, nothing downstream can recover it." },

    { q: "`new BigDecimal(\"1.0\").equals(new BigDecimal(\"1.00\"))` returns what, and why does it matter?",
      options: [
        "True, and it does not matter",
        "True, because the values are equal",
        "It throws",
        "False, because equals compares scale as well as value, so money comparisons must use compareTo"
      ],
      answer: 3,
      why: "This one costs everybody a day exactly once." },

    { q: "What does a sealed interface give you that a Python union type usually does not?",
      options: [
        "The compiler refuses to build when a switch does not handle every case, so adding an outcome finds every place that must change",
        "Faster dispatch",
        "Smaller memory use",
        "Runtime validation"
      ],
      answer: 0,
      why: "That is the property people mean when they say the type system pays for itself." },

    { q: "Which `@Transactional` behaviour catches everybody once?",
      options: [
        "It only works on public methods of interfaces",
        "Calling an annotated method from inside the same class does nothing, because the proxy is bypassed",
        "It requires an explicit commit",
        "It cannot be used with JDBC"
      ],
      answer: 1,
      why: "And by default it rolls back on unchecked exceptions only, so checked ones commit. Set rollbackFor for money." },

    { q: "Why turn off `open-in-view`?",
      options: [
        "It disables lazy loading",
        "Because it holds a database connection for the whole request including response writing, which multiplies the pool you need",
        "It breaks transactions",
        "It is deprecated"
      ],
      answer: 1,
      why: "The level 8 pool arithmetic applies unchanged, and this setting quietly invalidates it." },

    { q: "In Go, how are failures reported from a function that can fail?",
      options: [
        "Through a callback",
        "As an exception, caught by the caller",
        "As an error value returned beside the result, which the caller checks every time",
        "By panicking, which unwinds the stack"
      ],
      answer: 2,
      why: "Verbose on purpose: you cannot silently fail to handle something, which for money is the right trade." },

    { q: "Java threads run in parallel where Python threads do not. What follows for a payments service?",
      options: [
        "Shared mutable state is a genuine hazard, but the lost update from level 8 still lives in the database and still needs the same fixes",
        "Concurrency bugs disappear",
        "The database no longer needs locking",
        "You no longer need a connection pool"
      ],
      answer: 0,
      why: "Concurrency bugs in a payments service live in the database, not in the language." },

    { q: "What do virtual threads change?",
      options: [
        "They make CPU work faster",
        "They remove garbage collection pauses",
        "A thread costs hundreds of bytes instead of a megabyte and parks when it blocks, so ordinary blocking code gets asynchronous concurrency",
        "They replace the connection pool"
      ],
      answer: 2,
      why: "Which removes the reason most Java services reached for an asynchronous framework." },

    { q: "Why does a load test of a Java service need a warm up phase?",
      options: [
        "To fill the caches",
        "Because the JVM interprets bytecode first and compiles hot paths as it runs, so early requests measure the slow phase",
        "Because the connection pool starts empty",
        "To let the garbage collector settle"
      ],
      answer: 1,
      why: "And a canary that judges a new instance in its first thirty seconds will reject healthy releases." },

    { q: "A Java service in a container restarts with no log line and no stack trace. Most likely cause?",
      options: [
        "The JVM sized its heap for the host rather than the container limit, so the platform killed it for using too much memory",
        "A garbage collection pause",
        "A deadlock",
        "A failed health check"
      ],
      answer: 0,
      why: "Tell it what it may use. MaxRAMPercentage, and ExitOnOutOfMemoryError so it fails loudly." },

    { q: "What makes Testcontainers better than an in memory database for the level 8 race test?",
      options: [
        "It is faster",
        "It runs the real Postgres, which implements the locking the test exists to exercise",
        "It needs no configuration",
        "It works without Docker"
      ],
      answer: 1,
      why: "An in memory substitute would pass the test and ship the bug." },

    { q: "Your Java port benchmarks faster than the Python original. What should you check first?",
      options: [
        "The hardware",
        "The JVM version",
        "The garbage collector",
        "Whether both runs were warmed up, and what share of a request is database time in each"
      ],
      answer: 3,
      why: "If a payment is 5 ms of your code and 40 ms of database, the language was never the bottleneck." },

    { q: "Which is the honest reason to choose the JVM for a new payments service?",
      options: [
        "It is faster than Python",
        "It has better libraries",
        "Concurrency per instance and a compiler that checks your state machine, along with the hiring market you are targeting",
        "It uses less memory"
      ],
      answer: 2,
      why: "A latency claim that turns out to be mostly database time is a weak argument and an interviewer will test it." }
  ],

  project: {
    title: 'payments-api-java: the same service, on the JVM',
    story: 'Port the payments API from level 7 to Java and Spring Boot, with the money type from level 5, the state ' +
           'machine from level 9, the race from level 8 reproduced against a real Postgres in CI, and an honest ' +
           'benchmark against the Python original.',
    scope: 'Java 21 or later, Maven, Spring Boot, Testcontainers. The contract does not change: the same tests that ' +
           'exercised the Python service must pass against this one with only the base URL changed.',
    requirements: [
      'A `Money` record over `long` minor units, with the level 5 tests ported and overflow throwing rather than wrapping',
      'A test demonstrating that `new BigDecimal(0.1)` and `new BigDecimal("0.1")` differ',
      'A test demonstrating that `equals` and `compareTo` disagree about 1.0 and 1.00',
      'The card lifecycle as an enum plus a sealed interface, with a switch that stops compiling when an outcome is added',
      'The level 7 HTTP contract reproduced exactly: routes, status codes, idempotency, pagination and error shape',
      'Constructor injection with final fields throughout, and no field injection anywhere',
      'A `@ControllerAdvice` producing one consistent error format',
      '`open-in-view` disabled, and a Hikari pool size justified with the level 8 arithmetic in a comment',
      'Two tests that demonstrate the `@Transactional` traps: the bypassed proxy and the checked exception that commits',
      'Testcontainers running a real Postgres, with the level 8 lost update reproduced and then fixed two ways',
      'Virtual threads measured on and off, at several concurrency levels, with the JVM version and machine recorded',
      'A multi stage Dockerfile with the heap constrained and a readiness probe that tolerates JVM start up',
      'A graph of p99 against time from a cold start, showing warm up, with the canary window you would choose',
      'A benchmark of both services on the same hardware, warmed up, with p50, p99, goodput, and the database share of each request',
      'A paragraph on what you would choose for a new service and why, in which the word "faster" does not appear unqualified',
      'One component written in Go: the webhook sender, with a worker pool, a timeout on every call, retries with backoff and jitter, and graceful shutdown',
      'Throughput, p99 and memory for the Go component at a stated concurrency, with a CV line that claims only what it shows',
      'The repository public on GitHub as `payments-api-java`'
    ],
    starter: {
      lang: 'java',
      code: '// FinQuest level 18: the same service, on the JVM.\n//\n//   src/main/java/.../money/Money.java          long minor units, exact\n//   src/main/java/.../card/AuthResult.java      sealed, so the compiler checks\n//   src/main/java/.../api/PaymentController.java level 7 contract, unchanged\n//   src/main/java/.../api/ErrorAdvice.java      one error shape\n//   src/test/java/.../LostUpdateTest.java       level 8, against real Postgres\n//   bench/                                      both services, warmed up\n\npublic record Money(long minor, Currency currency) {\n\n    public Money {\n        Objects.requireNonNull(currency, "currency");\n    }\n\n    public Money plus(Money other) {\n        requireSameCurrency(other);\n        return new Money(Math.addExact(minor, other.minor), currency);\n    }\n\n    /** Split without losing a cent. The level 5 test suite ports unchanged. */\n    public List<Money> allocate(int... ratios) {\n        // TODO\n        throw new UnsupportedOperationException();\n    }\n\n    private void requireSameCurrency(Money other) {\n        if (!currency.equals(other.currency)) {\n            throw new IllegalArgumentException(\n                "cannot combine " + currency + " and " + other.currency);\n        }\n    }\n}\n'
    },
    tests: [
      'Allocating 100 minor units three ways loses nothing and the remainder is distributed deterministically',
      'Adding two amounts in different currencies throws',
      'An addition that would overflow throws rather than wrapping to a negative amount',
      'BigDecimal constructed from a double differs from the same literal constructed from a string',
      'Removing a case from an outcome switch fails compilation',
      'The level 7 integration suite passes against this service with only the base URL changed',
      'A repeated request with the same idempotency key returns the original response and creates no second payment',
      'A method annotated @Transactional and called from inside the same class does not open a transaction, and the test proves it',
      'A checked exception rolls back once rollbackFor is set, and commits without it',
      'The lost update reproduces against a real Postgres and is fixed by both pessimistic and optimistic locking',
      'The service refuses to start when a required configuration property is missing',
      'A cold start reaches its steady state p99 within the readiness window you configured',
      'Killing the Go worker under load loses no webhook and leaves no row marked published that was never sent'
    ],
    rubric: [
      { pts: 20, t: 'Money on the JVM', d: 'long minor units, BigDecimal used correctly, overflow handled, the two classic traps tested.' },
      { pts: 20, t: 'Types doing work', d: 'Records, enums and a sealed interface, with a compile failure demonstrated on purpose.' },
      { pts: 20, t: 'Spring used properly', d: 'Constructor injection, one error shape, transactions with both traps understood, pool sized with arithmetic.' },
      { pts: 20, t: 'Tested against reality', d: 'Testcontainers, the level 8 race reproduced and fixed twice, the level 7 suite passing unchanged.' },
      { pts: 20, t: 'Measured honestly', d: 'Warm up curve, virtual threads with conditions recorded, a benchmark whose limitations you state, and a Go component whose CV line claims only what it shows.' }
    ],
    stretch: [
      'Write the same service in Kotlin and compare the amount of code and the readability, on the same JVM',
      'Add GraalVM native image compilation and measure start up time and memory against the JVM version',
      'Port the level 12 saga and compare how the compiler helps or does not with a state machine that spans services',
      'Add JMH microbenchmarks for the money type and find out what your allocation function actually costs',
      'Run both services behind the same load balancer at 50/50 and compare their metrics on identical live traffic'
    ],
    solutionPath: 'solutions/level-18'
  },

  faq: [
    { q: 'Do I have to like Java?',
      a: 'No. You have to be able to read it, write a service in it, and discuss the JVM without bluffing. A good number of payments employers will not consider a candidate who cannot, and after this level you can, which is the entire purpose.' },
    { q: 'Kotlin instead?',
      a: 'Kotlin runs on the same JVM, uses the same Spring Boot and the same libraries, and is more pleasant to write. Learn the Java first, because interviews and existing code are in Java, then use Kotlin if the team does. The stretch goal is there for exactly this.' },
    { q: 'Which Java version?',
      a: '21 or later, because that is where records, sealed interfaces, pattern matching in switch and virtual threads all exist. A lot of existing code is on 8 or 11, and you will meet it, but learn on a modern version and know what is missing on an old one.' },
    { q: 'Maven or Gradle?',
      a: 'Maven for this, because its build file is declarative and easy to read when you are new. Gradle is more flexible and more common in larger codebases. Neither choice will matter to anybody interviewing you.' },
    { q: 'Is Spring Boot really necessary, or is it overkill?',
      a: 'For learning, it is what the jobs use, which settles it. It does a great deal implicitly, so make a point of understanding what each annotation causes rather than copying configuration, because the difference shows immediately in an interview.' },
    { q: 'My tests are slow because Testcontainers starts a database every time',
      a: 'Start one container for the whole test run rather than per test class, and reuse it. Then make your tests independent by cleaning data rather than recreating the schema. A single container plus a truncate between tests is usually the whole fix.' },
    { q: 'Why Go as well, and why only one component?',
      a: 'Because the same employers list it, and because a small concurrent component is enough to show you can work in it: goroutines, channels, checked errors, timeouts and a graceful shutdown. A second full port would take weeks and teach you almost nothing the first one did not. The claim you are making is that you can pick up a language and ship something correct in it, and one good component supports that claim completely.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Say that you ported a service you had already built and tested, so you could compare like with like, and lead with the two things that are genuinely hard: the level 8 race reproduced against a real Postgres in CI with Testcontainers, and an honest benchmark where you state how much of each request was database time. Then the sealed interface compile failure, because it shows you used the type system deliberately rather than because the language insisted. Mention the Go worker last and briefly, as evidence you can move between languages.' }
  ]
});
