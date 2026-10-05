package recon

/** Money as whole minor units, with no wrapper object at run time.
  *
  * `opaque type` is the Scala 3 answer to the problem level 10.1 solved in
  * TypeScript with a brand. Inside this file `Cents` and `Long` are the same
  * type; outside it they are not, so a bare `Long` cannot be passed where an
  * amount is expected. The difference from the TypeScript version is that this
  * one is checked by a compiler that also erases it: a `Cents` is a `Long` in
  * the bytecode, with no allocation and no boxing, which matters when you are
  * holding sixteen thousand of them.
  *
  * A `Long` holds about 92 million billion cents. That is not arbitrary
  * precision as in Ruby, but a settlement file will not reach it.
  */
object Money:
  opaque type Cents = Long

  def apply(n: Long): Cents = n

  def parse(text: String): Cents =
    text.trim match
      case ""    => 0L
      case other => other.toLong

  extension (c: Cents)
    def toLong: Long = c
    def +(other: Cents): Cents = c + other
    def -(other: Cents): Cents = c - other
    def abs: Cents = math.abs(c)
    def isZero: Boolean = c == 0L
    def signum: Int = java.lang.Long.signum(c)

    /** Dollars and cents, with a sign in front rather than brackets. */
    def show: String =
      val sign = if c < 0 then "-" else ""
      val units = math.abs(c) / 100
      val minor = math.abs(c) % 100
      f"$sign$$$units%,d.$minor%02d"

  given Ordering[Cents] = Ordering.Long

  /** Summing an empty list of amounts is zero, not an error. */
  def total(xs: Iterable[Cents]): Cents = xs.foldLeft(0L)(_ + _)
