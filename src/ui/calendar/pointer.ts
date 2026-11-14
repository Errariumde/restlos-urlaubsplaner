// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

/**
 * How far a pointer may move from where it was pressed and still count as resting there: for the long press on a day,
 * the start of the calendar's autoscroll, and a press on the day detail's leave bar, which becomes a drag only beyond
 * it. In CSS pixels, not rem: it stands for the wobble of a finger or a hand, which doesn't grow with the text.
 */
export const POINTER_SLOP_PX = 10;
