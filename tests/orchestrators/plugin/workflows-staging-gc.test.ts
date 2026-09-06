import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import {
  WORKFLOWS_STAGING_MAX_AGE_MS,
  garbageCollectWorkflowsStaging,
  scanRetainedWorkflowsStaging,
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

test("WR-07: refuses a symlinked staging segment before reading through it", async (t) => {
  // arrange
  // The refused entry carries a non-empty `.previous/`, so the retention
  // predicate would answer "keep this" if it ran first -- and answering it
  // reads through the very segment the containment check exists to refuse.
  // Ordering is the whole assertion here: a refusal recorded as a leak can only
  // happen if the boundary was walked before anything under it was read.
  const { home, locations } = await createStagingScope(t, "workflows-staging-gc-probe-order-");
  const external = path.join(home, "external-staging");
  const orphan = path.join(external, "abandoned");
  const displaced = path.join(orphan, ".previous");
  await mkdir(displaced, { recursive: true });
  await writeFile(path.join(orphan, "acme_greet.json"), "{}\n");
  await writeFile(path.join(displaced, "acme_greet.json"), `{"name":"acme:previous"}\n`);
  await backdate(orphan);

  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await symlink(external, locations.workflowsStagingDir, "dir");

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  assert.strictEqual(leaks.length, 1);
  assert.match(leaks[0] ?? "", /^abandoned: workflows staging root abandoned contains symlink/);
  // NFR-10: refused, so the tree outside the home is untouched either way.
  assert.deepStrictEqual((await readdir(orphan)).sort(), [".previous", "acme_greet.json"]);
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

// ---------------------------------------------------------------------------
// WR-06: the read-only retained-tree scan.
//
// The sweep above declines to remove an aged tree whose `.previous/` still
// holds envelopes, because those bytes are the only surviving copy of the
// user's previous workflow scripts. Nothing then removes that tree and nothing
// names it. These cases pin the read-only sibling that names it, and pin that
// it reports EXACTLY the set the sweep keeps for that reason -- same predicate,
// same age bound -- so a live transaction mid-commit is never reported.
// ---------------------------------------------------------------------------

/** Give a staging tree a `.previous/` holding `count` displaced envelopes. */
async function displace(root: string, count: number): Promise<string> {
  const displaced = path.join(root, ".previous");
  await mkdir(displaced, { recursive: true });
  for (let i = 0; i < count; i += 1) {
    await writeFile(path.join(displaced, `acme_prev${i}.json`), `{"name":"acme:prev${i}"}\n`);
  }

  return displaced;
}

test("WR-06: reports an aged staging tree whose .previous holds displaced envelopes", async (t) => {
  // arrange
  // `bbb-orphan` is an aged tree of the same age with no displacement at all --
  // the sweep removes it, so the scan must not name it. Reporting it would tell
  // the operator to recover bytes that were never at risk.
  const { locations } = await createStagingScope(t, "workflows-staging-scan-retained-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  await displace(retained, 2);
  await backdate(retained);
  await seedStagingTree(locations, "bbb-orphan", { aged: true });

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, [{ name: "aaa-retained", envelopeCount: 2 }]);
});

test("WR-06: does not report a staging tree still inside the maximum age", async (t) => {
  // arrange
  // The displaced envelopes are present, so only the age bound separates this
  // tree from a reported one. A transaction mid-commit holds exactly this
  // shape, and naming it would send the operator to recover a live staging root.
  const { locations } = await createStagingScope(t, "workflows-staging-scan-fresh-");
  const live = await seedStagingTree(locations, "in-flight", { aged: false });
  await displace(live, 1);

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, []);
});

test("WR-06: returns the empty result and creates nothing when the staging directory is absent", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-scan-absent-");

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, []);
  // NFR-5 read-surface discipline: the scan must not bring the directory into
  // existence on its way to answering "nothing is retained".
  await assert.rejects(readdir(locations.workflowsStagingDir), { code: "ENOENT" });
});

test("WR-06: returns the empty result rather than throwing when the staging directory cannot be read", async (t) => {
  // arrange
  // The sweep rethrows a non-ENOENT read failure; the scan cannot, because its
  // caller is a read-only command with no failure arm of its own to route it to.
  const { locations } = await createStagingScope(t, "workflows-staging-scan-enotdir-");
  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await writeFile(locations.workflowsStagingDir, "not a directory");

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, []);
});

test("WR-06: skips a staging entry it cannot inspect and still resolves", async (t) => {
  // arrange
  // Read-but-not-search on the staging directory: `readdir` names both entries
  // and the per-entry `lstat` is what fails. Both entries fail together because
  // the permission sits on their shared parent -- a single-entry inspection
  // failure is a race with no deterministic vehicle. What is pinned here is
  // that the failure is skipped rather than thrown out of a read-only command.
  requireNonRoot();
  const { locations } = await createStagingScope(t, "workflows-staging-scan-unreadable-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  await displace(retained, 1);
  await backdate(retained);
  await seedStagingTree(locations, "bbb-retained", { aged: true });
  t.after(() => chmod(locations.workflowsStagingDir, 0o755).catch(() => undefined));
  await chmod(locations.workflowsStagingDir, 0o444);

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  await chmod(locations.workflowsStagingDir, 0o755);
  assert.deepStrictEqual(found, []);
});

test("WR-07: skips a refused staging segment and resolves rather than rejecting", async (t) => {
  // arrange
  // Two aged trees, both carrying displaced envelopes, behind a symlinked
  // staging segment. Every entry is refused by construction: a symlinked ENTRY
  // is skipped earlier as a non-directory, so the segment is the only place a
  // containment refusal can originate. The claim is that a refusal neither
  // reports the entry nor ends the pass -- the call resolves.
  const { home, locations } = await createStagingScope(t, "workflows-staging-scan-symlink-");
  const external = path.join(home, "external-staging");
  for (const name of ["aaa-retained", "bbb-retained"]) {
    const orphan = path.join(external, name);
    await mkdir(orphan, { recursive: true });
    await displace(orphan, 1);
    await backdate(orphan);
  }

  await mkdir(locations.workflowsHomeDir, { recursive: true });
  await symlink(external, locations.workflowsStagingDir, "dir");

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, []);
});

test("WR-06: skips an aged staging entry that is not a directory", async (t) => {
  // arrange
  const { locations } = await createStagingScope(t, "workflows-staging-scan-nondir-");
  await mkdir(locations.workflowsStagingDir, { recursive: true });
  const stray = path.join(locations.workflowsStagingDir, "stray.json");
  await writeFile(stray, "{}\n");
  await backdate(stray);

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(found, []);
});

test("WR-06: sorts the reported trees by directory name", async (t) => {
  // arrange
  // Seeded in reverse so a pass that simply forwarded the enumeration order
  // could not accidentally agree. Order is the byte-identical-on-repeat
  // contract of the surface that renders this: `readdir` order is not sorted
  // and is not stable across filesystems.
  const { locations } = await createStagingScope(t, "workflows-staging-scan-sorted-");
  for (const name of ["ccc-retained", "aaa-retained", "bbb-retained"]) {
    const root = await seedStagingTree(locations, name, { aged: false });
    await displace(root, 1);
    await backdate(root);
  }

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  assert.deepStrictEqual(
    found.map((entry) => entry.name),
    ["aaa-retained", "bbb-retained", "ccc-retained"],
  );
});

test("WR-05: reports a retained tree whose .previous cannot be read, with no count", async (t) => {
  // arrange
  // The same open question the sweep answers by retaining: an unreadable
  // `.previous/` does not prove the directory is empty. The scan inherits that
  // answer -- it reports the tree -- but it cannot state a count it never read,
  // so the count is ABSENT rather than zero. `chmod 0o000` stands in for the
  // transient EMFILE/EIO window that cannot be provoked deterministically.
  requireNonRoot();
  const { locations } = await createStagingScope(t, "workflows-staging-scan-unreadable-prev-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  const displaced = await displace(retained, 1);
  t.after(() => chmod(displaced, 0o755).catch(() => undefined));
  await chmod(displaced, 0o000);
  await backdate(retained);

  // act
  const found = await scanRetainedWorkflowsStaging(locations);

  // assert
  await chmod(displaced, 0o755);
  assert.deepStrictEqual(found, [{ name: "aaa-retained" }]);
});

test("WR-02: the sweep's leak list and retention decisions survive the shared reader", async (t) => {
  // arrange
  // The refactor's regression guard. One tree of each kind the sweep
  // distinguishes -- retained for displaced envelopes, unremovable, ordinary
  // orphan -- swept in one pass, so a reader that answered any of the three
  // differently would move either the leak list or the surviving set.
  requireNonRoot();
  const { locations } = await createStagingScope(t, "workflows-staging-gc-refactor-");
  const retained = await seedStagingTree(locations, "aaa-retained", { aged: false });
  await displace(retained, 1);
  await backdate(retained);
  const blocked = await seedStagingTree(locations, "bbb-blocked", { aged: true });
  const locked = path.join(blocked, "locked");
  await mkdir(locked);
  await writeFile(path.join(locked, "acme_shout.json"), "{}\n");
  t.after(() => chmod(locked, 0o755).catch(() => undefined));
  await chmod(locked, 0o555);
  await backdate(blocked);
  await seedStagingTree(locations, "ccc-orphan", { aged: true });

  // act
  const leaks = await garbageCollectWorkflowsStaging(locations);

  // assert
  await chmod(locked, 0o755);
  assert.strictEqual(leaks.length, 1);
  assert.match(leaks[0] ?? "", /^bbb-blocked: /);
  assert.deepStrictEqual(await stagingEntries(locations), ["aaa-retained", "bbb-blocked"]);
});
