// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The engine worker's entry. The build bundles it into one classic script (scripts/build/vite-restlos.ts,
// `virtual:restlos-worker`), and the page starts it from a `blob:` URL (client.ts).
import type { Request, Response } from "./protocol.ts";
import { respond, Session } from "./session.ts";

/** The part of the worker's global scope this file uses; the UI program has the DOM types, not the worker's. */
interface WorkerScope {
  onmessage: ((event: { readonly data: Request }) => void) | null;
  postMessage(message: Response): void;
}

const scope = self as unknown as WorkerScope;
const session = new Session();

scope.onmessage = ({ data }) => {
  scope.postMessage(respond(session, data));
};
