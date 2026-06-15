// extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
//
// Bridge-owned asyncRewake registry. Spawns hook children detached-but-in-
// parent-process-group, holds them in an in-memory Map keyed by a UUID
// dispatchId, watches each child for exit code 2, and on exit-2 injects
// (`rewakeMessage` + body) into Pi's model context via ctx.sendMessage with
// `display: false` matching Claude Code's <system-reminder> semantic.
//
// This is the THIRD of exactly THREE sanctioned `node:child_process` import
// sites in the extension tree (closed-set whitelist at
// tests/architecture/no-shell-out.test.ts). Adding a FOURTH site requires
// amending the whitelist set AND the sibling assertion in the SAME commit
// (D-58-01 atomic-supersession). The first two sites are
// platform/git-credential.ts (AUTH-08) and bridges/hooks/dispatch-exec.ts
// (EXEC-01..04 sync path). This site (HOOK-06 / EXEC-05 / D-62-01) diverges
// from the sync site: `detached: false` + the parent does NOT await child
// exit; a per-child handler watches for code 2 and triggers the HOOK-06
// injection contract.

import { spawn, type ChildProcess } from "node:child_process";

import type { ScopedLocations } from "../../../persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "../../../platform/pi-api.ts";
import type { RoutingEntry } from "../event-router.ts";

// ──────────────────────────────────────────────────────────────────────────
// Public surface (stubs -- bodies filled in the follow-up task)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Readonly registry entry shape. Fields will be populated by
 * `spawnAndRegister` once the body lands. Defined here so the public
 * symbol exists at this checkpoint without requiring every consumer to
 * import a placeholder type.
 */
export interface AsyncRewakeEntry {
  readonly dispatchId: string;
  readonly pid: number;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly pluginId: string;
  readonly claudeEvent: string;
  readonly spawnedAt: string;
  readonly rewakeMessage: string | undefined;
  readonly rewakeSummary: string | undefined;
  readonly child: ChildProcess;
  readonly capturedEpoch: number;
}

/**
 * Synchronous spawn + register seam. Resolves once the in-memory and
 * PID-table entries are persisted; child exit is observed asynchronously
 * by the per-child handler installed inside this function.
 */
export function spawnAndRegister(
  _entry: RoutingEntry,
  _event: unknown,
  _ctx: ExtensionContext,
  _pi: ExtensionAPI,
  _loc: ScopedLocations,
): Promise<void> {
  return Promise.reject(new Error("not yet implemented"));
}

/**
 * `/reload` cleanup walk. Iterates the in-memory registry and SIGKILLs
 * every tracked child best-effort. Idempotent.
 */
export function shutdownInMemoryChildren(): void {
  // body filled in the follow-up task
}

/**
 * Factory-entry orphan reap. Reads the per-scope PID table, probes each
 * recorded PID, and SIGKILLs only owned children (marker env match on
 * Linux; soft-skip on macOS / read failure / mismatch). Then unlinks the
 * table.
 */
export function reapOrphans(_loc: ScopedLocations): Promise<void> {
  // body filled in the follow-up task
  return Promise.resolve();
}

// `spawn` is intentionally imported but unused at this checkpoint so the
// closed-set architecture whitelist captures the call site in the same
// commit as the test amendment (D-58-01 atomic-supersession).
void spawn;
