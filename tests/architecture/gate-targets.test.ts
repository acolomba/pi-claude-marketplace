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
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as registry from "./gate-targets.ts";
import { REPO_ROOT, stripComments } from "./source-scan.ts";
import {
  materializeTargets,
  plantBenignNearMiss,
  plantOffender,
  withTempRoot,
} from "./temp-root-control.ts";

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

// ---------------------------------------------------------------------------
// D-07-06: the self-hosting half. The clauses above judge the registry's data;
// the two below judge every OTHER file in the gate corpus, so a gate that
// spells a production target locally fails here instead of quietly
// reintroducing the invisibility D-07-05 exists to close.
// ---------------------------------------------------------------------------

/**
 * This gate's own path.
 *
 * Excluded from both rules below by EXACT path, alongside the registry, because
 * both files necessarily spell what they forbid: the registry IS the sanctioned
 * declaration site, and this file has to carry the offender text its controls
 * plant. The exclusion is two exact strings and not a pattern on purpose -- a
 * pattern is an allow-list that grows, which is the failure a meta-gate is
 * supposed to prevent rather than commit.
 */
const SELF_REL = "tests/architecture/gate-targets.test.ts";

/**
 * The gate whose real copy the offender and benign controls are derived from.
 *
 * A test path, named here as a whole literal on purpose. Rule one polices
 * PRODUCTION paths only: `D-07-07` scopes the registry to production targets, so
 * a gate naming a file in its own tree is addressing itself and has nothing to
 * go stale against. That is the decided answer to "registry section or gate
 * exemption" for test paths -- neither, because the rule's pattern never reaches
 * them.
 */
const CONTROL_VICTIM_REL = "tests/architecture/no-orchestrator-network.test.ts";

/** The module whose whole job is joining a caller's target onto a scan root. */
const SCAN_MECHANIC_REL = "tests/architecture/source-scan.ts";

/** A repository-relative production path, as a gate file may spell one. */
const PRODUCTION_PATH_LITERAL = /(["'`])((?:\.\/)?extensions\/pi-claude-marketplace\/[^"'`]*)\1/g;

/** One `path.join` / `path.resolve` call, tolerating one level of nesting. */
const COMPOSITION_CALL = /path\.(?:join|resolve)\((?:[^()]|\([^()]*\))*\)/g;

/** A quoted `.ts`-suffixed string, whether a whole path or a bare segment. */
const MODULE_NAME_LITERAL = /(["'])([^"']*\.ts)\1/g;

/** A path spelled from a repository root down, which is the sanctioned form. */
const WHOLE_REPO_RELATIVE = /^(?:\.\/)?(?:extensions|tests|scripts|docs)\//;

/** Repair for a locally-spelled production path. */
const NAMED_REMEDY =
  "Add the path to the registry group carrying that obligation and import it, annotating the local reference `(typeof GROUP)[number]` so the compiler rejects drift.";

/** Repair for a production module name assembled from segments. */
const ASSEMBLED_REMEDY =
  "Name the whole repository-relative path as ONE literal instead: from the registry when the target is production, inline when it is a test path, which rule one does not police.";

/** What one survey of the gate corpus opened and found. */
interface GateSurvey {
  /** `file names path` rows for production paths the registry does not carry. */
  readonly named: ReadonlyArray<string>;
  /** `file assembles segment` rows for module names built from segments. */
  readonly assembled: ReadonlyArray<string>;
  /** Repository-relative gate files really opened, in scan order. */
  readonly visited: ReadonlyArray<string>;
}

/**
 * Every repository-relative production path `stripped` names as a whole literal.
 *
 * Comments are stripped by the caller for the reason every scanning clause in
 * this tree strips them: a file header legally names the path it guards, so an
 * unstripped scan fails on its own subject's prose.
 *
 * A relative module specifier begins `../`, so this pattern cannot match one,
 * and that is deliberate rather than an oversight. A stale specifier breaks
 * `npm run typecheck` or throws at import time, which is a louder and earlier
 * failure than any gate can produce; policing it here would add noise and
 * subtract nothing.
 */
function namedProductionPaths(stripped: string): string[] {
  return [...stripped.matchAll(PRODUCTION_PATH_LITERAL)].map((match) => match[2] ?? "");
}

/**
 * Every production module NAME `stripped` assembles inside a path composition.
 *
 * The discriminator is the segment, not the call. `path.join(root, rel)` where
 * `rel` arrives as a whole literal is the shared scan mechanic itself, and a
 * whole repository-relative literal passed to a join is already rule one's
 * business -- neither hides a name. A bare `"install-flow.ts"` joined onto a
 * root is the offence: the path it produces appears nowhere as text, so the
 * literal-match scan the registry exists to serve cannot see it go stale.
 */
function assembledModuleNames(stripped: string): string[] {
  const segments: string[] = [];
  for (const call of stripped.match(COMPOSITION_CALL) ?? []) {
    for (const literal of call.matchAll(MODULE_NAME_LITERAL)) {
      const named = literal[2] ?? "";
      if (!WHOLE_REPO_RELATIVE.test(named)) {
        segments.push(named);
      }
    }
  }

  return segments;
}

/** Every production path the registry module under `root` spells as a literal. */
async function registeredProductionPaths(root: string): Promise<ReadonlySet<string>> {
  const source = await readFile(path.join(root, REGISTRY_REL), "utf8");

  return new Set(namedProductionPaths(stripComments(source)));
}

/** The gate corpus under `root`, minus the registry and this file. */
async function gateCorpusUnder(root: string): Promise<string[]> {
  const entries = await readdir(path.join(root, registry.ARCHITECTURE_DIR_REL), {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .filter((rel) => rel !== REGISTRY_REL && rel !== SELF_REL)
    .sort();
}

/** Open every `files` entry under `root` and judge it against both rules. */
async function surveyGateCorpus(
  root: string,
  files: ReadonlyArray<string>,
  registered: ReadonlySet<string>,
): Promise<GateSurvey> {
  const named: string[] = [];
  const assembled: string[] = [];
  const visited: string[] = [];
  for (const rel of files) {
    const stripped = stripComments(await readFile(path.join(root, rel), "utf8"));
    visited.push(rel);
    for (const production of namedProductionPaths(stripped)) {
      if (!registered.has(production)) {
        named.push(`${rel} names ${production}`);
      }
    }

    for (const segment of assembledModuleNames(stripped)) {
      assembled.push(`${rel} assembles ${segment}`);
    }
  }

  return { assembled, named, visited };
}

/**
 * A production path derived from a real registry entry that the registry does
 * NOT carry.
 *
 * Derived at plant time rather than hand-authored: an offender written out by
 * hand drifts away from the shape it claims to represent, and drift is how a
 * control goes quiet. The derivation asserts loudly when it fails to produce an
 * unregistered path, so a control can never plant something the rule is right to
 * ignore.
 */
function unregisteredPathFrom(registered: ReadonlySet<string>): string {
  const derived = `${path.posix.dirname(moduleAnchorFrom(registered))}/renamed-out-from-under-the-registry.ts`;
  assert.ok(
    !registered.has(derived),
    `the derived offender ${derived} is itself registered, so planting it would prove nothing`,
  );

  return derived;
}

/**
 * The registry's first production MODULE entry, in sorted order.
 *
 * Filtered to `.ts` because the registry also carries directory roots, and a
 * directory has no module name to assemble -- deriving a control from one would
 * plant a segment the assembly rule is right to ignore, which is a control that
 * proves nothing while looking like it does.
 */
function moduleAnchorFrom(registered: ReadonlySet<string>): string {
  const [anchor] = [...registered].filter((rel) => rel.endsWith(".ts")).sort();
  assert.ok(
    anchor !== undefined,
    "the registry named no production module to derive a control from",
  );

  return anchor;
}

/** A composition line assembling the basename of a real registry entry. */
function assembledLineFrom(registered: ReadonlySet<string>): string {
  const segment = path.posix.basename(moduleAnchorFrom(registered));

  return `const probe = path.join(PLUGIN_ORCHESTRATORS_REL, "${segment}");`;
}

/** Materialize the registry plus `victims` into `root` and survey what lands. */
async function surveyPlantedCorpus(
  root: string,
  victims: ReadonlyArray<string>,
): Promise<GateSurvey> {
  const registered = await registeredProductionPaths(root);

  return surveyGateCorpus(root, victims, registered);
}

test("D-07-06: no gate file names a production path the registry does not carry", async () => {
  // arrange
  const registered = await registeredProductionPaths(REPO_ROOT);
  const files = await gateCorpusUnder(REPO_ROOT);

  // act
  const survey = await surveyGateCorpus(REPO_ROOT, files, registered);

  // assert
  assert.ok(
    registered.size > 0,
    "the registry spelled no production path, so every file trivially agrees with it",
  );
  assert.deepEqual(
    survey.visited,
    files,
    "the survey opened a different set than the corpus walk declared",
  );
  assert.ok(
    survey.visited.includes(CONTROL_VICTIM_REL),
    `the survey never opened ${CONTROL_VICTIM_REL}, so it judged a corpus missing a file known to name production targets`,
  );
  assert.deepEqual(
    survey.named,
    [],
    `D-07-05 / D-07-06: these gate files spell a production path the registry does not carry, so a literal-match scan of the registry cannot see it go stale:\n  ${survey.named.join("\n  ")}\n${NAMED_REMEDY}`,
  );
});

test("D-07-06: no gate file assembles a production module name from segments", async () => {
  // arrange
  const registered = await registeredProductionPaths(REPO_ROOT);
  const files = await gateCorpusUnder(REPO_ROOT);

  // act
  const survey = await surveyGateCorpus(REPO_ROOT, files, registered);

  // assert
  assert.ok(survey.visited.length > 0, "the survey opened no gate file at all");
  assert.deepEqual(
    survey.assembled,
    [],
    `D-07-06: these gate files build a production module name from segments, which is exactly the target a literal-match stale-path scan cannot see:\n  ${survey.assembled.join("\n  ")}\n${ASSEMBLED_REMEDY}`,
  );
});

test("the naming rule reports a production path planted outside the registry", async () => {
  await withTempRoot("gate-targets-named-", async (root) => {
    // arrange
    await materializeTargets(root, [REGISTRY_REL, CONTROL_VICTIM_REL]);
    const offender = unregisteredPathFrom(await registeredProductionPaths(root));
    await plantOffender(root, CONTROL_VICTIM_REL, `const probe = "${offender}";`);

    // act
    const survey = await surveyPlantedCorpus(root, [CONTROL_VICTIM_REL]);

    // assert
    assert.deepEqual(survey.named, [`${CONTROL_VICTIM_REL} names ${offender}`]);
    assert.deepEqual(survey.assembled, []);
  });
});

test("the assembly rule reports a module name planted inside a path composition", async () => {
  await withTempRoot("gate-targets-assembled-", async (root) => {
    // arrange
    await materializeTargets(root, [REGISTRY_REL, CONTROL_VICTIM_REL]);
    const registered = await registeredProductionPaths(root);
    const segment = path.posix.basename(moduleAnchorFrom(registered));
    await plantOffender(root, CONTROL_VICTIM_REL, assembledLineFrom(registered));

    // act
    const survey = await surveyPlantedCorpus(root, [CONTROL_VICTIM_REL]);

    // assert
    assert.deepEqual(survey.assembled, [`${CONTROL_VICTIM_REL} assembles ${segment}`]);
    assert.deepEqual(survey.named, []);
  });
});

test("neither rule reports an unmutated copy of the same gate file", async () => {
  await withTempRoot("gate-targets-benign-", async (root) => {
    // arrange
    await materializeTargets(root, [REGISTRY_REL, CONTROL_VICTIM_REL]);

    // act
    const survey = await surveyPlantedCorpus(root, [CONTROL_VICTIM_REL]);

    // assert
    assert.deepEqual(survey.visited, [CONTROL_VICTIM_REL]);
    assert.deepEqual(survey.named, []);
    assert.deepEqual(survey.assembled, []);
  });
});

test("neither rule reports the same production path carried inside a comment", async () => {
  await withTempRoot("gate-targets-comment-", async (root) => {
    // arrange
    await materializeTargets(root, [REGISTRY_REL, CONTROL_VICTIM_REL]);
    const offender = unregisteredPathFrom(await registeredProductionPaths(root));
    await plantBenignNearMiss(root, CONTROL_VICTIM_REL, offender);

    // act
    const survey = await surveyPlantedCorpus(root, [CONTROL_VICTIM_REL]);

    // assert
    assert.deepEqual(survey.visited, [CONTROL_VICTIM_REL]);
    assert.deepEqual(survey.named, []);
    assert.deepEqual(survey.assembled, []);
  });
});

test("the assembly rule does not report the shared scan mechanic itself", async () => {
  await withTempRoot("gate-targets-mechanic-", async (root) => {
    // arrange
    await materializeTargets(root, [REGISTRY_REL, SCAN_MECHANIC_REL]);
    const mechanic = await readFile(path.join(root, SCAN_MECHANIC_REL), "utf8");

    // act
    const survey = await surveyPlantedCorpus(root, [SCAN_MECHANIC_REL]);

    // assert
    assert.ok(
      stripComments(mechanic).includes("path.join(scanRoot, rel)"),
      `${SCAN_MECHANIC_REL} no longer carries the join this control exists to exonerate`,
    );
    assert.deepEqual(survey.assembled, []);
    assert.deepEqual(survey.named, []);
  });
});
