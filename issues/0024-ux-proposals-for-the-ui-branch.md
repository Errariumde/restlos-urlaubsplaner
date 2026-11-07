---
status: open
priority:
area: UI
branch:
created: 2026-10-24
closed:
---
<!--
SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
SPDX-License-Identifier: CC-BY-4.0
-->

# UX proposals for the UI branch

## Problem

The research of 2026-10-24 on single-file and local-file web apps found UX practice that `docs/SPEC.md` doesn't have yet. The feasibility branch kept these proposals out of the spec because the maintainer hasn't seen them in detail. They need a decision before or in the UI branch.

## Context

- The research looked at TiddlyWiki, Feather Wiki, Excalidraw, draw.io, Photopea, Google's `browser-fs-access` and local-first software.
- The crash recovery in `docs/SPEC.md` ("File operations (editor behavior)", Restore) covers parts of proposals 3 and 4.

## Acceptance criteria

- Each of the nine proposals below is decided: adopted into the spec, changed, or rejected.
- The decision and its reason are written down here or in the spec.

## Notes

The nine proposals, each with its sources:

1. First start: say plainly that the plan lives in a file and the browser keeps only a recovery copy that "can be cleared unexpectedly"; make the first save part of creating a plan. ([Excalidraw's texts](https://raw.githubusercontent.com/excalidraw/excalidraw/master/packages/excalidraw/locales/en.json), [TiddlyWiki: Getting started](https://tiddlywiki.com/static/GettingStarted.html))
2. Show the unsaved state all the time, with "Last saved 14:32 as Name.rev3.urlaub.json"; clicking it saves. ([TiddlyWiki forum: avoiding frustration for newbies](https://talk.tiddlywiki.org/t/avoiding-frustration-for-newbies/5830), [draw.io: URL parameters](https://www.drawio.com/doc/faq/supported-url-parameters))
3. Register `beforeunload` only while there are unsaved changes and don't rely on it; write the recovery copy when the page is hidden (`visibilitychange`). Partly in the recovery concept. ([MDN: beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event))
4. The restore page says "not yet saved to a file" and has "Save as file" next to Restore. Partly in the recovery concept. ([Photopea: opening old files](https://www.photopea.com/tuts/photopea-opens-up-old-files/), [draw.io: open a diagram file](https://www.drawio.com/doc/faq/open-diagram-file))
5. After each download, say where the file went and how to turn on Firefox's "Always ask where to save files". ([TiddlyWiki: HTML5 saver](https://tiddlywiki.com/static/Saving%2520with%2520the%2520HTML5%2520saver.html))
6. Ask for read and write permission together when opening in Chromium, and only inside a click, so Save doesn't prompt again. The research also suggests offering "Save as" only in Chromium; that conflicts with the spec, where "Save as" also gives the file a new `id`, so it stays in every browser. ([Chrome: browser-fs-access](https://developer.chrome.com/docs/capabilities/browser-fs-access), [Chrome: persistent permissions](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api))
7. Suggest exporting the device settings before updating restlos. ([MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage))
8. Show the version and the build date in the app; after some months, a gentle note that a newer version may exist, with the address as text. The interval has no source. ([CyberChef](https://cc.flab.cesnet.cz/))
9. Treat the installed web app's file association as an extra on top of the Open button, and don't claim plain `.json`; whether operating systems match the compound extensions `.urlaub.json` and `.regeln.json` is unverified, so check it once the Pages version exists. ([Chrome: File Handling](https://developer.chrome.com/docs/capabilities/web-apis/file-handling))

Already in the spec, confirmed by the research: the warning before opening over unsaved changes, the revision warning, and taking over Ctrl+S.
