import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  compilePowerShellRule,
  parsePowerShellSubcommands,
  powerShellSubcommandFires,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts";

describe("parsePowerShellSubcommands", () => {
  test("splits every unquoted compound separator in source order", () => {
    // arrange
    const command =
      "Get-Location; Get-ChildItem | Select-Object Name && Remove-Item stale || Write-Output failed\nGet-Date";
    const expectedParse = {
      ok: true,
      subcommands: [
        "Get-Location",
        "Get-ChildItem",
        "Select-Object Name",
        "Remove-Item stale",
        "Write-Output failed",
        "Get-Date",
      ],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps a bare ampersand inside its surrounding command", () => {
    // arrange
    const command = "& Start-Process app & Get-Location";
    const expectedParse = {
      ok: true,
      subcommands: ["& Start-Process app & Get-Location"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps every separator inside a single-quoted region", () => {
    // arrange
    const command = "Write-Output 'a; b | c && d || e\nf'' g'";
    const expectedParse = {
      ok: true,
      subcommands: ["Write-Output 'a; b | c && d || e\nf'' g'"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps every separator inside a double-quoted region", () => {
    // arrange
    const command = 'Write-Output "a; b | c && d || e\nf"" g"';
    const expectedParse = {
      ok: true,
      subcommands: ['Write-Output "a; b | c && d || e\nf"" g"'],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("treats a backtick inside a double-quoted region as an escape", () => {
    // arrange
    const command = 'Write-Output "a `" b; c"';
    const expectedParse = {
      ok: true,
      subcommands: ['Write-Output "a `" b; c"'],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps a backtick-escaped separator inside its surrounding command", () => {
    // arrange
    const command = "Get-ChildItem `; Get-Location `| Select-Object Name";
    const expectedParse = {
      ok: true,
      subcommands: ["Get-ChildItem `; Get-Location `| Select-Object Name"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("extracts no nested command from a backtick-delimited region", () => {
    // arrange
    const command = "Write-Output `Get-Location`";
    const expectedParse = {
      ok: true,
      subcommands: ["Write-Output `Get-Location`"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("extracts nested subexpression bodies in discovery order", () => {
    // arrange
    const command = "Write-Output $(Get-Content $(Get-Location))";
    const expectedParse = {
      ok: true,
      subcommands: [
        "Write-Output $(Get-Content $(Get-Location))",
        "Get-Content $(Get-Location)",
        "Get-Location",
      ],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("extracts a subexpression nested inside a quoted region", () => {
    // arrange
    const command = 'Write-Output "$(Get-Location)"';
    const expectedParse = {
      ok: true,
      subcommands: ['Write-Output "$(Get-Location)"', "Get-Location"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("keeps a quoted closing parenthesis inside a subexpression body", () => {
    // arrange
    const command = "Write-Output $(Write-Output ')')";
    const expectedParse = {
      ok: true,
      subcommands: ["Write-Output $(Write-Output ')')", "Write-Output ')'"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("preserves an unmatched subexpression as literal text", () => {
    // arrange
    const command = "Write-Output $(Get-Location";
    const expectedParse = {
      ok: true,
      subcommands: ["Write-Output $(Get-Location"],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("extracts seven nested subexpression levels without failing open", () => {
    // arrange
    const command = "$($($($($($($(Get-Location)))))))";
    const expectedParse = {
      ok: true,
      subcommands: [
        "$($($($($($($(Get-Location)))))))",
        "$($($($($($(Get-Location))))))",
        "$($($($($(Get-Location)))))",
        "$($($($(Get-Location))))",
        "$($($(Get-Location)))",
        "$($(Get-Location))",
        "$(Get-Location)",
        "Get-Location",
      ],
      hasInterpolation: true,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("fails open at the exact eight-level recursion cap", () => {
    // arrange
    const command = "$($($($($($($($(Get-Location))))))))";
    const expectedParse = { ok: false, reason: "max recursion depth exceeded" };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("preserves the Bash wrapper vocabulary as ordinary command heads", () => {
    // arrange
    const command = "timeout foo; time foo; nice foo; nohup foo; stdbuf foo; xargs foo";
    const expectedParse = {
      ok: true,
      subcommands: ["timeout foo", "time foo", "nice foo", "nohup foo", "stdbuf foo", "xargs foo"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("deduplicates repeated candidates without changing first-seen order", () => {
    // arrange
    const command = "Get-Location; Get-ChildItem; Get-Location | Get-ChildItem";
    const expectedParse = {
      ok: true,
      subcommands: ["Get-Location", "Get-ChildItem"],
      hasInterpolation: false,
    };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("returns no candidates for empty input", () => {
    // arrange
    const command = "";
    const expectedParse = { ok: true, subcommands: [], hasInterpolation: false };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  test("discards empty partitions between compound separators", () => {
    // arrange
    const command = " ; | && || \n ";
    const expectedParse = { ok: true, subcommands: [], hasInterpolation: false };

    // act
    const parsedCommand = parsePowerShellSubcommands(command);

    // assert
    assert.deepStrictEqual(parsedCommand, expectedParse);
  });

  for (const { form, command, hasInterpolation } of [
    { form: "$IDENT", command: "Write-Output $Branch", hasInterpolation: true },
    { form: "${BRACED}", command: "Write-Output ${Branch Name}", hasInterpolation: true },
    { form: "$env: scope", command: "Write-Output $env:PATH", hasInterpolation: true },
    { form: "a backtick escape", command: "Get-ChildItem `; foo", hasInterpolation: false },
    { form: "a lone dollar", command: "Write-Output $", hasInterpolation: false },
  ]) {
    test(`reports ${form} interpolation as ${hasInterpolation}`, () => {
      // arrange
      const expectedFlag = hasInterpolation;

      // act
      const parsedCommand = parsePowerShellSubcommands(command);

      // assert
      assert.strictEqual(parsedCommand.ok && parsedCommand.hasInterpolation, expectedFlag);
    });
  }
});

describe("compilePowerShellRule", () => {
  test("canonicalizes an alias head into the cmdlet the rule matches on", () => {
    // arrange
    const expectedMetadata = {
      raw: "Get-ChildItem *",
      tokens: [{ kind: "literal", text: "get-childitem " }, { kind: "star" }],
      trailingWordBoundary: true,
      isCommandNameOnly: true,
    };

    // act
    const compiledGlob = compilePowerShellRule("gci *");
    const metadata = {
      raw: compiledGlob.raw,
      tokens: compiledGlob.tokens,
      trailingWordBoundary: compiledGlob.trailingWordBoundary,
      isCommandNameOnly: compiledGlob.isCommandNameOnly,
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
  });

  test("keeps a head outside the alias table unchanged", () => {
    // arrange
    const expectedMetadata = {
      raw: "Get-ChildItem *",
      tokens: [{ kind: "literal", text: "get-childitem " }, { kind: "star" }],
      trailingWordBoundary: true,
      isCommandNameOnly: true,
    };

    // act
    const compiledGlob = compilePowerShellRule("Get-ChildItem *");
    const metadata = {
      raw: compiledGlob.raw,
      tokens: compiledGlob.tokens,
      trailingWordBoundary: compiledGlob.trailingWordBoundary,
      isCommandNameOnly: compiledGlob.isCommandNameOnly,
    };

    // assert
    assert.deepStrictEqual(metadata, expectedMetadata);
  });
});

describe("powerShellSubcommandFires", () => {
  test("fires a cmdlet rule on every alias of that cmdlet", () => {
    // arrange
    const compiledGlob = compilePowerShellRule("Get-ChildItem *");
    const expectedDecisions = {
      cmdlet: true,
      gci: true,
      ls: true,
      dir: true,
      aliasWithoutArguments: true,
      differentCmdletAlias: false,
      headOutsideTheAliasTable: false,
    };

    // act
    const decisions = {
      cmdlet: powerShellSubcommandFires(compiledGlob, "Get-ChildItem foo", false),
      gci: powerShellSubcommandFires(compiledGlob, "gci foo", false),
      ls: powerShellSubcommandFires(compiledGlob, "ls foo", false),
      dir: powerShellSubcommandFires(compiledGlob, "dir foo", false),
      aliasWithoutArguments: powerShellSubcommandFires(compiledGlob, "gci", false),
      differentCmdletAlias: powerShellSubcommandFires(compiledGlob, "rm foo", false),
      headOutsideTheAliasTable: powerShellSubcommandFires(compiledGlob, "git status", false),
    };

    // assert
    assert.deepStrictEqual(decisions, expectedDecisions);
  });

  test("fires an alias rule on the command written with the cmdlet name", () => {
    // arrange
    const compiledGlob = compilePowerShellRule("gci *");
    const expectedDecisions = { cmdlet: true, sameAlias: true, differentCmdlet: false };

    // act
    const decisions = {
      cmdlet: powerShellSubcommandFires(compiledGlob, "Get-ChildItem foo", false),
      sameAlias: powerShellSubcommandFires(compiledGlob, "gci foo", false),
      differentCmdlet: powerShellSubcommandFires(compiledGlob, "Remove-Item foo", false),
    };

    // assert
    assert.deepStrictEqual(decisions, expectedDecisions);
  });

  test("fires a cmdlet rule on a single-character alias head", () => {
    // arrange
    const forEachGlob = compilePowerShellRule("ForEach-Object *");
    const whereGlob = compilePowerShellRule("Where-Object *");
    const expectedDecisions = { percent: true, question: true };

    // act
    const decisions = {
      percent: powerShellSubcommandFires(forEachGlob, "% { $_ }", false),
      question: powerShellSubcommandFires(whereGlob, "? { $_ }", false),
    };

    // assert
    assert.deepStrictEqual(decisions, expectedDecisions);
  });

  test("matches case-insensitively in both the rule and the command direction", () => {
    // arrange
    const cmdletCaseGlob = compilePowerShellRule("Get-ChildItem *");
    const lowerCaseGlob = compilePowerShellRule("get-childitem *");
    const expectedDecisions = {
      cmdletRuleOnLowerCaseCommand: true,
      lowerCaseRuleOnCmdletCommand: true,
      lowerCaseRuleOnUpperCaseAlias: true,
    };

    // act
    const decisions = {
      cmdletRuleOnLowerCaseCommand: powerShellSubcommandFires(
        cmdletCaseGlob,
        "get-childitem foo",
        false,
      ),
      lowerCaseRuleOnCmdletCommand: powerShellSubcommandFires(
        lowerCaseGlob,
        "Get-ChildItem foo",
        false,
      ),
      lowerCaseRuleOnUpperCaseAlias: powerShellSubcommandFires(lowerCaseGlob, "GCI foo", false),
    };

    // assert
    assert.deepStrictEqual(decisions, expectedDecisions);
  });

  test("applies interpolation fallback only to the promised specific glob", () => {
    // arrange
    const specificGlob = compilePowerShellRule("Remove-Item -Recurse *");
    const commandNameGlob = compilePowerShellRule("Remove-Item *");
    const subcommand = "Write-Output $Branch";

    // act
    const specificity = {
      specific: powerShellSubcommandFires(specificGlob, subcommand, true),
      commandName: powerShellSubcommandFires(commandNameGlob, subcommand, true),
    };

    // assert
    assert.deepStrictEqual(specificity, { specific: true, commandName: false });
  });
});
