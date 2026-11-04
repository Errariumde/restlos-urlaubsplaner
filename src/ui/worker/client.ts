// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

// The page's side of the engine worker. Every request resolves in the order it was sent. Previews are
// coalesced: at most one is in flight, and only the newest waiting one is sent after it. A hint that is
// older than the newest open, apply, undo or redo resolves with `undefined`, so it never overwrites a newer
// state (Review Focus 2).
import type { Hint, LeaveChange, PlanState, Request, Response } from "./protocol.ts";

/** What the client needs of a worker; a `Worker` in the browser, a fake in the tests. */
export interface EngineWorker {
  onmessage: ((event: { readonly data: Response }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(message: Request): void;
  terminate(): void;
}

export type MakeWorker = (url: string) => EngineWorker;

export interface Engine {
  open(text: string, example: boolean): Promise<PlanState>;
  apply(changes: readonly LeaveChange[]): Promise<PlanState>;
  undo(): Promise<PlanState>;
  redo(): Promise<PlanState>;
  /** The hint for the changes, or `undefined` when a newer request made it stale. */
  preview(changes: readonly LeaveChange[]): Promise<Hint | undefined>;
  stop(): void;
}

/**
 * The browser objects the client uses. The client is also type-checked without the DOM types (its tests
 * run in Node), so it names only what it needs.
 */
interface Browser {
  readonly Worker: new (url: string) => EngineWorker;
  readonly Blob: new (parts: string[], options: { type: string }) => object;
  readonly URL: { createObjectURL(blob: object): string; revokeObjectURL(url: string): void };
}
const browser = globalThis as unknown as Browser;

const newWorker: MakeWorker = (url) => new browser.Worker(url);

interface Pending {
  readonly id: number;
  readonly resolve: (value: PlanState | Hint | undefined) => void;
  readonly reject: (error: Error) => void;
  answer?: Response;
}

interface WaitingPreview {
  readonly changes: readonly LeaveChange[];
  readonly resolve: (hint: Hint | undefined) => void;
  readonly reject: (error: Error) => void;
}

/** Starts the engine worker from its source code: a classic worker from a `blob:` URL (docs/SPEC.md, "Worker"). */
export function startEngine(source: string, makeWorker: MakeWorker = newWorker): Engine {
  const url = browser.URL.createObjectURL(new browser.Blob([source], { type: "text/javascript" }));
  const worker = makeWorker(url);
  /** The requests sent and not yet resolved, in send order. */
  const pending: Pending[] = [];
  let nextId = 1;
  /** The id of the newest open, apply, undo or redo sent; older hints are stale. */
  let newestState = 0;
  let previewInFlight: number | undefined;
  let waiting: WaitingPreview | undefined;
  let stopped: Error | undefined;

  const settle = (entry: Pending, answer: Response): void => {
    switch (answer.type) {
      case "state":
        entry.resolve(answer.state);
        break;
      case "hint":
        entry.resolve(answer.id < newestState ? undefined : answer.hint);
        break;
      case "refused":
        entry.reject(new Error(answer.code));
        break;
      case "failed":
        entry.reject(new Error(answer.message));
        break;
    }
  };

  /** Resolves the answered requests at the head of the queue, so that none overtakes an earlier one. */
  const flush = (): void => {
    while (pending[0]?.answer !== undefined) {
      const entry = pending.shift()!;
      settle(entry, entry.answer!);
    }
  };

  const send = (request: Request, resolve: Pending["resolve"], reject: Pending["reject"]): void => {
    pending.push({ id: request.id, resolve, reject });
    worker.postMessage(request);
  };

  const sendPreview = (changes: readonly LeaveChange[], resolve: (hint: Hint | undefined) => void, reject: (error: Error) => void): void => {
    const id = nextId++;
    previewInFlight = id;
    send({ id, type: "preview", changes }, (value) => resolve(value as Hint | undefined), reject);
  };

  const failAll = (error: Error): void => {
    stopped ??= error;
    waiting?.resolve(undefined);
    waiting = undefined;
    previewInFlight = undefined;
    for (const entry of pending.splice(0)) entry.reject(error);
  };

  worker.onmessage = ({ data }) => {
    const entry = pending.find((p) => p.id === data.id);
    if (!entry || entry.answer !== undefined) return;
    entry.answer = data;
    if (data.id === previewInFlight) {
      previewInFlight = undefined;
      const next = waiting;
      waiting = undefined;
      if (next) sendPreview(next.changes, next.resolve, next.reject);
    }
    flush();
  };
  worker.onerror = () => failAll(new Error("The engine worker failed"));

  const request = (make: (id: number) => Request): Promise<PlanState> =>
    new Promise<PlanState>((resolve, reject) => {
      if (stopped) {
        reject(stopped);
        return;
      }
      const id = nextId++;
      newestState = id;
      // A preview still waiting was asked for before this request; its hint would be stale.
      waiting?.resolve(undefined);
      waiting = undefined;
      send(make(id), (value) => resolve(value as PlanState), reject);
    });

  return {
    open: (text, example) => request((id) => ({ id, type: "open", text, example })),
    apply: (changes) => request((id) => ({ id, type: "apply", changes })),
    undo: () => request((id) => ({ id, type: "undo" })),
    redo: () => request((id) => ({ id, type: "redo" })),
    preview: (changes) =>
      new Promise<Hint | undefined>((resolve, reject) => {
        if (stopped) {
          reject(stopped);
          return;
        }
        if (previewInFlight === undefined) {
          sendPreview(changes, resolve, reject);
          return;
        }
        waiting?.resolve(undefined);
        waiting = { changes, resolve, reject };
      }),
    stop: () => {
      if (stopped) return;
      worker.terminate();
      browser.URL.revokeObjectURL(url);
      failAll(new Error("The engine was stopped"));
    },
  };
}
