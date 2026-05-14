import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildClaudeImportPlan,
  planMarketplaceSourcesForRefs,
  type EnabledPluginRef,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts";

const ref = (raw: string, marketplace: string, plugin = "plugin"): EnabledPluginRef => ({
  raw,
  marketplace,
  plugin,
});

test("planMarketplaceSourcesForRefs maps official marketplace to built-in GitHub source", () => {
  const got = planMarketplaceSourcesForRefs(
    "user",
    [ref("plugin@claude-plugins-official", "claude-plugins-official")],
    {},
  );

  assert.deepEqual(got.marketplacesToEnsure, [
    {
      scope: "user",
      marketplace: "claude-plugins-official",
      source: "anthropics/claude-plugins-official",
    },
  ]);
  assert.deepEqual(got.diagnostics, []);
});

test("planMarketplaceSourcesForRefs maps directory and github.repo extra-known entries", () => {
  const got = planMarketplaceSourcesForRefs(
    "project",
    [ref("a@private", "private", "a"), ref("b@team", "team", "b")],
    {
      private: { directory: "../fixtures/private-marketplace" },
      team: { github: { repo: "owner/repo" } },
    },
  );

  assert.deepEqual(got.marketplacesToEnsure, [
    { scope: "project", marketplace: "private", source: "../fixtures/private-marketplace" },
    { scope: "project", marketplace: "team", source: "owner/repo" },
  ]);
  assert.deepEqual(got.diagnostics, []);
});

test("planMarketplaceSourcesForRefs diagnoses unsupported and missing marketplace source shapes", () => {
  const got = planMarketplaceSourcesForRefs(
    "user",
    [
      ref("a@url", "url", "a"),
      ref("b@badgithub", "badgithub", "b"),
      ref("c@missing", "missing", "c"),
    ],
    { url: { url: "https://example.com/marketplace.json" }, badgithub: { github: {} } },
  );

  assert.deepEqual(got.marketplacesToEnsure, []);
  assert.deepEqual(
    got.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.marketplace]),
    [
      ["unmappable-marketplace-source", "url"],
      ["unmappable-marketplace-source", "badgithub"],
      ["unmappable-marketplace-source", "missing"],
    ],
  );
});

test("buildClaudeImportPlan builds one scoped plan for user-only input", () => {
  const got = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: { "official@claude-plugins-official": true, "private@private": true },
        extraKnownMarketplaces: { private: { directory: "../private" } },
      },
    },
  ]);

  assert.equal(got.scopes.length, 1);
  assert.equal(got.scopes[0]?.scope, "user");
  assert.deepEqual(
    got.scopes[0]?.pluginsToInstall.map((plugin) => plugin.ref.raw),
    ["official@claude-plugins-official", "private@private"],
  );
  assert.deepEqual(got.scopes[0]?.skippedPlugins, []);
});

test("buildClaudeImportPlan preserves same plugin in user and project scopes", () => {
  const got = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: { "shared@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
    {
      scope: "project",
      settings: {
        enabledPlugins: { "shared@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
  ]);

  assert.deepEqual(
    got.scopes.map((scopePlan) => scopePlan.scope),
    ["user", "project"],
  );
  assert.deepEqual(
    got.scopes.map((scopePlan) => scopePlan.pluginsToInstall[0]?.ref.raw),
    ["shared@claude-plugins-official", "shared@claude-plugins-official"],
  );
});

test("buildClaudeImportPlan honors explicit project-only selection", () => {
  const got = buildClaudeImportPlan([
    {
      scope: "project",
      settings: {
        enabledPlugins: { "project@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
  ]);

  assert.deepEqual(
    got.scopes.map((scopePlan) => scopePlan.scope),
    ["project"],
  );
});

test("buildClaudeImportPlan skips one unmappable plugin without blocking another plugin", () => {
  const got = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: { "bad@missing": true, "good@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
  ]);

  const scoped = got.scopes[0];
  assert.ok(scoped);
  assert.deepEqual(
    scoped.pluginsToInstall.map((plugin) => plugin.ref.raw),
    ["good@claude-plugins-official"],
  );
  assert.deepEqual(
    scoped.skippedPlugins.map((plugin) => [plugin.ref.raw, plugin.reason]),
    [["bad@missing", "unmappable-marketplace-source"]],
  );
  assert.equal(scoped.diagnostics.length, 1);
});

test("import foundation modules stay pure and expose the Phase 10 API", async () => {
  const moduleNames = ["settings.ts", "refs.ts", "marketplaces.ts"] as const;
  for (const moduleName of moduleNames) {
    const source = await readFile(
      new URL(
        `../../../extensions/pi-claude-marketplace/orchestrators/import/${moduleName}`,
        import.meta.url,
      ),
      "utf8",
    );
    for (const forbidden of [
      "ctx.ui.notify",
      "process.stdout",
      "process.stderr",
      "console.log",
      "fetch",
      "gitOps",
      "withStateGuard",
      "installPlugin",
      "addMarketplace",
      "orchestrators/marketplace/add",
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${moduleName} must not contain ${forbidden}`,
      );
    }
  }

  const barrel = await readFile(
    new URL(
      "../../../extensions/pi-claude-marketplace/orchestrators/import/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  for (const exported of [
    "buildClaudeImportPlan",
    "planMarketplaceSourcesForRefs",
    "extractEnabledPluginRefs",
  ]) {
    assert.equal(barrel.includes(exported), true, `barrel must export ${exported}`);
  }
});
