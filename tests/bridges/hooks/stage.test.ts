import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  hookConfigPathFor,
  removeHookConfig,
  writeHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

// LIFE-03 / D-63-02: hooks bridge writes <hooksDir>/<plugin>/hooks.json via a
// single atomic tmp+rename and removes the same dir on uninstall. The 5 cases
// below pin the surface for cascade wiring.

interface Ctx {
  readonly cwd: string;
  readonly locations: ReturnType<typeof locationsFor>;
  readonly pluginRoot: string;
}

async function withTmpScope<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "hooks-stage-"));
  const locations = locationsFor("project", cwd);
  const pluginRoot = path.join(cwd, "fake-plugin-root");
  await mkdir(pluginRoot, { recursive: true });
  try {
    return await fn({ cwd, locations, pluginRoot });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

const PLUGIN = "acme";
// HOOK-03 / LIFE-01: upstream plugin-format wrapper per Claude Code
// `plugin-dev/skills/hook-development/SKILL.md` -- plugin `hooks/hooks.json`
// MUST use `{description?, hooks: {<event>: [...]}}`. The source-plugin
// seed file written under `<pluginRoot>/hooks/hooks.json` carries the
// wrapper verbatim; `parseHooksConfig` unwraps `parsed.hooks` before
// validation, and the bridge stage-write path receives the UNWRAPPED
// inner record from the parser. Direct `writeHookConfig` test calls (which
// bypass the parser) pass `HOOKS_VALUE.hooks` to match the production
// caller's contract; on-disk `deepEqual` assertions compare against
// `HOOKS_VALUE.hooks` for the same reason.
const HOOKS_VALUE = {
  hooks: {
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
  },
};

test("writeHookConfig writes <hooksDir>/<plugin>/hooks.json and returns absolute path", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    // Give pluginRoot a real hooks/ subtree so the symlink walk has work.
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(HOOKS_VALUE));

    const result = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE.hooks,
    });

    assert.equal(result.written, true);
    assert.equal(result.path, path.join(locations.hooksDir, PLUGIN, "hooks.json"));

    const onDiskText = await readFile(result.path, "utf8");
    const onDisk = JSON.parse(onDiskText) as typeof HOOKS_VALUE.hooks;
    assert.deepEqual(onDisk, HOOKS_VALUE.hooks);
  });
});

test("writeHookConfig is idempotent: second call yields identical content and does not throw", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(HOOKS_VALUE));

    const first = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE.hooks,
    });
    const firstText = await readFile(first.path, "utf8");

    const second = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE.hooks,
    });
    const secondText = await readFile(second.path, "utf8");

    assert.equal(first.path, second.path);
    assert.equal(firstText, secondText);
  });
});

test("removeHookConfig removes <hooksDir>/<plugin>/ recursively and returns the plugin name", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), JSON.stringify(HOOKS_VALUE));

    await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot,
      hooksValue: HOOKS_VALUE.hooks,
    });

    const result = await removeHookConfig({ locations, pluginName: PLUGIN });
    assert.deepEqual(result, { removed: PLUGIN });

    // The plugin dir should be gone.
    const targetDir = path.join(locations.hooksDir, PLUGIN);
    await assert.rejects(readFile(path.join(targetDir, "hooks.json"), "utf8"), {
      code: "ENOENT",
    });
  });
});

test("removeHookConfig is idempotent: removing a never-staged plugin does not throw", async () => {
  await withTmpScope(async ({ locations }) => {
    const result = await removeHookConfig({ locations, pluginName: PLUGIN });
    assert.deepEqual(result, { removed: PLUGIN });
  });
});

test("hookConfigPathFor returns path.join(locations.hooksDir, plugin, 'hooks.json')", async () => {
  await withTmpScope(({ locations }) => {
    const actual = hookConfigPathFor(locations, PLUGIN);
    const expected = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    assert.equal(actual, expected);
    return Promise.resolve();
  });
});

test("writeHookConfig rejects pluginName containing '..' via assertSafeName BEFORE any filesystem access", async () => {
  await withTmpScope(async ({ locations, pluginRoot }) => {
    await assert.rejects(
      writeHookConfig({
        locations,
        pluginName: "../escape",
        pluginRoot,
        hooksValue: HOOKS_VALUE.hooks,
      }),
      (err: Error) => err.message.includes("hooks bridge plugin name"),
    );
  });
});

test("removeHookConfig rejects pluginName containing '/' via assertSafeName BEFORE any filesystem access", async () => {
  await withTmpScope(async ({ locations }) => {
    await assert.rejects(removeHookConfig({ locations, pluginName: "../escape" }), (err: Error) =>
      err.message.includes("hooks bridge plugin name"),
    );
  });
});
