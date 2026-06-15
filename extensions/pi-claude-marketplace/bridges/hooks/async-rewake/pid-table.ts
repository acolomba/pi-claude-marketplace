// bridges/hooks/async-rewake/pid-table.ts
//
// HOOK-06 / EXEC-05 / D-62-05 persistence-leaf for the asyncRewake
// registry's orphan-reap pass. Holds the on-disk record of every
// asyncRewake child this process spawned (the in-memory registry is
// the source of truth during the process lifetime; the disk file is
// the only signal a subsequent process can use to clean up children
// orphaned by a parent crash or hard SIGKILL).
//
// File shape: `{ version: 1, entries: PidTableEntry[] }`. The
// `version` discriminator is hardcoded at 1 so a future v1.14+
// migration is unambiguous -- a reader that does not recognize the
// version returns `[]` (NFR-3 fail-clean) and the orphan-reap pass
// safely skips. Each entry carries the pid + a `dispatchId` UUID +
// the routing tuple (scope / marketplace / plugin) + ISO 8601
// spawnedAt timestamp. The dispatchId is mirrored into the child's
// environment under PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH so the
// orphan-reap pass can probe `/proc/<pid>/environ` on Linux and
// refuse to SIGKILL pids that don't match (defense against pid
// recycling -- the same numeric pid may belong to a stranger
// process by the time we read the table).
//
// Atomic writes (NFR-1): every disk mutation goes through
// `atomicWriteJson` (tmp + fsync + rename via write-file-atomic).
// `mkdir(path.dirname, { recursive: true })` lives inside
// `atomicWriteJson` so cold-start (no `_shared/` dir yet) is handled
// without an extra round-trip here.
//
// Path containment (NFR-10): every read / write / unlink call site
// is preceded by `assertPathInside(loc.dataRoot, pidTablePath(loc),
// "...")`. The composed path is hard-coded -- no untrusted name
// component participates -- so this guard is defense-in-depth, but
// the chokepoint stays uniform across every bridge that touches
// extension-owned filesystem state.
//
// Never-throws contract: `readPidTable` / `writePidTable` /
// `unlinkPidTable` ALL trap their own exceptions, debug-log them at
// the OBS-01 seam (`hookDebugLog`), and return / resolve without
// escape. The orphan-reap pass treats every failure as fail-clean
// (NFR-3): missing data simply means no orphans to reap.

import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { atomicWriteJson } from "../../../shared/atomic-json.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { assertPathInside } from "../../../shared/path-safety.ts";

import type { ScopedLocations } from "../../../persistence/locations.ts";

/** D-62-05: on-disk filename for the per-scope pid table. */
export const ASYNC_REWAKE_PIDS_FILENAME = "async-rewake-pids.json";

/**
 * D-62-05: hardcoded envelope discriminator. v1.14+ migrations bump
 * this constant and the reader's shape probe atomically; readers that
 * predate the bump see an unknown version and fall back to `[]`.
 */
export const ASYNC_REWAKE_PID_TABLE_VERSION = 1;

/**
 * One row in the pid table. Fields are populated by the registry at
 * spawn time:
 *
 *   - `pid`: from `child.pid` after spawn.
 *   - `dispatchId`: from `crypto.randomUUID()` -- mirrored into the
 *     child's env as `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH` so the
 *     orphan-reap pass can verify ownership.
 *   - `scope`, `marketplace`, `plugin`: from the `RoutingEntry` the
 *     dispatcher passed into the registry.
 *   - `spawnedAt`: `new Date().toISOString()` at registration time.
 */
export interface PidTableEntry {
  readonly pid: number;
  readonly dispatchId: string;
  readonly scope: "user" | "project";
  readonly marketplace: string;
  readonly plugin: string;
  readonly spawnedAt: string;
}

/** Internal on-disk envelope; not exported. */
interface PidTableFile {
  readonly version: typeof ASYNC_REWAKE_PID_TABLE_VERSION;
  readonly entries: readonly PidTableEntry[];
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Compose the on-disk path for the pid table. Pure (no I/O). Hard-
 * coded suffix on `dataRoot` -- no untrusted name component
 * participates.
 */
export function pidTablePath(loc: ScopedLocations): string {
  return path.join(loc.dataRoot, "_shared", ASYNC_REWAKE_PIDS_FILENAME);
}

/**
 * Load the pid table. Returns `[]` on every failure mode (absent
 * file, malformed JSON, shape mismatch, unrecognized version). Never
 * throws. Debug-logs every non-ENOENT failure once at the OBS-01
 * seam.
 */
export async function readPidTable(loc: ScopedLocations): Promise<readonly PidTableEntry[]> {
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json read");
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      (parsed as { version?: unknown }).version === ASYNC_REWAKE_PID_TABLE_VERSION &&
      Array.isArray((parsed as { entries?: unknown }).entries)
    ) {
      return (parsed as PidTableFile).entries;
    }

    hookDebugLog("async-rewake: pid-table shape mismatch");
    return [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    hookDebugLog(`async-rewake: pid-table read failed: ${errorMessage(err)}`);
    return [];
  }
}

/**
 * Persist `entries` to the pid table. Atomic (tmp + rename + fsync
 * via write-file-atomic). Defensive-copies the caller's array so the
 * envelope is not aliased. Never throws -- debug-logs and resolves
 * with `undefined` on failure.
 */
export async function writePidTable(
  loc: ScopedLocations,
  entries: readonly PidTableEntry[],
): Promise<void> {
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json write");
    const payload: PidTableFile = {
      version: ASYNC_REWAKE_PID_TABLE_VERSION,
      entries: [...entries],
    };
    await atomicWriteJson(filePath, payload);
  } catch (err) {
    hookDebugLog(`async-rewake: pid-table write failed: ${errorMessage(err)}`);
  }
}

/**
 * Remove the pid table. No-op on ENOENT. Never throws -- debug-logs
 * and resolves with `undefined` on any other failure.
 */
export async function unlinkPidTable(loc: ScopedLocations): Promise<void> {
  const filePath = pidTablePath(loc);
  try {
    await assertPathInside(loc.dataRoot, filePath, "async-rewake-pids.json unlink");
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    hookDebugLog(`async-rewake: pid-table unlink failed: ${errorMessage(err)}`);
  }
}
