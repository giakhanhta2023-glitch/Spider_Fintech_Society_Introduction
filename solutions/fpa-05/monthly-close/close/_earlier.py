"""The earlier levels, imported rather than copied.

Level 3 wrote the pack and level 4 wrote the model. Copying either into this
folder would mean two versions of the same logic drifting apart from the first
bug fix onwards, which is precisely the failure the whole track is about.

So this file puts the two sibling solution folders on the import path and
re-exports what the pipeline needs. In a real repository these would be one
package, or two dependencies installed from a private index, and the pipeline
would import them by name with no ceremony. This is the smallest honest version
of that, and it says so out loud rather than making the imports look native.
"""

from __future__ import annotations

import sys
from pathlib import Path

SOLUTIONS = Path(__file__).resolve().parents[3]
EARLIER = [
    SOLUTIONS / "fpa-03" / "close-pack",
    SOLUTIONS / "fpa-04" / "three-statement",
]

for folder in EARLIER:
    if not folder.exists():                      # a checkout with only this level
        raise ModuleNotFoundError(
            f"{folder} is missing. The monthly close is the assembly of levels 3 and 4, "
            f"and it cannot run without them.")
    if str(folder) not in sys.path:
        sys.path.insert(0, str(folder))

from closepack import load as closepack_load          # noqa: E402
from closepack import pack as closepack_pack          # noqa: E402
from model import drivers as model_drivers            # noqa: E402
from model import forecast as model_forecast          # noqa: E402

__all__ = ["closepack_load", "closepack_pack", "model_drivers", "model_forecast"]
