import assert from "node:assert/strict";
import test from "node:test";

type OwnerModule =
  typeof import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts");

async function loadOwner(): Promise<OwnerModule> {
  let owner: OwnerModule | undefined;
  await assert.doesNotReject(async () => {
    owner =
      await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts");
  }, "install-flow.ts must own install transaction composition");
  assert.ok(owner !== undefined);
  return owner;
}

test("owns the required install transaction factory", async () => {
  // arrange
  const owner = await loadOwner();

  // act
  const factory = owner.createInstallPlugin;

  // assert
  assert.equal(typeof factory, "function");
});

test("owns the production install transaction factory", async () => {
  // arrange
  const owner = await loadOwner();

  // act
  const factory = owner.createNodeInstallPlugin;

  // assert
  assert.equal(typeof factory, "function");
});
