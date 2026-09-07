import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compilePowerShellRule,
  parsePowerShellSubcommands,
  powerShellSubcommandFires,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts";

describe("parsePowerShellSubcommands", () => {
  test("splits a statement-separated compound command in source order", () => {
    // arrange
    const command = "Get-ChildItem -Path .; Remove-Item stale.log";
    const expectedParse = {
      ok: true,
      subcommands: ["Get-ChildItem -Path .", "Remove-Item stale.log"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });
});

describe("powerShellSubcommandFires", () => {
  test("fires a cmdlet rule on the command written with an alias head", () => {
    // arrange
    const compiledGlob = compilePowerShellRule("Get-ChildItem *");
    const subcommand = "gci foo";

    // act
    const fires = powerShellSubcommandFires(compiledGlob, subcommand, false);

    // assert
    assert.strictEqual(fires, true);
  });
});
