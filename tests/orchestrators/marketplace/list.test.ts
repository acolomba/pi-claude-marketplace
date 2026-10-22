import assert from "node:assert/strict";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  githubSource,
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  listMarketplaces,
  loadMarketplaceListEntries,
} from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ListMarketplacesOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

interface CapturedNotification {
  readonly message: string;
  readonly severity?: NotificationSeverity;
}

interface NotificationBoundary {
  readonly ctx: ExtensionContext;
  readonly notifications: CapturedNotification[];
  readonly ui: NotificationUi;
}

interface TreeEntry {
  readonly contents?: string;
  readonly path: string;
  readonly type: "directory" | "file";
}

interface WorkspaceSnapshot {
  readonly cwd: readonly TreeEntry[];
  readonly home: readonly TreeEntry[];
}

function notificationBoundary(name: string, expectsNotification: boolean): NotificationBoundary {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: `${name} context` });
  const ui = mock<NotificationUi>({ exactParams: true, name: `${name} UI` });
  const notifications: CapturedNotification[] = [];
  if (expectsNotification) {
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(1);
    when(() => ctx.ui).thenReturn(ui);
    when(() => ui.notify).thenReturn((message, severity) => {
      notifications.push({ message, ...(severity === undefined ? {} : { severity }) });
    });
  }

  return { ctx, notifications, ui };
}

async function seedAutoupdate(
  locations: ScopedLocations,
  configPath: string,
  name: string,
  source: string,
  autoupdate: boolean,
): Promise<void> {
  await saveConfig(
    configPath,
    {
      schemaVersion: 1,
      marketplaces: { [name]: { autoupdate, source } },
    },
    locations.scopeRoot,
  );
}

async function seedMarketplaces(
  locations: ScopedLocations,
  records: readonly MarketplaceRecord[],
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: Object.fromEntries(records.map((record) => [record.name, record])),
  });
}

function pathRecord(
  cwd: string,
  name: string,
  scope: MarketplaceRecord["scope"],
  lastUpdatedAt?: string,
): MarketplaceRecord {
  return {
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, `${name}.json`),
    marketplaceRoot: path.join(cwd, name),
    name,
    plugins: {},
    scope,
    source: pathSource(`./${name}`),
    ...(lastUpdatedAt === undefined ? {} : { lastUpdatedAt }),
  };
}

function compareNames(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function snapshotTree(root: string): Promise<readonly TreeEntry[]> {
  const snapshot: TreeEntry[] = [];

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareNames(left.name, right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        snapshot.push({ path: relativePath, type: "directory" });
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        snapshot.push({
          contents: (await readFile(absolutePath)).toString("base64"),
          path: relativePath,
          type: "file",
        });
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

async function snapshotWorkspace(home: string, cwd: string): Promise<WorkspaceSnapshot> {
  return {
    cwd: await snapshotTree(cwd),
    home: await snapshotTree(home),
  };
}

async function withHermeticHome<T>(
  fn: (environment: { readonly cwd: string; readonly home: string }) => Promise<T>,
): Promise<T> {
  return withHermeticEnvironment("mp-list-", fn);
}

test("bare list emits only the empty-state sentinel without creating scope data", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const boundary = notificationBoundary("empty list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [{ message: "(no marketplaces)" }]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("explicit project list renders the exact one-row path-source notification", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "local-marketplace.json"),
        marketplaceRoot: path.join(cwd, "local-marketplace"),
        name: "local",
        plugins: {},
        scope: "project",
        source: pathSource("./local-marketplace"),
      },
    ]);
    const boundary = notificationBoundary("project path list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● local [project]\n\nMarketplace list: 1 success" },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("explicit project list renders one GitHub source without a source suffix", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "official-marketplace.json"),
        marketplaceRoot: path.join(cwd, "official-marketplace"),
        name: "official",
        plugins: {},
        scope: "project",
        source: githubSource("https://github.com/anthropics/claude-plugins-official"),
      },
    ]);
    const boundary = notificationBoundary("project GitHub list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● official [project]\n\nMarketplace list: 1 success" },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("local config overrides base config and renders the exact autoupdate marker", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "auto-marketplace.json"),
        marketplaceRoot: path.join(cwd, "auto-marketplace"),
        name: "auto",
        plugins: {},
        scope: "project",
        source: pathSource("./auto-marketplace"),
      },
    ]);
    await seedAutoupdate(
      locations,
      locations.baseConfigJsonPath,
      "auto",
      "./auto-marketplace",
      false,
    );
    await seedAutoupdate(
      locations,
      locations.localConfigJsonPath,
      "auto",
      "./auto-marketplace",
      true,
    );
    const boundary = notificationBoundary("autoupdate list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● auto [project] <autoupdate>\n\nMarketplace list: 1 success" },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("lastUpdatedAt remains stored but renders no timestamp or status marker", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        lastUpdatedAt: "2026-05-25T00:00:00Z",
        manifestPath: path.join(cwd, "dated-marketplace.json"),
        marketplaceRoot: path.join(cwd, "dated-marketplace"),
        name: "dated",
        plugins: {},
        scope: "project",
        source: pathSource("./dated-marketplace"),
      },
    ]);
    const boundary = notificationBoundary("last-updated list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● dated [project]\n\nMarketplace list: 1 success" },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("explicit user list renders only the user scope", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(home, "user-marketplace.json"),
        marketplaceRoot: path.join(home, "user-marketplace"),
        name: "user-only",
        plugins: {},
        scope: "user",
        source: pathSource("~/user-marketplace"),
      },
    ]);
    const boundary = notificationBoundary("user list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "user",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      { message: "● user-only [user]\n\nMarketplace list: 1 success" },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("bare list emits the exact many-row notification in project-then-user insertion order", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await seedMarketplaces(projectLocations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "zulu-path.json"),
        marketplaceRoot: path.join(cwd, "zulu-path"),
        name: "zulu-path",
        plugins: {},
        scope: "project",
        source: pathSource("./zulu-path"),
      },
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "alpha-github.json"),
        marketplaceRoot: path.join(cwd, "alpha-github"),
        name: "alpha-github",
        plugins: {},
        scope: "project",
        source: parsePluginSource("acme/alpha-github"),
      },
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "mike-url.json"),
        marketplaceRoot: path.join(cwd, "mike-url"),
        name: "mike-url",
        plugins: {},
        scope: "project",
        source: parsePluginSource("https://gitlab.com/acme/mike-url.git"),
      },
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "charlie-unknown.json"),
        marketplaceRoot: path.join(cwd, "charlie-unknown"),
        name: "charlie-unknown",
        plugins: {},
        scope: "project",
        source: parsePluginSource("not-a-source"),
      },
    ]);
    await seedMarketplaces(userLocations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(home, "echo-user.json"),
        marketplaceRoot: path.join(home, "echo-user"),
        name: "echo-user",
        plugins: {},
        scope: "user",
        source: pathSource("~/echo-user"),
      },
      {
        addedFromCwd: cwd,
        manifestPath: path.join(home, "delta-user.json"),
        marketplaceRoot: path.join(home, "delta-user"),
        name: "delta-user",
        plugins: {},
        scope: "user",
        source: githubSource("https://github.com/acme/delta-user"),
      },
    ]);
    const boundary = notificationBoundary("exact many-row list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message:
          "● zulu-path [project]\n\n● alpha-github [project]\n\n● mike-url [project]\n\n● charlie-unknown [project]\n\n● echo-user [user]\n\n● delta-user [user]\n\nMarketplace list: 6 successes",
      },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("invalid local config is ignored while the valid base autoupdate value renders", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await seedMarketplaces(locations, [
      {
        addedFromCwd: cwd,
        manifestPath: path.join(cwd, "fallback-marketplace.json"),
        marketplaceRoot: path.join(cwd, "fallback-marketplace"),
        name: "fallback",
        plugins: {},
        scope: "project",
        source: pathSource("./fallback-marketplace"),
      },
    ]);
    await seedAutoupdate(
      locations,
      locations.baseConfigJsonPath,
      "fallback",
      "./fallback-marketplace",
      true,
    );
    await writeFile(locations.localConfigJsonPath, "{ invalid local config", "utf8");
    const boundary = notificationBoundary("invalid local config list", true);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    await listMarketplaces(options);

    // assert
    assert.deepStrictEqual(boundary.notifications, [
      {
        message: "● fallback [project] <autoupdate>\n\nMarketplace list: 1 success",
      },
    ]);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

test("unsupported state schema rejects exactly without notifying or mutating the tree", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.stateJsonPath, '{"schemaVersion":99,"marketplaces":{}}', "utf8");
    const boundary = notificationBoundary("invalid state list", false);
    const options = {
      ctx: boundary.ctx,
      cwd,
      run: runWithNothingLoaded(),
      scope: "project",
    } satisfies ListMarketplacesOptions;
    const before = await snapshotWorkspace(home, cwd);

    // act
    const operation = listMarketplaces(options);

    // assert
    await assert.rejects(operation, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { cause: error.cause, message: error.message, name: error.name },
        {
          cause: undefined,
          message: `state.json at ${locations.stateJsonPath} has an unsupported schema version`,
          name: "Error",
        },
      );
      return true;
    });
    assert.deepStrictEqual(boundary.notifications, []);
    assert.deepStrictEqual(await snapshotWorkspace(home, cwd), before);
    verify(boundary.ctx);
    verify(boundary.ui);
  });
});

describe("loadMarketplaceListEntries", () => {
  test("returns one block per record in project-then-user insertion order", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedMarketplaces(locationsFor("project", cwd), [
        pathRecord(cwd, "proj-b", "project"),
        pathRecord(cwd, "proj-a", "project"),
      ]);
      await seedMarketplaces(locationsFor("user", cwd), [pathRecord(cwd, "user-a", "user")]);

      // act
      const blocks = (await loadMarketplaceListEntries({ cwd })).map((entry) => entry.block);

      // assert
      assert.deepStrictEqual(blocks, [
        { name: "proj-b", scope: "project", severity: "info", plugins: [] },
        { name: "proj-a", scope: "project", severity: "info", plugins: [] },
        { name: "user-a", scope: "user", severity: "info", plugins: [] },
      ]);
    });
  });

  test("pairs each block with the scope and state record it was built from", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedMarketplaces(locationsFor("project", cwd), [pathRecord(cwd, "proj-a", "project")]);
      await seedMarketplaces(locationsFor("user", cwd), [pathRecord(cwd, "user-a", "user")]);

      // act
      const entries = await loadMarketplaceListEntries({ cwd });

      // assert
      assert.deepStrictEqual(
        entries.map(({ scope, record, block }) => ({
          scope,
          record: record.name,
          block: block.name,
        })),
        [
          { scope: "project", record: "proj-a", block: "proj-a" },
          { scope: "user", record: "user-a", block: "user-a" },
        ],
      );
    });
  });

  test("returns only the requested scope's blocks", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      await seedMarketplaces(locationsFor("project", cwd), [pathRecord(cwd, "proj-a", "project")]);
      await seedMarketplaces(locationsFor("user", cwd), [pathRecord(cwd, "user-a", "user")]);

      // act
      const blocks = (await loadMarketplaceListEntries({ cwd, scope: "user" })).map(
        (entry) => entry.block,
      );

      // assert
      assert.deepStrictEqual(blocks, [
        { name: "user-a", scope: "user", severity: "info", plugins: [] },
      ]);
    });
  });

  test("carries autoupdate details when the merged config turns autoupdate on", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplaces(locations, [pathRecord(cwd, "auto", "project")]);
      await seedAutoupdate(locations, locations.baseConfigJsonPath, "auto", "./auto", true);

      // act
      const blocks = (await loadMarketplaceListEntries({ cwd, scope: "project" })).map(
        (entry) => entry.block,
      );

      // assert
      assert.deepStrictEqual(blocks, [
        {
          name: "auto",
          scope: "project",
          severity: "info",
          details: { autoupdate: true },
          plugins: [],
        },
      ]);
    });
  });

  test("carries the last-update time with autoupdate off", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplaces(locations, [
        pathRecord(cwd, "dated", "project", "2026-05-25T00:00:00Z"),
      ]);
      await seedAutoupdate(locations, locations.baseConfigJsonPath, "dated", "./dated", false);

      // act
      const blocks = (await loadMarketplaceListEntries({ cwd, scope: "project" })).map(
        (entry) => entry.block,
      );

      // assert
      assert.deepStrictEqual(blocks, [
        {
          name: "dated",
          scope: "project",
          severity: "info",
          details: { autoupdate: false, lastUpdatedAt: "2026-05-25T00:00:00Z" },
          plugins: [],
        },
      ]);
    });
  });

  test("omits details when autoupdate is off and no last-update time is recorded", async () => {
    await withHermeticHome(async ({ cwd }) => {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedMarketplaces(locations, [pathRecord(cwd, "plain", "project")]);
      await seedAutoupdate(locations, locations.baseConfigJsonPath, "plain", "./plain", false);

      // act
      const blocks = (await loadMarketplaceListEntries({ cwd, scope: "project" })).map(
        (entry) => entry.block,
      );

      // assert
      assert.deepStrictEqual(blocks, [
        { name: "plain", scope: "project", severity: "info", plugins: [] },
      ]);
    });
  });
});
