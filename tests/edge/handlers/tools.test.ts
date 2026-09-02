// Owner suite for `edge/handlers/tools.ts`: the two read-only LLM tools
// (`pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list`) and the
// exported `projectRowStatus` projection.
//
// Registration is not the behavior. Each rendering case captures the registered
// callback off the recorded `registerTool` call and invokes it against a seeded
// tree, so the tool body runs rather than merely being installed.
//
// The list-surface status vocabulary these tools project is owned by
// `tests/orchestrators/plugin/list.test.ts`; every expected status here is a
// written-out literal, never a value this suite derives by re-running the
// production classification it is checking.
//
// D-02 / SC-4: both tools are read-only, so every case replaces the process-wide
// transport with a fail-fast stub and asserts its call count is zero. The Pi
// boundary states no `ctx.ui` and no `pi.getAllTools()` expectation at all, which
// is what proves the tools neither notify nor probe for a companion extension.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  projectRowStatus,
  registerListMarketplacesTool,
  registerListPluginsTool,
  type ToolPluginStatus,
} from "../../../extensions/pi-claude-marketplace/edge/handlers/tools.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { PluginNotificationMessage } from "../../../extensions/pi-claude-marketplace/shared/notify.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

/**
 * The tool definition shape `registerTool` receives, minus the two optional
 * custom renderers. Both tools leave those undeclared, and their generic
 * signatures are the only members a definition instantiated at a concrete
 * schema cannot widen into the uninstantiated form, so omitting them keeps the
 * capture derived from the production parameter type rather than hand-written.
 */
type ToolRegistration = Omit<
  Parameters<ExtensionAPI["registerTool"]>[0],
  "renderCall" | "renderResult"
>;

/**
 * The Pi API with `registerTool` restated as a property. The API declares it as
 * a generic method, and a method may not be read as a value, so the recorder
 * could not be installed on a mock of the API itself. The narrowed shape is
 * still what the two registration functions accept.
 */
type ToolRegistrar = Omit<ExtensionAPI, "registerTool"> & {
  readonly registerTool: (tool: ToolRegistration) => void;
};

interface ToolBoundary {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  /** Every tool definition the registration function installed, in call order. */
  readonly registrations: readonly ToolRegistration[];
  readonly verifyBoundary: () => void;
}

interface RegisteredToolBoundary {
  readonly ctx: ExtensionContext;
  readonly registration: ToolRegistration;
  readonly verifyBoundary: () => void;
}
type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];
type PluginStatus = PluginNotificationMessage["status"];

interface HermeticScope {
  readonly cwd: string;
  /** How many times the case reached the replaced process-wide transport. */
  fetchCallCount(): number;
}

interface SeededInstall {
  readonly version: string;
  /** Writes the record's `enabled: false` disabled marker (ENBL-05). */
  readonly disabled?: boolean;
  /** Persisted `compatibility.unsupported` kinds, which make `installable` false. */
  readonly unsupported?: readonly string[];
}

interface SeededPlugin {
  readonly name: string;
  /** Declare the entry in `marketplace.json` (default true). */
  readonly inManifest?: boolean;
  readonly manifestVersion?: string;
  /** Declare an unsupported component kind on the manifest entry. */
  readonly declaresUnsupported?: boolean;
  /** Create the on-disk plugin tree (default true). */
  readonly pluginTree?: boolean;
  readonly installed?: SeededInstall;
}

interface SeededMarketplace {
  readonly name: string;
  readonly plugins: readonly SeededPlugin[];
}

/** The structured `details.plugins` row shape the tool payload carries. */
interface ExpectedPluginRow {
  readonly marketplace: string;
  readonly scope: Scope;
  readonly name: string;
  readonly status: ToolPluginStatus;
  readonly version?: string;
  readonly reasons?: readonly string[];
}

function refuseNetwork(): Promise<Response> {
  throw new Error("the read-only tool surface must not reach the network");
}

/**
 * One temporary working directory and one temporary home per case, with the
 * agent-directory variable cleared: `getAgentDir()` reads it before `homedir()`,
 * so an ambient value would defeat a hermetic `HOME` (SC-1). Removal and both
 * environment restores are registered before the tool runs.
 */
async function createHermeticScope(t: TestContext, label: string): Promise<HermeticScope> {
  const cwd = await mkdtemp(path.join(tmpdir(), `tools-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `tools-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
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
  const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
  return {
    cwd,
    fetchCallCount(): number {
      return fetchSpy.mock.callCount();
    },
  };
}

function marketplaceRootIn(cwd: string, marketplaceName: string): string {
  return path.join(cwd, "marketplaces", marketplaceName);
}

function manifestPathIn(cwd: string, marketplaceName: string): string {
  return path.join(marketplaceRootIn(cwd, marketplaceName), ".claude-plugin", "marketplace.json");
}

function pluginRootIn(cwd: string, marketplaceName: string, pluginName: string): string {
  return path.join(marketplaceRootIn(cwd, marketplaceName), "plugins", pluginName);
}

function installedRecord(resolvedSource: string, installed: SeededInstall): PluginRecord {
  const unsupported = installed.unsupported ?? [];
  return {
    version: installed.version,
    resolvedSource,
    compatibility: {
      installable: unsupported.length === 0,
      notes: [],
      supported: [],
      unsupported: [...unsupported],
    },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: installed.disabled !== true,
    installedAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z",
  };
}

async function layoutMarketplace(
  cwd: string,
  scope: Scope,
  marketplace: SeededMarketplace,
): Promise<MarketplaceRecord> {
  const marketplaceRoot = marketplaceRootIn(cwd, marketplace.name);
  const manifestPath = manifestPathIn(cwd, marketplace.name);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace.name,
      plugins: marketplace.plugins
        .filter((plugin) => plugin.inManifest !== false)
        .map((plugin) => ({
          name: plugin.name,
          source: `./plugins/${plugin.name}`,
          ...(plugin.manifestVersion === undefined ? {} : { version: plugin.manifestVersion }),
          ...(plugin.declaresUnsupported === true ? { lspServers: { ls: {} } } : {}),
        })),
    }),
    "utf8",
  );

  const records: Record<string, PluginRecord> = {};
  for (const plugin of marketplace.plugins) {
    const pluginRoot = pluginRootIn(cwd, marketplace.name, plugin.name);
    if (plugin.pluginTree !== false) {
      await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
      await writeFile(
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
        JSON.stringify({
          name: plugin.name,
          ...(plugin.manifestVersion === undefined ? {} : { version: plugin.manifestVersion }),
        }),
        "utf8",
      );
    }

    if (plugin.installed !== undefined) {
      records[plugin.name] = installedRecord(pluginRoot, plugin.installed);
    }
  }

  return {
    name: marketplace.name,
    scope,
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    plugins: records,
  };
}

/**
 * Lay out every declared marketplace inside the case's own working directory and
 * write the scope's `state.json` naming them. Everything lives under `cwd`, so
 * the case's removal covers it.
 */
async function seedScope(
  cwd: string,
  scope: Scope,
  marketplaces: readonly SeededMarketplace[],
): Promise<void> {
  const records: Record<string, MarketplaceRecord> = {};
  for (const marketplace of marketplaces) {
    records[marketplace.name] = await layoutMarketplace(cwd, scope, marketplace);
  }

  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, { schemaVersion: 2, marketplaces: records });
}

/**
 * The boundary one tool case needs, sized to that case exactly.
 *
 * Only two members carry an expectation. `registerTool` is promised once, so a
 * second registration or none at all fails at `verifyBoundary()`. `ctx.cwd` is
 * promised exactly as often as the case's path reads it: the marketplace
 * existence check and the payload load take one read each, and a path that
 * short-circuits before the load takes one in total.
 *
 * Everything else is left unstated on purpose. `ctx.ui` carries no expectation,
 * so an attempt to notify fails where it happens -- a tool returns its result
 * and never reaches the slash-command notification channel. `pi.getAllTools()`
 * carries none either, so a soft-dependency probe fails the same way.
 */
function createToolBoundary(cwd?: {
  readonly value: string;
  readonly reads: number;
}): ToolBoundary {
  const registrations: ToolRegistration[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ToolRegistrar>({ exactParams: true, name: "extension API" });
  when(() => pi.registerTool)
    .thenReturn((tool) => {
      registrations.push(tool);
    })
    .times(1);
  if (cwd !== undefined) {
    when(() => ctx.cwd)
      .thenReturn(cwd.value)
      .times(cwd.reads);
  }

  return {
    ctx,
    pi,
    registrations,
    verifyBoundary: (): void => {
      verify(ctx);
      verify(pi);
    },
  };
}

/**
 * Register the tool and narrow the recorded definition, for the cases whose act
 * is the tool callback rather than the registration. The guard only narrows;
 * the `times(1)` promise above is what proves exactly one tool was installed.
 */
function registerToolUnderTest(
  register: (pi: ExtensionAPI) => void,
  cwd?: { readonly value: string; readonly reads: number },
): RegisteredToolBoundary {
  const boundary = createToolBoundary(cwd);
  register(boundary.pi);
  const [registration] = boundary.registrations;
  if (registration === undefined) {
    throw new Error("the registration function installed no tool definition");
  }

  return { ctx: boundary.ctx, registration, verifyBoundary: boundary.verifyBoundary };
}

describe("projectRowStatus", () => {
  const projectedStatuses = [
    { status: "installed", bucket: "installed" },
    { status: "upgradable", bucket: "installed" },
    { status: "partially-installed", bucket: "installed" },
    { status: "partially-upgradable", bucket: "installed" },
    { status: "available", bucket: "available" },
    { status: "remote", bucket: "available" },
    { status: "unavailable", bucket: "unavailable" },
    { status: "partially-available", bucket: "unavailable" },
    { status: "disabled", bucket: "unavailable" },
  ] as const satisfies readonly { status: PluginStatus; bucket: ToolPluginStatus }[];

  const refusedStatuses = [
    "updated",
    "reinstalled",
    "uninstalled",
    "failed",
    "skipped",
    "manual recovery",
    "will install",
    "will uninstall",
    "will enable",
    "will disable",
  ] as const satisfies readonly PluginStatus[];

  // A status neither table drives has no key here and makes this a compile
  // error, so the two tables together stay total over the plugin status union.
  type UndrivenStatus = Exclude<
    PluginStatus,
    (typeof projectedStatuses)[number]["status"] | (typeof refusedStatuses)[number]
  >;
  void ({} satisfies Record<UndrivenStatus, never>);

  for (const { status, bucket } of projectedStatuses) {
    test(`projects the ${status} list row onto the ${bucket} tool bucket`, () => {
      // arrange
      const expectedBucket = bucket;

      // act
      const toolStatus = projectRowStatus(status);

      // assert
      assert.deepStrictEqual(toolStatus, expectedBucket);
    });
  }

  for (const status of refusedStatuses) {
    test(`refuses the ${status} row the list surface never produces`, () => {
      // arrange
      const expectedMessage = `pi_claude_marketplace_plugin_list: unexpected plugin status "${status}" on list payload`;

      // act & assert
      assert.throws(
        () => projectRowStatus(status),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.deepStrictEqual(error.name, "Error");
          assert.deepStrictEqual(error.message, expectedMessage);
          return true;
        },
      );
    });
  }
});

describe("registerListMarketplacesTool", () => {
  test("registers pi_claude_marketplace_list with an empty parameter schema", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "list-registration");
    const { pi, registrations, verifyBoundary } = createToolBoundary();
    const expectedDefinition = {
      name: "pi_claude_marketplace_list",
      label: "Claude Marketplace List",
      description: "List configured Claude plugin marketplaces.",
      promptSnippet:
        "Use pi_claude_marketplace_list to inspect configured Claude plugin marketplaces.",
      parameters: { type: "object", properties: {} },
    };

    // act
    registerListMarketplacesTool(pi);

    // assert
    assert.deepStrictEqual(
      registrations.map((tool) => Object.keys(tool)),
      [["name", "label", "description", "promptSnippet", "parameters", "execute"]],
    );
    assert.deepStrictEqual(
      registrations.map((tool) => ({
        name: tool.name,
        label: tool.label,
        description: tool.description,
        promptSnippet: tool.promptSnippet,
        parameters: tool.parameters,
      })),
      [expectedDefinition],
    );
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("reports no marketplaces configured when neither scope holds a record", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "list-empty");
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(
      registerListMarketplacesTool,
      {
        value: scope.cwd,
        reads: 1,
      },
    );
    const expectedResult = {
      content: [{ type: "text", text: "No marketplaces configured." }],
      details: { marketplaces: [] },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("renders one line per marketplace with its scope, plugin count and source", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "list-populated");
    await seedScope(scope.cwd, "project", [
      {
        name: "proj-mp",
        plugins: [{ name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
      },
    ]);
    await seedScope(scope.cwd, "user", [{ name: "user-mp", plugins: [] }]);
    const projectRoot = marketplaceRootIn(scope.cwd, "proj-mp");
    const userRoot = marketplaceRootIn(scope.cwd, "user-mp");
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(
      registerListMarketplacesTool,
      {
        value: scope.cwd,
        reads: 1,
      },
    );
    const expectedResult = {
      content: [
        {
          type: "text",
          text: `[project] proj-mp -- 1 plugin(s) -- ${projectRoot}\n[user] user-mp -- 0 plugin(s) -- ${userRoot}`,
        },
      ],
      details: {
        marketplaces: [
          {
            name: "proj-mp",
            scope: "project",
            pluginCount: 1,
            source: { kind: "path", raw: projectRoot, logical: projectRoot },
          },
          {
            name: "user-mp",
            scope: "user",
            pluginCount: 0,
            source: { kind: "path", raw: userRoot, logical: userRoot },
          },
        ],
      },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });
});

interface VersionCase {
  /** Names the seeded shape and doubles as the marketplace and directory label. */
  readonly marketplace: string;
  readonly title: string;
  readonly plugin: SeededPlugin;
  readonly line: string;
  readonly row: ExpectedPluginRow;
}

const versionCases = [
  {
    marketplace: "installed-mp",
    title: "carries the recorded version of an installed row",
    plugin: { name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
    line: "  [installed] alpha  1.0.0",
    row: {
      marketplace: "installed-mp",
      scope: "project",
      name: "alpha",
      status: "installed",
      version: "1.0.0",
    },
  },
  {
    marketplace: "upgradable-mp",
    title: "carries the installed version, not the candidate, on an upgradable row",
    plugin: { name: "alpha", manifestVersion: "2.0.0", installed: { version: "1.0.0" } },
    line: "  [installed] alpha  1.0.0",
    row: {
      marketplace: "upgradable-mp",
      scope: "project",
      name: "alpha",
      status: "installed",
      version: "1.0.0",
    },
  },
  {
    marketplace: "partially-installed-mp",
    title: "carries the recorded version of a partially installed row",
    plugin: {
      name: "alpha",
      manifestVersion: "1.0.0",
      installed: { version: "1.0.0", unsupported: ["lspServers"] },
    },
    line: "  [installed] alpha  1.0.0  (lsp)",
    row: {
      marketplace: "partially-installed-mp",
      scope: "project",
      name: "alpha",
      status: "installed",
      version: "1.0.0",
      reasons: ["lsp"],
    },
  },
  {
    marketplace: "partially-upgradable-mp",
    title: "carries the installed version of a partially upgradable row",
    plugin: {
      name: "alpha",
      manifestVersion: "2.0.0",
      declaresUnsupported: true,
      installed: { version: "1.0.0" },
    },
    line: "  [installed] alpha  1.0.0  (lsp)",
    row: {
      marketplace: "partially-upgradable-mp",
      scope: "project",
      name: "alpha",
      status: "installed",
      version: "1.0.0",
      reasons: ["lsp"],
    },
  },
  {
    marketplace: "disabled-mp",
    title: "keeps the pinned version of a disabled row",
    plugin: {
      name: "alpha",
      manifestVersion: "1.0.0",
      installed: { version: "1.0.0", disabled: true },
    },
    line: "  [unavailable] alpha  1.0.0",
    row: {
      marketplace: "disabled-mp",
      scope: "project",
      name: "alpha",
      status: "unavailable",
      version: "1.0.0",
    },
  },
  {
    marketplace: "available-mp",
    title: "carries the declared version of an available row",
    plugin: { name: "alpha", manifestVersion: "3.0.0" },
    line: "  [available] alpha  3.0.0",
    row: {
      marketplace: "available-mp",
      scope: "project",
      name: "alpha",
      status: "available",
      version: "3.0.0",
    },
  },
  {
    marketplace: "unversioned-available-mp",
    title: "omits the version of an available row that declares none",
    plugin: { name: "alpha" },
    line: "  [available] alpha",
    row: {
      marketplace: "unversioned-available-mp",
      scope: "project",
      name: "alpha",
      status: "available",
    },
  },
  {
    marketplace: "unavailable-mp",
    title: "carries the declared version of an unavailable row",
    plugin: { name: "alpha", manifestVersion: "3.0.0", pluginTree: false },
    line: "  [unavailable] alpha  3.0.0  (unsupported source)",
    row: {
      marketplace: "unavailable-mp",
      scope: "project",
      name: "alpha",
      status: "unavailable",
      version: "3.0.0",
      reasons: ["unsupported source"],
    },
  },
  {
    marketplace: "unversioned-unavailable-mp",
    title: "omits the version of an unavailable row that declares none",
    plugin: { name: "alpha", pluginTree: false },
    line: "  [unavailable] alpha  (unsupported source)",
    row: {
      marketplace: "unversioned-unavailable-mp",
      scope: "project",
      name: "alpha",
      status: "unavailable",
      reasons: ["unsupported source"],
    },
  },
] as const satisfies readonly VersionCase[];

const mixedMarketplace = {
  name: "mixed-mp",
  plugins: [
    { name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
    { name: "bravo", manifestVersion: "2.0.0" },
    { name: "charlie", manifestVersion: "3.0.0", pluginTree: false },
  ],
} as const satisfies SeededMarketplace;

const installedRow = {
  marketplace: "mixed-mp",
  scope: "project",
  name: "alpha",
  status: "installed",
  version: "1.0.0",
} as const satisfies ExpectedPluginRow;

const availableRow = {
  marketplace: "mixed-mp",
  scope: "project",
  name: "bravo",
  status: "available",
  version: "2.0.0",
} as const satisfies ExpectedPluginRow;

const unavailableRow = {
  marketplace: "mixed-mp",
  scope: "project",
  name: "charlie",
  status: "unavailable",
  version: "3.0.0",
  reasons: ["unsupported source"],
} as const satisfies ExpectedPluginRow;

const INSTALLED_LINE = "  [installed] alpha  1.0.0";
const AVAILABLE_LINE = "  [available] bravo  2.0.0";
const UNAVAILABLE_LINE = "  [unavailable] charlie  3.0.0  (unsupported source)";

interface FilterCase {
  readonly title: string;
  readonly params: {
    readonly installed?: boolean;
    readonly available?: boolean;
    readonly unavailable?: boolean;
  };
  readonly lines: readonly string[];
  readonly rows: readonly ExpectedPluginRow[];
}

const filterCases = [
  {
    title: "renders every bucket when no filter is set",
    params: {},
    lines: [INSTALLED_LINE, AVAILABLE_LINE, UNAVAILABLE_LINE],
    rows: [installedRow, availableRow, unavailableRow],
  },
  {
    title: "narrows to the installed bucket when only installed is set",
    params: { installed: true },
    lines: [INSTALLED_LINE],
    rows: [installedRow],
  },
  {
    title: "narrows to the available bucket when only available is set",
    params: { available: true },
    lines: [AVAILABLE_LINE],
    rows: [availableRow],
  },
  {
    title: "narrows to the unavailable bucket when only unavailable is set",
    params: { unavailable: true },
    lines: [UNAVAILABLE_LINE],
    rows: [unavailableRow],
  },
  {
    title: "unions the available and unavailable buckets when both are set",
    params: { available: true, unavailable: true },
    lines: [AVAILABLE_LINE, UNAVAILABLE_LINE],
    rows: [availableRow, unavailableRow],
  },
] as const satisfies readonly FilterCase[];

describe("registerListPluginsTool", () => {
  test("registers pi_claude_marketplace_plugin_list with its filter parameters", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "plugin-registration");
    const { pi, registrations, verifyBoundary } = createToolBoundary();
    const expectedDefinition = {
      name: "pi_claude_marketplace_plugin_list",
      label: "Marketplace Plugin List",
      description:
        "List plugins in a Claude marketplace, showing compatibility and install status.",
      promptSnippet: "Use pi_claude_marketplace_plugin_list to inspect plugins in a marketplace.",
      parameters: {
        type: "object",
        properties: {
          marketplace: { type: "string", description: "Marketplace name to list plugins for." },
          scope: {
            anyOf: [
              { type: "string", const: "user" },
              { type: "string", const: "project" },
            ],
            description: 'Scope to look in: "user" or "project". Default: both scopes.',
          },
          installed: { type: "boolean", description: "Include plugins installed in state.json." },
          available: {
            type: "boolean",
            description:
              "Include manifest-declared plugins that are not installed but are installable.",
          },
          unavailable: {
            type: "boolean",
            description:
              "Include manifest-declared plugins that are not installable on this system.",
          },
        },
      },
    };

    // act
    registerListPluginsTool(pi);

    // assert
    assert.deepStrictEqual(
      registrations.map((tool) => Object.keys(tool)),
      [["name", "label", "description", "promptSnippet", "parameters", "execute"]],
    );
    assert.deepStrictEqual(
      registrations.map((tool) => ({
        name: tool.name,
        label: tool.label,
        description: tool.description,
        promptSnippet: tool.promptSnippet,
        parameters: tool.parameters,
      })),
      [expectedDefinition],
    );
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  for (const { marketplace, title, plugin, line, row } of versionCases) {
    test(title, async (t) => {
      // arrange
      const scope = await createHermeticScope(t, marketplace);
      await seedScope(scope.cwd, "project", [{ name: marketplace, plugins: [plugin] }]);
      const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
        value: scope.cwd,
        reads: 1,
      });
      const expectedResult = {
        content: [{ type: "text", text: `Marketplace ${marketplace} (project)\n${line}` }],
        details: { plugins: [row] },
      };

      // act
      const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

      // assert
      assert.deepStrictEqual(listed, expectedResult);
      assert.deepStrictEqual(scope.fetchCallCount(), 0);
      verifyBoundary();
    });
  }

  for (const { title, params, lines, rows } of filterCases) {
    test(title, async (t) => {
      // arrange
      const scope = await createHermeticScope(t, "filters");
      await seedScope(scope.cwd, "project", [mixedMarketplace]);
      const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
        value: scope.cwd,
        reads: 1,
      });
      const expectedResult = {
        content: [{ type: "text", text: ["Marketplace mixed-mp (project)", ...lines].join("\n") }],
        details: { plugins: rows },
      };

      // act
      const listed = await registration.execute("call-1", params, undefined, undefined, ctx);

      // assert
      assert.deepStrictEqual(listed, expectedResult);
      assert.deepStrictEqual(scope.fetchCallCount(), 0);
      verifyBoundary();
    });
  }

  test("skips a row whose bucket the filter excludes instead of rendering it", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "skip-bucket");
    await seedScope(scope.cwd, "project", [
      {
        name: "skip-mp",
        plugins: [
          { name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } },
          {
            name: "delta",
            manifestVersion: "1.0.0",
            installed: { version: "1.0.0", disabled: true },
          },
        ],
      },
    ]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [
        { type: "text", text: "Marketplace skip-mp (project)\n  [installed] alpha  1.0.0" },
      ],
      details: {
        plugins: [
          {
            marketplace: "skip-mp",
            scope: "project",
            name: "alpha",
            status: "installed",
            version: "1.0.0",
          },
        ],
      },
    };

    // act
    const listed = await registration.execute(
      "call-1",
      { installed: true },
      undefined,
      undefined,
      ctx,
    );

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("renders the no-plugins body for a marketplace that declares none", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "no-plugins");
    await seedScope(scope.cwd, "project", [{ name: "bare-mp", plugins: [] }]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: "Marketplace bare-mp (project)\n  (no plugins)" }],
      details: { plugins: [] },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("reports no marketplaces configured when neither scope holds a record", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "plugin-empty");
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: "No marketplaces configured." }],
      details: { plugins: [] },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("narrows to the named marketplace when the marketplace parameter is set", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "marketplace-narrowing");
    await seedScope(scope.cwd, "project", [
      {
        name: "first-mp",
        plugins: [{ name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
      },
      {
        name: "second-mp",
        plugins: [{ name: "bravo", manifestVersion: "2.0.0", installed: { version: "2.0.0" } }],
      },
    ]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 2,
    });
    const expectedResult = {
      content: [
        { type: "text", text: "Marketplace second-mp (project)\n  [installed] bravo  2.0.0" },
      ],
      details: {
        plugins: [
          {
            marketplace: "second-mp",
            scope: "project",
            name: "bravo",
            status: "installed",
            version: "2.0.0",
          },
        ],
      },
    };

    // act
    const listed = await registration.execute(
      "call-1",
      { marketplace: "second-mp" },
      undefined,
      undefined,
      ctx,
    );

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("narrows to the named scope when the scope parameter is set", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "scope-narrowing");
    await seedScope(scope.cwd, "project", [
      {
        name: "proj-mp",
        plugins: [{ name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
      },
    ]);
    await seedScope(scope.cwd, "user", [
      {
        name: "user-mp",
        plugins: [{ name: "bravo", manifestVersion: "2.0.0", installed: { version: "2.0.0" } }],
      },
    ]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: "Marketplace user-mp (user)\n  [installed] bravo  2.0.0" }],
      details: {
        plugins: [
          {
            marketplace: "user-mp",
            scope: "user",
            name: "bravo",
            status: "installed",
            version: "2.0.0",
          },
        ],
      },
    };

    // act
    const listed = await registration.execute(
      "call-1",
      { scope: "user" },
      undefined,
      undefined,
      ctx,
    );

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("looks for the named marketplace in the named scope alone", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "marketplace-in-scope");
    await seedScope(scope.cwd, "project", [
      {
        name: "proj-mp",
        plugins: [{ name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
      },
    ]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: 'Marketplace "proj-mp" not found.' }],
      details: { plugins: [] },
    };

    // act
    const listed = await registration.execute(
      "call-1",
      { marketplace: "proj-mp", scope: "user" },
      undefined,
      undefined,
      ctx,
    );

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("reports the marketplace as not found when no scope declares it", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "marketplace-absent");
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: 'Marketplace "ghost-mp" not found.' }],
      details: { plugins: [] },
    };

    // act
    const listed = await registration.execute(
      "call-1",
      { marketplace: "ghost-mp" },
      undefined,
      undefined,
      ctx,
    );

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("carries the plugin's own scope when it differs from the marketplace scope", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "orphan-fold");
    await seedScope(scope.cwd, "user", [
      { name: "shared-mp", plugins: [{ name: "alpha", manifestVersion: "1.0.0" }] },
    ]);
    await seedScope(scope.cwd, "project", [
      {
        name: "shared-mp",
        plugins: [{ name: "alpha", manifestVersion: "1.0.0", installed: { version: "1.0.0" } }],
      },
    ]);
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [{ type: "text", text: "Marketplace shared-mp (user)\n  [installed] alpha  1.0.0" }],
      details: {
        plugins: [
          {
            marketplace: "shared-mp",
            scope: "project",
            name: "alpha",
            status: "installed",
            version: "1.0.0",
          },
        ],
      },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });

  test("reports a tool error when the recorded state declares an unknown schema", async (t) => {
    // arrange
    const scope = await createHermeticScope(t, "unreadable-state");
    await seedScope(scope.cwd, "project", [{ name: "broken-mp", plugins: [] }]);
    const locations = locationsFor("project", scope.cwd);
    await writeFile(locations.stateJsonPath, JSON.stringify({ schemaVersion: 3 }), "utf8");
    const { ctx, registration, verifyBoundary } = registerToolUnderTest(registerListPluginsTool, {
      value: scope.cwd,
      reads: 1,
    });
    const expectedResult = {
      content: [
        {
          type: "text",
          text: `Failed to load plugin list: state.json at ${locations.stateJsonPath} has an unsupported schema version`,
        },
      ],
      isError: true,
      details: { plugins: [] },
    };

    // act
    const listed = await registration.execute("call-1", {}, undefined, undefined, ctx);

    // assert
    assert.deepStrictEqual(listed, expectedResult);
    assert.deepStrictEqual(scope.fetchCallCount(), 0);
    verifyBoundary();
  });
});
