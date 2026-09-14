// tests/integration/load-reconcile-race.test.ts
//
// RECON-06: two-process load-time apply race.
// + first-run migrate lock-coverage proof (discharges the
//   tests/persistence/migrate-config.test.ts hand-off).
//
// Test design constraint: what a contended reconcile guarantees is
// NON-CORRUPTION, not completion. The apply loop deliberately holds no outer
// lock (CR-01); each step takes the per-scope lock separately with
// `retries: 0` and soft-fails into a structured row when it loses, and
// marketplace source materialization is not atomic across processes. So a
// racer may lose every mutating step, and a round where BOTH do writes no
// state.json at all. The assertions split along that line:
//
//   - of the race itself: both children exit code 0 (NFR-2: neither process
//     throws past its handler boundary), any non-ok child carries the
//     StateLockHeldError marker, no orphaned staging directories, and
//     whatever state.json the race DID write is singular
//   - of the uncontended reconcile that follows: exactly one mp record +
//     exactly one plugin record. That is NFR-2's "a /reload converges"
//     contract, and running it is what keeps the record assertions
//     meaningful no matter who won the race -- or whether anybody did
//   - first-run migrate captures legacy autoupdate exactly once under the
//     cross-process lock
//   - D-13 gate single-process happy path produces a config that carries the
//     captured autoupdate
//
// Mirrors tests/integration/concurrent-install.test.ts for the fork + IPC +
// ready-sync harness; uses a path-source marketplace fixture so the test is
// fully network-free per NFR-5.

import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { STATE_LOCK_HELD_PREFIX } from "../../extensions/pi-claude-marketplace/shared/markers.ts";

interface ChildResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly notifyArgs: readonly { readonly message: string; readonly severity?: string }[];
}

interface RaceEnv {
  readonly cwd: string;
  readonly home: string;
  readonly cleanup: () => Promise<void>;
}

interface RaceOutcome {
  readonly first: ChildResult;
  readonly second: ChildResult;
  readonly firstExitCode: number | null;
  readonly secondExitCode: number | null;
}

const CHILD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "load-reconcile-race-child.ts",
);

async function setupRaceEnv(prefix: string): Promise<RaceEnv> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  const cwd = path.join(root, "project");
  const home = path.join(root, "home");
  await mkdir(cwd, { recursive: true });
  await mkdir(home, { recursive: true });
  return {
    cwd,
    home,
    cleanup: async (): Promise<void> => {
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

/**
 * Seed a path-source marketplace directory inside the project cwd. The
 * marketplace.json declares a single plugin pointing at a local plugin
 * directory with one SKILL.md, so applyReconcile's install pass can succeed
 * fully network-free (NFR-5).
 */
async function seedPathSourceMarketplace(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
}): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });

  const pluginRoot = path.join(marketplaceRoot, "plugins", opts.plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: opts.plugin, version: "1.0.0" }),
  );

  const skillDir = path.join(pluginRoot, "skills", "tool-00");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: tool-00\n---\n\nBody.\n`);

  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: opts.marketplace,
      plugins: [{ name: opts.plugin, source: `./plugins/${opts.plugin}`, version: "1.0.0" }],
    }),
  );
}

/** Write the user-authored claude-plugins.json declaring one mp + one plugin. */
async function writeConfig(cwd: string, body: unknown): Promise<void> {
  const projectScopeRoot = path.join(cwd, ".pi");
  await mkdir(projectScopeRoot, { recursive: true });
  await writeFile(
    path.join(projectScopeRoot, "claude-plugins.json"),
    JSON.stringify(body, null, 2),
  );
}

/**
 * Pre-record a marketplace in state.json BYPASSING saveState's schema check.
 * Used to seed the legacy `autoupdate` field on the marketplace record so
 * the D-13 gated migration path can capture it on the first load.
 * (saveState validates against STATE_SCHEMA, which does not declare
 * `autoupdate`, so the legacy-field test cannot use saveState directly.)
 */
async function seedStateRaw(cwd: string, raw: unknown): Promise<void> {
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(locations.stateJsonPath, JSON.stringify(raw, null, 2));
}

/** One reconcile child, forked but not yet released. */
function forkReconcileChild(env: RaceEnv): ReturnType<typeof fork> {
  return fork(CHILD_PATH, [], {
    cwd: env.cwd,
    env: { ...process.env, HOME: env.home, PI_CODING_AGENT_DIR: path.join(env.home, ".pi-agent") },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
}

/** Resolves on the child's `ready` handshake, before it is released. */
function waitReady(child: ReturnType<typeof fork>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      reject(new Error(`child exited ${String(code)} before ready`));
    });
    child.once("message", (message) => {
      if (message === "ready") {
        resolve();
      } else {
        reject(new Error(`unexpected child ready message: ${JSON.stringify(message)}`));
      }
    });
  });
}

/** Resolves with the child's reported result once it exits. */
function waitResult(
  child: ReturnType<typeof fork>,
  label: string,
): Promise<{ result: ChildResult; code: number | null }> {
  return new Promise((resolve, reject) => {
    let resultMessage: ChildResult | undefined;
    child.once("error", reject);
    child.once("message", (message) => {
      resultMessage = message as ChildResult;
    });
    child.once("exit", (code) => {
      if (resultMessage === undefined) {
        reject(new Error(`child ${label} exited ${String(code)} before result message`));
        return;
      }

      resolve({ result: resultMessage, code });
    });
  });
}

/**
 * Fork two children, await their `ready` signals (IPC sync barrier), then
 * release them simultaneously by sending the start payload. Mirrors the
 * harness in tests/integration/concurrent-install.test.ts.
 */
async function runRace(env: RaceEnv): Promise<RaceOutcome> {
  const first = forkReconcileChild(env);
  const second = forkReconcileChild(env);

  await Promise.all([waitReady(first), waitReady(second)]);

  const firstPromise = waitResult(first, "first");
  const secondPromise = waitResult(second, "second");

  // Release both simultaneously (the IPC `send` is the `go` signal).
  first.send({ cwd: env.cwd });
  second.send({ cwd: env.cwd });

  const [firstOutcome, secondOutcome] = await Promise.all([firstPromise, secondPromise]);
  return {
    first: firstOutcome.result,
    second: secondOutcome.result,
    firstExitCode: firstOutcome.code,
    secondExitCode: secondOutcome.code,
  };
}

/**
 * One reconcile with nobody to contend with -- the "run /reload again" half of
 * NFR-2. Every lock this pass takes is uncontested, so a converged end state is
 * a guarantee here in a way it is NOT during the race above.
 */
async function runUncontendedReconcile(
  env: RaceEnv,
): Promise<{ result: ChildResult; code: number | null }> {
  const child = forkReconcileChild(env);
  await waitReady(child);
  const settled = waitResult(child, "convergence");
  child.send({ cwd: env.cwd });
  return await settled;
}

/** Both children's reported output, for failure messages. */
function describeRace(outcome: RaceOutcome): string {
  return JSON.stringify({ first: outcome.first, second: outcome.second });
}

async function readStateRaw(cwd: string): Promise<{
  readonly marketplaces: Record<string, { readonly plugins: Record<string, unknown> }>;
}> {
  const locations = locationsFor("project", cwd);
  return JSON.parse(await readFile(locations.stateJsonPath, "utf8")) as {
    marketplaces: Record<string, { plugins: Record<string, unknown> }>;
  };
}

async function readConfigRaw(cwd: string): Promise<{
  readonly schemaVersion?: number;
  readonly marketplaces?: Record<
    string,
    { readonly source: string; readonly autoupdate?: boolean }
  >;
  readonly plugins?: Record<string, unknown>;
}> {
  const projectScopeRoot = path.join(cwd, ".pi");
  return JSON.parse(await readFile(path.join(projectScopeRoot, "claude-plugins.json"), "utf8")) as {
    schemaVersion?: number;
    marketplaces?: Record<string, { source: string; autoupdate?: boolean }>;
    plugins?: Record<string, unknown>;
  };
}

async function listAgentsStagingEntries(cwd: string): Promise<readonly string[]> {
  const locations = locationsFor("project", cwd);
  try {
    return (await readdir(locations.agentsStagingDir)).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Scenario A: RECON-06 core two-process race
// ---------------------------------------------------------------------------

test("RECON-06 (two-process race): config declares one path-source mp-a + plugin-a, two concurrent applyReconcile children corrupt nothing and orphan no staging, and the uncontended reconcile after them converges on exactly one mp record + one plugin record", async () => {
  const env = await setupRaceEnv("pi-cm-recon06-race-");
  try {
    await seedPathSourceMarketplace({
      cwd: env.cwd,
      marketplace: "mp-a",
      plugin: "plugin-a",
    });
    await writeConfig(env.cwd, {
      schemaVersion: 1,
      marketplaces: {
        "mp-a": { source: path.join(env.cwd, "mp-src") },
      },
      plugins: {
        "plugin-a@mp-a": {},
      },
    });

    const outcome = await runRace(env);

    // NFR-2: both children exit code 0 (neither escapes the harness
    // boundary). A process that loses a lock is allowed to either succeed
    // (against an already-converged plan) OR soft-fail with the
    // StateLockHeldError marker -- the test does NOT assert "exactly one
    // winner". The state-consistency assertions below are what matters.
    assert.equal(
      outcome.firstExitCode,
      0,
      `first child must exit 0 (NFR-2); message=${outcome.first.message ?? "(none)"}`,
    );
    assert.equal(
      outcome.secondExitCode,
      0,
      `second child must exit 0 (NFR-2); message=${outcome.second.message ?? "(none)"}`,
    );

    // Neither child may report a foreign error type. A lock-held loser is a
    // sanctioned soft-fail; anything else is a boundary escape.
    for (const r of [outcome.first, outcome.second]) {
      if (!r.ok) {
        assert.match(
          r.message ?? "",
          new RegExp(STATE_LOCK_HELD_PREFIX),
          `non-ok child must carry the StateLockHeldError marker (NFR-2 soft-fail); got: ${r.message ?? ""}`,
        );
      }
    }

    // The race itself guarantees NON-CORRUPTION, not completion. The apply
    // pass deliberately runs with no outer lock (CR-01) and every step -- read
    // pass, marketplace add, plugin install, backfill, routing rebuild -- takes
    // the per-scope lock separately with `retries: 0`, soft-failing into a
    // structured row when it loses. Marketplace source materialization is not
    // atomic across processes either, so a racer can read a half-written
    // manifest and report `{unparseable}`. A round in which BOTH racers fail
    // every mutating step is therefore legal and writes no state.json at all;
    // asserting "at least one racer converged" asserts an invariant the design
    // does not offer, and that assertion is what made this test flaky on loaded
    // runners. So: whatever the race DID write must be singular, and the
    // uncontended pass below must converge.
    if (existsSync(locationsFor("project", env.cwd).stateJsonPath)) {
      const raced = await readStateRaw(env.cwd);
      assert.deepEqual(
        Object.keys(raced.marketplaces).filter((name) => name !== "mp-a"),
        [],
        `race must write no marketplace record but mp-a; got ${JSON.stringify(raced.marketplaces)} for ${describeRace(outcome)}`,
      );
      assert.deepEqual(
        Object.keys(raced.marketplaces["mp-a"]?.plugins ?? {}).filter(
          (name) => name !== "plugin-a",
        ),
        [],
        `race must write no plugin record but plugin-a; got ${JSON.stringify(raced.marketplaces)} for ${describeRace(outcome)}`,
      );
    }

    // No orphaned staging directory survives the race -- agents-staging
    // either does not exist OR exists and is empty.
    const stagingEntries = await listAgentsStagingEntries(env.cwd);
    assert.equal(
      stagingEntries.length,
      0,
      `expected no orphaned staging entries; got ${JSON.stringify(stagingEntries)}`,
    );

    // NFR-2 convergence: one more reconcile, this time uncontended, must close
    // whatever gap the race left. This is the "run /reload again" contract and
    // it is what makes the record assertions below non-vacuous regardless of
    // who won -- or whether anybody did.
    const convergence = await runUncontendedReconcile(env);
    assert.equal(
      convergence.code,
      0,
      `convergence pass must exit 0 (NFR-2); message=${convergence.result.message ?? "(none)"}`,
    );
    assert.equal(
      convergence.result.ok,
      true,
      `convergence pass must not throw past its boundary; message=${convergence.result.message ?? "(none)"}`,
    );

    const state = await readStateRaw(env.cwd);

    // Exactly one mp-a record (no interleaved double-write).
    assert.deepEqual(
      Object.keys(state.marketplaces),
      ["mp-a"],
      `expected exactly one mp-a record; got ${JSON.stringify(state.marketplaces)} after ${describeRace(outcome)}`,
    );

    // Exactly one plugin-a record (no double-install).
    assert.deepEqual(
      Object.keys(state.marketplaces["mp-a"]!.plugins),
      ["plugin-a"],
      `expected exactly one plugin-a record; got ${JSON.stringify(
        state.marketplaces["mp-a"]!.plugins,
      )} after ${describeRace(outcome)}`,
    );

    // The convergence pass must not leave staging behind either.
    const settledStagingEntries = await listAgentsStagingEntries(env.cwd);
    assert.equal(
      settledStagingEntries.length,
      0,
      `expected no staging entries after convergence; got ${JSON.stringify(settledStagingEntries)}`,
    );
  } finally {
    await env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario B: concurrent first-load race
// ---------------------------------------------------------------------------

test("Concurrent first-load race: two processes race against state with legacy autoupdate + ENOENT claude-plugins.json -> migrate trichotomy serializes; exactly one process writes the config, the other observes 'valid' and short-circuits", async () => {
  const env = await setupRaceEnv("pi-cm-recon06-mig22-");
  try {
    // Pre-record a marketplace in state with the legacy `autoupdate: true`
    // field. STATE_SCHEMA does not declare the field (SPLIT-01), so we
    // bypass saveState to seed it; loadState's D-13 ORDERING RAIL preserves
    // the field on the first load (existsSync(claude-plugins.json) is
    // false), letting migrateFirstRunConfig capture it.
    await seedStateRaw(env.cwd, {
      schemaVersion: 1,
      marketplaces: {
        "mp-legacy": {
          name: "mp-legacy",
          scope: "project",
          source: { kind: "path", raw: "./mp-legacy-src" },
          addedFromCwd: env.cwd,
          manifestPath: path.join(env.cwd, "mp-legacy-src", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(env.cwd, "mp-legacy-src"),
          autoupdate: true,
          plugins: {},
        },
      },
    });

    // claude-plugins.json absent on both children's first read pass.
    const projectScopeRoot = path.join(env.cwd, ".pi");
    const configPath = path.join(projectScopeRoot, "claude-plugins.json");
    assert.equal(existsSync(configPath), false, "test precondition: config must be absent");

    const outcome = await runRace(env);

    // NFR-2 boundary preservation.
    assert.equal(outcome.firstExitCode, 0, `first exit code; msg=${outcome.first.message ?? ""}`);
    assert.equal(
      outcome.secondExitCode,
      0,
      `second exit code; msg=${outcome.second.message ?? ""}`,
    );

    // Config now exists and parses cleanly.
    assert.equal(
      existsSync(configPath),
      true,
      "claude-plugins.json must exist after both children run",
    );
    const config = await readConfigRaw(env.cwd);

    // Exactly one marketplace entry (no double-merge -- the second process
    // saw 'valid' and short-circuited per migrate-config.ts's trichotomy).
    assert.deepEqual(
      Object.keys(config.marketplaces ?? {}),
      ["mp-legacy"],
      `expected exactly one mp entry; got ${JSON.stringify(config.marketplaces ?? {})}`,
    );

    // The legacy autoupdate field is captured byte-stably -- whichever
    // process won the migration race wrote it from the in-memory state
    // record (the D-13 gate preserved the field on the first loadState
    // because the config did not yet exist).
    assert.equal(
      config.marketplaces!["mp-legacy"]!.autoupdate,
      true,
      "migrate must capture legacy autoupdate from the first-load state",
    );

    // state.json still parses + still has the marketplace record (the
    // marketplace itself is not removed; the loadState D-13 scrub may have
    // removed the legacy `autoupdate` field once the config existed, but
    // the marketplace record itself is unchanged).
    const state = await readStateRaw(env.cwd);
    assert.ok(
      "mp-legacy" in state.marketplaces,
      `expected mp-legacy still recorded in state; got ${JSON.stringify(state.marketplaces)}`,
    );
  } finally {
    await env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario C: D-13 gate single-process integration cover
// ---------------------------------------------------------------------------

test("D-13 gate (single-process): state with legacy autoupdate + ENOENT claude-plugins.json -> single applyReconcile observes the gate at loadState (before the closure runs), captures autoupdate via migrate inside the locked closure, writes the config carrying autoupdate", async () => {
  const env = await setupRaceEnv("pi-cm-recon06-mig24-");
  try {
    await seedStateRaw(env.cwd, {
      schemaVersion: 1,
      marketplaces: {
        "mp-d13": {
          name: "mp-d13",
          scope: "project",
          source: { kind: "path", raw: "./mp-d13-src" },
          addedFromCwd: env.cwd,
          manifestPath: path.join(env.cwd, "mp-d13-src", ".claude-plugin", "marketplace.json"),
          marketplaceRoot: path.join(env.cwd, "mp-d13-src"),
          autoupdate: false,
          plugins: {},
        },
      },
    });

    const projectScopeRoot = path.join(env.cwd, ".pi");
    const configPath = path.join(projectScopeRoot, "claude-plugins.json");
    assert.equal(existsSync(configPath), false, "test precondition: config must be absent");

    // Single process via fork (same child entry point; one child only) to
    // exercise the same code path the integration scenarios exercise.
    const child = fork(CHILD_PATH, [], {
      cwd: env.cwd,
      env: {
        ...process.env,
        HOME: env.home,
        PI_CODING_AGENT_DIR: path.join(env.home, ".pi-agent"),
      },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        reject(new Error(`child exited ${String(code)} before ready`));
      });
      child.once("message", (message) => {
        if (message === "ready") {
          resolve();
        } else {
          reject(new Error(`unexpected child ready message: ${JSON.stringify(message)}`));
        }
      });
    });

    const resultPromise = new Promise<{ result: ChildResult; code: number | null }>(
      (resolve, reject) => {
        let resultMessage: ChildResult | undefined;
        child.once("error", reject);
        child.once("message", (message) => {
          resultMessage = message as ChildResult;
        });
        child.once("exit", (code) => {
          if (resultMessage === undefined) {
            reject(new Error(`child exited ${String(code)} before result message`));
            return;
          }

          resolve({ result: resultMessage, code });
        });
      },
    );

    child.send({ cwd: env.cwd });
    const { result, code } = await resultPromise;

    assert.equal(code, 0, `child must exit 0 (NFR-2); message=${result.message ?? "(none)"}`);
    assert.equal(
      result.ok,
      true,
      `child must report ok=true; message=${result.message ?? "(none)"}`,
    );

    // Config was written + carries autoupdate: false captured from state.
    assert.equal(existsSync(configPath), true, "claude-plugins.json must exist after run");
    const config = await readConfigRaw(env.cwd);
    assert.deepEqual(Object.keys(config.marketplaces ?? {}), ["mp-d13"]);
    assert.equal(
      config.marketplaces!["mp-d13"]!.autoupdate,
      false,
      "D-13 gate: legacy autoupdate must be captured before the loadState scrub",
    );
  } finally {
    await env.cleanup();
  }
});
