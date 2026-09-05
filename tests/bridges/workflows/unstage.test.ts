import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { unstagePluginWorkflows } from "../../../extensions/pi-claude-marketplace/bridges/workflows/unstage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type {
  UnstageWorkflowFailure,
  UnstageWorkflowsInput,
  UnstageWorkflowsResult,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

interface WorkflowScope {
  readonly savedDirectory: string;
  readonly locations: ScopedLocations;
}

/**
 * Relocate the home directory before the bundle is built, and hand the saved
 * directory back so a case never re-reads a global it just wrote.
 *
 * `locationsFor` evaluates the workflow home eagerly and freezes the result, so
 * a bundle built before the relocation points at the developer's real
 * `~/.pi/workflows/` and every case below would pass while writing there. The
 * restoration is registered before anything is mutated, so a failing assertion
 * cannot leave the variable relocated, and an absent variable is deleted rather
 * than reassigned because `process.env` stringifies every assignment.
 */
async function createWorkflowScope(t: TestContext, prefix: string): Promise<WorkflowScope> {
  const home = await mkdtemp(path.join(tmpdir(), prefix));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 3 });
  });
  process.env.HOME = home;

  const scopeRoot = await mkdtemp(path.join(tmpdir(), `${prefix}scope-`));

  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));

  const locations = locationsFor("project", scopeRoot);

  await mkdir(locations.workflowsSavedDir, { recursive: true });
  return { savedDirectory: locations.workflowsSavedDir, locations };
}

test("removes the recorded envelopes in order and preserves foreign bytes", async (t) => {
  // arrange
  const { savedDirectory, locations } = await createWorkflowScope(t, "workflows-unstage-recorded-");
  const foreignEnvelopePath = path.join(savedDirectory, "other:keep.json");
  await writeFile(path.join(savedDirectory, "acme:deploy.json"), '{"name":"acme:deploy"}\n');
  await writeFile(path.join(savedDirectory, "acme:status.json"), '{"name":"acme:status"}\n');
  await writeFile(foreignEnvelopePath, '{"name":"other:keep"}\n');
  const expectedUnstagedWorkflows: UnstageWorkflowsResult = {
    removedNames: ["acme:status", "acme:deploy"],
    warnings: [],
    failed: [],
  };

  // act
  const unstagedWorkflows = await unstagePluginWorkflows({
    locations,
    previousWorkflowNames: ["acme:status", "acme:deploy"],
  });

  // assert
  assert.deepStrictEqual(unstagedWorkflows, expectedUnstagedWorkflows);
  assert.strictEqual(Object.isFrozen(unstagedWorkflows.removedNames), true);
  assert.strictEqual(Object.isFrozen(unstagedWorkflows.warnings), true);
  assert.strictEqual(Object.isFrozen(unstagedWorkflows.failed), true);
  assert.deepStrictEqual(await readdir(savedDirectory), ["other:keep.json"]);
  assert.strictEqual(await readFile(foreignEnvelopePath, "utf8"), '{"name":"other:keep"}\n');
});

test("returns an empty result when no workflow names were recorded", async (t) => {
  // arrange
  const { savedDirectory, locations } = await createWorkflowScope(t, "workflows-unstage-empty-");
  const foreignEnvelopePath = path.join(savedDirectory, "other:keep.json");
  await writeFile(foreignEnvelopePath, '{"name":"other:keep"}\n');

  // act
  const unstagedWorkflows = await unstagePluginWorkflows({
    locations,
    previousWorkflowNames: [],
  });

  // assert
  assert.deepStrictEqual(unstagedWorkflows, { removedNames: [], warnings: [], failed: [] });
  assert.deepStrictEqual(await readdir(savedDirectory), ["other:keep.json"]);
  assert.strictEqual(await readFile(foreignEnvelopePath, "utf8"), '{"name":"other:keep"}\n');
});

test("makes repeated unstaging a missing-envelope fixed point", async (t) => {
  // arrange
  const { savedDirectory, locations } = await createWorkflowScope(t, "workflows-unstage-repeat-");
  await writeFile(path.join(savedDirectory, "acme:once.json"), '{"name":"acme:once"}\n');

  // act
  const firstUnstage = await unstagePluginWorkflows({
    locations,
    previousWorkflowNames: ["acme:once"],
  });
  const replayedUnstage = await unstagePluginWorkflows({
    locations,
    previousWorkflowNames: ["acme:once"],
  });

  // assert
  assert.deepStrictEqual(firstUnstage, {
    removedNames: ["acme:once"],
    warnings: [],
    failed: [],
  });
  assert.deepStrictEqual(replayedUnstage, { removedNames: [], warnings: [], failed: [] });
  assert.deepStrictEqual(await readdir(savedDirectory), []);
});

test("records an unremovable name and still removes the names after it", async (t) => {
  // arrange
  const { savedDirectory, locations } = await createWorkflowScope(t, "workflows-unstage-blocked-");
  const blockedEnvelopePath = path.join(savedDirectory, "acme:blocked.json");
  await mkdir(blockedEnvelopePath);
  await writeFile(path.join(blockedEnvelopePath, "occupant.json"), "occupant bytes\n");
  await writeFile(path.join(savedDirectory, "acme:later.json"), '{"name":"acme:later"}\n');
  const expectedFailure: UnstageWorkflowFailure = {
    name: "acme:blocked",
    reason: `EISDIR: illegal operation on a directory, unlink '${blockedEnvelopePath}'`,
  };

  // act
  const unstagedWorkflows = await unstagePluginWorkflows({
    locations,
    previousWorkflowNames: ["acme:blocked", "acme:later"],
  });

  // assert
  assert.deepStrictEqual(unstagedWorkflows, {
    removedNames: ["acme:later"],
    warnings: [],
    failed: [expectedFailure],
  });
  assert.deepStrictEqual(await readdir(savedDirectory), ["acme:blocked.json"]);
});

test("rejects a recorded name carrying a path separator", async (t) => {
  // arrange
  const { savedDirectory, locations } = await createWorkflowScope(t, "workflows-unstage-unsafe-");
  const escapedEnvelopePath = path.join(savedDirectory, "..", "escape.json");
  await writeFile(escapedEnvelopePath, "escaped bytes\n");
  const unstageInput: UnstageWorkflowsInput = {
    locations,
    previousWorkflowNames: ["../escape"],
  };

  // act & assert
  await assert.rejects(
    () => unstagePluginWorkflows(unstageInput),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(
        error.message,
        'workflowArtifactPath workflow name "../escape" "../escape" must not contain path separators.',
      );
      return true;
    },
  );
  assert.strictEqual(await readFile(escapedEnvelopePath, "utf8"), "escaped bytes\n");
});
