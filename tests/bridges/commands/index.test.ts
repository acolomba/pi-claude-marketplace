import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { discoverPluginCommands as definingDiscoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";
import {
  abortPreparedCommands,
  commitPreparedCommands,
  discoverPluginCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
  unstagePluginCommands,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import {
  abortPreparedCommands as definingAbortPreparedCommands,
  commitPreparedCommands as definingCommitPreparedCommands,
  finalizeCommandsReplacement as definingFinalizeCommandsReplacement,
  prepareStageCommands as definingPrepareStageCommands,
  replacePreparedCommands as definingReplacePreparedCommands,
  rollbackCommandsReplacement as definingRollbackCommandsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { unstagePluginCommands as definingUnstagePluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/unstage.ts";

import type * as CommandsBarrel from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import type {
  CommandsReplacement as BarrelCommandsReplacement,
  PreparedCommandsStaging as BarrelPreparedCommandsStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/index.ts";
import type {
  CommandsReplacement as DefiningCommandsReplacement,
  PreparedCommandsStaging as DefiningPreparedCommandsStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedCommandsNoop = Extract<BarrelPreparedCommandsStaging, { kind: "noop" }>;
type PreparedCommandsStaged = Extract<BarrelPreparedCommandsStaging, { kind: "staged" }>;
type CommandsReplacementNoop = Extract<BarrelCommandsReplacement, { kind: "noop" }>;
type CommandsReplacementReplaced = Extract<BarrelCommandsReplacement, { kind: "replaced" }>;

void (true satisfies Same<BarrelCommandsReplacement, DefiningCommandsReplacement>);
void (true satisfies Same<BarrelPreparedCommandsStaging, DefiningPreparedCommandsStaging>);
void (true satisfies Same<PreparedCommandsNoop["kind"], "noop">);
void (true satisfies Same<PreparedCommandsStaged["kind"], "staged">);
void (true satisfies Same<CommandsReplacementNoop["kind"], "noop">);
void (true satisfies Same<CommandsReplacementReplaced["kind"], "replaced">);
void (true satisfies Same<CommandsReplacementNoop["prepared"], PreparedCommandsNoop>);
void (true satisfies Same<CommandsReplacementReplaced["prepared"], PreparedCommandsStaged>);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
} satisfies BarrelPreparedCommandsStaging);
void ({
  kind: "noop",
  prepared: {
    kind: "noop",
    result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
  },
} satisfies BarrelCommandsReplacement);

// @ts-expect-error staging internals require narrowing to the staged handle
void ("/staging" satisfies BarrelPreparedCommandsStaging["stagingRoot"]);
// @ts-expect-error a command preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedCommandsStaging);
// @ts-expect-error a command replacement handle has a closed discriminant set
void ({ kind: "staged" } satisfies BarrelCommandsReplacement);
// @ts-expect-error the barrel keeps the staged implementation type private
void (true satisfies Same<CommandsBarrel.PreparedCommandsStaged, never>);
// @ts-expect-error the barrel does not export the commit-result implementation type
void (true satisfies Same<CommandsBarrel.StageCommandsCommitResult, never>);

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

describe("finalizeCommandsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedFinalizeCommandsReplacement = definingFinalizeCommandsReplacement;

    // act
    const commandsFinalizeCommandsReplacement = finalizeCommandsReplacement;

    // assert
    assert.strictEqual(commandsFinalizeCommandsReplacement, expectedFinalizeCommandsReplacement);
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

describe("replacePreparedCommands", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedReplacePreparedCommands = definingReplacePreparedCommands;

    // act
    const commandsReplacePreparedCommands = replacePreparedCommands;

    // assert
    assert.strictEqual(commandsReplacePreparedCommands, expectedReplacePreparedCommands);
  });
});

describe("rollbackCommandsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRollbackCommandsReplacement = definingRollbackCommandsReplacement;

    // act
    const commandsRollbackCommandsReplacement = rollbackCommandsReplacement;

    // assert
    assert.strictEqual(commandsRollbackCommandsReplacement, expectedRollbackCommandsReplacement);
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
