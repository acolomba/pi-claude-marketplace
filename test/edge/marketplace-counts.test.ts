import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  marketplaceDescription,
  offeredPluginCount,
} from "../../extensions/pi-claude-marketplace/edge/marketplace-counts.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { ParsedSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";

function pathSource(raw: string): ParsedSource {
  return { kind: "path", raw, logical: raw };
}

function catalogText(name: string, pluginNames: readonly string[]): string {
  return JSON.stringify({
    name,
    plugins: pluginNames.map((pluginName) => ({
      name: pluginName,
      source: `./plugins/${pluginName}`,
    })),
  });
}

describe("offeredPluginCount", () => {
  test("counts every entry of a catalog whose name matches the record", async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "counts-offered-");
    const manifestPath = path.join(root, "marketplace.json");
    await writeFile(manifestPath, catalogText("shelf", ["one", "two", "three"]), "utf8");

    // act
    const offered = await offeredPluginCount("shelf", pathSource(root), manifestPath);

    // assert
    assert.strictEqual(offered, 3);
  });

  test("returns no count for a catalog that is not valid JSON", async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "counts-unreadable-");
    const manifestPath = path.join(root, "marketplace.json");
    await writeFile(manifestPath, "{ torn", "utf8");

    // act
    const offered = await offeredPluginCount("shelf", pathSource(root), manifestPath);

    // assert
    assert.strictEqual(offered, undefined);
  });

  test("returns no count for a catalog name Claude Code refuses for the record (D-PL5-28)", async (t) => {
    // arrange
    const { root } = await createHermeticEnvironment(t, "counts-refused-");
    const manifestPath = path.join(root, "marketplace.json");
    await writeFile(manifestPath, catalogText("claude-plugins-v2", ["one"]), "utf8");

    // act
    const offered = await offeredPluginCount("official", pathSource(root), manifestPath);

    // assert
    assert.strictEqual(offered, undefined);
  });
});

describe("marketplaceDescription", () => {
  for (const { title, pluginCount, installedCount, expectedDescription } of [
    {
      title: "both counts before the source",
      pluginCount: 9,
      installedCount: 4,
      expectedDescription: "9 available • 4 installed -- /srv/shelf",
    },
    {
      title: "the available count alone when nothing is installed",
      pluginCount: 5,
      installedCount: 0,
      expectedDescription: "5 available -- /srv/shelf",
    },
    {
      title: "a zero available count for an empty catalog",
      pluginCount: 0,
      installedCount: 0,
      expectedDescription: "0 available -- /srv/shelf",
    },
    {
      title: "the installed count alone when the catalog has no count",
      pluginCount: undefined,
      installedCount: 6,
      expectedDescription: "6 installed -- /srv/shelf",
    },
    {
      title: "the source alone when there is no count",
      pluginCount: undefined,
      installedCount: 0,
      expectedDescription: "/srv/shelf",
    },
  ] as const satisfies readonly {
    title: string;
    pluginCount: number | undefined;
    installedCount: number;
    expectedDescription: string;
  }[]) {
    test(`words ${title}`, () => {
      // arrange
      const source = "/srv/shelf";

      // act
      const description = marketplaceDescription({ pluginCount, installedCount, source });

      // assert
      assert.strictEqual(description, expectedDescription);
    });
  }
});
