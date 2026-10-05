# frozen_string_literal: true

module Refunds
  # Money, as whole minor units, the same rule as every other level.
  #
  # Ruby differs from the other two languages in the course in one way worth
  # knowing: Integer here is arbitrary precision. There is no 2^53 ceiling as
  # there is in JavaScript and no 64 bit wrap as there is in Java, so the only
  # limit is memory. You still store cents rather than a Float, because Float
  # is the same IEEE 754 as everywhere else and 0.1 + 0.2 is still not 0.3.
  class Money
    include Comparable

    attr_reader :cents, :currency

    def self.parse(text, currency = "USD")
      raise ArgumentError, "not an amount: #{text.inspect}" unless text.to_s.match?(/\A-?\d+(\.\d+)?\z/)

      whole, fraction = text.to_s.split(".")
      places = decimals(currency)
      fraction = (fraction || "").ljust(places, "0")
      raise ArgumentError, "#{currency} has #{places} decimal places, got #{text}" if fraction.length > places

      sign = whole.start_with?("-") ? -1 : 1
      new(sign * (whole.delete("-").to_i * 10**places + fraction.to_i), currency)
    end

    def self.zero(currency = "USD") = new(0, currency)

    def self.decimals(currency)
      case currency
      when "JPY", "KRW" then 0
      when "BHD", "KWD", "TND" then 3
      else 2
      end
    end

    def initialize(cents, currency = "USD")
      raise ArgumentError, "money must be whole minor units, got #{cents}" unless cents.is_a?(Integer)

      @cents = cents
      @currency = currency
      freeze
    end

    def +(other)
      same_currency!(other)
      Money.new(cents + other.cents, currency)
    end

    def -(other)
      same_currency!(other)
      Money.new(cents - other.cents, currency)
    end

    def <=>(other)
      same_currency!(other)
      cents <=> other.cents
    end

    def positive? = cents.positive?
    def zero? = cents.zero?

    def to_s
      places = Money.decimals(currency)
      sign = cents.negative? ? "-" : ""
      units, minor = cents.abs.divmod(10**places)
      body = places.zero? ? units.to_s : format("%d.%0*d", units, places, minor)
      "#{sign}#{symbol}#{body}"
    end

    alias inspect to_s

    def ==(other) = other.is_a?(Money) && cents == other.cents && currency == other.currency
    alias eql? ==
    def hash = [cents, currency].hash

    private

    def symbol
      { "USD" => "$", "GBP" => "£", "EUR" => "€", "JPY" => "¥" }.fetch(currency, "#{currency} ")
    end

    def same_currency!(other)
      raise ArgumentError, "cannot mix #{currency} and #{other.currency}" unless currency == other.currency
    end
  end
end
