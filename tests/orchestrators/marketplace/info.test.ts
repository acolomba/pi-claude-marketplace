import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  githubSource,
  parsePluginSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { getMarketplaceInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotificationExpectation {
  readonly message: string;
  readonly severity?: "error" | "info" | "warning";
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface TreeEntry {
  readonly contents?: string;
  readonly kind: "directory" | "file";
  readonly relativePath: string;
}

function marketplaceRecord(
  values: Pick<
    MarketplaceRecord,
    "addedFromCwd" | "manifestPath" | "marketplaceRoot" | "name" | "scope" | "source"
  > &
    Partial<Pick<MarketplaceRecord, "lastUpdatedAt">>,
): MarketplaceRecord {
  return { ...values, plugins: {} };
}

function notificationBoundary(expectation?: NotificationExpectation): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  verifyAll(): void;
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  if (expectation !== undefined) {
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => pi.getAllTools())
      .thenReturn([])
      .twice();
    if (expectation.severity === undefined) {
      when(() => {
        ui.notify(expectation.message);
      }).thenReturn(undefined);
    } else {
      when(() => {
        ui.notify(expectation.message, expectation.severity);
      }).thenReturn(undefined);
    }
  }

  return {
    ctx,
    pi,
    verifyAll(): void {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
}

function multiNotificationBoundary(expectations: readonly NotificationExpectation[]): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  verifyAll(): void;
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(expectations.length);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(expectations.length * 2);
  for (const expectation of expectations) {
    if (expectation.severity === undefined) {
      when(() => {
        ui.notify(expectation.message);
      }).thenReturn(undefined);
    } else {
      when(() => {
        ui.notify(expectation.message, expectation.severity);
      }).thenReturn(undefined);
    }
  }

  return {
    ctx,
    pi,
    verifyAll(): void {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
}

async function saveMarketplace(
  locations: ScopedLocations,
  record: MarketplaceRecord,
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: { [record.name]: record },
  });
}

async function seedConfigAutoupdate(
  locations: ScopedLocations,
  name: string,
  source: string,
  autoupdate: boolean,
): Promise<void> {
  await saveConfig(
    locations.configJsonPath,
    { schemaVersion: 1, marketplaces: { [name]: { source, autoupdate } } },
    locations.scopeRoot,
  );
}

async function snapshotTree(root: string): Promise<readonly TreeEntry[]> {
  const entries: TreeEntry[] = [];
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const relativePath = path.relative(root, absolutePath);
      if (child.isDirectory()) {
        entries.push({ kind: "directory", relativePath });
        await visit(absolutePath);
      } else {
        entries.push({
          contents: await readFile(absolutePath, "utf8"),
          kind: "file",
          relativePath,
        });
      }
    }
  }

  await visit(root);
  return entries;
}

async function snapshotEnvironment(
  home: string,
  cwd: string,
): Promise<{
  readonly cwd: readonly TreeEntry[];
  readonly home: readonly TreeEntry[];
}> {
  return { cwd: await snapshotTree(cwd), home: await snapshotTree(home) };
}

async function withHermeticHome<T>(
  fn: (environment: { readonly cwd: string; readonly home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "mp-info-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-info-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ cwd, home });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

async function writeMarketplaceJson(
  manifestPath: string,
  name: string,
  description?: string,
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const manifest: Record<string, unknown> = { name, plugins: [] };
  if (description !== undefined) {
    manifest.description = description;
  }

  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
}

test("INFO-01: an explicit user github source renders all optional fields", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "official.json");
    await writeMarketplaceJson(
      manifestPath,
      "claude-plugins-official",
      "Official Claude plugin marketplace.",
    );
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        lastUpdatedAt: "2026-06-03T00:00:00Z",
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/claude-plugins-official",
        name: "claude-plugins-official",
        scope: "user",
        source: githubSource("https://github.com/anthropics/claude-plugins-official#main"),
      }),
    );
    await seedConfigAutoupdate(
      locations,
      "claude-plugins-official",
      "anthropics/claude-plugins-official",
      true,
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "● claude-plugins-official [user] <autoupdate>",
        "github: anthropics/claude-plugins-official#main",
        "last_updated: 2026-06-03T00:00:00Z",
        "description: Official Claude plugin marketplace.",
      ].join("\n"),
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "claude-plugins-official",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-01: an explicit user github source omits absent optional fields", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "community.json");
    await writeMarketplaceJson(manifestPath, "community-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/community-mp",
        name: "community-mp",
        scope: "user",
        source: githubSource("https://github.com/someuser/community-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: "● community-mp [user] <no autoupdate>\ngithub: someuser/community-mp",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "community-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("MURL-05: an explicit user URL source renders all optional fields", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "acme.json");
    await writeMarketplaceJson(manifestPath, "acme-mp", "An ACME marketplace hosted on GitLab.");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        lastUpdatedAt: "2026-06-03T00:00:00Z",
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/acme-mp",
        name: "acme-mp",
        scope: "user",
        source: parsePluginSource("https://gitlab.com/acme/mp#main"),
      }),
    );
    await seedConfigAutoupdate(locations, "acme-mp", "https://gitlab.com/acme/mp#main", true);
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "● acme-mp [user] <autoupdate>",
        "url: https://gitlab.com/acme/mp#main",
        "last_updated: 2026-06-03T00:00:00Z",
        "description: An ACME marketplace hosted on GitLab.",
      ].join("\n"),
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "acme-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("MURL-05: an explicit user URL source omits absent optional fields", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "acme.json");
    await writeMarketplaceJson(manifestPath, "acme-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/acme-mp",
        name: "acme-mp",
        scope: "user",
        source: parsePluginSource("https://gitlab.com/acme/mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: "● acme-mp [user] <no autoupdate>\nurl: https://gitlab.com/acme/mp",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "acme-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-01: an explicit project path source renders its minimal block", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const manifestPath = path.join(locations.extensionRoot, "local.json");
    await writeMarketplaceJson(manifestPath, "local-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/local-mp",
        name: "local-mp",
        scope: "project",
        source: pathSource("/home/user/marketplaces/local-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: "● local-mp [project] <no autoupdate>\npath: /home/user/marketplaces/local-mp",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "local-mp",
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-01: a user path source renders description independently of source kind", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "dev.json");
    await writeMarketplaceJson(
      manifestPath,
      "dev-mp",
      "Local development marketplace; experimental plugins.",
    );
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        lastUpdatedAt: "2026-06-03T00:00:00Z",
        manifestPath,
        marketplaceRoot: "/home/user/src/dev-mp",
        name: "dev-mp",
        scope: "user",
        source: pathSource("/home/user/src/dev-mp"),
      }),
    );
    await seedConfigAutoupdate(locations, "dev-mp", "/home/user/src/dev-mp", true);
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "● dev-mp [user] <autoupdate>",
        "path: /home/user/src/dev-mp",
        "description: Local development marketplace; experimental plugins.",
      ].join("\n"),
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "dev-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("NFR-12: an unknown stored source falls back to the recorded marketplace root", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "future.json");
    await writeMarketplaceJson(manifestPath, "future-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/future-mp",
        name: "future-mp",
        scope: "user",
        source: { kind: "unknown", raw: "npm:future-mp@1", reason: "future source" },
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: "● future-mp [user] <no autoupdate>\npath: /home/user/marketplaces/future-mp",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "future-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-03: implicit scope renders project then user in one notification", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const projectManifestPath = path.join(projectLocations.extensionRoot, "my-mp.json");
    const userManifestPath = path.join(userLocations.extensionRoot, "my-mp.json");
    await writeMarketplaceJson(projectManifestPath, "my-mp");
    await writeMarketplaceJson(userManifestPath, "my-mp");
    await saveMarketplace(
      projectLocations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath: projectManifestPath,
        marketplaceRoot: "/repo/path/my-mp",
        name: "my-mp",
        scope: "project",
        source: pathSource("/repo/path/my-mp"),
      }),
    );
    await seedConfigAutoupdate(projectLocations, "my-mp", "/repo/path/my-mp", true);
    await saveMarketplace(
      userLocations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath: userManifestPath,
        marketplaceRoot: "/home/user/marketplaces/my-mp",
        name: "my-mp",
        scope: "user",
        source: githubSource("https://github.com/someuser/my-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "● my-mp [project] <autoupdate>",
        "path: /repo/path/my-mp",
        "",
        "● my-mp [user] <no autoupdate>",
        "github: someuser/my-mp",
      ].join("\n"),
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "my-mp",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-04: explicit user scope ignores a project-only marketplace", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const manifestPath = path.join(locations.extensionRoot, "my-mp.json");
    await writeMarketplaceJson(manifestPath, "my-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/repo/path/my-mp",
        name: "my-mp",
        scope: "project",
        source: pathSource("/repo/path/my-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ my-mp [user] (failed) {marketplace not added to user scope}",
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "my-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("INFO-04: explicit project scope ignores a user-only marketplace", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "my-mp.json");
    await writeMarketplaceJson(manifestPath, "my-mp");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/my-mp",
        name: "my-mp",
        scope: "user",
        source: pathSource("/home/user/marketplaces/my-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message:
        "A marketplace operation has failed.\n\n⊘ my-mp [project] (failed) {marketplace not added to project scope}",
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "my-mp",
      scope: "project",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("D-03: implicit scope renders an absent marketplace without a scope bracket", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {marketplace not added}",
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "ghost-mp",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("manifest absence renders the complete source-missing failure envelope", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "missing-mp.json");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/missing-mp",
        name: "missing-mp",
        scope: "user",
        source: pathSource("/home/user/marketplaces/missing-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "A plugin operation has failed.",
        "",
        "● missing-mp [user] <no autoupdate>",
        "  ⊘ missing-mp (failed) {source missing}",
        "    components: not resolved",
      ].join("\n"),
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "missing-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("malformed manifest JSON renders the complete unparseable failure envelope", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "bad-mp.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, "{ not valid json", "utf8");
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/bad-mp",
        name: "bad-mp",
        scope: "user",
        source: pathSource("/home/user/marketplaces/bad-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "A plugin operation has failed.",
        "",
        "● bad-mp [user] <no autoupdate>",
        "  ⊘ bad-mp (failed) {unparseable}",
        "    components: not resolved",
      ].join("\n"),
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "bad-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("schema-invalid manifest JSON renders the catalog invalid-manifest envelope", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("user", cwd);
    const manifestPath = path.join(locations.extensionRoot, "bad-mp.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify({ name: "bad-mp", plugins: "not-an-array" }),
      "utf8",
    );
    await saveMarketplace(
      locations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: "/home/user/marketplaces/bad-mp",
        name: "bad-mp",
        scope: "user",
        source: pathSource("/home/user/marketplaces/bad-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary({
      message: [
        "A plugin operation has failed.",
        "",
        "● bad-mp [user] <no autoupdate>",
        "  ⊘ bad-mp (failed) {invalid manifest}",
        "    components: not resolved",
      ].join("\n"),
      severity: "error",
    });

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "bad-mp",
      scope: "user",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("implicit scope emits a healthy project block before a failed user block", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    const projectManifestPath = path.join(projectLocations.extensionRoot, "mixed.json");
    const userManifestPath = path.join(userLocations.extensionRoot, "mixed.json");
    await writeMarketplaceJson(projectManifestPath, "mixed-mp");
    await saveMarketplace(
      projectLocations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath: projectManifestPath,
        marketplaceRoot: "/repo/path/mixed-mp",
        name: "mixed-mp",
        scope: "project",
        source: pathSource("/repo/path/mixed-mp"),
      }),
    );
    await saveMarketplace(
      userLocations,
      marketplaceRecord({
        addedFromCwd: cwd,
        manifestPath: userManifestPath,
        marketplaceRoot: "/home/user/marketplaces/mixed-mp",
        name: "mixed-mp",
        scope: "user",
        source: pathSource("/home/user/marketplaces/mixed-mp"),
      }),
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = multiNotificationBoundary([
      {
        message: "● mixed-mp [project] <no autoupdate>\npath: /repo/path/mixed-mp",
      },
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● mixed-mp [user] <no autoupdate>",
          "  ⊘ mixed-mp (failed) {source missing}",
          "    components: not resolved",
        ].join("\n"),
        severity: "error",
      },
    ]);

    // act
    await getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "mixed-mp",
      cwd,
    });

    // assert
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});

test("a malformed stored marketplace record rejects without notifying or mutating files", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      path.join(locations.extensionRoot, "state.json"),
      JSON.stringify({
        schemaVersion: 2,
        marketplaces: {
          "broken-mp": {
            addedFromCwd: cwd,
            manifestPath: path.join(locations.extensionRoot, "broken-mp.json"),
            marketplaceRoot: "/repo/path/broken-mp",
            name: "broken-mp",
            plugins: {},
            scope: "project",
            source: {},
          },
        },
      }),
      "utf8",
    );
    const before = await snapshotEnvironment(home, cwd);
    const boundary = notificationBoundary();

    // act
    const result = getMarketplaceInfo({
      ctx: boundary.ctx,
      pi: boundary.pi,
      name: "broken-mp",
      scope: "project",
      cwd,
    });

    // assert
    await assert.rejects(
      result,
      new Error(
        'state.json marketplace "broken-mp" has malformed source object (missing kind/raw)',
      ),
    );
    assert.deepEqual(await snapshotEnvironment(home, cwd), before);
    boundary.verifyAll();
  });
});
