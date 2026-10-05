//> using test.dep org.scalameta::munit::1.0.3
package recon

import java.nio.file.Paths
import java.time.LocalDate
import recon.Money.Cents

/** The tests.
  *
  *   scala-cli test . --server=false --jvm 21
  *
  * The suite that matters is `AgreementSuite`. Level 10 built this same
  * reconciliation in Python, and these assertions are its published figures.
  * Two implementations, written in two languages against the same 16,639 lines,
  * landing on the same numbers is a far stronger statement than either one
  * passing tests it wrote for itself.
  */

class MoneySuite extends munit.FunSuite:
  import Money.*

  test("an opaque type is a Long at run time and not a Long at compile time") {
    val c: Cents = Money(1299)
    assertEquals(c.toLong, 1299L)
    assertEquals(c.show, "$12.99")
  }

  test("negatives print with the sign in front") {
    assertEquals(Money(-1299).show, "-$12.99")
    assertEquals(Money(0).show, "$0.00")
  }

  test("thousands are grouped") {
    assertEquals(Money(311661).show, "$3,116.61")
  }

  test("an empty fee column is zero rather than a crash") {
    assertEquals(Money.parse("").toLong, 0L)
    assertEquals(Money.parse(" 255 ").toLong, 255L)
  }

  test("totalling an empty list is zero") {
    assertEquals(Money.total(Vector.empty).toLong, 0L)
  }

class KindSuite extends munit.FunSuite:
  test("only the three events that move money are recognised") {
    assertEquals(Kind.parse("capture"), Some(Kind.Capture))
    assertEquals(Kind.parse("refund"), Some(Kind.Refund))
    assertEquals(Kind.parse("chargeback"), Some(Kind.Chargeback))
    assertEquals(Kind.parse("authorize"), None)
    assertEquals(Kind.parse("decline"), None)
  }

  test("refunds and chargebacks move money the other way") {
    assertEquals(Kind.sign(Kind.Capture), 1)
    assertEquals(Kind.sign(Kind.Refund), -1)
    assertEquals(Kind.sign(Kind.Chargeback), -1)
  }

class BreakSuite extends munit.FunSuite:
  test("a pending settlement is not a break") {
    val pending = Break.PendingSettlement("P1", Kind.Capture, Money(100), LocalDate.now)
    val unsettled = Break.UnsettledCapture("P1", Kind.Capture, Money(100), LocalDate.now)
    assert(!Break.isBreak(pending), "a capture that has not settled yet is not a problem")
    assert(Break.isBreak(unsettled))
  }

  test("every break has an owner, because a break with no owner is one nobody works") {
    val all = Vector(
      Break.AmountMismatch("P1", Kind.Capture, Money(1), "x"),
      Break.CurrencyRounding("P1", Kind.Capture, Money(1), "EUR"),
      Break.DuplicateSettlement("P1", Kind.Capture, Money(1), "S1"),
      Break.MissingInLedger("P1", Kind.Capture, Money(1), LocalDate.now),
      Break.UnsettledCapture("P1", Kind.Capture, Money(1), LocalDate.now),
      Break.PendingSettlement("P1", Kind.Capture, Money(1), LocalDate.now),
    )
    all.foreach(b => assert(Break.owner(b).nonEmpty, s"${Break.label(b)} has no owner"))
  }

class ClassifySuite extends munit.FunSuite:
  val asOf = LocalDate.parse("2026-07-10")

  def capture(id: String, daysAgo: Int) = Movement(
    key = id, kind = Kind.Capture, amount = Money(1000),
    when = asOf.minusDays(daysAgo), source = Source.Ledger,
  )

  test("a capture two days old has not settled yet, and is not a break") {
    val r = Reconcile.Result(Vector.empty, Vector(capture("P1", 2)), Vector.empty, Vector.empty)
    val breaks = Reconcile.classify(r, asOf)
    assertEquals(breaks.size, 1)
    assert(!Break.isBreak(breaks.head), "two days is inside the three day window")
  }

  test("the same capture five days old is a break") {
    val r = Reconcile.Result(Vector.empty, Vector(capture("P1", 5)), Vector.empty, Vector.empty)
    val breaks = Reconcile.classify(r, asOf)
    assert(Break.isBreak(breaks.head))
  }

  test("the window boundary sits between two days and three") {
    // The window is three days, and the test is `when.isAfter(cutoff)`, so a
    // capture exactly three days old is already a break. Level 10's Python
    // engine does the same, and this assertion is what stops either of them
    // drifting by a day: an off by one here is a break raised a day early on
    // every unsettled capture, every morning.
    def at(days: Int) =
      val r = Reconcile.Result(Vector.empty, Vector(capture("P1", days)), Vector.empty, Vector.empty)
      Break.isBreak(Reconcile.classify(r, asOf).head)
    assert(!at(0), "settled today")
    assert(!at(2), "two days is inside the window")
    assert(at(3), "exactly three days old is already outside it")
    assert(at(4))
  }

  test("a break total is of magnitudes, so two errors that cancel do not vanish") {
    val breaks = Vector(
      Break.AmountMismatch("P1", Kind.Capture, Money(509), "over"),
      Break.AmountMismatch("P2", Kind.Capture, Money(-910), "under"),
    )
    val (count, value) = Reconcile.summary(breaks)("amount_mismatch")
    assertEquals(count, 2)
    assertEquals(value.toLong, 1419L, "not 401: netting hides the second error")
  }

/** The figures level 10's Python engine produces, asserted against this one. */
class AgreementSuite extends munit.FunSuite:
  val data = Paths.get("../../../data")

  lazy val ledger = Load.ledger(data.resolve("level-09-card-events.csv"))
  lazy val settlement = Load.settlement(data.resolve("level-10-settlement.csv"))

  test("both files load with no bad rows") {
    assertEquals(ledger._2, Vector.empty, "the ledger file has rows this loader cannot read")
    assertEquals(settlement._2, Vector.empty, "the settlement file has rows this loader cannot read")
  }

  test("the two sides are the sizes level 10 reports") {
    assertEquals(ledger._1.size, 16613)
    assertEquals(settlement._1.size, 16639)
  }

  test("16,408 exact matches, 163 converted, 30 with a different amount") {
    val r = Reconcile(ledger._1, settlement._1)
    assertEquals(r.byPass.getOrElse(Pass.Exact, 0), 16408)
    assertEquals(r.byPass.getOrElse(Pass.Converted, 0), 163)
    assertEquals(r.byPass.getOrElse(Pass.AmountDiffers, 0), 30)
  }

  test("every break category matches the Python engine, count and value") {
    val r = Reconcile(ledger._1, settlement._1)
    val asOf = settlement._1.map(_.when).max
    val s = Reconcile.summary(Reconcile.classify(r, asOf))

    def check(label: String, count: Int, cents: Long) =
      val (n, v) = s(label)
      assertEquals(n, count, s"$label count")
      assertEquals(v.toLong, cents, s"$label value")

    check("amount_mismatch", 30, 1419L)
    check("currency_rounding", 163, 116677L)
    check("duplicate_settlement", 1, 10412L)
    check("missing_in_ledger", 37, 311661L)
    check("unsettled_capture", 12, 169007L)
  }

  test("exactly one settlement line is sent twice") {
    val r = Reconcile(ledger._1, settlement._1)
    assertEquals(r.duplicates.size, 1)
  }

  test("nothing is pending: the file ends after every capture had time to settle") {
    val r = Reconcile(ledger._1, settlement._1)
    val asOf = settlement._1.map(_.when).max
    val breaks = Reconcile.classify(r, asOf)
    assertEquals(breaks.count(b => !Break.isBreak(b)), 0)
    assertEquals(breaks.count(Break.isBreak), 243)
  }
