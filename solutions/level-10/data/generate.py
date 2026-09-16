"""
Regenerate every dataset this project uses. All of it is synthetic: no real
customer, account, or market data appears anywhere in this repository.

Run:  python data/generate.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
COURSE_GENERATOR = HERE.parent.parent.parent / "data" / "generate_datasets.py"
FILES = ["level-03-transactions.csv", "level-05-fx-snapshot.json",
         "level-07-prices.csv", "level-08-transactions.csv"]


def main():
    if not COURSE_GENERATOR.exists():
        sys.exit(f"cannot find the course generator at {COURSE_GENERATOR}")

    subprocess.run([sys.executable, str(COURSE_GENERATOR)], check=True)

    source = COURSE_GENERATOR.parent
    for name in FILES:
        shutil.copy2(source / name, HERE / name)
        print(f"copied {name}")
    print(f"\n{len(FILES)} synthetic datasets ready in {HERE}")
    print("external-balances.csv is hand-written to match the demo ledger and is not regenerated.")


if __name__ == "__main__":
    main()
