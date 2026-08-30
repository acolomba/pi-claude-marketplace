import assert from "node:assert/strict";
import { describe, test } from "node:test";

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
import { discoverPluginCommands as definingDiscoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";
import {
  abortPreparedCommands as definingAbortPreparedCommands,
  commitPreparedCommands as definingCommitPreparedCommands,
  finalizeCommandsReplacement as definingFinalizeCommandsReplacement,
  prepareStageCommands as definingPrepareStageCommands,
  replacePreparedCommands as definingReplacePreparedCommands,
  rollbackCommandsReplacement as definingRollbackCommandsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { unstagePluginCommands as definingUnstagePluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/unstage.ts";

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
