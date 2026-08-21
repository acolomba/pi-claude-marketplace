import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverPluginCommands } from "../../../extensions/pi-claude-marketplace/bridges/commands/discover.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

// Helpers ---------------------------------------------------------------

/** Builds a minimal `ResolvedPluginInstallable` for discover tests. */
function makeResolved(
  pluginRoot: string,
  commandsRel: string | undefined,
): ResolvedPluginInstallable {
  // D-07: componentPaths.commands is `readonly string[]`.
  return {
    state: "installable",
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
    defaultEnabled: true,
  };
}

const FIXTURE_PLUGIN_ROOT = path.resolve(import.meta.dirname, "..", "_fixtures", "test-plugin");

// CM-4: recursive *.md discovery -----------------------------------------

test("CM-4 discoverPluginCommands enumerates *.md files (test-plugin fixture, flat)", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");

  const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

  // Fixture has only flat files (no subdirs), so recursion is a no-op here.
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
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.equal(out.length, 1, "only the .md file should be discovered");
    assert.equal(out[0]?.sourceName, "real");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("CM-4 discoverPluginCommands recurses into subdirs (sourceName is the relative path)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-subdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "build", "web"), { recursive: true });
    await writeFile(path.join(commandsDir, "top.md"), "top body");
    await writeFile(path.join(commandsDir, "build", "web.md"), "web body");
    await writeFile(path.join(commandsDir, "build", "web", "prod.md"), "prod body");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    // sourceName is the relative path from commands/ minus .md; generatedName
    // joins plugin + segments with ':'. Entries are name-sorted at each
    // level, and "web" (dir) sorts before "web.md" (file) because the shorter
    // name is a prefix -- so build/web/prod is visited before build/web.
    // This mirrors the real layout (a `pipeline/` dir beside a `pipeline.md`).
    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["build/web/prod", "build/web", "top"],
    );
    assert.deepEqual(
      out.map((c) => c.generatedName),
      ["acme:build:web:prod", "acme:build:web", "acme:top"],
    );
    assert.equal(
      out.find((c) => c.sourceName === "build/web/prod")?.commandFile,
      path.join(commandsDir, "build", "web", "prod.md"),
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("CM-4 discoverPluginCommands skips dotfile-prefixed subdirectories", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-dotdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, ".hidden"), { recursive: true });
    await mkdir(path.join(commandsDir, "build"), { recursive: true });
    await writeFile(path.join(commandsDir, ".hidden", "secret.md"), "secret");
    await writeFile(path.join(commandsDir, "build", "visible.md"), "visible");
    await writeFile(path.join(commandsDir, "root.md"), "root");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["build/visible", "root"],
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("CM-4 discoverPluginCommands refuses symlinked subdirectories (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("symlink semantics differ on Windows; targeting POSIX");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-symlinkdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });

    // A real tree outside commands/ that a symlinked subdir points at. The
    // bridge must NOT follow the link, or escaped.md would be discovered.
    const outside = path.join(tmp, "outside");
    await mkdir(path.join(outside, "linked"), { recursive: true });
    await writeFile(path.join(outside, "linked", "escaped.md"), "escaped");
    await symlink(outside, path.join(commandsDir, "linked"));

    await writeFile(path.join(commandsDir, "real.md"), "real");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    const names = out.map((c) => c.sourceName);
    assert.ok(!names.some((n) => n.startsWith("linked/")), "symlinked subdir must not be followed");
    assert.ok(names.includes("real"), "non-symlinked .md must be present");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// CM-2: elision behavior ------------------------------------------------

test("CM-2 generated name elides plugin prefix when source starts with `<plugin>-`", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");
  const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

  const elided = out.find((c) => c.sourceName === "acme-deploy");
  assert.ok(elided, "fixture missing acme-deploy.md");
  assert.equal(elided.generatedName, "acme:deploy");
});

test("CM-2 generated name has plain `<plugin>:` prefix when source has no plugin prefix", async () => {
  const resolved = makeResolved(FIXTURE_PLUGIN_ROOT, "commands");
  const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

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
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.deepEqual([...out], []);
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
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

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
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

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
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    const names = out.map((c) => c.sourceName);
    assert.ok(!names.includes("linked"), "symlinked .md must be skipped");
    assert.ok(names.includes("real-cmd"), "non-symlink .md must be present");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07 (COMP-01): multi-element componentPaths.commands.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 discoverPluginCommands iterates multi-element componentPaths.commands (no collision)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-multi-"));

  try {
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, "one.md"), "body-a");
    await writeFile(path.join(b, "two.md"), "body-b");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["commands"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [a, b], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    const names = out.map((c) => c.sourceName).sort();
    assert.deepEqual(names, ["one", "two"]);
    assert.deepEqual([...warnings], [], "no warnings when generated names disjoint");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("D-07 discoverPluginCommands first-wins dedup across array elements (collision -> warning)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-dedup-"));

  try {
    // Both dirs contain `shared.md`. They elide to generated name
    // "acme:shared". First-wins keeps dir `a`; dir `b` surfaces a warning.
    const a = path.join(tmp, "a");
    const b = path.join(tmp, "b");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(path.join(a, "shared.md"), "from-a");
    await writeFile(path.join(b, "shared.md"), "from-b");

    const resolved: ResolvedPluginInstallable = {
      state: "installable",
      name: "acme",
      pluginRoot: tmp,
      supported: ["commands"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [a, b], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    };
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.equal(out.length, 1, "first-wins keeps only one");
    assert.equal(out[0]!.commandFile, path.join(a, "shared.md"), "dir 'a' wins");
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /elides to generated name "acme:shared"/);
    assert.match(warnings[0]!, /ignoring duplicate/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
