import assert from "node:assert/strict";
import { describe, test } from "node:test";

// @ts-expect-error The production validator is intentionally a directly executable .mjs CLI.
import * as hubLedgerModule from "../../scripts/check-phase-06-hub-ledger.mjs";

interface CensusRow {
  readonly id: string;
  readonly sourcePath: string;
  readonly symbol: string;
  readonly ownerTest: string;
  readonly graph: string;
  readonly route: "phase-06" | "phase-08" | "retained" | "already-removed";
  readonly evidence: string;
}

interface HubLedgerApi {
  readonly CATALOG_FIXTURES: readonly string[];
  readonly CENSUS_ROWS: readonly CensusRow[];
  readonly LEGACY_HUBS: readonly string[];
  readonly MF_DEC_01_IDS: readonly string[];
  readonly OWNER_PAIRS: readonly (readonly [string, string])[];
  readonly validateCensus: (input: {
    readonly decision: string;
    readonly source: unknown;
    readonly codegraph: string;
    readonly rows: readonly CensusRow[];
    readonly trackedPaths: ReadonlySet<string>;
  }) => string[];
  readonly validatePreedit: (input: {
    readonly hub: string;
    readonly legacyTest: string;
    readonly ledger: string;
    readonly codegraph: string;
    readonly trackedPaths: ReadonlySet<string>;
  }) => string[];
  readonly validateClosure: (input: {
    readonly files: ReadonlyMap<string, string>;
    readonly ownerCount: number;
    readonly catalogFixtureCount: number;
    readonly legacyHubs: readonly string[];
    readonly syncFiles: number;
    readonly syncCalls: number;
    readonly requireFiles: number;
    readonly requireCalls: number;
  }) => string[];
}

const {
  CATALOG_FIXTURES,
  CENSUS_ROWS,
  LEGACY_HUBS,
  MF_DEC_01_IDS,
  OWNER_PAIRS,
  validateCensus,
  validateClosure,
  validatePreedit,
} = hubLedgerModule as HubLedgerApi;

function decisionSource(ids: readonly string[] = MF_DEC_01_IDS): unknown {
  return {
    decisions: [
      {
        id: "MF-DEC-01",
        status: "resolved",
        premiseFindingIds: ids,
        selectedOption: "Trace-preserving removal",
      },
    ],
  };
}

function codegraphEvidence(ids: readonly string[] = MF_DEC_01_IDS): string {
  return ids.map((id) => `===== ${id} =====\ncaller -> dependency -> owner`).join("\n");
}

describe("MF-DEC-01 census", () => {
  test("accepts exactly 24 mapped canonical rows with fresh evidence", () => {
    assert.deepStrictEqual(
      validateCensus({
        decision: "MF-DEC-01",
        source: decisionSource(),
        codegraph: codegraphEvidence(),
        rows: CENSUS_ROWS,
        trackedPaths: new Set(CENSUS_ROWS.flatMap((row) => [row.sourcePath, row.ownerTest])),
      }),
      [],
    );
  });

  test("fails closed for duplicate, missing, stale, and unmapped rows", () => {
    const duplicateIds = [...MF_DEC_01_IDS.slice(0, -1), MF_DEC_01_IDS[0]!];
    assert.match(
      validateCensus({
        decision: "MF-DEC-01",
        source: decisionSource(duplicateIds),
        codegraph: codegraphEvidence(),
        rows: CENSUS_ROWS,
        trackedPaths: new Set(CENSUS_ROWS.flatMap((row) => [row.sourcePath, row.ownerTest])),
      }).join("\n"),
      /duplicate|missing/i,
    );
    assert.match(
      validateCensus({
        decision: "MF-DEC-01",
        source: decisionSource(),
        codegraph: codegraphEvidence(MF_DEC_01_IDS.slice(1)),
        rows: CENSUS_ROWS,
        trackedPaths: new Set(CENSUS_ROWS.flatMap((row) => [row.sourcePath, row.ownerTest])),
      }).join("\n"),
      /CodeGraph.*BA-009/i,
    );
    assert.match(
      validateCensus({
        decision: "MF-DEC-01",
        source: decisionSource(),
        codegraph: codegraphEvidence(),
        rows: CENSUS_ROWS,
        trackedPaths: new Set(),
      }).join("\n"),
      /stale path/i,
    );
  });
});

describe("PRE-EDIT ledger", () => {
  const hub = "extensions/pi-claude-marketplace/domain/resolver.ts";
  const legacyTest = "tests/domain/resolver.test.ts";
  const ledger = `# Resolver PRE-EDIT Ledger

Status: READY
Hub: ${hub}
Legacy test: ${legacyTest}

| Category | Current owner | Destination | Evidence |
| --- | --- | --- | --- |
| exported symbol | resolvePlugin | domain/plugin-resolver.ts | tracked |
| production caller | bridges/commands/stage.ts | domain/plugin-resolver.ts | CodeGraph |
| source-scanning gate | scripts/test-coverage-direct.mjs | domain/plugin-resolver.ts | tracked |
| documentation comment | docs/architecture.md | domain/plugin-resolver.ts | tracked |
| test ownership | tests/domain/resolver.test.ts#resolvePlugin | tests/domain/plugin-resolver.test.ts | exact owner |
| completeness invariant | resolver closed set | domain/resolver-types.ts | inverse walk |
| dependency edge | resolver.ts -> source.ts | plugin-resolver.ts -> source.ts | acyclic |
`;

  test("accepts a READY ledger with every repoint category", () => {
    assert.deepStrictEqual(
      validatePreedit({
        hub,
        legacyTest,
        ledger,
        codegraph: `callers and dependencies for ${hub}`,
        trackedPaths: new Set([
          hub,
          legacyTest,
          "extensions/pi-claude-marketplace/domain/plugin-resolver.ts",
          "tests/domain/plugin-resolver.test.ts",
        ]),
      }),
      [],
    );
  });

  test("fails closed for unmapped, duplicate-owner, stale, or cyclic ledgers", () => {
    assert.match(
      validatePreedit({
        hub,
        legacyTest,
        ledger: ledger.replace(/\| completeness invariant .*\n/, ""),
        codegraph: hub,
        trackedPaths: new Set([hub, legacyTest]),
      }).join("\n"),
      /completeness invariant/i,
    );
    assert.match(
      validatePreedit({
        hub,
        legacyTest,
        ledger: `${ledger}| test ownership | duplicate | tests/domain/plugin-resolver.test.ts | duplicate |\n`,
        codegraph: hub,
        trackedPaths: new Set([hub, legacyTest]),
      }).join("\n"),
      /duplicate owner/i,
    );
    assert.match(
      validatePreedit({
        hub,
        legacyTest,
        ledger: ledger.replace("acyclic", "cycle"),
        codegraph: hub,
        trackedPaths: new Set([hub, legacyTest]),
      }).join("\n"),
      /cycle/i,
    );
  });
});

describe("Phase 6 closure", () => {
  function validClosureFiles(): Map<string, string> {
    // Keep the repository census limited to executable patch calls while the
    // fixture still assembles the exact tokens consumed by the validator.
    const syncToken = "syncBuiltinESM" + "Exports(";
    const requireToken = "create" + "Require(";
    const files = new Map<string, string>();
    for (const [source, owner] of OWNER_PAIRS) {
      files.set(source, "export const owner = true;\n");
      files.set(owner, "test('owner', () => {});\n");
    }

    for (const fixture of CATALOG_FIXTURES) {
      files.set(fixture, "export const fixture = {};\n");
    }

    files.set(
      "tests/bridges/skills/stage.test.ts",
      `${`${syncToken});\n`.repeat(16)}${requireToken}import.meta.url);\n`,
    );
    files.set(
      "tests/orchestrators/plugin/uninstall.test.ts",
      `${`${syncToken});\n`.repeat(2)}${requireToken}import.meta.url);\n`,
    );
    files.set("scripts/check-phase-06-hub-ledger.mjs", `${syncToken} ${requireToken}`);
    files.set("tests/scripts/check-phase-06-hub-ledger.test.ts", `${syncToken} ${requireToken}`);
    return files;
  }

  test("accepts 30 owner pairs, 20 fixtures, absent hubs, and the exact residual census", () => {
    assert.deepStrictEqual(
      validateClosure({
        files: validClosureFiles(),
        ownerCount: 30,
        catalogFixtureCount: 20,
        legacyHubs: LEGACY_HUBS,
        syncFiles: 2,
        syncCalls: 18,
        requireFiles: 2,
        requireCalls: 2,
      }),
      [],
    );
  });

  test("fails closed for missing owners, stale hubs, and residual count drift", () => {
    const missingOwner = validClosureFiles();
    missingOwner.delete(OWNER_PAIRS[0]?.[1] ?? "");
    assert.match(
      validateClosure({
        files: missingOwner,
        ownerCount: 30,
        catalogFixtureCount: 20,
        legacyHubs: LEGACY_HUBS,
        syncFiles: 2,
        syncCalls: 18,
        requireFiles: 2,
        requireCalls: 2,
      }).join("\n"),
      /missing owner/i,
    );
    const staleHub = validClosureFiles();
    staleHub.set(LEGACY_HUBS[0] ?? "legacy.ts", "stale\n");
    assert.match(
      validateClosure({
        files: staleHub,
        ownerCount: 30,
        catalogFixtureCount: 20,
        legacyHubs: LEGACY_HUBS,
        syncFiles: 2,
        syncCalls: 18,
        requireFiles: 2,
        requireCalls: 2,
      }).join("\n"),
      /legacy hub/i,
    );
    assert.match(
      validateClosure({
        files: validClosureFiles(),
        ownerCount: 30,
        catalogFixtureCount: 20,
        legacyHubs: LEGACY_HUBS,
        syncFiles: 2,
        syncCalls: 17,
        requireFiles: 2,
        requireCalls: 2,
      }).join("\n"),
      /syncBuiltinESMExports/i,
    );
  });
});
