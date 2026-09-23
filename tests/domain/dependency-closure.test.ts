import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveDependencyClosure,
  toClosureLookupResult,
  type ClosureLookup,
  type ClosureLookupResult,
  type ClosureMember,
} from "../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";

import type {
  DeclaredDependency,
  parseDeclaredDependencies,
} from "../../extensions/pi-claude-marketplace/domain/dependencies.ts";

void ({
  key: "helper@mp",
  name: "helper",
  marketplace: "mp",
  requiredBy: undefined,
  ranges: [],
} satisfies ClosureMember);
void ({ kind: "absent" } satisfies ClosureLookupResult);
void ({ kind: "unusable", detail: "dependencies.0: Invalid input" } satisfies ClosureLookupResult);

/** A synthetic catalog: key -> whatever that key declares. An absent key is absent. */
type Graph = Readonly<Record<string, readonly DeclaredDependency[]>>;

/** A recording lookup over a synthetic graph, plus the keys it was asked for. */
function catalog(graph: Graph): { readonly lookup: ClosureLookup; readonly asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    lookup: (subject) => {
      asked.push(subject.key);
      const dependencies = graph[subject.key];
      return Promise.resolve<ClosureLookupResult>(
        dependencies === undefined ? { kind: "absent" } : { kind: "found", dependencies },
      );
    },
  };
}

for (const { label, parsed, expected } of [
  {
    label: "a declaration that parses",
    parsed: { ok: true, dependencies: [{ name: "bar", marketplace: "mp" }] },
    expected: { kind: "found", dependencies: [{ name: "bar", marketplace: "mp" }] },
  },
  {
    label: "a declaration that does not parse",
    parsed: { ok: false, reason: "dependencies: expected an array" },
    expected: { kind: "unusable", detail: "dependencies: expected an array" },
  },
] satisfies readonly {
  label: string;
  parsed: ReturnType<typeof parseDeclaredDependencies>;
  expected: ClosureLookupResult;
}[]) {
  test(`RESV-01 a catalog read reports ${label}`, () => {
    // arrange
    const expectedLooked = expected;

    // act
    const looked = toClosureLookupResult(parsed);

    // assert
    assert.deepStrictEqual(looked, expectedLooked);
  });
}

test("RESV-01 a root declaring one dependency closes over both, dependency first", async () => {
  // arrange
  const { lookup } = catalog({ "foo@mp": [{ name: "bar" }], "bar@mp": [] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "foo@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      { key: "bar@mp", name: "bar", marketplace: "mp", requiredBy: "foo@mp", ranges: [] },
      { key: "foo@mp", name: "foo", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [],
  });
});

for (const { label, rootKey } of [
  { label: "carries no marketplace at all", rootKey: "foo" },
  { label: "carries an unrenderable plugin name", rootKey: "foo bar@mp" },
  { label: "carries an unrenderable marketplace", rootKey: "foo@mp mp" },
]) {
  test(`a root key that ${label} resolves nothing`, async () => {
    // arrange
    const { lookup, asked } = catalog({});

    // act
    const resolved = await resolveDependencyClosure({
      rootKey,
      lookup,
      installedKeys: new Set(),
      knownMarketplaces: new Set(["mp"]),
    });

    // assert
    assert.deepStrictEqual(resolved, {
      ok: false,
      reason: "unusable-declaration",
      key: rootKey,
      detail: "root: expected <plugin>@<marketplace>",
    });
    assert.deepStrictEqual(asked, [], "a key that cannot be split is never looked up");
  });
}

test("RESV-04 a root that declares itself reports a chain beginning and ending at it", async () => {
  // arrange
  const { lookup } = catalog({ "foo@mp": [{ name: "foo" }] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "foo@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, { ok: false, reason: "cycle", chain: ["foo@mp", "foo@mp"] });
});

test("RESV-04 a three-node ring reports the whole walk order plus the repeated key", async () => {
  // arrange
  const { lookup } = catalog({
    "a@mp": [{ name: "b" }],
    "b@mp": [{ name: "c" }],
    "c@mp": [{ name: "a" }],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "a@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "cycle",
    chain: ["a@mp", "b@mp", "c@mp", "a@mp"],
  });
});

test("D-03-11 a diamond resolves once and reports no cycle -- the one-set walk's failure", async () => {
  // arrange: root -> left, right; both -> shared.
  const { lookup, asked } = catalog({
    "root@mp": [{ name: "left" }, { name: "right" }],
    "left@mp": [{ name: "shared", version: "^1.0.0" }],
    "right@mp": [{ name: "shared", version: "^1.2.0" }],
    "shared@mp": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      {
        key: "shared@mp",
        name: "shared",
        marketplace: "mp",
        requiredBy: "left@mp",
        // D-03-10: BOTH declaring branches contribute, and only the two this
        // walk encountered.
        ranges: ["^1.0.0", "^1.2.0"],
      },
      { key: "left@mp", name: "left", marketplace: "mp", requiredBy: "root@mp", ranges: [] },
      { key: "right@mp", name: "right", marketplace: "mp", requiredBy: "root@mp", ranges: [] },
      { key: "root@mp", name: "root", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [],
  });
  assert.deepStrictEqual(
    asked,
    ["root@mp", "left@mp", "shared@mp", "right@mp"],
    "D-03-11: the memo looks each distinct key up exactly once",
  );
});

test("D-03-10 one plugin declaring the same dependency twice contributes both ranges", async () => {
  // arrange: root declares "shared" twice, with different version constraints.
  const { lookup } = catalog({
    "root@mp": [
      { name: "shared", version: "^1.0.0" },
      { name: "shared", version: "^2.0.0" },
    ],
    "shared@mp": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      {
        key: "shared@mp",
        name: "shared",
        marketplace: "mp",
        requiredBy: "root@mp",
        ranges: ["^1.0.0", "^2.0.0"],
      },
      { key: "root@mp", name: "root", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [],
  });
});

test("D-03-11 the memo bounds a layered graph to one lookup per distinct key", async () => {
  // arrange: six layers, each member depending on BOTH members of the next.
  // Without the memo this walk is 2^6 deep; with it, 13 lookups.
  const layers = 6;
  const graph: Record<string, readonly DeclaredDependency[]> = {};
  for (let layer = 0; layer < layers; layer++) {
    for (const side of ["a", "b"]) {
      graph[`L${layer}${side}@mp`] = [{ name: `L${layer + 1}a` }, { name: `L${layer + 1}b` }];
    }
  }

  graph["L6a@mp"] = [];
  graph["L6b@mp"] = [];
  graph["root@mp"] = [{ name: "L0a" }, { name: "L0b" }];
  const { lookup, asked } = catalog(graph);

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.closure.length, 15);
  assert.strictEqual(asked.length, new Set(asked).size, "no key is looked up twice");
  assert.strictEqual(asked.length, 15);
});

test("RESV-05 an already-installed dependency is skipped and its own children are not walked", async () => {
  // arrange
  const { lookup, asked } = catalog({
    "root@mp": [{ name: "installed", version: "^2.0.0" }],
    "installed@mp": [{ name: "never-walked" }],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(["installed@mp"]),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      { key: "root@mp", name: "root", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [
      {
        key: "installed@mp",
        name: "installed",
        marketplace: "mp",
        requiredBy: "root@mp",
        ranges: ["^2.0.0"],
      },
    ],
  });
  assert.deepStrictEqual(asked, ["root@mp"], "a skipped member's own catalog entry is never read");
});

test("RESV-05 a skipped dependency reached twice is reported once", async () => {
  // arrange
  const { lookup } = catalog({
    "root@mp": [{ name: "left" }, { name: "right" }],
    "left@mp": [{ name: "installed", version: "^1.0.0" }],
    "right@mp": [{ name: "installed", version: "^1.5.0" }],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(["installed@mp"]),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(resolved.alreadyInstalled, [
    {
      key: "installed@mp",
      name: "installed",
      marketplace: "mp",
      requiredBy: "left@mp",
      ranges: ["^1.0.0", "^1.5.0"],
    },
  ]);
});

test("RESV-05 the already-installed guard precedes the marketplace-known guard", async () => {
  // arrange: the dependency's marketplace was removed after it was installed.
  const { lookup } = catalog({ "root@mp": [{ name: "installed", marketplace: "gone" }] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(["installed@gone"]),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(
    resolved.alreadyInstalled.map((member) => member.key),
    ["installed@gone"],
  );
});

test("XMKT-01 an added but unlisted foreign dependency is refused before catalog lookup", async () => {
  const { lookup, asked } = catalog({
    "root@official": [{ name: "formatter", marketplace: "tools" }],
    "formatter@tools": [],
  });

  const resolved = await resolveDependencyClosure({
    rootKey: "root@official",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["official", "tools"]),
    installPolicy: { allowedMarketplaces: new Set(), recordedKeys: new Set() },
  });

  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "cross-marketplace",
    key: "formatter@tools",
    requiredBy: "root@official",
    marketplace: "tools",
    rootMarketplace: "official",
  });
  assert.deepStrictEqual(asked, ["root@official"]);
});

test("XMKT-01 a listed foreign dependency resolves through the root policy", async () => {
  const { lookup, asked } = catalog({
    "root@official": [{ name: "formatter", marketplace: "tools" }],
    "formatter@tools": [],
  });

  const resolved = await resolveDependencyClosure({
    rootKey: "root@official",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["official", "tools"]),
    installPolicy: { allowedMarketplaces: new Set(["tools"]), recordedKeys: new Set() },
  });

  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(asked, ["root@official", "formatter@tools"]);
});

test("XMKT-01 same-marketplace dependencies need no allowlist entry", async () => {
  const { lookup, asked } = catalog({
    "root@official": [{ name: "formatter" }],
    "formatter@official": [],
  });

  const resolved = await resolveDependencyClosure({
    rootKey: "root@official",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["official"]),
    installPolicy: { allowedMarketplaces: new Set(), recordedKeys: new Set() },
  });

  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(asked, ["root@official", "formatter@official"]);
});

test("XMKT-02 a recorded disabled foreign key may be read through without permission", async () => {
  const { lookup, asked } = catalog({
    "root@official": [{ name: "formatter", marketplace: "tools" }],
    "formatter@tools": [],
  });

  const resolved = await resolveDependencyClosure({
    rootKey: "root@official",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["official", "tools"]),
    installPolicy: {
      allowedMarketplaces: new Set(),
      recordedKeys: new Set(["formatter@tools"]),
    },
  });

  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(asked, ["root@official", "formatter@tools"]);
});

test("XMKT-01 every transitive edge uses the original root marketplace", async () => {
  const graph = {
    "root@alpha": [{ name: "bridge", marketplace: "beta" }],
    "bridge@beta": [{ name: "leaf", marketplace: "gamma" }],
    "leaf@gamma": [],
  };
  const denied = catalog(graph);

  const refusal = await resolveDependencyClosure({
    rootKey: "root@alpha",
    lookup: denied.lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["alpha", "beta", "gamma"]),
    installPolicy: { allowedMarketplaces: new Set(["beta"]), recordedKeys: new Set() },
  });

  assert.deepStrictEqual(refusal, {
    ok: false,
    reason: "cross-marketplace",
    key: "leaf@gamma",
    requiredBy: "bridge@beta",
    marketplace: "gamma",
    rootMarketplace: "alpha",
  });
  assert.deepStrictEqual(denied.asked, ["root@alpha", "bridge@beta"]);

  const permitted = catalog(graph);
  const result = await resolveDependencyClosure({
    rootKey: "root@alpha",
    lookup: permitted.lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["alpha", "beta", "gamma"]),
    installPolicy: { allowedMarketplaces: new Set(["beta", "gamma"]), recordedKeys: new Set() },
  });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(permitted.asked, ["root@alpha", "bridge@beta", "leaf@gamma"]);
});

test("XMKT-01 an intermediary can depend back on the root marketplace", async () => {
  const { lookup, asked } = catalog({
    "root@alpha": [{ name: "bridge", marketplace: "beta" }],
    "bridge@beta": [{ name: "leaf", marketplace: "alpha" }],
    "leaf@alpha": [],
  });
  const resolved = await resolveDependencyClosure({
    rootKey: "root@alpha",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["alpha", "beta"]),
    installPolicy: { allowedMarketplaces: new Set(["beta"]), recordedKeys: new Set() },
  });
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(asked, ["root@alpha", "bridge@beta", "leaf@alpha"]);
});

for (const { allowed, expected } of [
  { allowed: ["tools"], expected: true },
  { allowed: ["Tools"], expected: false },
  { allowed: [" tools"], expected: false },
  { allowed: ["tools "], expected: false },
  { allowed: ["tools", "tools"], expected: true },
]) {
  test(`XMKT-01 permission compares exact marketplace names in ${JSON.stringify(allowed)}`, async () => {
    const { lookup, asked } = catalog({
      "root@official": [{ name: "formatter", marketplace: "tools" }],
      "formatter@tools": [],
    });
    const resolved = await resolveDependencyClosure({
      rootKey: "root@official",
      lookup,
      installedKeys: new Set(),
      knownMarketplaces: new Set(["official", "tools"]),
      installPolicy: { allowedMarketplaces: new Set(allowed), recordedKeys: new Set() },
    });
    assert.strictEqual(resolved.ok, expected);
    assert.deepStrictEqual(
      asked,
      expected ? ["root@official", "formatter@tools"] : ["root@official"],
    );
  });
}

for (const allowed of [false, true]) {
  test(`XMKT-01 an unknown foreign marketplace ${allowed ? "passes policy then fails lookup" : "fails policy first"}`, async () => {
    const { lookup, asked } = catalog({ "root@alpha": [{ name: "leaf", marketplace: "gone" }] });
    const resolved = await resolveDependencyClosure({
      rootKey: "root@alpha",
      lookup,
      installedKeys: new Set(),
      knownMarketplaces: new Set(["alpha"]),
      installPolicy: {
        allowedMarketplaces: new Set(allowed ? ["gone"] : []),
        recordedKeys: new Set(),
      },
    });
    assert.deepStrictEqual(
      resolved,
      allowed
        ? {
            ok: false,
            reason: "marketplace-not-added",
            key: "leaf@gone",
            marketplace: "gone",
            requiredBy: "root@alpha",
          }
        : {
            ok: false,
            reason: "cross-marketplace",
            key: "leaf@gone",
            marketplace: "gone",
            requiredBy: "root@alpha",
            rootMarketplace: "alpha",
          },
    );
    assert.deepStrictEqual(asked, ["root@alpha"]);
  });
}

test("XMKT-02 recorded foreign edges retain every range before the installed check", async () => {
  const { lookup, asked } = catalog({
    "root@alpha": [{ name: "left" }, { name: "right" }],
    "left@alpha": [{ name: "leaf", marketplace: "gone", version: "^1.0.0" }],
    "right@alpha": [{ name: "leaf", marketplace: "gone", version: "^1.2.0" }],
  });
  const resolved = await resolveDependencyClosure({
    rootKey: "root@alpha",
    lookup,
    installedKeys: new Set(["leaf@gone"]),
    knownMarketplaces: new Set(["alpha"]),
    installPolicy: { allowedMarketplaces: new Set(), recordedKeys: new Set(["leaf@gone"]) },
  });
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(resolved.alreadyInstalled, [
    {
      key: "leaf@gone",
      name: "leaf",
      marketplace: "gone",
      requiredBy: "left@alpha",
      ranges: ["^1.0.0", "^1.2.0"],
    },
  ]);
  assert.deepStrictEqual(asked, ["root@alpha", "left@alpha", "right@alpha"]);
});

test("XMKT-02 a recorded disabled foreign edge exempts only itself", async () => {
  const { lookup, asked } = catalog({
    "root@alpha": [{ name: "bridge", marketplace: "beta" }],
    "bridge@beta": [{ name: "leaf", marketplace: "gamma" }],
  });
  const resolved = await resolveDependencyClosure({
    rootKey: "root@alpha",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["alpha", "beta", "gamma"]),
    installPolicy: { allowedMarketplaces: new Set(), recordedKeys: new Set(["bridge@beta"]) },
  });
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "cross-marketplace",
    key: "leaf@gamma",
    requiredBy: "bridge@beta",
    marketplace: "gamma",
    rootMarketplace: "alpha",
  });
  assert.deepStrictEqual(asked, ["root@alpha", "bridge@beta"]);
});

test("D-03-08 a dependency naming an unadded marketplace fails the whole closure", async () => {
  // arrange
  const { lookup } = catalog({ "root@mp": [{ name: "helper", marketplace: "other" }] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert: the walk has no marketplace-add capability at all, so the arm IS
  // the whole observable effect.
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "marketplace-not-added",
    key: "helper@other",
    marketplace: "other",
    requiredBy: "root@mp",
  });
});

test("RESV-02 a declaration naming no marketplace resolves in the declaring plugin's", async () => {
  // arrange: root lives in `mp`, its dependency lives in `other`, and THAT
  // plugin's own unqualified declaration must resolve in `other`.
  const { lookup } = catalog({
    "root@mp": [{ name: "bridge", marketplace: "other" }],
    "bridge@other": [{ name: "leaf" }],
    "leaf@other": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp", "other"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(
    resolved.closure.map((member) => member.key),
    ["leaf@other", "bridge@other", "root@mp"],
  );
});

test("RESV-02 a filled-in marketplace that fails the token allowlist rejects the declaration", async () => {
  // arrange: the declaring key's marketplace half is only reachable through a
  // lookup that hands back a dependency naming an unrenderable one.
  const { lookup } = catalog({ "root@mp": [{ name: "leaf", marketplace: "not a token" }] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "unusable-declaration",
    key: "root@mp",
    detail: "dependencies.0: unrenderable marketplace",
  });
});

test("D-03-36 a declared sha is refused rather than resolved as no constraint", async () => {
  // arrange: the element is otherwise perfectly valid -- `sha` passes the
  // parser's own allowlist, so nothing upstream of the walk rejects it. Without
  // the refusal the edge is built from `name` alone and the member installs
  // whatever ref its marketplace entry names, which is the silent pin loss.
  const { lookup, asked } = catalog({
    "root@mp": [{ name: "leaf", sha: "abc1234" }],
    "leaf@mp": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "unusable-declaration",
    key: "root@mp",
    detail: "dependencies.0: sha pinning is not supported",
  });
  assert.deepStrictEqual(asked, ["root@mp"], "the refused edge is never walked");
});

test("D-03-36 a sha declared beside a version is refused on the sha, not resolved on the version", async () => {
  // arrange: both constraint forms on one element. Honoring the version half
  // and dropping the sha half would install a version the declaration asked
  // for at a commit it did not.
  const { lookup } = catalog({
    "root@mp": [{ name: "leaf", version: "^1.0.0", sha: "abc1234" }],
    "leaf@mp": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, false);
  assert.strictEqual(resolved.reason, "unusable-declaration");
});

test("RESV-02 keys match by exact string identity, so case is never folded", async () => {
  // arrange: "Helper" and "helper" are two members, not one. Unicode
  // normalization cannot arise at all -- the dependency token alphabet
  // (`/^[A-Za-z0-9][-A-Za-z0-9._]{0,255}$/`) admits no character that has a
  // second normal form, so no composed/decomposed pair can ever reach a key.
  const { lookup } = catalog({
    "root@mp": [{ name: "Helper" }, { name: "helper" }],
    "Helper@mp": [],
    "helper@mp": [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(
    resolved.closure.map((member) => member.key),
    ["Helper@mp", "helper@mp", "root@mp"],
  );
});

test("RESV-02 two Unicode forms of one name resolve as distinct members", async () => {
  // arrange: the composed "e-acute" and the decomposed "e" + combining acute
  // render identically and are NOT equal strings. Written as escapes so no
  // editor or formatter can normalize the fixture out from under the case.
  const composed = "caf\u00e9";
  const decomposed = "cafe\u0301";
  const { lookup } = catalog({
    "root@mp": [{ name: composed }, { name: decomposed }],
    [`${composed}@mp`]: [],
    [`${decomposed}@mp`]: [],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert: the walk compares keys by exact string identity and normalizes
  // nothing, so the memo does not collapse the pair.
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(
    resolved.closure.map((member) => member.key),
    [`${composed}@mp`, `${decomposed}@mp`, "root@mp"],
  );
});

test("RESV-01 a dependency no marketplace declares fails as not-found naming its parent", async () => {
  // arrange
  const { lookup } = catalog({ "root@mp": [{ name: "ghost" }] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "not-found",
    key: "ghost@mp",
    requiredBy: "root@mp",
  });
});

test("a dependency whose declaration does not parse fails as unusable", async () => {
  // arrange
  const lookup: ClosureLookup = (subject) =>
    Promise.resolve<ClosureLookupResult>(
      subject.key === "root@mp"
        ? { kind: "found", dependencies: [{ name: "broken" }] }
        : { kind: "unusable", detail: "dependencies.0: Invalid input" },
    );

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: false,
    reason: "unusable-declaration",
    key: "broken@mp",
    detail: "dependencies.0: Invalid input",
  });
});

test("an absent ROOT resolves to itself alone, leaving the miss to the caller", async () => {
  // arrange: the caller's materialization path owns the requested plugin's
  // existence precondition and reports it against the right subject.
  const { lookup } = catalog({});

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      { key: "root@mp", name: "root", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [],
  });
});

test("an empty dependencies array yields a closure carrying the root alone", async () => {
  // arrange
  const { lookup } = catalog({ "root@mp": [] });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.deepStrictEqual(resolved, {
    ok: true,
    closure: [
      { key: "root@mp", name: "root", marketplace: "mp", requiredBy: undefined, ranges: [] },
    ],
    alreadyInstalled: [],
  });
});

test("D-03-10 a range declared outside the walked graph never reaches a member", async () => {
  // arrange: `unrelated@mp` constrains `leaf`, and nothing in root's graph
  // names `unrelated`, so the walk never reads it.
  const { lookup, asked } = catalog({
    "root@mp": [{ name: "leaf" }],
    "leaf@mp": [],
    "unrelated@mp": [{ name: "leaf", version: "^9.0.0" }],
  });

  // act
  const resolved = await resolveDependencyClosure({
    rootKey: "root@mp",
    lookup,
    installedKeys: new Set(),
    knownMarketplaces: new Set(["mp"]),
  });

  // assert
  assert.strictEqual(resolved.ok, true);
  assert.deepStrictEqual(resolved.closure[0]?.ranges, []);
  assert.deepStrictEqual(asked, ["root@mp", "leaf@mp"]);
});
