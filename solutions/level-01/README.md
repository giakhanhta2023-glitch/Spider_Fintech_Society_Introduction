# Level 1: Fintech Orientation & Your Zero-Install Toolkit

> **Mission Zero: Get Your Lab Running** · setup mission · difficulty 1/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

Level 1 has no build project on purpose. Your objective is a working environment and a vocabulary you can use in a conversation. Tick every item below and Level 2 opens.

## Files here

| File | What it is |
|------|------------|
| `check_setup.py` | paste into Colab to verify your lab in one cell |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
Open Colab, paste `check_setup.py` into a cell, press Shift + Enter.
```

## Why the solution is shaped this way

- There is no project at Level 1 on purpose. A first evening spent on installers is the most common reason people quit before they write anything that works.
- The checklist is the deliverable. `check_setup.py` only confirms it: it prints the Python version, imports the three libraries the course uses, formats a money value, and proves `0.1 + 0.2 != 0.3` so the float rule lands before Level 2 needs it.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| Nothing prints from a cell | Only the last expression is auto-displayed. Assigning a value shows nothing. Add `print(...)`. |
| Colab will not save | You are not signed in to a Google account, or the notebook is a read-only copy. Use **File → Save a copy in Drive**. |
| `Save a copy in GitHub` is greyed out | Authorise Colab against GitHub once, from the same menu. It needs permission before the repo list appears. |

## The checklist

- [ ] Signed in to Google Colab and created a notebook called finquest-level-01.ipynb
- [ ] Ran a cell with print("FinQuest online") and saw the output
- [ ] Wrote a function that takes two arguments and returns a number
- [ ] Printed a dollar amount with an f-string, formatted to two decimal places
- [ ] Caused an error on purpose and read the last line of the message
- [ ] Created a GitHub account with a portfolio-worthy username
- [ ] Created a public repository called finquest-portfolio with a README
- [ ] Saved your Level 1 notebook into that repository from Colab
- [ ] Opened the FinQuest solutions folder on GitHub and found the level folders

---

Part of [FinQuest](../../README.md) · Level 1 of 10
