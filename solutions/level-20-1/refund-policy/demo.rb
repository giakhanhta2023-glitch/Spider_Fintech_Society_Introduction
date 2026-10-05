# frozen_string_literal: true

# A day of refund requests through the policy.
#
#     ruby -Ilib demo.rb
#
# The point of the run is the last section: every refusal and every review
# printed with the sentence that explains it. A policy whose decisions cannot be
# read out loud to the customer they are about is not finished.

require "date"
require_relative "lib/refunds/rules"

module Refunds
  TODAY = Date.new(2026, 6, 1)

  # `refunded` defaults to nil rather than "0.00", because "0.00" is not a legal
  # JPY amount: yen has no decimal places. Money.zero knows that; a string does
  # not, which is the sort of thing a default argument hides until the day a
  # second currency arrives.
  def self.payment(id, captured:, refunded: nil, state: :captured, days_ago: 10,
                   currency: "USD", disputed: false)
    Payment.new(
      id: id, state: state,
      captured: Money.parse(captured, currency),
      refunded: refunded ? Money.parse(refunded, currency) : Money.zero(currency),
      currency: currency, captured_at: TODAY - days_ago,
      disputed: disputed, card_country: "US",
    )
  end

  def self.request(id, amount, currency: "USD", reason: "customer changed their mind")
    Request.new(payment_id: id, amount: Money.parse(amount, currency), currency: currency,
                reason: reason, requested_by: "support")
  end

  # Fifteen requests, chosen so every rule in the policy fires at least once.
  CASES = [
    [payment("pay_01", captured: "49.99"), request("pay_01", "49.99")],
    [payment("pay_02", captured: "200.00"), request("pay_02", "50.00")],
    [payment("pay_03", captured: "100.00", refunded: "80.00"), request("pay_03", "20.00")],
    [payment("pay_04", captured: "100.00", refunded: "80.00"), request("pay_04", "30.00")],
    [payment("pay_05", captured: "80.00", state: :authorised), request("pay_05", "80.00")],
    [payment("pay_06", captured: "250.00", disputed: true), request("pay_06", "250.00")],
    [payment("pay_07", captured: "75.00"), request("pay_07", "75.00", currency: "EUR")],
    [payment("pay_08", captured: "40.00"), request("pay_08", "0.00")],
    [payment("pay_09", captured: "60.00", days_ago: 121), request("pay_09", "60.00")],
    [payment("pay_10", captured: "60.00", days_ago: 120), request("pay_10", "60.00")],
    [payment("pay_11", captured: "900.00"), request("pay_11", "600.00")],
    [payment("pay_12", captured: "300.00", days_ago: 100), request("pay_12", "25.00")],
    [payment("pay_13", captured: "1200.00"), request("pay_13", "1200.00")],
    [payment("pay_14", captured: "5000.00", days_ago: 200, state: :authorised, disputed: true),
     request("pay_14", "5000.00")],
    [payment("pay_15", captured: "1299", currency: "JPY"), request("pay_15", "1299", currency: "JPY")],
  ].freeze

  decisions = CASES.map { |p, r| [p, r, POLICY.decide(payment: p, request: r, today: TODAY)] }

  counts = Hash.new(0)
  decisions.each { |_, _, d| counts[d.outcome] += 1 }

  puts "#{POLICY.rules.length} rules, #{CASES.length} requests\n\n"
  puts "   allowed  #{counts[:allow].to_s.rjust(3)}"
  puts "   review   #{counts[:review].to_s.rjust(3)}"
  puts "   refused  #{counts[:refuse].to_s.rjust(3)}"

  fired = Hash.new(0)
  decisions.each { |_, _, d| d.findings.each { |f| fired[f.name] += 1 } }
  puts "\n   rules that fired"
  POLICY.rules.each { |r| puts "      #{r.name.to_s.ljust(32)}#{fired[r.name]}" }

  unused = POLICY.rules.map(&:name) - fired.keys
  puts "\n   rules never exercised: #{unused.empty? ? 'none' : unused.join(', ')}"

  puts "\n   what support would say"
  decisions.reject { |_, _, d| d.allowed? }.each do |p, r, d|
    puts "      #{p.id}  #{r.amount.to_s.rjust(10)}  #{d.outcome}"
    d.findings.each { |f| puts "            #{f.because}" }
  end

  total = decisions.select { |_, _, d| d.allowed? }
                   .group_by { |_, r, _| r.currency }
                   .transform_values { |rows| rows.map { |_, r, _| r.amount }.reduce(:+) }
  puts "\n   approved, by currency"
  total.each { |currency, amount| puts "      #{currency}  #{amount}" }
end
