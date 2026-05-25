import assert from "node:assert/strict";
import test from "node:test";

import { PathContainmentError } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import {
  runPhases,
  type Phase,
} from "../../extensions/pi-claude-marketplace/transaction/phase-ledger.ts";

/**
 * D-01 / AS-4 / PI-14 -- runPhases ledger semantics.
 *
 * The ledger primitive is the seam every Phase 5 install/update/uninstall
 * orchestrator reuses. Tests focus on the three contracts that orchestrators
 * rely on: reverse-order undo (D-01), aggregated undo failures (AS-4), and
 * the loud PathContainmentError re-throw path (PI-14) that signals state
 * corruption rather than a routine cleanup miss.
 *
 * Test phases use `() => Promise.resolve()` instead of `async () => {}`
 * to satisfy `@typescript-eslint/require-await` -- the Phase<C> contract
 * is `() => Promise<void>`, and an empty resolved promise is the cheapest
 * legal body.
 */

interface TraceCtx {
  trace: string[];
}

interface CountCtx {
  count: number;
}

interface TaggedOpsCtx {
  tag: string;
  ops: string[];
}

const noopAsync = (): Promise<void> => Promise.resolve();
const throwAsync = (msg: string): (() => Promise<void>) => {
  return () => Promise.reject(new Error(msg));
};

test("D-01 runPhases: 4 phases, phase 3 throws -> reverse-order undo of phases 1+2", async () => {
  const ctx: TraceCtx = { trace: [] };
  const phases: Phase<TraceCtx>[] = [
    {
      name: "p1",
      do: (c) => {
        c.trace.push("do:p1");
        return Promise.resolve();
      },
      undo: (c) => {
        c.trace.push("undo:p1");
        return Promise.resolve();
      },
    },
    {
      name: "p2",
      do: (c) => {
        c.trace.push("do:p2");
        return Promise.resolve();
      },
      undo: (c) => {
        c.trace.push("undo:p2");
        return Promise.resolve();
      },
    },
    {
      name: "p3",
      do: throwAsync("boom"),
    },
    {
      name: "p4",
      do: (c) => {
        c.trace.push("do:p4");
        return Promise.resolve();
      },
    },
  ];
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, "boom");
  assert.deepEqual(ctx.trace, ["do:p1", "do:p2", "undo:p2", "undo:p1"], "reverse-order undo");
  assert.equal(result.rollbackPartials.length, 0);
});

test("AS-4 runPhases: undo failure aggregated with phase name", async () => {
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: noopAsync,
      undo: throwAsync("rm leak"),
    },
    {
      name: "p2",
      do: throwAsync("boom"),
    },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, "boom");
  // Task 260525-cjr C1: RollbackPartial now also preserves the
  // original undo throw via `cause`. Assert field-by-field instead of
  // a deep-equal on the whole row so the test does not encode the
  // Error instance identity into the fixture.
  assert.equal(result.rollbackPartials.length, 1);
  const first = result.rollbackPartials[0];
  assert.ok(first !== undefined);
  assert.equal(first.phase, "p1");
  assert.equal(first.msg, "rm leak");
  assert.ok(first.cause instanceof Error);
  assert.equal(first.cause.message, "rm leak");
});

test("AS-4 runPhases: multiple undo failures aggregated in reverse order", async () => {
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: noopAsync,
      undo: throwAsync("p1 undo failed"),
    },
    {
      name: "p2",
      do: noopAsync,
      undo: throwAsync("p2 undo failed"),
    },
    {
      name: "p3",
      do: throwAsync("boom"),
    },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.ok, false);
  // undo runs reverse order: p2 first, then p1 -> partials in that order
  assert.equal(result.rollbackPartials.length, 2);
  const [first, second] = result.rollbackPartials;
  assert.ok(first !== undefined && second !== undefined);
  assert.equal(first.phase, "p2");
  assert.equal(first.msg, "p2 undo failed");
  assert.ok(first.cause instanceof Error);
  assert.equal(second.phase, "p1");
  assert.equal(second.msg, "p1 undo failed");
  assert.ok(second.cause instanceof Error);
});

test("PI-14 runPhases: PathContainmentError from undo is RE-THROWN (not folded into rollback partial)", async () => {
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: noopAsync,
      undo: () =>
        Promise.reject(new PathContainmentError("/parent", "/parent/../escape", "test undo")),
    },
    {
      name: "p2",
      do: throwAsync("boom"),
    },
  ];
  await assert.rejects(
    () => runPhases(phases, {}),
    (err: unknown) => err instanceof PathContainmentError,
  );
});

test("D-01 runPhases: all-phases-success returns ok=true with empty partials/leaks", async () => {
  const ctx: CountCtx = { count: 0 };
  const phases: Phase<CountCtx>[] = [
    {
      name: "p1",
      do: (c) => {
        c.count++;
        return Promise.resolve();
      },
    },
    {
      name: "p2",
      do: (c) => {
        c.count++;
        return Promise.resolve();
      },
    },
  ];
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, true);
  assert.deepEqual([...result.rollbackPartials], []);
  assert.deepEqual([...result.leaks], []);
  assert.equal(ctx.count, 2);
});

test("D-01 runPhases: empty phases array is a no-op (ok=true)", async () => {
  const result = await runPhases([], {});
  assert.equal(result.ok, true);
  assert.deepEqual([...result.rollbackPartials], []);
});

test("D-01 runPhases: phase WITHOUT undo is silently skipped during rollback", async () => {
  const ctx: TraceCtx = { trace: [] };
  const phases: Phase<TraceCtx>[] = [
    {
      name: "p1",
      do: (c) => {
        c.trace.push("do:p1");
        return Promise.resolve();
      },
      // intentionally no undo -- ledger should silently skip on rollback.
    },
    {
      name: "p2",
      do: (c) => {
        c.trace.push("do:p2");
        return Promise.resolve();
      },
      undo: (c) => {
        c.trace.push("undo:p2");
        return Promise.resolve();
      },
    },
    {
      name: "p3",
      do: throwAsync("boom"),
    },
  ];
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, false);
  // p1 has no undo -> not invoked. p2.undo IS invoked.
  assert.deepEqual(ctx.trace, ["do:p1", "do:p2", "undo:p2"]);
  assert.equal(result.rollbackPartials.length, 0);
});

test("D-01 runPhases: ctx threaded to every do AND undo call", async () => {
  const ctx: TaggedOpsCtx = { tag: "mytag", ops: [] };
  const phases: Phase<TaggedOpsCtx>[] = [
    {
      name: "p1",
      do: (c) => {
        c.ops.push(`do:p1:${c.tag}`);
        return Promise.resolve();
      },
      undo: (c) => {
        c.ops.push(`undo:p1:${c.tag}`);
        return Promise.resolve();
      },
    },
    {
      name: "p2",
      do: throwAsync("boom"),
    },
  ];
  await runPhases(phases, ctx);
  assert.deepEqual(ctx.ops, ["do:p1:mytag", "undo:p1:mytag"]);
});

// ───────────────────────────────────────────────────────────────────────────
// Task 260525-cjr C1: RollbackPartial preserves the original undo throw's
// Error.cause chain so the presentation layer can surface the depth-5 walk
// to the user. Previously only `errorMessage(undoErr)` was recorded as
// `msg`, dropping any deeper cause attached via `new Error(..., {cause})`.
// ───────────────────────────────────────────────────────────────────────────

test("260525-cjr C1: undo error's Error.cause is preserved on the RollbackPartial.cause field", async () => {
  const innermost = new Error("disk write failed");
  const undoErr = new Error("rm leak", { cause: innermost });
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: noopAsync,
      undo: () => Promise.reject(undoErr),
    },
    {
      name: "p2",
      do: throwAsync("boom"),
    },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.ok, false);
  assert.equal(result.rollbackPartials.length, 1);
  const first = result.rollbackPartials[0];
  assert.ok(first !== undefined);
  assert.equal(first.phase, "p1");
  assert.equal(first.msg, "rm leak");
  // The Error INSTANCE is preserved (not just the message text) so the
  // depth-5 cause-chain walker at the presentation layer can traverse
  // .cause to surface the originating "disk write failed" message.
  assert.ok(first.cause instanceof Error);
  assert.equal(first.cause, undoErr);
  assert.equal((first.cause as Error & { cause?: unknown }).cause, innermost);
});

test("260525-cjr C1: undo throw of a non-Error (defensive) leaves RollbackPartial.cause undefined", async () => {
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: noopAsync,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- 260525-cjr C1: deliberately reject with a non-Error to exercise the defensive `instanceof Error` guard on RollbackPartial.cause population.
      undo: () => Promise.reject("string throw, not an Error"),
    },
    {
      name: "p2",
      do: throwAsync("boom"),
    },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.rollbackPartials.length, 1);
  const first = result.rollbackPartials[0];
  assert.ok(first !== undefined);
  assert.equal(first.cause, undefined);
});
