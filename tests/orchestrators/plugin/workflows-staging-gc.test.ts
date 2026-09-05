import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  WORKFLOWS_STAGING_MAX_AGE_MS,
  garbageCollectWorkflowsStaging,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

/**
 * Comfortably past the bound, expressed against the exported constant rather
 * than a transcribed copy: a later phase tuning the bound must not silently
 * turn this case's "aged" tree into a fresh one.
 */
const WELL_PAST_THE_BOUND_MS = WORKFLOWS_STAGING_MAX_AGE_MS + 60 * 60 * 1000;

interface StagingScope {
  readonly home: string;
  readonly locations: ScopedLocations;
}

/**
 * Relocate the home directory before the bundle is built, and hand the new home
 * back so a case never re-reads a global it just wrote.
 *
 * `locationsFor` evaluates the workflow home eagerly and freezes the result, so
 * a bundle built before the relocation points at the developer's real
 * `~/.pi/workflows/` and every case below would sweep there. The restoration is
 * registered before anything is mutated, so a failing assertion cannot leave the
 * variable relocated, and an absent variable is deleted rather than reassigned
 * because `process.env` stringifies every assignment.
 *
 * Nothing under the workflow home is created here: the absent-directory case has
 * to observe a home with no staging root at all.
 */
async function createStagingScope(t: TestContext, prefix: string): Promise<StagingScope> {
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
  return { home, locations: locationsFor("project", scopeRoot) };
}

/** Backdate an entry so the sweep reads it as abandoned rather than in flight. */
async function backdate(target: string): Promise<void> {
  const stamp = new Date(Date.now() - WELL_PAST_THE_BOUND_MS);
  await utimes(target, stamp, stamp);
}

async function seedStagingTree(
  locations: ScopedLocations,
  name: string,
  { aged }: { readonly aged: boolean },
): Promise<string> {
  const root = path.join(locations.workflowsStagingDir, name);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "acme_greet.json"), `{"name":"acme:${name}"}\n`);
  if (aged) {
    await backdate(root);
  }

  return root;
}

async function stagingEntries(locations: ScopedLocations): Promise<string[]> {
  try {
    return (await readdir(locations.workflowsStagingDir)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

test("removes a staging tree left behind longer than the maximum age", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-aged-");
  await seedStagingTree(locations, "abandoned", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), []);
});

test("keeps a staging tree still inside the maximum age", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-fresh-");
  const live = await seedStagingTree(locations, "in-flight", { aged: false });
  await seedStagingTree(locations, "abandoned", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), ["in-flight"]);
  assert.deepStrictEqual(await readdir(live), ["acme_greet.json"]);
});

test("returns an empty leak list when the staging directory is absent", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-absent-");

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), []);
});

test("rethrows a non-ENOENT staging read failure without changing the path", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-enotdir-");
  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await writeFile(locations.workflowsStagingDir, "not a directory");
  let caught: unknown;

  // act
  try {
    await garbageCollectWorkflowsStaging(locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.name, "Error");
  assert.strictEqual((caught as NodeJS.ErrnoException).code, "ENOTDIR");
});

test("skips an aged staging entry that is not a directory", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-nondir-");
  await mkdir(locations.workflowsStagingDir, { recursive: true });
  const stray = path.join(locations.workflowsStagingDir, "stray.json");
  await writeFile(stray, "{}\n");
  await backdate(stray);

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), ["stray.json"]);
});

test("records a leak for a staging entry it cannot inspect", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-unreadable-");
  await seedStagingTree(locations, "unreachable", { aged: true });
  // Read-but-not-search: `readdir` reports the entry and the per-entry `lstat`
  // is what fails. The restoring chmod is registered before the scope's own
  // removal hook can run, so the tree is searchable again before it is unlinked.
  t.after(() => chmod(locations.workflowsStagingDir, 0o755).catch(() => undefined));
  await chmod(locations.workflowsStagingDir, 0o444);

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.strictEqual(leaks.length, 1);
  assert.match(leaks[0] ?? "", /^unreachable: /);
  await chmod(locations.workflowsStagingDir, 0o755);
  assert.deepStrictEqual(await stagingEntries(locations), ["unreachable"]);
});

test("continues past a staging tree it cannot remove and names it once", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-gc-leak-");
  const blocked = await seedStagingTree(locations, "aaa-blocked", { aged: true });
  const locked = path.join(blocked, "locked");
  await mkdir(locked);
  await writeFile(path.join(locked, "acme_shout.json"), "{}\n");
  t.after(() => chmod(locked, 0o755).catch(() => undefined));
  await chmod(locked, 0o555);
  await backdate(blocked);
  await seedStagingTree(locations, "bbb-abandoned", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  // Unlock before asserting: the scope's own removal hook is registered first
  // and would otherwise race a still-unwritable subtree on a failing case.
  await chmod(locked, 0o755);
  assert.strictEqual(leaks.length, 1);
  assert.match(leaks[0] ?? "", /^aaa-blocked: /);
  assert.deepStrictEqual(await stagingEntries(locations), ["aaa-blocked"]);
});

test("rejects when the staging segment itself is a symbolic link", async (t) => {
  // arrange
  const { home, locations } = await createStagingScope(t, "workflows-staging-gc-symlink-");
  const external = path.join(home, "external-staging");
  const externalOrphan = path.join(external, "abandoned");
  await mkdir(externalOrphan, { recursive: true });
  await writeFile(path.join(externalOrphan, "acme_greet.json"), "{}\n");
  await backdate(externalOrphan);
  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await symlink(external, locations.workflowsStagingDir, "dir");
  let caught: unknown;

  // act
  try {
    await garbageCollectWorkflowsStaging(locations);
  } catch (error) {
    caught = error;
  }

  // assert
  assert.ok(caught instanceof Error);
  assert.strictEqual(caught.name, "SymlinkRefusedError");
  assert.strictEqual(
    caught.message,
    `workflows staging root abandoned contains symlink ${locations.workflowsStagingDir} -> ${external} (parent: ${locations.workflowsHomeDir}, target: ${path.join(locations.workflowsStagingDir, "abandoned")}).`,
  );
  assert.deepStrictEqual(await readdir(externalOrphan), ["acme_greet.json"]);
});
