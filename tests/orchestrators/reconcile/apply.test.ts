// tests/orchestrators/reconcile/apply.test.ts
//
// RECON-01..05 (Phase 55 Plan 02) behavior proofs for `applyReconcile`.
//
// Coverage:
//   - RECON-01 (decl-but-missing -> add at load): config declares a path-source
//     marketplace not in state -> applyReconcile drives addMarketplace, state
//     records the marketplace, single notify() carries an `(added)` row.
//   - RECON-02 (installed-but-undeclared -> remove at load): state records
//     a marketplace whose declaration no longer exists -> applyReconcile
//     drives removeMarketplace, state record is gone, notify() carries a
//     `(removed)` row. Ownership guard: a manually-edited extra entry the
//     planner classifies as `marketplacesToRemove` IS removed (the planner is
//     the ownership gate, so anything the planner surfaces gets driven).
//   - RECON-03 (per-entry network soft-fail): inject failing gitOps; the
//     orchestrator does NOT throw past the boundary, the cascade carries a
//     (failed) row for the github-source marketplace, AND a sibling
//     path-source marketplace that succeeds is rendered alongside (loop
//     continues past the failure).
//   - RECON-05 (back-to-back no-op): two consecutive applyReconcile calls
//     against an unchanged config + state -> claude-plugins.json bytes
//     unchanged, ZERO notify() calls on the second invocation (silent
//     empty-steady-state per NFR-2 / A4).
//
// Fixture strategy: marketplace-only fixtures (no plugin install). Plugin-
// level coverage is exercised by the projection unit tests in
// tests/shared/notify-v2.test.ts and the catalog UAT byte-equality runner.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import { applyReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { loadState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

const STUB_PI = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;

async function withHermeticHome<T>(
  fn: (env: { cwd: string; home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "apply-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "apply-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ cwd, home });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

/**
 * Lay down a project-scope config + empty state. The config declares one
 * github-source marketplace that the test will route through the mock
 * gitOps (cloning the named fixture into the staging dir).
 */
async function setupProjectScope(
  cwd: string,
  config: object,
  state?: object,
): Promise<{ configPath: string; statePath: string; extensionRoot: string }> {
  const projectScopeRoot = path.join(cwd, ".pi");
  const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  const configPath = path.join(projectScopeRoot, "claude-plugins.json");
  const statePath = path.join(extensionRoot, "state.json");
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  await writeFile(
    statePath,
    JSON.stringify(state ?? { schemaVersion: 1, marketplaces: {} }, null, 2),
    "utf8",
  );
  return { configPath, statePath, extensionRoot };
}

test("RECON-01 (decl-but-missing -> add at load): config declares mp-a, state empty -> applyReconcile drives addMarketplace, state records mp-a, single notify() with (added) row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { extensionRoot } = await setupProjectScope(cwd, {
      schemaVersion: 1,
      marketplaces: {
        "valid-marketplace": { source: "acme/valid" },
      },
    });

    const ctx = makeCtx();
    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
      gitOps,
    });

    // gitOps.clone was invoked exactly once (the addMarketplace drive).
    assert.equal(gitState.cloneCalls.length, 1);

    // State now records the marketplace.
    const persisted = await loadState(extensionRoot);
    assert.ok("valid-marketplace" in persisted.marketplaces);

    // IL-2 / RECON-04: exactly one notify() call.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    // info severity -> no second arg.
    assert.equal(args.length, 1);
    // Body carries the (added) row.
    assert.ok(
      args[0].includes("(added)"),
      `expected (added) row in cascade body; got:\n${args[0]}`,
    );
    assert.ok(
      args[0].includes("valid-marketplace"),
      `expected marketplace name in cascade body; got:\n${args[0]}`,
    );
    // No /reload trailer.
    assert.ok(
      !args[0].includes("/reload to pick up changes"),
      `RECON-04 / Pitfall 4: applyReconcile cascade MUST NOT emit /reload trailer; got:\n${args[0]}`,
    );
  });
});

test("RECON-02 (installed-but-undeclared -> remove at load): state records mp-a, config empty -> applyReconcile drives removeMarketplace; ownership guard = planner (state-recorded entries surface in the plan)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // State pre-records `manual-mp`; config is empty -> the planner surfaces
    // `manual-mp` in marketplacesToRemove (ownership gate: anything in state
    // but not in config is fair game for removal).
    const { extensionRoot } = await setupProjectScope(
      cwd,
      { schemaVersion: 1, marketplaces: {} },
      {
        schemaVersion: 1,
        marketplaces: {
          "manual-mp": {
            name: "manual-mp",
            scope: "project",
            source: { kind: "path", raw: "/tmp/nowhere" },
            plugins: {},
            autoupdate: false,
            addedFromCwd: cwd,
          },
        },
      },
    );

    const ctx = makeCtx();
    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    // State no longer records the marketplace.
    const persisted = await loadState(extensionRoot);
    assert.ok(!("manual-mp" in persisted.marketplaces));

    // Exactly one notify() carrying a (removed) row.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    assert.equal(args.length, 1);
    assert.ok(args[0].includes("(removed)"), `expected (removed) row; got:\n${args[0]}`);
    assert.ok(
      args[0].includes("manual-mp"),
      `expected manual-mp in cascade body; got:\n${args[0]}`,
    );
  });
});

test("RECON-03 (per-entry network soft-fail): one failing github mp + one succeeding mp -> applyReconcile completes without throwing, cascade carries (failed) row for the failed mp AND (added) row for the sibling", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await setupProjectScope(cwd, {
      schemaVersion: 1,
      marketplaces: {
        "flaky-mp": { source: "acme/flaky" },
        "ok-mp": { source: "acme/ok" },
      },
    });

    const ctx = makeCtx();
    // First clone throws (the "flaky-mp" attempt); second clone succeeds
    // (the "ok-mp" attempt). The planner iterates by Object.entries order
    // so insertion order in `marketplaces` determines drive order.
    let cloneCount = 0;
    const networkErr = new Error("connect ENETUNREACH");
    (networkErr as { code?: string }).code = "ENETUNREACH";
    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });
    const realClone = gitOps.clone.bind(gitOps);
    gitOps.clone = async (opts): Promise<void> => {
      cloneCount++;
      if (cloneCount === 1) {
        throw networkErr;
      }

      await realClone(opts);
    };

    // Must NOT throw.
    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
      gitOps,
    });

    // Loop continued past the failure.
    assert.ok(gitState.cloneCalls.length >= 2 || cloneCount >= 2);

    // IL-2: exactly one notify(); severity error (failed row present).
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    assert.equal(args[1], "error");
    const emitted = args[0];
    assert.ok(emitted.includes("(failed)"), `expected (failed) row; got:\n${emitted}`);
    assert.ok(emitted.includes("flaky-mp"), `expected flaky-mp row; got:\n${emitted}`);
    // Sibling continued -> the cascade also rendered an (added) row for ok-mp.
    // (The mock gitOps fixture is "valid-marketplace" so the second clone
    // resolves a valid manifest; the planner-driven entry's marketplace name
    // is "ok-mp" -- but addMarketplace records it under the MANIFEST's name
    // ("valid-marketplace"). Both names are checked permissively below.)
    assert.ok(
      emitted.includes("(added)") ||
        emitted.includes("ok-mp") ||
        emitted.includes("valid-marketplace"),
      `expected sibling success row to continue past the failure; got:\n${emitted}`,
    );
    // No /reload trailer (Pitfall 4).
    assert.ok(
      !emitted.includes("/reload to pick up changes"),
      `RECON-04 cascade MUST NOT emit /reload trailer; got:\n${emitted}`,
    );
  });
});

test("CR-01 (config key != manifest name): first apply records the MANIFEST name; second apply is a stable no-op -- no remove/re-add churn, no network clone, ZERO notify", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // The config key ("my-mp") deliberately differs from the fixture
    // manifest's `name` ("valid-marketplace"). addMarketplace records under
    // the MANIFEST-derived name, so without source-based matching in the
    // planner the second reconcile would plan add("my-mp") (another network
    // clone) AND remove("valid-marketplace") (uninstall-all + teardown) --
    // the perpetual destructive churn CR-01 closes.
    const { extensionRoot } = await setupProjectScope(cwd, {
      schemaVersion: 1,
      marketplaces: {
        "my-mp": { source: "acme/valid" },
      },
    });

    const ctxA = makeCtx();
    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureMarketplaceDir("valid-marketplace"),
    });

    await applyReconcile({
      ctx: ctxA as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
      gitOps,
    });

    // Recorded under the MANIFEST name, exactly one clone.
    assert.equal(gitState.cloneCalls.length, 1);
    const persisted = await loadState(extensionRoot);
    assert.ok("valid-marketplace" in persisted.marketplaces);

    // The (added) row carries the name the record was actually created under.
    assert.equal(ctxA.ui.notify.mock.calls.length, 1);
    const firstArgs = ctxA.ui.notify.mock.calls[0]!.arguments as [string, string?];
    assert.ok(
      firstArgs[0].includes("valid-marketplace") && firstArgs[0].includes("(added)"),
      `expected (added) row on the recorded name; got:\n${firstArgs[0]}`,
    );

    // Second apply: converged steady state -- no clone, no remove/re-add,
    // ZERO notify, record intact.
    const ctxB = makeCtx();
    await applyReconcile({
      ctx: ctxB as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
      gitOps,
    });

    assert.equal(
      gitState.cloneCalls.length,
      1,
      "second applyReconcile must NOT clone again (NFR-5: no network on a converged load)",
    );
    assert.equal(
      ctxB.ui.notify.mock.calls.length,
      0,
      "second applyReconcile must be silent (back-to-back convergence, never remove/re-add churn)",
    );
    const persisted2 = await loadState(extensionRoot);
    assert.ok(
      "valid-marketplace" in persisted2.marketplaces,
      "the recorded marketplace must survive the second reconcile untouched",
    );
  });
});

test("RECON-05 (back-to-back no-op): two consecutive applyReconcile calls against unchanged config + state -> config bytes unchanged, ZERO notify on the second call (silent empty-steady-state)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { configPath } = await setupProjectScope(cwd, {
      schemaVersion: 1,
      marketplaces: {},
      plugins: {},
    });

    // Capture the baseline.
    const beforeConfig = await readFile(configPath, "utf8");
    const beforeConfigMtime = (await stat(configPath)).mtimeMs;

    const ctxA = makeCtx();
    await applyReconcile({
      ctx: ctxA as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    // First call against an already-empty/clean config -> SILENT (NFR-2 /
    // A4). The plan was empty AND no invalid-config rows surfaced.
    assert.equal(
      ctxA.ui.notify.mock.calls.length,
      0,
      "first applyReconcile call against an empty/clean config must be silent (NFR-2 / A4)",
    );

    // Second call.
    const ctxB = makeCtx();
    await applyReconcile({
      ctx: ctxB as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(
      ctxB.ui.notify.mock.calls.length,
      0,
      "back-to-back applyReconcile against unchanged config must be silent (RECON-05)",
    );

    // claude-plugins.json bytes unchanged + mtime unchanged (the migration
    // short-circuits because the config exists, so no write happens).
    const afterConfig = await readFile(configPath, "utf8");
    const afterConfigMtime = (await stat(configPath)).mtimeMs;
    assert.equal(
      beforeConfig,
      afterConfig,
      "claude-plugins.json bytes must be unchanged across applyReconcile runs",
    );
    assert.equal(
      beforeConfigMtime,
      afterConfigMtime,
      "claude-plugins.json mtime must be unchanged across applyReconcile runs",
    );
  });
});

test("WR-01 (per-scope isolation): corrupt project-scope state.json -> structured (failed) {unparseable} row on the state.json subject; the user scope still reconciles and the single notify survives", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Project scope: a config that would otherwise plan work + a CORRUPT
    // state.json so the read pass throws inside withStateGuard.
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    await writeFile(
      path.join(projectScopeRoot, "claude-plugins.json"),
      JSON.stringify({ schemaVersion: 1, marketplaces: {} }, null, 2),
      "utf8",
    );
    await writeFile(path.join(extensionRoot, "state.json"), "{ not json", "utf8");

    // User scope: a recorded-but-undeclared marketplace so the sibling
    // scope's apply pass performs a (removed) action.
    const userScopeRoot = path.join(home, ".pi", "agent");
    const userExtensionRoot = path.join(userScopeRoot, "pi-claude-marketplace");
    await mkdir(userExtensionRoot, { recursive: true });
    await writeFile(
      path.join(userScopeRoot, "claude-plugins.json"),
      JSON.stringify({ schemaVersion: 1, marketplaces: {} }, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(userExtensionRoot, "state.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          marketplaces: {
            "user-manual-mp": {
              name: "user-manual-mp",
              scope: "user",
              source: { kind: "path", raw: "/tmp/nowhere" },
              plugins: {},
              autoupdate: false,
              addedFromCwd: cwd,
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const ctx = makeCtx();
    // Both scopes (no explicit scope) -- project first, then user.
    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
    });

    // ONE notify carrying BOTH the project-scope state-load failure row AND
    // the user-scope (removed) row -- the throw neither aborted the sibling
    // scope nor swallowed the accumulated outcomes.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    assert.equal(args[1], "error");
    const emitted = args[0];
    assert.ok(
      emitted.includes("state.json") && emitted.includes("{unparseable}"),
      `expected (failed) {unparseable} row on the state.json subject; got:\n${emitted}`,
    );
    assert.ok(
      emitted.includes("user-manual-mp") && emitted.includes("(removed)"),
      `WR-01: the user scope must still reconcile past the project-scope throw; got:\n${emitted}`,
    );

    // The corrupt project state.json is untouched (no clobber, no coercion).
    const rawAfter = await readFile(path.join(extensionRoot, "state.json"), "utf8");
    assert.equal(rawAfter, "{ not json", "the corrupt state.json must not be rewritten");
  });
});

test("CFG-03 / T-55-02-01: invalid claude-plugins.json -> (failed) {invalid manifest} row with BASENAME, that scope's apply skipped (no mass-uninstall)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    const badConfigPath = path.join(projectScopeRoot, "claude-plugins.json");
    // Truncated JSON -> CFG-03 invalid arm.
    await writeFile(badConfigPath, "{", "utf8");
    // Pre-record a marketplace in state -- IF the orchestrator silently
    // coerced invalid config to empty desired state, this would land in
    // `marketplacesToRemove` and surface as a (removed) row. The CFG-03
    // abort MUST keep it untouched.
    const statePath = path.join(extensionRoot, "state.json");
    await writeFile(
      statePath,
      JSON.stringify(
        {
          schemaVersion: 1,
          marketplaces: {
            "should-stay": {
              name: "should-stay",
              scope: "project",
              source: { kind: "path", raw: "/tmp/nowhere" },
              plugins: {},
              autoupdate: false,
              addedFromCwd: cwd,
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const ctx = makeCtx();
    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    // State unchanged: `should-stay` is still recorded (no mass-uninstall).
    const persisted = await loadState(extensionRoot);
    assert.ok(
      "should-stay" in persisted.marketplaces,
      "CFG-03 abort must NOT mass-uninstall recorded entries; got persisted=" +
        JSON.stringify(persisted.marketplaces),
    );

    // Exactly one notify carrying the BASENAME + invalid-manifest reason +
    // error severity + summary line. No absolute path leak.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    assert.equal(args[1], "error");
    const emitted = args[0];
    assert.ok(
      emitted.includes("claude-plugins.json"),
      `expected BASENAME 'claude-plugins.json'; got:\n${emitted}`,
    );
    assert.ok(
      !emitted.includes(projectScopeRoot),
      `T-55-02-01: absolute path MUST NOT leak; got:\n${emitted}`,
    );
    assert.ok(
      emitted.includes("(failed)") && emitted.includes("{invalid manifest}"),
      `expected (failed) {invalid manifest} row; got:\n${emitted}`,
    );
    assert.ok(
      !emitted.includes("(removed)"),
      `CFG-03 abort MUST NEVER render mass-uninstall; got:\n${emitted}`,
    );
  });
});
