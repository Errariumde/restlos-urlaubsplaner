<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Delivery format

restlos comes in two forms from the same build: a downloadable HTML file for offline use from the user's own computer, and a hosted version on GitHub Pages that can be installed as a web app on a phone and then also runs offline. The GitHub Pages version is planned for version 1. In both, the data stays on the device. There is no desktop wrapper. The facts are in [Browsers and file URLs](../reference/browsers-and-file-urls.md) and in [Architecture](../reference/architecture.md), "Single-file build".

## Why

- **A downloadable HTML file:** it runs offline from the user's computer, and the data never leaves it.
- **A GitHub Pages version:** hosting is free for public repositories, and a phone can install it as a web app that also runs offline.
- **The Firefox ESR as the baseline:** a feature the ESR lacks would break the app for its users. A `build.target` that names the ESR keeps Vite from emitting syntax the ESR doesn't understand.
- **Nothing fetched from disk:** opened from `file://`, Chromium blocks a request for the page's own file and an image next to the page, while Firefox allows both ([feasibility tests](../../../feasibility.md#content-security-policy-from-meta-and-keyboard-shortcuts), C3 and C4). Built into the page, the holiday data and the images load the same way in both.
- **No desktop wrapper:** the only real gain of one would be saving into the same file and opening a file by double-click in any browser. The installed Pages version covers that in Chrome and Edge ([File Handling API](https://developer.chrome.com/articles/file-handling), from version 102, desktop only). In Firefox, the setting "Always ask you where to save files" shows a save dialog in which the original file can be overwritten. The costs of a wrapper don't fit a stable hobby project.

## Rejected alternatives

- **A local server .exe:** builds for three operating systems, signing warnings, and a local server as attack surface.
- **Tauri:** builds for three operating systems, signing warnings, and a second supply chain with Rust crates.
- **Electron:** builds for three operating systems and signing warnings.
