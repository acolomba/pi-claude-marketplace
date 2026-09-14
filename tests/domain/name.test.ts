import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertSafeName,
  generatedAgentName,
  generatedCommandName,
  generatedSkillName,
  generatedWorkflowName,
} from "../../extensions/pi-claude-marketplace/domain/name.ts";
import { UnsafeGeneratedNameError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { setCasePlatform } from "../platform/case-platform.ts";

describe("assertSafeName", () => {
  for (const name of ["a", "Foo.Bar_Baz-123", "acme:foo", "pi-claude-marketplace-acme-bot"]) {
    test(`accepts ${JSON.stringify(name)}`, () => {
      // arrange
      const safeName = name;
      let actualError: unknown = undefined;

      // act
      try {
        assertSafeName(safeName);
      } catch (error) {
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
      } catch (error) {
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

describe("generatedSkillName", () => {
  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme:foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme:foo" },
    { plugin: "acme", source: "acme:foo", expectedSkillName: "acme:foo" },
    { plugin: "ab", source: "abc", expectedSkillName: "ab:abc" },
    {
      plugin: "acme",
      source: "acme-acme-foo",
      expectedSkillName: "acme:acme-foo",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Task_Name",
      expectedSkillName: "Ac.Me:Task_Name",
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

  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme.foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme.foo" },
    { plugin: "acme", source: "acme.foo", expectedSkillName: "acme.foo" },
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
      expectedAgentName: "pi-claude-marketplace-acme-bot",
    },
    {
      plugin: "ab",
      source: "abc",
      expectedAgentName: "pi-claude-marketplace-ab-abc",
    },
    {
      plugin: "acme",
      source: "acme-acme-bot",
      expectedAgentName: "pi-claude-marketplace-acme-acme-bot",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Bot_v2",
      expectedAgentName: "pi-claude-marketplace-Ac.Me-Bot_v2",
    },
    {
      plugin: "acme",
      source: "acme",
      expectedAgentName: "pi-claude-marketplace-acme-acme",
    },
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
      sourceName: "acme-",
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
