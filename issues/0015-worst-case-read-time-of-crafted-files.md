---
status: open
priority: 2
area: engine (file format)
branch:
created: 2026-10-19
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Crafted files at the limits read in about a second

## Problem

The design, `docs/SPEC.md:383` and `docs/file-format.md:349` promise that reading and computing any file within the limits takes "well under a second". For crafted files at the limits this no longer holds.

The worst crafted file found so far stays within every limit:

- 37 sources × 2,000 match entries, 10.47 MB;
- 73,830 distinct entries;
- `readFile` takes 1.0–1.15 s under Node on an i7-8650U.

Each entry looks like this:

```json
{"match":{"type":"range","from":{"type":"easter","offset":k},"to":{"type":"fixed","month":1,"day":k-280},"weekdays":["<(Sunday + k + 6) mod 7>"]},"validFrom":v}
```

- `k` runs from 286 to 338 and `v` from 1600 up, so every entry is distinct and the memo never hits.
- The range exists only in years with an early Easter, for 1–6 days, and never on the filtered weekday. So `neverApplies` has to walk most of the 400 years for each entry.

Realistic files read in a few milliseconds. Reading can no longer hang: before the fix the same kind of file took up to about 28 minutes.

## Context

- Finding C1 of the final review of branch `file-format`, fixed in 2e7e58a, and the re-review of that fix (2026-10-19).
- Base cost: reading 85,000–100,000 entries from 10 MB takes about 0.4 s even when every warning is answered in O(1). The scan over the years adds the rest.
- Times of the tested shapes, under plain Node:
  - shape (a) in `tests/engine/file/read-plan.test.ts`: 0.57 s;
  - shape (b): 0.54–0.56 s;
  - under vitest, 0.6–0.73 s against a 1,000 ms bound (see the note in issue 0011).
- Contract rules are already capped at 1,000, which bounds their part of the scan at about 15 ms. The open cost comes from match entries in sources: 50 sources × 2,000 entries.

## Acceptance criteria

- [ ] The maintainer has chosen one of the options below.
- [ ] A timing test with the shape above (as many distinct entries as the limits allow) reads in under 1,000 ms, or under the bound the chosen option gives.
- [ ] Design, SPEC and `docs/file-format.md` agree with the code.
- [ ] `npm run check` passes.

## Notes

Options:

1. **A limit on match entries per file.** Example: at most 10,000 match entries across all sources, refused as `limitExceeded` with `limit: "matchEntries"`.
   - At about 15 µs per entry in the worst shape, that bounds the scan at about 0.15 s.
   - Date entries and other-plan spans are not match entries and stay at 2,000 per source.
   - This changes the file format's limits table, so it is the maintainer's decision (ruling R16 of the branch).
2. **Another shortcut.** For example, a tighter O(1) bound on the occurrence length for starts with a fixed weekday; with today's slack of 366 days the bound comes out one day too long.
   - This kills this family, but not necessarily the next one.
   - The base cost of about 0.4–0.6 s for 85,000–100,000 entries stays, which is not "well under a second" either.
3. **Reword the promise.** For example: "Realistic files read in milliseconds; a crafted file at the limits takes up to about a second." The code stays as it is.
