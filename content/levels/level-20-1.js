/* =========================================================================
   LEVEL 20.1: Ruby, and the rules that change every week.

   An aside rather than a rung. It hangs off the capstone because nothing in it
   is needed to finish the track, and it is numbered 20.1 so the ladder stays
   twenty rungs against twenty rank titles.
   ========================================================================= */
FQ.registerLevel({
  id: 20.1,
  position: '20.1',
  aside: true,
  codename: 'refund-policy',
  title: 'Ruby, and the rules that change every week',
  tagline: 'Stripe runs its API on a Ruby monolith, and most payments companies have one file somewhere that decides who gets their money back. This is that file, written the way Ruby is actually used: as a language for the problem rather than a language for the computer.',
  difficulty: 6,
  minutes: 300,
  tags: ['ruby', 'dsl', 'refunds', 'policy'],
  summary: 'Level 18 ported a service to Java to prove you could be interviewed in it. This does the opposite: it ' +
           'takes the one job Ruby is genuinely best at and does that. A refund policy is a pile of rules that ' +
           'change every week, has to explain every decision to a customer, and gets read by people who do not ' +
           'write code. You build it as a small language of its own, in about 150 lines, with 30 tests.',

  objectives: [
    'Say why a payments company would choose a slow language for its core, and be right',
    'Read and write Ruby blocks, which are the one idea the rest of the language is built on',
    'Build a DSL with `instance_eval`, and know exactly what it costs',
    'Hold money in Ruby, where Integer never runs out',
    'Write rules a risk lead can read, argue with, and change without you',
    'Make a policy engine fail closed, and say why that is not the same as failing safely'
  ],

  knowledge: [
    { h: 'Why a payments company writes Ruby' },
    { p: 'Stripe\'s API runs on a Ruby monolith. Their own job postings put it plainly: **"we work mostly in Java, ' +
         'Ruby, JavaScript, Scala, and Go"**. Shopify, GitHub and Zendesk are the same story. That surprises people ' +
         'who have been told Ruby is slow, and the surprise is the useful part.' },
    { p: 'Ruby is slow, in the sense a benchmark measures. It is also not where the time goes. A payments core is ' +
         'mostly waiting: on a database, on an issuer, on a network. The part that is actually yours is business ' +
         'rules, and business rules change weekly because the business changes weekly. What you want from a language ' +
         'there is not throughput; it is the speed at which a rule can be read, argued about, changed and shipped.' },
    { table: {
      head: ['What the code does', 'What matters most', 'Where that points'],
      rows: [
        ['Matching 16,000 settlement rows', 'Throughput and memory', 'Go, Java, Rust, or SQL doing it for you'],
        ['Deciding whether this refund is allowed', 'How fast a person can change it, and whether they can read it', 'Ruby, or a rules language'],
        ['Signing and sending a webhook, a thousand a second', 'Concurrency and tail latency', 'Go, which is why level 18 ends there'],
        ['A model that a finance team edits', 'Whether the author is in finance', 'A spreadsheet, honestly']
      ]
    }},
    { p: 'The honest version of the trade is what happened next at Stripe. The monolith got big, dynamic typing ' +
         'started costing more than it saved, and rather than rewrite it they wrote **Sorbet**, a gradual type ' +
         'checker for Ruby, and open sourced it. That is the whole argument in one story: Ruby was the right choice ' +
         'for a decade, the costs showed up at scale, and the answer was to add types rather than to start again.' },
    { check: {
      q: 'Your team is deciding between Ruby and Go for a new service that reconciles settlement files overnight, ' +
         'about 20 million rows a night. Which, and why?',
      a: 'Go, or more likely SQL running inside the database that already holds the rows. This is the top line of ' +
         'the table: a job whose cost is dominated by moving and comparing a lot of data is exactly where language ' +
         'speed stops being irrelevant. The reason Ruby suits a refund policy is that a refund policy is a hundred ' +
         'decisions a minute about one payment at a time, where the expensive resource is the engineer changing it ' +
         'on a Tuesday. Pick per workload. "We are a Ruby shop" is not an engineering answer.'
    }},

    { h: 'Ruby, for somebody who already writes Python' },
    { p: 'Five differences carry most of the distance. The rest you can read past.' },
    { table: {
      head: ['Python', 'Ruby', 'Why it shows up in this level'],
      rows: [
        ['Indentation ends a block', '`do ... end` or `{ ... }`, closed by `end`', 'A rule is written as a block, so this is the shape of every rule you write'],
        ['A function returns `None` unless told otherwise', 'Everything is an expression and the last one is the return value', '`def positive? = cents.positive?` is a whole method'],
        ['`"name"` strings as dictionary keys', '`:name` symbols: cheap, interned, compared by identity', 'Rules are named with symbols, so a typo is visible rather than a silent new key'],
        ['`0`, `""` and `[]` are falsey', '**Only `nil` and `false` are falsey.** `0` is true. `""` is true', 'The single most common bug when a Python programmer writes Ruby'],
        ['`int` grows without limit', 'The same: `Integer` is arbitrary precision', 'Money as whole cents has no ceiling here, unlike JavaScript and Java']
      ]
    }},
    { warn: 'Read the fourth row twice. `if balance` is true for a balance of zero, so a guard written the Python ' +
            'way lets a zero through. In money code that is the difference between refusing an empty refund and ' +
            'processing one.' },
    { p: 'Two spellings you will see immediately. A method ending in `?` returns true or false by convention, and ' +
         'one ending in `!` is the dangerous or mutating version of a safer one. Neither is enforced by the ' +
         'language; both are so consistently followed that breaking them reads as a mistake.' },

    { h: 'Blocks, which are the whole language' },
    { p: 'A **block** is a chunk of code passed to a method. Python has lambdas and they are limited to one ' +
         'expression; Ruby blocks are any length and are everywhere, which is why Ruby code looks the way it does.' },
    { code: '# A method that takes a block runs it with yield\ndef with_audit(action)\n  puts "starting #{action}"\n  result = yield                 # run the block\n  puts "finished #{action}"\n  result\nend\n\nwith_audit("refund") do\n  process_refund(payment)\nend', lang: 'ruby' },
    { p: 'That is the shape behind almost every Ruby API you will meet. `File.open(path) do |f| ... end` closes the ' +
         'file afterwards whether or not your block raised. `ActiveRecord::Base.transaction do ... end` commits at ' +
         'the end and rolls back if anything throws. The method owns the before and the after; your block is the ' +
         'middle.' },
    { p: 'Capture the block as a value with `&`, and it becomes an object you can keep and call later. That is the ' +
         'move this level is built on, because a rule is a condition you store now and run against a payment you ' +
         'have not seen yet.' },
    { code: 'def rule(name, &condition)\n  @rules << [name, condition]      # keep it for later\nend\n\nrule(:too_old) { days_since_capture > 120 }\n\n# much later, against a real payment\nname, condition = @rules.first\nfired = condition.call', lang: 'ruby' },

    { h: 'A DSL is blocks plus one more trick' },
    { p: 'A **domain specific language** sounds like a large undertaking and is usually about fifteen lines. The ' +
         'extra trick is `instance_eval`, which runs a block against a different object, so the block can call that ' +
         'object\'s methods with no receiver in front of them.' },
    { code: 'class Builder\n  def initialize = @rules = []\n  def rule(name, &c) = @rules << [name, c]\nend\n\n# Without instance_eval: the caller has to say b. in front of everything\nb = Builder.new\nb.rule(:too_old) { ... }\n\n# With it: the block runs as if it were inside the builder\ndef self.define(&block)\n  b = Builder.new\n  b.instance_eval(&block)\n  b\nend\n\nPOLICY = define do\n  rule(:too_old) { ... }      # no receiver. this is the whole effect\nend', lang: 'ruby' },
    { p: 'That is the entire mechanism. Every configuration block you have seen in Ruby, in Rails routes, in RSpec, ' +
         'in a Gemfile, is this and nothing more exotic.' },
    { warn: 'The cost is real and worth saying out loud. Inside an `instance_eval` block, `self` is not what the ' +
            'surrounding file says it is, so a method you expected from the enclosing class is suddenly missing and ' +
            'the error names a class you did not write. Editors cannot complete it, and a reader cannot tell where ' +
            '`rule` came from without finding the builder. **Use it where the readability is worth it**, which is a ' +
            'file of business rules read by people who do not write Ruby, and nowhere else.' },
    { check: {
      q: 'A colleague uses `method_missing` so the policy can say `refuse_if_disputed` and `refuse_if_expired` ' +
         'without either being defined anywhere. It works. What have they bought and what have they sold?',
      a: 'They bought nothing: the DSL already reads well with real methods. They sold the ability to find out what ' +
         'is legal. With `rule` defined as a method you can read the builder and see the whole vocabulary, an editor ' +
         'can complete it, and a typo is a NoMethodError at load. With `method_missing` every possible name is legal, ' +
         '`refuse_if_dispueted` is silently a new rule that never fires, and the only documentation is the regular ' +
         'expression inside `method_missing`. Metaprogramming that removes a declaration is usually removing the ' +
         'thing that was telling you the truth.'
    }},

    { h: 'Money in Ruby' },
    { p: 'Whole minor units, as everywhere else in the course. What is different is the ceiling, and Ruby does not ' +
         'have one:' },
    { table: {
      head: ['Language', 'Integer money is exact up to', 'What happens past it'],
      rows: [
        ['JavaScript, level 10.1', '2^53, about $90 trillion in cents', 'Silently wrong. `Number.isSafeInteger` is how you find out'],
        ['Java, level 18', '2^63 as a `long`', 'Wraps to negative. An overflow check is a requirement of that level'],
        ['**Ruby, here**', 'No limit. `Integer` grows into memory', 'Nothing. It gets slower, eventually']
      ]
    }},
    { p: 'This is a genuine advantage and a small trap. The advantage is that no amount you will ever handle can ' +
         'overflow. The trap is that it removes a check that was catching something else: in Java an impossible ' +
         'amount announces itself by going negative, and in Ruby it just quietly is an impossible amount.' },
    { p: 'The other half is making the value object behave. `include Comparable` plus one `<=>` gives you `<`, `>`, ' +
         '`<=`, `>=` and `between?` for free, and `freeze` in the constructor means an amount cannot be edited after ' +
         'it is made, which is the same argument as `frozen=True` in level 5.' },
    { code: 'class Money\n  include Comparable\n  attr_reader :cents, :currency\n\n  def initialize(cents, currency = "USD")\n    raise ArgumentError, "whole minor units only" unless cents.is_a?(Integer)\n    @cents = cents\n    @currency = currency\n    freeze                      # nothing can change this afterwards\n  end\n\n  def <=>(other)\n    raise ArgumentError, "cannot mix #{currency} and #{other.currency}" unless currency == other.currency\n    cents <=> other.cents\n  end\nend', lang: 'ruby' },
    { p: 'Note what `<=>` does on a currency mismatch. It does not return false and it does not guess. Comparing 50 ' +
         'EUR with 200 USD is a meaningless question rather than a question with the answer no, so the only honest ' +
         'response is to refuse to answer. That decision comes back and bites in the last section, which is the ' +
         'point of making it here.' },

    { h: 'Rules that change every week' },
    { p: 'Here is the same policy written twice. The first is how it usually starts:' },
    { code: 'def refund_allowed?(payment, request)\n  return false unless payment.state == :captured\n  return false if payment.disputed\n  return false if request.amount > payment.captured - payment.refunded\n  return false if (Date.today - payment.captured_at).to_i > 120\n  true\nend', lang: 'ruby' },
    { p: 'It works, and it has three problems that only show up later. It returns one boolean, so a refund that ' +
         'breaks three rules reports one. It cannot say **why**, so support cannot tell the customer anything. And ' +
         'the risk lead who owns this policy cannot read it, which means every change to it is a ticket for you.' },
    { code: 'rule :already_disputed do\n  because "this payment is being disputed, and refunding it now would pay twice"\n  refuse_when { payment.disputed }\nend\n\nrule :large_refund do\n  because "a refund this size is checked by a person first"\n  review_when { amount > threshold(:review_above) }\nend', lang: 'ruby' },
    { p: 'Three things changed. There is a third answer, **review**, which is what most real policies spend their ' +
         'time doing. Every rule carries a sentence that could be shown to the customer it is about. And the file ' +
         'can be read by somebody who does not write Ruby, which is how a policy stops being yours.' },
    { tip: 'Make `because` compulsory: a rule with no reason refuses to load. It takes one line in the builder and ' +
           'it means no rule can ever reach production unable to explain itself. If you cannot write the sentence, ' +
           'you do not yet understand the rule well enough to ship it.' },

    { h: 'Fail closed' },
    { p: 'The engine runs every rule rather than stopping at the first failure, so a refund that breaks three rules ' +
         'reports three. That raises a question the simple version never had to answer: what happens when a rule ' +
         'itself throws?' },
    { p: 'There are three options and two of them are wrong.' },
    { table: {
      head: ['When a rule raises', 'What happens', 'Verdict'],
      rows: [
        ['Let it through', 'The whole decision dies. One broken rule takes down every refund', 'Wrong: an unrelated customer cannot get their money back'],
        ['Catch it and skip the rule', 'The refund is approved by the rules that did run', '**Worse.** A broken check reads as a passed check, and money leaves'],
        ['Catch it and refuse', 'That refund is held, naming the rule and the error', 'Right. Nobody is paid by accident, and the error is in front of somebody']
      ]
    }},
    { p: 'The middle row is the one worth sitting with, because it is what a `rescue` with an empty body does, and ' +
         'it is the most common way a safety check turns into decoration. **Failing closed** means that when the ' +
         'thing that decides is broken, the answer is no.' },
    { p: 'This is not free, and it is not the same as being safe. Fail closed on a payment authorisation and you ' +
         'decline real customers during an outage, which is why that one usually fails open with a limit. The rule ' +
         'of thumb: fail closed when the cost of a wrong yes is higher than the cost of a wrong no. Refunds are ' +
         'money leaving, so a wrong yes is expensive and a wrong no is an apology.' },
    { check: {
      q: 'The policy in this level refuses any currency it has no thresholds for. A new market launches on a ' +
         'Friday, and every refund in the new currency is held. Was the design wrong?',
      a: 'No, but the alert was. Holding is correct: the policy genuinely does not know what a large refund is in ' +
         'that currency, and inventing one by reusing the dollar figure would be worse than stopping. What is wrong ' +
         'is that nobody found out until a customer complained. A policy that fails closed needs the held queue ' +
         'watched, with an alert on held-for-an-unconfigured-reason, which is level 16\'s argument applied to a ' +
         'business rule rather than a server. Fail closed, and then look at what you closed on.'
    }}
  ],

  tutorial: {
    intro: 'A refund policy engine in Ruby, in about 150 lines. Ruby 3.1 or later. Nothing to install beyond Ruby ' +
           'itself: the tests use minitest, which ships with it.',
    steps: [
      {
        t: 'Ruby, and a test that runs',
        blocks: [
          { p: 'Two directories and one file. Minitest comes with Ruby, so there is no Gemfile and no `bundle ' +
               'install` in this level.' },
          { code: 'mkdir -p refund-policy/lib/refunds refund-policy/test\ncd refund-policy\nruby --version          # 3.1 or later', lang: 'bash' },
          { code: '# test/test_refunds.rb\nrequire "minitest/autorun"\n\nclass TestNothingYet < Minitest::Test\n  def test_ruby_works\n    assert_equal 4, 2 + 2\n  end\nend', lang: 'ruby' },
          { code: 'ruby -Ilib -Itest test/test_refunds.rb\n\n# Running:\n# .\n# 1 runs, 1 assertions, 0 failures, 0 errors, 0 skips', lang: 'bash' },
          { p: '`-Ilib -Itest` puts both directories on the load path, which is what makes `require "refunds/money"` ' +
               'find your file rather than a gem somewhere.' },
          { tip: 'Run the tests after every step in this level. They take about eight milliseconds, so there is no ' +
                 'reason to batch up changes and then find out which one broke it.' }
        ],
        check: 'ruby -Ilib -Itest test/test_refunds.rb reports 1 runs, 0 failures.'
      },
      {
        t: 'Money that cannot be edited',
        blocks: [
          { code: '# lib/refunds/money.rb\nmodule Refunds\n  class Money\n    include Comparable\n    attr_reader :cents, :currency\n\n    def self.decimals(currency)\n      case currency\n      when "JPY", "KRW" then 0\n      when "BHD", "KWD", "TND" then 3\n      else 2\n      end\n    end\n\n    def initialize(cents, currency = "USD")\n      raise ArgumentError, "money must be whole minor units, got #{cents}" unless cents.is_a?(Integer)\n\n      @cents = cents\n      @currency = currency\n      freeze\n    end\n\n    def +(other)\n      same_currency!(other)\n      Money.new(cents + other.cents, currency)\n    end\n\n    def <=>(other)\n      same_currency!(other)\n      cents <=> other.cents\n    end\n\n    def positive? = cents.positive?\n\n    private\n\n    def same_currency!(other)\n      raise ArgumentError, "cannot mix #{currency} and #{other.currency}" unless currency == other.currency\n    end\n  end\nend', lang: 'ruby' },
          { p: 'Three Ruby things in one file. `include Comparable` plus `<=>` gives you every comparison operator. ' +
               '`freeze` in the constructor makes the object immutable, so `+` has to return a new one. And ' +
               '`def positive? = cents.positive?` is the one line method form, where the last expression is the ' +
               'return value.' },
          { p: 'The parser is the fiddly part, and the fiddliness is the currency. `"12.99"` is 1299 cents, and ' +
               '`"1299"` in yen is 1299 yen, and `"12.99"` in yen is not an amount at all:' },
          { code: 'def self.parse(text, currency = "USD")\n  whole, fraction = text.to_s.split(".")\n  places = decimals(currency)\n  fraction = (fraction || "").ljust(places, "0")\n  raise ArgumentError, "#{currency} has #{places} decimal places, got #{text}" if fraction.length > places\n\n  sign = whole.start_with?("-") ? -1 : 1\n  new(sign * (whole.delete("-").to_i * 10**places + fraction.to_i), currency)\nend', lang: 'ruby' },
          { warn: 'Write the yen test now, not later. A default argument like `refunded: "0.00"` looks harmless and ' +
                  'is not a legal yen amount, so the day a second currency arrives it raises from a line nobody has ' +
                  'touched in months. That exact bug is in the solution\'s notes because it happened while writing ' +
                  'it.' }
        ],
        check: 'Money.parse("12.99").cents is 1299, Money.parse("1299", "JPY").cents is 1299, and Money.parse("12.99", "JPY") raises.'
      },
      {
        t: 'Your first block',
        blocks: [
          { p: 'Before the DSL, the mechanism on its own. A block is code you hand to a method; `yield` runs it; ' +
               '`&name` captures it as an object you can keep.' },
          { code: 'def twice\n  yield\n  yield\nend\n\ntwice { puts "hello" }        # hello, twice\n\ndef keep(&block)\n  @saved = block               # now it is a value\nend\n\nkeep { 2 + 2 }\n@saved.call                    # 4, whenever you like', lang: 'ruby' },
          { p: 'The second form is the one this level needs. A rule is a condition written today and run against a ' +
               'payment that does not exist yet, so it has to be stored rather than executed.' },
          { p: 'One more piece: `instance_exec` runs a stored block against a chosen object, so the block can say ' +
               '`payment` and get the payment of whatever it is being run against.' },
          { code: 'condition = proc { payment.disputed }\n\ncontext = SomethingWithAPaymentMethod.new(a_payment)\ncontext.instance_exec(&condition)      # the block sees context\'s methods', lang: 'ruby' },
          { tip: 'The difference in one line: `instance_eval` takes no arguments and is for a block you are about ' +
                 'to define things in; `instance_exec` can take arguments and is for running one later. This level ' +
                 'uses `instance_eval` to build the policy and `instance_exec` to run each rule.' }
        ],
        check: 'You can store a block in an instance variable and call it afterwards.'
      },
      {
        t: 'A rule, and what it must declare',
        blocks: [
          { code: '# lib/refunds/policy.rb\nmodule Refunds\n  class Rule\n    attr_reader :name, :outcome, :condition\n\n    def initialize(name)\n      @name = name\n      @because = nil\n      @outcome = nil\n      @condition = nil\n    end\n\n    def because(text = nil)\n      return @because if text.nil?      # reader and writer in one method\n\n      @because = text\n    end\n\n    def refuse_when(&block)\n      @outcome = :refuse\n      @condition = block\n    end\n\n    def review_when(&block)\n      @outcome = :review\n      @condition = block\n    end\n\n    def valid!\n      raise ArgumentError, "rule #{name} has no condition" if condition.nil?\n      raise ArgumentError, "rule #{name} does not say why" if @because.nil?\n    end\n  end\nend', lang: 'ruby' },
          { p: '`valid!` is the line that matters. It runs when the rule is defined, not when it is evaluated, so a ' +
               'rule missing its reason stops the file loading rather than failing on a Tuesday afternoon with a ' +
               'customer waiting. The `!` says this one raises.' },
          { p: 'Three outcomes, not two. `refuse` and `review` are declared by which method you call, and **allow** ' +
               'is what happens when no rule fires, which means the default is written nowhere and cannot drift.' }
        ],
        check: 'A rule built without calling because() raises from valid!.'
      },
      {
        t: 'The DSL, in fifteen lines',
        blocks: [
          { code: 'class RefundPolicy\n  attr_reader :rules\n\n  def self.define(&block)\n    builder = new\n    builder.instance_eval(&block)     # the whole trick\n    builder.freeze\n  end\n\n  def initialize\n    @rules = []\n    @thresholds = {}\n  end\n\n  def thresholds(table = nil)\n    return @thresholds if table.nil?\n\n    @thresholds = table\n  end\n\n  def rule(name, &block)\n    raise ArgumentError, "duplicate rule #{name}" if @rules.any? { |r| r.name == name }\n\n    r = Rule.new(name)\n    r.instance_eval(&block)\n    r.valid!\n    @rules << r\n    r\n  end\nend', lang: 'ruby' },
          { p: 'Two `instance_eval` calls, nested. The outer one lets the policy block say `rule` with no receiver. ' +
               'The inner one lets each rule block say `because` and `refuse_when` with no receiver. That is the ' +
               'entire difference between a configuration file and a DSL.' },
          { p: 'The duplicate check is worth the line. Two rules with the same name is a copy and paste that silently ' +
               'leaves one of them never reported, and it is the kind of thing that survives review because both ' +
               'halves look right.' },
          { p: 'Now the policy file itself, which is the one somebody else reads:' },
          { code: '# lib/refunds/rules.rb\nPOLICY = RefundPolicy.define do\n  thresholds(\n    "USD" => { review_above: "500.00", large_payment: "1000.00" },\n    "JPY" => { review_above: "75000",  large_payment: "150000" },\n  )\n\n  rule :already_disputed do\n    because "this payment is being disputed, and refunding it now would pay twice"\n    refuse_when { payment.disputed }\n  end\n\n  rule :outside_window do\n    because "the card networks stop accepting refunds 120 days after the payment"\n    refuse_when { days_since_capture > 120 }\n  end\nend', lang: 'ruby' },
          { warn: 'The thresholds live in a table rather than inside the rules, and not for tidiness. A threshold ' +
                  'written as `money("500.00")` inside a rule is parsed in whatever currency the payment happens to ' +
                  'be in, and `"500.00"` is not a yen amount. Writing them per currency is also the honest ' +
                  'statement that 500 of one currency is not 500 of another.' }
        ],
        check: 'POLICY.rules.length matches the number of rules you wrote, and POLICY is frozen.'
      },
      {
        t: 'The context a rule runs against',
        blocks: [
          { p: 'The rule bodies say `payment`, `amount` and `days_since_capture` with nothing passed in. This is the ' +
               'object they are run against, and it is the only place those names exist.' },
          { code: 'class Context\n  attr_reader :payment, :request, :today\n\n  def initialize(payment:, request:, today:, thresholds: {})\n    @payment = payment\n    @request = request\n    @today = today\n    @thresholds = thresholds\n  end\n\n  def amount = request.amount\n  def refundable_left = payment.captured - payment.refunded\n  def days_since_capture = (today - payment.captured_at).to_i\n  def same_currency? = request.currency == payment.currency\n\n  def threshold(name)\n    table = @thresholds.fetch(payment.currency) do\n      raise KeyError, "no thresholds configured for #{payment.currency}"\n    end\n    Money.parse(table.fetch(name), payment.currency)\n  end\nend', lang: 'ruby' },
          { p: 'Keeping this small is the discipline. Everything a rule is allowed to ask about is one short file, ' +
               'so the vocabulary of the policy is the public methods here. A rule that needs something new means ' +
               'adding a method deliberately, rather than a rule quietly reaching into a database.' },
          { p: '`today` is a parameter rather than `Date.today` inside the rules, which is what makes the window ' +
               'rules testable without waiting 121 days.' }
        ],
        check: 'A rule body can say days_since_capture and get a number.'
      },
      {
        t: 'Every rule, and failing closed',
        blocks: [
          { p: 'Now the engine. Two decisions, both of which you can get wrong without any test noticing.' },
          { code: 'def decide(payment:, request:, today:)\n  context = Context.new(payment: payment, request: request, today: today,\n                        thresholds: @thresholds)\n  findings = rules.filter_map { |r| r.evaluate(context) }\n\n  outcome = if findings.any? { |f| f.outcome == :refuse } then :refuse\n            elsif findings.any? { |f| f.outcome == :review } then :review\n            else :allow\n            end\n\n  Decision.new(outcome: outcome, findings: findings)\nend', lang: 'ruby' },
          { p: 'Every rule is evaluated, not just up to the first refusal, so a refund that breaks three rules ' +
               'reports all three. Support asking a customer to fix one thing at a time, three times, is how a two ' +
               'minute job becomes a week.' },
          { p: 'And the second decision, inside the rule:' },
          { code: 'def evaluate(context)\n  fires?(context) ? Finding.new(name: name, outcome: outcome, because: because) : nil\nrescue StandardError => e\n  Finding.new(name: name, outcome: :refuse,\n              because: "this rule could not be applied to this payment (#{e.message}), " \\\n                       "so the refund is held rather than approved")\nend', lang: 'ruby' },
          { p: 'A broken rule becomes a refusal that names itself and carries the error. It does not take the whole ' +
               'decision down, and it absolutely does not get skipped, because a check that was skipped looks ' +
               'exactly like a check that passed.' },
          { tip: 'Write the test for this before the code: define a policy whose only rule raises, and assert the ' +
                 'decision is a refusal. It is four lines and it is the one behaviour in this engine that nobody ' +
                 'will notice is missing until it costs money.' }
        ],
        check: 'A policy whose only rule raises returns a refusal, and the reason contains the error message.'
      },
      {
        t: 'A day of refunds',
        blocks: [
          { p: 'Fifteen requests, chosen so every rule fires at least once, including the ones you hope never do. ' +
               'The run reports what happened and, more usefully, what support would say:' },
          { code: '9 rules, 15 requests\n\n   allowed    4\n   review     4\n   refused    7\n\n   rules that fired\n      not_captured                    2\n      already_disputed                2\n      wrong_currency                  1\n      not_positive                    1\n      more_than_remains               1\n      outside_window                  2\n      large_refund                    3\n      late_in_window                  4\n      full_refund_of_a_large_payment  2\n\n   rules never exercised: none', lang: 'text' },
          { p: 'The last line is the one to keep. A rule that never fires in your own test day is a rule nobody has ' +
               'checked, and policy files accumulate those: a threshold from two years ago that no current payment ' +
               'can reach. Printing the unexercised list makes dead policy visible instead of quietly growing.' },
          { code: '      pay_14    $5000.00  refuse\n            a payment that was never captured is cancelled rather than refunded\n            this payment is being disputed, and refunding it now would pay twice\n            the card networks stop accepting refunds 120 days after the payment\n            a refund this size is checked by a person first\n            refunds after 90 days are checked, because the window closes at 120\n            cancelling a large payment outright is worth a second pair of eyes', lang: 'text' },
          { p: 'Six rules on one request, each in a sentence somebody could read out. The boolean version of this ' +
               'policy would have returned `false`.' }
        ],
        check: 'Your run reports every rule firing at least once, and no refusal that cannot explain itself.'
      }
    ]
  },

  glossary: [
    { t: 'Block', d: 'A chunk of code passed to a method, written `do ... end` or `{ ... }`. Run with `yield`, captured with `&`.' },
    { t: 'Proc', d: 'A block captured as an object, so it can be stored and called later.' },
    { t: 'Symbol', d: 'An interned name written `:like_this`. Cheaper than a string and compared by identity.' },
    { t: 'instance_eval', d: 'Run a block as if it were inside another object, so the block can call that object\'s methods with no receiver. The mechanism behind every Ruby DSL.' },
    { t: 'instance_exec', d: 'The same, for a block stored earlier and run later, and it can take arguments.' },
    { t: 'DSL', d: 'A domain specific language: an API shaped so the code reads as statements about the problem.' },
    { t: 'Comparable', d: 'A module that turns one `<=>` method into every comparison operator.' },
    { t: 'freeze', d: 'Make an object immutable. Calling it in a constructor is how a value object stays a value.' },
    { t: 'Monolith', d: 'One deployable application holding most of a company\'s logic. Stripe\'s is Ruby.' },
    { t: 'Sorbet', d: 'The gradual type checker Stripe wrote for Ruby and open sourced, after the monolith outgrew dynamic typing.' },
    { t: 'Fail closed', d: 'When the thing that decides is broken, the answer is no. The opposite is fail open.' },
    { t: 'Refund window', d: 'The period after a payment during which the card networks still accept a refund. Commonly 120 days.' },
    { t: 'Review queue', d: 'The third outcome: neither allowed nor refused, but held for a person. Where most real policy time goes.' }
  ],

  quiz: [
    { q: 'Why would a payments company run its core API on Ruby rather than Go?',
      options: ['Ruby is faster for IO bound work', 'Because the expensive resource is how quickly a business rule can be read and changed, and the core is mostly waiting on other systems anyway', 'Ruby uses less memory per request', 'Go cannot talk to Postgres'],
      answer: 1,
      why: 'Pick per workload. The same company writes Go for the webhook sender, where throughput is the whole job.' },

    { q: 'In Ruby, which of these is falsey?',
      options: ['`0`', '`""`', '`[]`', '`nil`'],
      answer: 3,
      why: 'Only `nil` and `false`. A guard written the Python way lets a zero amount straight through.' },

    { q: 'What does `yield` do inside a method?',
      options: ['Runs the block the caller passed in', 'Returns a value and pauses, like a Python generator', 'Hands control to another thread', 'Declares the method takes a block'],
      answer: 0,
      why: 'Ruby has `Enumerator` for the generator idea. `yield` is simply "run the block I was given".' },

    { q: 'Why does a rule store its condition as a block rather than evaluating it at definition time?',
      options: ['Blocks are faster than method calls', 'To avoid a circular import', 'Because the condition is written now and run later, against a payment that does not exist yet', 'Because Ruby cannot evaluate a condition outside a method'],
      answer: 2,
      why: 'The whole policy is defined at load, and runs thousands of times afterwards against payments nobody has seen.' },

    { q: 'What does `instance_eval` change about the block it is given?',
      options: ['It makes the block run in a new thread', 'It changes `self`, so the block can call the target object\'s methods with no receiver', 'It copies the block so the original cannot be mutated', 'It defers the block until the object is frozen'],
      answer: 1,
      why: 'That is the entire mechanism behind Rails routes, RSpec, a Gemfile, and this policy.' },

    { q: 'What is the real cost of building a DSL with `instance_eval`?',
      options: ['`self` is not what the surrounding file says, so errors name unfamiliar classes and editors cannot complete the vocabulary', 'It is significantly slower at run time', 'It prevents the object from being frozen', 'It only works at the top level of a file'],
      answer: 0,
      why: 'Worth paying for a file of business rules read by non programmers. Not worth paying anywhere else.' },

    { q: 'Money as whole cents in a Ruby `Integer` is exact up to what?',
      options: ['2^53, as in JavaScript', '2^63, then it wraps negative', 'There is no limit. `Integer` is arbitrary precision', '2^31 on a 32 bit build'],
      answer: 2,
      why: 'A genuine advantage over level 10.1 and level 18, and it removes an overflow check that was catching other mistakes.' },

    { q: 'Why must `Money#<=>` raise when the currencies differ, rather than return false?',
      options: ['Because Comparable requires an exception', 'To make the error message nicer', 'Because false would sort EUR before USD', 'Because comparing 50 EUR with 200 USD is meaningless rather than false, and guessing an answer hides the bug'],
      answer: 3,
      why: 'And the raise is what the engine then has to handle, which is the last section of this level.' },

    { q: 'The engine evaluates every rule instead of stopping at the first refusal. Why?',
      options: ['Rules may depend on each other', 'So a refund that breaks three rules reports three, instead of support asking the customer to fix one thing at a time, three times', 'To make the timing predictable', 'Because `filter_map` cannot stop early'],
      answer: 1,
      why: 'The cost is that a rule can now be reached with data it cannot handle, which is why fail closed matters.' },

    { q: 'A rule raises an exception. What should the engine do?',
      options: ['Record a refusal naming the rule and carrying the error', 'Skip that rule and decide on the others', 'Let the exception propagate and fail the request', 'Retry the rule three times'],
      answer: 0,
      why: 'Skipping is the dangerous one: a check that was skipped looks exactly like a check that passed, and the money leaves.' },

    { q: 'What does "fail closed" mean, and when is it wrong?',
      options: ['Close the connection on error; wrong for long lived sockets', 'Stop the process on error; wrong in a web server', 'When the decider is broken the answer is no; wrong where a false no is costlier than a false yes, like declining real cards during an outage', 'Roll back the transaction; wrong when there is no transaction'],
      answer: 2,
      why: 'Refunds are money leaving, so a wrong yes is expensive and a wrong no is an apology. Authorisations are the other way round.' },

    { q: 'Why does the policy keep thresholds in a per currency table rather than writing `money("500.00")` inside the rule?',
      options: ['It is easier to read', 'It avoids parsing on every decision', 'Hashes are faster than string parsing', '`"500.00"` is parsed in whatever currency the payment is in, and it is not a yen amount at all'],
      answer: 3,
      why: 'And separately, 500 of one currency is simply not 500 of another, which the table states out loud.' },

    { q: 'Why does `valid!` run when a rule is defined rather than when it is evaluated?',
      options: ['So a rule missing its reason stops the file loading, instead of failing later with a customer waiting', 'Because conditions cannot be inspected at run time', 'To let the JIT optimise the block', 'Because `freeze` would otherwise fail'],
      answer: 0,
      why: 'The same argument as a type error at build time rather than at 3am. Push the failure as early as it will go.' },

    { q: 'The demo prints "rules never exercised". Why is that worth printing?',
      options: ['It measures test coverage of the engine', 'A rule nothing can reach is dead policy nobody has checked, and policy files quietly accumulate them', 'It shows which rules are slowest', 'It is required for the audit'],
      answer: 1,
      why: 'A threshold from two years ago that no current payment can reach still looks like a working control in a review.' },

    { q: 'What is the third outcome, besides allow and refuse?',
      options: ['Retry', 'Defer', 'Review, where a person decides, and where most real policy time goes', 'Partial'],
      answer: 2,
      why: 'A policy with only two answers pushes every borderline case into one of them, and both choices are wrong often enough to matter.' }
  ],

  project: {
    title: 'A refund policy a risk lead can read',
    story: 'Every payments company has a file that decides who gets their money back, it changes most weeks, and ' +
           'the people who change it are not all engineers. Build that file as a small language of its own: rules ' +
           'that read as sentences, every decision explained well enough to show the customer, all rules evaluated ' +
           'rather than the first failure, and an engine that holds a refund rather than approving one when ' +
           'something is broken.',
    scope: 'Uses levels 4 and 9 for the ledger and the card lifecycle. Ruby 3.1 or later and minitest, which ships ' +
           'with Ruby. No Rails, no gems, no database. **This is the only Ruby in the course** and it is an aside ' +
           'rather than a rung, so nothing later depends on it. It is here because Stripe, Shopify and GitHub run ' +
           'on Ruby and the track had none.',
    requirements: [
      'A `Money` value object over whole minor units, frozen in the constructor, with `Comparable` and one `<=>`',
      'Currency aware parsing and printing: `"12.99"` in USD, `"1299"` in JPY, and `"12.99"` in JPY rejected',
      '`<=>` raising on mixed currencies rather than returning false',
      'A `rule` DSL built with `instance_eval`, where each rule names itself, states a reason, and gives one condition',
      'A rule missing its reason or its condition failing at definition time, not at decision time',
      'A duplicate rule name rejected',
      'Three outcomes: refuse, review, and allow as the absence of any firing rule',
      'At least eight rules covering the state, disputes, currency, amount, the remaining balance and the refund window',
      'Thresholds in a per currency table, with at least two currencies configured and one deliberately not',
      'Every rule evaluated on every decision, with all findings returned rather than the first',
      'A rule that raises becoming a refusal that names the rule and carries the error message',
      'An unconfigured currency held rather than approved, proven by a test',
      'A `Decision` that can print itself as the sentences support would say to the customer',
      'A demo over at least 15 requests where every rule fires at least once, printing the unexercised list',
      'At least 25 minitest tests, including the boundary of the refund window on both sides',
      'A README showing the policy file itself, because that file is the deliverable'
    ],
    starter: {
      lang: 'ruby',
      code: '# lib/refunds/money.rb\nmodule Refunds\n  class Money\n    include Comparable\n    attr_reader :cents, :currency\n\n    def self.decimals(currency)\n      # TODO: 0 for JPY and KRW, 3 for BHD KWD TND, otherwise 2\n    end\n\n    def self.parse(text, currency = "USD")\n      # TODO: "12.99" -> 1299 in USD. "12.99" in JPY must raise.\n    end\n\n    def initialize(cents, currency = "USD")\n      # TODO: whole Integer only, then freeze\n    end\n\n    def <=>(other)\n      # TODO: raise on a currency mismatch. Not false. Raise.\n    end\n  end\nend\n\n\n# lib/refunds/policy.rb\nmodule Refunds\n  class Rule\n    def because(text = nil)\n      # TODO: reader when called with nothing, writer when called with a string\n    end\n\n    def refuse_when(&block) = nil   # TODO: store the block and the outcome\n    def review_when(&block) = nil   # TODO\n\n    def valid!\n      # TODO: raise if there is no condition, or no reason\n    end\n\n    def evaluate(context)\n      # TODO: run the condition against context with instance_exec.\n      # A raise here must become a REFUSAL, never a skip.\n    end\n  end\n\n  class RefundPolicy\n    def self.define(&block)\n      # TODO: instance_eval the block against a new builder, then freeze\n    end\n\n    def rule(name, &block)\n      # TODO: reject duplicates, build the rule, validate it, keep it\n    end\n\n    def decide(payment:, request:, today:)\n      # TODO: every rule, all findings. refuse beats review beats allow.\n    end\n  end\nend\n\n\n# lib/refunds/rules.rb\nPOLICY = RefundPolicy.define do\n  # TODO: the thresholds table, then the rules, each with a sentence\n  # a customer could be shown\nend\n'
    },
    tests: [
      'Money.parse("12.99").cents == 1299 and Money.parse("1299", "JPY").cents == 1299',
      'Money.parse("12.99", "JPY") raises, naming the number of decimal places',
      'Money.parse("1.00", "USD") + Money.parse("1.00", "EUR") raises',
      'A Money built with 10**20 cents adds correctly: Integer does not run out',
      'A rule defined without because() raises at definition time, naming the rule',
      'A duplicate rule name raises',
      'An ordinary partial refund inside the window is allowed, with no findings',
      'A refund of exactly what remains is allowed; one cent more is refused',
      'A capture 120 days ago is not refused by the window rule; 121 days is',
      'A payment in an unconfigured currency is refused, and the reason names the currency',
      'A request breaking three rules returns three findings',
      'A refusal and a review together is a refusal',
      'A policy whose only rule raises returns a refusal whose reason contains the error',
      'Every rule in the shipped policy has a reason longer than twenty characters'
    ],
    rubric: [
      { pts: 25, t: 'The rules read as rules', d: 'Somebody who does not write Ruby can read the policy file and tell you what it does.' },
      { pts: 20, t: 'Every decision explains itself', d: 'Every refusal and review carries a sentence that could be shown to the customer. No rule can load without one.' },
      { pts: 20, t: 'Fail closed', d: 'A rule that raises refuses rather than being skipped, and a test proves it.' },
      { pts: 15, t: 'All findings, not the first', d: 'A request breaking three rules reports three.' },
      { pts: 10, t: 'Money', d: 'Frozen, whole minor units, currency aware, and raising rather than guessing on a mismatch.' },
      { pts: 10, t: 'The day', d: 'Fifteen requests, every rule exercised, and the unexercised list printed.' }
    ],
    stretch: [
      'Add Sorbet and type the engine, then say what it caught and what it cost in ceremony',
      'Load the policy from YAML instead of Ruby, and report what you lost: conditions are the hard part',
      'Add an effective date to each rule, so you can ask what the policy would have decided last March',
      'Port the engine to Python and compare the two policy files side by side for readability'
    ],
    solutionPath: 'solutions/level-20-1'
  },

  faq: [
    { q: 'Why is this after level 20 rather than somewhere in the middle?',
      a: 'Because nothing in the track needs it. It is an aside: the capstone is still the end of the ladder, the ' +
         'rank titles still run out at twenty, and you can finish the course without opening this. It sits at 20.1 ' +
         'for people who want the language a lot of payments companies actually write.' },
    { q: 'No Rails?',
      a: 'No. Rails is a large framework worth learning on its own time, and none of it would teach you anything ' +
         'about this problem. Everything here is plain Ruby and the standard library, which also means the level ' +
         'does not rot when Rails releases a major version.' },
    { q: 'Is a DSL not over engineering for nine rules?',
      a: 'For nine rules you wrote and only you will change, yes. The DSL earns its place at the moment somebody ' +
         'who is not an engineer needs to read the policy, which in a payments company is immediately: risk, ' +
         'support and compliance all have opinions about refunds. If that is never true where you work, write the ' +
         'if statements.' },
    { q: 'Should I learn Ruby before an interview?',
      a: 'Stripe\'s own posting says new languages can be learned if the fundamentals are there, and they mean it. ' +
         'Do this level so the syntax is not new, and spend the rest of your time on the things the interview ' +
         'actually tests, which are levels 19 and 20.' }
  ]
});
