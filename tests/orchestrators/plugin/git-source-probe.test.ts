// tests/orchestrators/plugin/git-source-probe.test.ts
//
// Direct owner for the filesystem-only git source probe. Every case stages a
// fresh local tree; no Git process, Git library, or network collaborator is
// present in this suite.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  makePresenceProbe,
  probeManifestEntry,
  probeUpgradeCandidate,
  readMirrorHeadSha,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type {
  GitHubSource,
  GitSubdirSource,
  UrlSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { ManifestEntry } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const SHA_A = "1111111111111111111111111111111111111111";
const SHA_B = "2222222222222222222222222222222222222222";
const SUBDIR_URL = "https://example.com/monorepo";

async function cloneDirectory(
  locations: ScopedLocations,
  cloneUrl: string,
  sha: string,
): Promise<string> {
  const cloneDir = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, sha));
  await mkdir(cloneDir, { recursive: true });
  return cloneDir;
}

function errorCode(error: unknown): unknown {
  return typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
}

function errorPath(error: unknown): unknown {
  return typeof error === "object" && error !== null && "path" in error ? error.path : undefined;
}

async function freshDirectory(testContext: TestContext, prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  testContext.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function freshLocations(
  testContext: TestContext,
): Promise<{ locations: ScopedLocations; marketplaceRoot: string }> {
  const marketplaceRoot = await freshDirectory(testContext, "git-source-probe-");
  const locations = locationsFor("project", marketplaceRoot);
  await mkdir(locations.extensionRoot, { recursive: true });
  return { locations, marketplaceRoot };
}

async function mirrorDirectory(locations: ScopedLocations, cloneUrl: string): Promise<string> {
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(mirrorDir, { recursive: true });
  return mirrorDir;
}

async function writeDetachedHead(mirrorDir: string, sha: string): Promise<void> {
  await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
  await writeFile(path.join(mirrorDir, ".git", "HEAD"), `${sha}\n`);
}

async function writeLooseHead(mirrorDir: string, refPath: string, sha: string): Promise<void> {
  await mkdir(path.dirname(path.join(mirrorDir, ".git", refPath)), { recursive: true });
  await writeFile(path.join(mirrorDir, ".git", "HEAD"), `ref: ${refPath}\n`);
  await writeFile(path.join(mirrorDir, ".git", refPath), `${sha}\n`);
}

describe("makePresenceProbe", () => {
  test("returns escapes for a pinned git-subdir outside its clone", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const cloneDir = await cloneDirectory(locations, SUBDIR_URL, SHA_A);
    const probe = makePresenceProbe(locations);
    const source: GitSubdirSource = {
      kind: "git-subdir",
      raw: `${SUBDIR_URL}#main:../escape`,
      url: SUBDIR_URL,
      path: "../escape",
      sha: SHA_A,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "escapes",
      detail: `git-subdir path "../escape" escapes ${cloneDir} (resolved: ${path.resolve(cloneDir, "../escape")}).`,
    });
  });

  test("returns materialized for a pinned GitHub clone", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const cloneUrl = "https://github.com/owner/repo";
    const cloneDir = await cloneDirectory(locations, cloneUrl, SHA_A);
    const probe = makePresenceProbe(locations);
    const source: GitHubSource = {
      kind: "github",
      raw: "owner/repo",
      owner: "owner",
      repo: "repo",
      sha: SHA_A,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "materialized",
      pluginRoot: cloneDir,
      resolvedSha: SHA_A,
    });
  });

  test("returns materialized for a pinned git-subdir", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const cloneDir = await cloneDirectory(locations, SUBDIR_URL, SHA_A);
    const pluginRoot = path.join(cloneDir, "plugins", "canva");
    await mkdir(pluginRoot, { recursive: true });
    const probe = makePresenceProbe(locations);
    const source: GitSubdirSource = {
      kind: "git-subdir",
      raw: `${SUBDIR_URL}#main:plugins/canva`,
      url: SUBDIR_URL,
      path: "plugins/canva",
      sha: SHA_A,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "materialized",
      pluginRoot,
      resolvedSha: SHA_A,
    });
  });

  test("returns materialized for an unpinned warm mirror", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/warm-plugin";
    const mirrorDir = await mirrorDirectory(locations, cloneUrl);
    await writeDetachedHead(mirrorDir, SHA_B);
    const probe = makePresenceProbe(locations);
    const source: UrlSource = {
      kind: "url",
      raw: cloneUrl,
      url: cloneUrl,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "materialized",
      pluginRoot: mirrorDir,
      resolvedSha: SHA_B,
    });
  });

  test("returns materialized for an unpinned warm subdir mirror", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const mirrorDir = await mirrorDirectory(locations, SUBDIR_URL);
    const pluginRoot = path.join(mirrorDir, "plugins", "canva");
    await mkdir(pluginRoot, { recursive: true });
    await writeDetachedHead(mirrorDir, SHA_B);
    const probe = makePresenceProbe(locations);
    const source: GitSubdirSource = {
      kind: "git-subdir",
      raw: `${SUBDIR_URL}#main:plugins/canva`,
      url: SUBDIR_URL,
      path: "plugins/canva",
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "materialized",
      pluginRoot,
      resolvedSha: SHA_B,
    });
  });

  test("returns missing-subdir for a pinned clone without its declared path", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    await cloneDirectory(locations, SUBDIR_URL, SHA_A);
    const probe = makePresenceProbe(locations);
    const source: GitSubdirSource = {
      kind: "git-subdir",
      raw: `${SUBDIR_URL}#main:plugins/missing`,
      url: SUBDIR_URL,
      path: "plugins/missing",
      sha: SHA_A,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, {
      kind: "missing-subdir",
      detail: 'git-subdir path "plugins/missing" does not exist in the plugin clone',
    });
  });

  test("returns not-cached for a pinned cold clone", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const probe = makePresenceProbe(locations);
    const source: UrlSource = {
      kind: "url",
      raw: "https://example.com/cold-pinned-plugin",
      url: "https://example.com/cold-pinned-plugin",
      sha: SHA_A,
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, { kind: "not-cached" });
  });

  test("returns not-cached for an unpinned cold mirror", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const probe = makePresenceProbe(locations);
    const source: UrlSource = {
      kind: "url",
      raw: "https://example.com/cold-unpinned-plugin",
      url: "https://example.com/cold-unpinned-plugin",
    };

    // act
    const result = await probe(source);

    // assert
    assert.deepStrictEqual(result, { kind: "not-cached" });
  });

  test("throws when an unpinned warm mirror has no HEAD", async (testContext) => {
    // arrange
    const { locations } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/corrupt-warm-plugin";
    const mirrorDir = await mirrorDirectory(locations, cloneUrl);
    await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
    const probe = makePresenceProbe(locations);
    const source: UrlSource = { kind: "url", raw: cloneUrl, url: cloneUrl };
    let failure: unknown;

    // act
    try {
      await probe(source);
    } catch (error) {
      failure = error;
    }

    // assert
    assert.equal(errorCode(failure), "ENOENT");
    assert.equal(errorPath(failure), path.join(mirrorDir, ".git", "HEAD"));
  });
});

describe("probeManifestEntry", () => {
  test("classifies a cold GitHub entry as remote", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = { name: "github-plugin", source: "owner/repo" };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "remote");
  });

  test("classifies a cold git-subdir entry as remote", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = {
      name: "subdir-plugin",
      source: { source: "git-subdir", url: SUBDIR_URL, path: "plugins/canva" },
    };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "remote");
  });

  test("classifies a cold URL entry as remote", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = {
      name: "url-plugin",
      source: "https://example.com/url-plugin",
    };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "remote");
  });

  test("classifies a missing path entry as unavailable", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = { name: "missing-path", source: "./plugins/missing" };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "unavailable");
  });

  test("classifies an existing path entry as available", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    await mkdir(path.join(marketplaceRoot, "plugins", "path-plugin"), { recursive: true });
    const entry: ManifestEntry = { name: "path-plugin", source: "./plugins/path-plugin" };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "available");
  });

  test("classifies an unsafe path entry name as unavailable", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    await mkdir(path.join(marketplaceRoot, "plugins", "unsafe"), { recursive: true });
    const entry: ManifestEntry = { name: "../escape", source: "./plugins/unsafe" };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "unavailable");
  });

  test("classifies a warm corrupt mirror as unavailable", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/corrupt-manifest-plugin";
    const mirrorDir = await mirrorDirectory(locations, cloneUrl);
    await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
    const entry: ManifestEntry = { name: "corrupt-plugin", source: cloneUrl };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "unavailable");
  });

  test("classifies a warm installable git entry as available", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/available-plugin";
    await cloneDirectory(locations, cloneUrl, SHA_A);
    const entry: ManifestEntry = {
      name: "available-plugin",
      source: { source: "url", url: cloneUrl, sha: SHA_A },
    };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "available");
  });

  test("classifies a warm missing git-subdir as unavailable", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    await cloneDirectory(locations, SUBDIR_URL, SHA_A);
    const entry: ManifestEntry = {
      name: "missing-subdir",
      source: {
        source: "git-subdir",
        url: SUBDIR_URL,
        path: "plugins/missing",
        sha: SHA_A,
      },
    };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "unavailable");
  });

  test("classifies a warm partially available git entry", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/partial-plugin";
    await cloneDirectory(locations, cloneUrl, SHA_A);
    const entry: ManifestEntry = {
      name: "partial-plugin",
      source: { source: "url", url: cloneUrl, sha: SHA_A },
      themes: ["dark"],
    };

    // act
    const result = await probeManifestEntry(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, "partially-available");
  });
});

describe("probeUpgradeCandidate", () => {
  test("returns a complete unavailable candidate for a cold git entry", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = {
      name: "cold-upgrade",
      source: "https://example.com/cold-upgrade",
      version: "2.0.0",
    };

    // act
    const result = await probeUpgradeCandidate(entry, marketplaceRoot, locations);

    // assert
    assert.deepStrictEqual(result, {
      state: "unavailable",
      installable: false,
      name: "cold-upgrade",
      notes: ["not installed"],
    });
  });

  test("returns a complete warm candidate for a newer entry", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/newer-upgrade";
    const cloneDir = await cloneDirectory(locations, cloneUrl, SHA_B);
    const entry: ManifestEntry = {
      name: "newer-upgrade",
      source: { source: "url", url: cloneUrl, sha: SHA_B },
      version: "2.0.0",
      themes: ["dark"],
    };

    // act
    const result = await probeUpgradeCandidate(entry, marketplaceRoot, locations);

    // assert
    assert.deepStrictEqual(result, {
      state: "partially-available",
      installable: true,
      name: "newer-upgrade",
      pluginRoot: cloneDir,
      supported: [],
      unsupported: ["themes"],
      notes: ["contains themes"],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    });
  });

  test("returns a complete warm candidate for a same-version entry", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/same-version-upgrade";
    const cloneDir = await cloneDirectory(locations, cloneUrl, SHA_A);
    const entry: ManifestEntry = {
      name: "same-version-upgrade",
      source: { source: "url", url: cloneUrl, sha: SHA_A },
      version: "1.0.0",
    };

    // act
    const result = await probeUpgradeCandidate(entry, marketplaceRoot, locations);

    // assert
    assert.deepStrictEqual(result, {
      state: "installable",
      installable: true,
      name: "same-version-upgrade",
      pluginRoot: cloneDir,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    });
  });

  test("returns undefined when the presence probe fails", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const cloneUrl = "https://example.com/corrupt-upgrade";
    const mirrorDir = await mirrorDirectory(locations, cloneUrl);
    await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
    const entry: ManifestEntry = { name: "corrupt-upgrade", source: cloneUrl };

    // act
    const result = await probeUpgradeCandidate(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, undefined);
  });

  test("returns undefined when resolution rejects an unsafe entry name", async (testContext) => {
    // arrange
    const { locations, marketplaceRoot } = await freshLocations(testContext);
    const entry: ManifestEntry = {
      name: "../escape",
      source: "https://example.com/unsafe-upgrade",
    };

    // act
    const result = await probeUpgradeCandidate(entry, marketplaceRoot, locations);

    // assert
    assert.equal(result, undefined);
  });
});

describe("readMirrorHeadSha", () => {
  test("propagates an absent HEAD error", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-absent-");
    await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
    let failure: unknown;

    // act
    try {
      await readMirrorHeadSha(mirrorDir);
    } catch (error) {
      failure = error;
    }

    // assert
    assert.equal(errorCode(failure), "ENOENT");
    assert.equal(errorPath(failure), path.join(mirrorDir, ".git", "HEAD"));
  });

  test("propagates an absent packed-refs error", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-packed-absent-");
    await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
    await writeFile(path.join(mirrorDir, ".git", "HEAD"), "ref: refs/heads/main\n");
    let failure: unknown;

    // act
    try {
      await readMirrorHeadSha(mirrorDir);
    } catch (error) {
      failure = error;
    }

    // assert
    assert.equal(errorCode(failure), "ENOENT");
    assert.equal(errorPath(failure), path.join(mirrorDir, ".git", "packed-refs"));
  });

  test("propagates an unreadable loose ref", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-unreadable-");
    const looseRef = path.join(mirrorDir, ".git", "refs", "heads", "main");
    await mkdir(looseRef, { recursive: true });
    await writeFile(path.join(mirrorDir, ".git", "HEAD"), "ref: refs/heads/main\n");
    let failure: unknown;

    // act
    try {
      await readMirrorHeadSha(mirrorDir);
    } catch (error) {
      failure = error;
    }

    // assert
    assert.equal(errorCode(failure), "EISDIR");
  });

  test("returns a detached HEAD value verbatim after trimming", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-detached-");
    await writeDetachedHead(mirrorDir, SHA_A);

    // act
    const result = await readMirrorHeadSha(mirrorDir);

    // assert
    assert.equal(result, SHA_A);
  });

  test("returns a malformed detached HEAD value without validation", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-malformed-");
    await writeDetachedHead(mirrorDir, "not-a-sha");

    // act
    const result = await readMirrorHeadSha(mirrorDir);

    // assert
    assert.equal(result, "not-a-sha");
  });

  test("returns a loose symbolic ref after trimming", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-loose-");
    await writeLooseHead(mirrorDir, "refs/heads/main", SHA_A);

    // act
    const result = await readMirrorHeadSha(mirrorDir);

    // assert
    assert.equal(result, SHA_A);
  });

  test("returns a packed symbolic ref while ignoring comments and peeled refs", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-packed-");
    const gitDir = path.join(mirrorDir, ".git");
    await mkdir(gitDir, { recursive: true });
    await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
    await writeFile(
      path.join(gitDir, "packed-refs"),
      [
        "# pack-refs with: peeled fully-peeled sorted",
        `${SHA_A} refs/tags/v1.0.0`,
        `^${SHA_B}`,
        `${SHA_B} refs/heads/main`,
        "",
      ].join("\n"),
    );

    // act
    const result = await readMirrorHeadSha(mirrorDir);

    // assert
    assert.equal(result, SHA_B);
  });

  test("throws the exact no-sha error when packed refs omit HEAD", async (testContext) => {
    // arrange
    const mirrorDir = await freshDirectory(testContext, "mirror-head-no-sha-");
    const gitDir = path.join(mirrorDir, ".git");
    await mkdir(gitDir, { recursive: true });
    await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
    await writeFile(
      path.join(gitDir, "packed-refs"),
      ["# pack-refs with: peeled", `${SHA_A} refs/tags/v1.0.0`, `^${SHA_B}`, ""].join("\n"),
    );
    let failure: unknown;

    // act
    try {
      await readMirrorHeadSha(mirrorDir);
    } catch (error) {
      failure = error;
    }

    // assert
    assert.equal(failure instanceof Error, true);
    assert.equal(
      failure instanceof Error ? failure.message : undefined,
      `mirror HEAD ref "refs/heads/main" resolved to no sha in ${mirrorDir}`,
    );
  });
});
