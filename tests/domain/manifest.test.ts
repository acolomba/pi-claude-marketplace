import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import {
  loadMarketplaceManifest,
  type MarketplaceManifest,
} from "../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { TestContext } from "node:test";

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

/**
 * MM-1: the compiled validator is module-private, so a schema case reaches it
 * the way production does -- by reading a manifest off disk. Each case owns the
 * directory it writes into and removes it, and a fresh directory per case also
 * keeps the D-01 per-path memo from serving one case's parse to another.
 */
async function manifestFileWith(t: TestContext, manifestBody: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });
  const manifestPath = path.join(directory, "marketplace.json");
  await writeFile(manifestPath, manifestBody, "utf8");
  return manifestPath;
}

describe("marketplace manifest schema", () => {
  for (const marketplaceManifest of [
    { name: "marketplace", plugins: [] },
    {
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
    },
    { name: "marketplace", plugins: [], strict: false },
  ]) {
    test(`accepts ${JSON.stringify(marketplaceManifest)}`, async (t) => {
      // arrange
      const manifestPath = await manifestFileWith(t, JSON.stringify(marketplaceManifest));

      // act
      const loadedMarketplaceManifest = await loadMarketplaceManifest(manifestPath);

      // assert
      assert.deepStrictEqual(loadedMarketplaceManifest, marketplaceManifest);
    });
  }

  // Each row pairs a rejected manifest with the exact defect the loader reports
  // for it, so a schema arm that stops firing is named rather than merely
  // counted.
  for (const [marketplaceManifest, schemaDefect] of [
    [null, "<root>: must be object"],
    [[], "<root>: must be object"],
    [{ plugins: [] }, "<root>: must have required properties name"],
    [{ name: "marketplace" }, "<root>: must have required properties plugins"],
    [{ name: 42, plugins: [] }, "/name: must be string"],
    [{ name: "marketplace", plugins: null }, "/plugins: must be array"],
    [{ name: "marketplace", plugins: {} }, "/plugins: must be array"],
    [
      { name: "marketplace", plugins: [{ name: "plugin" }] },
      "/plugins/0: must have required properties source",
    ],
    [{ name: "marketplace", plugins: [], strict: "false" }, "/strict: must be boolean"],
    [{ name: "marketplace", plugins: [], owner: null }, "/owner: must be object"],
    [{ name: "marketplace", plugins: [], owner: {} }, "/owner: must have required properties name"],
    [{ name: "marketplace", plugins: [], owner: { name: 42 } }, "/owner/name: must be string"],
  ] as const) {
    test(`rejects ${JSON.stringify(marketplaceManifest)}`, async (t) => {
      // arrange
      const manifestPath = await manifestFileWith(t, JSON.stringify(marketplaceManifest));

      // act & assert
      await assert.rejects(
        () => loadMarketplaceManifest(manifestPath),
        (error: unknown) => {
          assert.ok(error instanceof InvalidMarketplaceManifestError);
          assert.strictEqual(error.message, `marketplace.json schema invalid: ${schemaDefect}`);
          return true;
        },
      );
    });
  }
});

describe("loadMarketplaceManifest", () => {
  test("preserves a complete raw manifest by reference with key order and unknown fields", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(
      manifestPath,
      '{"vendorRoot":{"enabled":true},"plugins":[{"vendorEntry":1,"source":"./broken","name":"broken","mcpServers":"./missing.mcp.json"},{"source":"./sibling","name":"sibling"}],"name":"marketplace","owner":{"name":"Owner"},"strict":false}',
      "utf8",
    );

    // act
    const marketplaceManifest = await loadMarketplaceManifest(manifestPath);
    const cachedMarketplaceManifest = await loadMarketplaceManifest(manifestPath);

    // assert
    assert.deepStrictEqual(marketplaceManifest, {
      vendorRoot: { enabled: true },
      plugins: [
        {
          vendorEntry: 1,
          source: "./broken",
          name: "broken",
          mcpServers: "./missing.mcp.json",
        },
        { source: "./sibling", name: "sibling" },
      ],
      name: "marketplace",
      owner: { name: "Owner" },
      strict: false,
    });
    assert.deepStrictEqual(Object.keys(marketplaceManifest), [
      "vendorRoot",
      "plugins",
      "name",
      "owner",
      "strict",
    ]);
    assert.strictEqual(cachedMarketplaceManifest, marketplaceManifest);
  });

  test("returns the smallest valid manifest", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(manifestPath, '{"name":"marketplace","plugins":[]}', "utf8");

    // act
    const marketplaceManifest = await loadMarketplaceManifest(manifestPath);

    // assert
    assert.deepStrictEqual(marketplaceManifest, { name: "marketplace", plugins: [] });
  });

  test("preserves a SyntaxError cause for malformed JSON", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "marketplace-manifest-"));
    t.after(async () => {
      await rm(directory, { force: true, recursive: true });
    });
    const manifestPath = path.join(directory, "marketplace.json");
    await writeFile(manifestPath, "{", "utf8");
    const syntaxErrorMessage =
      "Expected property name or '}' in JSON at position 1 (line 1 column 2)";

    // act & assert
    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (error: unknown) => {
        assert.ok(error instanceof InvalidMarketplaceManifestError);
        assert.strictEqual(error.name, "InvalidMarketplaceManifestError");
        assert.strictEqual(
          error.message,
          `marketplace.json is not valid JSON: SyntaxError: ${syntaxErrorMessage}`,
        );
        assert.ok(error.cause instanceof SyntaxError);
        assert.strictEqual(error.cause.name, "SyntaxError");
        assert.strictEqual(error.cause.message, syntaxErrorMessage);
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
