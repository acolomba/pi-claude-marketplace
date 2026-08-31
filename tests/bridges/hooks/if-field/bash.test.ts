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

  test("extracts nested dollar and backtick substitutions in discovery order", () => {
    // arrange
    const command = "echo $(printf `date`) && echo `git status`";
    const expectedParse = {
      ok: true,
      subcommands: [
        "echo $(printf `date`)",
        "printf `date`",
        "date",
        "echo `git status`",
        "git status",
      ],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps quoted closing parentheses inside a dollar substitution body", () => {
    // arrange
    const command = "echo $(printf ')') && echo $(printf \"(\")";
    const expectedParse = {
      ok: true,
      subcommands: ["echo $(printf ')')", "printf ')'", 'echo $(printf "(")', 'printf "("'],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("detects supported interpolation forms while preserving the complete command", () => {
    // arrange
    const command = "printf '$LITERAL' \"$DOUBLE\" ${BRACED} $1";
    const expectedParse = {
      ok: true,
      subcommands: ["printf '$LITERAL' \"$DOUBLE\" ${BRACED} $1"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("does not classify positional parameters or a lone dollar as interpolation", () => {
    // arrange
    const command = "printf $1 $9 $";
    const expectedParse = {
      ok: true,
      subcommands: ["printf $1 $9 $"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("preserves an unmatched quote without splitting its literal separators", () => {
    // arrange
    const command = "printf 'unterminated && npm test";
    const expectedParse = {
      ok: true,
      subcommands: ["printf 'unterminated && npm test"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("preserves unmatched dollar and backtick substitutions as literal text", () => {
    // arrange
    const command = "echo $(date `pwd";
    const expectedParse = {
      ok: true,
      subcommands: ["echo $(date `pwd"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("preserves a terminal backslash as part of the command", () => {
    // arrange
    const command = "printf tail \\";
    const expectedParse = {
      ok: true,
      subcommands: ["printf tail \\"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("returns no candidates for empty input", () => {
    // arrange
    const command = "";
    const expectedParse = { ok: true, subcommands: [], hasInterpolation: false };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("discards empty partitions between compound separators", () => {
    // arrange
    const command = " && ; || |& | & \n ";
    const expectedParse = { ok: true, subcommands: [], hasInterpolation: false };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps empty substitutions on the surrounding command only", () => {
    // arrange
    const command = "echo $() && echo ``";
    const expectedParse = {
      ok: true,
      subcommands: ["echo $()", "echo ``"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("extracts seven nested substitution levels without failing open", () => {
    // arrange
    const command = "$($($($($($($(echo)))))))";
    const expectedParse = {
      ok: true,
      subcommands: [
        "$($($($($($($(echo)))))))",
        "$($($($($($(echo))))))",
        "$($($($($(echo)))))",
        "$($($($(echo))))",
        "$($($(echo)))",
        "$($(echo))",
        "$(echo)",
        "echo",
      ],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("fails open at the exact eight-level recursion cap", () => {
    // arrange
    const command = "$($($($($($($($(echo))))))))";
    const expectedParse = { ok: false, reason: "max recursion depth exceeded" };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("strips the complete closed wrapper vocabulary through a nested chain", () => {
    // arrange
    const command = "timeout 30 time nice 5 nohup stdbuf 0 xargs npm test";
    const expectedParse = {
      ok: true,
      subcommands: ["npm test"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("retains wrapper options and consumes only declared non-option arguments", () => {
    // arrange
    const command =
      "timeout --signal=TERM 30 npm test && time -p npm test && nice -n 5 npm test && nohup -- npm test && stdbuf -oL npm test";
    const expectedParse = {
      ok: true,
      subcommands: [
        "--signal=TERM 30 npm test",
        "-p npm test",
        "-n 5 npm test",
        "-- npm test",
        "-oL npm test",
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("drops wrapper-only commands after stripping their empty remainder", () => {
    // arrange
    const command = "timeout && time && nice && nohup && stdbuf && xargs";
    const expectedParse = { ok: true, subcommands: [], hasInterpolation: false };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("strips bare xargs but preserves flagged xargs as the command head", () => {
    // arrange
    const command =
      "xargs grep pattern && xargs -n1 grep pattern && xargs --max-args=1 grep pattern";
    const expectedParse = {
      ok: true,
      subcommands: ["grep pattern", "xargs -n1 grep pattern", "xargs --max-args=1 grep pattern"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps unsupported wrappers and find execution arguments opaque", () => {
    // arrange
    const command =
      "env npm test && sudo npm test && chronic npm test && watch npm test && setsid npm test && ionice npm test && flock lock npm test && devbox run npm test && mise exec npm test && npx npm test && docker exec box npm test && find . -exec rm {} \\;";
    const expectedParse = {
      ok: true,
      subcommands: [
        "env npm test",
        "sudo npm test",
        "chronic npm test",
        "watch npm test",
        "setsid npm test",
        "ionice npm test",
        "flock lock npm test",
        "devbox run npm test",
        "mise exec npm test",
        "npx npm test",
        "docker exec box npm test",
        "find . -exec rm {} \\;",
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parseBashSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("does not recurse into process substitution arguments", () => {
    // arrange
    const command = "cat <(git status) >(npm test)";
    const expectedParse = {
      ok: true,
      subcommands: ["cat <(git status) >(npm test)"],
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

  test("returns the direct glob decision when interpolation fallback is unavailable", () => {
    // arrange
    const compiledGlob = compileBashGlob("npm test *");
    const matchingSubcommand = "npm test unit";
    const differentSubcommand = "npm run lint";

    // act
    const decisions = {
      matching: bashSubcommandFires(compiledGlob, matchingSubcommand, false),
      different: bashSubcommandFires(compiledGlob, differentSubcommand, false),
    };

    // assert
    assert.deepStrictEqual(decisions, { matching: true, different: false });
  });
});
