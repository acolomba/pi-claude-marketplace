import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  bashSubcommandFires,
  parseBashSubcommands,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts";
import { compileBashGlob } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts";

describe("parseBashSubcommands", () => {
  test("splits every unquoted compound separator in source order", () => {
    // arrange
    const command =
      "git status && npm test || pnpm lint |& tee lint.log | cat & wait; echo done\npwd";
    const expectedParse = {
      ok: true,
      subcommands: [
        "git status",
        "npm test",
        "pnpm lint",
        "tee lint.log",
        "cat",
        "wait",
        "echo done",
        "pwd",
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps separators inside single and double quote boundaries", () => {
    // arrange
    const command =
      'printf \'left && right; still\' && printf "up | down & still" || echo "end\nstill"';
    const expectedParse = {
      ok: true,
      subcommands: [
        "printf 'left && right; still'",
        'printf "up | down & still"',
        'echo "end\nstill"',
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps escaped separators inside their surrounding commands", () => {
    // arrange
    const command =
      "find . -exec rm {} \\; && printf left \\| right && echo one \\& two && echo three \\&\\& four";
    const expectedParse = {
      ok: true,
      subcommands: [
        "find . -exec rm {} \\;",
        "printf left \\| right",
        "echo one \\& two",
        "echo three \\&\\& four",
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("deduplicates repeated candidates without changing first-seen order", () => {
    // arrange
    const command = "git status && npm test && git status || npm test; git push";
    const expectedParse = {
      ok: true,
      subcommands: ["git status", "npm test", "git push"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });
});

describe("bashSubcommandFires", () => {
  test("fires when the compiled glob directly matches the complete subcommand", () => {
    // arrange
    const compiledGlob = compileBashGlob("git push *");
    const subcommand = "git push origin/main";

    // act
    const fires = bashSubcommandFires(compiledGlob, subcommand, false);

    // assert
    assert.strictEqual(fires, true);
  });

  test("applies interpolation fallback only to the promised specific glob", () => {
    // arrange
    const specificGlob = compileBashGlob("git push *");
    const commandNameGlob = compileBashGlob("git *");
    const subcommand = "echo $BRANCH";

    // act
    const specificity = {
      specific: bashSubcommandFires(specificGlob, subcommand, true),
      commandName: bashSubcommandFires(commandNameGlob, subcommand, true),
    };

    // assert
    assert.deepStrictEqual(specificity, { specific: true, commandName: false });
  });
});
