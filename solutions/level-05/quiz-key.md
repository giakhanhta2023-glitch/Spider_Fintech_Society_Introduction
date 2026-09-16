# Level 5: Market Data & APIs: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **A** |
| 3 | **D** |
| 4 | **C** |
| 5 | **B** |
| 6 | **A** |
| 7 | **B** |
| 8 | **B** |
| 9 | **D** |
| 10 | **D** |
| 11 | **A** |
| 12 | **C** |
| 13 | **C** |
| 14 | **A** |
| 15 | **B** |

---

### 1. In `https://api.frankfurter.app/latest?base=USD&symbols=EUR`, which part is the query string?

- A. https
- B. api.frankfurter.app
- **C. base=USD&symbols=EUR** ✅
- D. /latest

**Why:** Everything after the ? is the query string: key=value pairs joined by &, used to filter or configure the request.

### 2. What does `response.json()` return in Python?

- **A. A dict (or list) built from the JSON body** ✅
- B. A string of JSON text
- C. A pandas DataFrame
- D. The status code

**Why:** It parses the body into native Python objects (JSON objects become dicts, arrays become lists) so you can index straight into it.

### 3. You receive HTTP 429. What is the correct response?

- A. Retry immediately in a tight loop
- B. Fix your query parameters
- C. Rotate your API key
- **D. Back off: wait, then retry more slowly, because you have hit the rate limit** ✅

**Why:** 429 means too many requests. Retrying immediately makes it worse and can earn a temporary ban. Exponential backoff is the standard fix.

### 4. Which status code means the problem is in your request rather than their server?

- A. 500
- B. 502
- **C. 400** ✅
- D. 503

**Why:** 4xx codes are client errors: bad parameters, missing auth, unknown resource. Retrying them unchanged will never succeed.

### 5. Why must every production `requests.get` have a timeout?

- A. To reduce bandwidth costs
- **B. Because without one the call can hang indefinitely and freeze your app** ✅
- C. Because the API requires it
- D. To avoid rate limits

**Why:** A server that accepts a connection and never replies will block your thread forever. Requests has no default timeout. You must set it.

### 6. What does `raise_for_status()` do?

- **A. Raises an exception if the status code indicates an error** ✅
- B. Retries the request
- C. Prints the status code
- D. Converts the response to JSON

**Why:** It turns 4xx and 5xx into an HTTPError so a failed response cannot be quietly processed as if it were data.

### 7. What is exponential backoff?

- A. Reducing the timeout on each retry
- **B. Waiting progressively longer between retries: 1s, 2s, 4s** ✅
- C. Switching to a backup API immediately
- D. Requesting more data with each attempt

**Why:** Growing delays give a struggling or rate-limiting service room to recover instead of being hammered by a retry storm.

### 8. Your FX app cannot reach the live API. What is the best behaviour?

- A. Show a blank screen until it recovers
- **B. Use the most recent cached or bundled rates and label them clearly as stale** ✅
- C. Use rates of 1.0 for everything as a placeholder
- D. Retry in a loop until it succeeds

**Why:** Degrade, do not disappear, but never present old data as current. Every displayed rate should carry its source and age.

### 9. Where should an API key live?

- A. Hardcoded in the script so it always works
- B. In the repository README for the team
- C. In the URL, so it is easy to inspect
- **D. In an environment variable or a getpass prompt, never committed** ✅

**Why:** Keys are credentials. Committed keys are found by scanners within minutes, and deleting the line does not remove it from git history.

### 10. You accidentally committed a key to a public repo and deleted it in the next commit. What now?

- A. Nothing, the deletion removed it
- B. Make the repository private and keep the key
- C. Rename the variable
- **D. Revoke and rotate the key immediately; it is still in the history** ✅

**Why:** Git keeps every version. The only safe assumption is that the key is compromised the moment it is pushed.

### 11. Rates are quoted against USD and EUR = 0.9123. How do you convert 250 EUR into USD?

- **A. 250 / 0.9123** ✅
- B. 250 * 0.9123
- C. 250 * (1 - 0.9123)
- D. 250 + 0.9123

**Why:** The rate says 1 USD buys 0.9123 EUR, so going the other way you divide: 250 / 0.9123 = $274.03. Getting this backwards is the classic FX bug.

### 12. With USD-based rates EUR = 0.9123 and GBP = 0.7684, what is the EUR to GBP cross rate?

- A. 0.9123 + 0.7684
- B. 0.9123 * 0.7684
- **C. 0.7684 / 0.9123** ✅
- D. 0.9123 / 0.7684

**Why:** Go through the base: EUR to USD is divide by 0.9123, USD to GBP is multiply by 0.7684, which simplifies to 0.7684 / 0.9123 = 0.8423.

### 13. What is the spread in an FX quote?

- A. The fee charged by the regulator
- B. The range of rates across different banks
- **C. The gap between the bid and the ask, which is the dealer's margin** ✅
- D. The difference between today's and yesterday's rate

**Why:** Bid is what a dealer pays you, ask is what they charge you. You never trade at the mid-market rate news sites display.

### 14. Why add `table[base] = 1.0` inside a convert function?

- **A. So converting to or from the base currency works instead of raising KeyError** ✅
- B. To normalise all the other rates
- C. To round the result
- D. Because APIs always omit the first currency

**Why:** The API omits the base from its rates map, since a currency is trivially 1 of itself. Adding it makes one code path handle every pair.

### 15. Which order gives the most resilient data client?

- A. Live call, then cache, then snapshot
- **B. Fresh cache, then live call with retries, then bundled snapshot** ✅
- C. Snapshot, then cache, then live
- D. Live call only, with an error message on failure

**Why:** Check the cache first to avoid the call entirely, go live when it is stale, and fall back to a labelled snapshot only when everything else fails.
