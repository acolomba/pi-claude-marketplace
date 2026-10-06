import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type * as UnsupportedComponentsOwner from "../../extensions/pi-claude-marketplace/domain/unsupported-components.ts";

type OwnerShape = typeof UnsupportedComponentsOwner;

function preserveDirectOwnerType(owner: OwnerShape): void {
  void owner;
}

void preserveDirectOwnerType;

const installDisabledPrecedenceCases = [
  {
    description: "entry disabled, no user declaration",
    entryDefault: false,
    declared: undefined,
    expected: true,
  },
  {
    description: "entry enabled, no user declaration",
    entryDefault: true,
    declared: undefined,
    expected: false,
  },
  {
    description: "entry silent, no user declaration",
    entryDefault: undefined,
    declared: undefined,
    expected: false,
  },
  {
    description: "entry disabled, user declares enabled",
    entryDefault: false,
    declared: true,
    expected: false,
  },
  {
    description: "entry disabled, user declares disabled",
    entryDefault: false,
    declared: false,
    expected: false,
  },
  {
    description: "entry silent, user declares enabled",
    entryDefault: undefined,
    declared: true,
    expected: false,
  },
  {
    description: "entry silent, user declares disabled",
    entryDefault: undefined,
    declared: false,
    expected: false,
  },
] as const;

for (const { description, entryDefault, declared, expected } of installDisabledPrecedenceCases) {
  test(`rowClaimsInstallDisabled with ${description} claims disabled: ${expected}`, async () => {
    // arrange
    const { rowClaimsInstallDisabled } =
      await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

    // act
    const claimedDisabled = rowClaimsInstallDisabled(
      {
        name: "alpha",
        source: "./alpha",
        ...(entryDefault !== undefined && { defaultEnabled: entryDefault }),
      },
      declared,
    );

    // assert
    assert.strictEqual(claimedDisabled, expected);
  });
}

test("rowClaimsInstallDisabled treats an invalid entry default as silent", async () => {
  // arrange
  const { rowClaimsInstallDisabled } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const entry = { name: "alpha", source: "./alpha" };
  // Object.defineProperty smuggles a non-boolean value past the field's
  // `boolean | undefined` type, simulating malformed data a literal cannot express.
  Object.defineProperty(entry, "defaultEnabled", { value: "false" });

  // act
  const claimedDisabled = rowClaimsInstallDisabled(entry, undefined);

  // assert
  assert.strictEqual(claimedDisabled, false);
});

test("collectUnsupportedKinds reads direct and experimental declarations in tuple order", async () => {
  // arrange
  const { collectUnsupportedKinds } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const entry = {
    lspServers: {},
    experimental: { monitors: {}, themes: {}, syntaxHighlighting: {} },
    channels: null,
    userConfig: false,
  };
  const manifest = { outputStyles: [], settings: false, binaries: { tool: { sha256: "ab" } } };

  // act
  const kinds = await collectUnsupportedKinds(
    {
      entry,
      manifest,
      pluginRoot: "/plugins/alpha",
      declaresHookModule: true,
      marketplaceName: "claude-plugins-official",
    },
    () => Promise.reject(new Error("declarations must not probe conventions")),
  );

  // assert
  assert.deepStrictEqual(kinds, [
    "lspServers",
    "monitors",
    "themes",
    "outputStyles",
    "channels",
    "userConfig",
    "settings",
    "syntaxHighlighting",
    "mod",
    "binaries",
  ]);
});

test("collectUnsupportedKinds detects every filesystem convention", async () => {
  // arrange
  const { collectUnsupportedKinds } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const pluginRoot = "/plugins/alpha";
  const statKinds = new Map<string, "file" | "dir">([
    [path.join(pluginRoot, ".lsp.json"), "file"],
    [path.join(pluginRoot, "monitors", "monitors.json"), "file"],
    [path.join(pluginRoot, "themes"), "dir"],
    [path.join(pluginRoot, "output-styles"), "dir"],
    [path.join(pluginRoot, "settings.json"), "file"],
  ]);

  // act
  const kinds = await collectUnsupportedKinds(
    {
      entry: {},
      manifest: null,
      pluginRoot,
      declaresHookModule: false,
      marketplaceName: "third-party",
    },
    (candidate) => Promise.resolve(statKinds.get(candidate) ?? null),
  );

  // assert
  assert.deepStrictEqual(kinds, ["lspServers", "monitors", "themes", "outputStyles", "settings"]);
});

const ignoredExperimentalCases = [
  { description: "an absent experimental field", entry: {} },
  { description: "a null experimental field", entry: { experimental: null } },
  { description: "a mismatched-type experimental field", entry: { experimental: "themes" } },
] as const;

for (const { description, entry } of ignoredExperimentalCases) {
  test(`collectUnsupportedKinds ignores ${description}`, async () => {
    // arrange
    const { collectUnsupportedKinds } =
      await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

    // act
    const kinds = await collectUnsupportedKinds(
      {
        entry,
        manifest: null,
        pluginRoot: "/plugins/alpha",
        declaresHookModule: false,
        marketplaceName: "third-party",
      },
      () => Promise.resolve("file"),
    );

    // assert
    assert.deepStrictEqual(kinds, ["lspServers", "monitors", "settings"]);
  });
}

test("UKIND-01: collectUnsupportedKinds reports mod from the declared hooks module", async () => {
  // arrange
  const { collectUnsupportedKinds } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

  // act
  const kinds = await collectUnsupportedKinds(
    {
      entry: {},
      manifest: null,
      pluginRoot: "/plugins/alpha",
      declaresHookModule: true,
      marketplaceName: "third-party",
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(kinds, ["mod"]);
});

test("UKIND-01: collectUnsupportedKinds ignores a plugin field named mod", async () => {
  // arrange
  const { collectUnsupportedKinds } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

  // act
  const kinds = await collectUnsupportedKinds(
    {
      entry: { mod: "./register.ts" },
      manifest: { mod: "./register.ts" },
      pluginRoot: "/plugins/alpha",
      declaresHookModule: false,
      marketplaceName: "third-party",
    },
    () => Promise.resolve(null),
  );

  // assert
  assert.deepStrictEqual(kinds, []);
});

for (const { description, entry, manifest, expectedKinds } of [
  {
    description: "an entry experimental outputStyles",
    entry: { experimental: { outputStyles: "./styles" } },
    manifest: null,
    expectedKinds: ["outputStyles"],
  },
  {
    description: "a manifest experimental outputStyles",
    entry: {},
    manifest: { experimental: { outputStyles: "./styles" } },
    expectedKinds: ["outputStyles"],
  },
  {
    description: "a top-level syntaxHighlighting",
    entry: { syntaxHighlighting: { hljsLanguages: [] } },
    manifest: null,
    expectedKinds: ["syntaxHighlighting"],
  },
  {
    description: "an experimental syntaxHighlighting",
    entry: {},
    manifest: { experimental: { syntaxHighlighting: { hljsLanguages: [] } } },
    expectedKinds: ["syntaxHighlighting"],
  },
]) {
  test(`UKIND-02: collectUnsupportedKinds reports ${description}`, async () => {
    // arrange
    const { collectUnsupportedKinds } =
      await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

    // act
    const kinds = await collectUnsupportedKinds(
      {
        entry,
        manifest,
        pluginRoot: "/plugins/alpha",
        declaresHookModule: false,
        marketplaceName: "third-party",
      },
      () => Promise.resolve(null),
    );

    // assert
    assert.deepStrictEqual(kinds, expectedKinds);
  });
}

for (const { description, marketplaceName, entry, manifest, expectedKinds } of [
  {
    description: "an entry binaries map in an official marketplace",
    marketplaceName: "claude-plugins-official",
    entry: { binaries: { tool: { sha256: "ab" } } },
    manifest: null,
    expectedKinds: ["binaries"],
  },
  {
    description: "a manifest binaries map in an official marketplace named in mixed case",
    marketplaceName: "Claude-Plugins-Official",
    entry: {},
    manifest: { binaries: { tool: { sha256: "ab" } } },
    expectedKinds: ["binaries"],
  },
  {
    description: "a binaries map in a third-party marketplace",
    marketplaceName: "third-party",
    entry: { binaries: { tool: { sha256: "ab" } } },
    manifest: null,
    expectedKinds: [],
  },
  {
    description: "an empty binaries map in an official marketplace",
    marketplaceName: "claude-plugins-official",
    entry: { binaries: {} },
    manifest: null,
    expectedKinds: [],
  },
  {
    description: "a null binaries value in an official marketplace",
    marketplaceName: "claude-plugins-official",
    entry: { binaries: null },
    manifest: null,
    expectedKinds: [],
  },
  {
    description: "a binaries array in an official marketplace",
    marketplaceName: "claude-plugins-official",
    entry: { binaries: ["tool"] },
    manifest: null,
    expectedKinds: [],
  },
]) {
  test(`UKIND-03: collectUnsupportedKinds reads ${description} as ${JSON.stringify(expectedKinds)}`, async () => {
    // arrange
    const { collectUnsupportedKinds } =
      await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");

    // act
    const kinds = await collectUnsupportedKinds(
      { entry, manifest, pluginRoot: "/plugins/alpha", declaresHookModule: false, marketplaceName },
      () => Promise.resolve(null),
    );

    // assert
    assert.deepStrictEqual(kinds, expectedKinds);
  });
}
