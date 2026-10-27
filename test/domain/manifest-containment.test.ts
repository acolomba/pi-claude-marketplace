import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  copyManifestBoundary,
  inPlaceManifestBoundary,
  isAbsenceError,
  locateManifestCandidate,
  sourceManifestBoundary,
} from "../../extensions/pi-claude-marketplace/domain/manifest-containment.ts";

import type {
  ManifestBoundary,
  ManifestLocation,
} from "../../extensions/pi-claude-marketplace/domain/manifest-containment.ts";

/** A marketplace tree holding one plugin, and a second root outside every boundary. */
interface PlantedTree {
  readonly marketplaceRoot: string;
  readonly pluginRoot: string;
  readonly wrapped: string;
  readonly outside: string;
}

async function temporaryRoot(t: TestContext, prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function plantTree(t: TestContext): Promise<PlantedTree> {
  const marketplaceRoot = await temporaryRoot(t, "manifest-containment-mp-");
  const outside = await temporaryRoot(t, "manifest-containment-outside-");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "alpha");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  return {
    marketplaceRoot,
    pluginRoot,
    wrapped: path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    outside,
  };
}

const BOUNDARY_KINDS = [
  { kind: "copy", boundaryOf: (tree: PlantedTree) => copyManifestBoundary(tree.pluginRoot) },
  {
    kind: "in-place",
    boundaryOf: (tree: PlantedTree) =>
      inPlaceManifestBoundary(tree.pluginRoot, tree.marketplaceRoot),
  },
] as const;

describe("locateManifestCandidate", () => {
  for (const { kind, boundaryOf } of BOUNDARY_KINDS) {
    test(`opens a ${kind} candidate with no link at its spelled path`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      await writeFile(tree.wrapped, "{}");

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: tree.wrapped });
    });

    test(`opens a missing ${kind} candidate at its spelled path`, async (t) => {
      // arrange
      const tree = await plantTree(t);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: tree.wrapped });
    });

    test(`D-PL2-24: opens a ${kind} link to a file in the plugin at the target`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const target = path.join(tree.pluginRoot, "manifest.json");
      await writeFile(target, "{}");
      await symlink(target, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: await realpath(target) });
    });

    test(`D-PL2-24: opens a ${kind} chain of links inside the plugin at its last target`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const hop = path.join(tree.pluginRoot, "hop.json");
      const target = path.join(tree.pluginRoot, "manifest.json");
      await writeFile(target, "{}");
      await symlink(target, hop);
      await symlink(hop, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: await realpath(target) });
    });

    test(`D-PL2-24: opens a ${kind} link with relative parent text inside the plugin`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const target = path.join(tree.pluginRoot, "manifest.json");
      await writeFile(target, "{}");
      await symlink(path.join("..", "manifest.json"), tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: await realpath(target) });
    });

    test(`D-PL2-24: opens a ${kind} candidate under a linked wrapper directory`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const meta = path.join(tree.pluginRoot, "meta");
      await mkdir(meta);
      await writeFile(path.join(meta, "plugin.json"), "{}");
      await rm(path.dirname(tree.wrapped), { recursive: true });
      await symlink(meta, path.dirname(tree.wrapped));

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, {
        kind: "open",
        path: path.join(await realpath(meta), "plugin.json"),
      });
    });

    test(`D-PL2-24: refuses a ${kind} absolute link to a file outside every root`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const target = path.join(tree.outside, "plugin.json");
      await writeFile(target, "{}");
      await symlink(target, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "escapes" });
    });

    test(`D-PL2-24: refuses a ${kind} chain whose inside hop leads outside`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const hop = path.join(tree.pluginRoot, "hop.json");
      const target = path.join(tree.outside, "plugin.json");
      await writeFile(target, "{}");
      await symlink(target, hop);
      await symlink(hop, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "escapes" });
    });

    test(`D-PL2-24: refuses a ${kind} relative link that climbs out of every root`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const target = path.join(tree.outside, "plugin.json");
      await writeFile(target, "{}");
      await symlink(path.relative(path.dirname(tree.wrapped), target), tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "escapes" });
    });

    test(`D-PL2-24: answers a ${kind} link loop as unresolvable`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      await symlink(tree.wrapped, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(describeLocation(location), { kind: "unresolvable", code: "ELOOP" });
    });

    test(`D-01-06: answers a dangling ${kind} link as absent`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      await symlink(path.join(tree.pluginRoot, "missing.json"), tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "absent" });
    });

    test(`D-01-06: answers a ${kind} link through a regular file as absent`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const file = path.join(tree.pluginRoot, "file.txt");
      await writeFile(file, "not a directory");
      await symlink(path.join(file, "plugin.json"), tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(tree), tree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "absent" });
    });

    test(`D-PL2-24: keeps a ${kind} root under a linked ancestor containing its own files`, async (t) => {
      // arrange
      const tree = await plantTree(t);
      const linkedAncestor = path.join(tree.outside, "linked-marketplace");
      await symlink(tree.marketplaceRoot, linkedAncestor);
      const linkedTree: PlantedTree = {
        marketplaceRoot: linkedAncestor,
        pluginRoot: path.join(linkedAncestor, "plugins", "alpha"),
        wrapped: path.join(linkedAncestor, "plugins", "alpha", ".claude-plugin", "plugin.json"),
        outside: tree.outside,
      };
      const target = path.join(tree.pluginRoot, "manifest.json");
      await writeFile(target, "{}");
      await symlink(target, tree.wrapped);

      // act
      const location = await locateManifestCandidate(boundaryOf(linkedTree), linkedTree.wrapped);

      // assert
      assert.deepStrictEqual(location, { kind: "open", path: await realpath(target) });
    });
  }

  test("D-PL2-17: refuses a copy link into its marketplace directory", async (t) => {
    // arrange
    const tree = await plantTree(t);
    const target = path.join(tree.marketplaceRoot, "shared.json");
    await writeFile(target, "{}");
    await symlink(target, tree.wrapped);

    // act
    const location = await locateManifestCandidate(
      copyManifestBoundary(tree.pluginRoot),
      tree.wrapped,
    );

    // assert
    assert.deepStrictEqual(location, { kind: "escapes" });
  });

  test("D-PL2-17: opens an in-place link into its marketplace directory at the target", async (t) => {
    // arrange
    const tree = await plantTree(t);
    const target = path.join(tree.marketplaceRoot, "shared.json");
    await writeFile(target, "{}");
    await symlink(target, tree.wrapped);

    // act
    const location = await locateManifestCandidate(
      inPlaceManifestBoundary(tree.pluginRoot, tree.marketplaceRoot),
      tree.wrapped,
    );

    // assert
    assert.deepStrictEqual(location, { kind: "open", path: await realpath(target) });
  });

  test("WR-03: opens a candidate under a non-directory wrapper at its spelled path", async (t) => {
    // arrange
    const tree = await plantTree(t);
    await rm(path.dirname(tree.wrapped), { recursive: true });
    await writeFile(path.dirname(tree.wrapped), "not a directory");

    // act
    const location = await locateManifestCandidate(
      copyManifestBoundary(tree.pluginRoot),
      tree.wrapped,
    );

    // assert
    assert.deepStrictEqual(location, { kind: "open", path: tree.wrapped });
  });

  test("answers a candidate spelling the system rejects as unresolvable", async (t) => {
    // arrange
    const tree = await plantTree(t);
    const candidate = path.join(tree.pluginRoot, "bad\0name", "plugin.json");

    // act
    const location = await locateManifestCandidate(
      copyManifestBoundary(tree.pluginRoot),
      candidate,
    );

    // assert
    assert.deepStrictEqual(describeLocation(location), {
      kind: "unresolvable",
      code: "ERR_INVALID_ARG_VALUE",
    });
  });

  test("answers a link under an in-place boundary whose marketplace root is gone as unresolvable", async (t) => {
    // arrange
    const tree = await plantTree(t);
    const target = path.join(tree.pluginRoot, "manifest.json");
    await writeFile(target, "{}");
    await symlink(target, tree.wrapped);
    const missingMarketplaceRoot = path.join(tree.outside, "missing-marketplace");

    // act
    const location = await locateManifestCandidate(
      inPlaceManifestBoundary(tree.pluginRoot, missingMarketplaceRoot),
      tree.wrapped,
    );

    // assert
    assert.deepStrictEqual(describeLocation(location), { kind: "unresolvable", code: "ENOENT" });
  });
});

describe("copyManifestBoundary", () => {
  test("bounds a copy by its plugin directory alone", () => {
    // act
    const boundary = copyManifestBoundary("/clones/alpha");

    // assert
    assert.deepStrictEqual(boundary, {
      pluginRoot: "/clones/alpha",
      roots: ["/clones/alpha"],
      label: "plugin directory",
    } satisfies ManifestBoundary);
  });
});

describe("inPlaceManifestBoundary", () => {
  test("bounds a plugin read in place by its plugin and marketplace directories", () => {
    // act
    const boundary = inPlaceManifestBoundary("/mp/plugins/alpha", "/mp");

    // assert
    assert.deepStrictEqual(boundary, {
      pluginRoot: "/mp/plugins/alpha",
      roots: ["/mp/plugins/alpha", "/mp"],
      label: "plugin directory and its marketplace directory",
    } satisfies ManifestBoundary);
  });
});

describe("sourceManifestBoundary", () => {
  test("D-PL2-17: reads an unpinned path source in place", () => {
    // act
    const boundary = sourceManifestBoundary("./alpha", "/mp/alpha", "/mp", undefined);

    // assert
    assert.deepStrictEqual(boundary, {
      pluginRoot: "/mp/alpha",
      roots: ["/mp/alpha", "/mp"],
      label: "plugin directory and its marketplace directory",
    } satisfies ManifestBoundary);
  });

  test("D-PL2-17: bounds a path source pinned to a tag by its plugin directory", () => {
    // act
    const boundary = sourceManifestBoundary("./alpha", "/clones/alpha", "/mp", "2.0.0");

    // assert
    assert.deepStrictEqual(boundary, {
      pluginRoot: "/clones/alpha",
      roots: ["/clones/alpha"],
      label: "plugin directory",
    } satisfies ManifestBoundary);
  });

  test("D-PL2-17: bounds a git source by its plugin directory", () => {
    // act
    const boundary = sourceManifestBoundary(
      { source: "github", repo: "acme/alpha" },
      "/clones/alpha",
      "/mp",
      undefined,
    );

    // assert
    assert.deepStrictEqual(boundary, {
      pluginRoot: "/clones/alpha",
      roots: ["/clones/alpha"],
      label: "plugin directory",
    } satisfies ManifestBoundary);
  });
});

describe("isAbsenceError", () => {
  for (const { code, absent } of [
    { code: "ENOENT", absent: true },
    { code: "ENOTDIR", absent: true },
    { code: "ELOOP", absent: false },
    { code: "EACCES", absent: false },
  ]) {
    test(`D-01-06: reads ${code} as ${absent ? "absence" : "presence"}`, () => {
      // arrange
      const error = Object.assign(new Error(code), { code });

      // act
      const isAbsent = isAbsenceError(error);

      // assert
      assert.strictEqual(isAbsent, absent);
    });
  }

  test("D-01-06: reads a value with no errno code as presence", () => {
    // act
    const isAbsent = isAbsenceError("ENOENT");

    // assert
    assert.strictEqual(isAbsent, false);
  });
});

/** An unresolvable answer with its error reduced to the errno code it carries. */
function describeLocation(
  location: ManifestLocation,
): ManifestLocation | { readonly kind: "unresolvable"; readonly code: unknown } {
  return location.kind === "unresolvable"
    ? { kind: "unresolvable", code: (location.error as { code?: unknown }).code }
    : location;
}
