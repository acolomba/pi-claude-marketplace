// test/integration/marketplace-layer-redeclare.test.ts
//
// Re-declaring a marketplace across a scope's two config layers (LAYER-01),
// through the add orchestrator, the config writer, the state file, and the git
// boundary. A re-declaration reuses the scope's record and clone, so it makes
// no git call and asks the credential helper nothing (NFR-5).

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { saveConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { pathExists } from "../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { createNotificationBoundary } from "../edge/notification-boundary.ts";
import { createCredentialOpsFake } from "../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { NotificationBoundary } from "../edge/notification-boundary.ts";

const REPO_URL = "https://example.com/acme/mp";

const MP_DECLARED = `{
  "schemaVersion": 1,
  "marketplaces": {
    "mp": {
      "source": "https://example.com/acme/mp"
    }
  }
}
`;

interface ProjectScope {
  readonly cwd: string;
  readonly locations: ScopedLocations;
  readonly fixture: string;
}

/** A project scope in a case-owned Pi environment, and a checkout that offers `mp`. */
async function projectScope(t: TestContext, prefix: string): Promise<ProjectScope> {
  const { cwd, root } = await createHermeticEnvironment(t, prefix);
  const fixture = path.join(root, "checkout");
  await mkdir(path.join(fixture, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(fixture, ".claude-plugin", "marketplace.json"),
    JSON.stringify({ name: "mp", plugins: [] }),
  );
  return { cwd, locations: locationsFor("project", cwd), fixture };
}

/** Adds `REPO_URL` through its own git and credential fakes, which the case then inspects. */
async function addRepo(
  scope: ProjectScope,
  boundary: NotificationBoundary,
  local: boolean,
): Promise<{
  readonly git: ReturnType<typeof createGitOpsFake>;
  readonly credentials: ReturnType<typeof createCredentialOpsFake>;
}> {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: [REPO_URL],
    cloneFixture: { boundary: "local", sourceDir: scope.fixture },
  });
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  await addMarketplace({
    ctx: boundary.ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd: scope.cwd,
    completionCache: createCompletionCache(),
    rawSource: REPO_URL,
    gitOps: git.gitOps,
    credentialOps: credentials.credentialOps,
    local,
  });
  return { git, credentials };
}

const NO_GIT_CALLS = {
  checkout: [],
  clone: [],
  currentBranch: [],
  fetch: [],
  forceUpdateRef: [],
  resolveRef: [],
  resolveRemoteRef: [],
};

test("declares a url marketplace in the local layer with one clone in total", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-redeclare-");
  const boundary = createNotificationBoundary(2);
  const first = await addRepo(scope, boundary, false);
  const stateBefore = await readFile(scope.locations.stateJsonPath, "utf8");

  // act
  const second = await addRepo(scope, boundary, true);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project] (added)" },
    { message: "● mp [project] (added)" },
  ]);
  assert.strictEqual(await readFile(scope.locations.baseConfigJsonPath, "utf8"), MP_DECLARED);
  assert.strictEqual(await readFile(scope.locations.localConfigJsonPath, "utf8"), MP_DECLARED);
  assert.strictEqual(await readFile(scope.locations.stateJsonPath, "utf8"), stateBefore);
  assert.deepStrictEqual(
    first.git.state.calls.clone.map(({ url }) => url),
    [REPO_URL],
  );
  assert.deepStrictEqual(second.git.state.calls, NO_GIT_CALLS);
  assert.deepStrictEqual(second.credentials.calls, { approve: [], fill: [], reject: [] });
  boundary.verifyBoundary();
});

test("declares again a url marketplace the scope records but no layer declares", async (t) => {
  // arrange
  const scope = await projectScope(t, "mp-layer-undeclared-");
  const boundary = createNotificationBoundary(2);
  await addRepo(scope, boundary, false);
  await saveConfig(
    scope.locations.baseConfigJsonPath,
    { schemaVersion: 1, marketplaces: {} },
    scope.locations.scopeRoot,
  );
  const stateBefore = await readFile(scope.locations.stateJsonPath, "utf8");

  // act
  const second = await addRepo(scope, boundary, false);

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project] (added)" },
    { message: "● mp [project] (added)" },
  ]);
  assert.strictEqual(await readFile(scope.locations.baseConfigJsonPath, "utf8"), MP_DECLARED);
  assert.strictEqual(await pathExists(scope.locations.localConfigJsonPath), false);
  assert.strictEqual(await readFile(scope.locations.stateJsonPath, "utf8"), stateBefore);
  assert.deepStrictEqual(second.git.state.calls, NO_GIT_CALLS);
  assert.deepStrictEqual(second.credentials.calls, { approve: [], fill: [], reject: [] });
  boundary.verifyBoundary();
});
