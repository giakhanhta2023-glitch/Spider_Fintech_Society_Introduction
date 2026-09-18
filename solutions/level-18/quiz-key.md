# Level 18: Three banks, three shapes, one account view: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **B** |
| 2 | **A** |
| 3 | **C** |
| 4 | **D** |
| 5 | **B** |
| 6 | **C** |
| 7 | **B** |
| 8 | **D** |
| 9 | **C** |
| 10 | **B** |
| 11 | **B** |
| 12 | **C** |
| 13 | **A** |
| 14 | **B** |
| 15 | **C** |

---

### 1. Where does the customer type their bank password in the authorization code flow?

- A. In your app, which forwards it
- **B. At their bank, and you never see it** ✅
- C. In the redirect URL
- D. Nowhere: the flow uses the client secret instead

**Why:** That is the point of the flow, and why screen scraping with shared credentials is being legislated out.

### 2. What does PKCE protect against?

- **A. An attacker who obtains the authorization code being able to exchange it** ✅
- B. The access token expiring too soon
- C. The bank refusing the scope
- D. Replay of the refresh token

**Why:** The verifier never leaves your server. Current guidance is to use it for every client type, not only mobile.

### 3. The state parameter exists to:

- A. Carry the requested scopes
- B. Identify the bank
- **C. Stop an attacker linking their account to your user's session** ✅
- D. Hold the code verifier

**Why:** Random, stored server side, checked on return, and used once. A reused state is a fatal error rather than a warning.

### 4. How should a refresh token be stored?

- A. Hashed, like a password
- B. In plain text, because it expires anyway
- C. In the session cookie
- **D. Encrypted at rest with a key held outside the database** ✅

**Why:** You cannot hash it because you need it back. Encryption means a dump of the table is not a set of working credentials.

### 5. Two workers refresh the same token at the same moment. What usually happens?

- A. Both succeed harmlessly
- **B. Many banks invalidate the old refresh token, so one worker is left holding a dead credential** ✅
- C. The bank merges the requests
- D. The access token is issued twice with the same value

**Why:** Take a lock and re-read inside it. A hundred workers should cost one refresh rather than a hundred races.

### 6. A refresh returns 400 invalid_grant. What is the correct handling?

- A. Retry five times with backoff
- B. Reconnect automatically using the stored credentials
- **C. Mark the connection as needing consent and ask the user to reconnect** ✅
- D. Page an engineer

**Why:** The permission is gone. No number of retries recreates it, and the only person who can fix it is the customer.

### 7. Why keep the raw bank record alongside the normalised one?

- A. For the audit log
- **B. Because normalisation is a guess that will be wrong for some bank, and fixing it later needs the original** ✅
- C. To compute the running balance
- D. Because regulators require the raw format

**Why:** Otherwise the only way to correct a parsing bug is asking every customer to reconnect and resync.

### 8. Bank A sends no transaction id. How do you give its rows a stable identity?

- A. Use the row number in the file
- B. Generate a UUID at ingestion
- C. Use the date alone
- **D. Hash the account, date, amount and description, with a counter for genuine repeats** ✅

**Why:** A UUID changes on every sync, so the same transaction arrives as new each time. The counter is what saves two identical coffees on one day.

### 9. A payment appears as pending and later as booked with the same reference. The ingester should:

- A. Keep both rows
- B. Ignore the pending one entirely
- **C. Match on the reference and replace the pending row, keeping the fact that the amount changed** ✅
- D. Ask the user which is correct

**Why:** One payment, two observations. Ignoring pending rows means the app is days behind, and keeping both double counts the spending.

### 10. Why deliberately refetch a day or two you already have?

- A. To check the bank is still up
- **B. Because banks backdate and reorder transactions, and deduplication makes the overlap free** ✅
- C. To keep the rate limit warm
- D. Because cursors are unreliable

**Why:** Without the overlap, a transaction backdated after your cursor passed is never seen again.

### 11. What should the categoriser do first with POS APPLE.COM/BILL HANOI?

- A. Feed it to the model
- **B. Clean it to APPLE.COM** ✅
- C. Look it up in a merchant database
- D. Ask the user

**Why:** Most of the value is in the cleaning, and it is a list of rules rather than a model. Everything downstream gets easier.

### 12. A user recategorises EVN HANOI to utilities. What happens for other users?

- A. Nothing at all, ever
- B. The same change immediately
- **C. It becomes one vote, promoted to a global rule only when enough independent users agree** ✅
- D. The model retrains on it overnight

**Why:** One correction can be a mistake or a personal preference. Applying it globally lets one person recategorise the electricity company.

### 13. Which is the right order for the categorisation fallback chain?

- **A. User rule, global rule, model, uncategorised** ✅
- B. Model, user rule, global rule
- C. Global rule, model, user rule
- D. Model only, with corrections as training data

**Why:** The user always wins, and an honest "uncategorised" beats a confident wrong answer that they have to correct twice.

### 14. Consent typically lasts ninety days. What does that mean for the product?

- A. Nothing, refresh handles it
- **B. The sync will stop on a date you can predict, so warn the user before it does** ✅
- C. The user must reauthenticate every login
- D. Tokens must be rotated daily

**Why:** Write the expiry down at connection time. A banner at day eighty three is worth more than any retry logic.

### 15. Why does each bank get its own normaliser function?

- A. For parallel processing
- B. Because the banks use different HTTP libraries
- **C. So that nothing outside those functions sees a bank specific field, and a fourth bank touches nothing else** ✅
- D. To allow per bank rate limits

**Why:** One place per bank, one schema out, and a test per bank holding a real row and the exact object it should become.
