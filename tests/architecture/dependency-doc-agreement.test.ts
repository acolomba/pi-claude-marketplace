// tests/architecture/dependency-doc-agreement.test.ts
//
// RESV-06: `docs/dependency-resolution.md`'s failure table and the reason
// tokens the dependency cascade actually stamps must name the same set.
//
// The table is what a user scans to find out why an install failed, and nothing
// else in the suite compares it to the code. Prose and code drifted apart
// exactly that way once already: the shipped set gained the three transport
// tokens, `{invalid manifest}` and `{dependency failed}` while the table kept a
// row that no code arm produces at all.
//
// How the gate avoids reporting success over nothing. It does NOT read a list
// of tokens from anywhere and compare it to itself. It DRIVES the real
// composers -- `composeCascadeFailureMessage` and `composeCascadeMemberRows` --
// once per failure arm and collects the reasons they emit, so a token the
// composer stops stamping, or starts stamping, moves the actual set. The arm
// fixtures are proven TOTAL at compile time -- the closure list by the `Record`
// key set it satisfies, the constraint list by an `Exclude<...> extends never`
// proof on `kind` -- so an arm added to `DependencyClosureResult` or
// `CascadeConstraintFailure` without a fixture here is a build failure rather
// than a silently narrower sweep.
//
// UPDT-02: the held-update case drives `preparePluginUpdate` itself with a
// held gate verdict, so the tokens it compares against the document are the
// ones the production arm stamps.
//
// DIVG-01: the second half of this gate guards the same claim for
// `docs/dependency-resolution.md`'s prose, not just its failure table. The
// document told readers for one milestone that a path-source dependency could
// satisfy no constraint but the wildcard, after TAGS-01/02 had already made
// that false -- the same class of prose-versus-code drift the first half of
// this file exists to catch. These cases drive `composeCascadeMemberRows`
// with a `fellBackToCurrentCopy` member and read the document's resolution
// and declaration sections, so a future rename or removal of the fallback
// prose, or the reason token it must name, fails here rather than silently.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  composeCascadeFailureMessage,
  composeCascadeMemberRows,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import { preparePluginUpdate } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import { REPO_ROOT } from "./source-scan.ts";

import type { DependencyClosureResult } from "../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";
import type { CascadeMsg } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";
import type { CascadeConstraintFailure } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts";
import type { InstallMsg } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const DOC_REL = "docs/dependency-resolution.md";
const ROOT_KEY = "helper@official";
const DEPENDENCY_KEY = "formatter@tools";

/** The requesting plugin's own row, which the failure composer takes as given. */
const ROOT_ROW: InstallMsg = {
  status: "installed",
  name: "helper",
  dependencies: [],
  version: "1.0.0",
  severity: "info",
  needsReload: true,
};

type ClosureFailure = Extract<DependencyClosureResult, { readonly ok: false }>;

/** One fixture per closure-failure arm, keyed by the arm's own discriminant. */
const CLOSURE_FAILURES = {
  cycle: { ok: false, reason: "cycle", chain: [ROOT_KEY, DEPENDENCY_KEY, ROOT_KEY] },
  "marketplace-not-added": {
    ok: false,
    reason: "marketplace-not-added",
    key: DEPENDENCY_KEY,
    marketplace: "tools",
    requiredBy: ROOT_KEY,
  },
  "not-found": { ok: false, reason: "not-found", key: DEPENDENCY_KEY, requiredBy: ROOT_KEY },
  "unusable-declaration": {
    ok: false,
    reason: "unusable-declaration",
    key: DEPENDENCY_KEY,
    detail: "dependencies.0: sha pinning is not supported",
  },
} as const satisfies Record<ClosureFailure["reason"], ClosureFailure>;

/**
 * One fixture per constraint-failure arm.
 *
 * `range-conflict` appears twice because its `why` half is a second
 * discriminant: a contradiction BETWEEN declarations and a contradiction with
 * what is on disk are different facts about different subjects, and the second
 * stamps a token the first does not.
 */
const CONSTRAINT_FAILURES = {
  "range-conflict:contradictory-declarations": {
    kind: "range-conflict",
    why: "contradictory-declarations",
    key: DEPENDENCY_KEY,
    range: "^1.0.0 ^2.0.0",
    detail: "inputs 1 and 2 do not overlap",
  },
  "range-conflict:installed-unsatisfied": {
    kind: "range-conflict",
    why: "installed-unsatisfied",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    recordedVersion: "1.0.0",
  },
  "range-too-complex": {
    kind: "range-too-complex",
    key: DEPENDENCY_KEY,
    range: "^1.0.0",
    detail: "input exceeds 4096 characters",
  },
  "range-invalid": {
    kind: "range-invalid",
    key: DEPENDENCY_KEY,
    range: "not-a-range",
    detail: "dependencies.0: unreadable range",
  },
  "no-matching-tag": { kind: "no-matching-tag", key: DEPENDENCY_KEY, range: "^2.0.0" },
  "tag-listing-failed:network": {
    kind: "tag-listing-failed",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    classification: "network unreachable",
  },
  "tag-listing-failed:auth": {
    kind: "tag-listing-failed",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    classification: "authentication required",
  },
  "tag-listing-failed:unclassified": {
    kind: "tag-listing-failed",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    classification: undefined,
  },
} as const satisfies Record<string, CascadeConstraintFailure>;

/**
 * Totality proof for the constraint arms. `CLOSURE_FAILURES` needs none: the
 * `Record` it satisfies is keyed by the arm discriminant, so a missing arm is
 * already a missing property. `CONSTRAINT_FAILURES` is keyed by `string`
 * because the `why` split doubles one `kind`, so its proof is on `kind` alone:
 * `AssertNever` accepts `never` only, and a `kind` without a fixture leaves
 * `UncoveredConstraintArm` non-`never`, a TS2344 compile error.
 */
type AssertNever<T extends never> = T;
type UncoveredConstraintArm = Exclude<
  CascadeConstraintFailure["kind"],
  (typeof CONSTRAINT_FAILURES)[keyof typeof CONSTRAINT_FAILURES]["kind"]
>;
void ([] satisfies AssertNever<UncoveredConstraintArm>[]);

/** Every reason the cascade's failure block stamps, across every arm. */
function stampedFailureReasons(): ReadonlySet<Reason> {
  const stamped = new Set<Reason>();
  function collect(rows: readonly { readonly reasons?: readonly Reason[] }[]): void {
    for (const row of rows) {
      for (const reason of row.reasons ?? []) {
        stamped.add(reason);
      }
    }
  }

  for (const failure of Object.values(CLOSURE_FAILURES)) {
    collect(
      composeCascadeFailureMessage({
        scope: "user",
        rootKey: ROOT_KEY,
        rootName: "helper",
        subject: { kind: "closure", failure },
      }),
    );
  }

  for (const failure of Object.values(CONSTRAINT_FAILURES)) {
    collect(
      composeCascadeFailureMessage({
        scope: "user",
        rootKey: ROOT_KEY,
        rootName: "helper",
        subject: { kind: "constraint", failure },
      }),
    );
  }

  return stamped;
}

/** Reads the doc section under `heading`, up to the next `## ` heading. */
async function readDocSection(heading: string): Promise<string> {
  const doc = await readFile(path.join(REPO_ROOT, DOC_REL), "utf8");
  const start = doc.indexOf(heading);
  assert.notStrictEqual(start, -1, `${DOC_REL}: the "${heading}" section is gone`);

  const next = doc.indexOf("\n## ", start + 1);
  return next === -1 ? doc.slice(start) : doc.slice(start, next);
}

/** Every `{token}` the doc's failure table names, in table order. */
async function documentedFailureReasons(): Promise<readonly string[]> {
  const section = await readDocSection("## Why a dependency can fail");
  return [...section.matchAll(/^\|\s*`\{([^}]+)\}`\s*\|/gmu)].map((match) => match[1] ?? "");
}

test("RESV-06 the failure table names every reason the cascade stamps, and no others", async () => {
  // arrange
  const stamped = stampedFailureReasons();

  // act
  const documented = await documentedFailureReasons();

  // assert: a sanity floor first -- an empty parse would make both set
  // comparisons below vacuous in one direction and impossible to read in the
  // other.
  assert.ok(
    documented.length > 5,
    `${DOC_REL}: parsed ${documented.length.toString()} reason cells out of the failure table`,
  );
  assert.deepStrictEqual(
    [...documented].sort(),
    [...stamped].sort(),
    `${DOC_REL}: the failure table and the tokens the cascade stamps must name the same set`,
  );
});

test("RESV-06 the failure table names each reason exactly once", async () => {
  // act
  const documented = await documentedFailureReasons();

  // assert
  assert.deepStrictEqual(
    documented.filter((reason, index) => documented.indexOf(reason) !== index),
    [],
    `${DOC_REL}: a reason named twice gives the user two places to look for one fact`,
  );
});

test("EDEP-03 the already-installed section names the reasons a re-enabled dependency's row carries", async () => {
  // arrange: a member already installed and DISABLED is re-materialized
  // through its own record and renders an `installed` row, not a skip --
  // driven through the REAL composer, never as a literal in this test body.
  const rows = composeCascadeMemberRows({
    scope: "user",
    rootKey: ROOT_KEY,
    rootRow: ROOT_ROW,
    installed: [
      {
        key: DEPENDENCY_KEY,
        version: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        fellBackToCurrentCopy: false,
        reEnabledFromRecord: true,
      },
    ],
    alreadyInstalled: [],
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
  });
  const reEnabled = rows.find(
    (row): row is Extract<CascadeMsg, { readonly status: "installed" }> =>
      row.status === "installed" && row.name === DEPENDENCY_KEY,
  );
  assert.ok(reEnabled !== undefined, "the re-enabled member still renders an installed row");

  // act
  const section = await readDocSection("## What happens to a dependency you already installed");

  // assert
  assert.deepStrictEqual(
    (reEnabled.reasons ?? []).filter((reason) => !section.includes(reason)),
    [],
    `${DOC_REL}: the re-enabled dependency's row carries reasons the section never names`,
  );
});

test("RESV-06 the already-installed section still names the reason a left-alone dependency's row carries", async () => {
  // arrange: the skip is not a failure, so it is absent from the failure table
  // by design -- which leaves its token undocumented unless the section that
  // describes the skip names it. The section still describes this case (the
  // recorded version is checked against the constraint either way), so the
  // gate keeps this half too.
  const rows = composeCascadeMemberRows({
    scope: "user",
    rootKey: ROOT_KEY,
    rootRow: ROOT_ROW,
    installed: [],
    alreadyInstalled: [{ key: DEPENDENCY_KEY, version: "1.0.0" }],
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
  });
  const skipped = rows.find((row) => row.status === "skipped");
  assert.ok(skipped !== undefined, "a left-alone member still renders a skipped row");

  // act
  const section = await readDocSection("## What happens to a dependency you already installed");

  // assert
  assert.deepStrictEqual(
    skipped.reasons.filter((reason) => !section.includes(reason)),
    [],
    `${DOC_REL}: the skipped dependency's row carries reasons the skip section never names`,
  );
});

test("DIVG-01 the resolution section names every reason the fallback row carries", async () => {
  // arrange: a path-source member that fell back to the marketplace's current
  // copy, driven through the REAL composer -- the token under test comes from
  // `composeCascadeMemberRows` itself, never as a literal in this test body.
  const rows = composeCascadeMemberRows({
    scope: "user",
    rootKey: ROOT_KEY,
    rootRow: ROOT_ROW,
    installed: [
      {
        key: DEPENDENCY_KEY,
        version: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        fellBackToCurrentCopy: true,
        reEnabledFromRecord: false,
      },
    ],
    alreadyInstalled: [],
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
  });
  const fallback = rows.find(
    (row): row is Extract<CascadeMsg, { readonly status: "installed" }> =>
      row.status === "installed" && row.name === DEPENDENCY_KEY,
  );
  assert.ok(fallback !== undefined, "the fallback member still renders an installed row");

  // act
  const section = await readDocSection("## How a constrained dependency is resolved");

  // assert: a sanity floor first, mirroring the failure-table case's floor above
  // -- a renamed heading makes `readDocSection` return a slice that runs to the
  // next "## ", and without a floor a mis-sliced section could satisfy the
  // containment check below by accident.
  assert.ok(
    section.length > 200,
    `${DOC_REL}: parsed a ${section.length.toString()}-character "How a constrained dependency is resolved" section`,
  );
  assert.deepStrictEqual(
    (fallback.reasons ?? []).filter((reason) => !section.includes(reason)),
    [],
    `${DOC_REL}: the resolution section never names a reason the fallback row carries`,
  );
});

test("DIVG-01 the resolution section carries the exact fallback subsection heading", async () => {
  // arrange / act
  const section = await readDocSection("## How a constrained dependency is resolved");

  // assert: sanity floor, then heading equality -- a failure here names the
  // actual heading text found, so a rename or a typo is visible on its own,
  // separate from the reason-containment case above.
  assert.ok(
    section.length > 200,
    `${DOC_REL}: parsed a ${section.length.toString()}-character "How a constrained dependency is resolved" section`,
  );
  const heading = /^### .+$/mu.exec(section)?.[0];
  assert.strictEqual(
    heading,
    "### When no tag satisfies the constraint",
    `${DOC_REL}: the fallback subsection heading has drifted from what DIVG-01 pins`,
  );
});

test("UPDT-02: the document names every token the held update row stamps", async (t) => {
  // arrange: the REAL preflight, held by a gate verdict, so the tokens under
  // test are the ones `preparePluginUpdate` stamps on its held arm -- never
  // literals this test body supplies and reads back.
  const cwd = await mkdtemp(path.join(tmpdir(), "doc-agreement-held-update-"));
  t.after(() => rm(cwd, { force: true, recursive: true }));
  const marketplaceRoot = path.join(cwd, "marketplace");
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({ name: "mp", plugins: [{ name: "shared-lib", source: "./plugins/shared-lib" }] }),
  );
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./marketplace"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          "shared-lib": {
            version: "1.0.0",
            resolvedSource: path.join(marketplaceRoot, "plugins", "shared-lib"),
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
            enabled: true,
            provenance: "explicit",
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });

  // act
  const outcome = await preparePluginUpdate({
    plugin: "shared-lib",
    marketplace: "mp",
    scope: "project",
    locations,
    cleanupClones: async () => {},
    constraintGate: () =>
      Promise.resolve({
        kind: "held",
        cause: 'the declared ranges admit no version in common -- required by "alpha@mp"',
      }),
  });
  const section = await readDocSection(
    "## What happens when an update is constrained by other plugins",
  );

  // assert
  assert.ok("partition" in outcome && outcome.partition === "skipped");
  assert.ok(outcome.reasons.length > 0, "the held preflight arm stamps at least one reason");
  for (const token of outcome.reasons) {
    assert.ok(
      section.includes(`{${token}}`),
      `${DOC_REL}: the document never names {${token}}, a token the held update row stamps`,
    );
  }
});

test("DIVG-01 the plugin-declares section names the sha divergence from upstream", async () => {
  // arrange / act
  const section = await readDocSection("## What a plugin declares");

  // assert: sanity floor, then the tokens that carry the actual divergence --
  // upstream's behavior, this extension's refusal, and the reason it fails
  // with -- not a prose stem that survives a rewrite deleting the claim.
  assert.ok(
    section.length > 200,
    `${DOC_REL}: parsed a ${section.length.toString()}-character "What a plugin declares" section`,
  );
  for (const claim of ["`sha`", "pins the dependency to that commit", "{invalid manifest}"]) {
    assert.ok(
      section.includes(claim),
      `${DOC_REL}: the "What a plugin declares" section no longer states ${claim}`,
    );
  }
});
