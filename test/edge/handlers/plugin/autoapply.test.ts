// Owner for edge/handlers/plugin/autoapply.ts.
//
// AAP-04 / AAP-D2: the handler delegates the bare form to the show and an
// `on` or `off` to the set, each over a case-owned hermetic tree, and rejects
// every other argument before it reads the context's `cwd`. The show and set
// themselves are proved in test/orchestrators/reconcile/autoapply-setting.test.ts.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { makeAutoapplyHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/autoapply.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import { createNotificationBoundary } from "../../notification-boundary.ts";

const USAGE = "Usage: /claude:plugin autoapply [on|off] [--scope user|project] [--local]";

test("AAP-04: the bare form shows the effective value and every config file", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "autoapply-handler-show-");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
    value: cwd,
    reads: 1,
  });

  // act
  await makeAutoapplyHandler()("", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Autoapply: off (default)\n\n" +
        "claude-plugins.json [user]: not set\n" +
        "claude-plugins.local.json [user]: not set\n" +
        "claude-plugins.json [project]: not set\n" +
        "claude-plugins.local.json [project]: not set",
      severity: "info",
    },
  ]);
  verifyBoundary();
});

test("AAP-04: a scope and layer filter narrow the bare form", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "autoapply-handler-filter-");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
    value: cwd,
    reads: 1,
  });

  // act
  await makeAutoapplyHandler()("--local --scope project", ctx, runWithNothingLoaded());

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: "Autoapply: off (default)\n\nclaude-plugins.local.json [project]: not set",
      severity: "info",
    },
  ]);
  verifyBoundary();
});

for (const { args, scope, local, value } of [
  { args: "on", scope: "user", local: false, value: true },
  { args: "off --scope project --local", scope: "project", local: true, value: false },
] as const) {
  test(`AAP-04: "${args}" writes the ${scope} ${local ? "local" : "base"} config`, async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "autoapply-handler-set-");
    const locations = locationsFor(scope, cwd);
    const file = local ? "claude-plugins.local.json" : "claude-plugins.json";
    const token = value ? "on" : "off";
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, {
      value: cwd,
      reads: 1,
    });

    // act
    await makeAutoapplyHandler()(args, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message:
          `Set autoapply to ${token} in ${file} [${scope}].\n\n` +
          `Autoapply: ${token} (${file} [${scope}])\n\n` +
          `${file} [${scope}]: ${token}`,
        severity: "info",
      },
    ]);
    const filePath = local ? locations.localConfigJsonPath : locations.baseConfigJsonPath;
    assert.deepStrictEqual(JSON.parse(await readFile(filePath, "utf8")), {
      schemaVersion: 1,
      autoapply: value,
    });
    verifyBoundary();
  });
}

for (const { args, message } of [
  { args: "yes", message: 'Unknown argument "yes".' },
  { args: "on off", message: "Too many arguments." },
  { args: "--bogus", message: 'Unknown flag: "--bogus".' },
  {
    args: "on --scope nowhere",
    message: 'Invalid --scope value: "nowhere". Must be "user" or "project".',
  },
]) {
  test(`AAP-04: "${args}" is a usage error that reads no cwd`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

    // act
    await makeAutoapplyHandler()(args, ctx, runWithNothingLoaded());

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `${message}\n\n${USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
  });
}
