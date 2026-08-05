import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";

import {
  collectBinDirs,
  recomputePluginPath,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin-path.ts";
import {
  PATH_LEDGER_ENV,
  applyPathLedger,
} from "../../extensions/pi-claude-marketplace/shared/session-env.ts";

import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

/**
 * Contract for the PENV-01 plugin-PATH recompute + the pi-only
 * `PI_CLAUDE_MARKETPLACE_PATH` env-var ledger (D-90-01).
 *
 * `applyPathLedger` (shared/) is pure -- no `process.env`, no fs -- and
 * `collectBinDirs` (orchestrators/) reads no `process.env` and touches no fs;
 * both are exercised exhaustively without disk. `recomputePluginPath` is the
 * thin I/O shell wired over both scopes; it is exercised against seeded
 * `state.json` fixtures under temp roots.
 */

function makeRecord(resolvedSource: string, enabled: boolean): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled,
    installedAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
}

function makeState(
  plugins: Record<string, { resolvedSource: string; enabled: boolean }>,
  sourceRoot: string,
): ExtensionState {
  const pluginRecords: Record<string, PluginInstallRecord> = {};
  for (const [name, p] of Object.entries(plugins)) {
    pluginRecords[name] = makeRecord(p.resolvedSource, p.enabled);
  }

  return {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "user",
        source: { kind: "path", raw: sourceRoot },
        addedFromCwd: "/tmp",
        manifestPath: join(sourceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: sourceRoot,
        plugins: pluginRecords,
      },
    },
  };
}

test("collectBinDirs: yields <resolvedSource>/bin for enabled records, excludes disabled", () => {
  const state = makeState(
    {
      alpha: { resolvedSource: "/plugins/alpha", enabled: true },
      beta: { resolvedSource: "/plugins/beta", enabled: false },
      gamma: { resolvedSource: "/plugins/gamma", enabled: true },
    },
    "/plugins",
  );

  assert.deepEqual(collectBinDirs(state), [
    join("/plugins/alpha", "bin"),
    join("/plugins/gamma", "bin"),
  ]);
});

test("collectBinDirs: empty state yields no dirs", () => {
  assert.deepEqual(collectBinDirs({ schemaVersion: 2, marketplaces: {} }), []);
});

test("WR-01 collectBinDirs: drops records with a non-absolute or empty resolvedSource", () => {
  // asAbsolutePluginRoot rejects empty/relative/traversal resolvedSource, so a
  // corrupted record can never compose a CWE-426 relative PATH entry; only the
  // absolute sibling survives.
  const state = makeState(
    {
      good: { resolvedSource: "/plugins/good", enabled: true },
      relative: { resolvedSource: "plugins/relative", enabled: true },
      empty: { resolvedSource: "", enabled: true },
    },
    "/plugins",
  );

  assert.deepEqual(collectBinDirs(state), [join("/plugins/good", "bin")]);
});

test("applyPathLedger: appends fresh bin dirs after existing entries (never prepend)", () => {
  const current = ["/usr/bin", "/bin"].join(delimiter);
  const result = applyPathLedger(current, "", ["/plugins/alpha/bin"]);

  assert.equal(result.path, ["/usr/bin", "/bin", "/plugins/alpha/bin"].join(delimiter));
  assert.equal(result.ledger, "/plugins/alpha/bin");
});

test("applyPathLedger: adds a bin dir even when it does not exist on disk (no fs stat)", () => {
  const current = "/usr/bin";
  const nonexistent = "/definitely/not/on/disk/plugins/x/bin";
  const result = applyPathLedger(current, "", [nonexistent]);

  assert.equal(result.path, ["/usr/bin", nonexistent].join(delimiter));
  assert.equal(result.ledger, nonexistent);
});

test("applyPathLedger: dedupes a fresh dir already present and is idempotent", () => {
  const current = ["/usr/bin", "/plugins/alpha/bin"].join(delimiter);
  // /plugins/alpha/bin is already on PATH but NOT owned (empty priorLedger):
  // it must be skipped from append and must NOT enter the ledger.
  const first = applyPathLedger(current, "", ["/plugins/alpha/bin", "/plugins/beta/bin"]);

  assert.equal(first.path, ["/usr/bin", "/plugins/alpha/bin", "/plugins/beta/bin"].join(delimiter));
  assert.equal(first.ledger, "/plugins/beta/bin");

  // Idempotency: thread the returned ledger back in as priorLedger.
  const second = applyPathLedger(first.path, first.ledger, [
    "/plugins/alpha/bin",
    "/plugins/beta/bin",
  ]);
  assert.equal(second.path, first.path);
  assert.equal(second.ledger, first.ledger);
});

test("applyPathLedger: non-owned entry equal to a fresh dir is never removed", () => {
  const current = ["/usr/bin", "/plugins/alpha/bin"].join(delimiter);
  const result = applyPathLedger(current, "", ["/plugins/alpha/bin"]);

  // The pre-existing (non-owned) /plugins/alpha/bin survives; nothing enters
  // the ledger because it was already present.
  assert.equal(result.path, ["/usr/bin", "/plugins/alpha/bin"].join(delimiter));
  assert.equal(result.ledger, "");
});

test("applyPathLedger: reload-durable cleanup removes an uninstalled plugin via the ledger", () => {
  // Seed: two owned entries on PATH, both recorded in the ledger (as they would
  // be after a prior recompute that survived /reload on process.env).
  const seededPath = ["/usr/bin", "/plugins/alpha/bin", "/plugins/beta/bin"].join(delimiter);
  const seededLedger = ["/plugins/alpha/bin", "/plugins/beta/bin"].join(delimiter);

  // beta was uninstalled between loads -> only alpha in the fresh set.
  const result = applyPathLedger(seededPath, seededLedger, ["/plugins/alpha/bin"]);

  assert.equal(result.path, ["/usr/bin", "/plugins/alpha/bin"].join(delimiter));
  assert.equal(result.ledger, "/plugins/alpha/bin");
  // No stale beta entry survives.
  assert.ok(!result.path.split(delimiter).includes("/plugins/beta/bin"));
});

test("applyPathLedger: zero fresh dirs removes prior-owned entries and empties the ledger", () => {
  const seededPath = ["/usr/bin", "/plugins/alpha/bin"].join(delimiter);
  const seededLedger = "/plugins/alpha/bin";

  const result = applyPathLedger(seededPath, seededLedger, []);

  assert.equal(result.path, "/usr/bin");
  assert.equal(result.ledger, "");
});

test("applyPathLedger: zero-plugin round-trip preserves a `::` empty segment byte-identical (PENV-01 non-interference)", () => {
  const current = ["/usr/bin", "", "/bin"].join(delimiter);
  const result = applyPathLedger(current, "", []);

  assert.equal(result.path, current);
  assert.equal(result.ledger, "");
});

test("applyPathLedger: preserves a leading empty PATH segment", () => {
  const current = ["", "/usr/bin"].join(delimiter);
  const result = applyPathLedger(current, "", []);

  assert.equal(result.path, current);
});

test("applyPathLedger: preserves a trailing empty PATH segment", () => {
  const current = ["/usr/bin", ""].join(delimiter);
  const result = applyPathLedger(current, "", []);

  assert.equal(result.path, current);
});

test("applyPathLedger: removes an owned entry while a neighboring empty segment survives", () => {
  const current = ["/usr/bin", "", "/a/bin"].join(delimiter);
  const result = applyPathLedger(current, "/a/bin", []);

  assert.equal(result.path, ["/usr/bin", ""].join(delimiter));
  assert.equal(result.ledger, "");
});

test("applyPathLedger: an empty PATH string is zero entries, so append never introduces a leading empty segment", () => {
  const result = applyPathLedger("", "", ["/a/bin"]);

  assert.equal(result.path, "/a/bin");
  assert.equal(result.ledger, "/a/bin");
});

test("applyPathLedger: preserves an empty segment while appending a fresh dir", () => {
  const current = ["/usr/bin", "", "/bin"].join(delimiter);
  const result = applyPathLedger(current, "", ["/a/bin"]);

  assert.equal(result.path, ["/usr/bin", "", "/bin", "/a/bin"].join(delimiter));
});

test("applyPathLedger: duplicate dirs within freshBinDirs land once on PATH and once in the ledger", () => {
  // Two scopes can derive the same bin dir; the append dedupes against itself,
  // so a doubled fresh dir produces exactly one PATH entry and one ledger entry.
  const result = applyPathLedger("/usr/bin", "", ["/a/bin", "/a/bin"]);

  assert.equal(result.path, ["/usr/bin", "/a/bin"].join(delimiter));
  assert.equal(result.ledger, "/a/bin");
});

test("applyPathLedger: a relative prior-ledger entry is not owned and is never removed from PATH", () => {
  // The ledger's write side only records absolute dirs, so a relative entry
  // means tampering/corruption. The read side filters owned entries to
  // absolute paths: the matching relative PATH segment survives verbatim and
  // the corrupt ledger entry does not carry forward.
  const current = ["/usr/bin", "rel/bin"].join(delimiter);
  const result = applyPathLedger(current, "rel/bin", []);

  assert.equal(result.path, current);
  assert.equal(result.ledger, "");
});

test("PATH_LEDGER_ENV is the pi-only bookkeeping var name", () => {
  assert.equal(PATH_LEDGER_ENV, "PI_CLAUDE_MARKETPLACE_PATH");
});

// --- recomputePluginPath I/O shell (both scopes, seeded state.json) ---

async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(join(extensionRoot, "state.json"), JSON.stringify(state), "utf8");
}

// Restore the specific env keys these tests manipulate with literal-key
// deletes (mirrors tests/shared/debug-log.test.ts; no dynamic delete).
function restorePathEnv(snapshot: {
  home: string | undefined;
  agentDir: string | undefined;
  path: string | undefined;
  ledger: string | undefined;
}): void {
  if (snapshot.home === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = snapshot.home;
  }

  if (snapshot.agentDir === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = snapshot.agentDir;
  }

  if (snapshot.path === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = snapshot.path;
  }

  if (snapshot.ledger === undefined) {
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;
  } else {
    process.env.PI_CLAUDE_MARKETPLACE_PATH = snapshot.ledger;
  }
}

function snapshotPathEnv(): {
  home: string | undefined;
  agentDir: string | undefined;
  path: string | undefined;
  ledger: string | undefined;
} {
  return {
    home: process.env.HOME,
    agentDir: process.env.PI_CODING_AGENT_DIR,
    path: process.env.PATH,
    ledger: process.env.PI_CLAUDE_MARKETPLACE_PATH,
  };
}

test("recomputePluginPath: appends both user and project scope bin dirs, records the ledger", async () => {
  const snapshot = snapshotPathEnv();
  const userRoot = await mkdtemp(join(tmpdir(), "senv-user-"));
  const projRoot = await mkdtemp(join(tmpdir(), "senv-proj-"));

  try {
    // user scope resolves via PI_CODING_AGENT_DIR (getAgentDir honors it first).
    process.env.PI_CODING_AGENT_DIR = userRoot;
    process.env.HOME = userRoot;
    process.env.PATH = "/usr/bin";
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    await seedState(
      join(userRoot, "pi-claude-marketplace"),
      makeState({ userplug: { resolvedSource: "/plugins/userplug", enabled: true } }, "/plugins"),
    );
    await seedState(
      join(projRoot, ".pi", "pi-claude-marketplace"),
      makeState({ projplug: { resolvedSource: "/plugins/projplug", enabled: true } }, "/plugins"),
    );

    await recomputePluginPath(projRoot);

    const entries = (process.env.PATH ?? "").split(delimiter);
    // user scope before project scope (D-90-04 deterministic order).
    assert.deepEqual(entries, [
      "/usr/bin",
      join("/plugins/userplug", "bin"),
      join("/plugins/projplug", "bin"),
    ]);
    assert.equal(
      process.env.PI_CLAUDE_MARKETPLACE_PATH,
      [join("/plugins/userplug", "bin"), join("/plugins/projplug", "bin")].join(delimiter),
    );
  } finally {
    restorePathEnv(snapshot);
    await rm(userRoot, { recursive: true, force: true });
    await rm(projRoot, { recursive: true, force: true });
  }
});

test("recomputePluginPath: a malformed user state.json is reported as skipped; the healthy project scope still contributes", async () => {
  const snapshot = snapshotPathEnv();
  const userRoot = await mkdtemp(join(tmpdir(), "senv-bad-"));
  const projRoot = await mkdtemp(join(tmpdir(), "senv-badproj-"));

  try {
    process.env.PI_CODING_AGENT_DIR = userRoot;
    process.env.HOME = userRoot;
    process.env.PATH = "/usr/bin";
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    const extRoot = join(userRoot, "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    await writeFile(join(extRoot, "state.json"), "{ not valid json", "utf8");

    await seedState(
      join(projRoot, ".pi", "pi-claude-marketplace"),
      makeState({ projplug: { resolvedSource: "/plugins/projplug", enabled: true } }, "/plugins"),
    );

    const { skipped } = await recomputePluginPath(projRoot);

    // Scope isolation: the corrupt user scope is reported, not thrown, and the
    // healthy project scope's bin dir still lands on PATH.
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0]!.scope, "user");
    assert.ok(skipped[0]!.reason.length > 0, "skipped scope carries a non-empty reason");
    const entries = (process.env.PATH ?? "").split(delimiter);
    assert.deepEqual(entries, ["/usr/bin", join("/plugins/projplug", "bin")]);
  } finally {
    restorePathEnv(snapshot);
    await rm(userRoot, { recursive: true, force: true });
    await rm(projRoot, { recursive: true, force: true });
  }
});

test("recomputePluginPath: a malformed project state.json is reported as skipped; the healthy user scope still contributes", async () => {
  const snapshot = snapshotPathEnv();
  const userRoot = await mkdtemp(join(tmpdir(), "senv-gooduser-"));
  const projRoot = await mkdtemp(join(tmpdir(), "senv-badproj2-"));

  try {
    process.env.PI_CODING_AGENT_DIR = userRoot;
    process.env.HOME = userRoot;
    process.env.PATH = "/usr/bin";
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    await seedState(
      join(userRoot, "pi-claude-marketplace"),
      makeState({ userplug: { resolvedSource: "/plugins/userplug", enabled: true } }, "/plugins"),
    );

    const projExtRoot = join(projRoot, ".pi", "pi-claude-marketplace");
    await mkdir(projExtRoot, { recursive: true });
    await writeFile(join(projExtRoot, "state.json"), "{ not valid json", "utf8");

    const { skipped } = await recomputePluginPath(projRoot);

    assert.equal(skipped.length, 1);
    assert.equal(skipped[0]!.scope, "project");
    assert.ok(skipped[0]!.reason.length > 0, "skipped scope carries a non-empty reason");
    const entries = (process.env.PATH ?? "").split(delimiter);
    assert.deepEqual(entries, ["/usr/bin", join("/plugins/userplug", "bin")]);
  } finally {
    restorePathEnv(snapshot);
    await rm(userRoot, { recursive: true, force: true });
    await rm(projRoot, { recursive: true, force: true });
  }
});

test("recomputePluginPath: no plugins + empty prior ledger leaves a previously-unset PATH unset", async () => {
  const snapshot = snapshotPathEnv();
  const userRoot = await mkdtemp(join(tmpdir(), "senv-nopath-"));
  const projRoot = await mkdtemp(join(tmpdir(), "senv-nopathproj-"));

  try {
    process.env.PI_CODING_AGENT_DIR = userRoot;
    process.env.HOME = userRoot;
    // A previously-unset PATH must not be materialized as an empty string.
    delete process.env.PATH;
    delete process.env.PI_CLAUDE_MARKETPLACE_PATH;

    const { skipped } = await recomputePluginPath(projRoot);

    assert.deepEqual(skipped, []);
    assert.equal(process.env.PATH, undefined);
    assert.equal(process.env.PI_CLAUDE_MARKETPLACE_PATH, undefined);
  } finally {
    restorePathEnv(snapshot);
    await rm(userRoot, { recursive: true, force: true });
    await rm(projRoot, { recursive: true, force: true });
  }
});
