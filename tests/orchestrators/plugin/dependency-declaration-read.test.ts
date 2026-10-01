import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { readDependencyDeclaration } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

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
