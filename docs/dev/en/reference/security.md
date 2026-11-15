<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Security

## Network access

- No network access at runtime.

## Threats and countermeasures

| Input / risk | Example | Countermeasure |
| --- | --- | --- |
| Plan file or rule set from a colleague | manipulated JSON, huge file, `__proto__` key | data in `Map` or objects without prototype |
| Display of foreign text | HTML/script in names and notes | Svelte escapes text; `{@html}` is forbidden for data (ESLint rule `svelte/no-at-html-tags`) |

## Content Security Policy

In the HTML's `<meta>` tag (GitHub Pages cannot set custom HTTP headers), as the first element after `<meta charset>`: a meta policy applies only to what comes after it.

- `default-src 'none'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
- `script-src` only with the SHA-256 hashes of the embedded scripts, computed at build time over the LF-normalized script text. No `eval`, no `new Function`. Data blocks (`type="application/json"`, `application/octet-stream`) need no hash.
- `style-src 'unsafe-inline'` (embedded styles; low risk, since no foreign HTML is rendered), `img-src data: blob:`, `font-src data:`, `worker-src blob:`.
- **Tested** (2026-11-02, Firefox ESR 153, Firefox 159, Chromium 147, on `file://` and for the Pages policy on `http://127.0.0.1`): the directives are enforced from `<meta>`, also on `file://` in Firefox, except Firefox's `file:` requests (see Known gap); whether the manifest loads under `manifest-src 'self'` was not observed, and `font-src data:` only showed no violation. Hashed scripts run; scripts without a hash, event handler attributes, `eval`, `new Function`, `<object>`, `<embed>`, `<base href>`, form submits, `data:` workers and `fetch`/XHR of `blob:` and `data:` URLs are blocked, and WebAssembly runs only with `'wasm-unsafe-eval'`. The service worker registers, and the Pages version loads again offline.
- **Known gap:** on `file://`, Firefox let the page fetch its own file and show an image file next to it without a `connect-src` or `img-src` violation, where Chromium blocks both. The app never fetches and embeds all images, so this changes nothing for it; the policy is defence in depth, not the only barrier.

## Verification

- Fuzzing of the parsers (plan file, rule set) with fast-check: random and broken inputs may only lead to error messages, never to crashes or wrong data.
- Local end-to-end test: the built HTML contains the CSP, and no network request leaves the page (Playwright intercepts requests).
- `SECURITY.md` with private reporting via GitHub's "Private vulnerability reporting"; handled on a best-effort basis, without any deadline commitment.
