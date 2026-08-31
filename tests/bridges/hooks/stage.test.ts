import assert from "node:assert/strict";
import fs, { type PathLike } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  hookConfigPathFor,
  removeHookConfig,
  writeHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

interface CasePaths {
  readonly scopeRoot: string;
  readonly pluginRoot: string;
  readonly externalRoot: string;
  readonly locations: ReturnType<typeof locationsFor>;
}

async function allocateCasePaths(prefix: string): Promise<CasePaths> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));

  return {
    scopeRoot,
    pluginRoot: path.join(scopeRoot, "plugin"),
    externalRoot: path.join(scopeRoot, "external"),
    locations: locationsFor("project", scopeRoot),
  };
}

async function createDirectoryLink(target: string, linkPath: string): Promise<void> {
  await symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function filesystemErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

const PLUGIN = "acme";
const HOOKS_VALUE = {
  PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
};
const EXPECTED_HOOKS_BYTES =
  '{\n  "PreToolUse": [\n    {\n      "matcher": "Bash",\n' +
  '      "hooks": [\n        {\n          "type": "command",\n' +
  '          "command": "echo hi"\n        }\n      ]\n    }\n  ]\n}\n';

test("writes when the plugin hooks subtree is absent", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-missing-");
  try {
    // arrange
    await mkdir(pluginRoot, { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const write = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: {},
    });
    const storedBytes = await readFile(expectedPath, "utf8");
    const sourceHooksState = await stat(path.join(normalizedPluginRoot, "hooks")).then(
      () => "present",
      filesystemErrorCode,
    );

    // assert
    assert.deepStrictEqual(write, { written: true, path: expectedPath });
    assert.strictEqual(storedBytes, "{}\n");
    assert.strictEqual(sourceHooksState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("writes when the plugin hooks path is not a directory", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-nondirectory-");
  try {
    // arrange
    await mkdir(pluginRoot, { recursive: true });
    const hooksPath = path.join(pluginRoot, "hooks");
    await writeFile(hooksPath, "source hooks marker\n");
    const normalizedPluginRoot = await realpath(pluginRoot);
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const write = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: {},
    });
    const sourceBytes = await readFile(hooksPath, "utf8");
    const storedBytes = await readFile(expectedPath, "utf8");

    // assert
    assert.deepStrictEqual(write, { written: true, path: expectedPath });
    assert.strictEqual(sourceBytes, "source hooks marker\n");
    assert.strictEqual(storedBytes, "{}\n");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("walks ordinary nested hook directories without changing their files", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-nested-");
  try {
    // arrange
    const nestedDirectory = path.join(pluginRoot, "hooks", "scripts", "nested");
    const hookConfigPath = path.join(pluginRoot, "hooks", "hooks.json");
    const nestedScriptPath = path.join(nestedDirectory, "format.sh");
    await mkdir(nestedDirectory, { recursive: true });
    await writeFile(hookConfigPath, "source config\n");
    await writeFile(nestedScriptPath, "#!/bin/sh\necho format\n");
    const normalizedPluginRoot = await realpath(pluginRoot);
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const write = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: {},
    });
    const sourceConfigBytes = await readFile(hookConfigPath, "utf8");
    const sourceScriptBytes = await readFile(nestedScriptPath, "utf8");
    const storedBytes = await readFile(expectedPath, "utf8");

    // assert
    assert.deepStrictEqual(write, { written: true, path: expectedPath });
    assert.strictEqual(sourceConfigBytes, "source config\n");
    assert.strictEqual(sourceScriptBytes, "#!/bin/sh\necho format\n");
    assert.strictEqual(storedBytes, "{}\n");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("treats an in-tree directory link as a safe traversal boundary", async () => {
  const { externalRoot, locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-contained-link-",
  );
  try {
    // arrange
    const hooksDirectory = path.join(pluginRoot, "hooks");
    const sharedScripts = path.join(pluginRoot, "shared-scripts");
    await mkdir(hooksDirectory, { recursive: true });
    await mkdir(sharedScripts, { recursive: true });
    await mkdir(externalRoot, { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedSharedScripts = await realpath(sharedScripts);
    const normalizedExternalRoot = await realpath(externalRoot);
    await createDirectoryLink(
      normalizedExternalRoot,
      path.join(normalizedSharedScripts, "unvisited-escape"),
    );
    await createDirectoryLink(
      normalizedSharedScripts,
      path.join(normalizedPluginRoot, "hooks", "scripts"),
    );
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const write = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: {},
    });
    const storedBytes = await readFile(expectedPath, "utf8");

    // assert
    assert.deepStrictEqual(write, { written: true, path: expectedPath });
    assert.strictEqual(storedBytes, "{}\n");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("rejects a direct directory link that escapes the plugin root", async () => {
  const { externalRoot, locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-direct-escape-",
  );
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await mkdir(externalRoot, { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedExternalRoot = await realpath(externalRoot);
    const linkPath = path.join(normalizedPluginRoot, "hooks", "escape");
    await createDirectoryLink(normalizedExternalRoot, linkPath);
    const expectedLinkTarget = await readlink(linkPath);
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: {},
      });
    } catch (error) {
      rejection = error;
    }

    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.ok(rejection instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      {
        name: rejection.name,
        parent: rejection.parent,
        child: rejection.child,
        linkPath: rejection.linkPath,
        linkTarget: rejection.linkTarget,
      },
      {
        name: "SymlinkRefusedError",
        parent: normalizedPluginRoot,
        child: normalizedExternalRoot,
        linkPath,
        linkTarget: expectedLinkTarget,
      },
    );
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("rejects a buried directory link that escapes the plugin root", async () => {
  const { externalRoot, locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-buried-escape-",
  );
  try {
    // arrange
    const buriedDirectory = path.join(pluginRoot, "hooks", "scripts", "nested");
    await mkdir(buriedDirectory, { recursive: true });
    await mkdir(externalRoot, { recursive: true });
    const externalNestedDirectory = path.join(externalRoot, "nested");
    await mkdir(externalNestedDirectory);
    await writeFile(path.join(externalRoot, "sentinel-do-not-read"), "secret\n");
    await writeFile(path.join(externalNestedDirectory, "deep-sentinel"), "deep\n");
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedExternalRoot = await realpath(externalRoot);
    const linkPath = path.join(normalizedPluginRoot, "hooks", "scripts", "nested", "escape");
    await createDirectoryLink(normalizedExternalRoot, linkPath);
    const expectedLinkTarget = await readlink(linkPath);
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    const expectedMessage =
      `hooks subtree symlink ${linkPath} contains symlink ${linkPath} -> ` +
      `${expectedLinkTarget} (parent: ${normalizedPluginRoot}, target: ${normalizedExternalRoot}).`;
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: {},
      });
    } catch (error) {
      rejection = error;
    }

    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.ok(rejection instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      {
        name: rejection.name,
        message: rejection.message,
        parent: rejection.parent,
        child: rejection.child,
        linkPath: rejection.linkPath,
        linkTarget: rejection.linkTarget,
      },
      {
        name: "SymlinkRefusedError",
        message: expectedMessage,
        parent: normalizedPluginRoot,
        child: normalizedExternalRoot,
        linkPath,
        linkTarget: expectedLinkTarget,
      },
    );
    assert.strictEqual(rejection.message.includes("sentinel-do-not-read"), false);
    assert.strictEqual(rejection.message.includes("deep-sentinel"), false);
    assert.strictEqual(rejection.message.includes(externalNestedDirectory), false);
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("uses the unreadable target marker when escape diagnostics cannot read the link", async (t) => {
  const { externalRoot, locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-unreadable-link-",
  );
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await mkdir(externalRoot, { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedExternalRoot = await realpath(externalRoot);
    const linkPath = path.join(normalizedPluginRoot, "hooks", "escape");
    await createDirectoryLink(normalizedExternalRoot, linkPath);
    const readlinkError = Object.assign(new Error("link changed before diagnostics"), {
      code: "EIO",
    });
    const linkReader = t.mock.method(fs.promises, "readlink", (): Promise<never> =>
      Promise.reject(readlinkError),
    );
    t.after(() => {
      linkReader.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    const expectedError = {
      name: "SymlinkRefusedError",
      message:
        `hooks subtree symlink ${linkPath} contains symlink ${linkPath} -> <unreadable> ` +
        `(parent: ${normalizedPluginRoot}, target: ${normalizedExternalRoot}).`,
      parent: normalizedPluginRoot,
      child: normalizedExternalRoot,
      linkPath,
      linkTarget: "<unreadable>",
    };
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: HOOKS_VALUE,
      });
    } catch (error) {
      rejection = error;
    }

    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.ok(rejection instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      {
        name: rejection.name,
        message: rejection.message,
        parent: rejection.parent,
        child: rejection.child,
        linkPath: rejection.linkPath,
        linkTarget: rejection.linkTarget,
      },
      expectedError,
    );
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("preserves an in-tree symlink refusal when a resolved target becomes a link", async (t) => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-replaced-target-",
  );
  try {
    // arrange
    const hooksDirectory = path.join(pluginRoot, "hooks");
    const originalTarget = path.join(pluginRoot, "original-target");
    const replacementTarget = path.join(pluginRoot, "replacement-target");
    await mkdir(hooksDirectory, { recursive: true });
    await mkdir(originalTarget);
    await mkdir(replacementTarget);
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedOriginalTarget = await realpath(originalTarget);
    const normalizedReplacementTarget = await realpath(replacementTarget);
    const linkPath = path.join(hooksDirectory, "alias");
    await createDirectoryLink(normalizedOriginalTarget, linkPath);
    let resolveInitialLink: (() => void) | undefined;
    const initialLinkResolved = new Promise<void>((resolve) => {
      resolveInitialLink = resolve;
    });
    const originalRealpath = fs.promises.realpath.bind(fs.promises);
    const pathResolver = t.mock.method(fs.promises, "realpath", async (target: PathLike) => {
      if (String(target) === linkPath) {
        const resolved = await originalRealpath(target);
        resolveInitialLink?.();
        return resolved;
      }

      if (String(target) === normalizedPluginRoot) {
        await initialLinkResolved;
        await rm(normalizedOriginalTarget, { recursive: true, force: true });
        await createDirectoryLink(normalizedReplacementTarget, normalizedOriginalTarget);
      }

      return originalRealpath(target);
    });
    t.after(() => {
      pathResolver.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: HOOKS_VALUE,
      });
    } catch (error) {
      rejection = error;
    }

    const expectedReplacementLinkTarget = await readlink(normalizedOriginalTarget);
    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.ok(rejection instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      {
        name: rejection.name,
        message: rejection.message,
        parent: rejection.parent,
        child: rejection.child,
        linkPath: rejection.linkPath,
        linkTarget: rejection.linkTarget,
      },
      {
        name: "SymlinkRefusedError",
        message:
          `hooks subtree symlink ${linkPath} contains symlink ${normalizedOriginalTarget} -> ` +
          `${expectedReplacementLinkTarget} (parent: ${normalizedPluginRoot}, ` +
          `target: ${normalizedOriginalTarget}).`,
        parent: normalizedPluginRoot,
        child: normalizedOriginalTarget,
        linkPath: normalizedOriginalTarget,
        linkTarget: expectedReplacementLinkTarget,
      },
    );
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("propagates an unexpected hook directory read failure unchanged", async (t) => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-readdir-error-",
  );
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const readError = Object.assign(new Error("hooks directory read denied"), { code: "EACCES" });
    const directoryReader = t.mock.method(fs.promises, "readdir", (): Promise<never> =>
      Promise.reject(readError),
    );
    t.after(() => {
      directoryReader.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: HOOKS_VALUE,
      });
    } catch (error) {
      rejection = error;
    }

    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.strictEqual(rejection, readError);
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("propagates an unexpected contained-target walk failure unchanged", async (t) => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths(
    "hooks-stage-contained-walk-error-",
  );
  try {
    // arrange
    const hooksDirectory = path.join(pluginRoot, "hooks");
    const containedTarget = path.join(pluginRoot, "contained-target");
    await mkdir(hooksDirectory, { recursive: true });
    await mkdir(containedTarget);
    const normalizedPluginRoot = await realpath(pluginRoot);
    const normalizedContainedTarget = await realpath(containedTarget);
    const linkPath = path.join(hooksDirectory, "alias");
    await createDirectoryLink(normalizedContainedTarget, linkPath);
    const walkError = Object.assign(new Error("contained target lstat denied"), { code: "EACCES" });
    const originalLstat = fs.promises.lstat.bind(fs.promises);
    const pathInspector = t.mock.method(fs.promises, "lstat", async (target: PathLike) => {
      if (String(target) === normalizedContainedTarget) {
        throw walkError;
      }

      return originalLstat(target);
    });
    t.after(() => {
      pathInspector.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedStagePath = path.join(locations.hooksDir, PLUGIN, "hooks.json");
    let rejection: unknown;

    // act
    try {
      await writeHookConfig({
        locations,
        pluginName: PLUGIN,
        pluginRoot: normalizedPluginRoot,
        hooksValue: HOOKS_VALUE,
      });
    } catch (error) {
      rejection = error;
    }

    const stagedState = await stat(expectedStagePath).then(() => "present", filesystemErrorCode);

    // assert
    assert.strictEqual(rejection, walkError);
    assert.strictEqual(stagedState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("writes hooks.json and returns its absolute path", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-write-");
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    await writeFile(path.join(pluginRoot, "hooks", "hooks.json"), "source hooks\n");
    const normalizedPluginRoot = await realpath(pluginRoot);
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const write = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    const storedBytes = await readFile(expectedPath, "utf8");
    const stagedEntries = await readdir(path.dirname(expectedPath));
    const relativeStagePath = path.relative(locations.hooksDir, write.path);

    // assert
    assert.deepStrictEqual(write, { written: true, path: expectedPath });
    assert.strictEqual(storedBytes, EXPECTED_HOOKS_BYTES);
    assert.deepStrictEqual(stagedEntries, ["hooks.json"]);
    assert.strictEqual(relativeStagePath, path.join("acme", "hooks.json"));
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("writes the same bytes when the hook config is staged twice", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-idempotent-");
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const firstWrite = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    const firstBytes = await readFile(expectedPath, "utf8");
    const secondWrite = await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    const secondBytes = await readFile(expectedPath, "utf8");

    // assert
    assert.deepStrictEqual(firstWrite, { written: true, path: expectedPath });
    assert.deepStrictEqual(secondWrite, { written: true, path: expectedPath });
    assert.strictEqual(firstBytes, EXPECTED_HOOKS_BYTES);
    assert.strictEqual(secondBytes, EXPECTED_HOOKS_BYTES);
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("removes an existing staged plugin directory", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-remove-");
  try {
    // arrange
    await mkdir(path.join(pluginRoot, "hooks"), { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);
    await writeHookConfig({
      locations,
      pluginName: PLUGIN,
      pluginRoot: normalizedPluginRoot,
      hooksValue: HOOKS_VALUE,
    });
    const expectedDirectory = path.join(locations.hooksDir, PLUGIN);

    // act
    const removal = await removeHookConfig({ locations, pluginName: PLUGIN });
    const directoryState = await stat(expectedDirectory).then(() => "present", filesystemErrorCode);

    // assert
    assert.deepStrictEqual(removal, { removed: PLUGIN });
    assert.strictEqual(directoryState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("treats removal of an absent staged plugin as a no-op", async () => {
  const { locations, scopeRoot } = await allocateCasePaths("hooks-stage-remove-absent-");
  try {
    // arrange
    const expectedDirectory = path.join(locations.hooksDir, PLUGIN);

    // act
    const removal = await removeHookConfig({ locations, pluginName: PLUGIN });
    const directoryState = await stat(expectedDirectory).then(() => "present", filesystemErrorCode);

    // assert
    assert.deepStrictEqual(removal, { removed: PLUGIN });
    assert.strictEqual(directoryState, "ENOENT");
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("composes the staged hook config path", async () => {
  const { locations, scopeRoot } = await allocateCasePaths("hooks-stage-path-");
  try {
    // arrange
    const expectedPath = path.join(locations.hooksDir, PLUGIN, "hooks.json");

    // act
    const hookConfigPath = hookConfigPathFor(locations, PLUGIN);

    // assert
    assert.strictEqual(hookConfigPath, expectedPath);
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("rejects an unsafe plugin name before writing", async () => {
  const { locations, pluginRoot, scopeRoot } = await allocateCasePaths("hooks-stage-unsafe-write-");
  try {
    // arrange
    await mkdir(pluginRoot, { recursive: true });
    const normalizedPluginRoot = await realpath(pluginRoot);

    // act & assert
    await assert.rejects(
      writeHookConfig({
        locations,
        pluginName: "../escape",
        pluginRoot: normalizedPluginRoot,
        hooksValue: HOOKS_VALUE,
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          {
            name: "Error",
            message: 'hooks bridge plugin name "../escape" must not contain path separators.',
          },
        );
        return true;
      },
    );
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});

test("rejects an unsafe plugin name before removal", async () => {
  const { locations, scopeRoot } = await allocateCasePaths("hooks-stage-unsafe-remove-");
  try {
    // arrange
    const unsafePluginName = "../escape";

    // act & assert
    await assert.rejects(
      removeHookConfig({ locations, pluginName: unsafePluginName }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          {
            name: "Error",
            message: 'hooks bridge plugin name "../escape" must not contain path separators.',
          },
        );
        return true;
      },
    );
  } finally {
    await rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 });
  }
});
