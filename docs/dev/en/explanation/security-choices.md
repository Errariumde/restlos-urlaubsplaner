<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Security choices

Every file from outside is untrusted, and the app has no network access. Templates are to run isolated as well; that part is planned for version 2. The worst a manipulated file can then cause is an error message. The facts are in [Security](../reference/security.md).

## Why

- **No network access:** the data stays on the device. Malicious code in a dependency finds no way to send it anywhere.
- **The policy in a `<meta>` tag:** GitHub Pages, which is to host the Pages version, cannot set custom HTTP headers.
- **Right after `<meta charset>`:** a meta policy applies only to what comes after it.
- **`style-src 'unsafe-inline'`:** the styles are embedded in the page. The risk is low, since no foreign HTML is rendered.
- **Defence in depth:** on `file://`, Firefox lets the page fetch its own file and show an image file next to it, without a `connect-src` or `img-src` violation, where Chromium blocks both ([feasibility tests](../../../feasibility.md#content-security-policy-from-meta-and-keyboard-shortcuts), C3 and C4). The app never fetches and embeds all images, so this gap changes nothing for it. The policy is defence in depth, not the only barrier.
- **Private vulnerability reporting:** it is the reporting path that [`SECURITY.md`](../../../../SECURITY.md) names, so a vulnerability is not reported in a public issue.
- **Dependabot alerts and malware alerts:** known vulnerabilities and malicious packages in the dependencies are reported.
- **Secret scanning with push protection:** the project has no secrets, and the scan catches tokens committed by mistake.
- **CodeQL default setup:** it finds, for example, script injection in workflows, and it is free for public repositories. Running on every push, every pull request and weekly, it is a deliberate exception to running CI [as rarely as possible](build-and-ci-choices.md).

## Rejected alternatives

- **The policy as an HTTP header:** GitHub Pages cannot set one.
- **The policy as the only barrier:** Firefox doesn't block every request on `file://`, so the app itself never fetches.
