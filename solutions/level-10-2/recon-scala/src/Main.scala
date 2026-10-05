//> using scala 3.3.4
package recon

import java.nio.file.{Path, Paths}
import java.time.LocalDate

/** Run it:
  *
  *   scala-cli run . -- ../../../data/level-09-card-events.csv ../../../data/level-10-settlement.csv
  *
  * The numbers printed here are checked against level 10's Python engine in
  * test/ReconcileTest.scala. Two independent implementations agreeing on
  * sixteen thousand lines is a stronger statement than either one passing its
  * own tests.
  */
@main def run(args: String*): Unit =
  val here = Paths.get("").toAbsolutePath
  val ledgerPath = Paths.get(if args.length > 0 then args(0) else "../../../data/level-09-card-events.csv")
  val settlePath = Paths.get(if args.length > 1 then args(1) else "../../../data/level-10-settlement.csv")

  val (ledger, ledgerBad) = Load.ledger(ledgerPath)
  val (settlement, settleBad) = Load.settlement(settlePath)

  println(s"ledger      ${ledger.size} movements")
  println(s"settlement  ${settlement.size} lines")
  if ledgerBad.nonEmpty || settleBad.nonEmpty then
    println(s"bad rows    ${ledgerBad.size + settleBad.size}")
    (ledgerBad ++ settleBad).take(5).foreach(b => println(s"   ${b.file}:${b.line} ${b.why}"))

  val result = Reconcile(ledger, settlement)
  val asOf = settlement.map(_.when).max
  val breaks = Reconcile.classify(result, asOf)

  println(s"\nas of $asOf\n")
  println("   matched")
  Seq(Pass.Exact, Pass.Converted, Pass.AmountDiffers).foreach { p =>
    println(f"      ${p.toString}%-16s${result.byPass.getOrElse(p, 0)}%6d")
  }

  println("\n   breaks")
  Reconcile.summary(breaks).toVector.sortBy(_._1).foreach { case (label, (n, value)) =>
    val tag = if label == "pending_settlement" then "  (not a break)" else ""
    println(f"      $label%-24s$n%6d  ${value.show}%14s$tag")
  }

  val real = breaks.filter(Break.isBreak)
  println(s"\n   ${real.size} breaks to work, ${breaks.size - real.size} pending")
