import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addedMarketplaceNameRefusal,
  assertRecordedMarketplaceName,
  assertSafeName,
  catalogMarketplaceNameRefusal,
  declaredAgentName,
  generatedAgentName,
  generatedCommandName,
  foldedMcpServerKey,
  generatedMcpServerKey,
  generatedSkillName,
  generatedWorkflowName,
  isReservedRecordKey,
  mcpServerDisplayName,
  reservedMarketplaceNameRefusal,
} from "../../extensions/pi-claude-marketplace/domain/name.ts";
import {
  ReservedMarketplaceNameError,
  UnsafeGeneratedNameError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

import type { ParsedSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";

describe("assertSafeName", () => {
  for (const name of ["a", "Foo.Bar_Baz-123", "acme:foo", "pi-claude-marketplace-acme-bot"]) {
    test(`accepts ${JSON.stringify(name)}`, () => {
      // arrange
      const safeName = name;
      let actualError: unknown = undefined;

      // act
      try {
        assertSafeName(safeName);
      } catch (error: unknown) {
        actualError = error;
      }

      // assert
      assert.strictEqual(actualError, undefined);
    });
  }

  test("rejects a non-string name", () => {
    // arrange
    const unsafeName: unknown = 42;

    // act & assert
    assert.throws(
      () => {
        // @ts-expect-error Runtime validation protects untyped callers.
        assertSafeName(unsafeName);
      },
      (error: unknown) => {
        assert.ok(error instanceof TypeError);
        assert.strictEqual(error.message, "Name must be a string (got number).");
        return true;
      },
    );
  });

  for (const { unsafeName, safeNeighbor, errorMessage } of [
    {
      unsafeName: "",
      safeNeighbor: "a",
      errorMessage: "Name must be a non-empty string.",
    },
    {
      unsafeName: " ",
      safeNeighbor: "a",
      errorMessage: "Name must be a non-empty string.",
    },
    {
      unsafeName: ".",
      safeNeighbor: ".a",
      errorMessage: 'Name must not be "." or "..".',
    },
    {
      unsafeName: "..",
      safeNeighbor: "...",
      errorMessage: 'Name must not be "." or "..".',
    },
    {
      unsafeName: "foo/bar",
      safeNeighbor: "foo-bar",
      errorMessage: 'Name "foo/bar" must not contain path separators.',
    },
    {
      unsafeName: "foo\\bar",
      safeNeighbor: "foo-bar",
      errorMessage: 'Name "foo\\bar" must not contain path separators.',
    },
    {
      unsafeName: "foo\tbar",
      safeNeighbor: "foo bar",
      errorMessage: 'Name "foo\tbar" must not contain ASCII control characters.',
    },
    {
      unsafeName: "foo\x00bar",
      safeNeighbor: "foo bar",
      errorMessage: 'Name "foo\x00bar" must not contain ASCII control characters.',
    },
    {
      unsafeName: "foo\x1fbar",
      safeNeighbor: "foo\x20bar",
      errorMessage: 'Name "foo\x1fbar" must not contain ASCII control characters.',
    },
    {
      unsafeName: "foo\x7fbar",
      safeNeighbor: "foo\x80bar",
      errorMessage: 'Name "foo\x7fbar" must not contain ASCII control characters.',
    },
  ]) {
    test(`accepts ${JSON.stringify(safeNeighbor)} adjacent to rejected ${JSON.stringify(unsafeName)}`, () => {
      // arrange
      const safeName = safeNeighbor;
      let actualError: unknown = undefined;

      // act
      try {
        assertSafeName(safeName);
      } catch (error: unknown) {
        actualError = error;
      }

      // assert
      assert.strictEqual(actualError, undefined);
    });

    test(`rejects ${JSON.stringify(unsafeName)}`, () => {
      // arrange
      const rejectedName = unsafeName;

      // act
      const assertNameSafety = () => {
        assertSafeName(rejectedName);
      };

      // assert
      assert.throws(assertNameSafety, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }

  for (const { name, label, errorMessage } of [
    {
      name: "../bad",
      label: "skill name",
      errorMessage: 'skill name "../bad" must not contain path separators.',
    },
    {
      name: "",
      label: "generated command name",
      errorMessage: "generated command name must be a non-empty string.",
    },
    {
      name: "foo\tbar",
      label: "agent name",
      errorMessage: 'agent name "foo\tbar" must not contain ASCII control characters.',
    },
  ]) {
    test(`uses the ${JSON.stringify(label)} error label`, () => {
      // arrange
      const unsafeName = name;

      // act
      const assertNameSafety = () => {
        assertSafeName(unsafeName, label);
      };

      // assert
      assert.throws(assertNameSafety, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});

describe("isReservedRecordKey", () => {
  test("D-08-07: reserves __proto__", () => {
    // arrange
    const name = "__proto__";

    // act
    const reserved = isReservedRecordKey(name);

    // assert
    assert.strictEqual(reserved, true);
  });

  for (const name of [
    ...Object.getOwnPropertyNames(Object.prototype).filter((member) => member !== "__proto__"),
    "tools",
  ]) {
    test(`D-08-07: leaves ${JSON.stringify(name)} a valid name`, () => {
      // arrange
      const recordKey = name;

      // act
      const reserved = isReservedRecordKey(recordKey);

      // assert
      assert.strictEqual(reserved, false);
    });
  }
});

const pathMarketplaceSource = {
  kind: "path",
  raw: "./tools",
  logical: "./tools",
} as const satisfies ParsedSource;

const ORGANIZATION_REFUSAL = (name: string): string =>
  `The name '${name}' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.`;

const GITHUB_REFUSAL = (name: string): string =>
  `The name '${name}' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name.`;

const IMPERSONATION_REFUSAL =
  "Marketplace name impersonates an official Anthropic/Claude marketplace";

const NEW_ADD = { repairedName: undefined, recorded: false } as const;

const anthropicsSource = (repo: string): ParsedSource => ({
  kind: "github",
  raw: `anthropics/${repo}`,
  owner: "anthropics",
  repo,
});

describe("reservedMarketplaceNameRefusal", () => {
  for (const name of [
    "claude-code-marketplace",
    "claude-code-plugins",
    "claude-plugins-official",
    "anthropic-marketplace",
    "anthropic-plugins",
    "agent-skills",
    "anthropic-agent-skills",
    "life-sciences",
    "knowledge-work-plugins",
    "claude-for-legal",
    "claude-for-financial-services",
    "financial-services-plugins",
    "first-party-plugins",
    "claude-tag-plugins",
    "claude-community",
    "claude-plugins-community",
    "healthcare",
    "anthropic-plugin-directory",
    "claude-plugin-directory",
  ]) {
    test(`MKT-01: refuses ${name} from a path source`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = reservedMarketplaceNameRefusal(declaredName, pathMarketplaceSource);

      // assert
      assert.strictEqual(refusal, ORGANIZATION_REFUSAL(name));
    });
  }

  test("MKT-01: refuses a reserved name in another case and echoes its declared spelling", () => {
    // arrange
    const declaredName = "Claude-Plugins-Official";

    // act
    const refusal = reservedMarketplaceNameRefusal(declaredName, pathMarketplaceSource);

    // assert
    assert.strictEqual(
      refusal,
      "The name 'Claude-Plugins-Official' is reserved for official Anthropic marketplaces and can only be used with GitHub sources from the 'anthropics' organization.",
    );
  });

  for (const owner of ["anthropics", "Anthropics"]) {
    test(`MKT-01: lets the github owner ${owner} use a reserved name`, () => {
      // arrange
      const source = {
        kind: "github",
        raw: `${owner}/claude-plugins-official`,
        owner,
        repo: "claude-plugins-official",
      } satisfies ParsedSource;

      // act
      const refusal = reservedMarketplaceNameRefusal("claude-plugins-official", source);

      // assert
      assert.strictEqual(refusal, undefined);
    });
  }

  for (const source of [
    { kind: "github", raw: "acme/tools", owner: "acme", repo: "tools" },
    {
      kind: "url",
      raw: "https://git.example.com/anthropics/tools.git",
      url: "https://git.example.com/anthropics/tools",
    },
  ] satisfies ParsedSource[]) {
    test(`MKT-01: refuses a reserved name from the ${source.kind} source ${source.raw} with the github sentence`, () => {
      // arrange
      const declaredName = "healthcare";

      // act
      const refusal = reservedMarketplaceNameRefusal(declaredName, source);

      // assert
      assert.strictEqual(refusal, GITHUB_REFUSAL("healthcare"));
    });
  }

  test("MKT-01: leaves a name outside the reserved set to any source", () => {
    // arrange
    const declaredName = "claude-plugins-officialx";

    // act
    const refusal = reservedMarketplaceNameRefusal(declaredName, pathMarketplaceSource);

    // assert
    assert.strictEqual(refusal, undefined);
  });
});

describe("addedMarketplaceNameRefusal", () => {
  for (const name of [
    "official-claude-plugins",
    "claude-plugins-v2",
    "unofficial-claude-tools",
    "claudeplugins",
    "claude-directory",
    "anthropic-directories",
    "claude-market-place",
    "_claude-plugins",
    "offi-cial-claude",
    "café",
    "acme\ttools",
  ]) {
    test(`D-PL5-28: refuses the look-alike ${JSON.stringify(name)} from a path source`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
    });
  }

  for (const name of [
    "claude-code-plugins-extra",
    "my-claude-tools",
    "acme-tools",
    "claude_code_plugins",
  ]) {
    test(`D-PL5-28: accepts ${name}, which is no look-alike`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(refusal, undefined);
    });
  }

  test("D-PL5-28: accepts a soft look-alike that keeps the name of the record it repairs", () => {
    // arrange
    const registration = { repairedName: "Claude-Directory", recorded: true };

    // act
    const refusal = addedMarketplaceNameRefusal(
      "claude-directory",
      pathMarketplaceSource,
      registration,
    );

    // assert
    assert.strictEqual(refusal, undefined);
  });

  test("D-PL5-28: refuses a strong look-alike that keeps the name of the record it repairs", () => {
    // arrange
    const registration = { repairedName: "claude-plugins-v2", recorded: true };

    // act
    const refusal = addedMarketplaceNameRefusal(
      "claude-plugins-v2",
      pathMarketplaceSource,
      registration,
    );

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });

  test("D-PL5-28: refuses a soft look-alike that renames the record it repairs", () => {
    // arrange
    const registration = { repairedName: "tools", recorded: false };

    // act
    const refusal = addedMarketplaceNameRefusal(
      "claude-directory",
      pathMarketplaceSource,
      registration,
    );

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });

  for (const { name, refusal: expectedRefusal } of [
    {
      name: "Inline",
      refusal: 'Marketplace name "inline" is reserved for --plugin-dir session plugins',
    },
    { name: "BuiltIn", refusal: 'Marketplace name "builtin" is reserved for built-in plugins' },
    {
      name: "Skills-Dir",
      refusal:
        'Marketplace name "skills-dir" is reserved for plugins auto-loaded from .claude/skills/',
    },
    {
      name: "SYNCED",
      refusal:
        'Marketplace name "synced" is reserved for plugins synced from your claude.ai account',
    },
    {
      name: "Claude-Plugin-Test",
      refusal:
        'Marketplace name "claude-plugin-test" is reserved for plugins loaded by claude plugin test',
    },
    {
      name: "NPM",
      refusal:
        'Marketplace name "npm" is reserved for plugins installed from an npm registry (`<package>@npm`); remove this marketplace and add it again under another name',
    },
    {
      name: "Pip",
      refusal:
        'Marketplace name "pip" is reserved for plugins installed from a Python package index (reserved; not yet available)',
    },
    {
      name: "uV",
      refusal:
        'Marketplace name "uv" is reserved for plugins installed from a Python package index through uv (reserved; not yet available)',
    },
    {
      name: "Cargo",
      refusal:
        'Marketplace name "cargo" is reserved for plugins installed from a Rust crate registry (reserved; not yet available)',
    },
    {
      name: "GitHub",
      refusal:
        'Marketplace name "github" is reserved for plugins installed straight from a GitHub repository (`<owner>/<repo>@github`; reserved; not yet available)',
    },
    {
      name: "GH",
      refusal:
        'Marketplace name "gh" is reserved for plugins installed straight from a GitHub repository (reserved; not yet available)',
    },
  ]) {
    test(`D-PL5-28: refuses Claude Code's own name ${name} in any case`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  test("D-PL5-28: accepts Constructor, which is neither an own name nor an object member", () => {
    // arrange
    const declaredName = "Constructor";

    // act
    const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

    // assert
    assert.strictEqual(refusal, undefined);
  });

  test("MKT-01 / D-PL5-28: refuses a reserved name from a path source with the organization sentence", () => {
    // arrange
    const declaredName = "claude-plugins-official";

    // act
    const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

    // assert
    assert.strictEqual(refusal, ORGANIZATION_REFUSAL("claude-plugins-official"));
  });

  test("MKT-01 / D-PL5-28: lets the anthropics organization use a reserved name", () => {
    // arrange
    const source = anthropicsSource("claude-plugins-official");

    // act
    const refusal = addedMarketplaceNameRefusal("claude-plugins-official", source, NEW_ADD);

    // assert
    assert.strictEqual(refusal, undefined);
  });

  test("D-PL5-28: refuses a look-alike from the anthropics organization", () => {
    // arrange
    const source = anthropicsSource("claude-plugins-v2");

    // act
    const refusal = addedMarketplaceNameRefusal("claude-plugins-v2", source, NEW_ADD);

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });

  for (const name of ["claudeai-tools", "ClaudeAI.tools", "claudeai tools", "claudeai-x."]) {
    test(`D-PL5-28: refuses ${JSON.stringify(name)}, which starts with claudeai-`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(
        refusal,
        `Cannot add marketplace ${JSON.stringify(name)}: names starting with "claudeai-" are reserved for marketplaces hosted on claude.ai.`,
      );
    });
  }

  for (const name of ["claudeai_tools", "my-claudeai-tools"]) {
    test(`D-PL5-28: accepts ${name}, which does not start with claudeai-`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(refusal, undefined);
    });
  }

  for (const { name, reserved } of [
    { name: "claude.code.plugins", reserved: "claude-code-plugins" },
    { name: "healthcare.", reserved: "healthcare" },
    { name: "Agent.Skills", reserved: "agent-skills" },
    { name: "life.sciences", reserved: "life-sciences" },
  ]) {
    test(`D-PL5-28: refuses ${name} as another spelling of ${reserved}`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(
        refusal,
        `"${name}" is another spelling of "${reserved}", a reserved marketplace name.`,
      );
    });
  }

  test("D-PL5-28: refuses another spelling that is not a plain word without naming it", () => {
    // arrange
    const declaredName = "claude code plugins";

    // act
    const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

    // assert
    assert.strictEqual(
      refusal,
      `This marketplace's name is another spelling of "claude-code-plugins", a reserved marketplace name. It is not exactly the reserved name it appears to be.`,
    );
  });

  for (const name of ["claude.plugin.directory", "anthropic.plugin.directory"]) {
    test(`D-PL5-28: refuses ${name}, a spelling of a plugin directory name`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(refusal, `"${name}" is a reserved marketplace name.`);
    });
  }

  for (const name of ["anthropic-plugin-directory", "Anthropic-Plugin-Directory"]) {
    test(`D-PL5-28: lets the anthropics organization add ${name}`, () => {
      // arrange
      const source = anthropicsSource("anthropic-plugin-directory");

      // act
      const refusal = addedMarketplaceNameRefusal(name, source, NEW_ADD);

      // assert
      assert.strictEqual(refusal, undefined);
    });
  }

  for (const name of ["constructor", "toString", "hasOwnProperty", "__defineGetter__"]) {
    test(`D-PL5-28: refuses the object member ${name}`, () => {
      // arrange
      const declaredName = name;

      // act
      const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

      // assert
      assert.strictEqual(
        refusal,
        `Cannot add marketplace "${name}": Claude Code reserves this name and cannot register a marketplace under it. The name is set by "name" in the marketplace's marketplace.json; ask its maintainer to change it.`,
      );
    });

    test(`D-PL5-28: accepts the object member ${name} when the scope already records it`, () => {
      // arrange
      const registration = { repairedName: undefined, recorded: true };

      // act
      const refusal = addedMarketplaceNameRefusal(name, pathMarketplaceSource, registration);

      // assert
      assert.strictEqual(refusal, undefined);
    });
  }

  test("D-PL5-28: refuses a look-alike spelling of a reserved name as a look-alike", () => {
    // arrange
    const declaredName = "claude-plugins-official.";

    // act
    const refusal = addedMarketplaceNameRefusal(declaredName, pathMarketplaceSource, NEW_ADD);

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });
});

describe("catalogMarketplaceNameRefusal", () => {
  test("D-PL5-28: accepts a soft look-alike that keeps the registered name", () => {
    // act
    const refusal = catalogMarketplaceNameRefusal("Claude-Directory", "claude-directory");

    // assert
    assert.strictEqual(refusal, undefined);
  });

  test("D-PL5-28: refuses a strong look-alike that keeps the registered name", () => {
    // act
    const refusal = catalogMarketplaceNameRefusal("claude-plugins-v2", "claude-plugins-v2");

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });

  test("D-PL5-28: refuses a soft look-alike that renames the registered marketplace", () => {
    // act
    const refusal = catalogMarketplaceNameRefusal("anthropic-directories", "claude-directory");

    // assert
    assert.strictEqual(refusal, IMPERSONATION_REFUSAL);
  });

  test("D-PL5-28: refuses one of Claude Code's own names even when the registered name keeps it", () => {
    // act
    const refusal = catalogMarketplaceNameRefusal("Cargo", "cargo");

    // assert
    assert.strictEqual(
      refusal,
      'Marketplace name "cargo" is reserved for plugins installed from a Rust crate registry (reserved; not yet available)',
    );
  });

  test("D-PL5-28: accepts a name that is neither a look-alike nor an own name", () => {
    // act
    const refusal = catalogMarketplaceNameRefusal("acme-tools", "tools");

    // assert
    assert.strictEqual(refusal, undefined);
  });
});

describe("assertRecordedMarketplaceName", () => {
  for (const { source, reserved } of [
    { source: pathMarketplaceSource, reserved: ORGANIZATION_REFUSAL("claude-plugins-official") },
    {
      source: {
        kind: "github",
        raw: "acme/claude-plugins-official",
        owner: "acme",
        repo: "claude-plugins-official",
      },
      reserved: GITHUB_REFUSAL("claude-plugins-official"),
    },
  ] satisfies { source: ParsedSource; reserved: string }[]) {
    test(`D-PL5-28: refuses claude-plugins-official recorded from the ${source.kind} source ${source.raw}`, () => {
      // act & assert
      assert.throws(
        () => {
          assertRecordedMarketplaceName("claude-plugins-official", source);
        },
        (error: unknown) => {
          assert.ok(error instanceof ReservedMarketplaceNameError);
          assert.strictEqual(
            error.message,
            `Marketplace "claude-plugins-official" is registered from an untrusted source: ${reserved} To fix it, remove the marketplace and re-add it from the official source.`,
          );
          return true;
        },
      );
    });
  }

  test("D-PL5-28: refuses a record named as another spelling of a reserved name", () => {
    // act & assert
    assert.throws(
      () => {
        assertRecordedMarketplaceName("claude.code.plugins", pathMarketplaceSource);
      },
      (error: unknown) => {
        assert.ok(error instanceof ReservedMarketplaceNameError);
        assert.strictEqual(
          error.message,
          '"claude.code.plugins" is another spelling of "claude-code-plugins", a reserved marketplace name.',
        );
        return true;
      },
    );
  });

  for (const name of ["claude-plugins-official", "anthropic-plugin-directory"]) {
    test(`D-PL5-28: accepts ${name} recorded from the anthropics organization`, () => {
      // act & assert
      assert.doesNotThrow(() => {
        assertRecordedMarketplaceName(name, anthropicsSource(name));
      });
    });
  }

  test("D-PL5-28: refuses a catalog that declares a strong look-alike for the record tools", () => {
    // act & assert
    assert.throws(
      () => {
        assertRecordedMarketplaceName("tools", pathMarketplaceSource, "claude-plugins-v2");
      },
      (error: unknown) => {
        assert.ok(error instanceof ReservedMarketplaceNameError);
        assert.strictEqual(
          error.message,
          `Claude Code refuses the marketplace name "tools": it looks like one of Anthropic's own`,
        );
        return true;
      },
    );
  });

  test("D-PL5-28: refuses a look-alike record without naming a record name outside printable ASCII", () => {
    // act & assert
    assert.throws(
      () => {
        assertRecordedMarketplaceName("café", pathMarketplaceSource, "café");
      },
      (error: unknown) => {
        assert.ok(error instanceof ReservedMarketplaceNameError);
        assert.strictEqual(
          error.message,
          "Claude Code refuses this marketplace's name: it looks like one of Anthropic's own.",
        );
        return true;
      },
    );
  });

  test("D-PL5-28: refuses a catalog that declares one of Claude Code's own names", () => {
    // act & assert
    assert.throws(
      () => {
        assertRecordedMarketplaceName("tools", pathMarketplaceSource, "gh");
      },
      (error: unknown) => {
        assert.ok(error instanceof ReservedMarketplaceNameError);
        assert.strictEqual(
          error.message,
          'Marketplace name "gh" is reserved for plugins installed straight from a GitHub repository (reserved; not yet available)',
        );
        return true;
      },
    );
  });

  test("D-PL5-28: accepts a soft look-alike record whose catalog keeps its name", () => {
    // act & assert
    assert.doesNotThrow(() => {
      assertRecordedMarketplaceName("claude-directory", pathMarketplaceSource, "claude-directory");
    });
  });
});

describe("generatedSkillName", () => {
  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme:foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme.foo", expectedSkillName: "acme-foo" },
    { plugin: "ab", source: "abc", expectedSkillName: "ab-abc" },
    {
      plugin: "acme",
      source: "acme-acme-foo",
      expectedSkillName: "acme-acme-foo",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Task_Name",
      expectedSkillName: "ac-me-task-name",
    },
    { plugin: "foo", source: "foo", expectedSkillName: "foo" },
  ]) {
    test(`generates ${JSON.stringify(expectedSkillName)} from ${JSON.stringify(source)}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const skillName = generatedSkillName(pluginName, sourceName);

      // assert
      assert.strictEqual(skillName, expectedSkillName);
    });
  }

  test("caps long names with a stable suffix that distinguishes sources", () => {
    // arrange
    const firstSource = `review-${"a".repeat(80)}`;
    const secondSource = `review-${"a".repeat(79)}b`;

    // act
    const first = generatedSkillName("acme", firstSource);
    const repeated = generatedSkillName("acme", firstSource);
    const second = generatedSkillName("acme", secondSource);

    // assert
    assert.match(first, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.strictEqual(first.length, 64);
    assert.strictEqual(first, repeated);
    assert.notStrictEqual(first, second);
  });

  test("gives non-ASCII and punctuation-only sources a stable valid name", () => {
    // arrange
    const source = "___";

    // act
    const generated = generatedSkillName("acme", source);

    // assert
    assert.match(generated, /^acme-name-[a-f0-9]{8}$/);
    assert.strictEqual(generated, generatedSkillName("acme", source));
    assert.notStrictEqual(generated, generatedSkillName("acme", "é"));
  });

  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme.foo", expectedSkillName: "acme-foo" },
  ]) {
    test(`generates ${JSON.stringify(expectedSkillName)} from ${JSON.stringify(source)} on win32`, (t) => {
      // arrange
      setCasePlatform(t, "win32");
      const pluginName = plugin;
      const sourceName = source;

      // act
      const skillName = generatedSkillName(pluginName, sourceName);

      // assert
      assert.strictEqual(skillName, expectedSkillName);
    });
  }

  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "ac/me",
      sourceName: "foo",
      errorMessage: 'Name "ac/me" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "foo/bar",
      errorMessage: 'Name "foo/bar" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "acme-",
      errorMessage: "Name must be a non-empty string.",
    },
  ]) {
    test(`rejects plugin ${JSON.stringify(pluginName)} and source ${JSON.stringify(sourceName)}`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const generateSkillName = () => generatedSkillName(plugin, source);

      // assert
      assert.throws(generateSkillName, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});

describe("generatedCommandName", () => {
  for (const { plugin, source, expectedCommandName } of [
    { plugin: "acme", source: "foo", expectedCommandName: "acme:foo" },
    { plugin: "acme", source: "acme-foo", expectedCommandName: "acme:foo" },
    { plugin: "ab", source: "abc", expectedCommandName: "ab:abc" },
    {
      plugin: "acme",
      source: "acme-acme-foo",
      expectedCommandName: "acme:acme-foo",
    },
    {
      plugin: "acme",
      source: "build/web",
      expectedCommandName: "acme:build:web",
    },
    {
      plugin: "acme",
      source: "build/web/prod",
      expectedCommandName: "acme:build:web:prod",
    },
    {
      plugin: "acme",
      source: "acme-build/web",
      expectedCommandName: "acme:build:web",
    },
    {
      plugin: "acme",
      source: "build/acme-web",
      expectedCommandName: "acme:build:acme-web",
    },
    {
      plugin: "acme",
      source: "acme-tools/lint",
      expectedCommandName: "acme:tools:lint",
    },
    {
      plugin: "acme",
      source: "acme-",
      expectedCommandName: "acme:acme-",
    },
    {
      plugin: "acme",
      source: "acme-/lint",
      expectedCommandName: "acme:acme-:lint",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Build_v2/Web.Cmd",
      expectedCommandName: "Ac.Me:Build_v2:Web.Cmd",
    },
  ]) {
    test(`generates ${JSON.stringify(expectedCommandName)} from ${JSON.stringify(source)}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const commandName = generatedCommandName(pluginName, sourceName);

      // assert
      assert.strictEqual(commandName, expectedCommandName);
    });
  }

  for (const { plugin, source, expectedCommandName } of [
    { plugin: "acme", source: "foo", expectedCommandName: "acme.foo" },
    { plugin: "acme", source: "acme-foo", expectedCommandName: "acme.foo" },
    {
      plugin: "acme",
      source: "build/web",
      expectedCommandName: "acme.build.web",
    },
    {
      plugin: "acme",
      source: "acme-tools/lint",
      expectedCommandName: "acme.tools.lint",
    },
    {
      plugin: "acme",
      source: "acme-",
      expectedCommandName: "acme.acme-",
    },
  ]) {
    test(`generates ${JSON.stringify(expectedCommandName)} from ${JSON.stringify(source)} on win32`, (t) => {
      // arrange
      setCasePlatform(t, "win32");
      const pluginName = plugin;
      const sourceName = source;

      // act
      const commandName = generatedCommandName(pluginName, sourceName);

      // assert
      assert.strictEqual(commandName, expectedCommandName);
    });
  }

  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "ac/me",
      sourceName: "foo",
      errorMessage: 'Name "ac/me" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "",
      errorMessage: 'command path segment in "" must be a non-empty string.',
    },
    {
      pluginName: "acme",
      sourceName: "build//web",
      errorMessage: 'command path segment in "build//web" must be a non-empty string.',
    },
    {
      pluginName: "acme",
      sourceName: "build\\web",
      errorMessage:
        'command path segment in "build\\web" "build\\web" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "acme-.",
      errorMessage: 'elided command path head in "acme-." must not be "." or "..".',
    },
  ]) {
    test(`rejects plugin ${JSON.stringify(pluginName)} and source ${JSON.stringify(sourceName)}`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const generateCommandName = () => generatedCommandName(plugin, source);

      // assert
      assert.throws(generateCommandName, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});

describe("generatedAgentName", () => {
  for (const { plugin, source, expectedAgentName } of [
    {
      plugin: "acme",
      source: "bot",
      expectedAgentName: "pi-claude-marketplace-acme-bot",
    },
    {
      plugin: "acme",
      source: "acme-bot",
      expectedAgentName: "pi-claude-marketplace-acme-acme-bot",
    },
    {
      plugin: "ab",
      source: "abc",
      expectedAgentName: "pi-claude-marketplace-ab-abc",
    },
    {
      plugin: "acme",
      source: "acme-acme-bot",
      expectedAgentName: "pi-claude-marketplace-acme-acme-acme-bot",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Bot_v2",
      expectedAgentName: "pi-claude-marketplace-Ac.Me-Ac.Me-Bot_v2",
    },
    {
      plugin: "acme",
      source: "acme",
      expectedAgentName: "pi-claude-marketplace-acme-acme",
    },
    { plugin: "acme", source: "acme-", expectedAgentName: "pi-claude-marketplace-acme-acme-" },
  ]) {
    test(`generates ${JSON.stringify(expectedAgentName)} from ${JSON.stringify(source)}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const agentName = generatedAgentName(pluginName, sourceName);

      // assert
      assert.strictEqual(agentName, expectedAgentName);
    });
  }

  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "ac/me",
      sourceName: "bot",
      errorMessage: 'Name "ac/me" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "bot/worker",
      errorMessage: 'Name "bot/worker" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "",
      errorMessage: "Name must be a non-empty string.",
    },
  ]) {
    test(`rejects plugin ${JSON.stringify(pluginName)} and source ${JSON.stringify(sourceName)}`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const generateAgentName = () => generatedAgentName(plugin, source);

      // assert
      assert.throws(generateAgentName, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});

describe("declaredAgentName", () => {
  for (const { plugin, source, expectedDeclaredName } of [
    { plugin: "acme", source: "bot", expectedDeclaredName: "acme:bot" },
    // No elision, matching generatedAgentName: with it, plugin acme's `bot`
    // and `acme-bot` would both declare `acme:bot` and collide.
    { plugin: "acme", source: "acme-bot", expectedDeclaredName: "acme:acme-bot" },
    { plugin: "ab", source: "abc", expectedDeclaredName: "ab:abc" },
    { plugin: "acme", source: "acme", expectedDeclaredName: "acme:acme" },
    { plugin: "Ac.Me", source: "Ac.Me-Bot_v2", expectedDeclaredName: "Ac.Me:Ac.Me-Bot_v2" },
  ]) {
    test(`declares ${plugin} + ${source} as ${expectedDeclaredName}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const declaredName = declaredAgentName(pluginName, sourceName);

      // assert
      assert.strictEqual(declaredName, expectedDeclaredName);
    });
  }

  test("separates with a colon on every platform, unlike command and skill names", () => {
    // arrange
    // Those names become filenames, so they take a dot on Windows. This one
    // is frontmatter only, and a dot here would miss the `<plugin>:<agent>`
    // agentType a bridged workflow script names.
    const plugin = "code-modernization";
    const source = "security-auditor";

    // act
    const declaredName = declaredAgentName(plugin, source);

    // assert
    assert.strictEqual(declaredName, "code-modernization:security-auditor");
    assert.ok(!declaredName.includes("."));
  });

  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "acme",
      sourceName: "..",
      errorMessage: 'Name must not be "." or "..".',
    },
    {
      pluginName: "acme",
      sourceName: "a/b",
      errorMessage: 'Name "a/b" must not contain path separators.',
    },
  ]) {
    test(`rejects ${sourceName} with the shared name rules`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const declareAgentName = () => declaredAgentName(plugin, source);

      // assert
      assert.throws(declareAgentName, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.constructor, Error);
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});

describe("generatedMcpServerKey", () => {
  for (const { plugin, server, expectedKey } of [
    { plugin: "acme", server: "db", expectedKey: "plugin_acme_db_" },
    {
      plugin: "my-plugin",
      server: "database-tools",
      expectedKey: "plugin_my-plugin_database-tools_",
    },
    { plugin: "acme", server: "my.api", expectedKey: "plugin_acme_my_api_" },
    { plugin: "acme", server: "a.b:c d/e", expectedKey: "plugin_acme_a_b_c_d_e_" },
    // Claude Code replaces UTF-16 code units, so the astral emoji's surrogate
    // pair becomes two underscores.
    { plugin: "acme", server: "a😀b", expectedKey: "plugin_acme_a__b_" },
    { plugin: "acme", server: "", expectedKey: "plugin_acme__" },
  ]) {
    test(`ANAME-01: keys ${plugin} + ${JSON.stringify(server)} as ${expectedKey}`, () => {
      // arrange
      const pluginName = plugin;
      const serverName = server;

      // act
      const serverKey = generatedMcpServerKey(pluginName, serverName);

      // assert
      assert.strictEqual(serverKey, expectedKey);
    });
  }

  test("ANAME-01: rejects an unsafe plugin name with the shared name rules", () => {
    // arrange
    const plugin = "a/b";
    const server = "db";

    // act
    const generateServerKey = () => generatedMcpServerKey(plugin, server);

    // assert
    assert.throws(generateServerKey, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.constructor, Error);
      assert.strictEqual(error.message, 'Name "a/b" must not contain path separators.');
      return true;
    });
  });
});

describe("mcpServerDisplayName", () => {
  for (const { plugin, server, expectedName } of [
    { plugin: "acme", server: "my.api", expectedName: "plugin:acme:my.api" },
    { plugin: "my-plugin", server: "a.b:c d/e", expectedName: "plugin:my-plugin:a.b:c d/e" },
  ]) {
    test(`ANAME-01: shows ${plugin} + ${JSON.stringify(server)} as ${expectedName}`, () => {
      // arrange
      const pluginName = plugin;
      const serverName = server;

      // act
      const displayName = mcpServerDisplayName(pluginName, serverName);

      // assert
      assert.strictEqual(displayName, expectedName);
    });
  }
});

describe("foldedMcpServerKey", () => {
  for (const { key, foldedKey } of [
    { key: "plugin_my-tools_db-1_", foldedKey: "plugin_my_tools_db_1_" },
    { key: "plugin_acme_db_", foldedKey: "plugin_acme_db_" },
  ]) {
    test(`ANAME-03: folds ${key} to ${foldedKey}`, () => {
      // arrange
      const serverKey = key;

      // act
      const folded = foldedMcpServerKey(serverKey);

      // assert
      assert.strictEqual(folded, foldedKey);
    });
  }
});

describe("generatedWorkflowName", () => {
  for (const { plugin, source, expectedWorkflowName } of [
    { plugin: "acme", source: "audit", expectedWorkflowName: "acme:audit" },
    { plugin: "acme", source: "acme-audit", expectedWorkflowName: "acme:audit" },
    { plugin: "ab", source: "abc", expectedWorkflowName: "ab:abc" },
    { plugin: "foo", source: "foo", expectedWorkflowName: "foo:foo" },
    { plugin: "acme", source: "a.b", expectedWorkflowName: "acme:a.b" },
    // The engine judges the WHOLE saved name, and its own `isSafeSavedWorkflowName`
    // rejects a name that IS "." or ".." rather than one that ends in it. Refusing
    // these would be a gate stricter than the engine, which is the one direction
    // that does not self-correct when a later engine relaxes a rule.
    { plugin: "acme", source: ".", expectedWorkflowName: "acme:." },
    { plugin: "acme", source: "..", expectedWorkflowName: "acme:.." },
    // D-141-02: the elision would empty the head, so it does not fire and the
    // source stands verbatim. The bare "acme:" is never produced.
    { plugin: "acme", source: "acme-", expectedWorkflowName: "acme:acme-" },
    // A WELL-FORMED astral character is one code point, not a surrogate, so the
    // \p{Cs} screen below must not touch it. Written as a code-point escape
    // (U+1F680 ROCKET) rather than pasted.
    { plugin: "acme", source: "ship\u{1F680}", expectedWorkflowName: "acme:ship\u{1F680}" },
  ]) {
    test(`generates ${JSON.stringify(expectedWorkflowName)} from ${JSON.stringify(source)}`, () => {
      // arrange
      const pluginName = plugin;
      const sourceName = source;

      // act
      const workflowName = generatedWorkflowName(pluginName, sourceName);

      // assert
      assert.strictEqual(workflowName, expectedWorkflowName);
    });
  }

  test("accepts a joined name of exactly 128 code units", () => {
    // arrange
    // "acme:" is 5 code units, so a 123-unit source lands the join on the ceiling.
    const plugin = "acme";
    const source = "x".repeat(123);

    // act
    const workflowName = generatedWorkflowName(plugin, source);

    // assert
    assert.strictEqual(workflowName, `acme:${"x".repeat(123)}`);
    assert.strictEqual(workflowName.length, 128);
  });

  test("rejects a joined name of 129 code units", () => {
    // arrange
    const plugin = "acme";
    const source = "x".repeat(124);
    const attemptedName = `acme:${"x".repeat(124)}`;
    const errorMessage = `Generated workflow name "${attemptedName}" must be at most 128 characters (got 129).`;

    // act
    const generateWorkflowName = () => generatedWorkflowName(plugin, source);

    // assert
    assert.throws(generateWorkflowName, (error: unknown) => {
      assert.ok(error instanceof UnsafeGeneratedNameError);
      assert.strictEqual(error.message, errorMessage);
      assert.strictEqual(error.attemptedName, attemptedName);
      return true;
    });
  });

  test("throws a bare Error for an unsafe PLUGIN name, which no one file causes", () => {
    // arrange
    // The plugin check sits outside the typed-error conversion on purpose: it
    // disqualifies every script in the plugin at once, so `workflow-script.ts`
    // must let it escape rather than refuse one arbitrary file for it.
    const plugin = "ac/me";
    const source = "audit";

    // act
    const generateWorkflowName = () => generatedWorkflowName(plugin, source);

    // assert
    assert.throws(generateWorkflowName, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.constructor, Error);
      assert.ok(!(error instanceof UnsafeGeneratedNameError));
      assert.strictEqual(error.message, 'Name "ac/me" must not contain path separators.');
      return true;
    });
  });

  for (const { pluginName, sourceName, errorMessage } of [
    {
      pluginName: "acme",
      sourceName: "",
      errorMessage: "Workflow name must be a non-empty string.",
    },
    {
      pluginName: "acme",
      sourceName: "   ",
      errorMessage: "Workflow name must be a non-empty string.",
    },
    {
      // A separator is the one part-level defect the join cannot fix, and
      // `assertSafeName` sees it in the joined name rather than in the part.
      pluginName: "acme",
      sourceName: "reports/weekly",
      errorMessage: 'Name "acme:reports/weekly" must not contain path separators.',
    },
    {
      pluginName: "acme",
      sourceName: "trail ",
      errorMessage:
        'Generated workflow name "acme:trail " must not have leading or trailing whitespace.',
    },
    {
      pluginName: "acme",
      sourceName: "my name",
      errorMessage:
        'Generated workflow name "acme:my name" must not contain whitespace, path separators, or NUL.',
    },
    {
      // A leading space in the source survives the join: "acme: lead" has no
      // leading or trailing whitespace of its own, so the trim rule cannot see it.
      pluginName: "acme",
      sourceName: " lead",
      errorMessage:
        'Generated workflow name "acme: lead" must not contain whitespace, path separators, or NUL.',
    },
    {
      // U+200B ZERO WIDTH SPACE, a format character written as an escape because
      // it is invisible in source.
      pluginName: "acme",
      sourceName: "zw\u200Bsp",
      errorMessage:
        'Generated workflow name "acme:zw\u200Bsp" must not contain control or format characters.',
    },
    {
      // U+202E RIGHT-TO-LEFT OVERRIDE, a bidi control and also a format
      // character: it reverses how the rest of the name renders.
      pluginName: "acme",
      sourceName: "bidi\u202Ex",
      errorMessage:
        'Generated workflow name "acme:bidi\u202Ex" must not contain control or format characters.',
    },
    {
      // A lone HIGH surrogate (U+D800), written as an escape because it is not a
      // character and cannot be pasted. The engine admits it -- its screen is
      // \p{Cc} and \p{Cf} only -- but Node writes it to a path as U+FFFD, so this
      // name and the one below would be the same file.
      pluginName: "acme",
      sourceName: "a\uD800b",
      errorMessage: 'Generated workflow name "acme:a\uD800b" must not contain unpaired surrogates.',
    },
    {
      // A lone LOW surrogate (U+DC00): distinct from the row above in memory,
      // identical to it once either becomes a file name.
      pluginName: "acme",
      sourceName: "a\uDC00b",
      errorMessage: 'Generated workflow name "acme:a\uDC00b" must not contain unpaired surrogates.',
    },
  ]) {
    test(`rejects plugin ${JSON.stringify(pluginName)} and source ${JSON.stringify(sourceName)}`, () => {
      // arrange
      const plugin = pluginName;
      const source = sourceName;

      // act
      const generateWorkflowName = () => generatedWorkflowName(plugin, source);

      // assert
      assert.throws(generateWorkflowName, (error: unknown) => {
        assert.ok(error instanceof UnsafeGeneratedNameError);
        assert.strictEqual(error.name, "UnsafeGeneratedNameError");
        assert.strictEqual(error.message, errorMessage);
        return true;
      });
    });
  }
});
