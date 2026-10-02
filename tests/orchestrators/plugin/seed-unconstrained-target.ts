// tests/orchestrators/plugin/seed-unconstrained-target.ts
//
// SC3: the on-disk marketplace both unconstrained-regression proofs run
// against -- the manual cascade's (`update-cascade.test.ts`) and the
// autoupdate cascade's (`marketplace/update.messaging.test.ts`). One seed,
// so a change to the manifest shape cannot make the two "identical" proofs
// drift apart.
//
// "alpha" is the target. A second installed plugin, "beta", declares
// something else entirely ("gamma"), so the declaration walk genuinely runs
// and returns an empty holder set for "alpha": the gate itself decides
// "alpha" is unconstrained, rather than a canned verdict standing in for it.
//
// The state document is written to disk because the cases drive
// `preparePluginUpdate`, which loads it. "alpha" resolves to version 1.1.0
// on disk against a recorded 1.0.0, so the preflight returns a prepared
// update rather than an `unchanged` verdict.

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type PluginStateRecord = ExtensionState["marketplaces"][string]["plugins"][string];

function installedRecord(resolvedSource: string): PluginStateRecord {
  return {
    version: "1.0.0",
    resolvedSource,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { workflows: [], skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export interface UnconstrainedTargetSeed {
  readonly cwd: string;
  readonly locations: ScopedLocations;
}

export async function seedUnconstrainedTarget(prefix: string): Promise<UnconstrainedTargetSeed> {
  const cwd = await mkdtemp(path.join(tmpdir(), prefix));
  const marketplaceRoot = path.join(cwd, "mp");
  const alphaRoot = path.join(marketplaceRoot, "plugins", "alpha");
  const betaRoot = path.join(marketplaceRoot, "plugins", "beta");
  for (const [root, manifest] of [
    [alphaRoot, { name: "alpha", version: "1.1.0" }],
    [betaRoot, { name: "beta", version: "1.0.0", dependencies: ["gamma"] }],
  ] as const) {
    await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
    await writeFile(path.join(root, ".claude-plugin", "plugin.json"), JSON.stringify(manifest));
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [
        { name: "alpha", source: "./plugins/alpha" },
        { name: "beta", source: "./plugins/beta", dependencies: ["gamma"] },
      ],
    }),
  );

  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: { alpha: installedRecord(alphaRoot), beta: installedRecord(betaRoot) },
      },
    },
  });
  return { cwd, locations };
}
