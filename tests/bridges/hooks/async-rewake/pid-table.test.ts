import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  ASYNC_REWAKE_PID_TABLE_VERSION,
  ASYNC_REWAKE_PIDS_FILENAME,
  pidTablePath,
  readPidTable,
  unlinkPidTable,
  writePidTable,
  type PidTableEntry,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";

async function allocateProjectScope(t: TestContext, prefix: string) {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));

  return { root, locations: locationsFor("project", root) };
}

test("writes, reads, and unlinks one scoped PID table without aliasing the caller array", async (t) => {
  // arrange
  const { locations, root } = await allocateProjectScope(t, "pid-table-lifecycle-");
  const entries: PidTableEntry[] = [
    {
      pid: 4_321,
      dispatchId: "dispatch-project",
      scope: "project",
      marketplace: "catalog",
      plugin: "audit",
      spawnedAt: "2026-08-30T12:34:56.000Z",
    },
  ];
  const expectedEntries = [
    {
      pid: 4_321,
      dispatchId: "dispatch-project",
      scope: "project",
      marketplace: "catalog",
      plugin: "audit",
      spawnedAt: "2026-08-30T12:34:56.000Z",
    },
  ];
  const expectedTablePath = path.join(
    root,
    ".pi",
    "pi-claude-marketplace",
    "data",
    "_shared",
    "async-rewake-pids.json",
  );
  const expectedBytes =
    '{\n  "version": 1,\n  "entries": [\n    {\n      "pid": 4321,\n' +
    '      "dispatchId": "dispatch-project",\n      "scope": "project",\n' +
    '      "marketplace": "catalog",\n      "plugin": "audit",\n' +
    '      "spawnedAt": "2026-08-30T12:34:56.000Z"\n    }\n  ]\n}\n';

  // act
  const tablePath = pidTablePath(locations);
  const writeValue = await writePidTable(locations, entries);
  entries.push({
    pid: 9_876,
    dispatchId: "caller-only",
    scope: "project",
    marketplace: "caller",
    plugin: "mutation",
    spawnedAt: "2026-08-30T12:35:00.000Z",
  });
  const storedEntries = await readPidTable(locations);
  const storedBytes = await readFile(tablePath, "utf8");
  const unlinkValue = await unlinkPidTable(locations);
  const finalState = await stat(tablePath).catch((error: NodeJS.ErrnoException) => error.code);

  // assert
  assert.strictEqual(ASYNC_REWAKE_PIDS_FILENAME, "async-rewake-pids.json");
  assert.strictEqual(ASYNC_REWAKE_PID_TABLE_VERSION, 1);
  assert.strictEqual(tablePath, expectedTablePath);
  assert.strictEqual(writeValue, undefined);
  assert.deepStrictEqual(storedEntries, expectedEntries);
  assert.strictEqual(storedBytes, expectedBytes);
  assert.strictEqual(unlinkValue, undefined);
  assert.strictEqual(finalState, "ENOENT");
});
