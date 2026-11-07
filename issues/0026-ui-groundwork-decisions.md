---
status: open
priority:
area: UI
branch:
created: 2026-11-03
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# UI groundwork decisions

## Problem

The UI groundwork research of 2026-11-03 asked 15 questions about how the UI looks, behaves and is built (D1–D15). The maintainer decided all of them. The decisions have to reach `docs/SPEC.md` and the UI branch.

## Context

- The research report was published as a private claude.ai artifact ("restlos UI Groundwork", version 9 of 2026-11-04), with mockups and pros and cons for each option.
- Related: issue 0024 (UX proposals), issue 0025 (browser behaviour left untested).

## Acceptance criteria

- The decisions below are written into `docs/SPEC.md` in the UI branch, in particular:
  - D7: "Detail view (tooltip on desktop, sheet on the phone)" in Calendar interaction becomes a popover on desktop.
  - D9: axe-core is added to the Dependencies table, as a dev dependency pinned to an exact version, and the end-to-end row of the test strategy mentions it.
  - D11 and D15: the colour section names the neutral grey surfaces and the navy primary action, and that blue is reserved for leave.
  - D12: "Dots: up to three calendar sources" in "Day cell: what is shown how" becomes lanes.
  - D14: Multilingual support adds RTL readiness (logical properties, `dir` from the catalog) and the two pseudo-locales.
  - D8: Calendar interaction adds drag to paint a range, clicking a week number, and two taps inside the touch selection mode.
  - D13: Allowance display describes the overdraft bar (scaled to what is planned, tick at the allowance, warning line).
- The other decisions are followed in the UI branch.

## Notes

Decided by the maintainer on 2026-11-03 and 2026-11-04:

- **D1 Styles: our own CSS, with borrowed ideas.** Svelte's scoped component CSS on top of one token file, ordered with `@layer reset, tokens, base, layout, components`. Borrowed from frameworks without depending on them: Pico's styling of native elements and ARIA states, Open Props' numbered scales, Radix Colors' one-job-per-step colour roles, Bootstrap's per-component custom properties (`--btn-*`), and Every Layout's layout primitives. A small check script (no package) fails on literal colours outside the token file, on physical properties and on `text-transform: uppercase`. Reason: no dependency to maintain, about 15 components. Frameworks that style every button globally would fight the 365 day-cell buttons. Compared: Tailwind, Bootstrap, Pico, Simple.css/Water.css/MVP.css, Pure.css, Open Props, Radix Colors.
- **D2 Colour schemes: one custom property per colour role with `light-dark()` values; the mode is `color-scheme` on the root** (light, dark, or `light dark` for automatic). User schemes are written with `style.setProperty()`. Print keeps its own light palette.
- **D3 Menus, popovers, dialogs: native `popover` and `<dialog>`, positioned with CSS anchor positioning, opened by small JS handlers** (`showPopover()`, `showModal()`). Invoker commands and `popover="hint"` are not relied on (no Safari support, unclear versions). The phone's bottom sheet is a modal `<dialog>`.
- **D4 Calendar semantics: ARIA grid with a roving tabindex.** Each view is one widget with one Tab stop. The arrow keys move inside it, and so do Home/End and PageUp/PageDown. Each cell has the label from the spec, the selection is `aria-selected`, and the leave state goes into the label. Reason: 365 Tab stops would make the page unusable by keyboard, and `role="application"` turns off screen-reader navigation. Test once with NVDA + Firefox and with Orca.
- **D5 Look of controls: tactile.** Buttons get a 1 px border at 3:1, a fill one step lighter than the surface, a 1 px darker bottom edge and a 6 px radius; pressing removes the edge. One filled primary button per area. Reason: it stays clear in dark mode and forced-colours mode, works on touch (no hover needed), and hasn't dated in decades. Flat, outline, elevated, bevel, neumorphic and pill styles were compared.
- **D6 File commands: Open and Save as visible buttons, everything else in a "File" menu button.** No menubar. Reason: the spec keeps Save and Open visible, because Firefox users can block shortcuts, and a `role="menubar"` would collide with the browser's own Alt menu. On the phone the File menu merges into the menu button; Save stays visible.
- **D7 Detail view on desktop: a popover on demand, plus a simple hover title.** It opens on right-click, the context-menu key, Enter or a long press. The hover title only repeats the cell's label and is not interactive. Reason: a hover tooltip that holds actions fails WCAG 1.4.13 and can't be reached reliably by keyboard. This changes the spec's "tooltip on desktop".
- **D8 Range selection: drag to paint is the main way with a mouse, with clicks on the week number and Shift-click as extras.** Pressing on a day and dragging previews the range; the hint line shows the working days, the cost, the resulting stretch and the remaining allowance, and releasing applies it. Starting on a day with leave removes leave instead. A range only sets days with required work and skips mandatory leave; one undo step undoes it. A click on a week number sets Monday to Friday of that week (or removes it if all are set). On touch: selection mode, in which both a drag and two taps (first and last day) work, confirmed by an action bar. Reason: one click per day is too slow for three weeks of leave, and dragging needs single-pointer alternatives (WCAG 2.5.7). Compared: two clicks with preview, an "Add leave" form.
- **D9 UI review and tests: a component gallery page, Playwright screenshots, keyboard end-to-end tests and axe-core.** The gallery (dev only, not in the build) shows every component in every state: light and dark, three schemes, DE, EN and the pseudo-locales. axe-core (MPL-2.0, dev only) runs on the gallery and the main screens. With this decision the maintainer approved adding axe-core.
- **D13 Large overdraft: the allowance bar is scaled to what is planned, with a tick at the allowance; the part over the allowance is hatched red, and a warning line says by how much, with "Change allowance".** Nothing is blocked. Compared: a bar capped at the allowance with an overflow chip, and two bars.
- **D10 Settings switches: native checkboxes**; toggles in menus are `menuitemcheckbox` items with a check mark.
- **D11 Neutral surfaces: neutral grey** (no hue). The tokens keep the hue and chroma factor (`--nh`, `--nk`), so a tint stays a one-number change. Compared: warm stone, soft stone, faint stone, warm paper, cool slate.
- **D12 Calendar source markers: lanes.** Thin bars at the bottom of the cell, each on its own thin surface-coloured band that is drawn only where a line is (in month columns, vertically at the right edge); the day number moves to the top so they never overlap. Consecutive days join into one bar. Lanes are packed per month: each run of days gets the lowest lane that no overlapping run uses. Each source has a colour and a line style (solid, dashed, dotted), which the sources list shows. The cell's label and the detail popover name the sources. Up to three lanes; beyond that, a "+" pattern and the popover list. Compared: dots, edge stripe, corner flag, background tint, underlined day number.
- **D14 Other languages: ship DE and EN, but build RTL-ready from the first component.** That means logical CSS properties only (enforced by the check script), `dir` from the catalog, grid arrow keys that follow the visual direction, and a list of icons that mirror. Two pseudo-locales in the gallery, one long and accented, one RTL. Also: `Intl` for all numbers and dates, the locale's decimal separator accepted in number fields, no `text-transform: uppercase` on translated text, `Intl.Collator` for sorted lists, and a test country with a Saturday week start in the engine tests.
- **D15 Primary action colour: navy**, oklch(37% 0.11 258) in light mode and oklch(50% 0.1 258) with white text in dark mode. Both are darker and greyer than the leave blue, so a filled button never looks like a leave day, and blue keeps meaning leave. Compared: leave blue, petrol, warm ink, warm charcoal, warm graphite.
