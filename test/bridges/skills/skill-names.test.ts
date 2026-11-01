import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  commandUpstreamNames,
  createSkillNameClaims,
  frontmatterNameAliases,
  skillIdentityName,
  writeSkillRecord,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/skill-names.ts";

async function allocateRoot(t: TestContext): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "skill-names-"));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  return root;
}

describe("skillIdentityName", () => {
  for (const { directory, expectedName } of [
    { directory: "foo.bar", expectedName: "demo:foo-bar" },
    { directory: "Mixed", expectedName: "demo:Mixed" },
    { directory: "demo-pre", expectedName: "demo:demo-pre" },
    { directory: "a b+c_d", expectedName: "demo:a-b-c_d" },
  ]) {
    test(`names the directory ${directory} as ${expectedName}`, () => {
      // act
      const name = skillIdentityName("demo", directory);

      // assert
      assert.strictEqual(name, expectedName);
    });
  }
});

describe("frontmatterNameAliases", () => {
  for (const { label, frontmatterName, expectedAliases } of [
    { label: "a plain name", frontmatterName: "fancy", expectedAliases: ["demo:fancy", "fancy"] },
    {
      label: "a name with the plugin prefix",
      frontmatterName: "demo:x",
      expectedAliases: ["demo:x"],
    },
    {
      label: "a name with another prefix",
      frontmatterName: "other:thing",
      expectedAliases: ["demo:other:thing"],
    },
    { label: "a number", frontmatterName: 123, expectedAliases: ["demo:123", "123"] },
    { label: "a boolean", frontmatterName: true, expectedAliases: ["demo:true", "true"] },
    { label: "a list", frontmatterName: ["a", "b"], expectedAliases: [] },
    {
      label: "a 256-character name",
      frontmatterName: "n".repeat(256),
      expectedAliases: [`demo:${"n".repeat(256)}`, "n".repeat(256)],
    },
    { label: "a 257-character name", frontmatterName: "n".repeat(257), expectedAliases: [] },
    { label: "an empty name", frontmatterName: "", expectedAliases: [] },
    { label: "null", frontmatterName: null, expectedAliases: [] },
    { label: "an absent name", frontmatterName: undefined, expectedAliases: [] },
    { label: "a name with whitespace", frontmatterName: "my skill", expectedAliases: [] },
  ]) {
    test(`gives ${label} the aliases Claude Code gives it`, () => {
      // act
      const aliases = frontmatterNameAliases("demo", frontmatterName);

      // assert
      assert.deepStrictEqual(aliases, expectedAliases);
    });
  }
});

describe("createSkillNameClaims", () => {
  test("gives a shared frontmatter alias to the first skill that claims it", () => {
    // arrange
    const claims = createSkillNameClaims(["demo:dupe-a", "demo:dupe-b"], new Set());

    // act
    const firstNames = claims.claim("demo:dupe-a", ["demo:same", "same"]);
    const secondNames = claims.claim("demo:dupe-b", ["demo:same", "same"]);

    // assert
    assert.deepStrictEqual(firstNames, ["demo:dupe-a", "demo:same", "same"]);
    assert.deepStrictEqual(secondNames, ["demo:dupe-b"]);
  });

  test("DC-25: never gives a frontmatter alias another skill's identity", () => {
    // arrange
    const claims = createSkillNameClaims(["demo:dupe-a", "demo:dupe-b"], new Set());

    // act
    const names = claims.claim("demo:dupe-a", ["demo:dupe-b"]);

    // assert
    assert.deepStrictEqual(names, ["demo:dupe-a"]);
  });

  test("D-CF2-03: never gives a frontmatter alias a command's name", () => {
    // arrange
    const claims = createSkillNameClaims(["demo:review"], new Set(["demo:clash"]));

    // act
    const names = claims.claim("demo:review", ["demo:clash", "clash"]);

    // assert
    assert.deepStrictEqual(names, ["demo:review", "clash"]);
  });

  test("keeps the bare alias of a name equal to the skill's own directory", () => {
    // arrange
    const claims = createSkillNameClaims(["demo:review"], new Set());

    // act
    const names = claims.claim("demo:review", ["demo:review", "review"]);

    // assert
    assert.deepStrictEqual(names, ["demo:review", "review"]);
  });
});

describe("commandUpstreamNames", () => {
  test("names each top-level plain Markdown file of each existing directory", async (t) => {
    // arrange
    const root = await allocateRoot(t);
    const pluginRoot = path.join(root, "plugin");
    const extra = path.join(root, "extra");
    await mkdir(path.join(pluginRoot, "commands", "nested"), { recursive: true });
    await mkdir(extra, { recursive: true });
    await writeFile(path.join(pluginRoot, "commands", "deploy.md"), "Deploy.\n");
    await writeFile(path.join(pluginRoot, "commands", ".hidden.md"), "Hidden.\n");
    await writeFile(path.join(pluginRoot, "commands", "notes.txt"), "Notes.\n");
    await writeFile(path.join(pluginRoot, "commands", "nested", "inner.md"), "Inner.\n");
    await symlink(
      path.join(pluginRoot, "commands", "deploy.md"),
      path.join(pluginRoot, "commands", "linked.md"),
    );
    await writeFile(path.join(extra, "review.md"), "Review.\n");

    // act
    const names = await commandUpstreamNames("demo", pluginRoot, ["commands", extra, "missing"]);

    // assert
    assert.deepStrictEqual(names, new Set(["demo:deploy", "demo:review"]));
  });

  test("names no file it cannot inspect", async (t) => {
    // arrange
    const root = await mkdtemp(path.join(tmpdir(), "skill-names-"));
    const commands = path.join(root, "commands");
    t.after(async () => {
      await chmod(commands, 0o755);
      await rm(root, { recursive: true, force: true, maxRetries: 3 });
    });
    await mkdir(commands, { recursive: true });
    await writeFile(path.join(commands, "deploy.md"), "Deploy.\n");
    await chmod(commands, 0o444);

    // act
    const names = await commandUpstreamNames("demo", root, ["commands"]);

    // assert
    assert.deepStrictEqual(names, new Set());
  });
});

const record = {
  names: ["demo:review", "demo:fancy", "fancy"],
  pluginRoot: "/plugins/demo",
  pluginData: "/data/demo",
};
const recordText =
  'pi-claude-marketplace: {"names":["demo:review","demo:fancy","fancy"],' +
  '"pluginRoot":"/plugins/demo","pluginData":"/data/demo"}';

describe("writeSkillRecord", () => {
  for (const { label, content, expectedContent } of [
    {
      label: "inserts the record as the last frontmatter line",
      content: "---\nname: demo-review\ndescription: Review\n---\n\nBody.\n",
      expectedContent: `---\nname: demo-review\ndescription: Review\n${recordText}\n---\n\nBody.\n`,
    },
    {
      label: "replaces a single-line node of the record key",
      content: "---\npi-claude-marketplace: old\nname: demo-review\n---\n",
      expectedContent: `---\nname: demo-review\n${recordText}\n---\n`,
    },
    {
      label: "replaces a multi-line node of the record key",
      content:
        "---\nname: demo-review\npi-claude-marketplace:\n  names: [x]\n  y: z\nlicense: MIT\n---\n",
      expectedContent: `---\nname: demo-review\nlicense: MIT\n${recordText}\n---\n`,
    },
    {
      label: "keeps an indented --- inside a block scalar out of the fence search",
      content: "---\nname: demo-review\ndescription: |\n  One.\n  ---\n  Two.\n---\n\nBody.\n",
      expectedContent:
        "---\nname: demo-review\ndescription: |\n  One.\n  ---\n  Two.\n" +
        `${recordText}\n---\n\nBody.\n`,
    },
  ]) {
    test(label, () => {
      // act
      const written = writeSkillRecord(content, record);

      // assert
      assert.strictEqual(written, expectedContent);
    });
  }

  test("T-02-01: keeps quotes, colons, and newlines of a name inside the record", () => {
    // arrange
    const forged = { names: ['a"b: c\nd: e'], pluginRoot: "C:\\plugins", pluginData: "/data" };

    // act
    const written = writeSkillRecord("---\nname: x\n---\n", forged);

    // assert
    assert.strictEqual(
      written,
      '---\nname: x\npi-claude-marketplace: {"names":["a\\"b: c\\nd: e"],' +
        '"pluginRoot":"C:\\\\plugins","pluginData":"/data"}\n---\n',
    );
  });

  test("T-02-01: throws when the written record does not read back", () => {
    // act & assert
    assert.throws(
      () => writeSkillRecord("no frontmatter\n", record),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.strictEqual(
          error.message,
          `the skill record ${recordText.slice("pi-claude-marketplace: ".length)} reads back as no record`,
        );
        return true;
      },
    );
  });
});
