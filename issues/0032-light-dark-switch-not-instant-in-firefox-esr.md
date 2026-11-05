---
status: open
priority:
area: UI
branch:
created: 2026-11-04
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Light/dark switch not instant in Firefox ESR

## Problem

In the maintainer's manual check (Firefox ESR 153, Linux desktop, wide HiDPI window, UI branch task 16) switching between light and dark mode takes a visible fraction of a second, and the page repaints in parts instead of all at once.

## Cause

An earlier version of this issue concluded from headless runs that the cost was not in our code. That was wrong. The maintainer's console measurements in ESR 153 (main screen, tiles view, example plan, devtools open, 2026-11-05):

| Test | Style (forced flush) | Until the next frame |
|---|---|---|
| `style.colorScheme` on `<html>`, every colour a `light-dark()` token with `oklch(… calc(var(--nk) …) var(--nh))` | ~90 ms | ~190 ms |
| Same page, a custom property change without any colour change | ~17 ms | – |
| All 39 `--r-*` tokens overridden with plain resolved `rgb()` values per mode, then the switch | ~45 ms | ~80 ms |
| `content-visibility: auto` on the month tiles | worse (~150 / ~260) | – |

So about three quarters of the style time went into resolving the colour tokens on every element, and plain per-mode values halve both the style time and the time to the next frame. Firefox's style engine lead notes that restyles after custom property changes are slow and much of the cost is painting (bug 1417970); design systems commonly switch plain values per mode instead of resolving `light-dark()` on every element.

## What changed (UI branch, 2026-11-05)

- `src/ui/styles/tokens.css` holds a finished value per role and mode: light on `:root`, dark under `:root[data-scheme="dark"]`. No `light-dark()`, no `calc(var(--nk) …)`/`var(--nh)` inside colour values; the D11 knobs are baked in (nh = 0, nk = 0) and each neutral names its chroma factor in a comment.
- The three `color-mix()` uses in `DayCell.svelte` (mandatory stripe, previewed range, removal hatch) are tokens with precomputed per-mode values (`--r-mandatory-stripe`, `--r-preview`, `--r-overdraft-hatch`).
- `src/ui/scheme.ts` sets `data-scheme` and `color-scheme` on `<html>` (App.svelte from `app.mode`, the gallery from its mode parameter); "auto" follows `matchMedia("(prefers-color-scheme: dark)")` including live changes.
- Registered tokens (`@property --r-… { syntax: "<color>" }`) were measured too and were not faster, so they were left out.

Headless Firefox ESR 153 through Playwright's BiDi driver (1280 × 800 and 2100 × 1700, example plan, tiles, 2,083 elements; per switch, mean of 100 forced style flushes, three runs each; for diagnosis only, no timing test is committed):

| Variant | Switch | Control: custom property change without a colour |
|---|---|---|
| Before (`light-dark()` + `--nk`/`--nh` + `color-mix()`) | 5.3–6.7 ms (mean 5.6) | 4.3–5.3 ms (mean 4.6) |
| Plain values per mode (kept) | 4.6–4.9 ms (mean 4.7) | 3.9–5.1 ms (mean 4.1) |
| Plain values, registered with `@property` | 4.7–6.0 ms (mean 5.2) | 4.1–4.9 ms (mean 4.4) |
| `@property` with `light-dark()` and `--nk` kept | 4.8–5.6 ms (mean 5.2) | – |

Headless runs show only a small part of what the maintainer sees (no devtools, no GPU painting; the frame time is the 33 ms headless frame cadence in every variant), but the colour-specific part above the control fell from about 1 ms to about 0.6 ms.

### Maintainer's re-measurement (ESR 153, 2026-11-05, after commit 0885584)

Same page and method, the switch toggles `data-scheme` and `color-scheme` as the app does: style 87/79/98/90/93/96 ms, next frame 158/162/194/180/189/191 ms. No change from before (~90/~190). The plain values per mode did not remove the cost, so the earlier 45/80 test was measuring something else; the cause is still unknown.

Headless ESR needs about 5 ms for the same switch, and there the switch costs barely more than the control without a colour change. On the maintainer's machine the switch costs about five times the control (90 vs 17 ms). Whatever makes the difference only shows up in a real window (devtools open, GPU, HiDPI). Next step: a Firefox Profiler recording of the switch with devtools closed.

## Acceptance criteria

- A profile of the switch in ESR on the maintainer's machine shows where the time goes.
- The maintainer confirms the switch is visibly faster, with no change to how the page looks in either mode.

## Notes

- If it is still too slow: the remaining cost is the restyle of all elements after any root custom property change (the 17 ms control) plus painting. Options then are fewer elements in the tiles view or simpler cell backgrounds; `content-visibility: auto` on the tiles made it worse.
- Don't add a transition to hide it: it would make the switch slower, and it is not wanted (reduced motion).
