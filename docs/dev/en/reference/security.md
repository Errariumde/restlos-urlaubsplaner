<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Security

Every file from outside is untrusted, and the app has no network access. The rules for code are the "Security" [hard rule](../../../../AGENTS.md#hard-rules). The reasons are in [Security choices](../explanation/security-choices.md).

## Network access

The "Security" [hard rule](../../../../AGENTS.md#hard-rules) forbids network access at runtime. The page's [Content Security Policy](#content-security-policy) names no network source: `default-src 'none'` and `connect-src 'none'`, and the other directives allow only script hashes, `'unsafe-inline'` styles, `data:` and `blob:`. The end-to-end tests check that no request leaves the page ([Verification](#verification)).

## Threats and countermeasures

| Input / risk | Example | Countermeasure |
| --- | --- | --- |
| Plan file or rule set from a colleague | manipulated JSON, huge file, `__proto__` key | the reader's [limits](file-format.md#limits), its [checks](file-format.md#reading) and the rule for [keys](file-format.md#values) |
| Display of foreign text | HTML or script in names and notes | Svelte escapes text. The ESLint rule `svelte/no-at-html-tags`, turned on by `svelte.configs.recommended` in `eslint.config.js`, reports every `{@html}`. |
| Compromised dependency | malicious code in the bundle | the [measures against supply chain attacks](dependencies.md#measures-against-supply-chain-attacks) and the page's [Content Security Policy](#content-security-policy) |

## Content Security Policy

`insertCsp` in `scripts/build/html.ts` writes the policy into a `<meta http-equiv="Content-Security-Policy">` tag right after `<meta charset="utf-8">`. The build fails if the page has no such `<meta charset>`. The `restlos:csp` plugin in `scripts/build/vite-restlos.ts` adds the policy after the scripts and styles are inlined, to the app and to the component gallery alike. The build fails if the page still loads a script or style file.

`standardPolicy` in `scripts/build/html.ts` writes these directives, in this order:

1. `default-src 'none'`
2. `connect-src 'none'`
3. `object-src 'none'`
4. `base-uri 'none'`
5. `form-action 'none'`
6. `script-src` with the SHA-256 hash of each executable inline script, in document order (`scriptHashes`). The hash covers the script text with every CR LF and lone CR turned into LF. A `<script>` whose `type` is not JavaScript, such as the `application/json` data block, is not executed and gets no hash.
7. `style-src 'unsafe-inline'`
8. `img-src data: blob:`
9. `font-src data:`
10. `worker-src blob:`

What browsers enforce of this policy from `<meta>` and on `file://` is in the [feasibility tests](../../../feasibility.md#content-security-policy-from-meta-and-keyboard-shortcuts).

## Verification

- **Fuzzing of the reader:** `tests/engine/file/read-envelope.test.ts` runs `readFile` with fast-check on random JSON and on file-shaped JSON with random parts. No input may reach the catch-all of `readFile`, which answers an unexpected exception with `invalidCore` and an empty report. A refusal `invalidCore` must hold an Error that drops the whole file, and no Warning or Info.
- **Round trip:** the round trip in the "Files" row of [Test levels](test-strategy.md#test-levels) is the check against a file that the app reads back as other data than it wrote.
- **Policy in the build:** `tests/scripts/build-html.test.ts` checks that `insertCsp` puts the policy right after `<meta charset>` and that `standardPolicy` writes the directives in the order above.
- **End-to-end tests:** `npm run test:e2e` runs them. Every page opened with `openApp` or `openGallery` in `e2e/helpers.ts` fails its test on a request that is not `file:` or `blob:`, and `expectNoPageProblems` fails the test that calls it on a policy violation or an uncaught error. `e2e/shell.spec.ts` checks that the policy is the first element after `<meta charset>` and that the built page contains no `fetch(`.
- **Reports:** [`SECURITY.md`](../../../../SECURITY.md) names the private reporting channel and how reports are handled.
