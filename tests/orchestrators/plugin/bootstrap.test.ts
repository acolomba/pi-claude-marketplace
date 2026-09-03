// Owner suite for orchestrators/plugin/bootstrap.ts.
//
// D-115-03: bootstrap's contract is the on-disk user scope it leaves behind, so
// every case drives the real `addMarketplace` + `setMarketplaceAutoupdate`
// composition against a case-owned temporary tree and fakes only the git
// remote. Notification bytes follow the compact MarketplaceRow forms of
// CMC-28 / CMC-30 / CMC-33; SNM-33 / D-22-01 / D-22-03 keep the `/reload`
// trailer off every marketplace-status-only block, because a marketplace
// record and its autoupdate flag are not Pi-visible resources.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { bootstrapClaudePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import { retryTree } from "./scope-tree-inventory.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

const BOOTSTRAP_REMOTE = "https://github.com/anthropics/claude-plugins-official.git";

function fixtureClaudePluginsOfficial(): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "_fixtures",
    "claude-plugins-official",
  );
}

interface BootstrapGitOptions {
  readonly cloneError?: Error;
}

/**
 * The single network edge. `allowedRemoteUrls` carries exactly the canonical
 * Anthropic remote, so any other remote fails the clone immediately; that
 * refusal, not the absence of a call, is what keeps these cases offline.
 */
function createBootstrapGitOps(options: BootstrapGitOptions = {}): {
  readonly gitOps: GitOps;
  readonly clonedUrls: () => readonly string[];
} {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [BOOTSTRAP_REMOTE],
    cloneFixture: { boundary: "local", sourceDir: fixtureClaudePluginsOfficial() },
    ...(options.cloneError === undefined ? {} : { cloneError: options.cloneError }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(cloneOptions) {
      // The fake records its arguments through `structuredClone`, and `auth`
      // carries credential callbacks, which are not structured-cloneable.
      const { auth: _auth, ...transportOptions } = cloneOptions;
      await git.gitOps.clone(transportOptions);
    },
  };

  return {
    gitOps,
    clonedUrls: () => git.state.calls.clone.map((call) => call.url),
  };
}

async function createHermeticUserScope(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly locations: ScopedLocations }> {
  const cwd = await mkdtemp(path.join(tmpdir(), `bootstrap-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `bootstrap-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { force: true, recursive: true });
    await rm(home, { force: true, recursive: true });
  });
  process.env.HOME = home;
  // SC-1: getAgentDir() reads PI_CODING_AGENT_DIR before homedir(), so an
  // environment that sets it would send user-scope writes to the developer's
  // real Pi agent directory despite the hermetic HOME above.
  delete process.env.PI_CODING_AGENT_DIR;
  return { cwd, locations: locationsFor("user", cwd) };
}

function addedMarketplaceRecord(cwd: string, marketplaceRoot: string): MarketplaceRecord {
  return {
    name: "claude-plugins-official",
    scope: "user",
    source: {
      kind: "github",
      raw: "anthropics/claude-plugins-official",
      owner: "anthropics",
      repo: "claude-plugins-official",
    },
    addedFromCwd: cwd,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {},
  };
}

/** SPLIT-01: the marketplace record lives in state, the autoupdate flag in config. */
async function seedAddedMarketplace(
  locations: ScopedLocations,
  cwd: string,
  autoupdate: boolean,
): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: { "claude-plugins-official": addedMarketplaceRecord(cwd, marketplaceRoot) },
  });
  await writeFile(
    locations.configJsonPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        marketplaces: {
          "claude-plugins-official": {
            source: "anthropics/claude-plugins-official",
            autoupdate,
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

/** Every path a clean bootstrap leaves under the user scope root. */
function bootstrappedScopeTree(): readonly string[] {
  return [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/sources/",
    "pi-claude-marketplace/sources/claude-plugins-official/",
    "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/",
    "pi-claude-marketplace/sources/claude-plugins-official/.claude-plugin/marketplace.json",
    "pi-claude-marketplace/sources-staging/",
    "pi-claude-marketplace/state.json",
  ];
}

/** The seeded tree plus the emptied staging directory the swallowed clone leaves. */
function seededScopeTree(): readonly string[] {
  return [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/sources-staging/",
    "pi-claude-marketplace/state.json",
  ];
}

test("adds the canonical marketplace and enables autoupdate on a clean user scope", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "clean");
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-02-03T04:05:06.000Z") });
  const marketplaceRoot = await locations.sourceCloneDir("claude-plugins-official");
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(2, 4);
  const { gitOps, clonedUrls } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    // UXG-04: a fresh autoupdate enable renders the marker as the outcome.
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {
      "claude-plugins-official": {
        ...addedMarketplaceRecord(cwd, marketplaceRoot),
        lastUpdatedAt: "2026-02-03T04:05:06.000Z",
      },
    },
  });
  // WB-04: both composed writes converge on one config entry.
  assert.deepStrictEqual(JSON.parse(await readFile(locations.configJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), bootstrappedScopeTree());
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("converges on a second bootstrap without changing the recorded state or the tree", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "repeat");
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(3, 6);
  const { gitOps, clonedUrls } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });
  const stateAfterFirst = await readFile(locations.stateJsonPath, "utf8");
  const configAfterFirst = await readFile(locations.configJsonPath, "utf8");
  const treeAfterFirst = await retryTree(locations.scopeRoot);
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
    // The duplicate-name error is swallowed, so the re-run's only signal is
    // the idempotent autoupdate row; its benign reason routes to info, which
    // the renderer emits with no severity argument (UXG-02 / UXG-04).
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateAfterFirst);
  assert.strictEqual(await readFile(locations.configJsonPath, "utf8"), configAfterFirst);
  assert.deepStrictEqual(treeAfterFirst, bootstrappedScopeTree());
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), treeAfterFirst);
  // WR-05: a github source derives its marketplace name from inside the cloned
  // manifest, so addMarketplace must clone before it can raise the duplicate
  // name; the idempotent re-run therefore clones once more by design.
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE, BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("reports an idempotent autoupdate when the marketplace is already bootstrapped", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "already");
  await seedAddedMarketplace(locations, cwd, true);
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const seededConfig = await readFile(locations.configJsonPath, "utf8");
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  // RECON-05: an idempotent flip skips the write-back, so the config stays byte-stable.
  assert.strictEqual(await readFile(locations.configJsonPath, "utf8"), seededConfig);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("flips autoupdate on when the marketplace is added but autoupdate is off", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "half");
  await seedAddedMarketplace(locations, cwd, false);
  const seededState = await readFile(locations.stateJsonPath, "utf8");
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(1, 2);
  const { gitOps, clonedUrls } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] <autoupdate>" },
  ]);
  assert.deepStrictEqual(JSON.parse(await readFile(locations.configJsonPath, "utf8")), {
    schemaVersion: 1,
    marketplaces: {
      "claude-plugins-official": {
        source: "anthropics/claude-plugins-official",
        autoupdate: true,
      },
    },
    plugins: {},
  });
  // WR-05: the flip is a config write-back only; state.json is never rewritten.
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededState);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});

test("writes into the user scope only and leaves the project scope absent", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "user-only");
  const projectLocations = locationsFor("project", cwd);
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(2, 4);
  const { gitOps } = createBootstrapGitOps();

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(await retryTree(projectLocations.scopeRoot), []);
  assert.deepStrictEqual(await loadState(projectLocations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), bootstrappedScopeTree());
  verifyBoundary();
});

test("propagates a clone failure silently and never reaches the autoupdate step", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "clone-failure");
  const { ctx, pi, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const { gitOps, clonedUrls } = createBootstrapGitOps({ cloneError: new Error("network down") });

  // act & assert
  await assert.rejects(bootstrapClaudePlugin({ ctx, pi, cwd, gitOps }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.strictEqual(error.message, "network down");
    return true;
  });
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(await loadState(locations.extensionRoot), {
    schemaVersion: 2,
    marketplaces: {},
  });
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), ["pi-claude-marketplace/"]);
  assert.deepStrictEqual(clonedUrls(), [BOOTSTRAP_REMOTE]);
  verifyBoundary();
});
