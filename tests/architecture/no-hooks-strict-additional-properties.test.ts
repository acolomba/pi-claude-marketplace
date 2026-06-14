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
  const src = await readFile(HOOKS_TS_PATH, "utf8");
  const stripped = stripComments(src);

  // The schema's lenient stance must hold textually. An `as unknown as
  // never` cast or any other smuggled strictness would show as a literal
  // `additionalProperties: false` in the source after comments are
  // stripped.
  assert.equal(
    /additionalProperties\s*:\s*false/.test(stripped),
    false,
    "domain/components/hooks.ts must NOT carry `additionalProperties: false` anywhere",
  );
});

test("D-57-01: migrateLegacyMarketplaceRecords is idempotent over the hooks default-fill", () => {
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

  // First pass: the migrator must default-fill `hooks: []` and report mutation.
  const first = migrateLegacyMarketplaceRecords(v1_12Parsed, "/ext-root", false);
  assert.equal(first.mutated, true, "first pass must report mutation (hooks default-fill ran)");

  const firstMp = first.marketplaces.mp as Record<string, unknown>;
  const firstPlugins = firstMp.plugins as Record<string, Record<string, unknown>>;
  const firstResources = firstPlugins.pl?.resources as Record<string, unknown>;
  assert.deepEqual(firstResources.hooks, [], "first pass must default-fill resources.hooks to []");

  // Second pass over the already-normalized record. The hooks arm must
  // report no further mutation. This pins the D-57-01 no-op-after-
  // normalization invariant: the helper MUST be a no-op on idempotent
  // input.
  const reparsed = {
    schemaVersion: 1,
    marketplaces: first.marketplaces,
  };
  const second = migrateLegacyMarketplaceRecords(reparsed, "/ext-root", false);
  assert.equal(
    second.mutated,
    false,
    "second pass must report no mutation -- D-57-01 idempotency invariant",
  );

  // And the shape must be deep-equal to the post-first-pass state.
  assert.deepEqual(
    second.marketplaces,
    first.marketplaces,
    "second pass output must deep-equal first pass output",
  );
});
