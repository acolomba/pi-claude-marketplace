/**
 * The target registry's own gate.
 *
 * D-07-05 makes `tests/architecture/gate-targets.ts` the one file a literal-match
 * stale-path scan has to read. That buys nothing unless three properties hold,
 * and none of them is visible by reading the data: every declared target still
 * resolves, every group still has members, and no entry is composed. A registry
 * whose entries quietly stopped resolving hands each importing gate a list of
 * files it will never open, and every one of those gates then reports success
 * over nothing -- the exact failure GGAT-01 names.
 *
 * The groups are enumerated from the module namespace rather than from a list of
 * names kept here, so a group added to the registry later is covered by every
 * clause below without editing this file. A hand-maintained name list would let a
 * new group escape the proof and report success by omission, which is the same
 * defect one level up.
 */

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as registry from "./gate-targets.ts";
import { REPO_ROOT, stripComments } from "./source-scan.ts";

/** The registry module, as this gate addresses it on disk. */
const REGISTRY_REL = "tests/architecture/gate-targets.ts";

/**
 * The single group whose resolution contract is INVERTED.
 *
 * WR-06: `MISSING_TARGET_PROBES` holds paths that must NOT exist. They are the
 * fixtures proving the shared scan mechanic fails (or explicitly waives) a target
 * it cannot open, instead of greening over zero inspected files. A probe that
 * started resolving would disarm that proof silently, so this gate asserts the
 * absence rather than assuming it.
 */
const MUST_NOT_RESOLVE_GROUP = "MISSING_TARGET_PROBES";

/** Sanctioned repair, appended to every failure message this gate can raise. */
const REMEDY = "Add the path to the registry group that carries this obligation.";

/** Every array-valued export of the registry, as `[name, entries]` pairs. */
function registryGroups(): Array<[string, ReadonlyArray<string>]> {
  const groups: Array<[string, ReadonlyArray<string>]> = [];
  for (const [name, exported] of Object.entries(registry)) {
    if (Array.isArray(exported)) {
      groups.push([name, exported as ReadonlyArray<string>]);
    }
  }

  return groups.sort(([left], [right]) => left.localeCompare(right));
}

/** `groupName`-labelled entries of `entries` that do not exist under the repository root. */
async function unresolvedEntries(
  groupName: string,
  entries: ReadonlyArray<string>,
): Promise<string[]> {
  const unresolved: string[] = [];
  for (const rel of entries) {
    try {
      await stat(path.join(REPO_ROOT, rel));
    } catch {
      unresolved.push(`${groupName}: ${rel}`);
    }
  }

  return unresolved;
}

/** `groupName`-labelled entries `entries` names more than once. */
function duplicateEntries(groupName: string, entries: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const rel of entries) {
    if (seen.has(rel)) {
      duplicates.push(`${groupName}: ${rel}`);
    }

    seen.add(rel);
  }

  return duplicates;
}

/**
 * Lines of `stripped` that build a path instead of naming one.
 *
 * This clause is what keeps D-07-05 enforceable: one composed entry defeats the
 * single scan point, because a literal-match scan reads the joined fragments and
 * never sees the path they produce. Comments are stripped first -- a header may
 * legally name the paths its group guards.
 */
function composedPathLines(stripped: string): string[] {
  const offenders: string[] = [];
  for (const line of stripped.split("\n")) {
    const composesTemplate =
      /`[^`]*\$\{[^`]*`/.test(line) && line.includes("extensions/pi-claude-marketplace");
    if (line.includes("path.join(") || composesTemplate) {
      offenders.push(line.trim());
    }
  }

  return offenders;
}

test("D-07-05: every registry group declares at least one target", () => {
  // arrange
  const groups = registryGroups();

  // act
  const empty = groups.filter(([, entries]) => entries.length === 0).map(([name]) => name);

  // assert
  assert.ok(groups.length > 0, "the registry exported no array-valued group at all");
  assert.deepEqual(
    empty,
    [],
    `D-07-05: these registry groups are empty, so every gate importing one inspects nothing and reports success over zero targets:\n  ${empty.join("\n  ")}\n${REMEDY}`,
  );
});

test("GGAT-01: every declared registry target resolves under the repository root", async () => {
  // arrange
  const groups = registryGroups().filter(([name]) => name !== MUST_NOT_RESOLVE_GROUP);

  // act
  const unresolved: string[] = [];
  for (const [name, entries] of groups) {
    unresolved.push(...(await unresolvedEntries(name, entries)));
  }

  // assert
  assert.ok(groups.length > 0, "the registry exported no resolving group at all");
  assert.deepEqual(
    unresolved,
    [],
    `GGAT-01: these registry targets do not exist, so the gates importing them open nothing for those entries:\n  ${unresolved.join("\n  ")}\n${REMEDY}`,
  );
});

test("WR-06: every MISSING_TARGET_PROBES entry is absent from disk", async () => {
  // arrange
  const probes = registry.MISSING_TARGET_PROBES;

  // act
  const unresolved = await unresolvedEntries(MUST_NOT_RESOLVE_GROUP, probes);
  const stillResolving = probes
    .map((rel) => `${MUST_NOT_RESOLVE_GROUP}: ${rel}`)
    .filter((labelled) => !unresolved.includes(labelled));

  // assert
  assert.ok(probes.length > 0, "the missing-target probe group is empty");
  assert.deepEqual(
    stillResolving,
    [],
    `WR-06: these probes now resolve, so the case proving a scan fails on an unopenable target proves nothing:\n  ${stillResolving.join("\n  ")}\nRename the probe rather than reusing the collision.`,
  );
});

test("D-07-05: no registry group names the same path twice", () => {
  // arrange
  const groups = registryGroups();

  // act
  const duplicates: string[] = [];
  for (const [name, entries] of groups) {
    duplicates.push(...duplicateEntries(name, entries));
  }

  // assert
  assert.deepEqual(
    duplicates,
    [],
    `D-07-05: these registry groups name the same path more than once, so a gate scans it twice and its visitation report disagrees with its declared list:\n  ${duplicates.join("\n  ")}\nTwo different groups naming one path is legal; one group naming it twice is not.`,
  );
});

test("D-07-05: the registry composes no path of its own", async () => {
  // arrange
  const source = await readFile(path.join(REPO_ROOT, REGISTRY_REL), "utf8");

  // act
  const offenders = composedPathLines(stripComments(source));

  // assert
  assert.deepEqual(
    offenders,
    [],
    `D-07-05: these lines of ${REGISTRY_REL} build a path instead of naming one, which hides it from the literal-match scan the registry exists to serve:\n  ${offenders.join("\n  ")}\nWrite the full repository-relative path out as one string literal.`,
  );
});

test("the resolution clause reports an entry that does not resolve", async () => {
  // arrange
  const plantedGroup = [
    "extensions/pi-claude-marketplace/shared/path-safety.ts",
    "extensions/pi-claude-marketplace/shared/renamed-out-from-under-the-gate.ts",
  ];

  // act
  const unresolved = await unresolvedEntries("PLANTED_GROUP", plantedGroup);

  // assert
  assert.deepEqual(unresolved, [
    "PLANTED_GROUP: extensions/pi-claude-marketplace/shared/renamed-out-from-under-the-gate.ts",
  ]);
});
