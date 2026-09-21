import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_MARKER } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  AgentsUnstageFailureError,
  cascadeUnstagePlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import { createUninstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import {
  createUninstallPlugin,
  UninstallRefusedError,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { loadAgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { atomicWriteJson } from "../../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  MarketplaceNotFoundError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import { retryTree } from "./scope-tree-inventory.ts";
import {
  createStateFifo,
  FIFO_SKIP,
  OVER_READ_SENTINEL,
  serializedStateBytes,
  startFifoStateServer,
} from "./state-fifo.ts";

import type { FifoStateServer } from "./state-fifo.ts";
import type { HooksRouting } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type {
  UninstallPluginOperation,
  UninstallPluginOptions,
  UninstallPluginOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TestContext } from "node:test";

// PU-1..8 + AS-6 (post-commit cleanup leaks).
//
// Every notification assertion is byte-exact against the catalog forms
// at docs/output-catalog.md:336-378. Per D-19-01 the post-state-commit
// `notifyWarning` sites in uninstall.ts (cache-refresh failure and
// data-dir cleanup-leak) are DROPPED entirely -- the surrounding
// try/catch retains the side-effecting rm() / dropMarketplaceCache
// calls; only the user-facing warning surface is gone. Test
// consequences:
//   - PU-2+PU-4 still asserts state-record removal under a cleanup leak,
//     but there is no second-notification warning assertion; the only
//     notification is the success row.
//   - PU-8 (b): reload-hint is per-variant (uninstalled is
//     state-changing per D-16-12), not gated on cascade-resource
//     drop count.
//
// Test taxonomy (PRD §5.2.2 PU-1..8):
//   PU-1: order skills -> commands -> agents -> mcp (covered by end-state assertion;
//         the order is encoded inside cascadeUnstagePlugin per the D-03 corollary)
//   PU-2: state commit BEFORE pluginDataDir cleanup (state mutation still asserted;
//         the warning surface is dropped per D-19-01)
//   PU-3: failures earlier than data-dir cleanup abort the state commit
//   PU-4: (DROPPED per D-19-01) -- data-dir cleanup leak is not a user surface;
//         the rm() call still runs.
//   PU-5: silent converge -- record already absent -> no notification
//   PU-6: legacy state migration (resources.agents / resources.mcpServers absent) -> normalized to []
//   PU-7: foreign-content propagation; agents-index row retained
//   PU-8: reload hint per D-16-12 (always emitted on uninstalled variant)

interface NotifyRecord {
  message: string;
  severity?: string;
}

/** Populate one lifecycle runtime with a distinct hook route. */
async function populateRuntimeRoute(
  cwd: string,
  runtime: HooksRuntime,
  opts: { readonly command: string; readonly marketplace: string; readonly plugin: string },
): Promise<HooksRouting> {
  const pluginRoot = path.join(cwd, "runtime-routes", `${opts.marketplace}-${opts.plugin}`);
  const hooksJsonPath = path.join(pluginRoot, "hooks.json");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ hooks: [{ command: opts.command, type: "command" }], matcher: "" }],
    }),
    "utf8",
  );
  const hooksRouting = createHooksRouting(runtime, { readHooksJson });
  await hooksRouting.readAndCachePluginHooks({
    cwd,
    hooksJsonPath,
    logPrefix: "uninstall-owner-test",
    marketplace: opts.marketplace,
    plugin: opts.plugin,
    resolvedSource: asAbsolutePluginRoot(pluginRoot),
    scope: "project",
  });
  hooksRouting.rebuildRoutingTables();
  return hooksRouting;
}

test("uninstall exposes its required transaction factory", () => {
  assert.strictEqual(typeof createUninstallPlugin, "function");
});

/** Construct one production uninstall operation with fresh lifecycle owners. */
function createUninstallOwner(): UninstallPluginOperation {
  return createUninstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

function uninstallWithFreshOwner(
  opts: UninstallPluginOptions & { notifications: { mode: "orchestrated" } },
): Promise<UninstallPluginOutcome>;
function uninstallWithFreshOwner(
  opts: UninstallPluginOptions,
): Promise<UninstallPluginOutcome | undefined>;
function uninstallWithFreshOwner(
  opts: UninstallPluginOptions,
): Promise<UninstallPluginOutcome | undefined> {
  return createUninstallOwner()(opts);
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
  } as ExtensionContext;
  const pi = {
    getAllTools: piOverrides?.getAllTools ?? ((): unknown[] => []),
  } as ExtensionAPI;
  return { ctx, pi, notifications };
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function makePluginRecord(
  resources: Partial<PluginRecord["resources"]> = {},
  provenance: PluginRecord["provenance"] = "explicit",
): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: resources.skills ?? [],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
      hooks: resources.hooks ?? [],
    },
    enabled: true,
    provenance,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function cascadeFailure(cause: Error): typeof cascadeUnstagePlugin {
  return () =>
    Promise.resolve({
      ok: false,
      dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
      cause,
    });
}

async function seedState(extensionRoot: string, state: ExtensionState): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, state);
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  return withHermeticEnvironment("uninstall-", fn);
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
): Promise<{
  skillDir: string;
  commandFile: string;
  agentFile: string;
  hooksFile: string;
  mcpJson: string;
}> {
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
  const agentName = `pi-claude-marketplace-${plugin}-uni-agent`;
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

  // hooks: <hooksDir>/<plugin>/hooks.json -- the path shape hookConfigPathFor
  // composes, which is what removeHookConfig removes on the cascade's 5th arm.
  const hooksFile = path.join(locations.hooksDir, plugin, "hooks.json");
  await mkdir(path.dirname(hooksFile), { recursive: true });
  await writeFile(hooksFile, JSON.stringify({ hooks: {} }));

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
        // LIFE-04: nothing writes a marketplace.json under this cwd, so the
        // recorded manifest path never exists. A single record has no sibling
        // whose declarations the dependents guard would read (D-05-14), so the
        // installation record alone drives the cascade.
        manifestPath: path.join(cwd, "marketplace.json"),
        marketplaceRoot: cwd,
        plugins: {
          [plugin]: makePluginRecord({
            skills: ["uni-skill"],
            prompts: ["uni-cmd"],
            agents: [agentName],
            mcpServers: [mcpServerName],
            hooks: [plugin],
          }),
        },
      },
    },
  });

  return { skillDir, commandFile, agentFile, hooksFile, mcpJson };
}

// PU-1 + PU-8 (success path, hint emitted) ---------------------------

test("PU-1: cascade order observable end-state -- all four bridges' resources removed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu1-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      const { ctx, pi, notifications } = makeCtx();

      await uninstallWithFreshOwner({
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

      // V2 byte form per docs/output-catalog.md:344-348
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
      assert.doesNotMatch(notifications[0]?.message ?? "", /Plugin uninstall:/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** A surviving plugin data tree: its inventory plus the seeded session bytes. */
interface DataTree {
  readonly tree: readonly string[];
  readonly sessionBytes: Buffer | null;
}

/**
 * The plugin data tree under `dataDir`, or `null` once the directory itself is
 * gone: the deleting disposition removes the directory, not only its contents,
 * so the two dispositions differ in exactly this value.
 */
async function readDataTree(dataDir: string): Promise<DataTree | null> {
  if (!(await pathExists(dataDir))) {
    return null;
  }

  const sessionFile = path.join(dataDir, "nested", "session.bin");
  return {
    tree: await retryTree(dataDir),
    sessionBytes: (await pathExists(sessionFile)) ? await readFile(sessionFile) : null,
  };
}

// WR-06: the preserving disposition stamps `{data kept}`; the two deleting
// cases (false and omitted) keep the byte-frozen bare row, so the brace is
// exactly as discriminating as the data tree beside it.
for (const scope of ["user", "project"] as const) {
  for (const { keepData, expectedDataTree, expectedReasonBrace } of [
    {
      keepData: true,
      expectedDataTree: {
        tree: ["nested/", "nested/session.bin"],
        sessionBytes: Buffer.from([0, 7, 255, 10]),
      },
      expectedReasonBrace: " {data kept}",
    },
    { keepData: false, expectedDataTree: null, expectedReasonBrace: "" },
    { keepData: undefined, expectedDataTree: null, expectedReasonBrace: "" },
  ] satisfies readonly {
    keepData: boolean | undefined;
    expectedDataTree: DataTree | null;
    expectedReasonBrace: string;
  }[]) {
    test(`uninstall preserves nested data only when keepData is true (${String(keepData)}, ${scope})`, async () => {
      // arrange
      await withHermeticHome(async () => {
        const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-data-policy-"));
        try {
          const locations = locationsFor(scope, cwd);
          const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
          const dataDir = await locations.pluginDataDir("mp", "hello");
          await mkdir(path.join(dataDir, "nested"), { recursive: true });
          await writeFile(
            path.join(dataDir, "nested", "session.bin"),
            Buffer.from([0, 7, 255, 10]),
          );
          await writeFile(locations.configJsonPath, '{"plugins":{"hello@mp":{}}}\n');
          const otherLocations = locationsFor(scope === "user" ? "project" : "user", cwd);
          const otherDataDir = await otherLocations.pluginDataDir("mp", "hello");
          await mkdir(path.join(otherDataDir, "nested"), { recursive: true });
          await writeFile(path.join(otherDataDir, "nested", "sentinel"), Buffer.from([31, 65, 0]));
          const { ctx, pi, notifications } = makeCtx();

          // act
          const outcome = await uninstallWithFreshOwner({
            ctx,
            pi,
            scope,
            cwd,
            marketplace: "mp",
            plugin: "hello",
            ...(keepData !== undefined && { keepData }),
          });

          // assert
          assert.strictEqual(outcome, undefined);
          assert.deepStrictEqual(
            await readFile(path.join(otherDataDir, "nested", "sentinel")),
            Buffer.from([31, 65, 0]),
          );
          assert.deepStrictEqual(await loadState(locations.extensionRoot), {
            schemaVersion: 3,
            marketplaces: {
              mp: {
                name: "mp",
                scope,
                source: { kind: "path", logical: "./src", raw: "./src" },
                addedFromCwd: cwd,
                manifestPath: path.join(cwd, "marketplace.json"),
                marketplaceRoot: cwd,
                plugins: {},
              },
            },
          });
          assert.strictEqual(
            await readFile(locations.configJsonPath, "utf8"),
            '{\n  "plugins": {},\n  "schemaVersion": 1\n}\n',
          );
          assert.deepStrictEqual(
            await Promise.all(
              [seeded.skillDir, seeded.commandFile, seeded.agentFile, seeded.hooksFile].map(
                (file) => pathExists(file),
              ),
            ),
            [false, false, false, false],
          );
          assert.deepStrictEqual(JSON.parse(await readFile(seeded.mcpJson, "utf8")), {
            mcpServers: {},
          });
          assert.deepStrictEqual(await loadAgentsIndex(locations), {
            schemaVersion: 1,
            agents: [],
            corruptions: [],
          });
          assert.deepStrictEqual(await readDataTree(dataDir), expectedDataTree);
          assert.deepStrictEqual(notifications, [
            {
              message: `● mp [${scope}]\n  ○ hello v0.0.1 (uninstalled)${expectedReasonBrace}\n\n/reload to pick up changes`,
            },
          ]);
        } finally {
          await rm(cwd, { recursive: true, force: true });
        }
      });
    });
  }
}

// PU-2 (state commit BEFORE data-dir cleanup; cleanup leaks SWALLOWED
// per D-19-01 -- the rm() still runs; only the user-visible warning surface
// is gone). There is no PU-4 warning assertion; PU-2's state-record
// removal under a cleanup leak is the binding behavior.

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
        await uninstallWithFreshOwner({
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
      // Defense-in-depth: the dropped warning content (the leaked
      // dataDir path) MUST NOT appear in any notification.
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

// NFR-10 (a containment assertion must never be absorbed by a D-19-01
// hygiene `catch {}`) ---

test("NFR-10: pluginDataDir containment failure PROPAGATES; it is not swallowed as a cleanup leak", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-nfr10-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // Mount the plugin data dir as a SYMLINK pointing outside dataRoot.
      // assertPathInside lstat's every segment from dataRoot down and throws
      // SymlinkRefusedError on the first symlink, so pluginDataDir("mp",
      // "hello") -- and ONLY that getter -- fails. uninstall.ts calls it
      // exactly once, in runPostUninstallCleanup, which isolates this to the
      // call under test. pluginCacheFile resolves under cacheDir and is
      // unaffected, so the cleanup step before it still runs normally.
      const escape = await mkdtemp(path.join(tmpdir(), "uninstall-nfr10-escape-"));
      const parent = await locations.marketplaceDataDir("mp");
      await mkdir(parent, { recursive: true });
      const dataDir = path.join(parent, "hello");
      await rm(dataDir, { recursive: true, force: true });
      const { symlink } = await import("node:fs/promises");
      await symlink(escape, dataDir);

      const { ctx, pi } = makeCtx();

      // Before the fix this rejected NOTHING: the getter sat inside the
      // D-19-01 try, so a refused symlink was indistinguishable from an rm
      // leak and uninstall reported plain success while the escape target
      // survived. D-19-01 sanctions swallowing the cleanup, not the
      // assertion guarding it.
      await assert.rejects(
        uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        }),
        (err: unknown) =>
          err instanceof Error && /symlink|contain/i.test(`${err.name} ${err.message}`),
        "a refused symlink under dataRoot must reach the caller, not be absorbed by the hygiene catch",
      );

      await rm(escape, { recursive: true, force: true });
    } finally {
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
      const agentName = "pi-claude-marketplace-hello-foreign";
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
      await uninstallWithFreshOwner({
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

      // V2 byte form per docs/output-catalog.md `failure-permission-denied`
      // shape. ATTR-09 / D-47-B: the cause is an AgentsUnstageFailureError
      // (foreign content owned by another process), which narrowCascadeFailure
      // maps to the truthful `"source mismatch"` member rather than claiming
      // the plugin is gone from the manifest.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      // UXG-07 (D-29-02/03): the "A plugin operation has failed."
      // summary line is prepended before the cascade body (1 failed plugin,
      // mp glyph `●` so the marketplace did not fail).
      assert.equal(
        (notifications[0]?.message ?? "").startsWith(
          "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {source mismatch}\n",
        ),
        true,
        `V2 failure row prefix mismatch: got "${notifications[0]?.message ?? ""}"`,
      );
      // The 4-space-indent `cause:` trailer surfaces the AgentsUnstageFailureError
      // message verbatim per D-16-08; the regex below confirms the underlying
      // bridge text is present.
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

test("PU-5 / D-01: standalone uninstall of an already-gone plugin -> error row (not installed)", async () => {
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
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "absent-plugin",
      });

      // D-01: the standalone command names an absent target it cannot operate
      // on -> error row (was literal silence). The orchestrated reconcile
      // converge stays silent (covered separately).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith("A plugin operation has failed.\n\n"),
        `PU-5 error summary mismatch: got "${notifications[0]?.message ?? ""}"`,
      );
      assert.match(notifications[0]?.message ?? "", /⊘ absent-plugin \(failed\) \{not installed\}/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-04 / M4: marketplace record itself absent -> LOUD {marketplace not added} (explicit scope)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-pu5b-"));
    try {
      const locations = locationsFor("project", cwd);
      // Do NOT seed state -- entire state.json missing in BOTH scopes. The
      // marketplace was never added; ATTR-04 makes this LOUD (distinct from
      // the silent already-gone-plugin converge above). The standalone
      // `marketplace-not-added` variant carries the requested-scope bracket.
      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "missing-mp",
        plugin: "missing-plugin",
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ missing-mp [project] (failed) {marketplace not added}",
      );
      // No state mutation -- the resolver short-circuits before the guard.
      const after = await loadState(locations.extensionRoot);
      assert.deepEqual(after.marketplaces, {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SCOPE-01: explicit-scope uninstall of an other-scope-only target names the scope the container sits in", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-scope01-"));
    try {
      // The plugin is installed in USER scope; the operator asks PROJECT.
      const userLocations = locationsFor("user", cwd);
      await seedState(userLocations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "user",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord({}) },
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // SCOPE-01: not silent, not {not in manifest}. Nothing of the
      // marketplace is installed at the requested scope, so the PLUGIN is the
      // row's subject and the brace names where the container really is
      // beside `not installed`. The user record is untouched.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n" +
          "● mp [project]\n" +
          "  ⊘ hello (failed) {not installed, marketplace in user scope}",
      );
      const userAfter = await loadState(userLocations.extensionRoot);
      assert.ok("hello" in (userAfter.marketplaces["mp"]?.plugins ?? {}), "user record retained");
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

      // Hand-write a state.json in legacy shape: resources missing the
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
                  // agents + mcpServers absent -- migrate.ts (ST-5)
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
      await uninstallWithFreshOwner({
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

// PU-8 reload-hint gating (per-variant trigger ladder per D-16-12) ----------

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
      await uninstallWithFreshOwner({
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
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
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
      // Contract per D-16-12: reload-hint trigger is per-variant
      // (uninstalled is state-changing) NOT per-cascade-resource-count.
      // There is no "zero dropped suppresses hint" gate -- the hint is
      // emitted structurally from the PluginUninstalledMessage status.
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
      await uninstallWithFreshOwner({
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

test("D-03-INV :: uninstall invalidates plugin cache for the target marketplace", async () => {
  // invalidateMarketplaceCache runs in uninstallPlugin's
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
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const completionCache = createCompletionCache();
      const uninstallPlugin = createUninstallOperation(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );

      // Pre-warm the plugin index memory entry.
      const pluginCachePath = await locations.pluginCacheFile("mp");
      let rebuildCount = 0;
      await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () => {
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
      await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () => {
        rebuildCount += 1;
        return Promise.resolve([{ name: "hello", status: "available" }]);
      });
      assert.equal(rebuildCount, 2, "post-invalidation read re-invokes rebuild");
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
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
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

// TR-03: cascade ghost-record correctness ---------------------
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
// mutation persisted (in-memory-only mutations are silent
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
                hooks: ["hello"],
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
            hooks: ["hello"],
            mcpServers: [],
          },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      const ownerRuntime = createHooksRuntime();
      const peerRuntime = createHooksRuntime();
      const hooksRouting = await populateRuntimeRoute(cwd, ownerRuntime, {
        command: "echo partial-owner",
        marketplace: "mp",
        plugin: "hello",
      });
      await populateRuntimeRoute(cwd, peerRuntime, {
        command: "echo partial-peer",
        marketplace: "mp",
        plugin: "hello",
      });
      await createUninstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stubCascade,
      });

      // (1) Re-load state from disk. The shrunken-row contract requires
      // saveState to have committed; the disk re-load catches in-memory-only
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
          "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {permission denied}\n",
        ),
        `TR-03 partial: expected failure row; got "${notifications[0]?.message ?? ""}"`,
      );
      // (5) No reload-hint trailer on failure (cleanup branch skipped; the
      // (uninstalled) variant never reached the notify call).
      assert.equal(
        (notifications[0]?.message ?? "").includes("/reload to pick up changes"),
        false,
        "TR-03 partial: failed uninstall must not emit reload-hint trailer",
      );
      assert.deepEqual(ownerRuntime.getRoutingBucket("PreToolUse"), []);
      assert.deepEqual(
        peerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["hello"],
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
            hooks: [],
            mcpServers: [],
          },
          cause: err,
        });
      };

      const { ctx, pi, notifications } = makeCtx();
      const ownerRuntime = createHooksRuntime();
      const hooksRouting = await populateRuntimeRoute(cwd, ownerRuntime, {
        command: "echo ag5-owner",
        marketplace: "mp",
        plugin: "hello",
      });
      await createUninstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({
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

      // (3) AG-5 still emits the V2 PluginFailedMessage via the outer catch
      // block (PU-3 + PU-7 invariant preserved). ATTR-09 / D-47-B: the
      // foreign-content cause now narrows to the truthful `{source mismatch}`.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.ok(
        (notifications[0]?.message ?? "").startsWith(
          "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello v0.0.1 (failed) {source mismatch}\n",
        ),
        `TR-03 AG-5: expected failure row; got "${notifications[0]?.message ?? ""}"`,
      );
      assert.deepEqual(
        ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["hello"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { code, reason } of [
  { code: "EIO", reason: "unreadable" },
  { code: "ENOENT", reason: "source missing" },
] as const) {
  test(`cascade failure maps ${code} to ${reason}`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), `uninstall-cascade-${code.toLowerCase()}-`));
      try {
        // arrange
        const locations = locationsFor("project", cwd);
        await seedFullPlugin(locations, "mp", "hello", cwd);
        const cause = Object.assign(new Error(`${code} during cascade`), { code });
        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          cascade: cascadeFailure(cause),
        });

        // assert
        assert.equal(outcome, undefined);
        assert.deepEqual(notifications, [
          {
            message:
              `A plugin operation has failed.\n\n● mp [project]\n` +
              `  ⊘ hello v0.0.1 (failed) {${reason}}\n` +
              `    cause: ${code} during cascade`,
            severity: "error",
          },
        ]);
        const state = await loadState(locations.extensionRoot);
        assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("cascade failure maps StateLockHeldError to lock held independently of its message", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-cascade-lock-held-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const cause = new StateLockHeldError("project", locations.stateLockFile);
      cause.message = "wording deliberately unrelated to contention";
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: cascadeFailure(cause),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {lock held}\n" +
            "    cause: wording deliberately unrelated to contention",
          severity: "error",
        },
      ]);
      const state = await loadState(locations.extensionRoot);
      assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("cascade failure maps an unclassified error to unreadable", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-cascade-unclassified-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const cause = new Error("unexpected cascade failure");
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: cascadeFailure(cause),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {unreadable}\n" +
            "    cause: unexpected cascade failure",
          severity: "error",
        },
      ]);
      const state = await loadState(locations.extensionRoot);
      assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("cascade failure without a cause uses the exported fallback error", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-cascade-no-cause-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const noCauseCascade: typeof cascadeUnstagePlugin = () =>
        Promise.resolve({
          ok: false,
          dropped: { skills: [], commands: [], agents: [], hooks: [], mcpServers: [] },
        });
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: noCauseCascade,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {unreadable}\n" +
            '    cause: Cascade unstage failed for plugin "hello".',
          severity: "error",
        },
      ]);
      const state = await loadState(locations.extensionRoot);
      assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("cascade string rejection is normalized before rendering", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-cascade-string-rejection-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const rejectNonError = Promise.reject.bind(Promise);
      const stringRejectingCascade: typeof cascadeUnstagePlugin = () =>
        rejectNonError("string cascade rejection");
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: stringRejectingCascade,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {unreadable}\n" +
            "    cause: string cascade rejection",
          severity: "error",
        },
      ]);
      const state = await loadState(locations.extensionRoot);
      assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// RECON-03: orchestrated-mode coverage
// ───────────────────────────────────────────────────────────────────────────

test("RECON-03 uninstall orchestrated mode -- cascade failure returns a typed result with ZERO notify calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-cascade-failure-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const cause = Object.assign(new Error("cascade denied"), { code: "EACCES" });
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cascade: cascadeFailure(cause),
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepEqual(outcome, {
        status: "failed",
        reason: "permission denied",
        error: cause,
        cause: "cascade denied",
      });
      assert.deepEqual(notifications, []);
      const state = await loadState(locations.extensionRoot);
      assert.ok(state.marketplaces["mp"]?.plugins["hello"] !== undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-03 uninstall orchestrated mode -- success returns { status: 'uninstalled', name, version } with ZERO notify calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-ok-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(path.join(dataDir, "nested"), { recursive: true });
      await writeFile(path.join(dataDir, "nested", "history"), "orchestrated history\n");
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
        keepData: true,
      });

      assert.deepStrictEqual(outcome, { status: "uninstalled", name: "hello", version: "0.0.1" });
      if (outcome.status === "uninstalled") {
        assert.equal(outcome.name, "hello");
      }

      assert.strictEqual(
        await readFile(path.join(dataDir, "nested", "history"), "utf8"),
        "orchestrated history\n",
      );
      assert.deepStrictEqual(notifications, []);

      // State record removed via orchestrated path -- same cascade ran.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-06 uninstall orchestrated mode -- PU-5 silent converge (record already absent) returns { status: 'converged' }, never 'uninstalled', with ZERO notify calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-converge-"));
    try {
      const locations = locationsFor("project", cwd);
      // Marketplace container present, plugin record ABSENT -- the PU-5
      // converge arm (another process completed first, or there was never
      // an install). The orchestrated outcome must be the explicit
      // `converged` variant so applyReconcile can drop the row instead of
      // reporting an uninstall this process did not perform.
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
            plugins: {},
          },
        },
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "absent-plugin",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(
        outcome.status,
        "converged",
        "PU-5 converge must surface as the explicit converged arm (WR-06)",
      );
      if (outcome.status === "converged") {
        assert.equal(outcome.name, "absent-plugin");
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test(
  "WR-06 uninstall orchestrated mode -- marketplace removed after resolution converges without mutation",
  { skip: FIFO_SKIP, timeout: 60_000 },
  async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-concurrent-marketplace-removal-"));
      let stateServer: FifoStateServer | undefined;
      try {
        // arrange: state.json is a FIFO. Its FIRST read -- the unlocked
        // cross-scope resolution -- sees the marketplace; its SECOND read --
        // the locked re-load inside the transaction -- sees it gone, removed
        // by the other process. The pipe pairs each read with one payload, so
        // the removal provably lands between them.
        const locations = locationsFor("project", cwd);
        await mkdir(locations.extensionRoot, { recursive: true });
        const userLocations = locationsFor("user", cwd);
        await seedState(userLocations.extensionRoot, { schemaVersion: 2, marketplaces: {} });

        const presentState = await serializedStateBytes({
          schemaVersion: 2,
          marketplaces: {
            mp: {
              name: "mp",
              scope: "project",
              source: pathSource("./mp-src"),
              addedFromCwd: cwd,
              manifestPath: path.join(cwd, "marketplace.json"),
              marketplaceRoot: cwd,
              plugins: { hello: makePluginRecord() },
            },
          },
        });
        const removedState = await serializedStateBytes({ schemaVersion: 2, marketplaces: {} });

        createStateFifo(locations.stateJsonPath);
        stateServer = startFifoStateServer({
          statePath: locations.stateJsonPath,
          payloads: [presentState, removedState],
        });
        await stateServer.ready;
        const { ctx, pi, notifications } = makeCtx();
        let cascadeCalls = 0;

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          cwd,
          marketplace: "mp",
          plugin: "hello",
          cascade: (...args) => {
            cascadeCalls += 1;
            return cascadeUnstagePlugin(...args);
          },
          notifications: { mode: "orchestrated" },
        });
        const serverResult = await stateServer.complete;

        // assert
        assert.deepEqual(
          stateServer.messages,
          ["ready", "served:1", "served:2"],
          "uninstall must read state.json exactly twice: once to resolve, once under the lock",
        );
        assert.deepEqual(serverResult, { code: 0, signal: null });
        assert.equal(stateServer.stderr(), "");
        assert.deepEqual(outcome, { status: "converged", name: "hello" });
        assert.equal(cascadeCalls, 0);
        assert.deepEqual(notifications, []);
        // A save renames the orchestrator's own file over the state path, so
        // the harness sentinel surviving IS the no-mutation proof (WR-04:
        // converge never saves).
        assert.equal(
          await readFile(locations.stateJsonPath, "utf8"),
          OVER_READ_SENTINEL,
          "PU-5 converge must leave state.json untouched",
        );
      } finally {
        stateServer?.kill();
        await rm(cwd, { recursive: true, force: true });
      }
    });
  },
);

test("RECON-03 uninstall orchestrated mode -- missing marketplace returns { status: 'failed', reason: 'marketplace not added' } no notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-na-"));
    try {
      const { ctx, pi, notifications } = makeCtx();
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "absent-mp",
        plugin: "anything",
        notifications: { mode: "orchestrated" },
      });

      assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
      assert.ok(outcome);
      assert.equal(outcome.status, "failed");
      if (outcome.status === "failed") {
        assert.equal(outcome.reason, "marketplace not added");
        assert.ok(outcome.error instanceof MarketplaceNotFoundError);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-03 uninstall standalone-default mode -- omitted notifications option remains byte-identical to today", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-default-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "byte-hello", cwd);
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "byte-hello",
      });
      assert.equal(outcome, undefined, "standalone (omitted) returns undefined");
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ byte-hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01/WB-02 write-back, --local, WR-09, CFG-03
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: standalone uninstall deletes the plugin entry from claude-plugins.json", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wb01-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // Pre-seed claude-plugins.json with the plugin entry so we can verify
      // the delete actually removes it.
      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          plugins: { "hello@mp": {}, "keep@mp": {} },
        },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cfg = await loadConfig(locations.configJsonPath);
      assert.equal(cfg.status, "valid");
      if (cfg.status === "valid") {
        assert.equal(cfg.config.plugins?.["hello@mp"], undefined);
        // Other plugin entry preserved.
        assert.deepEqual(cfg.config.plugins?.["keep@mp"], {});
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("cross-layer: standalone uninstall deletes the plugin key from BOTH the base and local files", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wb01-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      // Both layers declare the key -- the cross-layer sweep must clear both so
      // no dangling declaration survives in either physical file.
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      await saveConfig(
        locations.configLocalJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      // Both files no longer declare the key.
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status === "valid") {
        assert.equal(baseCfg.config.plugins?.["hello@mp"], undefined);
      }

      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.equal(localCfg.config.plugins?.["hello@mp"], undefined);
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-09 / T-56-03-01: orchestrated-mode uninstall SKIPS write-back; config untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wb01-orch-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      const bytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      // Config file byte-identical -- orchestrated mode skipped the write-back.
      const bytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: ALREADY-GONE uninstall leaves config byte-unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wb01-gone-"));
    try {
      const locations = locationsFor("project", cwd);
      // Seed marketplace but NOT the plugin record -- triggers PU-5 silent converge.
      await mkdir(locations.extensionRoot, { recursive: true });
      const { saveState } =
        await import("../../../extensions/pi-claude-marketplace/persistence/state-io.ts");
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, plugins: { "hello@mp": {} } },
        locations.scopeRoot,
      );
      const bytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // Config bytes UNCHANGED -- alreadyGone arm short-circuits before write-back.
      const bytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03 / T-56-03-04: invalid config aborts uninstall; basename-only cause; state untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wb01-cfg03-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);

      // Seed invalid base config.
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{ not valid json", "utf8");

      // WR-04: the abort must not rewrite state.json at
      // all -- bytes AND mtime stable (no-save abort discipline).
      const statePath = path.join(locations.extensionRoot, "state.json");
      const stateBytesPre = await readFile(statePath, "utf8");
      const stateMtimePre = (await stat(statePath)).mtimeMs;

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(notifications.length, 1);
      const note = notifications[0]!;
      assert.match(note.message, /\{invalid manifest\}/);
      assert.ok(
        !note.message.includes(locations.configJsonPath),
        `MUST NOT leak absolute configJsonPath, got: ${note.message}`,
      );

      // State record was NOT removed.
      const after = await loadState(locations.extensionRoot);
      assert.ok("hello" in (after.marketplaces["mp"]?.plugins ?? {}));

      // WR-04: state.json bytes + mtime unchanged on the CFG-03 abort.
      assert.equal(await readFile(statePath, "utf8"), stateBytesPre);
      assert.equal((await stat(statePath)).mtimeMs, stateMtimePre);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03 orchestrated invalid config returns a typed result without notification or mutation", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orch-invalid-config-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      await mkdir(path.dirname(locations.configJsonPath), { recursive: true });
      await writeFile(locations.configJsonPath, "{ not valid json", "utf8");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const cause = 'Config file "claude-plugins.json" failed schema validation.';
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepEqual(outcome, {
        status: "failed",
        reason: "invalid manifest",
        error: new Error(cause),
        cause,
      });
      assert.deepEqual(notifications, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after a successful uninstallPlugin, the hooks-bridge
// routing table no longer contains entries for the uninstalled plugin.
// Without the rebuildRoutingTables call inside the per-plugin lock,
// dispatch would continue to fire stale handlers (which the never-throws
// contract would convert to noop + hookDebugLog spawn-ENOENT entries --
// correct but wasteful and a /reload-blocked NFR-2 regression).
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: uninstallPlugin clears the plugin's routing-table entries without /reload", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-wr03-"));
    try {
      const locations = locationsFor("project", cwd);

      // Pre-seed state with a hooks-bearing plugin so the rebuild walk sees
      // a hooks resource. The slug `"p1"` mirrors the install-arm convention
      // (pluginId as the per-plugin hooks-container-dir slug).
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
              p1: makePluginRecord({ hooks: ["p1"] }),
            },
          },
        },
      });

      const ownerRuntime = createHooksRuntime();
      const peerRuntime = createHooksRuntime();
      const hooksRouting = await populateRuntimeRoute(cwd, ownerRuntime, {
        command: "echo target",
        marketplace: "mp",
        plugin: "p1",
      });
      await populateRuntimeRoute(cwd, ownerRuntime, {
        command: "echo unrelated",
        marketplace: "mp",
        plugin: "p2",
      });
      await populateRuntimeRoute(cwd, peerRuntime, {
        command: "echo peer",
        marketplace: "mp",
        plugin: "p1",
      });

      // Pre-condition: routing table holds the entry.
      assert.deepEqual(
        ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["p1", "p2"],
      );
      assert.deepEqual(
        peerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["p1"],
      );

      const { ctx, pi, notifications } = makeCtx();
      await createUninstallOperation(
        hooksRouting,
        createCompletionCache(),
      )({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "p1",
      });

      // Confirm uninstall succeeded (notification reports `uninstalled`,
      // not a failure marker).
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean uninstall notification; got: ${summary}`,
      );

      // Post-condition: the plugin is removed from state.
      const after = await loadState(locations.extensionRoot);
      assert.equal("p1" in (after.marketplaces["mp"]?.plugins ?? {}), false);

      // Post-condition: the routing-table entry for the uninstalled plugin
      // is gone. This proves WR-03's `rebuildRoutingTables(state, locations)`
      // ran inside `withLockedStateTransaction` right after
      // `removePluginConfigFromCache`.
      assert.deepEqual(
        ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["p2"],
      );
      assert.deepEqual(
        peerRuntime.getRoutingBucket("PreToolUse").map((entry) => entry.pluginId),
        ["p1"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-03: a post-save routing failure cannot roll back committed uninstall", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-routing-failure-"));
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
      const routingError = new Error("forced post-save routing failure");
      const { ctx, pi, notifications } = makeCtx();

      await createUninstallOperation(
        {
          rebuildRoutingTables(): void {
            throw new Error("rebuild must not run after cache removal throws");
          },
          removePluginConfigFromCache(): void {
            throw routingError;
          },
        },
        createCompletionCache(),
      )({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      assert.deepEqual(
        Object.keys((await loadState(locations.extensionRoot)).marketplaces.mp?.plugins ?? {}),
        [],
      );
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /hello v0\.0\.1 \(uninstalled\)/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PURL-05 / D-78-01: post-state-commit clone garbage-collection.
//
// After the uninstall transaction commits, uninstall calls
// garbageCollectPluginClones(locations) beside the existing
// rm(pluginDataDir) cleanup (D-19-01 swallow discipline). A git-source
// clone is reclaimed once no surviving record references it; a shared
// clone survives while another installed plugin still references it. The
// GC runs strictly AFTER the state save (T-78-08) and a GC leak never
// fails the user-visible uninstall (T-78-09).
// ─────────────────────────────────────────────────────────────────────────────

const GIT_SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

/**
 * Seed one git-source plugin record whose resolvedSource points at
 * `<pluginClonesDir>/<key>` and whose resolvedSha marks it as a live
 * referencer of that clone key, plus create the on-disk clone dir.
 */
async function seedGitPlugin(
  locations: ReturnType<typeof locationsFor>,
  marketplace: string,
  plugins: Record<string, string>, // pluginName -> cloneKey
  cwd: string,
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });

  const pluginRecords: Record<string, PluginRecord> = {};
  for (const [pluginName, cloneKey] of Object.entries(plugins)) {
    const record = makePluginRecord();
    record.resolvedSource = path.join(locations.pluginClonesDir, cloneKey);
    record.resolvedSha = GIT_SHA_A;
    pluginRecords[pluginName] = record;
    await mkdir(path.join(locations.pluginClonesDir, cloneKey), { recursive: true });
  }

  // D-05-14: with two records under one marketplace, uninstalling either one
  // reads the OTHER's declarations, so the recorded manifest must exist and
  // list both. Neither entry declares a dependency, so neither holds the other.
  const manifestPath = path.join(cwd, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: Object.keys(plugins).map((name) => ({ name, source: `./plugins/${name}` })),
    }),
  );

  await seedState(locations.extensionRoot, {
    schemaVersion: 3,
    marketplaces: {
      [marketplace]: {
        name: marketplace,
        scope: locations.scope,
        source: pathSource("./src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: cwd,
        plugins: pluginRecords,
      },
    },
  });
}

test("preservation bypasses the data path while retiring routes, caches and the last clone", async () => {
  // arrange
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-preserve-hygiene-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keySolo" }, cwd);
      const dataDir = await locations.pluginDataDir("mp", "solo");
      const retainedDir = path.join(cwd, "retained");
      await mkdir(path.join(retainedDir, "nested"), { recursive: true });
      await writeFile(path.join(retainedDir, "nested", "session"), "retained session\n");
      await mkdir(path.dirname(dataDir), { recursive: true });
      await symlink(retainedDir, dataDir);
      const runtime = createHooksRuntime();
      const hooksRouting = await populateRuntimeRoute(cwd, runtime, {
        command: "echo retained",
        marketplace: "mp",
        plugin: "solo",
      });
      const completionCache = createCompletionCache();
      const pluginCachePath = await locations.pluginCacheFile("mp");
      await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () =>
        Promise.resolve([{ name: "solo", status: "installed" }]),
      );
      const uninstallPlugin = createUninstallOperation(hooksRouting, completionCache);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallPlugin({
        ctx,
        pi,
        cwd,
        scope: "project",
        marketplace: "mp",
        plugin: "solo",
        keepData: true,
      });
      const cacheFilePresent = await pathExists(pluginCachePath);
      const rows = await completionCache.getPluginIndex(pluginCachePath, "project", "mp", () =>
        Promise.resolve([{ name: "solo", status: "available" }]),
      );
      const repeatedOutcome = await uninstallPlugin({
        ctx,
        pi,
        cwd,
        scope: "project",
        marketplace: "mp",
        plugin: "solo",
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.strictEqual(outcome, undefined);
      assert.deepStrictEqual(repeatedOutcome, { status: "converged", name: "solo" });
      assert.deepStrictEqual(await loadState(locations.extensionRoot), {
        schemaVersion: 3,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: { kind: "path", logical: "./src", raw: "./src" },
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: {},
          },
        },
      });
      assert.strictEqual(await readlink(dataDir), retainedDir);
      assert.deepStrictEqual(await readdir(dataDir), ["nested"]);
      assert.deepStrictEqual(await readdir(path.join(dataDir, "nested")), ["session"]);
      assert.strictEqual(
        await readFile(path.join(dataDir, "nested", "session"), "utf8"),
        "retained session\n",
      );
      assert.strictEqual(await pathExists(path.join(locations.pluginClonesDir, "keySolo")), false);
      assert.strictEqual(cacheFilePresent, false);
      assert.deepStrictEqual(rows, [{ name: "solo", status: "available" }]);
      assert.deepStrictEqual(runtime.getRoutingBucket("PreToolUse"), []);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ○ solo v0.0.1 (uninstalled) {data kept}\n\n/reload to pick up changes",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("uninstalling the last referencer of a git clone deletes its plugin-clones dir", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-gc-last-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keySolo" }, cwd);
      const cloneDir = path.join(locations.pluginClonesDir, "keySolo");
      assert.equal(await pathExists(cloneDir), true, "clone dir present before uninstall");

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "solo",
      });

      // Success row emitted, no error.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      // Last referencer removed -> clone dir garbage-collected.
      assert.equal(
        await pathExists(cloneDir),
        false,
        "clone dir removed after last referencer gone",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("uninstalling one of two plugins sharing a git clone leaves the clone until the last referencer is gone", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-gc-shared-"));
    try {
      const locations = locationsFor("project", cwd);
      // Both plugins resolve to the SAME clone key.
      await seedGitPlugin(locations, "mp", { alpha: "keyShared", beta: "keyShared" }, cwd);
      const cloneDir = path.join(locations.pluginClonesDir, "keyShared");
      assert.equal(await pathExists(cloneDir), true, "shared clone present before any uninstall");

      // Uninstall the FIRST sharer -> the clone survives (beta still references it).
      const first = makeCtx();
      await uninstallWithFreshOwner({
        ctx: first.ctx,
        pi: first.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "alpha",
      });
      assert.equal(
        await pathExists(cloneDir),
        true,
        "shared clone survives while beta still references it",
      );

      // Uninstall the SECOND sharer -> now the last referencer is gone, GC sweeps it.
      const second = makeCtx();
      await uninstallWithFreshOwner({
        ctx: second.ctx,
        pi: second.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "beta",
      });
      assert.equal(
        await pathExists(cloneDir),
        false,
        "shared clone removed once its last referencer is gone",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a GC rm leak does not fail the uninstall (leak swallowed per D-19-01)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-gc-leak-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keyLocked" }, cwd);

      // Make the pluginClonesDir read-only so GC's rm of the orphaned clone
      // fails with EACCES; the helper records a leak string and never throws,
      // and uninstall's belt-and-braces try/catch absorbs any throw. The
      // user-visible uninstall must still report success.
      const { chmod } = await import("node:fs/promises");
      await chmod(locations.pluginClonesDir, 0o500);

      const { ctx, pi, notifications } = makeCtx();
      try {
        await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "solo",
        });
      } finally {
        await chmod(locations.pluginClonesDir, 0o700);
      }

      // Uninstall still reports success (leak is not user-facing).
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const errors = notifications.filter((n) => n.severity === "error");
      assert.equal(errors.length, 0, "GC leak must not surface as an error notification");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GC never rolls back the committed uninstall: the state record is deleted even when GC leaks", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-gc-postcommit-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keyLocked" }, cwd);

      // Force the GC rm to leak (read-only clones dir). The state commit runs
      // BEFORE GC, so the record must be gone from state.json regardless.
      const { chmod } = await import("node:fs/promises");
      await chmod(locations.pluginClonesDir, 0o500);

      const { ctx, pi } = makeCtx();
      try {
        await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "solo",
        });
      } finally {
        await chmod(locations.pluginClonesDir, 0o700);
      }

      // Post-commit ordering: the record is deleted on disk even though GC leaked.
      const after = await loadState(locations.extensionRoot);
      assert.equal(
        "solo" in (after.marketplaces["mp"]?.plugins ?? {}),
        false,
        "committed uninstall must persist even when the post-commit GC leaks",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("cross-layer cascade: uninstall sweeps the plugin key from the sibling layer when declared there", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-xlayer-"));
    try {
      const locations = locationsFor("project", cwd);
      // State records marketplace `m` with one installable plugin `p`.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          m: {
            name: "m",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            plugins: { p: makePluginRecord() },
          },
        },
      });

      const { saveConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      // Base declares the marketplace but NOT the plugin key.
      await saveConfig(
        locations.configJsonPath,
        { schemaVersion: 1, marketplaces: { m: { source: "./src" } } },
        locations.scopeRoot,
      );
      // Local declares ONLY the plugin key `p@m`.
      await saveConfig(
        locations.configLocalJsonPath,
        { schemaVersion: 1, plugins: { "p@m": {} } },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      // STANDALONE mode (notifications omitted), targeting BASE.
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "m",
        plugin: "p",
      });

      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");

      // Neither physical file declares `p@m` afterward.
      const baseCfg = await loadConfig(locations.configJsonPath);
      assert.equal(baseCfg.status, "valid");
      if (baseCfg.status === "valid") {
        assert.equal(baseCfg.config.plugins?.["p@m"], undefined);
      }

      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.equal(localCfg.config.plugins?.["p@m"], undefined);
      }

      // Self-heal proof: merged planReconcile is clean.
      const { loadMergedScopeConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
      const { planReconcile } =
        await import("../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts");
      const { merged } = await loadMergedScopeConfig(locations);
      const stateAfter = await loadState(locations.extensionRoot);
      const plan = planReconcile(merged, stateAfter, "project");
      assert.equal(
        plan.sourceMismatches.length,
        0,
        `expected zero sourceMismatches; got ${JSON.stringify(plan.sourceMismatches)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-19-01: a clone-GC throw (plugin-clones path is a FILE) is swallowed -- the uninstall still succeeds", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-gc-throw-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      // A regular FILE at the plugin-clones path makes the GC's readdir throw
      // ENOTDIR (not the benign ENOENT no-op). The uninstall's belt-and-braces
      // catch must swallow it -- hygienic cleanup never becomes the primary
      // user-facing path.
      await writeFile(locations.pluginClonesDir, "not a directory");
      const { ctx, pi, notifications } = makeCtx();

      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // The success notification is byte-identical to the clean PU-1 path:
      // the GC throw leaves no trace on the user surface.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// LIFE-04: manifest-absent uninstall, one resource kind per case -------
//
// The installation record -- not the marketplace manifest -- drives
// uninstall: uninstall.ts imports no manifest module and no resolver, so a
// plugin whose marketplace entry is gone stays fully uninstallable. Each
// case below asserts the recorded manifest path does NOT exist before the
// call (the fact that makes this LIFE-04 coverage rather than ordinary
// uninstall coverage), then asserts exactly ONE resource kind's artifact is
// gone. D-98-12 chose per-kind isolation over fixture economy: a regression
// in one bridge arm turns exactly one case red and names the arm.

/** The `(uninstalled)` row bytes, identical to the form PU-1 pins. The
 *  resource-kind mix does not change the row, so every case shares it. */
const LIFE_04_UNINSTALLED_ROW =
  "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes";

/** The seeded manifest path, which no fixture ever writes. */
function manifestPathFor(cwd: string): string {
  return path.join(cwd, "marketplace.json");
}

test("LIFE-04: manifest-absent uninstall removes the skill directory", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-skills-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(await pathExists(seeded.skillDir), false, "skill dir removed");
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-04: manifest-absent uninstall removes the command file", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-commands-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(await pathExists(seeded.commandFile), false, "command file removed");
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-04: manifest-absent uninstall removes the agent file and its index row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-agents-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // The agents bridge owns two artifacts per agent -- the file and the
      // index row -- so this case asserts both halves of its cleanup.
      assert.equal(await pathExists(seeded.agentFile), false, "agent file removed");
      const loadedIdx = await loadAgentsIndex(locations);
      assert.equal(loadedIdx.agents.length, 0, "agents-index row removed");

      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-04: manifest-absent uninstall removes the staged hooks config", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-hooks-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(await pathExists(seeded.hooksFile), false, "staged hooks config removed");
      // Removal is confined to the plugin's own hooks directory; the sibling
      // locations bundle is untouched.
      assert.ok(await pathExists(locations.extensionRoot), "extension root retained");

      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-04: manifest-absent uninstall removes only the owned mcp.json server", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-mcp-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      // A second server carrying a DIFFERENT owning-plugin marker. Uninstall
      // removes only the keys the record owns; a document-clobbering rewrite
      // would pass the "owned key gone" assertion and fail this one.
      const seededDoc = JSON.parse(await readFile(seeded.mcpJson, "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      seededDoc.mcpServers["foreign-server"] = {
        command: "node",
        args: ["foreign.js"],
        _piClaudeMarketplace: { plugin: "other-plugin", marketplace: "mp" },
      };
      await writeFile(seeded.mcpJson, JSON.stringify(seededDoc));

      const { ctx, pi, notifications } = makeCtx();
      await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const afterDoc = JSON.parse(await readFile(seeded.mcpJson, "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      assert.equal("uni-server" in afterDoc.mcpServers, false, "owned server key removed");
      assert.ok("foreign-server" in afterDoc.mcpServers, "differently-owned server key retained");

      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-04: manifest-absent uninstall of a record with no resources still converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-life04-empty-"));
    try {
      const locations = locationsFor("project", cwd);
      // An inventory record with nothing on disk -- the shape a disabled
      // record persists -- is the input most likely to be mishandled by an
      // unguarded loop. Seeded directly because seedFullPlugin pre-stages
      // artifacts; every real cascade arm therefore runs against empty input.
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./src"),
            addedFromCwd: cwd,
            manifestPath: manifestPathFor(cwd),
            marketplaceRoot: cwd,
            plugins: { hello: makePluginRecord() },
          },
        },
      });
      assert.equal(await pathExists(manifestPathFor(cwd)), false, "manifest absent before call");

      const { ctx, pi, notifications } = makeCtx();
      await assert.doesNotReject(
        uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        }),
      );

      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false, "record removed");
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, LIFE_04_UNINSTALLED_ROW);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NFR-3 retry proof: every operation is safe to retry -- idempotent or
// fail-clean. NFR-2 bounds the recovery model: nothing below may need more
// than a reload.
//
// Every material uninstall failure or post-commit cleanup residue is consumed
// by a SECOND `uninstallPlugin` call over the same case-owned root, the same
// notification mode, and the same target. Between the two calls each case
// repairs only its injected failing collaborator or its case-owned fault
// fixture; no persistent byte, tree entry, or residue is reseeded.
//
// Schedule observation: uninstall's cascade and cleanup removals are
// `node:fs/promises` primitives with unambiguous target paths, so the forward
// ledger below is read straight off them. The state, config, agents-index, and
// mcp.json commits all route through `write-file-atomic`, which uses the
// callback `node:fs` surface and therefore leaves NO `node:fs/promises`
// signature; those commits are proved by authoritative bytes and complete tree
// inventory rather than by a schedule entry.
//
//   unstage:skill:<name>    rm of `<skillsTargetDir>/<name>`
//   unstage:command:<name>  unlink of `<promptsTargetDir>/<name>.md`
//   unstage:agent:<name>    rm of `<agentsDir>/<name>.md`
//   unstage:hooks           rm of `<hooksDir>/<plugin>`
//   drop:cache              unlink of `<cacheDir>/plugins/<marketplace>.json`
//   remove:data             rm of `<dataRoot>/<marketplace>/<plugin>`
//   gc:scan                 readdir of `<pluginClonesDir>`
//   gc:remove:<key>         rm of `<pluginClonesDir>/<key>`
//   refuse:<kind>           the case-owned fault refused the preceding call
// ─────────────────────────────────────────────────────────────────────────────

const retryRequire = createRequire(import.meta.url);
const retryFs = retryRequire("node:fs/promises") as typeof import("node:fs/promises");

/** Case-local projection of the paths the schedule observer recognizes. */
interface RetryTargets {
  readonly agentsDir: string;
  readonly cacheFile: string;
  readonly dataDir: string;
  readonly extensionRoot: string;
  readonly hooksPluginDir: string;
  readonly pluginClonesDir: string;
  readonly promptsTargetDir: string;
  readonly scopeRoot: string;
  readonly skillsTargetDir: string;
}

async function retryTargets(
  cwd: string,
  marketplace: string,
  plugin: string,
): Promise<RetryTargets> {
  const locations = locationsFor("project", cwd);
  return {
    agentsDir: locations.agentsDir,
    cacheFile: await locations.pluginCacheFile(marketplace),
    dataDir: await locations.pluginDataDir(marketplace, plugin),
    extensionRoot: locations.extensionRoot,
    hooksPluginDir: path.join(locations.hooksDir, plugin),
    pluginClonesDir: locations.pluginClonesDir,
    promptsTargetDir: locations.promptsTargetDir,
    scopeRoot: locations.scopeRoot,
    skillsTargetDir: locations.skillsTargetDir,
  };
}

/**
 * The six deterministic refusal points a retry case can arm. `config-write`
 * and `state-write` refuse the `mkdir` that `atomicWriteJson` issues for the
 * config layer and for `state.json`; the other four refuse the removal
 * primitive named by the kind.
 */
type RetryFaultKind =
  "cache-unlink" | "clone-rm" | "config-write" | "data-rm" | "hooks-rm" | "state-write";

/** One toggleable refusal. Repairing a case means flipping `enabled` to false. */
interface RetryFault {
  readonly code: string;
  enabled: boolean;
  readonly kind: RetryFaultKind;
}

/**
 * Record uninstall's forward cascade and cleanup ledger from the filesystem
 * primitives it issues, and optionally refuse exactly one of them so a partial
 * or cleanup-leak state becomes deterministic.
 */
function observeUninstallSchedule(
  t: TestContext,
  targets: RetryTargets,
  schedule: { current: string[] },
  fault?: RetryFault,
): () => void {
  const originalMkdir = retryFs.mkdir.bind(retryFs);
  const originalReaddir = retryFs.readdir.bind(retryFs);
  const originalRm = retryFs.rm.bind(retryFs);
  const originalUnlink = retryFs.unlink.bind(retryFs);
  const record = (event: string): void => {
    schedule.current.push(event);
  };

  const refuse = (kind: RetryFaultKind): void => {
    if (fault === undefined || !fault.enabled || fault.kind !== kind) {
      return;
    }

    record(`refuse:${kind}`);
    throw Object.assign(new Error(`${fault.code}: injected ${kind} refusal`), {
      code: fault.code,
    });
  };

  const mkdirMock = t.mock.method(
    retryFs,
    "mkdir",
    async (...args: Parameters<typeof retryFs.mkdir>) => {
      const target = String(args[0]);
      if (target === targets.scopeRoot) {
        refuse("config-write");
      }

      // The lock preamble mkdirs the extension root before any cascade
      // primitive runs, so an empty ledger identifies it unambiguously and
      // only the post-cascade `state.json` commit can be refused here.
      if (target === targets.extensionRoot && schedule.current.length > 0) {
        refuse("state-write");
      }

      return originalMkdir(...args);
    },
  );
  const readdirMock = t.mock.method(
    retryFs,
    "readdir",
    async (...args: Parameters<typeof retryFs.readdir>) => {
      if (String(args[0]) === targets.pluginClonesDir) {
        record("gc:scan");
      }

      return originalReaddir(...args);
    },
  );
  const rmMock = t.mock.method(retryFs, "rm", async (...args: Parameters<typeof retryFs.rm>) => {
    const target = String(args[0]);
    const parent = path.dirname(target);
    const base = path.basename(target);
    if (parent === targets.skillsTargetDir) {
      record(`unstage:skill:${base}`);
    }

    if (parent === targets.agentsDir) {
      record(`unstage:agent:${base}`);
    }

    if (parent === targets.pluginClonesDir) {
      record(`gc:remove:${base}`);
      refuse("clone-rm");
    }

    if (target === targets.hooksPluginDir) {
      record("unstage:hooks");
      refuse("hooks-rm");
    }

    if (target === targets.dataDir) {
      record("remove:data");
      refuse("data-rm");
    }

    return originalRm(...args);
  });
  const unlinkMock = t.mock.method(
    retryFs,
    "unlink",
    async (...args: Parameters<typeof retryFs.unlink>) => {
      const target = String(args[0]);
      if (path.dirname(target) === targets.promptsTargetDir) {
        record(`unstage:command:${path.basename(target)}`);
      }

      if (target === targets.cacheFile) {
        record("drop:cache");
        refuse("cache-unlink");
      }

      return originalUnlink(...args);
    },
  );
  syncBuiltinESMExports();

  return () => {
    unlinkMock.mock.restore();
    rmMock.mock.restore();
    readdirMock.mock.restore();
    mkdirMock.mock.restore();
    syncBuiltinESMExports();
  };
}

/**
 * Complete, Error-free projection of one exported outcome. The `failed` arm
 * carries a live `Error`, so the projection flattens its name, message, and
 * errno code and records the exact key set the arm exposes.
 */
function retryOutcomeShape(outcome: UninstallPluginOutcome | undefined): unknown {
  if (outcome?.status !== "failed") {
    return outcome;
  }

  return {
    cause: outcome.cause,
    code: (outcome.error as NodeJS.ErrnoException).code,
    keys: Object.keys(outcome).sort(),
    message: outcome.error.message,
    name: outcome.error.name,
    reason: outcome.reason,
    status: outcome.status,
  };
}

/** Capture the rejection of one exported call without ending the case. */
async function captureRejection(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending;
  } catch (err) {
    return err;
  }

  return undefined;
}

test("retry proof: uninstall: a hooks cascade refusal persists the shrunken record and the retry converges", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-hooks-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      const agentName = path.basename(seeded.agentFile, ".md");
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(path.join(dataDir, "nested"), { recursive: true });
      await writeFile(path.join(dataDir, "nested", "history"), "hooks history\n");
      const configBytes = JSON.stringify({ schemaVersion: 1, plugins: { "hello@mp": {} } });
      await writeFile(locations.configJsonPath, configBytes, "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "hooks-rm" };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
        fault,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstDataBytes = await readFile(path.join(dataDir, "nested", "history"), "utf8");
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(retryOutcomeShape(first), {
        cause: "EACCES: injected hooks-rm refusal",
        code: "EACCES",
        keys: ["cause", "error", "reason", "status"],
        message: "EACCES: injected hooks-rm refusal",
        name: "Error",
        reason: "permission denied",
        status: "failed",
      });
      assert.deepStrictEqual(second, { name: "hello", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(notifications, []);
      assert.strictEqual(firstDataBytes, "hooks history\n");
      assert.strictEqual(await pathExists(dataDir), false);
      assert.deepStrictEqual(firstRecord?.resources, {
        agents: [],
        hooks: ["hello"],
        mcpServers: ["uni-server"],
        prompts: [],
        skills: [],
      });
      assert.deepStrictEqual(firstSchedule, [
        `unstage:skill:uni-skill`,
        `unstage:command:uni-cmd.md`,
        `unstage:agent:${agentName}.md`,
        "unstage:hooks",
        "refuse:hooks-rm",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/data/mp/hello/nested/",
        "pi-claude-marketplace/data/mp/hello/nested/history",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/hello/",
        "pi-claude-marketplace/hooks/hello/hooks.json",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
      assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpJsonPath, "utf8")), {
        mcpServers: {},
      });
      assert.deepStrictEqual((await loadAgentsIndex(locations)).agents, []);
      assert.equal(
        "hello" in ((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        false,
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: foreign agent content preserves the whole record and the retry converges", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-agent-foreign-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedFullPlugin(locations, "mp", "hello", cwd);
      const agentName = path.basename(seeded.agentFile, ".md");
      await writeFile(seeded.agentFile, "---\nname: foreign\n---\n\nOwned by another process.\n");
      await writeFile(
        locations.configJsonPath,
        JSON.stringify({ schemaVersion: 1, plugins: { "hello@mp": {} } }),
        "utf8",
      );
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const configBytes = await readFile(locations.configJsonPath, "utf8");
      const foreignBytes = await readFile(seeded.agentFile, "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstIndex = await loadAgentsIndex(locations);
      const firstConfigBytes = await readFile(locations.configJsonPath, "utf8");
      const firstForeignBytes = await readFile(seeded.agentFile, "utf8");
      await unlink(seeded.agentFile);
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {source mismatch}\n" +
            `    cause: Failed to remove 1 agent(s): ${agentName}: target ${seeded.agentFile} is missing the generated marker`,
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message: "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstConfigBytes, configBytes);
      assert.equal(firstForeignBytes, foreignBytes);
      assert.deepStrictEqual(
        firstIndex.agents.map((entry) => entry.generatedName),
        [agentName],
      );
      assert.equal(await pathExists(seeded.agentFile), false);
      assert.deepStrictEqual(JSON.parse(await readFile(locations.configJsonPath, "utf8")), {
        plugins: {},
        schemaVersion: 1,
      });
      assert.deepStrictEqual((await loadAgentsIndex(locations)).agents, []);
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "agents/pi-claude-marketplace-hello-uni-agent.md",
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/hello/",
        "pi-claude-marketplace/hooks/hello/hooks.json",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.equal(
        "hello" in ((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        false,
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a normalized cascade rejection mutates nothing and the retry uninstalls once", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-cascade-reject-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const mcpBytes = await readFile(locations.mcpJsonPath, "utf8");
      const rejectNonError = Promise.reject.bind(Promise);
      const cascadeReject = { enabled: true };
      const cascade: typeof cascadeUnstagePlugin = (
        plugin,
        marketplace,
        cascadeLocations,
        record,
      ) =>
        cascadeReject.enabled
          ? rejectNonError("cascade rejected without an Error")
          : cascadeUnstagePlugin(plugin, marketplace, cascadeLocations, record);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        cascade,
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstMcpBytes = await readFile(locations.mcpJsonPath, "utf8");
      cascadeReject.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        cascade,
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(retryOutcomeShape(first), {
        cause: "cascade rejected without an Error",
        code: undefined,
        keys: ["cause", "error", "reason", "status"],
        message: "cascade rejected without an Error",
        name: "Error",
        reason: "unreadable",
        status: "failed",
      });
      assert.deepStrictEqual(second, { name: "hello", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstMcpBytes, mcpBytes);
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "agents/pi-claude-marketplace-hello-uni-agent.md",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/hello/",
        "pi-claude-marketplace/hooks/hello/hooks.json",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/uni-cmd.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/uni-skill/",
        "pi-claude-marketplace/resources/skills/uni-skill/SKILL.md",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpJsonPath, "utf8")), {
        mcpServers: {},
      });
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: an invalid config aborts before any mutation and the retry uninstalls", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-config-invalid-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      await writeFile(locations.configJsonPath, "{ not valid json", "utf8");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const stateMtime = (await stat(locations.stateJsonPath)).mtimeMs;
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstStateMtime = (await stat(locations.stateJsonPath)).mtimeMs;
      await unlink(locations.configJsonPath);
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello (failed) {invalid manifest}\n" +
            '    cause: Config file "claude-plugins.json" failed schema validation.',
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message: "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstStateMtime, stateMtime);
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "agents/pi-claude-marketplace-hello-uni-agent.md",
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/hello/",
        "pi-claude-marketplace/hooks/hello/hooks.json",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/uni-cmd.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/uni-skill/",
        "pi-claude-marketplace/resources/skills/uni-skill/SKILL.md",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused config write-back keeps the record and the retry deletes the entry", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-config-writeback-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(path.join(locations.skillsTargetDir, "uni-skill"), { recursive: true });
      await writeFile(
        path.join(locations.skillsTargetDir, "uni-skill", "SKILL.md"),
        "---\nname: uni-skill\n---\nbody\n",
      );
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await writeFile(path.join(locations.promptsTargetDir, "uni-cmd.md"), "# uni-cmd\n\nbody\n");
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ hooks: {} }),
      );
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            name: "mp",
            plugins: {
              hello: makePluginRecord({
                hooks: ["hello"],
                prompts: ["uni-cmd"],
                skills: ["uni-skill"],
              }),
            },
            scope: "project",
            source: pathSource("./src"),
          },
        },
      });
      await writeFile(
        locations.configJsonPath,
        JSON.stringify({ plugins: { "hello@mp": {}, "keep@mp": {} }, schemaVersion: 1 }),
        "utf8",
      );
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const configBytes = await readFile(locations.configJsonPath, "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "config-write" };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
        fault,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstConfigBytes = await readFile(locations.configJsonPath, "utf8");
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {permission denied}\n" +
            "    cause: EACCES: injected config-write refusal",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message: "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstConfigBytes, configBytes);
      assert.deepStrictEqual(JSON.parse(await readFile(locations.configJsonPath, "utf8")), {
        plugins: { "keep@mp": {} },
        schemaVersion: 1,
      });
      assert.equal(
        "hello" in ((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        false,
      );
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:hooks",
        "refuse:config-write",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:command:uni-cmd.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused state save leaves the swept config diverged and the retry converges it", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-state-save-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(path.join(locations.skillsTargetDir, "uni-skill"), { recursive: true });
      await writeFile(
        path.join(locations.skillsTargetDir, "uni-skill", "SKILL.md"),
        "---\nname: uni-skill\n---\nbody\n",
      );
      await mkdir(locations.promptsTargetDir, { recursive: true });
      await writeFile(path.join(locations.promptsTargetDir, "uni-cmd.md"), "# uni-cmd\n\nbody\n");
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ hooks: {} }),
      );
      await seedState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            name: "mp",
            plugins: {
              hello: makePluginRecord({
                hooks: ["hello"],
                prompts: ["uni-cmd"],
                skills: ["uni-skill"],
              }),
            },
            scope: "project",
            source: pathSource("./src"),
          },
        },
      });
      await writeFile(
        locations.configJsonPath,
        JSON.stringify({ plugins: { "hello@mp": {}, "keep@mp": {} }, schemaVersion: 1 }),
        "utf8",
      );
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(path.join(dataDir, "nested"), { recursive: true });
      await writeFile(path.join(dataDir, "nested", "history"), "save history\n");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "state-write" };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "hello"),
        activeSchedule,
        fault,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstDataBytes = await readFile(path.join(dataDir, "nested", "history"), "utf8");
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstConfigBytes = await readFile(locations.configJsonPath, "utf8");
      const firstConfigMtime = (await stat(locations.configJsonPath)).mtimeMs;
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello v0.0.1 (failed) {permission denied}\n" +
            "    cause: EACCES: injected state-write refusal",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message: "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(firstStateBytes, stateBytes);
      assert.strictEqual(firstDataBytes, "save history\n");
      assert.strictEqual(await pathExists(dataDir), false);
      assert.deepStrictEqual(JSON.parse(firstConfigBytes), {
        plugins: { "keep@mp": {} },
        schemaVersion: 1,
      });
      assert.equal(await readFile(locations.configJsonPath, "utf8"), firstConfigBytes);
      assert.equal((await stat(locations.configJsonPath)).mtimeMs, firstConfigMtime);
      assert.equal(
        "hello" in ((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        false,
      );
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:hooks",
        "refuse:state-write",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:command:uni-cmd.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/data/mp/hello/nested/",
        "pi-claude-marketplace/data/mp/hello/nested/history",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused cache drop leaves the cache file and the retry reports not installed", async (t) => {
  await withHermeticHome(async () => {
    const completionCache = createCompletionCache();
    const uninstallWithFreshOwner = createUninstallOperation(
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
      completionCache,
    );
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-cache-drop-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const targets = await retryTargets(cwd, "mp", "hello");
      await completionCache.getPluginIndex(targets.cacheFile, "project", "mp", () =>
        Promise.resolve([{ name: "hello", status: "installed" }]),
      );
      const cacheBytes = await readFile(targets.cacheFile, "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "cache-unlink" };
      restoreSchedule = observeUninstallSchedule(t, targets, activeSchedule, fault);
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message: "● mp [project]\n  ○ hello v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello (failed) {not installed}",
          severity: "error",
        },
      ]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(await readFile(targets.cacheFile, "utf8"), cacheBytes);
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
        "refuse:cache-unlink",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/cache/",
        "pi-claude-marketplace/cache/plugins/",
        "pi-claude-marketplace/cache/plugins/mp.json",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused data-dir removal keeps the directory and the retry converges", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-data-dir-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const targets = await retryTargets(cwd, "mp", "hello");
      await mkdir(targets.dataDir, { recursive: true });
      await writeFile(path.join(targets.dataDir, "guard.txt"), "guard");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "data-rm" };
      restoreSchedule = observeUninstallSchedule(t, targets, activeSchedule, fault);
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(first, { name: "hello", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(second, { name: "hello", status: "converged" });
      assert.deepStrictEqual(notifications, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(await readFile(path.join(targets.dataDir, "guard.txt"), "utf8"), "guard");
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "refuse:data-rm",
        "gc:scan",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/data/mp/hello/guard.txt",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused clone reclaim orphans the last-referenced clone across the retry", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-clone-rm-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keySolo" }, cwd);
      await writeFile(path.join(locations.pluginClonesDir, "keySolo", "pin.txt"), "clone body");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "clone-rm" };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "solo"),
        activeSchedule,
        fault,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "solo",
        scope: "project",
      });
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "solo",
        scope: "project",
      });

      // assert
      assert.equal(first, undefined);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message: "● mp [project]\n  ○ solo v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ solo (failed) {not installed}",
          severity: "error",
        },
      ]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(
        await readFile(path.join(locations.pluginClonesDir, "keySolo", "pin.txt"), "utf8"),
        "clone body",
      );
      assert.deepStrictEqual(firstSchedule, [
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
        "gc:remove:keySolo",
        "refuse:clone-rm",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "pi-claude-marketplace/",
        "pi-claude-marketplace/plugin-clones/",
        "pi-claude-marketplace/plugin-clones/keySolo/",
        "pi-claude-marketplace/plugin-clones/keySolo/pin.txt",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a hooks refusal on a shared clone retries without reclaiming the surviving clone", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-clone-shared-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(path.join(locations.pluginClonesDir, "keyShared"), { recursive: true });
      await writeFile(path.join(locations.pluginClonesDir, "keyShared", "pin.txt"), "clone body");
      await mkdir(path.join(locations.hooksDir, "alpha"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "alpha", "hooks.json"),
        JSON.stringify({ hooks: {} }),
      );
      const sharedRecord = (hooks: readonly string[]): PluginRecord => {
        const record = makePluginRecord({ hooks: [...hooks] });
        record.resolvedSha = GIT_SHA_A;
        record.resolvedSource = path.join(locations.pluginClonesDir, "keyShared");
        return record;
      };

      // D-05-14: uninstalling `alpha` reads `beta`'s declarations, so the
      // recorded manifest must exist and list both; neither declares the other.
      await writeFile(
        path.join(cwd, "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "alpha", source: "./plugins/alpha" },
            { name: "beta", source: "./plugins/beta" },
          ],
        }),
      );

      await seedState(locations.extensionRoot, {
        schemaVersion: 3,
        marketplaces: {
          mp: {
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "marketplace.json"),
            marketplaceRoot: cwd,
            name: "mp",
            plugins: { alpha: sharedRecord(["alpha"]), beta: sharedRecord([]) },
            scope: "project",
            source: pathSource("./src"),
          },
        },
      });
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const fault: RetryFault = { code: "EACCES", enabled: true, kind: "hooks-rm" };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "alpha"),
        activeSchedule,
        fault,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "alpha",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      fault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "alpha",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(retryOutcomeShape(first), {
        cause: "EACCES: injected hooks-rm refusal",
        code: "EACCES",
        keys: ["cause", "error", "reason", "status"],
        message: "EACCES: injected hooks-rm refusal",
        name: "Error",
        reason: "permission denied",
        status: "failed",
      });
      assert.deepStrictEqual(second, { name: "alpha", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.deepStrictEqual(
        Object.keys(
          (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {},
        ).sort(),
        ["beta"],
      );
      assert.equal(
        await readFile(path.join(locations.pluginClonesDir, "keyShared", "pin.txt"), "utf8"),
        "clone body",
      );
      assert.deepStrictEqual(firstSchedule, ["unstage:hooks", "refuse:hooks-rm"]);
      assert.deepStrictEqual(secondSchedule, [
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(firstTree, [
        "pi-claude-marketplace/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/alpha/",
        "pi-claude-marketplace/hooks/alpha/hooks.json",
        "pi-claude-marketplace/plugin-clones/",
        "pi-claude-marketplace/plugin-clones/keyShared/",
        "pi-claude-marketplace/plugin-clones/keyShared/pin.txt",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "pi-claude-marketplace/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/plugin-clones/",
        "pi-claude-marketplace/plugin-clones/keyShared/",
        "pi-claude-marketplace/plugin-clones/keyShared/pin.txt",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a clone-scan failure is swallowed and the retry converges without a scan", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-clone-scan-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedGitPlugin(locations, "mp", { solo: "keySolo" }, cwd);
      await rm(locations.pluginClonesDir, { force: true, recursive: true });
      await writeFile(locations.pluginClonesDir, "fault: plugin-clones is not a directory");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(
        t,
        await retryTargets(cwd, "mp", "solo"),
        activeSchedule,
      );
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "solo",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      await unlink(locations.pluginClonesDir);
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "solo",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(first, { name: "solo", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(second, { name: "solo", status: "converged" });
      assert.deepStrictEqual(notifications, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(await pathExists(locations.pluginClonesDir), false);
      assert.deepStrictEqual(firstSchedule, [
        "unstage:hooks",
        "drop:cache",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "pi-claude-marketplace/",
        "pi-claude-marketplace/plugin-clones",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "pi-claude-marketplace/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused data-dir path escape propagates after the commit and the retry reports not installed", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-data-escape-"));
    const escape = await mkdtemp(path.join(tmpdir(), "uninstall-retry-data-escape-target-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const targets = await retryTargets(cwd, "mp", "hello");
      await writeFile(path.join(escape, "outside.txt"), "outside");
      await mkdir(path.dirname(targets.dataDir), { recursive: true });
      await symlink(escape, targets.dataDir);
      const expectedRefusal =
        `pluginDataDir(mp, hello) contains symlink ${targets.dataDir} -> ${escape} ` +
        `(parent: ${locations.dataRoot}, target: ${targets.dataDir}).`;
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(t, targets, activeSchedule);
      const { ctx, notifications, pi } = makeCtx();

      // act
      const firstError = await captureRejection(
        uninstallWithFreshOwner({
          ctx,
          cwd,
          marketplace: "mp",
          pi,
          plugin: "hello",
          scope: "project",
        }),
      );
      const firstNotifications = [...notifications];
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      await unlink(targets.dataDir);
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.ok(firstError instanceof SymlinkRefusedError);
      assert.strictEqual(firstError.name, "SymlinkRefusedError");
      assert.strictEqual(firstError.parent, locations.dataRoot);
      assert.strictEqual(firstError.child, targets.dataDir);
      assert.strictEqual(firstError.linkPath, targets.dataDir);
      assert.strictEqual(firstError.linkTarget, escape);
      assert.strictEqual(firstError.message, expectedRefusal);
      assert.equal(second, undefined);
      assert.deepStrictEqual(firstNotifications, []);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n" +
            "  ⊘ hello (failed) {not installed}",
          severity: "error",
        },
      ]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(
        "hello" in ((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        false,
      );
      assert.equal(await readFile(path.join(escape, "outside.txt"), "utf8"), "outside");
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "drop:cache",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(escape, { force: true, recursive: true });
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: uninstall: a refused cache path escape is swallowed and later cleanup still runs", async (t) => {
  await withHermeticHome(async () => {
    const uninstallWithFreshOwner = createUninstallOwner();
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-retry-cache-escape-"));
    const escape = await mkdtemp(path.join(tmpdir(), "uninstall-retry-cache-escape-target-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedFullPlugin(locations, "mp", "hello", cwd);
      const targets = await retryTargets(cwd, "mp", "hello");
      await writeFile(path.join(escape, "outside.txt"), "outside");
      await mkdir(targets.dataDir, { recursive: true });
      await writeFile(path.join(targets.dataDir, "guard.txt"), "guard");
      await mkdir(locations.cacheDir, { recursive: true });
      await symlink(escape, path.join(locations.cacheDir, "plugins"));
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeUninstallSchedule(t, targets, activeSchedule);
      const { ctx, notifications, pi } = makeCtx();

      // act
      const first = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      await unlink(path.join(locations.cacheDir, "plugins"));
      activeSchedule.current = secondSchedule;
      const second = await uninstallWithFreshOwner({
        ctx,
        cwd,
        marketplace: "mp",
        notifications: { mode: "orchestrated" },
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.deepStrictEqual(first, { name: "hello", status: "uninstalled", version: "0.0.1" });
      assert.deepStrictEqual(second, { name: "hello", status: "converged" });
      assert.deepStrictEqual(notifications, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), firstStateBytes);
      assert.equal(await readFile(path.join(escape, "outside.txt"), "utf8"), "outside");
      assert.equal(await pathExists(targets.dataDir), false);
      assert.deepStrictEqual(firstSchedule, [
        "unstage:skill:uni-skill",
        "unstage:command:uni-cmd.md",
        "unstage:agent:pi-claude-marketplace-hello-uni-agent.md",
        "unstage:hooks",
        "remove:data",
        "gc:scan",
      ]);
      assert.deepStrictEqual(secondSchedule, []);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/cache/",
        "pi-claude-marketplace/cache/plugins",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/cache/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/state.json",
      ]);
    } finally {
      restoreSchedule?.();
      await rm(escape, { force: true, recursive: true });
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOAD-03 / D-06-06 / D-06-07: the declarer snapshot.
//
// `uninstall X` in a scope where other installed records declare X PROCEEDS.
// The record and its artifacts go, and the success row names the dependents
// the next load will report unsatisfied: an `(uninstalled)` row at info
// severity with its reload stamp -- the command was carried out in full -- and
// the dependent keys ride the cause line as sorted `name@marketplace` keys.
//
// Who counts as a declarer is unchanged from Phase 5: a disabled declarer
// still holds (D-05-04), only the target scope's own state is consulted
// (D-05-05), and every declaration is read offline (D-05-06). The
// fail-closed refusal survives too (D-05-07): a declarer whose declarations
// cannot be established still REFUSES and still removes nothing. Only the
// found-dependents outcome moved from refuse to proceed.
// ─────────────────────────────────────────────────────────────────────────────

interface DeclaringSeed {
  /** Bare `name` / `name@marketplace` tokens, written to the entry AND the plugin's own manifest. */
  readonly dependencies?: readonly string[];
  readonly enabled?: boolean;
  readonly provenance?: PluginRecord["provenance"];
  /** `false` records the plugin in state while its marketplace manifest omits it (D-05-07). */
  readonly listed?: boolean;
  /**
   * Raw bytes written as the plugin's own manifest in place of the JSON the
   * seed derives, so a case can plant a present-but-unusable file (D-05-07).
   */
  readonly ownManifest?: string;
}

/** The one skill each seeded plugin owns, so every cascade has something to drop. */
function seededSkillName(marketplace: string, plugin: string): string {
  return `${marketplace}-${plugin}-skill`;
}

/**
 * Seed one scope: for every marketplace, an on-disk `marketplace.json` and
 * per-plugin `plugin.json` carrying the declared dependencies, one staged
 * skill per plugin, and the state records, with each marketplace record's
 * `manifestPath` / `marketplaceRoot` pointing at its tree so the guard can
 * read every declaration offline (D-05-06).
 */
async function seedDeclaringScope(
  locations: ReturnType<typeof locationsFor>,
  marketplaces: Readonly<Record<string, Readonly<Record<string, DeclaringSeed>>>>,
  cwd: string,
): Promise<void> {
  const state: ExtensionState = { schemaVersion: 3, marketplaces: {} };
  for (const [marketplace, plugins] of Object.entries(marketplaces)) {
    const marketplaceRoot = path.join(cwd, marketplace);
    const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    const entries: object[] = [];
    const pluginRecords: Record<string, PluginRecord> = {};
    for (const [plugin, seed] of Object.entries(plugins)) {
      const declared = seed.dependencies === undefined ? {} : { dependencies: seed.dependencies };
      if (seed.listed !== false) {
        entries.push({
          name: plugin,
          version: "1.0.0",
          source: `./plugins/${plugin}`,
          ...declared,
        });
      }

      const ownManifest = path.join(
        marketplaceRoot,
        "plugins",
        plugin,
        ".claude-plugin",
        "plugin.json",
      );
      await mkdir(path.dirname(ownManifest), { recursive: true });
      await writeFile(
        ownManifest,
        seed.ownManifest ?? JSON.stringify({ name: plugin, version: "1.0.0", ...declared }),
      );
      const skillName = seededSkillName(marketplace, plugin);
      const skillDir = path.join(locations.skillsTargetDir, skillName);
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${skillName}\n---\nbody\n`);
      const record = makePluginRecord({ skills: [skillName] }, seed.provenance ?? "explicit");
      record.enabled = seed.enabled ?? true;
      pluginRecords[plugin] = record;
    }

    await writeFile(manifestPath, JSON.stringify({ name: marketplace, plugins: entries }));
    state.marketplaces[marketplace] = {
      name: marketplace,
      scope: locations.scope,
      source: pathSource(`./${marketplace}`),
      addedFromCwd: cwd,
      manifestPath,
      marketplaceRoot,
      plugins: pluginRecords,
    };
  }

  await seedState(locations.extensionRoot, state);
}

/** `seedDeclaringScope` for the one-marketplace scope most cases need. */
async function seedDeclaringMarketplace(
  locations: ReturnType<typeof locationsFor>,
  marketplace: string,
  plugins: Readonly<Record<string, DeclaringSeed>>,
  cwd: string,
): Promise<void> {
  await seedDeclaringScope(locations, { [marketplace]: plugins }, cwd);
}

interface DependentsCase {
  readonly title: string;
  readonly plugins: Readonly<Record<string, DeclaringSeed>>;
  readonly expectedCause: string;
  /** The `plugin@marketplace` keys still recorded after the target is removed. */
  readonly remaining: readonly string[];
}

const DEPENDENTS_CASES: readonly DependentsCase[] = [
  {
    title: "LOAD-03: the uninstall proceeds while one installed plugin declares the target",
    plugins: { helper: { provenance: "dependency" }, app: { dependencies: ["helper"] } },
    expectedCause: "required by app@mp",
    remaining: ["app@mp"],
  },
  {
    title: "LOAD-03: two dependents are named on the cause line in sorted key order",
    plugins: {
      helper: {},
      zeta: { dependencies: ["helper@mp"] },
      alpha: { dependencies: ["helper"] },
    },
    expectedCause: "required by alpha@mp, zeta@mp",
    remaining: ["alpha@mp", "zeta@mp"],
  },
  {
    title: "D-05-04: a DISABLED installed plugin still holds the target",
    plugins: { helper: {}, app: { dependencies: ["helper"], enabled: false } },
    expectedCause: "required by app@mp",
    remaining: ["app@mp"],
  },
];

for (const { title, plugins, expectedCause, remaining } of DEPENDENTS_CASES) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-dependents-"));
      try {
        // arrange
        const locations = locationsFor("project", cwd);
        await seedDeclaringMarketplace(locations, "mp", plugins, cwd);
        const dataDir = await locations.pluginDataDir("mp", "helper");
        await mkdir(dataDir, { recursive: true });
        await writeFile(path.join(dataDir, "session"), "gone\n");
        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "helper",
        });

        // assert
        assert.equal(outcome, undefined);
        assert.deepStrictEqual(notifications, [
          {
            message:
              `● mp [project]\n` +
              `  ○ helper v0.0.1 (uninstalled) {dependents unsatisfied}\n` +
              `    cause: ${expectedCause}\n\n` +
              `/reload to pick up changes`,
          },
        ]);
        assert.deepStrictEqual(Object.keys(await recordedInventory(locations)).sort(), [
          ...remaining,
        ]);
        assert.deepStrictEqual(await stagedSkills(locations, ["mp-helper-skill"]), {
          "mp-helper-skill": false,
        });
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

interface RefusalCase {
  readonly title: string;
  readonly plugins: Readonly<Record<string, DeclaringSeed>>;
  readonly expectedRow: string;
  readonly expectedCause: string;
}

const REFUSAL_CASES: readonly RefusalCase[] = [
  {
    title: "D-05-07: a record its marketplace manifest does not list refuses the uninstall",
    plugins: { helper: {}, other: { listed: false } },
    expectedRow: "⊘ helper v0.0.1 (failed) {unreadable}",
    expectedCause: "cannot read the dependencies of other@mp: not declared by its marketplace",
  },
  {
    title: "D-05-07: a record whose own manifest is present but unreadable refuses the uninstall",
    plugins: { helper: {}, other: { ownManifest: "{ truncated" } },
    expectedRow: "⊘ helper v0.0.1 (failed) {unreadable}",
    expectedCause:
      "cannot read the dependencies of other@mp: its own manifest is present but cannot be read",
  },
];

for (const { title, plugins, expectedRow, expectedCause } of REFUSAL_CASES) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-dependents-"));
      try {
        // arrange
        const locations = locationsFor("project", cwd);
        await seedDeclaringMarketplace(locations, "mp", plugins, cwd);
        const dataDir = await locations.pluginDataDir("mp", "helper");
        await mkdir(dataDir, { recursive: true });
        await writeFile(path.join(dataDir, "session"), "kept\n");
        const stateBefore = await readFile(locations.stateJsonPath);
        const mtimeBefore = (await stat(locations.stateJsonPath)).mtimeMs;
        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "helper",
        });

        // assert
        assert.equal(outcome, undefined);
        assert.deepStrictEqual(notifications, [
          {
            message:
              `A plugin operation has failed.\n\n● mp [project]\n` +
              `  ${expectedRow}\n` +
              `    cause: ${expectedCause}`,
            severity: "error",
          },
        ]);
        assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
        assert.equal((await stat(locations.stateJsonPath)).mtimeMs, mtimeBefore);
        assert.equal(await readFile(path.join(dataDir, "session"), "utf8"), "kept\n");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("LOAD-03: an installed sibling that declares nothing leaves the bare uninstalled row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-no-declarer-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(locations, "mp", { helper: {}, app: {} }, cwd);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "helper",
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message: "● mp [project]\n  ○ helper v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), { "app@mp": ["mp-app-skill"] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-05: a declarer installed only in the OTHER scope is not consulted", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-dependents-other-scope-"));
    try {
      // arrange
      const userLocations = locationsFor("user", cwd);
      await seedDeclaringMarketplace(
        userLocations,
        "mp",
        { app: { dependencies: ["helper"] } },
        cwd,
      );
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(locations, "mp", { helper: {} }, cwd);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "helper",
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message: "● mp [project]\n  ○ helper v0.0.1 (uninstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), {});
      assert.deepStrictEqual(await recordedInventory(userLocations), {
        "app@mp": ["mp-app-skill"],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-06-06: the orchestrated uninstall of a still-declared plugin succeeds and names no dependents", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-dependents-orchestrated-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { helper: {}, app: { dependencies: ["helper"] } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "helper",
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "uninstalled",
        name: "helper",
        version: "0.0.1",
      });
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(await recordedInventory(locations), { "app@mp": ["mp-app-skill"] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-07: the orchestrated unreadable-declarer refusal still returns the typed failed outcome", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-unreadable-orchestrated-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { helper: {}, other: { listed: false } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();
      const cause = "cannot read the dependencies of other@mp: not declared by its marketplace";

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "helper",
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        status: "failed",
        reason: "unreadable",
        error: new UninstallRefusedError("unreadable", cause),
        cause,
      });
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(await recordedInventory(locations), {
        "helper@mp": ["mp-helper-skill"],
        "other@mp": ["mp-other-skill"],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D-05-01 / D-05-02 / D-05-03 / D-05-09 / D-05-12 / D-05-13 / PRUNE-01..04:
// the `--prune` sweep.
//
// After the named plugin is removed, every dependency-provenance record in the
// scope that no remaining installed record declares is removed too, iterated
// to a fixpoint, inside the same locked transaction, with one save. Each
// pruned plugin renders its own `{dependency pruned}` row under its own
// marketplace; a member that fails to remove renders a warning row and rolls
// nothing back; nothing is pruned unless the named plugin actually went.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The scope the sweep cases share: `x` (explicit) declares `d1`; `d1`
 * (dependency) declares `d2` in the second marketplace; `o` (dependency) is
 * declared by nothing -- an orphan an earlier removal left behind.
 */
const PRUNE_SCOPE = {
  mp: {
    x: { dependencies: ["d1"] },
    d1: { provenance: "dependency", dependencies: ["d2@mp2"] },
  },
  mp2: {
    d2: { provenance: "dependency" },
    o: { provenance: "dependency" },
  },
} as const satisfies Readonly<Record<string, Readonly<Record<string, DeclaringSeed>>>>;

/** `plugin@marketplace -> [skill names]` for every record left in the scope. */
async function recordedInventory(
  locations: ReturnType<typeof locationsFor>,
): Promise<Record<string, readonly string[]>> {
  const state = await loadState(locations.extensionRoot);
  const inventory: Record<string, readonly string[]> = {};
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(marketplace.plugins)) {
      inventory[`${plugin}@${marketplace.name}`] = record.resources.skills;
    }
  }

  return inventory;
}

/** Whether each named skill directory is still staged. */
async function stagedSkills(
  locations: ReturnType<typeof locationsFor>,
  names: readonly string[],
): Promise<Record<string, boolean>> {
  const staged: Record<string, boolean> = {};
  for (const name of names) {
    staged[name] = await pathExists(path.join(locations.skillsTargetDir, name));
  }

  return staged;
}

/** Seed a data directory per key and return a reader of which ones survived. */
async function seedDataDirs(
  locations: ReturnType<typeof locationsFor>,
  keys: readonly string[],
): Promise<() => Promise<Record<string, boolean>>> {
  const dirs: Record<string, string> = {};
  for (const key of keys) {
    const separator = key.indexOf("@");
    const plugin = key.slice(0, separator);
    const marketplace = key.slice(separator + 1);
    const dir = await locations.pluginDataDir(marketplace, plugin);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "session"), "kept\n");
    dirs[key] = dir;
  }

  return async () => {
    const survived: Record<string, boolean> = {};
    for (const [key, dir] of Object.entries(dirs)) {
      survived[key] = await pathExists(path.join(dir, "session"));
    }

    return survived;
  };
}

const PRUNE_SCOPE_SKILLS = ["mp-x-skill", "mp-d1-skill", "mp2-d2-skill", "mp2-o-skill"];
const PRUNE_SCOPE_KEYS = ["x@mp", "d1@mp", "d2@mp2", "o@mp2"];

test("D-05-01 / D-05-02: uninstall --prune removes the named plugin, its orphaned chain and a pre-existing orphan in one save", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringScope(locations, PRUNE_SCOPE, cwd);
      const readDataDirs = await seedDataDirs(locations, PRUNE_SCOPE_KEYS);
      const { ctx, pi, notifications } = makeCtx();

      // act
      // `LockedStateTransaction.save()` throws on a second call, so a sweep
      // that saved per member would surface here as a failure row, not as the
      // success report asserted below: one save is what the assertion proves.
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled)\n" +
            "  ○ d1 v0.0.1 (uninstalled) {dependency pruned}\n" +
            "\n" +
            "● mp2 [project]\n" +
            "  ○ o v0.0.1 (uninstalled) {dependency pruned}\n" +
            "  ○ d2 v0.0.1 (uninstalled) {dependency pruned}\n" +
            "\n" +
            "/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), {});
      assert.deepStrictEqual(await stagedSkills(locations, PRUNE_SCOPE_SKILLS), {
        "mp-x-skill": false,
        "mp-d1-skill": false,
        "mp2-d2-skill": false,
        "mp2-o-skill": false,
      });
      assert.deepStrictEqual(await readDataDirs(), {
        "x@mp": false,
        "d1@mp": false,
        "d2@mp2": false,
        "o@mp2": false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-09: --keep-data covers every plugin --prune removes, and each pruned row says so after the prune reason", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-keep-data-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringScope(locations, PRUNE_SCOPE, cwd);
      const readDataDirs = await seedDataDirs(locations, PRUNE_SCOPE_KEYS);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        keepData: true,
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled) {data kept}\n" +
            "  ○ d1 v0.0.1 (uninstalled) {dependency pruned, data kept}\n" +
            "\n" +
            "● mp2 [project]\n" +
            "  ○ o v0.0.1 (uninstalled) {dependency pruned, data kept}\n" +
            "  ○ d2 v0.0.1 (uninstalled) {dependency pruned, data kept}\n" +
            "\n" +
            "/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), {});
      assert.deepStrictEqual(await stagedSkills(locations, PRUNE_SCOPE_SKILLS), {
        "mp-x-skill": false,
        "mp-d1-skill": false,
        "mp2-d2-skill": false,
        "mp2-o-skill": false,
      });
      assert.deepStrictEqual(await readDataDirs(), {
        "x@mp": true,
        "d1@mp": true,
        "d2@mp2": true,
        "o@mp2": true,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { keepData, expectedDataTree, expectedMessage } of [
  {
    keepData: true,
    expectedDataTree: {
      tree: ["nested/", "nested/session.bin"],
      sessionBytes: Buffer.from([0, 7, 255, 10]),
    },
    expectedMessage:
      "● mp [project]\n" +
      "  ○ x v0.0.1 (uninstalled) {data kept}\n" +
      "  ○ d1 v0.0.1 (uninstalled) {dependency pruned, data kept}\n" +
      "\n" +
      "/reload to pick up changes",
  },
  {
    keepData: false,
    expectedDataTree: null,
    expectedMessage:
      "● mp [project]\n" +
      "  ○ x v0.0.1 (uninstalled)\n" +
      "  ○ d1 v0.0.1 (uninstalled) {dependency pruned}\n" +
      "\n" +
      "/reload to pick up changes",
  },
] satisfies readonly {
  keepData: boolean;
  expectedDataTree: DataTree | null;
  expectedMessage: string;
}[]) {
  test(`D-05-09: --prune with keepData ${String(keepData)} applies one disposition to the root and its pruned dependency`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-data-bytes-"));
      try {
        // arrange
        const locations = locationsFor("project", cwd);
        await seedDeclaringMarketplace(
          locations,
          "mp",
          { x: { dependencies: ["d1"] }, d1: { provenance: "dependency" } },
          cwd,
        );
        const rootDataDir = await locations.pluginDataDir("mp", "x");
        const depDataDir = await locations.pluginDataDir("mp", "d1");
        for (const dataDir of [rootDataDir, depDataDir]) {
          await mkdir(path.join(dataDir, "nested"), { recursive: true });
          await writeFile(
            path.join(dataDir, "nested", "session.bin"),
            Buffer.from([0, 7, 255, 10]),
          );
        }

        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "x",
          keepData,
          prune: true,
        });

        // assert
        assert.equal(outcome, undefined);
        assert.deepStrictEqual(notifications, [{ message: expectedMessage }]);
        assert.deepStrictEqual(await recordedInventory(locations), {});
        assert.deepStrictEqual(await readDataTree(rootDataDir), expectedDataTree);
        assert.deepStrictEqual(await readDataTree(depDataDir), expectedDataTree);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

for (const { title, holder } of [
  {
    title:
      "PRUNE-03 / D-05-12: a dependency another installed plugin still declares survives, and the report is the plain uninstall's",
    holder: { dependencies: ["d1"] },
  },
  {
    title:
      "PRUNE-03 / D-05-04: a DISABLED installed plugin still holds the dependency against the sweep",
    holder: { dependencies: ["d1"], enabled: false },
  },
] satisfies readonly { title: string; holder: DeclaringSeed }[]) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-held-"));
      try {
        // arrange
        const plugins = {
          x: { dependencies: ["d1"] },
          y: holder,
          d1: { provenance: "dependency" },
        } as const satisfies Readonly<Record<string, DeclaringSeed>>;
        const locations = locationsFor("project", cwd);
        await seedDeclaringMarketplace(locations, "mp", plugins, cwd);
        const plain = makeCtx();
        await uninstallWithFreshOwner({
          ctx: plain.ctx,
          pi: plain.pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "x",
        });
        await seedDeclaringMarketplace(locations, "mp", plugins, cwd);
        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await uninstallWithFreshOwner({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "x",
          prune: true,
        });

        // assert
        assert.equal(outcome, undefined);
        assert.deepStrictEqual(notifications, plain.notifications);
        assert.deepStrictEqual(notifications, [
          {
            message: "● mp [project]\n  ○ x v0.0.1 (uninstalled)\n\n/reload to pick up changes",
          },
        ]);
        assert.deepStrictEqual(await recordedInventory(locations), {
          "y@mp": ["mp-y-skill"],
          "d1@mp": ["mp-d1-skill"],
        });
        assert.deepStrictEqual(
          await stagedSkills(locations, ["mp-x-skill", "mp-y-skill", "mp-d1-skill"]),
          {
            "mp-x-skill": false,
            "mp-y-skill": true,
            "mp-d1-skill": true,
          },
        );
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("PRUNE-02: an explicit record declared only by the named plugin is never pruned", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-explicit-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(locations, "mp", { x: { dependencies: ["e"] }, e: {} }, cwd);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        { message: "● mp [project]\n  ○ x v0.0.1 (uninstalled)\n\n/reload to pick up changes" },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), { "e@mp": ["mp-e-skill"] });
      assert.deepStrictEqual(await stagedSkills(locations, ["mp-x-skill", "mp-e-skill"]), {
        "mp-x-skill": false,
        "mp-e-skill": true,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-03: --prune on a plugin that is not installed prunes nothing, even with an orphan in the scope", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-not-installed-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(locations, "mp", { o: { provenance: "dependency" } }, cwd);
      const stateBefore = await readFile(locations.stateJsonPath);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "ghost",
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ ghost (failed) {not installed}",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
      assert.deepStrictEqual(await stagedSkills(locations, ["mp-o-skill"]), { "mp-o-skill": true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LOAD-03: --prune sweeps the orphan while the surviving declarer is named on the primary row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-dependents-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { x: {}, keeper: { dependencies: ["x"] }, o: { provenance: "dependency" } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled) {dependents unsatisfied}\n" +
            "    cause: required by keeper@mp\n" +
            "  ○ o v0.0.1 (uninstalled) {dependency pruned}\n\n" +
            "/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(Object.keys(await recordedInventory(locations)), ["keeper@mp"]);
      assert.deepStrictEqual(await stagedSkills(locations, ["mp-x-skill", "mp-o-skill"]), {
        "mp-x-skill": false,
        "mp-o-skill": false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LOAD-03: a declarer the same --prune run sweeps is not named as a surviving dependent", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-adjacent-"));
    try {
      // arrange: `dep` declares the target AND is a dependency record nothing
      // else declares, so the sweep removes it in the same locked snapshot the
      // declarer set was read from.
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { x: {}, dep: { provenance: "dependency", dependencies: ["x"] } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled)\n" +
            "  ○ dep v0.0.1 (uninstalled) {dependency pruned}\n\n" +
            "/reload to pick up changes",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), {});
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-08: without the option an orphan survives the uninstall of an unrelated plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-no-prune-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { x: {}, o: { provenance: "dependency" } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, { status: "uninstalled", name: "x", version: "0.0.1" });
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(await recordedInventory(locations), { "o@mp": ["mp-o-skill"] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-08: an orchestrated call carrying the prune option removes only the named plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-orchestrated-prune-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { x: {}, o: { provenance: "dependency" } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
        notifications: { mode: "orchestrated" },
      });

      // assert
      assert.deepStrictEqual(outcome, { status: "uninstalled", name: "x", version: "0.0.1" });
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(await recordedInventory(locations), { "o@mp": ["mp-o-skill"] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * A cascade that fails for ONE plugin by name and runs the real cascade for
 * every other, so the member-failure cases exercise real removals around the
 * injected fault.
 */
function cascadeFailingFor(
  plugin: string,
  cause: Error | undefined,
  dropped: Partial<Awaited<ReturnType<typeof cascadeUnstagePlugin>>["dropped"]> = {},
): typeof cascadeUnstagePlugin {
  return (name, marketplace, locations, installed) => {
    if (name !== plugin) {
      return cascadeUnstagePlugin(name, marketplace, locations, installed);
    }

    return Promise.resolve({
      ok: false,
      dropped: {
        skills: dropped.skills ?? [],
        commands: dropped.commands ?? [],
        agents: dropped.agents ?? [],
        hooks: dropped.hooks ?? [],
        mcpServers: dropped.mcpServers ?? [],
      },
      ...(cause !== undefined && { cause }),
    });
  };
}

/** The sweep report when `d2` alone fails to unstage, by the reason its row carries. */
function prunePartialFailureNotification(reason: string): NotifyRecord {
  return {
    message:
      "A plugin operation needs attention.\n" +
      "\n" +
      "● mp [project]\n" +
      "  ○ x v0.0.1 (uninstalled)\n" +
      "  ○ d1 v0.0.1 (uninstalled) {dependency pruned}\n" +
      "\n" +
      "● mp2 [project]\n" +
      "  ○ o v0.0.1 (uninstalled) {dependency pruned}\n" +
      `  ⊘ d2 v0.0.1 (failed) {${reason}}\n` +
      "    cause: Agents unstage refused: foreign content\n" +
      "\n" +
      "/reload to pick up changes",
    severity: "warning",
  };
}

test("D-05-13: a pruned member whose agents refuse to unstage renders a warning row, keeps its whole record, and rolls nothing back", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-member-ag5-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringScope(locations, PRUNE_SCOPE, cwd);
      const { ctx, pi, notifications } = makeCtx();
      const cause = new AgentsUnstageFailureError("Agents unstage refused: foreign content", [
        { generatedName: "d2-agent", targetPath: "/agents/d2-agent.md", reason: "missing marker" },
      ]);

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
        cascade: cascadeFailingFor("d2", cause, { skills: ["mp2-d2-skill"] }),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [prunePartialFailureNotification("source mismatch")]);
      assert.deepStrictEqual(await recordedInventory(locations), { "d2@mp2": ["mp2-d2-skill"] });
      assert.deepStrictEqual(await stagedSkills(locations, PRUNE_SCOPE_SKILLS), {
        "mp-x-skill": false,
        "mp-d1-skill": false,
        "mp2-d2-skill": true,
        "mp2-o-skill": false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRUNE-03 / D-05-13: a failed member is still a declarer, so the dependency only it holds is kept while the unrelated orphan is still pruned", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-member-holds-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringScope(locations, PRUNE_SCOPE, cwd);
      const { ctx, pi, notifications } = makeCtx();
      const cause = new AgentsUnstageFailureError("Agents unstage refused: foreign content", [
        { generatedName: "d1-agent", targetPath: "/agents/d1-agent.md", reason: "missing marker" },
      ]);

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
        cascade: cascadeFailingFor("d1", cause, { skills: ["mp-d1-skill"] }),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n" +
            "\n" +
            "● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled)\n" +
            "  ⊘ d1 v0.0.1 (failed) {source mismatch}\n" +
            "    cause: Agents unstage refused: foreign content\n" +
            "\n" +
            "● mp2 [project]\n" +
            "  ○ o v0.0.1 (uninstalled) {dependency pruned}\n" +
            "\n" +
            "/reload to pick up changes",
          severity: "warning",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), {
        "d1@mp": ["mp-d1-skill"],
        "d2@mp2": ["mp2-d2-skill"],
      });
      assert.deepStrictEqual(await stagedSkills(locations, PRUNE_SCOPE_SKILLS), {
        "mp-x-skill": false,
        "mp-d1-skill": true,
        "mp2-d2-skill": true,
        "mp2-o-skill": false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-13: a pruned member that partially unstaged keeps a record shrunk to what is still on disk", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-member-partial-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringScope(locations, PRUNE_SCOPE, cwd);
      const { ctx, pi, notifications } = makeCtx();
      const cause = new Error("Agents unstage refused: foreign content");

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
        cascade: cascadeFailingFor("d2", cause, { skills: ["mp2-d2-skill"], hooks: ["d2"] }),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [prunePartialFailureNotification("unreadable")]);
      assert.deepStrictEqual(await recordedInventory(locations), { "d2@mp2": [] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-05-13: a pruned member whose cascade reports no cause renders the fallback cause", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-prune-member-no-cause-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedDeclaringMarketplace(
        locations,
        "mp",
        { x: { dependencies: ["d1"] }, d1: { provenance: "dependency" } },
        cwd,
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await uninstallWithFreshOwner({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "x",
        prune: true,
        cascade: cascadeFailingFor("d1", undefined),
      });

      // assert
      assert.equal(outcome, undefined);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n" +
            "  ○ x v0.0.1 (uninstalled)\n" +
            "  ⊘ d1 v0.0.1 (failed) {unreadable}\n" +
            '    cause: Cascade unstage failed for plugin "d1".\n' +
            "\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
      assert.deepStrictEqual(await recordedInventory(locations), { "d1@mp": ["mp-d1-skill"] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
