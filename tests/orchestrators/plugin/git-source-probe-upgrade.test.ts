// tests/orchestrators/plugin/git-source-probe-upgrade.test.ts
//
// PURL-08 / D-78-04 / CR-01: `probeUpgradeCandidate` resolves an upgrade
// candidate against the warm clone cache fs-only. A `resolveStrict` throw is
// the CR-01 probe-failure degrade -- the helper returns undefined so the
// caller renders the plain `(upgradable)` row instead of failing the list.

import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { probeUpgradeCandidate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

type ManifestEntry = MarketplaceManifest["plugins"][number];

async function freshLocations(): Promise<ScopedLocations> {
  const cwd = await mkdtemp(path.join(tmpdir(), "git-source-probe-upgrade-"));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return locations;
}

void test("probeUpgradeCandidate: a resolveStrict throw (unsafe entry name) degrades to undefined (CR-01)", async () => {
  const locations = await freshLocations();
  // A path-separator name makes resolveStrict's assertSafeName throw; the
  // CR-01 probe-failure degrade must swallow it and return undefined.
  const entry: ManifestEntry = {
    name: "../escape",
    source: "https://example.com/plugin",
  };

  const candidate = await probeUpgradeCandidate(entry, "/nonexistent/mp/root", locations);
  assert.equal(candidate, undefined);
});

void test("probeUpgradeCandidate: a COLD git source resolves (not thrown) -- the cold arm folds inside resolveStrict", async () => {
  const locations = await freshLocations();
  const entry: ManifestEntry = {
    name: "cold-plugin",
    source: "https://example.com/cold-plugin",
  };

  // Cold cache: the presence probe yields `not-cached`, which the resolver
  // maps to `unavailable{not installed}` -- a RESOLVED value, not a throw.
  const candidate = await probeUpgradeCandidate(entry, "/nonexistent/mp/root", locations);
  assert.ok(candidate !== undefined);
  assert.equal(candidate.state, "unavailable");
});
