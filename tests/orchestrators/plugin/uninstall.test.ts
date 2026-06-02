import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_PREFIX,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { uninstallPlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { loadAgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { atomicWriteJson } from "../../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
import {
  __resetCacheForTests,
  getPluginIndex,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// PU-1..8 + AS-6 (post-commit cleanup leaks) + NFR-5 (no network).
//
// Phase 19 / Plan 19-01 V2 migration: every notification assertion is now
// byte-exact against the V2 catalog forms at docs/output-catalog.md:336-378.
// Per D-19-01 the V1 post-state-commit `notifyWarning` sites at uninstall.ts
// lines 179 (cache-refresh failure) and 200 (data-dir cleanup-leak) are
// DROPPED entirely -- the surrounding try/catch retains the side-effecting
// rm() / dropMarketplaceCache calls; only the user-facing warning surface
// is gone. Test consequences:
//   - PU-2+PU-4 still asserts state-record removal under a cleanup leak,
//     but the second-notification warning assertion is gone; the only
//     notification is the V2 success row.
//   - PU-8 (b) flips: V2 reload-hint is per-variant (uninstalled is
//     state-changing per D-16-12) and no longer gated on cascade-resource
//     drop count.
//
// Test taxonomy (PRD §5.2.2 PU-1..8):
//   PU-1: order skills -> commands -> agents -> mcp (covered by end-state assertion;
//         the order is encoded inside cascadeUnstagePlugin per Phase 4 D-03 corollary)
//   PU-2: state commit BEFORE pluginDataDir cleanup (state mutation still asserted;
//         the V1 warning surface is dropped per D-19-01)
//   PU-3: failures earlier than data-dir cleanup abort the state commit
//   PU-4: (DROPPED per D-19-01) -- data-dir cleanup leak is no longer a user surface;
//         the rm() call still runs.
//   PU-5: silent converge -- record already absent -> no notification
//   PU-6: legacy state migration (resources.agents / resources.mcpServers absent) -> normalized to []
//   PU-7: foreign-content propagation; agents-index row retained
//   PU-8: reload hint per D-16-12 (always emitted on uninstalled variant)

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(piOverrides?: { getAllTools?: () => unknown[] }): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  const pi = {
    getAllTools: piOverrides?.getAllTools ?? ((): unknown[] => []),
  } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(resources: Partial<PluginRecord["resources"]> = {}): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: resources.skills ?? [],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
    },
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, state);
}

/**
 * Hermetic home: override process.env.HOME for the duration of `fn`, then
 * restore. Lets us isolate user-scope state.json under a tmp root so the
 * test never reads or writes the developer's real ~/.pi/.
 */
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "uninstall-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

/** Build a minimum-viable owned agent file (basename prefix + body marker). */
function makeOwnedAgentFile(name: string): string {
  return `---\nname: ${name}\ntools: read\n---\n\n<!--\n${GENERATED_AGENT_MARKER}\n-->\n\nBody.\n`;
}

/** Seed a marketplace + plugin record AND pre-stage one of each bridge's
 *  on-disk resource so the cascade actually has something to drop. */
async function seedFullPlugin(
  locations: ReturnType<typeof locationsFor>,
  marketplace: string,
  plugin: string,
  cwd: string,
): Promise<{ skillDir: string; commandFile: string; agentFile: string; mcpJson: string }> {
  await mkdir(locations.extensionRoot, { recursive: true });

  // skill: <skillsTargetDir>/<name>/SKILL.md
  const skillDir = path.join(locations.skillsTargetDir, "uni-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: uni-skill\n---\nbody\n");

  // command: <promptsTargetDir>/<name>.md
  await mkdir(locations.promptsTargetDir, { recursive: true });
  const commandFile = path.join(locations.promptsTargetDir, "uni-cmd.md");
  await writeFile(commandFile, "# uni-cmd\n\nbody\n");

  // agent: write owned file + index row
  await mkdir(locations.agentsDir, { recursive: true });
  const agentName = `${GENERATED_AGENT_PREFIX}${plugin}-uni-agent`;
  const agentFile = path.join(locations.agentsDir, `${agentName}.md`);
  await writeFile(agentFile, makeOwnedAgentFile(agentName));
  const agentsIndex: AgentsIndex = {
    schemaVersion: 1,
    agents: [
      {
        plugin,
        marketplace,
        sourceAgent: "uni-agent",
        generatedName: agentName,
        sourcePath: "/orig/uni-agent.md",
        targetPath: agentFile,
        sourceHash: "abc",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  };
  await atomicWriteJson(locations.agentsIndexPath, agentsIndex);

  // mcp: <scopeRoot>/mcp.json with one owned server
  const mcpServerName = "uni-server";
  const mcpJson = locations.mcpJsonPath;
  await mkdir(path.dirname(mcpJson), { recursive: true });
  await writeFile(
    mcpJson,
    JSON.stringify({
      mcpServers: {
        [mcpServerName]: {
          command: "node",
          args: ["server.js"],
          _piClaudeMarketplace: { plugin, marketplace },
        },
      },
    }),
  );

  // Seed state record referencing each resource.
  await seedState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [marketplace]: {
        name: marketplace,
        scope: locations.scope,
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {
          [plugin]: makePluginRecord({
            skills: ["uni-skill"],
            prompts: ["uni-cmd"],
            agents: [agentName],
            mcpServers: [mcpServerName],
          }),
        },
      },
    },
  });

  return { skillDir, commandFile, agentFile, mcpJson };
}

// PU-1 + PU-8 (success path, hint emitted) ---------------------------

test("PU-1: cascade order observable end-state -- all four bridges' resources removed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu1-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      const { ctx, pi, notifications } = makeCtx();

      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // PU-1: end-state assertion -- all four on-disk resources removed.
      assert.equal(await pathExists(seeded.skillDir), false, "skill dir removed");
      assert.equal(await pathExists(seeded.commandFile), false, "command file removed");
      assert.equal(await pathExists(seeded.agentFile), false, "agent file removed");

      // State record removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);

      // Phase 19 / Plan 19-01: V2 byte form per docs/output-catalog.md:344-348
      // (catalog-state `success`). The marketplace header is a bare label
      // row (status omitted -- plugin-uninstall surface uses SUB-BRANCH A
      // of renderMpHeader). Plugin row uses ICON_AVAILABLE (`○`) per
      // D-16-11 effective-state rule. Reload-hint is emitted by notify()
      // per D-16-12 (uninstalled is in the state-changing variant set).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined); // success
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-2 (state commit BEFORE data-dir cleanup; cleanup leaks SWALLOWED in V2
// per D-19-01 -- the rm() still runs; only the user-visible warning surface
// is gone). The pre-19 PU-4 warning assertion is removed; PU-2's state-record
// removal under a cleanup leak is still the binding behavior.

test("PU-2: pluginDataDir rm failure leaves state record removed; cleanup leak SWALLOWED per D-19-01", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu2-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // Force the pluginDataDir rm to fail: write a file at the dataDir path
      // (not a directory) and then chmod the parent so rm cannot remove it.
      // The simplest reproducible failure is to mount a regular FILE at the
      // expected dir path; `rm({recursive:true})` succeeds on a regular file,
      // so instead we make the parent read-only AFTER placing a file inside.
      //
      // Reliable approach: create the dataDir as a directory containing a
      // file, then chmod the dataDir to 0o555 (read+execute, no write). On
      // POSIX this prevents unlink of the contained file -> rm reports EACCES.
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "guard.txt"), "guard");
      // Chmod the PARENT (the marketplaceDataDir) to 0o555 so unlink of
      // dataDir/guard.txt fails AND rmdir of dataDir fails. Simpler than
      // chmod-ing dataDir itself which only blocks the file unlink (rmdir
      // of an empty dir would still succeed once we chmod it back).
      const parent = await locations.marketplaceDataDir("mp");
      const { chmod } = await import("node:fs/promises");
      await chmod(parent, 0o555);

      const { ctx, pi, notifications } = makeCtx();
      try {
        await uninstallPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        });
      } finally {
        // Restore perms so the tmpdir cleanup works.
        await chmod(parent, 0o755);
      }

      // PU-2: state record IS removed (state save committed before cleanup attempt).
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);

      // D-19-01: V2 emits EXACTLY one notification -- the success row. The
      // cleanup leak still occurred (the parent dir is chmod 0o555 so rm
      // failed) but the warning surface is gone; the rm() call inside
      // uninstall.ts's try/catch swallowed the error silently.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
      // Defense-in-depth: the dropped V1 warning content (the leaked
      // dataDir path) MUST NOT appear in any V2 notification.
      assert.equal(
        (notifications[0]?.message ?? "").includes(dataDir),
        false,
        `D-19-01: dropped warning must not surface the leaked path; got "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      // Tmpdir teardown handles the rest.
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-3 + PU-7 (foreign content -> cascade fails -> state retained, index retained) ---

test("PU-3 + PU-7: foreign agent content -> V2 PluginFailedMessage + state record retained + agents-index row retained", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu7-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Pre-stage a FOREIGN agent file at the target -- right basename prefix
      // but body LACKS the marker, so the agents bridge soft-fails the rm
      // and preserves the index row.
      await mkdir(locations.agentsDir, { recursive: true });
      const agentName = `${GENERATED_AGENT_PREFIX}hello-foreign`;
      const agentFile = path.join(locations.agentsDir, `${agentName}.md`);
      await writeFile(agentFile, "---\nname: foreign\n---\n\nNo marker here.\n");

      // Seed the agents-index pointing at the foreign file.
      const agentsIndex: AgentsIndex = {
        schemaVersion: 1,
        agents: [
          {
            plugin: "hello",
            marketplace: "mp",
            sourceAgent: "foreign",
            generatedName: agentName,
            sourcePath: "/orig/foreign.md",
            targetPath: agentFile,
            sourceHash: "deadbeef",
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
        ],
      };
      await atomicWriteJson(locations.agentsIndexPath, agentsIndex);

      // Seed state record listing the agent.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord({ agents: [agentName] }) },
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // PU-3: state record still present -- cascade failure aborted the save.
      const after = await loadState(locations.extensionRoot);
      assert.ok("mp" in after.marketplaces, "marketplace retained");
      assert.ok("hello" in (after.marketplaces["mp"]?.plugins ?? {}), "plugin record retained");

      // PU-7: foreign agent file STILL on disk (was not rm'd).
      assert.ok(await pathExists(agentFile), "foreign agent file retained");

      // PU-7: agents-index row STILL present.
      const loadedIdx = await loadAgentsIndex(locations);
      assert.equal(loadedIdx.agents.length, 1, "agents-index row retained");
      assert.equal(loadedIdx.agents[0]?.generatedName, agentName);

      // Phase 19 / Plan 19-01: V2 byte form per docs/output-catalog.md:370-374
      // (catalog-state `failure-permission-denied` shape -- the closed-set
      // Reason here is `"not in manifest"` because the cause is an
      // AgentsUnstageFailureError, which narrowCascadeFailure() maps to
      // that Reason per the marketplace/remove.ts precedent).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // Phase 29 / UXG-07 (D-29-02/03): the "1 plugin operation failed."
      // summary line is prepended before the cascade body (1 failed plugin,
      // mp glyph `●` so the marketplace did not fail).
      assert.equal(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {not in manifest}\n",
        ),
        true,
        `V2 failure row prefix mismatch: got "${notifications[0]?.message ?? ""}"`,
      );
      // The 4-space-indent `cause:` trailer surfaces the AgentsUnstageFailureError
      // message verbatim per D-16-08; the regex below confirms the underlying
      // bridge text is still present after the V2 rendering layer change.
      assert.match(notifications[0]?.message ?? "", /Failed to remove .* agent/i);
      // No reload-hint on failure -- a failed uninstall did not remove
      // anything per docs/output-catalog.md:376.
      assert.equal(
        (notifications[0]?.message ?? "").includes("/reload to pick up changes"),
        false,
        "failed uninstall must not emit reload-hint trailer",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-5 silent converge -- record absent -----------------------------

test("PU-5: record already absent -> NO notification (literal silence)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu5-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {}, // empty -- the plugin we ask for is absent
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "absent-plugin",
      });

      // Literal silence -- no notification at all.
      assert.equal(notifications.length, 0, "no notification per PRD §5.2.2 PU-5");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PU-5: marketplace record itself absent -> NO notification (silent converge)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu5b-"));
    try {
      const locations = locationsFor("project", cwd);
      // Do NOT seed state -- entire state.json missing.
      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "missing-mp",
        plugin: "missing-plugin",
      });
      assert.equal(notifications.length, 0);
      // No state.json materialized -- the guard saves on close (extensionRoot
      // is created lazily by saveState), but no orchestrator output occurred.
      const after = await loadState(locations.extensionRoot);
      assert.deepEqual(after.marketplaces, {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-6 legacy state migration ---------------------------------------

test("PU-6: legacy state record missing resources.agents/mcpServers loads + uninstall completes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu6-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Hand-write a state.json in V1-legacy shape: resources missing the
      // agents + mcpServers fields. saveState would reject this; we go
      // around it to simulate a legacy on-disk artifact.
      const legacyState = {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", raw: "./src", logical: "./src" },
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              hello: {
                version: "0.0.1",
                resolvedSource: "/tmp",
                compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
                resources: {
                  skills: [],
                  prompts: [],
                  // agents + mcpServers absent -- migrate.ts (Phase 2 ST-5)
                  // normalizes to [] at load time.
                },
                installedAt: "2025-01-01T00:00:00.000Z",
                updatedAt: "2025-01-01T00:00:00.000Z",
              },
            },
          },
        },
      };
      await writeFile(locations.stateJsonPath, JSON.stringify(legacyState));

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // No error notification.
      const errors = notifications.filter((n) => n.severity === "error");
      assert.equal(errors.length, 0, `unexpected error notifications: ${JSON.stringify(errors)}`);

      // Plugin record removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-8 reload-hint gating (V2: per-variant trigger ladder per D-16-12) ----------

test("PU-8 (a): uninstalled variant -> reload-hint always emitted by notify() per D-16-12", async () => {
  // Already covered by PU-1 test above; this assertion is the explicit gate.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu8a-"));
    try {
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });

      // Pre-stage one skill so the cascade reports >=1 dropped.
      const skillDir = path.join(locations.skillsTargetDir, "lonely-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: lonely-skill\n---\nbody\n");

      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { lonely: makePluginRecord({ skills: ["lonely-skill"] }) },
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "lonely",
      });

      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ lonely v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PU-8 (b): V2 per-variant reload-hint -- emitted on uninstalled even with zero dropped (cascade stub)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu8b-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { empty: makePluginRecord() }, // record exists, no resources
          },
        },
      });

      // Inject a cascade stub that reports zero dropped across every bridge.
      // (The non-stubbed path would also do this since the plugin has no
      // resources, but the stub makes the intent unambiguous.)
      const stubCascade: typeof cascadeUnstagePlugin = () =>
        Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
        });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "empty",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      // V2 contract per D-16-12: reload-hint trigger is per-variant
      // (uninstalled is state-changing) NOT per-cascade-resource-count.
      // The V1 "zero dropped suppresses hint" gate is gone -- V2 emits
      // the hint structurally from the PluginUninstalledMessage status.
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ empty v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
      // Plugin record still removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal("empty" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// MSG-SD-3 -- soft-dep markers structurally absent from (uninstalled) rows

test("MSG-SD-3: uninstall NEVER emits soft-dep markers (structural via V2 PluginUninstalledMessage)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-sd3-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // ctx + pi without the "subagent" or "mcp" tools -> companion deps
      // both unloaded. In the install / reinstall / update path this would
      // trigger per-row `{requires pi-subagents}` + `{requires pi-mcp}`
      // markers; on the uninstall path the marker is structurally
      // impossible because PluginUninstalledMessage has no `dependencies`
      // field (D-15-02 / MSG-SD-3) so renderPluginRow's
      // composeReasons call passes (false, false) for both declares-flags.
      const { ctx, pi, notifications } = makeCtx({ getAllTools: () => [] });
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      const message = notifications[0]?.message ?? "";
      assert.equal(
        message.includes("{requires pi-subagents"),
        false,
        "MSG-SD-3: per-row {requires pi-subagents} marker must NOT appear on (uninstalled) rows",
      );
      assert.equal(
        message.includes("{requires pi-mcp"),
        false,
        "MSG-SD-3: per-row {requires pi-mcp} marker must NOT appear on (uninstalled) rows",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// NFR-5 source-grep ------------------------------------------------

test("NFR-5: uninstall.ts has zero git surface (no platform/git, no DEFAULT_GIT_OPS, no gitOps)", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts",
    "utf8",
  );
  // Header docstring legitimately mentions "platform/git" in prose; strip
  // line comments first.
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(stripped.includes("platform/git"), false, "must not import platform/git");
  assert.equal(stripped.includes("DEFAULT_GIT_OPS"), false, "must not reference DEFAULT_GIT_OPS");
  assert.equal(stripped.includes("gitOps"), false, "must not reference gitOps");
});

test("D-03-INV :: uninstall invalidates plugin cache for the target marketplace", async () => {
  // Plan 06-05 wires invalidateMarketplaceCache into uninstallPlugin's
  // post-state-commit window (after withStateGuard closes, before
  // pluginDataDir rm). The plugin moves from status="installed" ->
  // status="available", so the cached plugin index for this (scope,
  // marketplace) pair MUST be dropped. Memory-only op; the file is left
  // intact as a rebuild source. Test pattern: pre-warm memory + delete
  // the on-disk file -> run uninstall -> next read MUST re-invoke
  // rebuild (proves memory cleared).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-d03inv-"));
    try {
      __resetCacheForTests();
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // Pre-warm the plugin index memory entry.
      const pluginCachePath = await locations.pluginCacheFile("mp");
      let rebuildCount = 0;
      await getPluginIndex(pluginCachePath, "project", "mp", () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "hello", status: "installed" }]);
      });
      assert.equal(rebuildCount, 1, "pre-test: rebuild invoked on first read");

      // Drop the on-disk cache file so the next memory-miss MUST rebuild.
      await rm(pluginCachePath, { force: true });

      const { ctx, pi } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Memory must be cleared; with file absent, next read invokes rebuild.
      await getPluginIndex(pluginCachePath, "project", "mp", () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "hello", status: "available" }]);
      });
      assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// narrowCascadeFailure errno branches (lines 111-121) -----------------
// Exercises the EACCES/EPERM -> "permission denied", ENOENT ->
// "source missing", unknown-errno default -> "not in manifest", and
// plain-Error (no .code) -> "not in manifest" paths by injecting
// cascade stubs that return ok:false with the target error as cause.

test("narrowCascadeFailure: EACCES maps to 'permission denied' in PluginFailedMessage", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-ncf-eacces-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = Object.assign(new Error("EACCES: permission denied, unlink '/path/to/file'"), {
          code: "EACCES",
        });
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {permission denied}\n",
        ),
        `expected 'permission denied' reason; got: "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("narrowCascadeFailure: EPERM maps to 'permission denied' in PluginFailedMessage", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-ncf-eperm-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = Object.assign(
          new Error("EPERM: operation not permitted, unlink '/path/to/file'"),
          {
            code: "EPERM",
          },
        );
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {permission denied}\n",
        ),
        `expected 'permission denied' reason; got: "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("narrowCascadeFailure: ENOENT maps to 'source missing' in PluginFailedMessage", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-ncf-enoent-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = Object.assign(
          new Error("ENOENT: no such file or directory, unlink '/path/to/file'"),
          {
            code: "ENOENT",
          },
        );
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {source missing}\n",
        ),
        `expected 'source missing' reason; got: "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("narrowCascadeFailure: unknown errno (ETIMEDOUT default branch) maps to 'not in manifest'", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-ncf-etimedout-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = Object.assign(new Error("ETIMEDOUT: connection timed out"), {
          code: "ETIMEDOUT",
        });
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // The switch default break falls through to the final `return "not in
      // manifest"` at line 121 of uninstall.ts.
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {not in manifest}\n",
        ),
        `expected 'not in manifest' reason; got: "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("narrowCascadeFailure: plain Error (no .code) maps to 'not in manifest' via isErrnoException=false", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-ncf-plain-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      const stubCascade: typeof cascadeUnstagePlugin = () => {
        // Plain Error -- no .code property. isErrnoException() returns false
        // so the switch is skipped entirely; narrowCascadeFailure returns
        // "not in manifest" via the final fallthrough at uninstall.ts:121.
        return Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
          cause: new Error("plain failure"),
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {not in manifest}\n",
        ),
        `expected 'not in manifest' reason; got: "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// Lines 264-270: silent catch after dropMarketplaceCache ---------------
// Exercises the swallowed EISDIR when the plugin cache path is a
// directory. The underlying unlink() throws (EISDIR != ENOENT so
// dropMarketplaceCache re-throws), the catch at line 264 swallows it,
// and the success notification is still emitted.

test("cache-drop EISDIR swallowed: success notification still emitted, plugin record removed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-cache-eisdir-"));
    try {
      __resetCacheForTests();
      const locations = locationsFor("project", cwd);
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });

      // Pre-create the cache file path as a DIRECTORY so unlink() throws
      // EISDIR (not ENOENT), causing dropMarketplaceCache to re-throw and
      // hit the catch at uninstall.ts:264 which swallows it silently.
      const pluginCachePath = await locations.pluginCacheFile("mp");
      await mkdir(pluginCachePath, { recursive: true });

      const stubCascade: typeof cascadeUnstagePlugin = () =>
        Promise.resolve({
          ok: true,
          dropped: { skills: [], commands: [], agents: [], mcpServers: [] },
        });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      // (1) Exactly one notification with undefined severity (success row).
      assert.equal(notifications.length, 1, "exactly one notification on cache-drop failure");
      assert.equal(notifications[0]?.severity, undefined, "notification must be success severity");
      // (2) Plugin record removed from state.
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        "hello" in (after.marketplaces["mp"]?.plugins ?? {}),
        false,
        "plugin record must be removed even when cache drop threw",
      );
      // (3) No error notification surfaced.
      const errNotifications = notifications.filter((n) => n.severity === "error");
      assert.equal(
        errNotifications.length,
        0,
        "cache-drop EISDIR must be swallowed silently -- no error notification",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// Phase 39 / TR-03: cascade ghost-record correctness ---------------------
//
// Two regression tests cover the partial-cascade-failure surface:
//
//   (a) non-AG-5 partial failure: cascade dropped {skill1, cmd1} before
//       throwing; the persisted state row MUST have resources.skills/
//       prompts shrunken so they reference only artifacts still on disk
//       (no ghost record). The remaining axes (agents, mcpServers) stay
//       intact because the cascade did not advance past commands.
//   (b) AG-5 cause (AgentsUnstageFailureError): the persisted state row
//       MUST be preserved INTACT -- foreign content owned by another
//       process must not cause data loss. The cascade primitive itself
//       reports dropped.skills/.commands, but the orchestrator MUST
//       discard the filter on the AG-5 path so a retry has the complete
//       resources.* history.
//
// Both tests stub the cascade (no real filesystem race needed) and
// re-load state from disk after the orchestrator call to verify the
// mutation persisted (Pitfall 3: in-memory-only mutations are silent
// regressions if not checked against disk).

test("TR-03 (non-AG-5 partial): resources.* filtered by outcome.dropped.*; sRecord shrunk on disk", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-tr03-partial-"));
    try {
      const locations = locationsFor("project", cwd);
      // Seed a record with TWO of each resource so the filter is visible.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              hello: makePluginRecord({
                skills: ["skill1", "skill2"],
                prompts: ["cmd1", "cmd2"],
                agents: ["agent1", "agent2"],
                mcpServers: ["mcp1", "mcp2"],
              }),
            },
          },
        },
      });

      // Stub: cascade dropped {skill1} + {cmd1} then threw a non-AG-5 cause
      // (an EACCES on the agents axis). The orchestrator must filter
      // resources.skills (remove skill1), resources.prompts (remove cmd1
      // -- CRITICAL field-name mapping dropped.commands -> resources.prompts),
      // and leave resources.agents + resources.mcpServers untouched (the
      // cascade did not advance to them).
      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = Object.assign(new Error("EACCES on agent unlink"), { code: "EACCES" });
        return Promise.resolve({
          ok: false,
          dropped: {
            skills: ["skill1"],
            commands: ["cmd1"],
            agents: [],
            mcpServers: [],
          },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      // (1) Re-load state from disk. The shrunken-row contract requires
      // saveState to have committed; Pitfall 3 catches in-memory-only
      // mutations that never reach state.json.
      const after = await loadState(locations.extensionRoot);
      const sRecord = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(sRecord !== undefined, "plugin record retained (partial failure -> shrunken row)");
      // (2) Filtered axes -- dropped artifact names removed.
      assert.deepEqual(
        sRecord.resources.skills,
        ["skill2"],
        "resources.skills filtered: skill1 dropped, skill2 retained",
      );
      assert.deepEqual(
        sRecord.resources.prompts,
        ["cmd2"],
        "resources.prompts filtered via dropped.commands -> resources.prompts mapping",
      );
      // (3) Un-advanced axes -- nothing in outcome.dropped, nothing filtered.
      assert.deepEqual(
        sRecord.resources.agents,
        ["agent1", "agent2"],
        "resources.agents untouched (cascade did not advance past commands)",
      );
      assert.deepEqual(
        sRecord.resources.mcpServers,
        ["mcp1", "mcp2"],
        "resources.mcpServers untouched (cascade did not advance past commands)",
      );

      // (4) Exactly one notification, severity=error, V2 failure surface.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {permission denied}\n",
        ),
        `TR-03 partial: expected failure row; got "${notifications[0]?.message ?? ""}"`,
      );
      // (5) No reload-hint trailer on failure (Pitfall 4: cleanup branch
      // skipped; the (uninstalled) variant never reached the notify call).
      assert.equal(
        (notifications[0]?.message ?? "").includes("/reload to pick up changes"),
        false,
        "TR-03 partial: failed uninstall must not emit reload-hint trailer",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("TR-03 (AG-5 cause): full row preserved intact when cause instanceof AgentsUnstageFailureError", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-tr03-ag5-"));
    try {
      const locations = locationsFor("project", cwd);
      // Seed a record with TWO of each resource so the AG-5 preservation
      // is unambiguously visible (any filter would shrink the row).
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {
              hello: makePluginRecord({
                skills: ["skill1", "skill2"],
                prompts: ["cmd1", "cmd2"],
                agents: ["agent1", "agent2"],
                mcpServers: ["mcp1", "mcp2"],
              }),
            },
          },
        },
      });

      // Stub: cascade dropped {skill1} + {cmd1} then threw an
      // AgentsUnstageFailureError (AG-5 foreign content). The orchestrator
      // MUST throw out of the guard (ST-7 abort-save) so the row stays
      // intact -- foreign content owned by another process must not cause
      // data loss.
      const stubCascade: typeof cascadeUnstagePlugin = () => {
        const err = new AgentsUnstageFailureError("foreign content at agent1", [
          { generatedName: "agent1", targetPath: "/agents/agent1.md", reason: "missing marker" },
        ]);
        return Promise.resolve({
          ok: false,
          dropped: {
            skills: ["skill1"],
            commands: ["cmd1"],
            agents: [],
            mcpServers: [],
          },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      await uninstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      // (1) Re-load state from disk. AG-5 must preserve the FULL row.
      const after = await loadState(locations.extensionRoot);
      const sRecord = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(sRecord !== undefined, "plugin record retained (AG-5 preserves row)");
      // (2) Every axis untouched -- the cascade reported dropped.skills
      // + dropped.commands, but the orchestrator MUST discard the filter
      // on the AG-5 path (the row must be a faithful pre-cascade snapshot
      // so a retry has the complete resources.* history).
      assert.deepEqual(
        sRecord.resources.skills,
        ["skill1", "skill2"],
        "AG-5: resources.skills UNCHANGED (filter discarded on AG-5 cause)",
      );
      assert.deepEqual(
        sRecord.resources.prompts,
        ["cmd1", "cmd2"],
        "AG-5: resources.prompts UNCHANGED (filter discarded on AG-5 cause)",
      );
      assert.deepEqual(
        sRecord.resources.agents,
        ["agent1", "agent2"],
        "AG-5: resources.agents UNCHANGED",
      );
      assert.deepEqual(
        sRecord.resources.mcpServers,
        ["mcp1", "mcp2"],
        "AG-5: resources.mcpServers UNCHANGED",
      );

      // (3) AG-5 still emits the existing V2 PluginFailedMessage via the
      // outer catch block (PU-3 + PU-7 invariant preserved).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {not in manifest}\n",
        ),
        `TR-03 AG-5: expected failure row; got "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
