package recon

import java.time.LocalDate
import recon.Money.Cents

/** The reconciliation, as a fold over immutable collections.
  *
  * Nothing here mutates anything. Every step takes collections and returns new
  * ones, which is what makes the whole thing a value you can test by calling it
  * rather than a process you have to set up. It is also the shape Spark wants:
  * group, map, reduce over data you do not edit in place.
  *
  * The passes run strictest first, and a matched line leaves the pool, so a
  * looser pass can never steal a line an exact pass would have claimed.
  */
object Reconcile:

  final case class Result(
      matches: Vector[Match],
      unmatchedLedger: Vector[Movement],
      unmatchedSettlement: Vector[Movement],
      duplicates: Vector[Movement],
  ):
    def byPass: Map[Pass, Int] = matches.groupBy(_.pass).view.mapValues(_.size).toMap

  /** Our own side having duplicates is a different and worse problem than the
    * processor's file having them, so it is not quietly absorbed.
    */
  def apply(ledger: Vector[Movement], settlement: Vector[Movement]): Result =
    val ours = ledger.groupBy(_.matchKey)
    val ourDuplicates = ours.filter(_._2.size > 1).keys.toVector
    require(
      ourDuplicates.isEmpty,
      s"the ledger has duplicate movements: ${ourDuplicates.take(5).mkString(", ")}",
    )
    val byKey = ours.view.mapValues(_.head).toMap

    val grouped = settlement.groupBy(_.matchKey)

    // Pass 0: the same line twice. Every line after the first is a duplicate,
    // and the first one still goes through normal matching.
    val firsts = grouped.view.mapValues(_.sortBy(_.lineId)).toMap
    val duplicates = firsts.values.flatMap(_.drop(1)).toVector

    val decided = firsts.toVector.map { case (key, lines) =>
      val theirs = lines.head
      byKey.get(key) match
        case None => Left(theirs)
        case Some(mine) =>
          Right(
            if mine.amount == theirs.amount then
              Match(mine, theirs, Pass.Exact, "same payment, kind and amount")
            else if theirs.currency != "USD" then
              // Matched, and the difference is explained by the line having been
              // converted. Still the same movement; the difference is classified
              // separately rather than tolerated.
              Match(mine, theirs, Pass.Converted,
                s"settled in ${theirs.currency}: ${if theirs.note.isEmpty then "no rate given" else theirs.note}",
                Money(theirs.amount.toLong - mine.amount.toLong))
            else
              Match(mine, theirs, Pass.AmountDiffers, "same payment and kind, different amount",
                Money(theirs.amount.toLong - mine.amount.toLong))
          )
    }

    val matches = decided.collect { case Right(m) => m }
    val matchedKeys = matches.map(_.ledger.matchKey).toSet

    Result(
      matches = matches,
      unmatchedLedger = ledger.filterNot(m => matchedKeys.contains(m.matchKey)),
      unmatchedSettlement = decided.collect { case Left(m) => m },
      duplicates = duplicates,
    )

  /** Turn the result into the closed set of disagreements.
    *
    * `settlementWindowDays` is three: the processor documents T+2 and a day of
    * slack costs nothing. A break raised too early is investigated by a person
    * and found to be nothing, which is more expensive than finding it a day
    * later. It is a parameter rather than a literal because it is a policy
    * somebody may reasonably want to change.
    */
  def classify(
      result: Result,
      asOf: LocalDate,
      settlementWindowDays: Int = 3,
  ): Vector[Break] =
    val cutoff = asOf.minusDays(settlementWindowDays)

    val fromMatches = result.matches.flatMap { m =>
      m.pass match
        case Pass.Exact => None
        case Pass.Converted =>
          Some(Break.CurrencyRounding(m.settlement.key, m.settlement.kind, m.difference,
            m.settlement.currency))
        case Pass.AmountDiffers =>
          Some(Break.AmountMismatch(m.settlement.key, m.settlement.kind, m.difference,
            s"ledger ${m.ledger.amount.show}, settled ${m.settlement.amount.show}"))
    }

    val fromDuplicates = result.duplicates.map { d =>
      Break.DuplicateSettlement(d.key, d.kind, d.amount, d.lineId)
    }

    val fromTheirSide = result.unmatchedSettlement.map { s =>
      Break.MissingInLedger(s.key, s.kind, s.amount, s.when)
    }

    val fromOurSide = result.unmatchedLedger.map { m =>
      if m.when.isAfter(cutoff) then Break.PendingSettlement(m.key, m.kind, m.amount, m.when)
      else Break.UnsettledCapture(m.key, m.kind, m.amount, m.when)
    }

    fromMatches ++ fromDuplicates ++ fromTheirSide ++ fromOurSide

  /** The report, as counts and totals per kind of disagreement.
    *
    * The total is of absolute values, and that is not a detail. One line
    * settled $5.09 over and another $9.10 under nets to $4.01 of apparent
    * disagreement, which understates the work and, worse, lets two errors that
    * happen to cancel look like one small one. What a finance team is asking
    * is how much is in dispute, not what the net is.
    */
  def summary(breaks: Vector[Break]): Map[String, (Int, Cents)] =
    breaks.groupBy(Break.label).view.mapValues { bs =>
      (bs.size, Money.total(bs.map(b => Break.value(b).abs)))
    }.toMap
