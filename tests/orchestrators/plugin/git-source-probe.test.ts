// tests/orchestrators/plugin/git-source-probe.test.ts
//
// RSTA-01 / RSTA-05 / RSTA-06 / D-80-02 / MIRR-05: unit coverage for the shared
// git-source probe module. `probeManifestEntry` classifies a not-installed
// git-source entry from fs-only clone/mirror presence: a COLD entry (nothing
// materialized) classifies `remote`; a WARM entry resolves three-way against the
// on-disk tree (`available` / `partially-available` / `unavailable`). A path
// entry with no on-disk tree folds to `unavailable`. `makePresenceProbe` is the
// fs-only warm-clone presence probe. Its PINNED arm derives from the per-sha
// clone dir (pinned + dir present -> materialized). Its UNPINNED arm (MIRR-05)
// derives from the URL-keyed mirror dir: a warm mirror -> materialized with the
// fs-read HEAD sha, a cold one -> not-cached. Neither arm touches the network
// (NFR-5).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import {
  pluginCloneKey,
  pluginMirrorKey,
} from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { resolveStrict } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
import {
  makePresenceProbe,
  probeManifestEntry,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type {
  GitHubSource,
  UrlSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const SHA = "1111111111111111111111111111111111111111";

type ManifestEntry = MarketplaceManifest["plugins"][number];

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "git-source-probe-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

void test("probeManifestEntry: a not-fetched url source with no clone classifies `remote` (RSTA-01)", async () => {
  const locations = await freshLocations();
  const entry: ManifestEntry = {
    name: "url-plugin",
    source: "https://example.com/plugin.git",
  };

  // marketplaceRoot points nowhere real -- the cold presence probe returns
  // `remote` before any resolveStrict/disk read against the marketplace root.
  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "remote");
});

void test("probeManifestEntry: a not-fetched github source with no clone classifies `remote` (RSTA-01)", async () => {
  const locations = await freshLocations();
  const entry: ManifestEntry = {
    name: "gh-plugin",
    source: "owner/repo",
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "remote");
});

void test("probeManifestEntry: a not-fetched git-subdir source with no clone classifies `remote` (RSTA-01)", async () => {
  const locations = await freshLocations();
  const entry: ManifestEntry = {
    name: "subdir-plugin",
    source: "https://example.com/repo.git#main:packages/plugin",
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "remote");
});

void test("probeManifestEntry: a WARM unpinned url source with a valid clone tree classifies `available` (RSTA-05)", async () => {
  const locations = await freshLocations();
  // Use a canonical url (no `.git` suffix) so the mirror key the test stages
  // matches the parse-time canonical url the presence probe hashes over.
  const cloneUrl = "https://example.com/plugin";

  // Stage a warm mirror carrying a minimal installable plugin so the presence
  // probe resolves `materialized` and resolveStrict validates the on-disk tree.
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "warm-plugin" }),
  );
  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDir, filepath: ".claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });

  const entry: ManifestEntry = { name: "warm-plugin", source: cloneUrl };
  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "available");
});

void test("probeManifestEntry: a WARM mirror with a corrupt git dir (missing .git/HEAD) folds to `unavailable` instead of throwing (MIRR-05)", async () => {
  const locations = await freshLocations();
  const cloneUrl = "https://example.com/plugin";

  // The mirror dir exists (so the presence pre-check is WARM) but its .git dir
  // carries no HEAD -- the fs-only HEAD read throws ENOENT. probeManifestEntry
  // must fold that throw to `unavailable` (one corrupt mirror degrades one
  // plugin) rather than letting it escape to the whole-marketplace catch.
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorDir, ".git"), { recursive: true });

  const entry: ManifestEntry = { name: "corrupt-mirror-plugin", source: cloneUrl };
  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "unavailable");
});

void test("probeManifestEntry: a WARM mirror whose HEAD ref resolves to no sha folds to `unavailable` instead of throwing (MIRR-05)", async () => {
  const locations = await freshLocations();
  const cloneUrl = "https://example.com/plugin";

  // HEAD names a branch, but the loose ref is absent and packed-refs does not
  // carry it either -- readMirrorHeadSha's no-sha arm throws. The probe must
  // fold to `unavailable`, not propagate.
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(path.join(mirrorDir, ".git"), { recursive: true });
  await writeFile(path.join(mirrorDir, ".git", "HEAD"), "ref: refs/heads/main\n");
  await writeFile(path.join(mirrorDir, ".git", "packed-refs"), "# pack-refs with: peeled\n");

  const entry: ManifestEntry = { name: "no-sha-mirror-plugin", source: cloneUrl };
  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "unavailable");
});

void test("probeManifestEntry: a path source with no on-disk tree folds to `unavailable`", async () => {
  const locations = await freshLocations();
  const entry: ManifestEntry = {
    name: "path-plugin",
    source: "./plugins/path-plugin",
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "unavailable");
});

void test("makePresenceProbe: an unpinned source with NO mirror dir returns not-cached (the cold-mirror arm)", async () => {
  const locations = await freshLocations();
  const probe = makePresenceProbe(locations);
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/plugin.git",
    url: "https://example.com/plugin.git",
  };

  const result = await probe(source);
  assert.equal(result.kind, "not-cached");
});

void test("makePresenceProbe: an unpinned source with a WARM mirror dir returns materialized with the fs-read HEAD sha (MIRR-05 inversion)", async () => {
  const locations = await freshLocations();
  const probe = makePresenceProbe(locations);
  const cloneUrl = "https://example.com/plugin.git";

  // Build a real git mirror at the URL-keyed mirror dir so the probe reads its
  // HEAD sha fs-only -- proving the unpinned arm no longer degrades to
  // not-cached when a warm mirror exists.
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
  await mkdir(mirrorDir, { recursive: true });
  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await writeFile(path.join(mirrorDir, "README.md"), "# mirror\n");
  await git.add({ fs, dir: mirrorDir, filepath: "README.md" });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
  const expectedSha = await git.resolveRef({ fs, dir: mirrorDir, ref: "HEAD" });

  const source: UrlSource = {
    kind: "url",
    raw: cloneUrl,
    url: cloneUrl,
  };

  const result = await probe(source);
  assert.equal(result.kind, "materialized");
  if (result.kind === "materialized") {
    assert.equal(result.pluginRoot, mirrorDir);
    assert.equal(result.resolvedSha, expectedSha);
    assert.match(result.resolvedSha, /^[0-9a-f]{40}$/);
  }
});

void test("makePresenceProbe: a pinned source resolves `materialized` when the clone dir exists on disk", async () => {
  const locations = await freshLocations();
  const probe = makePresenceProbe(locations);
  const cloneUrl = "https://github.com/owner/repo";
  const key = pluginCloneKey(cloneUrl, SHA);
  const cloneDir = await locations.pluginCloneDir(key);
  await mkdir(cloneDir, { recursive: true });

  const source: GitHubSource = {
    kind: "github",
    raw: "owner/repo",
    owner: "owner",
    repo: "repo",
    sha: SHA,
  };

  const result = await probe(source);
  assert.equal(result.kind, "materialized");
  if (result.kind === "materialized") {
    assert.equal(result.pluginRoot, cloneDir);
    assert.equal(result.resolvedSha, SHA);
  }
});

void test("makePresenceProbe: a pinned source whose clone dir is absent returns not-cached", async () => {
  const locations = await freshLocations();
  const probe = makePresenceProbe(locations);
  const source: UrlSource = {
    kind: "url",
    raw: "https://example.com/plugin.git",
    url: "https://example.com/plugin.git",
    sha: SHA,
  };

  const result = await probe(source);
  assert.equal(result.kind, "not-cached");
});

// RSTA-04 / RSTA-05 / NFR-10 / D-77-03: a warm git-subdir source resolves its
// pluginRoot at <clone>/<source.path> (the canva monorepo shape), not the clone
// root. Only the OBJECT-form source produces a git-subdir kind; the string form
// parses as a plain url, so it would not exercise the git-subdir arm at all.

const SUBDIR_URL = "https://example.com/monorepo";

void test("a warm git-subdir clone resolves its subdir components, not the empty monorepo root (RSTA-05 / D-77-03)", async () => {
  const locations = await freshLocations();
  const key = pluginCloneKey(SUBDIR_URL, SHA);
  const cloneDir = await locations.pluginCloneDir(key);

  // The subdir carries a real installable plugin; the monorepo ROOT deliberately
  // has no plugin.json and no component dirs, so a clone-root resolution would
  // yield the silently-empty `available` the fix removes.
  const subdir = path.join(cloneDir, "plugins", "canva");
  await mkdir(path.join(subdir, "skills", "canva-skill"), { recursive: true });
  await writeFile(
    path.join(subdir, ".mcp.json"),
    JSON.stringify({ mcpServers: { canva: { command: "canva-mcp" } } }),
  );

  const entry: ManifestEntry = {
    name: "canva",
    source: { source: "git-subdir", url: SUBDIR_URL, path: "plugins/canva", sha: SHA },
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "available");

  // The probe anchored the pluginRoot at the subdir: resolveStrict enumerates the
  // subdir's skill + mcp server rather than the empty clone root.
  const resolved = await resolveStrict(entry, {
    marketplaceRoot: "/nonexistent/mp/root",
    resolveGitPluginRoot: makePresenceProbe(locations),
  });
  assert.equal(resolved.state, "installable");
  if (resolved.state === "installable") {
    assert.ok(resolved.componentPaths.skills.length > 0, "subdir skills should resolve");
    assert.ok(Object.keys(resolved.mcpServers).length > 0, "subdir mcpServers should resolve");
  }
});

void test("a warm git-subdir clone whose declared path is absent classifies `unavailable`, never the monorepo root (NFR-10 / D-77-03)", async () => {
  const locations = await freshLocations();
  const key = pluginCloneKey(SUBDIR_URL, SHA);
  const cloneDir = await locations.pluginCloneDir(key);

  // The clone exists but the declared subdir does NOT -- the probe returns the
  // `missing-subdir` arm, which the resolver folds to `unavailable`.
  await mkdir(cloneDir, { recursive: true });

  const entry: ManifestEntry = {
    name: "canva",
    source: { source: "git-subdir", url: SUBDIR_URL, path: "plugins/canva", sha: SHA },
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "unavailable");
});

void test("a warm whole-repo url source still resolves `available` at the clone root (subdir fix is git-subdir-specific)", async () => {
  const locations = await freshLocations();
  const cloneUrl = "https://example.com/whole-repo";
  const key = pluginCloneKey(cloneUrl, SHA);
  const cloneDir = await locations.pluginCloneDir(key);

  // A whole-repo url plugin lives at the clone ROOT. The subdir-anchoring must
  // not double-append for non-subdir kinds -- the root must still resolve.
  await mkdir(path.join(cloneDir, "skills", "root-skill"), { recursive: true });
  await mkdir(path.join(cloneDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(cloneDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "whole-repo" }),
  );

  const entry: ManifestEntry = {
    name: "whole-repo",
    source: { source: "url", url: cloneUrl, sha: SHA },
  };

  const status = await probeManifestEntry(entry, "/nonexistent/mp/root", locations);
  assert.equal(status, "available");
});
