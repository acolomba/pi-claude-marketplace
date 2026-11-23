/**
 * Seeds the URL-keyed mirror the fs-only presence probe reads, so a list row
 * test can resolve a warm git tree offline (VER-01, NFR-5).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { gitTestCheckout, initGitTestCheckout } from "../../platform/git-test-repository.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

/**
 * Creates a mirror for `canonicalUrl` with one commit. The commit holds
 * `.claude-plugin/plugin.json` with `manifest`, or only a README when
 * `manifest` is undefined. Returns the mirror dir and its HEAD commit.
 */
export async function seedWarmMirror(
  locations: ScopedLocations,
  canonicalUrl: string,
  manifest: object | undefined,
): Promise<{ readonly mirrorDirectory: string; readonly head: string }> {
  const mirrorDirectory = await locations.pluginCloneDir(pluginMirrorKey(canonicalUrl));
  const filepath = manifest === undefined ? "README.md" : ".claude-plugin/plugin.json";
  await mkdir(path.dirname(path.join(mirrorDirectory, filepath)), { recursive: true });
  await writeFile(
    path.join(mirrorDirectory, filepath),
    manifest === undefined ? "no plugins here" : JSON.stringify(manifest),
  );
  const checkout = await initGitTestCheckout(mirrorDirectory);
  const head = await checkout.commitPaths("initial", [filepath]);
  return { mirrorDirectory, head };
}

/** Adds a second commit to a seeded mirror and returns its new HEAD commit. */
export async function advanceWarmMirror(mirrorDirectory: string): Promise<string> {
  await writeFile(path.join(mirrorDirectory, "CHANGELOG.md"), "a newer revision");
  return gitTestCheckout(mirrorDirectory).commitPaths("newer", ["CHANGELOG.md"]);
}
