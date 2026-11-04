// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it, vi } from "vitest";
import { startEngine, type EngineWorker } from "../../../src/ui/worker/client.ts";
import type { Hint, PlanState, Request, Response } from "../../../src/ui/worker/protocol.ts";

/** Node's structured clone, which throws for what `postMessage` can't send (the tests have no DOM types). */
const clone = (globalThis as unknown as { structuredClone: <T>(value: T) => T }).structuredClone;

/** A response without its id. */
type Answer = { [K in Response["type"]]: Omit<Extract<Response, { type: K }>, "id"> }[Response["type"]];

/** A worker that keeps every request until the test answers it. */
class FakeWorker implements EngineWorker {
  onmessage: ((event: { readonly data: Response }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  readonly received: Request[] = [];
  terminated = false;
  /** The next postMessage calls that throw, like a DataCloneError. */
  failing = 0;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
  }
  postMessage(message: Request): void {
    if (this.failing > 0) {
      this.failing--;
      throw new Error("DataCloneError");
    }
    // Like structured cloning: a later change of the caller's objects doesn't reach the worker.
    this.received.push(clone(message));
  }
  terminate(): void {
    this.terminated = true;
  }
  /** Answers the request with this id. */
  answer(id: number, response?: Answer): void {
    const request = this.received.find((r) => r.id === id);
    if (!request) throw new Error(`No request ${id}`);
    const data = { id, ...(response ?? defaultAnswer(request)) } as Response;
    this.onmessage?.({ data });
  }
  /** Sends a raw response, whatever its id. */
  send(data: Response): void {
    this.onmessage?.({ data });
  }
  ids(type?: Request["type"]): number[] {
    return this.received.filter((r) => type === undefined || r.type === type).map((r) => r.id);
  }
}

const state = (planned: number): PlanState => ({ result: { totals: { planned } } }) as unknown as PlanState;
const hint = (days: number): Hint => ({ days, cost: days * 480, remaining: 0, stretch: undefined });

function defaultAnswer(request: Request): Answer {
  if (request.type === "preview") return { type: "hint", hint: hint(request.changes.length) };
  return { type: "state", state: state(request.id) };
}

function setUp(): { engine: ReturnType<typeof startEngine>; worker: () => FakeWorker } {
  let worker: FakeWorker | undefined;
  const engine = startEngine("/* worker */", (url) => (worker = new FakeWorker(url)));
  return {
    engine,
    worker: () => {
      if (!worker) throw new Error("The worker wasn't started");
      return worker;
    },
  };
}

/** Node's URL, typed only as far as the tests need it (the tests have no DOM or Node types). */
const nodeUrl = (globalThis as unknown as { URL: { revokeObjectURL(url: string): void } }).URL;

const day = (n: number): { day: number; take: 480 } => ({ day: n, take: 480 });

describe("startEngine", () => {
  it("starts the worker from a blob URL", () => {
    const { engine, worker } = setUp();
    expect(worker().url).toMatch(/^blob:/);
    engine.stop();
    expect(worker().terminated).toBe(true);
  });

  it("drops a preview superseded while another is in flight", async () => {
    // Review Focus 2
    const { engine, worker } = setUp();
    const first = engine.preview([day(1)]);
    const second = engine.preview([day(1), day(2)]);
    const third = engine.preview([day(1), day(2), day(3)]);
    expect(await second).toBeUndefined();
    expect(worker().received.map((r) => r.type)).toEqual(["preview"]);
    worker().answer(worker().ids("preview")[0]!);
    expect(await first).toMatchObject({ days: 1 });
    // Only now the newest waiting preview goes out.
    const previews = worker().received.filter((r) => r.type === "preview");
    expect(previews.map((r) => (r.type === "preview" ? r.changes.length : 0))).toEqual([1, 3]);
    worker().answer(worker().ids("preview")[1]!);
    expect(await third).toMatchObject({ days: 3 });
  });

  it("drops a hint that arrives after a newer apply", async () => {
    // Review Focus 2
    const { engine, worker } = setUp();
    const preview = engine.preview([day(1)]);
    const waiting = engine.preview([day(2)]);
    const applied = engine.apply([day(5)]);
    // The waiting preview was asked for before the apply: it is never sent.
    expect(await waiting).toBeUndefined();
    expect(worker().received.map((r) => r.type)).toEqual(["preview", "apply"]);
    const [previewId, applyId] = worker().ids();
    worker().answer(previewId!);
    worker().answer(applyId!);
    expect(await preview).toBeUndefined();
    expect(await applied).toMatchObject({ result: { totals: { planned: applyId } } });
    // A preview after the apply gets its hint again.
    const later = engine.preview([day(3)]);
    worker().answer(worker().ids().at(-1)!);
    expect(await later).toMatchObject({ days: 1 });
  });

  it("resolves requests in send order", async () => {
    const { engine, worker } = setUp();
    const order: string[] = [];
    const track = <T>(name: string, promise: Promise<T>): Promise<T> => promise.then((value) => (order.push(name), value));
    const all = Promise.all([
      track("open", engine.open("{}", false)),
      track("preview", engine.preview([day(1)])),
      track("apply", engine.apply([day(2)])),
      track("undo", engine.undo()),
      track("redo", engine.redo()),
    ]);
    const [open, preview, apply, undo, redo] = worker().ids();
    // Even when answers come out of order, each request resolves after all earlier ones.
    worker().answer(redo!);
    worker().answer(apply!);
    worker().answer(undo!);
    worker().answer(preview!);
    await Promise.resolve();
    expect(order).toEqual([]);
    worker().answer(open!);
    await all;
    expect(order).toEqual(["open", "preview", "apply", "undo", "redo"]);
  });

  it("rejects a refused file with its code", async () => {
    const { engine, worker } = setUp();
    const opened = engine.open("{", false);
    worker().answer(worker().ids()[0]!, { type: "refused", code: "notJson" });
    await expect(opened).rejects.toThrow(new Error("notJson"));
  });

  it("rejects a failed request with its message", async () => {
    const { engine, worker } = setUp();
    const applied = engine.apply([]);
    worker().answer(worker().ids()[0]!, { type: "failed", message: "No plan is open" });
    await expect(applied).rejects.toThrow("No plan is open");
  });

  it("rejects what is pending when the worker fails or stops", async () => {
    const { engine, worker } = setUp();
    const opened = engine.open("{}", false);
    worker().onerror?.({});
    await expect(opened).rejects.toThrow();
    const again = setUp();
    const undone = again.engine.undo();
    again.engine.stop();
    await expect(undone).rejects.toThrow();
    await expect(again.engine.redo()).rejects.toThrow();
  });
  it("keeps flowing when a message can't be sent", async () => {
    const { engine, worker } = setUp();
    worker().failing = 1;
    await expect(engine.apply([day(1)])).rejects.toThrow("DataCloneError");
    const applied = engine.apply([day(2)]);
    worker().answer(worker().ids("apply")[0]!);
    expect(await applied).toBeDefined();
    // A preview that can't be sent doesn't stay in flight.
    worker().failing = 1;
    await expect(engine.preview([day(3)])).rejects.toThrow("DataCloneError");
    const preview = engine.preview([day(4)]);
    worker().answer(worker().ids("preview")[0]!);
    expect(await preview).toMatchObject({ days: 1 });
  });

  it("rejects a waiting preview that can't be sent after the one in flight", async () => {
    const { engine, worker } = setUp();
    const first = engine.preview([day(1)]);
    const second = engine.preview([day(2)]);
    worker().failing = 1;
    worker().answer(worker().ids("preview")[0]!);
    expect(await first).toMatchObject({ days: 1 });
    await expect(second).rejects.toThrow("DataCloneError");
    const third = engine.preview([day(3)]);
    worker().answer(worker().ids("preview")[1]!);
    expect(await third).toMatchObject({ days: 1 });
  });

  it("sends plain copies of the changes", () => {
    const { engine, worker } = setUp();
    const change = { day: 7, take: 240 as const, part: "start" as const, extra: () => 1 };
    void engine.apply([change, { day: 8, take: 480 }]);
    expect(worker().received[0]).toEqual({ id: 1, type: "apply", changes: [{ day: 7, take: 240, part: "start" }, { day: 8, take: 480 }] });
    expect(Object.keys((worker().received[0] as unknown as { changes: object[] }).changes[1]!)).toEqual(["day", "take"]);
  });

  it("ignores an answer with an unknown or repeated id", async () => {
    const { engine, worker } = setUp();
    const opened = engine.open("{}", false);
    worker().send({ id: 99, type: "state", state: state(99) });
    const [id] = worker().ids();
    worker().answer(id!);
    worker().send({ id: id!, type: "failed", message: "late" });
    expect(await opened).toMatchObject({ result: { totals: { planned: id } } });
    const undone = engine.undo();
    worker().answer(worker().ids().at(-1)!);
    expect(await undone).toBeDefined();
  });

  it("resolves a waiting preview with undefined when the worker fails", async () => {
    const { engine, worker } = setUp();
    const first = engine.preview([day(1)]);
    const waiting = engine.preview([day(2)]);
    worker().onerror?.({});
    expect(await waiting).toBeUndefined();
    await expect(first).rejects.toThrow();
  });

  it("drops the hint in flight when undo is sent", async () => {
    // Review Focus 2
    const { engine, worker } = setUp();
    const preview = engine.preview([day(1)]);
    const undone = engine.undo();
    const [previewId, undoId] = worker().ids();
    worker().answer(previewId!);
    worker().answer(undoId!);
    expect(await preview).toBeUndefined();
    expect(await undone).toBeDefined();
  });

  it("stops the worker and frees its URL after a worker error", async () => {
    const revoke = vi.spyOn(nodeUrl, "revokeObjectURL");
    const { engine, worker } = setUp();
    const opened = engine.open("{}", false);
    worker().onmessageerror?.({});
    await expect(opened).rejects.toThrow();
    expect(worker().terminated).toBe(true);
    expect(revoke).toHaveBeenCalledWith(worker().url);
    engine.stop();
    expect(revoke).toHaveBeenCalledTimes(1);
    revoke.mockRestore();
  });
});
