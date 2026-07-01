// tests/orchestrators/reconcile/pending.test.ts
//
// DIFF-01 SC #2 + DIFF-02 + CFG-03 abort proofs for
// `orchestrators/reconcile/pending.ts`. The suite covers:
//
//   1. Idempotency: two consecutive invocations against unchanged state +
//      config produce byte-identical `ctx.ui.notify` argument lists.
//   2. No-mutation: file mtimes + on-disk bytes of `state.json`,
//      `claude-plugins.json`, `claude-plugins.local.json` are unchanged across
//      both invocations.
//   3. CFG-03 abort: a malformed `claude-plugins.json` surfaces
//      a `(failed) {invalid manifest}` row carrying the BASENAME (never the
//      absolute path) AND `planReconcile`'s side effects (any plan content)
//      do NOT appear for that scope. Invalid input is NEVER coerced into an
//      empty desired state that would render as a mass-uninstall pending list.
//   4. Scope fan-out: omitted `--scope` walks both scopes project-first;
//      explicit `--scope user` walks only user.
//   5. Single-notify (IL-2): exactly one ctx.ui.notify call per invocation.
//   6. Empty-steady-state: the dedicated ReconcilePendingEmptyMessage
//      variant emits the catalog-locked advisory body line.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import { pendingReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface MockCtx {
  cwd: string;
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(cwd: string): MockCtx {
  return { cwd, ui: { notify: mock.fn() } };
}

const STUB_PI = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;

async function withHermeticHome<T>(
  fn: (env: { cwd: string; home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "pending-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "pending-cwd-"));
  process.env.HOME = home;
  // SC-1: getAgentDir() honors PI_CODING_AGENT_DIR FIRST and only falls back
  // to homedir(). Clear it so the hermetic HOME above actually governs the
  // user scope -- otherwise a developer/CI env that sets the variable would
  // make these tests read the real Pi agent dir.
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

    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test("DIFF-01 SC #2 / empty-steady-state: bare invocation against zero config + zero state emits the advisory once", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const ctx = makeCtx(cwd);
    await pendingReconcile({ ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd });
    // IL-2: exactly one notify call.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments;
    // info severity -> no 2nd arg.
    assert.equal(args.length, 1);
    assert.equal(args[0], "Pending: next reload will apply 0 actions.");
  });
});

test("DIFF-01 SC #2 / idempotency: two invocations against unchanged state -> byte-identical notify args", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const ctxA = makeCtx(cwd);
    const ctxB = makeCtx(cwd);
    await pendingReconcile({ ctx: ctxA as unknown as ExtensionContext, pi: STUB_PI, cwd });
    await pendingReconcile({ ctx: ctxB as unknown as ExtensionContext, pi: STUB_PI, cwd });
    assert.deepEqual(
      ctxA.ui.notify.mock.calls[0]!.arguments,
      ctxB.ui.notify.mock.calls[0]!.arguments,
    );
  });
});

test("DIFF-01 SC #2 / no-mutation: pending run leaves config + state file mtimes + bytes unchanged", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Lay down a minimal project-scope config + empty state directory so the
    // orchestrator reads real on-disk files (rather than absent-arms).
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    const configPath = path.join(projectScopeRoot, "claude-plugins.json");
    const statePath = path.join(extensionRoot, "state.json");
    await writeFile(configPath, JSON.stringify({ schemaVersion: 1 }, null, 2), "utf8");
    await writeFile(
      statePath,
      JSON.stringify({ schemaVersion: 1, marketplaces: {} }, null, 2),
      "utf8",
    );

    const beforeConfig = await readFile(configPath, "utf8");
    const beforeConfigMtime = (await stat(configPath)).mtimeMs;
    const beforeState = await readFile(statePath, "utf8");
    const beforeStateMtime = (await stat(statePath)).mtimeMs;

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    const afterConfig = await readFile(configPath, "utf8");
    const afterConfigMtime = (await stat(configPath)).mtimeMs;
    const afterState = await readFile(statePath, "utf8");
    const afterStateMtime = (await stat(statePath)).mtimeMs;

    assert.equal(beforeConfig, afterConfig, "config bytes must be unchanged across pending runs");
    assert.equal(
      beforeConfigMtime,
      afterConfigMtime,
      "config mtime must be unchanged across pending runs",
    );
    assert.equal(beforeState, afterState, "state bytes must be unchanged across pending runs");
    assert.equal(
      beforeStateMtime,
      afterStateMtime,
      "state mtime must be unchanged across pending runs",
    );
  });
});

test("CFG-03 abort: malformed claude-plugins.json -> (failed) {invalid manifest} row with BASENAME (not absolute path)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    const badConfigPath = path.join(projectScopeRoot, "claude-plugins.json");
    // Truncated JSON -- JSON.parse fails -> invalid arm.
    await writeFile(badConfigPath, "{", "utf8");

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const emitted = args[0];
    // Severity: error (the cascade has a failed marketplace row) -> summary
    // prepended (GRAM-01 / GRAM-02).
    assert.equal(args[1], "error");
    // The marketplace name is the BASENAME (T-53-02-02 information-disclosure
    // mitigation -- the absolute path is NEVER emitted).
    assert.ok(
      emitted.includes("claude-plugins.json"),
      `expected emitted output to include the BASENAME 'claude-plugins.json'; got:\n${emitted}`,
    );
    assert.ok(
      !emitted.includes(projectScopeRoot),
      `emitted output must NOT include the absolute path '${projectScopeRoot}'; got:\n${emitted}`,
    );
    assert.ok(
      emitted.includes("(failed)") && emitted.includes("{invalid manifest}"),
      `expected (failed) {invalid manifest} row; got:\n${emitted}`,
    );
    // The row must NOT render as `(will uninstall)` etc. --
    // invalid config NEVER coerced to an empty desired state.
    assert.ok(
      !emitted.includes("will uninstall"),
      `CFG-03 abort must NEVER render as a mass-uninstall pending list; got:\n${emitted}`,
    );
  });
});

test("failure containment (WR-04): corrupt state.json -> (failed) {unparseable} row with BASENAME, no raw throw", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    // Valid (empty) config; corrupt state -- the asymmetric twin of the
    // CFG-03 case above. loadState throws on unparseable JSON; the
    // orchestrator must contain it as a structured row (IL-2), mirroring
    // listPlugins, instead of escaping as an unhandled rejection.
    await writeFile(
      path.join(projectScopeRoot, "claude-plugins.json"),
      JSON.stringify({ schemaVersion: 1 }, null, 2),
      "utf8",
    );
    const statePath = path.join(extensionRoot, "state.json");
    await writeFile(statePath, "{", "utf8");

    const ctx = makeCtx(cwd);
    // Must NOT throw.
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    // IL-2: exactly one notify call.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const emitted = args[0];
    // Severity: error (failed marketplace row).
    assert.equal(args[1], "error");
    // BASENAME only (T-53-02-02) -- the absolute path is NEVER emitted.
    assert.ok(
      emitted.includes("state.json"),
      `expected emitted output to include the BASENAME 'state.json'; got:\n${emitted}`,
    );
    assert.ok(
      !emitted.includes(extensionRoot),
      `emitted output must NOT include the absolute path '${extensionRoot}'; got:\n${emitted}`,
    );
    assert.ok(
      emitted.includes("(failed)") && emitted.includes("{unparseable}"),
      `expected (failed) {unparseable} row; got:\n${emitted}`,
    );
  });
});

test("mixed output ordering (WR-05): invalid-config block sorts with plan blocks via compareByNameThenScope (MSG-GR-3)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Project scope: invalid config -> (failed) {invalid manifest} block
    // named "claude-plugins.json". User scope: a bare-header pending block
    // named "zzz-mp" carrying a `will install` child (WILL-01 / D-65.1-02: the
    // marketplace add itself is immediate and carries no token; the child
    // install is the reload-deferred work that materializes the block). MSG-GR-3
    // (name primary, case-insensitive) requires "claude-plugins.json" BEFORE
    // "zzz-mp" -- appending invalid blocks after the sorted projection would
    // mis-order them.
    const projectScopeRoot = path.join(cwd, ".pi");
    await mkdir(projectScopeRoot, { recursive: true });
    await writeFile(path.join(projectScopeRoot, "claude-plugins.json"), "{", "utf8");

    const userScopeRoot = path.join(home, ".pi", "agent");
    await mkdir(userScopeRoot, { recursive: true });
    await writeFile(
      path.join(userScopeRoot, "claude-plugins.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          marketplaces: { "zzz-mp": { source: "acme/z" } },
          plugins: { "pp@zzz-mp": { enabled: true } },
        },
        null,
        2,
      ),
      "utf8",
    );

    const ctx = makeCtx(cwd);
    await pendingReconcile({ ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    const failedIdx = emitted.indexOf("claude-plugins.json");
    const mpIdx = emitted.indexOf("zzz-mp");
    assert.ok(failedIdx >= 0, `expected the invalid-config row; got:\n${emitted}`);
    assert.ok(mpIdx >= 0, `expected the zzz-mp pending block; got:\n${emitted}`);
    assert.ok(
      failedIdx < mpIdx,
      `MSG-GR-3: "claude-plugins.json" must sort before "zzz-mp"; got:\n${emitted}`,
    );
  });
});

test("scope fan-out: omitted --scope walks both scopes project-first (advisory in project + advisory in user converges to one advisory)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const ctx = makeCtx(cwd);
    // No --scope -> both scopes. Both are empty so the empty-steady-state
    // advisory fires.
    await pendingReconcile({ ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd });
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    assert.equal(
      ctx.ui.notify.mock.calls[0]!.arguments[0],
      "Pending: next reload will apply 0 actions.",
    );
  });
});

/**
 * Lay down a FULLY-MODERN populated project-scope state.json (all
 * MARKETPLACE_RECORD_SCHEMA fields present, plugin resources arrays
 * complete) so `loadState` performs NO legacy migration and fires NO
 * background persist -- the no-write assertions below must not race an
 * ST-4 best-effort save.
 */
async function writePopulatedProjectState(cwd: string): Promise<{ statePath: string }> {
  const projectScopeRoot = path.join(cwd, ".pi");
  const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  const statePath = path.join(extensionRoot, "state.json");
  await writeFile(
    statePath,
    JSON.stringify(
      {
        schemaVersion: 1,
        marketplaces: {
          "mp-github": {
            name: "mp-github",
            scope: "project",
            source: "acme/tools",
            addedFromCwd: "/some/cwd",
            manifestPath: "/abs/mp-github/.claude-plugin/marketplace.json",
            marketplaceRoot: "/abs/mp-github",
            plugins: {
              "code-reviewer": {
                version: "1.0.0",
                resolvedSource: "/abs/mp-github/code-reviewer",
                compatibility: {
                  installable: true,
                  notes: [],
                  supported: ["skills"],
                  unsupported: [],
                },
                resources: {
                  skills: ["cr-skill"],
                  prompts: [],
                  agents: [],
                  mcpServers: [],
                },
                installedAt: "2025-01-01T00:00:00.000Z",
                updatedAt: "2025-01-01T00:00:00.000Z",
              },
            },
          },
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  return { statePath };
}

test("MIG-01 pre-migration window: absent config + populated state -> EMPTY advisory, NOT a mass-uninstall plan", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Populated state.json, NO claude-plugins.json: the post-upgrade,
    // pre-first-/reload window. The apply path migrates FIRST (the next
    // load's reconcile is a no-op), so the pending must converge on the
    // same answer -- planning against the absent-as-empty merged view would
    // tear down every recorded marketplace and render its per-plugin
    // `(will uninstall)` cascade rows for everything in state (the DIFF-01
    // 'exactly what the next load would do' violation).
    await writePopulatedProjectState(cwd);

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const args = ctx.ui.notify.mock.calls[0]!.arguments;
    assert.equal(args.length, 1, "empty advisory is info severity (no 2nd arg)");
    assert.equal(args[0], "Pending: next reload will apply 0 actions.");
  });
});

test("MIG-01 pre-migration window: idempotent + READ-ONLY -- run twice, byte-identical output, NO config file created", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { statePath } = await writePopulatedProjectState(cwd);
    const beforeState = await readFile(statePath, "utf8");
    const beforeStateMtime = (await stat(statePath)).mtimeMs;

    const ctxA = makeCtx(cwd);
    const ctxB = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctxA as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });
    await pendingReconcile({
      ctx: ctxB as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    // DIFF-01 SC #2: byte-identical across consecutive runs.
    assert.deepEqual(
      ctxA.ui.notify.mock.calls[0]!.arguments,
      ctxB.ui.notify.mock.calls[0]!.arguments,
    );
    // NFR-5 read-surface discipline: the pending projection must NOT have
    // performed the migration -- no claude-plugins.json appears.
    const configPath = path.join(cwd, ".pi", "claude-plugins.json");
    await assert.rejects(
      stat(configPath),
      (err: NodeJS.ErrnoException) => err.code === "ENOENT",
      "pending must NEVER create claude-plugins.json (migration is the apply path's job)",
    );
    // state.json bytes + mtime untouched.
    assert.equal(await readFile(statePath, "utf8"), beforeState);
    assert.equal((await stat(statePath)).mtimeMs, beforeStateMtime);
  });
});

test("MIG-01 pre-migration window: local arm merges over the projection (immediate local-only add, no uninstalls)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Populated state + absent BASE config + a local config declaring one
    // EXTRA marketplace with no plugins: the post-migration merged view is
    // projection + local, so the planner must NOT plan uninstalls for the
    // recorded entries. WILL-01 / D-65.1-02: the local-only marketplace add is
    // immediate and has no reload-deferred child work, so it produces no
    // pending row -- a change consisting only of immediate actions yields the
    // empty advisory. The regression this guards against (absent base treated
    // as empty desired state) would instead surface `will uninstall` rows for
    // every recorded entry, so the empty advisory is the discriminating signal.
    await writePopulatedProjectState(cwd);
    await writeFile(
      path.join(cwd, ".pi", "claude-plugins.local.json"),
      JSON.stringify(
        { schemaVersion: 1, marketplaces: { "zzz-extra": { source: "acme/extra" } }, plugins: {} },
        null,
        2,
      ),
      "utf8",
    );

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.equal(emitted, "Pending: next reload will apply 0 actions.");
  });
});

test("scope routing: explicit --scope user routes to user-scope load only (still emits the empty advisory in a clean env)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "user",
    });
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    assert.equal(
      ctx.ui.notify.mock.calls[0]!.arguments[0],
      "Pending: next reload will apply 0 actions.",
    );
  });
});

/**
 * FSTAT-06 / D-66-04: stage a project scope where marketplace `mp-github` is
 * RECORDED (its clone is on disk with a real manifest) but plugin `cr` is
 * DECLARED+enabled and NOT yet installed -- so the planner emits a
 * `pluginsToInstall`. The on-disk `cr` plugin root carries a `.lsp.json`
 * (lspServers) when `degrade` is true, which resolveStrict resolves
 * `unsupported` -> the install would degrade -> `(will force install)`. With
 * `degrade` false the root is clean -> `installable` -> plain `(will install)`.
 */
async function stageForceInstallScenario(cwd: string, degrade: boolean): Promise<void> {
  const projectScopeRoot = path.join(cwd, ".pi");
  const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
  const marketplaceRoot = path.join(extensionRoot, "marketplaces", "mp-github");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(marketplaceRoot, "cr"), { recursive: true });
  if (degrade) {
    // lspServers is an unsupported component kind -> resolveStrict yields
    // `unsupported` (no structural defect).
    await writeFile(path.join(marketplaceRoot, "cr", ".lsp.json"), "{}", "utf8");
  }

  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp-github",
      plugins: [{ name: "cr", source: "./cr", version: "1.0.0" }],
    }),
    "utf8",
  );

  // Recorded marketplace, NO recorded plugin -> `cr` is a planned install.
  await writeFile(
    path.join(extensionRoot, "state.json"),
    JSON.stringify({
      schemaVersion: 1,
      marketplaces: {
        "mp-github": {
          name: "mp-github",
          scope: "project",
          source: "acme/tools",
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot,
          plugins: {},
        },
      },
    }),
    "utf8",
  );

  // Declared+enabled `cr@mp-github`; marketplace source matches the record so
  // the planner produces an install (not a source mismatch).
  await writeFile(
    path.join(projectScopeRoot, "claude-plugins.json"),
    JSON.stringify({
      schemaVersion: 1,
      marketplaces: { "mp-github": { source: "acme/tools" } },
      plugins: { "cr@mp-github": { enabled: true } },
    }),
    "utf8",
  );
}

test("FSTAT-06: a planned install whose candidate resolves unsupported renders (will force install) through the pending surface", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await stageForceInstallScenario(cwd, true);

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.ok(
      emitted.includes("(will force install)"),
      "expected the degrading planned install to render (will force install); got:\n" + emitted,
    );
    assert.ok(emitted.includes("cr"), "expected the cr plugin row; got:\n" + emitted);
    // D-66-05: no will-force-update analog is ever produced.
    assert.ok(
      !emitted.includes("will force update") && !emitted.includes("will update"),
      "the reconcile pending surface must never render a will-(force-)update row; got:\n" + emitted,
    );
  });
});

test("FSTAT-06: a planned install whose candidate resolves installable renders plain (will install)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await stageForceInstallScenario(cwd, false);

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.ok(
      emitted.includes("(will install)"),
      "expected the clean planned install to render (will install); got:\n" + emitted,
    );
    assert.ok(
      !emitted.includes("(will force install)"),
      "an installable candidate must NOT render the force modifier; got:\n" + emitted,
    );
  });
});

// FSTAT-06 fallback: a planned install whose marketplace is DECLARED-but-not-
// RECORDED (no state.json entry) has no cached clone to resolve against, so
// `locateCandidate` finds no `recordedMarketplaces` entry (record === undefined)
// and the row stays a plain `(will install)` -- the preview cannot truthfully
// assert a degrade it cannot resolve.
test("FSTAT-06 fallback: an install under a declared-but-not-recorded marketplace renders plain (will install)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Config declares `newmp` + `pp@newmp`, but there is NO state.json -> the
    // marketplace is not recorded, so no cached manifest to resolve the candidate.
    const projectScopeRoot = path.join(cwd, ".pi");
    await mkdir(projectScopeRoot, { recursive: true });
    await writeFile(
      path.join(projectScopeRoot, "claude-plugins.json"),
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: { newmp: { source: "acme/new" } },
        plugins: { "pp@newmp": { enabled: true } },
      }),
      "utf8",
    );

    const ctx = makeCtx(cwd);
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.ok(emitted.includes("pp"), "expected the pp plugin row; got:\n" + emitted);
    assert.ok(
      emitted.includes("(will install)"),
      "an unresolvable candidate must render plain (will install); got:\n" + emitted,
    );
    assert.ok(
      !emitted.includes("(will force install)"),
      "an unrecorded marketplace must NOT render the force modifier; got:\n" + emitted,
    );
  });
});

// FSTAT-06 fallback: a RECORDED marketplace whose cached manifest is corrupt.
// `locateCandidate` calls loadMarketplaceManifest, which THROWS on unparseable
// JSON; `resolvePendingForceInstalls` catches the throw and degrades the row to
// a plain `(will install)`. The read-only pending surface must never let the
// throw escape (IL-2 single-notify discipline).
test("FSTAT-06 fallback: a corrupt recorded manifest degrades the force preview to plain (will install), no throw", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Stage the degrading scenario (cr resolves unsupported -> would be
    // `(will force install)`), then corrupt the recorded manifest so the
    // force-preview resolve throws and is caught.
    await stageForceInstallScenario(cwd, true);
    const manifestPath = path.join(
      cwd,
      ".pi",
      "pi-claude-marketplace",
      "marketplaces",
      "mp-github",
      ".claude-plugin",
      "marketplace.json",
    );
    await writeFile(manifestPath, "{ not valid json at all", "utf8");

    const ctx = makeCtx(cwd);
    // Must NOT throw despite the corrupt manifest.
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.ok(emitted.includes("cr"), "expected the cr plugin row; got:\n" + emitted);
    assert.ok(
      emitted.includes("(will install)"),
      "a caught force-preview throw must degrade to plain (will install); got:\n" + emitted,
    );
    assert.ok(
      !emitted.includes("(will force install)"),
      "a caught force-preview throw must NOT render the force modifier; got:\n" + emitted,
    );
  });
});

// FSTAT-06 fallback: a RECORDED marketplace whose cached manifest is VALID but
// does NOT list the planned plugin. `locateCandidate` loads the manifest
// successfully, then `manifest.plugins.find` returns undefined
// (manifestEntry === undefined) -> no candidate -> plain `(will install)`.
// This is the distinct twin of the `record === undefined` (unrecorded
// marketplace) fallback above: here the marketplace IS recorded and the
// manifest IS readable, but the plugin name is absent from it.
test("FSTAT-06 fallback: a recorded manifest that omits the planned plugin renders plain (will install), no throw", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectScopeRoot = path.join(cwd, ".pi");
    const extensionRoot = path.join(projectScopeRoot, "pi-claude-marketplace");
    const marketplaceRoot = path.join(extensionRoot, "marketplaces", "mp-github");
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });

    // Valid manifest that lists a DIFFERENT plugin -- the planned `ghost`
    // install has no manifest entry to resolve its force preview against.
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "mp-github",
        plugins: [{ name: "other", source: "./other", version: "1.0.0" }],
      }),
      "utf8",
    );

    // Recorded marketplace, NO recorded plugin -> `ghost` is a planned install.
    await writeFile(
      path.join(extensionRoot, "state.json"),
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: {
          "mp-github": {
            name: "mp-github",
            scope: "project",
            source: "acme/tools",
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: {},
          },
        },
      }),
      "utf8",
    );

    // Declared+enabled `ghost@mp-github`; the marketplace source matches the
    // record so the planner produces an install (not a source mismatch).
    await writeFile(
      path.join(projectScopeRoot, "claude-plugins.json"),
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: { "mp-github": { source: "acme/tools" } },
        plugins: { "ghost@mp-github": { enabled: true } },
      }),
      "utf8",
    );

    const ctx = makeCtx(cwd);
    // Must NOT throw despite the manifest omitting the plugin.
    await pendingReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
    });

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const emitted = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
    assert.ok(emitted.includes("ghost"), "expected the ghost plugin row; got:\n" + emitted);
    assert.ok(
      emitted.includes("(will install)"),
      "a manifest that omits the plugin must render plain (will install); got:\n" + emitted,
    );
    assert.ok(
      !emitted.includes("(will force install)"),
      "a missing manifest entry must NOT render the force modifier; got:\n" + emitted,
    );
  });
});
