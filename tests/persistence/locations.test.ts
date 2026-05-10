import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  type ScopedLocations,
  locationsFor,
} from "../../extensions/claude-marketplace/persistence/locations.ts";
import { PathContainmentError } from "../../extensions/claude-marketplace/shared/path-safety.ts";

/**
 * SC-1, SC-2, SC-3, SC-7 -- ScopedLocations brand bundle behavior.
 *
 * SC-1/SC-2: per-scope path layout (user vs project).
 * SC-3: brand-symbol presence + frozen object (cannot mutate scope).
 * SC-7: name-derived path methods route through assertPathInside.
 */

test("SC-1 / SC-2 locationsFor('user') returns ~/.pi/agent/ paths", () => {
  const loc = locationsFor("user", "/anywhere");
  assert.equal(loc.scope, "user");
  assert.ok(loc.scopeRoot.endsWith(path.join(".pi", "agent")));
  assert.ok(loc.extensionRoot.endsWith(path.join(".pi", "agent", "claude-marketplace")));
  assert.ok(loc.stateJsonPath.endsWith("state.json"));
  assert.ok(loc.agentsDir.endsWith(path.join(".pi", "agent", "agents")));
  assert.ok(loc.mcpJsonPath.endsWith(path.join(".pi", "agent", "mcp.json")));
});

test("SC-1 / SC-2 locationsFor('project', cwd) returns <cwd>/.pi/ paths", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(loc.scope, "project");
  assert.equal(loc.scopeRoot, path.join("/my/proj", ".pi"));
  assert.equal(loc.extensionRoot, path.join("/my/proj", ".pi", "claude-marketplace"));
  assert.equal(loc.stateJsonPath, path.join("/my/proj", ".pi", "claude-marketplace", "state.json"));
  assert.equal(loc.agentsDir, path.join("/my/proj", ".pi", "agents"));
  assert.equal(loc.mcpJsonPath, path.join("/my/proj", ".pi", "mcp.json"));
});

test("SC-2 ScopedLocations exposes agents-staging dir under extensionRoot", () => {
  const loc = locationsFor("project", "/p");
  assert.ok(loc.agentsStagingDir.includes("agents-staging"));
  assert.ok(loc.agentsStagingDir.startsWith(loc.extensionRoot));
});

test("SC-3 ScopedLocations carries a symbol-keyed brand field", () => {
  // The brand is a unique symbol -- consumers cannot construct a
  // ScopedLocations literal without going through the factory because the
  // brand symbol is module-private. Verifiable at runtime via Reflect.ownKeys.
  const loc = locationsFor("user", "/x");
  const allKeys = Reflect.ownKeys(loc);
  const brandKeys = allKeys.filter((k) => typeof k === "symbol");
  assert.ok(
    brandKeys.length >= 1,
    "ScopedLocations must carry at least one symbol-keyed brand field",
  );
});

test("SC-3 ScopedLocations is frozen (cannot mutate scope after construction)", () => {
  const loc = locationsFor("user", "/x") as ScopedLocations & { scope: string };
  assert.throws(() => {
    loc.scope = "project";
  }, /Cannot assign to read only property|object is not extensible/);
});

test("SC-7 pluginDataDir('../escape', 'p') throws PathContainmentError", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("../escape", "plugin"), PathContainmentError);
});

test("SC-7 marketplaceDataDir('../escape') throws PathContainmentError", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.marketplaceDataDir("../escape"), PathContainmentError);
});

test("SC-7 sourceCloneDir('../../etc') throws PathContainmentError", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.sourceCloneDir("../../etc"), PathContainmentError);
});

test("SC-7 pluginDataDir('mp', 'plugin') happy path returns under dataRoot", async () => {
  const loc = locationsFor("project", "/p");
  const got = await loc.pluginDataDir("mp", "plugin");
  assert.ok(got.startsWith(loc.dataRoot));
  assert.ok(got.endsWith(path.join("mp", "plugin")));
});

test("SC-7 marketplaceDataDir('mp') happy path returns under dataRoot", async () => {
  const loc = locationsFor("project", "/p");
  const got = await loc.marketplaceDataDir("mp");
  assert.ok(got.startsWith(loc.dataRoot));
  assert.ok(got.endsWith("mp"));
});

test("SC-7 sourceCloneDir('mp') happy path returns under sourcesDir", async () => {
  const loc = locationsFor("project", "/p");
  const got = await loc.sourceCloneDir("mp");
  assert.ok(got.startsWith(loc.sourcesDir));
  assert.ok(got.endsWith("mp"));
});

// ──────────────────────────────────────────────────────────────────────────
// Phase 3 (Plan 03-01): bridge-target paths added to ScopedLocations.
// agentsIndexPath, skillsStagingDir, commandsStagingDir, skillsTargetDir,
// promptsTargetDir.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 locationsFor('user') sets agentsIndexPath to <extensionRoot>/agents-index.json", () => {
  const loc = locationsFor("user", "/anywhere");
  assert.equal(loc.agentsIndexPath, path.join(loc.extensionRoot, "agents-index.json"));
});

test("D-07 locationsFor('project') sets agentsIndexPath under <extensionRoot>", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.agentsIndexPath,
    path.join("/my/proj", ".pi", "claude-marketplace", "agents-index.json"),
  );
});

test("D-04 locationsFor('project') sets skillsStagingDir to <extensionRoot>/skills-staging", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.skillsStagingDir,
    path.join("/my/proj", ".pi", "claude-marketplace", "skills-staging"),
  );
});

test("D-04 locationsFor('project') sets commandsStagingDir to <extensionRoot>/commands-staging", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.commandsStagingDir,
    path.join("/my/proj", ".pi", "claude-marketplace", "commands-staging"),
  );
});

test("SK-1 locationsFor('project') sets skillsTargetDir to <extensionRoot>/resources/skills", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.skillsTargetDir,
    path.join("/my/proj", ".pi", "claude-marketplace", "resources", "skills"),
  );
});

test("CM-1 locationsFor('project') sets promptsTargetDir to <extensionRoot>/resources/prompts", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.promptsTargetDir,
    path.join("/my/proj", ".pi", "claude-marketplace", "resources", "prompts"),
  );
});

test("SC-3 ScopedLocations new bridge-target fields are not writable (frozen)", () => {
  const loc = locationsFor("user", "/x") as ScopedLocations & {
    agentsIndexPath: string;
    skillsStagingDir: string;
    commandsStagingDir: string;
    skillsTargetDir: string;
    promptsTargetDir: string;
  };
  assert.throws(() => {
    loc.agentsIndexPath = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.skillsStagingDir = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.commandsStagingDir = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.skillsTargetDir = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.promptsTargetDir = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
});

test("Phase 3 bridge-target dirs are all under extensionRoot (defense-in-depth)", () => {
  const loc = locationsFor("project", "/p");
  // String-prefix containment check: every bridge target lives under
  // extensionRoot. Bridges still call assertPathInside before writing leaf
  // paths under these dirs.
  assert.ok(loc.agentsIndexPath.startsWith(loc.extensionRoot));
  assert.ok(loc.skillsStagingDir.startsWith(loc.extensionRoot));
  assert.ok(loc.commandsStagingDir.startsWith(loc.extensionRoot));
  assert.ok(loc.skillsTargetDir.startsWith(loc.extensionRoot));
  assert.ok(loc.promptsTargetDir.startsWith(loc.extensionRoot));
});
