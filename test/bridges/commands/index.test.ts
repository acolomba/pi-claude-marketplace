import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { discoverPluginCommands as definingDiscoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
  discoverPluginCommands,
  prepareStageCommands,
  unstagePluginCommands,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import {
  abortPreparedCommands as definingAbortPreparedCommands,
  commitPreparedCommands as definingCommitPreparedCommands,
  prepareStageCommands as definingPrepareStageCommands,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { unstagePluginCommands as definingUnstagePluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/unstage.ts";

import type * as CommandsBarrel from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import type { PreparedCommandsStaging as BarrelPreparedCommandsStaging } from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import type { PreparedCommandsStaging as DefiningPreparedCommandsStaging } from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedCommandsNoop = Extract<BarrelPreparedCommandsStaging, { kind: "noop" }>;
type PreparedCommandsStaged = Extract<BarrelPreparedCommandsStaging, { kind: "staged" }>;

void (true satisfies Same<BarrelPreparedCommandsStaging, DefiningPreparedCommandsStaging>);
void (true satisfies Same<PreparedCommandsNoop["kind"], "noop">);
void (true satisfies Same<PreparedCommandsStaged["kind"], "staged">);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
} satisfies BarrelPreparedCommandsStaging);

// @ts-expect-error staging internals require narrowing to the staged handle
void ("/staging" satisfies BarrelPreparedCommandsStaging["stagingRoot"]);
// @ts-expect-error a command preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedCommandsStaging);
// @ts-expect-error the barrel keeps the staged implementation type private
void ({} satisfies { readonly retired?: CommandsBarrel.PreparedCommandsStaged });
// @ts-expect-error the barrel does not export the commit-result implementation type
void ({} satisfies { readonly retired?: CommandsBarrel.StageCommandsCommitResult });

describe("abortPreparedCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedCommands = definingAbortPreparedCommands;

    // act
    const commandsAbortPreparedCommands = abortPreparedCommands;

    // assert
    assert.strictEqual(commandsAbortPreparedCommands, expectedAbortPreparedCommands);
  });
});

describe("commitPreparedCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedCommitPreparedCommands = definingCommitPreparedCommands;

    // act
    const commandsCommitPreparedCommands = commitPreparedCommands;

    // assert
    assert.strictEqual(commandsCommitPreparedCommands, expectedCommitPreparedCommands);
  });
});

describe("discoverPluginCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedDiscoverPluginCommands = definingDiscoverPluginCommands;

    // act
    const commandsDiscoverPluginCommands = discoverPluginCommands;

    // assert
    assert.strictEqual(commandsDiscoverPluginCommands, expectedDiscoverPluginCommands);
  });
});

describe("prepareStageCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedPrepareStageCommands = definingPrepareStageCommands;

    // act
    const commandsPrepareStageCommands = prepareStageCommands;

    // assert
    assert.strictEqual(commandsPrepareStageCommands, expectedPrepareStageCommands);
  });
});

describe("unstagePluginCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedUnstagePluginCommands = definingUnstagePluginCommands;

    // act
    const commandsUnstagePluginCommands = unstagePluginCommands;

    // assert
    assert.strictEqual(commandsUnstagePluginCommands, expectedUnstagePluginCommands);
  });
});
