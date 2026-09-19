// tests/integration/path-source-tag-install.test.ts
//
// TAGS-01 / TAGS-03 (07-marketplace-repo-tag-resolution, plan 07-01): the
// whole tracer slice, driven end to end against a REAL git repository with NO
// injected seams -- every collaborator (`probeMarketplaceTags`,
// `materializeMarketplaceTagClone`, the resolver's `resolvePathPluginRoot`
// wiring) runs as production wires it, through the real `addMarketplace` and
// `installPlugin` orchestrators. Mirrors
// `tests/integration/marketplace-add-seed-mirrors.test.ts`'s fixture shape.
//
// The fixture marketplace declares a path-source plugin `formatter` and a
// dependent plugin `app` that constrains `formatter` to `^1.0.0`. The
// marketplace clone's HEAD moves PAST the `formatter--v1.0.0` tag (a second
// commit bumps `formatter` to `2.0.0` and changes a marker file), so a
// materialization that read the CURRENT checkout instead of the tag would be
// caught immediately.

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
import { createNodeInstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const AUTHOR = { name: "test", email: "test@example.com" } as const;

interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

interface TestCtx {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly notifications: NotifyRecord[];
}

function makeCtx(cwd: string): TestCtx {
  const notifications: NotifyRecord[] = [];
  const pi = { getAllTools: (): ReturnType<ExtensionAPI["getAllTools"]> => [] } as ExtensionAPI;
  const ctx = {
    cwd,
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as ExtensionContext;
  return { ctx, pi, notifications };
}

/** `.git/HEAD` and `.git/index` bytes, plus the two files a stray checkout would touch. */
async function marketplaceGitSnapshot(marketplaceRoot: string): Promise<{
  readonly head: Buffer;
  readonly index: Buffer;
  readonly pluginJson: string;
  readonly marker: string;
}> {
  return {
    head: await readFile(path.join(marketplaceRoot, ".git", "HEAD")),
    index: await readFile(path.join(marketplaceRoot, ".git", "index")),
    pluginJson: await readFile(
      path.join(marketplaceRoot, "plugins", "formatter", ".claude-plugin", "plugin.json"),
      "utf8",
    ),
    marker: await readFile(
      path.join(marketplaceRoot, "plugins", "formatter", "MARKER.txt"),
      "utf8",
    ),
  };
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
  readonly tagOid: string;
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

  // Advance the checkout PAST the tag: a materialization that reads the
  // current checkout instead of the tag is caught by every assertion below.
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

  return { marketplaceRoot, tagOid };
}

test("TAGS-01/TAGS-03: a constrained path-source dependency installs from the marketplace tag that satisfies it", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "path-source-tag-install-");
  const { marketplaceRoot, tagOid } = await buildTaggedMarketplace(environment.cwd);
  const before = await marketplaceGitSnapshot(marketplaceRoot);
  const locations = locationsFor("project", environment.cwd);
  const addCtx = makeCtx(environment.cwd);
  const installCtx = makeCtx(environment.cwd);
  const completionCache = createCompletionCache();
  const installPlugin = createNodeInstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act: add the marketplace, then install the DEPENDENT plugin -- the
  // cascade resolves `formatter`'s constraint against the marketplace
  // clone's own local tags with no seam of any kind injected.
  await addMarketplace({
    ctx: addCtx.ctx,
    pi: addCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    pi: installCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    marketplace: "acme",
    plugin: "app",
  });

  // assert
  const state = await loadState(locations.extensionRoot);
  const formatterRecord = state.marketplaces.acme?.plugins.formatter;
  const appRecord = state.marketplaces.acme?.plugins.app;
  assert.ok(
    formatterRecord !== undefined,
    `formatter did not install: ${JSON.stringify(installCtx.notifications)}`,
  );
  assert.ok(
    appRecord !== undefined,
    `app did not install: ${JSON.stringify(installCtx.notifications)}`,
  );

  // The installed plugin root holds the TAG's file content, not the later
  // commit's.
  const installedPluginJson: unknown = JSON.parse(
    await readFile(
      path.join(formatterRecord.resolvedSource, ".claude-plugin", "plugin.json"),
      "utf8",
    ),
  );
  assert.deepStrictEqual(installedPluginJson, { name: "formatter", version: "1.0.0" });
  assert.strictEqual(
    await readFile(path.join(formatterRecord.resolvedSource, "MARKER.txt"), "utf8"),
    "tagged-content\n",
  );

  // The install record's version is the tag's own semver, and resolvedSha is
  // the tag's commit oid.
  assert.strictEqual(formatterRecord.version, "1.0.0");
  assert.strictEqual(formatterRecord.resolvedSha, tagOid);
  assert.ok(
    formatterRecord.resolvedSource.includes(`${path.sep}plugin-clones${path.sep}`),
    `resolvedSource does not sit inside plugin-clones/: ${formatterRecord.resolvedSource}`,
  );

  // The marketplace clone's own git state -- and the checked-out bytes a
  // stray checkout would have overwritten -- are byte-identical to the
  // pre-install snapshot.
  const after = await marketplaceGitSnapshot(marketplaceRoot);
  assert.deepStrictEqual(after, before);
});

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
  const installPlugin = createNodeInstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act
  await addMarketplace({
    ctx: addCtx.ctx,
    pi: addCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    pi: installCtx.pi,
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
  const installPlugin = createNodeInstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act
  await addMarketplace({
    ctx: addCtx.ctx,
    pi: addCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    pi: installCtx.pi,
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
  assert.strictEqual(formatterRecord.version, "1.0.0");
  assert.strictEqual(linterRecord.version, "1.0.0");
  assert.strictEqual(formatterRecord.resolvedSha, tagOid);
  assert.strictEqual(linterRecord.resolvedSha, tagOid);

  // The marketplace clone's `.git/index` and `.git/HEAD` are byte-identical
  // to the pre-run snapshot -- two members read it, and it stayed read-only.
  assert.deepStrictEqual(await readFile(path.join(marketplaceRoot, ".git", "index")), before);
  assert.deepStrictEqual(await readFile(path.join(marketplaceRoot, ".git", "HEAD")), beforeHead);
});

/**
 * Builds a real git repository marketplace declaring `formatter` (tagged
 * `formatter--v1.0.0`) and `app`, which constrains `formatter` to `^9.0.0` --
 * a range the marketplace's only tag does not satisfy. Otherwise identical to
 * `buildTaggedMarketplace`, including the second commit that advances the
 * checkout PAST the tag, so the CURRENT checkout stays byte-distinguishable
 * from it.
 */
async function buildNonSatisfyingTagMarketplace(cwd: string): Promise<{
  readonly marketplaceRoot: string;
}> {
  const marketplaceRoot = path.join(cwd, "acme-no-match-market-src");
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
      // TAGS-02: `^9.0.0` is satisfied by NEITHER the tag NOR the current
      // checkout -- the fallback installs the current copy regardless, and
      // the constraint is left for Phase 6's load-time check.
      dependencies: [{ name: "formatter", version: "^9.0.0" }],
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

  // Advance the checkout PAST the tag: a materialization that read the TAG
  // instead of the current checkout would be caught by every assertion below.
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

test("TAGS-02: a constraint no marketplace tag satisfies still installs both plugins, from the CURRENT checkout", async (t) => {
  // arrange
  const environment = await createHermeticEnvironment(t, "path-source-tag-fallback-");
  const { marketplaceRoot } = await buildNonSatisfyingTagMarketplace(environment.cwd);
  const before = await marketplaceGitSnapshot(marketplaceRoot);
  const locations = locationsFor("project", environment.cwd);
  const addCtx = makeCtx(environment.cwd);
  const installCtx = makeCtx(environment.cwd);
  const completionCache = createCompletionCache();
  const installPlugin = createNodeInstallPlugin(
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache,
  );

  // act: no seam of any kind injected -- the real local probe reports
  // `no-matching-tag`, and TAGS-02's fallback carries the install through.
  await addMarketplace({
    ctx: addCtx.ctx,
    pi: addCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    completionCache,
    rawSource: marketplaceRoot,
  });
  await installPlugin({
    ctx: installCtx.ctx,
    pi: installCtx.pi,
    scope: "project",
    cwd: environment.cwd,
    marketplace: "acme",
    plugin: "app",
  });

  // assert: both the dependency and the requesting plugin installed.
  const state = await loadState(locations.extensionRoot);
  const formatterRecord = state.marketplaces.acme?.plugins.formatter;
  const appRecord = state.marketplaces.acme?.plugins.app;
  assert.ok(
    formatterRecord !== undefined,
    `formatter did not install: ${JSON.stringify(installCtx.notifications)}`,
  );
  assert.ok(
    appRecord !== undefined,
    `app did not install: ${JSON.stringify(installCtx.notifications)}`,
  );

  // The installed plugin root holds the CURRENT checkout's content, not the
  // tag's -- there was no tag to satisfy the constraint, so the fallback
  // installs the marketplace as it stands.
  const installedPluginJson: unknown = JSON.parse(
    await readFile(
      path.join(formatterRecord.resolvedSource, ".claude-plugin", "plugin.json"),
      "utf8",
    ),
  );
  assert.deepStrictEqual(installedPluginJson, { name: "formatter", version: "2.0.0" });
  assert.strictEqual(
    await readFile(path.join(formatterRecord.resolvedSource, "MARKER.txt"), "utf8"),
    "current-checkout-content\n",
  );

  // The install record carries the CURRENT checkout's own version, not a tag
  // pin -- there was no pin.
  assert.strictEqual(formatterRecord.version, "2.0.0");

  // WR-05: the row names the fallback and raises to warning -- the
  // requesting plugin installed against a dependency at an unverified
  // version.
  assert.deepStrictEqual(installCtx.notifications, [
    {
      message:
        "A plugin operation needs attention.\n" +
        "\n" +
        [
          "● acme [project]",
          "  ● app v1.0.0 (installed)",
          "  ● formatter@acme v2.0.0 (installed) {dependency current copy}",
          "",
          "/reload to pick up changes",
        ].join("\n"),
      severity: "warning",
    },
  ]);

  // The marketplace clone's own git state is byte-identical to the pre-install
  // snapshot -- the fallback resolves through the SAME `marketplaceRoot + raw`
  // branch an unconstrained install already uses, with no repository mutation.
  const after = await marketplaceGitSnapshot(marketplaceRoot);
  assert.deepStrictEqual(after, before);
});
