# Level 9: Shipping a fintech service: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **C** |
| 2 | **B** |
| 3 | **D** |
| 4 | **D** |
| 5 | **A** |
| 6 | **B** |
| 7 | **C** |
| 8 | **A** |
| 9 | **C** |
| 10 | **C** |
| 11 | **A** |
| 12 | **B** |
| 13 | **D** |
| 14 | **A** |
| 15 | **B** |

---

### 1. Why keep calculations in finance.py rather than inside app.py?

- A. Streamlit cannot do arithmetic
- B. GitHub requires multiple files
- **C. Pure functions can be tested, reused, and audited without running the interface** ✅
- D. It makes the app load faster

**Why:** A calculation containing st.write() is welded to the UI forever. Separated, the engine can be unit-tested in milliseconds and reused by an API later.

### 2. What happens when a user moves a slider in a Streamlit app?

- A. The page reloads and state is lost
- **B. The entire script runs again from the top** ✅
- C. A callback function fires and nothing else runs
- D. Only the affected widget updates

**Why:** Streamlit re-executes the whole file on every interaction. It keeps the code simple, and it is exactly why slow operations must be cached.

### 3. What is `@st.cache_data` for?

- A. Encrypting sensitive data
- B. Saving user input between sessions
- C. Speeding up chart rendering
- **D. Avoiding repeating slow work like file downloads on every re-run** ✅

**Why:** Since the script re-runs constantly, uncached downloads or API calls would repeat on every slider move. Cache reads, never cache writes.

### 4. Where should a deployed app get its API key?

- A. From a text file committed beside the code
- B. From a query parameter in the URL
- C. Hardcoded in app.py
- **D. From the platform's secrets store, read via st.secrets** ✅

**Why:** The secrets store injects values at runtime and keeps them out of the repository. A key in a URL ends up in logs and browser history.

### 5. What does requirements.txt do?

- **A. Tells the deployment platform exactly which libraries and versions to install** ✅
- B. Documents the API endpoints
- C. Configures the server's memory
- D. Lists the features the app must have

**Why:** Without it the server has none of your libraries and the app fails on import. Most first deployment failures are a missing or wrong line in this file.

### 6. Why use a virtual environment?

- A. Because Streamlit requires one
- **B. To keep each project's libraries separate so upgrades cannot break other projects** ✅
- C. To make Python run faster
- D. To encrypt your source code

**Why:** A library folder for each project means one project upgrading pandas cannot silently break another. Add .venv/ to .gitignore. It is rebuildable.

### 7. A user enters a loan of 0. What should happen?

- A. The app silently uses a default of 1000
- B. A Python traceback appears on the page
- **C. A clear error message is shown and the script stops before computing** ✅
- D. The page reloads

**Why:** Validate, message, st.stop(). A traceback exposes internals and tells the user nothing they can act on; a silent default produces answers to a question they did not ask.

### 8. Why validate inside your functions as well as with widget min/max values?

- **A. Because the same function may later be called by an API or a test where no widget exists** ✅
- B. Because Streamlit ignores min_value
- C. Widgets are unreliable
- D. To slow down malicious users

**Why:** Widget limits are a convenience of one particular interface. The engine must defend itself wherever it is called from.

### 9. What does `st.stop()` do?

- A. Shuts down the server
- B. Logs the user out
- **C. Halts the current script run so nothing below it executes** ✅
- D. Clears the cache

**Why:** It ends this run cleanly, leaving your error message on screen with no half-rendered charts underneath it.

### 10. Which test is most valuable for a payment calculation?

- A. That the chart colours are correct
- B. That the page loads under two seconds
- **C. That a known input produces a known output, and that bad input raises** ✅
- D. That the app opens without errors

**Why:** Fixed known values catch silent maths regressions, and testing the refusals proves your validation actually fires. Both run in milliseconds without a browser.

### 11. What does `pytest.raises(ValueError)` assert?

- **A. That the code inside the block does raise a ValueError** ✅
- B. That the code never raises an error
- C. That errors are logged
- D. That ValueError is imported

**Why:** It is how you test refusals. If the block completes without raising, the test fails, which is exactly what you want when checking validation.

### 12. Your app works locally but fails on Streamlit Cloud. What do you check first?

- A. Your internet connection
- **B. requirements.txt and the build log, which names the failing package** ✅
- C. The GitHub repository description
- D. The colour scheme

**Why:** The server starts empty. A library you installed locally but never listed is the most common cause, and the build log states exactly which one.

### 13. Which best describes the client-server split for a Streamlit app?

- A. The server only serves static files
- B. Both run the same code simultaneously
- C. Your Python runs in the user's browser
- **D. Your Python runs on the server; the browser only sends input and displays results** ✅

**Why:** That is why secrets can live server-side, and why the server must survive whatever a stranger types into the form.

### 14. What belongs in .gitignore for this project?

- **A. .venv/ and __pycache__/** ✅
- B. README.md
- C. app.py and finance.py
- D. requirements.txt

**Why:** Ignore anything rebuildable or machine-specific. The virtual environment is hundreds of megabytes and reinstalls from requirements.txt in seconds.

### 15. What is the most valuable thing to put at the top of your README?

- A. The install instructions for Python
- **B. The live URL and a screenshot** ✅
- C. Your full source code
- D. A list of every function

**Why:** A reviewer with thirty seconds clicks a link and looks at a picture. Everything else in the README is for the people who stay.
