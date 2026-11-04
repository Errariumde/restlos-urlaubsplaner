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

## Context

- The switch is one write of `document.documentElement.style.colorScheme` (`src/ui/App.svelte`). Every colour is a `light-dark()` token (`src/ui/styles/tokens.css`, 37 of them). The UI has no CSS transitions.
- Only `App.svelte` (that write) and the toolbar's mode control read `app.mode`. No cell or calendar component re-renders on a switch.
- The day cells paint their day types with gradients: `repeating-linear-gradient` hatches (weekend, mandatory leave, overdraft), `radial-gradient` dots (holidays), split half-day gradients and `color-mix()` (`src/ui/calendar/DayCell.svelte`). The example plan has about 2,100 elements in the tiles view.

Measured in Playwright's headless Firefox and Chromium (1280 × 800 and 2100 × 1700, the example plan, median of 21 switches, for diagnosis only):

| Case | Firefox: style + layout | Chromium: style + layout | Two frames after the write |
|---|---|---|---|
| Start screen (16 elements) | 1 ms | 0.4 ms | 33–34 ms (frame cadence) |
| Tiles view | 7–8 ms | 7–8 ms | 33–40 ms |
| Tiles, all `background-image`s off | 8 ms | 8–9 ms | 33–42 ms |
| Tiles, all shadows off | 7–8 ms | 7 ms | 33–39 ms |
| Calendar `display: none` | 2–3 ms | 1 ms | 33 ms |
| Columns view | 10–11 ms | 21 ms | 33–50 ms |
| Clicking the toolbar's Dark/Light button | | | 30–34 ms |

"Style + layout" is the time from the write to a forced `getComputedStyle()` and `offsetHeight`. "Two frames" waits for two `requestAnimationFrame`s, so 33 ms is the headless frame rate, not work.

The page's own work for a switch is about 10 ms: style recalculation of the calendar's elements. Taking the gradients out doesn't change it, and the click on the Svelte control costs no more than the bare write. What the maintainer sees most likely comes after the main thread: rasterizing and compositing the newly coloured page (WebRender), which headless runs at device scale 1 don't show. The partial repaint fits tile-by-tile rasterization of a large HiDPI window.

## Acceptance criteria

- The cause in ESR is known from a profile, not guessed.
- If it is raster cost of our backgrounds: the switch is visibly instant in ESR on the maintainer's machine, with no change to how the cells look in either mode.
- If it is the browser or the graphics setup: this issue records it and is closed without a code change.

## Notes

Options, in order:

1. Maintainer: open `about:support` in ESR and check "Compositing" (WebRender vs. Software WebRender). Software WebRender on a large HiDPI window would explain it by itself.
2. Maintainer: record the switch with the Firefox Profiler (preset "Graphics") and look at the time in the Renderer/RenderBackend threads and at which display items rasterize slowly.
3. If the profile points at the gradients: draw the hatches and dots as small tiled images instead (SVG `data:` URLs are allowed by the CSP `img-src data:`) in one shared custom property per pattern, so the raster cache reuses one tile; or drop the hatch on cells that are off screen with `content-visibility: auto` on the month tiles. Both keep the look, and both need new screenshot baselines.
4. Related: in the same check ESR painted the month columns' week markers once in an intermediate place, probably before their per-cell container queries were resolved (task 16 removed those queries). A profile of the switch may show the same kind of split paint of a large page.
5. Don't add a transition to hide it: it would make the switch slower, and it is not wanted (reduced motion).
