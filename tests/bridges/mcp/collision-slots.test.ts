import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import { loadEffectiveServerNames } from "../../../extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

interface CollisionPaths {
  agentDirectory: string;
  cwd: string;
  homeDirectory: string;
}

async function allocateCollisionPaths(t: TestContext): Promise<CollisionPaths> {
  const { agentDir, cwd, home } = await createHermeticEnvironment(t, "mcp-collision-slots-");
  return { agentDirectory: agentDir, cwd, homeDirectory: home };
}

describe("loadEffectiveServerNames", () => {
  test("preserves every slot priority and stable repeated reads", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const slotPaths = [
      path.join(homeDirectory, ".config", "mcp", "mcp.json"),
      path.join(agentDirectory, "mcp.json"),
      path.join(cwd, ".mcp.json"),
      path.join(cwd, ".pi", "mcp.json"),
    ] as const;

    for (const slotPath of slotPaths) {
      await mkdir(path.dirname(slotPath), { recursive: true });
    }

    await writeFile(slotPaths[0], JSON.stringify({ global: {}, allSlots: {} }));
    await writeFile(slotPaths[1], JSON.stringify({ agent: {}, allSlots: {}, afterGlobal: {} }));
    await writeFile(
      slotPaths[2],
      JSON.stringify({ project: {}, allSlots: {}, afterGlobal: {}, afterAgent: {} }),
    );
    await writeFile(
      slotPaths[3],
      JSON.stringify({ piProject: {}, allSlots: {}, afterGlobal: {}, afterAgent: {} }),
    );
    const expectedOwners = new Map([
      ["global", path.join(homeDirectory, ".config", "mcp", "mcp.json")],
      ["allSlots", path.join(homeDirectory, ".config", "mcp", "mcp.json")],
      ["agent", path.join(agentDirectory, "mcp.json")],
      ["afterGlobal", path.join(agentDirectory, "mcp.json")],
      ["project", path.join(cwd, ".mcp.json")],
      ["afterAgent", path.join(cwd, ".mcp.json")],
      ["piProject", path.join(cwd, ".pi", "mcp.json")],
    ]);

    // act
    const owners = await loadEffectiveServerNames(cwd);
    const repeatedOwners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
    assert.deepStrictEqual(repeatedOwners, expectedOwners);
  });

  test("keeps the first declaration across all four ordered slots", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const homeSlot = path.join(homeDirectory, ".config", "mcp", "mcp.json");
    const agentSlot = path.join(agentDirectory, "mcp.json");
    const projectSlot = path.join(cwd, ".mcp.json");
    const piProjectSlot = path.join(cwd, ".pi", "mcp.json");
    await mkdir(path.dirname(homeSlot), { recursive: true });
    await mkdir(path.dirname(agentSlot), { recursive: true });
    await mkdir(path.dirname(projectSlot), { recursive: true });
    await mkdir(path.dirname(piProjectSlot), { recursive: true });
    await writeFile(
      homeSlot,
      JSON.stringify({ mcpServers: { global: { command: "global" }, shared: {} } }),
    );
    await writeFile(agentSlot, JSON.stringify({ agent: { command: "agent" }, shared: {} }));
    await writeFile(
      projectSlot,
      JSON.stringify({ mcpServers: { project: { command: "project" }, shared: {} } }),
    );
    await writeFile(
      piProjectSlot,
      JSON.stringify({ piProject: { command: "pi-project" }, shared: {} }),
    );
    const expectedOwners = new Map([
      ["global", homeSlot],
      ["shared", homeSlot],
      ["agent", agentSlot],
      ["project", projectSlot],
      ["piProject", piProjectSlot],
    ]);

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("returns an empty map when every collision document is missing", async (t) => {
    // arrange
    const { cwd } = await allocateCollisionPaths(t);
    const expectedOwners = new Map<string, string>();

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("treats a non-directory path component as an absent document", async (t) => {
    // arrange
    const { cwd, homeDirectory } = await allocateCollisionPaths(t);
    await writeFile(path.join(homeDirectory, ".config"), "not a directory\n");
    const expectedOwners = new Map<string, string>();

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("skips empty, array, and primitive documents before a valid declaration", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const homeSlot = path.join(homeDirectory, ".config", "mcp", "mcp.json");
    const agentSlot = path.join(agentDirectory, "mcp.json");
    const projectSlot = path.join(cwd, ".mcp.json");
    const piProjectSlot = path.join(cwd, ".pi", "mcp.json");
    await mkdir(path.dirname(homeSlot), { recursive: true });
    await mkdir(path.dirname(agentSlot), { recursive: true });
    await mkdir(path.dirname(projectSlot), { recursive: true });
    await mkdir(path.dirname(piProjectSlot), { recursive: true });
    await writeFile(homeSlot, "");
    await writeFile(agentSlot, JSON.stringify(["array-server"]));
    await writeFile(projectSlot, JSON.stringify(42));
    await writeFile(piProjectSlot, JSON.stringify({ survivor: { command: "survivor" } }));
    const expectedOwners = new Map([["survivor", piProjectSlot]]);

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("accepts empty wrapped and unwrapped objects while skipping null", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const homeSlot = path.join(homeDirectory, ".config", "mcp", "mcp.json");
    const agentSlot = path.join(agentDirectory, "mcp.json");
    const projectSlot = path.join(cwd, ".mcp.json");
    await mkdir(path.dirname(homeSlot), { recursive: true });
    await mkdir(path.dirname(agentSlot), { recursive: true });
    await mkdir(path.dirname(projectSlot), { recursive: true });
    await writeFile(homeSlot, JSON.stringify(null));
    await writeFile(agentSlot, JSON.stringify({}));
    await writeFile(projectSlot, JSON.stringify({ mcpServers: {} }));
    const expectedOwners = new Map<string, string>();

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("skips invalid wrapped server collections and keeps the next valid one", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const homeSlot = path.join(homeDirectory, ".config", "mcp", "mcp.json");
    const agentSlot = path.join(agentDirectory, "mcp.json");
    const projectSlot = path.join(cwd, ".mcp.json");
    const piProjectSlot = path.join(cwd, ".pi", "mcp.json");
    await mkdir(path.dirname(homeSlot), { recursive: true });
    await mkdir(path.dirname(agentSlot), { recursive: true });
    await mkdir(path.dirname(projectSlot), { recursive: true });
    await mkdir(path.dirname(piProjectSlot), { recursive: true });
    await writeFile(homeSlot, JSON.stringify({ mcpServers: null }));
    await writeFile(agentSlot, JSON.stringify({ mcpServers: [] }));
    await writeFile(projectSlot, JSON.stringify({ mcpServers: "invalid" }));
    await writeFile(piProjectSlot, JSON.stringify({ mcpServers: { valid: { command: "valid" } } }));
    const expectedOwners = new Map([["valid", piProjectSlot]]);

    // act
    const owners = await loadEffectiveServerNames(cwd);

    // assert
    assert.deepStrictEqual(owners, expectedOwners);
  });

  test("propagates an unreadable collision document", async (t) => {
    // arrange
    const { cwd, homeDirectory } = await allocateCollisionPaths(t);
    const homeSlot = path.join(homeDirectory, ".config", "mcp", "mcp.json");
    await mkdir(homeSlot, { recursive: true });

    // act
    const ownerLoad = loadEffectiveServerNames(cwd);

    // assert
    await assert.rejects(ownerLoad, { code: "EISDIR" });
  });
});
