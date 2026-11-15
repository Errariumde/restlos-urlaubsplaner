<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Dependencies and supply chain

Recommendation: use common, widespread tools, but choose them deliberately and secure them with standard measures: exact versions, lockfile, no install scripts, a waiting period for new versions, an isolated build. The risk is real: from April to July 2026 alone there were several major npm compromises, partly via `preinstall` hooks, partly with malicious code that runs on import, partly with a valid provenance signature ([Unit 42](https://unit42.paloaltonetworks.com/?p=179395)).
