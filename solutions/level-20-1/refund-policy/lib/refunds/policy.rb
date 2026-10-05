# frozen_string_literal: true

require_relative "money"

module Refunds
  # A captured card payment, as much of it as a refund decision needs.
  Payment = Struct.new(
    :id, :state, :captured, :refunded, :currency, :captured_at, :disputed, :card_country,
    keyword_init: true,
  ) do
    def refundable_left = captured - refunded
    def days_since_capture(today) = (today - captured_at).to_i
  end

  Request = Struct.new(:payment_id, :amount, :currency, :reason, :requested_by, keyword_init: true)

  # What the engine decided, and which rule decided it. The reason is not a nice
  # extra: "why was my refund refused" is a question somebody in support has to
  # answer out loud, and a decision that cannot explain itself makes that their
  # problem rather than the policy's.
  Decision = Struct.new(:outcome, :findings, keyword_init: true) do
    def allowed? = outcome == :allow
    def refused? = outcome == :refuse
    def review?  = outcome == :review

    def reasons = findings.map(&:because)

    def to_s
      return "allowed" if allowed?

      "#{outcome}: " + findings.map { |f| "#{f.name} (#{f.because})" }.join("; ")
    end
  end

  Finding = Struct.new(:name, :outcome, :because, keyword_init: true)

  # The context a rule body runs against. Rules are written as blocks, and those
  # blocks are evaluated here, which is why a rule can say `payment` and
  # `amount` with nothing passed in and nothing imported.
  class Context
    attr_reader :payment, :request, :today

    def initialize(payment:, request:, today:, thresholds: {})
      @payment = payment
      @request = request
      @today = today
      @thresholds = thresholds
    end

    def amount = request.amount
    def already_refunded = payment.refunded
    def refundable_left = payment.refundable_left
    def days_since_capture = payment.days_since_capture(today)
    def money(text) = Money.parse(text, payment.currency)

    # Any rule that compares the requested amount against the payment has to ask
    # this first. Comparing 50 EUR with 200 USD is not false, it is meaningless,
    # and Money says so by raising rather than guessing an answer.
    def same_currency? = request.currency == payment.currency

    # A threshold is per currency, because 500 of one currency is not 500 of
    # another. An unknown currency raises rather than guessing, and the engine
    # turns that into a held refund rather than an approved one.
    def threshold(name)
      table = @thresholds.fetch(payment.currency) do
        raise KeyError, "no thresholds configured for #{payment.currency}"
      end
      Money.parse(table.fetch(name), payment.currency)
    end
  end

  # The rule builder. Each rule names itself, says why in a sentence a customer
  # could be shown, and gives one condition.
  class Rule
    attr_reader :name, :because, :outcome, :condition

    def initialize(name)
      @name = name
      @because = nil
      @outcome = nil
      @condition = nil
    end

    def because(text = nil)
      return @because if text.nil?

      @because = text
    end

    def refuse_when(&block)
      @outcome = :refuse
      @condition = block
    end

    def review_when(&block)
      @outcome = :review
      @condition = block
    end

    # A rule that raises has not said no, but it has certainly not said yes.
    # Letting the exception through takes the whole decision down; swallowing it
    # quietly lets the money out. Neither is acceptable, so a broken rule
    # becomes a refusal that names itself, and the error travels with it.
    def fires?(context) = context.instance_exec(&condition)

    def evaluate(context)
      fires?(context) ? Finding.new(name: name, outcome: outcome, because: because) : nil
    rescue StandardError => e
      Finding.new(name: name, outcome: :refuse,
                  because: "this rule could not be applied to this payment (#{e.message}), "                            "so the refund is held rather than approved")
    end

    def valid!
      raise ArgumentError, "rule #{name} has no condition" if condition.nil?
      raise ArgumentError, "rule #{name} does not say why" if @because.nil?
    end
  end

  # The policy itself: an ordered list of rules and a way to run them all.
  class RefundPolicy
    attr_reader :rules

    # `define` is the whole DSL. The block is evaluated against a builder rather
    # than against wherever it was written, which is what lets the body say
    # `rule :outside_window do ... end` with no receiver.
    def self.define(&block)
      builder = new
      builder.instance_eval(&block)
      builder.freeze
    end

    def initialize
      @rules = []
      @thresholds = {}
    end

    # Numbers that differ by currency, kept out of the rule bodies so the rules
    # stay readable and the figures stay in one place somebody can audit.
    def thresholds(table = nil)
      return @thresholds if table.nil?

      @thresholds = table
    end

    def rule(name, &block)
      raise ArgumentError, "duplicate rule #{name}" if @rules.any? { |r| r.name == name }

      r = Rule.new(name)
      r.instance_eval(&block)
      r.valid!
      @rules << r
      r
    end

    # Every rule is evaluated, not just up to the first failure, because a
    # refund that breaks three rules should tell you all three. Support asking
    # the customer to fix one thing at a time, three times, is how a two minute
    # job becomes a week.
    def decide(payment:, request:, today:)
      context = Context.new(payment: payment, request: request, today: today,
                            thresholds: @thresholds)
      findings = rules.filter_map { |r| r.evaluate(context) }

      outcome = if findings.any? { |f| f.outcome == :refuse } then :refuse
                elsif findings.any? { |f| f.outcome == :review } then :review
                else :allow
                end

      Decision.new(outcome: outcome, findings: findings)
    end

    def freeze
      @rules.freeze
      @thresholds.freeze
      super
    end
  end
end
