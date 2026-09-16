"""
FinQuest level 1: lab check.

Paste this whole file into one Google Colab cell and press Shift + Enter.
It confirms the environment the rest of the course assumes, and demonstrates
the one rule you need before Level 2: money is not a float.
"""

import sys

print("=" * 52)
print(f"{'FinQuest lab check':^52}")
print("=" * 52)

ok = True

# 1. Python version -----------------------------------------------------
version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
good_version = sys.version_info >= (3, 9)
ok &= good_version
print(f"{'Python ' + version:<38}{'OK' if good_version else 'TOO OLD':>14}")

# 2. The libraries the course uses ---------------------------------------
for name in ["pandas", "numpy", "matplotlib", "sklearn", "requests"]:
    try:
        module = __import__(name)
        print(f"{'  ' + name:<38}{getattr(module, '__version__', 'present'):>14}")
    except ImportError:
        ok = False
        print(f"{'  ' + name:<38}{'MISSING':>14}")

# 3. Can you format money? ----------------------------------------------
principal = 1500
formatted = f"${principal:,.2f}"
print(f"{'f-string money formatting':<38}{formatted:>14}")

# 4. Can you write a function? ------------------------------------------
def interest(amount, rate):
    """One year of simple interest."""
    return amount * rate

print(f"{'interest(1000, 0.05)':<38}{interest(1000, 0.05):>14}")

# 5. The float rule ------------------------------------------------------
print("-" * 52)
print(f"0.1 + 0.2 = {0.1 + 0.2!r}")
print(f"0.1 + 0.2 == 0.3  ->  {0.1 + 0.2 == 0.3}")
print("Which is why balances are stored as integer cents, never floats.")
print("Level 4 builds a ledger that way.")

print("=" * 52)
print("Lab ready. Go and tick the checklist." if ok else
      "SOMETHING IS MISSING: ask the tutor, or use Colab where it is preinstalled.")
print("=" * 52)
