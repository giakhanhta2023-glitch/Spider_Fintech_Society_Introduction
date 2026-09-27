package finquest.money;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Level 5's money tests, ported. The two JVM specific traps are their own tests. */
class MoneyTest {

    @Test
    @DisplayName("allocating loses nothing and the remainder is distributed")
    void allocateLosesNothing() {
        Money total = Money.of(100, Currency.USD);
        List<Money> parts = total.allocate(1, 1, 1);

        assertAll(
                () -> assertEquals(List.of(34L, 33L, 33L),
                        parts.stream().map(Money::minor).toList()),
                () -> assertEquals(100L, parts.stream().mapToLong(Money::minor).sum()));
    }

    @ParameterizedTest
    @ValueSource(longs = {1, 2, 3, 7, 99, 100, 1999, 250_000, 999_999_999})
    @DisplayName("every allocation sums back to the original, at every size")
    void allocationIsExact(long minor) {
        Money money = Money.of(minor, Currency.USD);
        for (int parts = 1; parts <= 7; parts++) {
            int[] ratios = new int[parts];
            java.util.Arrays.fill(ratios, 1);
            long sum = money.allocate(ratios).stream().mapToLong(Money::minor).sum();
            assertEquals(minor, sum, "lost money splitting " + minor + " " + parts + " ways");
        }
    }

    @Test
    @DisplayName("uneven ratios split proportionally, remainder to the earliest parts")
    void unevenRatios() {
        List<Money> parts = Money.of(1000, Currency.USD).allocate(70, 20, 10);
        assertEquals(List.of(700L, 200L, 100L), parts.stream().map(Money::minor).toList());

        // 101 split three ways is 33 each with two minor units left over, and the
        // two go to the first two parts rather than both to the first. My first
        // version of this test expected [35, 33, 33], which is the same money
        // distributed less fairly: the code was right and the expectation was not.
        List<Money> awkward = Money.of(101, Currency.USD).allocate(1, 1, 1);
        assertEquals(List.of(34L, 34L, 33L), awkward.stream().map(Money::minor).toList());
        assertEquals(101L, awkward.stream().mapToLong(Money::minor).sum());
    }

    @Test
    @DisplayName("adding two currencies throws rather than guessing")
    void currenciesDoNotMix() {
        Money dollars = Money.of(100, Currency.USD);
        Money euros = Money.of(100, Currency.EUR);

        CurrencyMismatch thrown = assertThrows(CurrencyMismatch.class, () -> dollars.plus(euros));
        assertTrue(thrown.getMessage().contains("USD"));
        assertTrue(thrown.getMessage().contains("EUR"));
    }

    @Test
    @DisplayName("overflow throws rather than wrapping to a negative amount")
    void overflowThrows() {
        Money huge = Money.of(Long.MAX_VALUE, Currency.USD);
        assertThrows(ArithmeticException.class, () -> huge.plus(Money.of(1, Currency.USD)));
        assertThrows(ArithmeticException.class, () -> huge.times(2));
    }

    @Test
    @DisplayName("an int would have wrapped here, which is why every amount is a long")
    void intWouldHaveWrapped() {
        // 2,147,483,647 minor units is $21,474,836.47. A payments system that holds
        // a merchant's monthly volume in an int has a ceiling nobody documented.
        int wrapped = Integer.MAX_VALUE + 1;
        assertTrue(wrapped < 0, "int silently wraps to negative, with no error");

        Money beyondAnInt = Money.of((long) Integer.MAX_VALUE + 1, Currency.USD);
        assertEquals(2_147_483_648L, beyondAnInt.minor());
        assertEquals("$21474836.48", beyondAnInt.format());
    }

    @Test
    @DisplayName("a percentage is integer arithmetic, rounded half up")
    void percentageRoundsHalfUp() {
        // 1999 at 2.9% is 57.971, which rounds to 58 and truncates to 57. Level 17
        // shipped the truncating version and it cost a cent on every payment.
        assertEquals(58L, Money.of(1999, Currency.USD).percentage(290).minor());
        assertEquals(29L, Money.of(1000, Currency.USD).percentage(290).minor());
        assertEquals(50L, Money.of(1724, Currency.USD).percentage(290).minor());
    }

    @Test
    @DisplayName("currencies with other decimal places are not two by assumption")
    void notEveryCurrencyHasTwoDecimals() {
        assertEquals("\u00a51000", Money.of(1000, Currency.JPY).format());
        assertEquals("KD1.000", Money.of(1000, Currency.KWD).format());
        assertEquals(1000L, Money.parse("1000", Currency.JPY).minor());
        assertEquals(1000L, Money.parse("1.000", Currency.KWD).minor());
    }

    // ---------------------------------------------------------- the two traps
    @Test
    @DisplayName("BigDecimal from a double is not BigDecimal from the same literal")
    void bigDecimalFromDoubleIsNotTheNumberYouWrote() {
        BigDecimal fromDouble = new BigDecimal(0.1);
        BigDecimal fromString = new BigDecimal("0.1");

        assertNotEquals(fromString, fromDouble);
        assertTrue(fromDouble.toPlainString()
                .startsWith("0.1000000000000000055511151231257827"),
                "the double never held 0.1: " + fromDouble);
        assertEquals("0.1", fromString.toPlainString());

        // BigDecimal.valueOf(double) goes through Double.toString and gives 0.1,
        // which is why it is the safe one of the two and still not the habit to
        // form: parse from a string and the question never comes up.
        assertEquals(fromString, BigDecimal.valueOf(0.1));
    }

    @Test
    @DisplayName("equals and compareTo disagree about 1.0 and 1.00")
    void equalsDisagreesWithCompareTo() {
        BigDecimal one = new BigDecimal("1.0");
        BigDecimal alsoOne = new BigDecimal("1.00");

        assertNotEquals(one, alsoOne, "equals compares scale as well as value");
        assertEquals(0, one.compareTo(alsoOne), "compareTo compares value");

        // The consequence, and the reason this is a money bug rather than trivia: a
        // HashSet or a map key built on BigDecimal treats the same amount as two.
        java.util.Set<BigDecimal> amounts = new java.util.HashSet<>();
        amounts.add(one);
        amounts.add(alsoOne);
        assertEquals(2, amounts.size(), "one amount, two entries, because of scale");

        // Money has none of this problem: it is a long, so equal amounts are equal
        // and hash the same. (`Set.of` refuses duplicates outright, which is how
        // this assertion first failed: the set constructor threw before it could
        // deduplicate. `HashSet` is the one that answers the question.)
        assertEquals(Money.of(100, Currency.USD), Money.of(100, Currency.USD));
        java.util.Set<Money> oneAmount = new java.util.HashSet<>(
                java.util.List.of(Money.of(100, Currency.USD), Money.of(100, Currency.USD)));
        assertEquals(1, oneAmount.size());
    }
}
