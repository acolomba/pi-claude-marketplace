import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  assertSafeName,
  generatedAgentName,
  generatedCommandName,
  generatedSkillName,
} from "../../extensions/pi-claude-marketplace/domain/name.ts";

describe("assertSafeName", () => {
  for (const name of ["a", "Foo.Bar_Baz-123", "acme:foo", "pi-claude-marketplace-acme-bot"]) {
    test(`accepts ${JSON.stringify(name)}`, () => {
      // arrange
      const safeName = name;

      // act & assert
      assert.doesNotThrow(() => {
        assertSafeName(safeName);
      });
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

      // act & assert
      assert.doesNotThrow(() => {
        assertSafeName(safeName);
      });
    });

    test(`rejects ${JSON.stringify(unsafeName)}`, () => {
      // arrange
      const rejectedName = unsafeName;

      // act & assert
      assert.throws(
        () => {
          assertSafeName(rejectedName);
        },
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.constructor, Error);
          assert.strictEqual(error.message, errorMessage);
          return true;
        },
      );
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

      // act & assert
      assert.throws(
        () => {
          assertSafeName(unsafeName, label);
        },
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.constructor, Error);
          assert.strictEqual(error.message, errorMessage);
          return true;
        },
      );
    });
  }
});

describe("generatedSkillName", () => {
  for (const { plugin, source, expectedSkillName } of [
    { plugin: "acme", source: "foo", expectedSkillName: "acme-foo" },
    { plugin: "acme", source: "acme-foo", expectedSkillName: "acme-foo" },
    { plugin: "ab", source: "abc", expectedSkillName: "ab-abc" },
    {
      plugin: "acme",
      source: "acme-acme-foo",
      expectedSkillName: "acme-acme-foo",
    },
    {
      plugin: "Ac.Me",
      source: "Ac.Me-Task_Name",
      expectedSkillName: "Ac.Me-Task_Name",
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

      // act & assert
      assert.throws(
        () => generatedSkillName(plugin, source),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.constructor, Error);
          assert.strictEqual(error.message, errorMessage);
          return true;
        },
      );
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

      // act & assert
      assert.throws(
        () => generatedCommandName(plugin, source),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.constructor, Error);
          assert.strictEqual(error.message, errorMessage);
          return true;
        },
      );
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

      // act & assert
      assert.throws(
        () => generatedAgentName(plugin, source),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.strictEqual(error.constructor, Error);
          assert.strictEqual(error.message, errorMessage);
          return true;
        },
      );
    });
  }
});
