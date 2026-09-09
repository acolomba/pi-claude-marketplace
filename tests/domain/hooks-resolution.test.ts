import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type * as HooksResolutionOwner from "../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts";

type OwnerShape = typeof HooksResolutionOwner;

function emptyResolution() {
  return {
    supported: [] as string[],
    unsupported: [] as string[],
    notes: [] as string[],
  };
}

function dependencies(
  contents: string | undefined,
  readError?: Error,
): {
  statKind: (candidate: string) => Promise<"file" | null>;
  readFileText: (candidate: string) => Promise<string>;
} {
  return {
    statKind: () => Promise.resolve(contents === undefined && readError === undefined ? null : "file"),
    readFileText: () =>
      readError === undefined ? Promise.resolve(contents ?? "") : Promise.reject(readError),
  };
}

test("resolves no hooks when the convention file is absent", async () => {
  // arrange
  let owner: OwnerShape | undefined;
  const resolution = emptyResolution();

  // act & assert
  await assert.doesNotReject(async () => {
    owner = await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  }, "hooks-resolution.ts is absent");
  assert.ok(owner !== undefined);
  const dirty = await owner.resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies(undefined),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
});

test("records a supported hooks configuration and its relative path", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ready" }] }],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
});

test("classifies malformed hooks as a structural failure", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies("not-json"),
  );

  // assert
  assert.strictEqual(dirty, true);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: [],
    notes: [
      "malformed hooks.json: hooks.json is not valid JSON: Unexpected token 'o', \"not-json\" is not valid JSON",
    ],
  });
});

test("propagates convention-file read failures unchanged", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const readError = Object.assign(new Error("denied"), { code: "EACCES" });

  // act & assert
  await assert.rejects(
    resolveHooks(
      { pluginRoot: "/plugins/alpha", resolution },
      dependencies(undefined, readError),
    ),
    (error: unknown) => error === readError,
  );
  assert.deepStrictEqual(resolution, { supported: [], unsupported: [], notes: [] });
});

test("keeps supported handlers and reports dropped groups in source order", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [
      { matcher: ".*", hooks: [{ type: "command", command: "echo first" }] },
      { matcher: "Bash", hooks: [{ type: "command", command: "echo kept" }] },
      { matcher: ".+", hooks: [{ type: "command", command: "echo second" }] },
    ],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
      { kind: "group", event: "PreToolUse", matcher: ".+", cond: "regex" },
    ],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
});

test("omits materialization when every hook is dropped", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    Notification: [{ hooks: [{ type: "command", command: "echo ignored" }] }],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: [],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [{ kind: "event", event: "Notification" }],
  });
});

test("flags orphan rewake fields only in the retained hook subset", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const resolution = emptyResolution();
  const contents = JSON.stringify({
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [
          { type: "command", command: "echo paired", asyncRewake: true, rewakeMessage: "ok" },
          { type: "command", command: "echo orphan", rewakeSummary: "later" },
        ],
      },
      {
        matcher: ".*",
        hooks: [{ type: "command", command: "echo dropped", rewakeMessage: "ignored" }],
      },
    ],
  });

  // act
  const dirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(dirty, false);
  assert.deepStrictEqual(resolution, {
    supported: ["hooks"],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ],
    hooksConfigPath: path.join("hooks", "hooks.json"),
    orphanRewake: true,
  });
});

test("repeated resolutions are observationally identical", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const contents = JSON.stringify({
    PostToolUse: [
      { matcher: "Edit", hooks: [{ type: "command", command: "echo once" }] },
      { matcher: "Write", hooks: [{ type: "notification" }] },
    ],
  });
  const firstResolution = emptyResolution();
  const secondResolution = emptyResolution();

  // act
  const firstDirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution: firstResolution },
    dependencies(contents),
  );
  const secondDirty = await resolveHooks(
    { pluginRoot: "/plugins/alpha", resolution: secondResolution },
    dependencies(contents),
  );

  // assert
  assert.strictEqual(firstDirty, false);
  assert.strictEqual(secondDirty, false);
  assert.deepStrictEqual(secondResolution, firstResolution);
});

test("parallel resolutions keep independent deterministic state", async () => {
  // arrange
  const { resolveHooks } =
    await import("../../extensions/pi-claude-marketplace/domain/hooks-resolution.ts");
  const supportedResolution = emptyResolution();
  const droppedResolution = emptyResolution();
  const supportedContents = JSON.stringify({
    SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
  });
  const droppedContents = JSON.stringify({
    Notification: [{ hooks: [{ type: "command", command: "echo ignored" }] }],
  });

  // act
  const [supportedDirty, droppedDirty] = await Promise.all([
    resolveHooks(
      { pluginRoot: "/plugins/supported", resolution: supportedResolution },
      dependencies(supportedContents),
    ),
    resolveHooks(
      { pluginRoot: "/plugins/dropped", resolution: droppedResolution },
      dependencies(droppedContents),
    ),
  ]);

  // assert
  assert.deepStrictEqual([supportedDirty, droppedDirty], [false, false]);
  assert.deepStrictEqual(supportedResolution, {
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    hooksConfigPath: path.join("hooks", "hooks.json"),
  });
  assert.deepStrictEqual(droppedResolution, {
    supported: [],
    unsupported: ["hooks"],
    notes: [],
    droppedHooks: [{ kind: "event", event: "Notification" }],
  });
});
