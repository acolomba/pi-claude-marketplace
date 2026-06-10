// Wave 0 RED scaffold for the Phase 54 enable/disable orchestrator.
//
// Phase 54 Plan 01 lands this file with `test.skip(...)` shells whose
// bodies are `assert.fail(...)` -- if anyone flips a `skip` on without
// landing the matching orchestrator code in Plan 02, the suite RED-fails
// loudly. Plan 02 fills in the bodies AND flips `test.skip` to `test`
// in lockstep with the new
// `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
// source file.
//
// IMPORT SENTINEL (Rule 3 deviation from plan): the plan's literal
// instructions specify a STATIC top-level
// `import { setPluginEnabled } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"`
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
//     STATIC top-level `import { setPluginEnabled } from
//     "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts";`
//     in lockstep with the new orchestrator source file. If Plan 02
//     ships the bodies but forgets the source file, the static import
//     fails at file-load time and the suite RED-fails.
//
//   - Plan 02 flips `test.skip(...)` to `test(...)` for each behavior
//     below.
//
// IMPORT SENTINEL TARGET (verbatim, for grep):
//   extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts

import assert from "node:assert/strict";
import test from "node:test";

const ENABLE_DISABLE_ORCHESTRATOR_PATH =
  "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts";

async function loadOrchestrator(): Promise<unknown> {
  return import(ENABLE_DISABLE_ORCHESTRATOR_PATH);
}

// ──────────────────────────────────────────────────────────────────────────
// ENBL-01: config write-back (base + --local)
// ──────────────────────────────────────────────────────────────────────────

test.skip("ENBL-01: enable writes config entry back to claude-plugins.json (base)", async () => {
  await loadOrchestrator();
  assert.fail("Plan 02 implements this -- see ENBL-01 base config write-back");
});

test.skip("ENBL-01: enable --local writes config entry back to claude-plugins.local.json", async () => {
  await loadOrchestrator();
  assert.fail("Plan 02 implements this -- see ENBL-01 --local config write-back");
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-02: disable preserves version pin + empties resources
// ──────────────────────────────────────────────────────────────────────────

test.skip("ENBL-02: disable preserves version pin and empties all four resources arrays", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see ENBL-02 disable preserves version pin + resources reset",
  );
});

test.skip("ENBL-02: reconcile is no-op after disable (steady state under enabled === false)", async () => {
  await loadOrchestrator();
  assert.fail("Plan 02 implements this -- see ENBL-02 reconcile no-op after disable");
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-03: enable from cache (no network, NFR-5)
// ──────────────────────────────────────────────────────────────────────────

test.skip("ENBL-03: enable re-materializes from cached manifest (no network, manifest read mock)", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see ENBL-03 enable from cache (manifest read mock, no network)",
  );
});

test.skip("ENBL-03: enable preserves the recorded version pin", async () => {
  await loadOrchestrator();
  assert.fail("Plan 02 implements this -- see ENBL-03 version pin preserved on enable");
});

test.skip("ENBL-03: missing clone aborts pre-ledger with (failed) {source missing}", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see ENBL-03 missing clone aborts pre-ledger with (failed) {source missing}",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL idempotency arm
// ──────────────────────────────────────────────────────────────────────────

test.skip("Idempotency: enable on already-enabled plugin renders (skipped) {already enabled} at info severity", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see idempotency arm (skipped) {already enabled} / {already disabled} at info severity",
  );
});

test.skip("Idempotency: disable on already-disabled plugin renders (skipped) {already disabled} at info severity", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see idempotency arm (skipped) {already enabled} / {already disabled} at info severity",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// CFG-03: invalid-config abort
// ──────────────────────────────────────────────────────────────────────────

test.skip("CFG-03: invalid config aborts with path.basename containment (NEVER absolute path)", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see CFG-03 invalid-config abort with path.basename (NEVER absolute path)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Pitfall 54-5: --local file creation never disturbs base file
// ──────────────────────────────────────────────────────────────────────────

test.skip("--local creates claude-plugins.local.json and leaves base file mtime unchanged (Pitfall 54-5)", async () => {
  await loadOrchestrator();
  assert.fail(
    "Plan 02 implements this -- see --local creates claude-plugins.local.json and leaves base file mtime unchanged (Pitfall 54-5)",
  );
});
