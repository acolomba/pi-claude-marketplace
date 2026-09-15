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
// fixtures are proven TOTAL at compile time: each discriminant list carries an
// `Exclude<...> extends never` proof, so an arm added to
// `DependencyClosureResult` or `CascadeConstraintFailure` without a fixture
// here is a TS2344 build failure rather than a silently narrower sweep.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  composeCascadeFailureMessage,
  composeCascadeMemberRows,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts";

import { REPO_ROOT } from "./source-scan.ts";

import type { DependencyClosureResult } from "../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";
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
    cause: new Error("connect ECONNREFUSED"),
    classification: "network unreachable",
  },
  "tag-listing-failed:auth": {
    kind: "tag-listing-failed",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    cause: new Error("HTTP 401"),
    classification: "authentication required",
  },
  "tag-listing-failed:unclassified": {
    kind: "tag-listing-failed",
    key: DEPENDENCY_KEY,
    range: "^2.0.0",
    cause: new Error("something else"),
    classification: undefined,
  },
} as const satisfies Record<string, CascadeConstraintFailure>;

/**
 * Totality proofs. Each resolves to `never` only when every arm of the union
 * has a fixture above; a non-`never` result is a TS2344 compile error, so an
 * arm added without a fixture cannot reach a green run.
 *
 * The constraint half is proven on `kind` alone -- the `why` split is a second
 * discriminant the key strings carry, and a `kind` covered by one fixture is a
 * `kind` this gate reaches.
 */
type _AssertNever<T extends never> = T;
type _UncoveredClosureArm = Exclude<ClosureFailure["reason"], keyof typeof CLOSURE_FAILURES>;
type _UncoveredConstraintArm = Exclude<
  CascadeConstraintFailure["kind"],
  (typeof CONSTRAINT_FAILURES)[keyof typeof CONSTRAINT_FAILURES]["kind"]
>;
type _ArmCoverageProof = [
  _AssertNever<_UncoveredClosureArm>,
  _AssertNever<_UncoveredConstraintArm>,
];
void (undefined as unknown as _ArmCoverageProof);

/** Every reason the cascade's failure block stamps, across every arm. */
function stampedFailureReasons(): ReadonlySet<Reason> {
  const stamped = new Set<Reason>();
  const collect = (rows: readonly { readonly reasons?: readonly Reason[] }[]): void => {
    for (const row of rows) {
      for (const reason of row.reasons ?? []) {
        stamped.add(reason);
      }
    }
  };

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

/** Every `{token}` the doc's failure table names, in table order. */
async function documentedFailureReasons(): Promise<readonly string[]> {
  const doc = await readFile(path.join(REPO_ROOT, DOC_REL), "utf8");
  const heading = doc.indexOf("## Why a dependency can fail");
  assert.notStrictEqual(heading, -1, `${DOC_REL}: the failure section heading is gone`);

  const next = doc.indexOf("\n## ", heading + 1);
  const section = next === -1 ? doc.slice(heading) : doc.slice(heading, next);
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

test("RESV-06 the skip section names the reason a disabled dependency's row carries", async () => {
  // arrange: the skip is not a failure, so it is absent from the failure table
  // by design -- which leaves its token undocumented unless the section that
  // describes the skip names it.
  const rows = composeCascadeMemberRows({
    scope: "user",
    rootKey: ROOT_KEY,
    rootRow: ROOT_ROW,
    installed: [],
    alreadyInstalled: [{ key: DEPENDENCY_KEY, version: "1.0.0", disabled: true }],
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
  });
  const skipped = rows.find((row) => row.status === "skipped");
  assert.ok(skipped !== undefined, "the disabled skip still renders a skipped row");

  // act
  const doc = await readFile(path.join(REPO_ROOT, DOC_REL), "utf8");

  // assert
  for (const reason of skipped.reasons) {
    assert.ok(
      doc.includes(reason),
      `${DOC_REL}: the skipped dependency's row carries {${reason}} and the document never names it`,
    );
  }
});
