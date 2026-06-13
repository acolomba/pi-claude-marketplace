import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  type ScopedLocations,
  locationsFor,
} from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

/**
 * SC-1, SC-2, SC-3, SC-7 -- ScopedLocations brand bundle behavior.
 *
 * SC-1/SC-2: per-scope path layout (user vs project).
 * SC-3: brand-symbol presence + frozen object (cannot mutate scope).
 * SC-7: name-derived path methods route through assertPathInside.
 */

function withPiAgentDir<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.PI_CODING_AGENT_DIR;

  if (value === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = value;
  }

  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previous;
    }
  }
}

test("SC-1 / SC-2 locationsFor('user') returns Pi agent dir default paths", () => {
  withPiAgentDir(undefined, () => {
    const loc = locationsFor("user", "/anywhere");
    assert.equal(loc.scope, "user");
    assert.equal(loc.scopeRoot, path.join(os.homedir(), ".pi", "agent"));
    assert.ok(loc.extensionRoot.endsWith(path.join(".pi", "agent", "pi-claude-marketplace")));
    assert.ok(loc.stateJsonPath.endsWith("state.json"));
    assert.ok(loc.agentsDir.endsWith(path.join(".pi", "agent", "agents")));
    assert.ok(loc.mcpJsonPath.endsWith(path.join(".pi", "agent", "mcp.json")));
    // CFG-01: config paths sit under scopeRoot at the same tier as mcp.json.
    assert.ok(loc.configJsonPath.endsWith(path.join(".pi", "agent", "claude-plugins.json")));
    assert.ok(loc.configJsonPath.startsWith(loc.scopeRoot));
    assert.ok(
      loc.configLocalJsonPath.endsWith(path.join(".pi", "agent", "claude-plugins.local.json")),
    );
    assert.ok(loc.configLocalJsonPath.startsWith(loc.scopeRoot));
  });
});

test("SC-1 / SC-2 locationsFor('user') honors PI_CODING_AGENT_DIR", () => {
  withPiAgentDir(path.join("/tmp", "pi-home", "agent"), () => {
    const loc = locationsFor("user", "/anywhere");
    assert.equal(loc.scope, "user");
    assert.equal(loc.scopeRoot, path.join("/tmp", "pi-home", "agent"));
    assert.equal(loc.extensionRoot, path.join("/tmp", "pi-home", "agent", "pi-claude-marketplace"));
    assert.equal(loc.agentsDir, path.join("/tmp", "pi-home", "agent", "agents"));
    assert.equal(loc.mcpJsonPath, path.join("/tmp", "pi-home", "agent", "mcp.json"));
    // CFG-01: configJsonPath / configLocalJsonPath under scopeRoot (sibling of mcp.json).
    assert.equal(loc.configJsonPath, path.join("/tmp", "pi-home", "agent", "claude-plugins.json"));
    assert.equal(
      loc.configLocalJsonPath,
      path.join("/tmp", "pi-home", "agent", "claude-plugins.local.json"),
    );
  });
});

test("SC-1 / SC-2 locationsFor('project', cwd) returns <cwd>/.pi/ paths", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(loc.scope, "project");
  assert.equal(loc.scopeRoot, path.join("/my/proj", ".pi"));
  assert.equal(loc.extensionRoot, path.join("/my/proj", ".pi", "pi-claude-marketplace"));
  assert.equal(
    loc.stateJsonPath,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "state.json"),
  );
  assert.equal(loc.agentsDir, path.join("/my/proj", ".pi", "agents"));
  assert.equal(loc.mcpJsonPath, path.join("/my/proj", ".pi", "mcp.json"));
  // CFG-01: config paths sit under scopeRoot (.pi), NOT under extensionRoot.
  assert.equal(loc.configJsonPath, path.join("/my/proj", ".pi", "claude-plugins.json"));
  assert.equal(loc.configLocalJsonPath, path.join("/my/proj", ".pi", "claude-plugins.local.json"));
});

test("CFG-01 ScopedLocations config fields are not writable (frozen)", () => {
  const loc = locationsFor("user", "/x") as ScopedLocations & {
    configJsonPath: string;
    configLocalJsonPath: string;
  };
  assert.throws(() => {
    loc.configJsonPath = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.configLocalJsonPath = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
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

// D-07 corollary: assertSafeName is the upstream gate inside each helper
// (Rule 2 mitigation for T-5-09). Names containing path separators "/" /
// "\", traversal segments "." / "..", or control chars are rejected at the
// input boundary BEFORE assertPathInside fires. The downstream
// PathContainmentError is therefore unreachable for these particular escape
// inputs; the upstream Error suffices to refuse.
test("SC-7 pluginDataDir('../escape', 'p') throws (upstream assertSafeName rejects '..' name)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(
    () => loc.pluginDataDir("../escape", "plugin"),
    /must not contain path separators|must not be|must not contain ASCII control/,
  );
});

test("SC-7 marketplaceDataDir('../escape') throws (upstream assertSafeName rejects '/' name)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(
    () => loc.marketplaceDataDir("../escape"),
    /must not contain path separators|must not be|must not contain ASCII control/,
  );
});

test("SC-7 sourceCloneDir('../../etc') throws (upstream assertSafeName rejects '/' name)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(
    () => loc.sourceCloneDir("../../etc"),
    /must not contain path separators|must not be|must not contain ASCII control/,
  );
});

test("SC-7 pluginDataDir('mp', 'plugin') happy path returns under dataRoot", async () => {
  const loc = locationsFor("project", "/p");
  const got = await loc.pluginDataDir("mp", "plugin");
  assert.ok(got.startsWith(loc.dataRoot));
  assert.ok(got.endsWith(path.join("mp", "plugin")));
});

// ──────────────────────────────────────────────────────────────────────────
// T-5-09: pluginDataDir name-input containment coverage.
//
// assertPathInside alone does NOT catch a plugin name like "p/sub" because
// path.join("dataRoot", "mp", "p/sub") -> "dataRoot/mp/p/sub" -- which
// IS inside dataRoot, just nested one level too deep. The upstream
// assertSafeName gate inside pluginDataDir refuses every separator-bearing
// input regardless of dataRoot containment.
// ──────────────────────────────────────────────────────────────────────────

test("T-5-09 pluginDataDir refuses plugin name with '/' separator (upstream assertSafeName)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("ok", "p/sub"), /must not contain path separators/);
});

test("T-5-09 pluginDataDir refuses plugin name with '\\\\' separator (upstream assertSafeName)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("ok", "p\\sub"), /must not contain path separators/);
});

test("T-5-09 pluginDataDir refuses marketplace name with '/' separator (upstream assertSafeName)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("a/b", "ok"), /must not contain path separators/);
});

test("T-5-09 pluginDataDir refuses marketplace name with '\\\\' separator (upstream assertSafeName)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("a\\b", "ok"), /must not contain path separators/);
});

test("T-5-09 pluginDataDir refuses '.' plugin name", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("ok", "."), /must not be/);
});

test("T-5-09 pluginDataDir refuses '..' marketplace name (without separator)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("..", "p"), /must not be/);
});

test("T-5-09 pluginDataDir refuses empty plugin name", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("ok", ""), /must be a non-empty string/);
});

test("T-5-09 pluginDataDir refuses control-char plugin name", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginDataDir("ok", "p\x00sub"), /must not contain ASCII control/);
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
// Bridge-target paths on ScopedLocations: agentsIndexPath, skillsStagingDir,
// commandsStagingDir, skillsTargetDir, promptsTargetDir.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 locationsFor('user') sets agentsIndexPath to <extensionRoot>/agents-index.json", () => {
  const loc = locationsFor("user", "/anywhere");
  assert.equal(loc.agentsIndexPath, path.join(loc.extensionRoot, "agents-index.json"));
});

test("D-07 locationsFor('project') sets agentsIndexPath under <extensionRoot>", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.agentsIndexPath,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "agents-index.json"),
  );
});

test("D-04 locationsFor('project') sets skillsStagingDir to <extensionRoot>/skills-staging", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.skillsStagingDir,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "skills-staging"),
  );
});

test("D-04 locationsFor('project') sets commandsStagingDir to <extensionRoot>/commands-staging", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.commandsStagingDir,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "commands-staging"),
  );
});

test("SK-1 locationsFor('project') sets skillsTargetDir to <extensionRoot>/resources/skills", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.skillsTargetDir,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "resources", "skills"),
  );
});

test("CM-1 locationsFor('project') sets promptsTargetDir to <extensionRoot>/resources/prompts", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.promptsTargetDir,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "resources", "prompts"),
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

test("bridge-target dirs are all under extensionRoot (defense-in-depth)", () => {
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

// ──────────────────────────────────────────────────────────────────────────
// D-03 completion-cache path helpers:
// cacheDir, marketplaceNamesCacheFile, pluginCacheFile.
// ──────────────────────────────────────────────────────────────────────────

test("D-03 locationsFor('project') sets cacheDir to <extensionRoot>/cache", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(loc.cacheDir, path.join("/my/proj", ".pi", "pi-claude-marketplace", "cache"));
  assert.ok(loc.cacheDir.startsWith(loc.extensionRoot));
});

test("D-03 locationsFor('user') sets cacheDir under user extensionRoot", () => {
  const loc = locationsFor("user", "/anywhere");
  assert.ok(loc.cacheDir.endsWith(path.join(".pi", "agent", "pi-claude-marketplace", "cache")));
  assert.ok(loc.cacheDir.startsWith(loc.extensionRoot));
});

test("D-03 locationsFor('project') sets marketplaceNamesCacheFile to <cacheDir>/marketplace-names.json", () => {
  const loc = locationsFor("project", "/my/proj");
  assert.equal(
    loc.marketplaceNamesCacheFile,
    path.join("/my/proj", ".pi", "pi-claude-marketplace", "cache", "marketplace-names.json"),
  );
  assert.ok(loc.marketplaceNamesCacheFile.startsWith(loc.cacheDir));
});

test("D-03 pluginCacheFile('safe-name') happy path returns under cacheDir/plugins", async () => {
  const loc = locationsFor("project", "/p");
  const got = await loc.pluginCacheFile("safe-name");
  assert.ok(got.startsWith(loc.cacheDir));
  assert.equal(got, path.join(loc.cacheDir, "plugins", "safe-name.json"));
});

test("D-03 pluginCacheFile('../../etc') refused by upstream assertSafeName (T-EDGE-5b)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(
    () => loc.pluginCacheFile("../../etc"),
    /must not contain path separators|must not be|must not contain ASCII control/,
  );
});

test("D-03 pluginCacheFile refuses '/' separator (T-EDGE-5b)", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginCacheFile("a/b"), /must not contain path separators/);
});

test("D-03 pluginCacheFile refuses empty name", async () => {
  const loc = locationsFor("project", "/p");
  await assert.rejects(() => loc.pluginCacheFile(""), /must be a non-empty string/);
});

test("SC-3 ScopedLocations cache fields are not writable (frozen)", () => {
  const loc = locationsFor("user", "/x") as ScopedLocations & {
    cacheDir: string;
    marketplaceNamesCacheFile: string;
  };
  assert.throws(() => {
    loc.cacheDir = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
  assert.throws(() => {
    loc.marketplaceNamesCacheFile = "/tmp/evil";
  }, /Cannot assign to read only property|object is not extensible/);
});
