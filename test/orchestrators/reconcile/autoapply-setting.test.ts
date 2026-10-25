// Owner suite for orchestrators/reconcile/autoapply-setting.ts.
//
// AAP-04: each case shapes the four config files of a case-owned hermetic
// tree, runs the real show or set, and states the one notification it sends
// and what the set left on disk.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import lockfile from "proper-lockfile";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  setAutoapply,
  showAutoapply,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/autoapply-setting.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { errorMessage } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { redactAbsolutePaths } from "../../../extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { TestContext } from "node:test";

interface AutoapplyTree {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
}

async function createTree(t: TestContext, label: string): Promise<AutoapplyTree> {
  const { cwd } = await createHermeticEnvironment(t, `autoapply-${label}-`);
  return { cwd, project: locationsFor("project", cwd), user: locationsFor("user", cwd) };
}

async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

const NO_FILE_SET =
  "claude-plugins.json [user]: not set\n" +
  "claude-plugins.local.json [user]: not set\n" +
  "claude-plugins.json [project]: not set\n" +
  "claude-plugins.local.json [project]: not set";

test("AAP-04: show with no config that sets autoapply shows the default and the four files", async (t) => {
  // arrange
  const tree = await createTree(t, "default");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await showAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: `Autoapply: off (default)\n\n${NO_FILE_SET}`, severity: "info" },
  ]);
  verifyBoundary();
});

test("AAP-04: show names the most specific file that sets autoapply and every file's own value", async (t) => {
  // arrange
  const tree = await createTree(t, "all-four");
  await writeUnder(tree.user.baseConfigJsonPath, JSON.stringify({ autoapply: true }));
  await writeUnder(tree.user.localConfigJsonPath, JSON.stringify({ autoapply: false }));
  await writeUnder(tree.project.baseConfigJsonPath, JSON.stringify({}));
  await writeUnder(tree.project.localConfigJsonPath, JSON.stringify({ autoapply: true }));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await showAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Autoapply: on (claude-plugins.local.json [project])\n\n" +
        "claude-plugins.json [user]: on\n" +
        "claude-plugins.local.json [user]: off\n" +
        "claude-plugins.json [project]: not set\n" +
        "claude-plugins.local.json [project]: on",
      severity: "info",
    },
  ]);
  verifyBoundary();
});

for (const { name, filter, lines } of [
  {
    name: "a scope filter keeps that scope's two files",
    filter: { scope: "user" },
    lines: "claude-plugins.json [user]: off\nclaude-plugins.local.json [user]: not set",
  },
  {
    name: "a local filter keeps the two local files",
    filter: { local: true },
    lines:
      "claude-plugins.local.json [user]: not set\nclaude-plugins.local.json [project]: not set",
  },
  {
    name: "both filters keep one file",
    filter: { scope: "project", local: true },
    lines: "claude-plugins.local.json [project]: not set",
  },
] as const) {
  test(`AAP-04: show with ${name} and still the effective value`, async (t) => {
    // arrange
    const tree = await createTree(t, "filter");
    await writeUnder(tree.user.baseConfigJsonPath, JSON.stringify({ autoapply: false }));
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await showAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd, ...filter });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `Autoapply: off (claude-plugins.json [user])\n\n${lines}`,
        severity: "info",
      },
    ]);
    verifyBoundary();
  });
}

const INVALID_USER_BASE =
  "Some operations have failed.\n\n" +
  "⊘ claude-plugins.json [user] (failed) {invalid manifest}\n" +
  "  ⊘ claude-plugins.json (failed) {invalid manifest}\n" +
  "    cause: schema validation failed: /autoapply: must be boolean\n\n" +
  "Reconcile pending: 2 failures";

test("AAP-04 / D-03: show with an invalid config reports it as the load does and no value", async (t) => {
  // arrange
  const tree = await createTree(t, "invalid");
  await writeUnder(tree.project.baseConfigJsonPath, JSON.stringify({ autoapply: true }));
  await writeUnder(tree.user.baseConfigJsonPath, JSON.stringify({ autoapply: "yes" }));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await showAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd, scope: "project" });

  // assert
  assert.deepStrictEqual(notifications, [{ message: INVALID_USER_BASE, severity: "error" }]);
  verifyBoundary();
});

test("AAP-04: set with no scope or layer writes the user base config and shows it", async (t) => {
  // arrange
  const tree = await createTree(t, "set-default");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd, enabled: true });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Set autoapply to on in claude-plugins.json [user].\n\n" +
        "Autoapply: on (claude-plugins.json [user])\n\n" +
        "claude-plugins.json [user]: on",
      severity: "info",
    },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(tree.user.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    autoapply: true,
  });
  verifyBoundary();
});

test("AAP-04: set into the project local config shows the value a more specific file keeps in effect", async (t) => {
  // arrange
  const tree = await createTree(t, "set-local");
  await writeUnder(
    tree.project.localConfigJsonPath,
    JSON.stringify({ plugins: { "demo@mp": {} }, extra: 1 }),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({
    ctx,
    run: runWithNothingLoaded(),
    cwd: tree.cwd,
    scope: "project",
    local: true,
    enabled: false,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Set autoapply to off in claude-plugins.local.json [project].\n\n" +
        "Autoapply: off (claude-plugins.local.json [project])\n\n" +
        "claude-plugins.local.json [project]: off",
      severity: "info",
    },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(tree.project.localConfigJsonPath, "utf8")), {
    plugins: { "demo@mp": {} },
    extra: 1,
    schemaVersion: 1,
    autoapply: false,
  });
  verifyBoundary();
});

test("AAP-04 / MIG-01: set into an absent base config first captures the scope's recorded plugins", async (t) => {
  // arrange
  const tree = await createTree(t, "set-migrates");
  const marketplaceRoot = path.join(tree.cwd, "mp-src");
  await mkdir(tree.project.extensionRoot, { recursive: true });
  await saveState(tree.project.extensionRoot, {
    schemaVersion: 3,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource(marketplaceRoot),
        addedFromCwd: tree.cwd,
        manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
        marketplaceRoot,
        plugins: {},
      },
    },
  });
  const { ctx, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({
    ctx,
    run: runWithNothingLoaded(),
    cwd: tree.cwd,
    scope: "project",
    enabled: true,
  });

  // assert
  assert.deepStrictEqual(JSON.parse(await readFile(tree.project.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: { mp: { source: marketplaceRoot } },
    plugins: {},
    autoapply: true,
  });
  verifyBoundary();
});

test("AAP-04 / D-03: set refuses to write an invalid target config and reports it as the load does", async (t) => {
  // arrange
  const tree = await createTree(t, "set-invalid-target");
  const bytes = JSON.stringify({ autoapply: "yes" });
  await writeUnder(tree.user.baseConfigJsonPath, bytes);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd, enabled: true });

  // assert
  assert.deepStrictEqual(notifications, [{ message: INVALID_USER_BASE, severity: "error" }]);
  assert.equal(await readFile(tree.user.baseConfigJsonPath, "utf8"), bytes);
  verifyBoundary();
});

test("AAP-04 / D-03: set writes a valid target, then reports another invalid config instead of a value", async (t) => {
  // arrange
  const tree = await createTree(t, "set-other-invalid");
  await writeUnder(tree.user.baseConfigJsonPath, JSON.stringify({ autoapply: "yes" }));
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({
    ctx,
    run: runWithNothingLoaded(),
    cwd: tree.cwd,
    scope: "project",
    enabled: true,
  });

  // assert
  assert.deepStrictEqual(notifications, [{ message: INVALID_USER_BASE, severity: "error" }]);
  assert.deepStrictEqual(JSON.parse(await readFile(tree.project.baseConfigJsonPath, "utf8")), {
    schemaVersion: 1,
    autoapply: true,
  });
  verifyBoundary();
});

test("AAP-04: set while another process holds the scope's state lock fails as lock held and writes nothing", async (t) => {
  // arrange
  const tree = await createTree(t, "set-lock-held");
  await mkdir(tree.user.extensionRoot, { recursive: true });
  const release = await lockfile.lock(tree.user.extensionRoot, {
    lockfilePath: tree.user.stateLockFile,
    realpath: false,
  });
  t.after(() => release());
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({ ctx, run: runWithNothingLoaded(), cwd: tree.cwd, enabled: true });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● claude-plugins.json [user]\n" +
        "  ⊘ claude-plugins.json (failed) {lock held}\n" +
        "    cause: Another pi-claude-marketplace operation is in progress for user scope (.state-lock). Retry after it completes.",
      severity: "error",
    },
  ]);
  await assert.rejects(readFile(tree.user.baseConfigJsonPath, "utf8"), { code: "ENOENT" });
  verifyBoundary();
});

test("AAP-04: set whose scope root cannot be created fails with its closed-set reason", async (t) => {
  // arrange
  const tree = await createTree(t, "set-not-dir");
  await writeUnder(path.join(tree.cwd, ".pi"), "not a directory");
  // The runtime's own errno text, which differs across Node majors.
  const refusal = await mkdir(tree.project.extensionRoot, { recursive: true }).then(
    () => assert.fail("the extension root was created"),
    (err: unknown) => redactAbsolutePaths(errorMessage(err)),
  );
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  await setAutoapply({
    ctx,
    run: runWithNothingLoaded(),
    cwd: tree.cwd,
    scope: "project",
    enabled: true,
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● claude-plugins.json [project]\n" +
        "  ⊘ claude-plugins.json (failed) {source missing}\n" +
        `    cause: ${refusal}`,
      severity: "error",
    },
  ]);
  verifyBoundary();
});
