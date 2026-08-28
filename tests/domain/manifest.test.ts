import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadMarketplaceManifest,
  MARKETPLACE_VALIDATOR,
  type MarketplaceManifest,
} from "../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

void ({ name: "marketplace", plugins: [] } satisfies MarketplaceManifest);
void ({
  name: "marketplace",
  plugins: [{ name: "plugin", source: "./plugin" }],
  strict: false,
  owner: { name: "Owner" },
} satisfies MarketplaceManifest);
// @ts-expect-error A marketplace manifest requires its plugin array.
void ({ name: "marketplace" } satisfies MarketplaceManifest);
// @ts-expect-error The strict declaration is boolean when present.
void ({ name: "marketplace", plugins: [], strict: "false" } satisfies MarketplaceManifest);

describe("MARKETPLACE_VALIDATOR", () => {
  test("accepts a minimal marketplace", () => {
    // arrange
    const marketplaceManifest = { name: "marketplace", plugins: [] };

    // act
    const isValid = MARKETPLACE_VALIDATOR.Check(marketplaceManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts the complete marketplace shape and unknown fields", () => {
    // arrange
    const marketplaceManifest = {
      name: "marketplace",
      plugins: [
        {
          name: "plugin",
          source: "./plugin",
          defaultEnabled: false,
          mcpServers: "./plugin.mcp.json",
        },
      ],
      strict: true,
      owner: { name: "Owner" },
      vendorField: { enabled: true },
    };

    // act
    const isValid = MARKETPLACE_VALIDATOR.Check(marketplaceManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts non-strict marketplaces", () => {
    // arrange
    const marketplaceManifest = {
      name: "marketplace",
      plugins: [],
      strict: false,
    };

    // act
    const isValid = MARKETPLACE_VALIDATOR.Check(marketplaceManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  for (const marketplaceManifest of [
    null,
    [],
    { plugins: [] },
    { name: "marketplace" },
    { name: 42, plugins: [] },
    { name: "marketplace", plugins: null },
    { name: "marketplace", plugins: {} },
    { name: "marketplace", plugins: [{ name: "plugin" }] },
    { name: "marketplace", plugins: [], strict: "false" },
    { name: "marketplace", plugins: [], owner: null },
    { name: "marketplace", plugins: [], owner: {} },
    { name: "marketplace", plugins: [], owner: { name: 42 } },
  ]) {
    test(`rejects ${JSON.stringify(marketplaceManifest)}`, () => {
      // arrange
      const invalidMarketplaceManifest = marketplaceManifest;

      // act
      const isValid = MARKETPLACE_VALIDATOR.Check(invalidMarketplaceManifest);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});

describe("loadMarketplaceManifest", () => {
  test("returns the complete raw manifest with unknown fields", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(
      manifestPath,
      '{"name":"marketplace","plugins":[{"name":"broken","source":"./broken","mcpServers":"./missing.mcp.json","vendorEntry":1},{"name":"sibling","source":"./sibling"}],"strict":false,"owner":{"name":"Owner"},"vendorRoot":{"enabled":true}}',
      "utf8",
    );

    // act
    const marketplaceManifest = await loadMarketplaceManifest(manifestPath);

    // assert
    assert.deepStrictEqual(marketplaceManifest, {
      name: "marketplace",
      plugins: [
        {
          name: "broken",
          source: "./broken",
          mcpServers: "./missing.mcp.json",
          vendorEntry: 1,
        },
        { name: "sibling", source: "./sibling" },
      ],
      strict: false,
      owner: { name: "Owner" },
      vendorRoot: { enabled: true },
    });
  });

  test("returns the same manifest reference for an unchanged file", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(manifestPath, '{"name":"marketplace","plugins":[]}', "utf8");

    // act
    const marketplaceManifest = await loadMarketplaceManifest(manifestPath);
    const cachedMarketplaceManifest = await loadMarketplaceManifest(manifestPath);

    // assert
    assert.strictEqual(cachedMarketplaceManifest, marketplaceManifest);
  });

  test("preserves a SyntaxError cause for malformed JSON", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(manifestPath, "{", "utf8");

    // act & assert
    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (error: unknown) => {
        assert.ok(error instanceof InvalidMarketplaceManifestError);
        assert.strictEqual(error.name, "InvalidMarketplaceManifestError");
        assert.ok(error.cause instanceof SyntaxError);
        return true;
      },
    );
  });

  test("reports a root marketplace schema defect", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(manifestPath, '{"name":"marketplace"}', "utf8");

    // act & assert
    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (error: unknown) => {
        assert.ok(error instanceof InvalidMarketplaceManifestError);
        assert.strictEqual(error.name, "InvalidMarketplaceManifestError");
        assert.strictEqual(
          error.message,
          "marketplace.json schema invalid: <root>: must have required properties plugins",
        );
        assert.strictEqual(error.cause, undefined);
        return true;
      },
    );
  });

  test("reports a nested plugin schema defect", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(
      manifestPath,
      '{"name":"marketplace","plugins":[{"name":"plugin","source":"./plugin","defaultEnabled":"false"}]}',
      "utf8",
    );

    // act & assert
    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (error: unknown) => {
        assert.ok(error instanceof InvalidMarketplaceManifestError);
        assert.strictEqual(error.name, "InvalidMarketplaceManifestError");
        assert.strictEqual(
          error.message,
          "marketplace.json schema invalid: /plugins/0/defaultEnabled: must be boolean",
        );
        assert.strictEqual(error.cause, undefined);
        return true;
      },
    );
  });

  test("preserves filesystem error fields for a missing file", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "missing.json");

    // act & assert
    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        const fileError = error as NodeJS.ErrnoException;
        assert.strictEqual(fileError.code, "ENOENT");
        assert.strictEqual(fileError.syscall, "open");
        assert.strictEqual(fileError.path, manifestPath);
        return true;
      },
    );
  });
});
