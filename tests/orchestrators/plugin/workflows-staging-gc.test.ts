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

/**
 * WR-08: `chmod` denial is inert for uid 0 -- a 0o444/0o555 mode restricts
 * nothing for root, so `lstat` and `rm` both succeed and the case fails against
 * the sweep logic instead of naming the environment. Refuse up front, matching
 * `denyWrites` in tests/orchestrators/reconcile/apply.test.ts.
 */
function requireNonRoot(): void {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    throw new Error("chmod-based denial cannot deny root; run this suite as a non-root user");
  }
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
  requireNonRoot();
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
  requireNonRoot();
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

test("WR-01: refuses a symlinked staging segment per entry without ending the sweep", async (t) => {
  // arrange
  // Two aged entries behind the same symlinked segment. Both must be refused:
  // a refusal that escaped the loop would abort the pass at the first one, and
  // both call sites discard the escape in a bare `catch {}`, so the sweep would
  // die silently for every remaining tree.
  const { home, locations } = await createStagingScope(t, "workflows-staging-gc-symlink-");
  const external = path.join(home, "external-staging");
  const first = path.join(external, "aaa-abandoned");
  const second = path.join(external, "bbb-abandoned");
  for (const orphan of [first, second]) {
    await mkdir(orphan, { recursive: true });
    await writeFile(path.join(orphan, "acme_greet.json"), "{}\n");
    await backdate(orphan);
  }

  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await symlink(external, locations.workflowsStagingDir, "dir");

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.strictEqual(leaks.length, 2);
  assert.strictEqual(
    leaks[0],
    `aaa-abandoned: workflows staging root aaa-abandoned contains symlink ${locations.workflowsStagingDir} -> ${external} (parent: ${locations.workflowsHomeDir}, target: ${path.join(locations.workflowsStagingDir, "aaa-abandoned")}).`,
  );
  assert.match(
    leaks[1] ?? "",
    /^bbb-abandoned: workflows staging root bbb-abandoned contains symlink/,
  );
  // NFR-10: refused, so neither tree outside the home was removed.
  assert.deepStrictEqual(await readdir(first), ["acme_greet.json"]);
  assert.deepStrictEqual(await readdir(second), ["acme_greet.json"]);
});

test("WR-02: keeps an aged staging tree whose .previous still holds displaced envelopes", async (t) => {
  // arrange
  // `retained` models the commit's failed-restore path: the restore could not
  // put the previous envelope back, so the commit KEPT the staging root because
  // `.previous/` is the only copy left and the operator was told to move it back
  // by hand. `swept` is an ordinary crash orphan of the same age with no
  // displacement, and proves the skip is targeted rather than a blanket bail.
  const { locations } = await createStagingScope(t, "workflows-staging-gc-retained-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  const displaced = path.join(retained, ".previous");
  await mkdir(displaced);
  await writeFile(path.join(displaced, "acme_greet.json"), `{"name":"acme:previous"}\n`);
  await backdate(retained);
  await seedStagingTree(locations, "bbb-swept", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), ["aaa-retained"]);
  // The bytes themselves, not just the directory: this is the only copy.
  assert.deepStrictEqual(await readdir(displaced), ["acme_greet.json"]);
});

test("WR-05: keeps an aged staging tree whose .previous cannot be read", async (t) => {
  // arrange
  // An unreadable `.previous/` does not prove the directory is empty -- it
  // proves nothing at all, and the answer to an open question here is retention
  // rather than a recursive force-remove over what may be the only copy.
  // `chmod 0o000` stands in for the transient EMFILE/EIO window that cannot be
  // provoked deterministically. `bbb-swept` holds the skip to the one entry
  // whose `.previous/` is ambiguous.
  requireNonRoot();
  const { locations } = await createStagingScope(t, "workflows-staging-gc-unreadable-prev-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  const displaced = path.join(retained, ".previous");
  await mkdir(displaced);
  await writeFile(path.join(displaced, "acme_greet.json"), `{"name":"acme:previous"}\n`);
  t.after(() => chmod(displaced, 0o755).catch(() => undefined));
  await chmod(displaced, 0o000);
  await backdate(retained);
  await seedStagingTree(locations, "bbb-swept", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  // Restore before asserting: the scope's own removal hook is registered first
  // and would otherwise race an unreadable subtree on a failing case.
  await chmod(displaced, 0o755);
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), ["aaa-retained"]);
  // The bytes themselves: the whole point is that they may be the only copy.
  assert.deepStrictEqual(await readdir(displaced), ["acme_greet.json"]);
});

test("WR-05: sweeps an aged staging tree whose .previous is a plain file", async (t) => {
  // arrange
  // ENOTDIR is the second errno that PROVES nothing is displaced: the commit
  // only ever creates `.previous/` as a directory, so a plain file at that name
  // holds no envelope and the tree is an ordinary orphan. Pins the carve-out so
  // a later widening of the retained set has to state its reason.
  const { locations } = await createStagingScope(t, "workflows-staging-gc-file-prev-");
  const root = await seedStagingTree(locations, "abandoned", { aged: false });
  await writeFile(path.join(root, ".previous"), "not a directory\n");
  await backdate(root);

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), []);
});

test("WR-02: sweeps an aged staging tree whose .previous is empty", async (t) => {
  // arrange
  // An empty `.previous/` holds no bytes, so nothing is at risk and the tree is
  // an ordinary orphan. Pins the predicate on the CONTENTS rather than on the
  // directory's mere presence.
  const { locations } = await createStagingScope(t, "workflows-staging-gc-empty-prev-");
  const root = await seedStagingTree(locations, "abandoned", { aged: false });
  await mkdir(path.join(root, ".previous"));
  await backdate(root);

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(leaks, []);
  assert.deepStrictEqual(await stagingEntries(locations), []);
});
