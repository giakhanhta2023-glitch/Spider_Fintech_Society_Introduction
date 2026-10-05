package recon

import java.time.LocalDate
import recon.Money.Cents

/** One thing that happened, from one side, in a shape both sides share.
  *
  * A `case class` gives you the constructor, the accessors, equality by value,
  * a readable `toString`, `copy`, and pattern matching, from one line. It is
  * the Scala equivalent of level 5's frozen dataclass and level 18's record,
  * and like both of them it is immutable: `copy` returns a new one.
  */
final case class Movement(
    key: String, // payment id: what the two sides agree to call it
    kind: Kind,
    amount: Cents, // signed
    when: LocalDate,
    source: Source,
    currency: String = "USD",
    fee: Cents = Money(0),
    lineId: String = "",
    note: String = "",
):
  def matchKey: (String, Kind) = (key, kind)

/** The three events that move money. An authorisation is a hold and settles
  * nothing; including it is the mistake that makes a reconciliation report
  * thousands of missing settlements that were never coming.
  *
  * `enum` in Scala 3 is a sealed set of values, so a `match` over it can be
  * checked for exhaustiveness at compile time. That is the same guarantee as
  * the TypeScript union in level 10.1 and the Java sealed interface in level
  * 18, which is three languages reaching for one idea.
  */
enum Kind:
  case Capture, Refund, Chargeback

object Kind:
  def parse(s: String): Option[Kind] = s match
    case "capture"    => Some(Capture)
    case "refund"     => Some(Refund)
    case "chargeback" => Some(Chargeback)
    case _            => None

  /** Which direction this kind moves money. Used to sign the ledger side and
    * to check the settlement side has not changed its convention underneath us.
    */
  def sign(k: Kind): Int = k match
    case Capture               => 1
    case Refund | Chargeback   => -1

enum Source:
  case Ledger, Settlement

/** Why a pair matched, kept because a reconciliation has to answer "why is this
  * line matched to that one" two months later, in front of an auditor.
  */
enum Pass:
  case Exact, Converted, AmountDiffers

final case class Match(
    ledger: Movement,
    settlement: Movement,
    pass: Pass,
    reason: String,
    difference: Cents = Money(0),
)

/** Every way a reconciliation can disagree, as a closed set.
  *
  * This is the type the whole level turns on. Adding a case here makes every
  * `match` over `Break` that does not handle it fail to compile, so a new kind
  * of disagreement cannot be silently dropped out of the report.
  */
enum Break:
  case AmountMismatch(key: String, kind: Kind, difference: Cents, detail: String)
  case CurrencyRounding(key: String, kind: Kind, difference: Cents, currency: String)
  case DuplicateSettlement(key: String, kind: Kind, amount: Cents, lineId: String)
  case MissingInLedger(key: String, kind: Kind, amount: Cents, when: LocalDate)
  case UnsettledCapture(key: String, kind: Kind, amount: Cents, when: LocalDate)
  case PendingSettlement(key: String, kind: Kind, amount: Cents, when: LocalDate)

object Break:
  /** A pending settlement is not a break. It is a capture that has not settled
    * yet, and reporting it as a problem is how a reconciliation report trains
    * people to ignore it.
    */
  def isBreak(b: Break): Boolean = b match
    case _: PendingSettlement => false
    case _                    => true

  def owner(b: Break): String = b match
    case _: AmountMismatch       => "payments engineering"
    case _: CurrencyRounding     => "payments engineering"
    case _: DuplicateSettlement  => "processor operations"
    case _: MissingInLedger      => "payments engineering"
    case _: UnsettledCapture     => "processor operations"
    case _: PendingSettlement    => "nobody: this is not a break"

  def value(b: Break): Cents = b match
    case AmountMismatch(_, _, d, _)      => d
    case CurrencyRounding(_, _, d, _)    => d
    case DuplicateSettlement(_, _, a, _) => a
    case MissingInLedger(_, _, a, _)     => a
    case UnsettledCapture(_, _, a, _)    => a
    case PendingSettlement(_, _, a, _)   => a

  def label(b: Break): String = b match
    case _: AmountMismatch      => "amount_mismatch"
    case _: CurrencyRounding    => "currency_rounding"
    case _: DuplicateSettlement => "duplicate_settlement"
    case _: MissingInLedger     => "missing_in_ledger"
    case _: UnsettledCapture    => "unsettled_capture"
    case _: PendingSettlement   => "pending_settlement"
