// tests/orchestrators/plugin/clone-cache-defaults.test.ts
//
// The clone-cache seam's DEFAULT_GIT_OPS fallback (`args.gitOps ??
// DEFAULT_GIT_OPS`), exercised on the two arms that stay OFFLINE against the
// real default git surface:
//   - PURL-02: a warm cache short-circuits before any git primitive fires;
//   - D-77-04: a pinned sha wins outright, so resolvePluginPin never calls
//     resolveRemoteRef.
// Both stay network-free by construction, so omitting the injected mock is
// safe here (the clone/fetch paths keep their mock-injected coverage in
// clone-cache.test.ts).

import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pluginCloneKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { UrlSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

const PIN_40 = "1234567890abcdef1234567890abcdef12345678";

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "clone-cache-defaults-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

void test("PURL-02: a warm cache with NO injected gitOps returns the clone root offline (default git surface untouched)", async () => {
  const locations = await freshLocations();
  const cloneUrl = "https://example.com/warm-default";
  const cloneRoot = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, PIN_40));
  await mkdir(cloneRoot, { recursive: true });

  // Omitting gitOps exercises the DEFAULT_GIT_OPS fallback; the warm-cache
  // short-circuit returns before any git primitive fires, so the call stays
  // offline (PURL-02) even against the real default surface.
  const got = await materializePluginClone({ locations, cloneUrl, pin: PIN_40 });

  assert.equal(got, cloneRoot);
});

void test("D-77-04: a pinned source with NO injected gitOps resolves its sha as the pin without any git call", async () => {
  // source.sha wins outright -- resolvePluginPin never touches the git
  // surface on the pinned arm, so the DEFAULT_GIT_OPS fallback is safe to
  // exercise offline (sha over ref, no resolveRemoteRef).
  const source: UrlSource = {
    kind: "url",
    raw: `https://example.com/pinned.git#${PIN_40}`,
    url: "https://example.com/pinned",
    sha: PIN_40,
  };

  const got = await resolvePluginPin({ source });

  assert.deepEqual(got, { cloneUrl: "https://example.com/pinned", pin: PIN_40 });
});
