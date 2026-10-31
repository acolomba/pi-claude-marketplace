import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  installedCopyReadOptions,
  readCandidateDeclaration,
  readDependencyDeclaration,
  readInstalledCopyDeclaration,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { CHMOD_DENIAL_HINT, chmodDeniesThisProcess } from "../../chmod-denial.ts";

import type { ClosureLookupResult } from "../../../extensions/pi-claude-marketplace/domain/dependency-closure.ts";
import type { ManifestPluginEntry } from "../../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";
import type { GitPluginRootResult } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";

/**
 * A marketplace root that is never created on disk. `assertPathInside` returns
 * without complaint for a path whose components do not exist, so the derivation
 * still yields a plugin root and every candidate answer comes from the seam.
 */
const MARKETPLACE_ROOT = path.join(tmpdir(), "dependency-declaration-read-marketplace");
const PLUGIN_ROOT = path.join(MARKETPLACE_ROOT, "alpha");
const WRAPPED = path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json");
const BARE = path.join(PLUGIN_ROOT, "plugin.json");

/** The candidate ordering, applied to an arbitrary plugin root. */
function candidatesUnder(pluginRoot: string): { wrapped: string; bare: string } {
  return {
    wrapped: path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    bare: path.join(pluginRoot, "plugin.json"),
  };
}

/** A candidate's answer: its bytes, or a stat failure. An unnamed one is absent. */
type CandidateAnswer = string | Error;

function errno(code: string): Error {
  return Object.assign(new Error(code), { code });
}

interface RecordingReader extends DependencyDeclarationReader {
  /** Every candidate path whose kind was probed, in walk order. */
  readonly opened: string[];
  /** Every source raw spelling the presence probe was asked about. */
  readonly probed: string[];
}

/**
 * A seam that never touches disk and never materializes anything. An unnamed
 * candidate is absent, and a presence probe nobody supplied fails loudly rather
 * than answering a question the case did not ask.
 */
function buildReader(options: {
  readonly files?: Readonly<Record<string, CandidateAnswer>>;
  readonly presence?: () => Promise<GitPluginRootResult>;
}): RecordingReader {
  const files = options.files ?? {};
  const opened: string[] = [];
  const probed: string[] = [];
  return {
    opened,
    probed,
    isRegularFile(filePath: string): Promise<boolean> {
      opened.push(filePath);
      const answer = files[filePath];
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve(typeof answer === "string");
    },
    readTextFile(filePath: string): Promise<string> {
      const answer = files[filePath];
      return typeof answer === "string"
        ? Promise.resolve(answer)
        : Promise.reject(new Error(`unexpected read of ${filePath}`));
    },
    makePresenceProbe: () => (source) => {
      probed.push(source.raw);
      return options.presence === undefined
        ? Promise.reject(new Error(`unexpected presence probe for ${source.raw}`))
        : options.presence();
    },
  };
}

function entryWith(source: unknown, dependencies?: unknown): ManifestPluginEntry {
  return { name: "alpha", source, dependencies };
}

/** The recording seam's scope bundle. No case reads a real clone through it. */
const LOCATIONS = locationsFor("project", MARKETPLACE_ROOT);

async function readDeclaration(
  entry: ManifestPluginEntry,
  reader: RecordingReader,
): Promise<ClosureLookupResult> {
  return readDependencyDeclaration({
    marketplaceRoot: MARKETPLACE_ROOT,
    entry,
    locations: LOCATIONS,
    reader,
  });
}

/** `readDeclaration` under the dependents index's option (D-05-07). */
async function readRefusingUnusable(
  entry: ManifestPluginEntry,
  reader: RecordingReader,
): Promise<ClosureLookupResult> {
  return readDependencyDeclaration({
    marketplaceRoot: MARKETPLACE_ROOT,
    entry,
    locations: LOCATIONS,
    reader,
    refuseUnusableOwnManifest: true,
  });
}

/** The parsed form of the bare token `<name>@mp` every case declares. */
function dependsOn(name: string): ClosureLookupResult {
  return { kind: "found", dependencies: [{ name, marketplace: "mp" }] };
}

async function freshRoot(testContext: TestContext, prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  testContext.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  return root;
}

test("D-01-32: the plugin's own manifest answers where the entry declares nothing", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: '{"dependencies":["helper@mp"]}' } });

  // act
  const declaration = await readDeclaration(entryWith("./alpha"), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("helper"));
  assert.deepStrictEqual(reader.opened, [WRAPPED]);
});

test("D-01-32: a manifest declaring an empty array suppresses the entry's list", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: '{"dependencies":[]}' } });

  // act
  const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, { kind: "found", dependencies: [] });
});

test("D-01-32: a manifest with no dependencies key means the plugin declares nothing", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: '{"name":"alpha"}' } });

  // act
  const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, { kind: "found", dependencies: [] });
});

test("D-01-07: an unparseable first candidate falls back to the entry, not to the second", async () => {
  // arrange -- the bare sibling declares a DIFFERENT plugin, so the answer names
  // which file was treated as authoritative rather than merely that one was read.
  const reader = buildReader({
    files: { [WRAPPED]: "{ truncated", [BARE]: '{"dependencies":["from-bare@mp"]}' },
  });

  // act
  const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.opened, [WRAPPED], "the walk must end at the unusable candidate");
});

test("D-01-06: an absent first candidate falls through to the bare manifest", async () => {
  // arrange
  const reader = buildReader({ files: { [BARE]: '{"dependencies":["from-bare@mp"]}' } });

  // act
  const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-bare"));
  assert.deepStrictEqual(reader.opened, [WRAPPED, BARE]);
});

test("D-01-32: neither candidate readable leaves the entry as the answer", async () => {
  // arrange
  const reader = buildReader({ files: {} });

  // act
  const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.opened, [WRAPPED, BARE]);
});

for (const { label, fault, expected } of [
  {
    label: "an ENOENT stat is absence, so the walk continues to the sibling",
    fault: errno("ENOENT"),
    expected: "from-bare",
  },
  {
    label: "an ENOTDIR stat is absence, so the walk continues to the sibling",
    fault: errno("ENOTDIR"),
    expected: "from-bare",
  },
  {
    label: "an EACCES stat ends the walk as not-readable",
    fault: errno("EACCES"),
    expected: "from-entry",
  },
  {
    label: "a stat failure carrying no errno code ends the walk as not-readable",
    fault: new Error("boom"),
    expected: "from-entry",
  },
]) {
  test(`D-01-07: ${label}`, async () => {
    // arrange
    const reader = buildReader({
      files: { [WRAPPED]: fault, [BARE]: '{"dependencies":["from-bare@mp"]}' },
    });

    // act
    const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

    // assert
    assert.deepStrictEqual(declaration, dependsOn(expected));
  });
}

for (const { label, payload } of [
  { label: "a JSON number", payload: "123" },
  { label: "a JSON null", payload: "null" },
  { label: "a JSON array", payload: '["helper@mp"]' },
]) {
  test(`D-01-07: ${label} payload is a present-but-unusable manifest`, async () => {
    // arrange
    const reader = buildReader({ files: { [WRAPPED]: payload } });

    // act
    const declaration = await readDeclaration(entryWith("./alpha", ["from-entry@mp"]), reader);

    // assert
    assert.deepStrictEqual(declaration, dependsOn("from-entry"));
    assert.deepStrictEqual(reader.opened, [WRAPPED], "the walk must end at the unusable candidate");
  });
}

for (const { label, wrapped } of [
  { label: "an unparseable first candidate", wrapped: "{ truncated" },
  { label: "an EACCES stat on the first candidate", wrapped: errno("EACCES") },
  { label: "a JSON-array payload", wrapped: '["helper@mp"]' },
]) {
  test(`D-05-07: with refuseUnusableOwnManifest, ${label} is the unusable arm, not the entry`, async () => {
    // arrange -- the bare sibling declares a DIFFERENT plugin, so a walk that
    // wrongly continued past the unusable candidate would change the answer.
    const reader = buildReader({
      files: { [WRAPPED]: wrapped, [BARE]: '{"dependencies":["from-bare@mp"]}' },
    });

    // act
    const declaration = await readRefusingUnusable(entryWith("./alpha", ["from-entry@mp"]), reader);

    // assert
    assert.deepStrictEqual(declaration, {
      kind: "unusable",
      detail: "its own manifest is present but cannot be read",
      ownManifest: true,
    });
    assert.deepStrictEqual(reader.opened, [WRAPPED], "the walk must end at the unusable candidate");
  });
}

for (const { label, source, files, expectedOpened } of [
  {
    label: "no candidate present",
    source: "./alpha",
    files: {},
    expectedOpened: [WRAPPED, BARE],
  },
  {
    label: "a containment-refused root",
    source: "../outside",
    files: {
      [candidatesUnder(path.resolve(MARKETPLACE_ROOT, "../outside")).wrapped]:
        '{"dependencies":["escaped@mp"]}',
    },
    expectedOpened: [],
  },
]) {
  test(`D-05-06: with refuseUnusableOwnManifest, ${label} still falls back to the entry`, async () => {
    // arrange
    const reader = buildReader({ files });

    // act
    const declaration = await readRefusingUnusable(entryWith(source, ["from-entry@mp"]), reader);

    // assert
    assert.deepStrictEqual(declaration, dependsOn("from-entry"));
    assert.deepStrictEqual(reader.opened, expectedOpened);
  });
}

test("RESV-02: a rejected declaration becomes the unusable arm carrying the reason", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: '{"dependencies":["bad name!"]}' } });

  // act
  const declaration = await readDeclaration(entryWith("./alpha"), reader);

  // assert
  assert.deepStrictEqual(declaration, {
    kind: "unusable",
    detail: "dependencies.0: Invalid input",
  });
});

test("NFR-10: a containment refusal while deriving a plugin root reads as no root", async () => {
  // arrange -- the escaping root's OWN candidate declares a different plugin, so
  // a derivation that wrongly succeeded would change the answer.
  const escaped = candidatesUnder(path.resolve(MARKETPLACE_ROOT, "../outside"));
  const reader = buildReader({ files: { [escaped.wrapped]: '{"dependencies":["escaped@mp"]}' } });

  // act
  const declaration = await readDeclaration(entryWith("../outside", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.opened, [], "a refused root opens no candidate");
});

test("NFR-10: a syscall-layer refusal while deriving a plugin root reads as no root", async () => {
  // arrange -- an interior NUL byte is rejected by the syscall layer, not by
  // containment, so only a TOTAL catch keeps it out of the cascade.
  const raw = "./al\u0000pha";
  const nulRoot = candidatesUnder(path.resolve(MARKETPLACE_ROOT, raw));
  const reader = buildReader({ files: { [nulRoot.wrapped]: '{"dependencies":["nul@mp"]}' } });

  // act
  const declaration = await readDeclaration(entryWith(raw, ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.opened, [], "a refused root opens no candidate");
});

test("D-01-32: a warm git clone's own manifest answers", async () => {
  // arrange
  const cloneRoot = path.join(MARKETPLACE_ROOT, "clone");
  const reader = buildReader({
    files: { [candidatesUnder(cloneRoot).wrapped]: '{"dependencies":["from-manifest@mp"]}' },
    presence: () =>
      Promise.resolve({ kind: "materialized", pluginRoot: cloneRoot, resolvedSha: "a".repeat(40) }),
  });

  // act
  const entry = entryWith("https://example.com/alpha.git", ["from-entry@mp"]);
  const declaration = await readDeclaration(entry, reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-manifest"));
  assert.deepStrictEqual(reader.probed, ["https://example.com/alpha.git"]);
});

test("NFR-5: a git-subdir source with a missing subdirectory is answered by the entry", async () => {
  // arrange
  const reader = buildReader({
    presence: () => Promise.resolve({ kind: "missing-subdir", detail: "sub" }),
  });
  const entry = entryWith(
    { kind: "git-subdir", url: "https://example.com/repo.git", path: "sub" },
    ["from-entry@mp"],
  );

  // act
  const declaration = await readDeclaration(entry, reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.opened, [], "no local tree means no candidate is opened");
});

test("NFR-5: a github source whose presence probe throws is answered by the entry", async () => {
  // arrange -- one corrupt mirror degrades one plugin; it does not fail the cascade.
  const reader = buildReader({ presence: () => Promise.reject(new Error("corrupt mirror HEAD")) });

  // act
  const declaration = await readDeclaration(entryWith("owner/repo", ["from-entry@mp"]), reader);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.deepStrictEqual(reader.probed, ["owner/repo"]);
});

for (const { label, source } of [
  { label: "an npm", source: { kind: "npm", package: "@scope/alpha" } },
  { label: "a hosted", source: { kind: "hosted", raw: "https://h.example/alpha.json" } },
  { label: "an unrecognized", source: "ftp://example.com/alpha" },
]) {
  test(`NFR-5: ${label} source has no readable tree, so the entry answers`, async () => {
    // arrange
    const reader = buildReader({});

    // act
    const declaration = await readDeclaration(entryWith(source, ["from-entry@mp"]), reader);

    // assert
    assert.deepStrictEqual(declaration, dependsOn("from-entry"));
    assert.deepStrictEqual(reader.opened, []);
    assert.deepStrictEqual(reader.probed, [], "an unresolvable source reaches no clone probe");
  });
}

test("NFR-5: a git source with no materialized clone materializes nothing", async (testContext) => {
  // arrange -- the PRODUCTION seam, against an empty scope root.
  const scopeRoot = await freshRoot(testContext, "ddr-scope-");
  const locations = locationsFor("project", scopeRoot);
  const entry = entryWith("https://example.com/alpha.git", ["from-entry@mp"]);

  // act
  const declaration = await readDependencyDeclaration({
    marketplaceRoot: MARKETPLACE_ROOT,
    entry,
    locations,
  });

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-entry"));
  assert.equal(
    existsSync(locations.pluginClonesDir),
    false,
    "the read must not create a clone directory",
  );
});

test("D-01-32: the production reader reads a bare manifest off real disk", async (testContext) => {
  // arrange
  const marketplaceRoot = await freshRoot(testContext, "ddr-marketplace-");
  const pluginRoot = path.join(marketplaceRoot, "alpha");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(path.join(pluginRoot, "plugin.json"), '{"dependencies":["from-manifest@mp"]}\n');

  // act
  const declaration = await readDependencyDeclaration({
    marketplaceRoot,
    entry: entryWith("./alpha", ["from-entry@mp"]),
    locations: locationsFor("project", marketplaceRoot),
  });

  // assert
  assert.deepStrictEqual(declaration, dependsOn("from-manifest"));
});

/**
 * A marketplace holding `alpha` read in place, for the catalog read over real
 * disk. `real.json` declares `linked@mp` and the bare `plugin.json` declares
 * `bare@mp`; the entry declares `entry@mp`.
 */
async function linkedCatalogPlugin(
  testContext: TestContext,
): Promise<{ readonly marketplaceRoot: string; readonly pluginRoot: string }> {
  const marketplaceRoot = await freshRoot(testContext, "ddr-catalog-link-");
  const pluginRoot = path.join(marketplaceRoot, "alpha");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "real.json"),
    JSON.stringify({ dependencies: ["linked@mp"] }),
  );
  await writeFile(
    path.join(pluginRoot, "plugin.json"),
    JSON.stringify({ dependencies: ["bare@mp"] }),
  );
  return { marketplaceRoot, pluginRoot };
}

/** The catalog read of `alpha` in `marketplaceRoot`, refusing an unusable manifest when asked. */
function readCatalogAlpha(
  marketplaceRoot: string,
  refuse: boolean,
): ReturnType<typeof readDependencyDeclaration> {
  return readDependencyDeclaration({
    marketplaceRoot,
    entry: entryWith("./alpha", ["entry@mp"]),
    locations: locationsFor("project", marketplaceRoot),
    ...(refuse && { refuseUnusableOwnManifest: true }),
  });
}

const CATALOG_LINK_SHAPES: readonly {
  readonly label: string;
  readonly plant: (testContext: TestContext, pluginRoot: string) => Promise<void>;
  readonly followed: boolean;
}[] = [
  {
    label: "a direct link to a file in the plugin",
    plant: async (_testContext, pluginRoot) => {
      await symlink(
        path.join(pluginRoot, "real.json"),
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      );
    },
    followed: true,
  },
  {
    label: "a chain of links inside the plugin",
    plant: async (_testContext, pluginRoot) => {
      await symlink(path.join(pluginRoot, "real.json"), path.join(pluginRoot, "hop.json"));
      await symlink(
        path.join(pluginRoot, "hop.json"),
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      );
    },
    followed: true,
  },
  {
    label: "a relative link inside the plugin",
    plant: async (_testContext, pluginRoot) => {
      await symlink(
        path.join("..", "real.json"),
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      );
    },
    followed: true,
  },
  {
    label: "an absolute link outside the marketplace",
    plant: async (testContext, pluginRoot) => {
      await symlink(
        await outsideManifest(testContext),
        path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      );
    },
    followed: false,
  },
  {
    label: "a relative link that climbs out of the marketplace",
    plant: async (testContext, pluginRoot) => {
      const wrapped = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      await symlink(
        path.relative(path.dirname(wrapped), await outsideManifest(testContext)),
        wrapped,
      );
    },
    followed: false,
  },
  {
    label: "a link loop",
    plant: async (_testContext, pluginRoot) => {
      const wrapped = path.join(pluginRoot, ".claude-plugin", "plugin.json");
      await symlink(wrapped, wrapped);
    },
    followed: false,
  },
];

for (const { label, plant } of CATALOG_LINK_SHAPES.filter(({ followed }) => followed)) {
  test(`D-PL2-24: the catalog read follows ${label} to the file it names`, async (testContext) => {
    // arrange
    const { marketplaceRoot, pluginRoot } = await linkedCatalogPlugin(testContext);
    await plant(testContext, pluginRoot);

    // act
    const declaration = await readCatalogAlpha(marketplaceRoot, true);

    // assert
    assert.deepStrictEqual(declaration, dependsOn("linked"));
  });
}

for (const { label, plant } of CATALOG_LINK_SHAPES.filter(({ followed }) => !followed)) {
  test(`D-01-07 / D-PL2-24: the catalog read lets the entry answer for ${label}`, async (testContext) => {
    // arrange
    const { marketplaceRoot, pluginRoot } = await linkedCatalogPlugin(testContext);
    await plant(testContext, pluginRoot);

    // act
    const declaration = await readCatalogAlpha(marketplaceRoot, false);

    // assert
    assert.deepStrictEqual(declaration, dependsOn("entry"));
  });

  test(`D-05-07 / D-PL2-24: the refusing catalog read refuses ${label}`, async (testContext) => {
    // arrange
    const { marketplaceRoot, pluginRoot } = await linkedCatalogPlugin(testContext);
    await plant(testContext, pluginRoot);

    // act
    const declaration = await readCatalogAlpha(marketplaceRoot, true);

    // assert
    assert.deepStrictEqual(declaration, ownManifestRefusal());
  });
}

test("D-01-06: the catalog read passes a dangling wrapped link to the bare manifest", async (testContext) => {
  // arrange
  const { marketplaceRoot, pluginRoot } = await linkedCatalogPlugin(testContext);
  await symlink(
    path.join(pluginRoot, "missing.json"),
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
  );

  // act
  const declaration = await readCatalogAlpha(marketplaceRoot, true);

  // assert
  assert.deepStrictEqual(declaration, dependsOn("bare"));
});

/** A plugin-clones root beside, not under, the marketplace root. */
const CLONES_ROOT = path.join(tmpdir(), "dependency-declaration-read-clones");

const OWNER_ROOTS = { marketplaceRoot: MARKETPLACE_ROOT, pluginClonesDir: CLONES_ROOT };

/** `readInstalledCopyDeclaration` of a path record's `pluginRoot`, owned by the marketplace root. */
function readInstalledCopy(
  reader: RecordingReader,
  pluginRoot: string = PLUGIN_ROOT,
): ReturnType<typeof readInstalledCopyDeclaration> {
  return readInstalledCopyDeclaration({
    ...installedCopyReadOptions({ resolvedSource: pluginRoot }, OWNER_ROOTS),
    reader,
  });
}

/** The installed copy of a path record read in place from the marketplace tree at `root`. */
function readPathRecordCopy(
  pluginRoot: string,
  root: string,
): ReturnType<typeof readInstalledCopyDeclaration> {
  return readInstalledCopyDeclaration(
    installedCopyReadOptions(
      { resolvedSource: pluginRoot },
      { marketplaceRoot: root, pluginClonesDir: path.join(root, "unused-plugin-clones") },
    ),
  );
}

/** The installed copy of a record pinned to a commit, under the plugin clones at `root`. */
function readGitRecordCopy(
  pluginRoot: string,
  root: string,
): ReturnType<typeof readInstalledCopyDeclaration> {
  return readInstalledCopyDeclaration(
    installedCopyReadOptions(
      { resolvedSource: pluginRoot, resolvedSha: "0123456" },
      { marketplaceRoot: path.join(root, "unused-marketplace"), pluginClonesDir: root },
    ),
  );
}

test("D-PL2-12 / D-PL2-17: a record pinned to a commit is a copy owned by the scope's plugin clones", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/clones/alpha", resolvedSha: "0123456" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/clones" },
  );

  // assert
  assert.deepStrictEqual(options, {
    boundary: { pluginRoot: "/clones/alpha", roots: ["/clones/alpha"], label: "plugin directory" },
    ownerRoot: "/clones",
  });
});

test("D-PL2-12 / D-PL2-17: a record with no recorded commit is read in place, owned by its marketplace clone", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/mp/alpha" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/clones" },
  );

  // assert
  assert.deepStrictEqual(options, {
    boundary: {
      pluginRoot: "/mp/alpha",
      roots: ["/mp/alpha", "/mp"],
      label: "plugin directory and its marketplace directory",
    },
    ownerRoot: "/mp",
  });
});

test("D-PL2-23: a record pinned to a commit whose copy lies in its marketplace clone is read in place, owned by that clone", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/mp/alpha", resolvedSha: "0123456" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/clones" },
  );

  // assert
  assert.deepStrictEqual(options, {
    boundary: {
      pluginRoot: "/mp/alpha",
      roots: ["/mp/alpha", "/mp"],
      label: "plugin directory and its marketplace directory",
    },
    ownerRoot: "/mp",
  });
});

test("D-PL2-23: a pinned copy that is the parent of the plugin clones is not under them", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/mp", resolvedSha: "0123456" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/mp/clones" },
  );

  // assert
  assert.equal(options.ownerRoot, "/mp");
});

test("D-PL2-23: a pinned copy named with a leading double dot is under the plugin clones", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/clones/..alpha", resolvedSha: "0123456" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/clones" },
  );

  // assert
  assert.equal(options.ownerRoot, "/clones");
});

test("D-PL2-23: plugin clones nested in the marketplace clone own a pinned copy that lies under them", () => {
  // act
  const options = installedCopyReadOptions(
    { resolvedSource: "/mp/.pi/clones/alpha", resolvedSha: "0123456" },
    { marketplaceRoot: "/mp", pluginClonesDir: "/mp/.pi/clones" },
  );

  // assert
  assert.deepStrictEqual(options, {
    boundary: {
      pluginRoot: "/mp/.pi/clones/alpha",
      roots: ["/mp/.pi/clones/alpha"],
      label: "plugin directory",
    },
    ownerRoot: "/mp/.pi/clones",
  });
});

test("DLS-01: a delisted plugin's installed copy answers with its own manifest", async () => {
  // arrange
  const reader = buildReader({
    files: { [WRAPPED]: JSON.stringify({ dependencies: ["beta@mp"] }) },
  });

  // act
  const read = await readInstalledCopy(reader);

  // assert
  assert.deepStrictEqual(read, dependsOn("beta"));
});

test("DLS-01: an installed copy whose manifest has no dependencies key declares nothing", async () => {
  // arrange
  const reader = buildReader({ files: { [BARE]: JSON.stringify({ name: "alpha" }) } });

  // act
  const read = await readInstalledCopy(reader);

  // assert
  assert.deepStrictEqual(read, { kind: "found", dependencies: [] });
  assert.deepStrictEqual(reader.opened, [WRAPPED, BARE]);
});

test("DLS-01: an installed copy with no manifest answers absent", async () => {
  // arrange
  const reader = buildReader({});

  // act
  const read = await readInstalledCopy(reader);

  // assert
  assert.deepStrictEqual(read, { kind: "absent" });
});

test("D-05-07: an installed copy whose manifest is present but unusable is the fixed-detail refusal", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: "{ not json" } });

  // act
  const read = await readInstalledCopy(reader);

  // assert
  assert.deepStrictEqual(read, {
    kind: "unusable",
    detail: "its own manifest is present but cannot be read",
    ownManifest: true,
  });
});

test("RESV-02: an installed copy's rejected declaration is the unusable arm", async () => {
  // arrange
  const reader = buildReader({ files: { [WRAPPED]: JSON.stringify({ dependencies: "beta" }) } });

  // act
  const read = await readInstalledCopy(reader);

  // assert
  assert.equal(read.kind, "unusable");
  assert.ok(!("ownManifest" in read));
});

test("D-PL2-12 / NFR-10: an installed copy outside its owning root is the fixed-detail refusal, never opened", async () => {
  // arrange
  const reader = buildReader({});

  // act
  const read = await readInstalledCopy(reader, path.join(tmpdir(), "elsewhere", "alpha"));

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
  assert.deepStrictEqual(reader.opened, []);
});

test("D-PL2-12 / NFR-10: an installed copy under the other clone root is the fixed-detail refusal, never opened", async () => {
  // arrange
  const reader = buildReader({});

  // act
  const read = await readInstalledCopy(reader, path.join(CLONES_ROOT, "alpha"));

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
  assert.deepStrictEqual(reader.opened, []);
});

test("D-PL2-23 / NFR-10: a pinned copy under neither clone root is the fixed-detail refusal, never opened", async () => {
  // arrange
  const reader = buildReader({});

  // act
  const read = await readInstalledCopyDeclaration({
    ...installedCopyReadOptions(
      { resolvedSource: path.join(tmpdir(), "elsewhere", "alpha"), resolvedSha: "0123456" },
      OWNER_ROOTS,
    ),
    reader,
  });

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
  assert.deepStrictEqual(reader.opened, []);
});

test("DLS-01: a missing installed copy under its owning root answers absent", async (testContext) => {
  // arrange
  const root = await freshRoot(testContext, "installed-copy-missing-");

  // act
  const read = await readPathRecordCopy(path.join(root, "plugins", "gone"), root);

  // assert
  assert.deepStrictEqual(read, { kind: "absent" });
});

test("DLS-01: the production reader reads an installed copy off real disk", async (testContext) => {
  // arrange
  const root = await freshRoot(testContext, "installed-copy-read-");
  const pluginRoot = path.join(root, "plugins", "alpha");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ dependencies: ["beta@mp"] }),
  );

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("beta"));
});

/**
 * An installed copy on real disk under a fresh owning root: `real.json`
 * declares `linked@mp`, and the bare `plugin.json` declares `bare@mp`.
 */
async function linkedManifestCopy(
  testContext: TestContext,
): Promise<{ readonly root: string; readonly pluginRoot: string }> {
  const root = await freshRoot(testContext, "installed-copy-link-");
  const pluginRoot = path.join(root, "plugins", "alpha");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    path.join(pluginRoot, "real.json"),
    JSON.stringify({ dependencies: ["linked@mp"] }),
  );
  await writeFile(
    path.join(pluginRoot, "plugin.json"),
    JSON.stringify({ dependencies: ["bare@mp"] }),
  );
  return { root, pluginRoot };
}

/** The D-05-07 fixed-detail refusal an installed copy's unusable manifest answers. */
function ownManifestRefusal(): Awaited<ReturnType<typeof readInstalledCopyDeclaration>> {
  return {
    kind: "unusable",
    detail: "its own manifest is present but cannot be read",
    ownManifest: true,
  };
}

/** The wrapped manifest path of `pluginRoot`, made a link to `target` (the link text). */
async function linkWrappedManifest(pluginRoot: string, target: string): Promise<void> {
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await symlink(target, path.join(pluginRoot, ".claude-plugin", "plugin.json"));
}

/** A manifest outside any owning root, declaring `outside@mp`. */
async function outsideManifest(testContext: TestContext): Promise<string> {
  const outside = await freshRoot(testContext, "installed-copy-outside-");
  const manifest = path.join(outside, "plugin.json");
  await writeFile(manifest, JSON.stringify({ dependencies: ["outside@mp"] }));
  return manifest;
}

test("D-PL2-13: an installed copy whose manifest links to a file inside the plugin reads that file", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await linkWrappedManifest(pluginRoot, path.join(pluginRoot, "real.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("linked"));
});

test("D-PL2-13: an installed copy whose manifest directory links inside the plugin reads the manifest through it", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await mkdir(path.join(pluginRoot, "meta"));
  await writeFile(
    path.join(pluginRoot, "meta", "plugin.json"),
    JSON.stringify({ dependencies: ["linked@mp"] }),
  );
  await symlink(path.join(pluginRoot, "meta"), path.join(pluginRoot, ".claude-plugin"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("linked"));
});

test("D-PL2-13: an installed copy with no wrapped manifest reads a bare manifest that links inside the plugin", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await rm(path.join(pluginRoot, "plugin.json"));
  await symlink(path.join(pluginRoot, "real.json"), path.join(pluginRoot, "plugin.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("linked"));
});

test("D-PL2-13: an installed copy whose manifest links through a chain inside the plugin reads the last file", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await symlink("real.json", path.join(pluginRoot, "hop.json"));
  await linkWrappedManifest(pluginRoot, path.join(pluginRoot, "hop.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("linked"));
});

test("D-PL2-17: a path record read in place follows a manifest link into its marketplace directory", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await mkdir(path.join(root, "shared"));
  await writeFile(
    path.join(root, "shared", "plugin.json"),
    JSON.stringify({ dependencies: ["shared@mp"] }),
  );
  await linkWrappedManifest(pluginRoot, path.join(root, "shared", "plugin.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("shared"));
});

test("D-PL2-17: a git record's copy refuses a manifest link outside its plugin directory but inside the plugin clones", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await mkdir(path.join(root, "shared"));
  await writeFile(
    path.join(root, "shared", "plugin.json"),
    JSON.stringify({ dependencies: ["shared@mp"] }),
  );
  await linkWrappedManifest(pluginRoot, path.join(root, "shared", "plugin.json"));

  // act
  const read = await readGitRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-PL2-17: an installed copy whose manifest links outside its owning root is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await linkWrappedManifest(pluginRoot, await outsideManifest(testContext));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-PL2-17: an installed copy whose manifest links through a chain that leaves its owning root is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await symlink(await outsideManifest(testContext), path.join(pluginRoot, "hop.json"));
  await linkWrappedManifest(pluginRoot, path.join("..", "hop.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-PL2-17: an installed copy whose manifest directory links outside its owning root is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  const outside = path.dirname(await outsideManifest(testContext));
  await symlink(outside, path.join(pluginRoot, ".claude-plugin"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-PL2-17: an installed copy whose manifest link climbs out of its owning root by relative text is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  const outside = await outsideManifest(testContext);
  await linkWrappedManifest(
    pluginRoot,
    path.relative(path.join(pluginRoot, ".claude-plugin"), outside),
  );

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-PL2-17: an installed copy whose manifest link loops is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await linkWrappedManifest(pluginRoot, "plugin.json");

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, ownManifestRefusal());
});

test("D-01-06: an installed copy whose wrapped manifest link dangles reads its bare manifest", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await linkWrappedManifest(pluginRoot, path.join(pluginRoot, "missing.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("bare"));
});

test("D-01-06: an installed copy whose wrapped manifest link runs through a regular file reads its bare manifest", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await linkWrappedManifest(pluginRoot, path.join(pluginRoot, "real.json", "plugin.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("bare"));
});

test("D-PL2-13: an installed copy whose wrapped manifest is a regular file is read beside a symlink elsewhere", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await mkdir(path.join(pluginRoot, ".claude-plugin"));
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ dependencies: ["wrapped@mp"] }),
  );
  await symlink(path.join(pluginRoot, "real.json"), path.join(pluginRoot, "linked.json"));

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("wrapped"));
});

test("WR-03: an installed copy whose wrapped manifest path runs through a regular file reads its bare manifest", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await linkedManifestCopy(testContext);
  await writeFile(path.join(pluginRoot, ".claude-plugin"), "not a directory\n");

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("bare"));
});

/** One manifest link shape planted under a copy from `linkedManifestCopy`. */
interface CopyLinkShape {
  readonly label: string;
  readonly plant: (testContext: TestContext, pluginRoot: string) => Promise<void>;
  /** The `name@mp` the read declares, or `undefined` for the fixed-detail refusal. */
  readonly declares: string | undefined;
}

const COPY_LINK_SHAPES: readonly CopyLinkShape[] = [
  {
    label: "a direct link to a file in the plugin",
    plant: (_testContext, pluginRoot) =>
      linkWrappedManifest(pluginRoot, path.join(pluginRoot, "real.json")),
    declares: "linked",
  },
  {
    label: "a chain of links inside the plugin",
    plant: async (_testContext, pluginRoot) => {
      await symlink("real.json", path.join(pluginRoot, "hop.json"));
      await linkWrappedManifest(pluginRoot, path.join(pluginRoot, "hop.json"));
    },
    declares: "linked",
  },
  {
    label: "an absolute link outside every root",
    plant: async (testContext, pluginRoot) =>
      linkWrappedManifest(pluginRoot, await outsideManifest(testContext)),
    declares: undefined,
  },
  {
    label: "a relative link that climbs out of every root",
    plant: async (testContext, pluginRoot) =>
      linkWrappedManifest(
        pluginRoot,
        path.relative(path.join(pluginRoot, ".claude-plugin"), await outsideManifest(testContext)),
      ),
    declares: undefined,
  },
  {
    label: "a link loop",
    plant: (_testContext, pluginRoot) =>
      linkWrappedManifest(pluginRoot, path.join(pluginRoot, ".claude-plugin", "plugin.json")),
    declares: undefined,
  },
  {
    label: "a dangling link",
    plant: (_testContext, pluginRoot) =>
      linkWrappedManifest(pluginRoot, path.join(pluginRoot, "missing.json")),
    declares: "bare",
  },
];

/** What a read of a `linkedManifestCopy` answers for `declares`. */
function expectedCopyRead(
  declares: string | undefined,
): Awaited<ReturnType<typeof readInstalledCopyDeclaration>> {
  return declares === undefined ? ownManifestRefusal() : dependsOn(declares);
}

for (const { label, plant, declares } of COPY_LINK_SHAPES) {
  test(`D-PL2-17: a git record's copy reads ${label} inside its plugin directory boundary`, async (testContext) => {
    // arrange
    const { root, pluginRoot } = await linkedManifestCopy(testContext);
    await plant(testContext, pluginRoot);

    // act
    const read = await readGitRecordCopy(pluginRoot, root);

    // assert
    assert.deepStrictEqual(read, expectedCopyRead(declares));
  });

  test(`D-PL2-17: a path record's copy reads ${label} inside its in-place boundary`, async (testContext) => {
    // arrange
    const { root, pluginRoot } = await linkedManifestCopy(testContext);
    await plant(testContext, pluginRoot);

    // act
    const read = await readPathRecordCopy(pluginRoot, root);

    // assert
    assert.deepStrictEqual(read, expectedCopyRead(declares));
  });
}

/** The candidate read of a `linkedManifestCopy` tree read in place from `root`. */
function readInPlaceCandidate(pluginRoot: string, root: string): Promise<ClosureLookupResult> {
  return readCandidateDeclaration({
    pluginRoot,
    entry: entryWith("./plugins/alpha", ["entry@mp"]),
    marketplace: { marketplaceRoot: root },
    pin: undefined,
  });
}

for (const { label, plant, declares } of COPY_LINK_SHAPES) {
  test(`D-PL2-24: a candidate tree read in place answers ${label} by ${declares ?? "its entry"}`, async (testContext) => {
    // arrange
    const { root, pluginRoot } = await linkedManifestCopy(testContext);
    await plant(testContext, pluginRoot);

    // act
    const read = await readInPlaceCandidate(pluginRoot, root);

    // assert
    assert.deepStrictEqual(read, dependsOn(declares ?? "entry"));
  });
}

/** A `linkedManifestCopy` whose wrapped manifest links to a file in its marketplace directory. */
async function marketplaceLinkedCopy(
  testContext: TestContext,
): Promise<{ readonly root: string; readonly pluginRoot: string }> {
  const copy = await linkedManifestCopy(testContext);
  await writeFile(
    path.join(copy.root, "shared.json"),
    JSON.stringify({ dependencies: ["shared@mp"] }),
  );
  await linkWrappedManifest(copy.pluginRoot, path.join(copy.root, "shared.json"));
  return copy;
}

test("D-PL2-17: a path candidate read in place follows a link into its marketplace directory", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await marketplaceLinkedCopy(testContext);

  // act
  const read = await readInPlaceCandidate(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, dependsOn("shared"));
});

test("D-PL2-17: a tag-pinned path candidate is a copy, so its entry answers for that link", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await marketplaceLinkedCopy(testContext);

  // act
  const read = await readCandidateDeclaration({
    pluginRoot,
    entry: entryWith("./plugins/alpha", ["entry@mp"]),
    marketplace: { marketplaceRoot: root },
    pin: "2.0.0",
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("entry"));
});

test("D-PL2-17: a git candidate is a copy, so its entry answers for that link", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await marketplaceLinkedCopy(testContext);

  // act
  const read = await readCandidateDeclaration({
    pluginRoot,
    entry: entryWith({ source: "github", repo: "acme/alpha" }, ["entry@mp"]),
    marketplace: { marketplaceRoot: root },
    pin: undefined,
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("entry"));
});

test("D-PL2-17: a candidate with no marketplace record is a copy, so its entry answers for that link", async (testContext) => {
  // arrange
  const { pluginRoot } = await marketplaceLinkedCopy(testContext);

  // act
  const read = await readCandidateDeclaration({
    pluginRoot,
    entry: entryWith("./plugins/alpha", ["entry@mp"]),
    marketplace: undefined,
    pin: undefined,
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("entry"));
});

/**
 * An installed copy whose `.claude-plugin/` directory denies every access, so
 * a lookup inside it fails with EACCES. The permission comes back before the
 * tree is removed, in the same hook.
 */
async function deniedManifestDirectoryCopy(
  testContext: TestContext,
): Promise<{ readonly root: string; readonly pluginRoot: string }> {
  // A 0o000 directory stays readable for uid 0 with its default capabilities,
  // so the EACCES never happens.
  if (!(await chmodDeniesThisProcess())) {
    throw new Error(`a denied directory cannot deny this process. ${CHMOD_DENIAL_HINT}`);
  }

  const root = await mkdtemp(path.join(tmpdir(), "installed-copy-denied-"));
  const pluginRoot = path.join(root, "plugins", "alpha");
  const denied = path.join(pluginRoot, ".claude-plugin");
  testContext.after(async () => {
    await chmod(denied, 0o755);
    await rm(root, { recursive: true, force: true, maxRetries: 3 });
  });
  await mkdir(denied, { recursive: true });
  await writeFile(path.join(denied, "plugin.json"), JSON.stringify({ dependencies: ["x@mp"] }));
  await writeFile(
    path.join(pluginRoot, "plugin.json"),
    JSON.stringify({ dependencies: ["bare@mp"] }),
  );
  await chmod(denied, 0o000);
  return { root, pluginRoot };
}

test("WR-03 / D-05-07: an installed copy whose manifest directory cannot be inspected is the fixed-detail refusal", async (testContext) => {
  // arrange
  const { root, pluginRoot } = await deniedManifestDirectoryCopy(testContext);

  // act
  const read = await readPathRecordCopy(pluginRoot, root);

  // assert
  assert.deepStrictEqual(read, {
    kind: "unusable",
    detail: "its own manifest is present but cannot be read",
    ownManifest: true,
  });
});

test("WR-03 / D-05-07: an installed copy whose recorded root cannot be inspected is the fixed-detail refusal", async (testContext) => {
  // arrange
  const root = await freshRoot(testContext, "installed-copy-nul-");
  await mkdir(path.join(root, "plugins"));

  // act
  const read = await readPathRecordCopy(path.join(root, "plugins", "al\0pha"), root);

  // assert
  assert.deepStrictEqual(read, {
    kind: "unusable",
    detail: "its own manifest is present but cannot be read",
    ownManifest: true,
  });
});

test("UPD-DEP-D1: a resolved candidate's own manifest answers over its marketplace entry", async () => {
  // arrange
  const reader = buildReader({
    files: { [WRAPPED]: JSON.stringify({ dependencies: ["candidate@mp"] }) },
  });

  // act
  const read = await readCandidateDeclaration({
    pluginRoot: PLUGIN_ROOT,
    entry: entryWith("./alpha", ["head@mp"]),
    marketplace: { marketplaceRoot: MARKETPLACE_ROOT },
    pin: undefined,
    reader,
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("candidate"));
});

test("UPD-DEP-D1: a resolved candidate with no manifest is answered by its marketplace entry", async () => {
  // arrange
  const reader = buildReader({});

  // act
  const read = await readCandidateDeclaration({
    pluginRoot: PLUGIN_ROOT,
    entry: entryWith("./alpha", ["head@mp"]),
    marketplace: { marketplaceRoot: MARKETPLACE_ROOT },
    pin: undefined,
    reader,
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("head"));
  assert.deepStrictEqual(reader.opened, [WRAPPED, BARE]);
});

test("UPD-DEP-D1: the production reader reads a candidate's manifest off real disk", async (testContext) => {
  // arrange
  const root = await freshRoot(testContext, "dependency-declaration-read-candidate-");
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(root, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "alpha", dependencies: ["disk@mp"] }),
  );

  // act
  const read = await readCandidateDeclaration({
    pluginRoot: root,
    entry: entryWith("./alpha"),
    marketplace: undefined,
    pin: undefined,
  });

  // assert
  assert.deepStrictEqual(read, dependsOn("disk"));
});
