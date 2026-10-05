# frozen_string_literal: true

require_relative "policy"

module Refunds
  # The policy, written in the language of the problem rather than the language
  # of the program. This file is the one a risk or support lead can read, argue
  # with, and ask you to change, which is the entire reason for the DSL.
  #
  # Every `because` is a sentence that could be shown to a customer. If you
  # cannot write one, the rule is not ready.
  POLICY = RefundPolicy.define do
    # Written here rather than inside the rules, because these are the figures
    # a risk lead changes, and because a threshold typed as "500.00" inside a
    # rule gets parsed in whatever currency the payment happens to be in. Yen
    # has no decimal places, so "500.00" is not a yen amount at all.
    thresholds(
      "USD" => { review_above: "500.00",  large_payment: "1000.00" },
      "EUR" => { review_above: "450.00",  large_payment: "900.00" },
      "GBP" => { review_above: "400.00",  large_payment: "800.00" },
      "JPY" => { review_above: "75000",   large_payment: "150000" },
    )

    rule :not_captured do
      because "a payment that was never captured is cancelled rather than refunded"
      refuse_when { payment.state != :captured }
    end

    rule :already_disputed do
      because "this payment is being disputed, and refunding it now would pay twice"
      refuse_when { payment.disputed }
    end

    rule :wrong_currency do
      because "a refund is made in the currency the payment was taken in"
      refuse_when { request.currency != payment.currency }
    end

    rule :not_positive do
      because "a refund has to be for more than nothing"
      refuse_when { !amount.positive? }
    end

    rule :more_than_remains do
      because "this would refund more than is left on the payment"
      refuse_when { same_currency? && amount > refundable_left }
    end

    rule :outside_window do
      because "the card networks stop accepting refunds 120 days after the payment"
      refuse_when { days_since_capture > 120 }
    end

    rule :large_refund do
      because "a refund this size is checked by a person first"
      review_when { same_currency? && amount > threshold(:review_above) }
    end

    rule :late_in_window do
      because "refunds after 90 days are checked, because the window closes at 120"
      review_when { days_since_capture > 90 }
    end

    rule :full_refund_of_a_large_payment do
      because "cancelling a large payment outright is worth a second pair of eyes"
      review_when { same_currency? && amount == payment.captured && payment.captured > threshold(:large_payment) }
    end
  end
end
