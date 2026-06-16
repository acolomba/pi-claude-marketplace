import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeHookConfig } from "../../../extensions/pi-claude-marketplace/bridges/hooks/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

// LIFE-03: the hooks bridge MUST reject any symlink inside
// <pluginRoot>/hooks/ whose realpath escapes pluginRoot. The cases below
// pin both the buried-symlink and leaf-symlink rejection paths, AND the
// positive paths (in-tree symlink, valid real files, missing subtree).

interface Ctx {
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly pluginRoot: string;
  readonly externalDir: string;
}

async function withTmpScope<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "hooks-symlink-"));
  const externalDir = await mkdtemp(path.join(os.tmpdir(), "hooks-external-"));
  const locations = locationsFor("project", cwd);
  const pluginRoot = path.join(cwd, "fake-plugin-root");
  await mkdir(pluginRoot, { recursive: true });
  try {
    return await fn({ cwd, locations, pluginRoot, externalDir });
  } finally {
    await rm(cwd, { recursive: true, force: true });
    await rm(externalDir, { recursive: true, force: true });
  }
}

const PLUGIN = "acme";
const HOOKS_VALUE = { hooks: {} };

// Symlink creation requires elevated permissions on Windows; the entire
// Phase 63 supported-platform matrix is Linux + macOS, so we skip these
// tests if the runtime can't create symlinks. The skip is defensive.
const canSymlink = process.platform !== "win32";

test(
  "Case A (buried symlink): <pluginRoot>/hooks/sub/escape -> external dir rejects via SymlinkRefusedError",
  { skip: !canSymlink },
  async () => {
    await withTmpScope(async ({ locations, pluginRoot, externalDir }) => {
      const subdir = path.join(pluginRoot, "hooks", "sub");
      await mkdir(subdir, { recursive: true });
      await symlink(externalDir, path.join(subdir, "escape"));

      await assert.rejects(
        writeHookConfig({
          locations,
          pluginName: PLUGIN,
          pluginRoot,
          hooksValue: HOOKS_VALUE,
        }),
        (err: Error) =>
          err instanceof SymlinkRefusedError && err.message.includes("hooks subtree symlink"),
      );
    });
  },
);

test(
  "Case B (leaf symlink): <pluginRoot>/hooks/escape.sh -> external file rejects via SymlinkRefusedError",
  { skip: !canSymlink },
  async () => {
    await withTmpScope(async ({ locations, pluginRoot, externalDir }) => {
      const externalScript = path.join(externalDir, "script.sh");
      await writeFile(externalScript, "#!/bin/sh\necho hi\n");

      await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
      await symlink(externalScript, path.join(pluginRoot, "hooks", "escape.sh"));

      await assert.rejects(
        writeHookConfig({
          locations,
          pluginName: PLUGIN,
          pluginRoot,
          hooksValue: HOOKS_VALUE,
        }),
        (err: Error) =>
          err instanceof SymlinkRefusedError && err.message.includes("hooks subtree symlink"),
      );
    });
  },
);

test("Case C (valid real path): regular files under <pluginRoot>/hooks/ succeed", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    await mkdir(path.join(pluginRoot, "hooks", "scripts"), { recursive: true });
    await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(HOOKS_VALUE));
    await writeFile(path.join(pluginRoot, "hooks", "scripts", "format.sh"), "#!/bin/sh\n");

    const result = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    assert.equal(result.written, true);
  });
});

test(
  "Case D (in-tree symlink): <pluginRoot>/hooks/alias.sh -> ./scripts/format.sh succeeds",
  { skip: !canSymlink },
  async () => {
    await withTmpScope(async ({ locations, pluginRoot }) => {
      const scriptsDir = path.join(pluginRoot, "hooks", "scripts");
      await mkdir(scriptsDir, { recursive: true });
      const realScript = path.join(scriptsDir, "format.sh");
      await writeFile(realScript, "#!/bin/sh\n");
      // Relative symlink target -- resolves inside pluginRoot.
      await symlink(path.join("scripts", "format.sh"), path.join(pluginRoot, "hooks", "alias.sh"));

      const result = await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot,
        hooksValue: HOOKS_VALUE,
      });
      assert.equal(result.written, true);
    });
  },
);

test("Case E (missing hooks subtree): pluginRoot without hooks/ succeeds (ENOENT clean return)", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    // No hooks/ dir under pluginRoot.
    const result = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    assert.equal(result.written, true);
  });
});
