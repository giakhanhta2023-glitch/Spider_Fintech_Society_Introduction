package recon

import java.nio.file.{Files, Path}
import java.time.LocalDate
import scala.jdk.CollectionConverters.*
import recon.Money.Cents

/** Reading the two files.
  *
  * A bad row is an `Either` rather than an exception, because a batch job over
  * sixteen thousand lines wants every complaint at once, not the first one. The
  * same argument as level 4's replay and level 20.1's findings, with the type
  * system doing the carrying instead of a convention.
  */
object Load:

  final case class BadRow(file: String, line: Int, why: String)

  /** A tiny CSV reader. The files here have no quoted commas, which is checked
    * rather than assumed: a field count that changes is a hard failure, because
    * silently reading the wrong column is worse than stopping.
    */
  private def rows(path: Path): (Vector[String], Vector[(Int, Vector[String])]) =
    val lines = Files.readAllLines(path).asScala.toVector.filter(_.nonEmpty)
    val header = lines.head.split(",", -1).toVector
    val body = lines.tail.zipWithIndex.map { case (line, i) =>
      (i + 2, line.split(",", -1).toVector)
    }
    (header, body)

  private def column(header: Vector[String], name: String): Int =
    val at = header.indexOf(name)
    require(at >= 0, s"column $name is missing, found ${header.mkString(",")}")
    at

  /** Our side: the card events from level 9, signed on the way in. */
  def ledger(path: Path): (Vector[Movement], Vector[BadRow]) =
    val (header, body) = rows(path)
    val (pid, at, event, amount, eid) =
      (column(header, "payment_id"), column(header, "at"), column(header, "event"),
       column(header, "amount_minor"), column(header, "event_id"))

    val parsed = body.map { case (lineNo, f) =>
      if f.length != header.length then
        Left(BadRow(path.getFileName.toString, lineNo, s"${f.length} fields, expected ${header.length}"))
      else
        Kind.parse(f(event)) match
          case None => Right(None) // authorisations and declines: not money moving
          case Some(k) =>
            Right(Some(Movement(
              key = f(pid),
              kind = k,
              amount = Money(Kind.sign(k) * f(amount).toLong),
              when = LocalDate.parse(f(at).take(10)),
              source = Source.Ledger,
              lineId = f(eid),
            )))
    }
    (parsed.collect { case Right(Some(m)) => m }, parsed.collect { case Left(b) => b })

  /** Their side. The file already carries the sign, so it is checked rather
    * than re-derived: if a refund ever arrives positive, this is where you find
    * out, instead of every comparison below being quietly wrong.
    */
  def settlement(path: Path): (Vector[Movement], Vector[BadRow]) =
    val (header, body) = rows(path)
    val (sid, settledAt, pid, kindCol, gross, fee, ccy, note) =
      (column(header, "settlement_id"), column(header, "settled_at"), column(header, "payment_id"),
       column(header, "type"), column(header, "gross_minor"), column(header, "fee_minor"),
       column(header, "currency"), column(header, "note"))

    val parsed = body.map { case (lineNo, f) =>
      val bad = (why: String) => Left(BadRow(path.getFileName.toString, lineNo, why))
      if f.length != header.length then bad(s"${f.length} fields, expected ${header.length}")
      else
        Kind.parse(f(kindCol)) match
          case None => bad(s"unknown settlement type ${f(kindCol)}")
          case Some(k) =>
            val amount = f(gross).toLong
            if Kind.sign(k) * amount < 0 then
              bad(s"a ${f(kindCol)} of $amount: the sign convention has changed")
            else
              Right(Movement(
                key = f(pid),
                kind = k,
                amount = Money(amount),
                when = LocalDate.parse(f(settledAt)),
                source = Source.Settlement,
                currency = f(ccy),
                fee = Money.parse(f(fee)),
                lineId = f(sid),
                note = f(note),
              ))
    }
    (parsed.collect { case Right(m) => m }, parsed.collect { case Left(b) => b })
