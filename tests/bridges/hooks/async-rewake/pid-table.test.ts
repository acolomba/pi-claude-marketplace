import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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

// HOOK-06 / NFR-1 / NFR-10: pid-table.ts is the persistence-leaf for
// the asyncRewake registry's orphan-reap pass. Tests exercise the
// containment-guarded read/write/unlink helpers and the never-throws
// contract.

async function makeProjectScope(): Promise<{
  loc: ReturnType<typeof locationsFor>;
  cleanup: () => Promise<void>;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "pid-table-test-"));
  const loc = locationsFor("project", root);
  return {
    loc,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

test("pid-table: ASYNC_REWAKE_PID_TABLE_VERSION === 1 (hardcoded discriminator)", () => {
  assert.equal(ASYNC_REWAKE_PID_TABLE_VERSION, 1);
});

test("pid-table: ASYNC_REWAKE_PIDS_FILENAME is async-rewake-pids.json", () => {
  assert.equal(ASYNC_REWAKE_PIDS_FILENAME, "async-rewake-pids.json");
});

test("pid-table: pidTablePath() composes <dataRoot>/_shared/async-rewake-pids.json", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const p = pidTablePath(loc);
    assert.equal(
      p.endsWith(path.join("pi-claude-marketplace", "data", "_shared", "async-rewake-pids.json")),
      true,
      `unexpected path: ${p}`,
    );
  } finally {
    await cleanup();
  }
});

test("pid-table: readPidTable returns [] when the file does not exist (ENOENT)", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const entries = await readPidTable(loc);
    assert.deepEqual(entries, []);
  } finally {
    await cleanup();
  }
});

test("pid-table: readPidTable returns [] on malformed JSON (no throw)", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const filePath = pidTablePath(loc);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "not-json{", "utf8");
    const entries = await readPidTable(loc);
    assert.deepEqual(entries, []);
  } finally {
    await cleanup();
  }
});

test("pid-table: readPidTable returns [] on shape mismatch (version != 1)", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const filePath = pidTablePath(loc);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ version: 2, entries: [] }), "utf8");
    const entries = await readPidTable(loc);
    assert.deepEqual(entries, []);
  } finally {
    await cleanup();
  }
});

test("pid-table: readPidTable returns [] on shape mismatch (entries not array)", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const filePath = pidTablePath(loc);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ version: 1, entries: "nope" }), "utf8");
    const entries = await readPidTable(loc);
    assert.deepEqual(entries, []);
  } finally {
    await cleanup();
  }
});

test("pid-table: writePidTable + readPidTable round-trips a single entry", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const entry: PidTableEntry = {
      pid: 12345,
      dispatchId: "00000000-0000-4000-8000-000000000000",
      scope: "project",
      marketplace: "official",
      plugin: "foo",
      spawnedAt: "2026-06-15T20:14:32.123Z",
    };
    await writePidTable(loc, [entry]);
    const entries = await readPidTable(loc);
    assert.deepEqual(entries, [entry]);
  } finally {
    await cleanup();
  }
});

test("pid-table: writePidTable writes the version=1 envelope", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    await writePidTable(loc, []);
    const raw = await readFile(pidTablePath(loc), "utf8");
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, 1);
    assert.deepEqual(parsed.entries, []);
  } finally {
    await cleanup();
  }
});

test("pid-table: writePidTable does not mutate the caller's array", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    const original: PidTableEntry[] = [
      {
        pid: 1,
        dispatchId: "id-1",
        scope: "project",
        marketplace: "m",
        plugin: "p",
        spawnedAt: "2026-06-15T00:00:00.000Z",
      },
    ];
    const snapshot = [...original];
    await writePidTable(loc, original);
    assert.deepEqual(original, snapshot);
  } finally {
    await cleanup();
  }
});

test("pid-table: unlinkPidTable is a no-op when the file is absent", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    await assert.doesNotReject(() => unlinkPidTable(loc));
    assert.deepEqual(await readPidTable(loc), []);
  } finally {
    await cleanup();
  }
});

test("pid-table: unlinkPidTable removes a present file", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    await writePidTable(loc, []);
    await unlinkPidTable(loc);
    assert.deepEqual(await readPidTable(loc), []);
  } finally {
    await cleanup();
  }
});

test("pid-table: writePidTable on first call creates parent dirs (cold start)", async () => {
  const { loc, cleanup } = await makeProjectScope();
  try {
    // dataRoot/_shared does not yet exist when this runs.
    await writePidTable(loc, []);
    const raw = await readFile(pidTablePath(loc), "utf8");
    assert.match(raw, /"version": 1/);
  } finally {
    await cleanup();
  }
});
