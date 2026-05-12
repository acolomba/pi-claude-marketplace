import assert from "node:assert/strict";
import test from "node:test";

import {
  AgentForeignContentError,
  AgentOwnershipConflictError,
  BridgeStagingError,
  McpServerCollisionError,
} from "../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { PathContainmentError } from "../../extensions/pi-claude-marketplace/shared/path-safety.ts";

// AG-5 / AG-9 / RN-4 / RN-5 -- typed bridge error subclasses.

test("AG-5 AgentForeignContentError instanceof PathContainmentError (D-17 inheritance)", () => {
  const err = new AgentForeignContentError("/x/agents/foreign.md", "missing marker");
  assert.ok(err instanceof PathContainmentError, "must inherit PathContainmentError");
  assert.ok(err instanceof AgentForeignContentError);
});

test("AG-5 AgentForeignContentError carries targetPath and reason", () => {
  const err = new AgentForeignContentError("/x/agents/foreign.md", "missing marker");
  assert.equal(err.targetPath, "/x/agents/foreign.md");
  assert.equal(err.reason, "missing marker");
  assert.equal(err.name, "AgentForeignContentError");
  assert.match(err.message, /Refusing to overwrite agent file at \/x\/agents\/foreign\.md/);
  assert.match(err.message, /missing marker/);
});

test("AG-9/RN-4 AgentOwnershipConflictError formats single-conflict message", () => {
  const err = new AgentOwnershipConflictError({ marketplace: "official", plugin: "acme" }, [
    {
      generatedName: "pi-claude-marketplace-acme-bot",
      owner: { marketplace: "official", plugin: "old-acme" },
    },
  ]);
  assert.equal(err.name, "AgentOwnershipConflictError");
  assert.match(err.message, /Refusing to stage agents for official\/acme/);
  assert.match(err.message, /"pi-claude-marketplace-acme-bot" already owned by official\/old-acme/);
  assert.equal(err.conflicts.length, 1);
  assert.equal(err.stagingFor.marketplace, "official");
  assert.equal(err.stagingFor.plugin, "acme");
});

test("AG-9 AgentOwnershipConflictError formats multi-conflict message with semicolons", () => {
  const err = new AgentOwnershipConflictError({ marketplace: "mp", plugin: "p" }, [
    { generatedName: "n1", owner: { marketplace: "mp", plugin: "other1" } },
    { generatedName: "n2", owner: { marketplace: "mp", plugin: "other2" } },
    { generatedName: "n3", owner: { marketplace: "mp", plugin: "other3" } },
  ]);
  assert.match(err.message, /"n1" already owned by mp\/other1/);
  assert.match(err.message, /"n2" already owned by mp\/other2/);
  assert.match(err.message, /"n3" already owned by mp\/other3/);
  // Three entries -> two semicolon separators.
  const semis = (err.message.match(/; /g) ?? []).length;
  assert.equal(semis, 2, "expected exactly two `; ` separators between three conflicts");
});

test("AG-9 AgentOwnershipConflictError freezes conflicts and stagingFor", () => {
  const err = new AgentOwnershipConflictError({ marketplace: "mp", plugin: "p" }, [
    { generatedName: "n1", owner: { marketplace: "mp", plugin: "o1" } },
  ]);
  assert.ok(Object.isFrozen(err.conflicts));
  assert.ok(Object.isFrozen(err.stagingFor));
});

test("MC-4/RN-5 McpServerCollisionError carries serverName and owningPath", () => {
  const err = new McpServerCollisionError("acme-server", "/scope/mcp.json");
  assert.equal(err.name, "McpServerCollisionError");
  assert.equal(err.serverName, "acme-server");
  assert.equal(err.owningPath, "/scope/mcp.json");
  assert.match(
    err.message,
    /Refusing to stage MCP server "acme-server": already exists in \/scope\/mcp\.json/,
  );
});

test("BridgeStagingError preserves cause via Error.cause", () => {
  const cause = new Error("ENOSPC: no space left");
  const err = new BridgeStagingError("staging tmp failed", { cause });
  assert.equal(err.name, "BridgeStagingError");
  assert.equal(err.message, "staging tmp failed");
  assert.equal(err.cause, cause);
});

test("BridgeStagingError works without options", () => {
  const err = new BridgeStagingError("plain message");
  assert.equal(err.name, "BridgeStagingError");
  assert.equal(err.message, "plain message");
  assert.equal(err.cause, undefined);
});
