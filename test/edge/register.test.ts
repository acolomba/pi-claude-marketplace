// Owner suite for `edge/register.ts`: the D-04 registration glue that wires the
// `/claude:plugin` slash command, the TC-7 autocomplete wrapper, and the two
// read-only LLM tools onto the Pi extension API.
//
// Registration is not the behavior. Every callback this module hands to Pi is
// captured off the recorded call and INVOKED, because a callback that is only
// installed leaves its body unexecuted. That covers the suggestion
// pass-through and the file-completion trigger.
//
// Capturing a callback is the one place `It.willCapture` earns its keep: a
// function argument cannot be compared structurally, so the expectation states
// the command name and the event name by hand and captures only the callback
// beside them. A registration under any other name or event has no expectation
// and fails where it happens.
//
// What this pair deliberately leaves to its neighbours: the subcommand dispatch
// matrix and both usage blocks (`test/edge/router.test.ts`), the completion
// candidate sets (`test/edge/completions/provider.test.ts` and
// `.../data.test.ts`), the whitespace collapse itself
// (`test/edge/completions/normalize.test.ts`), and the two tool bodies
// (`test/edge/handlers/tools.test.ts`). This suite owns the wiring only, so the
// router case pins the token it hands over and reads the surrounding usage block
// off the router rather than keeping a second copy of a text its own owner pins.
//
// No exhaustiveness claim: `register.ts` carries no `switch` and no closed-union
// dispatch. The handler record it builds is compile-enforced by
// `SubcommandHandlers`, so a case asserting that record has every key would
// restate a compiler guarantee and is deliberately absent.
//
// NFR-5: every case installs a fail-fast replacement of `https.request`, the
// door the git transport opens. NO CASE ASSERTS A CALL COUNT AGAINST IT. No
// input to this module opens a transport -- the completion path reads the two
// scope roots off disk and the git operations are injected and never invoked --
// so a zero here could not rise, which is why none is asserted. What the
// replacement is, is a hermeticity device: a dial-out reached from any of these
// cases fails where it happens. See `installNetworkTrap`.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import lockfile from "proper-lockfile";
import { It, mock, verify, when } from "strong-mock";
import { Type } from "typebox";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  registerClaudeMarketplaceTools,
  registerClaudePluginCommand,
} from "../../extensions/pi-claude-marketplace/edge/register.ts";
import {
  MARKETPLACE_SUBCOMMANDS,
  TOP_LEVEL_SUBCOMMANDS,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { makeLocationsResolver } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { UnsupportedModeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  notify,
  notifyUsageInfo,
  notifyUsageError,
  notifyDiagnostic,
  notifyDeviceFlowPrompt,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { openNotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { retryTree } from "../orchestrators/plugin/scope-tree-inventory.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { noStatusSnapshot } from "../platform/mcp-status-seed.ts";

import { buildInstalledPluginRecord } from "./handlers/marketplace-seed.ts";
import { createJsonCapture } from "./json-capture.ts";
import { createNotificationBoundary, expectSoftDepProbes } from "./notification-boundary.ts";

import type { Notification } from "./notification-boundary.ts";
import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";
import type { ClaudeImportExecutionResult } from "../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import type { UpdatePluginsFn } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import type { PluginUpdateOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";
import type {
  AutocompleteItem,
  AutocompleteProvider,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type ImportDelegate = NonNullable<EdgeDeps["importClaudeSettings"]>;

/** The options bag `registerCommand` receives, derived from the Pi surface. */
type CommandRegistration = Parameters<ExtensionAPI["registerCommand"]>[1];

/** The factory `addAutocompleteProvider` receives, derived from the Pi surface. */
type AutocompleteProviderFactory = Parameters<ExtensionContext["ui"]["addAutocompleteProvider"]>[0];

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

/** The listener shape the `session_start` overload accepts. */
type SessionStartListener = (event: SessionStartEvent, ctx: ExtensionContext) => void;

/**
 * The tool definition shape `registerTool` receives, minus the two optional
 * custom renderers, mirroring `test/edge/handlers/tools.test.ts`.
 */
type ToolRegistration = Omit<
  Parameters<ExtensionAPI["registerTool"]>[0],
  "renderCall" | "renderResult"
>;

/**
 * The Pi API with `registerTool` restated as a property. The API declares it as
 * a generic method, whose uninstantiated form no concrete definition matches, so
 * the narrowed shape is what an expectation can name. It is still what both
 * registration entrypoints accept.
 */
type PiRegistrar = Omit<ExtensionAPI, "registerTool"> & {
  readonly registerTool: (tool: ToolRegistration) => void;
};

const EXPECTED_TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|prune|update|fetch|reinstall|list|ls|info|pending|apply|autoapply|enable|disable|import|browse|marketplace|market|help> ...\n" +
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope and enable autoupdate\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local] [--prune]\n" +
  "  prune [--scope user|project] [--dry-run]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  list [<marketplace>] [--scope user|project]   (alias: ls)\n" +
  "  info <plugin>@<marketplace> [--scope user|project]\n" +
  "  pending [--scope user|project]\n" +
  "  apply [--scope user|project]\n" +
  "  autoapply [on|off] [--scope user|project] [--local]\n" +
  "  enable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  disable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  import [--scope user|project]\n" +
  "  browse\n" +
  "  marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...   (alias: market)\n" +
  "  help [marketplace]";

interface HermeticScope {
  readonly cwd: string;
}

interface CommandUnderTest {
  readonly registration: CommandRegistration;
  readonly sessionStart: SessionStartListener;
  readonly verifyRegistrar: () => void;
}

/**
 * The Pi inventory reads a registered command promises. `runs` is the number
 * of handler invocations: each opens one notification run whose snapshot takes
 * one soft-dependency probe (D-05; `expectSoftDepProbes` states its reads).
 */
interface CommandProbes {
  readonly runs: number;
  readonly capture?: Pick<ReturnType<typeof createJsonCapture>, "entrySink">;
  readonly createInvocationId?: () => string;
  readonly createRecoveryId?: () => string;
  readonly appendAttempts?: number;
  readonly updatePlugins?: UpdatePluginsFn;
}

interface WrapperUnderTest {
  readonly wrap: AutocompleteProviderFactory;
  readonly verifyBoundary: () => void;
}

const EXPECTED_COMMAND_DESCRIPTION =
  "Manage Claude plugin marketplaces and plugins. Bootstrap, install, uninstall, prune, list, import, " +
  "update, and reinstall plugins from configured marketplaces.";

const OWN_COMMAND_LINE = "/claude:plugin install  alpha";
const FOREIGN_COMMAND_LINE = "/other-extension  alpha";
const CHOSEN_ITEM: AutocompleteItem = { label: "alpha", value: "install alpha " };
const SESSION_START: SessionStartEvent = { type: "session_start", reason: "startup" };

/**
 * Replace the door the git transport opens with a fail-fast throw owned by the
 * test context, which restores it after the case.
 *
 * A HERMETICITY DEVICE, not an offline proof, and no case asserts a call count
 * against it. No input to this module opens a transport -- the completion path
 * reads the two scope roots off disk, and the git operations are injected and
 * never invoked -- so a zero here could not rise whatever this module did. The
 * value of the replacement is that a dial-out reached from any of these cases
 * fails where it happens.
 *
 * The door is `https.request` because that is the one the git transport opens:
 * `isomorphic-git/http/node` reaches the wire through `simple-get`, which calls
 * `https.request`. `globalThis.fetch` is NOT watched -- its only production
 * caller in this repository is the device flow in `domain/github-auth.ts`,
 * which no registration or completion enters.
 */
function installNetworkTrap(t: TestContext): void {
  t.mock.method(https, "request", (): never => {
    throw new Error("the registration glue must not open a network connection");
  });
}

/**
 * The tool pi-subagents registers. Its name is what the RH-3 soft-dependency
 * probe looks for; the other fields only satisfy the Pi tool shape.
 */
function subagentTool(): ReturnType<ExtensionAPI["getAllTools"]>[number] {
  return {
    name: "subagent",
    description: "test tool subagent",
    parameters: Type.Object({}),
    exposure: "direct",
    sourceInfo: {
      origin: "top-level",
      path: "/test/tools/subagent.ts",
      scope: "temporary",
      source: "test",
    },
  };
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). This module holds
 * the one sanctioned read of the process working directory, so the case owns
 * that too -- it moves into its own root and the restore is registered before
 * anything runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const previousCwd = process.cwd();
  t.after(() => {
    process.chdir(previousCwd);
  });
  const { cwd } = await createHermeticEnvironment(t, `register-${label}-`);
  process.chdir(cwd);
  installNetworkTrap(t);
  return { cwd };
}

function marketplaceRecordIn(root: string, marketplaceName: string): MarketplaceRecord {
  const marketplaceRoot = path.join(root, "marketplaces", marketplaceName);
  return {
    name: marketplaceName,
    scope: "project",
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: root,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {},
  };
}

/** Record project-scope marketplaces under `root`, the completion read path. */
async function seedProjectMarketplaces(
  root: string,
  marketplaceNames: readonly string[],
): Promise<void> {
  const extensionRoot = path.join(root, ".pi", "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(
      marketplaceNames.map((name) => [name, marketplaceRecordIn(root, name)]),
    ),
  });
}

/** Record one project-scope marketplace under `root`. */
async function seedProjectMarketplace(root: string, marketplaceName: string): Promise<void> {
  await seedProjectMarketplaces(root, [marketplaceName]);
}

async function seedPrunableScope(scope: Scope, cwd: string): Promise<ExtensionState> {
  const locations = locationsFor(scope, cwd);
  const marketplaceRoot = path.join(locations.extensionRoot, "sources", "mp");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "orphan");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "orphan", source: "./plugins/orphan" }] }),
  );
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "orphan", version: "1.0.0" }),
  );
  const skillPath = path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, "---\nname: orphan-skill\n---\nbody\n");
  const state: ExtensionState = {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope,
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          orphan: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              workflows: [],
              skills: ["orphan-skill"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            provenance: "dependency",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await saveState(locations.extensionRoot, state);
  return state;
}

/**
 * The injected dependency bag. The git operations are a memory-boundary fake and
 * the three orchestrator entrypoints refuse to run: no case here dispatches a
 * subcommand that reaches them, so a call is a defect rather than a fixture gap.
 */
function createEdgeDeps(
  completionCache: CompletionCache,
  importClaudeSettings?: ImportDelegate,
  gitOps?: EdgeDeps["gitOps"],
): EdgeDeps {
  const selectedGitOps = gitOps ?? createGitOpsFake({ boundary: "memory" }).gitOps;
  return {
    completionCache,
    mcpStatus: noStatusSnapshot(),
    gitOps: selectedGitOps,
    beginPluginUpdateRun: () => (): Promise<PluginUpdateOutcome> => {
      throw new Error("the registration glue must not run a plugin update");
    },
    applyReconcile: (): Promise<void> => {
      throw new Error("the registration glue must not run a reconcile apply");
    },
    importClaudeSettings:
      importClaudeSettings ??
      ((): Promise<ClaudeImportExecutionResult> => {
        throw new Error("the registration glue must not run a settings import");
      }),
  } satisfies EdgeDeps;
}

/**
 * Register the command against a strict Pi handle and hand back both captured
 * callbacks. The command name and the event name are stated by hand; only the
 * two callbacks are captured, because a function has no structural comparison.
 */
function registerCommandWithCache(
  completionCache: CompletionCache,
  hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson }),
  importClaudeSettings?: ImportDelegate,
  probes: CommandProbes = { runs: 0 },
  gitOps?: EdgeDeps["gitOps"],
): CommandUnderTest {
  const pi = mock<PiRegistrar>({ exactParams: true, name: "extension API" });
  const commandOptions = It.willCapture<CommandRegistration>("claude:plugin registration");
  const sessionStartListener = It.willCapture<SessionStartListener>("session start listener");
  when(() => {
    pi.registerCommand("claude:plugin", commandOptions);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("session_start", sessionStartListener);
  })
    .thenReturn()
    .times(1);
  if (probes.capture !== undefined) {
    const capture = probes.capture;
    function appendEntry(this: PiRegistrar, customType: string, payload: unknown): void {
      assert.strictEqual(this, pi);
      capture.entrySink.appendEntry(customType, payload);
    }

    when(() => pi.appendEntry)
      .thenReturn(appendEntry)
      .times(probes.appendAttempts ?? 1);
  }

  expectSoftDepProbes(pi, probes.runs);

  registerClaudePluginCommand(
    pi,
    createEdgeDeps(completionCache, importClaudeSettings, gitOps),
    hooksRouting,
    probes.updatePlugins ??
      createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
    {
      createInvocationId: probes.createInvocationId ?? (() => "run-list-1"),
      ...(probes.createRecoveryId === undefined
        ? {}
        : { createRecoveryId: probes.createRecoveryId }),
    },
  );

  const registration = commandOptions.value;
  const sessionStart = sessionStartListener.value;
  if (registration === undefined || sessionStart === undefined) {
    throw new Error("the registration glue installed no command or no session listener");
  }

  return {
    registration,
    sessionStart,
    verifyRegistrar: (): void => {
      verify(pi);
    },
  };
}

function registerCommandUnderTest(probes: CommandProbes): CommandUnderTest {
  return registerCommandWithCache(createCompletionCache(), undefined, undefined, probes);
}

for (const mode of ["json", "rpc"]) {
  for (const ending of ["success", "typed-failure", "missing", "throw"] as const) {
    test(`awaits delayed ${ending} output before registered settlement in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "delayed-update");
      const capture = createJsonCapture();
      const events: unknown[] = [];
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let late!: () => void;
      const origin = { kind: "command", commandId: "plugin update", invocationId: "run-list-1" };
      const prompt = {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin,
          kind: "device-flow-prompt",
          severity: "info",
          needsReload: false,
          verificationUri: "https://example.test/device",
          userCode: "WAIT-1234",
        },
      };
      const warning = {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin,
          kind: "prune-committed-warning",
          severity: "warning",
          needsReload: true,
          summary: "Prune committed; finalization needs attention.",
          scope: "project",
          cause: { causeChain: ["Saved."], truncated: false },
        },
      };
      const completion =
        ending === "missing"
          ? commandErrorEntry("plugin update", "run-list-1", "Command returned without an outcome.")
          : ending === "throw"
            ? commandErrorEntry("plugin update", "run-list-1", "Delayed failure.", true)
            : {
                customType: "claude-plugin",
                payload: {
                  schemaVersion: 1,
                  origin,
                  kind: "usage-error",
                  severity: "error",
                  needsReload: false,
                  message: "Update refused.",
                  usage: "Usage: update",
                },
              };
      const expected =
        ending === "success"
          ? [prompt, warning]
          : ending === "throw"
            ? [prompt, warning, completion]
            : [prompt, completion];
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        appendAttempts: expected.length,
        capture: {
          entrySink: {
            appendEntry(customType, payload) {
              capture.entrySink.appendEntry(customType, payload);
              events.push({ customType, payload });
            },
          },
        },
        updatePlugins: async ({ ctx, run }) => {
          late = () => {
            notifyDiagnostic(ctx, run, "Late.", ["Ignored."]);
          };

          notifyDeviceFlowPrompt(ctx, run, {
            verificationUri: "https://example.test/device",
            userCode: "WAIT-1234",
          });
          await pending;
          if (ending === "success" || ending === "throw") {
            notify(ctx, run, {
              kind: "prune-committed-warning",
              scope: "project",
              cause: new Error("Saved."),
            });
          }

          if (ending === "typed-failure") {
            notifyUsageError(ctx, run, { message: "Update refused.", usage: "Usage: update" });
          }

          if (ending === "throw") {
            throw new Error("Delayed failure.");
          }
        },
      });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };

      // act
      const command = Promise.resolve(
        Reflect.apply(registration.handler, undefined, ["update", ctx]),
      ).then(() => {
        events.push("settled");
      });
      await Promise.resolve();
      const beforeRelease = [...events];
      release();
      await command;
      ctx.mode = "invalid-mode";
      late();

      // assert
      assert.deepStrictEqual(beforeRelease, [prompt]);
      assert.deepStrictEqual(events, [...expected, "settled"]);
      assert.deepStrictEqual(capture.entries, expected);
      capture.assertValid();
      verifyRegistrar();
    });
  }
}

function commandErrorEntry(
  commandId: string,
  invocationId: string,
  message: string,
  needsReload = false,
): object {
  return {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      kind: "internal-error",
      origin: { kind: "command", commandId, invocationId },
      severity: "error",
      needsReload,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: [message], truncated: false },
    },
  };
}

for (const mode of ["json", "rpc"]) {
  for (const projectSucceeds of [true, false]) {
    test(`registered marketplace info preserves ${projectSucceeds ? "partial" : "total"} scope failures in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "info-failures");
      const records: MarketplaceRecord[] = [];
      for (const scope of ["project", "user"] as const) {
        const locations = locationsFor(scope, cwd);
        const record = { ...marketplaceRecordIn(locations.extensionRoot, "demo"), scope };
        records.push(record);

        await mkdir(path.dirname(record.manifestPath), { recursive: true });

        await writeFile(
          record.manifestPath,
          scope === "project" && projectSucceeds
            ? JSON.stringify({ name: "demo", plugins: [] })
            : "{",
        );

        await saveState(locations.extensionRoot, {
          schemaVersion: 2,
          marketplaces: { demo: record },
        });
      }

      const capture = createJsonCapture();
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        capture,
        appendAttempts: 2,
      });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };
      const origin = { kind: "command", commandId: "marketplace info", invocationId: "run-list-1" };
      const expected = [
        ...(projectSucceeds
          ? [
              {
                customType: "claude-plugin",
                payload: {
                  schemaVersion: 1,
                  origin,
                  kind: "marketplace-info",
                  severity: "info",
                  needsReload: false,
                  name: "demo",
                  scope: "project",
                  details: { autoupdate: false },
                  source: { sourceKind: "path", absPath: records[0]!.marketplaceRoot },
                },
              },
            ]
          : []),
        ...(projectSucceeds ? ["user"] : ["project", "user"]).map((scope) => ({
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin,
            kind: "plugin-info",
            severity: "error",
            needsReload: false,
            summary: "A plugin operation has failed.",
            marketplaceName: "demo",
            marketplaceScope: scope,
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "failed",
              name: "demo",
              id: "demo",
              scope,
              reasons: ["unparseable"],
              componentsResolved: false,
            },
          },
        })),
      ];

      // act
      await Reflect.apply(registration.handler, undefined, ["marketplace info demo", ctx]);

      // assert
      assert.deepStrictEqual(capture.entries, expected);
      capture.assertValid();
      verifyRegistrar();
    });
  }

  test(`settles overlapping silent imports independently of lifecycle output in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "silent-imports");
    const capture = createJsonCapture();
    const events: unknown[] = [];
    const entrySink = {
      appendEntry(customType: string, payload: unknown): void {
        capture.entrySink.appendEntry(customType, payload);
        events.push({ customType, payload });
      },
    };
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });
    const completions = [first, second];
    const ids = ["run-a", "run-b"];
    const late: Array<() => void> = [];
    const importClaudeSettings: ImportDelegate = async ({ ctx, run }) => {
      late.push(() => {
        notifyUsageInfo(ctx, run, "Too late.");
      });
      await completions.shift();
      return {
        addedMarketplaces: [],
        changedResources: false,
        diagnostics: [],
        installedPlugins: [],
        marketplaceFailures: [],
        skippedExistingMarketplaces: [],
        skippedExistingPlugins: [],
        sourceMismatches: [],
        unexpectedPluginFailures: [],
        warnings: [],
      };
    };

    const { registration, verifyRegistrar } = registerCommandWithCache(
      createCompletionCache(),
      undefined,
      importClaudeSettings,
      {
        runs: 2,
        capture: { entrySink },
        appendAttempts: 2,
        createInvocationId: () => ids.shift()!,
      },
    );
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };
    const independent = { ...entrySink, getAllTools: () => [], getCommands: () => [] };

    // act
    const firstCommand = Promise.resolve(
      Reflect.apply(registration.handler, undefined, ["import", ctx]),
    ).then(() => {
      events.push("settled-a");
    });
    notifyUsageInfo(ctx, openNotificationRun(independent, { kind: "hook" }), "Independent.");
    const secondCommand = Promise.resolve(
      Reflect.apply(registration.handler, undefined, ["import", ctx]),
    ).then(() => {
      events.push("settled-b");
    });
    notifyUsageInfo(ctx, openNotificationRun(independent, { kind: "load" }), "Independent.");
    finishSecond();
    await secondCommand;
    finishFirst();
    await firstCommand;

    // assert
    const expected = [
      ...["hook", "load"].map((kind) => ({
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind },
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          usage: "Independent.",
        },
      })),
      commandErrorEntry("plugin import", "run-b", "Command returned without an outcome."),
      commandErrorEntry("plugin import", "run-a", "Command returned without an outcome."),
    ];
    assert.deepStrictEqual(capture.entries, expected);
    assert.deepStrictEqual(events, [
      expected[0],
      expected[1],
      expected[2],
      "settled-b",
      expected[3],
      "settled-a",
    ]);
    assert.strictEqual(late.length, 2);
    ctx.mode = "stale";
    for (const callback of late) {
      callback();
    }

    assert.deepStrictEqual(capture.entries, expected);
    assert.deepStrictEqual(ids, []);
    capture.assertValid();
    verifyRegistrar();
  });

  for (const recoveryFails of [false, true]) {
    test(`registered sink recovery ${recoveryFails ? "closes" : "reopens"} delivery in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "root-recovery");
      const attempts: object[] = [];
      const entrySink = {
        appendEntry(customType: string, payload: unknown): void {
          attempts.push({ customType, payload });
          if (attempts.length === 1 || (recoveryFails && attempts.length === 2)) {
            throw new Error("Append failed.");
          }
        },
      };
      let late: () => void = () => {
        throw new Error("Callback not captured");
      };

      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        capture: { entrySink },
        appendAttempts: recoveryFails ? 2 : 4,
        updatePlugins: ({ ctx, run }) => {
          late = () => {
            notifyUsageInfo(ctx, run, "Too late.");
          };

          notifyUsageInfo(ctx, run, "Before.");
          notify(ctx, run, {
            kind: "prune-committed-warning",
            scope: "user",
            cause: new Error("Saved."),
          });
          return Promise.reject(new Error("Later failure."));
        },
      });
      const ctx = {
        mode,
        cwd,
        get ui(): never {
          throw new Error("Unexpected UI");
        },
      };
      const origin = { kind: "command", commandId: "plugin update", invocationId: "run-list-1" };
      const expected = [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin,
            kind: "usage-info",
            severity: "info",
            needsReload: false,
            usage: "Before.",
          },
        },
        commandErrorEntry("plugin update", "run-list-1", "Append failed."),
        ...(recoveryFails
          ? []
          : [
              {
                customType: "claude-plugin",
                payload: {
                  schemaVersion: 1,
                  origin,
                  kind: "prune-committed-warning",
                  severity: "warning",
                  needsReload: true,
                  summary: "Prune committed; finalization needs attention.",
                  scope: "user",
                  cause: { causeChain: ["Saved."], truncated: false },
                },
              },
              commandErrorEntry("plugin update", "run-list-1", "Later failure.", true),
            ]),
      ];

      // act
      await Reflect.apply(registration.handler, undefined, ["update", ctx]);

      // assert
      assert.deepStrictEqual(attempts, expected);
      ctx.mode = "stale";
      late();
      assert.deepStrictEqual(attempts, expected);
      verifyRegistrar();
    });
  }

  for (const startup of [false, true]) {
    test(`registered ${startup ? "allocator" : "missing-outcome"} error cannot restart failed recovery in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "terminal-recovery");
      const attempts: object[] = [];
      const entrySink = {
        appendEntry(customType: string, payload: unknown): never {
          attempts.push({ customType, payload });
          throw new Error("Append failed.");
        },
      };
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: startup ? 0 : 1,
        capture: { entrySink },
        appendAttempts: 2,
        createInvocationId: () => {
          if (startup) {
            throw new Error("ID failed.");
          }

          return "run-list-1";
        },
        createRecoveryId: () => "recovery-a",
        updatePlugins: () => {
          assert.strictEqual(startup, false);
          return Promise.resolve();
        },
      });
      const ctx = {
        mode,
        cwd,
        get ui(): never {
          throw new Error("Unexpected UI");
        },
      };

      // act
      await Reflect.apply(registration.handler, undefined, ["update", ctx]);

      // assert
      const invocationId = startup ? "recovery-a" : "run-list-1";
      assert.deepStrictEqual(attempts, [
        commandErrorEntry(
          "plugin update",
          invocationId,
          startup ? "ID failed." : "Command returned without an outcome.",
        ),
        commandErrorEntry("plugin update", invocationId, "Append failed."),
      ]);
      verifyRegistrar();
    });
  }

  for (const stale of [false, true]) {
    test(`registered completion preserves a live ${stale ? "throwing" : "invalid"} mode failure in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "live-mode");
      const capture = createJsonCapture();
      let finished = false;
      const failure = new Error("Mode getter expired.");
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        updatePlugins: () => {
          finished = true;
          return Promise.resolve();
        },
      });
      const ctx = {
        cwd,
        get mode() {
          if (!finished) {
            return mode;
          }

          if (stale) {
            throw failure;
          }

          return "invalid-mode";
        },
        get ui() {
          return capture.ui;
        },
      };

      // act & assert
      await assert.rejects(
        async () => {
          await Reflect.apply(registration.handler, undefined, ["update", ctx]);
        },
        (error: unknown) => (stale ? error === failure : error instanceof UnsupportedModeError),
      );
      assert.deepStrictEqual(capture.entries, []);
      capture.assertValid();
      verifyRegistrar();
    });
  }

  for (const { name, emit, earlier } of [
    { name: "silent", emit: () => undefined, earlier: [] },
    {
      name: "diagnostic-only",
      emit: (ctx, run) => {
        notifyDiagnostic(ctx, run, "Warning.", ["Detail."]);
      },
      earlier: [
        { kind: "diagnostic", severity: "warning", header: "Warning.", lines: ["Detail."] },
      ],
    },
    {
      name: "prompt-only",
      emit: (ctx, run) => {
        notifyDeviceFlowPrompt(ctx, run, {
          verificationUri: "https://example.test",
          userCode: "ABCD",
        });
      },
      earlier: [
        {
          kind: "device-flow-prompt",
          severity: "info",
          verificationUri: "https://example.test",
          userCode: "ABCD",
        },
      ],
    },
  ] satisfies Array<{
    name: string;
    emit: (ctx: NotificationContext, run: NotificationRun) => void;
    earlier: object[];
  }>) {
    test(`registered ${name} update completes with an error in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "missing-outcome");
      const capture = createJsonCapture();
      let late: () => void = () => {
        throw new Error("Callback not captured");
      };

      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        capture,
        appendAttempts: earlier.length + 1,
        updatePlugins: ({ ctx, run }) => {
          emit(ctx, run);
          late = () => {
            notifyUsageInfo(ctx, run, "Too late.");
          };

          return Promise.resolve();
        },
      });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };
      const expected = [
        ...earlier.map((payload) => ({
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin update", invocationId: "run-list-1" },
            needsReload: false,
            ...payload,
          },
        })),
        commandErrorEntry("plugin update", "run-list-1", "Command returned without an outcome."),
      ];

      // act
      await Reflect.apply(registration.handler, undefined, ["update", ctx]);

      // assert
      assert.deepStrictEqual(capture.entries, expected);
      ctx.mode = "stale";
      late();
      assert.deepStrictEqual(capture.entries, expected);
      capture.assertValid();
      verifyRegistrar();
    });
  }

  for (const { args, commandId, payload } of [
    {
      args: "list --scope project",
      commandId: "plugin list",
      payload: { kind: "cascade", marketplaces: [] },
    },
    {
      args: "update --scope project",
      commandId: "plugin update",
      payload: { kind: "cascade", marketplaces: [], noOp: true },
    },
    {
      args: "pending --scope project",
      commandId: "plugin pending",
      payload: { kind: "reconcile-pending-empty" },
    },
    {
      args: "prune --scope project",
      commandId: "plugin prune",
      payload: { kind: "prune-empty", scope: "project" },
    },
    {
      args: "help",
      commandId: "plugin help",
      payload: { kind: "usage-info", usage: EXPECTED_TOP_LEVEL_USAGE },
    },
  ]) {
    test(`registered ${args} accepts its empty or help outcome in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "valid-empty");
      const capture = createJsonCapture();
      const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 1, capture });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };

      // act
      await Reflect.apply(registration.handler, undefined, [args, ctx]);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId, invocationId: "run-list-1" },
            severity: "info",
            needsReload: false,
            ...payload,
          },
        },
      ]);
      capture.assertValid();
      verifyRegistrar();
    });
  }

  test(`registered update reports a failed ID allocator before inventory in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "update-id-failure");
    const capture = createJsonCapture();
    const ids = mock<{ primary(): string; recovery(): string }>({
      exactParams: true,
      name: "invocation IDs",
    });
    when(() => ids.primary())
      .thenThrow(new Error("ID failed"))
      .times(1);
    when(() => ids.recovery())
      .thenReturn("recovery-a")
      .times(1);
    const { registration, verifyRegistrar } = registerCommandUnderTest({
      runs: 0,
      capture,
      createInvocationId: () => ids.primary(),
      createRecoveryId: () => ids.recovery(),
      updatePlugins: () => {
        throw new Error("Unexpected update");
      },
    });
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await Reflect.apply(registration.handler, undefined, ["update", ctx]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "internal-error",
          origin: { kind: "command", commandId: "plugin update", invocationId: "recovery-a" },
          severity: "error",
          needsReload: false,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: ["ID failed"], truncated: false },
        },
      },
    ]);
    capture.assertValid();
    verifyRegistrar();
    verify(ids);
  });

  test(`registered update delivers an unexpected failure before output in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "update-failure");
    const capture = createJsonCapture();
    const { registration, verifyRegistrar } = registerCommandUnderTest({
      runs: 1,
      capture,
      updatePlugins: () => Promise.reject(new Error("Update failed.")),
    });
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };

    // act
    const completion = await Promise.resolve()
      .then(async () => {
        await Reflect.apply(registration.handler, undefined, ["update", ctx]);
      })
      .then(
        () => "fulfilled",
        () => "rejected",
      );

    // assert
    assert.strictEqual(completion, "fulfilled");
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "internal-error",
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-list-1" },
          severity: "error",
          needsReload: false,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: ["Update failed."], truncated: false },
        },
      },
    ]);
    capture.assertValid();
    verifyRegistrar();
  });

  test(`registered update retains equal earlier entries before failure in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "update-partial");
    const capture = createJsonCapture();
    const { registration, verifyRegistrar } = registerCommandUnderTest({
      runs: 1,
      capture,
      appendAttempts: 3,
      updatePlugins: ({ ctx, run }) => {
        notifyUsageInfo(ctx, run, "Updated.");
        notifyUsageInfo(ctx, run, "Updated.");
        return Promise.reject(new Error("Update failed."));
      },
    });
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };
    const earlierEntry = {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "usage-info",
        origin: { kind: "command", commandId: "plugin update", invocationId: "run-list-1" },
        severity: "info",
        needsReload: false,
        usage: "Updated.",
      },
    };

    // act
    await Reflect.apply(registration.handler, undefined, ["update", ctx]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      earlierEntry,
      earlierEntry,
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "internal-error",
          origin: { kind: "command", commandId: "plugin update", invocationId: "run-list-1" },
          severity: "error",
          needsReload: false,
          summary: "Command failed unexpectedly.",
          cause: { causeChain: ["Update failed."], truncated: false },
        },
      },
    ]);
    capture.assertValid();
    verifyRegistrar();
  });
}

for (const mode of ["json", "rpc"]) {
  for (const { args, commandId } of [
    { args: "list --scope project", commandId: "plugin list" },
    { args: "ls --scope project", commandId: "plugin list" },
  ]) {
    test(`registered ${JSON.stringify(args)} appends a complete cascade in ${mode} without UI access`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "machine-list");
      await seedProjectMarketplace(cwd, "demo");
      const manifestPath = marketplaceRecordIn(cwd, "demo").manifestPath;
      await mkdir(path.dirname(manifestPath), { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ name: "demo", plugins: [] }));
      const capture = createJsonCapture();
      const ids = mock<{ createInvocationId(): string }>({
        exactParams: true,
        name: "invocation IDs",
      });
      when(() => ids.createInvocationId())
        .thenReturn("run-list-1")
        .times(1);
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        capture,
        createInvocationId: () => ids.createInvocationId(),
      });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };

      // act
      try {
        await Reflect.apply(registration.handler, undefined, [args, ctx]);
      } catch {
        // The retained capture ledger below must expose caught delivery failures.
      }

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "cascade",
            origin: { kind: "command", commandId, invocationId: "run-list-1" },
            severity: "info",
            needsReload: false,
            tally: { label: "Plugin list", success: { count: 0 }, failures: 0, warnings: 0 },
            marketplaces: [{ name: "demo", scope: "project", plugins: [] }],
          },
        },
      ]);
      capture.assertValid();
      verifyRegistrar();
      verify(ids);
    });
  }
}

for (const mode of ["json", "rpc"] as const) {
  for (const args of ["browse", "", " \t "]) {
    test(`registered ${JSON.stringify(args)} refuses each browse invocation in ${mode} without state or UI access`, async () => {
      // arrange
      const capture = createJsonCapture();
      let invocation = 0;
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 2,
        capture,
        appendAttempts: 2,
        createInvocationId: () => `browse-run-${++invocation}`,
      });
      const ctx = {
        mode,
        get cwd(): string {
          throw new Error("Browse refusal must not load marketplace state");
        },
        get ui() {
          return capture.ui;
        },
      };

      // act
      await Reflect.apply(registration.handler, undefined, [args, ctx]);
      await Reflect.apply(registration.handler, undefined, [args, ctx]);

      // assert
      assert.deepStrictEqual(
        capture.entries,
        ["browse-run-1", "browse-run-2"].map((invocationId) => ({
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "usage-error",
            origin: { kind: "command", commandId: "plugin browse", invocationId },
            severity: "error",
            needsReload: false,
            message: `Browse is unavailable in ${mode} mode. Use /claude:plugin list instead.`,
            usage: "Usage: /claude:plugin browse",
          },
        })),
      );
      capture.assertValid();
      verifyRegistrar();
    });
  }
}

for (const mode of ["json", "rpc"] as const) {
  for (const { args, commandId, message, usage } of [
    {
      args: "help marketplace extra",
      commandId: "plugin help",
      message: "Too many arguments.",
      usage: "Usage: /claude:plugin help [marketplace]",
    },
    {
      args: "help invalid",
      commandId: "plugin help",
      message: 'Unknown help topic: "invalid".',
      usage: "Usage: /claude:plugin help [marketplace]",
    },
    {
      args: "marketplace help extra",
      commandId: "marketplace help",
      message: "marketplace help takes no arguments.",
      usage: "Usage: /claude:plugin marketplace help",
    },
  ]) {
    test(`registered ${args} retains its recognized identity in ${mode}`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "help-origin");
      const capture = createJsonCapture();
      const { registration, verifyRegistrar } = registerCommandUnderTest({
        runs: 1,
        capture,
        createInvocationId: () => "help-run",
      });
      const ctx = {
        mode,
        cwd,
        get ui() {
          return capture.ui;
        },
      };

      // act
      await Reflect.apply(registration.handler, undefined, [args, ctx]);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "usage-error",
            severity: "error",
            needsReload: false,
            origin: { kind: "command", commandId, invocationId: "help-run" },
            message,
            usage,
          },
        },
      ]);
      capture.assertValid();
      verifyRegistrar();
    });
  }

  test(`keeps overlapping import runs and independent roots ordered in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "overlapping-imports");
    const capture = createJsonCapture();
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    const first = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const second = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });
    const completions = [first, second];
    const invocationIds = ["run-a", "run-b"];
    const importClaudeSettings: ImportDelegate = async ({ ctx, run }) => {
      const completion = completions.shift()!;
      notifyUsageInfo(ctx, run, "same");
      notifyUsageInfo(ctx, run, "same");
      await completion;
      notifyUsageInfo(ctx, run, "same");
      return {
        addedMarketplaces: [],
        changedResources: false,
        diagnostics: [],
        installedPlugins: [],
        marketplaceFailures: [],
        skippedExistingMarketplaces: [],
        skippedExistingPlugins: [],
        sourceMismatches: [],
        unexpectedPluginFailures: [],
        warnings: [],
      };
    };

    const { registration, verifyRegistrar } = registerCommandWithCache(
      createCompletionCache(),
      undefined,
      importClaudeSettings,
      { runs: 2, capture, appendAttempts: 6, createInvocationId: () => invocationIds.shift()! },
    );
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };
    const independentRoot = { ...capture.entrySink, getAllTools: () => [], getCommands: () => [] };

    // act
    const firstCommand: unknown = Reflect.apply(registration.handler, undefined, [
      "import --scope project",
      ctx,
    ]);
    notifyUsageInfo(ctx, openNotificationRun(independentRoot, { kind: "hook" }), "same");
    const secondCommand: unknown = Reflect.apply(registration.handler, undefined, [
      "import --scope project",
      ctx,
    ]);
    notifyUsageInfo(ctx, openNotificationRun(independentRoot, { kind: "load" }), "same");
    finishSecond();
    await secondCommand;
    finishFirst();
    await firstCommand;

    // assert
    assert.deepStrictEqual(
      capture.entries,
      [
        { kind: "command", commandId: "plugin import", invocationId: "run-a" },
        { kind: "command", commandId: "plugin import", invocationId: "run-a" },
        { kind: "hook" },
        { kind: "command", commandId: "plugin import", invocationId: "run-b" },
        { kind: "command", commandId: "plugin import", invocationId: "run-b" },
        { kind: "load" },
        { kind: "command", commandId: "plugin import", invocationId: "run-b" },
        { kind: "command", commandId: "plugin import", invocationId: "run-a" },
      ].map((origin) => ({
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "usage-info",
          severity: "info",
          needsReload: false,
          origin,
          usage: "same",
        },
      })),
    );
    assert.deepStrictEqual(invocationIds, []);
    capture.assertValid();
    verifyRegistrar();
  });

  test(`keeps the enable origin through delegated installation in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "enable-delegation");
    const state = await seedPrunableScope("project", cwd);
    const plugin = state.marketplaces.mp!.plugins.orphan!;
    plugin.enabled = false;
    const sourceSkill = path.join(plugin.resolvedSource, "skills", "orphan-skill", "SKILL.md");
    await mkdir(path.dirname(sourceSkill), { recursive: true });
    await writeFile(sourceSkill, "---\nname: orphan-skill\ndescription: A skill\n---\nbody\n");
    const locations = locationsFor("project", cwd);
    await rm(path.join(locations.skillsTargetDir, "orphan-skill"), { recursive: true });
    await saveState(locations.extensionRoot, state);
    const capture = createJsonCapture();
    const { registration, verifyRegistrar } = registerCommandUnderTest({
      runs: 1,
      capture,
      createInvocationId: () => "enable-run",
    });
    const ctx = {
      mode,
      cwd,
      get ui() {
        return capture.ui;
      },
    };

    // act
    await Reflect.apply(registration.handler, undefined, ["enable orphan@mp --scope project", ctx]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          kind: "cascade",
          severity: "info",
          needsReload: true,
          origin: { kind: "command", commandId: "plugin enable", invocationId: "enable-run" },
          marketplaces: [
            {
              name: "mp",
              scope: "project",
              plugins: [
                {
                  name: "orphan",
                  id: "orphan@mp",
                  scope: "project",
                  status: "installed",
                  version: "1.0.0",
                  reasons: [],
                },
              ],
            },
          ],
        },
      },
    ]);
    assert.strictEqual(
      await readFile(path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md"), "utf8"),
      "---\nname: orphan-skill\ndescription: A skill\n---\nbody\n",
    );
    assert.strictEqual(
      (await loadState(locations.extensionRoot)).marketplaces.mp!.plugins.orphan!.enabled,
      true,
    );
    capture.assertValid();
    verifyRegistrar();
  });
}

for (const mode of ["", "JSON", " json", "rpc ", "ｊｓｏｎ", "jsоn", "unknown"]) {
  test(`registered command rejects ${JSON.stringify(mode)} before routing or probing`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "unsupported-mode");
    const { registration, verifyRegistrar } = registerCommandUnderTest({
      runs: 0,
      createInvocationId: () => {
        throw new Error("Unexpected ID allocation");
      },
    });
    const work: string[] = [];
    const ctx = {
      mode,
      get cwd() {
        work.push("route");
        return cwd;
      },
    };
    const originalPath = process.env.PATH;

    // act & assert
    assert.throws(
      () => Reflect.apply(registration.handler, undefined, ["install alpha@demo", ctx]),
      (error: unknown) => {
        assert.ok(error instanceof UnsupportedModeError);
        assert.strictEqual(error.mode, mode);
        return true;
      },
    );
    assert.deepStrictEqual(work, []);
    assert.deepStrictEqual(await retryTree(cwd), []);
    assert.strictEqual(process.env.PATH, originalPath);
    verifyRegistrar();
  });
}

test("a stale command mode getter prevents routing and inventory reads", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "stale-mode");
  const { registration, verifyRegistrar } = registerCommandUnderTest({
    runs: 0,
    createInvocationId: () => {
      throw new Error("Unexpected ID allocation");
    },
  });
  const stale = new Error("context is stale");
  const work: string[] = [];
  const ctx = {
    get mode(): string {
      throw stale;
    },
    get cwd() {
      work.push("route");
      return cwd;
    },
  };

  // act & assert
  assert.throws(
    () => Reflect.apply(registration.handler, undefined, ["install alpha@demo", ctx]),
    (error: unknown) => error === stale,
  );
  assert.deepStrictEqual(work, []);
  assert.deepStrictEqual(await retryTree(cwd), []);
  verifyRegistrar();
});

function createBootstrapGitOps(sourceTree: string): EdgeDeps["gitOps"] {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ["https://github.com/anthropics/claude-plugins-official.git"],
    cloneFixture: { boundary: "local", sourceDir: sourceTree },
  });
  return {
    ...git.gitOps,
    async clone(cloneOptions) {
      const { auth: _auth, ...transportOptions } = cloneOptions;
      await git.gitOps.clone(transportOptions);
    },
  };
}

/**
 * Drive the captured session-start listener against a strict session context and
 * hand back the provider factory it installed.
 */
function installAutocompleteWrapper(): WrapperUnderTest {
  const { sessionStart, verifyRegistrar } = registerCommandUnderTest({ runs: 0 });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "session UI" });
  const providerFactory = It.willCapture<AutocompleteProviderFactory>("provider factory");
  when(() => {
    ui.addAutocompleteProvider(providerFactory);
  })
    .thenReturn()
    .times(1);
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "session context" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);

  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  sessionStart(SESSION_START, ctx);

  const wrap = providerFactory.value;
  if (wrap === undefined) {
    throw new Error("the session start listener installed no autocomplete provider");
  }

  return {
    wrap,
    verifyBoundary: (): void => {
      verifyRegistrar();
      verify(ctx);
      verify(ui);
    },
  };
}

describe("registerClaudePluginCommand", () => {
  test("registers the slash command once under its published description (D-04)", async (t) => {
    // arrange
    await createHermeticScope(t, "command-description");
    const expectedDescription = EXPECTED_COMMAND_DESCRIPTION;

    // act
    const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 0 });

    // assert
    assert.deepStrictEqual(registration.description, expectedDescription);
    verifyRegistrar();
  });

  test("hands the argument text and the command context to the subcommand router (D-04)", async (t) => {
    // arrange
    await createHermeticScope(t, "command-handler");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, undefined, 3);
    // One run per invocation, usage errors included; the usage error probes nothing.
    const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 1 });
    const expectedNotifications: readonly Notification[] = [
      {
        message: `Unknown subcommand: "frobnicate".\n\n${EXPECTED_TOP_LEVEL_USAGE}`,
        severity: "error",
      },
    ];

    // act
    await registration.handler("frobnicate", ctx);

    // assert
    assert.deepStrictEqual(notifications, expectedNotifications);
    verifyBoundary();
    verifyRegistrar();
  });

  for (const { commandLine, scope, untouchedScope } of [
    { commandLine: "prune", scope: "user", untouchedScope: "project" },
    { commandLine: "prune --scope project", scope: "project", untouchedScope: "user" },
  ] as const) {
    test(`registered ${commandLine} removes one orphan only from ${scope} scope`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, `prune-${scope}`);
      const seeded = await seedPrunableScope(scope, cwd);
      await seedPrunableScope(untouchedScope, cwd);
      const selected = locationsFor(scope, cwd);
      const untouched = locationsFor(untouchedScope, cwd);
      const untouchedState = await readFile(untouched.stateJsonPath, "utf8");
      const untouchedTree = await retryTree(untouched.scopeRoot);
      const lockSpy = t.mock.method(lockfile, "lock");
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(
        1,
        {
          value: cwd,
          reads: 1,
        },
        3,
      );
      // The one run is the only probe: the prune notification renders from it.
      const { registration, verifyRegistrar } = registerCommandWithCache(
        createCompletionCache(),
        createHooksRouting(createHooksRuntime(), { readHooksJson }),
        undefined,
        { runs: 1 },
      );

      // act
      await registration.handler(commandLine, ctx);

      // assert
      assert.deepStrictEqual(await loadState(selected.extensionRoot), {
        ...seeded,
        marketplaces: { mp: { ...seeded.marketplaces.mp, plugins: {} } },
      });
      await assert.rejects(
        readFile(path.join(selected.skillsTargetDir, "orphan-skill", "SKILL.md")),
      );
      assert.strictEqual(await readFile(untouched.stateJsonPath, "utf8"), untouchedState);
      assert.deepStrictEqual(await retryTree(untouched.scopeRoot), untouchedTree);
      assert.strictEqual(
        await readFile(path.join(untouched.skillsTargetDir, "orphan-skill", "SKILL.md"), "utf8"),
        "---\nname: orphan-skill\n---\nbody\n",
      );
      assert.deepStrictEqual(notifications, [
        {
          message: `● mp [${scope}]\n  ○ orphan v1.0.0 (uninstalled) {dependency pruned}\n\n/reload to pick up changes`,
        },
      ]);
      assert.strictEqual(lockSpy.mock.callCount(), 1);
      verifyBoundary();
      verifyRegistrar();
    });
  }

  for (const { operand, diagnostic } of [
    { operand: "orphan@mp", diagnostic: "Too many arguments." },
    { operand: "--unknown", diagnostic: 'Unknown flag: "--unknown".' },
    { operand: "--local", diagnostic: 'Unknown flag: "--local".' },
    { operand: "--keep-data", diagnostic: 'Unknown flag: "--keep-data".' },
    { operand: "--prune", diagnostic: 'Unknown flag: "--prune".' },
    { operand: "-y", diagnostic: 'Unknown flag: "-y".' },
  ] as const) {
    test(`registered prune rejects ${operand} before reaching state`, async (t) => {
      // arrange
      const { cwd } = await createHermeticScope(t, "prune-rejected");
      await seedPrunableScope("user", cwd);
      await seedPrunableScope("project", cwd);
      const user = locationsFor("user", cwd);
      const project = locationsFor("project", cwd);
      const userState = await readFile(user.stateJsonPath, "utf8");
      const projectState = await readFile(project.stateJsonPath, "utf8");
      const userTree = await retryTree(user.scopeRoot);
      const projectTree = await retryTree(project.scopeRoot);
      const lockSpy = t.mock.method(lockfile, "lock");
      const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, undefined, 3);
      // One run per invocation, usage errors included; the usage error probes nothing.
      const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 1 });

      // act
      await registration.handler(`prune ${operand}`, ctx);

      // assert
      assert.deepStrictEqual(notifications, [
        {
          message: `${diagnostic}\n\nUsage: /claude:plugin prune [--scope user|project] [--dry-run]`,
          severity: "error",
        },
      ]);
      assert.strictEqual(await readFile(user.stateJsonPath, "utf8"), userState);
      assert.strictEqual(await readFile(project.stateJsonPath, "utf8"), projectState);
      assert.deepStrictEqual(await retryTree(user.scopeRoot), userTree);
      assert.deepStrictEqual(await retryTree(project.scopeRoot), projectTree);
      assert.strictEqual(lockSpy.mock.callCount(), 0);
      verifyBoundary();
      verifyRegistrar();
    });
  }

  test("shares the supplied lifecycle routing owner with registered import execution", async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "import-routing-owner");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(
      0,
      {
        value: cwd,
        reads: 1,
      },
      2,
    );
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    let forwardedHooksRouting: unknown;
    const importClaudeSettings: ImportDelegate = (options) => {
      forwardedHooksRouting = Reflect.get(options, "hooksRouting");
      return Promise.resolve({
        addedMarketplaces: [],
        changedResources: false,
        diagnostics: [],
        installedPlugins: [],
        marketplaceFailures: [],
        skippedExistingMarketplaces: [],
        skippedExistingPlugins: [],
        sourceMismatches: [],
        unexpectedPluginFailures: [],
        warnings: [],
      });
    };

    // The one run is the only probe: import emits nothing here.
    const { registration, verifyRegistrar } = registerCommandWithCache(
      createCompletionCache(),
      hooksRouting,
      importClaudeSettings,
      { runs: 1 },
    );

    // act
    await registration.handler("import --scope project", ctx);

    // assert
    assert.strictEqual(forwardedHooksRouting, hooksRouting);
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verifyRegistrar();
  });

  test("resolves argument completions against the working directory the callback runs in (D-04)", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "completion-cwd");
    const laterRoot = await mkdtemp(path.join(tmpdir(), "register-completion-later-"));
    t.after(async () => {
      await rm(laterRoot, { recursive: true, force: true });
    });
    await seedProjectMarketplace(scope.cwd, "registration-mp");
    await seedProjectMarketplace(laterRoot, "invocation-mp");
    const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 0 });
    const expectedCandidates = [{ label: "invocation-mp", value: "list invocation-mp " }];
    process.chdir(laterRoot);

    // act
    const candidates = await registration.getArgumentCompletions?.("list ");

    // assert
    assert.deepStrictEqual(candidates, expectedCandidates);
    verifyRegistrar();
  });

  test("keeps supplied lifecycle completion-cache hits isolated between registrations", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "completion-cache");
    const marketplace = "cache-mp";
    await seedProjectMarketplace(scope.cwd, marketplace);
    const resolver = makeLocationsResolver(scope.cwd);
    const cachePath = await resolver.pluginCachePath("project", marketplace);
    const ownerCache = createCompletionCache();
    const peerCache = createCompletionCache();
    await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
      Promise.resolve([{ name: "owner-row", status: "installed" }]),
    );
    await rm(cachePath);
    await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
      Promise.resolve([{ name: "peer-row", status: "installed" }]),
    );
    await rm(cachePath);
    const owner = registerCommandWithCache(ownerCache);
    const peer = registerCommandWithCache(peerCache);
    const expectedOwnerCandidates = [
      {
        label: "owner-row@cache-mp",
        value: "uninstall --scope project owner-row@cache-mp ",
      },
    ];
    const expectedPeerCandidates = [
      {
        label: "peer-row@cache-mp",
        value: "uninstall --scope project peer-row@cache-mp ",
      },
    ];

    // act
    const ownerCandidates = await owner.registration.getArgumentCompletions?.(
      "uninstall --scope project ",
    );
    const peerCandidates = await peer.registration.getArgumentCompletions?.(
      "uninstall --scope project ",
    );

    // assert
    assert.deepStrictEqual(ownerCandidates, expectedOwnerCandidates);
    assert.deepStrictEqual(peerCandidates, expectedPeerCandidates);
    owner.verifyRegistrar();
    peer.verifyRegistrar();
  });

  test("runs registered bootstrap through the supplied lifecycle cache and both real children", async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "bootstrap-owner");
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-02-03T04:05:06.000Z") });
    const sourceTree = await mkdtemp(path.join(tmpdir(), "register-bootstrap-source-"));
    t.after(async () => {
      await rm(sourceTree, { force: true, recursive: true });
    });
    await mkdir(path.join(sourceTree, ".claude-plugin"), { recursive: true });
    const manifestJson = JSON.stringify({
      name: "claude-plugins-official",
      owner: { name: "registration owner" },
      plugins: [],
    });
    await writeFile(
      path.join(sourceTree, ".claude-plugin", "marketplace.json"),
      manifestJson,
      "utf8",
    );
    const userLocations = locationsFor("user", cwd);
    const projectLocations = locationsFor("project", cwd);
    const marketplaceRoot = await userLocations.sourceCloneDir("claude-plugins-official");
    const pluginCachePath = await userLocations.pluginCacheFile("claude-plugins-official");
    const completionCache = createCompletionCache();
    const peerCompletionCache = createCompletionCache();
    await completionCache.getPluginIndex(pluginCachePath, "user", "claude-plugins-official", () =>
      Promise.resolve([{ name: "owner-stale", status: "available" }]),
    );
    await rm(pluginCachePath, { force: true });
    await peerCompletionCache.getPluginIndex(
      pluginCachePath,
      "user",
      "claude-plugins-official",
      () => Promise.resolve([{ name: "peer-stale", status: "available" }]),
    );
    await rm(path.dirname(path.dirname(pluginCachePath)), { force: true, recursive: true });
    // The one run is the only probe: add and autoupdate render from it.
    const owner = registerCommandWithCache(
      completionCache,
      createHooksRouting(createHooksRuntime(), { readHooksJson }),
      undefined,
      { runs: 1 },
      createBootstrapGitOps(sourceTree),
    );
    const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
    const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
    const notifications: Notification[] = [];
    when(() => ctx.cwd)
      .thenReturn(cwd)
      .times(1);
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(4);
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(2);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      })
      .times(2);

    // act
    await owner.registration.handler("bootstrap", ctx);
    const userTree = await retryTree(userLocations.scopeRoot);
    const projectTree = await retryTree(projectLocations.scopeRoot);
    const ownerRows = await completionCache.getPluginIndex(
      pluginCachePath,
      "user",
      "claude-plugins-official",
      () => Promise.resolve([{ name: "owner-fresh", status: "available" }]),
    );
    const peerRows = await peerCompletionCache.getPluginIndex(
      pluginCachePath,
      "user",
      "claude-plugins-official",
      () => Promise.reject(new Error("the peer cache must retain its warmed row")),
    );

    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● claude-plugins-official [user] (added)" },
      { message: "● claude-plugins-official [user] <autoupdate>" },
    ]);
    assert.deepStrictEqual(await loadState(userLocations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {
        "claude-plugins-official": {
          addedFromCwd: cwd,
          lastSuccessfulManifest: manifestJson,
          lastUpdatedAt: "2026-02-03T04:05:06.000Z",
          manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
          marketplaceRoot,
          name: "claude-plugins-official",
          plugins: {},
          scope: "user",
          source: {
            kind: "github",
            owner: "anthropics",
            raw: "anthropics/claude-plugins-official",
            repo: "claude-plugins-official",
          },
        },
      },
    });
    assert.deepStrictEqual(JSON.parse(await readFile(userLocations.baseConfigJsonPath, "utf8")), {
      schemaVersion: 1,
      marketplaces: {
        "claude-plugins-official": {
          autoupdate: true,
          source: "anthropics/claude-plugins-official",
        },
      },
      plugins: {},
    });
    assert.deepStrictEqual(userTree, [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/sources/",
      "pi-claude-marketplace/sources/claude-plugins-official/",
      "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/",
      "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/marketplace.json",
      "pi-claude-marketplace/sources/claude-plugins-official/.git/",
      "pi-claude-marketplace/sources/claude-plugins-official/.git/pi-claude-marketplace.json",
      "pi-claude-marketplace/sources-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(projectTree, []);
    assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
      schemaVersion: 3,
      marketplaces: {},
    });
    assert.deepStrictEqual(ownerRows, [{ name: "owner-fresh", status: "available" }]);
    assert.deepStrictEqual(peerRows, [{ name: "peer-stale", status: "available" }]);
    verify(ctx);
    verify(ui);
    owner.verifyRegistrar();
  });
});

test("rebuilds completion rows through the cache that owns a successful registered add", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "add-completion-owner");
  const marketplace = "registered-add";
  const sourceRoot = path.join(cwd, "marketplace-source");
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(sourceRoot, "plugins", "hello"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
    "utf8",
  );
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "owner-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "peer-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  // The one run is the only probe.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`marketplace add ${sourceRoot} --scope project`, ctx);
  const ownerCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const peerCandidates = await peer.registration.getArgumentCompletions?.(
    "install --scope project ",
  );

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● registered-add [project] (added)" }]);
  assert.deepStrictEqual(ownerCandidates, [
    {
      label: "hello@registered-add",
      value: "install --scope project hello@registered-add ",
    },
  ]);
  assert.deepStrictEqual(peerCandidates, [
    {
      label: "peer-stale@registered-add",
      value: "install --scope project peer-stale@registered-add ",
    },
  ]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

test("rebuilds completion rows through the cache that owns a successful registered remove", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "remove-completion-owner");
  const marketplace = "registered-remove";
  const unrelated = "unrelated-marketplace";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(sourceRoot, "plugins", "fresh"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "fresh", source: "./plugins/fresh", version: "2.0.0" }],
    }),
    "utf8",
  );
  await seedProjectMarketplaces(cwd, [marketplace, unrelated]);
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const unrelatedCachePath = await resolver.pluginCachePath("project", unrelated);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "owner-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "peer-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await ownerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  await peerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "peer-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  // The one run is the only probe: the remove notification renders from it.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`marketplace remove ${marketplace} --scope project`, ctx);
  await seedProjectMarketplaces(cwd, [marketplace, unrelated]);
  const ownerCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const peerCandidates = await peer.registration.getArgumentCompletions?.(
    "install --scope project ",
  );

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● registered-remove [project] (removed)" }]);
  assert.deepStrictEqual(ownerCandidates, [
    {
      label: "fresh@registered-remove",
      value: "install --scope project fresh@registered-remove ",
    },
    {
      label: "owner-unrelated@unrelated-marketplace",
      value: "install --scope project owner-unrelated@unrelated-marketplace ",
    },
  ]);
  assert.deepStrictEqual(peerCandidates, [
    {
      label: "peer-stale@registered-remove",
      value: "install --scope project peer-stale@registered-remove ",
    },
    {
      label: "peer-unrelated@unrelated-marketplace",
      value: "install --scope project peer-unrelated@unrelated-marketplace ",
    },
  ]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

test("rebuilds completion rows through the cache that owns a successful registered update", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "update-completion-owner");
  const marketplace = "registered-update";
  const unrelated = "unrelated-marketplace";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(sourceRoot, "plugins", "fresh"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "fresh", source: "./plugins/fresh", version: "2.0.0" }],
    }),
    "utf8",
  );
  await seedProjectMarketplaces(cwd, [marketplace, unrelated]);
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const unrelatedCachePath = await resolver.pluginCachePath("project", unrelated);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "owner-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "peer-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await ownerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  await peerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "peer-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  // The one run is the only probe: the update notification renders from it.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`marketplace update ${marketplace} --scope project`, ctx);
  const ownerCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const peerCandidates = await peer.registration.getArgumentCompletions?.(
    "install --scope project ",
  );

  // assert
  assert.deepStrictEqual(notifications, [{ message: "● registered-update [project] (updated)" }]);
  assert.deepStrictEqual(ownerCandidates, [
    {
      label: "fresh@registered-update",
      value: "install --scope project fresh@registered-update ",
    },
    {
      label: "owner-unrelated@unrelated-marketplace",
      value: "install --scope project owner-unrelated@unrelated-marketplace ",
    },
  ]);
  assert.deepStrictEqual(peerCandidates, [
    {
      label: "peer-stale@registered-update",
      value: "install --scope project peer-stale@registered-update ",
    },
    {
      label: "peer-unrelated@unrelated-marketplace",
      value: "install --scope project peer-unrelated@unrelated-marketplace ",
    },
  ]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

test("rebuilds completion rows through the cache that owns a successful registered install", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "install-completion-owner");
  const marketplace = "registered-install";
  const unrelated = "unrelated-marketplace";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  const pluginRoot = path.join(sourceRoot, "plugins", "hello");
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
    "utf8",
  );
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
    "utf8",
  );
  await seedProjectMarketplaces(cwd, [marketplace, unrelated]);
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const unrelatedCachePath = await resolver.pluginCachePath("project", unrelated);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "hello", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "hello", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await ownerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  await peerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "peer-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  // D-05: the run is the only probe; the install stamps severity and renders
  // its markers from the run's snapshot.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`install hello@${marketplace} --scope project`, ctx);
  const ownerInstallCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const ownerUninstallCandidates = await owner.registration.getArgumentCompletions?.(
    "uninstall --scope project ",
  );
  const peerInstallCandidates = await peer.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const peerRows = await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.reject(new Error("the peer cache must retain its warmed target row")),
  );

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● registered-install [project]\n  ● hello v1.0.0 (installed)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(ownerInstallCandidates, [
    {
      label: "owner-unrelated@unrelated-marketplace",
      value: "install --scope project owner-unrelated@unrelated-marketplace ",
    },
  ]);
  assert.deepStrictEqual(ownerUninstallCandidates, [
    {
      label: "hello@registered-install",
      value: "uninstall --scope project hello@registered-install ",
    },
  ]);
  assert.deepStrictEqual(peerInstallCandidates, [
    {
      label: "peer-unrelated@unrelated-marketplace",
      value: "install --scope project peer-unrelated@unrelated-marketplace ",
    },
  ]);
  assert.deepStrictEqual(peerRows, [{ name: "hello", status: "available" }]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

test("one soft-dep snapshot drives both the severity stamp and the markers of a registered install (SC-3, D-08)", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "sc3-one-snapshot");
  const marketplace = "sc3-marketplace";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  const pluginRoot = path.join(sourceRoot, "plugins", "helper");
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "snapshot owner" },
      plugins: [{ name: "helper", source: "./plugins/helper", version: "1.0.0" }],
    }),
    "utf8",
  );
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "helper", version: "1.0.0" }),
    "utf8",
  );
  await writeFile(
    path.join(pluginRoot, "agents", "helper.md"),
    "---\nname: helper\ndescription: Helps.\n---\n\nBody.\n",
    "utf8",
  );
  await seedProjectMarketplace(cwd, marketplace);
  // The inventory answers "no companion" for the three reads one snapshot
  // takes, and "pi-subagents loaded" on every later read. If the severity
  // stamp and the renderer took separate probes, the second probe would see
  // `subagent` loaded: the row would lose its marker while the summary still
  // said "needs attention", or the reverse.
  const getAllTools = t.mock.fn<ExtensionAPI["getAllTools"]>(() => [subagentTool()]);
  getAllTools.mock.mockImplementationOnce(() => [], 0);
  getAllTools.mock.mockImplementationOnce(() => [], 1);
  getAllTools.mock.mockImplementationOnce(() => [], 2);
  const pi = mock<PiRegistrar>({ exactParams: true, name: "extension API" });
  const commandOptions = It.willCapture<CommandRegistration>("claude:plugin registration");
  when(() => {
    pi.registerCommand("claude:plugin", commandOptions);
  })
    .thenReturn()
    .times(1);
  when(() => {
    pi.on("session_start", It.willCapture<SessionStartListener>("session start listener"));
  })
    .thenReturn()
    .times(1);
  when(() => pi.getAllTools)
    .thenReturn(getAllTools)
    .atLeast(3);
  when(() => pi.getCommands())
    .thenReturn([])
    .times(1);
  const completionCache = createCompletionCache();
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  registerClaudePluginCommand(
    pi,
    createEdgeDeps(completionCache),
    hooksRouting,
    createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  );
  const registration = commandOptions.value;
  assert.ok(registration !== undefined, "the registration glue installed no command");
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await registration.handler(`install helper@${marketplace} --scope project`, ctx);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation needs attention.\n\n" +
        "● sc3-marketplace [project]\n" +
        "  ● helper v1.0.0 (installed) {requires pi-subagents}\n\n" +
        "/reload to pick up changes",
      severity: "warning",
    },
  ]);
  // D-05: one probe per command run, three tool reads and one command read.
  assert.strictEqual(getAllTools.mock.callCount(), 3);
  verify(ctx);
  verify(ui);
  verify(pi);
});

test("rebuilds completion rows through the cache that owns a successful registered reinstall", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "reinstall-completion-owner");
  const marketplace = "registered-reinstall";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  const pluginRoot = path.join(sourceRoot, "plugins", "hello");
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
    "utf8",
  );
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
    "utf8",
  );
  await seedProjectMarketplace(cwd, marketplace);
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  const state = await loadState(extensionRoot);
  const record = state.marketplaces[marketplace];
  if (record === undefined) {
    throw new Error("the registered reinstall fixture has no target marketplace");
  }

  record.plugins["hello"] = buildInstalledPluginRecord(
    { version: "1.0.0", resolvedSource: pluginRoot },
    { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
  ) as ExtensionState["marketplaces"][string]["plugins"][string];
  await saveState(extensionRoot, state);
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "owner-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "peer-stale", status: "available" }]),
  );
  await rm(cachePath, { force: true });
  // One run; the reinstall notification renders from it and probes nothing.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`reinstall hello@${marketplace} --scope project`, ctx);
  const ownerCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const peerCandidates = await peer.registration.getArgumentCompletions?.(
    "install --scope project ",
  );

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● registered-reinstall [project]\n  ● hello v1.0.0 (reinstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(ownerCandidates, []);
  assert.deepStrictEqual(peerCandidates, [
    {
      label: "peer-stale@registered-reinstall",
      value: "install --scope project peer-stale@registered-reinstall ",
    },
  ]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

test("rebuilds completion rows through the cache that owns a successful registered uninstall", async (t) => {
  // arrange
  const { cwd } = await createHermeticScope(t, "uninstall-completion-owner");
  const marketplace = "registered-uninstall";
  const unrelated = "unrelated-marketplace";
  const sourceRoot = path.join(cwd, "marketplaces", marketplace);
  const pluginRoot = path.join(sourceRoot, "plugins", "hello");
  await mkdir(path.join(sourceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(sourceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: marketplace,
      owner: { name: "registration owner" },
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
    "utf8",
  );
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
    "utf8",
  );
  await seedProjectMarketplaces(cwd, [marketplace, unrelated]);
  const extensionRoot = path.join(cwd, ".pi", "pi-claude-marketplace");
  const state = await loadState(extensionRoot);
  const record = state.marketplaces[marketplace];
  if (record === undefined) {
    throw new Error("the registered uninstall fixture has no target marketplace");
  }

  record.plugins["hello"] = buildInstalledPluginRecord(
    { version: "1.0.0", resolvedSource: pluginRoot },
    { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
  ) as ExtensionState["marketplaces"][string]["plugins"][string];
  await saveState(extensionRoot, state);
  const resolver = makeLocationsResolver(cwd);
  const cachePath = await resolver.pluginCachePath("project", marketplace);
  const unrelatedCachePath = await resolver.pluginCachePath("project", unrelated);
  const ownerCache = createCompletionCache();
  const peerCache = createCompletionCache();
  await ownerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "hello", status: "installed" }]),
  );
  await rm(cachePath, { force: true });
  await peerCache.getPluginIndex(cachePath, "project", marketplace, () =>
    Promise.resolve([{ name: "hello", status: "installed" }]),
  );
  await rm(cachePath, { force: true });
  await ownerCache.getPluginIndex(unrelatedCachePath, "project", unrelated, () =>
    Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
  );
  await rm(unrelatedCachePath, { force: true });
  // One run; the uninstall notification renders from it and probes nothing.
  const owner = registerCommandWithCache(
    ownerCache,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    undefined,
    { runs: 1 },
  );
  const peer = registerCommandWithCache(peerCache);
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
  const notifications: Notification[] = [];
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .times(1);
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(3);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(1);

  // act
  await owner.registration.handler(`uninstall hello@${marketplace} --scope project`, ctx);
  const ownerInstallCandidates = await owner.registration.getArgumentCompletions?.(
    "install --scope project ",
  );
  const ownerUninstallCandidates = await owner.registration.getArgumentCompletions?.(
    "uninstall --scope project ",
  );
  const peerUninstallCandidates = await peer.registration.getArgumentCompletions?.(
    "uninstall --scope project ",
  );

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● registered-uninstall [project]\n  ○ hello v1.0.0 (uninstalled)\n\n/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(ownerInstallCandidates, [
    {
      label: "hello@registered-uninstall",
      value: "install --scope project hello@registered-uninstall ",
    },
    {
      label: "owner-unrelated@unrelated-marketplace",
      value: "install --scope project owner-unrelated@unrelated-marketplace ",
    },
  ]);
  assert.deepStrictEqual(ownerUninstallCandidates, []);
  assert.deepStrictEqual(peerUninstallCandidates, [
    {
      label: "hello@registered-uninstall",
      value: "uninstall --scope project hello@registered-uninstall ",
    },
  ]);
  verify(ctx);
  verify(ui);
  owner.verifyRegistrar();
  peer.verifyRegistrar();
});

describe("registerClaudePluginCommand autocomplete wrapper", () => {
  for (const failure of ["unknown-mode", "mode", "ui", "provider"] as const) {
    test(`contains ${failure} failure during autocomplete setup`, async (t) => {
      // arrange
      await createHermeticScope(t, "autocomplete-failure");
      const { sessionStart, verifyRegistrar } = registerCommandUnderTest({ runs: 0 });
      const work: string[] = [];
      const ctx = {
        get mode(): string {
          if (failure === "mode") {
            throw new Error("stale mode");
          }

          return failure === "unknown-mode" ? "unknown" : "rpc";
        },
        get ui() {
          work.push("ui");
          if (failure === "ui") {
            throw new Error("stale ui");
          }

          return {
            addAutocompleteProvider() {
              work.push("provider");
              throw new Error("stale provider");
            },
          };
        },
      };

      // act
      Reflect.apply(sessionStart, undefined, [SESSION_START, ctx]);

      // assert
      const expected = { "unknown-mode": [], mode: [], ui: ["ui"], provider: ["ui", "provider"] };
      assert.deepStrictEqual(work, expected[failure]);
      verifyRegistrar();
    });
  }

  test("installs exactly one autocomplete provider when the session starts (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "provider-install");

    // act
    const { verifyBoundary } = installAutocompleteWrapper();

    // assert
    verifyBoundary();
  });

  test("returns the underlying provider's suggestions unchanged (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "suggestions");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const underlyingSuggestions = {
      items: [{ label: "install", value: "install " }],
      prefix: "ins",
    } satisfies AutocompleteSuggestions;
    const requests: [string[], number, number, { signal: AbortSignal; force?: boolean }][] = [];
    const current = {
      getSuggestions: (lines, cursorLine, cursorCol, options) => {
        requests.push([lines, cursorLine, cursorCol, options]);
        return Promise.resolve(underlyingSuggestions);
      },
      applyCompletion: () => {
        throw new Error("the suggestion pass-through must not apply a completion");
      },
      shouldTriggerFileCompletion: () => {
        throw new Error("the suggestion pass-through must not test the file trigger");
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const options = { signal: new AbortController().signal, force: true };
    const expectedRequests = [[[OWN_COMMAND_LINE], 0, 23, options]];

    // act
    const suggestions = await wrapper.getSuggestions([OWN_COMMAND_LINE], 0, 23, options);

    // assert
    assert.deepStrictEqual(suggestions, underlyingSuggestions);
    assert.deepStrictEqual(requests, expectedRequests);
    verifyBoundary();
  });

  test("collapses the whitespace run a completion left on its own command line (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "apply-own-line");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const underlyingApplication = { lines: [OWN_COMMAND_LINE], cursorLine: 0, cursorCol: 23 };
    const applications: [string[], number, number, AutocompleteItem, string][] = [];
    const current = {
      getSuggestions: () => {
        throw new Error("the completion application must not request suggestions");
      },
      applyCompletion: (lines, cursorLine, cursorCol, item, prefix) => {
        applications.push([lines, cursorLine, cursorCol, item, prefix]);
        return underlyingApplication;
      },
      shouldTriggerFileCompletion: () => {
        throw new Error("the completion application must not test the file trigger");
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const expectedApplication = {
      lines: ["/claude:plugin install alpha"],
      cursorLine: 0,
      cursorCol: 23,
    };
    const expectedApplications = [[[OWN_COMMAND_LINE], 0, 23, CHOSEN_ITEM, "al"]];

    // act
    const application = wrapper.applyCompletion([OWN_COMMAND_LINE], 0, 23, CHOSEN_ITEM, "al");

    // assert
    assert.deepStrictEqual(application, expectedApplication);
    assert.deepStrictEqual(applications, expectedApplications);
    verifyBoundary();
  });

  test("leaves another extension's command line exactly as the underlying provider left it (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "apply-foreign-line");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const underlyingApplication = { lines: [FOREIGN_COMMAND_LINE], cursorLine: 0, cursorCol: 17 };
    const current = {
      getSuggestions: () => {
        throw new Error("the foreign line must not request suggestions");
      },
      applyCompletion: () => underlyingApplication,
      shouldTriggerFileCompletion: () => {
        throw new Error("the foreign line must not test the file trigger");
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const expectedApplication = {
      lines: [FOREIGN_COMMAND_LINE],
      cursorLine: 0,
      cursorCol: 17,
    };

    // act
    const application = wrapper.applyCompletion([FOREIGN_COMMAND_LINE], 0, 17, CHOSEN_ITEM, "al");

    // assert
    assert.deepStrictEqual(application, expectedApplication);
    verifyBoundary();
  });

  test("leaves the result untouched when the cursor names a line the buffer does not hold (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "apply-absent-line");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const underlyingApplication = { lines: [OWN_COMMAND_LINE], cursorLine: 0, cursorCol: 23 };
    const current = {
      getSuggestions: () => {
        throw new Error("the absent line must not request suggestions");
      },
      applyCompletion: () => underlyingApplication,
      shouldTriggerFileCompletion: () => {
        throw new Error("the absent line must not test the file trigger");
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const expectedApplication = {
      lines: [OWN_COMMAND_LINE],
      cursorLine: 0,
      cursorCol: 23,
    };

    // act
    const application = wrapper.applyCompletion([OWN_COMMAND_LINE], 2, 23, CHOSEN_ITEM, "al");

    // assert
    assert.deepStrictEqual(application, expectedApplication);
    verifyBoundary();
  });

  test("defers the file-completion trigger to the underlying provider that answers it (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "trigger-delegate");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const triggerTests: [string[], number, number][] = [];
    const current = {
      getSuggestions: () => {
        throw new Error("the file trigger must not request suggestions");
      },
      applyCompletion: () => {
        throw new Error("the file trigger must not apply a completion");
      },
      shouldTriggerFileCompletion: (lines, cursorLine, cursorCol) => {
        triggerTests.push([lines, cursorLine, cursorCol]);
        return false;
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const expectedTriggerTests = [[[OWN_COMMAND_LINE], 0, 23]];

    // act
    const triggersFileCompletion = wrapper.shouldTriggerFileCompletion?.([OWN_COMMAND_LINE], 0, 23);

    // assert
    assert.deepStrictEqual(triggersFileCompletion, false);
    assert.deepStrictEqual(triggerTests, expectedTriggerTests);
    verifyBoundary();
  });

  test("permits the file-completion trigger when the underlying provider does not answer it (TC-7)", async (t) => {
    // arrange
    await createHermeticScope(t, "trigger-fallback");
    const { wrap, verifyBoundary } = installAutocompleteWrapper();
    const current = {
      getSuggestions: () => {
        throw new Error("the trigger fallback must not request suggestions");
      },
      applyCompletion: () => {
        throw new Error("the trigger fallback must not apply a completion");
      },
    } satisfies AutocompleteProvider;
    const wrapper = wrap(current);
    const expectedTrigger = true;

    // act
    const triggersFileCompletion = wrapper.shouldTriggerFileCompletion?.([OWN_COMMAND_LINE], 0, 23);

    // assert
    assert.deepStrictEqual(triggersFileCompletion, expectedTrigger);
    verifyBoundary();
  });
});

describe("registerClaudeMarketplaceTools", () => {
  test("registers the two read-only tools in order and nothing else (D-04)", async (t) => {
    // arrange
    await createHermeticScope(t, "tools");
    const pi = mock<PiRegistrar>({ exactParams: true, name: "extension API" });
    const firstTool = It.willCapture<ToolRegistration>("first registered tool");
    const secondTool = It.willCapture<ToolRegistration>("second registered tool");
    when(() => {
      pi.registerTool(firstTool);
    })
      .thenReturn()
      .times(1);
    when(() => {
      pi.registerTool(secondTool);
    })
      .thenReturn()
      .times(1);
    const expectedToolNames = ["pi_claude_marketplace_list", "pi_claude_marketplace_plugin_list"];

    // act
    registerClaudeMarketplaceTools(pi);

    // assert
    assert.deepStrictEqual([firstTool.value?.name, secondTool.value?.name], expectedToolNames);
    verify(pi);
  });
});

/**
 * Verbs that reject `--scope` itself, so the empty-scope rejection below has no
 * valid spelling to exercise on them.
 */
const SCOPELESS_VERBS = new Set(["bootstrap", "browse", "help", "marketplace help"]);

/** Complete public spellings with independently stated argument and error contracts. */
const COMMAND_ARGUMENT_CASES = [
  {
    verb: "bootstrap",
    operand: "",
    usage: "bootstrap",
    surplus: "bootstrap takes no arguments.",
  },
  {
    verb: "install",
    operand: "alpha@official",
    usage:
      "install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]",
  },
  {
    verb: "uninstall",
    operand: "alpha@official",
    usage:
      "uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local] [--prune]",
  },
  {
    verb: "prune",
    operand: "",
    usage: "prune [--scope user|project] [--dry-run]",
    unknown: 'Unknown flag: "--bogus".',
  },
  {
    verb: "update",
    operand: "alpha@official",
    usage:
      "update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--map-model] [--partial] [--local]",
  },
  {
    verb: "fetch",
    operand: "alpha@official",
    usage: "fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]",
  },
  {
    verb: "reinstall",
    operand: "alpha@official",
    usage: "reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--local]",
  },
  {
    verb: "list",
    aliases: ["ls"],
    operand: "official",
    usage:
      "list [<marketplace>] [--installed] [--available] [--unavailable] [--partial] [--remote] [--scope user|project]",
  },
  {
    verb: "info",
    operand: "alpha@official",
    usage: "info <plugin>@<marketplace> [--fetch] [--scope user|project]",
  },
  {
    verb: "pending",
    operand: "",
    usage: "pending [--scope user|project]",
  },
  {
    verb: "apply",
    operand: "",
    usage: "apply [--scope user|project]",
  },
  {
    verb: "autoapply",
    operand: "on",
    usage: "autoapply [on|off] [--scope user|project] [--local]",
  },
  {
    verb: "enable",
    operand: "alpha@official",
    usage: "enable <plugin>@<marketplace> [--scope user|project] [--local]",
  },
  {
    verb: "disable",
    operand: "alpha@official",
    usage: "disable <plugin>@<marketplace> [--scope user|project] [--local]",
  },
  {
    verb: "import",
    operand: "",
    usage: "import [--scope user|project]",
    surplus: "import does not accept positional arguments.",
  },
  {
    verb: "browse",
    operand: "",
    usage: "browse",
    surplus: "browse takes no arguments.",
  },
  {
    // `help` takes one topic, so a token after a valid topic is surplus.
    verb: "help",
    operand: "marketplace",
    usage: "help [marketplace]",
  },
  {
    verb: "marketplace help",
    aliases: ["market help"],
    operand: "",
    usage: "marketplace help",
    surplus: "marketplace help takes no arguments.",
  },
  {
    verb: "marketplace add",
    aliases: ["market add"],
    operand: "./fixture-marketplace",
    usage: "marketplace add <source> [--scope user|project] [--local]",
  },
  {
    verb: "marketplace remove",
    aliases: ["marketplace rm", "market remove", "market rm"],
    operand: "official",
    usage: "marketplace <remove|rm> <name> [--scope user|project] [--local]",
  },
  {
    verb: "marketplace list",
    aliases: ["marketplace ls", "market list", "market ls"],
    operand: "",
    usage: "marketplace <list|ls> [--scope user|project]",
  },
  {
    verb: "marketplace info",
    aliases: ["market info"],
    operand: "official",
    usage: "marketplace info <name> [--scope user|project]",
  },
  {
    verb: "marketplace update",
    aliases: ["market update"],
    operand: "official",
    usage: "marketplace update [<name>] [--scope user|project]",
  },
  {
    verb: "marketplace autoupdate",
    aliases: ["market autoupdate"],
    operand: "official",
    usage: "marketplace autoupdate [<name>] [--scope user|project] [--local]",
  },
  {
    verb: "marketplace noautoupdate",
    aliases: ["market noautoupdate"],
    operand: "official",
    usage: "marketplace noautoupdate [<name>] [--scope user|project] [--local]",
  },
];

test("argument rejection cases cover every routed command and alias", () => {
  // arrange
  const exercised = COMMAND_ARGUMENT_CASES.flatMap(({ verb, aliases = [] }) => [verb, ...aliases]);
  const routed = [
    ...TOP_LEVEL_SUBCOMMANDS.filter((verb) => verb !== "marketplace" && verb !== "market"),
    ...MARKETPLACE_SUBCOMMANDS.map((verb) => `marketplace ${verb}`),
    ...MARKETPLACE_SUBCOMMANDS.map((verb) => `market ${verb}`),
  ];

  // act & assert
  assert.deepStrictEqual(exercised.sort(), routed.sort());
});

for (const { verb, aliases = [], operand, usage, surplus, unknown } of COMMAND_ARGUMENT_CASES) {
  for (const spelling of [verb, ...aliases]) {
    for (const { kind, invalid, diagnostic } of [
      {
        kind: "unknown flag",
        invalid: "--bogus",
        diagnostic: unknown ?? 'Unknown flag: "--bogus".',
      },
      {
        kind: "surplus positional",
        invalid: "surplus",
        diagnostic: surplus ?? "Too many arguments.",
      },
      {
        kind: "empty double-quoted surplus",
        invalid: '""',
        diagnostic: surplus ?? "Too many arguments.",
      },
      {
        kind: "empty single-quoted surplus",
        invalid: "''",
        diagnostic: surplus ?? "Too many arguments.",
      },
    ]) {
      test(`registered ${spelling} rejects ${kind} before reading runtime context`, async (t) => {
        // arrange
        const { cwd } = await createHermeticScope(t, "reject-arguments");
        const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, undefined, 3);
        // One run per invocation, usage errors included; the usage error probes nothing.
        const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 1 });

        // act
        await registration.handler(`${spelling} ${operand} ${invalid}`, ctx);

        // assert
        assert.deepStrictEqual(notifications, [
          {
            message: `${diagnostic}\n\nUsage: /claude:plugin ${usage}`,
            severity: "error",
          },
        ]);
        assert.deepStrictEqual(await retryTree(cwd), []);
        verifyBoundary();
        verifyRegistrar();
      });
    }
  }
}

for (const { verb, aliases = [], operand, usage } of COMMAND_ARGUMENT_CASES.filter(
  ({ verb }) => !SCOPELESS_VERBS.has(verb),
)) {
  for (const spelling of [verb, ...aliases]) {
    for (const emptyValue of ['""', "''"]) {
      test(`registered ${spelling} rejects the empty scope ${emptyValue} before a valid-looking token`, async (t) => {
        // arrange
        const { cwd } = await createHermeticScope(t, "reject-empty-scope");
        const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, undefined, 3);
        // One run per invocation, usage errors included; the usage error probes nothing.
        const { registration, verifyRegistrar } = registerCommandUnderTest({ runs: 1 });

        // act
        await registration.handler(`${spelling} ${operand} --scope ${emptyValue} project`, ctx);

        // assert
        assert.deepStrictEqual(notifications, [
          {
            message: `Invalid --scope value: "". Must be "user" or "project".\n\nUsage: /claude:plugin ${usage}`,
            severity: "error",
          },
        ]);
        assert.deepStrictEqual(await retryTree(cwd), []);
        verifyBoundary();
        verifyRegistrar();
      });
    }
  }
}
