# Level 19: The screen that filters you out: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **A** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **C** |
| 7 | **D** |
| 8 | **B** |
| 9 | **C** |
| 10 | **C** |
| 11 | **B** |
| 12 | **D** |
| 13 | **B** |
| 14 | **A** |
| 15 | **A** |

---

### 1. Matching two 8,000 row files by reference took 8,528.3 ms with nested loops and 7.0 ms with a dictionary. At a million rows, roughly what happens?

- **A. The nested version would take around 36 hours while the indexed one stays under a second** ✅
- B. Both grow by the same factor
- C. Neither is usable
- D. The nested version becomes about 125 times slower

**Why:** Quadratic growth against linear. This is why "use a dictionary" is the expected answer, said early.

### 2. Four times the rows made the nested version 45 times slower rather than 16. Why?

- **A. Memory: at the smaller size the data still fits in cache, so each comparison also got more expensive** ✅
- B. Because the algorithm is cubic
- C. Garbage collection
- D. The measurement was wrong

**Why:** Complexity describes growth in operations. Constant factors move too, and usually in the wrong direction.

### 3. Which of these is a change of complexity class rather than a constant factor improvement?

- A. Using a faster JSON library
- B. Sorting 200,000 items against using a heap for the top 10
- C. String += in a loop against "".join(...)
- **D. Checking membership in a list against a set** ✅

**Why:** Measured at 100,000 known references: 19,708.9 ms against 6.82 ms, and the gap grows with the data.

### 4. Grouping 200,000 payments by merchant: filtering once per merchant took 9,527.8 ms, one pass took 59.1 ms. What is the pattern name?

- A. Sliding window
- B. Two pointers
- **C. Hash map, one pass building a dictionary of lists** ✅
- D. Prefix sums

**Why:** Filtering per key is a nested loop wearing a comprehension. 161x, and it grows.

### 5. "The ten largest refunds today, from a stream you cannot store." Which pattern?

- A. Sorting
- **B. A heap** ✅
- C. Prefix sums
- D. Intervals

**Why:** Whenever you hear "top k", especially over a stream, the answer starts with a heap.

### 6. "The highest total any merchant took in a rolling 24 hours." Which pattern?

- A. Hash map counting
- B. Two pointers
- **C. Sliding window** ✅
- D. Graph traversal

**Why:** "In any period of" and "consecutive" are the tells. Update the total rather than recomputing it.

### 7. Which step do candidates skip most often, and interviewers weight most heavily?

- A. Asking about edge cases
- B. Writing tests
- C. Optimising the solution
- **D. Stating the approach and its complexity before writing any code** ✅

**Why:** One sentence before you type tells the interviewer most of what the hour was going to reveal.

### 8. You are stuck five minutes in. What is the best move?

- A. Start writing code and hope
- **B. Say the brute force out loud, try a tiny example, or ask whether sorting the input would help** ✅
- C. Think silently until you have it
- D. Ask for a different question

**Why:** Silence reads as lost. One of those three almost always moves the problem forward.

### 9. A working slow solution against an unfinished fast one. Which scores better?

- A. It depends on the company
- B. The unfinished fast one, because it shows ambition
- **C. The working slow one, said aloud to be slow, then improved** ✅
- D. They score the same

**Why:** Get correct first, name what is slow, then improve. Many loops score whether you arrived, not how directly.

### 10. In a practical exercise, what should you do in the first five minutes?

- A. Start writing the fix
- B. Plan the change in full
- **C. Run the tests, so you have a working baseline and find a broken setup early** ✅
- D. Read the whole codebase

**Why:** A working baseline tells you more than an hour of reading, and setup problems are worth finding at minute two.

### 11. At minute seventy of a ninety minute exercise you find your approach cannot handle a required case. Best response?

- A. Start again with the correct design
- **B. Commit what works, then write a note saying what breaks, why, and what you would do with another hour** ✅
- C. Hack around it so everything appears to pass
- D. Stop and submit nothing

**Why:** Reviewers score that above a rushed rewrite, because it is what they want a colleague to do on a Friday.

### 12. Why does reformatting a file while fixing a bug count against you?

- A. It does not matter
- B. Because formatters disagree
- C. It is slower
- **D. Because it buries the actual change and ignores the conventions of the codebase you are joining** ✅

**Why:** Matching the style you find is a signal about working with people, which is what the exercise is for.

### 13. What makes a good failure story in a behavioural round?

- A. A failure caused by somebody else
- **B. That you noticed it, told somebody, fixed it, and changed something so it could not recur** ✅
- C. A small mistake with no consequences
- D. A strength disguised as a weakness

**Why:** In fintech this round often decides the offer, because the domain punishes people who hide mistakes.

### 14. Why rehearse out loud with a person rather than only solving problems?

- **A. Because explaining while writing uses a different skill from writing silently, and the first attempt must not be in an interview** ✅
- B. To build a network
- C. Because it is faster
- D. To get feedback on your solutions

**Why:** The value is in the talking. A friend on a call is enough.

### 15. What is the most useful thing to do with a problem you failed under time?

- **A. Put it on a redo list with the date and attempt it again a week later** ✅
- B. Read the model solution and consider it learned
- C. Move on to a new problem
- D. Solve it untimed until it is comfortable

**Why:** Repetition on what you got wrong is worth ten fresh problems, and the list is what keeps it targeted.
