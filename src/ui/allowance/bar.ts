// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { Units } from "../../engine/weight.ts";

export interface BarGeometry {
  /** What the full width of the bar stands for. */
  scale: Units;
  /** The part of the bar filled with planned leave inside the allowance. */
  plannedShare: number;
  /** Where the allowance ends. */
  tickShare: number;
  /** The hatched part: planned leave beyond the allowance. */
  overShare: number;
}

/** The bar is scaled to what is planned when that exceeds the allowance, so an overdraft stays visible. */
export function barGeometry(allowance: Units, planned: Units): BarGeometry {
  const scale = Math.max(allowance, planned, 1);
  return {
    scale,
    plannedShare: Math.min(planned, allowance) / scale,
    tickShare: allowance / scale,
    overShare: Math.max(0, planned - allowance) / scale,
  };
}
