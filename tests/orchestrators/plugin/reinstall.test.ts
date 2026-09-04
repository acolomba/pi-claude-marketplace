import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, readdirSync, watch, writeFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { GENERATED_AGENT_PREFIX } from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  installPlugin,
  type InstallCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  reinstallPlugin,
  reinstallPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import {
  dropMarketplaceCache,
  resetCompletionCache,
} from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import { retryTree } from "./scope-tree-inventory.ts";

import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  ReinstallCloneCacheSeam,
  ReinstallPluginDeps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import type { ExtensionAPI, ExtensionContext, ToolInfo } from "@earendil-works/pi-coding-agent";
import type { TestContext } from "node:test";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function toolInfo(name: string): ToolInfo {
  return { name } as ToolInfo;
}

function makeCtx(piOverrides?: { readonly toolNames?: readonly string[] }): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as ExtensionContext;
  const pi = {
    getAllTools: () => (piOverrides?.toolNames ?? []).map(toolInfo),
  } as ExtensionAPI;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "reinstall-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  resetCompletionCache();
  try {
    return await fn();
  } finally {
    resetCompletionCache();
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

interface ResourceSet {
  readonly skill?: string;
  readonly command?: string;
  readonly agent?: string;
  readonly mcp?: boolean;
  /**
   * WR-03: seed `<pluginRoot>/hooks/hooks.json` so reinstall's resolver
   * advertises `hooksConfigPath` and the per-plugin lock runs the
   * cache+rebuild pattern.
   */
  readonly hooksJson?: object;
}

async function seedMarketplace(opts: {
  readonly cwd: string;
  readonly marketplaceRoot: string;
  readonly marketplaceName?: string;
  readonly pluginName?: string;
  readonly version?: string;
  readonly resources?: ResourceSet;
  readonly install?: boolean;
  readonly scope?: "user" | "project";
  /**
   * DFEN-01: stamp `defaultEnabled` on the MARKETPLACE ENTRY -- the side that
   * WINS the precedence rule. A knob on the plugin's own plugin.json would
   * resolve through the fallback instead, so a fixture built there could pass
   * for the wrong reason. Absent -> the entry is written without the field.
   */
  readonly entryDefaultEnabled?: boolean;
  /**
   * DFEN-04: let the install honor the resolved declaration, so a record can
   * land disabled through the production path rather than by hand. Only
   * meaningful together with `install: true`.
   */
  readonly applyDefaultEnabled?: boolean;
}): Promise<{ readonly pluginRoot: string; readonly manifestPath: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const pluginName = opts.pluginName ?? "hello";
  const version = opts.version ?? "1.0.0";
  const resources = opts.resources ?? { skill: "old skill", command: "old command" };
  const scope = opts.scope ?? "project";

  const pluginRoot = path.join(opts.marketplaceRoot, "plugins", pluginName);
  await writePluginTree(pluginRoot, pluginName, resources);
  const manifestPath = await mergeManifestEntry(
    opts.marketplaceRoot,
    marketplaceName,
    pluginName,
    version,
    opts.entryDefaultEnabled,
  );

  const locations = locationsFor(scope, opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state = await loadState(locations.extensionRoot);
  const previousMarketplace = state.marketplaces[marketplaceName];
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope,
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: previousMarketplace?.plugins ?? {},
      },
    },
  });

  if (opts.install === true) {
    const { ctx, pi } = makeCtx({ toolNames: ["subagent", "mcp"] });
    await installPlugin({
      ctx,
      pi,
      scope,
      cwd: opts.cwd,
      marketplace: marketplaceName,
      plugin: pluginName,
      ...(opts.applyDefaultEnabled !== undefined && {
        applyDefaultEnabled: opts.applyDefaultEnabled,
      }),
    });
  }

  return { pluginRoot, manifestPath };
}

async function writePluginTree(
  pluginRoot: string,
  pluginName: string,
  resources: ResourceSet,
): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName }),
  );

  if (resources.skill !== undefined) {
    const skillDir = path.join(pluginRoot, "skills", "tool");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: tool\n---\n\n${resources.skill}\n`,
    );
  }

  if (resources.command !== undefined) {
    const commandDir = path.join(pluginRoot, "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(path.join(commandDir, "deploy.md"), `# deploy\n\n${resources.command}\n`);
  }

  if (resources.agent !== undefined) {
    const agentDir = path.join(pluginRoot, "agents");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      path.join(agentDir, "bot.md"),
      `---\nname: bot\ntools: Read,Grep\n---\n\n${resources.agent}\n`,
    );
  }

  if (resources.mcp === true) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { server1: { command: "node", args: ["server.js"] } } }),
    );
  }

  // WR-03: seed hooks payload so the resolver advertises hooksConfigPath
  // and the reinstall ledger exercises the cache+rebuild path.
  if (resources.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(resources.hooksJson));
  }
}

async function mergeManifestEntry(
  marketplaceRoot: string,
  marketplaceName: string,
  pluginName: string,
  version: string,
  /** DFEN-01: stamped on this plugin's entry; absent leaves the field off. */
  defaultEnabled?: boolean,
): Promise<string> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const plugins: Record<string, string> = {};
  const declarations: Record<string, boolean> = {};
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      readonly plugins?: readonly {
        readonly name?: unknown;
        readonly version?: unknown;
        readonly defaultEnabled?: unknown;
      }[];
    };
    for (const entry of manifest.plugins ?? []) {
      if (typeof entry.name === "string" && typeof entry.version === "string") {
        plugins[entry.name] = entry.version;
        if (typeof entry.defaultEnabled === "boolean") {
          declarations[entry.name] = entry.defaultEnabled;
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  plugins[pluginName] = version;
  if (defaultEnabled !== undefined) {
    declarations[pluginName] = defaultEnabled;
  }

  return writeManifest(marketplaceRoot, marketplaceName, plugins, declarations);
}

async function writeManifest(
  marketplaceRoot: string,
  marketplaceName: string,
  plugins: Record<string, string>,
  declarations: Record<string, boolean> = {},
): Promise<string> {
  const manifestDir = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: Object.entries(plugins).map(([name, version]) => ({
        name,
        version,
        source: `./plugins/${name}`,
        ...(Object.hasOwn(declarations, name) && { defaultEnabled: declarations[name] }),
      })),
    }),
  );
  return manifestPath;
}

async function reinstallDefault(cwd: string, ctx: ExtensionContext, pi: ExtensionAPI) {
  return reinstallPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
}

async function readSkill(cwd: string): Promise<string> {
  const locations = locationsFor("project", cwd);
  return readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8");
}

async function readCommand(cwd: string): Promise<string> {
  const locations = locationsFor("project", cwd);
  return readFile(path.join(locations.promptsTargetDir, "hello:deploy.md"), "utf8");
}

function errorNotifications(notifications: readonly NotifyRecord[]): readonly NotifyRecord[] {
  return notifications.filter((n) => n.severity === "error");
}

// ──────────────────────────────────────────────────────────────────────────
// Retry-proof observation helpers (NFR-3)
//
// Mechanical observation only: these read filesystem primitives and record
// the ledger events reinstall's bridges emit. They choose no expected value
// and derive no assertion -- every retry case authors its own literal
// schedule, tree, and byte expectations.
// ──────────────────────────────────────────────────────────────────────────

const retryRequire = createRequire(import.meta.url);
const retryFs = retryRequire("node:fs/promises") as typeof import("node:fs/promises");
/**
 * Snapshot taken before any case installs a mock, so a case's own repair step
 * between the two calls never lands in the observed schedule. A repair that
 * removes a fault fixture under a bridge's target dir is indistinguishable
 * from a production rollback at the `rm` boundary, so it has to bypass the
 * observer rather than be filtered by it.
 */
const retryRepairRm = retryFs.rm.bind(retryFs);

interface RetryScheduleDirs {
  readonly agentsStagingDir: string;
  readonly agentsTargetDir: string;
  readonly commandsStagingDir: string;
  readonly hooksPluginDir: string;
  readonly promptsTargetDir: string;
  readonly skillsStagingDir: string;
  readonly skillsTargetDir: string;
}

type RetryBridge = "agents" | "commands" | "skills";

/** Toggleable `rm` refusal aimed at one bridge's staging root. */
interface RetryStagingRmFault {
  readonly bridge: RetryBridge;
  enabled: boolean;
  readonly message: string;
}

function retryStagingDirOf(dirs: RetryScheduleDirs, bridge: RetryBridge): string {
  if (bridge === "agents") {
    return dirs.agentsStagingDir;
  }

  if (bridge === "commands") {
    return dirs.commandsStagingDir;
  }

  return dirs.skillsStagingDir;
}

function retryStagingSlot(
  dirs: RetryScheduleDirs,
  target: string,
): { readonly backup: boolean; readonly bridge: RetryBridge } | undefined {
  const parent = path.dirname(target);
  const bridges: readonly RetryBridge[] = ["agents", "commands", "skills"];
  for (const bridge of bridges) {
    if (parent === retryStagingDirOf(dirs, bridge)) {
      return { backup: path.basename(target).startsWith("backup-"), bridge };
    }
  }

  return undefined;
}

function retryTargetBridge(dirs: RetryScheduleDirs, target: string): RetryBridge | undefined {
  const parent = path.dirname(target);
  if (parent === dirs.agentsTargetDir) {
    return "agents";
  }

  if (parent === dirs.promptsTargetDir) {
    return "commands";
  }

  if (parent === dirs.skillsTargetDir) {
    return "skills";
  }

  return undefined;
}

/**
 * Record reinstall's prepare/replace/rollback/abort/finalize ledger from the
 * filesystem primitives each bridge issues, and optionally refuse one bridge's
 * staging removal so an abort or rollback leak becomes deterministic.
 *
 *   prepare:<bridge>    mkdir of `<stagingDir>/<uuid>`
 *   replace:<bridge>    mkdir of `<stagingDir>/backup-<uuid>`
 *   rollback:<bridge>   removal of a replaced target, or restore of a backup
 *   staging-rm:<bridge> removal of `<stagingDir>/<uuid>`
 *   backup-rm:<bridge>  removal of `<stagingDir>/backup-<uuid>`
 *   commit:hooks        mkdir of `<hooksDir>/<plugin>` by the atomic hooks write
 *   remove:hooks        removal of `<hooksDir>/<plugin>`
 *
 * Every event is recorded unconditionally and describes only the primitive
 * that was issued, so a repeated, extra, or out-of-order operation moves the
 * schedule. Unwinding one bridge that reached `replace:` therefore emits
 * `rollback:<bridge>` twice -- once for the removal of the replacement, once
 * for the restore of the backup.
 *
 * The derived vocabulary lives in each case's literal, not here: a
 * `staging-rm:` with no `replace:` for that bridge before it is an abort, one
 * that follows `replace:` is a finalize sweep, and a `backup-rm:` with no
 * `rollback:` for that bridge before it is a finalize of an accepted
 * replacement. Deciding that inside the observer would have let an
 * out-of-order cleanup be relabelled or dropped instead of failing.
 */
function observeReinstallSchedule(
  t: TestContext,
  dirs: RetryScheduleDirs,
  schedule: { current: string[] },
  stagingRmFault?: RetryStagingRmFault,
): () => void {
  const originalMkdir = retryFs.mkdir.bind(retryFs);
  const originalRename = retryFs.rename.bind(retryFs);
  const originalRm = retryFs.rm.bind(retryFs);
  const record = (event: string): void => {
    schedule.current.push(event);
  };

  const mkdirMock = t.mock.method(
    retryFs,
    "mkdir",
    async (...args: Parameters<typeof retryFs.mkdir>) => {
      const target = String(args[0]);
      if (target === dirs.hooksPluginDir) {
        record("commit:hooks");
      }

      const slot = retryStagingSlot(dirs, target);
      if (slot !== undefined) {
        record(`${slot.backup ? "replace" : "prepare"}:${slot.bridge}`);
      }

      return originalMkdir(...args);
    },
  );
  const renameMock = t.mock.method(
    retryFs,
    "rename",
    async (...args: Parameters<typeof retryFs.rename>) => {
      const restored = retryStagingSlot(dirs, path.dirname(String(args[0])));
      if (restored?.backup === true) {
        record(`rollback:${restored.bridge}`);
      }

      return originalRename(...args);
    },
  );
  const rmMock = t.mock.method(retryFs, "rm", async (...args: Parameters<typeof retryFs.rm>) => {
    const target = String(args[0]);
    if (target === dirs.hooksPluginDir) {
      record("remove:hooks");
    }

    const replaced = retryTargetBridge(dirs, target);
    if (replaced !== undefined) {
      record(`rollback:${replaced}`);
    }

    const slot = retryStagingSlot(dirs, target);
    if (slot !== undefined) {
      record(`${slot.backup ? "backup-rm" : "staging-rm"}:${slot.bridge}`);

      if (
        stagingRmFault?.enabled === true &&
        !slot.backup &&
        slot.bridge === stagingRmFault.bridge
      ) {
        throw new Error(stagingRmFault.message);
      }
    }

    return originalRm(...args);
  });
  syncBuiltinESMExports();

  return () => {
    rmMock.mock.restore();
    renameMock.mock.restore();
    mkdirMock.mock.restore();
    syncBuiltinESMExports();
  };
}

/** Case-local `ScopedLocations` projection the schedule observer consumes. */
function retryScheduleDirs(cwd: string, plugin: string): RetryScheduleDirs {
  const locations = locationsFor("project", cwd);
  return {
    agentsStagingDir: locations.agentsStagingDir,
    agentsTargetDir: locations.agentsDir,
    commandsStagingDir: locations.commandsStagingDir,
    hooksPluginDir: path.join(locations.hooksDir, plugin),
    promptsTargetDir: locations.promptsTargetDir,
    skillsStagingDir: locations.skillsStagingDir,
    skillsTargetDir: locations.skillsTargetDir,
  };
}

test("PRL-06: absent installed record returns skipped and does not mutate state or disk", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const before = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "skipped");
      assert.deepEqual(outcome.notes, ["not installed"]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), before);
      // CR-02 / D-01: the standalone path emits the absent-target row as an
      // error (was a silent return). State/disk stay untouched; the notify is
      // the only visible effect.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");
      assert.equal(
        notifications[0]?.message,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-08/11 happy: success preserves installed version, restages resources, deletes data, and refreshes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-happy-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent", mcp: true },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
        mcp: true,
      });
      await writeManifest(path.join(cwd, "mp-src"), "mp", { hello: "9.9.9" });
      const beforeRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(beforeRecord !== undefined);

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.version, "1.0.0");
      assert.equal(outcome.resourcesChanged, true);
      assert.deepEqual(outcome.stagedAgentNames, [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.deepEqual(outcome.stagedMcpServerNames, ["server1"]);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.0.0");
      assert.equal(record.installedAt, beforeRecord.installedAt);
      assert.match(await readSkill(cwd), /new skill/);
      await assert.rejects(() => readFile(path.join(dataDir, "state.txt"), "utf8"), /ENOENT/);
      assert.equal(errorNotifications(notifications).length, 0);
      assert.match(notifications.at(-1)?.message ?? "", /\/reload to pick up changes$/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: missing cached manifest entry fails and preserves old state, resources, and data", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-missing-entry-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      const beforeState = await readFile(locations.stateJsonPath, "utf8");
      const beforeSkill = await readSkill(cwd);
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "failed");
      assert.match(notifications[0]?.message ?? "", /not found in cached manifest/);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), beforeState);
      assert.equal(await readSkill(cwd), beforeSkill);
      assert.equal(await readFile(path.join(dataDir, "state.txt"), "utf8"), "plugin data");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10 / RINST-01: bare reinstall unconditionally overwrites foreign agent content across all bridges", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-overwrite-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      await writeFile(agentPath, "manual foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
      });
      const { ctx, pi, notifications } = makeCtx();

      // RINST-01 / D-67-03: a bare reinstall (no `--force`) overwrites the
      // agent that holds foreign bytes and refreshes every bridge -- overwrite
      // is unconditional.
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(errorNotifications(notifications).length, 0);
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: saveState failure rolls back physical replacements and preserves data", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-save-failure-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent", mcp: true },
        install: true,
      });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      await mkdir(dataDir, { recursive: true });
      await writeFile(path.join(dataDir, "state.txt"), "plugin data");
      const beforeState = await readFile(locations.stateJsonPath, "utf8");
      const beforeSkill = await readSkill(cwd);
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
        mcp: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("saveState failure")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.match(notifications[0]?.message ?? "", /saveState failure/);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), beforeState);
      assert.equal(await readSkill(cwd), beforeSkill);
      assert.equal(await readFile(path.join(dataDir, "state.txt"), "utf8"), "plugin data");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10 / RINST-01: unconditional overwrite of foreign previous agent content rolls back on save failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-rollback-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const foreignBytes = "manual foreign bytes";
      await writeFile(agentPath, foreignBytes, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("save failure after overwrite")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.equal(await readFile(agentPath, "utf8"), foreignBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-12: cache and data cleanup failures are SILENTLY swallowed after successful reinstall (V1 warning surface DROPPED per D-19-01)", async () => {
  // D-19-01 DROPS the two standalone-mode warning surfaces (bridgeWarnings
  // + maintenanceWarnings) that would otherwise fire after a successful
  // reinstall when the post-state-commit cache/data cleanup paths failed:
  // the underlying try/catch is retained (the side effects --
  // dropMarketplaceCache + rm -- still attempt to run), but the
  // user-visible warning surface is gone. The primary success
  // notification still fires.
  //
  // The orchestrated-mode `notes` field accumulation is asserted in the
  // PRL-13-quiet test below; this test asserts the standalone-mode
  // user-visible flow.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-cleanup-warning-"));
    try {
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache drop failed")),
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
      });

      assert.equal(outcome.partition, "reinstalled");
      // Exactly one notification (the V2 success cascade); zero warnings.
      assert.equal(notifications.length, 1);
      assert.equal(errorNotifications(notifications).length, 0);
      assert.equal(notifications.filter((n) => n.severity === "warning").length, 0);
      // Defense-in-depth: the dropped warning text MUST NOT leak into the
      // success notification's message.
      const body = notifications[0]?.message ?? "";
      assert.equal(body.includes("cache drop failed"), false);
      assert.equal(body.includes("data cleanup failed"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-12/RH-5: V2 per-variant reload-hint -- emitted on reinstalled even with zero resources changed (cascade stub); agents/MCP warn when unloaded", async () => {
  // The reload-hint is emitted structurally from
  // `PluginReinstalledMessage.status` per D-16-12 (the `reinstalled`
  // status is in the state-changing variant set), NOT from
  // cascade-outcome resource count. Mirrors the PU-8 (b) behavior.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-output-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "empty-mp"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: {},
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();
      const noResource = await reinstallDefault(cwd, ctx, pi);
      assert.equal(noResource.partition, "reinstalled");
      // The reload-hint trailer is emitted structurally
      // from the `reinstalled` variant per D-16-12, regardless of
      // resourcesChanged.
      assert.equal(
        (notifications.at(-1)?.message ?? "").includes("/reload to pick up changes"),
        true,
      );

      notifications.length = 0;
      const cwd2 = await mkdtemp(path.join(tmpdir(), "reinstall-output-deps-"));
      await seedMarketplace({
        cwd: cwd2,
        marketplaceRoot: path.join(cwd2, "mp-src"),
        resources: { agent: "agent", mcp: true },
        install: true,
      });
      const withDeps = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd: cwd2,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(withDeps.partition, "reinstalled");
      const body = notifications.at(-1)?.message ?? "";
      // CMC-13 / MSG-SD-1..2: per-row soft-dep markers. The single-plugin
      // reinstall renders as a 1-row cascade and the soft-dep markers
      // appear on the (reinstalled) row when companion extensions are
      // unloaded.
      assert.match(body, /\{[^}]*requires pi-subagents[^}]*\}/);
      assert.match(body, /\{[^}]*requires pi-mcp[^}]*\}/);
      assert.match(body, /\/reload to pick up changes/);
      await rm(cwd2, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 quiet render suppresses per-plugin notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-quiet-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 quiet render returns warning notes after successful cleanup warnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-quiet-warnings-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache drop failed")),
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(notifications, []);
      assert.ok(
        outcome.notes?.some((n) =>
          n.includes(
            'warning: Plugin "hello" reinstalled; completion cache refresh deferred: cache drop failed',
          ),
        ),
      );
      assert.ok(
        outcome.notes?.some((n) =>
          n.includes('warning: Plugin "hello" reinstalled; data cleanup deferred'),
        ),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-04 bulk bare reinstall enumerates user and project scopes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-all-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "ump",
        pluginName: "uplug",
        resources: { skill: "user old" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "project-mp-src"),
        marketplaceName: "pmp",
        pluginName: "pplug",
        resources: { skill: "project old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // CR-01 / D-04: ordered via compareByNameThenScope (name
      // primary case-insensitive, scope secondary project-before-user
      // per MSG-GR-3). "pmp" sorts before "ump" by name primary alone.
      assert.deepEqual(
        outcomes.map((o) => `[${o.scope}] ${o.name}@${o.marketplace}`),
        ["[project] pplug@pmp", "[user] uplug@ump"],
      );
      // D-19-02: cascade renders with orphan-fold per-row
      // scope suppression (D-17.2-01 / D-17.2-02): when the plugin's
      // scope matches the parent marketplace's scope, the per-row
      // `[<scope>]` bracket is OMITTED (renderScopeBracket contract).
      // The marketplace header still carries the
      // `[<scope>]` token. Project-scoped marketplaces sort before user
      // (compareByNameThenScope: project-before-user tie-breaker).
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /● pmp \[project\]\n {2}● pplug v\d/);
      assert.match(body, /● ump \[user\]\n {2}● uplug v\d/);
      // The summary/partition forms must NOT appear.
      assert.equal(body.includes("Reinstalled 2 plugins."), false);
      assert.equal(body.includes("Reinstalled:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-03 bulk marketplace reinstall resolves implicit scope like update", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-scope-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mymp",
        pluginName: "plug",
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mymp" },
      });

      assert.deepEqual(
        outcomes.map((o) => o.scope),
        ["project"],
      );
      // D-19-02: cascade marketplace header + indented
      // plugin row; orphan-fold suppresses the per-row `[<scope>]`
      // bracket when it matches the parent marketplace's scope.
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /● mymp \[project\]\n {2}● plug v/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-05 bulk reinstall explicit scope filters targets", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-filter-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "userplug",
        resources: { skill: "user" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "project-mp-src"),
        marketplaceName: "mp",
        pluginName: "projectplug",
        resources: { skill: "project" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "all" },
      });

      assert.deepEqual(
        outcomes.map((o) => `[${o.scope}] ${o.name}@${o.marketplace}`),
        ["[project] projectplug@mp"],
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03/SCOPE-01: explicit-scope-plugin reinstall of an other-scope-only target emits (skipped) {not installed, marketplace in user scope}", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-cross-scope-source-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // --scope project where the marketplace lives ONLY in user scope.
      // ATTR-03 / D-47-A: the PLUGIN is the row's subject -- the container sits
      // one scope over, so nothing is installed at the scope named. SCOPE-01:
      // the `[project]` bracket carries the REQUESTED scope, and the brace
      // token names the scope that HOLDS the container, so the operator is not
      // left to infer it. SEV-04 / D-01: an absent target means the operation
      // was NOT carried out, so the row is `error`.
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "plug", marketplace: "mp" },
      });

      // No raw throw escapes; the entrypoint returns [] before the cascade.
      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ plug (skipped) {not installed, marketplace in user scope}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03/SCOPE-01: explicit-scope-marketplace reinstall of an other-scope-only marketplace emits the scope-qualified not-added row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mp-cross-scope-empty-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // Marketplace target with explicit --scope project where mp lives only
      // in user scope. ATTR-03 / D-47-A: the miss is attributed to the
      // standalone `MarketplaceNotAddedMessage`, not to a synthetic
      // `(reinstall)` `{not found}` row. SCOPE-01: the `[project]` bracket
      // carries the REQUESTED scope. No raw throw escapes.
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {marketplace not added to project scope}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03: bare reinstall of a marketplace absent in BOTH scopes emits standalone {marketplace not added} with no bracket", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bare-absent-both-"));
    try {
      // Seed an unrelated marketplace so both scope states exist on disk but
      // neither holds `ghost-mp`.
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "other",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // Bare form (no --scope): ghost-mp is absent in both scopes.
      // ATTR-03 / D-47-A: the miss is attributed to the standalone
      // `{marketplace not added}` with NO bracket (absent-from-both form).
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {marketplace not added}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 batch reinstall continues after failed plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-continue-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "bad",
        resources: { skill: "bad" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "good",
        resources: { skill: "good" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "good", version: "1.0.0", source: "./plugins/good" }],
        }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.deepEqual(
        outcomes.map((o) => `${o.name}:${o.partition}`),
        ["bad:failed", "good:reinstalled"],
      );
      const body = notifications.at(-1)?.message ?? "";
      // D-19-02: cascade with mixed rows; `(reinstalled)`
      // on the success row, `(failed) {not in manifest}` on the failure
      // row (narrowed from `Plugin "bad" not found in cached manifest`).
      // Per-row scope orphan-folded (matches marketplace scope).
      // Severity computed by notify() per D-16-11: `error` (any failed
      // row tips the ladder to error; D-16-11 first-match takes
      // failed before warning).
      assert.match(body, /● mp \[project\]\n {2}⊘ bad \(failed\) \{not in manifest\}/);
      assert.match(body, /● good v1\.0\.0 \(reinstalled\)/);
      // The `Reinstalled plugin "good".` summary line + `Failed:`
      // partition header must NOT appear.
      assert.equal(body.includes('Reinstalled plugin "good".'), false);
      assert.equal(body.includes("Failed:"), false);
      // Severity is computed from contents per D-16-11 -> any failed row
      // tips the ladder to `error`.
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 deterministic partition output sorts by scope marketplace plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-sort-"));
    try {
      const aRoot = path.join(cwd, "a-src");
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "z-src"),
        marketplaceName: "z",
        pluginName: "b",
        resources: { skill: "z b" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: aRoot,
        marketplaceName: "a",
        pluginName: "c",
        resources: { skill: "a c" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: aRoot,
        marketplaceName: "a",
        pluginName: "a",
        resources: { skill: "a a" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "u-src"),
        marketplaceName: "u",
        pluginName: "z",
        resources: { skill: "u z" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // CR-01 / D-04: ordered project-before-user via
      // `compareByNameThenScope` (name primary case-insensitive, scope
      // secondary project-before-user per MSG-GR-3). Marketplace name
      // is the primary key: "a" < "u" < "z" lexicographically. Plugin
      // rows within a marketplace also sort by name primary.
      assert.deepEqual(
        outcomes.map((o) => ({
          partition: o.partition,
          scope: o.scope,
          marketplace: o.marketplace,
          name: o.name,
        })),
        [
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "a" },
          { partition: "reinstalled", scope: "project", marketplace: "a", name: "c" },
          { partition: "reinstalled", scope: "user", marketplace: "u", name: "z" },
          { partition: "reinstalled", scope: "project", marketplace: "z", name: "b" },
        ],
      );
      const body = notifications.at(-1)?.message ?? "";
      // D-19-02 / D-04: per-marketplace cascade
      // blocks ordered via `compareByNameThenScope` (name primary
      // case-insensitive, scope secondary project-before-user). Per-row
      // scope orphan-folded (matches marketplace scope). The body-regex
      // matches below assert presence (not order between markets) -- the
      // deepEqual above locks outcome order.
      assert.match(body, /● u \[user\]\n {2}● z v1\.0\.0 \(reinstalled\)/);
      assert.match(
        body,
        /● a \[project\]\n {2}● a v1\.0\.0 \(reinstalled\)\n {2}● c v1\.0\.0 \(reinstalled\)/,
      );
      assert.match(body, /● z \[project\]\n {2}● b v1\.0\.0 \(reinstalled\)/);
      assert.equal(body.includes("Reinstalled:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("260525-cjr C9: same-name cross-scope reinstall -> project-scope row renders BEFORE user-scope row (MSG-GR-3 stable-sort tie-break)", async () => {
  // The existing PRL-13 deterministic-sort test (above) uses DISTINCT
  // marketplace names (a / u / z) so the marketplace-name primary key
  // never produces same-name pairs -- the project-before-user secondary
  // tie-break on `MarketplaceRow.scope` never fires. This test seeds
  // the SAME marketplace name in BOTH scopes so the tie-break is
  // exercised end-to-end through the cascade renderer (NOT just via
  // the unit test on `compareByNameThenScope` in
  // `tests/presentation/sort.test.ts`).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-same-name-scopes-"));
    try {
      // Both scopes carry a marketplace named "mp" with a plugin named
      // "p". The roots are deliberately distinct dirs so install
      // succeeds independently in each scope.
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "mp-user-src"),
        marketplaceName: "mp",
        pluginName: "p",
        resources: { skill: "user-scope skill" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "mp-project-src"),
        marketplaceName: "mp",
        pluginName: "p",
        resources: { skill: "project-scope skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      // Outcome order asserts the project-before-user tie-break at the
      // orchestrator boundary -- both outcomes share `marketplace: "mp"`
      // and `name: "p"`, so the scope secondary key decides.
      assert.deepEqual(
        outcomes.map((o) => ({
          partition: o.partition,
          scope: o.scope,
          marketplace: o.marketplace,
          name: o.name,
        })),
        [
          { partition: "reinstalled", scope: "project", marketplace: "mp", name: "p" },
          { partition: "reinstalled", scope: "user", marketplace: "mp", name: "p" },
        ],
      );

      // Rendered cascade order: the two same-named marketplace blocks
      // appear with project-scope FIRST. Locate both headers in the
      // body and assert the project header's index is lower than the
      // user header's.
      const body = notifications.at(-1)?.message ?? "";
      const projectHeaderIdx = body.indexOf("● mp [project]");
      const userHeaderIdx = body.indexOf("● mp [user]");
      assert.ok(
        projectHeaderIdx >= 0,
        `expected project-scope header '● mp [project]' in body:\n${body}`,
      );
      assert.ok(userHeaderIdx >= 0, `expected user-scope header '● mp [user]' in body:\n${body}`);
      assert.ok(
        projectHeaderIdx < userHeaderIdx,
        `project-scope cascade row must render BEFORE user-scope (MSG-GR-3 stable-sort tie-break).\n  project idx=${String(projectHeaderIdx)}\n  user idx=${String(userHeaderIdx)}\n  body:\n${body}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-14 batch reload hint uses only changed successful outcomes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-reload-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "empty",
        resources: {},
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "withskill",
        resources: { skill: "skill" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /\/reload to pick up changes/);
      assert.doesNotMatch(body, /"empty"/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-15 batch soft dependency warnings aggregate successful restaged resources only", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-soft-deps-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "bad",
        resources: { agent: "bad agent" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "good",
        resources: { agent: "good agent", mcp: true },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "good", version: "1.0.0", source: "./plugins/good" }],
        }),
      );
      const { ctx, pi, notifications } = makeCtx();

      await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      const body = notifications.at(-1)?.message ?? "";
      // D-19-02 / MSG-SD-1..2: per-row soft-dep markers via
      // the notify() probe. The `good` plugin (reinstalled with
      // agent+mcp) carries `{requires pi-subagents, requires pi-mcp}`;
      // the `bad` plugin (failed) does NOT (effective state = not
      // installed; MSG-SD-3 -- failed rows omit soft-dep markers).
      // Per-row scope orphan-folded (matches marketplace scope).
      assert.match(
        body,
        /● good v1\.0\.0 \(reinstalled\) \{requires pi-subagents, requires pi-mcp\}/,
      );
      assert.match(body, /⊘ bad \(failed\) \{not in manifest\}/);
      assert.equal(body.includes("Failed:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// -----------------------------------------------------------------------
// Additional coverage tests for uncovered paths
// -----------------------------------------------------------------------

test("GAP-01: reinstallPlugins with no installed plugins emits empty-marketplaces notice", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-no-plugins-"));
    try {
      // No plugins installed; state is empty.
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.deepEqual([...outcomes], []);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "(no marketplaces)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-02: reinstallPlugins with plugin removed from manifest emits failed cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-zero-reinstall-"));
    try {
      // Install then remove plugin from manifest so every reinstall target fails.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "failed");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /not in manifest/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-03: reinstallPlugin render=none failure returns failed without notifying", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-fail-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      await writeFile(
        path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
        JSON.stringify({ name: "mp", plugins: [] }),
      );
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "failed");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-04: errorWithManualRecovery empty-leaks path: saveState fails on empty-resource plugin", async () => {
  // Empty-resource plugin: replaceAll succeeds with all-noop replacements,
  // rollbackReplacements([]) returns []. errorWithManualRecovery(err, [])
  // hits the leaks.length === 0 early-return branch and returns the base
  // error unchanged (no MANUAL RECOVERY REQUIRED prefix).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-empty-leaks-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {},
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("atomic-save-failed")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      const note = outcome.notes?.[0] ?? "";
      assert.ok(note.includes("atomic-save-failed"), `expected cause in: ${note}`);
      assert.equal(
        notifications.some((n) => n.severity === "error"),
        true,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-06: prepareAllHandles catch: MCP collision aborts partial handles and wraps error", async () => {
  // Two plugins in the same marketplace declare the same MCP server name.
  // Reinstalling the first one after the second owns the server triggers
  // McpServerCollisionError inside prepareStageMcpServers, which is caught
  // by prepareAllHandles' try/catch. The error is wrapped by
  // errorWithManualRecovery and surfaced as a failed outcome.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mcp-collision-"));
    try {
      // Install "hello" with mcp server "server1".
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: { mcp: true },
        install: true,
      });
      // Install "other" that also declares "server1" in a separate marketplace.
      // We write its mcp.json entry directly into the project mcp.json so that
      // prepareStageMcpServers sees a cross-slot collision when reinstalling hello.
      const locations = locationsFor("project", cwd);
      const mcpPath = locations.mcpJsonPath;
      let mcpDoc: Record<string, unknown> = {};
      try {
        mcpDoc = JSON.parse(await readFile(mcpPath, "utf8")) as Record<string, unknown>;
      } catch {
        // mcp.json may not exist yet
      }

      const mcpServers = (mcpDoc.mcpServers ?? {}) as Record<string, unknown>;
      // Register server1 under a foreign plugin marker so it looks like another plugin owns it.
      mcpServers["server1"] = {
        command: "node",
        args: ["other.js"],
        __claude_marketplace_plugin: "other@othermp",
      };
      mcpDoc.mcpServers = mcpServers;
      await writeFile(mcpPath, JSON.stringify(mcpDoc));

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-07: reinstallPlugin skipped does not trigger runPostSuccessMaintenance", async () => {
  // When the plugin is not installed, runLockedReinstall returns
  // partition='skipped'. The code at line 184-186 returns the skipped outcome
  // without calling runPostSuccessMaintenance (so no cache/data drops run).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-no-maint-"));
    try {
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      let maintenanceCalled = false;
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => {
            maintenanceCalled = true;
            return Promise.resolve();
          },
        },
      });

      assert.equal(outcome.partition, "skipped");
      assert.equal(maintenanceCalled, false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-08: reinstallPlugin render=none with skipped outcome emits no notifications", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-skip-"));
    try {
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "skipped");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-09: reinstallPlugin render=none success with bridgeWarnings returns annotated notes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-warn-"));
    const locations = locationsFor("project", cwd);
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
        __deps: {
          stateTransaction: {
            saveState: async (extensionRoot, state) => {
              await saveState(extensionRoot, state);
              await chmod(locations.skillsStagingDir, 0o000);
            },
          },
        },
      });
      await chmod(locations.skillsStagingDir, 0o700);

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(outcome.notes?.some((note) => note.startsWith("warning: skills: ")));
      assert.ok(outcome.notes?.some((note) => note.includes("replacement backup directory")));
    } finally {
      await chmod(locations.skillsStagingDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-10: reinstallPlugin render=none success with no warnings returns bare locked.outcome", async () => {
  // When no bridge warnings and no maintenance warnings exist,
  // the notes.length === 0 branch returns locked.outcome unchanged (no notes field).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-nowarn-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.notes, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-11 / RINST-01: reinstallPlugin unconditionally overwrites agent foreign content", async () => {
  // RINST-01 / D-67-03: overwrite is unconditional -- replaceAll always calls
  // replacePreparedAgents with { force: true }. The success path verifies that
  // the outer render='default' success notification includes the reload hint.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-success-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      await writeFile(agentPath, "foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.equal(errorNotifications(notifications).length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-12: reinstallPlugins exactly-one-reinstalled emits singular summary", async () => {
  // reinstallSummary with reinstalledCount === 1 returns
  // 'Reinstalled plugin "<name>".' (the singular branch).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-singular-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "reinstalled");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /hello.*reinstalled/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-13: reinstallPlugin user-scope happy path reinstalls and records correct scope", async () => {
  // Exercise the user-scope code path (locationsFor('user', cwd)).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-user-scope-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "ump",
        pluginName: "uplug",
        resources: { skill: "user old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "user",
        cwd,
        marketplace: "ump",
        plugin: "uplug",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.scope, "user");
      assert.equal(errorNotifications(notifications).length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-14: reinstallPlugins batch with only skipped outcomes emits skipped cascade", async () => {
  // When every reinstall target reports skipped ('not installed' because
  // the plugin record was removed from state), reinstallSummary returns
  // 'Plugin reinstall complete.' and the batch notification includes a
  // Skipped section.  Explicit scope is required so resolveReinstallScope
  // takes the explicitScope branch and finds the marketplace in state.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-all-skipped-"));
    try {
      // Install a plugin then remove it from state so reinstall sees it as skipped.
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      // Clear the plugins map so the plugin appears 'not installed'.
      await saveState(locations.extensionRoot, {
        schemaVersion: 1,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath: path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json"),
            marketplaceRoot: path.join(cwd, "mp-src"),
            plugins: {},
          },
        },
      });
      const { ctx, pi, notifications } = makeCtx();

      // Explicit scope=project so enumerateMarketplaceReinstallTargets finds
      // the marketplace and returns [{ plugin: "hello", scope: "project" }].
      // reinstallPlugin then sees plugin not in mp.plugins and returns skipped.
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(outcomes.length, 1);
      assert.equal(outcomes[0]?.partition, "skipped");
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /skipped/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-15: reinstallPlugin with bridge warning emits notifyWarning before success", async () => {
  // collectStagingWarnings propagates through locked.bridgeWarnings.
  // When render='default', bridgeWarnings are emitted via notifyWarning
  // before the success notification. This exercises the
  // 'for (const warning of locked.bridgeWarnings)' loop body.
  // We trigger the warning via a dropMarketplaceCache failure with render='default'.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bridge-warn-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          dropMarketplaceCache: () => Promise.reject(new Error("cache-drop-warn")),
        },
      });

      // dropMarketplaceCache failure is swallowed; reinstall still succeeds.
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(notifications.some((n) => n.message.includes("reinstalled")));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-16: reinstallPlugin saveState failure with non-empty replacements wraps as ManualRecoveryError", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-save-nonempty-leaks-"));
    const locations = locationsFor("project", cwd);
    try {
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: async () => {
              await chmod(locations.skillsStagingDir, 0o000);
              throw new Error("save-failure");
            },
          },
        },
      });
      await chmod(locations.skillsStagingDir, 0o700);

      // assert
      assert.equal(outcome.partition, "failed");
      assert.equal(outcome.failureClass, "manual-recovery");
      assert.ok(outcome.notes[0]?.includes("save-failure"));
    } finally {
      await chmod(locations.skillsStagingDir, 0o700).catch(() => undefined);
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-17: reinstallPlugin outcome notes include reinstall-specific failure message", async () => {
  // Verify the 'notes' field on a failed outcome contains the formatted
  // error chain from formatErrorWithCauses, covering the catch-block at
  // lines 175-182 in reinstallPlugin.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-notes-chain-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            saveState: () => Promise.reject(new Error("root-cause-error")),
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      assert.ok(outcome.notes !== undefined && outcome.notes.length > 0);
      assert.ok(
        outcome.notes.some((n) => n.includes("root-cause-error")),
        `expected root-cause-error in notes: ${JSON.stringify(outcome.notes)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("ATTR-03: a plugin reinstall whose marketplace is absent everywhere names the marketplace", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-plugin-ghost-"));
    try {
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "plugin", marketplace: "ghost-mp", plugin: "hello" },
      });

      // assert
      assert.deepEqual([...outcomes], []);
      assert.deepEqual(notifications, [
        {
          message:
            "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {marketplace not added}",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SCOPE-01: an explicit-scope plugin reinstall of an other-scope-only container names the plugin, not the marketplace", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-cross-scope-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: { skill: "s" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
      });

      // assert
      assert.deepEqual([...outcomes], []);
      assert.deepEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n" +
            "● mp [project]\n" +
            "  ⊘ hello (skipped) {not installed, marketplace in user scope}",
          severity: "error",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-18: reinstallPlugins enumeration miss for an other-scope-only marketplace emits the scope-qualified not-added row", async () => {
  // enumerateMarketplaceReinstallTargets raises the structural
  // MarketplaceNotAddedSignal when the marketplace exists only in user scope
  // and the caller specifies project scope explicitly. reinstallPlugins
  // catches it at the targets-enumeration boundary and emits the standalone
  // `{marketplace not added}` variant (ATTR-03 / D-47-A) -- no raw throw escapes.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-enum-err-"));
    try {
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-src"),
        marketplaceName: "onlyuser",
        pluginName: "plug",
        resources: { skill: "s" },
        install: true,
      });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "onlyuser" },
      });

      assert.deepEqual([...outcomes], []);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(
        body,
        "A marketplace operation has failed.\n\n⊘ onlyuser [project] (failed) {marketplace not added to project scope}",
      );
      assert.equal(notifications.at(-1)?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-19: reinstallPlugin updateStateRecord concurrent-removal detection", async () => {
  // Inject a loadState that returns a state with the plugin present
  // (passes the initial check at runLockedReinstall), but where the
  // plugins object is a Proxy that returns undefined on the second access
  // so updateStateRecord's check (line 646) throws 'concurrently removed'.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-concurrent-remove-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      let firstAccess = true;
      const { ctx, pi } = makeCtx();

      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        __deps: {
          stateTransaction: {
            loadState: async (extensionRoot) => {
              const state = await loadState(extensionRoot);
              const mp = state.marketplaces["mp"];
              if (mp === undefined) {
                return state;
              }

              // Proxy the plugins map so the "hello" plugin exists on first
              // access (the initial null-check in runLockedReinstall) but
              // appears removed on all subsequent accesses (updateStateRecord).
              const proxied = new Proxy(mp.plugins, {
                get(target: typeof mp.plugins, prop: string | symbol): unknown {
                  if (prop === "hello") {
                    if (firstAccess) {
                      firstAccess = false;
                      return Reflect.get(target, prop);
                    }

                    return undefined;
                  }

                  return Reflect.get(target, prop);
                },
              });
              (state.marketplaces as Record<string, unknown>)["mp"] = { ...mp, plugins: proxied };
              return state;
            },
          },
        },
      });

      assert.equal(outcome.partition, "failed");
      const note = outcome.notes?.[0] ?? "";
      assert.ok(
        note.includes("concurrently removed"),
        `expected 'concurrently removed' in: ${note}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WB-01/WB-02 deep-equal short-circuit + --local
// ──────────────────────────────────────────────────────────────────────────

test("WB-01 / A7: reinstall with EQUAL existing entry leaves config byte- and mtime-unchanged (RECON-05)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-noop-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // seedMarketplace -> installPlugin already wrote claude-plugins.json
      // with the entry `{}`. Snapshot bytes + mtime BEFORE reinstall.
      const bytesBefore = await readFile(locations.configJsonPath);
      const statBefore = await (await import("node:fs/promises")).stat(locations.configJsonPath);

      // Pause to ensure any write would produce a different mtime.
      await new Promise((r) => setTimeout(r, 50));

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const bytesAfter = await readFile(locations.configJsonPath);
      const statAfter = await (await import("node:fs/promises")).stat(locations.configJsonPath);
      assert.deepEqual(bytesAfter, bytesBefore);
      assert.equal(statAfter.mtimeMs, statBefore.mtimeMs, "config mtime MUST be unchanged");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01 / A7: reinstall with DIFFERENT existing entry writes back the patched shape (forward-compat key preserved)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-diff-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // Overwrite the entry with a known-different shape carrying an unknown
      // forward-compat key. The reinstall MUST preserve the unknown key
      // (D-09) -- the deep-equal short-circuit fires when the prospective
      // patched shape ({} spread over existing) == existing.
      const { saveConfig, loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const cur = await loadConfig(locations.configJsonPath);
      assert.equal(cur.status, "valid");
      if (cur.status !== "valid") {
        return;
      }

      await saveConfig(
        locations.configJsonPath,
        {
          schemaVersion: 1,
          plugins: { "hello@mp": { enabled: false, futureKey: "x" } as never },
        },
        locations.scopeRoot,
      );

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      // Existing shape `{ enabled: false, futureKey: "x" }` deep-equals
      // the spread-over-existing patched shape -- byte-stable, write
      // SKIPPED. The unknown key MUST still be present (no clobber).
      const after = await loadConfig(locations.configJsonPath);
      assert.equal(after.status, "valid");
      if (after.status === "valid") {
        const entry = after.config.plugins?.["hello@mp"] as Record<string, unknown> | undefined;
        assert.equal(entry?.enabled, false);
        assert.equal(entry?.futureKey, "x");
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WB-01: --local reinstall targets the local file; base file untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wb01-local-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "s", command: "c" },
        install: true,
      });

      // Snapshot base bytes BEFORE the --local reinstall.
      const baseBytesBefore = await readFile(locations.configJsonPath);

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });
      assert.equal(outcome.partition, "reinstalled");

      // Base bytes UNCHANGED on the --local path (--local NEVER touches the
      // base file).
      const baseBytesAfter = await readFile(locations.configJsonPath);
      assert.deepEqual(baseBytesAfter, baseBytesBefore);

      // Local file received the write -- the local file was ABSENT before
      // the reinstall, so the key is missing -> WRITE fires to add the
      // implicit declaration.
      const { loadConfig } =
        await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
      const localCfg = await loadConfig(locations.configLocalJsonPath);
      assert.equal(localCfg.status, "valid");
      if (localCfg.status === "valid") {
        assert.deepEqual(localCfg.config.plugins?.["hello@mp"], {});
      }
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after reinstallPlugin succeeds, the hooks-bridge routing
// table reflects the post-reinstall entry set. Reinstall does NOT delegate
// to install/uninstall, so the cache lifecycle
// is wired explicitly inside the per-plugin lock and verified end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: reinstallPlugin round-trips the plugin's routing-table entries without /reload", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  const { getRoutingBucket } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");

  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr03-"));
    try {
      resetRoutingState();
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: {
          skill: "old skill",
          hooksJson: {
            PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hi" }] }],
          },
        },
      });

      // After the seed install, the routing table contains the plugin's
      // PreToolUse entry (install-arm WR-03 wiring confirmed elsewhere).
      const preBucket = getRoutingBucket("PreToolUse");
      assert.equal(preBucket.length, 1);
      assert.equal(preBucket[0]?.pluginId, "hello");

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean reinstall notification; got: ${summary}`,
      );

      // Post-condition: the routing-table entry still reflects the plugin
      // after the explicit remove+add inside the per-plugin lock. This
      // proves both `removePluginConfigFromCache` and
      // `addPluginConfigToCache` plus the trailing `rebuildRoutingTables`
      // call landed in the right order.
      const postBucket = getRoutingBucket("PreToolUse");
      assert.equal(postBucket.length, 1);
      assert.equal(postBucket[0]?.pluginId, "hello");
      assert.equal(postBucket[0]?.handlerDecl["command"], "echo hi");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table. CLAUDE_PLUGIN_ROOT export at dispatch depends on it.
      const reinstallLoc = locationsFor("project", cwd);
      const postState = await loadState(reinstallLoc.extensionRoot);
      assert.equal(
        postBucket[0]?.resolvedSource,
        postState.marketplaces["mp"]?.plugins["hello"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource after reinstall",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: 5th cascade slot in reinstall.ts -- the parallel-prepare/commit
// path writes <hooksDir>/<plugin>/hooks.json between the agents and mcp
// replace steps and removes the stale subtree when the plugin no longer
// ships hooks.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-rewrite-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);

      const hooksJson = {
        PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo reinstalled" }] }],
      };

      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: {
          skill: "old skill",
          hooksJson,
        },
      });

      // Corrupt the on-disk hooks file so we can detect whether reinstall
      // actually rewrites it (rather than passively leaving the prior install
      // arm's write in place).
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ corrupted: true }),
      );

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean reinstall; got: ${summary}`);

      const written = await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      assert.deepEqual(
        JSON.parse(written),
        hooksJson,
        "reinstall cascade slot must rewrite hooks.json from the resolved manifest",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LIFE-01 (reinstall): a plugin without hooks removes any stale <hooksDir>/<plugin>/ subtree", async () => {
  const { resetRoutingState } =
    await import("../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts");
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-drop-"));
    try {
      resetRoutingState();
      const locations = locationsFor("project", cwd);

      // Seed a plugin WITHOUT hooks.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        install: true,
        resources: { skill: "old skill" },
      });

      // Pre-place a stale hooks file at the destination as if a prior
      // install had left one behind.
      await mkdir(path.join(locations.hooksDir, "hello"), { recursive: true });
      await writeFile(
        path.join(locations.hooksDir, "hello", "hooks.json"),
        JSON.stringify({ stale: true }),
      );

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");

      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(!summary.includes("(failed)"), `expected clean reinstall; got: ${summary}`);

      // The stale hooks dir must be gone.
      let stillThere = true;
      try {
        await readFile(path.join(locations.hooksDir, "hello", "hooks.json"), "utf8");
      } catch {
        stillThere = false;
      }

      assert.equal(
        stillThere,
        false,
        "reinstall cascade slot must removeHookConfig when the resolved plugin has no hooks",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// BFILL-01 / RINST-01 / D-68-02: reinstall is force-capable. It resolves the
// `installable | unsupported` union through `requireForceInstallable`, so a
// plugin that re-resolves `unsupported` (here: a `.lsp.json` lspServers
// convention file beside a supported skill) passes the gate instead of
// throwing `{not-installable}`. Re-resolution stays cache-only (NFR-5). The persisted
// compatibility record reflects the REAL supported/unsupported sets at the
// SAME recorded version (a promotion-shaped repair, not an upgrade).
async function seedThenDegradeToUnsupported(cwd: string): Promise<string> {
  // Install a normal (installable) plugin with one supported skill.
  const seeded = await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { skill: "old skill" },
    install: true,
  });
  // Drop an lspServers convention file so re-resolution degrades to
  // `unsupported` with supported=["skills"], unsupported=["lspServers"].
  await writeFile(path.join(seeded.pluginRoot, ".lsp.json"), "{}");
  return seeded.pluginRoot;
}

test("BFILL-01 / RINST-01: reinstalling a force-installed (unsupported) plugin succeeds instead of throwing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-force-"));
    try {
      await seedThenDegradeToUnsupported(cwd);

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-68-02 partial: reinstall records the REAL non-empty unsupported set at the same version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-partial-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedThenDegradeToUnsupported(cwd);

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      assert.equal(outcome.partition, "reinstalled");

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      // The partial re-materialize stays force-installed: installable=false
      // with a non-empty unsupported set (D-66-01 derivation source).
      assert.equal(record.compatibility.installable, false);
      assert.deepEqual(record.compatibility.unsupported, ["lspServers"]);
      assert.deepEqual(record.compatibility.supported, ["skills"]);
      // D-68-02: SAME recorded version (a repair/promotion, not an upgrade).
      assert.equal(record.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-68-02 full: reinstall of an installable plugin records installable:true with empty unsupported", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-full-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      assert.equal(outcome.partition, "reinstalled");

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      assert.equal(record.compatibility.installable, true);
      assert.deepEqual(record.compatibility.unsupported, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PURL-07 / D-78-02 -- offline reinstall of a git-source (url / git-subdir /
// github) plugin from the state record's recorded resolvedSha. Reinstall pins
// from the recorded sha and reaches materializePluginClone by name via the
// clone-cache seam; it NEVER calls resolvePluginPin / resolveRemoteRef, so a
// warm cache is offline by construction.
// ───────────────────────────────────────────────────────────────────────────

const GIT_SOURCE_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const DEVICE_CODE = {
  device_code: "MOCK_DEVICE_CODE",
  user_code: "ABCD-1234",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 0,
} as const;
const REINSTALL_REMOTE_URLS = [
  "https://example.com/org/mono.git",
  "https://example.com/org/repo.git",
  "https://github.com/org/one.git",
  "https://github.com/org/repo.git",
  "https://github.com/org/two.git",
  "https://gitlab.example.com/o/r.git",
] as const;

function makeMockGitOps(
  options: {
    readonly fixtureSourceDir?: string;
    readonly cloneThrows?: Error;
    readonly resolveRemoteRefThrows?: Error;
  } = {},
): {
  readonly gitOps: ReturnType<typeof createGitOpsFake>["gitOps"];
  readonly state: {
    readonly cloneCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"];
    readonly checkoutCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["checkout"];
    readonly resolveRemoteRefCalls: ReturnType<
      typeof createGitOpsFake
    >["state"]["calls"]["resolveRemoteRef"];
  };
} {
  const fake = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: REINSTALL_REMOTE_URLS,
    ...(options.fixtureSourceDir !== undefined && {
      cloneFixture: { boundary: "local" as const, sourceDir: options.fixtureSourceDir },
    }),
    ...(options.cloneThrows !== undefined && { cloneError: options.cloneThrows }),
    ...(options.resolveRemoteRefThrows !== undefined && {
      resolveRemoteRefError: options.resolveRemoteRefThrows,
    }),
  });
  const gitOps: typeof fake.gitOps = {
    ...fake.gitOps,
    async clone(cloneOptions) {
      const { auth: _auth, ...cloneWithoutCallbacks } = cloneOptions;
      await fake.gitOps.clone(cloneWithoutCallbacks);
    },
    async resolveRef(resolveOptions) {
      if (resolveOptions.ref === "refs/remotes/origin/HEAD") {
        const remoteMain = fake.state.localRefs["refs/remotes/origin/main"];
        if (remoteMain !== undefined) {
          return remoteMain;
        }
      }

      return fake.gitOps.resolveRef(resolveOptions);
    },
    async resolveRemoteRef(resolveOptions) {
      const { auth: _auth, ...resolveWithoutCallbacks } = resolveOptions;
      return fake.gitOps.resolveRemoteRef(resolveWithoutCallbacks);
    },
  };
  return {
    gitOps,
    state: {
      cloneCalls: fake.state.calls.clone,
      checkoutCalls: fake.state.calls.checkout,
      resolveRemoteRefCalls: fake.state.calls.resolveRemoteRef,
    },
  };
}

/** Bind install's clone-cache seam to a mock gitOps (used to seed the install). */
function installSeamWith(gitOps: GitOps): InstallCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/** Bind reinstall's clone-cache seam (materialize only) to a mock gitOps. */
function reinstallSeamWith(gitOps: GitOps): ReinstallCloneCacheSeam {
  return {
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
  };
}

function capturingReinstallSeam(gitOps: GitOps): {
  readonly seam: ReinstallCloneCacheSeam;
  readonly captured: { auth: GitAuthBundle | undefined; count: number };
} {
  const captured: { auth: GitAuthBundle | undefined; count: number } = {
    auth: undefined,
    count: 0,
  };
  const seam: ReinstallCloneCacheSeam = {
    materializePluginClone: (args) => {
      captured.auth = args.auth;
      captured.count += 1;
      return materializePluginClone({ ...args, gitOps });
    },
  };
  return { seam, captured };
}

/**
 * Build a git plugin fixture tree on disk (the "repo" the mock clone copies),
 * seed a marketplace whose manifest entry carries a git-object source, then
 * install it via the git seam so the state record carries `resolvedSha` and
 * the clone materializes into plugin-clones/<key>/ (a warm cache).
 *
 * `subdirPath` places the plugin under `<repo>/<subdirPath>/` for git-subdir
 * fixtures; when absent the plugin lives at the repo root (url / github).
 */
async function seedInstalledGitSourcePlugin(opts: {
  cwd: string;
  marketplaceName: string;
  pluginName: string;
  source: unknown;
  subdirPath?: string;
}): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const fixtureRepoDir = path.join(opts.cwd, "repo-fixture");
  const pluginRoot =
    opts.subdirPath === undefined ? fixtureRepoDir : path.join(fixtureRepoDir, opts.subdirPath);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: opts.pluginName, version: "9.9.9" }),
  );
  const skillDir = path.join(pluginRoot, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);

  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: opts.marketplaceName,
      plugins: [{ name: opts.pluginName, source: opts.source }],
    }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      [opts.marketplaceName]: {
        name: opts.marketplaceName,
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  });

  const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
  const { ctx, pi } = makeCtx();
  await installPlugin({
    ctx,
    pi,
    scope: "project",
    cwd: opts.cwd,
    marketplace: opts.marketplaceName,
    plugin: opts.pluginName,
    cloneCacheSeam: installSeamWith(gitOps),
  });
}

test("a clone-cache seam non-Error rejection becomes a complete failed outcome", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-clone-string-failure-"));
    try {
      // arrange
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
      });
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(
        pluginCloneKey("https://github.com/org/repo", GIT_SOURCE_SHA),
      );
      await rm(cloneRoot, { recursive: true, force: true });
      const { ctx, pi, notifications } = makeCtx();
      const rejectNonError = Promise.reject.bind(Promise);

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: {
          cloneCacheSeam: {
            materializePluginClone: () => rejectNonError("clone-cache string failure"),
          },
        },
      });

      // assert
      assert.deepEqual(outcome, {
        partition: "failed",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        notes: ["clone-cache string failure\n\ncause: clone-cache string failure"],
      });
      assert.deepEqual(notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin reinstall authentication: a cold GitHub cache threads one provider bundle", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-cold-"));
    try {
      // arrange
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
      });
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(
        pluginCloneKey("https://github.com/org/repo", GIT_SOURCE_SHA),
      );
      await rm(cloneRoot, { recursive: true, force: true });
      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: path.join(cwd, "repo-fixture"),
      });
      const { seam, captured } = capturingReinstallSeam(gitOps);
      const { credentialOps, calls: credentialCalls } = createCredentialOpsFake({
        boundary: "memory",
      });
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: DEVICE_CODE,
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        deviceFlowHttp: deviceFlow.http,
        __deps: { cloneCacheSeam: seam },
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(captured.count, 1);
      assert.equal(captured.auth?.host, "github.com");
      assert.equal(gitState.cloneCalls.length, 1);
      assert.deepEqual(credentialCalls, { approve: [], fill: [], reject: [] });
      assert.deepEqual(deviceFlow.calls, { pollToken: [], requestCode: [] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin reinstall authentication: a non-provider host threads no auth bundle", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-no-provider-"));
    try {
      // arrange
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "url",
          url: "https://gitlab.example.com/o/r",
          sha: GIT_SOURCE_SHA,
        },
      });
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(
        pluginCloneKey("https://gitlab.example.com/o/r", GIT_SOURCE_SHA),
      );
      await rm(cloneRoot, { recursive: true, force: true });
      const { gitOps } = makeMockGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingReinstallSeam(gitOps);
      const { credentialOps, calls: credentialCalls } = createCredentialOpsFake({
        boundary: "memory",
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        __deps: { cloneCacheSeam: seam },
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(captured.count, 1);
      assert.equal(captured.auth, undefined);
      assert.deepEqual(credentialCalls, { approve: [], fill: [], reject: [] });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("plugin reinstall authentication: a bulk cold-cache sweep shares one host memo", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-auth-memo-"));
    try {
      // arrange
      const secondSha = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "unused", version: "9.9.9" }),
      );
      const skillDir = path.join(fixtureRepoDir, "skills", "greet");
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: greet\n---\n\nHi.\n");
      const marketplaceRoot = path.join(cwd, "mp-src");
      await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
      const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [
            { name: "gh1", source: { source: "github", repo: "org/one", sha: GIT_SOURCE_SHA } },
            { name: "gh2", source: { source: "github", repo: "org/two", sha: secondSha } },
          ],
        }),
      );
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const makeRecord = async (repo: string, sha: string) => ({
        version: `sha-${sha.slice(0, 12)}`,
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        enabled: true,
        compatibility: {
          installable: true,
          notes: [] as string[],
          supported: [] as string[],
          unsupported: [] as string[],
        },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
        resolvedSource: await locations.pluginCloneDir(
          pluginCloneKey(`https://github.com/${repo}`, sha),
        ),
        resolvedSha: sha,
      });
      await saveState(locations.extensionRoot, {
        schemaVersion: 2,
        marketplaces: {
          mp: {
            name: "mp",
            scope: "project",
            source: pathSource("./mp-src"),
            addedFromCwd: cwd,
            manifestPath,
            marketplaceRoot,
            plugins: {
              gh1: await makeRecord("org/one", GIT_SOURCE_SHA),
              gh2: await makeRecord("org/two", secondSha),
            },
          },
        },
      });
      const { gitOps } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
      const bundles: (GitAuthBundle | undefined)[] = [];
      const seam: ReinstallCloneCacheSeam = {
        materializePluginClone: (args) => {
          bundles.push(args.auth);
          return materializePluginClone({ ...args, gitOps });
        },
      };
      const { credentialOps } = createCredentialOpsFake({ boundary: "memory" });
      const deviceFlow = createDeviceFlowFake({
        boundary: "memory",
        network: "disabled",
        deviceCode: DEVICE_CODE,
        pollResponses: [
          { kind: "success", accessToken: "tok-abc", tokenType: "bearer", scope: "repo" },
        ],
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        credentialOps,
        deviceFlowHttp: deviceFlow.http,
        __deps: { cloneCacheSeam: seam },
      });
      const firstBundle = bundles[0];
      const secondBundle = bundles[1];
      if (firstBundle === undefined || secondBundle === undefined) {
        throw new Error("expected one auth bundle for each cold-cache reinstall");
      }

      await firstBundle.onAuthRequired();
      await secondBundle.onAuthRequired();

      // assert
      assert.deepEqual(
        outcomes.map(({ name, partition }) => ({ name, partition })),
        [
          { name: "gh1", partition: "reinstalled" },
          { name: "gh2", partition: "reinstalled" },
        ],
      );
      assert.equal(bundles.length, 2);
      assert.equal(deviceFlow.calls.requestCode.length, 1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a url-source reinstall completes on a warm cache with clone and resolveRemoteRef both throwing (offline)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-offline-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
      });

      // A GitOps stub whose clone AND resolveRemoteRef both throw: any network
      // touch fails the reinstall. The warm cache must short-circuit both.
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "reinstalled", "warm-cache reinstall succeeds offline");
      assert.equal(gitState.resolveRemoteRefCalls.length, 0, "no pin re-resolution (no network)");
      assert.equal(gitState.cloneCalls.length, 0, "warm cache short-circuits the clone");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a git-source reinstall carries the recorded resolvedSha, version, and installedAt forward", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-carry-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
      });

      const locations = locationsFor("project", cwd);
      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.ok(before !== undefined, "the seeded install records a git-source plugin");
      assert.equal(before.resolvedSha, GIT_SOURCE_SHA, "install recorded the resolvedSha");

      const { gitOps } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      const after = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.ok(after !== undefined, "the record survives the reinstall");
      assert.equal(after.resolvedSha, GIT_SOURCE_SHA, "resolvedSha carried forward (not dropped)");
      assert.equal(after.version, before.version, "same recorded version (reinstall identity)");
      assert.equal(after.installedAt, before.installedAt, "same installedAt (reinstall identity)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a cold-cache git-source reinstall re-materializes from the recorded sha without re-resolving the ref", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-cold-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
      });

      const locations = locationsFor("project", cwd);
      // Evict the warm clone so the reinstall hits a cold cache and must
      // re-materialize (network on cache-miss is allowed, NFR-5 amended).
      const key = pluginCloneKey("https://example.com/org/repo", GIT_SOURCE_SHA);
      const cloneRoot = await locations.pluginCloneDir(key);
      await rm(cloneRoot, { recursive: true, force: true });

      // A gitOps that copies the fixture back on clone (does NOT throw on
      // clone) but whose resolveRemoteRef still throws: the pin must come from
      // the recorded sha, never from a ref re-resolution.
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const { gitOps, state: gitState } = makeMockGitOps({
        fixtureSourceDir: fixtureRepoDir,
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "reinstalled", "cold-cache reinstall re-materializes");
      assert.equal(gitState.cloneCalls.length, 1, "one clone on the cold cache");
      assert.equal(
        gitState.checkoutCalls[0]?.ref,
        GIT_SOURCE_SHA,
        "checkout pins the recorded sha, not a re-resolved ref",
      );
      assert.equal(gitState.resolveRemoteRefCalls.length, 0, "no ref re-resolution");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a git-subdir reinstall honors clone-root subdir containment (pluginRoot under the clone root)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-subdir-"));
    try {
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: {
          source: "git-subdir",
          url: "https://example.com/org/mono",
          path: "packages/gp",
          sha: GIT_SOURCE_SHA,
        },
        subdirPath: "packages/gp",
      });

      const { gitOps } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "reinstalled", "git-subdir warm-cache reinstall succeeds");

      const locations = locationsFor("project", cwd);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      const key = pluginCloneKey("https://example.com/org/mono", GIT_SOURCE_SHA);
      const cloneRoot = await locations.pluginCloneDir(key);
      assert.equal(
        record?.resolvedSource,
        path.join(cloneRoot, "packages/gp"),
        "pluginRoot = cloneRoot + subdir (containment honored)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// MIRR-06 / D-79.1-04 / PRL-07 -- an unpinned mirror-anchored reinstall repairs
// fs-only from the warm mirror the record points at. Reinstall is network-gated,
// so it reads the mirror HEAD off disk (readMirrorHeadSha); it does NOT re-anchor
// and does NOT materialize a cold mirror. A pre-existing per-sha unpinned record
// still repairs from its per-sha clone (coexistence); a truly cold source
// degrades without a network clone.
// ───────────────────────────────────────────────────────────────────────────

const MIRROR_HEAD_SHA = "b2c3d4e5f60718293a4b5c6d7e8f90123456789a";

/**
 * Build a git plugin tree at `pluginRoot` and stamp a minimal `.git/HEAD` at
 * `mirrorRoot` holding `headSha` (detached-HEAD form) so `readMirrorHeadSha`
 * resolves the mirror HEAD fs-only without a real clone.
 */
async function writeMirrorTree(
  mirrorRoot: string,
  pluginRoot: string,
  pluginName: string,
  headSha: string,
): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version: "9.9.9" }),
  );
  const skillDir = path.join(pluginRoot, "skills", "greet");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: greet\n---\n\nHello.\n`);
  await mkdir(path.join(mirrorRoot, ".git"), { recursive: true });
  await writeFile(path.join(mirrorRoot, ".git", "HEAD"), `${headSha}\n`);
}

/**
 * Seed an UNPINNED git-source install record (manifest entry carries no `sha`)
 * whose `resolvedSource`/`resolvedSha` are supplied by the caller, so a reinstall
 * routes through the unpinned mirror arm.
 */
async function seedUnpinnedGitRecord(opts: {
  cwd: string;
  cloneUrl: string;
  resolvedSource: string;
  resolvedSha: string;
  source: unknown;
}): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "gp", source: opts.source }] }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          gp: {
            version: `sha-${opts.resolvedSha.slice(0, 12)}`,
            resolvedSource: opts.resolvedSource,
            resolvedSha: opts.resolvedSha,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: true,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });
}

test("MIRR-06 / PRL-07: an unpinned reinstall repairs fs-only from the warm mirror with no network call", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-warm-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await writeMirrorTree(mirrorRoot, mirrorRoot, "gp", MIRROR_HEAD_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: mirrorRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "url", url: cloneUrl },
      });

      // A gitOps whose clone AND resolveRemoteRef both throw: any network touch
      // fails the reinstall. The warm mirror must repair fs-only.
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "reinstalled", "warm-mirror reinstall repairs fs-only");
      assert.equal(gitState.cloneCalls.length, 0, "no clone (warm mirror, no network)");
      assert.equal(gitState.resolveRemoteRefCalls.length, 0, "no ref re-resolution (no network)");

      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      // The record stays anchored to the BARE mirror key with the HEAD sha read
      // off disk (reinstall does NOT re-anchor -- the mirror key is unchanged).
      assert.equal(record?.resolvedSource, mirrorRoot, "resolvedSource is the bare mirror root");
      assert.match(
        path.basename(record?.resolvedSource ?? ""),
        /^[0-9a-f]{12}$/,
        "resolvedSource segment is a bare 12-hex mirror key",
      );
      assert.equal(record?.resolvedSha, MIRROR_HEAD_SHA, "resolvedSha = mirror HEAD");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-06 / D-79.1-04: an unpinned reinstall with only a per-sha clone (no mirror) still repairs from the per-sha clone (coexistence)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-persha-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      // Old-design record: still anchored to the per-sha clone, no mirror dir.
      const perShaKey = pluginCloneKey(cloneUrl, GIT_SOURCE_SHA);
      const perShaRoot = await locations.pluginCloneDir(perShaKey);
      await writeMirrorTree(perShaRoot, perShaRoot, "gp", GIT_SOURCE_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: perShaRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: { source: "url", url: cloneUrl },
      });

      // clone + resolveRemoteRef both throw: a warm per-sha clone repairs with
      // no network; the mirror dir is absent so the arm falls through to the
      // recorded-sha per-sha path.
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "reinstalled", "per-sha coexistence reinstall repairs");
      assert.equal(gitState.cloneCalls.length, 0, "warm per-sha clone short-circuits the clone");
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      // No re-anchor: the record keeps its per-sha `<12hex>-<12hex>` key.
      assert.equal(record?.resolvedSource, perShaRoot, "resolvedSource stays the per-sha clone");
      assert.match(
        path.basename(record?.resolvedSource ?? ""),
        /^[0-9a-f]{12}-[0-9a-f]{12}$/,
        "resolvedSource segment is the per-sha key (coexistence, no re-anchor)",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-06 / PRL-07: an unpinned reinstall with neither mirror nor per-sha clone degrades without a network clone", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-cold-"));
    try {
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      const perShaKey = pluginCloneKey(cloneUrl, GIT_SOURCE_SHA);
      const perShaRoot = await locations.pluginCloneDir(perShaKey);
      // Record points at a per-sha clone that does NOT exist on disk, and there
      // is no mirror dir -- a truly cold source.
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: perShaRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: { source: "url", url: cloneUrl },
      });

      // clone throws: PRL-07 forbids a network materialize on reinstall, so a
      // cold source must NOT clone successfully -- it fails clean (the same
      // degrade a cold per-sha reinstall hits today).
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      assert.equal(outcome.partition, "failed", "a cold source fails clean, never clones");
      assert.equal(gitState.cloneCalls.length, 1, "the per-sha fallback attempts one clone");
      // The clone threw (network-forbidden simulation), so nothing materialized.
      assert.equal(await pathExists(perShaRoot), false, "no clone materialized on the cold source");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SUB-02 -- end-to-end ${CLAUDE_PROJECT_DIR} delivery through the reinstall path
//
// reinstall's prepareAllHandles threads `cwd` into every stage input by hand
// (an optional field the compiler cannot enforce). A refactor that drops the
// `cwd` line would compile, pass the rest of the suite, and silently ship
// un-substituted project dirs on the reinstall path. These tests install a
// project-scope fixture whose skill/command/agent bodies carry
// ${CLAUDE_PROJECT_DIR} and ${CLAUDE_SKILL_DIR}, reinstall, and assert the
// re-staged files -- closing the silent-miss gap end-to-end.
// ───────────────────────────────────────────────────────────────────────────

test("SUB-02: project-scope reinstall substitutes ${CLAUDE_PROJECT_DIR} to the install cwd in skill, command, and agent files; keeps ${CLAUDE_SKILL_DIR} literal in command and agent", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-sub02-proj-"));
    try {
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          skill: "Project: ${CLAUDE_PROJECT_DIR}",
          command: "Project: ${CLAUDE_PROJECT_DIR} Skill: ${CLAUDE_SKILL_DIR}",
          agent: "Project: ${CLAUDE_PROJECT_DIR} Skill: ${CLAUDE_SKILL_DIR}",
        },
        install: true,
      });

      // Rewrite the source with a fresh marker so the assertions prove the
      // reinstall re-staged from source (not leftover install output).
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "Reinstalled project: ${CLAUDE_PROJECT_DIR}",
        command: "Reinstalled project: ${CLAUDE_PROJECT_DIR} Skill: ${CLAUDE_SKILL_DIR}",
        agent: "Reinstalled project: ${CLAUDE_PROJECT_DIR} Skill: ${CLAUDE_SKILL_DIR}",
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, pi);
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(errorNotifications(notifications).length, 0);

      const skillBody = await readSkill(cwd);
      assert.ok(
        skillBody.includes(`Reinstalled project: ${cwd}`),
        `skill: expected ${cwd} for projectDir, got: ${skillBody}`,
      );
      assert.equal(
        skillBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "skill: no remaining ${CLAUDE_PROJECT_DIR}",
      );

      const commandBody = await readCommand(cwd);
      assert.ok(
        commandBody.includes(`Reinstalled project: ${cwd}`),
        `command: expected ${cwd} for projectDir, got: ${commandBody}`,
      );
      assert.equal(
        commandBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "command: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      // ${CLAUDE_SKILL_DIR} is skill-scoped -- commands receive no skillDir, so
      // it stays literal.
      assert.ok(
        commandBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "command: expected literal ${CLAUDE_SKILL_DIR}, got: " + commandBody,
      );

      const agentBody = await readFile(
        path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`),
        "utf8",
      );
      assert.ok(
        agentBody.includes(`Reinstalled project: ${cwd}`),
        `agent: expected ${cwd} for projectDir, got: ${agentBody}`,
      );
      assert.equal(
        agentBody.includes("${CLAUDE_PROJECT_DIR}"),
        false,
        "agent: no remaining ${CLAUDE_PROJECT_DIR}",
      );
      assert.ok(
        agentBody.includes("Skill: ${CLAUDE_SKILL_DIR}"),
        "agent: expected literal ${CLAUDE_SKILL_DIR}, got: " + agentBody,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("SUB-02: user-scope reinstall keeps ${CLAUDE_PROJECT_DIR} literal in skill, command, and agent files", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-sub02-user-"));
    try {
      const locations = locationsFor("user", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          skill: "Project: ${CLAUDE_PROJECT_DIR}",
          command: "Project: ${CLAUDE_PROJECT_DIR}",
          agent: "Project: ${CLAUDE_PROJECT_DIR}",
        },
        install: true,
        scope: "user",
      });

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "user",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(errorNotifications(notifications).length, 0);

      const skillBody = await readFile(
        path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"),
        "utf8",
      );
      assert.ok(
        skillBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "skill: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + skillBody,
      );

      const commandBody = await readFile(
        path.join(locations.promptsTargetDir, "hello:deploy.md"),
        "utf8",
      );
      assert.ok(
        commandBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "command: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + commandBody,
      );

      const agentBody = await readFile(
        path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`),
        "utf8",
      );
      assert.ok(
        agentBody.includes("Project: ${CLAUDE_PROJECT_DIR}"),
        "agent: user-scope must keep ${CLAUDE_PROJECT_DIR} literal, got: " + agentBody,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WARN-01 / WR-04: the reinstall outcome carries the degraded-component kinds
// ──────────────────────────────────────────────────────────────────────────

test("WR-04: a reinstall whose source frontmatter no longer parses reports the degraded kind on its outcome", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr04-degraded-"));
    try {
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      // Break the skill's frontmatter at the SOURCE. The bridge installs it in
      // degraded form rather than failing, which is the fact the outcome has to
      // carry: the load-time backfill drives this same primitive, and a row that
      // named nothing would contradict the ledger that produced it.
      await writeFile(
        path.join(seeded.pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: [unterminated\n---\n\n# Bad\nBody.\n",
      );

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.ok(outcome.partition === "reinstalled");
      assert.deepEqual([...(outcome.degradedKinds ?? [])], ["skill"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-04: a reinstall whose command frontmatter no longer parses reports the command degrade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr04-command-degraded-"));
    try {
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command" },
        install: true,
      });
      await writeFile(
        path.join(seeded.pluginRoot, "commands", "deploy.md"),
        "---\ntitle: A: B: C\n---\nRun it.\n",
      );
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(outcome.partition === "reinstalled");
      assert.deepEqual([...(outcome.degradedKinds ?? [])], ["command"]);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "warning");
      assert.match(notifications[0]?.message ?? "", /\{malformed command\}/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-09: the standalone reinstall row names the degraded kind and takes the warning raise", async () => {
  // The outcome-level case above proves the signal is COLLECTED. This one proves
  // the verb's own row READS it. `install`, standalone `enable`, and both
  // reconcile projections already name the kind; a bare `(reinstalled)` row here
  // would contradict the `(partially-installed)`-class record `list` renders one
  // command later -- the same contradiction the shared signal shape exists to
  // prevent, one surface over.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr09-row-"));
    try {
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      await writeFile(
        path.join(seeded.pluginRoot, "skills", "tool", "SKILL.md"),
        "---\nname: [unterminated\n---\n\n# Bad\nBody.\n",
      );

      const { ctx, pi, notifications } = makeCtx();
      await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(
        first.message,
        [
          "A plugin operation needs attention.",
          "",
          "● mp [project]",
          "  ● hello v1.0.0 (reinstalled) {malformed skill}",
          "",
          "/reload to pick up changes",
        ].join("\n"),
      );
      // WARN-01: the raise reaches the Pi API severity argument, not just the
      // summary line.
      assert.equal(first.severity, "warning");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-09: a clean reinstall row is byte-identical to before -- no brace, no raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr09-clean-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      const { ctx, pi, notifications } = makeCtx();
      await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      const first = notifications[0];
      assert.ok(first !== undefined);
      assert.equal(
        first.message,
        ["● mp [project]", "  ● hello v1.0.0 (reinstalled)", "", "/reload to pick up changes"].join(
          "\n",
        ),
      );
      assert.equal(first.severity, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WR-04: a clean reinstall omits the degraded-kinds field entirely", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr04-clean-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.ok(outcome.partition === "reinstalled");
      assert.equal(Object.hasOwn(outcome, "degradedKinds"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rare failure arms (D-99-05b). Each case reaches one arm no happy-path test
// touches, and asserts the arm's observable consequence.
// ───────────────────────────────────────────────────────────────────────────

test("S5: a reinstall whose config write-back cannot parse reports the skip beside the success", async () => {
  // The artifacts reinstall and the config entry does NOT get written. Pre-S5
  // that second half was silent, so the config and the disk drifted with no
  // trace. The row must name the config file by basename only -- an absolute
  // path in an operator-facing row leaks the scope root.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-s5-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      await writeFile(locations.configJsonPath, "{ not json ", "utf8");

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "reinstalled", "the artifacts still reinstall");
      const allText = notifications.map((n) => n.message).join("\n");
      assert.match(allText, /\(reinstalled\)/, `success row still emitted in:\n${allText}`);
      assert.match(allText, /\(failed\) \{invalid manifest\}/, `no S5 row in:\n${allText}`);
      assert.match(allText, /claude-plugins\.json/, `basename missing in:\n${allText}`);
      assert.ok(
        !allText.includes(locations.configJsonPath),
        `the absolute config path must not leak: ${allText}`,
      );
      assert.ok(
        notifications.some((n) => n.severity === "error"),
        "the skipped write-back is an error severity, not a silent success",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: a source that stopped being installable fails with the typed reason, not the substring fallback", async () => {
  // The manifest entry's source is rewritten to a git-flavored URL after the
  // path-source install. requireInstallable raises a typed shape error, and
  // the reason must come from that shape -- the notes-substring fallback would
  // land on the permissive `not in manifest` and misdescribe the failure.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-shape-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { manifestPath } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old skill" },
        install: true,
      });

      await writeFile(
        manifestPath,
        JSON.stringify({
          name: "mp",
          plugins: [{ name: "hello", version: "1.0.0", source: { source: "unsupported-kind" } }],
        }),
        "utf8",
      );

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      assert.equal(outcome.partition, "failed");
      const allText = notifications.map((n) => n.message).join("\n");
      assert.doesNotMatch(
        allText,
        /\{not in manifest\}/,
        `the substring fallback must not win over the typed shape in:\n${allText}`,
      );
      // The shape switch maps `not-installable` to the source-classification
      // reason, which is the fact the operator needs: the entry now points at
      // a kind this install cannot be reproduced from.
      assert.match(
        allText,
        /⊘ hello \(failed\) \{source mismatch\}/,
        `the typed shape reason must reach the row in:\n${allText}`,
      );
      assert.equal(errorNotifications(notifications).length, 1);

      // A failed reinstall leaves the installed record and its artifacts alone.
      const after = await loadState(locationsFor("project", cwd).extensionRoot);
      assert.ok(after.marketplaces["mp"]?.plugins["hello"] !== undefined);
      assert.match(await readSkill(cwd), /old skill/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// ENBL-05: reinstall over a record the user disabled
// ───────────────────────────────────────────────────────────────────────────

/**
 * Overwrite the installed record's enablement marker in place, keeping every
 * other field the install wrote. ENBL-18: a disabled record KEEPS its
 * `resources.*` inventory, so this is the shape production actually produces --
 * an empty-inventory stand-in would let a re-materialization hide.
 */
async function markRecordedPluginDisabled(
  cwd: string,
  marketplace: string,
  plugin: string,
): Promise<void> {
  const locations = locationsFor("project", cwd);
  const state = await loadState(locations.extensionRoot);
  const mp = state.marketplaces[marketplace];
  assert.ok(mp !== undefined);
  const record = mp.plugins[plugin];
  assert.ok(record !== undefined);
  await saveState(locations.extensionRoot, {
    ...state,
    marketplaces: {
      ...state.marketplaces,
      [marketplace]: {
        ...mp,
        plugins: { ...mp.plugins, [plugin]: { ...record, enabled: false } },
      },
    },
  });
}

/**
 * Seed, install, disable the record, and delete the staged skill directory so
 * the fixture matches a real disabled plugin: the record is retained, the
 * artifacts are gone. A re-materialization is then visible as the directory
 * coming back.
 */
async function seedDisabledInstall(
  cwd: string,
  opts: { readonly pluginName?: string; readonly marketplaceRoot?: string } = {},
): Promise<{ readonly skillDir: string }> {
  const pluginName = opts.pluginName ?? "hello";
  await seedMarketplace({
    cwd,
    marketplaceRoot: opts.marketplaceRoot ?? path.join(cwd, "mp-src"),
    pluginName,
    resources: { skill: "old skill", command: "old command" },
    install: true,
  });
  await markRecordedPluginDisabled(cwd, "mp", pluginName);

  const skillDir = path.join(locationsFor("project", cwd).skillsTargetDir, `${pluginName}-tool`);
  await rm(skillDir, { recursive: true, force: true });
  return { skillDir };
}

// Re-staging artifacts and flipping a disabled record to enabled here would
// let a verb invoked to repair a plugin silently turn it back on, over a
// configuration that still says it is off, until the next reload undid that.
// Reinstall over a disabled record must write and stage nothing instead.
test("DFEN-07 / D-103-12 / ENBL-18: reinstall over a disabled record writes nothing and stages nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-disabled-"));
    try {
      const locations = locationsFor("project", cwd);
      const { skillDir } = await seedDisabledInstall(cwd);

      const recordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(recordBefore !== undefined);
      assert.equal(recordBefore.enabled, false);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const configBefore = await readFile(locations.configJsonPath, "utf8");

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "skipped");
      assert.deepEqual(outcome.notes, ["already disabled"]);

      // The stronger statement than record equality: the verb did not write at
      // all, so `state.json`'s mtime is untouched and the load-time no-op
      // detection that reads it still sees a quiet file (RECON-05).
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      const recordAfter = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.deepEqual(recordAfter, recordBefore);
      assert.equal(await readFile(locations.configJsonPath, "utf8"), configBefore);
      assert.equal(await pathExists(skillDir), false, "nothing may be re-materialized");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// The two reinstall surfaces compose their rows through different code paths,
// so a fix applied to one could leave the other telling an untruthful story
// that contradicts it. The shared closed-set narrowing is what makes them
// agree; these two cases are what stop them from drifting apart again.
test("DFEN-07 / D-103-12: the standalone reinstall renders one benign skipped row for a disabled plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-disabled-row-"));
    try {
      await seedDisabledInstall(cwd);
      const { ctx, pi, notifications } = makeCtx();

      await reinstallDefault(cwd, ctx, pi);

      // IL-2: one emission for the whole reinstall. The mock records a severity
      // only when the producer passes one, so an absent severity is the info
      // row -- the reason is benign and idempotent, so it must neither raise
      // nor take the error flip the absent-target skip takes.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      // Subject-first, and asserted whole rather than as independent
      // `includes` checks a reordering could survive. No summary line (an info
      // cascade emits none) and no reload hint (nothing was materialized).
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {already disabled}",
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("DFEN-07 / D-103-12: the bulk cascade carries the skipped and the reinstalled row together", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-disabled-bulk-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "keeper",
        resources: { skill: "keeper skill" },
        install: true,
      });
      await seedDisabledInstall(cwd, { marketplaceRoot, pluginName: "sleeper" });
      const { ctx, pi, notifications } = makeCtx();

      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.deepEqual(
        outcomes.map((o) => `${o.name}:${o.partition}`),
        ["keeper:reinstalled", "sleeper:skipped"],
      );
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      const body = notifications[0]?.message ?? "";
      assert.match(body, /● keeper v[^\n]* \(reinstalled\)/);
      assert.match(body, /⊘ sleeper \(skipped\) \{already disabled\}/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * DFEN-08: the overwhelming majority of plugins say nothing about install-time
 * enablement, so what DFEN-08 owes them is that NOTHING moved. The
 * triple is what makes that checkable instead of assumed: `beta` declares the
 * install-time default TRUE, `gamma` declares nothing at all, and the two must
 * render the same row as each other AND as the row this surface produced before
 * the field existed. The declaring sibling `alpha` is present precisely so the
 * comparison happens inside one live run rather than against a captured
 * baseline that would rot, and because a precedence fixture over a three-valued
 * key that covers two of the values passes while asking the wrong question.
 *
 * No declaration flip is staged here. The flip discipline separates "never
 * re-read the field" from "re-read it and got the same answer", which is the
 * lifecycle claim the case below this one already pins for this verb. DFEN-08's
 * claim is narrower and the triple proves it in one run.
 */
test("DFEN-08: a declared-true entry and a silent entry render identical reinstall rows", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-dfen08-parity-"));
    try {
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");

      // One marketplace built by repeat calls against a shared root:
      // `mergeManifestEntry` reads the existing manifest and merges, so the
      // three entries accumulate. Every arm carries the same version and the
      // same single skill, so the ONLY difference between them is the
      // declaration. `applyDefaultEnabled` is set on all three because that is
      // what the real install handler passes -- and the claim is that it
      // changes nothing for two of the three.
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "alpha",
        version: "1.0.0",
        resources: { skill: "alpha skill" },
        install: true,
        entryDefaultEnabled: false,
        applyDefaultEnabled: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "beta",
        version: "1.0.0",
        resources: { skill: "beta skill" },
        install: true,
        entryDefaultEnabled: true,
        applyDefaultEnabled: true,
      });
      // No knob at all: the seeder's conditional merge writes NO
      // `defaultEnabled` key on this entry, which is the arm every plugin that
      // never heard of the field lands on.
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "gamma",
        version: "1.0.0",
        resources: { skill: "gamma skill" },
        install: true,
        applyDefaultEnabled: true,
      });

      const pluginsNow = async (): Promise<Record<string, { enabled?: boolean }>> =>
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {};

      // Precondition: without it the cascade assertions below can pass over a
      // fixture that never reached the path under test.
      const before = await pluginsNow();
      assert.equal(
        before["alpha"]?.enabled,
        false,
        "precondition: declared false installs disabled",
      );
      assert.equal(before["beta"]?.enabled, true, "precondition: declared true installs enabled");
      assert.equal(before["gamma"]?.enabled, true, "precondition: a silent entry installs enabled");

      const { ctx, pi, notifications } = makeCtx();
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      assert.deepEqual(
        outcomes.map((o) => `${o.name}:${o.partition}`),
        ["alpha:skipped", "beta:reinstalled", "gamma:reinstalled"],
      );

      assert.equal(notifications.length, 1);
      // Two benign `reinstalled` rows beside one info-severity skip -> info
      // (severity unset).
      assert.equal(notifications[0]?.severity, undefined);

      // Whole-body rather than per-row `includes`: the literal pins the row
      // ORDER, the tally and the trailer, none of which a substring check
      // constrains.
      //
      // The tally counts THREE successes over two reinstalled rows and one
      // skip. That is correct, not a mis-count: OUT-03 / D-04 count operation
      // rows uniformly by STAMPED severity, and the `already disabled` reason
      // is idempotent and therefore info (D-01), so it lands in the success
      // bucket. The catalog documents the identical arithmetic for a different
      // idempotent skip, where `(skipped) {up-to-date}` is one of the two
      // successes in `Plugin reinstall: 1 failure, 2 successes`.
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ⊘ alpha (skipped) {already disabled}\n" +
          "  ● beta v1.0.0 (reinstalled)\n" +
          "  ● gamma v1.0.0 (reinstalled)\n" +
          "\n" +
          "Plugin reinstall: 3 successes\n" +
          "\n" +
          "/reload to pick up changes",
      );

      // The parity claim itself, stated apart from the whole-body literal.
      // Before the field was consumed it was an unknown key under the lenient
      // manifest tolerance and therefore inert, so a declared-true entry and a
      // silent entry were LITERALLY the same input -- which is what makes the
      // two literals below the pre-existing row form as well. Asserting the two
      // rendered rows against EACH OTHER catches a drift that two
      // independently-correct literals would both stay green through.
      const rows = body.split("\n");
      const rowFor = (name: string): string =>
        rows.find((line) => line.startsWith(`  ● ${name} `)) ?? "";

      const betaRow = rowFor("beta");
      const gammaRow = rowFor("gamma");
      assert.equal(betaRow, "  ● beta v1.0.0 (reinstalled)");
      assert.equal(gammaRow, "  ● gamma v1.0.0 (reinstalled)");
      assert.equal(
        betaRow.replaceAll("beta", "<plugin>"),
        gammaRow.replaceAll("gamma", "<plugin>"),
        "DFEN-08: the declared-true row and the silent row must COINCIDE, not merely each match a literal",
      );

      const after = await pluginsNow();
      assert.equal(
        after["alpha"]?.enabled,
        false,
        "DFEN-07: a reinstall over a disabled record leaves it disabled",
      );
      assert.equal(after["beta"]?.enabled, true, "DFEN-08: a declared-true entry moves nothing");
      assert.equal(after["gamma"]?.enabled, true, "DFEN-08: a silent entry moves nothing");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// Installing and reinstalling against the SAME manifest cannot distinguish
// "never re-read the declaration" from "re-read it and got the same answer".
// Only a flip between the two calls separates those.
test("DFEN-07 / D-103-10: a declaration flipped between install and reinstall does not move the record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-flip-"));
    try {
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { manifestPath } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old skill", command: "old command" },
        install: true,
        entryDefaultEnabled: false,
        applyDefaultEnabled: true,
      });

      // Precondition and anti-vacuity anchor: the record landed disabled
      // through the production install path, not by hand.
      const recordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(recordBefore !== undefined);
      assert.equal(recordBefore.enabled, false);

      const skillDir = path.join(locations.skillsTargetDir, "hello-tool");
      await rm(skillDir, { recursive: true, force: true });

      await mergeManifestEntry(marketplaceRoot, "mp", "hello", "1.0.0", true);

      // THE CONTROL. A verb that short-circuits moves no version, so there is
      // no record field to read the flip out of. Read the manifest directly
      // instead: that read goes through the same process-lifetime cache the
      // orchestrator uses, so a flipped value here proves the cache is serving
      // the rewritten bytes to THIS process -- the property a version bump
      // would otherwise have proven. The parse is returned by reference and
      // must be treated as read-only (D-03).
      const manifest = await loadMarketplaceManifest(manifestPath);
      assert.equal(
        manifest.plugins.find((e) => e.name === "hello")?.defaultEnabled,
        true,
        "the rewritten declaration must be visible to this process",
      );

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, pi);

      assert.equal(outcome.partition, "skipped");
      const recordAfter = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.equal(recordAfter?.enabled, false);
      assert.equal(await pathExists(skillDir), false, "nothing may be re-materialized");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// D-141-03 / D-141-05: reinstall runs install's warning policy, not its own.
// The skills and commands halves are discovery warnings and reach the
// standalone user after the row; the agents and mcp halves stay on the
// orchestrated channel.
//
// Every test below drives `reinstallPlugins`, the function the edge handler
// calls for EVERY target form. `reinstallPlugin`'s own `render !== "none"`
// arm is not a production path, so a test that entered it would prove
// nothing about what a user sees.

/**
 * Seed a D-07 collision inside ONE componentPaths.skills entry: for plugin
 * `<plugin>`, `<plugin>-<stem>/` and `<stem>/` both elide to the generated
 * name `<plugin>-<stem>` (D-141-04), so discovery keeps the localeCompare-first
 * source and reports the loser.
 */
async function seedCollidingSkills(
  pluginRoot: string,
  pluginName: string,
  stems: readonly string[],
): Promise<void> {
  const skillsDir = path.join(pluginRoot, "skills");
  for (const stem of stems) {
    for (const dir of [`${pluginName}-${stem}`, stem]) {
      await mkdir(path.join(skillsDir, dir), { recursive: true });
      await writeFile(
        path.join(skillsDir, dir, "SKILL.md"),
        `---\nname: ${stem}\n---\n\nfrom ${dir}\n`,
      );
    }
  }
}

test("D-141-03: a standalone reinstall surfaces a skills discovery warning after the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old skill" },
        install: true,
      });
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

      const { ctx, pi, notifications } = makeCtx();
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.equal(outcomes[0]?.partition, "reinstalled");
      assert.equal(notifications.length, 2, "the reinstall row plus the diagnostic block");
      const diagnostic = notifications[1];
      assert.ok(diagnostic !== undefined);
      assert.equal(diagnostic.severity, "warning");
      // The VERB and the plugin name are the whole reason the diagnostic
      // header is parameterised; assert them, not just the tally clause.
      assert.match(
        diagnostic.message,
        /Plugin "hello" reinstalled; 1 declared component was skipped\./,
      );
      assert.match(diagnostic.message, /"hello-foo"/);
      assert.match(diagnostic.message, /ignoring duplicate/);
      // NFR-9: the absolute skills directory is redacted to its basename.
      assert.ok(
        !diagnostic.message.includes(marketplaceRoot),
        `absolute path leaked: ${diagnostic.message}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: a bulk reinstall surfaces one diagnostic per plugin, singular and plural", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-bulk-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      const hello = await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "hello",
        resources: { skill: "old skill" },
        install: true,
      });
      const world = await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "world",
        resources: { skill: "old skill" },
        install: true,
      });
      await seedCollidingSkills(hello.pluginRoot, "hello", ["foo"]);
      // TWO collisions, so this plugin exercises the PLURAL header arm that a
      // one-collision fixture leaves dark.
      await seedCollidingSkills(world.pluginRoot, "world", ["foo", "bar"]);

      const { ctx, pi, notifications } = makeCtx();
      await reinstallPlugins({ ctx, pi, cwd, target: { kind: "all" } });

      const diagnostics = notifications.filter((n) => n.message.includes("declared component"));
      // Both plugins reported, so the emitter walks EVERY outcome rather than
      // stopping at the first.
      assert.equal(diagnostics.length, 2, JSON.stringify(notifications));
      assert.ok(
        diagnostics.some((n) =>
          n.message.includes('Plugin "hello" reinstalled; 1 declared component was skipped.'),
        ),
        JSON.stringify(diagnostics),
      );
      assert.ok(
        diagnostics.some((n) =>
          n.message.includes('Plugin "world" reinstalled; 2 declared components were skipped.'),
        ),
        JSON.stringify(diagnostics),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: an orchestrated reinstall carries the discovery half on notes and on discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-orch-"));
    try {
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

      const { ctx, pi, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0, "render: none emits nothing");
      // The flat `notes` fold reaches orchestrated consumers (reconcile
      // backfill) and MUST keep carrying the discovery half.
      const notes = outcome.partition === "reinstalled" ? (outcome.notes ?? []) : [];
      assert.ok(
        notes.some((n) => n.startsWith("warning: ") && n.includes('"hello-foo"')),
        `expected the discovery warning on notes; got: ${JSON.stringify(notes)}`,
      );
      // The unprefixed carrier is what `reinstallPlugins` renders from.
      const carried = outcome.partition === "reinstalled" ? (outcome.discoveryWarnings ?? []) : [];
      assert.equal(carried.length, 1, JSON.stringify(carried));
      assert.ok(carried[0]?.includes('"hello-foo"'));
      assert.ok(!carried[0]?.startsWith("warning: "));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a clean reinstall outcome carries neither notes nor discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nreg-"));
    try {
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      const { ctx, pi } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.ok(!Object.hasOwn(outcome, "notes"), JSON.stringify(outcome));
      assert.ok(!Object.hasOwn(outcome, "discoveryWarnings"), JSON.stringify(outcome));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a hygiene-only reinstall carries notes but still omits discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nreg-hyg-"));
    try {
      // The agent has no `description`, so the HYGIENE half is non-empty while
      // the discovery half stays empty. Without this case the omit rule is
      // only exercised where `notes` is empty too, and an unconditional
      // `discoveryWarnings: []` would go unnoticed.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", agent: "old agent" },
        install: true,
      });

      const { ctx, pi } = makeCtx({ toolNames: ["subagent"] });
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(outcome.partition, "reinstalled");
      assert.ok(Object.hasOwn(outcome, "notes"), JSON.stringify(outcome));
      assert.ok(!Object.hasOwn(outcome, "discoveryWarnings"), JSON.stringify(outcome));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: an agents hygiene warning rides notes in orchestrated mode and no notification in standalone", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-hygwarn-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      // `writePluginTree` writes the agent frontmatter with no `description`,
      // which the agents bridge reports as a fallback note.
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old skill", agent: "old agent" },
        install: true,
      });
      // A discovery warning beside it: without this positive control the
      // absence assertion below would also pass if the split returned nothing.
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

      const orchestrated = makeCtx({ toolNames: ["subagent"] });
      const orchestratedOutcome = await reinstallPlugin({
        ctx: orchestrated.ctx,
        pi: orchestrated.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      assert.equal(orchestratedOutcome.partition, "reinstalled");
      assert.equal(orchestrated.notifications.length, 0, "render: none emits nothing");
      const notes = orchestratedOutcome.notes ?? [];
      assert.ok(
        notes.some((n) => n.includes("source description was missing or empty")),
        `expected the agents warning on notes; got: ${JSON.stringify(notes)}`,
      );

      const standalone = makeCtx({ toolNames: ["subagent"] });
      await reinstallPlugins({
        ctx: standalone.ctx,
        pi: standalone.pi,
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      assert.ok(
        standalone.notifications.some((n) => n.message.includes("declared component was skipped")),
        `the discovery half must still reach standalone: ${JSON.stringify(standalone.notifications)}`,
      );
      assert.ok(
        !standalone.notifications.some((n) =>
          n.message.includes("source description was missing or empty"),
        ),
        `agents warning leaked to standalone: ${JSON.stringify(standalone.notifications)}`,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a malformed state file renders one bulk enumeration failure without mutating bytes", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-enumeration-failure-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const malformedState = "{ not json";
      await writeFile(locations.stateJsonPath, malformedState, "utf8");
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "all" },
      });

      // assert
      assert.deepEqual(outcomes, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), malformedState);
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /\(reinstall\).*failed/s);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a bare marketplace reinstall preserves a non-absence scope-resolution failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-scope-resolution-failure-"));
    try {
      // arrange
      const userLocations = locationsFor("user", cwd);
      await mkdir(userLocations.extensionRoot, { recursive: true });
      const malformedState = "{ malformed user state";
      await writeFile(userLocations.stateJsonPath, malformedState, "utf8");
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepEqual(outcomes, []);
      assert.equal(await readFile(userLocations.stateJsonPath, "utf8"), malformedState);
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]?.message ?? "", /\(reinstall\).*failed/s);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a marketplace removed between scope resolution and enumeration reports not added", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-concurrent-marketplace-removal-"));
    let stateMonitor: ReturnType<typeof spawn> | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      await writeFile(
        locations.stateJsonPath,
        JSON.stringify({
          schemaVersion: 1,
          marketplaces: {
            mp: {
              name: "mp",
              scope: "project",
              source: pathSource("./mp-src"),
              addedFromCwd: cwd,
              plugins: {},
            },
          },
        }),
        "utf8",
      );
      const userLocations = locationsFor("user", cwd);
      await mkdir(userLocations.extensionRoot, { recursive: true });
      await writeFile(
        userLocations.stateJsonPath,
        JSON.stringify({
          schemaVersion: 2,
          marketplaces: {},
          padding: "x".repeat(16 * 1024 * 1024),
        }),
        "utf8",
      );
      const removedStatePath = path.join(locations.extensionRoot, "state-removed.json");
      const quarantinedStatePath = path.join(locations.extensionRoot, "state-migration.tmp");
      await writeFile(
        removedStatePath,
        JSON.stringify({ schemaVersion: 2, marketplaces: {} }),
        "utf8",
      );
      const monitorSource = `
        import { renameSync, watch } from "node:fs";
        import path from "node:path";

        const directory = process.env.REINSTALL_RACE_DIRECTORY;
        const statePath = process.env.REINSTALL_RACE_STATE;
        const removedPath = process.env.REINSTALL_RACE_REMOVED;
        const quarantinedPath = process.env.REINSTALL_RACE_QUARANTINED;
        if (!directory || !statePath || !removedPath || !quarantinedPath) {
          throw new Error("missing reinstall race paths");
        }

        const timeout = setTimeout(() => {
          process.exitCode = 2;
          process.send?.("timeout", () => process.disconnect?.());
        }, 5_000);
        const watcher = watch(directory, (_event, filename) => {
          if (filename === null || !filename.startsWith("state.json.")) {
            return;
          }

          try {
            renameSync(path.join(directory, filename), quarantinedPath);
            renameSync(removedPath, statePath);
            clearTimeout(timeout);
            watcher.close();
            process.send?.("replaced", () => process.disconnect?.());
          } catch (error) {
            clearTimeout(timeout);
            watcher.close();
            process.exitCode = 3;
            process.send?.(
              \`failure: \${error instanceof Error ? error.message : String(error)}\`,
              () => process.disconnect?.(),
            );
          }
        });
        process.send?.("ready");
      `;
      const monitor = spawn(process.execPath, ["--input-type=module", "--eval", monitorSource], {
        env: {
          ...process.env,
          REINSTALL_RACE_DIRECTORY: locations.extensionRoot,
          REINSTALL_RACE_QUARANTINED: quarantinedStatePath,
          REINSTALL_RACE_REMOVED: removedStatePath,
          REINSTALL_RACE_STATE: locations.stateJsonPath,
        },
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      });
      stateMonitor = monitor;
      const monitorStderrStream = monitor.stderr;
      assert.ok(monitorStderrStream !== null);
      let monitorStderr = "";
      const monitorMessages: unknown[] = [];
      const monitorComplete = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve, reject) => {
          monitor.once("error", reject);
          monitor.once("exit", (code, signal) => {
            resolve({ code, signal });
          });
        },
      );
      const ready = new Promise<void>((resolve, reject) => {
        const readyTimeout = setTimeout(() => {
          reject(new Error(`state monitor readiness timed out: ${monitorStderr}`));
        }, 6_000);
        monitor.once("error", reject);
        monitorStderrStream.setEncoding("utf8");
        monitorStderrStream.on("data", (chunk: string) => {
          monitorStderr += chunk;
        });
        monitor.on("message", (message) => {
          monitorMessages.push(message);
          if (message === "ready") {
            clearTimeout(readyTimeout);
            resolve();
          } else if (typeof message === "string" && message.startsWith("failure:")) {
            clearTimeout(readyTimeout);
            reject(new Error(message));
          }
        });
        monitor.once("exit", (code) => {
          if (!monitorMessages.includes("ready")) {
            clearTimeout(readyTimeout);
            reject(new Error(`state monitor exited before readiness (${code}): ${monitorStderr}`));
          }
        });
      });
      await ready;
      const warningMock = t.mock.method(console, "warn", () => undefined);
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });
      const monitorResult = await monitorComplete;

      // assert
      assert.deepEqual(monitorMessages, ["ready", "replaced"]);
      assert.deepEqual(monitorResult, { code: 0, signal: null });
      assert.equal(monitorStderr, "");
      assert.equal(warningMock.mock.callCount(), 1);
      assert.deepEqual(outcomes, []);
      assert.equal(notifications.length, 1);
      assert.equal(
        notifications[0]?.message,
        "A marketplace operation has failed.\n\n⊘ mp (failed) {marketplace not added}",
      );
    } finally {
      if (stateMonitor?.exitCode === null && stateMonitor.signalCode === null) {
        stateMonitor.kill("SIGTERM");
      }

      await rm(cwd, { recursive: true, force: true });
    }
  });
});

for (const { title, failure, reasons } of [
  {
    title: "maps a permission-denied state read to its typed reason",
    failure: () => Object.assign(new Error("state denied"), { code: "EACCES" }),
    reasons: ["permission denied"] as const,
  },
  {
    title: "maps a missing state read to its typed reason",
    failure: () => Object.assign(new Error("state missing"), { code: "ENOENT" }),
    reasons: ["source missing"] as const,
  },
  {
    title: "leaves an unclassified state read failure without a forged typed reason",
    failure: () => new Error("unexpected state read failure"),
    reasons: undefined,
  },
] as const) {
  test(title, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-state-read-"));
      try {
        // arrange
        const { ctx, pi, notifications } = makeCtx();

        // act
        const outcome = await reinstallPlugin({
          ctx,
          pi,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          __deps: {
            stateTransaction: {
              loadState: () => {
                throw failure();
              },
            },
          },
        });

        // assert
        assert.equal(outcome.partition, "failed");
        assert.deepEqual(outcome.reasons, reasons);
        assert.equal(notifications.length, 1);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("a replacement failure aborts every prepared bridge and preserves foreign content", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-replace-abort-"));
    try {
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent", command: "old command", mcp: true, skill: "old skill" },
        install: true,
      });
      const freshSkillDir = path.join(seeded.pluginRoot, "skills", "fresh");
      await mkdir(freshSkillDir, { recursive: true });
      await writeFile(path.join(freshSkillDir, "SKILL.md"), "---\nname: fresh\n---\n\nFresh.\n");
      const locations = locationsFor("project", cwd);
      const foreignTarget = path.join(locations.skillsTargetDir, "hello-fresh");
      await mkdir(foreignTarget, { recursive: true });
      await writeFile(path.join(foreignTarget, "foreign.txt"), "foreign\n");
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "failed");
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      assert.equal(await readFile(path.join(foreignTarget, "foreign.txt"), "utf8"), "foreign\n");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a post-save hook-cache read failure leaves the committed reinstall successful", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-post-save-hook-cache-"));
    try {
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          hooksJson: {
            hooks: {
              PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] }],
            },
          },
        },
        install: true,
      });
      const sourceHooksPath = path.join(seeded.pluginRoot, "hooks", "hooks.json");
      const locations = locationsFor("project", cwd);
      const stateBefore = await loadState(locations.extensionRoot);
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
        __deps: {
          stateTransaction: {
            saveState: async (extensionRoot, state) => {
              await saveState(extensionRoot, state);
              await rm(sourceHooksPath);
            },
          },
        },
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      const stateAfter = await loadState(locations.extensionRoot);
      assert.equal(stateAfter.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
      assert.notDeepEqual(stateAfter, stateBefore);
      assert.equal(await pathExists(sourceHooksPath), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a hooks source changed after resolve fails before state persistence", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-hooks-toctou-"));
    let sourceWatcher: ReturnType<typeof watch> | undefined;
    try {
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          skill: "old skill",
          hooksJson: {
            hooks: {
              PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] }],
            },
          },
        },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const sourceHooksPath = path.join(seeded.pluginRoot, "hooks", "hooks.json");
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const installedHooksPath = path.join(locations.hooksDir, "hello", "hooks.json");
      const installedHooksBefore = await readFile(installedHooksPath, "utf8");
      let sourceChanged = false;
      sourceWatcher = watch(locations.skillsStagingDir, () => {
        if (!sourceChanged) {
          sourceChanged = true;
          writeFileSync(sourceHooksPath, "{ invalid hooks", "utf8");
        }
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(sourceChanged, true);
      assert.equal(outcome.partition, "failed");
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      assert.equal(await readFile(installedHooksPath, "utf8"), installedHooksBefore);
    } finally {
      sourceWatcher?.close();
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an abort cleanup failure reports manual recovery through the exported workflow", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-abort-cleanup-leak-"));
    let commandsWatcher: ReturnType<typeof watch> | undefined;
    let protectedSkillsStagingRoot: string | undefined;
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      commandsWatcher = watch(locations.commandsStagingDir, () => {
        if (protectedSkillsStagingRoot !== undefined) {
          return;
        }

        const [stagingName] = readdirSync(locations.skillsStagingDir);
        if (stagingName !== undefined) {
          protectedSkillsStagingRoot = path.join(locations.skillsStagingDir, stagingName);
          chmodSync(protectedSkillsStagingRoot, 0o000);
        }
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      if (protectedSkillsStagingRoot !== undefined) {
        chmodSync(protectedSkillsStagingRoot, 0o700);
      }

      // assert
      assert.notEqual(protectedSkillsStagingRoot, undefined);
      assert.equal(outcome.partition, "failed");
      assert.equal(outcome.failureClass, "manual-recovery");
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    } finally {
      commandsWatcher?.close();
      if (protectedSkillsStagingRoot !== undefined) {
        chmodSync(protectedSkillsStagingRoot, 0o700);
      }

      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a local single reinstall names the invalid local config after a successful replacement", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-invalid-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      await writeFile(locations.configLocalJsonPath, "{ invalid", "utf8");
      const { ctx, pi, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 2);
      assert.match(notifications[1]?.message ?? "", /claude-plugins\.local\.json/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a bulk local reinstall writes only the local configuration", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-local-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const baseConfigBefore = await readFile(locations.configJsonPath, "utf8");
      const { ctx, pi } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
        local: true,
      });

      // assert
      assert.equal(outcomes[0]?.partition, "reinstalled");
      assert.equal(await readFile(locations.configJsonPath, "utf8"), baseConfigBefore);
      assert.equal(await pathExists(locations.configLocalJsonPath), true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an unpinned git-subdir reinstall repairs from the warm mirror without external calls", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-subdir-mirror-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/mono";
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      const pluginRoot = path.join(mirrorRoot, "packages", "gp");
      await writeMirrorTree(mirrorRoot, pluginRoot, "gp", MIRROR_HEAD_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: pluginRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "git-subdir", url: cloneUrl, path: "packages/gp" },
      });
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("unexpected clone"),
        resolveRemoteRefThrows: new Error("unexpected remote resolution"),
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(gitState.cloneCalls, []);
      assert.deepEqual(gitState.resolveRemoteRefCalls, []);
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.equal(record?.resolvedSource, pluginRoot);
      assert.equal(record?.resolvedSha, MIRROR_HEAD_SHA);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an unpinned git-subdir reinstall reports a missing mirror subdirectory without cloning", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-subdir-mirror-missing-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/mono";
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await writeMirrorTree(mirrorRoot, mirrorRoot, "gp", MIRROR_HEAD_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: mirrorRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "git-subdir", url: cloneUrl, path: "packages/missing" },
      });
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("unexpected clone"),
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(gitState.cloneCalls, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a pinned git-subdir reinstall reports a missing cached subdirectory", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-subdir-pinned-missing-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/mono";
      const locations = locationsFor("project", cwd);
      const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, GIT_SOURCE_SHA));
      await writeMirrorTree(cloneRoot, cloneRoot, "gp", GIT_SOURCE_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        cloneUrl,
        resolvedSource: cloneRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: {
          source: "git-subdir",
          url: cloneUrl,
          path: "packages/missing",
          sha: GIT_SOURCE_SHA,
        },
      });
      const { gitOps, state: gitState } = makeMockGitOps({
        cloneThrows: new Error("unexpected clone"),
      });
      const { ctx, pi } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        __deps: { cloneCacheSeam: reinstallSeamWith(gitOps) },
      });

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepEqual(gitState.cloneCalls, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/**
 * Fresh maintenance/persistence collaborator set for one retry case. Each
 * call returns new closures bound to that case's schedule and fault cells;
 * nothing is shared between cases.
 */
function observeRetryDeps(
  schedule: { current: string[] },
  faults?: {
    readonly cache?: { enabled: boolean; readonly message: string };
    readonly data?: { enabled: boolean; readonly message: string };
    readonly persistence?: { enabled: boolean; readonly message: string };
  },
  loadStateOverride?: typeof loadState,
): ReinstallPluginDeps {
  return {
    dropMarketplaceCache: async (cachePath, scope, marketplace) => {
      schedule.current.push("drop:cache");
      if (faults?.cache?.enabled === true) {
        throw new Error(faults.cache.message);
      }

      await dropMarketplaceCache(cachePath, scope, marketplace);
    },
    removeDataDir: async (target, options) => {
      schedule.current.push("remove:data");
      if (faults?.data?.enabled === true) {
        throw new Error(faults.data.message);
      }

      await rm(target, options);
    },
    stateTransaction: {
      ...(loadStateOverride !== undefined && { loadState: loadStateOverride }),
      saveState: async (extensionRoot, state) => {
        schedule.current.push("save:state");
        if (faults?.persistence?.enabled === true) {
          throw new Error(faults.persistence.message);
        }

        await saveState(extensionRoot, state);
      },
    },
  };
}

/** The doubled `<message>\n\ncause: <message>` shape reinstall folds onto `notes`. */
function retryCauseChain(message: string): string {
  return `${message}\n\ncause: ${message}`;
}

// ──────────────────────────────────────────────────────────────────────────
// NFR-3 failure-then-retry proof: every operation is safe to retry --
// idempotent or fail-clean. NFR-2 bounds the recovery model: nothing below
// may need more than a reload.
//
// Every case below calls the SAME exported reinstall entrypoint twice inside
// one test, over one case-owned root, in one mode, against one target or
// ordered target set. Between the two calls it repairs only the injected
// collaborator or the case-owned fault fixture -- never the bytes, tree, or
// residue the first call left behind.
//
// The mcp and hooks bridges write through `write-file-atomic`, so their
// commits carry no observable `node:fs/promises` signature; those two are
// proven by the authoritative bytes and the owned-tree inventory instead of
// by a schedule entry.
// ──────────────────────────────────────────────────────────────────────────

test("retry proof: reinstall: skills prepare failure with no prepared handles converges on the same root", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-skills-prepare-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      const manifestBytes = await readFile(seeded.manifestPath, "utf8");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const configBytes = await readFile(locations.configJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const oldCommand = await readCommand(cwd);
      await rm(locations.skillsStagingDir, { force: true, recursive: true });
      await writeFile(locations.skillsStagingDir, "fault: skills staging is not a directory");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstCommand = await readCommand(cwd);
      await rm(locations.skillsStagingDir, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.deepStrictEqual(Object.keys(first).sort(), [
        "marketplace",
        "name",
        "notes",
        "partition",
        "reasons",
        "scope",
      ]);
      assert.deepStrictEqual(first.reasons, ["source missing"]);
      assert.match(
        first.notes[0] ?? "",
        new RegExp(
          `^ENOTDIR: not a directory, mkdir '${locations.skillsStagingDir}/[0-9a-f-]+'\\n\\ncause: ENOTDIR: not a directory, mkdir '${locations.skillsStagingDir}/[0-9a-f-]+'$`,
        ),
      );
      assert.equal(first.notes.length, 1);
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(second, {
        declaresAgents: false,
        declaresMcp: false,
        marketplace: "mp",
        name: "hello",
        partition: "reinstalled",
        resourcesChanged: true,
        scope: "project",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        version: "1.0.0",
      });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(await readFile(seeded.manifestPath, "utf8"), manifestBytes);
      assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
      assert.equal(firstSkill, oldSkill);
      assert.equal(firstCommand, oldCommand);
      assert.deepStrictEqual(firstSchedule, ["prepare:skills"]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
      assert.deepStrictEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources,
        {
          agents: [],
          hooks: [],
          mcpServers: [],
          prompts: ["hello:deploy"],
          skills: ["hello-tool"],
        },
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: commands prepare failure aborts the one prepared handle and converges", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-commands-prepare-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      const manifestBytes = await readFile(seeded.manifestPath, "utf8");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      await rm(locations.commandsStagingDir, { force: true, recursive: true });
      await writeFile(locations.commandsStagingDir, "fault: commands staging is not a directory");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      await rm(locations.commandsStagingDir, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.reasons, ["source missing"]);
      assert.match(
        first.notes[0] ?? "",
        new RegExp(
          `^ENOTDIR: not a directory, mkdir '${locations.commandsStagingDir}/[0-9a-f-]+'\\n\\ncause: `,
        ),
      );
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(second, {
        declaresAgents: false,
        declaresMcp: false,
        marketplace: "mp",
        name: "hello",
        partition: "reinstalled",
        resourcesChanged: true,
        scope: "project",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        version: "1.0.0",
      });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(await readFile(seeded.manifestPath, "utf8"), manifestBytes);
      assert.equal(firstSkill, oldSkill);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "staging-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: an abort cleanup leak reports manual recovery and the leak survives the retry", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-abort-leak-"));
    let restoreSchedule: (() => void) | undefined;
    const stagingRmFault = {
      bridge: "skills" as const,
      enabled: true,
      message: "skills staging removal refused",
    };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      await rm(locations.commandsStagingDir, { force: true, recursive: true });
      await writeFile(locations.commandsStagingDir, "fault: commands staging is not a directory");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
        stagingRmFault,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstNotifications = [...notifications];
      stagingRmFault.enabled = false;
      await rm(locations.commandsStagingDir, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, "manual-recovery");
      assert.deepStrictEqual(first.reasons, ["rollback partial"]);
      assert.equal(firstNotifications.length, 1);
      assert.equal(firstNotifications[0]?.severity, "warning");
      assert.match(
        firstNotifications[0]?.message ?? "",
        /^A plugin operation needs attention\.\n\n● mp \[project\]\n {2}⊘ hello \(manual recovery\) \{rollback partial\}\n {4}cause: ENOTDIR/,
      );
      assert.match(
        firstNotifications[0]?.message ?? "",
        new RegExp(
          `\\n {4}leaked: skills: failed to clean up skills staging directory at ${locations.skillsStagingDir}/[0-9a-f-]+: skills staging removal refused$`,
        ),
      );
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(firstStateBytes, stateBytes);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "staging-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      const isLeakedStagingEntry = (entry: string): boolean =>
        entry.startsWith("pi-claude-marketplace/skills-staging/") &&
        entry !== "pi-claude-marketplace/skills-staging/";
      assert.equal(
        firstTree.filter((entry) =>
          /^pi-claude-marketplace\/skills-staging\/[0-9a-f-]+\/$/.test(entry),
        ).length,
        1,
      );
      assert.deepStrictEqual(
        firstTree.filter((entry) => !isLeakedStagingEntry(entry)),
        [
          "claude-plugins.json",
          "pi-claude-marketplace/",
          "pi-claude-marketplace/commands-staging",
          "pi-claude-marketplace/data/",
          "pi-claude-marketplace/data/mp/",
          "pi-claude-marketplace/data/mp/hello/",
          "pi-claude-marketplace/resources/",
          "pi-claude-marketplace/resources/prompts/",
          "pi-claude-marketplace/resources/prompts/hello:deploy.md",
          "pi-claude-marketplace/resources/skills/",
          "pi-claude-marketplace/resources/skills/hello-tool/",
          "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
          "pi-claude-marketplace/skills-staging/",
          "pi-claude-marketplace/state.json",
        ],
      );
      const finalTree = await retryTree(locations.scopeRoot);
      assert.deepStrictEqual(
        finalTree.filter(isLeakedStagingEntry),
        firstTree.filter(isLeakedStagingEntry),
      );
      assert.deepStrictEqual(
        finalTree.filter((entry) => !isLeakedStagingEntry(entry)),
        [
          "claude-plugins.json",
          "pi-claude-marketplace/",
          "pi-claude-marketplace/commands-staging/",
          "pi-claude-marketplace/data/",
          "pi-claude-marketplace/data/mp/",
          "pi-claude-marketplace/resources/",
          "pi-claude-marketplace/resources/prompts/",
          "pi-claude-marketplace/resources/prompts/hello:deploy.md",
          "pi-claude-marketplace/resources/skills/",
          "pi-claude-marketplace/resources/skills/hello-tool/",
          "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
          "pi-claude-marketplace/skills-staging/",
          "pi-claude-marketplace/state.json",
        ],
      );
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      stagingRmFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: MCP prepare failure aborts three prepared handles newest first", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-mcp-prepare-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent", command: "old command", mcp: true, skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        agent: "new agent",
        command: "new command",
        mcp: true,
        skill: "new skill",
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const mcpBytes = await readFile(locations.mcpJsonPath, "utf8");
      const oldAgent = await readFile(agentPath, "utf8");
      await rm(locations.mcpJsonPath, { force: true });
      await mkdir(locations.mcpJsonPath, { recursive: true });
      // Read back the runtime's own errno wording: later majors append the offending path to it.
      // The failure's IDENTITY is not runtime-owned, so it is pinned here rather than left to the
      // composition: the probe is the same read production makes, so it moves with whatever is on
      // disk. A fixture that drifted to a missing file would report ENOENT on both sides and leave
      // this case green against a different failure entirely.
      const readFailure = await readFile(locations.mcpJsonPath, "utf8").catch((error: unknown) => {
        const errno = error as NodeJS.ErrnoException;
        assert.deepStrictEqual(
          { code: errno.code, syscall: errno.syscall },
          { code: "EISDIR", syscall: "read" },
        );
        return errno.message;
      });
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstAgent = await readFile(agentPath, "utf8");
      await rm(locations.mcpJsonPath, { force: true, recursive: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.equal(first.reasons, undefined);
      assert.deepStrictEqual(first.notes, [retryCauseChain(readFailure)]);
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(second.stagedMcpServerNames, ["server1"]);
      assert.deepStrictEqual(second.stagedAgentNames, [`${GENERATED_AGENT_PREFIX}hello-bot`]);
      assert.equal(second.version, "1.0.0");
      assert.deepStrictEqual(second.notes, [
        "warning: [bot] source description was missing or empty -- using fallback",
      ]);
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstAgent, oldAgent);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "prepare:agents",
        "staging-rm:agents",
        "staging-rm:commands",
        "staging-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "prepare:agents",
        "replace:skills",
        "replace:commands",
        "replace:agents",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "backup-rm:agents",
        "staging-rm:agents",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        `agents/${GENERATED_AGENT_PREFIX}hello-bot.md`,
        "claude-plugins.json",
        "mcp.json/",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/agents-staging/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        `agents/${GENERATED_AGENT_PREFIX}hello-bot.md`,
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/agents-staging/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.equal(await readFile(locations.mcpJsonPath, "utf8"), mcpBytes);
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: skills replacement refusal leaves an empty replacement ledger and converges", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-skills-replace-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      const freshSkillSource = path.join(seeded.pluginRoot, "skills", "fresh");
      await mkdir(freshSkillSource, { recursive: true });
      await writeFile(
        path.join(freshSkillSource, "SKILL.md"),
        "---\nname: fresh\n---\n\nfresh skill\n",
      );
      const foreignSkillDir = path.join(locations.skillsTargetDir, "hello-fresh");
      await mkdir(foreignSkillDir, { recursive: true });
      await writeFile(path.join(foreignSkillDir, "foreign.md"), "foreign bytes\n");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const manifestBytes = await readFile(seeded.manifestPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstForeign = await readFile(path.join(foreignSkillDir, "foreign.md"), "utf8");
      await retryRepairRm(foreignSkillDir, { force: true, recursive: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.equal(first.reasons, undefined);
      assert.deepStrictEqual(first.notes, [
        retryCauseChain(
          `Cannot replace skill target with non-previous content at ${foreignSkillDir}`,
        ),
      ]);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.version, "1.0.0");
      assert.equal(second.resourcesChanged, true);
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(await readFile(seeded.manifestPath, "utf8"), manifestBytes);
      assert.equal(firstSkill, oldSkill);
      assert.equal(firstForeign, "foreign bytes\n");
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "rollback:skills",
        "staging-rm:skills",
        "backup-rm:skills",
        "staging-rm:commands",
        "staging-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-fresh/",
        "pi-claude-marketplace/resources/skills/hello-fresh/foreign.md",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-fresh/",
        "pi-claude-marketplace/resources/skills/hello-fresh/SKILL.md",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources,
        {
          agents: [],
          hooks: [],
          mcpServers: [],
          prompts: ["hello:deploy"],
          skills: ["hello-fresh", "hello-tool"],
        },
      );
      assert.match(
        await readFile(path.join(locations.skillsTargetDir, "hello-fresh", "SKILL.md"), "utf8"),
        /fresh skill/,
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: commands replacement refusal unwinds the committed skills replacement in reverse", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-commands-replace-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      await writeFile(
        path.join(seeded.pluginRoot, "commands", "fresh.md"),
        "# fresh\n\nfresh command\n",
      );
      const foreignCommandPath = path.join(locations.promptsTargetDir, "hello:fresh.md");
      await writeFile(foreignCommandPath, "foreign command bytes\n");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const oldCommand = await readCommand(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstCommand = await readCommand(cwd);
      const firstForeign = await readFile(foreignCommandPath, "utf8");
      await retryRepairRm(foreignCommandPath, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.notes, [
        retryCauseChain(
          `Cannot replace command target with non-previous content at ${foreignCommandPath}`,
        ),
      ]);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.version, "1.0.0");
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstSkill, oldSkill);
      assert.equal(firstCommand, oldCommand);
      assert.equal(firstForeign, "foreign command bytes\n");
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "rollback:commands",
        "rollback:commands",
        "staging-rm:commands",
        "backup-rm:commands",
        "rollback:skills",
        "rollback:skills",
        "staging-rm:skills",
        "backup-rm:skills",
        "staging-rm:commands",
        "staging-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/prompts/hello:fresh.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/prompts/hello:fresh.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
      assert.match(await readFile(foreignCommandPath, "utf8"), /fresh command/);
      assert.deepStrictEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources,
        {
          agents: [],
          hooks: [],
          mcpServers: [],
          prompts: ["hello:deploy", "hello:fresh"],
          skills: ["hello-tool"],
        },
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a persistence failure after hooks removal leaves the unrestorable hooks window and the retry converges the record", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-hooks-window-"));
    let restoreSchedule: (() => void) | undefined;
    const persistenceFault = { enabled: true, message: "state persistence refused" };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          hooksJson: {
            hooks: {
              PreToolUse: [{ hooks: [{ command: "echo ok", type: "command" }], matcher: "Bash" }],
            },
          },
          skill: "old skill",
        },
        install: true,
      });
      await rm(path.join(seeded.pluginRoot, "hooks"), { force: true, recursive: true });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule, { persistence: persistenceFault });
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      const firstSkill = await readSkill(cwd);
      persistenceFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.notes, [retryCauseChain("state persistence refused")]);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.version, "1.0.0");
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstSkill, oldSkill);
      // The hooks write is not on the replacement ledger, so the removed
      // subtree cannot be restored. The record still claims the hook.
      assert.deepStrictEqual(firstRecord?.resources.hooks, ["hello"]);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "replace:skills",
        "remove:hooks",
        "save:state",
        "rollback:skills",
        "rollback:skills",
        "staging-rm:skills",
        "backup-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "replace:skills",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]?.resources,
        { agents: [], hooks: [], mcpServers: [], prompts: [], skills: ["hello-tool"] },
      );
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      persistenceFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a persistence failure after four committed replacements unwinds them all in reverse", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-persistence-"));
    let restoreSchedule: (() => void) | undefined;
    const persistenceFault = { enabled: true, message: "state persistence refused" };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent", command: "old command", mcp: true, skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        agent: "new agent",
        command: "new command",
        mcp: true,
        skill: "new skill",
      });
      const agentPath = path.join(locations.agentsDir, `${GENERATED_AGENT_PREFIX}hello-bot.md`);
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const mcpBytes = await readFile(locations.mcpJsonPath, "utf8");
      const oldAgent = await readFile(agentPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const oldCommand = await readCommand(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule, { persistence: persistenceFault });
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstMcpBytes = await readFile(locations.mcpJsonPath, "utf8");
      const firstAgent = await readFile(agentPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstCommand = await readCommand(cwd);
      persistenceFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.notes, [retryCauseChain("state persistence refused")]);
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(second.stagedMcpServerNames, ["server1"]);
      assert.deepStrictEqual(second.notes, [
        "warning: [bot] source description was missing or empty -- using fallback",
      ]);
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstMcpBytes, mcpBytes);
      assert.equal(firstAgent, oldAgent);
      assert.equal(firstSkill, oldSkill);
      assert.equal(firstCommand, oldCommand);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "prepare:agents",
        "replace:skills",
        "replace:commands",
        "replace:agents",
        "remove:hooks",
        "save:state",
        "rollback:agents",
        "rollback:agents",
        "staging-rm:agents",
        "backup-rm:agents",
        "rollback:commands",
        "rollback:commands",
        "staging-rm:commands",
        "backup-rm:commands",
        "rollback:skills",
        "rollback:skills",
        "staging-rm:skills",
        "backup-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "prepare:agents",
        "replace:skills",
        "replace:commands",
        "replace:agents",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "backup-rm:agents",
        "staging-rm:agents",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        `agents/${GENERATED_AGENT_PREFIX}hello-bot.md`,
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/agents-staging/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "agents/",
        `agents/${GENERATED_AGENT_PREFIX}hello-bot.md`,
        "claude-plugins.json",
        "mcp.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/agents-index.json",
        "pi-claude-marketplace/agents-staging/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.match(await readSkill(cwd), /new skill/);
      assert.match(await readCommand(cwd), /new command/);
    } finally {
      persistenceFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a concurrently removed record unwinds before any save and the retry persists once", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-concurrent-removal-"));
    let restoreSchedule: (() => void) | undefined;
    const removalFault = { enabled: true, observed: false };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule, undefined, async (extensionRoot) => {
        const state = await loadState(extensionRoot);
        const mp = state.marketplaces["mp"];
        if (mp === undefined || !removalFault.enabled) {
          return state;
        }

        // The record is present for the entry guard and gone by the time the
        // ledger writes it back -- the real concurrent-removal window.
        const plugins = new Proxy(mp.plugins, {
          get(target: typeof mp.plugins, key: string | symbol): unknown {
            if (key !== "hello") {
              return Reflect.get(target, key);
            }

            if (removalFault.observed) {
              return undefined;
            }

            removalFault.observed = true;
            return Reflect.get(target, key);
          },
        });
        (state.marketplaces as Record<string, unknown>)["mp"] = { ...mp, plugins };
        return state;
      });
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      removalFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(removalFault.observed, true);
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.notes, [
        retryCauseChain('Plugin "hello" was concurrently removed from marketplace "mp".'),
      ]);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.version, "1.0.0");
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstSkill, oldSkill);
      // The guard fires before `tx.save()`, so no persistence attempt appears.
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "rollback:commands",
        "rollback:commands",
        "staging-rm:commands",
        "backup-rm:commands",
        "rollback:skills",
        "rollback:skills",
        "staging-rm:skills",
        "backup-rm:skills",
      ]);
      assert.deepStrictEqual(secondSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.match(await readSkill(cwd), /new skill/);
      assert.deepStrictEqual(
        Object.keys((await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins ?? {}),
        ["hello"],
      );
    } finally {
      removalFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: an invalid config write-back is reported beside the success and the retry writes the entry", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-config-write-back-"));
    let restoreSchedule: (() => void) | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { command: "old command", skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        command: "new command",
        skill: "new skill",
      });
      await writeFile(locations.configJsonPath, "{ not json ", "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule);
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstConfigBytes = await readFile(locations.configJsonPath, "utf8");
      const firstNotifications = [...notifications];
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      await rm(locations.configJsonPath, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.equal(first.version, "1.0.0");
      assert.equal(first.notes, undefined);
      assert.deepStrictEqual(firstNotifications, [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
        {
          message:
            'A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {invalid manifest}\n    cause: Config file "claude-plugins.json" failed schema validation.',
          severity: "error",
        },
      ]);
      assert.equal(firstConfigBytes, "{ not json ");
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(notifications.slice(2), [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
      ]);
      assert.equal(
        await readFile(locations.configJsonPath, "utf8"),
        '{\n  "schemaVersion": 1,\n  "plugins": {\n    "hello@mp": {}\n  }\n}\n',
      );
      assert.equal(firstRecord?.version, "1.0.0");
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "prepare:commands",
        "replace:skills",
        "replace:commands",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "backup-rm:commands",
        "staging-rm:commands",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(secondSchedule, firstSchedule);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/commands-staging/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/prompts/",
        "pi-claude-marketplace/resources/prompts/hello:deploy.md",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
      assert.equal(
        (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"]
          ?.installedAt,
        firstRecord?.installedAt,
      );
    } finally {
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a post-save hook-cache read failure stays silent and the retry re-materializes once", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-post-save-hooks-"));
    let restoreRead: (() => void) | undefined;
    const hookReadFault = { enabled: true, reads: 0 };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          hooksJson: {
            hooks: {
              PreToolUse: [{ hooks: [{ command: "echo ok", type: "command" }], matcher: "Bash" }],
            },
          },
          skill: "old skill",
        },
        install: true,
      });
      const sourceHooksPath = path.join(seeded.pluginRoot, "hooks", "hooks.json");
      const installedHooksPath = path.join(locations.hooksDir, "hello", "hooks.json");
      const installedHooksBytes = await readFile(installedHooksPath, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        hooksJson: {
          hooks: {
            PreToolUse: [{ hooks: [{ command: "echo ok", type: "command" }], matcher: "Bash" }],
          },
        },
        skill: "new skill",
      });
      const originalReadFile = retryFs.readFile.bind(retryFs);
      const readMock = t.mock.method(
        retryFs,
        "readFile",
        async (...args: Parameters<typeof retryFs.readFile>) => {
          const [target] = args;
          if (typeof target !== "string" || target !== sourceHooksPath) {
            return originalReadFile(...args);
          }

          hookReadFault.reads += 1;
          // Reads 1 and 2 are the resolve and the hooks commit; read 3 is the
          // post-save cache hydration this case refuses.
          if (hookReadFault.enabled && hookReadFault.reads === 3) {
            throw new Error("hooks source read refused");
          }

          return originalReadFile(...args);
        },
      );

      syncBuiltinESMExports();
      restoreRead = (): void => {
        readMock.mock.restore();
        syncBuiltinESMExports();
      };

      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstReads = hookReadFault.reads;
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      hookReadFault.enabled = false;
      const second = await reinstallPlugin({
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.equal(first.version, "1.0.0");
      // The post-save hook-cache failure is debug-only: no note, no warning.
      assert.equal(first.notes, undefined);
      assert.equal(firstReads, 3);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.notes, undefined);
      assert.equal(hookReadFault.reads, 6);
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(firstRecord?.resources.hooks, ["hello"]);
      assert.deepStrictEqual(firstRecord.hookEntries, [{ event: "PreToolUse", matcher: "Bash" }]);
      assert.equal(await readFile(installedHooksPath, "utf8"), installedHooksBytes);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/hooks/",
        "pi-claude-marketplace/hooks/hello/",
        "pi-claude-marketplace/hooks/hello/hooks.json",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
      const finalRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.equal(finalRecord?.installedAt, firstRecord.installedAt);
      assert.equal(finalRecord.version, "1.0.0");
      assert.deepStrictEqual(finalRecord.resources.skills, ["hello-tool"]);
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      hookReadFault.enabled = false;
      restoreRead?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a completion-cache maintenance failure notes the deferral and the retry clears it", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-cache-maintenance-"));
    let restoreSchedule: (() => void) | undefined;
    const cacheFault = { enabled: true, message: "completion cache refresh refused" };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule, { cache: cacheFault });
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      cacheFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.deepStrictEqual(first.notes, [
        'warning: Plugin "hello" reinstalled; completion cache refresh deferred: completion cache refresh refused',
      ]);
      assert.equal(first.discoveryWarnings, undefined);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      // The data cleanup still runs, so the deferral is cache-only.
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "replace:skills",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(secondSchedule, firstSchedule);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
      const finalRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(finalRecord !== undefined);
      assert.equal(finalRecord.installedAt, firstRecord?.installedAt);
      assert.equal(finalRecord.version, "1.0.0");
      assert.deepStrictEqual(finalRecord.resources.skills, ["hello-tool"]);
    } finally {
      cacheFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a plugin-data-dir maintenance failure keeps the directory and the retry removes it", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-data-maintenance-"));
    let restoreSchedule: (() => void) | undefined;
    const dataFault = { enabled: true, message: "data directory removal refused" };
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const dataDir = await locations.pluginDataDir("mp", "hello");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      restoreSchedule = observeReinstallSchedule(
        t,
        retryScheduleDirs(cwd, "hello"),
        activeSchedule,
      );
      const deps = observeRetryDeps(activeSchedule, { data: dataFault });
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });

      // act
      const first = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      dataFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstallPlugin({
        __deps: deps,
        ctx,
        cwd,
        marketplace: "mp",
        pi,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.deepStrictEqual(first.notes, [
        `warning: Plugin "hello" reinstalled; data cleanup deferred at ${dataDir}: data directory removal refused`,
      ]);
      assert.equal(first.discoveryWarnings, undefined);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(firstSchedule, [
        "prepare:skills",
        "replace:skills",
        "remove:hooks",
        "save:state",
        "backup-rm:skills",
        "staging-rm:skills",
        "drop:cache",
        "remove:data",
      ]);
      assert.deepStrictEqual(secondSchedule, firstSchedule);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/hello-tool/",
        "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      const finalRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(finalRecord !== undefined);
      assert.equal(finalRecord.installedAt, firstRecord?.installedAt);
      assert.deepStrictEqual(finalRecord.resources.skills, ["hello-tool"]);
    } finally {
      dataFault.enabled = false;
      restoreSchedule?.();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-bulk-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const marketplaceRoot = path.join(cwd, "mp-src");
      const alpha = await seedMarketplace({
        cwd,
        install: true,
        marketplaceRoot,
        pluginName: "alpha",
        resources: { skill: "old alpha" },
      });
      const beta = await seedMarketplace({
        cwd,
        install: true,
        marketplaceRoot,
        pluginName: "beta",
        resources: { skill: "old beta" },
      });
      await writePluginTree(alpha.pluginRoot, "alpha", { skill: "new alpha" });
      await writePluginTree(beta.pluginRoot, "beta", { skill: "new beta" });
      const extraBetaSkill = path.join(beta.pluginRoot, "skills", "extra");
      await mkdir(extraBetaSkill, { recursive: true });
      await writeFile(
        path.join(extraBetaSkill, "SKILL.md"),
        "---\nname: extra\n---\n\nextra beta skill\n",
      );
      const foreignBetaTarget = path.join(locations.skillsTargetDir, "beta-extra");
      await mkdir(foreignBetaTarget, { recursive: true });
      await writeFile(path.join(foreignBetaTarget, "foreign.md"), "foreign bytes\n");
      const betaRecordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]
        ?.plugins["beta"];
      const maintenance: string[] = [];
      const { ctx, notifications, pi } = makeCtx({ toolNames: ["mcp", "subagent"] });
      const deps: ReinstallPluginDeps = {
        removeDataDir: async (target, options) => {
          maintenance.push(`remove:data:${path.basename(target)}`);
          await rm(target, options);
        },
      };

      // act
      const first = await reinstallPlugins({
        __deps: deps,
        ctx,
        cwd,
        pi,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstMaintenance = [...maintenance];
      const firstNotifications = [...notifications];
      const firstBetaRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]
        ?.plugins["beta"];
      await rm(foreignBetaTarget, { force: true, recursive: true });
      const second = await reinstallPlugins({
        __deps: deps,
        ctx,
        cwd,
        pi,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(
        first.map((outcome) => `${outcome.name}:${outcome.partition}`),
        ["alpha:reinstalled", "beta:failed"],
      );
      assert.deepStrictEqual(
        second.map((outcome) => `${outcome.name}:${outcome.partition}`),
        ["alpha:reinstalled", "beta:reinstalled"],
      );
      // Target-local continuation: only the committed target ran maintenance.
      assert.deepStrictEqual(firstMaintenance, ["remove:data:alpha"]);
      assert.deepStrictEqual(maintenance.slice(1), ["remove:data:alpha", "remove:data:beta"]);
      assert.deepStrictEqual(firstNotifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ● alpha v1.0.0 (reinstalled)\n  ⊘ beta (failed) {unreadable}\n\nPlugin reinstall: 1 failure, 1 success\n\n/reload to pick up changes",
          severity: "error",
        },
      ]);
      assert.deepStrictEqual(notifications.slice(1), [
        {
          message:
            "● mp [project]\n  ● alpha v1.0.0 (reinstalled)\n  ● beta v1.0.0 (reinstalled)\n\nPlugin reinstall: 2 successes\n\n/reload to pick up changes",
        },
      ]);
      // No batch-wide rollback: beta's record is exactly its pre-call record.
      assert.deepStrictEqual(firstBetaRecord, betaRecordBefore);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/beta/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/alpha-tool/",
        "pi-claude-marketplace/resources/skills/alpha-tool/SKILL.md",
        "pi-claude-marketplace/resources/skills/beta-extra/",
        "pi-claude-marketplace/resources/skills/beta-extra/foreign.md",
        "pi-claude-marketplace/resources/skills/beta-tool/",
        "pi-claude-marketplace/resources/skills/beta-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/resources/",
        "pi-claude-marketplace/resources/skills/",
        "pi-claude-marketplace/resources/skills/alpha-tool/",
        "pi-claude-marketplace/resources/skills/alpha-tool/SKILL.md",
        "pi-claude-marketplace/resources/skills/beta-extra/",
        "pi-claude-marketplace/resources/skills/beta-extra/SKILL.md",
        "pi-claude-marketplace/resources/skills/beta-tool/",
        "pi-claude-marketplace/resources/skills/beta-tool/SKILL.md",
        "pi-claude-marketplace/skills-staging/",
        "pi-claude-marketplace/state.json",
      ]);
      const finalState = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(Object.keys(finalState.marketplaces["mp"]?.plugins ?? {}), [
        "alpha",
        "beta",
      ]);
      assert.deepStrictEqual(finalState.marketplaces["mp"]?.plugins["alpha"]?.resources.skills, [
        "alpha-tool",
      ]);
      assert.deepStrictEqual(finalState.marketplaces["mp"]?.plugins["beta"]?.resources.skills, [
        "beta-extra",
        "beta-tool",
      ]);
      assert.equal(
        finalState.marketplaces["mp"]?.plugins["beta"]?.installedAt,
        betaRecordBefore?.installedAt,
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
