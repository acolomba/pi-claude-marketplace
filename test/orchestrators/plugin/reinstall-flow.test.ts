import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { loadMarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { WORKFLOW_SCRIPT_MAX_BYTES } from "../../../extensions/pi-claude-marketplace/domain/workflow-script.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { createInstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import {
  createNodeReinstallPlugins,
  createReinstallPlugin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  DependencyDeclarationsUnreadableError,
  InvalidGitHubBaseUrlError,
  LayerConfigUnreadableError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
  PluginUpdatePhase3Error,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createDeviceFlowFake } from "../../domain/device-flow-fake.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { setGitHubBaseUrl } from "../../shared/github-base-url-environment.ts";
import { runWithNothingLoaded, runWithSoftDeps } from "../../shared/notification-run-seeds.ts";

import { materializeCommitCopyWith } from "./mirror-checkout.ts";
import { retryTree } from "./scope-tree-inventory.ts";
import {
  createStateFifo,
  FIFO_SKIP,
  OVER_READ_SENTINEL,
  serializedStateBytes,
  startFifoStateServer,
} from "./state-fifo.ts";

import type { FifoStateServer } from "./state-fifo.ts";
import type {
  GitAuthBundle,
  GitOps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { InstallCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts";
import type {
  ReinstallHooksRouting,
  ReinstallPluginOptions,
  ReinstallPluginsOptions,
  RemoveDataDirFn,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts";
import type { UpdateCloneCacheSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import type { AgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  NotificationContext,
  SoftDepStatus,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { LockedStateTransactionDeps } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function reinstallPlugin(opts: ReinstallPluginOptions) {
  return createReinstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  )(opts);
}

function reinstallPlugins(opts: ReinstallPluginsOptions) {
  return createNodeReinstallPlugins(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  )(opts);
}

function createCompletionCacheWithDrop(
  dropMarketplaceCache: CompletionCache["dropMarketplaceCache"],
): CompletionCache {
  return { ...createCompletionCache(), dropMarketplaceCache };
}

function reinstallPluginWithCache(opts: ReinstallPluginOptions, completionCache: CompletionCache) {
  return createReinstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  )(opts);
}

test("owns the injected single-plugin and the bulk production reinstall factories", () => {
  // arrange
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();

  // act
  const injected = createReinstallPlugin(hooksRouting, completionCache);
  const bulk = createNodeReinstallPlugins(hooksRouting, completionCache);

  // assert
  assert.strictEqual(typeof injected, "function");
  assert.strictEqual(typeof bulk, "function");
});

function makeCtx(softDeps?: Partial<SoftDepStatus>): {
  ctx: NotificationContext;
  run: NotificationRun;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  };
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
    ...softDeps,
  });
  return { ctx, run, notifications };
}

async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  return withHermeticEnvironment("reinstall-", fn);
}

interface SeededReinstallAgent {
  readonly directory?: string;
  readonly sourceName: string;
  readonly frontmatterName?: string;
  readonly description?: string;
  readonly body: string;
}

interface ResourceSet {
  readonly skill?: string;
  readonly command?: string;
  readonly agent?: string;
  readonly agents?: readonly SeededReinstallAgent[];
  readonly mcp?: boolean;
  /**
   * WR-03: seed `<pluginRoot>/hooks/hooks.json` so reinstall's resolver
   * advertises `hooksConfigPath` and the shared swap runs the
   * cache+rebuild pattern.
   */
  readonly hooksJson?: object;
  /**
   * WLIF-01: each entry becomes `<pluginRoot>/workflows/<sourceName>.js`. The
   * default body carries a NAMED `meta` export on purpose -- a default-export
   * body classifies as SKIPPED and stages nothing, so a case relying on the
   * default would pass for the wrong reason.
   */
  readonly workflows?: readonly { readonly sourceName: string; readonly body?: string }[];
}

interface ExistingManifestEntry {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly defaultEnabled?: unknown;
  readonly agents?: unknown;
}

function rememberManifestEntry(
  entry: ExistingManifestEntry,
  plugins: Record<string, string>,
  declarations: Record<string, boolean>,
  agentsByPlugin: Record<string, readonly string[]>,
): void {
  if (typeof entry.name !== "string" || typeof entry.version !== "string") {
    return;
  }

  plugins[entry.name] = entry.version;
  if (typeof entry.defaultEnabled === "boolean") {
    declarations[entry.name] = entry.defaultEnabled;
  }

  if (
    Array.isArray(entry.agents) &&
    entry.agents.every((agentsDir): agentsDir is string => typeof agentsDir === "string")
  ) {
    agentsByPlugin[entry.name] = entry.agents;
  }
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
  /** Declared agent directories; the conventional agents/ directory remains additive. */
  readonly agentDirectories?: readonly string[];
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
    opts.agentDirectories,
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
    const { ctx } = makeCtx();
    const installPlugin = createInstallOperation(
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
      createCompletionCache(),
    );
    await installPlugin({
      ctx,
      run: runWithSoftDeps({
        piSubagentsLoaded: true,
        piMcpAdapterLoaded: true,
        workflowEngineLoaded: false,
      }),
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

  for (const agent of resources.agents ?? []) {
    const agentDir = path.join(pluginRoot, agent.directory ?? "agents");
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      path.join(agentDir, `${agent.sourceName}.md`),
      "---\n" +
        `name: ${agent.frontmatterName ?? agent.sourceName}\n` +
        `description: ${agent.description ?? `${agent.sourceName} agent`}\n` +
        "tools: Read,Grep\n" +
        "---\n\n" +
        agent.body,
    );
  }

  if (resources.mcp === true) {
    await writeFile(
      path.join(pluginRoot, ".mcp.json"),
      JSON.stringify({ mcpServers: { server1: { command: "node", args: ["server.js"] } } }),
    );
  }

  // WR-03: seed hooks payload so the resolver advertises hooksConfigPath
  // and the shared swap exercises the cache+rebuild path.
  if (resources.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(resources.hooksJson));
  }

  await writeWorkflowScripts(pluginRoot, resources.workflows ?? []);
}

/**
 * WLIF-01: write `<pluginRoot>/workflows/<sourceName>.js` per entry.
 *
 * Its own function rather than a sixth branch inside `writePluginTree`, which
 * sits near the cognitive-complexity ceiling with five.
 */
async function writeWorkflowScripts(
  pluginRoot: string,
  workflows: readonly { readonly sourceName: string; readonly body?: string }[],
): Promise<void> {
  if (workflows.length === 0) {
    return;
  }

  const workflowsDir = path.join(pluginRoot, "workflows");
  await mkdir(workflowsDir, { recursive: true });
  for (const workflow of workflows) {
    await writeFile(
      path.join(workflowsDir, `${workflow.sourceName}.js`),
      workflow.body ??
        `export const meta = { name: "${workflow.sourceName}", description: "does ${workflow.sourceName}" };\n`,
    );
  }
}

/** Directory entries, or `[]` when the directory was never created. */
async function entriesOf(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).sort();
  } catch {
    return [];
  }
}

async function mergeManifestEntry(
  marketplaceRoot: string,
  marketplaceName: string,
  pluginName: string,
  version: string,
  /** DFEN-01: stamped on this plugin's entry; absent leaves the field off. */
  defaultEnabled?: boolean,
  agentDirectories?: readonly string[],
): Promise<string> {
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const plugins: Record<string, string> = {};
  const declarations: Record<string, boolean> = {};
  const agentsByPlugin: Record<string, readonly string[]> = {};
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      readonly plugins?: readonly ExistingManifestEntry[];
    };
    for (const entry of manifest.plugins ?? []) {
      rememberManifestEntry(entry, plugins, declarations, agentsByPlugin);
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

  if (agentDirectories !== undefined) {
    agentsByPlugin[pluginName] = agentDirectories;
  }

  return writeManifest(marketplaceRoot, marketplaceName, plugins, declarations, agentsByPlugin);
}

async function writeManifest(
  marketplaceRoot: string,
  marketplaceName: string,
  plugins: Record<string, string>,
  declarations: Record<string, boolean> = {},
  agentsByPlugin: Record<string, readonly string[]> = {},
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
        ...(Object.hasOwn(agentsByPlugin, name) && { agents: agentsByPlugin[name] }),
      })),
    }),
  );
  return manifestPath;
}

async function reinstallDefault(cwd: string, ctx: NotificationContext, run: NotificationRun) {
  return reinstallPlugin({ ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
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

test("PRL-06: absent installed record returns skipped and does not mutate state or disk", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const before = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
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

async function seedLegacyReinstall(cwd: string, coexist: boolean) {
  const locations = locationsFor("project", cwd);
  const seeded = await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: {
      agents: [{ sourceName: "reviewer", description: "Reviewer", body: "Legacy body.\n" }],
    },
    install: true,
  });
  const sourcePath = path.join(seeded.pluginRoot, "agents", "hello-reviewer.md");
  await rm(path.join(seeded.pluginRoot, "agents", "reviewer.md"));
  await writePluginTree(seeded.pluginRoot, "hello", {
    agents: [
      { sourceName: "hello-reviewer", description: "Prefixed reviewer", body: "Prefixed body.\n" },
      ...(coexist
        ? [{ sourceName: "reviewer", description: "Reviewer", body: "Short body.\n" }]
        : []),
    ],
  });
  const oldTarget = path.join(locations.agentsDir, "pi-claude-marketplace-hello-reviewer.md");
  const newTarget = path.join(locations.agentsDir, "pi-claude-marketplace-hello-hello-reviewer.md");
  const oldBytes = `---\nname: pi-claude-marketplace-hello-reviewer\ndescription: Reviewer\ntools: read,grep\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: hello-reviewer\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\nLegacy body.\n`;
  await writeFile(oldTarget, oldBytes);
  const oldIndex: AgentsIndex = {
    schemaVersion: 1,
    agents: [
      {
        plugin: "hello",
        marketplace: "mp",
        sourceAgent: "hello-reviewer",
        generatedName: "pi-claude-marketplace-hello-reviewer",
        sourcePath,
        targetPath: oldTarget,
        sourceHash: "a".repeat(64),
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  };
  const oldIndexBytes = JSON.stringify(oldIndex);
  await writeFile(locations.agentsIndexPath, oldIndexBytes);
  return {
    locations,
    pluginRoot: seeded.pluginRoot,
    sourcePath,
    oldTarget,
    newTarget,
    oldBytes,
    oldIndex,
    oldIndexBytes,
  };
}

for (const coexist of [false, true]) {
  test(`AGENT-01: same-version reinstall migrates and repeats with coexistence ${String(coexist)}`, async (t) => {
    await withHermeticHome(async () => {
      // arrange
      t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-02T00:00:00.000Z") });
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-migrate-"));
      t.after(() => rm(cwd, { recursive: true, force: true }));
      const { locations, pluginRoot, oldTarget, newTarget } = await seedLegacyReinstall(
        cwd,
        coexist,
      );
      const beforeState = await loadState(locations.extensionRoot);
      const oldRecord = beforeState.marketplaces.mp?.plugins.hello;
      assert.ok(oldRecord);
      const expectedNames = coexist
        ? ["pi-claude-marketplace-hello-hello-reviewer", "pi-claude-marketplace-hello-reviewer"]
        : ["pi-claude-marketplace-hello-hello-reviewer"];
      const expectedAgents = [
        {
          sourceName: "hello-reviewer",
          generatedName: "pi-claude-marketplace-hello-hello-reviewer",
          description: "Prefixed reviewer",
          body: "Prefixed body.\n",
        },
        ...(coexist
          ? [
              {
                sourceName: "reviewer",
                generatedName: "pi-claude-marketplace-hello-reviewer",
                description: "Reviewer",
                body: "Short body.\n",
              },
            ]
          : []),
      ];
      const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });
      const options = {
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      } as const;

      // act
      const outcome = await reinstallPlugin(options);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: expectedNames,
        stagedMcpServerNames: [],
        declaresAgents: true,
        declaresMcp: false,
        declaresWorkflows: false,
      });
      assert.deepStrictEqual(notifications, []);
      const expectedEntries = [];
      for (const agent of expectedAgents) {
        const sourcePath = path.join(pluginRoot, "agents", agent.sourceName + ".md");
        const targetPath = path.join(locations.agentsDir, agent.generatedName + ".md");
        const sourceBytes = `---\nname: ${agent.sourceName}\ndescription: ${agent.description}\ntools: Read,Grep\n---\n\n${agent.body}`;
        expectedEntries.push({
          plugin: "hello",
          marketplace: "mp",
          sourceAgent: agent.sourceName,
          generatedName: agent.generatedName,
          sourcePath,
          targetPath,
          sourceHash: createHash("sha256").update(sourceBytes).digest("hex"),
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        });
        assert.strictEqual(
          await readFile(targetPath, "utf8"),
          `---\nname: hello:${agent.sourceName}\ndescription: ${agent.description}\naliases: ${agent.generatedName}\ntools: read,grep\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: hello\n  sourceAgent: ${agent.sourceName}\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\n${agent.body}`,
        );
      }

      const expectedIndex = { schemaVersion: 1, agents: expectedEntries };
      assert.deepStrictEqual(
        JSON.parse(await readFile(locations.agentsIndexPath, "utf8")),
        expectedIndex,
      );
      const afterState = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(afterState, {
        ...beforeState,
        marketplaces: {
          ...beforeState.marketplaces,
          mp: {
            ...beforeState.marketplaces.mp,
            plugins: {
              hello: { ...oldRecord, resources: { ...oldRecord.resources, agents: expectedNames } },
            },
          },
        },
      });
      if (!coexist) {
        await assert.rejects(readFile(oldTarget), { code: "ENOENT" });
      }

      const firstBytes = await readFile(newTarget, "utf8");

      // act
      const repeated = await reinstallPlugin(options);

      // assert
      assert.deepStrictEqual(repeated, outcome);
      assert.strictEqual(await readFile(newTarget, "utf8"), firstBytes);
      assert.deepStrictEqual(
        JSON.parse(await readFile(locations.agentsIndexPath, "utf8")),
        expectedIndex,
      );
      assert.deepStrictEqual(await loadState(locations.extensionRoot), afterState);
    });
  });
}

/**
 * Assert the common contract every AGENT-01 protection case shares: the
 * reinstall fails, emits no standalone notification, and leaves the legacy
 * agent file, the agents index, and state.json byte-identical to their
 * pre-attempt form.
 */
async function assertReinstallPreservedLegacyState(params: {
  readonly outcome: Awaited<ReturnType<typeof reinstallPlugin>>;
  readonly notifications: readonly NotifyRecord[];
  readonly locations: ScopedLocations;
  readonly oldTarget: string;
  readonly oldBytes: string;
  readonly indexBefore: string;
  readonly stateBefore: string;
}): Promise<void> {
  const { outcome, notifications, locations, oldTarget, oldBytes, indexBefore, stateBefore } =
    params;
  assert.strictEqual(outcome.partition, "failed");
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(await readFile(oldTarget, "utf8"), oldBytes);
  assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), indexBefore);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
}

test("AGENT-01 / NFR-3: a reinstall refuses a file no index row names at its new agent target before it changes anything", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-protection-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const { locations, oldTarget, newTarget, oldBytes } = await seedLegacyReinstall(cwd, false);
    await writeFile(newTarget, "Other owner's bytes.\n");
    const indexBefore = await readFile(locations.agentsIndexPath, "utf8");
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

    // act
    const outcome = await reinstallPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "hello",
      render: "none",
    });

    // assert
    // PI-6: no index row names the new target's file, so reinstall's overwrite
    // knob (D-18-15) does not reach it. The swap refuses before its intent
    // mark, so state.json, the index, and both agent files are unchanged.
    await assertReinstallPreservedLegacyState({
      outcome,
      notifications,
      locations,
      oldTarget,
      oldBytes,
      indexBefore,
      stateBefore,
    });
    const message = `Cannot replace agent target with non-previous content at ${newTarget}`;
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: [`${message}\n\ncause: ${message}`],
    });
    assert.strictEqual(await readFile(newTarget, "utf8"), "Other owner's bytes.\n");
  });
});

test("AGENT-01: reinstall preserves legacy bytes and state when another plugin owns the new target name", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-protection-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const { locations, sourcePath, oldTarget, newTarget, oldBytes, oldIndex } =
      await seedLegacyReinstall(cwd, false);
    await writeFile(newTarget, "Other owner's bytes.\n");
    const otherEntry = {
      plugin: "world",
      marketplace: "other",
      sourceAgent: "reviewer",
      generatedName: "pi-claude-marketplace-hello-hello-reviewer",
      sourcePath,
      targetPath: newTarget,
      sourceHash: "b".repeat(64),
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    };
    await writeFile(
      locations.agentsIndexPath,
      JSON.stringify({ schemaVersion: 1, agents: [...oldIndex.agents, otherEntry] }),
    );
    const indexBefore = await readFile(locations.agentsIndexPath, "utf8");
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

    // act
    const outcome = await reinstallPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "hello",
      render: "none",
    });

    // assert
    await assertReinstallPreservedLegacyState({
      outcome,
      notifications,
      locations,
      oldTarget,
      oldBytes,
      indexBefore,
      stateBefore,
    });
    const message =
      'Refusing to stage agents for mp/hello: "pi-claude-marketplace-hello-hello-reviewer" already owned by other/world.';
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: [`${message}\n\ncause: ${message}`],
    });
    assert.strictEqual(await readFile(newTarget, "utf8"), "Other owner's bytes.\n");
  });
});

test("AGENT-01: reinstall preserves legacy bytes and state when the post-migration save fails", async (t) => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-protection-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const { locations, oldTarget, newTarget, oldBytes } = await seedLegacyReinstall(cwd, false);
    const indexBefore = await readFile(locations.agentsIndexPath, "utf8");
    const stateBefore = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

    // act
    const outcome = await reinstallPlugin({
      ctx,
      run,
      scope: "project",
      cwd,
      marketplace: "mp",
      plugin: "hello",
      render: "none",
      stateTransaction: {
        saveState: () => Promise.reject(new Error("save failure after migration")),
      },
    });

    // assert
    await assertReinstallPreservedLegacyState({
      outcome,
      notifications,
      locations,
      oldTarget,
      oldBytes,
      indexBefore,
      stateBefore,
    });
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["save failure after migration\n\ncause: save failure after migration"],
    });
    await assert.rejects(readFile(newTarget), { code: "ENOENT" });
  });
});

test("PDEF-01: reinstall preview detects an agent conflict from a later resolved directory", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-dir-preview-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        agentDirectories: ["declared-agents"],
        resources: {
          agents: [
            { directory: "declared-agents", sourceName: "first", body: "First agent.\n" },
            { sourceName: "later", body: "Later agent.\n" },
          ],
        },
        install: true,
      });
      // D-18-17: the dependency walk reads every recorded plugin of the scope,
      // so `world` needs a marketplace that declares it; without one the
      // reinstall fails as unreadable before it reaches the conflict.
      const otherRoot = path.join(cwd, "other-mp");
      await writePluginTree(path.join(otherRoot, "plugins", "world"), "world", {});
      const otherManifestPath = await writeManifest(otherRoot, "other-mp", { world: "1.0.0" });
      const state = await loadState(locations.extensionRoot);
      const installed = state.marketplaces.mp?.plugins.hello;
      assert.ok(installed !== undefined);
      state.marketplaces["other-mp"] = {
        name: "other-mp",
        scope: "project",
        source: pathSource("./other-mp"),
        addedFromCwd: cwd,
        manifestPath: otherManifestPath,
        marketplaceRoot: otherRoot,
        plugins: {
          world: {
            ...installed,
            resources: {
              ...installed.resources,
              agents: ["pi-claude-marketplace-hello-later"],
            },
          },
        },
      };
      await saveState(locations.extensionRoot, state);
      const { ctx, run, notifications } = makeCtx({ piSubagentsLoaded: true });

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.strictEqual(outcome.partition, "failed");
      assert.match(outcome.notes?.[0] ?? "", /Cross-plugin name conflict/);
      assert.match(outcome.notes?.[0] ?? "", /pi-claude-marketplace-hello-later/);
      assert.strictEqual(notifications.length, 1);
      assert.strictEqual(notifications[0]?.severity, "error");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PDEF-01: reinstall stages every agent directory", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-agent-dirs-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        agentDirectories: ["declared-agents"],
        resources: {
          agents: [
            {
              directory: "declared-agents",
              sourceName: "shared-first",
              frontmatterName: "shared",
              body: "First shared agent.\n",
            },
            { sourceName: "later", body: "Later agent.\n" },
            {
              sourceName: "shared-later",
              frontmatterName: "shared",
              body: "Later shared agent.\n",
            },
          ],
        },
        install: true,
      });
      const { ctx, run } = makeCtx({ piSubagentsLoaded: true });

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.strictEqual(outcome.partition, "reinstalled");
      // The duplicate-name warning is an agents hygiene note, which the shared
      // swap does not carry in direct mode (D-18-02, D-141-03).
      assert.ok(!Object.hasOwn(outcome, "notes"), JSON.stringify(outcome));
      const state = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.agents, [
        "pi-claude-marketplace-hello-shared",
        "pi-claude-marketplace-hello-later",
      ]);
      assert.match(
        await readFile(
          path.join(locations.agentsDir, "pi-claude-marketplace-hello-shared.md"),
          "utf8",
        ),
        /First shared agent\./,
      );
      assert.match(
        await readFile(
          path.join(locations.agentsDir, "pi-claude-marketplace-hello-later.md"),
          "utf8",
        ),
        /Later agent\./,
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: a plugin missing from the cached manifest is skipped and leaves state, resources, and data unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-missing-entry-"));
    try {
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        notes: ["not in manifest"],
        reasons: ["not in manifest"],
      });
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {not in manifest}",
          severity: "warning",
        },
      ]);
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
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command", agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
      await writeFile(agentPath, "manual foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        command: "new command",
        agent: "new agent",
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      // RINST-01 / D-67-03: a bare reinstall (no `--partial`) overwrites the
      // agent that holds foreign bytes and refreshes every bridge -- overwrite
      // is unconditional.
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
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

test("PRL-10 / RINST-01: unconditional overwrite of foreign previous agent content rolls back on save failure", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-rollback-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
      const foreignBytes = "manual foreign bytes";
      await writeFile(agentPath, foreignBytes, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        stateTransaction: {
          saveState: () => Promise.reject(new Error("save failure after overwrite")),
        },
      });

      // assert
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
      // arrange
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", { skill: "new skill" });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPluginWithCache(
        {
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
        createCompletionCacheWithDrop(() => Promise.reject(new Error("cache drop failed"))),
      );

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "empty-mp"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: {},
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();
      // act & assert
      const noResource = await reinstallDefault(cwd, ctx, run);
      assert.equal(noResource.partition, "reinstalled");
      // The reload-hint trailer is emitted structurally
      // from the `reinstalled` variant per D-16-12.
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
        run,
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
      assert.match(body, /\{[^}]*requires pi-mcp-adapter[,}]/);
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPluginWithCache(
        {
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          render: "none",
          removeDataDir: () => Promise.reject(new Error("data cleanup failed")),
        },
        createCompletionCacheWithDrop(() => Promise.reject(new Error("cache drop failed"))),
      );

      // assert
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
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        scope: "project",
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mymp",
        pluginName: "plug",
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        target: { kind: "marketplace", marketplace: "mymp" },
      });

      // assert
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

test("PRL-03: a bulk reinstall forwards the data-directory removal seam to every per-plugin reinstall", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-data-dir-"));
    try {
      // arrange
      for (const pluginName of ["alpha", "beta"]) {
        await seedMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          pluginName,
          resources: { skill: pluginName },
          install: true,
        });
      }

      const locations = locationsFor("project", cwd);
      const removed: string[] = [];
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        removeDataDir: (dataDir) => {
          removed.push(dataDir);
          return Promise.resolve();
        },
      });

      // assert
      assert.deepStrictEqual(
        outcomes.map(({ name, partition }) => ({ name, partition })),
        [
          { name: "alpha", partition: "reinstalled" },
          { name: "beta", partition: "reinstalled" },
        ],
      );
      assert.deepStrictEqual(removed, [
        await locations.pluginDataDir("mp", "alpha"),
        await locations.pluginDataDir("mp", "beta"),
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("REI-04: a reinstall after the marketplace offers a newer version records and reports that version", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-newer-version-"));
    try {
      // arrange
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old" },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(before !== undefined, "the install wrote the record");
      assert.equal(before.version, "1.0.0");
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        version: "1.1.0",
        resources: { skill: "new" },
      });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({ name: "hello", version: "1.1.0" }),
      );
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.1.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
      const after = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["hello"];
      assert.deepStrictEqual(
        {
          version: after?.version,
          installedAt: after?.installedAt,
          provenance: after?.provenance,
        },
        { version: "1.1.0", installedAt: before.installedAt, provenance: before.provenance },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-05 bulk reinstall explicit scope filters targets", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-filter-"));
    try {
      // arrange
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
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "all" },
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      // --scope project where the marketplace lives ONLY in user scope.
      // ATTR-03 / D-47-A: the PLUGIN is the row's subject -- the container sits
      // one scope over, so nothing is installed at the scope named. SCOPE-01:
      // the `[project]` bracket carries the REQUESTED scope, and the brace
      // token names the scope that HOLDS the container, so the operator is not
      // left to infer it. SEV-04 / D-01: an absent target means the operation
      // was NOT carried out, so the row is `error`.
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "plug", marketplace: "mp" },
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "mp",
        pluginName: "plug",
        resources: { skill: "user" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      // Marketplace target with explicit --scope project where mp lives only
      // in user scope. ATTR-03 / D-47-A: the miss is attributed to the
      // standalone `MarketplaceNotAddedMessage`, not to a synthetic
      // `(reinstall)` `{not found}` row. SCOPE-01: the `[project]` bracket
      // carries the REQUESTED scope. No raw throw escapes.
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
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
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      // Bare form (no --scope): ghost-mp is absent in both scopes.
      // ATTR-03 / D-47-A: the miss is attributed to the standalone
      // `{marketplace not added}` with NO bracket (absent-from-both form).
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        target: { kind: "marketplace", marketplace: "ghost-mp" },
      });

      // assert
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

test("PRL-13: a bulk reinstall continues past a plugin it can no longer resolve", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-continue-"));
    try {
      // arrange
      const bad = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "bad",
        resources: { skill: "bad" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "good",
        resources: { skill: "good" },
        install: true,
      });
      // The manifest still declares `bad`, so the dependency walk reads it;
      // only its own resolution fails.
      await rm(bad.pluginRoot, { recursive: true, force: true });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      assert.deepEqual(
        outcomes.map((o) => `${o.name}:${o.partition}`),
        ["bad:skipped", "good:reinstalled"],
      );
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ bad (skipped) {no longer installable}\n  ● good v1.0.0 (reinstalled)\n\nPlugin reinstall: 1 warning, 1 success\n\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
      const body = notifications.at(-1)?.message ?? "";
      assert.equal(body.includes('Reinstalled plugin "good".'), false);
      assert.equal(body.includes("Failed:"), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-13 deterministic partition output sorts by scope marketplace plugin", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-sort-"));
    try {
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
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

test("same-name cross-scope reinstall renders the project-scope row before the user-scope row (MSG-GR-3 stable-sort tie-break)", async () => {
  // The existing PRL-13 deterministic-sort test (above) uses DISTINCT
  // marketplace names (a / u / z) so the marketplace-name primary key
  // never produces same-name pairs -- the project-before-user secondary
  // tie-break on `MarketplaceRow.scope` never fires. This test seeds
  // the SAME marketplace name in BOTH scopes so the tie-break is
  // exercised end-to-end through the cascade renderer (NOT just via
  // the unit cases on `compareByNameThenScope` in
  // `test/shared/notification-dispatch.test.ts`).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-same-name-scopes-"));
    try {
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
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
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      const body = notifications.at(-1)?.message ?? "";
      assert.match(body, /\/reload to pick up changes/);
      assert.doesNotMatch(body, /"empty"/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-15: batch soft dependency markers ride only the reinstalled row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-soft-deps-"));
    try {
      // arrange
      const bad = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "bad",
        resources: { agent: "bad agent" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "good",
        resources: { agent: "good agent", mcp: true },
        install: true,
      });
      await rm(bad.pluginRoot, { recursive: true, force: true });
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ bad (skipped) {no longer installable}\n  ● good v1.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp-adapter}\n\nPlugin reinstall: 1 warning, 1 success\n\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-17: a recorded plugin the manifest no longer declares fails every other reinstall in its scope as unreadable", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-unreadable-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "bad",
        resources: { agent: "bad agent" },
        install: true,
      });
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        pluginName: "good",
        resources: { agent: "good agent", mcp: true },
        install: true,
      });
      await writeManifest(path.join(cwd, "mp-src"), "mp", { good: "1.0.0" });
      const goodAgentPath = path.join(locations.agentsDir, "pi-claude-marketplace-good-bot.md");
      const goodAgentBefore = await readFile(goodAgentPath, "utf8");
      const adapterBefore = await readFile(locations.mcpAdapterJsonPath, "utf8");
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      // D-18-17: the walk fails closed on a record it cannot read, and the row
      // names the true cause; `dependents constrain` is kept for a real range
      // hold (D-18-07). `bad`'s own triage answers before its walk runs.
      const walkCause = "cannot read the dependencies of bad@mp: not declared by its marketplace";
      const [badOutcome, goodOutcome] = outcomes;
      assert.deepStrictEqual(badOutcome, {
        partition: "skipped",
        name: "bad",
        marketplace: "mp",
        scope: "project",
        notes: ["not in manifest"],
        reasons: ["not in manifest"],
      });
      assert.ok(goodOutcome?.partition === "failed");
      const { cause, ...goodRest } = goodOutcome;
      assert.deepStrictEqual(goodRest, {
        partition: "failed",
        name: "good",
        marketplace: "mp",
        scope: "project",
        notes: [`${walkCause}\n\ncause: ${walkCause}`],
        reasons: ["unreadable"],
      });
      assert.ok(cause instanceof DependencyDeclarationsUnreadableError);
      assert.strictEqual(cause.message, walkCause);
      assert.strictEqual(cause.declarer, "bad@mp");
      assert.deepStrictEqual(notifications, [
        {
          message: `A plugin operation has failed.\n\n● mp [project]\n  ⊘ bad (skipped) {not in manifest}\n  ⊘ good (failed) {unreadable}\n    cause: ${walkCause}\n\nPlugin reinstall: 1 failure, 1 warning`,
          severity: "error",
        },
      ]);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
      assert.equal(await readFile(goodAgentPath, "utf8"), goodAgentBefore);
      assert.equal(await readFile(locations.mcpAdapterJsonPath, "utf8"), adapterBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// -----------------------------------------------------------------------
// Additional coverage tests for uncovered paths
// -----------------------------------------------------------------------

test("GAP-01: an empty bulk reinstall emits only its sentinel", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-no-plugins-"));
    try {
      // arrange
      // No plugins installed; state is empty.
      const locations = locationsFor("project", cwd);
      await mkdir(locations.extensionRoot, { recursive: true });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      assert.deepEqual([...outcomes], []);
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.message, "(no marketplaces)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-02: a bulk reinstall of a plugin the manifest no longer declares renders a not-in-manifest skip", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-zero-reinstall-"));
    try {
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      assert.deepStrictEqual(outcomes, [
        {
          partition: "skipped",
          name: "hello",
          marketplace: "mp",
          scope: "project",
          notes: ["not in manifest"],
          reasons: ["not in manifest"],
        },
      ]);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {not in manifest}\n\nPlugin reinstall: 1 warning",
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-03: reinstallPlugin render=none returns a not-in-manifest skip without notifying", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-fail-"));
    try {
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        notes: ["not in manifest"],
        reasons: ["not in manifest"],
      });
      assert.deepStrictEqual(notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-04: a reinstall of an empty-resource plugin whose state save fails reports the save error", async () => {
  // Empty-resource plugin: the shared swap's first state write is its intent
  // mark (D-18-10). That save fails, so the swap aborts the prepared handles
  // and the failed outcome carries the save error with no manual-recovery
  // prefix.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-empty-leaks-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {},
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        stateTransaction: {
          saveState: () => Promise.reject(new Error("atomic-save-failed")),
        },
      });

      // assert
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

test("GAP-06: an MCP collision at prepare aborts the prepared handles and fails the reinstall", async () => {
  // A foreign full definition sits under hello's own server key. Reinstalling
  // hello triggers McpServerCollisionError inside prepareStageMcpServers,
  // which the shared swap's prepare step catches: it aborts the handles it
  // already prepared and surfaces a failed outcome.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mcp-collision-"));
    try {
      // arrange
      // Install "hello" with mcp server "server1".
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        resources: { mcp: true },
        install: true,
      });
      // Write a foreign definition under hello's key directly into the project
      // mcp-adapter.json so that prepareStageMcpServers sees a collision when
      // reinstalling hello (ANAME-01: two plugins that declare the same server
      // name get different keys, so only a definition of the key itself collides).
      const locations = locationsFor("project", cwd);
      const mcpPath = locations.mcpAdapterJsonPath;
      let mcpDoc: Record<string, unknown> = {};
      try {
        mcpDoc = JSON.parse(await readFile(mcpPath, "utf8")) as Record<string, unknown>;
      } catch {
        // mcp-adapter.json may not exist yet
      }

      const mcpServers = (mcpDoc.mcpServers ?? {}) as Record<string, unknown>;
      // Register hello's key under a foreign plugin marker so it looks like another plugin owns it.
      mcpServers["plugin_hello_server1_"] = {
        command: "node",
        args: ["other.js"],
        __claude_marketplace_plugin: "other@othermp",
      };
      mcpDoc.mcpServers = mcpServers;
      await writeFile(mcpPath, JSON.stringify(mcpDoc));

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.equal(outcome.partition, "failed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-07: reinstallPlugin skipped does not trigger runPostSuccessMaintenance", async () => {
  // When the plugin is not installed, the reinstall returns
  // partition='skipped' without calling runPostSuccessMaintenance (so no
  // cache/data drops run).
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-skip-no-maint-"));
    try {
      // arrange
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      let maintenanceCalled = false;
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPluginWithCache(
        {
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        },
        createCompletionCacheWithDrop(() => {
          maintenanceCalled = true;
          return Promise.resolve();
        }),
      );

      // assert
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
      // arrange
      await seedMarketplace({ cwd, marketplaceRoot: path.join(cwd, "mp-src"), install: false });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "skipped");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-10: reinstallPlugin render=none success with no warnings returns bare locked.outcome", async () => {
  // When no bridge warnings and no maintenance warnings exist, the outcome
  // carries no notes field.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-none-nowarn-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.notes, undefined);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GAP-11 / RINST-01: reinstallPlugin unconditionally overwrites agent foreign content", async () => {
  // RINST-01 / D-67-03 / D-18-15: overwrite is unconditional -- the shared swap
  // passes reinstall's overwrite knob to the agents commit. The success path
  // verifies that the outer render='default' success notification includes
  // the reload hint.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-force-success-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { agent: "old agent" },
        install: true,
      });
      const agentPath = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
      await writeFile(agentPath, "foreign bytes", "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", { agent: "new agent" });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-mp-src"),
        marketplaceName: "ump",
        pluginName: "uplug",
        resources: { skill: "user old" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "user",
        cwd,
        marketplace: "ump",
        plugin: "uplug",
      });

      // assert
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
      // arrange
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
      const { ctx, run, notifications } = makeCtx();

      // act
      // Explicit scope=project so enumerateMarketplaceReinstallTargets finds
      // the marketplace and returns [{ plugin: "hello", scope: "project" }].
      // reinstallPlugin then sees plugin not in mp.plugins and returns skipped.
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPluginWithCache(
        {
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
        },
        createCompletionCacheWithDrop(() => Promise.reject(new Error("cache-drop-warn"))),
      );

      // assert
      // dropMarketplaceCache failure is swallowed; reinstall still succeeds.
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(notifications.some((n) => n.message.includes("reinstalled")));
    } finally {
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old" },
        install: true,
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        stateTransaction: {
          saveState: () => Promise.reject(new Error("root-cause-error")),
        },
      });

      // assert
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
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
      // arrange
      await seedMarketplace({
        cwd,
        scope: "user",
        marketplaceRoot: path.join(cwd, "user-src"),
        marketplaceName: "onlyuser",
        pluginName: "plug",
        resources: { skill: "s" },
        install: true,
      });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "marketplace", marketplace: "onlyuser" },
      });

      // assert
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

/**
 * Install `hello` from marketplace `mp` in the project scope, then replace
 * both configs with the given bytes.
 */
async function seedLocalLayerReinstall(
  cwd: string,
  baseBytes: string,
  localBytes: string,
): Promise<ReturnType<typeof locationsFor>> {
  await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { skill: "s" },
    install: true,
  });
  const locations = locationsFor("project", cwd);
  await writeFile(locations.baseConfigJsonPath, baseBytes, "utf8");
  await writeFile(locations.localConfigJsonPath, localBytes, "utf8");
  return locations;
}

/** The bytes of both layer configs, of `state.json` with its mtime, and of the staged skill. */
async function reinstallFileSnapshot(
  cwd: string,
  locations: ReturnType<typeof locationsFor>,
): Promise<{
  readonly base: string;
  readonly local: string;
  readonly state: string;
  readonly stateMtimeMs: number;
  readonly skill: string;
}> {
  return {
    base: await readFile(locations.baseConfigJsonPath, "utf8"),
    local: await readFile(locations.localConfigJsonPath, "utf8"),
    state: await readFile(locations.stateJsonPath, "utf8"),
    stateMtimeMs: (await stat(locations.stateJsonPath)).mtimeMs,
    skill: await readSkill(cwd),
  };
}

const BASE_MARKETPLACE_ONLY = JSON.stringify({
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src" } },
});
const HELLO_DECLARED_LAYER = JSON.stringify({
  schemaVersion: 1,
  marketplaces: { mp: { source: "./mp-src" } },
  plugins: { "hello@mp": {} },
});

for (const { direction, base, local, flag, refusal, reason, cause } of [
  {
    direction: "without --local a plugin only the local layer declares",
    base: BASE_MARKETPLACE_ONLY,
    local: HELLO_DECLARED_LAYER,
    flag: false,
    refusal: new PluginInLocalLayerOnlyError("hello", "mp"),
    reason: "plugin in local layer only",
    cause:
      "The plugin hello@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
  },
  {
    direction: "with --local a plugin only the base layer declares",
    base: HELLO_DECLARED_LAYER,
    local: BASE_MARKETPLACE_ONLY,
    flag: true,
    refusal: new PluginInBaseLayerOnlyError("hello", "mp"),
    reason: "plugin in base layer only",
    cause:
      "The plugin hello@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.",
  },
] as const) {
  test(`LAYER-04: a named reinstall ${direction} is refused before anything is resolved or replaced`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-layer-refusal-"));
      try {
        // arrange
        const locations = await seedLocalLayerReinstall(cwd, base, local);
        const filesBefore = await reinstallFileSnapshot(cwd, locations);
        const reinstall = createReinstallPlugin(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
        );
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcome = await reinstall({
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          named: true,
          local: flag,
        });

        // assert
        assert.deepStrictEqual(outcome, {
          partition: "failed",
          name: "hello",
          marketplace: "mp",
          scope: "project",
          notes: [`${cause}\n\ncause: ${cause}`],
          reasons: [reason],
          cause: refusal,
        });
        assert.deepEqual(notifications, [
          {
            message: [
              "A plugin operation has failed.",
              "",
              "● mp [project]",
              `  ⊘ hello (failed) {${reason}}`,
              `    cause: ${cause}`,
            ].join("\n"),
            severity: "error",
          },
        ]);
        assert.deepStrictEqual(await reinstallFileSnapshot(cwd, locations), filesBefore);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

/**
 * Install `hello` and `other` from marketplace `mp` in the project scope, then
 * write `localBytes` into the local layer.
 */
async function seedTwoPluginReinstall(
  cwd: string,
  localBytes: string,
): Promise<ReturnType<typeof locationsFor>> {
  for (const pluginName of ["hello", "other"]) {
    await seedMarketplace({
      cwd,
      marketplaceRoot: path.join(cwd, "mp-src"),
      pluginName,
      resources: { skill: pluginName },
      install: true,
    });
  }

  const locations = locationsFor("project", cwd);
  await writeFile(locations.localConfigJsonPath, localBytes, "utf8");
  return locations;
}

for (const { form, target } of [
  { form: "bare", target: { kind: "all" } },
  { form: "@marketplace", target: { kind: "marketplace", marketplace: "mp" } },
] as const) {
  test(`LAYER-04: the ${form} reinstall with --local reinstalls only the plugins the local layer declares`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nameless-local-"));
      try {
        // arrange
        await seedTwoPluginReinstall(cwd, HELLO_DECLARED_LAYER);
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcomes = await reinstallPlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target,
          local: true,
        });

        // assert
        assert.deepEqual(
          outcomes.map((outcome) => [outcome.name, outcome.partition]),
          [["hello", "reinstalled"]],
        );
        assert.deepEqual(notifications, [
          {
            message:
              "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\nPlugin reinstall: 1 success\n\n/reload to pick up changes",
          },
        ]);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });

  test(`LAYER-04: the ${form} reinstall without --local reinstalls every installed plugin of the scope`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nameless-flagless-"));
      try {
        // arrange
        await seedTwoPluginReinstall(cwd, HELLO_DECLARED_LAYER);
        const { ctx, run } = makeCtx();

        // act
        const outcomes = await reinstallPlugins({ ctx, run, scope: "project", cwd, target });

        // assert
        assert.deepEqual(
          outcomes.map((outcome) => [outcome.name, outcome.partition]),
          [
            ["hello", "reinstalled"],
            ["other", "reinstalled"],
          ],
        );
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

for (const { form, target, blockName } of [
  { form: "bare", target: { kind: "all" }, blockName: "(reinstall)" },
  { form: "@marketplace", target: { kind: "marketplace", marketplace: "mp" }, blockName: "mp" },
] as const) {
  test(`CFG-03: the ${form} reinstall with --local fails naming an unreadable local layer and touches no plugin`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nameless-local-invalid-"));
      try {
        // arrange
        const locations = await seedTwoPluginReinstall(cwd, "{ invalid");
        const stateBytes = await readFile(locations.stateJsonPath, "utf8");
        const baseBytes = await readFile(locations.baseConfigJsonPath, "utf8");
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcomes = await reinstallPlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target,
          local: true,
        });

        // assert
        assert.deepEqual([...outcomes], []);
        assert.deepEqual(notifications, [
          {
            message: [
              "A plugin operation has failed.",
              "",
              `● ${blockName} [project]`,
              "  ⊘ (reinstall) (failed) {invalid manifest}",
              '    cause: Config file "claude-plugins.local.json" failed schema validation.',
              "",
              "Plugin reinstall: 1 failure",
            ].join("\n"),
            severity: "error",
          },
        ]);
        assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
        assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), baseBytes);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

/**
 * Install `hello` and `other`, declare both in the local layer, then drop
 * `other` from the marketplace, so its dependencies cannot be read.
 */
async function seedUnreadableLocalDeclaration(
  cwd: string,
): Promise<ReturnType<typeof locationsFor>> {
  const locations = await seedTwoPluginReinstall(
    cwd,
    JSON.stringify({
      schemaVersion: 1,
      marketplaces: { mp: { source: "./mp-src" } },
      plugins: { "hello@mp": {}, "other@mp": {} },
    }),
  );
  const manifestPath = path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    readonly plugins: readonly { readonly name: string }[];
  };
  await writeFile(
    manifestPath,
    JSON.stringify({
      ...manifest,
      plugins: manifest.plugins.filter((entry) => entry.name !== "other"),
    }),
  );
  return locations;
}

for (const { form, target, blockName } of [
  { form: "bare", target: { kind: "all" }, blockName: "(reinstall)" },
  { form: "@marketplace", target: { kind: "marketplace", marketplace: "mp" }, blockName: "mp" },
] as const) {
  test(`LAYER-04: the ${form} reinstall with --local fails as unreadable when a local plugin's dependencies cannot be read, and touches no plugin`, async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nameless-local-unreadable-"));
      try {
        // arrange
        const locations = await seedUnreadableLocalDeclaration(cwd);
        const stateBytes = await readFile(locations.stateJsonPath, "utf8");
        const localBytes = await readFile(locations.localConfigJsonPath, "utf8");
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcomes = await reinstallPlugins({
          ctx,
          run,
          scope: "project",
          cwd,
          target,
          local: true,
        });

        // assert
        assert.deepEqual([...outcomes], []);
        assert.deepEqual(notifications, [
          {
            message: [
              "A plugin operation has failed.",
              "",
              `● ${blockName} [project]`,
              "  ⊘ (reinstall) (failed) {unreadable}",
              "    cause: cannot read the dependencies of other@mp: not declared by its marketplace",
              "",
              "Plugin reinstall: 1 failure",
            ].join("\n"),
            severity: "error",
          },
        ]);
        assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
        assert.equal(await readFile(locations.localConfigJsonPath, "utf8"), localBytes);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("FIX-03: a bare reinstall under a marketplace only the local config declares writes no declaration", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-mp-"));
    try {
      // arrange
      const baseBytes = JSON.stringify({ schemaVersion: 1 });
      const localBytes = JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp-src" } },
      });
      const locations = await seedLocalLayerReinstall(cwd, baseBytes, localBytes);
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "all" },
      });

      // assert
      assert.deepEqual(
        outcomes.map((outcome) => outcome.partition),
        ["reinstalled"],
      );
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), baseBytes);
      assert.equal(await readFile(locations.localConfigJsonPath, "utf8"), localBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-08: a named reinstall of a plugin no layer declares, under a marketplace only the local layer declares, reinstalls it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-mp-named-"));
    try {
      // arrange
      await seedLocalLayerReinstall(
        cwd,
        JSON.stringify({ schemaVersion: 1 }),
        BASE_MARKETPLACE_ONLY,
      );
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
      });

      // assert
      assert.deepEqual(
        outcomes.map((outcome) => outcome.partition),
        ["reinstalled"],
      );
      assert.deepEqual(notifications, [
        { message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes" },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: a named reinstall with --local under a marketplace only the local layer declares reinstalls the plugin and writes no layer config", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-mp-flag-"));
    try {
      // arrange
      const locations = await seedLocalLayerReinstall(
        cwd,
        JSON.stringify({ schemaVersion: 1 }),
        BASE_MARKETPLACE_ONLY,
      );
      const layersBefore = await layerConfigs(locations);
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
        local: true,
      });

      // assert
      assert.deepEqual(
        outcomes.map((outcome) => outcome.partition),
        ["reinstalled"],
      );
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const INVALID_LOCAL_LAYER_CAUSE =
  'Config file "claude-plugins.local.json" failed schema validation.';

interface LayerConfig {
  readonly bytes: string;
  readonly mtimeMs: number;
}

async function readLayerConfig(filePath: string): Promise<LayerConfig | undefined> {
  return (await pathExists(filePath))
    ? { bytes: await readFile(filePath, "utf8"), mtimeMs: (await stat(filePath)).mtimeMs }
    : undefined;
}

/** The bytes and mtime of each layer config; an absent file reads as undefined. */
async function layerConfigs(locations: ReturnType<typeof locationsFor>): Promise<{
  readonly base: LayerConfig | undefined;
  readonly local: LayerConfig | undefined;
}> {
  return {
    base: await readLayerConfig(locations.baseConfigJsonPath),
    local: await readLayerConfig(locations.localConfigJsonPath),
  };
}

const HELLO_REINSTALLED_ROW = {
  message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
};

test("LAYER-04: a bare flagless reinstall whose local layer cannot be read reinstalls and renders only its cascade", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bare-local-invalid-"));
    try {
      // arrange
      const locations = await seedLocalLayerReinstall(cwd, BASE_MARKETPLACE_ONLY, "{ invalid");
      const layersBefore = await layerConfigs(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "all" },
      });

      // assert
      assert.deepEqual(
        outcomes.map((outcome) => outcome.partition),
        ["reinstalled"],
      );
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\nPlugin reinstall: 1 success\n\n/reload to pick up changes",
        },
      ]);
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: a named reinstall of a plugin the base layer declares leaves both layer configs unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-declared-layers-"));
    try {
      // arrange
      const locations = await seedLocalLayerReinstall(
        cwd,
        HELLO_DECLARED_LAYER,
        JSON.stringify({ schemaVersion: 1 }),
      );
      const layersBefore = await layerConfigs(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
      });

      // assert
      assert.deepEqual(
        outcomes.map((outcome) => outcome.partition),
        ["reinstalled"],
      );
      assert.deepEqual(notifications, [HELLO_REINSTALLED_ROW]);
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: a reinstall with --local of a plugin no layer declares writes no layer config", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-no-layer-"));
    try {
      // arrange
      const locations = await seedLocalLayerReinstall(
        cwd,
        BASE_MARKETPLACE_ONLY,
        JSON.stringify({ schemaVersion: 1 }),
      );
      const layersBefore = await layerConfigs(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(notifications, [HELLO_REINSTALLED_ROW]);
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("LAYER-04: the unnamed flagless reinstall the load-time backfill runs on a dependency writes no layer config", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-backfill-dependency-"));
    try {
      // arrange
      const locations = await seedLocalLayerReinstall(
        cwd,
        BASE_MARKETPLACE_ONLY,
        JSON.stringify({ schemaVersion: 1 }),
      );
      const seededState = await loadState(locations.extensionRoot);
      const seededRecord = seededState.marketplaces.mp?.plugins.hello;
      assert.ok(seededRecord !== undefined);
      seededRecord.provenance = "dependency";
      await saveState(locations.extensionRoot, seededState);
      const layersBefore = await layerConfigs(locations);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
      assert.deepEqual(notifications, []);
      assert.deepEqual(await layerConfigs(locations), layersBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("CFG-03: a named flagless reinstall whose local layer cannot be read is refused naming it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-local-invalid-"));
    try {
      // arrange
      const baseBytes = JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: "./mp-src" } },
      });
      const locations = await seedLocalLayerReinstall(cwd, baseBytes, "{ invalid");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const skillBytes = await readSkill(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
      });

      // assert
      assert.deepStrictEqual(outcomes, [
        {
          partition: "failed",
          name: "hello",
          marketplace: "mp",
          scope: "project",
          notes: [`${INVALID_LOCAL_LAYER_CAUSE}\n\ncause: ${INVALID_LOCAL_LAYER_CAUSE}`],
          reasons: ["invalid manifest"],
          cause: new LayerConfigUnreadableError("claude-plugins.local.json"),
        },
      ]);
      assert.deepEqual(notifications, [
        {
          message: [
            "A plugin operation has failed.",
            "",
            "● mp [project]",
            "  ⊘ hello (failed) {invalid manifest}",
            `    cause: ${INVALID_LOCAL_LAYER_CAUSE}`,
          ].join("\n"),
          severity: "error",
        },
      ]);
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), baseBytes);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBytes);
      assert.equal(await readSkill(cwd), skillBytes);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WR-03 / D-60-05: after reinstallPlugin succeeds, the hooks-bridge routing
// table reflects the post-reinstall entry set. Reinstall does NOT delegate
// to install/uninstall; the shared swap wires the cache lifecycle, and this
// section verifies it end-to-end.
// ─────────────────────────────────────────────────────────────────────────────

test("WR-03: reinstallPlugin round-trips the plugin's routing-table entries without /reload", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr03-"));
    try {
      // arrange
      const ownerRuntime = createHooksRuntime();
      const peerRuntime = createHooksRuntime();
      const hooksRouting = createHooksRouting(ownerRuntime, { readHooksJson });
      const { pluginRoot } = await seedMarketplace({
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

      await hooksRouting.readAndCachePluginHooks({
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        resolvedSource: asAbsolutePluginRoot(pluginRoot),
        hooksJsonPath: path.join(pluginRoot, "hooks", "hooks.json"),
        cwd,
        logPrefix: "reinstall-test",
      });
      hooksRouting.rebuildRoutingTables();
      const preBucket = ownerRuntime.getRoutingBucket("PreToolUse");
      assert.equal(preBucket.length, 1);
      assert.equal(preBucket[0]?.pluginId, "hello");
      assert.equal(preBucket[0]?.handlerDecl["command"], "echo hi");
      await writeFile(
        path.join(pluginRoot, "hooks", "hooks.json"),
        JSON.stringify({
          PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo new" }] }],
        }),
      );

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await createReinstallPlugin(
        hooksRouting,
        createCompletionCache(),
      )({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(
        !summary.includes("(failed)"),
        `expected clean reinstall notification; got: ${summary}`,
      );

      // Post-condition: the routing-table entry still reflects the plugin
      // after the shared swap's explicit remove+add. This
      // proves both `removePluginConfigFromCache` and
      // `addPluginConfigToCache` plus the trailing `rebuildRoutingTables`
      // call landed in the right order.
      const postBucket = ownerRuntime.getRoutingBucket("PreToolUse");
      assert.equal(postBucket.length, 1);
      assert.equal(postBucket[0]?.pluginId, "hello");
      assert.equal(postBucket[0]?.handlerDecl["command"], "echo new");
      // resolvedSource must propagate from the resolver -> cache -> routing
      // table. CLAUDE_PLUGIN_ROOT export at dispatch depends on it.
      const reinstallLoc = locationsFor("project", cwd);
      const postState = await loadState(reinstallLoc.extensionRoot);
      assert.equal(
        postBucket[0]?.resolvedSource,
        postState.marketplaces["mp"]?.plugins["hello"]?.resolvedSource,
        "RoutingEntry.resolvedSource must mirror state.json's resolvedSource after reinstall",
      );
      assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LIFE-01: the shared swap reinstall runs writes <hooksDir>/<plugin>/hooks.json
// between its agents and mcp commits, and removes the stale subtree when the
// plugin no longer ships hooks.
// ─────────────────────────────────────────────────────────────────────────────

test("LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-rewrite-"));
    try {
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

      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
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
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-life01-drop-"));
    try {
      // arrange
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

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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

// BFILL-01 / RINST-01 / D-18-06: reinstall is partial-capable. It runs the
// shared runner with `partial` admitted, so a plugin that re-resolves
// `partially-available` (here: a `.lsp.json` lspServers convention file beside
// a supported skill) passes the gate instead of throwing `{not-installable}`.
// Re-resolution of a path source stays cache-only (NFR-5). The persisted
// compatibility record reflects the REAL supported/unsupported sets at the
// version the marketplace offers, which here is still the recorded one (D-18-08).
async function seedThenDegradeToUnsupported(cwd: string): Promise<string> {
  // Install a normal (installable) plugin with one supported skill.
  const seeded = await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { skill: "old skill" },
    install: true,
  });
  // Drop an lspServers convention file so re-resolution degrades to
  // `partially-available` with supported=["skills"], unsupported=["lspServers"].
  await writeFile(path.join(seeded.pluginRoot, ".lsp.json"), "{}");
  return seeded.pluginRoot;
}

test("BFILL-01 / RINST-01: reinstalling a partially-installed plugin succeeds instead of throwing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-partial-"));
    try {
      // arrange
      await seedThenDegradeToUnsupported(cwd);

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(notifications.length, 0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-18-06 / D-18-18: a reinstall of a clean record whose source now resolves partially records it as partial", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-partial-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedThenDegradeToUnsupported(cwd);
      const before = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.deepStrictEqual(
        {
          installable: before?.compatibility.installable,
          unsupported: before?.compatibility.unsupported,
        },
        { installable: true, unsupported: [] },
      );

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(record !== undefined);
      // The partial re-materialize stays partially-installed: installable=false
      // with a non-empty unsupported set (D-66-01 derivation source).
      assert.equal(record.compatibility.installable, false);
      assert.deepEqual(record.compatibility.unsupported, ["lspServers"]);
      assert.deepEqual(record.compatibility.supported, ["skills"]);
      // D-18-08: the version the marketplace offers, which is still 1.0.0.
      assert.equal(record.version, "1.0.0");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-06 / D-18-08: a reinstall that newly leaves a component out names it on a warning row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-partial-row-"));
    try {
      // arrange
      await seedThenDegradeToUnsupported(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (reinstalled) {lsp}\n\n/reload to pick up changes",
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("BFILL-01 / D-18-06 full: reinstall of an installable plugin records installable:true with empty unsupported", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bfill-full-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
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
// PURL-07 / D-18-04 -- reinstall of a pinned git-source (url / git-subdir /
// github) plugin. The shared runner materializes the marketplace entry's sha
// through the clone-cache seam's resolvePluginPin then materializePluginClone;
// a pinned ref resolves with no remote call, so a warm copy is offline and only
// a cache miss clones.
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
  "https://example.com/org/mono",
  "https://example.com/org/repo",
  "https://example.com/org/repo.git",
  "https://github.com/org/one.git",
  "https://github.com/org/repo.git",
  "https://github.com/org/two.git",
  "https://gitlab.example.com/o/r",
] as const;

function createGitOps(
  options: {
    readonly fixtureSourceDir?: string;
    readonly cloneThrows?: Error;
    readonly resolveRemoteRefThrows?: Error;
    /**
     * The commit the fake reports as `HEAD` and as the default branch's last
     * fetch, both before and after a clone.
     */
    readonly head?: string;
    /** Remote-tracking refs a previous fetch left in the mirror. */
    readonly fetchedRefs?: Readonly<Record<string, string>>;
  } = {},
): {
  readonly gitOps: ReturnType<typeof createGitOpsFake>["gitOps"];
  readonly state: {
    readonly cloneCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["clone"];
    readonly fetchCalls: ReturnType<typeof createGitOpsFake>["state"]["calls"]["fetch"];
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
    ...(options.head !== undefined && { initialOid: options.head, remoteHead: options.head }),
    localRefs: {
      ...(options.head !== undefined && { "refs/remotes/origin/main": options.head }),
      ...options.fetchedRefs,
    },
  });
  const gitOps: typeof fake.gitOps = {
    ...fake.gitOps,
    async clone(cloneOptions) {
      await fake.gitOps.clone(cloneOptions);
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
      return fake.gitOps.resolveRemoteRef(resolveOptions);
    },
  };
  return {
    gitOps,
    state: {
      cloneCalls: fake.state.calls.clone,
      fetchCalls: fake.state.calls.fetch,
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
    materializePluginCommitCopy: (args) => materializeCommitCopyWith(gitOps, args),
  };
}

/**
 * Bind reinstall's clone-cache seam to a mock gitOps. Reinstall runs the shared
 * runner, so its seam is the same four members install's is.
 */
function reinstallSeamWith(gitOps: GitOps): UpdateCloneCacheSeam {
  return installSeamWith(gitOps);
}

/**
 * Reinstall's seam, recording the auth bundle each mirror read or cold clone
 * received.
 */
function capturingReinstallSeam(gitOps: GitOps): {
  readonly seam: UpdateCloneCacheSeam;
  readonly captured: { auth: GitAuthBundle | undefined; count: number };
} {
  const captured: { auth: GitAuthBundle | undefined; count: number } = {
    auth: undefined,
    count: 0,
  };
  const base = installSeamWith(gitOps);
  const seam: UpdateCloneCacheSeam = {
    ...base,
    materializeOrRefreshPluginMirror: (args) => {
      captured.auth = args.auth;
      captured.count += 1;
      return base.materializeOrRefreshPluginMirror(args);
    },
    materializePluginClone: (args) => {
      captured.auth = args.resolveAuth();
      captured.count += 1;
      return base.materializePluginClone(args);
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

  const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
  const { ctx } = makeCtx();
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
  await installPlugin({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: opts.cwd,
    marketplace: opts.marketplaceName,
    plugin: opts.pluginName,
    cloneCacheSeam: installSeamWith(gitOps),
  });
}

test("a clone-cache seam non-Error rejection becomes a complete skipped outcome", async () => {
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
      // The cold pinned cache reaches the clone through `resolvePluginPin`
      // then `materializePluginClone`.
      await rm(cloneRoot, { recursive: true, force: true });
      const { gitOps } = createGitOps({ cloneThrows: new Error("unexpected clone") });
      const rejectNonError = Promise.reject.bind(Promise);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: {
          ...installSeamWith(gitOps),
          materializePluginClone: () => rejectNonError("clone-cache string failure"),
        },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        notes: ["clone-cache string failure"],
        reasons: ["no longer installable"],
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
      const { gitOps, state: gitState } = createGitOps({
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
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        deviceFlowHttp: deviceFlow.http,
        cloneCacheSeam: seam,
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

test("plugin reinstall authentication: a host the registry does not claim threads a host-keyed bundle", async () => {
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
      const { gitOps } = createGitOps({ fixtureSourceDir: path.join(cwd, "repo-fixture") });
      const { seam, captured } = capturingReinstallSeam(gitOps);
      const { credentialOps, calls: credentialCalls } = createCredentialOpsFake({
        boundary: "memory",
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        credentialOps,
        cloneCacheSeam: seam,
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(captured.count, 1);
      assert.deepStrictEqual(
        { credentialOps: captured.auth?.credentialOps, host: captured.auth?.host },
        { credentialOps, host: "gitlab.example.com" },
      );
      // Attaching a bundle consults nothing on its own: the credential helper
      // is queried only when the server issues a challenge, and this clone
      // succeeds without one.
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
        provenance: "explicit" as const,
        compatibility: {
          installable: true,
          notes: [] as string[],
          supported: [] as string[],
          unsupported: [] as string[],
        },
        resources: {
          skills: [],
          prompts: [],
          agents: [],
          mcpServers: [],
          hooks: [],
          workflows: [],
        },
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
      const { gitOps } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const bundles: (GitAuthBundle | undefined)[] = [];
      const base = installSeamWith(gitOps);
      const seam: UpdateCloneCacheSeam = {
        ...base,
        materializePluginClone: (args) => {
          bundles.push(args.resolveAuth());
          return base.materializePluginClone(args);
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
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
        credentialOps,
        deviceFlowHttp: deviceFlow.http,
        cloneCacheSeam: seam,
      });
      const firstBundle = bundles[0];
      const secondBundle = bundles[1];
      if (firstBundle?.kind !== "device-flow" || secondBundle?.kind !== "device-flow") {
        throw new Error("expected one device-flow auth bundle for each cold-cache reinstall");
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
      // arrange
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo", sha: GIT_SOURCE_SHA },
      });

      // act
      // A GitOps stub whose clone AND resolveRemoteRef both throw: any network
      // touch fails the reinstall. The warm cache must short-circuit both.
      const { gitOps, state: gitState } = createGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
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
      // arrange
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

      // act
      const { gitOps } = createGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();
      await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      const after = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.ok(after !== undefined, "the record survives the reinstall");
      assert.equal(after.resolvedSha, GIT_SOURCE_SHA, "resolvedSha carried forward (not dropped)");
      assert.equal(after.version, before.version, "the version the copy declares (unchanged here)");
      assert.equal(after.installedAt, before.installedAt, "same installedAt (reinstall identity)");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a cold-cache git-source reinstall re-materializes from the entry's pinned sha without re-resolving the ref", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-cold-"));
    try {
      // arrange
      // The manifest's .git suffix survives onto the wire URL (source.raw)
      // while the parse-time identity (source.url) drops it, so this fixture
      // also discriminates networkCloneUrl from canonicalCloneUrl.
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "url", url: "https://example.com/org/repo.git", sha: GIT_SOURCE_SHA },
      });

      const locations = locationsFor("project", cwd);
      // Evict the warm clone so the reinstall hits a cold cache and must
      // re-materialize (network on cache-miss is allowed, NFR-5 amended).
      const key = pluginCloneKey("https://example.com/org/repo", GIT_SOURCE_SHA);
      const cloneRoot = await locations.pluginCloneDir(key);
      await rm(cloneRoot, { recursive: true, force: true });

      // act
      // A gitOps that copies the fixture back on clone (does NOT throw on
      // clone) but whose resolveRemoteRef still throws: the pin must come from
      // the entry's sha (here also the recorded one), never from a ref
      // re-resolution.
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const { gitOps, state: gitState } = createGitOps({
        fixtureSourceDir: fixtureRepoDir,
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.equal(outcome.partition, "reinstalled", "cold-cache reinstall re-materializes");
      assert.equal(gitState.cloneCalls.length, 1, "one clone on the cold cache");
      assert.equal(
        gitState.cloneCalls[0]?.url,
        "https://example.com/org/repo.git",
        "the wire url preserves the manifest's .git decision (source.raw)",
      );
      assert.equal(
        gitState.checkoutCalls[0]?.ref,
        GIT_SOURCE_SHA,
        "checkout pins the entry's sha, not a re-resolved ref",
      );
      assert.equal(gitState.resolveRemoteRefCalls.length, 0, "no ref re-resolution");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-03: reinstalling a pinned GitHub-source plugin whose clone is gone fails the command on an invalid base", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-ghb03-"));
    try {
      // arrange
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
      });
      const locations = locationsFor("project", cwd);
      await rm(
        await locations.pluginCloneDir(
          pluginCloneKey("https://github.com/org/repo", GIT_SOURCE_SHA),
        ),
        { recursive: true, force: true },
      );
      setGitHubBaseUrl(t, "http://mirror.example");
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      const { gitOps, state: gitState } = createGitOps({ fixtureSourceDir: fixtureRepoDir });
      const { ctx, verifyBoundary } = createNotificationBoundary(0);

      // act & assert
      await assert.rejects(
        () =>
          reinstallPlugin({
            ctx,
            run: runWithNothingLoaded(),
            scope: "project",
            cwd,
            marketplace: "mp",
            plugin: "gp",
            cloneCacheSeam: reinstallSeamWith(gitOps),
          }),
        (error: unknown) => {
          assert.deepStrictEqual(
            error,
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          );
          return true;
        },
      );
      assert.deepStrictEqual(gitState.cloneCalls, []);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("GHB-03 / D-18-16: an invalid GitHub base fails a reinstall of a GitHub-source plugin even on a warm cache", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-ghb-warm-"));
    try {
      // arrange
      // D-18-16: a misconfiguration the user must fix. The shared probe builds
      // the host auth bundle before it reads the cache, as `update` does, so a
      // warm copy does not exempt the reinstall.
      await seedInstalledGitSourcePlugin({
        cwd,
        marketplaceName: "mp",
        pluginName: "gp",
        source: { source: "github", repo: "org/repo", sha: GIT_SOURCE_SHA },
      });
      const locations = locationsFor("project", cwd);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      setGitHubBaseUrl(t, "http://mirror.example");
      const { gitOps, state: gitState } = createGitOps({
        cloneThrows: new Error("network unreachable: clone"),
      });
      const { ctx, run } = makeCtx();

      // act & assert
      await assert.rejects(
        () =>
          reinstallPlugin({
            ctx,
            run,
            scope: "project",
            cwd,
            marketplace: "mp",
            plugin: "gp",
            render: "none",
            cloneCacheSeam: reinstallSeamWith(gitOps),
          }),
        (error: unknown) => {
          assert.deepStrictEqual(
            error,
            new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme"),
          );
          return true;
        },
      );
      assert.deepStrictEqual(gitState.cloneCalls, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a git-subdir reinstall honors clone-root subdir containment (pluginRoot under the clone root)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-purl-subdir-"));
    try {
      // arrange
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

      // act
      const { gitOps } = createGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
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
// MIRR-06 / D-18-04 / PRL-07 -- an unpinned git-source reinstall reads, offline,
// the commit the mirror last fetched for the ref the entry declares, and
// copies that commit. Only a missing mirror is a cache miss: reinstall clones
// it once (the NFR-5 cache-miss allowance) and installs its HEAD; a failed
// clone skips the reinstall.
// ───────────────────────────────────────────────────────────────────────────

const MIRROR_HEAD_SHA = "b2c3d4e5f60718293a4b5c6d7e8f90123456789a";

/**
 * Build a git plugin tree at `pluginRoot` and stamp a minimal `.git/HEAD` at
 * `mirrorRoot` holding `headSha` (detached-HEAD form), the shape a real clone
 * leaves. The shared probe reads the commit through the git-ops fake, which a
 * case seeds with the same sha.
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
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: [],
            },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });
}

test("GIT-01 / D-18-04 / D-18-11: an unpinned reinstall of a record on the mirror copies the default branch the mirror last fetched with no network call", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-warm-"));
    try {
      // arrange
      // IN-01: the record names the mirror as its `resolvedSource`, the shape a
      // record made before per-commit copies has.
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await writeMirrorTree(mirrorRoot, mirrorRoot, "gp", MIRROR_HEAD_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        resolvedSource: mirrorRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "url", url: cloneUrl },
      });
      // A gitOps whose clone AND resolveRemoteRef both throw: any network touch
      // fails the reinstall.
      const { gitOps, state: gitState } = createGitOps({
        head: MIRROR_HEAD_SHA,
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        version: "9.9.9",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
      assert.deepStrictEqual(
        {
          clone: gitState.cloneCalls,
          fetch: gitState.fetchCalls,
          resolveRemoteRef: gitState.resolveRemoteRefCalls,
        },
        { clone: [], fetch: [], resolveRemoteRef: [] },
      );
      // D-18-11: a record on the mirror moves onto its own copy of the commit.
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.deepStrictEqual(
        {
          resolvedSource: record?.resolvedSource,
          resolvedSha: record?.resolvedSha,
          version: record?.version,
        },
        {
          resolvedSource: await locations.pluginCloneDir(pluginCloneKey(cloneUrl, MIRROR_HEAD_SHA)),
          resolvedSha: MIRROR_HEAD_SHA,
          version: "9.9.9",
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("REI-04 / D-18-04: an unpinned reinstall copies the commit the mirror last fetched for the declared ref, not the commit checked out for another ref", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-ref-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const releaseSha = "c3d4e5f60718293a4b5c6d7e8f90123456789abc";
      const locations = locationsFor("project", cwd);
      const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      await writeMirrorTree(mirrorRoot, mirrorRoot, "gp", MIRROR_HEAD_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        resolvedSource: mirrorRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "url", url: cloneUrl, ref: "release" },
      });
      // Another source of the same repository last checked out the default
      // branch; the `release` branch was fetched earlier.
      const { gitOps, state: gitState } = createGitOps({
        head: MIRROR_HEAD_SHA,
        fetchedRefs: { "refs/remotes/origin/release": releaseSha },
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        version: "9.9.9",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
      });
      assert.deepStrictEqual(
        {
          clone: gitState.cloneCalls,
          fetch: gitState.fetchCalls,
          resolveRemoteRef: gitState.resolveRemoteRefCalls,
        },
        { clone: [], fetch: [], resolveRemoteRef: [] },
      );
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.deepStrictEqual(
        { resolvedSource: record?.resolvedSource, resolvedSha: record?.resolvedSha },
        {
          resolvedSource: await locations.pluginCloneDir(pluginCloneKey(cloneUrl, releaseSha)),
          resolvedSha: releaseSha,
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("MIRR-06 / D-18-04: an unpinned reinstall with no mirror clones it once and installs its HEAD", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-persha-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      // Old-design record: anchored to a per-sha clone, no mirror directory.
      const perShaRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, GIT_SOURCE_SHA));
      await writeMirrorTree(perShaRoot, perShaRoot, "gp", GIT_SOURCE_SHA);
      await seedUnpinnedGitRecord({
        cwd,
        resolvedSource: perShaRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: { source: "url", url: cloneUrl },
      });
      const fixtureRepoDir = path.join(cwd, "repo-fixture");
      await writeMirrorTree(fixtureRepoDir, fixtureRepoDir, "gp", MIRROR_HEAD_SHA);
      const { gitOps, state: gitState } = createGitOps({
        head: MIRROR_HEAD_SHA,
        fixtureSourceDir: fixtureRepoDir,
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepStrictEqual(
        gitState.cloneCalls.map((call) => call.url),
        [cloneUrl],
      );
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.deepStrictEqual(
        { resolvedSource: record?.resolvedSource, resolvedSha: record?.resolvedSha },
        {
          resolvedSource: await locations.pluginCloneDir(pluginCloneKey(cloneUrl, MIRROR_HEAD_SHA)),
          resolvedSha: MIRROR_HEAD_SHA,
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-18-04: an unpinned reinstall whose mirror clone fails is skipped and materializes nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-mirror-cold-"));
    try {
      // arrange
      const cloneUrl = "https://example.com/org/repo";
      const locations = locationsFor("project", cwd);
      // The record points at a per-sha clone that does NOT exist on disk, and
      // there is no mirror directory: a truly cold source.
      const perShaRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, GIT_SOURCE_SHA));
      await seedUnpinnedGitRecord({
        cwd,
        resolvedSource: perShaRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: { source: "url", url: cloneUrl },
      });
      const { gitOps, state: gitState } = createGitOps({
        cloneThrows: new Error("network unreachable: clone"),
        resolveRemoteRefThrows: new Error("network unreachable: resolveRemoteRef"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        notes: ["network unreachable: clone"],
        reasons: ["no longer installable"],
      });
      assert.equal(gitState.cloneCalls.length, 1);
      // Neither a mirror nor a per-commit copy is left behind.
      assert.deepStrictEqual(await entriesOf(locations.pluginClonesDir), []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// SUB-02 -- end-to-end ${CLAUDE_PROJECT_DIR} delivery through the reinstall path
//
// the shared swap's prepare step threads `cwd` into every stage input by hand
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
      // arrange
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

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
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
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md"),
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
      // arrange
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

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "user",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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
        path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md"),
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
      // arrange
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

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
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
      // arrange
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

      // act
      const { ctx, run, notifications } = makeCtx();
      await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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

test("WR-09: a clean reinstall row carries no brace and no raise", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-wr09-clean-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      // act
      const { ctx, run, notifications } = makeCtx();
      await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
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

test("LAYER-04: a reinstall over an unreadable base layer reinstalls, renders only its row, and leaves the layer unchanged", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-shared-invalid-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", command: "old command" },
        install: true,
      });
      await writeFile(locations.baseConfigJsonPath, "{ not json ", "utf8");

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(notifications, [HELLO_REINSTALLED_ROW]);
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), "{ not json ");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("PRL-10: a source that stopped being installable skips the reinstall with the typed reason", async () => {
  // The manifest entry's source is rewritten to an unsupported kind after the
  // path-source install. The preflight maps the resolver's typed shape to the
  // reason; the notes-substring fallback would land on the permissive
  // `not in manifest` and misdescribe the skip.
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-shape-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const { manifestPath } = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
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
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const cloneCalls: string[] = [];
      function refuseClone(member: string): () => Promise<never> {
        return () => {
          cloneCalls.push(member);
          return Promise.reject(new Error(`${member} must not run`));
        };
      }

      const cloneCacheSeam: UpdateCloneCacheSeam = {
        resolvePluginPin: refuseClone("resolvePluginPin"),
        materializePluginClone: refuseClone("materializePluginClone"),
        materializeOrRefreshPluginMirror: refuseClone("materializeOrRefreshPluginMirror"),
        materializePluginCommitCopy: refuseClone("materializePluginCommitCopy"),
      };
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        cloneCacheSeam,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        notes: [
          'Plugin "hello" is no longer installable: unsupported source kind: unknown (unrecognized source kind: unsupported-kind)',
        ],
        reasons: ["no longer installable"],
      });
      assert.doesNotMatch(notifications.map((n) => n.message).join("\n"), /\{not in manifest\}/);
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {no longer installable}",
          severity: "warning",
        },
      ]);
      assert.deepStrictEqual(cloneCalls, []);
      assert.equal(await readFile(locations.stateJsonPath, "utf8"), stateBefore);
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
  opts: {
    readonly pluginName?: string;
    readonly marketplaceRoot?: string;
    /** WLIF-01: source names to declare, each landing as one envelope. */
    readonly workflows?: readonly string[];
  } = {},
): Promise<{ readonly skillDir: string; readonly envelopePaths: readonly string[] }> {
  const pluginName = opts.pluginName ?? "hello";
  const workflows = opts.workflows ?? [];
  await seedMarketplace({
    cwd,
    marketplaceRoot: opts.marketplaceRoot ?? path.join(cwd, "mp-src"),
    pluginName,
    resources: {
      skill: "old skill",
      command: "old command",
      workflows: workflows.map((sourceName) => ({ sourceName })),
    },
    install: true,
  });
  await markRecordedPluginDisabled(cwd, "mp", pluginName);

  const locations = locationsFor("project", cwd);
  const skillDir = path.join(locations.skillsTargetDir, `${pluginName}-tool`);
  await rm(skillDir, { recursive: true, force: true });
  // The envelopes are deliberately NOT removed: a disabled record keeps its
  // recorded inventory, and the point of the disabled case is that reinstall
  // leaves those bytes exactly where they are.
  return {
    skillDir,
    envelopePaths: workflows.map((sourceName) =>
      path.join(locations.workflowsSavedDir, `${pluginName}:${sourceName}.json`),
    ),
  };
}

// Re-staging artifacts and flipping a disabled record to enabled here would
// let a verb invoked to repair a plugin silently turn it back on, over a
// configuration that still says it is off, until the next reload undid that.
// Reinstall over a disabled record must write and stage nothing instead.
test("DFEN-07 / D-103-12 / ENBL-18: reinstall over a disabled record writes nothing and stages nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-disabled-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const { skillDir, envelopePaths } = await seedDisabledInstall(cwd, {
        workflows: ["greet"],
      });
      const envelopePath = envelopePaths[0];
      assert.ok(envelopePath !== undefined);
      const envelopeBefore = await readFile(envelopePath, "utf8");

      const recordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(recordBefore !== undefined);
      assert.equal(recordBefore.enabled, false);
      const stateBefore = await readFile(locations.stateJsonPath, "utf8");
      const configBefore = await readFile(locations.baseConfigJsonPath, "utf8");

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
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
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), configBefore);
      assert.equal(await pathExists(skillDir), false, "nothing may be re-materialized");
      // WLIF-01: the recorded envelope is left exactly as it was -- the
      // disabled skip runs before any prepare, so nothing displaces it.
      assert.equal(await readFile(envelopePath, "utf8"), envelopeBefore);
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
      // arrange
      await seedDisabledInstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallDefault(cwd, ctx, run);

      // assert
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
      // arrange
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "keeper",
        resources: { skill: "keeper skill" },
        install: true,
      });
      await seedDisabledInstall(cwd, { marketplaceRoot, pluginName: "sleeper" });
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
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
      // arrange
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

      // act
      const { ctx, run, notifications } = makeCtx();
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
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
      // arrange
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

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
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

for (const mode of ["json", "rpc"]) {
  test(`appends reinstall discovery diagnostics after the cascade in ${mode}`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-machine-diagnostics-"));
      try {
        const { pluginRoot } = await seedMarketplace({
          cwd,
          marketplaceRoot: path.join(cwd, "mp-src"),
          resources: { skill: "old skill" },
        });
        const capture = createJsonCapture();
        const ctx = {
          mode,
          get ui() {
            return capture.ui;
          },
        };
        const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
        const installPlugin = createInstallOperation(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
        );
        await installPlugin({
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          notifications: { mode: "orchestrated" },
        });
        await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

        // act
        const outcomes = await reinstallPlugins({
          ctx,
          run,
          cwd,
          target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        });

        // assert
        assert.strictEqual(outcomes[0]?.partition, "reinstalled");
        assert.strictEqual(
          (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces["mp"]?.plugins[
            "hello"
          ]?.version,
          "1.0.0",
        );
        assert.deepStrictEqual(capture.entries, [
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
              kind: "cascade",
              severity: "info",
              needsReload: true,
              marketplaces: [
                {
                  name: "mp",
                  scope: "project",
                  plugins: [
                    {
                      name: "hello",
                      id: "hello@mp",
                      scope: "project",
                      reasons: [],
                      status: "reinstalled",
                      version: "1.0.0",
                    },
                  ],
                },
              ],
            },
          },
          {
            customType: "claude-plugin",
            payload: {
              schemaVersion: 1,
              origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
              kind: "diagnostic",
              severity: "warning",
              needsReload: false,
              header: 'Plugin "hello" reinstalled; 1 declared component has a note.',
              lines: [
                'skill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
              ],
            },
          },
        ]);
        capture.assertValid();
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("D-141-03: a standalone reinstall surfaces a skills discovery warning after the row", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-"));
    try {
      // arrange
      const marketplaceRoot = path.join(cwd, "mp-src");
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot,
        resources: { skill: "old skill" },
        install: true,
      });
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

      // act
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
      const run = runWithNothingLoaded();
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.equal(outcomes[0]?.partition, "reinstalled");
      assert.deepStrictEqual(notifications, [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "hello" reinstalled; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
      // NFR-9: the absolute skills directory is redacted to its basename.
      assert.ok(
        !notifications.some((n) => n.message.includes(marketplaceRoot)),
        `absolute path leaked: ${JSON.stringify(notifications)}`,
      );
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: a bulk reinstall surfaces one diagnostic per plugin, singular and plural", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-bulk-"));
    try {
      // arrange
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

      // act
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
      const run = runWithNothingLoaded();
      await reinstallPlugins({ ctx, run, cwd, target: { kind: "all" } });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n  ● world v1.0.0 (reinstalled)\n\nPlugin reinstall: 2 successes\n\n/reload to pick up changes",
        },
        {
          message:
            'Plugin "hello" reinstalled; 1 declared component has a note.\n\nskill source "hello-foo" in "skills" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
        {
          message:
            'Plugin "world" reinstalled; 2 declared components have notes.\n\nskill source "world-bar" in "skills" elides to generated name "world-bar", already produced by skill source "bar"; ignoring duplicate.\nskill source "world-foo" in "skills" elides to generated name "world-foo", already produced by skill source "foo"; ignoring duplicate.',
          severity: "warning",
        },
      ]);
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: an orchestrated reinstall carries the discovery half on notes and on discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-discwarn-orch-"));
    try {
      // arrange
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);

      // act
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
      const run = runWithNothingLoaded();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepStrictEqual(notifications, []);
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
      verifyBoundary();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a clean reinstall outcome carries neither notes nor discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nreg-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });

      // act
      const { ctx, run } = makeCtx();
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.ok(!Object.hasOwn(outcome, "notes"), JSON.stringify(outcome));
      assert.ok(!Object.hasOwn(outcome, "discoveryWarnings"), JSON.stringify(outcome));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("NREG-01: a hygiene-only reinstall carries neither notes nor discoveryWarnings", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-nreg-hyg-"));
    try {
      // arrange
      // The agent has no `description`, so the HYGIENE half is non-empty while
      // the discovery half stays empty. The shared swap carries only the
      // discovery half in direct mode, so neither carrier key appears.
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", agent: "old agent" },
        install: true,
      });
      const { ctx, run } = makeCtx({ piSubagentsLoaded: true });

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: ["pi-claude-marketplace-hello-bot"],
        stagedMcpServerNames: [],
        declaresAgents: true,
        declaresMcp: false,
        declaresWorkflows: false,
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("D-141-03: a reinstall carries its discovery warning on notes and drops the agents hygiene warning", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-hygwarn-"));
    try {
      // arrange
      // `writePluginTree` writes the agent frontmatter with no `description`,
      // which the agents bridge reports as a hygiene note. The colliding skills
      // beside it give a discovery warning: without that positive control the
      // absence below would also pass if the split returned nothing.
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", agent: "old agent" },
        install: true,
      });
      await seedCollidingSkills(pluginRoot, "hello", ["foo"]);
      function elision(skillsDir: string): string {
        return `skill source "hello-foo" in "${skillsDir}" elides to generated name "hello-foo", already produced by skill source "foo"; ignoring duplicate.`;
      }

      // The outcome carries the absolute directory; the rendered row redacts it.
      const discovery = elision(path.join(pluginRoot, "skills"));
      const orchestrated = makeCtx({ piSubagentsLoaded: true });
      const standalone = makeCtx({ piSubagentsLoaded: true });

      // act
      const orchestratedOutcome = await reinstallPlugin({
        ctx: orchestrated.ctx,
        run: orchestrated.run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });
      await reinstallPlugins({
        ctx: standalone.ctx,
        run: standalone.run,
        cwd,
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.ok(orchestratedOutcome.partition === "reinstalled");
      assert.deepStrictEqual(orchestratedOutcome.notes, [`warning: ${discovery}`]);
      assert.deepStrictEqual(orchestratedOutcome.discoveryWarnings, [discovery]);
      assert.deepStrictEqual(orchestrated.notifications, []);
      assert.deepStrictEqual(standalone.notifications, [
        {
          message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
        },
        {
          message: `Plugin "hello" reinstalled; 1 declared component has a note.\n\n${elision("skills")}`,
          severity: "warning",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WGATE-01 / D-115-05: the workflows discovery channel on a standalone reinstall
//
// The families below are the `WorkflowOutcomeSite` union
// (`bridges/workflows/discover.ts`) measured member by member, not a shorter
// list of the interesting ones: `gate`, `skipped`, `refused`, `read`,
// `oversize` and `inspect`. Every one of them rides the single
// `handles.workflows.result.warnings` array, so a verb that drops that array
// drops all six at once.
//
// `inspect` cannot share a directory with the other five. It fires when
// `lstat` fails on an entry `readdir` returned, which needs the directory's
// execute bit cleared -- and that also stops every sibling in the same
// directory from being opened. It gets its own case below.
// ──────────────────────────────────────────────────────────────────────────

/**
 * One script per family, named so the discovery walk's name sort is the order
 * the expectations below are written in. `ff-fine.js` is well-formed: it earns
 * no line, which is what keeps the expected list from passing as a prefix of a
 * channel that warns about everything.
 */
const WORKFLOW_FAMILY_SCRIPTS: readonly { readonly sourceName: string; readonly body: string }[] = [
  // named + gate: a readable `meta.name`, no description -- the engine's check 9.
  { sourceName: "aa-gate", body: 'export const meta = { name: "gate" };\n' },
  // skipped: a helper module with no `meta` at all.
  { sourceName: "bb-helper", body: "export function helper() {\n  return 1;\n}\n" },
  // refused: a determinism-blocklist match.
  {
    sourceName: "cc-roll",
    body: 'export const meta = { name: "roll", description: "rolls" };\nMath.random();\n',
  },
  // skipped, differently: a `meta` with no name at all, so no command name is readable.
  {
    sourceName: "dd-nameless",
    body: 'export const meta = { description: "a helper with no name" };\n',
  },
  // oversize: one byte past the cap Claude Code's loader imposes.
  { sourceName: "ee-big", body: "/".repeat(WORKFLOW_SCRIPT_MAX_BYTES + 1) },
  // ff-fine earns no warning.
  { sourceName: "ff-fine", body: 'export const meta = { name: "fine", description: "fine" };\n' },
];

/**
 * The `read` family's script, written as raw bytes because the reason under
 * test is the decoder's: `0xff 0xfe` is not valid UTF-8 in any position, which
 * is deterministic on every platform and is not a permission the test process
 * might hold. `writeFile` with a string cannot produce it -- every JavaScript
 * string encodes to valid UTF-8.
 */
async function writeUnreadableWorkflowScript(pluginRoot: string): Promise<void> {
  await writeFile(
    path.join(pluginRoot, "workflows", "ee-bad.js"),
    Buffer.from([0x65, 0x78, 0xff, 0xfe, 0x0a]),
  );
}

/** The rendered line each family earns, in directory-entry-name order. */
const EXPECTED_FAMILY_LINES: readonly string[] = [
  'workflow script "aa-gate.js" in "workflows" was installed but the engine will refuse to load it: the engine refuses at its check 9 -- `meta.description` must be a non-empty string, and `meta.model` (a string) and `meta.phases` (an array of objects each carrying a string `title`) must match those shapes wherever they are declared',
  'workflow script "bb-helper.js" in "workflows" was not installed: bb-helper.js declares no `meta`, so there is nothing to install',
  'workflow script "cc-roll.js" in "workflows" was refused: cc-roll.js calls `Math.random`, which the workflow engine refuses as nondeterministic',
  'workflow script "dd-nameless.js" in "workflows" was not installed: dd-nameless.js declares no string-literal `meta.name`, so there is no command to install',
  'workflow script "ee-bad.js" in "workflows" could not be read and was skipped: the file is not valid UTF-8, so its bytes cannot be copied verbatim',
  `workflow script "ee-big.js" in "workflows" was not installed: the file is ${(WORKFLOW_SCRIPT_MAX_BYTES + 1).toString()} bytes and Claude Code loads a plugin workflow script only up to ${WORKFLOW_SCRIPT_MAX_BYTES.toString()} bytes`,
];

/**
 * Seed a plugin carrying `workflows`, install it, then run the reinstall a user
 * reaches -- `reinstallPlugins`, which drives `reinstallPlugin` with
 * `render: "none"` and renders the cascade itself.
 *
 * `mutate` runs after the install and before the reinstall, for a fixture the
 * seeder's string-bodied entries cannot express.
 */
async function standaloneReinstallNotifications(
  cwd: string,
  workflows: readonly { readonly sourceName: string; readonly body?: string }[],
  mutate?: (pluginRoot: string) => Promise<void>,
): Promise<readonly NotifyRecord[]> {
  const { pluginRoot } = await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { skill: "old skill", workflows },
    install: true,
  });
  if (mutate !== undefined) {
    await mutate(pluginRoot);
  }

  const { ctx, run, notifications } = makeCtx();
  const outcomes = await reinstallPlugins({
    ctx,
    run,
    cwd,
    target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
  });
  assert.equal(outcomes[0]?.partition, "reinstalled");
  return notifications;
}

test("WGATE-01 / D-115-05: a standalone reinstall renders every workflow discovery family", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflow-families-"));
    try {
      // act
      const notifications = await standaloneReinstallNotifications(
        cwd,
        WORKFLOW_FAMILY_SCRIPTS,
        writeUnreadableWorkflowScript,
      );

      // assert -- the reinstall row, then the diagnostic block that qualifies it.
      assert.equal(notifications.length, 2, JSON.stringify(notifications));
      const row = notifications[0];
      const diagnostic = notifications[1];
      assert.ok(row !== undefined);
      assert.ok(diagnostic !== undefined);
      assert.equal(diagnostic.severity, "warning");
      // Per-family attribution first: a changed phrase names its own line here,
      // where the whole-message comparison below would only name the block.
      assert.deepEqual(
        diagnostic.message.split("\n").filter((line) => line.startsWith("workflow script ")),
        EXPECTED_FAMILY_LINES,
      );
      // Then the whole block, byte for byte -- the header, the blank-line
      // separator and the line order, none of which the filter above sees.
      //
      // The header counts the lines and claims no disposal, because one of the
      // six components below it WAS installed -- the one the host engine will
      // refuse to load. It is shared by install, update and reinstall.
      assert.equal(
        diagnostic.message,
        `Plugin "hello" reinstalled; 6 declared components have notes.\n\n${EXPECTED_FAMILY_LINES.join("\n")}`,
      );
      // WGATE-03: the row itself states no gate. The channel is a second
      // notification precisely so the row is free of it.
      assert.doesNotMatch(row.message, /engine will refuse/);
      assert.doesNotMatch(row.message, /check 9/);
      assert.doesNotMatch(row.message, /aa-gate/);
      // NFR-9: the temporary marketplace root never reaches the user.
      assert.ok(!diagnostic.message.includes(cwd), diagnostic.message);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WGATE-01 / D-115-05: a standalone reinstall reports a workflow script it could not inspect", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflow-inspect-"));
    let lockedDir: string | undefined;
    try {
      // arrange -- clearing the directory's execute bit is what makes the
      // `lstat` inside it fail while `readdir` still returns the entry, which
      // is the only shape that reaches the `inspect` site.
      const notifications = await standaloneReinstallNotifications(
        cwd,
        [{ sourceName: "gg-locked" }],
        async (pluginRoot) => {
          lockedDir = path.join(pluginRoot, "workflows");
          await chmod(lockedDir, 0o444);
        },
      );

      // assert
      assert.ok(lockedDir !== undefined);
      const diagnostic = notifications.find((n) => n.message.includes("could not be inspected"));
      assert.ok(diagnostic !== undefined, JSON.stringify(notifications));
      assert.equal(diagnostic.severity, "warning");
      assert.ok(
        diagnostic.message.includes(
          `workflow script "gg-locked.js" in "workflows" could not be inspected and was skipped: EACCES: permission denied, lstat 'gg-locked.js'`,
        ),
        diagnostic.message,
      );
    } finally {
      if (lockedDir !== undefined) {
        // Restored before the removal below, which cannot walk a directory it
        // may not enter.
        await chmod(lockedDir, 0o755).catch(() => undefined);
      }

      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WGATE-01 / D-115-05: a standalone reinstall of well-formed workflow scripts emits one notification", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflow-clean-"));
    try {
      // act -- both scripts carry a literal name and a non-empty description,
      // so no family fires.
      const notifications = await standaloneReinstallNotifications(cwd, [
        { sourceName: "greet" },
        { sourceName: "wave" },
      ]);

      // assert -- without this case, "the second notification contains X" is
      // satisfiable by a second notification that is always emitted.
      assert.equal(notifications.length, 1, JSON.stringify(notifications));
      assert.doesNotMatch(notifications[0]?.message ?? "", /declared component/);
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
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
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
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

test(
  "a marketplace removed between scope resolution and enumeration reports not added",
  { skip: FIFO_SKIP, timeout: 60_000 },
  async () => {
    await withHermeticHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-concurrent-marketplace-removal-"));
      let stateServer: FifoStateServer | undefined;
      try {
        // arrange: state.json is a FIFO. Its FIRST read -- the unlocked scope
        // resolution -- sees the marketplace; its SECOND read -- the
        // enumeration pass -- sees it gone, removed by the other process. The
        // pipe pairs each read with one payload, so the removal provably lands
        // between them.
        //
        // The earlier shape forced the IL-3 migration-save warning by stealing
        // `write-file-atomic`'s temp file mid-rename. That was a race against
        // library internals, and the warning it proved is covered directly by
        // test/persistence/migrate.test.ts, so it is gone from here.
        const locations = locationsFor("project", cwd);
        await mkdir(locations.extensionRoot, { recursive: true });

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
              plugins: {},
            },
          },
        });
        const removedState = await serializedStateBytes({ schemaVersion: 2, marketplaces: {} });

        const userLocations = locationsFor("user", cwd);
        await mkdir(userLocations.extensionRoot, { recursive: true });
        await writeFile(userLocations.stateJsonPath, removedState, "utf8");

        createStateFifo(locations.stateJsonPath);
        stateServer = startFifoStateServer({
          statePath: locations.stateJsonPath,
          payloads: [presentState, removedState],
        });
        await stateServer.ready;
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcomes = await reinstallPlugins({
          ctx,
          run,
          cwd,
          target: { kind: "marketplace", marketplace: "mp" },
        });
        const serverResult = await stateServer.complete;

        // assert
        assert.deepEqual(
          stateServer.messages,
          ["ready", "served:1", "served:2"],
          "reinstall must read state.json exactly twice: once to resolve, once to enumerate",
        );
        assert.deepEqual(serverResult, { code: 0, signal: null });
        assert.equal(stateServer.stderr(), "");
        assert.deepEqual(outcomes, []);
        assert.equal(notifications.length, 1);
        assert.equal(
          notifications[0]?.message,
          "A marketplace operation has failed.\n\n⊘ mp (failed) {marketplace not added}",
        );
        // A write renames the orchestrator's own file over the state path,
        // so the harness sentinel surviving proves the aborted reinstall left
        // state.json alone.
        assert.equal(
          await readFile(locations.stateJsonPath, "utf8"),
          OVER_READ_SENTINEL,
          "a marketplace-not-added abort must leave state.json untouched",
        );
      } finally {
        stateServer?.kill();
        await rm(cwd, { recursive: true, force: true });
      }
    });
  },
);

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
        const { ctx, run, notifications } = makeCtx();

        // act
        const outcome = await reinstallPlugin({
          ctx,
          run,
          scope: "project",
          cwd,
          marketplace: "mp",
          plugin: "hello",
          stateTransaction: {
            loadState: () => {
              throw failure();
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

test("LAYER-04: a local single reinstall over an unreadable local layer renders only its row", async () => {
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
      await writeFile(locations.localConfigJsonPath, "{ invalid", "utf8");
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        local: true,
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepEqual(notifications, [HELLO_REINSTALLED_ROW]);
      assert.equal(await readFile(locations.localConfigJsonPath, "utf8"), "{ invalid");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const BASE_ONLY_CAUSE =
  "The plugin hello@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.";

test("LAYER-04: the plugin form of reinstall with --local refuses a plugin only the base layer declares", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-named-local-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const baseConfigBefore = await readFile(locations.baseConfigJsonPath, "utf8");
      const { ctx, run } = makeCtx();

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        run,
        scope: "project",
        cwd,
        target: { kind: "plugin", marketplace: "mp", plugin: "hello" },
        local: true,
      });

      // assert
      assert.deepStrictEqual(outcomes, [
        {
          partition: "failed",
          name: "hello",
          marketplace: "mp",
          scope: "project",
          notes: [`${BASE_ONLY_CAUSE}\n\ncause: ${BASE_ONLY_CAUSE}`],
          reasons: ["plugin in base layer only"],
          cause: new PluginInBaseLayerOnlyError("hello", "mp"),
        },
      ]);
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), baseConfigBefore);
      assert.equal(await pathExists(locations.localConfigJsonPath), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an unpinned git-subdir reinstall copies the default branch the mirror last fetched without external calls", async () => {
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
        resolvedSource: pluginRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "git-subdir", url: cloneUrl, path: "packages/gp" },
      });
      const { gitOps, state: gitState } = createGitOps({
        head: MIRROR_HEAD_SHA,
        cloneThrows: new Error("unexpected clone"),
        resolveRemoteRefThrows: new Error("unexpected remote resolution"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.deepStrictEqual(
        {
          clone: gitState.cloneCalls,
          fetch: gitState.fetchCalls,
          resolveRemoteRef: gitState.resolveRemoteRefCalls,
        },
        { clone: [], fetch: [], resolveRemoteRef: [] },
      );
      const record = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins["gp"];
      assert.deepStrictEqual(
        { resolvedSource: record?.resolvedSource, resolvedSha: record?.resolvedSha },
        {
          resolvedSource: path.join(
            await locations.pluginCloneDir(pluginCloneKey(cloneUrl, MIRROR_HEAD_SHA)),
            "packages",
            "gp",
          ),
          resolvedSha: MIRROR_HEAD_SHA,
        },
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("an unpinned git-subdir reinstall whose mirror lacks the subdirectory is skipped without cloning", async () => {
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
        resolvedSource: mirrorRoot,
        resolvedSha: MIRROR_HEAD_SHA,
        source: { source: "git-subdir", url: cloneUrl, path: "packages/missing" },
      });
      const { gitOps, state: gitState } = createGitOps({
        head: MIRROR_HEAD_SHA,
        cloneThrows: new Error("unexpected clone"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        notes: [
          'Plugin "gp" is no longer installable: git-subdir path "packages/missing" does not exist in the plugin clone',
        ],
        reasons: ["no longer installable"],
      });
      assert.deepEqual(gitState.cloneCalls, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("a pinned git-subdir reinstall whose cached copy lacks the subdirectory is skipped without cloning", async () => {
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
        resolvedSource: cloneRoot,
        resolvedSha: GIT_SOURCE_SHA,
        source: {
          source: "git-subdir",
          url: cloneUrl,
          path: "packages/missing",
          sha: GIT_SOURCE_SHA,
        },
      });
      const { gitOps, state: gitState } = createGitOps({
        cloneThrows: new Error("unexpected clone"),
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "gp",
        render: "none",
        cloneCacheSeam: reinstallSeamWith(gitOps),
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "skipped",
        name: "gp",
        marketplace: "mp",
        scope: "project",
        notes: [
          'Plugin "gp" is no longer installable: git-subdir path "packages/missing" does not exist in the plugin clone',
        ],
        reasons: ["no longer installable"],
      });
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
 *
 * D-18-10: the shared swap writes state twice per reinstall, its intent mark
 * and its finalize. A persistence fault with an `ordinal` refuses only the
 * save at that position in the active schedule (1 is the intent mark, 2 the
 * finalize); without one it refuses every save.
 */
function observeRetryCollaborators(
  schedule: { current: string[] },
  faults?: {
    readonly data?: { enabled: boolean; readonly message: string };
    readonly persistence?: {
      enabled: boolean;
      readonly message: string;
      readonly ordinal?: number;
    };
  },
  loadStateOverride?: typeof loadState,
): Required<Pick<ReinstallPluginOptions, "removeDataDir" | "stateTransaction">> {
  return {
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
        const persistence = faults?.persistence;
        const saves = schedule.current.filter((entry) => entry === "save:state").length;
        if (
          persistence?.enabled === true &&
          (persistence.ordinal === undefined || persistence.ordinal === saves)
        ) {
          throw new Error(persistence.message);
        }

        await saveState(extensionRoot, state);
      },
    },
  };
}

/** A reinstall whose completion-cache drops record into the case's schedule. */
function createRetryReinstall(schedule: {
  current: string[];
}): ReturnType<typeof createReinstallPlugin> {
  const delegate = createCompletionCache();
  const completionCache = createCompletionCacheWithDrop(async (cachePath, scope, marketplace) => {
    schedule.current.push("drop:cache");
    await delegate.dropMarketplaceCache(cachePath, scope, marketplace);
  });
  return createReinstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );
}

/** The doubled `<message>\n\ncause: <message>` shape reinstall folds onto `notes`. */
function retryCauseChain(message: string): string {
  return `${message}\n\ncause: ${message}`;
}

/**
 * The schedule of a reinstall that converged: the swap's intent mark and
 * finalize, its completion-cache refresh, then reinstall's own maintenance
 * (D-18-05, D-18-10).
 */
const CONVERGED_SCHEDULE = ["save:state", "save:state", "drop:cache", "drop:cache", "remove:data"];

// ──────────────────────────────────────────────────────────────────────────
// NFR-3 failure-then-retry proof: every operation is safe to retry --
// idempotent or fail-clean. NFR-2 bounds the recovery model: nothing below
// may need more than a reload.
//
// Every case below calls the SAME exported reinstall entrypoint twice inside
// one test, over one case-owned root, in one mode, against one target or
// ordered target set. Between the two calls it repairs only the injected
// fault -- never the bytes, tree, or residue the first call left behind.
//
// The schedule records the state writes, the completion-cache drops, and the
// plugin-data removal. The bridge commits carry no schedule entry; they are
// proven by the authoritative bytes and the owned-tree inventory.
// ──────────────────────────────────────────────────────────────────────────

test("retry proof: reinstall: skills prepare failure with no prepared handles converges on the same root", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-skills-prepare-"));
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
      const configBytes = await readFile(locations.baseConfigJsonPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const oldCommand = await readCommand(cwd);
      await rm(locations.skillsStagingDir, { force: true, recursive: true });
      await writeFile(locations.skillsStagingDir, "fault: skills staging is not a directory");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule);
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstCommand = await readCommand(cwd);
      await rm(locations.skillsStagingDir, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
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
        declaresWorkflows: false,
        marketplace: "mp",
        name: "hello",
        partition: "reinstalled",
        scope: "project",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        version: "1.0.0",
      });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(await readFile(seeded.manifestPath, "utf8"), manifestBytes);
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), configBytes);
      assert.equal(firstSkill, oldSkill);
      assert.equal(firstCommand, oldCommand);
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
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
          workflows: [],
        },
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: commands prepare failure aborts the one prepared handle and converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-commands-prepare-"));
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
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule);
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      await rm(locations.commandsStagingDir, { force: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
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
        declaresWorkflows: false,
        marketplace: "mp",
        name: "hello",
        partition: "reinstalled",
        scope: "project",
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        version: "1.0.0",
      });
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(await readFile(seeded.manifestPath, "utf8"), manifestBytes);
      assert.equal(firstSkill, oldSkill);
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: MCP prepare failure aborts three prepared handles newest first", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-mcp-prepare-"));
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
      const agentPath = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
      const stateBytes = await readFile(locations.stateJsonPath, "utf8");
      const mcpBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
      const oldAgent = await readFile(agentPath, "utf8");
      await rm(locations.mcpAdapterJsonPath, { force: true });
      await mkdir(locations.mcpAdapterJsonPath, { recursive: true });
      // Read back the runtime's own errno wording: later majors append the offending path to it.
      // The failure's IDENTITY is not runtime-owned, so it is pinned here rather than left to the
      // composition: the probe is the same read production makes, so it moves with whatever is on
      // disk. A fixture that drifted to a missing file would report ENOENT on both sides and leave
      // this case green against a different failure entirely.
      const readFailure = await readFile(locations.mcpAdapterJsonPath, "utf8").catch(
        (error: unknown) => {
          const errno = error as NodeJS.ErrnoException;
          assert.deepStrictEqual(
            { code: errno.code, syscall: errno.syscall },
            { code: "EISDIR", syscall: "read" },
          );
          return errno.message;
        },
      );
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule);
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstAgent = await readFile(agentPath, "utf8");
      await rm(locations.mcpAdapterJsonPath, { force: true, recursive: true });
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });

      // assert
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.equal(first.reasons, undefined);
      assert.deepStrictEqual(first.notes, [retryCauseChain(readFailure)]);
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(second.stagedMcpServerNames, ["server1"]);
      assert.deepStrictEqual(second.stagedAgentNames, ["pi-claude-marketplace-hello-bot"]);
      assert.equal(second.version, "1.0.0");
      // D-18-02: the agents hygiene warning does not ride `notes` in direct mode.
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstAgent, oldAgent);
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "agents/pi-claude-marketplace-hello-bot.md",
        "claude-plugins.json",
        "mcp-adapter.json/",
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
        "agents/pi-claude-marketplace-hello-bot.md",
        "claude-plugins.json",
        "mcp-adapter.json",
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
      assert.equal(await readFile(locations.mcpAdapterJsonPath, "utf8"), mcpBytes);
      assert.match(await readFile(agentPath, "utf8"), /new agent/);
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a refused intent-mark save changes nothing and the retry converges the record", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-hooks-window-"));
    const persistenceFault = { enabled: true, message: "state persistence refused", ordinal: 1 };
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
      const hooksPath = path.join(locations.hooksDir, "hello", "hooks.json");
      const hooksBytes = await readFile(hooksPath, "utf8");
      const oldSkill = await readSkill(cwd);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule, {
        persistence: persistenceFault,
      });
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      const firstSkill = await readSkill(cwd);
      const firstHooks = await readFile(hooksPath, "utf8");
      persistenceFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
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
      // D-18-10: the first save is the swap's intent mark, so the refusal
      // lands before any commit: the hooks subtree and the record's hooks
      // inventory are both untouched.
      assert.deepStrictEqual(firstRecord?.resources.hooks, ["hello"]);
      assert.equal(firstHooks, hooksBytes);
      assert.deepStrictEqual(firstSchedule, ["save:state"]);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
      assert.deepStrictEqual(firstTree, [
        "claude-plugins.json",
        "pi-claude-marketplace/",
        "pi-claude-marketplace/data/",
        "pi-claude-marketplace/data/mp/",
        "pi-claude-marketplace/data/mp/hello/",
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
        {
          agents: [],
          hooks: [],
          mcpServers: [],
          prompts: [],
          skills: ["hello-tool"],
          workflows: [],
        },
      );
      assert.match(await readSkill(cwd), /new skill/);
    } finally {
      persistenceFault.enabled = false;
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a refused finalize save after every commit fails rollback partial and the retry converges", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-persistence-"));
    const persistenceFault = { enabled: true, message: "state persistence refused", ordinal: 2 };
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
      const agentPath = path.join(locations.agentsDir, "pi-claude-marketplace-hello-bot.md");
      const recordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(recordBefore !== undefined);
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule, {
        persistence: persistenceFault,
      });
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      const firstMcpBytes = await readFile(locations.mcpAdapterJsonPath, "utf8");
      const firstAgent = await readFile(agentPath, "utf8");
      const firstSkill = await readSkill(cwd);
      const firstCommand = await readCommand(cwd);
      persistenceFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });

      // assert
      // D-18-10: every commit landed, so the refused finalize is a phase-3
      // failure, not a rollback; the swap reports it against its last bridge.
      const aggregate =
        'Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it.';
      assert.ok(first.partition === "failed");
      const { cause, rollbackPartial, ...firstRest } = first;
      assert.deepStrictEqual(firstRest, {
        partition: "failed",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        notes: [aggregate, "mcp: state finalize failed: state persistence refused"],
        reasons: ["rollback partial"],
      });
      assert.ok(cause instanceof PluginUpdatePhase3Error);
      assert.strictEqual(cause.message, aggregate);
      assert.deepStrictEqual(
        rollbackPartial?.map((child) => ({ phase: child.phase, message: child.cause.message })),
        [{ phase: "mcp", message: "state persistence refused" }],
      );
      // The new bytes are committed, and the record still carries the swap's
      // in-progress marker from the intent mark.
      assert.deepStrictEqual(JSON.parse(firstMcpBytes), {
        mcpServers: {
          plugin_hello_server1_: {
            command: "node",
            args: ["server.js"],
            env: {
              CLAUDE_PLUGIN_ROOT: seeded.pluginRoot,
              CLAUDE_PLUGIN_DATA: await locations.pluginDataDir("mp", "hello"),
            },
            directTools: "search",
            toolPrefix: "mcp",
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
      assert.match(firstAgent, /new agent/);
      assert.match(firstSkill, /new skill/);
      assert.match(firstCommand, /new command/);
      // ST-9: the intent mark also restamps the record, so a run that read it
      // before the mark fails as concurrently updated.
      assert.ok(firstRecord !== undefined);
      const { updatedAt: markedStamp, ...markedFields } = firstRecord;
      const { updatedAt: readStamp, ...readFields } = recordBefore;
      assert.deepStrictEqual(markedFields, {
        ...readFields,
        compatibility: {
          installable: false,
          notes: ["update-in-progress"],
          supported: ["skills", "commands", "agents"],
          unsupported: [],
        },
      });
      assert.ok(markedStamp > readStamp, `${markedStamp} is not later than ${readStamp}`);
      assert.deepStrictEqual(second, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: ["pi-claude-marketplace-hello-bot"],
        stagedMcpServerNames: ["server1"],
        declaresAgents: true,
        declaresMcp: true,
        declaresWorkflows: false,
      });
      const finalRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(finalRecord !== undefined);
      const { updatedAt: _finalStamp, ...finalFields } = finalRecord;
      assert.deepStrictEqual(finalFields, readFields);
      assert.deepStrictEqual(notifications, []);
      assert.deepStrictEqual(firstSchedule, ["save:state", "save:state"]);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
      assert.deepStrictEqual(firstTree, [
        "agents/",
        "agents/pi-claude-marketplace-hello-bot.md",
        "claude-plugins.json",
        "mcp-adapter.json",
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
        "agents/pi-claude-marketplace-hello-bot.md",
        "claude-plugins.json",
        "mcp-adapter.json",
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a concurrently removed record fails before any write and the retry persists once", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-concurrent-removal-"));
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
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(
        activeSchedule,
        undefined,
        async (extensionRoot) => {
          const state = await loadState(extensionRoot);
          const mp = state.marketplaces["mp"];
          if (mp === undefined || !removalFault.enabled) {
            return state;
          }

          // The record is present for reinstall's own read and gone by the time
          // the swap's intent mark reads it -- the real concurrent-removal
          // window.
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
        },
      );
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstStateBytes = await readFile(locations.stateJsonPath, "utf8");
      const firstSkill = await readSkill(cwd);
      removalFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });

      // assert
      assert.equal(removalFault.observed, true);
      assert.equal(first.partition, "failed");
      assert.equal(first.failureClass, undefined);
      assert.deepStrictEqual(first.notes, [
        retryCauseChain('Plugin "hello" was concurrently uninstalled.'),
      ]);
      assert.deepStrictEqual(first.reasons, ["concurrently uninstalled"]);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.version, "1.0.0");
      assert.deepStrictEqual(notifications, []);
      assert.equal(firstStateBytes, stateBytes);
      assert.equal(firstSkill, oldSkill);
      // The intent mark's guard fires before its write, so no persistence
      // attempt appears.
      assert.deepStrictEqual(firstSchedule, []);
      assert.deepStrictEqual(secondSchedule, CONVERGED_SCHEDULE);
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: an unreadable base layer is left unchanged by a reinstall and its retry", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-shared-invalid-"));
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
      await writeFile(locations.baseConfigJsonPath, "{ not json ", "utf8");
      const firstSchedule: string[] = [];
      const secondSchedule: string[] = [];
      const activeSchedule = { current: firstSchedule };
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule);
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstConfigBytes = await readFile(locations.baseConfigJsonPath, "utf8");
      const firstNotifications = [...notifications];
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        scope: "project",
        stateTransaction,
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.equal(first.version, "1.0.0");
      assert.equal(first.notes, undefined);
      assert.deepStrictEqual(firstNotifications, [HELLO_REINSTALLED_ROW]);
      assert.equal(firstConfigBytes, "{ not json ");
      assert.equal(second.partition, "reinstalled");
      assert.deepStrictEqual(notifications.slice(1), [HELLO_REINSTALLED_ROW]);
      assert.equal(await readFile(locations.baseConfigJsonPath, "utf8"), "{ not json ");
      assert.equal(firstRecord?.version, "1.0.0");
      assert.deepStrictEqual(firstSchedule, CONVERGED_SCHEDULE);
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a completion-cache maintenance failure notes the deferral and the retry clears it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-cache-maintenance-"));
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
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule);
      const delegate = createCompletionCache();
      const completionCache = createCompletionCacheWithDrop(
        async (cachePath, scope, marketplace) => {
          activeSchedule.current.push("drop:cache");
          if (cacheFault.enabled) {
            throw new Error(cacheFault.message);
          }

          await delegate.dropMarketplaceCache(cachePath, scope, marketplace);
        },
      );
      const reinstall = createReinstallPlugin(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache,
      );
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      cacheFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });

      // assert
      // The swap's own cache refresh fails silently; only reinstall's
      // maintenance step notes the deferral, once.
      assert.equal(first.partition, "reinstalled");
      assert.deepStrictEqual(first.notes, [
        'warning: Plugin "hello" reinstalled; completion cache refresh deferred: completion cache refresh refused',
      ]);
      assert.equal(first.discoveryWarnings, undefined);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.notes, undefined);
      assert.deepStrictEqual(notifications, []);
      // The data cleanup still runs, so the deferral is cache-only.
      assert.deepStrictEqual(firstSchedule, CONVERGED_SCHEDULE);
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("retry proof: reinstall: a plugin-data-dir maintenance failure keeps the directory and the retry removes it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-data-maintenance-"));
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
      const { removeDataDir, stateTransaction } = observeRetryCollaborators(activeSchedule, {
        data: dataFault,
      });
      const reinstall = createRetryReinstall(activeSchedule);
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      dataFault.enabled = false;
      activeSchedule.current = secondSchedule;
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        removeDataDir,
        render: "none",
        scope: "project",
        stateTransaction,
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
      assert.deepStrictEqual(firstSchedule, CONVERGED_SCHEDULE);
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
      // Alpha writes state twice (intent mark, finalize), so the cascade's
      // third guarded write is beta's intent mark (D-18-10).
      const persistenceFault = { enabled: true, message: "state persistence refused", ordinal: 3 };
      const { stateTransaction } = observeRetryCollaborators(
        { current: [] },
        { persistence: persistenceFault },
      );
      const betaRecordBefore = (await loadState(locations.extensionRoot)).marketplaces["mp"]
        ?.plugins["beta"];
      const maintenance: string[] = [];
      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });
      const removeDataDir: RemoveDataDirFn = async (target, options) => {
        maintenance.push(`remove:data:${path.basename(target)}`);
        await rm(target, options);
      };

      // act
      const first = await reinstallPlugins({
        ctx,
        cwd,
        run,
        removeDataDir,
        scope: "project",
        stateTransaction,
        target: { kind: "marketplace", marketplace: "mp" },
      });
      const firstTree = await retryTree(locations.scopeRoot);
      const firstMaintenance = [...maintenance];
      const firstNotifications = [...notifications];
      const firstBetaRecord = (await loadState(locations.extensionRoot)).marketplaces["mp"]
        ?.plugins["beta"];
      persistenceFault.enabled = false;
      const second = await reinstallPlugins({
        ctx,
        cwd,
        run,
        removeDataDir,
        scope: "project",
        stateTransaction,
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

test("retry proof: reinstall: a post-save hook-cache read failure stays silent and the retry re-materializes once", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-retry-post-save-hooks-"));
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
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      const originalHydrate = hooksRouting.readAndCachePluginHooks.bind(hooksRouting);
      t.mock.method(
        hooksRouting,
        "readAndCachePluginHooks",
        async (options: Parameters<ReinstallHooksRouting["readAndCachePluginHooks"]>[0]) => {
          hookReadFault.reads += 1;
          if (hookReadFault.enabled) {
            return;
          }

          await originalHydrate(options);
        },
      );

      const reinstall = createReinstallPlugin(hooksRouting, createCompletionCache());

      const { ctx, notifications, run } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });

      // act
      const first = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
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
      const second = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(first.partition, "reinstalled");
      assert.equal(first.version, "1.0.0");
      // The post-save hook-cache failure is debug-only: no note, no warning.
      assert.equal(first.notes, undefined);
      assert.equal(firstReads, 1);
      assert.equal(second.partition, "reinstalled");
      assert.equal(second.notes, undefined);
      assert.equal(hookReadFault.reads, 2);
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
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WR-03: a post-save routing-table rebuild failure leaves the committed reinstall successful", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-post-save-rebuild-fault-"));
    try {
      // arrange
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          hooksJson: {
            hooks: {
              PreToolUse: [{ hooks: [{ command: "echo ok", type: "command" }], matcher: "Bash" }],
            },
          },
        },
        install: true,
      });
      const locations = locationsFor("project", cwd);
      const stateBefore = await loadState(locations.extensionRoot);
      const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
      t.mock.method(hooksRouting, "rebuildRoutingTables", () => {
        throw new Error("routing rebuild denied");
      });
      const reinstall = createReinstallPlugin(hooksRouting, createCompletionCache());
      const { ctx, notifications, run } = makeCtx();

      // act
      const outcome = await reinstall({
        ctx,
        cwd,
        marketplace: "mp",
        run,
        plugin: "hello",
        render: "none",
        scope: "project",
      });

      // assert
      assert.equal(outcome.partition, "reinstalled");
      const stateAfter = await loadState(locations.extensionRoot);
      assert.equal(stateAfter.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
      assert.notDeepEqual(stateAfter, stateBefore);
      assert.deepStrictEqual(notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const retryFs = createRequire(import.meta.url)(
  "node:fs/promises",
) as typeof import("node:fs/promises");

// ──────────────────────────────────────────────────────────────────────────
// WLIF-01: the workflows handle -- reinstall's fifth prepare and its abort arm.
//
// `locationsFor` is called INSIDE the `withHermeticHome` closure in every case
// below: the helper sets `process.env.HOME`, which is what the workflow home
// derivation reads, so a call outside the closure would point
// `workflowsSavedDir` at the developer's real home.
//
// Envelope paths are composed with a plain `path.join`, NOT with the async
// artifact-path composer: a forgotten await there yields a leaf named after a
// promise instead of throwing.
// ──────────────────────────────────────────────────────────────────────────

test("WLIF-01: a replace-step failure leaves no workflows staging tree behind", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-abort-"));
    const originalRename = retryFs.rename.bind(retryFs);
    let renameMock: ReturnType<typeof t.mock.method> | undefined;
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      const envelopeBefore = await readFile(envelopePath, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "greet" }],
      });
      // The skills replace is the FIRST step of the replace sequence, so its
      // failure reaches `abortHandles` with all five prepared handles and the
      // workflows commit never runs. That is what makes the abort arm the right
      // owner of the staging root HERE. The other path into the same catch is
      // the workflows commit throwing part way, and there the commit owns its
      // own staging lifecycle -- covered by the two cases below.
      renameMock = t.mock.method(
        retryFs,
        "rename",
        async (...args: Parameters<typeof retryFs.rename>) => {
          if (String(args[1]).startsWith(locations.skillsTargetDir)) {
            throw new Error("skills replace denied");
          }

          return originalRename(...args);
        },
      );
      syncBuiltinESMExports();
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.equal(outcome.partition, "failed");
      assert.deepStrictEqual(await entriesOf(locations.workflowsStagingDir), []);
      // The failure landed BEFORE the workflows step, so the envelope the
      // install placed is untouched rather than removed or rewritten.
      assert.equal(await readFile(envelopePath, "utf8"), envelopeBefore);
    } finally {
      renameMock?.mock.restore();
      syncBuiltinESMExports();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("CR-02: a failed restore keeps the staging root holding the only copy", async (t) => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-retained-"));
    const originalRename = retryFs.rename.bind(retryFs);
    let renameMock: ReturnType<typeof t.mock.method> | undefined;
    try {
      // arrange
      // The old install DOES ship `greet`, so the commit displaces that
      // envelope into `<stagingRoot>/.previous/` instead of unlinking it.
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      const envelopeBefore = await readFile(envelopePath, "utf8");
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "greet" }, { sourceName: "wave" }],
      });
      const wavePath = path.join(locations.workflowsSavedDir, "hello:wave.json");
      // Refuse `wave`, then refuse the restore out of `.previous/`. The commit
      // then reports it could not put the previous envelope back and KEEPS the
      // staging root, because that directory now holds the only copy.
      renameMock = t.mock.method(
        retryFs,
        "rename",
        async (...args: Parameters<typeof retryFs.rename>) => {
          if (String(args[1]) === wavePath) {
            throw new Error("wave placement denied");
          }

          if (String(args[0]).includes(`${path.sep}.previous${path.sep}`)) {
            throw new Error("previous envelope restore denied");
          }

          return originalRename(...args);
        },
      );
      syncBuiltinESMExports();
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.equal(outcome.partition, "failed");
      // The abort arm must NOT have run: `cleanupStaging` is a recursive rm and
      // `.previous/` is inside the root, so aborting here would destroy the
      // bytes the leak text just told the operator to move back by hand.
      const staging = await entriesOf(locations.workflowsStagingDir);
      assert.equal(staging.length, 1);
      const retainedPrevious = path.join(
        locations.workflowsStagingDir,
        staging[0] ?? "",
        ".previous",
      );
      assert.deepStrictEqual(await entriesOf(retainedPrevious), ["hello:greet.json"]);
      assert.equal(
        await readFile(path.join(retainedPrevious, "hello:greet.json"), "utf8"),
        envelopeBefore,
      );
    } finally {
      renameMock?.mock.restore();
      syncBuiltinESMExports();
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WLIF-01: a reinstall of a plugin with no workflows touches neither workflow directory", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-none-"));
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
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert -- the prepare short-circuits on the noop branch, so no staging
      // root is created and the engine's storage root is not brought into
      // existence for a plugin that ships no workflows (WPTH-05).
      assert.equal(outcome.partition, "reinstalled");
      assert.deepStrictEqual(await entriesOf(locations.workflowsStagingDir), []);
      assert.deepStrictEqual(await entriesOf(locations.workflowsSavedDir), []);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WLIF-01: the workflows commit -- the LAST step of the replace sequence, the
// placed names threaded out of it, and the outer recovery path that is the
// only thing able to take those envelopes back.
// ──────────────────────────────────────────────────────────────────────────

/**
 * A foreign envelope in the shared saved directory. Nothing this extension
 * placed and nothing any record names, so every case that removes envelopes
 * can assert its bytes survived.
 */
async function seedForeignEnvelope(savedDir: string): Promise<{
  readonly path: string;
  readonly bytes: string;
}> {
  await mkdir(savedDir, { recursive: true });
  const foreignPath = path.join(savedDir, "someone-else:thing.json");
  const bytes = '{ "name": "someone-else:thing" }\n';
  await writeFile(foreignPath, bytes, "utf8");
  return { path: foreignPath, bytes };
}

test("WLIF-04: a reinstall REPLACES a workflow envelope at its recorded target", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-replace-"));
    try {
      // arrange -- install once so both a record and an envelope exist, then
      // change the workflow's description so the re-materialized bytes are
      // distinguishable from the ones already at the target. The old record
      // naming the envelope is what puts the commit on its displace path
      // rather than into the occupancy refusal.
      //
      // WLIF-04 is "reinstall replaces workflow artifacts", and REPLACES is
      // what separates this case from a first-write: the same target path holds
      // different bytes afterwards. The pre-reinstall bytes are read here so
      // "the old content is gone" is an assertion rather than an inference from
      // the new content matching.
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      assert.equal(await pathExists(envelopePath), true, "the install must place the envelope");
      const beforeBytes = await readFile(envelopePath, "utf8");
      const foreign = await seedForeignEnvelope(locations.workflowsSavedDir);
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [
          {
            sourceName: "greet",
            body: 'export const meta = { name: "greet", description: "greets again" };\n',
          },
        ],
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.notEqual(
        await readFile(envelopePath, "utf8"),
        beforeBytes,
        "WLIF-04: the pre-reinstall envelope content is gone from the target",
      );
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets again",
        script: 'export const meta = { name: "greet", description: "greets again" };\n',
      });
      const state = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.workflows, [
        "hello:greet",
      ]);
      // The commit's staging root is removed on success, so nothing is left
      // behind under the staging directory.
      assert.deepStrictEqual(await entriesOf(locations.workflowsStagingDir), []);
      // WLIF-04: "replaces" is only meaningful against a boundary saying which
      // artifacts it does NOT touch. The saved directory is shared, so an
      // adjacent plugin's envelope sitting beside the replacement target has to
      // come through byte-unchanged.
      assert.equal(await readFile(foreign.path, "utf8"), foreign.bytes);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WLIF-01 / T-112-15: the record names the envelopes reinstall actually wrote.
// ──────────────────────────────────────────────────────────────────────────

test("WLIF-01: the record names both envelopes a two-workflow reinstall wrote", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-two-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: {
          skill: "old skill",
          workflows: [{ sourceName: "alpha" }, { sourceName: "beta" }],
        },
        install: true,
      });
      const foreign = await seedForeignEnvelope(locations.workflowsSavedDir);
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "alpha" }, { sourceName: "beta" }],
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.equal(outcome.partition, "reinstalled");
      const state = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.workflows, [
        "hello:alpha",
        "hello:beta",
      ]);
      for (const sourceName of ["alpha", "beta"]) {
        const envelopePath = path.join(locations.workflowsSavedDir, `hello:${sourceName}.json`);
        assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
          name: `hello:${sourceName}`,
          description: `does ${sourceName}`,
          script: `export const meta = { name: "${sourceName}", description: "does ${sourceName}" };\n`,
        });
      }

      assert.equal(await readFile(foreign.path, "utf8"), foreign.bytes);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WLIF-04: a workflow the new version drops leaves neither an envelope nor a record entry", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-dropped-"));
    try {
      // arrange -- the workflows directory is REMOVED before the new tree is
      // written, so the dropped source name is genuinely absent rather than
      // shadowed by the new one. This is the case that distinguishes a replace
      // from an add.
      const locations = locationsFor("project", cwd);
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      const droppedPath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      assert.equal(await pathExists(droppedPath), true, "the install must place the envelope");
      const foreign = await seedForeignEnvelope(locations.workflowsSavedDir);
      await rm(path.join(seeded.pluginRoot, "workflows"), { force: true, recursive: true });
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "farewell" }],
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(await pathExists(droppedPath), false);
      assert.equal(
        await pathExists(path.join(locations.workflowsSavedDir, "hello:farewell.json")),
        true,
      );
      const state = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.workflows, [
        "hello:farewell",
      ]);
      assert.equal(await readFile(foreign.path, "utf8"), foreign.bytes);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WLIF-06: a reinstall whose source dropped a workflow carries the stale-command axis", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-stale-"));
    try {
      // arrange -- the record names `hello:greet`; the new tree declares only
      // `hello:farewell`, so the shared swap places a name the record did not
      // hold and does not re-place one it did.
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      await rm(path.join(seeded.pluginRoot, "workflows"), { force: true, recursive: true });
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "farewell" }],
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert -- the axis rides the outcome so the shared row composer can
      // name the remedy; `reinstall.messaging.test.ts` pins what it renders.
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(outcome.staleWorkflowCommand, true);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WLIF-06: a reinstall that re-placed every recorded workflow omits the axis", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-stale-none-"));
    try {
      // arrange -- the SAME name before and after. A name in both the recorded
      // and the placed set retires nothing; that is the ordinary re-place.
      const seeded = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill", workflows: [{ sourceName: "greet" }] },
        install: true,
      });
      await writePluginTree(seeded.pluginRoot, "hello", {
        skill: "new skill",
        workflows: [{ sourceName: "greet" }],
      });
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert -- ABSENT, not `false`: the outcome shape of a clean reinstall
      // is unchanged, which is what keeps its row byte-identical.
      assert.equal(outcome.partition, "reinstalled");
      assert.equal(Object.hasOwn(outcome, "staleWorkflowCommand"), false);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("WLIF-01: a reinstall with no workflows records an empty array, not an absent key", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-workflows-empty-record-"));
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
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert -- an own, empty array. A `deepStrictEqual` against `[]` alone
      // would not distinguish an absent key from an empty one, so the presence
      // of the property is asserted separately.
      assert.equal(outcome.partition, "reinstalled");
      const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      assert.ok(Object.hasOwn(record.resources, "workflows"));
      assert.deepStrictEqual(record.resources.workflows, []);
      assert.deepStrictEqual(await entriesOf(locations.workflowsSavedDir), []);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("PRL-03: a bulk cascade forwards the state-transaction seam to every per-plugin reinstall", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-bulk-state-seam-"));
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
      const saved: string[] = [];
      const stateTransaction: LockedStateTransactionDeps = {
        saveState: async (extensionRoot, state) => {
          saved.push(extensionRoot);
          await saveState(extensionRoot, state);
        },
      };
      const { ctx, run } = makeCtx({ piMcpAdapterLoaded: true, piSubagentsLoaded: true });

      // act
      const outcomes = await reinstallPlugins({
        ctx,
        cwd,
        run,
        scope: "project",
        stateTransaction,
        target: { kind: "marketplace", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(
        outcomes.map(({ name, partition }) => ({ name, partition })),
        [
          { name: "alpha", partition: "reinstalled" },
          { name: "beta", partition: "reinstalled" },
        ],
      );
      // Two substituted writes per cascaded plugin, the swap's intent mark and
      // its finalize (D-18-10): the seam the caller supplied reaches every
      // per-plugin reinstall, not just the first.
      assert.deepStrictEqual(saved, [
        locations.extensionRoot,
        locations.extensionRoot,
        locations.extensionRoot,
        locations.extensionRoot,
      ]);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});

test("PRL-08 / PRL-11 / REI-04: a reinstall records the version its source now declares, keeps installedAt and provenance, removes plugin data, and renders the exact row", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-flow-success-"));
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
      const beforeRecord = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins
        .hello;
      assert.ok(beforeRecord !== undefined);
      const { ctx, run, notifications } = makeCtx({
        piMcpAdapterLoaded: true,
        piSubagentsLoaded: true,
      });
      const reinstall = createReinstallPlugin(
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        createCompletionCache(),
      );

      // act
      const outcome = await reinstall({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "9.9.9",
        stagedAgentNames: ["pi-claude-marketplace-hello-bot"],
        stagedMcpServerNames: ["server1"],
        declaresAgents: true,
        declaresMcp: true,
        declaresWorkflows: false,
      });
      const record = (await loadState(locations.extensionRoot)).marketplaces.mp?.plugins.hello;
      assert.ok(record !== undefined);
      assert.deepStrictEqual(
        {
          version: record.version,
          installedAt: record.installedAt,
          provenance: record.provenance,
        },
        {
          version: "9.9.9",
          installedAt: beforeRecord.installedAt,
          provenance: beforeRecord.provenance,
        },
      );
      assert.deepStrictEqual(record.resources, {
        skills: ["hello-tool"],
        prompts: ["hello:deploy"],
        agents: ["pi-claude-marketplace-hello-bot"],
        mcpServers: ["server1"],
        hooks: [],
        workflows: [],
      });
      assert.strictEqual(
        await readFile(path.join(locations.skillsTargetDir, "hello-tool", "SKILL.md"), "utf8"),
        '---\nname: hello-tool\ndescription: "new skill"\n---\n\nnew skill\n',
      );
      await assert.rejects(() => readFile(path.join(dataDir, "state.txt"), "utf8"), {
        code: "ENOENT",
      });
      assert.deepStrictEqual(notifications, [
        {
          message: "● mp [project]\n  ● hello v9.9.9 (reinstalled)\n\n/reload to pick up changes",
        },
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-06: a disabled plugin MCP server stays disabled through reinstall", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile06-disabled-"));
    try {
      const locations = locationsFor("project", cwd);
      const { pluginRoot } = await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { mcp: true },
        install: true,
      });
      const installed = JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")) as {
        mcpServers: Record<string, Record<string, unknown>>;
      };
      installed.mcpServers.plugin_hello_server1_ = {
        ...installed.mcpServers.plugin_hello_server1_,
        disabled: true,
      };
      await writeFile(locations.mcpAdapterJsonPath, `${JSON.stringify(installed, null, 2)}\n`);
      await writeFile(
        path.join(pluginRoot, ".mcp.json"),
        JSON.stringify({ mcpServers: { server1: { command: "deno", args: ["v2.js"] } } }),
      );
      const { ctx, run } = makeCtx();

      // act
      const outcome = await reinstallDefault(cwd, ctx, run);

      // assert
      assert.strictEqual(outcome.partition, "reinstalled");
      assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpAdapterJsonPath, "utf8")), {
        mcpServers: {
          plugin_hello_server1_: {
            command: "deno",
            args: ["v2.js"],
            env: {
              CLAUDE_PLUGIN_ROOT: pluginRoot,
              CLAUDE_PLUGIN_DATA: path.join(locations.dataRoot, "mp", "hello"),
            },
            directTools: "search",
            toolPrefix: "mcp",
            disabled: true,
            _piClaudeMarketplace: { plugin: "hello", marketplace: "mp" },
          },
        },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** The failed row of a reinstall of `hello@mp` whose finalize save was refused. */
const FINALIZE_FAILED_ROW =
  "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {rollback partial}\n" +
  '    cause: Plugin "hello" failed during physical replace. Run /claude:plugin reinstall hello@mp to repair it. -> finalize refused\n' +
  "    [mcp] (rollback failed)\n      cause: finalize refused";

/** AFILE-04: the exact comments-dropped notice for the project-scope adapter file. */
const PROJECT_COMMENTS_DROPPED_NOTICE: NotifyRecord = {
  severity: "warning",
  message:
    "MCP config comments removed.\n\nThe project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
};

/** AFILE-04: install `hello` with one MCP server, then put a `//` comment at the top of the adapter file. */
async function seedCommentedMcpReinstall(cwd: string): Promise<{
  readonly locations: ReturnType<typeof locationsFor>;
  readonly commentedText: string;
}> {
  const locations = locationsFor("project", cwd);
  await seedMarketplace({
    cwd,
    marketplaceRoot: path.join(cwd, "mp-src"),
    resources: { mcp: true },
    install: true,
  });
  const commentedText = `// mine\n${await readFile(locations.mcpAdapterJsonPath, "utf8")}`;
  await writeFile(locations.mcpAdapterJsonPath, commentedText);
  return { locations, commentedText };
}

test("AFILE-04: reinstall over a commented mcp-adapter.json shows the comments-removed notice after its rows", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile04-"));
    try {
      await seedCommentedMcpReinstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 (reinstalled) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: a reinstall refused at its intent mark keeps the comments and shows no notice", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile04-rollback-"));
    try {
      const { locations, commentedText } = await seedCommentedMcpReinstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        stateTransaction: { saveState: () => Promise.reject(new Error("saveState failure")) },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {unreadable}",
          severity: "error",
        },
      ]);
      assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), commentedText);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

/** A state save that refuses only the shared swap's second write, its finalize. */
function refuseFinalizeSave(): typeof saveState {
  let saves = 0;
  return async (extensionRoot, state) => {
    saves += 1;
    if (saves === 2) {
      throw new Error("finalize refused");
    }

    await saveState(extensionRoot, state);
  };
}

test("AFILE-04: a reinstall whose finalize fails after the MCP commit shows the notice after its failed row", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile04-finalize-"));
    try {
      const { locations, commentedText } = await seedCommentedMcpReinstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
        stateTransaction: { saveState: refuseFinalizeSave() },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: FINALIZE_FAILED_ROW,
          severity: "error",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
      assert.strictEqual(
        await readFile(locations.mcpAdapterJsonPath, "utf8"),
        commentedText.replace("// mine\n", ""),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: an orchestrated reinstall returns the notice on its outcome and sends nothing", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile04-orchestrated-"));
    try {
      await seedCommentedMcpReinstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      const outcome = await reinstallPlugin({
        ctx,
        run,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
        render: "none",
      });

      // assert
      assert.deepStrictEqual(outcome, {
        partition: "reinstalled",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        version: "1.0.0",
        stagedAgentNames: [],
        stagedMcpServerNames: ["server1"],
        declaresAgents: false,
        declaresMcp: true,
        declaresWorkflows: false,
        mcpConfigNotices: [
          { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
        ],
      });
      assert.deepStrictEqual(notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("AFILE-04: a self-rendered reinstall shows the notice after its row", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile04-self-"));
    try {
      await seedCommentedMcpReinstall(cwd);
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallDefault(cwd, ctx, run);

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message:
            "● mp [project]\n  ● hello v1.0.0 (reinstalled) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
        },
        PROJECT_COMMENTS_DROPPED_NOTICE,
      ]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

const STAGING_VARIABLE_NOTICE: NotifyRecord = {
  severity: "warning",
  message:
    'MCP server variables not set.\n\nServer "plugin_hello_server1_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_SET_FOR_STAGING.',
};

for (const { label, env, notices } of [
  { label: "sets", env: { PI_CM_SET_FOR_STAGING: "1" }, notices: [] },
  { label: "lacks", env: {}, notices: [STAGING_VARIABLE_NOTICE] },
] as const) {
  test(`D-08-06: a reinstall whose environment ${label} a variable stages with that environment`, async () => {
    await withHermeticHome(async () => {
      // arrange
      const cwd = await mkdtemp(path.join(tmpdir(), `reinstall-env-${label}-`));
      try {
        const marketplaceRoot = path.join(cwd, "mp-src");
        await seedMarketplace({ cwd, marketplaceRoot, resources: { mcp: true }, install: true });
        await writeFile(
          path.join(marketplaceRoot, "plugins", "hello", ".mcp.json"),
          JSON.stringify({
            mcpServers: { server1: { command: "node", args: ["${PI_CM_SET_FOR_STAGING}"] } },
          }),
        );
        const reinstall = createReinstallPlugin(
          createHooksRouting(createHooksRuntime(), { readHooksJson }),
          createCompletionCache(),
          env,
        );
        const { ctx, run, notifications } = makeCtx();

        // act
        await reinstall({ ctx, run, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

        // assert
        assert.deepStrictEqual(notifications, [
          {
            message:
              "● mp [project]\n  ● hello v1.0.0 (reinstalled) {requires pi-mcp-adapter}\n\n/reload to pick up changes",
          },
          ...notices,
        ]);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    });
  });
}

test("AFILE-02: reinstalling a plugin with no MCP servers over an unparseable mcp-adapter.json leaves it unchanged and says so", async () => {
  await withHermeticHome(async () => {
    // arrange
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-afile02-unparseable-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        resources: { skill: "old skill" },
        install: true,
      });
      await mkdir(path.dirname(locations.mcpAdapterJsonPath), { recursive: true });
      await writeFile(locations.mcpAdapterJsonPath, "{ not json");
      const { ctx, run, notifications } = makeCtx();

      // act
      await reinstallPlugins({
        ctx,
        run,
        cwd,
        scope: "project",
        target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
      });

      // assert
      assert.deepStrictEqual(notifications, [
        { message: "● mp [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes" },
        {
          message:
            "MCP config left unchanged.\n\nThe project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
          severity: "warning",
        },
      ]);
      assert.strictEqual(await readFile(locations.mcpAdapterJsonPath, "utf8"), "{ not json");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
