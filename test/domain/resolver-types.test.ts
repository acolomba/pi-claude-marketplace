import type {
  CommandMapEntry,
  GitPluginRootResult,
  MaterializablePlugin,
  ResolveContext,
  ResolvedPlugin,
  ResolvedPluginInstallable,
  ResolvedPluginPartiallyAvailable,
  ResolvedPluginUnavailable,
  StatKind,
  StatKindReader,
} from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

declare const resolvedPluginContract: ResolvedPlugin;
declare const installablePluginContract: ResolvedPluginInstallable;
declare const partiallyAvailablePluginContract: ResolvedPluginPartiallyAvailable;
declare const unavailablePluginContract: ResolvedPluginUnavailable;
declare const materializablePluginContract: MaterializablePlugin;

function proveExactDiscriminants(): void {
  void (installablePluginContract.installable satisfies true);
  void (partiallyAvailablePluginContract.installable satisfies true);
  void (unavailablePluginContract.installable satisfies false);
  void (installablePluginContract.state satisfies "installable");
  void (partiallyAvailablePluginContract.state satisfies "partially-available");
  void (unavailablePluginContract.state satisfies "unavailable");
}

type ResolvedDroppedHook = NonNullable<ResolvedPluginInstallable["droppedHooks"]>[number];
type AssertTrue<T extends true> = T;
type ExpectedDroppedHook =
  | { kind: "event"; event: string }
  | {
      kind: "group";
      event: string;
      matcher: string;
      cond: "regex" | "unmapped-tool" | "no-matcher-support" | "closed-set";
    }
  | { kind: "handler"; event: string; matcher: string; handlerType: string };
void (true satisfies AssertTrue<
  [ResolvedDroppedHook] extends [ExpectedDroppedHook] ? true : false
>);
void (true satisfies AssertTrue<
  [ExpectedDroppedHook] extends [ResolvedDroppedHook] ? true : false
>);

const installableExample = {
  state: "installable",
  installable: true,
  name: "alpha",
  pluginRoot: "/plugins/alpha",
  supported: [],
  unsupported: [],
  notes: [],
  componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
  mcpServers: {},
  defaultEnabled: true,
} satisfies ResolvedPlugin;
const partialExample = {
  ...installableExample,
  state: "partially-available",
  unsupported: ["themes"],
  notes: ["contains themes"],
  defaultEnabled: false,
} satisfies ResolvedPlugin;
const unavailableExample = {
  state: "unavailable",
  installable: false,
  name: "alpha",
  notes: ["source missing"],
} satisfies ResolvedPlugin;
// Runtime schema accepted extra fields; structural assignment of an existing object remains legal.
const unavailableWithExtraField = {
  ...unavailableExample,
  pluginRoot: "/must-not-leak",
};
void (unavailableWithExtraField satisfies ResolvedPlugin);
// D-CF1-06: a materializable arm may name the folders a declaration leaves unread.
void ({ ...installableExample, shadowedFolders: ["commands"] } satisfies ResolvedPlugin);
void ({ ...partialExample, shadowedFolders: ["agents", "workflows"] } satisfies ResolvedPlugin);
// @ts-expect-error the shadowed folders are kind names.
void ({ ...installableExample, shadowedFolders: [1] } satisfies ResolvedPlugin);
// D-CF3-03: the command map holds source entries and inline entries, each with its origin.
void ({
  ...installableExample,
  componentPaths: {
    ...installableExample.componentPaths,
    commandMap: [
      { key: "alpha", source: "cmds/alpha.md", origin: "manifest", argumentHint: "<target>" },
      { key: "beta", content: "Beta body", origin: "entry", description: "Beta.", model: "opus" },
    ],
  },
} satisfies ResolvedPlugin);
const commandMapEntryContract = {
  key: "alpha",
  source: "cmds/alpha.md",
  origin: "manifest",
} satisfies CommandMapEntry;
void ({
  ...installableExample,
  componentPaths: {
    ...installableExample.componentPaths,
    // @ts-expect-error a command map entry sets a source or inline content.
    commandMap: [{ key: "alpha", origin: "manifest" }],
  },
} satisfies ResolvedPlugin);
void ({
  ...installableExample,
  componentPaths: {
    ...installableExample.componentPaths,
    // @ts-expect-error a command map entry comes from the plugin manifest or the marketplace entry.
    commandMap: [{ key: "alpha", source: "a.md", origin: "plugin" }],
  },
} satisfies ResolvedPlugin);
void ({
  ...installableExample,
  componentPaths: {
    ...installableExample.componentPaths,
    // @ts-expect-error a command map override is a string.
    commandMap: [{ key: "alpha", source: "a.md", origin: "manifest", model: 1 }],
  },
} satisfies ResolvedPlugin);
// @ts-expect-error the resolver's state set is closed.
void ({ ...unavailableExample, state: "unknown" } satisfies ResolvedPlugin);
// @ts-expect-error installable and state discriminants must agree.
void ({ ...unavailableExample, state: "installable" } satisfies ResolvedPlugin);
void partialExample;

function consumeInstallable(): string {
  return installablePluginContract.pluginRoot;
}

function consumePartiallyAvailable(): string {
  return partiallyAvailablePluginContract.pluginRoot;
}

function narrowOnMaterializability(): string | undefined {
  if (resolvedPluginContract.installable) {
    return resolvedPluginContract.pluginRoot;
  }

  return undefined;
}

function consumeUnavailable(): void {
  // @ts-expect-error -- NFR-7: the unavailable variant cannot expose pluginRoot.
  void unavailablePluginContract.pluginRoot;
}

function narrowOnMaterializabilityNegative(): void {
  if (!resolvedPluginContract.installable) {
    // @ts-expect-error -- NFR-7: the false arm cannot expose pluginRoot.
    void resolvedPluginContract.pluginRoot;
  }
}

function materializableAdmitsInstallable(): MaterializablePlugin {
  return installablePluginContract;
}

function materializableAdmitsPartiallyAvailable(): MaterializablePlugin {
  return partiallyAvailablePluginContract;
}

function materializableExposesFields(): readonly [string, boolean] {
  return [materializablePluginContract.pluginRoot, materializablePluginContract.defaultEnabled];
}

function materializableExcludesUnavailable(): void {
  // @ts-expect-error -- NFR-7: the unavailable arm is not materializable.
  const unavailableMaterializable: MaterializablePlugin = unavailablePluginContract;
  void unavailableMaterializable;
}

function unavailableHasNoDefaultEnabled(): void {
  // @ts-expect-error -- the unavailable arm carries no install-time enablement answer.
  void unavailablePluginContract.defaultEnabled;
}

const statKindContract: StatKind = "dir";
const statKindReaderContract: StatKindReader = () => Promise.resolve(statKindContract);
const gitPluginRootContract = {
  kind: "materialized",
  pluginRoot: "/plugins/alpha",
  resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
} satisfies GitPluginRootResult;
const resolveContextContract = {
  marketplaceRoot: "/marketplaces/main",
  marketplaceName: "third-party",
  marketplaceSource: { kind: "hosted", raw: "https://h.example/m.json" },
  statKind: statKindReaderContract,
  resolveGitPluginRoot: () => Promise.resolve(gitPluginRootContract),
} satisfies ResolveContext;

void proveExactDiscriminants;
void consumeInstallable;
void consumePartiallyAvailable;
void narrowOnMaterializability;
void consumeUnavailable;
void narrowOnMaterializabilityNegative;
void materializableAdmitsInstallable;
void materializableAdmitsPartiallyAvailable;
void materializableExposesFields;
void materializableExcludesUnavailable;
void unavailableHasNoDefaultEnabled;
void resolveContextContract;
void commandMapEntryContract;
