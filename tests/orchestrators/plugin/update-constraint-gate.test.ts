import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { probeDependencyTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import { probeMarketplaceTags } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import {
  admitResolvedVersion,
  describeConstraint,
  evaluateUpdateConstraint,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  CredentialOps,
  DeviceFlowHttp,
} from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { AddressedDependency } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type {
  DependencyTagListingSeam,
  DependencyTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";
import type { MarketplaceTagListingSeam } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts";
import type {
  ConstraintHolder,
  UpdateConstraintOptions,
  UpdateConstraintSeam,
  UpdateConstraintVerdict,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { RemoteTag } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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

/** A no-op ui context, for the git-arm cases whose auth threading needs one. */
function silentCtx(): NotificationContext {
  return { ui: { notify: () => undefined } };
}

/** The target's own git source repository, for the git-arm cases below. */
function gitSource(): GitBackedSource {
  return { kind: "url", raw: "https://example.com/target", url: "https://example.com/target" };
}

/**
 * Probe doubles that answer `no-matching-tag` for whatever range they were
 * asked about -- the default `seamReturning` / `seamFailingWith` probe
 * members, so every pre-existing case's "admits, no pin" expectation holds
 * unchanged once stage one's probe call sits on that path.
 */
function noMatchingGitTag(
  probeOptions: DependencyTagProbeOptions,
): ReturnType<UpdateConstraintSeam["probeDependencyTags"]> {
  return Promise.resolve({ kind: "no-matching-tag", range: probeOptions.range });
}

function noMatchingMarketplaceTag(
  probeOptions: Parameters<UpdateConstraintSeam["probeMarketplaceTags"]>[0],
): ReturnType<UpdateConstraintSeam["probeMarketplaceTags"]> {
  return Promise.resolve({ kind: "no-matching-tag", range: probeOptions.range });
}

/** A seam whose `buildScopeDeclarationDetail` returns a canned result. */
function seamReturning(
  declarations: ReadonlyMap<string, readonly AddressedDependency[]>,
): UpdateConstraintSeam {
  return {
    buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
    probeDependencyTags: noMatchingGitTag,
    probeMarketplaceTags: noMatchingMarketplaceTag,
  };
}

function seamFailingWith(declarer: string, cause: Error): UpdateConstraintSeam {
  return {
    buildScopeDeclarationDetail: () => Promise.resolve({ ok: false, declarer, cause }),
    probeDependencyTags: noMatchingGitTag,
    probeMarketplaceTags: noMatchingMarketplaceTag,
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
      probeDependencyTags: () => {
        throw new Error("not expected: no holder means no constrained range to probe");
      },
      probeMarketplaceTags: () => {
        throw new Error("not expected: no holder means no constrained range to probe");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(options({ seam }));

    // assert -- an unconstrained fold returns before either probe is ever
    // reached; only the declaration walk itself is called, exactly once.
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
      // D-10-14: `options()` defaults to a `path` entry source and the
      // default seam's `probeMarketplaceTags` answers `no-matching-tag`, so
      // this falls back to the marketplace's current copy.
      fellBackToCurrentCopy: true,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0 >=1.2.0) -- required by "alpha@mp", "beta@mp"',
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
      // D-10-14: a `path` entry source with no satisfying marketplace tag
      // falls back to the current copy.
      fellBackToCurrentCopy: true,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0) -- required by "alpha@mp"',
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

  for (const { title, cause } of [
    {
      title: "D-05-07: a marketplace manifest load failure",
      cause: new Error("cannot read the dependencies of app@mp: ENOENT: open 'mp'"),
    },
    {
      title: "D-05-07: a declarer its marketplace does not list",
      cause: new Error(
        "cannot read the dependencies of helper@mp: not declared by its marketplace",
      ),
    },
    {
      title: "D-05-07: a declarer's own manifest present but unusable",
      cause: new Error(
        "cannot read the dependencies of helper@mp: its own manifest is present but cannot be read",
      ),
    },
    {
      title: "D-05-07: a declaration that parses as unusable",
      cause: new Error("cannot read the dependencies of helper@mp: dependencies.0: Invalid input"),
    },
  ] as const) {
    test(`UPDT-02: ${title} holds the update and names itself, verbatim`, async () => {
      // arrange
      const seam = seamFailingWith("helper@mp", cause);

      // act
      const verdict = await evaluateUpdateConstraint(options({ seam }));

      // assert -- a refusal short-circuits before any fold: the seam returns
      // no declarations at all, so `intersectDependencyRanges` is never
      // reached for this verdict. `verdict.cause` is the double's own
      // message string, passed through unchanged.
      assert.deepStrictEqual(verdict, { kind: "held", cause: cause.message });
      assert.doesNotMatch(cause.message, /(^|\s)\//u);
    });
  }

  for (const { title, holder, expectedClause } of [
    {
      title: "invalid",
      holder: dependency({ name: "target", version: "not-a-valid-range" }),
      expectedClause: "a declared range could not be read",
    },
    {
      title: "too-complex",
      holder: dependency({ name: "target", version: "^1.0.0".repeat(700) }),
      expectedClause: "the declared ranges are too complex to combine",
    },
  ] as const) {
    test(`UPDT-01: a ${title} declared range holds the update with a distinct arm clause`, async () => {
      // arrange
      const declarations = new Map<string, readonly AddressedDependency[]>([
        ["alpha@mp", [holder]],
      ]);
      const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });

      // act
      const verdict = await evaluateUpdateConstraint(
        options({ state, seam: seamReturning(declarations) }),
      );

      // assert
      assert.ok(verdict.kind === "held");
      assert.ok(verdict.cause.startsWith(expectedClause));
    });
  }

  test("UPDT-01: the highest git tag satisfying the intersection is pinned", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const calls: DependencyTagProbeOptions[] = [];
    const ctx: NotificationContext = { ui: { notify: () => undefined } };
    const credOps = credentialOps();
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: (probeOptions) => {
        calls.push(probeOptions);
        return Promise.resolve({
          kind: "pinned",
          tag: "target--v1.4.0",
          oid: "oid-git",
          version: "1.4.0",
        });
      },
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(
      options({
        state,
        entry: { name: "target", source },
        seam,
        auth: { ctx, credentialOps: credOps },
      }),
    );

    // assert -- the pin is the probe double's own oid/version, sorted,
    // filtered or re-derived nothing.
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      pin: { oid: "oid-git", version: "1.4.0" },
      fellBackToCurrentCopy: false,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0) -- required by "alpha@mp"',
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.pluginName, "target");
    assert.deepStrictEqual(calls[0]?.source, source);
    assert.strictEqual(calls[0]?.range, ">=1.0.0 <2.0.0-0");
    assert.deepStrictEqual(calls[0]?.auth, { ctx, credentialOps: credOps });
  });

  test("UPDT-01: the git arm threads the caller's auth bundle untouched", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const ctx: NotificationContext = { ui: { notify: () => undefined } };
    const credOps = credentialOps();
    const deviceFlowHttp: DeviceFlowHttp = {
      requestCode: () => Promise.reject(new Error("not used")),
      pollToken: () => Promise.reject(new Error("not used")),
    };
    const authMemo = new Map<string, never>();
    const calls: DependencyTagProbeOptions[] = [];
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: (probeOptions) => {
        calls.push(probeOptions);
        return Promise.resolve({ kind: "no-matching-tag", range: probeOptions.range });
      },
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };

    // act
    await evaluateUpdateConstraint(
      options({
        state,
        entry: { name: "target", source },
        seam,
        auth: { ctx, credentialOps: credOps, deviceFlowHttp, authMemo },
      }),
    );

    // assert -- credentialOps/deviceFlowHttp/authMemo reach the probe as the
    // SAME objects the caller supplied, composing no second credential
    // acquisition path (AUTH-09).
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.auth.ctx, ctx);
    assert.strictEqual(calls[0]?.auth.credentialOps, credOps);
    assert.strictEqual(calls[0]?.auth.deviceFlowHttp, deviceFlowHttp);
    assert.strictEqual(calls[0]?.auth.authMemo, authMemo);
  });

  test("UPDT-01: the git arm skips the tag query when no ui context was threaded", async () => {
    // arrange -- `options()` defaults `auth` to no `ctx` at all.
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected: no ui context to authenticate the query with");
      },
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source }, seam }),
    );

    // assert -- defers to a later stage instead of failing outright.
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0) -- required by "alpha@mp"',
    });
  });

  test("UPDT-01: the highest marketplace tag satisfying the intersection is pinned", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const calls: Parameters<UpdateConstraintSeam["probeMarketplaceTags"]>[0][] = [];
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected on a path entry source");
      },
      probeMarketplaceTags: (probeOptions) => {
        calls.push(probeOptions);
        return Promise.resolve({
          kind: "pinned",
          tag: "target--v1.4.0",
          oid: "oid-path",
          version: "1.4.0",
        });
      },
    };

    // act -- `options()` defaults `entry.source` to a `path` source.
    const verdict = await evaluateUpdateConstraint(options({ state, seam }));

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      pin: { oid: "oid-path", version: "1.4.0" },
      fellBackToCurrentCopy: false,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0) -- required by "alpha@mp"',
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0]?.pluginName, "target");
    assert.strictEqual(calls[0]?.marketplaceRoot, "/cwd/mp");
    assert.strictEqual(calls[0]?.range, ">=1.0.0 <2.0.0-0");
  });

  test("D-10-14: a path source with no satisfying tag falls back and is re-checked", async () => {
    // arrange -- the path arm's no-satisfying-tag result falls back to the
    // marketplace's current copy; the git arm's equivalent does not, because
    // a git source with no satisfying tag refreshes its own branch head.
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const pathVerdict = await evaluateUpdateConstraint(
      options({ state, seam: seamReturning(declarations) }),
    );
    const gitVerdict = await evaluateUpdateConstraint(
      options({
        state,
        entry: { name: "target", source: gitSource() },
        seam: seamReturning(declarations),
        auth: { ctx: silentCtx(), credentialOps: credentialOps() },
      }),
    );

    // assert
    assert.ok(pathVerdict.kind === "admits");
    assert.strictEqual(pathVerdict.fellBackToCurrentCopy, true);
    assert.strictEqual(pathVerdict.pin, undefined);
    assert.ok(gitVerdict.kind === "admits");
    assert.strictEqual(gitVerdict.fellBackToCurrentCopy, false);
    assert.strictEqual(gitVerdict.pin, undefined);
  });

  test("UPDT-01: a caret range whose boundary equals an available tag pins that tag", async () => {
    // arrange -- drives the REAL `selectHighestSatisfyingTag` through an
    // injected local listing seam, one level below the gate's own seam.
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.2.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const listingSeam: MarketplaceTagListingSeam = {
      listTags: () => Promise.resolve(["target--v1.2.0", "target--v0.9.0"]),
      resolveTagOid: (opts) =>
        Promise.resolve(opts.name === "target--v1.2.0" ? "oid-1.2.0" : "oid-0.9.0"),
    };
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected on a path entry source");
      },
      probeMarketplaceTags: (probeOptions) =>
        probeMarketplaceTags({ ...probeOptions, seam: listingSeam }),
    };

    // act
    const verdict = await evaluateUpdateConstraint(options({ state, seam }));

    // assert
    assert.ok(verdict.kind === "admits");
    assert.deepStrictEqual(verdict.pin, { oid: "oid-1.2.0", version: "1.2.0" });
  });

  test("UPDT-01: an exclusive upper bound does not admit the boundary tag", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "<2.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const listingSeam: DependencyTagListingSeam = {
      listRemoteTags: () => Promise.resolve([{ name: "target--v2.0.0", oid: "oid-2.0.0" }]),
    };
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: (probeOptions) =>
        probeDependencyTags({ ...probeOptions, seam: listingSeam }),
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(
      options({
        state,
        entry: { name: "target", source },
        seam,
        auth: { ctx: silentCtx(), credentialOps: credentialOps() },
      }),
    );

    // assert -- the no-satisfying-tag arm leaves the outcome open (no pin,
    // still `admits`), rather than holding the update outright.
    assert.ok(verdict.kind === "admits");
    assert.strictEqual(verdict.pin, undefined);
    assert.strictEqual(verdict.fellBackToCurrentCopy, false);
  });

  test("D-10-16: an unreadable local tag listing reads as no satisfying tag", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const unreadable: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected on a path entry source");
      },
      probeMarketplaceTags: () =>
        Promise.resolve({ kind: "tag-listing-failed", cause: new Error("cannot read tags") }),
    };
    const empty: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected on a path entry source");
      },
      probeMarketplaceTags: noMatchingMarketplaceTag,
    };

    // act
    const unreadableVerdict = await evaluateUpdateConstraint(options({ state, seam: unreadable }));
    const emptyVerdict = await evaluateUpdateConstraint(options({ state, seam: empty }));

    // assert -- the two are one user-visible fact.
    assert.deepStrictEqual(unreadableVerdict, emptyVerdict);
  });

  test("UPDT-01: an unreachable git tag listing holds the update, naming the transport classification", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () =>
        Promise.resolve({
          kind: "tag-listing-failed",
          cause: new Error("boom"),
          classification: "network unreachable",
        }),
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(
      options({
        state,
        entry: { name: "target", source },
        seam,
        auth: { ctx: silentCtx(), credentialOps: credentialOps() },
      }),
    );

    // assert -- a repository that could not be reached has not told us
    // anything, unlike the path arm's fallback above.
    assert.ok(verdict.kind === "held");
    assert.match(verdict.cause, /network unreachable/);
  });

  test("UPDT-01: an entry source with no tag listing queries no probe", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected: the entry source has no tag listing either probe reads");
      },
      probeMarketplaceTags: () => {
        throw new Error("not expected: the entry source has no tag listing either probe reads");
      },
    };

    // act
    const verdict = await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source: "not-a-valid-source" }, seam }),
    );

    // assert
    assert.deepStrictEqual(verdict, {
      kind: "admits",
      range: ">=1.0.0 <2.0.0-0",
      holders: [{ key: "alpha@mp", range: "^1.0.0", disabled: false }],
      fellBackToCurrentCopy: false,
      disclosure:
        'already the highest version the combined range admits (>=1.0.0 <2.0.0-0) -- required by "alpha@mp"',
    });
  });

  test("D-10-18: one bulk run lists each repository's tags once", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    const queried: string[] = [];
    const listingSeam: DependencyTagListingSeam = {
      listRemoteTags: (opts) => {
        queried.push(opts.url);
        return Promise.resolve([{ name: "target--v1.0.0", oid: "oid-1.0.0" }]);
      },
    };
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: (probeOptions) =>
        probeDependencyTags({ ...probeOptions, seam: listingSeam }),
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };
    const tagMemo = new Map<string, readonly RemoteTag[]>();
    const auth = { ctx: silentCtx(), credentialOps: credentialOps() };

    // act
    await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source }, seam, tagMemo, auth }),
    );
    await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source }, seam, tagMemo, auth }),
    );

    // assert
    assert.strictEqual(queried.length, 1);
  });

  test("D-10-18: one bulk run lists the same marketplace clone's tags once", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const listTagsCalls: { dir: string }[] = [];
    const listingSeam: MarketplaceTagListingSeam = {
      listTags: (opts) => {
        listTagsCalls.push(opts);
        return Promise.resolve(["target--v1.0.0"]);
      },
      resolveTagOid: () => Promise.resolve("oid-1.0.0"),
    };
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: () => {
        throw new Error("not expected on a path entry source");
      },
      probeMarketplaceTags: (probeOptions) =>
        probeMarketplaceTags({ ...probeOptions, seam: listingSeam }),
    };
    const marketplaceTagMemo: Required<UpdateConstraintOptions>["marketplaceTagMemo"] = new Map();

    // act
    await evaluateUpdateConstraint(options({ state, seam, marketplaceTagMemo }));
    await evaluateUpdateConstraint(options({ state, seam, marketplaceTagMemo }));

    // assert
    assert.strictEqual(listTagsCalls.length, 1);
  });

  test("D-10-18: a failed listing is re-queried on the next evaluation in the same run", async () => {
    // arrange
    const declarations = new Map<string, readonly AddressedDependency[]>([
      ["alpha@mp", [dependency({ name: "target", version: "^1.0.0" })]],
    ]);
    const state = stateOf({ mp: { target: pluginRecord(), alpha: pluginRecord() } });
    const source = gitSource();
    let calls = 0;
    const listingSeam: DependencyTagListingSeam = {
      listRemoteTags: () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(new Error("transient"));
        }

        return Promise.resolve([{ name: "target--v1.0.0", oid: "oid-1.0.0" }]);
      },
    };
    const seam: UpdateConstraintSeam = {
      buildScopeDeclarationDetail: () => Promise.resolve({ ok: true, declarations }),
      probeDependencyTags: (probeOptions) =>
        probeDependencyTags({ ...probeOptions, seam: listingSeam }),
      probeMarketplaceTags: () => {
        throw new Error("not expected on a git-backed entry source");
      },
    };
    const tagMemo = new Map<string, readonly RemoteTag[]>();
    const auth = { ctx: silentCtx(), credentialOps: credentialOps() };

    // act
    const first = await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source }, seam, tagMemo, auth }),
    );
    const second = await evaluateUpdateConstraint(
      options({ state, entry: { name: "target", source }, seam, tagMemo, auth }),
    );

    // assert -- the failed attempt wrote no memo entry, so the second
    // evaluation re-queries and succeeds.
    assert.strictEqual(calls, 2);
    assert.ok(first.kind === "held");
    assert.ok(second.kind === "admits");
    assert.deepStrictEqual(second.pin, { oid: "oid-1.0.0", version: "1.0.0" });
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
    const result = admitResolvedVersion(verdict, "1.4.2");

    // assert
    assert.deepStrictEqual(result, { kind: "admitted" });
  });

  test("UPDT-02: the out-of-range hold names only the rejecting dependents", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<=1.5.0", disabled: false },
      { key: "b@mp", range: "^1.0.0", disabled: false },
    ];
    const verdict = admits("<=1.5.0", holders);

    // act
    const result = admitResolvedVersion(verdict, "1.6.0");

    // assert
    assert.ok(result.kind === "held");
    assert.match(result.cause, /"a@mp"/);
    assert.doesNotMatch(result.cause, /"b@mp"/);
  });

  test("UPDT-02: an inclusive upper bound admits the boundary version", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<=1.5.0", disabled: false },
    ];
    const verdict = admits("<=1.5.0", holders);

    // act
    const result = admitResolvedVersion(verdict, "1.5.0");

    // assert
    assert.deepStrictEqual(result, { kind: "admitted" });
  });

  test("UPDT-02: an exclusive upper bound holds the boundary version", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [
      { key: "a@mp", range: "<1.5.0", disabled: false },
    ];
    const verdict = admits("<1.5.0", holders);

    // act
    const result = admitResolvedVersion(verdict, "1.5.0");

    // assert
    assert.strictEqual(result.kind, "held");
  });

  test("a holder with no declared range never rejects", () => {
    // arrange
    const holders: readonly ConstraintHolder[] = [{ key: "a@mp", disabled: false }];
    const verdict = admits("^1.0.0", holders);

    // act
    const result = admitResolvedVersion(verdict, "5.0.0");

    // assert
    assert.ok(result.kind === "held");
    assert.doesNotMatch(result.cause, /a@mp/);
  });
});
