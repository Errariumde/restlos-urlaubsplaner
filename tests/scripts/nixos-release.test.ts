// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { releaseStatus, type ReleaseStatus } from "../../scripts/nixos-release-status";

const may26 = { release: "26.05", endOfSupport: "2026-12-31", successor: "26.11" };
const november26 = { release: "26.11", endOfSupport: "2027-06-30", successor: "27.05" };

describe("releaseStatus", () => {
  it.each([
    ["2026-10-24", { kind: "supported", release: "26.05", endOfSupport: "2026-12-31" }],
    ["2026-11-30", { kind: "supported", release: "26.05", endOfSupport: "2026-12-31" }],
    ["2026-12-01", { kind: "successorDue", ...may26 }],
    ["2026-12-15", { kind: "successorDue", ...may26 }],
    ["2026-12-16", { kind: "overdue", ...may26 }],
    ["2027-01-01", { kind: "overdue", ...may26 }],
  ] satisfies [string, ReleaseStatus][])("nixos-26.05 on %s", (today, status) => {
    expect(releaseStatus("nixos-26.05", today)).toEqual(status);
  });

  it.each([
    ["2027-05-31", { kind: "supported", release: "26.11", endOfSupport: "2027-06-30" }],
    ["2027-06-15", { kind: "successorDue", ...november26 }],
    ["2027-06-16", { kind: "overdue", ...november26 }],
  ] satisfies [string, ReleaseStatus][])("nixos-26.11 on %s, whose support ends in the next year", (today, status) => {
    expect(releaseStatus("nixos-26.11", today)).toEqual(status);
  });

  it.each(["nixos-unstable", "nixpkgs-unstable", "nixos-26.04", "26.05", "nixos-26.05-small", ""])("fails %j, which is not a NixOS release branch", (ref) => {
    expect(releaseStatus(ref, "2026-10-24")).toEqual({ kind: "notARelease", ref });
  });
});
