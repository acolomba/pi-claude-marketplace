import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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

async function allocateRoot(t: TestContext, prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));

  return root;
}

async function allocateProjectScope(t: TestContext, prefix: string) {
  const root = await allocateRoot(t, prefix);

  return { root, locations: locationsFor("project", root) };
}

function setCaseEnvironment(t: TestContext, key: string, nextValue: string): void {
  const hadProperty = Object.hasOwn(process.env, key);
  const previousValue = process.env[key];
  t.after(() => {
    if (hadProperty) {
      process.env[key] = previousValue;
    } else {
      Reflect.deleteProperty(process.env, key);
    }
  });
  process.env[key] = nextValue;
}

function filesystemErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

function observeCompletion(operation: Promise<void>): Promise<unknown> {
  return operation;
}

function recordHookDiagnostics(t: TestContext): string[] {
  setCaseEnvironment(t, "PI_CLAUDE_MARKETPLACE_DEBUG", "1");
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (...parts: unknown[]): void => {
    diagnostics.push(parts.map(String).join(" "));
  });

  return diagnostics;
}

async function writeTableBytes(tablePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(tablePath), { recursive: true });
  await writeFile(tablePath, bytes);
}

async function blockSharedDirectory(dataRoot: string): Promise<string> {
  await mkdir(dataRoot, { recursive: true });
  const sharedPath = path.join(dataRoot, "_shared");
  await writeFile(sharedPath, "occupied by a regular file\n");

  return sharedPath;
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
  const writeCompletion = await observeCompletion(writePidTable(locations, entries));
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
  const unlinkCompletion = await observeCompletion(unlinkPidTable(locations));
  const finalState = await stat(tablePath).catch(filesystemErrorCode);

  // assert
  assert.strictEqual(ASYNC_REWAKE_PIDS_FILENAME, "async-rewake-pids.json");
  assert.strictEqual(ASYNC_REWAKE_PID_TABLE_VERSION, 1);
  assert.strictEqual(tablePath, expectedTablePath);
  assert.strictEqual(writeCompletion, undefined);
  assert.deepStrictEqual(storedEntries, expectedEntries);
  assert.strictEqual(storedBytes, expectedBytes);
  assert.strictEqual(unlinkCompletion, undefined);
  assert.strictEqual(finalState, "ENOENT");
});

test(
  "returns an empty table without diagnostics when the scoped file is absent",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-absent-");
    const diagnostics = recordHookDiagnostics(t);
    const expectedTablePath = path.join(locations.dataRoot, "_shared", "async-rewake-pids.json");

    // act
    const entries = await readPidTable(locations);
    const tableState = await stat(expectedTablePath).catch(filesystemErrorCode);

    // assert
    assert.deepStrictEqual(entries, []);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(diagnostics, []);
  },
);

test(
  "degrades malformed JSON to an empty table with a semantic diagnostic",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-malformed-");
    const diagnostics = recordHookDiagnostics(t);
    const tablePath = path.join(locations.dataRoot, "_shared", "async-rewake-pids.json");
    const malformedBytes = "not-json\n";
    await writeTableBytes(tablePath, malformedBytes);

    // act
    const entries = await readPidTable(locations);
    const storedBytes = await readFile(tablePath, "utf8");
    const diagnostic = diagnostics[0] ?? "";

    // assert
    assert.deepStrictEqual(entries, []);
    assert.strictEqual(storedBytes, malformedBytes);
    assert.deepStrictEqual(
      {
        count: diagnostics.length,
        category: diagnostic.includes("pid-table read failed"),
        parseFailure: diagnostic.includes("JSON"),
      },
      { count: 1, category: true, parseFailure: true },
    );
  },
);

for (const shapeCase of [
  { title: "null envelope", bytes: "null\n" },
  { title: "primitive envelope", bytes: '"entries"\n' },
  { title: "object without a version", bytes: '{"entries":[]}\n' },
  { title: "non-array entries", bytes: '{"version":1,"entries":{}}\n' },
  { title: "stale version", bytes: '{"version":2,"entries":[]}\n' },
] as const) {
  test(
    `degrades a ${shapeCase.title} to an empty table without changing stored bytes`,
    { concurrency: false },
    async (t) => {
      // arrange
      const { locations } = await allocateProjectScope(t, "pid-table-shape-");
      const diagnostics = recordHookDiagnostics(t);
      const tablePath = path.join(locations.dataRoot, "_shared", "async-rewake-pids.json");
      await writeTableBytes(tablePath, shapeCase.bytes);

      // act
      const entries = await readPidTable(locations);
      const storedBytes = await readFile(tablePath, "utf8");
      const diagnostic = diagnostics[0] ?? "";

      // assert
      assert.deepStrictEqual(entries, []);
      assert.strictEqual(storedBytes, shapeCase.bytes);
      assert.deepStrictEqual(
        {
          count: diagnostics.length,
          category: diagnostic.includes("pid-table shape mismatch"),
        },
        { count: 1, category: true },
      );
    },
  );
}

test(
  "keeps user and project PID tables in separate scoped roots",
  { concurrency: false },
  async (t) => {
    // arrange
    const userRoot = await allocateRoot(t, "pid-table-user-scope-");
    const projectRoot = await allocateRoot(t, "pid-table-project-scope-");
    setCaseEnvironment(t, "PI_CODING_AGENT_DIR", userRoot);
    const userLocations = locationsFor("user", projectRoot);
    const projectLocations = locationsFor("project", projectRoot);
    const userEntries: readonly PidTableEntry[] = [
      {
        pid: 1_001,
        dispatchId: "dispatch-user",
        scope: "user",
        marketplace: "user-catalog",
        plugin: "user-plugin",
        spawnedAt: "2026-08-30T13:00:00.000Z",
      },
    ];
    const projectEntries: readonly PidTableEntry[] = [
      {
        pid: 2_002,
        dispatchId: "dispatch-project",
        scope: "project",
        marketplace: "project-catalog",
        plugin: "project-plugin",
        spawnedAt: "2026-08-30T13:01:00.000Z",
      },
    ];
    const expectedUserPath = path.join(
      userRoot,
      "pi-claude-marketplace",
      "data",
      "_shared",
      "async-rewake-pids.json",
    );
    const expectedProjectPath = path.join(
      projectRoot,
      ".pi",
      "pi-claude-marketplace",
      "data",
      "_shared",
      "async-rewake-pids.json",
    );

    // act
    await writePidTable(userLocations, userEntries);
    await writePidTable(projectLocations, projectEntries);
    const storedUserEntries = await readPidTable(userLocations);
    const storedProjectEntries = await readPidTable(projectLocations);
    const userPath = pidTablePath(userLocations);
    const projectPath = pidTablePath(projectLocations);

    // assert
    assert.deepStrictEqual(
      { path: userPath, entries: storedUserEntries },
      { path: expectedUserPath, entries: userEntries },
    );
    assert.deepStrictEqual(
      { path: projectPath, entries: storedProjectEntries },
      { path: expectedProjectPath, entries: projectEntries },
    );
    assert.notStrictEqual(userPath, projectPath);
  },
);

test(
  "degrades a non-directory read boundary without changing the case tree",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-read-failure-");
    const diagnostics = recordHookDiagnostics(t);
    const sharedPath = await blockSharedDirectory(locations.dataRoot);
    const expectedTablePath = path.join(sharedPath, "async-rewake-pids.json");

    // act
    const entries = await readPidTable(locations);
    const sharedBytes = await readFile(sharedPath, "utf8");
    const dataRootEntries = await readdir(locations.dataRoot);
    const diagnostic = diagnostics[0] ?? "";

    // assert
    assert.deepStrictEqual(entries, []);
    assert.strictEqual(sharedBytes, "occupied by a regular file\n");
    assert.deepStrictEqual(dataRootEntries, ["_shared"]);
    assert.deepStrictEqual(
      {
        count: diagnostics.length,
        category: diagnostic.includes("pid-table read failed"),
        errorCode: diagnostic.includes("ENOTDIR"),
        path: diagnostic.includes(expectedTablePath),
      },
      { count: 1, category: true, errorCode: true, path: true },
    );
  },
);

test(
  "treats unlink of an absent PID table as a diagnostic-free no-op",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-unlink-absent-");
    const diagnostics = recordHookDiagnostics(t);
    const expectedTablePath = path.join(locations.dataRoot, "_shared", "async-rewake-pids.json");

    // act
    const unlinkCompletion = await observeCompletion(unlinkPidTable(locations));
    const tableState = await stat(expectedTablePath).catch(filesystemErrorCode);

    // assert
    assert.strictEqual(unlinkCompletion, undefined);
    assert.strictEqual(tableState, "ENOENT");
    assert.deepStrictEqual(diagnostics, []);
  },
);

test(
  "contains a PID-table write failure at a non-directory filesystem boundary",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-write-failure-");
    const diagnostics = recordHookDiagnostics(t);
    const sharedPath = await blockSharedDirectory(locations.dataRoot);
    const expectedTablePath = path.join(sharedPath, "async-rewake-pids.json");
    const entries: readonly PidTableEntry[] = [
      {
        pid: 3_003,
        dispatchId: "dispatch-write-failure",
        scope: "project",
        marketplace: "catalog",
        plugin: "plugin",
        spawnedAt: "2026-08-30T13:02:00.000Z",
      },
    ];

    // act
    const writeCompletion = await observeCompletion(writePidTable(locations, entries));
    const sharedBytes = await readFile(sharedPath, "utf8");
    const dataRootEntries = await readdir(locations.dataRoot);
    const diagnostic = diagnostics[0] ?? "";

    // assert
    assert.strictEqual(writeCompletion, undefined);
    assert.strictEqual(sharedBytes, "occupied by a regular file\n");
    assert.deepStrictEqual(dataRootEntries, ["_shared"]);
    assert.deepStrictEqual(
      {
        count: diagnostics.length,
        category: diagnostic.includes("pid-table write failed"),
        errorCode: /EEXIST|ENOTDIR/.test(diagnostic),
        path: diagnostic.includes(expectedTablePath) || diagnostic.includes(sharedPath),
      },
      { count: 1, category: true, errorCode: true, path: true },
    );
  },
);

test(
  "contains a PID-table unlink failure at a non-directory filesystem boundary",
  { concurrency: false },
  async (t) => {
    // arrange
    const { locations } = await allocateProjectScope(t, "pid-table-unlink-failure-");
    const diagnostics = recordHookDiagnostics(t);
    const sharedPath = await blockSharedDirectory(locations.dataRoot);
    const expectedTablePath = path.join(sharedPath, "async-rewake-pids.json");

    // act
    const unlinkCompletion = await observeCompletion(unlinkPidTable(locations));
    const sharedBytes = await readFile(sharedPath, "utf8");
    const dataRootEntries = await readdir(locations.dataRoot);
    const diagnostic = diagnostics[0] ?? "";

    // assert
    assert.strictEqual(unlinkCompletion, undefined);
    assert.strictEqual(sharedBytes, "occupied by a regular file\n");
    assert.deepStrictEqual(dataRootEntries, ["_shared"]);
    assert.deepStrictEqual(
      {
        count: diagnostics.length,
        category: diagnostic.includes("pid-table unlink failed"),
        errorCode: diagnostic.includes("ENOTDIR"),
        path: diagnostic.includes(expectedTablePath),
      },
      { count: 1, category: true, errorCode: true, path: true },
    );
  },
);
