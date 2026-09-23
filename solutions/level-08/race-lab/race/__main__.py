"""python -m race --mode naive --workers 8

Run each mode and look at the balance. The naive one is worth running several
times: it should be wrong every single time, and if it is not, the rig is
letting the workers start at different moments.
"""

from __future__ import annotations

import argparse
import sys

from .modes import MODES
from .rig import run
from .setup import setup, url


def main() -> int:
    parser = argparse.ArgumentParser(prog="race")
    parser.add_argument("--mode", choices=sorted(MODES), default="naive")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--spend", type=int, default=1000)
    parser.add_argument("--balance", type=int, default=10000)
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--with-constraint", action="store_true")
    args = parser.parse_args()

    conninfo = url()
    setup(conninfo, with_constraint=args.with_constraint)

    wrong = 0
    for _ in range(args.repeat):
        result = run(
            conninfo,
            args.mode,
            workers=args.workers,
            spend_each=args.spend,
            starting_balance=args.balance,
        )
        print(result.report())
        print()
        wrong += 0 if result.correct else 1

    if args.repeat > 1:
        print(f"{wrong} of {args.repeat} runs ended with a wrong balance")

    # Non-zero when the ledger was wrong, so this can sit in a pipeline.
    return 1 if wrong else 0


if __name__ == "__main__":
    sys.exit(main())
