import assert from "node:assert/strict";
import test from "node:test";

import {
  lookupDeclaredPlugin,
  type ManifestLookup,
  type ManifestPluginEntry,
} from "../../extensions/pi-claude-marketplace/domain/manifest-lookup.ts";

void ({ name: "plugin", source: "./plugin" } satisfies ManifestPluginEntry);
void ({
  kind: "declared",
  entry: { name: "plugin", source: "./plugin" },
} satisfies ManifestLookup);
void ({ kind: "absent" } satisfies ManifestLookup);
void ({ kind: "unverified" } satisfies ManifestLookup);
// @ts-expect-error A declared lookup includes its manifest entry.
void ({ kind: "declared" } satisfies ManifestLookup);
// @ts-expect-error A lookup has one of the three public states.
void ({ kind: "unknown" } satisfies ManifestLookup);

test("returns the complete entry for an exact plugin name", () => {
  // arrange
  const manifest = {
    plugins: [
      {
        name: "plugin",
        source: "./plugin",
        description: "Plugin description",
        version: "1.2.3",
      },
      { name: "other", source: "./other" },
    ],
  } as const;

  // act
  const lookup = lookupDeclaredPlugin(manifest, "plugin");

  // assert
  assert.deepStrictEqual(lookup, {
    kind: "declared",
    entry: {
      name: "plugin",
      source: "./plugin",
      description: "Plugin description",
      version: "1.2.3",
    },
  });
});

test("returns absent when the manifest has no exact plugin name", () => {
  // arrange
  const manifest = {
    plugins: [{ name: "other", source: "./other" }],
  } as const;

  // act
  const lookup = lookupDeclaredPlugin(manifest, "plugin");

  // assert
  assert.deepStrictEqual(lookup, { kind: "absent" });
});

test("compares plugin names with case-sensitive identity", () => {
  // arrange
  const manifest = {
    plugins: [{ name: "Plugin", source: "./plugin" }],
  } as const;

  // act
  const lookup = lookupDeclaredPlugin(manifest, "plugin");

  // assert
  assert.deepStrictEqual(lookup, { kind: "absent" });
});

test("does not normalize Unicode plugin names", () => {
  // arrange
  const manifest = {
    plugins: [{ name: "caf\u00e9", source: "./plugin" }],
  } as const;

  // act
  const lookup = lookupDeclaredPlugin(manifest, "cafe\u0301");

  // assert
  assert.deepStrictEqual(lookup, { kind: "absent" });
});
