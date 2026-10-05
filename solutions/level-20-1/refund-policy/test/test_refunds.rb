# frozen_string_literal: true

# Each test is a refund that should or should not happen.
#
#     ruby -Ilib -Itest test/test_refunds.rb
#
# The one worth reading is `test_a_refund_that_breaks_three_rules_reports_all_three`.
# An engine that stops at the first problem makes support ask the customer to
# fix one thing, three times, which is how a two minute job becomes a week.

require "minitest/autorun"
require "date"

require "refunds/rules"

module Refunds
  class TestMoney < Minitest::Test
    def test_parses_and_prints
      assert_equal 129_900, Money.parse("1299.00").cents
      assert_equal "$1299.00", Money.parse("1299.00").to_s
      assert_equal "-$12.99", Money.parse("-12.99").to_s
    end

    def test_currencies_have_different_decimal_places
      assert_equal 1299, Money.parse("1299", "JPY").cents
      assert_equal 0, Money.decimals("JPY")
      assert_equal 3, Money.decimals("KWD")
      assert_equal 1_299_000, Money.parse("1299.000", "KWD").cents
    end

    def test_rejects_too_many_decimal_places
      assert_raises(ArgumentError) { Money.parse("12.999") }
      assert_raises(ArgumentError) { Money.parse("12.1", "JPY") }
    end

    def test_refuses_to_mix_currencies
      assert_raises(ArgumentError) { Money.parse("1.00", "USD") + Money.parse("1.00", "EUR") }
    end

    def test_integers_do_not_run_out
      # Ruby Integer is arbitrary precision: no 2^53 ceiling as in JavaScript,
      # no 64 bit wrap as in Java. This is the GDP of the planet, in cents.
      huge = Money.new(10**20, "USD")
      assert_equal 10**20 + 1, (huge + Money.new(1, "USD")).cents
    end

    def test_frozen
      assert Money.parse("1.00").frozen?
    end
  end

  class TestPolicy < Minitest::Test
    TODAY = Date.new(2026, 6, 1)

    def payment(**over)
      Payment.new(**{
        id: "pay_1", state: :captured,
        captured: Money.parse("200.00"), refunded: Money.zero,
        currency: "USD", captured_at: TODAY - 10, disputed: false, card_country: "US",
      }.merge(over))
    end

    def request(amount: "50.00", currency: "USD", **over)
      Request.new(**{
        payment_id: "pay_1", amount: Money.parse(amount, currency), currency: currency,
        reason: "customer changed their mind", requested_by: "support",
      }.merge(over))
    end

    def decide(p = payment, r = request) = POLICY.decide(payment: p, request: r, today: TODAY)

    # ------------------------------------------------------------- the happy path
    def test_an_ordinary_partial_refund_is_allowed
      d = decide
      assert d.allowed?, d.to_s
      assert_empty d.findings
    end

    # ---------------------------------------------------------------- refusals
    def test_an_uncaptured_payment_is_cancelled_not_refunded
      d = decide(payment(state: :authorised))
      assert d.refused?
      assert_includes d.findings.map(&:name), :not_captured
    end

    def test_a_disputed_payment_is_not_refunded
      assert decide(payment(disputed: true)).refused?
    end

    def test_a_refund_larger_than_what_is_left_is_refused
      p = payment(captured: Money.parse("100.00"), refunded: Money.parse("80.00"))
      d = decide(p, request(amount: "30.00"))
      assert d.refused?
      assert_includes d.findings.map(&:name), :more_than_remains
    end

    def test_refunding_exactly_what_is_left_is_fine
      p = payment(captured: Money.parse("100.00"), refunded: Money.parse("80.00"))
      assert decide(p, request(amount: "20.00")).allowed?
    end

    def test_a_different_currency_is_refused
      assert decide(payment, request(amount: "50.00", currency: "EUR")).refused?
    end

    def test_zero_is_refused
      assert decide(payment, request(amount: "0.00")).refused?
    end

    def test_past_the_network_window
      d = decide(payment(captured_at: TODAY - 121))
      assert d.refused?
      assert_includes d.findings.map(&:name), :outside_window
    end

    def test_the_window_boundary_is_inclusive
      # 120 days is still inside. Off by one here is a refused refund that
      # should have gone through, and a customer who is right to complain.
      d = decide(payment(captured_at: TODAY - 120))
      refute d.refused?, d.to_s
    end

    # ------------------------------------------------------------------ review
    def test_a_large_refund_goes_to_a_person
      p = payment(captured: Money.parse("900.00"))
      d = decide(p, request(amount: "600.00"))
      assert d.review?
      assert_includes d.findings.map(&:name), :large_refund
    end

    def test_a_late_refund_goes_to_a_person
      assert decide(payment(captured_at: TODAY - 100)).review?
    end

    def test_cancelling_a_large_payment_outright_goes_to_a_person
      p = payment(captured: Money.parse("1200.00"))
      d = decide(p, request(amount: "1200.00"))
      assert d.review?
      assert_includes d.findings.map(&:name), :full_refund_of_a_large_payment
    end

    # ------------------------------------------------- thresholds per currency
    # These two exist because the first version of this policy wrote its
    # thresholds as "500.00" inside the rule bodies, which parses in whatever
    # currency the payment is in. Yen has no decimal places, so an ordinary yen
    # refund was held by a rule that could not run.
    def test_a_yen_refund_is_decided_rather_than_held
      p = Payment.new(
        id: "pay_jp", state: :captured, captured: Money.parse("1299", "JPY"),
        refunded: Money.zero("JPY"), currency: "JPY", captured_at: TODAY - 10,
        disputed: false, card_country: "JP",
      )
      r = Request.new(payment_id: "pay_jp", amount: Money.parse("1299", "JPY"),
                      currency: "JPY", reason: "returned", requested_by: "support")

      d = POLICY.decide(payment: p, request: r, today: TODAY)
      assert d.allowed?, d.to_s
      refute(d.reasons.any? { |x| x.include?("could not be applied") })
    end

    def test_the_yen_threshold_is_in_yen
      p = Payment.new(
        id: "pay_jp2", state: :captured, captured: Money.parse("200000", "JPY"),
        refunded: Money.zero("JPY"), currency: "JPY", captured_at: TODAY - 10,
        disputed: false, card_country: "JP",
      )
      r = Request.new(payment_id: "pay_jp2", amount: Money.parse("80000", "JPY"),
                      currency: "JPY", reason: "returned", requested_by: "support")

      # 80,000 yen is over the 75,000 review threshold, and nowhere near 500 of
      # anything, which is the whole point.
      assert POLICY.decide(payment: p, request: r, today: TODAY).review?
    end

    def test_an_unconfigured_currency_holds_rather_than_approves
      p = Payment.new(
        id: "pay_x", state: :captured, captured: Money.parse("100.00", "CHF"),
        refunded: Money.zero("CHF"), currency: "CHF", captured_at: TODAY - 10,
        disputed: false, card_country: "CH",
      )
      r = Request.new(payment_id: "pay_x", amount: Money.parse("10.00", "CHF"),
                      currency: "CHF", reason: "returned", requested_by: "support")

      d = POLICY.decide(payment: p, request: r, today: TODAY)
      assert d.refused?, "a currency with no thresholds must not be approved by default"
      assert_match(/no thresholds configured for CHF/, d.reasons.join(" "))
    end

    # ----------------------------------------------------------- the real one
    def test_a_refund_that_breaks_three_rules_reports_all_three
      p = payment(state: :authorised, disputed: true, captured_at: TODAY - 200)
      d = decide(p, request(amount: "500.00"))

      names = d.findings.map(&:name)
      assert_includes names, :not_captured
      assert_includes names, :already_disputed
      assert_includes names, :outside_window
      assert d.refused?
    end

    def test_refuse_beats_review
      p = payment(captured: Money.parse("2000.00"), disputed: true)
      d = decide(p, request(amount: "2000.00"))
      assert d.refused?, "a refusal and a review together is a refusal"
      assert_includes d.findings.map(&:outcome), :review
    end

    def test_every_refusal_can_explain_itself_in_a_sentence
      d = decide(payment(state: :authorised))
      assert d.reasons.all? { |r| r.is_a?(String) && r.length > 20 }
      refute_includes d.to_s, "nil"
    end
  end

  class TestTheDSL < Minitest::Test
    def test_a_rule_without_a_reason_is_rejected
      err = assert_raises(ArgumentError) do
        RefundPolicy.define { rule(:nameless) { refuse_when { true } } }
      end
      assert_match(/does not say why/, err.message)
    end

    def test_a_rule_without_a_condition_is_rejected
      err = assert_raises(ArgumentError) do
        RefundPolicy.define { rule(:empty) { because "nothing" } }
      end
      assert_match(/no condition/, err.message)
    end

    def test_a_duplicate_rule_name_is_rejected
      assert_raises(ArgumentError) do
        RefundPolicy.define do
          rule(:twice) { because "once"; refuse_when { true } }
          rule(:twice) { because "again"; refuse_when { true } }
        end
      end
    end

    # The one design decision in the engine worth arguing about, asserted.
    def test_a_rule_that_raises_becomes_a_refusal_rather_than_an_approval
      broken = RefundPolicy.define do
        rule(:explodes) do
          because "this rule is wrong and should not approve anything"
          refuse_when { raise "the risk service is down" }
        end
      end

      payment = Payment.new(
        id: "pay_1", state: :captured, captured: Money.parse("10.00"),
        refunded: Money.zero, currency: "USD", captured_at: Date.new(2026, 5, 1),
        disputed: false, card_country: "US",
      )
      request = Request.new(
        payment_id: "pay_1", amount: Money.parse("1.00"), currency: "USD",
        reason: "test", requested_by: "test",
      )

      d = broken.decide(payment: payment, request: request, today: Date.new(2026, 6, 1))

      assert d.refused?, "a policy engine that cannot answer must not approve"
      assert_match(/could not be applied/, d.reasons.first)
      assert_match(/risk service is down/, d.reasons.first)
    end

    def test_the_shipped_policy_is_frozen
      assert POLICY.frozen?
      assert POLICY.rules.frozen?
    end

    def test_every_shipped_rule_explains_itself
      POLICY.rules.each do |r|
        refute_nil r.because, "#{r.name} has no reason"
        assert r.because.length > 20, "#{r.name}: #{r.because.inspect} is too short to show anybody"
      end
    end
  end
end
