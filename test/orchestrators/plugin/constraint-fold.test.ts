import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  admitResolvedVersion,
  admitsRange,
  evaluateCatalogConstraint,
  foldDeclaredConstraint,
  transportHeld,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { DependencyDeclarationsUnreadableError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  CatalogConstraintSeam,
  ConstraintHolder,
  UpdateConstraintVerdict,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts";
import type { AddressedDependency } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginStateRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function pluginRecord(overrides: Partial<PluginStateRecord> = {}): PluginStateRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/x",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** One marketplace's `plugins` map, keyed by name, with its own `plugins` order. */
function stateOf(marketplaces: Record<string, Record<string, PluginStateRecord>>): ExtensionState {
  const built: ExtensionState["marketplaces"] = {};
  for (const [name, plugins] of Object.entries(marketplaces)) {
    built[name] = {
      name,
      scope: "project",
      source: pathSource("./mp"),
      addedFromCwd: "/cwd",
      manifestPath: "/cwd/mp/.claude-plugin/marketplace.json",
      marketplaceRoot: "/cwd/mp",
      plugins,
    };
  }

  return { schemaVersion: 2, marketplaces: built };
}

function dependency(
  overrides: Partial<AddressedDependency> & { readonly name: string },
): AddressedDependency {
  return { marketplace: "mp", ...overrides };
}

/** Folds what `declarations` hold `target@mp` to over `state`. */
function foldTarget(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  state: ExtensionState = stateOf({ mp: { target: pluginRecord() } }),
): UpdateConstraintVerdict {
  return foldDeclaredConstraint(declarations, state, "target", "mp");
}

describe("foldDeclaredConstraint", () => {
  test("UPDT-02: disjoint declared ranges hold the update and name both declarers", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });

    // act
    const verdict = foldTarget(declarations, state);

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the declared ranges admit no version in common (^1.0.0, ^2.0.0) -- required by "alpha@mp", "beta@mp"',
    });
  });

  test("UPDT-02: holders are named in lexicographic key order", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const forward = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });
    const reversed = stateOf({
      mp: { beta: pluginRecord(), alpha: pluginRecord(), target: pluginRecord() },
    });

    // act
    const forwardVerdict = foldTarget(declarations, forward);
    const reversedVerdict = foldTarget(declarations, reversed);

    // assert
    assert.deepStrictEqual(forwardVerdict, reversedVerdict);
  });

  test("UPDT-02: a disabled declarer is named and marked", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const state = stateOf({
      mp: {
        target: pluginRecord(),
        alpha: pluginRecord(),
        beta: pluginRecord({ enabled: false }),
      },
    });

    // act
    const verdict = foldTarget(declarations, state);

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the declared ranges admit no version in common (^1.0.0, ^2.0.0) -- required by "alpha@mp", "beta@mp" (currently disabled)',
    });
  });

  test("D-10-08: flipping a declarer's provenance changes neither the verdict nor the cause", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const direct = stateOf({
      mp: {
        target: pluginRecord(),
        alpha: pluginRecord({ provenance: "explicit" }),
        beta: pluginRecord({ provenance: "explicit" }),
      },
    });
    const dependencyProvenance = stateOf({
      mp: {
        target: pluginRecord(),
        alpha: pluginRecord({ provenance: "dependency" }),
        beta: pluginRecord({ provenance: "dependency" }),
      },
    });

    // act
    const directVerdict = foldTarget(declarations, direct);
    const dependencyVerdict = foldTarget(declarations, dependencyProvenance);

    // assert
    assert.deepStrictEqual(directVerdict, dependencyVerdict);
  });

  test("a declarer's other declarations do not hold the target", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      [
        "alpha@mp",
        [dependency({ name: "other" }), dependency({ name: "target", version: "^1.0.0" })],
      ],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), other: pluginRecord() },
    });

    // act
    const verdict = foldTarget(declarations, state);

    // assert -- D-23: the fold lists no tag, so it admits the range with no pin
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "alpha@mp"',
    });
  });

  test("a plugin that declares its own key holds nothing", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["target@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);

    // act
    const verdict = foldTarget(declarations);

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });

  test("a declarer naming the target with no version holds the key but names no range", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });

    // act
    const verdict = foldTarget(declarations, state);

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });

  for (const { title, holder, expectedCause } of [
    {
      title: "invalid",
      holder: dependency({ name: "target", version: "not-a-valid-range" }),
      expectedCause:
        'a declared range could not be read (not-a-valid-range) -- required by "alpha@mp"',
    },
    {
      title: "too-complex",
      holder: dependency({ name: "target", version: "^1.0.0".repeat(700) }),
      expectedCause: `the declared ranges are too complex to combine (${"^1.0.0".repeat(700).slice(0, 200)}... (+4000 chars)) -- required by "alpha@mp"`,
    },
  ] as const) {
    test(`UPDT-01 / INR-05: a ${title} declared range holds the update, naming the declared range`, () => {
      // arrange
      const declarations = new Map<string, readonly AddressedDependency[]>([
        ["alpha@mp", [holder]],
      ]);
      const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });

      // act
      const verdict = foldTarget(declarations, state);

      // assert
      assert.deepStrictEqual(verdict, { kind: "held", cause: expectedCause });
    });
  }

  test("INR-05: a holder that declared no range is named but adds no range to the disclosure", () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target" })]],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });

    // act
    const verdict = foldTarget(declarations, state);

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [
        { key: "alpha@mp", range: "^1.0.0", disabled: false },
        { key: "beta@mp", disabled: false },
      ],
      fellBackToCurrentCopy: false,
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "alpha@mp", "beta@mp"',
    });
  });
});

describe("admitsRange", () => {
  const holders: readonly ConstraintHolder[] = [
    { key: "alpha@mp", range: "^1.0.0", disabled: false },
  ];

  test("D-10-13: a pinned range claims the established ceiling", () => {
    // act
    const verdict = admitsRange(">=1.0.0 <2.0.0-0", holders, {
      pin: { oid: "oid-1.2.0", version: "1.2.0" },
    });

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders,
      pin: { oid: "oid-1.2.0", version: "1.2.0" },
      fellBackToCurrentCopy: false,
      disclosure:
        'already the highest version the combined range admits (^1.0.0) -- required by "alpha@mp"',
    });
  });

  test("D-10-14: a fallback to the current copy says so and discloses the range alone", () => {
    // act
    const verdict = admitsRange(">=1.0.0 <2.0.0-0", holders, { fellBackToCurrentCopy: true });

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders,
      fellBackToCurrentCopy: true,
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "alpha@mp"',
    });
  });
});

describe("transportHeld", () => {
  test("UPDT-01: an unreachable tag listing names the transport classification", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "alpha@mp", range: "^1.0.0", disabled: true },
    ];

    // act
    const verdict = transportHeld(holders, "network unreachable");

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the release tags could not be listed (network unreachable) -- required by "alpha@mp" (currently disabled)',
    });
  });
});

describe("admitResolvedVersion", () => {
  /** An `admits` verdict fixture; `disclosure` is unused by stage two. */
  function admits(
    range: string,
    holders: readonly ConstraintHolder[],
  ): Extract<UpdateConstraintVerdict, { readonly kind: "admits" }> {
    return { kind: "admits", range, holders, fellBackToCurrentCopy: false, disclosure: "unused" };
  }

  test("admits a version inside the range", () => {
    // arrange
    const verdict = admits("^1.0.0", []);

    // act
    const admission = admitResolvedVersion(verdict, "1.4.2");

    // assert
    assert.deepStrictEqual(admission, { kind: "admitted" });
  });

  test("UPDT-02: the out-of-range hold names only the rejecting dependents", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<=1.5.0", disabled: false },
      { key: "b@mp", range: "^1.0.0", disabled: false },
    ];
    const verdict = admits("<=1.5.0", holders);

    // act
    const admission = admitResolvedVersion(verdict, "1.6.0");

    // assert
    assert.ok(admission.kind === "held");
    assert.strictEqual(
      admission.cause,
      'version 1.6.0 falls outside what the combined range admits (<=1.5.0) -- required by "a@mp"',
    );
  });

  test("UPDT-02 / INR-05: the out-of-range hold prints the rejecting holders' declared ranges, not the fold", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "app@tools", range: "^1.0.0", disabled: false },
      { key: "other@tools", range: ">=0.5.0", disabled: false },
    ];
    const verdict = admits(">=1.0.0 <2.0.0-0", holders);

    // act
    const admission = admitResolvedVersion(verdict, "2.0.0");

    // assert
    assert.deepStrictEqual(admission, {
      kind: "held",
      cause:
        'version 2.0.0 falls outside what the combined range admits (^1.0.0) -- required by "app@tools"',
    });
  });

  test("UPDT-02: an inclusive upper bound admits the boundary version", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<=1.5.0", disabled: false },
    ];
    const verdict = admits("<=1.5.0", holders);

    // act
    const admission = admitResolvedVersion(verdict, "1.5.0");

    // assert
    assert.deepStrictEqual(admission, { kind: "admitted" });
  });

  test("UPDT-02: an exclusive upper bound holds the boundary version", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<1.5.0", disabled: false },
    ];
    const verdict = admits("<1.5.0", holders);

    // act
    const admission = admitResolvedVersion(verdict, "1.5.0");

    // assert
    assert.strictEqual(admission.kind, "held");
  });

  test("UPDT-02: a holder that declared no range is left off the held line", () => {
    // arrange -- `b@mp` holds the key without constraining it, so it has
    // nothing to reject the version with and sending the user to it would be
    // a wrong remedy.
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<=1.5.0", disabled: false },
      { key: "b@mp", disabled: false },
    ];
    const verdict = admits("<=1.5.0", holders);

    // act
    const admission = admitResolvedVersion(verdict, "1.6.0");

    // assert
    assert.ok(admission.kind === "held");
    assert.strictEqual(
      admission.cause,
      'version 1.6.0 falls outside what the combined range admits (<=1.5.0) -- required by "a@mp"',
    );
  });
});

describe("evaluateCatalogConstraint", () => {
  const locations = locationsFor("project", "/cwd");

  function seamReturning(
    declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
  ): CatalogConstraintSeam {
    return {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
    };
  }

  test("D-23: a declared range admits with no pin and discloses the range alone", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });

    // act
    const verdict = await evaluateCatalogConstraint({
      plugin: "target",
      marketplace: "mp",
      state,
      locations,
      seam: seamReturning(declarations),
    });

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "alpha@mp"',
    });
  });

  test("D-12: declared ranges with nothing in common hold the move", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });

    // act
    const verdict = await evaluateCatalogConstraint({
      plugin: "target",
      marketplace: "mp",
      state,
      locations,
      seam: seamReturning(declarations),
    });

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the declared ranges admit no version in common (^1.0.0, ^2.0.0) -- required by "alpha@mp", "beta@mp"',
    });
  });

  test("D-18-17: an unreadable declaration walk fails closed and names the declarer", async () => {
    // arrange
    const cause = new Error("cannot read the dependencies of alpha@mp: its manifest is unreadable");
    const seam: CatalogConstraintSeam = {
      buildScopeDeclarationDetail: () =>
        Promise.resolve({ ok: false, declarer: "alpha@mp", reason: "unreadable manifest", cause }),
    };

    // act & assert
    await assert.rejects(
      () =>
        evaluateCatalogConstraint({
          plugin: "target",
          marketplace: "mp",
          state: stateOf({ mp: { target: pluginRecord() } }),
          locations,
          seam,
        }),
      new DependencyDeclarationsUnreadableError(
        "alpha@mp",
        "cannot read the dependencies of alpha@mp: its manifest is unreadable",
      ),
    );
  });

  test("walks the scope's own records when no seam is given", async () => {
    // act
    const verdict = await evaluateCatalogConstraint({
      plugin: "target",
      marketplace: "mp",
      state: { schemaVersion: 2, marketplaces: {} },
      locations,
    });

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });
});
