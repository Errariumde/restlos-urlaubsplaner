// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import type { RegionSelection } from "../../src/engine/holidays/types";

export interface Variant {
  key: string;
  selection: RegionSelection;
}

export const FIRST_YEAR = 2000;
export const LAST_YEAR = 2100;

const STATES = ["BB", "BE", "BW", "BY", "HB", "HE", "HH", "MV", "NI", "NW", "RP", "SH", "SL", "SN", "ST", "TH"];

const withOptions = (state: string, options: readonly string[]): Variant => {
  const sorted = [...options].sort();
  return {
    key: [state, ...sorted].join("+"),
    selection: { country: "DE", state, options: Object.fromEntries(sorted.map((o) => [o, true])) },
  };
};

export const VARIANTS: readonly Variant[] = [
  ...STATES.map((state): Variant => ({ key: state, selection: { country: "DE", state } })),
  withOptions("BY", ["assumption"]),
  withOptions("BY", ["augsburg"]),
  withOptions("BY", ["assumption", "augsburg"]),
  withOptions("SN", ["corpusChristi"]),
  withOptions("TH", ["corpusChristi"]),
];
