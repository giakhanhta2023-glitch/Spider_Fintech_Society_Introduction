# Five stories, with numbers in them

The behavioural round is four questions with the same shape: tell me about a time
you did something hard, and let me hear whether you know what happened afterwards.
Charm has very little to do with it.

**These five are drawn from building this course**, which is the honest source
available to somebody who has not yet had the job. Every number in them is a
measurement that exists in this repository and can be re-run, which is the property
that makes a story hold up under follow up questions. Do the same with your own: if
a story has no number in it, it is an opinion about yourself.

The form is STAR, and the fifth letter people leave off is the one that matters:
**what changed afterwards.** A story that ends at the result is a story about luck.

---

## 1. A time you found a bug that nobody had noticed

**Situation.** Level 11 of this course teaches the outbox pattern by measuring how
many events a dual write loses against how many an outbox duplicates. The experiment
had been written, it ran, and it reported zero duplicates.

**Task.** Zero was the answer I wanted, which is exactly why it needed checking
before it was published to anybody learning from it.

**Action.** I read the instrument rather than the result. The publisher used a batch
size of 50, so 400 payments were 8 rounds, and the injected crash rate was 5% per
round. Eight chances at 5% produces no crashes at all about two runs in three. The
experiment had not measured a system that was correct; it had measured nothing and
reported a beautiful zero. I lowered the batch to 10, which gave 40 rounds, and
added an assertion that the number of duplicates is greater than zero, so the
experiment now fails if it ever stops measuring anything.

**Result.** The published figures became real: over 400 payments at a 5% crash
rate, the dual write lost 5% of events permanently and the outbox lost none and
duplicated 7.50% instead, which is the actual trade the pattern makes.

**What changed afterwards.** I now treat a flattering zero as a broken instrument
until proven otherwise, and I write the assertion that the experiment observed
something at all. The same habit caught two more: a saga sweep reporting zero
inconsistent payouts because the state machine ended early, and a cold cache
measurement that came out faster than the warm one, which I deleted rather than
published.

**The follow up question I would expect.** "How do you know the new number is
right?" The answer is that the crash count is now printed beside the duplicate
count, so a run with no crashes is visibly not evidence.

---

## 2. A time you disagreed with a decision

**Situation.** The curriculum was twenty levels because it had always been twenty
levels. I had been asked more than once whether twenty was necessary and had each
time explained why the plan was good.

**Task.** The question deserved an answer with arithmetic in it rather than a
defence of the plan.

**Action.** I added up the estimated hours across the twenty levels: 130 hours,
which at five hours a week is six months. Then I said plainly that the number
twenty was inherited from an earlier version of the course and had not been derived
from anything, and that levels 18 through 20 are optional for most readers and
levels 1 through 17 are the spine.

**Result.** The structure stayed and the framing changed, which is the outcome that
was actually available. A reader can now see the cost before starting and choose
where to stop.

**What changed afterwards.** When somebody asks the same question twice, I now treat
the repetition as the signal rather than the question. The second asking usually
means the first answer was a defence rather than an answer.

**Why this is a good disagreement story.** I was not overruled and I did not win. I
was wrong about what the question was, which is the more common and less flattering
shape of a real disagreement.

---

## 3. A time you had to make something faster

**Situation.** A settlement reconciliation matching two files by reference, written
the obvious way with nested loops.

**Task.** It needed to handle a real settlement file, which is about a million rows
a side.

**Action.** I measured it at three sizes rather than reasoning about it: 2,000 rows a
side took 119.9 ms, 4,000 took 545.1 ms, and 8,000 took 4,300.6 ms. Four times the
rows made it 36 times slower, which is worse than the 16 times quadratic growth
predicts, and the extra came from the inner list no longer fitting in cache. The
indexed version, one dictionary and one pass, took 0.8 ms, 1.5 ms and 4.7 ms for the
same three sizes.

**Result.** 911 times faster at 8,000 rows, and the ratio grows with the data rather
than staying constant. Extrapolating the nested version to a million rows gives
roughly 36 hours against under a second.

**What changed afterwards.** I now measure at three sizes rather than one, because
one size cannot distinguish a change of complexity class from a constant factor, and
the two are worth completely different amounts. In the same set of measurements,
string concatenation looked like a 1.8x constant factor at 25,000 lines and turned
out to degrade to 21x at 200,000, which one size would have reported as a harmless
2x.

---

## 4. A time you broke something, or nearly did

**Situation.** Level 17's deploy rehearsal: blue green, with a deliberately broken
version deployed to the idle side to prove it receives no traffic, followed by a
timed rollback.

**Task.** Publish a rollback time that a runbook could quote.

**Action.** The rehearsal crashed. Deploying the broken version onto the idle side
had overwritten the last known good version, so there was nothing healthy to roll
back to. That is a property of blue green with two sides rather than a bug in the
rehearsal, and every deploy I had described as safe had the same hole in it. I made
`rollback()` refuse to switch to a side that is not ready, added
`rollback_by_redeploy()` as the slow path, and measured both.

**Result.** Two numbers instead of one: 6.8 ms to the first healthy response when
the idle side still holds the previous version, and 636.2 ms when it has to be
redeployed first. A factor of 93, and the second number is the one a runbook has to
quote, because it is the case that happens after a failed deploy.

**What changed afterwards.** I write the failure case into the rehearsal rather than
the happy path, and I publish the slower number. Quoting the fast one is how a
runbook promises seven milliseconds and delivers a readiness gate.

---

## 5. A time you had to explain something to somebody who did not want to hear it

**Situation.** Level 16's alerting work replays a month of synthetic traffic against
two alerting strategies. The obvious threshold alert, error rate above 1% for five
minutes, detects both incidents instantly. The multiwindow burn rate rule takes two
minutes on one and ten on the other.

**Task.** Recommend the slower one.

**Action.** I put the whole table in front of the reader rather than the flattering
half. The threshold rule paged four times in the month and two of those were blips
that had recovered before anybody could open a laptop. The burn rate rule paged
twice and both were real. Then I costed the downside honestly: two minutes of a 35%
failure rate is about 8,400 failed payments, worth roughly $654,000 in attempted
volume at the measured mean capture of $77.90.

**Result.** The recommendation stands with its price attached. Anybody who wants the
threshold rule now has the numbers to argue for it rather than having to trust me.

**What changed afterwards.** I write the counterfactual into the document. "Here is
what my recommendation costs" is the section that makes the rest of it credible, and
it is the section I used to leave out.

---

## How to use these

Do not use these. They are mine, and an interviewer can tell.

Use the shape: a real situation, one number that can be checked, and a sentence
about what you do differently now. Then rehearse them out loud, once, timed, because
a story that takes four minutes on paper takes seven out loud and the interviewer
stopped listening at three.
