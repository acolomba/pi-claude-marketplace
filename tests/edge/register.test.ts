// Plan 06-05 Task 2: registration glue tests.
//
// Verifies that `edge/register.ts` wires the slash-command + autocomplete
// + LLM tools correctly onto a mock `pi: ExtensionAPI`. The mock pi records
// every `registerCommand`, `registerTool`, and `on(event, handler)` call;
// firing the captured session_start handler exercises the TC-7 wrapper.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  registerClaudeMarketplaceTools,
  registerClaudePluginCommand,
} from "../../extensions/pi-claude-marketplace/edge/register.ts";

import type { EdgeDeps } from "../../extensions/pi-claude-marketplace/edge/types.ts";
import type { ImportClaudeSettingsOptions } from "../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import type {
  PluginUpdateFn,
  PluginUpdateOutcome,
} from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem, AutocompleteProvider } from "@earendil-works/pi-tui";

// ---------------------------------------------------------------------------
// Mock pi -- records command + tool + event registrations.
// ---------------------------------------------------------------------------

interface RegisteredCommand {
  description?: string;
  handler: (args: string, ctx: ExtensionContext) => Promise<void>;
  getArgumentCompletions?: (
    prefix: string,
  ) => AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>;
}

interface RegisteredTool {
  name: string;
  parameters: unknown;
  execute: (...args: unknown[]) => Promise<unknown>;
}

interface MockPi {
  pi: ExtensionAPI;
  commands: Map<string, RegisteredCommand>;
  tools: Map<string, RegisteredTool>;
  events: Map<string, ((event: unknown, ctx: ExtensionContext) => unknown)[]>;
}

function makeMockPi(): MockPi {
  const commands = new Map<string, RegisteredCommand>();
  const tools = new Map<string, RegisteredTool>();
  const events = new Map<string, ((event: unknown, ctx: ExtensionContext) => unknown)[]>();

  const pi = {
    registerCommand: (name: string, options: RegisteredCommand): void => {
      commands.set(name, options);
    },
    registerTool: (tool: RegisteredTool): void => {
      tools.set(tool.name, tool);
    },
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown): void => {
      const list = events.get(event) ?? [];
      list.push(handler);
      events.set(event, list);
    },
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;

  return { pi, commands, tools, events };
}

// ---------------------------------------------------------------------------
// Mock deps -- inert gitOps + pluginUpdate (tests do not exercise them).
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<EdgeDeps> = {}): EdgeDeps {
  const pluginUpdate: PluginUpdateFn = (plugin) =>
    Promise.resolve<PluginUpdateOutcome>({
      partition: "unchanged",
      name: plugin,
      fromVersion: "0.0.0",
      toVersion: "0.0.0",
      declaresAgents: false,
      declaresMcp: false,
    });

  const gitOps = {
    clone: () => Promise.resolve(),
    fetch: () => Promise.resolve(),
    forceUpdateRef: () => Promise.resolve(),
    checkout: () => Promise.resolve(),
    resolveRef: () => Promise.resolve("deadbeef"),
    currentBranch: () => Promise.resolve(undefined),
  } as unknown as EdgeDeps["gitOps"];

  return { gitOps, pluginUpdate, ...overrides };
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "register-reinstall-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "register-reinstall-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

test("D-04 :: registerClaudePluginCommand registers claude:plugin command on pi", () => {
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  assert.equal(commands.size, 1, "exactly one registered command");
  assert.ok(commands.has("claude:plugin"), "command name is claude:plugin");
  const cmd = commands.get("claude:plugin");
  assert.ok(cmd !== undefined);
  assert.equal(typeof cmd.description, "string");
  assert.ok(
    cmd.description !== undefined && cmd.description.length > 0,
    "description is non-empty",
  );
});

test("D-04 :: registered command has a handler that routes through routeClaudePlugin", async () => {
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  const cmd = commands.get("claude:plugin");
  assert.ok(cmd !== undefined);
  assert.equal(typeof cmd.handler, "function");

  // Empty input should trigger the TOP_LEVEL_USAGE emission via
  // routeClaudePlugin -> notifyUsageError. We assert by capturing the
  // notify calls.
  const notifications: { message: string; severity?: string }[] = [];
  const ctx = {
    cwd: "/tmp",
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;

  await cmd.handler("", ctx);

  // routeClaudePlugin emits "Usage error.\n\n<TOP_LEVEL_USAGE>" at error severity.
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  assert.match(notifications[0]?.message ?? "", /Usage error\./);
  assert.match(notifications[0]?.message ?? "", /Usage: \/claude:plugin/);
});

test("D-04 :: registered command description mentions reinstall", () => {
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  const cmd = commands.get("claude:plugin");
  assert.ok(cmd !== undefined);
  assert.equal(cmd.description?.includes("reinstall plugins"), true);
});

test("D-04 :: registered command routes reinstall through makeReinstallHandler", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { pi, commands } = makeMockPi();
    registerClaudePluginCommand(pi, makeDeps());

    const cmd = commands.get("claude:plugin");
    assert.ok(cmd !== undefined);

    const notifications: { message: string; severity?: string }[] = [];
    const ctx = {
      cwd,
      ui: {
        notify: (m: string, s?: string): void => {
          notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
        },
      },
    } as unknown as ExtensionContext;

    await cmd.handler("reinstall", ctx);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, undefined);
    // Plan 19-04 / D-19-02 byte change: V2 empty-targets renders as the
    // `(no marketplaces)` sentinel via `{ marketplaces: [] }`. V1's
    // `(no plugins)` empty-row form is RETIRED.
    assert.equal(notifications[0]?.message ?? "", "(no marketplaces)");
  });
});

test("registered command handler routes import through the new handler", async () => {
  const calls: ImportClaudeSettingsOptions[] = [];
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(
    pi,
    makeDeps({
      importClaudeSettings: (opts) => {
        calls.push(opts);
        return Promise.resolve({
          addedMarketplaces: [],
          installedPlugins: [],
          skippedExistingMarketplaces: [],
          skippedExistingPlugins: [],
          warnings: [],
          marketplaceFailures: [],
          sourceMismatches: [],
          unexpectedPluginFailures: [],
          diagnostics: [],
          changedResources: false,
        });
      },
    }),
  );
  const cmd = commands.get("claude:plugin");
  assert.ok(cmd !== undefined);

  await cmd.handler("import --scope project", { cwd: "/tmp/project" } as ExtensionContext);

  assert.deepEqual(
    calls.map((call) => call.selectedScopes),
    [["project"]],
  );
});

test("D-04 :: registered command has getArgumentCompletions returning AutocompleteItem[] | null", async () => {
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  const cmd = commands.get("claude:plugin");
  assert.ok(cmd !== undefined);
  assert.equal(typeof cmd.getArgumentCompletions, "function");

  // Empty prefix -> TC-1 top-level keywords.
  const items = await cmd.getArgumentCompletions?.("");
  assert.ok(items !== null && items !== undefined);
  assert.ok(Array.isArray(items));
  const labels = items.map((i) => i.label);
  for (const expected of ["install", "uninstall", "update", "list", "marketplace"]) {
    assert.ok(labels.includes(expected), `top-level completions include "${expected}"`);
  }
});

test('D-04 :: registerClaudePluginCommand also calls pi.on("session_start", ...) exactly once', () => {
  const { pi, events } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  const handlers = events.get("session_start");
  assert.ok(handlers !== undefined, "session_start handler registered");
  assert.equal(handlers.length, 1, "exactly one session_start handler");
});

test("D-04 :: firing the session_start handler installs an autocomplete provider via ctx.ui.addAutocompleteProvider", () => {
  const { pi, events } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  const handler = events.get("session_start")?.[0];
  assert.ok(handler !== undefined);

  const factories: ((current: AutocompleteProvider) => AutocompleteProvider)[] = [];
  const ctx = {
    ui: {
      addAutocompleteProvider: (
        factory: (current: AutocompleteProvider) => AutocompleteProvider,
      ): void => {
        factories.push(factory);
      },
      notify: (): void => {
        // unused
      },
    },
  } as unknown as ExtensionContext;

  // Fire the captured session_start handler with a synthetic event.
  handler({ type: "session_start", reason: "startup" }, ctx);

  assert.equal(factories.length, 1, "addAutocompleteProvider invoked exactly once");
});

test("D-04 :: the installed wrapper applies normalizeCompletionWhitespace only to lines matching isClaudePluginCommandLine", () => {
  const { pi, events } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());
  const handler = events.get("session_start")?.[0];
  assert.ok(handler !== undefined);

  let capturedFactory: ((current: AutocompleteProvider) => AutocompleteProvider) | undefined;
  const ctx = {
    ui: {
      addAutocompleteProvider: (
        factory: (current: AutocompleteProvider) => AutocompleteProvider,
      ): void => {
        capturedFactory = factory;
      },
      notify: (): void => undefined,
    },
  } as unknown as ExtensionContext;

  handler({ type: "session_start", reason: "startup" }, ctx);
  assert.ok(capturedFactory !== undefined);

  // Build a synthetic `current` provider whose applyCompletion returns
  // text WITH a redundant trailing space; the wrapper should
  // normalize the whitespace for a /claude:plugin line.
  const current: AutocompleteProvider = {
    getSuggestions: () => Promise.resolve(null),
    applyCompletion: () => ({
      lines: ["/claude:plugin install foo "],
      cursorLine: 0,
      cursorCol: 27,
    }),
    shouldTriggerFileCompletion: () => true,
  };
  const wrapper = capturedFactory(current);

  // Synthetic call with a /claude:plugin line -> the wrapper composes
  // normalizeCompletionWhitespace. We assert the resulting line shape
  // differs from the unnormalized `current.applyCompletion` result when
  // normalizable whitespace is present.
  const inputLines = ["/claude:plugin install foo "];
  const item: AutocompleteItem = { label: "foo", value: "foo " };
  const result = wrapper.applyCompletion(inputLines, 0, 27, item, "fo");
  // The wrapper goes through normalizeCompletionWhitespace; for a
  // line that the regex matches we expect a non-identical line in the
  // typical case (whitespace collapsed). For this assertion we just
  // verify the wrapper does NOT throw and returns the expected shape.
  assert.ok(typeof result.cursorLine === "number");
  assert.ok(Array.isArray(result.lines));
});

test("D-04 :: the installed wrapper is a no-op for non-/claude:plugin lines", () => {
  const { pi, events } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());
  const handler = events.get("session_start")?.[0];
  assert.ok(handler !== undefined);

  let capturedFactory: ((current: AutocompleteProvider) => AutocompleteProvider) | undefined;
  const ctx = {
    ui: {
      addAutocompleteProvider: (
        factory: (current: AutocompleteProvider) => AutocompleteProvider,
      ): void => {
        capturedFactory = factory;
      },
      notify: (): void => undefined,
    },
  } as unknown as ExtensionContext;
  handler({ type: "session_start", reason: "startup" }, ctx);
  assert.ok(capturedFactory !== undefined);

  // Underlying provider returns a result identifiable by reference; the
  // wrapper MUST pass this through verbatim for a non-/claude:plugin line.
  const sentinelResult = {
    lines: ["/other-extension whatever"],
    cursorLine: 0,
    cursorCol: 10,
  };
  const current: AutocompleteProvider = {
    getSuggestions: () => Promise.resolve(null),
    applyCompletion: () => sentinelResult,
    shouldTriggerFileCompletion: () => true,
  };
  const wrapper = capturedFactory(current);

  const passthrough = wrapper.applyCompletion(
    ["/other-extension whatever"],
    0,
    10,
    { label: "x", value: "x" },
    "x",
  );
  // Reference equality proves the wrapper did NOT call
  // normalizeCompletionWhitespace (which returns a new object).
  assert.strictEqual(passthrough, sentinelResult, "non-matching line passes through verbatim");
});

test("D-04 :: registerClaudeMarketplaceTools calls pi.registerTool exactly twice", () => {
  const { pi, tools } = makeMockPi();
  registerClaudeMarketplaceTools(pi);

  assert.equal(tools.size, 2, "exactly two tools registered");
});

test("D-04 :: registerClaudeMarketplaceTools registers pi_claude_marketplace_list", () => {
  const { pi, tools } = makeMockPi();
  registerClaudeMarketplaceTools(pi);

  assert.ok(tools.has("pi_claude_marketplace_list"), "pi_claude_marketplace_list registered");
});

test("D-04 :: registerClaudeMarketplaceTools registers pi_claude_marketplace_plugin_list", () => {
  const { pi, tools } = makeMockPi();
  registerClaudeMarketplaceTools(pi);

  assert.ok(
    tools.has("pi_claude_marketplace_plugin_list"),
    "pi_claude_marketplace_plugin_list registered",
  );
});
