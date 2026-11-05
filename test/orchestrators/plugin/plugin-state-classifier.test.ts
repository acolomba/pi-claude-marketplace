import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  candidateFor,
  classifyInstalledRecord,
  classifyManifestEntry,
  type InstalledClassification,
  type InstalledRecordLike,
  type ManifestEntryClassification,
  type UpgradeCandidate,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts";

import type { ActiveMcpImplementation } from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { ResolvedPlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

void ("partially-installed-upgradable" satisfies InstalledClassification);
void ("remote" satisfies ManifestEntryClassification);

// @ts-expect-error disabled is rendered by the list caller, not this classifier
const foreignInstalledStatus: InstalledClassification = "disabled";
void foreignInstalledStatus;

// @ts-expect-error a non-upgradable candidate cannot carry a resolution
const invalidSameCandidate: UpgradeCandidate = { upgradable: false, resolved: undefined };
void invalidSameCandidate;

const invalidRemoteResolution: ResolvedPlugin = {
  // @ts-expect-error remote is a probe classification, not a resolver state
  state: "remote",
  installable: false,
  name: "remote-plugin",
  notes: [],
};
void invalidRemoteResolution;

function installedRecord(enabled: boolean, unsupported: readonly string[]): InstalledRecordLike {
  return {
    enabled,
    compatibility: { unsupported: [...unsupported] },
  };
}

function installableResolution(name: string): ResolvedPlugin {
  return {
    state: "installable",
    installable: true,
    name,
    pluginRoot: `/plugins/${name}`,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
    mcpServers: {},
    declaredMcpServers: {},
    defaultEnabled: true,
  };
}

function partiallyAvailableResolution(name: string): ResolvedPlugin {
  return {
    state: "partially-available",
    installable: true,
    name,
    pluginRoot: `/plugins/${name}`,
    supported: ["skills"],
    unsupported: ["lspServers"],
    notes: ["contains lspServers"],
    componentPaths: { skills: ["skills/commit"], commands: [], agents: [], workflows: [] },
    mcpServers: {},
    declaredMcpServers: {},
    defaultEnabled: true,
  };
}

function unavailableResolution(name: string): ResolvedPlugin {
  return {
    state: "unavailable",
    installable: false,
    name,
    notes: ["source dir does not exist"],
  };
}

interface InstalledCase {
  readonly name: string;
  readonly persisted: () => InstalledRecordLike;
  readonly candidate: () => UpgradeCandidate;
  readonly status: InstalledClassification;
}

const installedCases: readonly InstalledCase[] = [
  {
    name: "freezes a disabled clean record without a newer candidate as installed",
    persisted: () => installedRecord(false, []),
    candidate: () => ({ upgradable: false }),
    status: "installed",
  },
  {
    name: "freezes a disabled degraded record before the partial-candidate split",
    persisted: () => installedRecord(false, ["lspServers"]),
    candidate: () => ({
      upgradable: true,
      resolved: partiallyAvailableResolution("disabled-partial"),
    }),
    status: "installed",
  },
  {
    name: "keeps an enabled clean record without a newer candidate installed",
    persisted: () => installedRecord(true, []),
    candidate: () => ({ upgradable: false }),
    status: "installed",
  },
  {
    name: "marks an enabled clean record with a clean newer candidate upgradable",
    persisted: () => installedRecord(true, []),
    candidate: () => ({ upgradable: true, resolved: installableResolution("clean-candidate") }),
    status: "upgradable",
  },
  {
    name: "marks an enabled clean record with a partial newer candidate partially upgradable",
    persisted: () => installedRecord(true, []),
    candidate: () => ({
      upgradable: true,
      resolved: partiallyAvailableResolution("partial-candidate"),
    }),
    status: "partially-upgradable",
  },
  {
    name: "keeps an enabled clean record with an unavailable newer candidate upgradable",
    persisted: () => installedRecord(true, []),
    candidate: () => ({
      upgradable: true,
      resolved: unavailableResolution("unavailable-candidate"),
    }),
    status: "upgradable",
  },
  {
    name: "keeps an enabled clean record with an unprobeable newer candidate upgradable",
    persisted: () => installedRecord(true, []),
    candidate: () => ({ upgradable: true, resolved: undefined }),
    status: "upgradable",
  },
  {
    name: "keeps an enabled degraded record without a newer candidate partially installed",
    persisted: () => installedRecord(true, ["lspServers"]),
    candidate: () => ({ upgradable: false }),
    status: "partially-installed",
  },
  {
    name: "offers an enabled degraded record with a clean newer candidate for partial update",
    persisted: () => installedRecord(true, ["lspServers"]),
    candidate: () => ({
      upgradable: true,
      resolved: installableResolution("clean-promotion"),
    }),
    status: "partially-installed-upgradable",
  },
  {
    name: "offers an enabled degraded record with a partial newer candidate for partial update",
    persisted: () => installedRecord(true, ["lspServers"]),
    candidate: () => ({
      upgradable: true,
      resolved: partiallyAvailableResolution("partial-reapply"),
    }),
    status: "partially-installed-upgradable",
  },
  {
    name: "keeps an enabled degraded record with an unavailable newer candidate partially installed",
    persisted: () => installedRecord(true, ["lspServers"]),
    candidate: () => ({
      upgradable: true,
      resolved: unavailableResolution("unavailable-partial-candidate"),
    }),
    status: "partially-installed",
  },
  {
    name: "offers an enabled degraded record with an unprobeable newer candidate for partial update",
    persisted: () => installedRecord(true, ["lspServers"]),
    candidate: () => ({ upgradable: true, resolved: undefined }),
    status: "partially-installed-upgradable",
  },
];

describe("classifyInstalledRecord", () => {
  for (const { name, persisted, candidate, status } of installedCases) {
    test(name, () => {
      // arrange
      const persistedRecord = persisted();
      const upgradeCandidate = candidate();
      const expectedStatus = status;

      // act
      const installedStatus = classifyInstalledRecord(persistedRecord, upgradeCandidate);

      // assert
      assert.strictEqual(installedStatus, expectedStatus);
    });
  }
});

interface ManifestCase {
  readonly name: string;
  readonly resolved: () => ResolvedPlugin;
  readonly status: Exclude<ManifestEntryClassification, "remote">;
}

const manifestCases: readonly ManifestCase[] = [
  {
    name: "maps an installable resolution to available",
    resolved: () => installableResolution("available-plugin"),
    status: "available",
  },
  {
    name: "maps a partially available resolution without collapsing its state",
    resolved: () => partiallyAvailableResolution("partial-plugin"),
    status: "partially-available",
  },
  {
    name: "maps an unavailable resolution to unavailable",
    resolved: () => unavailableResolution("unavailable-plugin"),
    status: "unavailable",
  },
];

describe("classifyManifestEntry", () => {
  for (const { name, resolved, status } of manifestCases) {
    test(name, () => {
      // arrange
      const resolvedPlugin = resolved();
      const expectedStatus = status;

      // act
      const manifestStatus = classifyManifestEntry(resolvedPlugin);

      // assert
      assert.strictEqual(manifestStatus, expectedStatus);
    });
  }
});

/** An installable resolution whose one sse server only pi-mcp-adapter runs. */
function sseResolution(name: string): ResolvedPlugin {
  const sse = { type: "sse", url: "http://127.0.0.1:9/sse" };
  return {
    state: "installable",
    installable: true,
    name,
    pluginRoot: `/plugins/${name}`,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
    mcpServers: { events: sse },
    declaredMcpServers: { events: sse },
    defaultEnabled: true,
  };
}

describe("candidateFor", () => {
  const viewCases = [
    { active: "adapter", state: "installable", unsupported: [] },
    { active: "builtin", state: "partially-available", unsupported: ["mcpServers"] },
    { active: "none", state: "installable", unsupported: [] },
  ] satisfies readonly {
    readonly active: ActiveMcpImplementation;
    readonly state: ResolvedPlugin["state"];
    readonly unsupported: readonly string[];
  }[];

  for (const { active, state, unsupported } of viewCases) {
    test(`gives an upgradable candidate the ${active} view of its resolution`, () => {
      // arrange
      const candidate: UpgradeCandidate = {
        upgradable: true,
        resolved: sseResolution("sse-candidate"),
      };
      const expectedView = { state, unsupported };

      // act
      const view = candidateFor(candidate, active);

      // assert
      const resolved = view.upgradable ? view.resolved : undefined;
      assert.deepStrictEqual(
        resolved === undefined || resolved.state === "unavailable"
          ? resolved
          : { state: resolved.state, unsupported: resolved.unsupported },
        expectedView,
      );
    });
  }

  test("returns a candidate that is not upgradable as it is", () => {
    // arrange
    const candidate: UpgradeCandidate = { upgradable: false };

    // act
    const view = candidateFor(candidate, "builtin");

    // assert
    assert.strictEqual(view, candidate);
  });

  test("returns an upgradable candidate without a resolution as it is", () => {
    // arrange
    const candidate: UpgradeCandidate = { upgradable: true, resolved: undefined };

    // act
    const view = candidateFor(candidate, "builtin");

    // assert
    assert.strictEqual(view, candidate);
  });
});
