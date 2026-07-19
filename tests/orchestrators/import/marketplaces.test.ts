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

test("MURL-07 planMarketplaceSourcesForRefs maps nested url/github/directory extra-known entries", () => {
  const got = planMarketplaceSourcesForRefs(
    "project",
    [
      ref("a@nu", "nu", "a"),
      ref("b@nur", "nur", "b"),
      ref("c@ng", "ng", "c"),
      ref("d@ngr", "ngr", "d"),
      ref("e@nd", "nd", "e"),
    ],
    {
      // Nested upstream {source:{...}} shape (D-76-13).
      nu: { source: { source: "url", url: "https://gitlab.com/acme/mp.git" } },
      nur: { source: { source: "url", url: "https://gitlab.com/acme/mp.git", ref: "main" } },
      ng: { source: { source: "github", repo: "acme/mp" } },
      ngr: { source: { source: "github", repo: "acme/mp", ref: "v2.0" } },
      nd: { source: { source: "directory", path: "/abs/mp" } },
    },
  );

  assert.deepEqual(got.marketplacesToEnsure, [
    { scope: "project", marketplace: "nu", source: "https://gitlab.com/acme/mp.git" },
    { scope: "project", marketplace: "nur", source: "https://gitlab.com/acme/mp.git#main" },
    { scope: "project", marketplace: "ng", source: "acme/mp" },
    { scope: "project", marketplace: "ngr", source: "acme/mp@v2.0" },
    { scope: "project", marketplace: "nd", source: "/abs/mp" },
  ]);
  assert.deepEqual(got.diagnostics, []);
});

test("MURL-07 planMarketplaceSourcesForRefs leaves the nested file shape unmappable", () => {
  const got = planMarketplaceSourcesForRefs(
    "user",
    [ref("a@nf", "nf", "a"), ref("b@nx", "nx", "b")],
    {
      // The nested `file` shape (remote marketplace.json URL) stays out of
      // scope and keeps its unmappable diagnostic (D-76-13).
      nf: { source: { source: "file", url: "https://x/marketplace.json" } },
      // An unrecognized discriminator is also unmappable.
      nx: { source: { source: "npm", package: "x" } },
    },
  );

  assert.deepEqual(got.marketplacesToEnsure, []);
  assert.deepEqual(
    got.diagnostics.map((diagnostic) => diagnostic.code),
    ["unmappable-marketplace-source", "unmappable-marketplace-source"],
  );
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

test("import foundation modules stay pure and expose the expected API", async () => {
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

test("MURL-07 planMarketplaceSourcesForRefs leaves malformed nested url/github/directory payloads unmappable", () => {
  const got = planMarketplaceSourcesForRefs(
    "user",
    [
      ref("a@badurl", "badurl", "a"),
      ref("b@badrepo", "badrepo", "b"),
      ref("c@badpath", "badpath", "c"),
    ],
    {
      // A recognized discriminator whose payload field carries the wrong
      // type must stay unmappable, not coerce into a bogus source string.
      badurl: { source: { source: "url", url: 123 } },
      badrepo: { source: { source: "github", repo: null } },
      badpath: { source: { source: "directory", path: 42 } },
    },
  );

  assert.deepEqual(got.marketplacesToEnsure, []);
  assert.deepEqual(
    got.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.marketplace]),
    [
      ["unmappable-marketplace-source", "badurl"],
      ["unmappable-marketplace-source", "badrepo"],
      ["unmappable-marketplace-source", "badpath"],
    ],
  );
});
