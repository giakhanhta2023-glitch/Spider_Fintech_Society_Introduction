"""
FinQuest analyst level 1: does the lab work?
============================================
Paste this into a Colab cell, or save it and run `python check_setup.py`.

It checks the five things the rest of the track needs and says what to do about
each one it cannot find. Nothing here is clever: the value is that a single
run tells you whether an evening of setup actually worked, instead of finding
out halfway through a query at eleven at night.

    python check_setup.py            everything, including the data download
    python check_setup.py --offline  skip the download, check the rest
"""

import sys

DATA_URL = ("https://raw.githubusercontent.com/giakhanhta2023-glitch/"
            "Spider_Fintech_Society_Introduction/main/data/fpa-actuals.csv")

# What each library is for, in the words this track uses, so a missing one
# explains itself rather than just failing.
LIBRARIES = [
    ("pandas", "tables, from level 2 onwards", "pip install pandas"),
    ("sqlite3", "the database in level 2 (ships with Python)", "reinstall Python from python.org"),
    ("matplotlib", "the charts in levels 3 and 5", "pip install matplotlib"),
    ("pytest", "the tests in levels 4 and 5", "pip install pytest"),
]

ok = True


def report(passed, text, fix=""):
    global ok
    ok = ok and passed
    print(f"   {'ok  ' if passed else 'NO  '} {text}")
    if not passed and fix:
        print(f"        -> {fix}")


def main() -> int:
    offline = "--offline" in sys.argv
    print("FinQuest analyst track, lab check\n")

    # 1. Python itself. 3.9 is where the syntax this track uses settles down.
    version = sys.version_info
    report(version >= (3, 9),
           f"python {version.major}.{version.minor}.{version.micro}",
           "install Python 3.11 or newer from python.org, ticking 'Add to PATH' on Windows")

    # 2. The four libraries, each with what it is for.
    for name, purpose, fix in LIBRARIES:
        try:
            __import__(name)
            report(True, f"{name:<11} {purpose}")
        except ImportError:
            report(False, f"{name:<11} {purpose}", fix)

    # 3. The course data, read the way every level reads it.
    if offline:
        print("   --   skipping the data download")
    else:
        try:
            import pandas as pd
            ledger = pd.read_csv(DATA_URL)
            shape_is_right = ledger.shape == (318, 9)
            report(shape_is_right, f"the course ledger loads: {ledger.shape}",
                   "expected (318, 9). If the shape differs the file has moved on; pull the repo again")
        except ImportError:
            report(False, "cannot read the data without pandas", "pip install pandas")
        except Exception as problem:                    # network, proxy, DNS
            report(False, f"the course data did not load: {type(problem).__name__}",
                   "download data/fpa-actuals.csv from the repository and drag it into Colab, "
                   "or run with --offline")

    print()
    if ok:
        print("   Everything the track needs is here. Go to level 2.")
    else:
        print("   Fix the lines marked NO above, then run this again.")
        print("   Nothing below them is broken: the check stops at nothing.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
