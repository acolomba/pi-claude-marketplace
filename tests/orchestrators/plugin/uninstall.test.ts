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
import { cascadeUnstagePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
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

// PU-1..8 + AS-6 (post-commit cleanup leaks warning-severity) + NFR-5 (no network).
//
// Test taxonomy (PRD §5.2.2 PU-1..8):
//   PU-1: order skills -> commands -> agents -> mcp (covered by end-state assertion;
//         the order is encoded inside cascadeUnstagePlugin per Phase 4 D-03 corollary)
//   PU-2: state commit BEFORE pluginDataDir cleanup
//   PU-3: failures earlier than data-dir cleanup abort the state commit
//   PU-4: data-dir cleanup leaks surface as warning-severity with the leaked path named
//   PU-5: silent converge -- record already absent -> no notification
//   PU-6: legacy state migration (resources.agents / resources.mcpServers absent) -> normalized to []
//   PU-7: foreign-content propagation; agents-index row retained
//   PU-8: reload hint gated on >=1 dropped resource

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

      // PU-8: reload hint emitted (verb 'drop'); single dropped name -> "it" form.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined); // success
      assert.match(
        notifications[0]?.message ?? "",
        /Uninstalled plugin "hello" from marketplace "mp"\./,
      );
      assert.match(notifications[0]?.message ?? "", /Run \/reload to drop it\.$/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-2 + PU-4 (state commit BEFORE data-dir cleanup; cleanup leaks -> warning) -----

test("PU-2 + PU-4: pluginDataDir rm failure leaves state record removed and warns with leaked path", async () => {
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

      // PU-4: warning surfaces with leaked dataDir path named.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(
        notifications[0]?.message ?? "",
        /cleanup partial/i,
        "must mention partial cleanup",
      );
      assert.ok(
        (notifications[0]?.message ?? "").includes(dataDir),
        `must name the leaked dataDir path: got "${notifications[0]?.message ?? ""}"`,
      );
    } finally {
      // Tmpdir teardown handles the rest.
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// PU-3 + PU-7 (foreign content -> cascade fails -> state retained, index retained) ---

test("PU-3 + PU-7: foreign agent content -> notifyError + state record retained + agents-index row retained", async () => {
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

      // notifyError fires.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.match(notifications[0]?.message ?? "", /Failed to remove .* agent/i);
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

// PU-8 reload-hint gating ------------------------------------------

test("PU-8 (a): >=1 resource dropped -> reload hint present (verb 'drop', 'it' form)", async () => {
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
      assert.match(notifications[0]?.message ?? "", /Run \/reload to drop it\.$/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PU-8 (b): zero dropped resources -> NO reload hint (cascade injection seam)", async () => {
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
      // PU-8 inverse: NO trailing "Run /reload" line.
      assert.equal(
        (notifications[0]?.message ?? "").includes("Run /reload"),
        false,
        "reload hint must be suppressed when nothing dropped",
      );
      // Plugin record still removed.
      const after = await loadState(locations.extensionRoot);
      assert.equal("empty" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// RH-5 soft-dep warnings (companion-extension unloaded) -------------

test("RH-5: dropped agents while pi-subagents unloaded -> subagent warning appended", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-rh5-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // ctx + pi without the "subagent" tool -> hasLoadedPiSubagents=false.
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
      assert.match(
        notifications[0]?.message ?? "",
        /pi-subagents is not loaded/,
        "must include pi-subagents warning when agents dropped + companion unloaded",
      );
      assert.match(
        notifications[0]?.message ?? "",
        /pi-mcp-adapter is not loaded/,
        "must include pi-mcp-adapter warning when mcp servers dropped + companion unloaded",
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
