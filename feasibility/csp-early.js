// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// T2 and T2b (feasibility/README.md): collects every securitypolicyviolation event from the start of parsing, so the
// violations of the unhashed script and the attribute handler are not missed. csp.js reads window.cspViolations.
/* global document, window */

window.cspViolations = [];
document.addEventListener("securitypolicyviolation", (event) => {
  window.cspViolations.push({
    effectiveDirective: event.effectiveDirective,
    violatedDirective: event.violatedDirective,
    blockedURI: event.blockedURI,
    sourceFile: event.sourceFile,
    lineNumber: event.lineNumber,
    disposition: event.disposition,
    sample: event.sample,
  });
  if (typeof window.onCspViolation === "function") window.onCspViolation();
});
