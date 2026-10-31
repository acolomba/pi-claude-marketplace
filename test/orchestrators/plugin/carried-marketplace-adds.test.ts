import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  carryUnsavedAdds,
  discardCarriedAdds,
  removeAddedClones,
  reusingCarriedAdds,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/carried-marketplace-adds.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type {
  AddedMarketplaces,
  CarriedAdd,
  MarketplaceAddSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/carried-marketplace-adds.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

function marketplaceRecord(name: string): MarketplaceRecord {
  return {
    name,
    scope: "project",
    source: pathSource(`./${name}`),
    addedFromCwd: "/work",
    manifestPath: `/work/${name}/.claude-plugin/marketplace.json`,
    marketplaceRoot: `/work/${name}`,
    plugins: {},
  };
}

function emptyState(): ExtensionState {
  return { schemaVersion: 2, marketplaces: {} };
}

function carried(name: string, cloneDir: string | undefined): CarriedAdd {
  return { marketplace: name, rawSource: `./${name}`, cloneDir, record: marketplaceRecord(name) };
}

async function locationsWithClone(
  t: TestContext,
  names: readonly string[],
): Promise<{ readonly locations: ScopedLocations; readonly cloneDirs: readonly string[] }> {
  const { cwd } = await createHermeticEnvironment(t, "carried-adds-");
  const locations = locationsFor("project", cwd);
  const cloneDirs = names.map((name) => path.join(locations.extensionRoot, "sources", name));
  await mkdir(path.join(locations.extensionRoot, "sources"), { recursive: true });
  await Promise.all(cloneDirs.map((dir) => mkdir(dir, { recursive: true })));
  return { locations, cloneDirs };
}

async function sources(locations: ScopedLocations): Promise<string[]> {
  return (await readdir(path.join(locations.extensionRoot, "sources"))).sort();
}

/** The `record` arguments of one add, for a source raw `raw`. */
function addArgs(
  state: ExtensionState,
  locations: ScopedLocations,
  raw: string,
): Parameters<MarketplaceAddSeam["record"]>[0] {
  return {
    state,
    locations,
    source: pathSource(raw),
    cwd: "/work",
    ctx: { mode: "tui", ui: { notify: () => undefined } },
    run: runWithNothingLoaded(),
    removalOps: createRemovalOps(),
  };
}

/** A seam whose every add is recorded and answers `{ name: "fresh" }`. */
function recordingSeam(): MarketplaceAddSeam & { readonly added: string[] } {
  const added: string[] = [];
  return {
    added,
    record: (args) => {
      added.push(args.source.raw);
      return Promise.resolve({ name: "fresh" });
    },
    settle: () => Promise.resolve(),
  };
}

describe("removeAddedClones", () => {
  test("removes each add's clone and reports no leak, a path source having none", async (t) => {
    // arrange
    const { locations, cloneDirs } = await locationsWithClone(t, ["up", "keep"]);

    // act
    const leaks = await removeAddedClones([{ cloneDir: cloneDirs[0] }, { cloneDir: undefined }]);

    // assert
    assert.deepStrictEqual(leaks, [undefined, undefined]);
    assert.deepStrictEqual(await sources(locations), ["keep"]);
  });

  test("reports a clone it cannot remove as a leak", async (t) => {
    // arrange
    const { locations } = await locationsWithClone(t, []);
    const blocker = path.join(locations.extensionRoot, "sources", "blocker");
    await writeFile(blocker, "a file where a directory should be");
    const cloneDir = path.join(blocker, "up");

    // act
    const leaks = await removeAddedClones([{ cloneDir }]);

    // assert
    assert.deepStrictEqual(
      leaks.map((leak) =>
        leak?.startsWith(`failed to clean up marketplace final clone ${cloneDir}`),
      ),
      [true],
    );
    assert.deepStrictEqual(await sources(locations), ["blocker"]);
  });
});

describe("reusingCarriedAdds", () => {
  test("records a kept source again from its entry, with no add, and answers its clone", async (t) => {
    // arrange
    const { locations, cloneDirs } = await locationsWithClone(t, ["up"]);
    const seam = recordingSeam();
    const kept = [carried("up", cloneDirs[0])];
    const state = emptyState();

    // act
    const added = await reusingCarriedAdds(seam, kept).record(addArgs(state, locations, "./up"));

    // assert
    assert.deepStrictEqual(added, { name: "up", cloneDir: cloneDirs[0] });
    assert.deepStrictEqual(state.marketplaces, { up: marketplaceRecord("up") });
    assert.deepStrictEqual(kept, []);
    assert.deepStrictEqual(seam.added, []);
  });

  test("answers no clone for a kept path source", async (t) => {
    // arrange
    const { locations } = await locationsWithClone(t, []);
    const kept = [carried("local", undefined)];

    // act
    const added = await reusingCarriedAdds(recordingSeam(), kept).record(
      addArgs(emptyState(), locations, "./local"),
    );

    // assert
    assert.deepStrictEqual(added, { name: "local" });
  });

  test("adds any other source through the seam and settles through it", async (t) => {
    // arrange
    const { locations } = await locationsWithClone(t, []);
    const seam = recordingSeam();
    const kept = [carried("up", undefined)];
    const reusing = reusingCarriedAdds(seam, kept);

    // act
    const added = await reusing.record(addArgs(emptyState(), locations, "./other"));

    // assert
    assert.deepStrictEqual(added, { name: "fresh" });
    assert.deepStrictEqual(seam.added, ["./other"]);
    assert.deepStrictEqual(kept, [carried("up", undefined)]);
    assert.strictEqual(reusing.settle, seam.settle);
  });
});

describe("carryUnsavedAdds", () => {
  test("keeps each add the state records and leaves the rest for removal", () => {
    // arrange
    const added: AddedMarketplaces = [
      { marketplace: "up", rawSource: "./up", cloneDir: "/clones/up" },
      { marketplace: "gone", rawSource: "./gone", cloneDir: "/clones/gone" },
    ];
    const state: ExtensionState = {
      schemaVersion: 2,
      marketplaces: { tools: marketplaceRecord("tools"), up: marketplaceRecord("up") },
    };
    const kept: CarriedAdd[] = [];

    // act
    carryUnsavedAdds(added, state, kept);

    // assert
    assert.deepStrictEqual(kept, [carried("up", "/clones/up")]);
    assert.deepStrictEqual(added, [
      { marketplace: "gone", rawSource: "./gone", cloneDir: "/clones/gone" },
    ]);
  });
});

describe("discardCarriedAdds", () => {
  test("removes the clone of a kept add no run recorded and keeps a recorded one", async (t) => {
    // arrange
    const { locations, cloneDirs } = await locationsWithClone(t, ["up", "recorded"]);
    await saveState(locations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: { recorded: marketplaceRecord("recorded") },
    });
    const kept = [carried("up", cloneDirs[0]), carried("recorded", cloneDirs[1])];

    // act
    await discardCarriedAdds(kept, locations);

    // assert
    assert.deepStrictEqual(kept, []);
    assert.deepStrictEqual(await sources(locations), ["recorded"]);
  });

  test("leaves a clone it cannot remove and does not throw", async (t) => {
    // arrange
    const { locations } = await locationsWithClone(t, []);
    const blocker = path.join(locations.extensionRoot, "sources", "blocker");
    await writeFile(blocker, "a file where a directory should be");
    const kept = [carried("up", path.join(blocker, "up"))];

    // act
    await discardCarriedAdds(kept, locations);

    // assert
    assert.deepStrictEqual(kept, []);
    assert.deepStrictEqual(await sources(locations), ["blocker"]);
  });

  test("keeps every clone when the state cannot be read, and does not throw", async (t) => {
    // arrange
    const { locations, cloneDirs } = await locationsWithClone(t, ["up"]);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.stateJsonPath, "{");
    const kept = [carried("up", cloneDirs[0])];

    // act
    await discardCarriedAdds(kept, locations);

    // assert
    assert.deepStrictEqual(kept, [carried("up", cloneDirs[0])]);
    assert.deepStrictEqual(await sources(locations), ["up"]);
  });
});
