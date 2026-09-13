import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type * as UnsupportedComponentsOwner from "../../extensions/pi-claude-marketplace/domain/unsupported-components.ts";

type OwnerShape = typeof UnsupportedComponentsOwner;

function preserveDirectOwnerType(owner: OwnerShape): void {
  void owner;
}

void preserveDirectOwnerType;

test("exports the exact supported and unsupported closed sets", async () => {
  // arrange
  let supported: readonly string[] = [];
  let unsupported: readonly string[] = [];

  // act & assert
  await assert.doesNotReject(async () => {
    const owner =
      await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
    supported = owner.SUPPORTED_COMPONENT_KINDS;
    unsupported = owner.UNSUPPORTED_COMPONENT_KINDS;
  }, "unsupported-components.ts is absent");
  assert.deepStrictEqual(supported, ["skills", "commands", "agents", "hooks"]);
  assert.deepStrictEqual(unsupported, [
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
test("rowClaimsInstallDisabled preserves user-declaration precedence", async () => {
  // arrange
  const { rowClaimsInstallDisabled } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const cases = [
    { entryDefault: false, declared: undefined, expected: true },
    { entryDefault: true, declared: undefined, expected: false },
    { entryDefault: undefined, declared: undefined, expected: false },
    { entryDefault: false, declared: true, expected: false },
    { entryDefault: false, declared: false, expected: false },
    { entryDefault: undefined, declared: true, expected: false },
    { entryDefault: undefined, declared: false, expected: false },
  ] as const;

  // act
  const actual = cases.map(({ entryDefault, declared }) =>
    rowClaimsInstallDisabled(
      {
        name: "alpha",
        source: "./alpha",
        ...(entryDefault !== undefined && { defaultEnabled: entryDefault }),
      },
      declared,
    ),
  );

  // assert
  assert.deepStrictEqual(
    actual,
    cases.map(({ expected }) => expected),
  );
});

test("rowClaimsInstallDisabled treats an invalid entry default as silent", async () => {
  // arrange
  const { rowClaimsInstallDisabled } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const entry = { name: "alpha", source: "./alpha" };
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

test("collectUnsupportedKinds ignores absent, null-experimental, and mismatched conventions", async () => {
  // arrange
  const { collectUnsupportedKinds } =
    await import("../../extensions/pi-claude-marketplace/domain/unsupported-components.ts");
  const records = [{}, { experimental: null }, { experimental: "themes" }] as const;

  // act
  const results = await Promise.all(
    records.map((entry) =>
      collectUnsupportedKinds(entry, null, "/plugins/alpha", () => Promise.resolve("file")),
    ),
  );

  // assert
  assert.deepStrictEqual(results, [
    ["lspServers", "monitors", "settings"],
    ["lspServers", "monitors", "settings"],
    ["lspServers", "monitors", "settings"],
  ]);
});
