import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

test("discoverPluginCommands name-sorts the entries WITHIN one directory", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-sort-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });
    // Flat directory, so per-directory sort and whole-array sort agree here.
    // They do NOT agree once a subdirectory is involved: the walk is DFS
    // pre-order, and that order is the D-07 first-wins tiebreak.
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

// ──────────────────────────────────────────────────────────────────────────
// D-141-01: the collision the first-segment elision creates.
// ──────────────────────────────────────────────────────────────────────────

test("D-141-01 discoverPluginCommands folds an elided directory onto its unprefixed twin", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-elide-"));

  try {
    // "acme-tools/lint.md" elides to "acme:tools:lint", the same generated
    // name "tools/lint.md" produces. Sorted order puts "acme-tools" first,
    // so it wins and "tools/lint.md" surfaces as a warning.
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "acme-tools"), { recursive: true });
    await mkdir(path.join(commandsDir, "tools"), { recursive: true });
    await writeFile(path.join(commandsDir, "acme-tools", "lint.md"), "from-acme-tools");
    await writeFile(path.join(commandsDir, "tools", "lint.md"), "from-tools");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.equal(out.length, 1, "both sources elide to one generated name");
    assert.equal(out[0]?.generatedName, "acme:tools:lint");
    assert.equal(
      out[0]?.commandFile,
      path.join(commandsDir, "acme-tools", "lint.md"),
      "sorted order makes 'acme-tools' the winner",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command source "tools\/lint"/);
    assert.match(warnings[0]!, /"acme:tools:lint"/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// An unreadable subdirectory is a warning, not an aborted install.
// ──────────────────────────────────────────────────────────────────────────

test("CM-4 discoverPluginCommands skips an unreadable subdirectory (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block readdir");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-eacces-"));
  const commandsDir = path.join(tmp, "commands");
  const locked = path.join(commandsDir, "locked");
  // `mkdir` runs BEFORE the try: a failure here would leave the `finally`
  // chmod to throw ENOENT on a path that was never created, masking the real
  // error and leaking the temp directory.
  await mkdir(locked, { recursive: true });

  try {
    await writeFile(path.join(locked, "hidden.md"), "unreachable");
    await writeFile(path.join(commandsDir, "readable.md"), "body");
    await chmod(locked, 0o000);

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["readable"],
      "the readable command still installs",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command subdirectory "locked"/);
    assert.match(warnings[0]!, /skipping subdirectory/);
    assert.match(
      warnings[0]!,
      /EACCES/,
      "the errno is what tells the user this is a permission problem",
    );
  } finally {
    await chmod(locked, 0o755);
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// A bad command file name is a warning naming the directory, the source,
// and the reason -- not an aborted install.
// ──────────────────────────────────────────────────────────────────────────

test("CM-4 discoverPluginCommands skips a bad-named command and installs the rest", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-badname-"));

  try {
    // The head segment "acme-." elides to ".", which RN-2 forbids.
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "acme-."), { recursive: true });
    await writeFile(path.join(commandsDir, "acme-.", "lint.md"), "body");
    await writeFile(path.join(commandsDir, "good.md"), "body");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(
      out.map((c) => c.generatedName),
      ["acme:good"],
      "the well-named command still installs",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /"acme-\.\/lint"/, "the warning names the source path");
    assert.ok(warnings[0]!.includes(commandsDir), "the warning names the commands directory");
    assert.match(warnings[0]!, /elided command path head/, "the warning names the reason");
    assert.match(warnings[0]!, /skipping file/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-141-01: the elision fires on the HEAD segment and on no other. A source
// whose head AND leaf both carry the prefix is the only shape that separates
// the head-only rule from an all-segment one.
// ──────────────────────────────────────────────────────────────────────────

test("D-141-01 discoverPluginCommands elides the head segment and leaves the leaf alone", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-headonly-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "acme-tools"), { recursive: true });
    await writeFile(path.join(commandsDir, "acme-tools", "acme-lint.md"), "body");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out } = await discoverPluginCommands({ pluginName: "acme", resolved });

    assert.deepEqual(
      out.map((c) => c.generatedName),
      ["acme:tools:acme-lint"],
      "an all-segment elision would produce acme:tools:lint",
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// The declared commands/ directory is NOT tolerant the way a subdirectory is.
// ──────────────────────────────────────────────────────────────────────────

test("CM-4 discoverPluginCommands reports no commands and no warning for a missing commands/", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-absent-"));

  try {
    // Nothing is created: the declared directory does not exist. ENOENT means
    // "this plugin declares no commands", not "a subdirectory failed".
    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(out, []);
    assert.deepEqual(warnings, [], "an absent commands/ must not warn about anything");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("CM-4 discoverPluginCommands propagates a non-ENOENT failure on commands/ itself (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block readdir");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-baseeacces-"));
  const commandsDir = path.join(tmp, "commands");
  await mkdir(commandsDir, { recursive: true });

  try {
    await writeFile(path.join(commandsDir, "readable.md"), "body");
    await chmod(commandsDir, 0o000);

    const resolved = makeResolved(tmp, "commands");
    const err = await discoverPluginCommands({ pluginName: "acme", resolved }).then(
      () => undefined,
      (e: unknown) => e,
    );

    assert.ok(err instanceof Error, "an unreadable commands/ must fail the install");
    assert.match(err.message, /EACCES/);
  } finally {
    await chmod(commandsDir, 0o755);
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// A readable-but-not-searchable directory: readdir lists the children and
// every lstat on one of them fails.
// ──────────────────────────────────────────────────────────────────────────

test("CM-4 discoverPluginCommands skips a file it cannot lstat (mode 0444, POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only permission failure path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod does not block lstat");
    return;
  }

  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-noexec-"));
  const commandsDir = path.join(tmp, "commands");
  const noExec = path.join(commandsDir, "rx");
  await mkdir(noExec, { recursive: true });

  try {
    await writeFile(path.join(noExec, "b.md"), "unreachable");
    await writeFile(path.join(commandsDir, "readable.md"), "body");
    // Readable but not searchable: readdir succeeds, lstat on each child does not.
    await chmod(noExec, 0o444);

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["readable"],
      "the readable command still installs",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command file "rx\/b\.md"/);
    assert.match(warnings[0]!, /EACCES/);
    assert.match(warnings[0]!, /skipping file/);
  } finally {
    await chmod(noExec, 0o755);
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07 / RN-6: a flat file whose name already carries the colon collides with
// the nested file that generates the same name. Traversal order decides.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 a flat build:web.md loses to a nested build/web.md", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-flatnested-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "build"), { recursive: true });
    await writeFile(path.join(commandsDir, "build", "web.md"), "nested");
    await writeFile(path.join(commandsDir, "build:web.md"), "flat");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    // "build" sorts before "build:web.md", and the walk descends at the point
    // the directory name sorts to, so the nested file is seen first and wins.
    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["build/web"],
      "the nested file wins the first-wins tiebreak",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command source "build:web"/);
    assert.match(warnings[0]!, /already produced by command source "build\/web"/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// A skipped SUBDIRECTORY discards an unbounded number of commands, so it is
// reported. A skipped file discards one and stays silent.
// ──────────────────────────────────────────────────────────────────────────

test("D-14 discoverPluginCommands reports a skipped dotfile subdirectory", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-dotdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, ".hidden"), { recursive: true });
    await writeFile(path.join(commandsDir, ".hidden", "secret.md"), "body");
    await writeFile(path.join(commandsDir, ".dotfile.md"), "body");
    await writeFile(path.join(commandsDir, "good.md"), "body");

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["good"],
    );
    assert.equal(warnings.length, 1, "the dotfile FILE stays silent; the directory does not");
    assert.match(warnings[0]!, /command subdirectory "\.hidden"/);
    assert.match(warnings[0]!, /is dotfile-prefixed/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("D-14 discoverPluginCommands reports a skipped symlinked subdirectory only", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-symdir-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(commandsDir, { recursive: true });
    const outside = path.join(tmp, "outside");
    await mkdir(outside, { recursive: true });
    await writeFile(path.join(outside, "escaped.md"), "body");
    await writeFile(path.join(tmp, "loose.md"), "body");
    await writeFile(path.join(commandsDir, "good.md"), "body");
    await symlink(outside, path.join(commandsDir, "linked"));
    await symlink(path.join(tmp, "loose.md"), path.join(commandsDir, "linked-file.md"));

    const resolved = makeResolved(tmp, "commands");
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved,
    });

    assert.deepEqual(
      out.map((c) => c.sourceName),
      ["good"],
      "neither symlink is followed",
    );
    assert.equal(warnings.length, 1, "the symlinked FILE stays silent; the directory does not");
    assert.match(warnings[0]!, /command subdirectory "linked"/);
    assert.match(warnings[0]!, /is a symlink/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07: two overlapping componentPaths.commands entries reach one file at two
// depths, so it generates two names and the generated-name dedup never sees
// it. Both install; the user is told.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 discoverPluginCommands warns when two entries reach the same file", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-cmds-overlap-"));

  try {
    const commandsDir = path.join(tmp, "commands");
    await mkdir(path.join(commandsDir, "build"), { recursive: true });
    await writeFile(path.join(commandsDir, "build", "web.md"), "body");

    const resolved = makeResolved(tmp, "commands");
    const overlapping = {
      ...resolved,
      componentPaths: { ...resolved.componentPaths, commands: ["commands", "commands/build"] },
    };
    const { discovered: out, warnings } = await discoverPluginCommands({
      pluginName: "acme",
      resolved: overlapping,
    });

    assert.deepEqual(
      out.map((c) => c.generatedName),
      ["acme:build:web", "acme:web"],
      "one file, two names, both installed",
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /command file "commands\/build\/web\.md"/);
    assert.match(warnings[0]!, /"acme:build:web"/);
    assert.match(warnings[0]!, /"acme:web"/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
