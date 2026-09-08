// Owner suite for `edge/register.ts`: the D-04 registration glue that wires the
// `/claude:plugin` slash command, the TC-7 autocomplete wrapper, and the two
// read-only LLM tools onto the Pi extension API.
//
// Registration is not the behavior. Every callback this module hands to Pi is
// captured off the recorded call and INVOKED, because a callback that is only
// installed leaves its body unexecuted -- which is why the suggestion
// pass-through and the file-completion trigger were unreached before.
//
// Capturing a callback is the one place `It.willCapture` earns its keep: a
// function argument cannot be compared structurally, so the expectation states
// the command name and the event name by hand and captures only the callback
// beside them. A registration under any other name or event has no expectation
// and fails where it happens.
//
// What this pair deliberately leaves to its neighbours: the subcommand dispatch
// matrix and both usage blocks (`tests/edge/router.test.ts`), the completion
// candidate sets (`tests/edge/completions/provider.test.ts` and
// `.../data.test.ts`), the whitespace collapse itself
// (`tests/edge/completions/normalize.test.ts`), and the two tool bodies
// (`tests/edge/handlers/tools.test.ts`). This suite owns the wiring only, so the
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
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  registerClaudeMarketplaceTools,
  registerClaudePluginCommand,
} from "../../extensions/pi-claude-marketplace/edge/register.ts";
import { TOP_LEVEL_USAGE } from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { makeLocationsResolver } from "../../extensions/pi-claude-marketplace/orchestrators/edge-deps.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";

import { createNotificationBoundary } from "./notification-boundary.ts";

import type { Notification } from "./notification-boundary.ts";
import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";
import type { ClaudeImportExecutionResult } from "../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";
import type { PluginUpdateOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { CompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
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
 * custom renderers, mirroring `tests/edge/handlers/tools.test.ts`.
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

interface HermeticScope {
  readonly cwd: string;
}

interface CommandUnderTest {
  readonly registration: CommandRegistration;
  readonly sessionStart: SessionStartListener;
  readonly verifyRegistrar: () => void;
}

interface WrapperUnderTest {
  readonly wrap: AutocompleteProviderFactory;
  readonly verifyBoundary: () => void;
}

const EXPECTED_COMMAND_DESCRIPTION =
  "Manage Claude plugin marketplaces and plugins. Bootstrap, install, uninstall, list, import, " +
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
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). This module holds
 * the one sanctioned read of the process working directory, so the case owns
 * that too -- it moves into its own root and the restore is registered before
 * anything runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `register-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `register-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const previousCwd = process.cwd();
  t.after(async () => {
    process.chdir(previousCwd);
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
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

/** Record one project-scope marketplace under `root`, the completion read path. */
async function seedProjectMarketplace(root: string, marketplaceName: string): Promise<void> {
  const extensionRoot = path.join(root, ".pi", "pi-claude-marketplace");
  await mkdir(extensionRoot, { recursive: true });
  await saveState(extensionRoot, {
    schemaVersion: 2,
    marketplaces: { [marketplaceName]: marketplaceRecordIn(root, marketplaceName) },
  });
}

/**
 * The injected dependency bag. The git operations are a memory-boundary fake and
 * the two orchestrator entrypoints refuse to run: no case here dispatches a
 * subcommand that reaches them, so a call is a defect rather than a fixture gap.
 */
function createEdgeDeps(
  completionCache: CompletionCache,
  importClaudeSettings?: ImportDelegate,
): EdgeDeps {
  const { gitOps } = createGitOpsFake({ boundary: "memory" });
  return {
    completionCache,
    gitOps,
    pluginUpdate: (): Promise<PluginUpdateOutcome> => {
      throw new Error("the registration glue must not run a plugin update");
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
  hooksRouting = createHooksRouting(createHooksRuntime()),
  importClaudeSettings?: ImportDelegate,
  expectedNotifications = 0,
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
  if (expectedNotifications > 0) {
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(expectedNotifications * 2);
  }

  registerClaudePluginCommand(
    pi,
    createEdgeDeps(completionCache, importClaudeSettings),
    hooksRouting,
    createPluginUpdateOperations(hooksRouting).updatePlugins,
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

function registerCommandUnderTest(): CommandUnderTest {
  return registerCommandWithCache(createCompletionCache());
}

/**
 * Drive the captured session-start listener against a strict session context and
 * hand back the provider factory it installed.
 */
function installAutocompleteWrapper(): WrapperUnderTest {
  const { sessionStart, verifyRegistrar } = registerCommandUnderTest();
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
    const { registration, verifyRegistrar } = registerCommandUnderTest();

    // assert
    assert.deepStrictEqual(registration.description, expectedDescription);
    verifyRegistrar();
  });

  test("hands the argument text and the command context to the subcommand router (D-04)", async (t) => {
    // arrange
    await createHermeticScope(t, "command-handler");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const { registration, verifyRegistrar } = registerCommandUnderTest();
    const expectedNotifications: readonly Notification[] = [
      { message: `Unknown subcommand: "frobnicate".\n\n${TOP_LEVEL_USAGE}`, severity: "error" },
    ];

    // act
    await registration.handler("frobnicate", ctx);

    // assert
    assert.deepStrictEqual(notifications, expectedNotifications);
    verifyBoundary();
    verifyRegistrar();
  });

  test("shares the supplied lifecycle routing owner with registered import execution", async (t) => {
    // arrange
    const { cwd } = await createHermeticScope(t, "import-routing-owner");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0, {
      value: cwd,
      reads: 1,
    });
    const hooksRouting = createHooksRouting(createHooksRuntime());
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

    const { registration, verifyRegistrar } = registerCommandWithCache(
      createCompletionCache(),
      hooksRouting,
      importClaudeSettings,
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
    const { registration, verifyRegistrar } = registerCommandUnderTest();
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
    const owner = registerCommandWithCache(
      ownerCache,
      createHooksRouting(createHooksRuntime()),
      undefined,
      1,
    );
    const peer = registerCommandWithCache(peerCache);
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "command context" });
    const ui = mock<NotificationUi>({ exactParams: true, name: "command UI" });
    const notifications: Notification[] = [];
    when(() => ctx.cwd).thenReturn(cwd).times(1);
    when(() => ctx.ui).thenReturn(ui).times(1);
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

describe("registerClaudePluginCommand autocomplete wrapper", () => {

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
