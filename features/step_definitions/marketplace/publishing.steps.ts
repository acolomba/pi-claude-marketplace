/**
 * @fileoverview Steps that publish local marketplaces by source kind and add
 * them to a scope, shared by every marketplace verb.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { readOfferedPlugins } from "../../lib/path-marketplace.ts";
import { runCommand } from "../../lib/pi-commands.ts";
import { publishMarketplace } from "../../lib/published-marketplace.ts";

import type { OfferedPlugin } from "../../lib/path-marketplace.ts";
import type { PublishedMarketplace, SourceKind } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Publishes the marketplace `name` as a `kind` source and records it, so a
// later step adds the marketplace through the source it was published as.
async function publish(
  world: ScenarioWorld,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  const root = path.join(world.marketplacesRoot, name);
  world.onRelease(() => rm(root, { recursive: true, force: true }));
  world.recordPublished(
    name,
    await publishMarketplace(world.marketplacesRoot, name, kind, plugins),
  );
}

function requirePublished(world: ScenarioWorld, name: string): PublishedMarketplace {
  const published = world.publishedMarketplace(name);
  if (published === undefined) {
    assert.fail(`the marketplace ${name} is not published in this scenario`);
  }

  return published;
}

Given(
  "the marketplace {string} is published as a {source kind} source",
  async function (this: ScenarioWorld, name: string, kind: SourceKind) {
    await publish(this, name, kind, []);
  },
);

Given(
  "the marketplace {string} offers these plugins:",
  async function (this: ScenarioWorld, name: string, table: DataTable) {
    const kind = this.publishedMarketplace(name)?.kind ?? "dir";
    await publish(this, name, kind, readOfferedPlugins(table));
  },
);

Given(
  "the marketplace {string} is added to the {word} scope",
  async function (this: ScenarioWorld, name: string, scope: string) {
    const { source } = requirePublished(this, name);
    const payload = await runCommand(
      this.pi,
      `/claude:plugin marketplace add ${source} --scope ${scope}`,
    );
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  },
);
