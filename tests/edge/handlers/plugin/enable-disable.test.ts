// Wave 0 RED scaffold for the Phase 54 enable/disable edge handler.
//
// Phase 54 Plan 01 lands this file with `test.skip(...)` shells whose
// bodies are `assert.fail(...)` -- if anyone flips a `skip` on without
// landing the matching edge handler code in Plan 02, the suite RED-fails
// loudly. Plan 02 fills in the bodies AND flips `test.skip` to `test`
// in lockstep with the new
// `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts`
// source file.
//
// IMPORT SENTINEL (Rule 3 deviation from plan): the plan's literal
// instructions specify a STATIC top-level
// `import { makeEnableDisableHandler } from
// "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts"`
// guarded by `@ts-expect-error`. That pattern breaks at runtime under
// `node --test` because the native-TS-strip loader resolves the path
// eagerly at file-load time and the missing source crashes the whole
// test file with `ERR_MODULE_NOT_FOUND` BEFORE any `test.skip(...)`
// suppression takes effect. Switching to a DYNAMIC `import()` inside
// each skipped body keeps the load-time path GREEN (skipped tests
// never execute their `import()`) while preserving the "source missing
// in Plan 02 -> tests RED" sentinel:
//
//   - Plan 02 replaces the `await import(...)` line below with a
//     STATIC top-level `import { makeEnableDisableHandler } from
//     "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts";`
//     in lockstep with the new edge handler source file. If Plan 02
//     ships the bodies but forgets the source file, the static import
//     fails at file-load time and the suite RED-fails.
//
//   - Plan 02 flips `test.skip(...)` to `test(...)` for each behavior
//     below.
//
// IMPORT SENTINEL TARGET (verbatim, for grep):
//   extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts

import assert from "node:assert/strict";
import test from "node:test";

const ENABLE_DISABLE_HANDLER_PATH =
  "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts";

async function loadHandler(): Promise<unknown> {
  return import(ENABLE_DISABLE_HANDLER_PATH);
}

// ──────────────────────────────────────────────────────────────────────────
// USAGE error arms
// ──────────────────────────────────────────────────────────────────────────

test.skip("USAGE: missing positional emits USAGE error", async () => {
  await loadHandler();
  assert.fail("Plan 02 implements this -- see missing positional -> USAGE error");
});

test.skip("USAGE: malformed <plugin>@<marketplace> emits USAGE error", async () => {
  await loadHandler();
  assert.fail("Plan 02 implements this -- see malformed <plugin>@<marketplace> -> USAGE error");
});

test.skip("USAGE: unknown flag emits USAGE error", async () => {
  await loadHandler();
  assert.fail("Plan 02 implements this -- see unknown flag -> USAGE error");
});

// ──────────────────────────────────────────────────────────────────────────
// Flag parsing + forward
// ──────────────────────────────────────────────────────────────────────────

test.skip("Flag: --local is parsed and forwarded to the orchestrator", async () => {
  await loadHandler();
  assert.fail("Plan 02 implements this -- see --local parse + forward to orchestrator");
});

test.skip("Flag: --scope user|project is parsed and forwarded to the orchestrator", async () => {
  await loadHandler();
  assert.fail(
    "Plan 02 implements this -- see --scope user|project parse + forward to orchestrator",
  );
});
