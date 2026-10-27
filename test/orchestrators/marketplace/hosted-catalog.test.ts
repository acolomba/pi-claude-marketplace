import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  DEFAULT_HOSTED_MANIFEST_FETCH,
  downloadHostedCatalog,
  recognizeHostedLeftover,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts";
import { fetchHostedManifest } from "../../../extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts";
import {
  StaleSourceCloneError,
  UnreadableSourceCloneError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import {
  createRemovalOps,
  pathExists,
  type RemovalOps,
} from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";

import type { HostedManifestFetch } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts";

const CATALOG_URL = "https://catalog.example/acme/marketplace.json";
const CATALOG = '{"name":"tools","owner":{"name":"acme"},"plugins":[]}';
const MARKER_FILE = ".pi-claude-marketplace-hosted.json";

function markerBytes(url: string): string {
  return `{\n  "generatedBy": "pi-claude-marketplace",\n  "url": "${url}"\n}\n`;
}

async function scratchDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "hosted-catalog-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** A leftover tree holding a sentinel file and, when given, a marker file. */
async function leftover(t: TestContext, marker?: string): Promise<string> {
  const finalDir = path.join(await scratchDir(t), "tools");
  await mkdir(finalDir);
  await writeFile(path.join(finalDir, "sentinel"), "x");
  if (marker !== undefined) {
    await writeFile(path.join(finalDir, MARKER_FILE), marker);
  }

  return finalDir;
}

function assertStale(finalDir: string): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof StaleSourceCloneError);
    assert.deepStrictEqual(
      { absPath: error.absPath, mpName: error.mpName },
      { absPath: finalDir, mpName: "tools" },
    );
    return true;
  };
}

test("the default download is the platform hosted fetch", () => {
  // assert
  assert.strictEqual(DEFAULT_HOSTED_MANIFEST_FETCH, fetchHostedManifest);
});

describe("downloadHostedCatalog", () => {
  test("stores the downloaded bytes as the catalog and marks the tree with its URL", async (t) => {
    // arrange
    const stagingDir = path.join(await scratchDir(t), "staging");
    const urls: string[] = [];
    const fetchCatalog: HostedManifestFetch = (url) => {
      urls.push(url);
      return Promise.resolve(Buffer.from(CATALOG));
    };

    // act
    await downloadHostedCatalog({ url: CATALOG_URL, stagingDir, fetchCatalog });

    // assert
    assert.deepStrictEqual(urls, [CATALOG_URL]);
    assert.deepStrictEqual(
      {
        catalog: await readFile(
          path.join(stagingDir, ".claude-plugin", "marketplace.json"),
          "utf8",
        ),
        marker: await readFile(path.join(stagingDir, MARKER_FILE), "utf8"),
      },
      { catalog: CATALOG, marker: markerBytes(CATALOG_URL) },
    );
  });

  test("writes nothing when the download fails", async (t) => {
    // arrange
    const stagingDir = path.join(await scratchDir(t), "staging");
    const failure = new Error("download failed");
    const fetchCatalog: HostedManifestFetch = () => Promise.reject(failure);

    // act & assert
    await assert.rejects(
      downloadHostedCatalog({ url: CATALOG_URL, stagingDir, fetchCatalog }),
      failure,
    );
    assert.strictEqual(await pathExists(stagingDir), false);
  });
});

describe("recognizeHostedLeftover", () => {
  test("removes a leftover that marks a download of the same URL", async (t) => {
    // arrange
    const finalDir = await leftover(t, markerBytes(CATALOG_URL));

    // act
    const leak = await recognizeHostedLeftover({
      finalDir,
      derivedName: "tools",
      url: CATALOG_URL,
      removalOps: createRemovalOps(),
    });

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(await pathExists(finalDir), false);
  });

  test("returns the leak of a removal that fails", async (t) => {
    // arrange
    const finalDir = await leftover(t, markerBytes(CATALOG_URL));
    const removalOps: RemovalOps = {
      rm: () => Promise.reject(Object.assign(new Error("denied"), { code: "EACCES" })),
    };

    // act
    const leak = await recognizeHostedLeftover({
      finalDir,
      derivedName: "tools",
      url: CATALOG_URL,
      removalOps,
    });

    // assert
    assert.strictEqual(
      leak,
      `failed to clean up marketplace leftover download at ${finalDir}: denied`,
    );
    assert.strictEqual(await pathExists(path.join(finalDir, "sentinel")), true);
  });

  for (const { title, marker } of [
    { title: "no marker", marker: undefined },
    { title: "a marker for another URL", marker: markerBytes("https://other.example/m.json") },
    {
      title: "a marker another tool wrote",
      marker: JSON.stringify({ generatedBy: "other-tool", url: CATALOG_URL }),
    },
    { title: "a marker that is not an object", marker: "null" },
    { title: "a marker that is not json", marker: "{" },
  ]) {
    test(`refuses a leftover with ${title} as a stale clone and keeps it`, async (t) => {
      // arrange
      const finalDir = await leftover(t, marker);

      // act & assert
      await assert.rejects(
        recognizeHostedLeftover({
          finalDir,
          derivedName: "tools",
          url: CATALOG_URL,
          removalOps: createRemovalOps(),
        }),
        assertStale(finalDir),
      );
      assert.strictEqual(await pathExists(path.join(finalDir, "sentinel")), true);
    });
  }

  test("refuses a destination that is a file as a stale clone", async (t) => {
    // arrange
    const finalDir = path.join(await scratchDir(t), "tools");
    await writeFile(finalDir, "x");

    // act & assert
    await assert.rejects(
      recognizeHostedLeftover({
        finalDir,
        derivedName: "tools",
        url: CATALOG_URL,
        removalOps: createRemovalOps(),
      }),
      assertStale(finalDir),
    );
  });

  test("lets the rename proceed when the destination is gone", async (t) => {
    // arrange
    const finalDir = path.join(await scratchDir(t), "tools");

    // act
    const leak = await recognizeHostedLeftover({
      finalDir,
      derivedName: "tools",
      url: CATALOG_URL,
      removalOps: createRemovalOps(),
    });

    // assert
    assert.strictEqual(leak, undefined);
  });

  test("reads a marker nobody may read as permission denied", async (t) => {
    // arrange
    const finalDir = await leftover(t, markerBytes(CATALOG_URL));
    await chmod(path.join(finalDir, MARKER_FILE), 0o000);

    // act & assert
    await assert.rejects(
      recognizeHostedLeftover({
        finalDir,
        derivedName: "tools",
        url: CATALOG_URL,
        removalOps: createRemovalOps(),
      }),
      (error: unknown) => {
        assert.ok(error instanceof UnreadableSourceCloneError);
        assert.deepStrictEqual(
          { absPath: error.absPath, mpName: error.mpName, failure: error.failure },
          { absPath: finalDir, mpName: "tools", failure: "permission-denied" },
        );
        return true;
      },
    );
  });

  test("reads a marker that is a directory as unreadable", async (t) => {
    // arrange
    const finalDir = await leftover(t);
    await mkdir(path.join(finalDir, MARKER_FILE));

    // act & assert
    await assert.rejects(
      recognizeHostedLeftover({
        finalDir,
        derivedName: "tools",
        url: CATALOG_URL,
        removalOps: createRemovalOps(),
      }),
      (error: unknown) => {
        assert.ok(error instanceof UnreadableSourceCloneError);
        assert.deepStrictEqual(
          { absPath: error.absPath, mpName: error.mpName, failure: error.failure },
          { absPath: finalDir, mpName: "tools", failure: "unreadable" },
        );
        return true;
      },
    );
  });
});
