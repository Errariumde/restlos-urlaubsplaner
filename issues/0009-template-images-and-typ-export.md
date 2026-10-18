---
status: open
priority: 3
area: templates, export
branch:
created: 2026-10-18
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Template images and the `.typ` export

## Problem

PDF templates may contain images such as a company logo (decided for the file-format branch: `templates[].images` with `name`, `type` and Base64 `data`, PNG, JPEG or SVG, at most 1 MB each and 2 MB per template). The standard HTML exports a `.typ` file that the user compiles with Typst; with images, that export has to deliver more than one file, and a single download can't.

## Context

- `docs/superpowers/specs/2026-10-18-file-format-design.md`, "Plan file" (`templates`) and "Limits".
- `docs/SPEC.md`, "Output: .ics and PDF" and "Own templates: workflow and help".

## Acceptance criteria

- It is decided how the `.typ` export delivers a template's images (for example several downloads, an archive written without a new package, or SVG inlined into the `.typ` text where possible), and the help explains it.
- The template interface says how a template refers to its images.
- Images reach only Typst or an `<img>` element; an SVG is never inserted into the page as markup.

## Notes

Typst can read an SVG from a string in the `.typ` text itself (`image(bytes("<svg …>"))`), but a PNG or JPEG needs a file next to it.
