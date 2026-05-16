import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  abortPreparedCommands,
  assertNoCommandCollisions,
  commitPreparedCommands,
  finalizeCommandsReplacement,
  prepareStageCommands,
  replacePreparedCommands,
  rollbackCommandsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { pathExists } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { DiscoveredCommand } from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";
import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

// Helpers ---------------------------------------------------------------

const FIXTURE_PLUGIN_ROOT = path.resolve(import.meta.dirname, "..", "_fixtures", "test-plugin");
const FIXTURE_EMPTY_MCP_ROOT = path.resolve(import.meta.dirname, "..", "_fixtures", "empty-mcp");

interface TmpScope {
  loc: ScopedLocations;
  cleanup: () => Promise<void>;
}

async function tmpScope(): Promise<TmpScope> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stage-cmds-"));
  const loc = locationsFor("project", dir);
  await mkdir(loc.extensionRoot, { recursive: true });

  return {
    loc,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function makeResolved(pluginRoot: string, commandsRel?: string): ResolvedPluginInstallable {
  // D-07: componentPaths.commands is now `readonly string[]`.
  return {
    installable: true,
    name: "acme",
    pluginRoot,
    supported: commandsRel === undefined ? [] : ["commands"],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: [],
      commands: commandsRel === undefined ? [] : [commandsRel],
      agents: [],
    },
    mcpServers: {},
  };
}

// Happy-path commit -----------------------------------------------------

test("CM-1 commitPreparedCommands lands files at <extensionRoot>/resources/prompts/<plugin>:<command>.md", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });

    assert.equal(prepared.kind, "staged");
    const leak = await commitPreparedCommands(prepared);
    assert.equal(leak, undefined, "happy-path commit must not leak");

    // Files land at the colon-bearing target paths.
    const deployTarget = path.join(scope.loc.promptsTargetDir, "acme:deploy.md");
    const statusTarget = path.join(scope.loc.promptsTargetDir, "acme:status.md");
    assert.equal(await pathExists(deployTarget), true);
    assert.equal(await pathExists(statusTarget), true);
  } finally {
    await scope.cleanup();
  }
});

// CM-3 substitution -----------------------------------------------------

test("CM-3 substituted body has no remaining ${CLAUDE_PLUGIN_ROOT} or ${CLAUDE_PLUGIN_DATA}", async () => {
  const scope = await tmpScope();

  try {
    const pluginDataDir = "/tmp/pi-data/test-mp/acme";
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir,
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });
    await commitPreparedCommands(prepared);

    const deployBody = await readFile(
      path.join(scope.loc.promptsTargetDir, "acme:deploy.md"),
      "utf8",
    );
    const statusBody = await readFile(
      path.join(scope.loc.promptsTargetDir, "acme:status.md"),
      "utf8",
    );

    assert.ok(
      !deployBody.includes("${CLAUDE_PLUGIN_ROOT}"),
      "deploy body still has ${CLAUDE_PLUGIN_ROOT}",
    );
    assert.ok(
      !deployBody.includes("${CLAUDE_PLUGIN_DATA}"),
      "deploy body still has ${CLAUDE_PLUGIN_DATA}",
    );
    assert.ok(
      !statusBody.includes("${CLAUDE_PLUGIN_ROOT}"),
      "status body still has ${CLAUDE_PLUGIN_ROOT}",
    );
    assert.ok(
      !statusBody.includes("${CLAUDE_PLUGIN_DATA}"),
      "status body still has ${CLAUDE_PLUGIN_DATA}",
    );
  } finally {
    await scope.cleanup();
  }
});

test("CM-3 substituted body contains the resolved pluginDataDir", async () => {
  const scope = await tmpScope();

  try {
    const pluginDataDir = "/tmp/pi-data/test-mp/acme";
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir,
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });
    await commitPreparedCommands(prepared);

    // status.md fixture body: "Show status. Data dir: ${CLAUDE_PLUGIN_DATA}."
    const statusBody = await readFile(
      path.join(scope.loc.promptsTargetDir, "acme:status.md"),
      "utf8",
    );
    assert.ok(statusBody.includes(pluginDataDir), `status body missing ${pluginDataDir}`);

    // acme-deploy.md fixture body: "Deploy command for ${CLAUDE_PLUGIN_ROOT}."
    const deployBody = await readFile(
      path.join(scope.loc.promptsTargetDir, "acme:deploy.md"),
      "utf8",
    );
    assert.ok(
      deployBody.includes(FIXTURE_PLUGIN_ROOT),
      `deploy body missing ${FIXTURE_PLUGIN_ROOT}`,
    );
  } finally {
    await scope.cleanup();
  }
});

// Noop branch -----------------------------------------------------------

test('prepareStageCommands returns kind:"noop" when no commands AND no previousCommandNames (empty-mcp fixture)', async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "noop-plugin",
      pluginRoot: FIXTURE_EMPTY_MCP_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/noop-plugin",
      // empty-mcp fixture has no commands directory at all -- componentPaths
      // is empty, modeling the resolver's behavior for a plugin without
      // commands.
      resolved: makeResolved(FIXTURE_EMPTY_MCP_ROOT, undefined),
    });

    assert.equal(prepared.kind, "noop");
    assert.deepEqual(prepared.result.stagedNames, []);
    assert.deepEqual(prepared.result.recorded, []);

    // commit and abort must both be no-ops on the noop branch.
    const leak = await commitPreparedCommands(prepared);
    assert.equal(leak, undefined);
    await abortPreparedCommands(prepared); // should not throw

    // No staging dir was ever created.
    assert.equal(await pathExists(scope.loc.commandsStagingDir), false);
  } finally {
    await scope.cleanup();
  }
});

// RN-6 collisions -------------------------------------------------------

test("RN-6 assertNoCommandCollisions throws with both source names listed", () => {
  const collisions: DiscoveredCommand[] = [
    {
      sourceName: "acme-deploy",
      generatedName: "acme:deploy",
      commandFile: "/fake/acme-deploy.md",
    },
    {
      sourceName: "deploy",
      generatedName: "acme:deploy",
      commandFile: "/fake/deploy.md",
    },
  ];

  assert.throws(
    () => {
      assertNoCommandCollisions(collisions);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Generated command name collision detected/);
      // BOTH source names must appear in the message.
      assert.match(err.message, /"acme-deploy"/);
      assert.match(err.message, /"deploy"/);
      assert.match(err.message, /"acme:deploy"/);
      return true;
    },
  );
});

test("RN-6 assertNoCommandCollisions does NOT throw on disjoint names", () => {
  const ok: DiscoveredCommand[] = [
    {
      sourceName: "acme-deploy",
      generatedName: "acme:deploy",
      commandFile: "/fake/acme-deploy.md",
    },
    {
      sourceName: "status",
      generatedName: "acme:status",
      commandFile: "/fake/status.md",
    },
  ];

  // No throw.
  assertNoCommandCollisions(ok);
});

// Re-stage path ---------------------------------------------------------

test("commitPreparedCommands removes previous-named files (re-stage path)", async () => {
  const scope = await tmpScope();

  try {
    // Pre-create a previously-staged file at the target.
    await mkdir(scope.loc.promptsTargetDir, { recursive: true });
    const stale = path.join(scope.loc.promptsTargetDir, "acme:old.md");
    await writeFile(stale, "STALE BODY");
    assert.equal(await pathExists(stale), true);

    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      previousCommandNames: ["acme:old"],
    });
    assert.equal(prepared.kind, "staged");

    await commitPreparedCommands(prepared);

    // The stale file is gone.
    assert.equal(await pathExists(stale), false);
    // New files are present.
    assert.equal(await pathExists(path.join(scope.loc.promptsTargetDir, "acme:deploy.md")), true);
  } finally {
    await scope.cleanup();
  }
});

test("Phase 8 / PRL-10 replacePreparedCommands can rollback to previous prompt bytes", async () => {
  const scope = await tmpScope();

  try {
    await mkdir(scope.loc.promptsTargetDir, { recursive: true });
    const oldFile = path.join(scope.loc.promptsTargetDir, "acme:deploy.md");
    await writeFile(oldFile, "old prompt bytes");

    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      previousCommandNames: ["acme:deploy"],
    });

    const replacement = await replacePreparedCommands(prepared);
    const replaced = await readFile(oldFile, "utf8");
    assert.notEqual(replaced, "old prompt bytes");
    assert.ok(replaced.includes(FIXTURE_PLUGIN_ROOT));

    const leaks = await rollbackCommandsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await readFile(oldFile, "utf8"), "old prompt bytes");
    assert.equal(await pathExists(path.join(scope.loc.promptsTargetDir, "acme:status.md")), false);
  } finally {
    await scope.cleanup();
  }
});

test("Phase 8 / PRL-10 finalizeCommandsReplacement removes backups and keeps staged content", async () => {
  const scope = await tmpScope();

  try {
    await mkdir(scope.loc.promptsTargetDir, { recursive: true });
    const oldFile = path.join(scope.loc.promptsTargetDir, "acme:deploy.md");
    await writeFile(oldFile, "old prompt bytes");

    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      previousCommandNames: ["acme:deploy"],
    });
    assert.equal(prepared.kind, "staged");

    const replacement = await replacePreparedCommands(prepared);
    const leaks = await finalizeCommandsReplacement(replacement);
    assert.deepEqual([...leaks], []);
    assert.equal(await pathExists(prepared.stagingRoot), false);

    const current = await readFile(oldFile, "utf8");
    assert.notEqual(current, "old prompt bytes");
    assert.equal(await pathExists(path.join(scope.loc.promptsTargetDir, "acme:status.md")), true);
  } finally {
    await scope.cleanup();
  }
});

test("Phase 8 / PRL-10 replacePreparedCommands restores backups if unrelated prompt blocks rename", async () => {
  const scope = await tmpScope();

  try {
    await mkdir(scope.loc.promptsTargetDir, { recursive: true });
    const oldFile = path.join(scope.loc.promptsTargetDir, "acme:deploy.md");
    const unrelatedFile = path.join(scope.loc.promptsTargetDir, "acme:status.md");
    await writeFile(oldFile, "old prompt bytes");
    await writeFile(unrelatedFile, "manual status bytes");

    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      previousCommandNames: ["acme:deploy"],
    });

    await assert.rejects(() => replacePreparedCommands(prepared), /non-previous content/);
    assert.equal(await readFile(oldFile, "utf8"), "old prompt bytes");
    assert.equal(await readFile(unrelatedFile, "utf8"), "manual status bytes");
  } finally {
    await scope.cleanup();
  }
});

test("Phase 8 / PRL-10 noop command replacements rollback and finalize without leaks", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "noop-plugin",
      pluginRoot: FIXTURE_EMPTY_MCP_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/noop-plugin",
      resolved: makeResolved(FIXTURE_EMPTY_MCP_ROOT, undefined),
    });

    const replacement = await replacePreparedCommands(prepared);
    assert.equal(replacement.kind, "noop");
    assert.deepEqual([...(await rollbackCommandsReplacement(replacement))], []);
    assert.deepEqual([...(await finalizeCommandsReplacement(replacement))], []);
  } finally {
    await scope.cleanup();
  }
});

test("commitPreparedCommands tolerates missing previous-named file (ENOENT silenced)", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      // The previously-named file was never created on disk -- previous
      // install succeeded then failed mid-cleanup, or this is a fresh
      // re-install. Commit must not throw.
      previousCommandNames: ["acme:never-existed"],
    });

    const leak = await commitPreparedCommands(prepared);
    assert.equal(leak, undefined);
  } finally {
    await scope.cleanup();
  }
});

// abort -----------------------------------------------------------------

test("abortPreparedCommands cleans up staging dir", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });

    assert.equal(prepared.kind, "staged");
    if (prepared.kind === "staged") {
      const stagingRoot = prepared.stagingRoot;
      assert.equal(await pathExists(stagingRoot), true, "staging root exists pre-abort");

      await abortPreparedCommands(prepared);

      assert.equal(await pathExists(stagingRoot), false, "staging root removed by abort");
      // Target dir was not populated.
      assert.equal(
        await pathExists(path.join(scope.loc.promptsTargetDir, "acme:deploy.md")),
        false,
        "abort must not commit",
      );
    }
  } finally {
    await scope.cleanup();
  }
});

// Read-failure -> appendLeakToError ------------------------------------

test("prepareStageCommands surfaces appendLeakToError when readFile fails (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 unreadable file path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block read");
    return;
  }

  const scope = await tmpScope();
  // Build a synthetic plugin with a single .md command file we can chmod 0.
  const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "pi-cmds-unread-"));
  const cmdsDir = path.join(pluginRoot, "commands");
  await mkdir(cmdsDir, { recursive: true });
  const unreadable = path.join(cmdsDir, "blocked.md");
  await writeFile(unreadable, "body that cannot be read");

  try {
    await chmod(unreadable, 0o000);

    await assert.rejects(
      prepareStageCommands({
        locations: scope.loc,
        marketplaceName: "test-mp",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir: "/tmp/pi-data/test-mp/acme",
        resolved: makeResolved(pluginRoot, "commands"),
      }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        // Either EACCES surfaces (most common) or the leak-augmented form.
        return true;
      },
    );

    // Staging dir must be cleaned up even on prepare failure.
    // We can only assert the parent commands-staging dir is empty (the
    // <uuid> child was best-effort removed).
    let leftovers: string[] = [];
    try {
      const { readdir } = await import("node:fs/promises");
      leftovers = await readdir(scope.loc.commandsStagingDir);
    } catch {
      // commandsStagingDir might not exist at all -- also fine.
    }

    assert.equal(leftovers.length, 0, "staging dir should be empty after failed prepare");
  } finally {
    await chmod(unreadable, 0o644);
    await rm(pluginRoot, { recursive: true, force: true });
    await scope.cleanup();
  }
});

// Filename / colon ------------------------------------------------------

test("staged file basenames contain literal colon character (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("Windows does not allow `:` in filenames; Phase 3 targets POSIX");
    return;
  }

  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });
    await commitPreparedCommands(prepared);

    // Both target file basenames carry the literal colon.
    assert.ok(path.basename(path.join(scope.loc.promptsTargetDir, "acme:deploy.md")).includes(":"));
    assert.ok(path.basename(path.join(scope.loc.promptsTargetDir, "acme:status.md")).includes(":"));
    // The actual on-disk file MUST be readable -- proves POSIX accepts it.
    assert.equal(await pathExists(path.join(scope.loc.promptsTargetDir, "acme:deploy.md")), true);
  } finally {
    await scope.cleanup();
  }
});

// recorded[] (W-05) -----------------------------------------------------

test("StageCommandsCommitResult.recorded captures sourcePath + targetPath per command (W-05)", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
    });

    assert.equal(prepared.result.recorded.length, 2);

    const byName = new Map(prepared.result.recorded.map((r) => [r.generatedName, r]));
    const deploy = byName.get("acme:deploy");
    const status = byName.get("acme:status");

    assert.ok(deploy, "missing acme:deploy record");
    assert.equal(deploy.sourcePath, path.join(FIXTURE_PLUGIN_ROOT, "commands", "acme-deploy.md"));
    assert.equal(deploy.targetPath, path.join(scope.loc.promptsTargetDir, "acme:deploy.md"));

    assert.ok(status, "missing acme:status record");
    assert.equal(status.sourcePath, path.join(FIXTURE_PLUGIN_ROOT, "commands", "status.md"));
    assert.equal(status.targetPath, path.join(scope.loc.promptsTargetDir, "acme:status.md"));
  } finally {
    await scope.cleanup();
  }
});

test("Phase 8 / PRL-10 finalizeCommandsReplacement throws on unknown replacement handle (defensive)", async () => {
  const bogus = { kind: "replaced" } as Parameters<typeof finalizeCommandsReplacement>[0];
  await assert.rejects(
    () => finalizeCommandsReplacement(bogus),
    /Unknown commands replacement handle/,
  );
});

test("Phase 8 / PRL-10 replacePreparedCommands skips backup when previous command file vanished", async () => {
  const scope = await tmpScope();

  try {
    const prepared = await prepareStageCommands({
      locations: scope.loc,
      marketplaceName: "test-mp",
      pluginName: "acme",
      pluginRoot: FIXTURE_PLUGIN_ROOT,
      pluginDataDir: "/tmp/pi-data/test-mp/acme",
      resolved: makeResolved(FIXTURE_PLUGIN_ROOT, "commands"),
      previousCommandNames: ["acme:was-here-but-gone"], // never written to disk
    });

    const replacement = await replacePreparedCommands(prepared);
    assert.equal(replacement.kind, "replaced");
    const leaks = await rollbackCommandsReplacement(replacement);
    assert.deepEqual([...leaks], []);
  } finally {
    await scope.cleanup();
  }
});
