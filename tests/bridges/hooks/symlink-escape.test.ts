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
// CR-01: Case A additionally pins that the walker NEVER enumerates paths
// outside `<pluginRoot>/hooks/` and that the rejection message names the
// IN-TREE symlink path (never an external target path).

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
// WR-05: schema-valid top-level-event-keys shape. Rejection happens before
// the value is read, so an empty record is sufficient AND parse-valid.
const HOOKS_VALUE = {};

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

      // Sentinel files inside the external target. The walker MUST NOT
      // enumerate them (CR-01 / T-63-08-PROBE) -- if it did, their names
      // would surface in the rejection error message because a buggy
      // walker that descended through the symlink would either re-emit
      // them as candidate symlinks (with their parentPath inside
      // `externalDir`) or raise a containment error citing them.
      await writeFile(path.join(externalDir, "sentinel-do-not-read-PROBE"), "secret\n");
      const externalNested = path.join(externalDir, "nested");
      await mkdir(externalNested, { recursive: true });
      await writeFile(path.join(externalNested, "deep-sentinel-PROBE"), "deep\n");

      const expectedInTreePath = path.join(subdir, "escape");
      const externalDirResolved = path.resolve(externalDir);

      let captured: Error | undefined;
      await assert.rejects(
        writeHookConfig({
          locations,
          pluginName: PLUGIN,
          pluginRoot,
          hooksValue: HOOKS_VALUE,
        }),
        (err: Error) => {
          captured = err;
          return err instanceof SymlinkRefusedError;
        },
      );

      assert.ok(captured, "writeHookConfig did not reject");
      const msg = captured.message;
      assert.match(msg, /hooks subtree symlink/);

      // CR-01 / T-63-08-MSG: the "hooks subtree symlink <PATH>" SUBJECT
      // must be the IN-TREE symlink path. Parse the segment defensively.
      // Format from `SymlinkRefusedError`:
      //   "hooks subtree symlink <SUBJECT> contains symlink <linkPath> -> <target> (parent: ..., target: ...)."
      const subjectMatch = /hooks subtree symlink (\S+)\s/.exec(msg);
      assert.ok(subjectMatch, `could not parse "hooks subtree symlink <PATH>" out of: ${msg}`);
      assert.equal(
        subjectMatch[1],
        expectedInTreePath,
        "rejection SUBJECT must be the IN-TREE symlink path, not an external-tree path",
      );

      // CR-01 / T-63-08-PROBE: the rejection message must not name any
      // path INSIDE `externalDir` -- only the externalDir root itself may
      // appear (as the symlink's `target:` field). Walking into the
      // sentinel files would surface their names here.
      assert.ok(
        !msg.includes("sentinel-do-not-read-PROBE"),
        `walker enumerated externalDir contents (sentinel surfaced): ${msg}`,
      );
      assert.ok(
        !msg.includes("deep-sentinel-PROBE"),
        `walker descended into externalDir (deep sentinel surfaced): ${msg}`,
      );
      assert.ok(!msg.includes(externalNested), `walker descended into externalDir/nested: ${msg}`);

      // Reference the resolved externalDir root for diagnostic clarity:
      // the SymlinkRefusedError correctly reports the target, but only the
      // root, never a sub-path under it.
      assert.ok(externalDirResolved.length > 0);
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
