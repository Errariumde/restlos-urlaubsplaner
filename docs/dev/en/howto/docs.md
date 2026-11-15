<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# Documentation

Write or change a page under `docs/user/` or `docs/dev/`. The rules behind the steps are on the [documentation style](../reference/documentation-style.md) page.

## Hard rules

- Nothing links to or depends on `docs/superpowers/`, and agents never delete anything in it.
- Repository text stands on its own: no pointers to chats, sessions, reviews or files outside the repository.
- An issue number gets a short description next to it.
- Normative statements live only in reference pages, rationale only in explanation pages.
- English and German user pages change in the same commit.
- Every new file gets SPDX headers, with CC-BY-4.0 for documentation.
- Docs never cite the spec. Exceptions: the dependency-update how-to until phase 2, and this page's move steps.

## Steps

1. Name the reader: a person who plans their leave (`user`) or a contributor or agent (`dev`).
2. Name the one need of that reader that the page serves.
3. Choose the mode: tutorial, how-to, reference or explanation. A page with two needs becomes two pages.
4. Follow that quadrant's register and order on the [documentation style](../reference/documentation-style.md) page. Put the page at `docs/<audience>/<language>/<quadrant>/<topic>.md`.
5. When the text comes from `docs/SPEC.md`, take the section's destination and phase from the table in issue 0055 (move the spec into the docs). Move the text unchanged to that page.
6. In the same commit, update every citation of the moved or renamed text. Also update every file that names the authoritative source.
7. In the same commit, replace the section's text with the line ``Status: moved to `<path>`.``, where `<path>` is the page's repository path. For a partly moved section, keep the planned part and update its status line instead. Tick the section's row in that issue.
8. Rewrite the moved text in a second commit. `npm run check` must pass after each of the two commits.
9. Hand texts for the message catalogs to the [UI texts](ui-texts.md) how-to.
10. Write a user page in English and German, and commit both in the same commit.
11. Review what no check can see: one idea per sentence, one mode per page, and facts that match the code.
12. Run `npm run check` last, and fix every error it reports.
