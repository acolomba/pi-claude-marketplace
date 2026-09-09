import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import * as git from "isomorphic-git";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  composeCandidateListRow,
  type CandidateRow,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { ManifestPluginEntry } from "../../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

type ComposeCandidateListRow = (
  manifestEntry: ManifestPluginEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
  declaredEnabled: boolean | undefined,
) => Promise<CandidateRow>;

function loadComposeCandidateListRow(): ComposeCandidateListRow {
  return composeCandidateListRow;
}

async function candidateEnvironment(testContext: TestContext): Promise<{
  readonly cwd: string;
  readonly marketplaceRoot: string;
  readonly locations: ScopedLocations;
}> {
  const environment = await createHermeticEnvironment(testContext, "list-candidate-row-");
  const marketplaceRoot = path.join(environment.cwd, "marketplace");
  await mkdir(marketplaceRoot, { recursive: true });
  return {
    cwd: environment.cwd,
    marketplaceRoot,
    locations: locationsFor("project", environment.cwd),
  };
}

test("composes the complete available candidate projection", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"));
  const entry: ManifestPluginEntry = {
    name: "alpha",
    source: "./alpha",
    version: "1.0.0",
    description: "Alpha plugin.",
  };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    undefined,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: {
      status: "available",
      name: "alpha",
      version: "1.0.0",
      description: "Alpha plugin.",
    },
    bucket: "available",
  });
});

test("appends installs-disabled to a partially available row", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"));
  const entry: ManifestPluginEntry = {
    name: "alpha",
    source: "./alpha",
    lspServers: { alpha: {} },
    defaultEnabled: false,
  };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    undefined,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: {
      status: "partially-available",
      name: "alpha",
      reasons: ["lsp", "installs disabled"],
    },
    bucket: "partially-available",
  });
});

test("keeps a user-enabled partial row free of the author default", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  await mkdir(path.join(environment.marketplaceRoot, "alpha"));
  const entry: ManifestPluginEntry = {
    name: "alpha",
    source: "./alpha",
    lspServers: { alpha: {} },
    defaultEnabled: false,
  };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    true,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: {
      status: "partially-available",
      name: "alpha",
      reasons: ["lsp"],
    },
    bucket: "partially-available",
  });
});

test("composes structural unavailability without an installs-disabled claim", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  const entry: ManifestPluginEntry = {
    name: "missing",
    source: "./missing",
    defaultEnabled: false,
  };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    undefined,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: {
      status: "unavailable",
      name: "missing",
      reasons: ["unsupported source"],
    },
    bucket: "unavailable",
  });
});

test("classifies a thrown candidate probe without leaking the error", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  const entry: ManifestPluginEntry = { name: "bad/name", source: "./bad" };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    undefined,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: {
      status: "unavailable",
      name: "bad/name",
      reasons: ["unreadable"],
    },
    bucket: "unavailable",
  });
});

test("resolves a warm git mirror into an available row", async (testContext) => {
  // arrange
  const composeCandidateListRow = await loadComposeCandidateListRow();
  const environment = await candidateEnvironment(testContext);
  const canonicalUrl = "https://example.com/warm-plugin";
  const mirrorDirectory = await environment.locations.pluginCloneDir(pluginMirrorKey(canonicalUrl));
  await mkdir(path.join(mirrorDirectory, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDirectory, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "warm-plugin" }),
  );
  await git.init({ fs, dir: mirrorDirectory, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDirectory, filepath: ".claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: mirrorDirectory,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
  const entry: ManifestPluginEntry = { name: "warm-plugin", source: canonicalUrl };

  // act
  const row = await composeCandidateListRow(
    entry,
    environment.marketplaceRoot,
    environment.locations,
    undefined,
  );

  // assert
  assert.deepStrictEqual(row, {
    message: { status: "available", name: "warm-plugin" },
    bucket: "available",
  });
});

const COLD_GIT_ENTRIES: readonly ManifestPluginEntry[] = [
  {
    name: "url-plugin",
    source: "https://example.com/url-plugin.git",
    version: "1.0.0",
    defaultEnabled: false,
  },
  { name: "github-plugin", source: { source: "github", repo: "owner/repo" } },
  {
    name: "subdir-plugin",
    source: { source: "git-subdir", url: "https://example.com/repo.git", path: "plugins/sub" },
  },
];

for (const entry of COLD_GIT_ENTRIES) {
  test(`composes a cold ${entry.name} row without materializing it`, async (testContext) => {
    // arrange
    const composeCandidateListRow = await loadComposeCandidateListRow();
    const environment = await candidateEnvironment(testContext);

    // act
    const row = await composeCandidateListRow(
      entry,
      environment.marketplaceRoot,
      environment.locations,
      undefined,
    );

    // assert
    assert.deepStrictEqual(row, {
      message: {
        status: "remote",
        name: entry.name,
        ...(entry.version !== undefined && { version: entry.version }),
        ...(entry.defaultEnabled === false && { reasons: ["installs disabled"] }),
      },
      bucket: "remote",
    });
  });
}
