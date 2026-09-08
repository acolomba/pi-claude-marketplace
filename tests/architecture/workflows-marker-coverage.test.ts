/**
 * tests/architecture/workflows-marker-coverage.test.ts -- WDEP-04 / SNM-06
 * cross-site coverage gate for the `requires pi-dynamic-workflows` marker.
 *
 * Each derivation site's owner suite proves its own row bytes directly. This
 * suite keeps the distinct architectural invariant: EVERY `Dependency[]`
 * derivation site under `orchestrators/` renders the host-engine marker when a
 * plugin declares workflows into a session with no host workflow engine, and
 * none of them renders it when the engine is loaded.
 *
 * That claim needs ONE owner. Seven scattered per-site assertions can each be
 * deleted without anything noticing; a single projection over all seven cannot.
 * The one-assertion shape is also what makes the deletion-of-one-arm control
 * informative: reverting a single derivation turns exactly one row of the
 * projected array red, and that row names the file to open.
 *
 * Every case asserts on the RENDERED ROW rather than on an intermediate
 * `Dependency[]`, so all seven prove the same end-to-end claim (D-114-05). Five
 * of the seven derivations are module-private and stay that way: they are
 * reached through their exported outcome-to-row composers or through a full
 * orchestrator entry point, never through an export added to serve a test.
 *
 * The engine-absent runs use the DECOY tool name `workflow` rather than an
 * empty tool list. `@nicknisi/pi-workflows` registers a tool by that name, so
 * driving the absent case through it re-proves the WDEP-01 discriminator at
 * every one of these seven surfaces for free.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { Type } from "typebox";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { importClaudeSettings } from "../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { listPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { reinstalledRowFromOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { enableRowDependencies } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { updatedRowFromOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts";
import { dependenciesFromInstall } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { notify } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notify.ts";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";

/** The closed-set marker every case looks for. */
const HOST_ENGINE_MARKER = "requires pi-dynamic-workflows";

/** The tool name only the host workflow engine registers (WDEP-01). */
const ENGINE_TOOL = "workflow_control";

/** `@nicknisi/pi-workflows` registers this name; it must NOT read as loaded. */
const DECOY_TOOL = "workflow";

function toolNamesFor(engineLoaded: boolean): readonly string[] {
  return engineLoaded ? [ENGINE_TOOL] : [DECOY_TOOL];
}

function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    sourceInfo: {
      origin: "top-level",
      path: `/test/tools/${name}.ts`,
      scope: "temporary",
      source: "test",
    },
  } satisfies ToolInfo;
}

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

function makeCtx(engineLoaded: boolean): {
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
    getAllTools: () => toolNamesFor(engineLoaded).map(toolInfo),
  } as ExtensionAPI;
  return { ctx, pi, notifications };
}

/**
 * Render one composed message and return the emitted bytes. The two Tier A and
 * two Tier B cases share this so their claim is the same "this surface renders
 * the marker" claim the three Tier C cases make.
 */
function renderThroughNotify(engineLoaded: boolean, message: NotificationMessage): string {
  const { ctx, pi, notifications } = makeCtx(engineLoaded);
  notify(ctx, pi, message);
  const emitted = notifications[0];
  assert.ok(emitted !== undefined, "notify() emitted nothing");
  return emitted.message;
}

/**
 * Isolate `HOME` (and the agent-dir override) for the duration of `fn` so the
 * user-scope state root lands under a tmp directory. The three full-orchestrator
 * cases mutate these process globals, which is why the projection below drives
 * the cases SEQUENTIALLY rather than through `Promise.all`.
 */
async function withHermeticHome<T>(fn: (cwd: string) => Promise<T>): Promise<T> {
  const home = await mkdtemp(path.join(tmpdir(), "wf-marker-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "wf-marker-cwd-"));
  const prevHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn(cwd);
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = prevAgentDir;
    }

    await rm(home, { force: true, recursive: true });
    await rm(cwd, { force: true, recursive: true });
  }
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/**
 * Seed a path-source marketplace whose single plugin ships one workflow script.
 *
 * The script carries a NAMED `meta` export on purpose: a default-export body
 * classifies as SKIPPED and writes zero envelopes, so a case built on one would
 * stage no workflow and pass for the wrong reason whichever way the derivation
 * went.
 */
async function seedWorkflowPlugin(cwd: string): Promise<string> {
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await writeUnder(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(pluginRoot, "workflows", "greet.js"),
    'export const meta = { name: "greet", description: "greets" };\n',
  );
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: "mp",
      owner: { name: "marker coverage gate" },
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
  );
  return marketplaceRoot;
}

/** Record the seeded marketplace in project-scope state so `install` finds it. */
async function recordMarketplace(cwd: string, marketplaceRoot: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: cwd,
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

/** Drive a real project-scope install of the seeded workflow-bearing plugin. */
async function runInstall(
  cwd: string,
  engineLoaded: boolean,
): Promise<{ notifications: readonly NotifyRecord[] }> {
  const { ctx, pi, notifications } = makeCtx(engineLoaded);
  await installPlugin({
    ctx,
    pi,
    scope: "project",
    cwd,
    marketplace: "mp",
    plugin: "hello",
  });
  return { notifications };
}

// ---------------------------------------------------------------------------
// The seven cases, one per `Dependency[]` derivation site.
// ---------------------------------------------------------------------------

interface SiteCase {
  /** Repo-relative path of the derivation, so a failing row names the file. */
  readonly site: string;
  /** Drives a PUBLIC surface and returns the rendered row or block. */
  readonly drive: (engineLoaded: boolean) => Promise<string>;
}

const SITE_CASES = [
  {
    // Tier C: `composeInstalledRow` is module-private; a full install is the
    // only public surface that reaches it.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts",
    drive: async (engineLoaded) =>
      withHermeticHome(async (cwd) => {
        // arrange
        const marketplaceRoot = await seedWorkflowPlugin(cwd);
        await recordMarketplace(cwd, marketplaceRoot);

        // act
        const { notifications } = await runInstall(cwd, engineLoaded);

        // assert -- the caller reads the emitted block.
        const emitted = notifications[0];
        assert.ok(emitted !== undefined, "installPlugin emitted no notification");
        return emitted.message;
      }),
  },
  {
    // Tier C: `dependenciesFromDeclares` is module-private and reads the
    // PERSISTED record, so the install above is what puts a workflow name in it.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    drive: async (engineLoaded) =>
      withHermeticHome(async (cwd) => {
        // arrange
        const marketplaceRoot = await seedWorkflowPlugin(cwd);
        await recordMarketplace(cwd, marketplaceRoot);
        await runInstall(cwd, engineLoaded);

        // act
        const { ctx, pi, notifications } = makeCtx(engineLoaded);
        await listPlugins({ ctx, pi, cwd, scope: "project" });

        // assert
        const emitted = notifications[0];
        assert.ok(emitted !== undefined, "listPlugins emitted no notification");
        return emitted.message;
      }),
  },
  {
    // Tier A: exported for production reasons; the gate calls it and renders
    // the array it returns through the same public `notify` entry point.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts",
    drive: (engineLoaded) =>
      Promise.resolve(
        renderThroughNotify(engineLoaded, {
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                {
                  status: "installed",
                  name: "hello",
                  version: "1.0.0",
                  dependencies: enableRowDependencies({ stagedWorkflows: true }),
                  severity: "warning",
                  needsReload: true,
                },
              ],
            },
          ],
        }),
      ),
  },
  {
    // Tier B: `dependenciesFromOutcome` is module-private behind the exported
    // row composer.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts",
    drive: (engineLoaded) =>
      Promise.resolve(
        renderThroughNotify(engineLoaded, {
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                reinstalledRowFromOutcome(
                  {
                    partition: "reinstalled",
                    name: "hello",
                    marketplace: "mp",
                    scope: "project",
                    version: "1.0.0",
                    resourcesChanged: true,
                    stagedAgentNames: [],
                    stagedMcpServerNames: [],
                    declaresAgents: false,
                    declaresMcp: false,
                    declaresWorkflows: true,
                  },
                  undefined,
                ),
              ],
            },
          ],
        }),
      ),
  },
  {
    // Tier B: `outcomeDependencies` is module-private behind the exported row
    // composer.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts",
    drive: (engineLoaded) =>
      Promise.resolve(
        renderThroughNotify(engineLoaded, {
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                updatedRowFromOutcome(
                  {
                    partition: "updated",
                    name: "hello",
                    fromVersion: "1.0.0",
                    toVersion: "2.0.0",
                    stagedAgentNames: [],
                    stagedMcpServerNames: [],
                    declaresAgents: false,
                    declaresMcp: false,
                    declaresWorkflows: true,
                  },
                  "project",
                  { partiallyInstalled: "info", updated: "info" },
                ),
              ],
            },
          ],
        }),
      ),
  },
  {
    // Tier C: `dependenciesFromInstalled` is module-private; a full import run
    // with production collaborators is the only public surface that reaches it.
    site: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
    drive: async (engineLoaded) =>
      withHermeticHome(async (cwd) => {
        // arrange
        const marketplaceRoot = await seedWorkflowPlugin(cwd);
        await writeUnder(
          path.join(cwd, ".claude", "settings.json"),
          JSON.stringify({
            enabledPlugins: { "hello@mp": true },
            extraKnownMarketplaces: { mp: { directory: marketplaceRoot } },
          }),
        );
        const { ctx, pi, notifications } = makeCtx(engineLoaded);

        // act
        await importClaudeSettings({
          ctx,
          cwd,
          gitOps: createGitOpsFake({ allowedRemoteUrls: [], boundary: "memory" }).gitOps,
          pi,
          selectedScopes: ["project"],
        });

        // assert
        const emitted = notifications[0];
        assert.ok(emitted !== undefined, "importClaudeSettings emitted no notification");
        return emitted.message;
      }),
  },
  {
    // Tier A: exported for production reasons; the gate calls it and renders
    // the array it returns.
    site: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts",
    drive: (engineLoaded) =>
      Promise.resolve(
        renderThroughNotify(engineLoaded, {
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                {
                  status: "installed",
                  name: "hello",
                  version: "1.0.0",
                  dependencies: dependenciesFromInstall({
                    declaresAgents: false,
                    declaresMcp: false,
                    declaresWorkflows: true,
                  }),
                  severity: "warning",
                  needsReload: true,
                },
              ],
            },
          ],
        }),
      ),
  },
] as const satisfies readonly SiteCase[];

test("WDEP-04 / SNM-06: every Dependency[] derivation site renders the host-engine marker", async () => {
  // arrange
  const observed: { site: string; marked: boolean; clean: boolean }[] = [];

  // act -- sequential, not `Promise.all`: the three full-orchestrator cases
  // swap `process.env.HOME`, and concurrent drives would race that global.
  for (const siteCase of SITE_CASES) {
    const absent = await siteCase.drive(false);
    const present = await siteCase.drive(true);
    observed.push({
      site: siteCase.site,
      marked: absent.includes(HOST_ENGINE_MARKER),
      clean: !present.includes(HOST_ENGINE_MARKER),
    });
  }

  // assert -- ONE assertion over the whole projection, so reverting a single
  // derivation arm turns exactly one row red and that row names its file.
  assert.deepEqual(observed, [
    {
      site: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/import/execute.ts",
      marked: true,
      clean: true,
    },
    {
      site: "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts",
      marked: true,
      clean: true,
    },
  ]);
});
