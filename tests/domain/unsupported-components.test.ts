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
    experimental: { monitors: {}, themes: {} },
    channels: null,
    userConfig: false,
  };
  const manifest = { outputStyles: [], settings: false, workflows: {} };

  // act
  const kinds = await collectUnsupportedKinds(entry, manifest, "/plugins/alpha", () =>
    Promise.reject(new Error("declarations must not probe conventions")),
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
    "workflows",
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
    [path.join(pluginRoot, "workflows"), "dir"],
  ]);

  // act
  const kinds = await collectUnsupportedKinds({}, null, pluginRoot, (candidate) =>
    Promise.resolve(statKinds.get(candidate) ?? null),
  );

  // assert
  assert.deepStrictEqual(kinds, [
    "lspServers",
    "monitors",
    "themes",
    "outputStyles",
    "settings",
    "workflows",
  ]);
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
    const kinds = await collectUnsupportedKinds(entry, null, "/plugins/alpha", () =>
      Promise.resolve("file"),
    );

    // assert
    assert.deepStrictEqual(kinds, ["lspServers", "monitors", "settings"]);
  });
}
