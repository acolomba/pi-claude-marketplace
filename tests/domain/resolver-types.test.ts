import assert from "node:assert/strict";
import test from "node:test";

import { Compile } from "typebox/compile";

import type {
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

test("exports the exact three-arm resolver schema", async () => {
  // arrange
  let checkedStates: readonly boolean[] = [];

  // act & assert
  await assert.doesNotReject(async () => {
    const { ResolvedPluginSchema } = await import(
      "../../extensions/pi-claude-marketplace/domain/resolver-types.ts"
    );
    const validator = Compile(ResolvedPluginSchema);
    checkedStates = [
      validator.Check({
        state: "installable",
        installable: true,
        name: "alpha",
        pluginRoot: "/plugins/alpha",
        supported: [],
        unsupported: [],
        notes: [],
        componentPaths: { skills: [], commands: [], agents: [] },
        mcpServers: {},
        defaultEnabled: true,
      }),
      validator.Check({
        state: "partially-available",
        installable: true,
        name: "alpha",
        pluginRoot: "/plugins/alpha",
        supported: [],
        unsupported: ["themes"],
        notes: ["contains themes"],
        componentPaths: { skills: [], commands: [], agents: [] },
        mcpServers: {},
        defaultEnabled: false,
      }),
      validator.Check({
        state: "unavailable",
        installable: false,
        name: "alpha",
        notes: ["source missing"],
      }),
      validator.Check({
        state: "unavailable",
        installable: false,
        name: "alpha",
        pluginRoot: "/must-not-leak",
        notes: ["source missing"],
      }),
    ];
  });
  assert.deepStrictEqual(checkedStates, [true, true, true, false]);
});

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
const statKindReaderContract: StatKindReader = async () => statKindContract;
const gitPluginRootContract = {
  kind: "materialized",
  pluginRoot: "/plugins/alpha",
  resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
} satisfies GitPluginRootResult;
const resolveContextContract = {
  marketplaceRoot: "/marketplaces/main",
  statKind: statKindReaderContract,
  resolveGitPluginRoot: async () => gitPluginRootContract,
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
