# SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
# SPDX-License-Identifier: EUPL-1.2

"""Generate the python-holidays reference for German public holidays.

Usage: python3 scripts/python-holidays-reference.py <output.json>
"""

import json
import sys

import holidays

PINNED_VERSION = "0.97"
FIRST_YEAR = 2000
LAST_YEAR = 2100

STATES = ["BB", "BE", "BW", "BY", "HB", "HE", "HH", "MV", "NI", "NW", "RP", "SH", "SL", "SN", "ST", "TH"]

# key -> (subdiv, categories, excluded names); keys identical to tests/reference/variants.ts
VARIANTS = {state: (state, ["public"], []) for state in STATES}
VARIANTS.update(
    {
        "BY+assumption": ("BY", ["public", "catholic"], []),
        "SN+corpusChristi": ("SN", ["public", "catholic"], []),
        "TH+corpusChristi": ("TH", ["public", "catholic"], []),
        "BY+assumption+augsburg": ("Augsburg", ["public"], []),
        "BY+augsburg": ("Augsburg", ["public"], ["Mariä Himmelfahrt"]),
    }
)


def collect(subdiv, categories, exclude):
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    calendar = holidays.country_holidays("DE", subdiv=subdiv, years=years, categories=tuple(categories))
    result = {}
    for day, joined in calendar.items():
        for name in joined.split("; "):
            if name not in exclude:
                result.setdefault(name, []).append(day.isoformat())
    return {name: sorted(days) for name, days in sorted(result.items())}


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: python3 scripts/python-holidays-reference.py <output.json>")
    if holidays.__version__ != PINNED_VERSION:
        sys.exit(f"python-holidays {PINNED_VERSION} is required (found {holidays.__version__}); run inside `nix develop`")
    variants = {
        key: {
            "subdiv": subdiv,
            "categories": categories,
            "exclude": exclude,
            "holidays": collect(subdiv, categories, exclude),
        }
        for key, (subdiv, categories, exclude) in VARIANTS.items()
    }
    document = {
        "generator": "scripts/python-holidays-reference.py",
        "package": "holidays",
        "version": holidays.__version__,
        "years": [FIRST_YEAR, LAST_YEAR],
        "variants": variants,
    }
    with open(sys.argv[1], "w", encoding="utf-8") as out:
        out.write(json.dumps(document, indent=1, sort_keys=True, ensure_ascii=False) + "\n")


main()
