import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  describeConstraint,
  evaluateUpdateConstraint,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { AddressedDependency } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type {
  ConstraintHolder,
  UpdateConstraintOptions,
  UpdateConstraintSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginStateRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function pluginRecord(overrides: Partial<PluginStateRecord> = {}): PluginStateRecord {
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/x",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
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

function credentialOps(): CredentialOps {
  return {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
}

/** A seam whose `buildScopeDeclarationDetail` returns a canned result. */
function seamReturning(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
): UpdateConstraintSeam {
  return {
    buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
  };
}

function seamFailingWith(declarer: string, cause: Error): UpdateConstraintSeam {
  return {
    buildScopeDeclarationDetail: () => Promise.resolve({ ok: false, declarer, cause }),
  };
}

function options(overrides: Partial<UpdateConstraintOptions> = {}): UpdateConstraintOptions {
  return {
    plugin: "target",
    marketplace: "mp",
    entry: { name: "target", source: pathSource("./plugins/target") },
    marketplaceRoot: "/cwd/mp",
    state: stateOf({ mp: { target: pluginRecord() } }),
    locations: locationsFor("project", "/cwd"),
    auth: { credentialOps: credentialOps() },
    ...overrides,
  };
}

describe("evaluateUpdateConstraint", () => {
  test("UPDT-02: disjoint declared ranges hold the update and name both declarers", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: "^2.0.0" })]],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });

    // act
    const verdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the declared ranges admit no version in common (no version satisfies all 2 declared ranges) -- required by "alpha@mp", "beta@mp"',
    });
  });

  test("UPDT-02: holders are named in lexicographic key order", async () => {
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
    const forwardVerdict = await evaluateUpdateConstraint(
      options({ state: forward, seam: seamReturning(declarations) }),
    );
    const reversedVerdict = await evaluateUpdateConstraint(
      options({ state: reversed, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(forwardVerdict, reversedVerdict);
  });

  test("UPDT-02: a disabled declarer is named and marked", async () => {
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
    const verdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "held",
      cause:
        'the declared ranges admit no version in common (no version satisfies all 2 declared ranges) -- required by "alpha@mp", "beta@mp" (currently disabled)',
    });
  });

  test("UPDT-01: a target no installed record declares queries no tag listing", async () => {
    // arrange
    let calls = 0;
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => {
        calls += 1;
        return Promise.resolve({ ok: true, declarations: new Map() });
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(options({ seam }));

    // assert -- this plan's seam carries no tag-listing member at all, so
    // "no tag listing queried" holds by construction; only the declaration
    // walk itself is called, exactly once.
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
    assert.strictEqual(calls, 1);
  });

  test("D-10-08: flipping a declarer's provenance changes neither the verdict nor the cause", async () => {
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
    const directVerdict = await evaluateUpdateConstraint(
      options({ state: direct, seam: seamReturning(declarations) }),
    );
    const dependencyVerdict = await evaluateUpdateConstraint(
      options({ state: dependencyProvenance, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(directVerdict, dependencyVerdict);
  });

  test("UPDT-02: an unreadable declarer holds the update and names itself", async () => {
    // arrange
    const cause = new Error(
      "cannot read the dependencies of alpha@mp: not declared by its marketplace",
    );
    const seam = seamFailingWith("alpha@mp", cause);

    // act
    const verdict = await evaluateUpdateConstraint(options({ seam }));

    // assert
    assert.deepStrictEqual(verdict, { kind: "held", cause: cause.message });
  });

  test("UPDT-01: two overlapping declared ranges admit their intersection", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
      ["beta@mp", [dependency({ name: "target", version: ">=1.2.0" })]],
    ]);
    const state = stateOf({
      mp: { target: pluginRecord(), alpha: pluginRecord(), beta: pluginRecord() },
    });

    // act
    const verdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );

    // assert
    const expectedHolders: readonly ConstraintHolder[] = [
      { key: "alpha@mp", range: "^1.0.0", disabled: false },
      { key: "beta@mp", range: ">=1.2.0", disabled: false },
    ];
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0 >=1.2.0",
      holders: expectedHolders,
      fellBackToCurrentCopy: false,
    });
  });

  test("without an injected seam, the gate composes the real declaration walk", async () => {
    // arrange
    const state: ExtensionState = { schemaVersion: 2, marketplaces: {} };

    // act
    const verdict = await evaluateUpdateConstraint(options({ state }));

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });

  test("a declarer's other declarations do not hold the target", async () => {
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
    const verdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
    });
  });

  test("a plugin that declares its own key holds nothing", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["target@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);

    // act
    const verdict = await evaluateUpdateConstraint(options({ seam: seamReturning(declarations) }));

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });

  test("a declarer naming the target with no version holds the key but names no range", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });

    // act
    const verdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );

    // assert
    assert.deepStrictEqual(verdict, { kind: "unconstrained" });
  });
});

describe("describeConstraint", () => {
  test("composes a fixed arm clause, the bounded detail, and disabled-marked holders", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "alpha@mp", range: "^1.0.0", disabled: false },
      { key: "beta@mp", range: "^2.0.0", disabled: true },
    ];

    // act
    const cause = describeConstraint(
      "no version satisfies all 2 declared ranges",
      holders,
      "disjoint",
    );

    // assert
    assert.strictEqual(
      cause,
      'the declared ranges admit no version in common (no version satisfies all 2 declared ranges) -- required by "alpha@mp", "beta@mp" (currently disabled)',
    );
  });
});
