<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# File kinds

restlos has three kinds of files: the plan file, the rule set and the device settings export, planned for version 1. Each one is self-contained and never refers to another file. A plan file holds a copy of the rule set it was made from, and a color scheme travels inside a plan file or rule set. The kinds and their keys are listed in [Files](../reference/files.md) and [Plan files and rule sets](../reference/file-format.md).

## Why

- **Self-contained files:** the app can neither remember nor reopen file paths. A file that pointed to another one would make users open two files every time.
- **A copy, not a reference:** a plan file made from a rule set stays usable on its own, also when the rule set is lost or changes.
- **Embedded color schemes:** a company shares its colors together with its rule set, so a colleague gets them with the file they open anyway.

## Rejected alternatives

- **References between files**, for example a plan file that points to its rule set: every opening would need both files, and a plan file would no longer work on its own.
- **A separate color scheme file:** it would be one more file to pass on and open, for a part that fits into the plan file or rule set.
