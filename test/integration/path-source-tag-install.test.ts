// test/integration/path-source-tag-install.test.ts
//
// Two cases of the path-source tag install (TAGS-01), kept as internal cases
// (ITSCOPE-01). Each runs the real `addMarketplace` and `installPlugin`
// orchestrators against a real git repository with no injected seam, so
// `probeMarketplaceTags` and `materializeMarketplaceTagClone` run as
// production wires them. CR-01: a gitignored or untracked file in the
// marketplace checkout never reaches the tag clone under `plugin-clones/`.
// The planted files are not plugin components, so only that directory on
// disk would hold them, and no command lists it. D-07-04: two cascade members
// that read one marketplace clone's tags leave its `.git/index` and
// `.git/HEAD` byte for byte as they were, which no command shows either.
// What a user sees is in `features/plugin/install-dependencies.feature`: a
// dependency installed from the release tag its version constraint selects
// while the marketplace has moved past it (TAGS-01, TAGS-03), and its current
// copy when no tag satisfies the constraint (TAGS-02).

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { addMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

const AUTHOR = { name: "test", email: "test@example.com" } as const;

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

interface TestCtx {
  readonly ctx: ExtensionContext;
  readonly run: NotificationRun;
  readonly notifications: NotifyRecord[];
}

function makeCtx(cwd: string): TestCtx {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
    cwd,
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as ExtensionContext;
  return { ctx, run: runWithNothingLoaded(), notifications };
}

/**
 * Builds a real git repository marketplace declaring `formatter` (a
 * path-source plugin, tagged `formatter--v1.0.0` at its first commit) and
 * `app` (a path-source plugin declaring `formatter@^1.0.0` in its OWN
 * `plugin.json`, per D-01-32's read order). A second commit on top bumps
 * `formatter` to `2.0.0` and rewrites its marker file, so the CURRENT
 * checkout is byte-distinguishable from the tag.
 */
async function buildTaggedMarketplace(cwd: string): Promise<{
  readonly marketplaceRoot: string;
}> {
  const marketplaceRoot = path.join(cwd, "acme-market-src");
  const formatterDir = path.join(marketplaceRoot, "plugins", "formatter");
  const appDir = path.join(marketplaceRoot, "plugins", "app");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(formatterDir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(appDir, ".claude-plugin"), { recursive: true });

  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "acme",
      plugins: [
        { name: "formatter", source: "./plugins/formatter" },
        { name: "app", source: "./plugins/app" },
      ],
    }),
  );
  await writeFile(
    path.join(formatterDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "formatter", version: "1.0.0" }),
  );
  await writeFile(path.join(formatterDir, "MARKER.txt"), "tagged-content\n");
  await writeFile(
    path.join(appDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "app",
      version: "1.0.0",
      dependencies: [{ name: "formatter", version: "^1.0.0" }],
    }),
  );

  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  await git.add({ fs, dir: marketplaceRoot, filepath: ".claude-plugin/marketplace.json" });
  await git.add({
    fs,
    dir: marketplaceRoot,
    filepath: "plugins/formatter/.claude-plugin/plugin.json",
  });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/formatter/MARKER.txt" });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/app/.claude-plugin/plugin.json" });
  await git.commit({ fs, dir: marketplaceRoot, message: "release 1.0.0", author: AUTHOR });
  const tagOid = await git.resolveRef({ fs, dir: marketplaceRoot, ref: "HEAD" });
  await git.tag({ fs, dir: marketplaceRoot, ref: "formatter--v1.0.0", object: tagOid });

  // Advance the checkout PAST the tag, so the tag's tree and the current
  // checkout differ.
  await writeFile(
    path.join(formatterDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "formatter", version: "2.0.0" }),
  );
  await writeFile(path.join(formatterDir, "MARKER.txt"), "current-checkout-content\n");
  await git.add({
    fs,
    dir: marketplaceRoot,
    filepath: "plugins/formatter/.claude-plugin/plugin.json",
  });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/formatter/MARKER.txt" });
  await git.commit({ fs, dir: marketplaceRoot, message: "release 2.0.0", author: AUTHOR });

  return { marketplaceRoot };
}

test("CR-01: an untracked file in the marketplace root does not leak into the materialized tag clone", async (t) => {
  // arrange: plant files the tag's tree does not contain -- one gitignored,
  // one plainly untracked, at both the marketplace root and inside the
  // plugin's own directory. A materialization that copies the marketplace's
  // live work tree before checking the tag out would carry all of them into
  // `plugin-clones/<key>/`; extracting the tag's tree into an empty staging
  // dir must not.
  const environment = await createHermeticEnvironment(t, "path-source-tag-untracked-");
  const { marketplaceRoot } = await buildTaggedMarketplace(environment.cwd);
  await writeFile(path.join(marketplaceRoot, ".gitignore"), "*.secret\n");
  await writeFile(
    path.join(marketplaceRoot, "top-level.secret"),
    "should never leave the marketplace checkout\n",
  );
  await writeFile(
    path.join(marketplaceRoot, "plugins", "formatter", "leaked.secret"),
    "should never leave the marketplace checkout\n",
  );
  await writeFile(
    path.join(marketplaceRoot, "plugins", "formatter", "UNTRACKED.txt"),
    "never committed\n",
  );
  const locations = locationsFor("project", environment.cwd);
  const addCtx = makeCtx(environment.cwd);
  const installCtx = makeCtx(environment.cwd);
  const completionCache = createCompletionCache();
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act
  await addMarketplace({
    ctx: addCtx.ctx,
    run: addCtx.run,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    run: installCtx.run,
    scope: "project",
    cwd: environment.cwd,
    marketplace: "acme",
    plugin: "app",
  });

  // assert
  const state = await loadState(locations.extensionRoot);
  const formatterRecord = state.marketplaces.acme?.plugins.formatter;
  assert.ok(
    formatterRecord !== undefined,
    `formatter did not install: ${JSON.stringify(installCtx.notifications)}`,
  );
  assert.ok(
    formatterRecord.resolvedSource.includes(`${path.sep}plugin-clones${path.sep}`),
    `resolvedSource does not sit inside plugin-clones/: ${formatterRecord.resolvedSource}`,
  );
  // `resolvedSource` is `<plugin-clones>/<key>/plugins/formatter` (the
  // git-subdir root); its grandparent is the whole materialized clone.
  const cloneRoot = path.resolve(formatterRecord.resolvedSource, "..", "..");
  assert.strictEqual(
    fs.existsSync(path.join(cloneRoot, "top-level.secret")),
    false,
    "a gitignored file at the marketplace root leaked into the materialized tag clone",
  );
  assert.strictEqual(
    fs.existsSync(path.join(formatterRecord.resolvedSource, "leaked.secret")),
    false,
    "a gitignored file under the plugin's own directory leaked into the materialized tag clone",
  );
  assert.strictEqual(
    fs.existsSync(path.join(formatterRecord.resolvedSource, "UNTRACKED.txt")),
    false,
    "an untracked file leaked into the materialized tag clone",
  );
});

/**
 * Builds a real git repository marketplace declaring TWO independently-tagged
 * path-source plugins (`formatter--v1.0.0`, `linter--v1.0.0`) and one
 * dependent plugin `app` constraining both.
 */
async function buildTwoTagMarketplace(cwd: string): Promise<{
  readonly marketplaceRoot: string;
  readonly tagOid: string;
}> {
  const marketplaceRoot = path.join(cwd, "acme-two-tag-market-src");
  const formatterDir = path.join(marketplaceRoot, "plugins", "formatter");
  const linterDir = path.join(marketplaceRoot, "plugins", "linter");
  const appDir = path.join(marketplaceRoot, "plugins", "app");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(formatterDir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(linterDir, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(appDir, ".claude-plugin"), { recursive: true });

  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "acme",
      plugins: [
        { name: "formatter", source: "./plugins/formatter" },
        { name: "linter", source: "./plugins/linter" },
        { name: "app", source: "./plugins/app" },
      ],
    }),
  );
  await writeFile(
    path.join(formatterDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "formatter", version: "1.0.0" }),
  );
  await writeFile(
    path.join(linterDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "linter", version: "1.0.0" }),
  );
  await writeFile(
    path.join(appDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "app",
      version: "1.0.0",
      dependencies: [
        { name: "formatter", version: "^1.0.0" },
        { name: "linter", version: "^1.0.0" },
      ],
    }),
  );

  await git.init({ fs, dir: marketplaceRoot, defaultBranch: "main" });
  await git.add({ fs, dir: marketplaceRoot, filepath: ".claude-plugin/marketplace.json" });
  await git.add({
    fs,
    dir: marketplaceRoot,
    filepath: "plugins/formatter/.claude-plugin/plugin.json",
  });
  await git.add({
    fs,
    dir: marketplaceRoot,
    filepath: "plugins/linter/.claude-plugin/plugin.json",
  });
  await git.add({ fs, dir: marketplaceRoot, filepath: "plugins/app/.claude-plugin/plugin.json" });
  await git.commit({ fs, dir: marketplaceRoot, message: "release 1.0.0", author: AUTHOR });
  const tagOid = await git.resolveRef({ fs, dir: marketplaceRoot, ref: "HEAD" });
  await git.tag({ fs, dir: marketplaceRoot, ref: "formatter--v1.0.0", object: tagOid });
  await git.tag({ fs, dir: marketplaceRoot, ref: "linter--v1.0.0", object: tagOid });

  return { marketplaceRoot, tagOid };
}

test("TAGS-01: two cascade members resolving against the SAME marketplace clone leave its git state untouched", async (t) => {
  // arrange: one cascade (installing `app`) constrains TWO independently
  // named path-source members against the SAME marketplace clone's tags.
  const environment = await createHermeticEnvironment(t, "path-source-tag-concurrency-");
  const { marketplaceRoot, tagOid } = await buildTwoTagMarketplace(environment.cwd);
  const before = await readFile(path.join(marketplaceRoot, ".git", "index"));
  const beforeHead = await readFile(path.join(marketplaceRoot, ".git", "HEAD"));
  const locations = locationsFor("project", environment.cwd);
  const addCtx = makeCtx(environment.cwd);
  const installCtx = makeCtx(environment.cwd);
  const completionCache = createCompletionCache();
  const installPlugin = createInstallOperation(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act
  await addMarketplace({
    ctx: addCtx.ctx,
    run: addCtx.run,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    run: installCtx.run,
    scope: "project",
    cwd: environment.cwd,
    marketplace: "acme",
    plugin: "app",
  });

  // assert: both members pinned correctly off the one clone's one listing.
  const state = await loadState(locations.extensionRoot);
  const formatterRecord = state.marketplaces.acme?.plugins.formatter;
  const linterRecord = state.marketplaces.acme?.plugins.linter;
  assert.ok(
    formatterRecord !== undefined && linterRecord !== undefined,
    `a dependency did not install: ${JSON.stringify(installCtx.notifications)}`,
  );
  // GV-01: each records its declared version with the tag's commit.
  const tagVersion = `1.0.0-${tagOid.slice(0, 12)}`;
  assert.strictEqual(formatterRecord.version, tagVersion);
  assert.strictEqual(linterRecord.version, tagVersion);
  assert.strictEqual(formatterRecord.resolvedSha, tagOid);
  assert.strictEqual(linterRecord.resolvedSha, tagOid);

  // The marketplace clone's `.git/index` and `.git/HEAD` are byte-identical
  // to the pre-run snapshot -- two members read it, and it stayed read-only.
  assert.deepStrictEqual(await readFile(path.join(marketplaceRoot, ".git", "index")), before);
  assert.deepStrictEqual(await readFile(path.join(marketplaceRoot, ".git", "HEAD")), beforeHead);
});
