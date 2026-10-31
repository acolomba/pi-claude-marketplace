import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { createHooksHydration as definingCreateHooksHydration } from "../../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts";
import {
  createHooksHydration,
  readHooksJson,
  removeHookConfig,
  writeHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createHooksRuntime as definingCreateHooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import {
  readHooksJson as definingReadHooksJson,
  removeHookConfig as definingRemoveHookConfig,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type * as HooksBarrel from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";

type Public<Name extends keyof typeof HooksBarrel> = Name;

// @ts-expect-error the barrel does not expose the HooksFileReader type
void ({} satisfies { readonly retired?: HooksBarrel.HooksFileReader });
// @ts-expect-error the barrel does not expose the HooksHydration type
void ({} satisfies { readonly retired?: HooksBarrel.HooksHydration });
// @ts-expect-error the barrel does not expose the HooksHydrationDeps type
void ({} satisfies { readonly retired?: HooksBarrel.HooksHydrationDeps });
// @ts-expect-error the barrel does not expose the ReadAndCachePluginHooksOptions type
void ({} satisfies { readonly retired?: HooksBarrel.ReadAndCachePluginHooksOptions });
// @ts-expect-error the barrel does not expose the HooksRuntime type
void ({} satisfies { readonly retired?: HooksBarrel.HooksRuntime });

void ({
  loadState: () => Promise.resolve({ schemaVersion: 2, marketplaces: {} }),
  readHooksJson: () => Promise.resolve("{}"),
} satisfies Parameters<typeof createHooksHydration>[1]);

// @ts-expect-error the barrel keeps accumulateStream internal
void ("accumulateStream" satisfies Public<"accumulateStream">);
// @ts-expect-error the barrel keeps assertNoSymlinkEscapeInHooksSubtree internal
void ("assertNoSymlinkEscapeInHooksSubtree" satisfies Public<"assertNoSymlinkEscapeInHooksSubtree">);
// @ts-expect-error the barrel keeps assertSymlinkEntryContained internal
void ("assertSymlinkEntryContained" satisfies Public<"assertSymlinkEntryContained">);
// @ts-expect-error the barrel keeps compileIfPredicate internal
void ("compileIfPredicate" satisfies Public<"compileIfPredicate">);
// @ts-expect-error the barrel keeps currentEpoch internal
void ("currentEpoch" satisfies Public<"currentEpoch">);
// @ts-expect-error the barrel keeps ifFires internal
void ("ifFires" satisfies Public<"ifFires">);
// @ts-expect-error the barrel keeps installTimerLadder internal
void ("installTimerLadder" satisfies Public<"installTimerLadder">);
// @ts-expect-error the barrel keeps liveEpoch internal
void ("liveEpoch" satisfies Public<"liveEpoch">);
// @ts-expect-error the barrel keeps MATCH_ALL_IF internal
void ("MATCH_ALL_IF" satisfies Public<"MATCH_ALL_IF">);
// @ts-expect-error the barrel keeps normalizeSeconds internal
void ("normalizeSeconds" satisfies Public<"normalizeSeconds">);
// @ts-expect-error the barrel keeps parsedConfigCache internal
void ("parsedConfigCache" satisfies Public<"parsedConfigCache">);
// @ts-expect-error the barrel keeps parsedConfigEntries internal
void ("parsedConfigEntries" satisfies Public<"parsedConfigEntries">);
// @ts-expect-error the barrel keeps pendingSessionStartContext internal
void ("pendingSessionStartContext" satisfies Public<"pendingSessionStartContext">);
// @ts-expect-error the barrel keeps pendingSessionStartContextEntries internal
void ("pendingSessionStartContextEntries" satisfies Public<"pendingSessionStartContextEntries">);
// @ts-expect-error the barrel keeps readEntriesOrSkip internal
void ("readEntriesOrSkip" satisfies Public<"readEntriesOrSkip">);
// @ts-expect-error the barrel keeps readSymlinkTargetSafe internal
void ("readSymlinkTargetSafe" satisfies Public<"readSymlinkTargetSafe">);
// @ts-expect-error the barrel keeps REQUIRED_EVENT_FIELDS internal
void ("REQUIRED_EVENT_FIELDS" satisfies Public<"REQUIRED_EVENT_FIELDS">);
// @ts-expect-error the barrel keeps routingTable internal
void ("routingTable" satisfies Public<"routingTable">);
// @ts-expect-error the barrel keeps routingTableEntries internal
void ("routingTableEntries" satisfies Public<"routingTableEntries">);
// @ts-expect-error the barrel keeps STDERR_MAX_BYTES internal
void ("STDERR_MAX_BYTES" satisfies Public<"STDERR_MAX_BYTES">);
// @ts-expect-error the barrel keeps STDOUT_MAX_BYTES internal
void ("STDOUT_MAX_BYTES" satisfies Public<"STDOUT_MAX_BYTES">);
// @ts-expect-error the barrel keeps TRANSLATORS internal
void ("TRANSLATORS" satisfies Public<"TRANSLATORS">);

describe("createHooksHydration", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedCreateHooksHydration = definingCreateHooksHydration;

    // act
    const hooksCreateHooksHydration = createHooksHydration;

    // assert
    assert.strictEqual(hooksCreateHooksHydration, expectedCreateHooksHydration);
  });
});

describe("createHooksRuntime", () => {
  test("re-exports the lifecycle owner factory", async () => {
    // arrange
    const hooksBarrel =
      await import("../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts");
    const expectedCreateHooksRuntime = definingCreateHooksRuntime;

    // act
    const hooksCreateHooksRuntime = Reflect.get(hooksBarrel, "createHooksRuntime");

    // assert
    assert.strictEqual(hooksCreateHooksRuntime, expectedCreateHooksRuntime);
  });
});

describe("readHooksJson", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedReadHooksJson = definingReadHooksJson;

    // act
    const hooksReadHooksJson = readHooksJson;

    // assert
    assert.strictEqual(hooksReadHooksJson, expectedReadHooksJson);
  });
});

describe("removeHookConfig", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRemoveHookConfig = definingRemoveHookConfig;

    // act
    const hooksRemoveHookConfig = removeHookConfig;

    // assert
    assert.strictEqual(hooksRemoveHookConfig, expectedRemoveHookConfig);
  });
});

describe("writeHookConfig", () => {
  test("writes complete hook bytes repeatedly through the Node tree inspector", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "hooks-bridge-compose-"));
    t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
    const root = await realpath(directory);
    const locations = locationsFor("project", root);
    const pluginRoot = path.join(root, "plugin");
    const hooksRoot = path.join(pluginRoot, "hooks");
    const nestedRoot = path.join(hooksRoot, "nested");
    const sharedRoot = path.join(pluginRoot, "shared");
    const sourceScript = path.join(nestedRoot, "run.sh");
    const sharedScript = path.join(sharedRoot, "shared.sh");
    const linkPath = path.join(hooksRoot, "shared-link");
    await mkdir(nestedRoot, { recursive: true });
    await mkdir(sharedRoot);
    await writeFile(sourceScript, "echo source\n");
    await writeFile(sharedScript, "echo shared\n");
    await symlink(sharedRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
    const expectedPath = path.join(locations.hooksDir, "acme", "hooks.json");
    const hooksValue = { Stop: [{ hooks: [{ type: "command", command: "echo ready" }] }] };
    const expectedBytes = `{
  "Stop": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "echo ready"
        }
      ]
    }
  ]
}
`;

    // act
    const writtenHook = await writeHookConfig({
      locations,
      pluginName: "acme",
      pluginRoot,
      hooksValue,
    });
    const firstBytes = await readFile(expectedPath, "utf8");
    const repeatedHook = await writeHookConfig({
      locations,
      pluginName: "acme",
      pluginRoot,
      hooksValue,
    });
    const repeatedBytes = await readFile(expectedPath, "utf8");

    // assert
    assert.deepStrictEqual(writtenHook, { written: true, path: expectedPath });
    assert.deepStrictEqual(repeatedHook, { written: true, path: expectedPath });
    assert.strictEqual(firstBytes, expectedBytes);
    assert.strictEqual(repeatedBytes, expectedBytes);
    assert.deepStrictEqual(await readdir(path.dirname(expectedPath)), ["hooks.json"]);
    assert.deepStrictEqual((await readdir(hooksRoot)).sort(), ["nested", "shared-link"]);
    assert.strictEqual(await readFile(sourceScript, "utf8"), "echo source\n");
    assert.strictEqual(await readFile(sharedScript, "utf8"), "echo shared\n");
    assert.strictEqual((await lstat(linkPath)).isSymbolicLink(), true);
  });

  test("refuses an escaping source symlink before replacing staged or external bytes", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "hooks-bridge-escape-"));
    t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
    const root = await realpath(directory);
    const locations = locationsFor("project", root);
    const pluginRoot = path.join(root, "plugin");
    const hooksRoot = path.join(pluginRoot, "hooks");
    const externalRoot = path.join(root, "external");
    const externalFile = path.join(externalRoot, "keep.txt");
    const linkPath = path.join(hooksRoot, "escape");
    const stagedPath = path.join(locations.hooksDir, "acme", "hooks.json");
    await mkdir(hooksRoot, { recursive: true });
    await mkdir(externalRoot);
    await mkdir(path.dirname(stagedPath), { recursive: true });
    await writeFile(externalFile, "external bytes\n");
    await writeFile(stagedPath, '{"retained":true}\n');
    await symlink(externalRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
    const expectedLinkTarget = await readlink(linkPath);

    // act
    const writeError: unknown = await writeHookConfig({
      locations,
      pluginName: "acme",
      pluginRoot,
      hooksValue: { replacement: true },
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    // assert
    assert.ok(writeError instanceof SymlinkRefusedError);
    assert.deepStrictEqual(
      {
        name: writeError.name,
        message: writeError.message,
        parent: writeError.parent,
        child: writeError.child,
        linkPath: writeError.linkPath,
        linkTarget: writeError.linkTarget,
        cause: writeError.cause,
      },
      {
        name: "SymlinkRefusedError",
        message: `hooks subtree symlink ${linkPath} contains symlink ${linkPath} -> ${expectedLinkTarget} (parent: ${pluginRoot}, target: ${externalRoot}).`,
        parent: pluginRoot,
        child: externalRoot,
        linkPath,
        linkTarget: expectedLinkTarget,
        cause: undefined,
      },
    );
    assert.strictEqual(await readFile(stagedPath, "utf8"), '{"retained":true}\n');
    assert.strictEqual(await readFile(externalFile, "utf8"), "external bytes\n");
    assert.deepStrictEqual(await readdir(path.dirname(stagedPath)), ["hooks.json"]);
    assert.deepStrictEqual(await readdir(externalRoot), ["keep.txt"]);
    assert.strictEqual((await lstat(linkPath)).isSymbolicLink(), true);
    assert.strictEqual(await readlink(linkPath), expectedLinkTarget);
  });
});
