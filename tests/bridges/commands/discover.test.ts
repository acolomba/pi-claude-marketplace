import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverPluginCommands } from "../../../extensions/claude-marketplace/bridges/commands/discover.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/claude-marketplace/domain/resolver.ts";

// Helpers ---------------------------------------------------------------

/** Builds a minimal `ResolvedPluginInstallable` for discover tests. */
function makeResolved(
  pluginRoot: string,
  commandsRel: string | undefined,
): ResolvedPluginInstallable {
  return {
    installable: true,
    name: "acme",
    pluginRoot,
    supported: commandsRel === undefined ? [] : ["commands"],
    unsupported: [],
    notes: [],
    componentPaths: commandsRel === undefined ? {} : { commands: commandsRel },
    mcpServers: {},
  };
}

const FIXTURE_PLUGIN_ROOT = path.resolve(import.meta.dirname, "..", "_fixtures", "test-plugin");

// CM-4: flat *.md only --------------------------------------------------

test("CM-4 discoverPluginCommands enumerates flat *.md only (test-plugin fixture)", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");

  const out = await discoverPluginCommands({ pluginName: "acme", resolved });

  assert.equal(out.length, 2, "expected exactly 2 .md commands in fixture");
  const names = out.map((c) => c.sourceName);
  assert.deepEqual(names, ["acme-deploy", "status"]);
});

test("CM-4 discoverPluginCommands ignores non-md files", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-nonmd-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(path.join(commandsDir, "real.md"), "body");
    await writeFile(path.join(commandsDir, "README.txt"), "ignored");
    await writeFile(path.join(commandsDir, "config.json"), "{}");

    const resolved = makeResolved(tmp, "commands");
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.equal(out.length, 1, "only the .md file should be discovered");
    assert.equal(out[0]?.sourceName, "real");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("CM-4 discoverPluginCommands does NOT recurse into subdirs", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-subdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "subdir"), { recursive: true });
    await writeFile(path.join(commandsDir, "top.md"), "top body");
    await writeFile(path.join(commandsDir, "subdir", "nested.md"), "nested body");

    const resolved = makeResolved(tmp, "commands");
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.equal(out.length, 1, "subdir entries must be skipped");
    assert.equal(out[0]?.sourceName, "top");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// CM-2: elision behavior ------------------------------------------------

test("CM-2 generated name elides plugin prefix when source starts with `<plugin>-`", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");
  const out = await discoverPluginCommands({ pluginName: "acme", resolved });

  const elided = out.find((c) => c.sourceName === "acme-deploy");
  assert.ok(elided, "fixture missing acme-deploy.md");
  assert.equal(elided.generatedName, "acme:deploy");
});

test("CM-2 generated name has plain `<plugin>:` prefix when source has no plugin prefix", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");
  const out = await discoverPluginCommands({ pluginName: "acme", resolved });

  const plain = out.find((c) => c.sourceName === "status");
  assert.ok(plain, "fixture missing status.md");
  assert.equal(plain.generatedName, "acme:status");
});

// Edge cases ------------------------------------------------------------

test("discoverPluginCommands returns [] when commands dir missing (ENOENT graceful)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-missing-"));

  try {
    // Point componentPaths.commands at a path that does not exist.
    const resolved = makeResolved(tmp, "commands"); // tmp/commands -- never created
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.deepEqual(out, []);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("discoverPluginCommands returns sorted output by sourceName", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-sort-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });
    // Intentionally create out-of-order names.
    await writeFile(path.join(commandsDir, "zebra.md"), "z");
    await writeFile(path.join(commandsDir, "alpha.md"), "a");
    await writeFile(path.join(commandsDir, "middle.md"), "m");

    const resolved = makeResolved(tmp, "commands");
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["alpha", "middle", "zebra"],
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("discoverPluginCommands skips dotfile-prefixed entries", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-dot-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(path.join(commandsDir, ".hidden.md"), "hidden");
    await writeFile(path.join(commandsDir, "visible.md"), "visible");

    const resolved = makeResolved(tmp, "commands");
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.equal(out.length, 1);
    assert.equal(out[0]?.sourceName, "visible");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("discoverPluginCommands refuses symlinked .md entries (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("symlink semantics differ on Windows; targeting POSIX");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-symlink-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });

    // Real source the link points to (also under tmp -- so the link target
    // is itself benign; the bridge refuses on principle, not because of
    // containment).
    const real = path.join(tmp, "real-target.md");
    await writeFile(real, "body");
    await symlink(real, path.join(commandsDir, "linked.md"));

    // Plus a real (non-symlink) .md file that should be discovered.
    await writeFile(path.join(commandsDir, "real-cmd.md"), "real");

    const resolved = makeResolved(tmp, "commands");
    const out = await discoverPluginCommands({ pluginName: "acme", resolved });

    const names = out.map((c) => c.sourceName);
    assert.ok(!names.includes("linked"), "symlinked .md must be skipped");
    assert.ok(names.includes("real-cmd"), "non-symlink .md must be present");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
