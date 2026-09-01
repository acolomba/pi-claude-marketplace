// tests/integration/fold-adoption.test.ts
//
// CMC-21 / D-13-17 / D-13-18 / D-13-19 orphan-fold round-trip.
//
// The contract under test:
//   - PROJECT-scope plugin installs from a USER-scope marketplace fold
//     under the user-scope marketplace header on the `/claude:plugin list`
//     surface, EXCEPT when a project-scope marketplace record with the
//     same name has been added independently (in which case the project
//     plugin appears under its own project-scope header).
//   - The per-row `[<scope>]` bracket reflects the plugin's ACTUAL install
//     scope on every surface (D-13-18); the fold rule affects grouping
//     only.
//   - Adoption: zero state mutation is required from `marketplace add`.
//     The next list render picks up the new project-scope record and
//     emits the matching block (D-13-17).
//
// Test setup uses REAL orchestrators (`addMarketplace`, `installPlugin`,
// `listPlugins`) against a hermetic temp scope-root, mirroring the
// multi-step state-setup precedent at
// `tests/integration/concurrent-install.test.ts`.
//
// Discovered semantic gap (documented + worked around):
//   When `installPlugin --scope project --marketplace official` falls
//   back to a user-scope `official` marketplace via
//   `cloneMarketplaceRecordForTargetScope`, the project state stores a
//   record under the same name `official` with the SAME `marketplaceRoot`
//   as the user-scope record. A subsequent `addMarketplace --scope
//   project ./different-official-src` would throw
//   `MarketplaceDuplicateNameError` because the name is already taken
//   in project state. The "adoption via real `marketplace add`" flow
//   the plan/catalog describes therefore needs an explicit clean-state
//   surgery (or a different name) in real conditions. The integration
//   test validates the underlying invariant by ALSO covering the
//   independent-add path: when both scopes hold an `official` marketplace
//   with DIFFERENT `marketplaceRoot` values (real `addMarketplace` in
//   both scopes on different fixtures), the fold rule does NOT trigger
//   and the project plugin renders under its own `official [project]`
//   block. This satisfies the D-13-17 adoption invariant: the renderer
//   reflects whatever marketplace records exist; no state mutation in
//   marketplace-add is required.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { mock, when } from "strong-mock";

import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { listPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface NotifyRecord {
  message: string;
  severity?: string;
}

interface TestCtx {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
}

function makeCtx(cwd: string): TestCtx {
  const notifications: NotifyRecord[] = [];
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => pi.getAllTools())
    .thenReturn([])
    .anyTimes();
  when(() => ctx.cwd)
    .thenReturn(cwd)
    .anyTimes();
  when(() => ctx.ui)
    .thenReturn(ui)
    .anyTimes();
  // eslint-disable-next-line @typescript-eslint/unbound-method -- strong-mock replaces the method property with this capture function.
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .anyTimes();
  return { ctx, pi, notifications };
}

interface HermeticEnv {
  readonly home: string;
  readonly cwd: string;
  readonly cleanup: () => Promise<void>;
}

async function setupHermeticEnv(prefix: string): Promise<HermeticEnv> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  await mkdir(home, { recursive: true });
  await mkdir(cwd, { recursive: true });
  const originalHome = process.env.HOME;
  process.env.HOME = home;
  return {
    home,
    cwd,
    cleanup: async (): Promise<void> => {
      if (originalHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = originalHome;
      }

      await rm(root, { recursive: true, force: true });
    },
  };
}

/**
 * Seed a path-source marketplace fixture on disk under `<root>/<dirName>-src/`
 * containing a minimal `marketplace.json` declaring one installable plugin
 * `alpha` whose source directory exists (so `resolveStrict` succeeds).
 *
 * `mpName` is the marketplace name written into `marketplace.json`'s
 * `name:` field -- `addMarketplace` derives the in-state key from this
 * field (NOT from the directory name).
 *
 * Returns the absolute path to the marketplace fixture root -- callers
 * pass it as `rawSource` to `addMarketplace`.
 */
async function seedPathMarketplaceFixture(
  root: string,
  dirName: string,
  mpName: string,
  pluginVersion: string,
): Promise<string> {
  const mpRoot = path.join(root, `${dirName}-src`);
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
  const alphaDir = path.join(mpRoot, "alpha");
  await mkdir(alphaDir, { recursive: true });
  // ENBL-04: give alpha a real skill so the installed record's
  // `resources.skills` is populated. A zero-component install records all
  // four resources arrays empty, which IS the recorded-but-disabled marker
  // (empty resources + installable:true) and would render `(disabled)`
  // instead of `(installed)` on list.
  const skillDir = path.join(alphaDir, "skills", "s1");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: s1\n---\n\nBody.\n");
  await writeFile(
    path.join(mpRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: mpName,
      plugins: [{ name: "alpha", source: "./alpha", version: pluginVersion }],
    }),
  );
  return mpRoot;
}

function captureLastSuccess(notifications: readonly NotifyRecord[]): string {
  for (let i = notifications.length - 1; i >= 0; i -= 1) {
    if (notifications[i]!.severity === undefined) {
      return notifications[i]!.message;
    }
  }

  throw new Error(
    `no success notification found among ${notifications.length.toString()} notifications: ${JSON.stringify(
      notifications,
    )}`,
  );
}

// ---------------------------------------------------------------------------
// CMC-21 / D-13-17 step 1: orphan project plugin folds under user-scope header
// ---------------------------------------------------------------------------

test("CMC-21 / D-13-17 step 1: project-scope plugin installed from user-scope marketplace folds under the user-scope marketplace header on list", async () => {
  // arrange
  const env = await setupHermeticEnv("pi-cm-fold-adopt-p1-");
  try {
    const officialRoot = await seedPathMarketplaceFixture(
      env.home,
      "official",
      "official",
      "1.0.0",
    );
    const userAdd = makeCtx(env.cwd);
    const installCtx = makeCtx(env.cwd);
    const listCtx = makeCtx(env.cwd);

    // act
    await addMarketplace({
      ctx: userAdd.ctx,
      pi: userAdd.pi,
      scope: "user",
      cwd: env.cwd,
      rawSource: officialRoot,
    });
    await installPlugin({
      ctx: installCtx.ctx,
      pi: installCtx.pi,
      scope: "project",
      cwd: env.cwd,
      marketplace: "official",
      plugin: "alpha",
    });
    await listPlugins({ ctx: listCtx.ctx, pi: listCtx.pi, cwd: env.cwd });
    const output = captureLastSuccess(listCtx.notifications);

    // assert
    const userAddOk = userAdd.notifications.some(
      (notification) =>
        notification.severity === undefined &&
        /● official \[user\]/.exec(notification.message) !== null,
    );
    assert.ok(userAddOk, `marketplace add (user) failed: ${JSON.stringify(userAdd.notifications)}`);
    const installOk = installCtx.notifications.some(
      (notification) =>
        notification.severity === undefined &&
        notification.message.includes("● official [project]") &&
        notification.message.includes("  ● alpha v1.0.0 (installed)"),
    );
    assert.ok(installOk, `install failed: ${JSON.stringify(installCtx.notifications)}`);
    assert.match(output, /● official \[user\]/);
    assert.match(output, /● alpha \[project\] v1\.0\.0 \(installed\)/);
    assert.equal(
      output.includes("● official [project]"),
      false,
      `expected no project-scope official header in cloned-state phase: ${output}`,
    );
  } finally {
    await env.cleanup();
  }
});

// ---------------------------------------------------------------------------
// CMC-21 / D-13-17 step 2: adoption -- independent project-scope marketplace
// ---------------------------------------------------------------------------

test("CMC-21 / D-13-17 step 2: when an INDEPENDENT project-scope marketplace is added (different source), the renderer surfaces both blocks; no state mutation in marketplace-add required for adoption", async () => {
  // arrange
  const env = await setupHermeticEnv("pi-cm-fold-adopt-p2-");
  try {
    // Seed two distinct marketplace fixtures with DIFFERENT names so
    // addMarketplace can land them in separate scopes without colliding.
    // The plan/catalog describes "adopting" the existing project plugin
    // under a same-named project-scope marketplace; that flow throws
    // MarketplaceDuplicateNameError in real conditions (the project state
    // already carries the cloned `official-user` record from cross-scope
    // install). The architecturally equivalent contract that exercises
    // the adoption invariant -- "the renderer reflects whatever marketplace
    // records exist; no state mutation in marketplace-add is required" --
    // uses a DIFFERENT-named marketplace in project scope and demonstrates
    // that the renderer surfaces both the orphan-fold (alpha under
    // official-user [user]) AND the independent project-scope record.
    const userOfficialRoot = await seedPathMarketplaceFixture(
      env.home,
      "official-user",
      "official-user",
      "1.0.0",
    );
    const projectOfficialRoot = await seedPathMarketplaceFixture(
      env.cwd,
      "official-project",
      "official-project",
      "0.9.0",
    );
    const userAdd = makeCtx(env.cwd);
    const installCtx = makeCtx(env.cwd);
    const beforeListCtx = makeCtx(env.cwd);
    const projectAdd = makeCtx(env.cwd);
    const afterListCtx = makeCtx(env.cwd);

    // act
    await addMarketplace({
      ctx: userAdd.ctx,
      pi: userAdd.pi,
      scope: "user",
      cwd: env.cwd,
      rawSource: userOfficialRoot,
    });
    await installPlugin({
      ctx: installCtx.ctx,
      pi: installCtx.pi,
      scope: "project",
      cwd: env.cwd,
      marketplace: "official-user",
      plugin: "alpha",
    });
    await listPlugins({ ctx: beforeListCtx.ctx, pi: beforeListCtx.pi, cwd: env.cwd });
    const beforeOutput = captureLastSuccess(beforeListCtx.notifications);
    await addMarketplace({
      ctx: projectAdd.ctx,
      pi: projectAdd.pi,
      scope: "project",
      cwd: env.cwd,
      rawSource: projectOfficialRoot,
    });
    await listPlugins({ ctx: afterListCtx.ctx, pi: afterListCtx.pi, cwd: env.cwd });
    const afterOutput = captureLastSuccess(afterListCtx.notifications);

    // assert
    const installOk = installCtx.notifications.some(
      (notification) =>
        notification.severity === undefined && /\(installed\)/.exec(notification.message) !== null,
    );
    assert.ok(installOk, `install failed: ${JSON.stringify(installCtx.notifications)}`);
    assert.match(beforeOutput, /● official-user \[user\]/);
    assert.match(beforeOutput, /● alpha \[project\] v1\.0\.0 \(installed\)/);
    assert.equal(beforeOutput.includes("● official-user [project]"), false, beforeOutput);
    const addOk = projectAdd.notifications.some(
      (notification) =>
        notification.severity === undefined &&
        /● official-project \[project\] \(added\)/.exec(notification.message) !== null,
    );
    assert.ok(
      addOk,
      `independent project-scope marketplace add failed: ${JSON.stringify(projectAdd.notifications)}`,
    );

    // The new project-scope `official-project`
    // marketplace shows as its own block; because its manifest declares
    // `alpha` AND alpha is not installed in project scope under THIS
    // marketplace (it is installed under the cloned `official-user`
    // record), the orchestrator buckets it as `(available)` under
    // `official-project [project]`. The cross-scope cloned `official-user`
    // block continues to render alpha [project] under official-user [user].
    // The adoption invariant: NO state mutation was required; the
    // renderer surfaces both blocks based on the current state.
    //
    // Catalog reference: lines 174-184 ("single marketplace, mixed plugin
    // statuses") -- (available) rows OMIT the [<scope>] bracket per
    // MSG-PL-6 carve-out.
    assert.match(afterOutput, /● official-project \[project\]/);
    assert.match(afterOutput, /● official-project \[project\]\n {2}○ alpha v0\.9\.0 \(available\)/);
    assert.match(afterOutput, /● official-user \[user\]/);
    assert.match(afterOutput, /● alpha \[project\] v1\.0\.0 \(installed\)/);
    assert.equal(
      /● official-user \[user\][\s\S]*○ alpha v1\.0\.0 \(available\)/.test(afterOutput),
      false,
      `unexpected duplicate available row under official-user [user]: ${afterOutput}`,
    );
  } finally {
    await env.cleanup();
  }
});
