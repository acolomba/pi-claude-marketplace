import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { buildStagedCommand } from "../../../extensions/pi-claude-marketplace/bridges/commands/staged-command.ts";
import { parseFrontmatter } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import { BridgeStagingError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { StagedCommandContext } from "../../../extensions/pi-claude-marketplace/bridges/commands/staged-command.ts";
import type { DiscoveredCommand } from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";

const context = {
  pluginName: "acme",
  pluginRoot: "/plugins/acme",
  pluginDataDir: "/data/acme",
  projectDir: undefined,
  referenceNames: { skills: [], commands: [], workflows: [] },
} satisfies StagedCommandContext;

/** The record line the writer ends every staged frontmatter with, for `context`. */
const RECORD_LINE =
  '"pi-claude-marketplace": {"pluginRoot":"/plugins/acme","pluginData":"/data/acme"}\n';

async function commandWithSource(t: TestContext, source: string): Promise<DiscoveredCommand> {
  const root = await mkdtemp(path.join(tmpdir(), "staged-command-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const commandFile = path.join(root, "deploy.md");
  await writeFile(commandFile, source);
  return { sourceName: "deploy", generatedName: "acme:deploy", commandFile };
}

test("D-CF3-08 describes a command with no frontmatter by its first body line", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "Deploy the current branch to the staging environment and report the result.\n\nSecond paragraph.\n",
  );

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text:
      '---\n"description": "Deploy the current branch to the staging environment and report the result."\n' +
      RECORD_LINE +
      "---\n" +
      "Deploy the current branch to the staging environment and report the result.\n\nSecond paragraph.\n",
  });
});

test("D-CF3-08 describes a command by the first non-blank line after leading blank lines", async (t) => {
  // arrange
  const command = await commandWithSource(t, "\n\nRun after two blank lines.\n");

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text:
      '---\n"description": "Run after two blank lines."\n' +
      RECORD_LINE +
      "---\n\n\nRun after two blank lines.\n",
  });
});

test("D-CF3-08 describes a command whose body has no non-blank line as Plugin command", async (t) => {
  // arrange
  const command = await commandWithSource(t, "\n  \n");

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text: '---\n"description": "Plugin command"\n' + RECORD_LINE + "---\n\n  \n",
  });
});

test("D-CF3-08 keeps a non-empty declared description", async (t) => {
  // arrange
  const command = await commandWithSource(t, "---\ndescription: Deploys.\n---\nShip it.\n");

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text: '---\n"description": "Deploys."\n' + RECORD_LINE + "---\nShip it.\n",
  });
});

for (const { declared, frontmatter, text } of [
  {
    declared: "an empty string",
    frontmatter: 'description: ""\nmodel: sonnet\n',
    text: '---\n"description": "Ship it."\n"model": "sonnet"\n' + RECORD_LINE + "---\nShip it.\n",
  },
  {
    declared: "null",
    frontmatter: "description: null\nmodel: sonnet\n",
    text: '---\n"description": "Ship it."\n"model": "sonnet"\n' + RECORD_LINE + "---\nShip it.\n",
  },
  {
    declared: "a number",
    frontmatter: "description: 42\nmodel: sonnet\n",
    text: '---\n"description": "Ship it."\n"model": "sonnet"\n' + RECORD_LINE + "---\nShip it.\n",
  },
  {
    declared: "no key",
    frontmatter: "model: sonnet\n",
    text: '---\n"model": "sonnet"\n"description": "Ship it."\n' + RECORD_LINE + "---\nShip it.\n",
  },
]) {
  test(`D-CF3-08 replaces a description of ${declared} with the one fallback key`, async (t) => {
    // arrange
    const command = await commandWithSource(t, `---\n${frontmatter}---\nShip it.\n`);

    // act
    const staged = await buildStagedCommand(command, context);

    // assert
    assert.deepStrictEqual(staged, { text });
  });
}

test("rebuilds every value as one JSON line that Pi reads back unchanged, in source key order", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "---\n" +
      "zeta: 'a: b \"quoted\"'\n" +
      "notes: |\n  first line\n  --- not a fence\n" +
      "nested:\n  list: [1, true, null]\n  map: {k: v}\n" +
      "path: 'C:\\x\\${y}'\n" +
      "description: Values.\n" +
      "---\nBody.\n",
  );
  const expectedFrontmatter = {
    zeta: 'a: b "quoted"',
    notes: "first line\n--- not a fence\n",
    nested: { list: [1, true, null], map: { k: "v" } },
    path: "C:\\x\\${y}",
    description: "Values.",
    "pi-claude-marketplace": { pluginRoot: "/plugins/acme", pluginData: "/data/acme" },
  };

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text:
      "---\n" +
      '"zeta": "a: b \\"quoted\\""\n' +
      '"notes": "first line\\n--- not a fence\\n"\n' +
      '"nested": {"list":[1,true,null],"map":{"k":"v"}}\n' +
      '"path": "C:\\\\x\\\\${y}"\n' +
      '"description": "Values."\n' +
      RECORD_LINE +
      "---\nBody.\n",
  });
  assert.deepStrictEqual(parseFrontmatter(staged.text), {
    frontmatter: expectedFrontmatter,
    body: "Body.",
  });
});

for (const { shape, source, text } of [
  {
    shape: "a list",
    source: "---\n- a\n- b\n---\nList body.\n",
    text: '---\n"description": "List body."\n' + RECORD_LINE + "---\nList body.\n",
  },
  {
    shape: "a scalar",
    source: "---\nhello\n---\nScalar body.\n",
    text: '---\n"description": "Scalar body."\n' + RECORD_LINE + "---\nScalar body.\n",
  },
]) {
  test(`rebuilds a frontmatter that parses to ${shape} from no keys`, async (t) => {
    // arrange
    const command = await commandWithSource(t, source);

    // act
    const staged = await buildStagedCommand(command, context);

    // assert
    assert.deepStrictEqual(staged, { text });
  });
}

test("keeps the whole text as the body of a source whose opening fence never closes", async (t) => {
  // arrange
  const command = await commandWithSource(t, "---\nNo closing fence here.\n");

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text: '---\n"description": "---"\n' + RECORD_LINE + "---\n---\nNo closing fence here.\n",
  });
});

test("reads a source behind two byte-order marks the way Pi does", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "\uFEFF\uFEFF---\ndescription: Twice marked.\n---\nBody.\n",
  );

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text: '---\n"description": "Twice marked."\n' + RECORD_LINE + "---\nBody.\n",
  });
});

test("substitutes the plugin variables and rewrites references before the rebuild", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "---\ndescription: From ${CLAUDE_PLUGIN_ROOT}\n---\n" +
      "Use acme:helper with ${CLAUDE_PLUGIN_DATA} in ${CLAUDE_PROJECT_DIR}.\n",
  );

  // act
  const staged = await buildStagedCommand(command, {
    ...context,
    projectDir: "/work/project",
    referenceNames: { skills: ["acme-helper"], commands: [], workflows: [] },
  });

  // assert
  assert.deepStrictEqual(staged, {
    text:
      '---\n"description": "From /plugins/acme"\n' +
      RECORD_LINE +
      "---\n" +
      "Use /skill:acme-helper with /data/acme in /work/project.\n",
  });
});

test("T-03-02 adds the record after the substitution and the reference rewrite", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "---\ndescription: Chains.\n---\nRun acme:other from ${CLAUDE_PLUGIN_ROOT}.\n",
  );

  // act
  const staged = await buildStagedCommand(command, {
    ...context,
    pluginRoot: "/plugins/${CLAUDE_PLUGIN_DATA}",
    pluginDataDir: "/data/x acme:other",
    referenceNames: { skills: [], commands: ["acme:other"], workflows: [] },
  });

  // assert
  assert.deepStrictEqual(staged, {
    text:
      '---\n"description": "Chains."\n' +
      '"pi-claude-marketplace": {"pluginRoot":"/plugins/${CLAUDE_PLUGIN_DATA}","pluginData":"/data/x acme:other"}\n' +
      "---\nRun /acme:other from /plugins/${CLAUDE_PLUGIN_DATA}.\n",
  });
});

test("D-CF3-06 replaces an author's record key with the install-time record, last", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "---\npi-claude-marketplace: {pluginRoot: /author}\ndescription: Planted.\n---\nBody.\n",
  );

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text: '---\n"description": "Planted."\n' + RECORD_LINE + "---\nBody.\n",
  });
});

test("CMD-01 neutralizes a malformed frontmatter and describes the remaining body", async (t) => {
  // arrange
  const command = await commandWithSource(
    t,
    "---\ntitle: Deploy: the whole thing\ndescription: never reached\n---\n\nRun the deployment.\n",
  );

  // act
  const staged = await buildStagedCommand(command, context);

  // assert
  assert.deepStrictEqual(staged, {
    text:
      '---\n"description": "Run the deployment."\n' + RECORD_LINE + "---\n\nRun the deployment.\n",
    parseError:
      "Nested mappings are not allowed in compact mappings at line 1, column 8:\n\n" +
      "title: Deploy: the whole thing\n       ^\n",
  });
});

for (const { source, text } of [
  {
    source: "---\ralpha: one: two\r---\r\rLone CR body.\r",
    text: '---\n"description": "Lone CR body."\n' + RECORD_LINE + "---\n\nLone CR body.\n",
  },
  {
    source: "---\nalpha: one: two\n---\n---\nbeta: three: four\n---\nRepeated body.\n",
    text: '---\n"description": "Repeated body."\n' + RECORD_LINE + "---\nRepeated body.\n",
  },
  {
    source: "---\nalpha: one: two\n---\n---\ndescription: Kept.\n---\nKept body.\n",
    text: '---\n"description": "Kept."\n' + RECORD_LINE + "---\nKept body.\n",
  },
  {
    source: "---\nalpha: one: two\n---",
    text: '---\n"description": "Plugin command"\n' + RECORD_LINE + "---\n",
  },
]) {
  test(`CMD-01 neutralizes ${JSON.stringify(source)} to its readable remainder`, async (t) => {
    // arrange
    const command = await commandWithSource(t, source);

    // act
    const staged = await buildStagedCommand(command, context);

    // assert
    assert.deepStrictEqual(staged, {
      text,
      parseError:
        "Nested mappings are not allowed in compact mappings at line 1, column 8:\n\n" +
        "alpha: one: two\n       ^\n",
    });
  });
}

test("propagates Pi's parse error when a repeated malformed block passes the opening check", async (t) => {
  // arrange
  const remainder = "---\nbeta: three: four\n---\nPlain body.\n";
  const command = await commandWithSource(t, `---\nalpha: one: two\n---\n${remainder}`);
  let openingChecks = 0;
  t.mock.method(
    String.prototype,
    "startsWith",
    function (this: string, searchString: string, position?: number) {
      if (this === remainder && searchString === "---") {
        openingChecks += 1;
        if (openingChecks === 2) {
          return false;
        }
      }

      const start = position ?? 0;
      return this.slice(start, start + searchString.length) === searchString;
    },
  );

  // act & assert
  await assert.rejects(
    () => buildStagedCommand(command, context),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, openingChecks },
        { name: "YAMLParseError", openingChecks: 3 },
      );
      return true;
    },
  );
});

test("propagates Pi's parse error when a repeated malformed block passes the closing check", async (t) => {
  // arrange
  const remainder = "---\nbeta: three: four\n---\nPlain body.\n";
  const command = await commandWithSource(t, `---\nalpha: one: two\n---\n${remainder}`);
  let closeSearches = 0;
  t.mock.method(
    String.prototype,
    "indexOf",
    function (this: string, searchString: string, position?: number) {
      if (this === remainder && searchString === "\n---") {
        closeSearches += 1;
        if (closeSearches === 2) {
          return -1;
        }
      }

      const start = Math.max(position ?? 0, 0);
      for (let index = start; index <= this.length - searchString.length; index += 1) {
        if (this.slice(index, index + searchString.length) === searchString) {
          return index;
        }
      }

      return -1;
    },
  );

  // act & assert
  await assert.rejects(
    () => buildStagedCommand(command, context),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, closeSearches },
        { name: "YAMLParseError", closeSearches: 3 },
      );
      return true;
    },
  );
});

test("T-03-01 refuses a rebuilt frontmatter that Pi cannot read back", async (t) => {
  // arrange
  const command = await commandWithSource(t, `---\n? ${"k".repeat(1100)}\n: 1\n---\nBody.\n`);

  // act & assert
  await assert.rejects(
    () => buildStagedCommand(command, context),
    (error: unknown) => {
      assert.ok(error instanceof BridgeStagingError);
      assert.deepStrictEqual(
        { message: error.message, cause: error.cause },
        {
          message:
            'command "acme:deploy" was staged with frontmatter or a body that Pi reads differently',
          cause: undefined,
        },
      );
      return true;
    },
  );
});
