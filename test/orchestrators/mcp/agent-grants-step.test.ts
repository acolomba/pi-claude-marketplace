import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { agentGrantsStep } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { withLockedStateTransaction } from "../../../extensions/pi-claude-marketplace/transaction/with-state-guard.ts";
import {
  adapterBlock,
  agentPath,
  BODY,
  builtinBlock,
  indexPath,
  readIndexRows,
  storedRow,
  swappedRow,
  writeAgent,
  writeIndex,
} from "../../bridges/agents/agent-grant-seeds.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithSoftDeps } from "../../shared/notification-run-seeds.ts";

import type { McpImplementationId } from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { AgentsIndexEntry } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type {
  ActiveMcpImplementation,
  ExtensionContext,
  PiInventory,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type { TestContext } from "node:test";

const NOT_A_CHILD = {};

function runFor(mcpImplementation: ActiveMcpImplementation): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: true,
    mcpImplementation,
    workflowEngineLoaded: false,
  });
}

/** Both scopes of a fresh hermetic environment. */
async function scopes(
  t: TestContext,
): Promise<{ cwd: string; user: ScopedLocations; project: ScopedLocations }> {
  const environment = await createHermeticEnvironment(t, "agent-grants-step-");
  return {
    cwd: environment.cwd,
    user: locationsFor("user", environment.cwd),
    project: locationsFor("project", environment.cwd),
  };
}

/** Seeds one agent whose file holds `recorded`'s block and whose row stores both forms. */
async function seedAgent(
  locations: ScopedLocations,
  recorded: McpImplementationId,
): Promise<AgentsIndexEntry> {
  const target = agentPath(locations);
  const row = storedRow(target, recorded);
  await writeAgent(target, (recorded === "adapter" ? adapterBlock() : builtinBlock()) + BODY);
  await writeIndex(locations, [row]);
  return row;
}

/** A strict context that answers the cwd once and the trust question once. */
function contextFor(cwd: string, trusted: boolean): ExtensionContext {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  when(() => ctx.cwd).thenReturn(cwd);
  when(() => ctx.isProjectTrusted()).thenReturn(trusted);
  return ctx;
}

function inventory(): PiInventory {
  return mock<PiInventory>({ exactParams: true, name: "inventory" });
}

test("MGRT-01: with no active implementation, reads nothing from the context and changes no file", async (t) => {
  // arrange
  const { user } = await scopes(t);
  await seedAgent(user, "adapter");
  const indexBefore = await readFile(indexPath(user), "utf8");
  const pi = inventory();
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("none") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), adapterBlock() + BODY);
  assert.strictEqual(await readFile(indexPath(user), "utf8"), indexBefore);
  verify(pi);
  verify(ctx);
});

test("MGRT-02 / D-MB-12: in a pi-subagents background child, reads nothing from the context and changes no file", async (t) => {
  // arrange
  const { user } = await scopes(t);
  await seedAgent(user, "adapter");
  const indexBefore = await readFile(indexPath(user), "utf8");
  const pi = inventory();
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, { PI_SUBAGENT_CHILD: "1" });

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), adapterBlock() + BODY);
  assert.strictEqual(await readFile(indexPath(user), "utf8"), indexBefore);
  verify(pi);
  verify(ctx);
});

test("MGRT-01 / D-MB-03: under Pi's built-in MCP, rewrites the adapter form in both scopes of a trusted project", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  const userRow = await seedAgent(user, "adapter");
  const projectRow = await seedAgent(project, "adapter");
  const pi = inventory();
  const ctx = contextFor(cwd, true);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), builtinBlock() + BODY);
  assert.strictEqual(await readFile(agentPath(project), "utf8"), builtinBlock() + BODY);
  assert.deepStrictEqual(await readIndexRows(user), [swappedRow(userRow, "builtin")]);
  assert.deepStrictEqual(await readIndexRows(project), [swappedRow(projectRow, "builtin")]);
  await assert.rejects(stat(user.stateJsonPath), { code: "ENOENT" });
  await assert.rejects(stat(project.stateJsonPath), { code: "ENOENT" });
  verify(pi);
  verify(ctx);
});

test("MGRT-01 / D-MB-03: under pi-mcp-adapter, rewrites the built-in form back to the adapter form", async (t) => {
  // arrange
  const { cwd, user } = await scopes(t);
  const userRow = await seedAgent(user, "builtin");
  const pi = inventory();
  const ctx = contextFor(cwd, false);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("adapter") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), adapterBlock() + BODY);
  assert.deepStrictEqual(await readIndexRows(user), [swappedRow(userRow, "adapter")]);
  verify(pi);
  verify(ctx);
});

test("D-06: a user state.json that does not load blocks no rewrite and stays as it is", async (t) => {
  // arrange
  const { cwd, user } = await scopes(t);
  const userRow = await seedAgent(user, "adapter");
  await writeFile(user.stateJsonPath, "{ not json", "utf8");
  const pi = inventory();
  const ctx = contextFor(cwd, false);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), builtinBlock() + BODY);
  assert.deepStrictEqual(await readIndexRows(user), [swappedRow(userRow, "builtin")]);
  assert.strictEqual(await readFile(user.stateJsonPath, "utf8"), "{ not json");
  verify(pi);
  verify(ctx);
});

test("D-LOC-01: in a project Pi does not trust, rewrites only the user scope", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  const userRow = await seedAgent(user, "adapter");
  await seedAgent(project, "adapter");
  const projectIndexBefore = await readFile(indexPath(project), "utf8");
  const pi = inventory();
  const ctx = contextFor(cwd, false);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.deepStrictEqual(await readIndexRows(user), [swappedRow(userRow, "builtin")]);
  assert.strictEqual(await readFile(agentPath(project), "utf8"), adapterBlock() + BODY);
  assert.strictEqual(await readFile(indexPath(project), "utf8"), projectIndexBefore);
  verify(pi);
  verify(ctx);
});

test("NFR-2: a held user-scope lock skips the user scope and still rewrites the trusted project scope", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  await seedAgent(user, "adapter");
  const projectRow = await seedAgent(project, "adapter");
  const userIndexBefore = await readFile(indexPath(user), "utf8");
  const pi = inventory();
  const ctx = contextFor(cwd, true);

  // act
  await withLockedStateTransaction(
    user,
    () => agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD),
    { persistMigration: false },
  );

  // assert
  assert.strictEqual(await readFile(agentPath(user), "utf8"), adapterBlock() + BODY);
  assert.strictEqual(await readFile(indexPath(user), "utf8"), userIndexBefore);
  assert.deepStrictEqual(await readIndexRows(project), [swappedRow(projectRow, "builtin")]);
  verify(pi);
  verify(ctx);
});

test("NFR-2: a trust question that throws resolves the step after the user scope is rewritten", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  const userRow = await seedAgent(user, "adapter");
  await seedAgent(project, "adapter");
  const projectIndexBefore = await readFile(indexPath(project), "utf8");
  const pi = inventory();
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  when(() => ctx.cwd).thenReturn(cwd);
  when(() => ctx.isProjectTrusted()).thenThrow(new Error("the trust store is unreadable"));

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.deepStrictEqual(await readIndexRows(user), [swappedRow(userRow, "builtin")]);
  assert.strictEqual(await readFile(indexPath(project), "utf8"), projectIndexBefore);
  verify(pi);
  verify(ctx);
});

test("MGRT-01: a scope with no agents index stays absent", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  const pi = inventory();
  const ctx = contextFor(cwd, true);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  await assert.rejects(stat(user.extensionRoot), { code: "ENOENT" });
  await assert.rejects(stat(project.extensionRoot), { code: "ENOENT" });
  verify(pi);
  verify(ctx);
});

test("NFR-2: an unparseable user agents index changes nothing there and the project scope is still rewritten", async (t) => {
  // arrange
  const { cwd, user, project } = await scopes(t);
  await mkdir(user.extensionRoot, { recursive: true });
  await writeFile(indexPath(user), "{ not json", "utf8");
  const projectRow = await seedAgent(project, "adapter");
  const pi = inventory();
  const ctx = contextFor(cwd, true);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(indexPath(user), "utf8"), "{ not json");
  assert.deepStrictEqual(await readIndexRows(project), [swappedRow(projectRow, "builtin")]);
  verify(pi);
  verify(ctx);
});

test("T-04-13: an index with a corrupt row saves nothing and the step resolves", async (t) => {
  // arrange
  const { cwd, user } = await scopes(t);
  const target = agentPath(user);
  await writeAgent(target, adapterBlock() + BODY);
  await writeIndex(user, [storedRow(target, "adapter"), { plugin: "demo" }]);
  const indexBefore = await readFile(indexPath(user), "utf8");
  const pi = inventory();
  const ctx = contextFor(cwd, false);

  // act
  await agentGrantsStep({ pi, ctx, snapshot: runFor("builtin") }, NOT_A_CHILD);

  // assert
  assert.strictEqual(await readFile(target, "utf8"), adapterBlock() + BODY);
  assert.strictEqual(await readFile(indexPath(user), "utf8"), indexBefore);
  await assert.rejects(stat(user.stateJsonPath), { code: "ENOENT" });
  verify(pi);
  verify(ctx);
});
