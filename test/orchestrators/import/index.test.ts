import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { importClaudeSettings as definingImportClaudeSettings } from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import * as importBarrel from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

import type {
  ClaudeImportExecutionResult as DefiningClaudeImportExecutionResult,
  ImportClaudeSettingsOptions as DefiningImportClaudeSettingsOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import type {
  ClaudeImportExecutionResult as BarrelClaudeImportExecutionResult,
  ImportClaudeSettingsOptions as BarrelImportClaudeSettingsOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type ImportRuntimeExport = keyof typeof importBarrel;

void (true satisfies Same<BarrelClaudeImportExecutionResult, DefiningClaudeImportExecutionResult>);
void (true satisfies Same<BarrelImportClaudeSettingsOptions, DefiningImportClaudeSettingsOptions>);
void (true satisfies Same<ImportRuntimeExport, "importClaudeSettings">);

void ({
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
} satisfies BarrelClaudeImportExecutionResult);

// @ts-expect-error an import execution result carries every outcome bucket and diagnostics
void ({ addedMarketplaces: [] } satisfies BarrelClaudeImportExecutionResult);

// D-115-01: the barrel publishes only what the plugin import command consumes. Each negative
// below fails to compile while its symbol is absent, so the suppression is consumed; re-adding
// any re-export makes the suppression unused and breaks `npm run typecheck`.

// @ts-expect-error the barrel does not re-export the import plan builder
void importBarrel.buildClaudeImportPlan;
// @ts-expect-error the barrel does not re-export the marketplace source planner
void importBarrel.planMarketplaceSourcesForRefs;
// @ts-expect-error the barrel does not re-export the enabled plugin reference extractor
void importBarrel.extractEnabledPluginRefs;
// @ts-expect-error the barrel does not re-export the enabled plugin reference parser
void importBarrel.parseEnabledPluginRef;
// @ts-expect-error the barrel does not re-export the merged settings loader
void importBarrel.loadMergedClaudeSettingsForScope;
// @ts-expect-error the barrel does not re-export the settings merger
void importBarrel.mergeClaudeSettings;
// @ts-expect-error the barrel does not re-export the settings path resolver
void importBarrel.resolveClaudeSettingsPaths;
// The type negative compares the absent member with itself: an absent member is the only way
// this line fails, so re-adding the type re-export leaves the suppression unused.
// @ts-expect-error the barrel does not re-export the enabled plugin reference type
void (true satisfies Same<importBarrel.EnabledPluginRef, importBarrel.EnabledPluginRef>);

describe("importClaudeSettings", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedImportClaudeSettings = definingImportClaudeSettings;

    // act
    const barrelImportClaudeSettings = importBarrel.importClaudeSettings;

    // assert
    assert.strictEqual(barrelImportClaudeSettings, expectedImportClaudeSettings);
  });
});
