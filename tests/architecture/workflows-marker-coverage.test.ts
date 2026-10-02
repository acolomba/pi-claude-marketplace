/**
 * tests/architecture/workflows-marker-coverage.test.ts -- two claims about where
 * soft-dep markers come from.
 *
 * First, the WDEP-04 / SNM-06 cross-site coverage gate for the
 * `requires pi-dynamic-workflows` marker: every `Dependency[]` derivation site
 * renders it. Second, D-12 / SC-5: the extension calls `softDepMarkers` from
 * exactly one module, the resolve step. A second call site would let a surface
 * compose markers that the per-verb marker policy does not govern. The last
 * two cases own that claim, with a planted control.
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
 * The case list is BOUND to the tree, not hand-maintained (WR-04). A literal
 * seven-entry array can only prove the seven sites it already names: an eighth
 * derivation would render no marker and leave this suite green, which is the
 * exact failure mode the word EVERY above claims to exclude. The second case
 * below therefore scans `orchestrators/` for the two shapes a derivation takes
 * here and asserts the discovered file set equals the case list's, so an
 * unlisted site is a red row rather than a silent gap. It is the runtime
 * counterpart of the compile-time totality constructs this codebase reaches for
 * elsewhere (`satisfies Record<DegradeKind, ...>`, `_ReasonsCoverageProof`);
 * the sites are files rather than type members, so the binding cannot be a type.
 *
 * Every case asserts on the RENDERED ROW rather than on an intermediate
 * `Dependency[]`, so all seven prove the same end-to-end claim (D-114-05). Five
 * of the seven derivations are module-private and stay that way: they are
 * reached through their exported outcome-to-row composers or through a full
 * orchestrator entry point, never through an export added to serve a test.
 *
 * Every surface renders from a notification run and reads the run's
 * soft-dependency snapshot (D-05), so the cases seed the snapshot directly. The
 * WDEP-01 discriminator that keeps the decoy `workflow` tool name from reading
 * as the host engine belongs to the `softDepStatus` owner suite.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { importClaudeSettings } from "../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import { composeCascadeMemberRows } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import { listPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { reinstalledRowFromOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { enableRowDependencies } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import { updatedRowFromOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts";
import { dependenciesFromInstall } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { notify } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { runWithSoftDeps } from "../shared/notification-run-seeds.ts";

import {
  EXTENSION_ROOT_REL,
  SOFT_DEP_MARKER_DERIVATION_TARGETS,
  WORKFLOWS_MARKER_COVERAGE_TARGETS,
} from "./gate-targets.ts";
import { filesMatching } from "./source-scan.ts";
import { materializeTargets, plantOffender, withTempRoot } from "./temp-root-control.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const installPlugin = createInstallOperation(
  createHooksRouting(createHooksRuntime(), { readHooksJson }),
  createCompletionCache(),
);

/** The closed-set marker every case looks for. */
const HOST_ENGINE_MARKER = "requires pi-dynamic-workflows";

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
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
  return { ctx, notifications };
}

/** The run whose snapshot reports the host engine as `engineLoaded` and no other companion. */
function runFor(engineLoaded: boolean): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: engineLoaded,
  });
}

/**
 * Render one composed message and return the emitted bytes. The two Tier A and
 * two Tier B cases share this so their claim is the same "this surface renders
 * the marker" claim the three Tier C cases make.
 */
function renderThroughNotify(engineLoaded: boolean, message: NotificationMessage): string {
  const { ctx, notifications } = makeCtx();
  notify(ctx, runFor(engineLoaded), message);
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
  const { ctx, notifications } = makeCtx();
  await installPlugin({
    ctx,
    run: runFor(engineLoaded),
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
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
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
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts",
    drive: async (engineLoaded) =>
      withHermeticHome(async (cwd) => {
        // arrange
        const marketplaceRoot = await seedWorkflowPlugin(cwd);
        await recordMarketplace(cwd, marketplaceRoot);
        await runInstall(cwd, engineLoaded);

        // act
        const { ctx, notifications } = makeCtx();
        await listPlugins({ ctx, run: runFor(engineLoaded), cwd, scope: "project" });

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
    // Tier B: `stagedDependencies` is module-private behind the exported
    // cascade row composer. The ROOT row is supplied already composed, so the
    // member row below is the only one this case's marker can come from.
    site: "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts",
    drive: (engineLoaded) =>
      Promise.resolve(
        renderThroughNotify(engineLoaded, {
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: composeCascadeMemberRows({
                scope: "project",
                rootKey: "hello@mp",
                rootRow: {
                  status: "installed",
                  name: "hello",
                  version: "1.0.0",
                  dependencies: [],
                  severity: "info",
                  needsReload: true,
                },
                installed: [
                  {
                    key: "dep@mp",
                    version: "1.0.0",
                    declaresAgents: false,
                    declaresMcp: false,
                    declaresWorkflows: true,
                    fellBackToCurrentCopy: false,
                    reEnabledFromRecord: false,
                  },
                ],
                alreadyInstalled: [],
                probe: runFor(engineLoaded).softDeps,
              }),
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
                    constraint: undefined,
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
        const { ctx, notifications } = makeCtx();

        // act
        await importClaudeSettings({
          ctx,
          run: runFor(engineLoaded),
          cwd,
          gitOps: createGitOpsFake({ allowedRemoteUrls: [], boundary: "memory" }).gitOps,
          selectedScopes: ["project"],
          hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
          completionCache: createCompletionCache(),
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
  //
  // The expectation is PROJECTED from the case list rather than spelled a
  // second time (IN-03): only the two booleans are literal here. A typo in a
  // duplicated path would have reported two differing paths, which reads as a
  // rename rather than as the coverage failure it is.
  assert.deepEqual(
    observed,
    SITE_CASES.map(({ site }) => ({ site, marked: true, clean: true })),
  );
});

/**
 * The two spellings a `Dependency[]` derivation takes under `orchestrators/`:
 * a function whose declared return type is the tuple, and a local mutable
 * accumulator that is pushed into. Both are anchored so the pattern cannot
 * match a mere type ANNOTATION -- an interface field spelled
 * `readonly dependencies: readonly Dependency[];` carries no derivation and
 * must not turn this gate red, or the first purely-typed change would invite a
 * suppression instead of a fix.
 */
const DERIVATION_SHAPE =
  /\)\s*:\s*(?:readonly\s+)?Dependency\[\]\s*\{|:\s*Dependency\[\]\s*=\s*\[\s*\]/;

test("WDEP-04: the case list covers every Dependency[] derivation site", async () => {
  // arrange + act -- discover the sites from the tree rather than trusting the
  // enumeration above. `filesMatching` strips comments first, so the several
  // prose mentions of `Dependency[]` in these files' headers do not count as
  // derivations.
  const discovered = await filesMatching(
    "extensions/pi-claude-marketplace/orchestrators",
    DERIVATION_SHAPE,
  );

  // assert -- set equality in BOTH directions. An eighth derivation that no
  // case drives is a red row here even though its own surface renders no
  // marker; a case whose site no longer derives anything is red too, so a
  // deleted derivation cannot leave a case asserting against nothing.
  assert.deepEqual(
    discovered,
    [...SITE_CASES].map(({ site }) => site).sort(),
    "WDEP-04: the Dependency[] derivation sites on disk no longer match SITE_CASES. A site present here and absent there renders no host-engine marker and nothing else would notice; add a case that drives its PUBLIC surface. A site absent here and present there has lost its derivation; retire the case with it.",
  );
});

/**
 * A call to the marker helper. The lookbehind skips its declaration in
 * `shared/concerns/soft-dep.ts`, which names the helper but derives nothing.
 */
const MARKER_DERIVATION_CALL = /(?<!function\s)\bsoftDepMarkers\(/;

/** The real orchestrator whose copy receives the planted call. */
const PLANTED_CALLER_HOST: (typeof WORKFLOWS_MARKER_COVERAGE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";

const SINGLE_DERIVATION_SITE_MESSAGE =
  "D-12 / SC-5: softDepMarkers is called outside the resolve module, or no longer called there. A second derivation site would let a surface compose markers the policy table does not govern; route the row through resolveRows instead.";

test("D-12 / SC-5: softDepMarkers is called only from the resolve module", async () => {
  // act
  const discovered = await filesMatching(EXTENSION_ROOT_REL, MARKER_DERIVATION_CALL);

  // assert -- set equality in both directions, so a new caller and a lost
  // resolve call are both red.
  assert.deepEqual(
    discovered,
    [...SOFT_DEP_MARKER_DERIVATION_TARGETS],
    SINGLE_DERIVATION_SITE_MESSAGE,
  );
});

test("D-12: the derivation-site scan reports a softDepMarkers call planted in a copy of a real orchestrator", async () => {
  await withTempRoot("marker-derivation-offender-", async (root) => {
    // arrange
    await materializeTargets(root, SOFT_DEP_MARKER_DERIVATION_TARGETS);
    await plantOffender(
      root,
      PLANTED_CALLER_HOST,
      "export const plantedMarkers = softDepMarkers(true, false, false, snapshot);",
    );

    // act
    const discovered = await filesMatching(EXTENSION_ROOT_REL, MARKER_DERIVATION_CALL, { root });

    // assert
    assert.deepEqual(
      discovered,
      [PLANTED_CALLER_HOST, ...SOFT_DEP_MARKER_DERIVATION_TARGETS].sort(),
    );
  });
});
