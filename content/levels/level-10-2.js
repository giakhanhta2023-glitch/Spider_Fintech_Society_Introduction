/* =========================================================================
   LEVEL 10.2: Scala, and the job that runs at four in the morning.

   An aside, hanging off level 10 because it reconciles the same file. Numbered
   10.2 so nothing after it moves and level 11 still opens on level 10.
   ========================================================================= */
FQ.registerLevel({
  id: 10.2,
  position: '10.2',
  aside: true,
  codename: 'recon-scala',
  title: 'Scala, and the job that runs at four in the morning',
  tagline: 'Level 10 reconciled 16,639 settlement lines in Python. This does the same job in Scala and checks the two against each other, because the place Scala actually lives in a payments company is the batch that has to be right before anybody arrives.',
  difficulty: 7,
  minutes: 330,
  tags: ['scala', 'reconciliation', 'types', 'batch'],
  summary: 'The third and last of the language asides. Scala is on the same postings as Java and Ruby and it does a ' +
           'different job from both: not the API and not the business rules, but the large, cold, nightly data ' +
           'work where immutability and an exhaustive match stop being style arguments. You rebuild level 10\'s ' +
           'reconciliation and prove it right by making it agree, line for line, with the Python one you already ' +
           'wrote.',

  objectives: [
    'Say which part of a payments company writes Scala, and which parts do not',
    'Model every way a reconciliation can disagree as a closed set the compiler checks',
    'Hold money in an opaque type: compile time safety with no run time object',
    'Return errors as values, so a batch job collects every bad row instead of dying on the first',
    'Write the whole reconciliation as transformations over immutable collections',
    'Verify a rewrite by agreement with the original rather than by reading it'
  ],

  knowledge: [
    { h: 'Where Scala actually lives' },
    { p: 'Three languages, three asides, three different jobs. It is worth being precise about which is which, ' +
         'because "we are a Scala shop" is not a thing and nobody is hired to write Scala in general.' },
    { table: {
      head: ['The work', 'The language', 'Why'],
      rows: [
        ['The API customers call', 'Ruby, level 20.1', 'Business rules change weekly and are read by people who do not write code'],
        ['The browser taking the payment', 'TypeScript, level 10.1', 'There is no other option, and money needs the types'],
        ['The service that must not fall over', 'Java or Go, level 18', 'Throughput, tail latency, and a team that already knows the JVM'],
        ['**The nightly job over everything that happened**', '**Scala, this level**', 'Large immutable datasets, and Spark is written in it']
      ]
    }},
    { p: 'The last row is this level. A reconciliation reads every movement from both sides, groups them, compares ' +
         'them and reports what disagrees. It runs once, on a machine nobody is watching, and the only thing that ' +
         'matters is that the answer is right and the job finishes before people arrive. That shape, a pipeline of ' +
         'transformations over data nobody edits in place, is what Scala is for, and it is the shape **Spark** took ' +
         'and spread across a cluster.' },
    { p: 'The honest limit: this level does not teach Spark, and you should not reach for Spark at 16,639 lines. One ' +
         'machine and a `groupBy` is the right answer until it is not, and knowing where that line is matters more ' +
         'than knowing the API.' },
    { check: {
      q: 'Your reconciliation takes four minutes on one machine. Somebody proposes moving it to Spark. What do you ' +
         'ask before agreeing?',
      a: 'How big it will be in a year, and what four minutes is costing. Spark buys you a cluster and charges you a ' +
         'cluster: a scheduler, a shuffle, serialisation, a UI nobody reads, and a failure mode where the job is ' +
         'slower than the single machine because the data was never big enough to pay for the distribution. The ' +
         'answer is usually to leave it until one machine genuinely cannot hold the data, and the useful part is ' +
         'that the code barely changes when that day comes, because `map`, `filter` and `groupBy` over immutable ' +
         'collections is the same shape in both.'
    }},

    { h: 'Scala, for somebody who already writes Python' },
    { table: {
      head: ['Python', 'Scala', 'What it buys here'],
      rows: [
        ['`x = 1`, rebindable', '`val x = 1` cannot be reassigned; `var` can', 'A pipeline of `val`s has no step that can be changed behind you'],
        ['`if` is a statement', 'Everything is an expression, including `if` and `match`', '`val kind = if ... then ... else ...` is one assignment, not four lines and a mutation'],
        ['`isinstance` chains', '`match` with patterns, checked for exhaustiveness', 'The compiler names the case you did not handle'],
        ['`None`, and `Optional[X]` by convention', '`Option[X]`, and the compiler makes you open it', 'A missing settlement line cannot be read as a zero'],
        ['`raise` for everything that went wrong', '`Either[Error, A]` for what you expect, exceptions for what you do not', 'A bad row is collected rather than fatal']
      ]
    }},
    { p: 'The last two rows are the level. Everything else is syntax you will pick up by reading.' },
    { tip: 'Scala 3 is indentation sensitive and the braces are optional, so the code in this level looks much more ' +
           'like Python than Scala 2 did. If you find an old answer online full of braces and `implicit`, it is ' +
           'probably Scala 2 and worth skipping.' },

    { h: 'Every disagreement, as a closed set' },
    { p: 'A reconciliation has a finite number of ways to disagree, and the whole report is built from that list. ' +
         'Written as strings it is a list nobody can check:' },
    { code: 'breaks.append({"type": "amount_mismatch", "value": diff})\nbreaks.append({"type": "amount_mismatched", "value": diff})   # a typo, and a new category', lang: 'python' },
    { p: 'Written as an `enum` it is a closed set, and every place that handles a break has to handle all of them:' },
    { code: 'enum Break:\n  case AmountMismatch(key: String, kind: Kind, difference: Cents, detail: String)\n  case CurrencyRounding(key: String, kind: Kind, difference: Cents, currency: String)\n  case DuplicateSettlement(key: String, kind: Kind, amount: Cents, lineId: String)\n  case MissingInLedger(key: String, kind: Kind, amount: Cents, when: LocalDate)\n  case UnsettledCapture(key: String, kind: Kind, amount: Cents, when: LocalDate)\n  case PendingSettlement(key: String, kind: Kind, amount: Cents, when: LocalDate)\n\ndef owner(b: Break): String = b match\n  case _: AmountMismatch      => "payments engineering"\n  case _: CurrencyRounding    => "payments engineering"\n  case _: DuplicateSettlement => "processor operations"\n  case _: MissingInLedger     => "payments engineering"\n  case _: UnsettledCapture    => "processor operations"\n  case _: PendingSettlement   => "nobody: this is not a break"', lang: 'scala' },
    { p: 'Add a seventh kind of disagreement and that `match` stops compiling, naming the case you did not handle. ' +
         'Not a warning, not a test that might exist: the build fails. Every function that routes, totals or prints ' +
         'a break fails the same way, so a new category cannot be quietly dropped out of the report.' },
    { p: 'You have now seen this idea in three languages: the TypeScript union in level 10.1, the Java sealed ' +
         'interface in level 18, and this. The same guarantee each time, which is the point of meeting it three ' +
         'times. Typed languages all reach for it, to stop a list of cases from rotting.' },
    { p: 'Note `PendingSettlement`, which is the one that earns the design. A capture that has not settled yet is ' +
         '**not** a break, and giving it its own case means the report can carry it without counting it. Lumping it ' +
         'in with the real breaks is how a reconciliation report trains the people reading it to ignore the number ' +
         'at the bottom.' },

    { h: 'Money with no object' },
    { p: 'Level 10.1 used a TypeScript branded type to stop a plain number passing as money. Scala 3 has the same ' +
         'idea built into the language, and it is checked by a compiler that then erases it:' },
    { code: 'object Money:\n  opaque type Cents = Long\n\n  def apply(n: Long): Cents = n\n\n  extension (c: Cents)\n    def toLong: Long = c\n    def +(other: Cents): Cents = c + other\n    def show: String = ...\n\n// Inside Money.scala, Cents and Long are the same type.\n// Outside it, they are not:\nval fee: Cents = 255L            // does not compile\nval fee: Cents = Money(255)      // this is the only way in', lang: 'scala' },
    { table: {
      head: ['Approach', 'Run time cost', 'Where you met it'],
      rows: [
        ['A wrapper class holding a number', 'An object per amount, allocated and chased', 'The obvious answer, and the wrong one at sixteen thousand rows'],
        ['A branded type', 'None. It is a number', 'TypeScript, level 10.1'],
        ['`opaque type`', 'None. It is a `Long` in the bytecode', '**Here**'],
        ['A plain `Long` everywhere', 'None, and no safety either', 'How the bug gets in']
      ]
    }},
    { p: 'A `Long` holds about 92 million billion cents. Ruby\'s Integer has no ceiling at all, and this is still far more ' +
         'than a settlement file will ever ask for. The ceiling that matters in practice is the one in level 10.1, where ' +
         'JavaScript runs out at 2^53.' },

    { h: 'Errors that are values' },
    { p: 'A batch job reading 16,639 rows should not stop on the first bad one. It should read all of them, do the ' +
         'work with the good ones, and hand you every complaint at once, because a file with forty bad rows fixed ' +
         'one run at a time is forty nights.' },
    { p: 'In Python that is a list you append to and remember to check. In Scala the type says it:' },
    { code: 'def ledger(path: Path): (Vector[Movement], Vector[BadRow])\n\nval (movements, bad) = Load.ledger(path)\nif bad.nonEmpty then report(bad)       // and carry on with movements', lang: 'scala' },
    { p: 'The parse of each row returns an `Either[BadRow, Movement]`: a value that is one or the other, never both ' +
         'and never neither. Collecting them splits the file into what you can use and what you have to complain ' +
         'about, in one pass, with nothing thrown.' },
    { warn: 'Reserve exceptions for what you did not expect. A missing column means you are reading a different ' +
            'file, and continuing past it means reading the wrong column silently. That one should throw, loudly, ' +
            'at load. The rule: expected failure is a value, unexpected failure is an exception, and the test of ' +
            '"expected" is whether the caller has something sensible to do about it.' },

    { h: 'A reconciliation is a fold' },
    { p: 'Strip the domain away and the whole job is four moves you already know from pandas: group both sides by a ' +
         'key, pair them up, classify what does not pair, and total the result.' },
    { code: 'val ours   = ledger.groupBy(_.matchKey)            // Map[(String, Kind), Vector[Movement]]\nval theirs = settlement.groupBy(_.matchKey)\n\nval decided = theirs.toVector.map { (key, lines) =>\n  ours.get(key) match\n    case None       => Left(lines.head)                 // they paid us for something we never did\n    case Some(mine) => Right(compare(mine, lines.head))\n}\n\nval matches   = decided.collect { case Right(m) => m }\nval unmatched = decided.collect { case Left(m)  => m }', lang: 'scala' },
    { p: 'Nothing is mutated. Every line takes collections and returns new ones, which means the whole reconciliation ' +
         'is a function you can call in a test rather than a process you have to set up. It also means it is ' +
         'trivially parallel: nothing is sharing state, so nothing can race, which is the quiet argument behind all ' +
         'of this and the reason the same code shape survives being spread across a cluster.' },
    { p: 'The passes run strictest first and a matched line leaves the pool, so a looser pass can never steal a line ' +
         'that an exact match would have claimed. That ordering is a rule about correctness rather than speed, and ' +
         'it is the same ordering level 10 used.' },

    { h: 'How you know a rewrite is right' },
    { p: 'You have now written this reconciliation twice. The second one is not verified by reading it, by its own ' +
         'tests, or by it looking sensible. It is verified by **agreeing with the first**, on the real file:' },
    { code: 'exact matches        16,408\nconverted               163\namount differs           30\n\namount_mismatch       30      $14.19\ncurrency_rounding    163   $1,166.77\nduplicate_settlement   1     $104.12\nmissing_in_ledger     37   $3,116.61\nunsettled_capture     12   $1,690.07', lang: 'text' },
    { p: 'Two implementations, two languages, two people\'s worth of assumptions, 16,639 lines, and every count and ' +
         'every total identical. That is a far stronger statement than either engine passing tests it wrote for ' +
         'itself, because the tests were written by the same mind that wrote the bug.' },
    { tip: 'This is how a rewrite is actually done in production: run both, compare the output on real data, and ' +
           'only turn the old one off when they have agreed for long enough that a difference would be news. It is ' +
           'the same shape as the dual write in level 11.' },
    { check: {
      q: 'Your Scala engine agrees with the Python one on every count but reports the amount mismatch total as ' +
         '$4.01 where Python says $14.19. Which is wrong, and how would you know?',
      a: 'Look at how each one totals, and the answer is that netting is wrong. One line settled $5.09 over and ' +
         'another $9.10 under nets to $4.01, which understates the work and, worse, lets two errors that happen to ' +
         'cancel look like one small one. The question a finance team is asking is how much is in dispute, not what ' +
         'the net is, so the total is of magnitudes. This exact disagreement happened while writing the solution, ' +
         'and the useful part is that neither engine was obviously wrong on its own: it took the comparison to ' +
         'surface the question at all.'
    }}
  ],

  tutorial: {
    intro: 'A reconciliation in Scala 3, checked against the Python one from level 10. Install nothing permanent: ' +
           'scala-cli is a single executable that fetches its own compiler and its own JVM.',
    steps: [
      {
        t: 'One executable, no build tool',
        blocks: [
          { p: 'Scala has a reputation for a heavy setup, and most of that reputation is sbt. You do not need it. ' +
               '**scala-cli** is one binary that downloads the compiler, the libraries and a JVM on first run.' },
          { code: '# download scala-cli for your platform from scala-cli.virtuslab.org\n# then, in an empty directory:\n\ncat > hello.scala <<EOF\n//> using scala 3.3.4\n@main def hello(): Unit =\n  println(List(1, 2, 3).map(_ * 2))\nEOF\n\nscala-cli run hello.scala', lang: 'bash' },
          { p: 'The `//> using` line is a directive: the file states the Scala version and its dependencies itself, ' +
               'so there is no separate build file for a project this size.' },
          { warn: 'If you have an old Java on your PATH, the compile server will fail to start with an exit code and ' +
                  'no useful message. `--jvm 21 --server=false` makes scala-cli fetch its own and skip the server, ' +
                  'which is slower per run and immune to whatever is installed. The solution was built that way for ' +
                  'exactly this reason.' }
        ],
        check: 'scala-cli run hello.scala prints List(2, 4, 6).'
      },
      {
        t: 'Money, with nothing allocated',
        blocks: [
          { code: 'object Money:\n  opaque type Cents = Long\n\n  def apply(n: Long): Cents = n\n\n  def parse(text: String): Cents =\n    text.trim match\n      case ""    => 0L           // an empty fee column is zero, not a crash\n      case other => other.toLong\n\n  extension (c: Cents)\n    def toLong: Long = c\n    def +(other: Cents): Cents = c + other\n    def abs: Cents = math.abs(c)\n    def show: String =\n      val sign = if c < 0 then "-" else ""\n      f"$sign$$${math.abs(c) / 100}%,d.${math.abs(c) % 100}%02d"\n\n  given Ordering[Cents] = Ordering.Long\n\n  def total(xs: Iterable[Cents]): Cents = xs.foldLeft(0L)(_ + _)', lang: 'scala' },
          { p: '`opaque type` means `Cents` and `Long` are the same type inside this file and different types ' +
               'outside it. `extension` adds methods to it without a wrapper, so `amount.show` works and there is ' +
               'still no object: in the bytecode it is a `Long`.' },
          { p: 'The `parse("")` case is not padding. The settlement file leaves the fee column empty on some rows, ' +
               'and `"".toLong` throws. One line here is the difference between a loader that works and one that ' +
               'dies two thirds of the way through the file.' }
        ],
        check: 'Money(311661).show is "$3,116.61", and a bare 255L will not compile as a Cents.'
      },
      {
        t: 'The shape both sides share',
        blocks: [
          { p: 'The two files look nothing alike. The first job of the loader is to make them, so that everything ' +
               'after it compares like with like:' },
          { code: 'final case class Movement(\n    key: String,          // payment id: what the two sides agree to call it\n    kind: Kind,\n    amount: Cents,        // signed\n    when: LocalDate,\n    source: Source,\n    currency: String = "USD",\n    fee: Cents = Money(0),\n    lineId: String = "",\n    note: String = "",\n):\n  def matchKey: (String, Kind) = (key, kind)\n\nenum Kind:\n  case Capture, Refund, Chargeback\n\nenum Source:\n  case Ledger, Settlement', lang: 'scala' },
          { p: 'A `case class` gives you the constructor, accessors, equality by value, a readable `toString`, `copy` ' +
               'and pattern matching from one line. It is level 5\'s frozen dataclass and level 18\'s record again.' },
          { warn: 'Only three events move money: capture, refund and chargeback. An authorisation is a hold and ' +
                  'settles nothing. Including authorisations in the ledger side is the mistake that makes a ' +
                  'reconciliation report thousands of missing settlements that were never coming, and it is the ' +
                  'first thing to check when the numbers are absurd.' }
        ],
        check: 'Kind.parse("authorize") is None, and Kind.sign(Kind.Refund) is -1.'
      },
      {
        t: 'Loading, without dying on a bad row',
        blocks: [
          { code: 'final case class BadRow(file: String, line: Int, why: String)\n\ndef settlement(path: Path): (Vector[Movement], Vector[BadRow]) =\n  val (header, body) = rows(path)\n\n  val parsed = body.map { (lineNo, f) =>\n    val bad = (why: String) => Left(BadRow(path.getFileName.toString, lineNo, why))\n    Kind.parse(f(kindCol)) match\n      case None => bad(s"unknown settlement type ${f(kindCol)}")\n      case Some(k) =>\n        val amount = f(gross).toLong\n        if Kind.sign(k) * amount < 0 then\n          bad(s"a ${f(kindCol)} of $amount: the sign convention has changed")\n        else\n          Right(Movement(key = f(pid), kind = k, amount = Money(amount), ...))\n  }\n\n  (parsed.collect { case Right(m) => m }, parsed.collect { case Left(b) => b })', lang: 'scala' },
          { p: 'Every row becomes an `Either`, and the two `collect` calls split them. Nothing is thrown, so one ' +
               'unreadable row does not cost you the other 16,638.' },
          { p: 'The sign check is the one worth copying. Their file already carries the sign, so it is **checked ' +
               'rather than re-derived**: if a refund ever arrives positive, that line is where you find out, ' +
               'instead of every comparison below being quietly wrong and the report looking fine.' },
          { p: 'A missing column, though, throws:' },
          { code: 'private def column(header: Vector[String], name: String): Int =\n  val at = header.indexOf(name)\n  require(at >= 0, s"column $name is missing, found ${header.mkString(",")}")\n  at', lang: 'scala' },
          { p: 'That is the line between the two kinds of failure. A bad row is expected and collected. A file whose ' +
               'columns have moved is a different file, and reading column 4 as though it were column 5 silently is ' +
               'much worse than stopping.' }
        ],
        check: 'Both files load with an empty Vector of bad rows, 16,613 and 16,639 movements.'
      },
      {
        t: 'Breaks, as a closed set',
        blocks: [
          { code: 'enum Break:\n  case AmountMismatch(key: String, kind: Kind, difference: Cents, detail: String)\n  case CurrencyRounding(key: String, kind: Kind, difference: Cents, currency: String)\n  case DuplicateSettlement(key: String, kind: Kind, amount: Cents, lineId: String)\n  case MissingInLedger(key: String, kind: Kind, amount: Cents, when: LocalDate)\n  case UnsettledCapture(key: String, kind: Kind, amount: Cents, when: LocalDate)\n  case PendingSettlement(key: String, kind: Kind, amount: Cents, when: LocalDate)\n\nobject Break:\n  def isBreak(b: Break): Boolean = b match\n    case _: PendingSettlement => false\n    case _                    => true', lang: 'scala' },
          { p: 'Each case carries exactly what that kind of disagreement has, so there is no `lineId` field to read ' +
               'on a break that has no settlement line. The same narrowing as the TypeScript union in level 10.1.' },
          { tip: 'Write `owner`, `value` and `label` as separate exhaustive matches rather than as fields on the ' +
                 'enum. Three functions that each fail to compile when you add a case is three reminders, and the ' +
                 'one you would have forgotten is the routing.' }
        ],
        check: 'Adding a seventh case makes owner(), value() and label() all fail to compile.'
      },
      {
        t: 'Matching, strictest first',
        blocks: [
          { code: 'val grouped = settlement.groupBy(_.matchKey)\n\n// Pass 0: the same line twice. The processor sent it; we did it once.\nval firsts = grouped.view.mapValues(_.sortBy(_.lineId)).toMap\nval duplicates = firsts.values.flatMap(_.drop(1)).toVector\n\nval decided = firsts.toVector.map { (key, lines) =>\n  val theirs = lines.head\n  byKey.get(key) match\n    case None => Left(theirs)                      // nothing of ours matches\n    case Some(mine) =>\n      Right(\n        if mine.amount == theirs.amount then\n          Match(mine, theirs, Pass.Exact, "same payment, kind and amount")\n        else if theirs.currency != "USD" then\n          Match(mine, theirs, Pass.Converted, s"settled in ${theirs.currency}", diff)\n        else\n          Match(mine, theirs, Pass.AmountDiffers, "same payment and kind, different amount", diff)\n      )\n}', lang: 'scala' },
          { p: 'The duplicate is found before matching, and the **first** line still goes through normal matching: ' +
               'they sent it twice, we did it once, so one of them is real and the rest are the problem. Sorting by ' +
               'line id before taking the first is what makes that choice deterministic, so two runs never blame ' +
               'different lines.' },
          { p: 'A converted line is still a match. It is the same movement, settled in another currency, and the ' +
               'difference is classified separately rather than tolerated. Widening a tolerance until the ' +
               'disagreement disappears is how a reconciliation stops finding anything.' }
        ],
        check: '16,408 exact, 163 converted, 30 with a different amount, and exactly one duplicate.'
      },
      {
        t: 'Classifying, and the window',
        blocks: [
          { code: 'def classify(result: Result, asOf: LocalDate, settlementWindowDays: Int = 3): Vector[Break] =\n  val cutoff = asOf.minusDays(settlementWindowDays)\n\n  val fromOurSide = result.unmatchedLedger.map { m =>\n    if m.when.isAfter(cutoff) then Break.PendingSettlement(m.key, m.kind, m.amount, m.when)\n    else Break.UnsettledCapture(m.key, m.kind, m.amount, m.when)\n  }\n\n  fromMatches ++ fromDuplicates ++ fromTheirSide ++ fromOurSide', lang: 'scala' },
          { p: 'Three days, because the processor documents T+2 and a day of slack costs nothing. It is a parameter ' +
               'rather than a literal because it is a policy somebody may reasonably want to change, and a ' +
               'settlement window buried inside an `if` is a policy nobody can find.' },
          { warn: 'The boundary is worth pinning with a test, and worth getting right by reading rather than by ' +
                  'guessing. `isAfter(cutoff)` means a capture **exactly** three days old is already a break. Off by ' +
                  'one here is a break raised a day early on every unsettled capture, every morning, until people ' +
                  'stop reading the report.' },
          { p: 'And the totals, which is the other place a reconciliation quietly lies:' },
          { code: 'def summary(breaks: Vector[Break]): Map[String, (Int, Cents)] =\n  breaks.groupBy(Break.label).view.mapValues { bs =>\n    (bs.size, Money.total(bs.map(b => Break.value(b).abs)))      // magnitudes, not net\n  }.toMap', lang: 'scala' },
          { p: 'One line over by $5.09 and another under by $9.10 nets to $4.01. The question is how much is in ' +
               'dispute, not what the net is, so the total is of magnitudes.' }
        ],
        check: 'A capture two days old is pending; three days old is a break.'
      },
      {
        t: 'Agreeing with the engine you already wrote',
        blocks: [
          { p: 'The last step is the real one. Point both engines at the same two files and assert, in the Scala ' +
               'tests, the numbers level 10 publishes:' },
          { code: 'test("every break category matches the Python engine, count and value") {\n  val r = Reconcile(ledger, settlement)\n  val s = Reconcile.summary(Reconcile.classify(r, asOf))\n\n  def check(label: String, count: Int, cents: Long) =\n    val (n, v) = s(label)\n    assertEquals(n, count, s"$label count")\n    assertEquals(v.toLong, cents, s"$label value")\n\n  check("amount_mismatch", 30, 1419L)\n  check("currency_rounding", 163, 116677L)\n  check("duplicate_settlement", 1, 10412L)\n  check("missing_in_ledger", 37, 311661L)\n  check("unsettled_capture", 12, 169007L)\n}', lang: 'scala' },
          { p: 'When they disagree, neither one is obviously wrong, and that is the useful part. You have to go and ' +
               'decide which behaviour you actually want, which is a question you would never have asked with one ' +
               'implementation.' },
          { tip: 'Keep the comparison in the test suite rather than in a notebook. A rewrite that agreed once, ' +
                 'months ago, on a file nobody still has, is not evidence of anything.' }
        ],
        check: 'scala-cli test passes, including six assertions taken from level 10\'s published figures.'
      }
    ]
  },

  glossary: [
    { t: 'Case class', d: 'An immutable record with value equality, pattern matching and copy, from one declaration.' },
    { t: 'enum', d: 'A closed set of alternatives, each able to carry its own fields. Scala 3\'s algebraic data type.' },
    { t: 'Exhaustive match', d: 'A match the compiler proves covers every case, so adding one breaks the build.' },
    { t: 'opaque type', d: 'A type that is distinct outside its own file and identical to the underlying one inside it. No run time cost.' },
    { t: 'extension', d: 'Methods added to a type from outside it, without a wrapper object.' },
    { t: 'val and var', d: '`val` cannot be reassigned, `var` can. Pipelines are written in `val`.' },
    { t: 'Option', d: '`Some(x)` or `None`, replacing a null the compiler cannot see.' },
    { t: 'Either', d: '`Left` or `Right`: a value that is a failure or a success, used where a failure is expected.' },
    { t: 'Fold', d: 'Reducing a collection to one value by combining as you go. `foldLeft` is the general form of sum.' },
    { t: 'Immutable collection', d: 'One that returns a new collection instead of changing itself. The default in Scala.' },
    { t: 'Spark', d: 'The distributed data engine written in Scala. The same transformations, across a cluster.' },
    { t: 'Dual run', d: 'Running an old and a new implementation side by side and comparing output, to verify a rewrite.' }
  ],

  quiz: [
    { q: 'Which part of a payments company most often writes Scala?',
      options: ['The customer facing API', 'The browser checkout', 'The large nightly and streaming data work, where Spark lives', 'The deployment pipeline'],
      answer: 2,
      why: 'Not the API, which is the Ruby of level 20.1, and not the hot service, which is the Java and Go of level 18.' },

    { q: 'What is the difference between `val` and `var`?',
      options: ['`val` cannot be reassigned; `var` can', '`val` is a compile time constant; `var` is run time', '`val` is immutable all the way down; `var` is shallow', '`val` is lazy; `var` is eager'],
      answer: 0,
      why: 'Note what it is not: a `val` holding a mutable collection is still a reference you cannot rebind to a collection that can change.' },

    { q: 'You add a seventh case to the `Break` enum. What happens?',
      options: ['Nothing until a test fails', 'A warning at run time', 'The new case is ignored by existing matches', 'Every exhaustive match over Break fails to compile, naming the case you did not handle'],
      answer: 3,
      why: 'Which is why `owner`, `value` and `label` are three separate matches: three reminders rather than one.' },

    { q: 'What does `opaque type Cents = Long` cost at run time?',
      options: ['One object allocation per amount', 'Nothing. It is a `Long` in the bytecode', 'A boxing conversion on every comparison', 'A small table lookup'],
      answer: 1,
      why: 'Compile time safety with no run time object, which matters when you are holding sixteen thousand of them.' },

    { q: 'Why does the loader return `(Vector[Movement], Vector[BadRow])` instead of throwing on a bad row?',
      options: ['So a batch job reads every row and reports every complaint at once, instead of being fixed one night at a time', 'Because exceptions are slow in Scala', 'Because Vector cannot hold exceptions', 'To avoid a stack trace in the log'],
      answer: 0,
      why: 'Forty bad rows discovered one per run is forty nights.' },

    { q: 'A column is missing from the header. Bad row or exception?',
      options: ['Bad row: collect it and carry on', 'Bad row, with a warning logged', 'Exception. A file whose columns moved is a different file, and reading the wrong column silently is worse than stopping', 'Depends on which column'],
      answer: 2,
      why: 'Expected failure is a value, unexpected failure is an exception, and the test is whether the caller has anything sensible to do about it.' },

    { q: 'Why does the duplicate pass keep the first line and flag the rest?',
      options: ['The first is always the cheapest', 'They sent it twice and we did it once, so one is real and the rest are the problem', 'The later lines are more likely to be corrupt', 'It matches what the payout file does'],
      answer: 1,
      why: 'Sorting by line id first is what makes the choice deterministic, so two runs never blame different lines.' },

    { q: 'A settlement line arrives in EUR and the amount differs from the ledger. How is it treated?',
      options: ['Unmatched, because the currencies differ', 'Matched, and the difference absorbed into a tolerance', 'A duplicate', 'Matched, with the difference classified as currency rounding rather than tolerated'],
      answer: 3,
      why: 'It is the same movement. Widening a tolerance until a disagreement disappears is how a reconciliation stops finding anything.' },

    { q: 'The window is three days and the test is `when.isAfter(cutoff)`. A capture exactly three days old is:',
      options: ['Already a break', 'Still pending', 'Pending until the end of that day', 'Excluded from the report'],
      answer: 0,
      why: 'Worth pinning with a test. Off by one here raises a break a day early on every unsettled capture, every morning.' },

    { q: 'Two amount mismatches, one +$5.09 and one -$9.10. What should the report total?',
      options: ['-$4.01, the net', '$0.00, since they offset', '$14.19, the sum of magnitudes', '$9.10, the larger'],
      answer: 2,
      why: 'The question is how much is in dispute. Netting lets two errors that happen to cancel look like one small one.' },

    { q: 'Why is `PendingSettlement` a separate case rather than just a break?',
      options: ['To make the enum exhaustive', 'Because a capture that has not settled yet is not a problem, and counting it as one trains people to ignore the report', 'Because it has different fields', 'To let it be retried automatically'],
      answer: 1,
      why: 'A report that cries wolf is a report nobody opens, which is worse than no report.' },

    { q: 'What makes the reconciliation trivially parallel?',
      options: ['It uses parallel collections', 'It runs on the JVM', 'The data is sorted first', 'Nothing is mutated, so nothing is shared and nothing can race'],
      answer: 3,
      why: 'And it is the same reason the shape survives being spread across a cluster by Spark.' },

    { q: 'Your 16,639 line job takes four minutes. Should it move to Spark?',
      options: ['Almost certainly not yet, and the code barely changes when it should', 'Yes, Spark is always faster', 'Yes, to get the monitoring UI', 'Only if written in Scala 2'],
      answer: 0,
      why: 'Spark charges you a scheduler, a shuffle and serialisation. Below the size where one machine struggles, it is often slower.' },

    { q: 'What is the strongest evidence that this rewrite is correct?',
      options: ['Its own test suite passes', 'The types are exhaustive', 'It agrees with the Python engine, count and total, on the real 16,639 line file', 'It is faster than the original'],
      answer: 2,
      why: 'Tests written by the same mind that wrote the bug agree with the bug. Two independent implementations do not.' },

    { q: 'The two engines disagree on one total. What is the first thing to do?',
      options: ['Trust the older one and move on', 'Find out which behaviour you actually want, because neither is obviously wrong', 'Average them', 'Widen a tolerance until they agree'],
      answer: 1,
      why: 'That question is the whole value of the dual run: with one implementation it would never have been asked.' }
  ],

  project: {
    title: 'The same reconciliation, in Scala, agreeing to the cent',
    story: 'Rebuild level 10\'s reconciliation in Scala 3 against the same two files, then prove it by making it ' +
           'agree with the Python engine on every count and every total. Model the disagreements as a closed set ' +
           'the compiler checks, hold money in an opaque type, collect bad rows instead of dying on them, and write ' +
           'the whole thing as transformations over immutable collections.',
    scope: 'Uses levels 9 and 10 and their datasets. Scala 3.3 and scala-cli, which is one executable that fetches ' +
           'its own compiler and JVM, plus munit for the tests. No sbt, no Spark, no database. **This is the only ' +
           'Scala in the course** and it is an aside, so level 11 opens on level 10 whether you do this or not.',
    dataset: '{{RAW}}/data/level-10-settlement.csv',
    requirements: [
      'A Scala 3 project built with scala-cli and a `//> using` directive, with no sbt build file',
      'Money as an `opaque type Cents = Long`, with extension methods and no wrapper object',
      'An empty fee column parsing as zero rather than throwing',
      'A `Movement` case class that both files load into, so everything downstream compares like with like',
      '`Kind` as an enum of capture, refund and chargeback only, with authorisations excluded and a test proving it',
      'The settlement file\'s sign convention checked on load rather than re-derived, failing the row if it changes',
      'A missing column raising, while a bad row is collected: both behaviours tested',
      'Loaders returning `(Vector[Movement], Vector[BadRow])` so one bad row does not cost you the file',
      '`Break` as an enum of at least six cases, each carrying only the fields that kind of break has',
      '`owner`, `value` and `label` as three separate exhaustive matches over Break',
      'Matching in named passes, strictest first, with a matched line leaving the pool',
      'Duplicates found before matching, sorted deterministically, with the first line still matched normally',
      'A converted line matched and classified rather than absorbed into a tolerance',
      'The settlement window as a parameter with a default, not a literal buried in an `if`',
      'Break totals of magnitudes rather than net, with a test using two amounts that cancel',
      'A test suite asserting level 10\'s published figures: 16,408 exact, 163 converted, 30 differing, and all five break categories by count and value',
      'A README with both engines\' output side by side'
    ],
    starter: {
      lang: 'scala',
      code: '//> using scala 3.3.4\npackage recon\n\nimport java.time.LocalDate\n\nobject Money:\n  opaque type Cents = Long\n\n  def apply(n: Long): Cents = n\n\n  def parse(text: String): Cents =\n    // TODO: an empty fee column is zero, not a crash\n    ???\n\n  extension (c: Cents)\n    def toLong: Long = c\n    def show: String = ???     // TODO: "$3,116.61", and "-$12.99" for negatives\n\n\nenum Kind:\n  case Capture, Refund, Chargeback\n\nobject Kind:\n  def parse(s: String): Option[Kind] = ???   // TODO: authorisations are None\n  def sign(k: Kind): Int = ???               // TODO: refunds and chargebacks are -1\n\n\nenum Break:\n  // TODO: AmountMismatch, CurrencyRounding, DuplicateSettlement,\n  // MissingInLedger, UnsettledCapture, PendingSettlement.\n  // Each carries only the fields that kind of break actually has.\n  case Placeholder\n\nobject Break:\n  def isBreak(b: Break): Boolean = ???   // pending settlement is NOT a break\n  def owner(b: Break): String = ???\n  def value(b: Break): Money.Cents = ???\n\n\nobject Reconcile:\n  def apply(ledger: Vector[Movement], settlement: Vector[Movement]): Result =\n    // TODO: group both sides, duplicates first, then exact, converted,\n    // amount differs. A matched line leaves the pool.\n    ???\n\n  def classify(result: Result, asOf: LocalDate, settlementWindowDays: Int = 3): Vector[Break] =\n    ???\n\n  def summary(breaks: Vector[Break]): Map[String, (Int, Money.Cents)] =\n    // TODO: magnitudes, not net\n    ???\n'
    },
    tests: [
      'Both files load with no bad rows: 16,613 ledger movements and 16,639 settlement lines',
      'Kind.parse("authorize") is None, so holds are never counted as unsettled',
      'A settlement refund arriving positive is a bad row naming the sign convention',
      'A missing column raises rather than being collected',
      'Matching reports 16,408 exact, 163 converted and 30 with a different amount',
      'Exactly one settlement line is a duplicate',
      'amount_mismatch is 30 lines totalling $14.19, as magnitudes not net',
      'currency_rounding is 163 lines totalling $1,166.77',
      'missing_in_ledger is 37 lines totalling $3,116.61',
      'unsettled_capture is 12 lines totalling $1,690.07',
      'A capture two days old is pending; three days old is a break',
      'Two mismatches of +$5.09 and -$9.10 total $14.19, not $4.01',
      'Money(311661).show is "$3,116.61" and a bare Long will not compile as a Cents'
    ],
    rubric: [
      { pts: 25, t: 'It agrees', d: 'Every count and every total matches the Python engine on the real file, asserted in tests.' },
      { pts: 20, t: 'The disagreements are a closed set', d: 'An enum with per case fields, and at least three exhaustive matches over it.' },
      { pts: 15, t: 'Bad rows are collected', d: 'Loaders return failures as values; a changed header still raises.' },
      { pts: 15, t: 'Nothing is mutated', d: 'The reconciliation is transformations over immutable collections, callable from a test.' },
      { pts: 15, t: 'Policy is visible', d: 'The window is a parameter, the totals are magnitudes, and both choices are commented with why.' },
      { pts: 10, t: 'Money', d: 'An opaque type with no run time object, and an empty fee column handled.' }
    ],
    stretch: [
      'Run both engines over a file ten times the size and report where the time goes in each',
      'Add the fee check from level 10 and see whether the two still agree to the cent',
      'Rewrite the matching with parallel collections and measure whether it was worth it at this size',
      'Express the same pipeline in Spark locally, and report how much of the code actually changed'
    ],
    solutionPath: 'solutions/level-10-2'
  },

  faq: [
    { q: 'Why is this 10.2 rather than its own rung?',
      a: 'Because it is a third language aside, like 10.1 and 20.1, and the ladder is twenty rungs against twenty ' +
         'rank titles. It sits at 10.2 because it reconciles level 10\'s file, so the comparison is the point. ' +
         'Level 11 opens on level 10 whether you do this or not.' },
    { q: 'Do I need sbt?',
      a: 'No, and that is deliberate. sbt is most of Scala\'s setup reputation. scala-cli is one executable that ' +
         'fetches the compiler, the libraries and a JVM, and the whole project is four files plus a directive.' },
    { q: 'Is Scala worth learning if I am not going into data engineering?',
      a: 'Honestly, it is the least generally useful of the three asides. Take this level for the ideas rather than ' +
         'the language: an exhaustive match over a closed set and errors as values are worth having in any language, ' +
         'and you will write them better in Python afterwards.' },
    { q: 'Why not teach Spark?',
      a: 'Because Spark at 16,639 lines teaches you that Spark is slower, and a cluster you do not need is the most ' +
         'expensive thing in this course. The transformations here are the ones Spark uses, so the step up is small ' +
         'on the day the data is genuinely too big, and the stretch goal asks you to measure exactly how small.' }
  ]
});
