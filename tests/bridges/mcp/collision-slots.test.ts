import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  MCP_COLLISION_SLOTS,
  loadEffectiveServerNames,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts";

interface CollisionPaths {
  agentDirectory: string;
  cwd: string;
  homeDirectory: string;
}

async function allocateCollisionPaths(t: TestContext): Promise<CollisionPaths> {
  const root = await mkdtemp(path.join(tmpdir(), "mcp-collision-slots-"));
  t.after(async () => rm(root, { recursive: true, force: true }));

  return {
    agentDirectory: path.join(root, "pi-agent"),
    cwd: path.join(root, "project"),
    homeDirectory: path.join(root, "home"),
  };
}

describe("MCP_COLLISION_SLOTS", () => {
  test("returns the exact frozen slot order from the case environment", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const previousHome = process.env.HOME;
    t.after(() => {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    });
    process.env.HOME = homeDirectory;
    const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (previousAgentDirectory === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
      }
    });
    process.env.PI_CODING_AGENT_DIR = agentDirectory;
    const expectedSlots = [
      path.join(homeDirectory, ".config", "mcp", "mcp.json"),
      path.join(agentDirectory, "mcp.json"),
      path.join(cwd, ".mcp.json"),
      path.join(cwd, ".pi", "mcp.json"),
    ];

    // act
    const slots = MCP_COLLISION_SLOTS(cwd);

    // assert
    assert.deepStrictEqual(slots, expectedSlots);
    assert.strictEqual(Object.isFrozen(slots), true);
  });
});

describe("loadEffectiveServerNames", () => {
  test("keeps the first declaration across all four ordered slots", async (t) => {
    // arrange
    const { agentDirectory, cwd, homeDirectory } = await allocateCollisionPaths(t);
    const previousHome = process.env.HOME;
    t.after(() => {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    });
    process.env.HOME = homeDirectory;
    const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (previousAgentDirectory === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
      }
    });
    process.env.PI_CODING_AGENT_DIR = agentDirectory;
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
});
