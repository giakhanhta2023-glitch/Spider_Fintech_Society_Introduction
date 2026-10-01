# Level 01: Mission zero: a lab that works

> **Mission zero: a lab that works** · setup mission · difficulty 1/10

## Read this second

Attempt the build yourself first, then ask the FinQuest tutor for a hint, and only then open this folder.
Read the part you are stuck on, close the file, and retype the fix from memory. Copying the solution into
your own project skips the only step that actually teaches you anything.

## The brief

There is no build project this time, and that is deliberate. By the end of the evening you need a place to run code, the course data loading in one line, somewhere public to keep what you make, and enough vocabulary that the next four levels read as instructions rather than as noise.

## Files here

| File | What it is |
|------|------------|
| `check_setup.py` | five checks on the lab, with the fix printed next to anything missing |
| `quiz-key.md` | all 15 drill answers with explanations |

## Run it

```bash
python check_setup.py
```

## Why the solution is shaped this way

- There is no build at level 1 on purpose. An evening lost to installers is the most common reason somebody stops before writing anything that works, and a finance reader who has never opened a terminal has more ways to lose that evening than a computer science one.
- The checker reports rather than raises, and it keeps going after a failure. One run tells you everything that is wrong with the lab, which is the difference between one evening of setup and four.
- Each library is listed with what it is for in the words the track uses, so a missing one explains itself: matplotlib is "the charts in levels 3 and 5" rather than a name. The fix is printed underneath it.
- The data check reads the same URL every level reads, so it proves the thing that actually matters: not that pandas imports, but that this machine, on this network, can get the course data. A proxy that blocks raw.githubusercontent.com is a problem worth meeting now rather than in the middle of level 2.
- An --offline flag skips the download and checks everything else, because a blocked network should not stop somebody confirming their Python works.
- The exit code is 1 when anything failed, so the script is useful to a person and to anything that runs it for them.

## Where people get stuck

| Symptom | Cause |
|---------|-------|
| python is not found on Windows | The installer's "Add python.exe to PATH" box was not ticked. Re-run it, choose Modify, tick it. |
| python works but pip does not | On macOS and some Linux installs the commands are python3 and pip3. |
| The course data will not load | A corporate proxy blocking raw.githubusercontent.com. Download the file and drag it into Colab, or use a personal machine. |
| A variable that worked yesterday is undefined | A notebook keeps its text and not its memory. Run the cells again, in order. |
| The first list item is missing | Python counts from zero: it is rows[0], not rows[1]. |
| An error wall of red stops everything | Read the last line first. It names the problem; the lines above it are only the path that reached it. |

## The checklist

- [ ] Signed in to Google Colab and created a notebook called finquest-analyst-01.ipynb
- [ ] Ran a cell with print("FinQuest online") and saw the output
- [ ] Written each of the eight pieces of Python at least once, by typing rather than pasting
- [ ] Loaded the course ledger from its URL and seen (318, 9)
- [ ] Caused an error on purpose and read the last line of it
- [ ] Created a GitHub account with a username you would put on a CV
- [ ] Created a public repository called finquest-analyst with a README of two sentences
- [ ] Saved your level 1 notebook into it from Colab, with a message saying what changed
- [ ] Installed Python 3.11 or newer locally and run python --version in a terminal
- [ ] Run pip install pandas matplotlib pytest without an error
- [ ] Run check_setup.py and seen every line say ok

---

Part of [FinQuest](../../README.md) · Analyst track, Level 01 of 5
