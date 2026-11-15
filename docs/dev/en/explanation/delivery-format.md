<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Delivery format

Recommendation: two distribution channels from the same build. A **downloadable HTML file** for offline use from your own computer, and a **hosted version on GitHub Pages** (free for public repositories) that can be installed as a web app on the phone and then also runs offline. In both cases the data stays on the device.

**No desktop wrapper.** A local server .exe, Tauri and Electron were evaluated. The only real gain would be saving into the same file and opening by double-click in any browser. The installed Pages version in Chrome/Edge already covers that ([File Handling API](https://developer.chrome.com/articles/file-handling), from version 102, desktop only); for Firefox a browser setting helps (see below). The costs of a wrapper (builds for three operating systems, signing warnings, a second supply chain with Rust crates, a local server as attack surface) don't fit a stable hobby project.
