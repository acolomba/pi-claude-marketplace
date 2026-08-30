// Architecture-level defense-in-depth gates for the HOOK-03 lenient stance
// + D-57-01 idempotency invariant.
//
// The companion hooks-foundation.test.ts walks the introspected
// `HOOKS_CONFIG_SCHEMA` JSON-Schema for `additionalProperties: false`.
// This file pins a complementary source-text gate: the literal string
// `additionalProperties: false` must never appear in
// `domain/components/hooks.ts` source code. The textual gate blocks an
// `as unknown as never` cast or any other one-liner that could slip a
// strict gate into the TypeBox schema without being visible in the
// introspected JSON-Schema output.
//
// The idempotency gate pins the D-57-01 invariant that
// `ensurePluginResources` is a no-op on a record that has already been
// default-filled -- the helper is reached through the public
// `migrateLegacyMarketplaceRecords` seam.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { migrateLegacyMarketplaceRecords } from "../../extensions/pi-claude-marketplace/persistence/migrate.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOOKS_TS_PATH = path.join(
  REPO_ROOT,
  "extensions/pi-claude-marketplace/domain/components/hooks.ts",
);

/**
 * Strip line + block comments so a doc-comment that legally mentions the
 * forbidden token (e.g. explaining the HOOK-03 lenient stance) does not
 * false-positive.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // full-line line comments
}

test("HOOK-03: hooks.ts source never carries 'additionalProperties: false' (defense-in-depth)", async () => {
  // arrange
  const src = await readFile(HOOKS_TS_PATH, "utf8");

  // act
  const stripped = stripComments(src);
  const carriesStrictAdditionalProperties = /additionalProperties\s*:\s*false/.test(stripped);

  // assert
  assert.equal(
    carriesStrictAdditionalProperties,
    false,
    "domain/components/hooks.ts must NOT carry `additionalProperties: false` anywhere",
  );
});

test("D-57-01: migrateLegacyMarketplaceRecords is idempotent over the hooks default-fill", () => {
  // arrange
  // A v1.12-shaped record: resources missing the `hooks` field entirely.
  // The migrator's `ensurePluginResources` arm is responsible for filling
  // `hooks: []` before validation runs (HOOK-02 / D-57-01).
  const v1_12Parsed = {
    schemaVersion: 1,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "user",
        source: { kind: "path", path: "/tmp/mp" },
        addedFromCwd: "/tmp",
        manifestPath: "/ext-root/sources/mp/.claude-plugin/marketplace.json",
        marketplaceRoot: "/ext-root/sources/mp",
        plugins: {
          pl: {
            version: "1.0.0",
            resolvedSource: "/tmp/mp/pl",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              // hooks deliberately omitted (v1.12 shape)
            },
            installedAt: "2026-06-01T00:00:00Z",
            updatedAt: "2026-06-01T00:00:00Z",
          },
        },
      },
    },
  };

  // act
  // First pass: the migrator must default-fill `hooks: []` and report mutation.
  const first = migrateLegacyMarketplaceRecords(v1_12Parsed, "/ext-root", false);
  const firstMp = first.marketplaces.mp!;
  const firstPlugins = firstMp.plugins as Record<string, Record<string, unknown>>;
  const firstResources = firstPlugins.pl?.resources as Record<string, unknown>;
  const reparsed = {
    schemaVersion: 1,
    marketplaces: first.marketplaces,
  };
  const second = migrateLegacyMarketplaceRecords(reparsed, "/ext-root", false);

  // assert
  assert.equal(first.mutated, true, "first pass must report mutation (hooks default-fill ran)");
  assert.deepEqual(firstResources.hooks, [], "first pass must default-fill resources.hooks to []");
  assert.equal(
    second.mutated,
    false,
    "second pass must report no mutation -- D-57-01 idempotency invariant",
  );
  assert.deepEqual(
    second.marketplaces,
    first.marketplaces,
    "second pass output must deep-equal first pass output",
  );
});
