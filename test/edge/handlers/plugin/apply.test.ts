// Owner for edge/handlers/plugin/apply.ts.
//
// The handler takes the reconcile apply step as a required dependency, so every
// delegating case states the complete options bag in a strict interaction mock
// and ends in `verify()`. Every rejection case builds the step as a mock with no
// stated expectation, which throws on any call, so a green case proves the step
// never ran. A rejection also states no `cwd` on the boundary, so the early
// return is proven to read nothing off the context.
//
// The accepted arity is zero positionals. `--local` never reaches
// `extractLocalFlag` here, so it survives `parseArgs` as a positional that opens
// with `--` and takes the unknown-flag sentence (D-07, D-16).
//
// No case re-derives the tokenizer diagnostics (test/edge/args.test.ts), the
// shared prelude (test/edge/handlers/plugin/shared.test.ts), or the apply step
// itself (test/orchestrators/reconcile/apply.test.ts).

import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { SCOPE_TARGET_FLAG } from "../../../../extensions/pi-claude-marketplace/edge/flag-catalog.ts";
import {
  makeApplyHandler,
  type ApplyHandlerDeps,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/apply.ts";
import { createCompletionCache } from "../../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

import type { Scope } from "../../../../extensions/pi-claude-marketplace/shared/types.ts";

type ApplyStep = ApplyHandlerDeps["applyReconcile"];

const APPLY_USAGE = "Usage: /claude:plugin apply [--scope user|project]";

const CWD = "/workspace/project";

test("applies both scopes when no scope flag narrows the command (APL-01)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, {
    value: CWD,
    reads: 1,
  });
  const run = runWithNothingLoaded();
  const completionCache = createCompletionCache();
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const applyReconcile = mock<ApplyStep>({ exactParams: true, name: "apply reconcile" });
  when(() => applyReconcile({ ctx, run, cwd: CWD, hooksRouting, completionCache })).thenResolve(
    undefined,
  );
  const applyHandler = makeApplyHandler({ completionCache, applyReconcile }, hooksRouting);

  // act
  await applyHandler("", ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(applyReconcile);
});

for (const scope of ["project", "user"] satisfies readonly Scope[]) {
  test(`applies the ${scope} scope alone when --scope ${scope} narrows the command (APL-01)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, {
      value: CWD,
      reads: 1,
    });
    const run = runWithNothingLoaded();
    const completionCache = createCompletionCache();
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const applyReconcile = mock<ApplyStep>({ exactParams: true, name: "apply reconcile" });
    when(() =>
      applyReconcile({ ctx, run, cwd: CWD, hooksRouting, completionCache, scope }),
    ).thenResolve(undefined);
    const applyHandler = makeApplyHandler({ completionCache, applyReconcile }, hooksRouting);

    // act
    await applyHandler(`--scope ${scope}`, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(applyReconcile);
  });
}

for (const { args, summary } of [
  { args: "extra", summary: "a single surplus token" },
  { args: "--scope user extra", summary: "a surplus token beside a scope flag" },
]) {
  test(`rejects ${summary} with the too-many-arguments sentence and never applies`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const completionCache = createCompletionCache();
    const applyReconcile = mock<ApplyStep>({ exactParams: true, name: "apply reconcile" });
    const applyHandler = makeApplyHandler(
      { completionCache, applyReconcile },
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
    );

    // act
    await applyHandler(args, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Too many arguments.\n\n${APPLY_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(applyReconcile);
  });
}

for (const { args, offendingToken, summary } of [
  { args: "--bogus", offendingToken: "--bogus", summary: "an unknown flag" },
  { args: "extra --bogus", offendingToken: "--bogus", summary: "an unknown flag after a token" },
  { args: SCOPE_TARGET_FLAG, offendingToken: SCOPE_TARGET_FLAG, summary: "the local flag" },
]) {
  test(`names ${summary} as an unknown flag and never applies (D-16)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const completionCache = createCompletionCache();
    const applyReconcile = mock<ApplyStep>({ exactParams: true, name: "apply reconcile" });
    const applyHandler = makeApplyHandler(
      { completionCache, applyReconcile },
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
    );

    // act
    await applyHandler(args, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Unknown flag: "${offendingToken}".\n\n${APPLY_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(applyReconcile);
  });
}

for (const { args, expectedSentence, summary } of [
  {
    args: "--scope bad",
    expectedSentence: 'Invalid --scope value: "bad". Must be "user" or "project".',
    summary: "an unrecognised scope value",
  },
  {
    args: "--scope",
    expectedSentence: '--scope requires a value: "user" or "project".',
    summary: "a scope flag with no value",
  },
]) {
  test(`carries the parse failure for ${summary} under the apply usage and never applies`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const completionCache = createCompletionCache();
    const applyReconcile = mock<ApplyStep>({ exactParams: true, name: "apply reconcile" });
    const applyHandler = makeApplyHandler(
      { completionCache, applyReconcile },
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
    );

    // act
    await applyHandler(args, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${expectedSentence}\n\n${APPLY_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(applyReconcile);
  });
}
