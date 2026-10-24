// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// Whether the NixOS release that flake.lock follows is still the one to use (npm run nixos-release,
// scripts/nixos-release.js). NixOS supports each release for seven months: a YY.05 release until 31 December,
// a YY.11 release until 30 June of the next year (the 26.05 announcement: fixes "up until 2026-12-31",
// https://nixos.org/blog/announcements/2026/nixos-2605/). Its successor comes out about a month before that.
// From the 1st of the last month the successor is due; from the 16th the project is overdue to move, so it moves
// while the old release is still supported (docs/superpowers/specs/2026-10-24-ci-design.md, decision 7).

export type ReleaseStatus =
  | { kind: "supported"; release: string; endOfSupport: string }
  | { kind: "successorDue"; release: string; endOfSupport: string; successor: string }
  | { kind: "overdue"; release: string; endOfSupport: string; successor: string }
  | { kind: "notARelease"; ref: string };

const pad = (n: number): string => String(n).padStart(2, "0");

/** `ref` is flake.lock's nodes.nixpkgs.original.ref; `today` an ISO date (UTC). ISO dates compare as strings. */
export function releaseStatus(ref: string, today: string): ReleaseStatus {
  const match = /^nixos-(\d\d)\.(05|11)$/.exec(ref);
  if (match === null) return { kind: "notARelease", ref };
  const [, yy, month] = match as unknown as [string, string, "05" | "11"];
  const year = Number(yy);
  const release = `${yy}.${month}`;
  // The last month of support: December of the same year for YY.05, June of the next year for YY.11.
  const lastMonth = month === "05" ? `20${yy}-12` : `20${pad(year + 1)}-06`;
  const endOfSupport = month === "05" ? `${lastMonth}-31` : `${lastMonth}-30`;
  const successor = month === "05" ? `${yy}.11` : `${pad(year + 1)}.05`;
  if (today >= `${lastMonth}-16`) return { kind: "overdue", release, endOfSupport, successor };
  if (today >= `${lastMonth}-01`) return { kind: "successorDue", release, endOfSupport, successor };
  return { kind: "supported", release, endOfSupport };
}
