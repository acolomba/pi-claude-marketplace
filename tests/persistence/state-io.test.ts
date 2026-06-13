import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  DEFAULT_STATE,
  STATE_VALIDATOR,
  type ExtensionState,
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * ST-1, ST-6 -- state.json load/save behavior.
 *
 * Each test creates an isolated tmpdir representing the extensionRoot and
 * cleans up afterwards. Round-trip uses saveState followed by loadState.
 * The missing-file / empty-`{}` cases verify ENOENT and structurally-empty
 * states return the canonical DEFAULT_STATE shape.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/legacy");

async function tmpExtensionRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-state-test-"));
  const root = path.join(dir, "pi-claude-marketplace");
  await mkdir(root, { recursive: true });
  // Cleanup retries with a short sleep -- ST-4 fire-and-forget persists
  // can land between our `rm`'s readdir and rmdir, raising ENOTEMPTY.
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }

        throw err;
      }
    }
  };

  return { root, cleanup };
}

test("loadState on missing state.json returns DEFAULT_STATE", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const got = await loadState(root);
    assert.deepEqual(got, { schemaVersion: 1, marketplaces: {} });
  } finally {
    await cleanup();
  }
});

test("loadState on empty {} state.json returns DEFAULT_STATE shape", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    await writeFile(path.join(root, "state.json"), "{}");
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 1);
    assert.deepEqual(got.marketplaces, {});
  } finally {
    await cleanup();
  }
});

test("ST-1 saveState + loadState round-trip preserves marketplace shape", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const state: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "user",
          source: { kind: "path", raw: "./local", logical: "./local" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/mp1/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/mp1",
          plugins: {},
        },
      },
    };
    await saveState(root, state);
    const stateOnDisk = JSON.parse(await readFile(path.join(root, "state.json"), "utf8")) as {
      schemaVersion: number;
      marketplaces: Record<string, { name: string }>;
    };
    assert.equal(stateOnDisk.schemaVersion, 1);
    assert.equal(stateOnDisk.marketplaces["mp1"]?.name, "mp1");

    const reloaded = await loadState(root);
    const mp1 = (reloaded.marketplaces as Record<string, { name: string }>)["mp1"];
    assert.equal(mp1?.name, "mp1");
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState classifies legacy raw-string source via pathSource (v0 fixture)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn in this test: the fire-and-forget
  // persistMigratedState call may race the cleanup `rm` and emit ENOENT
  // -- that's expected library behavior under the test harness, not a
  // regression. The IL-3 callsite itself is exercised in migrate.test.ts.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    const fixtureRaw = await readFile(path.join(FIXTURES, "v0-no-schemaversion.json"), "utf8");
    await writeFile(path.join(root, "state.json"), fixtureRaw);
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 1);
    const mp = (got.marketplaces as Record<string, { source: unknown }>)["alpha"];
    assert.ok(mp);
    // Source revalidated to ParsedSource object form
    const src = mp.source as { kind: string };
    assert.equal(src.kind, "path");
    // ST-4 best-effort persist is fire-and-forget; let it finish before
    // cleanup so we don't race the rm. write-file-atomic queues + fsyncs;
    // a few microtasks plus a setImmediate is enough to flush.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState rejects state.json with malformed source object", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const malformed = {
      schemaVersion: 1,
      marketplaces: {
        bad: {
          name: "bad",
          scope: "user",
          source: { kind: "no-such-kind", raw: "x" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/bad/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/bad",
          plugins: {},
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(malformed));
    await assert.rejects(() => loadState(root), /malformed source/);
  } finally {
    await cleanup();
  }
});

test("ST-6 loadState accepts forward-compat unknown-kind source verbatim (NFR-12)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const forwardCompat = {
      schemaVersion: 1,
      marketplaces: {
        future: {
          name: "future",
          scope: "user",
          source: { kind: "unknown", raw: "future-spec://x", reason: "forward-compat" },
          addedFromCwd: "/cwd",
          manifestPath: "/abs/future/.claude-plugin/marketplace.json",
          marketplaceRoot: "/abs/future",
          plugins: {},
        },
      },
    };
    await writeFile(path.join(root, "state.json"), JSON.stringify(forwardCompat));
    const got = await loadState(root);
    const mp = (got.marketplaces as Record<string, { source: unknown }>)["future"];
    assert.ok(mp);
    const src = mp.source as { kind: string };
    assert.equal(src.kind, "unknown");
  } finally {
    await cleanup();
  }
});

test("loadState rejects state.json that is not valid JSON", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    await writeFile(path.join(root, "state.json"), "{ this is not json");
    await assert.rejects(() => loadState(root), /not valid JSON/);
  } finally {
    await cleanup();
  }
});

test("saveState refuses invalid in-memory state (caller-bug guard)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    const bad = { schemaVersion: 1, marketplaces: { x: { not: "valid" } } };
    await assert.rejects(
      () => saveState(root, bad as unknown as ExtensionState),
      /failed schema validation/,
    );
  } finally {
    await cleanup();
  }
});

test("STATE_VALIDATOR exports a JIT-compiled validator (D-07)", () => {
  assert.equal(typeof STATE_VALIDATOR.Check, "function");
  assert.equal(STATE_VALIDATOR.Check(DEFAULT_STATE), true);
  assert.equal(STATE_VALIDATOR.Check({ schemaVersion: 2, marketplaces: {} }), false);
});

test("SPLIT-01: legacy state.json with autoupdate still loads (typebox lenient)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    const fixtureRaw = await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8");
    await writeFile(path.join(root, "state.json"), fixtureRaw);
    // D-13 gate is CLOSED here because no <scopeRoot>/claude-plugins.json
    // exists alongside the tmp extensionRoot -- the migrator preserves the
    // legacy `autoupdate` in-memory for the first-run migration to capture, while the
    // STATE_SCHEMA carve-out (autoupdate removed from MARKETPLACE_RECORD_SCHEMA)
    // means the lenient typebox default ACCEPTS the extra property at the
    // schema gate. Both halves must hold for the load to succeed.
    const got = await loadState(root);
    assert.equal(got.schemaVersion, 1);
    const mp = (got.marketplaces as Record<string, { name: string }>)["mp-with-autoupdate"];
    assert.ok(mp);
    assert.equal(mp.name, "mp-with-autoupdate");
    // Flush fire-and-forget persist.
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  } finally {
    await cleanup();
  }
});

test("D-13 GATE OPEN through loadState: sibling claude-plugins.json triggers the autoupdate scrub (in-memory + persisted)", async (t) => {
  const { root, cleanup } = await tmpExtensionRoot();
  // Suppress the IL-3 sanctioned warn: ST-4 fire-and-forget persist may race
  // the cleanup `rm`, surfacing as a harmless persist failure.
  t.mock.method(console, "warn", () => {
    // suppress noise
  });
  try {
    // `root` is <scopeRoot>/pi-claude-marketplace; the D-13 gate path is the
    // SIBLING <scopeRoot>/claude-plugins.json. Materializing it here proves
    // loadState's internal derivation (path.dirname(extensionRoot) join)
    // actually points at the file the gate is specified against -- the scrub
    // must fire end-to-end through loadState, not just at the migrator unit.
    const scopeRoot = path.dirname(root);
    await writeFile(path.join(scopeRoot, "claude-plugins.json"), "{}", "utf8");
    const fixtureRaw = await readFile(path.join(FIXTURES, "state-with-autoupdate.json"), "utf8");
    const stateJsonPath = path.join(root, "state.json");
    await writeFile(stateJsonPath, fixtureRaw);

    const got = await loadState(root);
    const mp = (got.marketplaces as Record<string, Record<string, unknown>>)["mp-with-autoupdate"];
    assert.ok(mp);
    // Gate OPEN -> the legacy autoupdate flag is scrubbed from the in-memory record.
    assert.equal(mp["autoupdate"], undefined);

    // Flush the ST-4 fire-and-forget persist, then assert the scrub was
    // persisted: the on-disk state.json no longer carries the flag either.
    // write-file-atomic performs real fs work (write + fsync + rename), so
    // poll with a short backoff instead of relying on a fixed tick count.
    let persisted: { marketplaces: Record<string, Record<string, unknown>> } | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      persisted = JSON.parse(await readFile(stateJsonPath, "utf8")) as {
        marketplaces: Record<string, Record<string, unknown>>;
      };
      if (persisted.marketplaces["mp-with-autoupdate"]?.["autoupdate"] === undefined) {
        break;
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }

    assert.ok(persisted);
    assert.equal(persisted.marketplaces["mp-with-autoupdate"]?.["autoupdate"], undefined);
  } finally {
    await cleanup();
  }
});

test("D-13 drift guard: loadState's configJsonPath derivation matches locationsFor byte-for-byte", () => {
  // loadState derives the gate path as
  // path.join(path.dirname(extensionRoot), "claude-plugins.json") without
  // importing locationsFor (its external signature must stay
  // loadState(extensionRoot)). Pin the equivalence so a future edit to
  // either construction cannot silently divert the D-13 gate.
  const loc = locationsFor("project", path.join(tmpdir(), "drift-guard-cwd"));
  assert.equal(
    path.join(path.dirname(loc.extensionRoot), "claude-plugins.json"),
    loc.configJsonPath,
  );
});

test("SPLIT-01 / D-12: STATE_SCHEMA.schemaVersion stays Type.Literal(1) (saveState refuses schemaVersion: 2)", async () => {
  const { root, cleanup } = await tmpExtensionRoot();
  try {
    // The compile-time `Type.Literal(1)` forces the cast below; the runtime
    // STATE_VALIDATOR.Check inside saveState must REFUSE because the on-disk
    // contract is locked at schemaVersion 1 (D-12: no STATE_SCHEMA bump).
    const bumped = {
      schemaVersion: 2 as 1,
      marketplaces: {},
    } as ExtensionState;
    await assert.rejects(() => saveState(root, bumped), /failed schema validation/);
  } finally {
    await cleanup();
  }
});
