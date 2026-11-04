// SPDX-FileCopyrightText: 2026 The restlos-urlaubsplaner authors
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from "vitest";
import { startEngine, type EngineWorker } from "../../../src/ui/worker/client.ts";
import type { Hint, PlanState, Request, Response } from "../../../src/ui/worker/protocol.ts";

/** A response without its id. */
type Answer = { [K in Response["type"]]: Omit<Extract<Response, { type: K }>, "id"> }[Response["type"]];

/** A worker that keeps every request until the test answers it. */
class FakeWorker implements EngineWorker {
  onmessage: ((event: { readonly data: Response }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readonly received: Request[] = [];
  terminated = false;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
  }
  postMessage(message: Request): void {
    this.received.push(message);
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
});
