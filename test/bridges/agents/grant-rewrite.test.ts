import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  needsAgentGrantRewrite,
  rewriteAgentGrantForms,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/grant-rewrite.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import {
  ADAPTER_ASYNC,
  adapterBlock,
  agentBlock,
  agentPath,
  BODY,
  BUILTIN_ASYNC,
  builtinBlock,
  indexPath,
  legacyRow,
  NAME,
  OTHER_NAME,
  plainRow,
  readIndexRows,
  storedRow,
  swappedRow,
  writeAgent,
  writeIndex,
} from "./agent-grant-seeds.ts";

import type { AgentsIndexEntry } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { RemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import type { TestContext } from "node:test";

async function userScope(t: TestContext): Promise<ScopedLocations> {
  const environment = await createHermeticEnvironment(t, "grant-rewrite-");
  return locationsFor("user", environment.cwd);
}

describe("needsAgentGrantRewrite", () => {
  test("MGRT-01: is false for a scope with no agents index and creates nothing", async (t) => {
    // arrange
    const locations = await userScope(t);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, false);
    await assert.rejects(stat(locations.extensionRoot), { code: "ENOENT" });
  });

  test("MGRT-01: is true when a row records the other form and stores the active one", async (t) => {
    // arrange
    const locations = await userScope(t);
    await writeIndex(locations, [storedRow(agentPath(locations), "adapter")]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, true);
  });

  test("MGRT-01: is false when every row already records the active form", async (t) => {
    // arrange
    const locations = await userScope(t);
    await writeIndex(locations, [storedRow(agentPath(locations), "adapter")]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "adapter");

    // assert
    assert.strictEqual(needed, false);
  });

  test("MGRT-01: is false when the row does not store the active form", async (t) => {
    // arrange
    const locations = await userScope(t);
    const row = storedRow(agentPath(locations), "adapter");
    await writeIndex(locations, [
      { ...row, mcpForms: { adapter: row.mcpForms?.adapter } },
      plainRow(agentPath(locations, "pi-claude-marketplace-demo-plain")),
    ]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, false);
  });

  test("MGRT-01: is false when the row does not store the form its file holds", async (t) => {
    // arrange
    const locations = await userScope(t);
    const row = storedRow(agentPath(locations), "adapter");
    await writeIndex(locations, [{ ...row, mcpForms: { builtin: row.mcpForms?.builtin } }]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, false);
  });
  test("P4-DC-06: a legacy row holding the adapter async warning is a candidate under Pi's built-in MCP", async (t) => {
    // arrange
    const locations = await userScope(t);
    await writeIndex(locations, [legacyRow(agentPath(locations), [ADAPTER_ASYNC])]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, true);
  });

  test("P4-DC-06: a legacy row without the adapter async warning is never a candidate", async (t) => {
    // arrange
    const locations = await userScope(t);
    await writeIndex(locations, [legacyRow(agentPath(locations), ["a warning that stays"])]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "builtin");

    // assert
    assert.strictEqual(needed, false);
  });

  test("P4-DC-06: a legacy row is never a candidate under pi-mcp-adapter", async (t) => {
    // arrange
    const locations = await userScope(t);
    await writeIndex(locations, [legacyRow(agentPath(locations), [ADAPTER_ASYNC])]);

    // act
    const needed = await needsAgentGrantRewrite(locations, "adapter");

    // assert
    assert.strictEqual(needed, false);
  });
});

describe("rewriteAgentGrantForms", () => {
  test("MGRT-01 / D-MB-03: swaps the adapter block for the built-in block and keeps the body", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = storedRow(target, "adapter");
    const plain = plainRow(agentPath(locations, "pi-claude-marketplace-demo-plain"));
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [plain, row]);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [plain, swappedRow(row, "builtin")]);
    await assert.rejects(stat(locations.stateJsonPath), { code: "ENOENT" });
    assert.deepStrictEqual(await readdir(locations.agentsStagingDir), []);
  });

  test("MGRT-01 / D-MB-03: swaps the built-in block for the adapter block", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = storedRow(target, "builtin");
    await writeAgent(target, builtinBlock() + BODY);
    await writeIndex(locations, [row]);

    // act
    await rewriteAgentGrantForms(locations, "adapter", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [swappedRow(row, "adapter")]);
  });

  test("NFR-3: a file that already holds the active block only gets its row fixed", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = storedRow(target, "adapter");
    await writeAgent(target, builtinBlock() + BODY);
    await writeIndex(locations, [row]);
    const before = await stat(target);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    const after = await stat(target);
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock() + BODY);
    assert.strictEqual(after.mtimeMs, before.mtimeMs);
    assert.deepStrictEqual(await readIndexRows(locations), [swappedRow(row, "builtin")]);
  });

  test("AG-5: a file the user edited is left, and another candidate is still rewritten", async (t) => {
    // arrange
    const locations = await userScope(t);
    const edited = agentPath(locations, OTHER_NAME);
    const editedText = adapterBlock(OTHER_NAME).replace("Helps with", "Edited by hand,") + BODY;
    const editedRow = storedRow(edited, "adapter", OTHER_NAME);
    const target = agentPath(locations);
    const row = storedRow(target, "adapter");
    await writeAgent(edited, editedText);
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [editedRow, row]);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(edited, "utf8"), editedText);
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [editedRow, swappedRow(row, "builtin")]);
  });

  test("MGRT-01: a row whose file is missing is left as it is", async (t) => {
    // arrange
    const locations = await userScope(t);
    const row = storedRow(agentPath(locations), "adapter");
    await writeIndex(locations, [row]);
    const indexBefore = await readFile(indexPath(locations), "utf8");

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(indexPath(locations), "utf8"), indexBefore);
    await assert.rejects(stat(agentPath(locations)), { code: "ENOENT" });
  });

  test("NFR-10: a row whose target leaves the agents folder is left, and another candidate is rewritten", async (t) => {
    // arrange
    const locations = await userScope(t);
    const outside = path.join(path.dirname(locations.agentsDir), "elsewhere", `${NAME}.md`);
    const outsideRow = storedRow(outside, "adapter");
    const target = agentPath(locations, OTHER_NAME);
    const row = storedRow(target, "adapter", OTHER_NAME);
    await writeAgent(outside, adapterBlock() + BODY);
    await writeAgent(target, adapterBlock(OTHER_NAME) + BODY);
    await writeIndex(locations, [outsideRow, row]);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(outside, "utf8"), adapterBlock() + BODY);
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock(OTHER_NAME) + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [
      outsideRow,
      swappedRow(row, "builtin"),
    ]);
  });

  test("NFR-10: a row whose target file has another name is left as it is", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations, OTHER_NAME);
    const row = storedRow(target, "adapter");
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [row]);
    const indexBefore = await readFile(indexPath(locations), "utf8");

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
    assert.strictEqual(await readFile(indexPath(locations), "utf8"), indexBefore);
  });

  for (const { label, frontmatter } of [
    { label: "no opening line", frontmatter: builtinBlock().slice("---\n".length) },
    { label: "no closing line", frontmatter: builtinBlock().slice(0, -"---\n".length) },
    {
      label: "no generated marker",
      frontmatter: builtinBlock().replace("  generatedBy: pi-claude-marketplace\n", ""),
    },
  ]) {
    test(`AG-4: a stored active form with ${label} is never written`, async (t) => {
      // arrange
      const locations = await userScope(t);
      const target = agentPath(locations);
      const stored = storedRow(target, "adapter");
      const row: AgentsIndexEntry = {
        ...stored,
        mcpForms: { ...stored.mcpForms, builtin: { frontmatter, warnings: [], droppedTools: [] } },
      };
      await writeAgent(target, adapterBlock() + BODY);
      await writeIndex(locations, [row]);
      const indexBefore = await readFile(indexPath(locations), "utf8");

      // act
      await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

      // assert
      assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
      assert.strictEqual(await readFile(indexPath(locations), "utf8"), indexBefore);
    });
  }

  test("T-04-13: a re-read that reports a corrupt row saves nothing and writes no file", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [storedRow(target, "adapter"), { plugin: "demo" }]);
    const indexBefore = await readFile(indexPath(locations), "utf8");

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
    assert.strictEqual(await readFile(indexPath(locations), "utf8"), indexBefore);
  });

  test("NFR-2: a staging cleanup that fails still leaves the rewritten file and saved row", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = storedRow(target, "adapter");
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [row]);
    const ops = { rm: () => Promise.reject(new Error("rm refused")) } satisfies RemovalOps;

    // act
    await rewriteAgentGrantForms(locations, "builtin", ops);

    // assert
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [swappedRow(row, "builtin")]);
  });

  test("P4-DC-06: a legacy agent gets the translated built-in block and its row stores both forms", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = legacyRow(target, [ADAPTER_ASYNC]);
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [row]);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), builtinBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [
      {
        ...row,
        warnings: [BUILTIN_ASYNC],
        mcpImplementation: "builtin",
        mcpForms: {
          adapter: { frontmatter: adapterBlock(), warnings: [ADAPTER_ASYNC], droppedTools: [] },
          builtin: { frontmatter: builtinBlock(), warnings: [BUILTIN_ASYNC], droppedTools: [] },
        },
      },
    ]);
  });

  test("P4-DC-06: a translated legacy agent swaps back exactly after a switch to pi-mcp-adapter", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const row = legacyRow(target, [ADAPTER_ASYNC]);
    await writeAgent(target, adapterBlock() + BODY);
    await writeIndex(locations, [row]);
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // act
    await rewriteAgentGrantForms(locations, "adapter", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [
      {
        ...row,
        mcpImplementation: "adapter",
        mcpForms: {
          adapter: { frontmatter: adapterBlock(), warnings: [ADAPTER_ASYNC], droppedTools: [] },
          builtin: { frontmatter: builtinBlock(), warnings: [BUILTIN_ASYNC], droppedTools: [] },
        },
      },
    ]);
  });

  test("P4-DC-06: a legacy agent whose translation gives up keeps its file and is not a candidate again", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const block = agentBlock(`excludeTools: mcp__plugin_demo_my-db__${"q".repeat(41)}`, [
      ADAPTER_ASYNC,
    ]);
    const row = legacyRow(target, [ADAPTER_ASYNC]);
    await writeAgent(target, block + BODY);
    await writeIndex(locations, [row]);

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), block + BODY);
    assert.deepStrictEqual(await readIndexRows(locations), [
      {
        ...row,
        mcpImplementation: "adapter",
        mcpForms: { adapter: { frontmatter: block, warnings: [ADAPTER_ASYNC], droppedTools: [] } },
      },
    ]);
    assert.strictEqual(await needsAgentGrantRewrite(locations, "builtin"), false);
  });

  test("P4-DC-06: a legacy file that is not a generated agent is left with its row", async (t) => {
    // arrange
    const locations = await userScope(t);
    const target = agentPath(locations);
    const text = adapterBlock().replace("  generatedBy: pi-claude-marketplace\n", "") + BODY;
    await writeAgent(target, text);
    await writeIndex(locations, [legacyRow(target, [ADAPTER_ASYNC])]);
    const indexBefore = await readFile(indexPath(locations), "utf8");

    // act
    await rewriteAgentGrantForms(locations, "builtin", createRemovalOps());

    // assert
    assert.strictEqual(await readFile(target, "utf8"), text);
    assert.strictEqual(await readFile(indexPath(locations), "utf8"), indexBefore);
  });
});
