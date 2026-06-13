import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { mergeScopeConfigs } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { buildConfigFromState } from "../../../extensions/pi-claude-marketplace/persistence/migrate-config.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * Deferred SC#4 -- the PLANNER-LEVEL convergence proof.
 *
 *   planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope)
 *     deepEqual emptyReconcilePlan(scope)
 *
 * for any populated state. The data-level surrogate (key-set + provenance
 * equality) lives in `tests/persistence/migrate-config.test.ts` Section D;
 * this file owns the planner-level no-op proof.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(
  HERE,
  "../../persistence/fixtures/legacy/state-populated-mixed.json",
);

/**
 * Mirror of `loadPopulatedState` from `tests/persistence/migrate-config.test.ts`
 * -- load the populated fixture and normalise its `source` strings to
 * `ParsedSource` objects, matching the post-`loadState` in-memory shape.
 * Re-implemented inline here (rather than re-exported across test trees) so
 * this convergence file stays self-contained and the Section D
 * surrogate's helper is not load-bearing for the planner-level proof.
 */
async function loadPopulatedState(): Promise<ExtensionState> {
  const raw = JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as {
    marketplaces: Record<string, Record<string, unknown>>;
  };

  for (const mp of Object.values(raw.marketplaces)) {
    const src = mp["source"];
    if (typeof src === "string") {
      if (
        src.startsWith("./") ||
        src.startsWith("../") ||
        src.startsWith("/") ||
        src === "~" ||
        src.startsWith("~/")
      ) {
        mp["source"] = pathSource(src);
      } else {
        mp["source"] = githubSource(src);
      }
    }
  }

  return { schemaVersion: 1, ...raw } as unknown as ExtensionState;
}

function assertConvergesForScope(state: ExtensionState, scope: Scope): void {
  const merged = mergeScopeConfigs(buildConfigFromState(state), {});
  const plan = planReconcile(merged, state, scope);
  assert.deepEqual(plan, emptyReconcilePlan(scope));
}

test("SC#4 (project): build-from-state + merge + plan = empty (deepEqual)", async () => {
  const state = await loadPopulatedState();
  assertConvergesForScope(state, "project");
});

test("SC#4 (user): build-from-state + merge + plan = empty (deepEqual)", async () => {
  const state = await loadPopulatedState();
  assertConvergesForScope(state, "user");
});
