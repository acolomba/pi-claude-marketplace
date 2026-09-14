import assert from "node:assert/strict";
import test from "node:test";

import { buildClaudeImportPlan } from "../../../extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts";

test("buildClaudeImportPlan builds a complete mixed user plan with ordered diagnostics", () => {
  // arrange
  const inputs = [
    {
      scope: "user" as const,
      settings: {
        enabledPlugins: {
          malformed: true,
          "not-boolean@private": "true",
          "disabled@private": false,
          "official@claude-plugins-official": true,
          "unmapped@missing": true,
        },
        extraKnownMarketplaces: {},
      },
    },
  ];

  // act
  const result = buildClaudeImportPlan(inputs);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "user",
        marketplacesToEnsure: [
          {
            scope: "user",
            marketplace: "claude-plugins-official",
            source: "anthropics/claude-plugins-official",
          },
        ],
        pluginsToInstall: [
          {
            scope: "user",
            ref: {
              marketplace: "claude-plugins-official",
              plugin: "official",
              raw: "official@claude-plugins-official",
            },
          },
        ],
        skippedPlugins: [
          {
            scope: "user",
            ref: {
              marketplace: "missing",
              plugin: "unmapped",
              raw: "unmapped@missing",
            },
            reason: "unmappable-marketplace-source",
          },
        ],
        diagnostics: [
          {
            code: "malformed-plugin-ref",
            message:
              'Skipping malformed enabled plugin ref "malformed": Expected exactly one @ separator in plugin@marketplace ref. Expected plugin@marketplace.',
            ref: "malformed",
            scope: "user",
            severity: "warning",
          },
          {
            code: "non-boolean-enabled-plugin",
            message:
              'Skipping enabled plugin ref "not-boolean@private" because its value is not boolean true or false.',
            ref: "not-boolean@private",
            scope: "user",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "missing",
            message:
              'Skipping Claude marketplace "missing" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
        ],
      },
    ],
    diagnostics: [
      {
        code: "malformed-plugin-ref",
        message:
          'Skipping malformed enabled plugin ref "malformed": Expected exactly one @ separator in plugin@marketplace ref. Expected plugin@marketplace.',
        ref: "malformed",
        scope: "user",
        severity: "warning",
      },
      {
        code: "non-boolean-enabled-plugin",
        message:
          'Skipping enabled plugin ref "not-boolean@private" because its value is not boolean true or false.',
        ref: "not-boolean@private",
        scope: "user",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "missing",
        message:
          'Skipping Claude marketplace "missing" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
    ],
  });
});

test("buildClaudeImportPlan keeps every plugin while ensuring a shared marketplace once", () => {
  // arrange
  const inputs = [
    {
      scope: "project" as const,
      settings: {
        enabledPlugins: {
          "alpha@private": true,
          "omega@private": true,
        },
        extraKnownMarketplaces: {
          private: { directory: "../private-marketplace" },
        },
      },
    },
  ];

  // act
  const result = buildClaudeImportPlan(inputs);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "project",
        marketplacesToEnsure: [
          {
            scope: "project",
            marketplace: "private",
            source: "../private-marketplace",
          },
        ],
        pluginsToInstall: [
          {
            scope: "project",
            ref: {
              marketplace: "private",
              plugin: "alpha",
              raw: "alpha@private",
            },
          },
          {
            scope: "project",
            ref: {
              marketplace: "private",
              plugin: "omega",
              raw: "omega@private",
            },
          },
        ],
        skippedPlugins: [],
        diagnostics: [],
      },
    ],
    diagnostics: [],
  });
});

test("buildClaudeImportPlan preserves user and project scope input order", () => {
  // arrange
  const inputs = [
    {
      scope: "user" as const,
      settings: {
        enabledPlugins: { "shared@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
    {
      scope: "project" as const,
      settings: {
        enabledPlugins: { "shared@claude-plugins-official": true },
        extraKnownMarketplaces: {},
      },
    },
  ];

  // act
  const result = buildClaudeImportPlan(inputs);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "user",
        marketplacesToEnsure: [
          {
            scope: "user",
            marketplace: "claude-plugins-official",
            source: "anthropics/claude-plugins-official",
          },
        ],
        pluginsToInstall: [
          {
            scope: "user",
            ref: {
              marketplace: "claude-plugins-official",
              plugin: "shared",
              raw: "shared@claude-plugins-official",
            },
          },
        ],
        skippedPlugins: [],
        diagnostics: [],
      },
      {
        scope: "project",
        marketplacesToEnsure: [
          {
            scope: "project",
            marketplace: "claude-plugins-official",
            source: "anthropics/claude-plugins-official",
          },
        ],
        pluginsToInstall: [
          {
            scope: "project",
            ref: {
              marketplace: "claude-plugins-official",
              plugin: "shared",
              raw: "shared@claude-plugins-official",
            },
          },
        ],
        skippedPlugins: [],
        diagnostics: [],
      },
    ],
    diagnostics: [],
  });
});

test("buildClaudeImportPlan returns a complete empty plan for no selected scopes", () => {
  // arrange
  const inputs: [] = [];

  // act
  const result = buildClaudeImportPlan(inputs);

  // assert
  assert.deepStrictEqual(result, { scopes: [], diagnostics: [] });
});

test("buildClaudeImportPlan diagnoses malformed nested marketplace payloads", () => {
  // arrange
  const extraKnownMarketplaces = {
    "bad-url": { source: { source: "url", url: 123 } },
    "bad-github": { source: { source: "github", repo: null } },
    "bad-directory": { source: { source: "directory", path: false } },
    file: { source: { source: "file", url: "https://example.test/marketplace.json" } },
    unknown: { source: { source: "npm", package: "marketplace" } },
  };

  // act
  const result = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: {
          "alpha@bad-url": true,
          "beta@bad-github": true,
          "gamma@bad-directory": true,
          "delta@file": true,
          "epsilon@unknown": true,
        },
        extraKnownMarketplaces: extraKnownMarketplaces,
      },
    },
  ]);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "user",
        marketplacesToEnsure: [],
        diagnostics: [
          {
            code: "unmappable-marketplace-source",
            marketplace: "bad-url",
            message:
              'Skipping Claude marketplace "bad-url" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "bad-github",
            message:
              'Skipping Claude marketplace "bad-github" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "bad-directory",
            message:
              'Skipping Claude marketplace "bad-directory" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "file",
            message:
              'Skipping Claude marketplace "file" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "unknown",
            message:
              'Skipping Claude marketplace "unknown" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "user",
            severity: "warning",
          },
        ],
        pluginsToInstall: [],
        skippedPlugins: [
          {
            scope: "user",
            ref: { marketplace: "bad-url", plugin: "alpha", raw: "alpha@bad-url" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "user",
            ref: { marketplace: "bad-github", plugin: "beta", raw: "beta@bad-github" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "user",
            ref: { marketplace: "bad-directory", plugin: "gamma", raw: "gamma@bad-directory" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "user",
            ref: { marketplace: "file", plugin: "delta", raw: "delta@file" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "user",
            ref: { marketplace: "unknown", plugin: "epsilon", raw: "epsilon@unknown" },
            reason: "unmappable-marketplace-source",
          },
        ],
      },
    ],
    diagnostics: [
      {
        code: "unmappable-marketplace-source",
        marketplace: "bad-url",
        message:
          'Skipping Claude marketplace "bad-url" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "bad-github",
        message:
          'Skipping Claude marketplace "bad-github" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "bad-directory",
        message:
          'Skipping Claude marketplace "bad-directory" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "file",
        message:
          'Skipping Claude marketplace "file" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "unknown",
        message:
          'Skipping Claude marketplace "unknown" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "user",
        severity: "warning",
      },
    ],
  });
});

test("buildClaudeImportPlan diagnoses nonobject and unsupported flat entries", () => {
  // arrange
  const extraKnownMarketplaces = {
    array: [],
    null: null,
    string: "owner/repo",
    "flat-url": { url: "https://example.test/marketplace.json" },
    "bad-github": { github: [] },
    "bad-source": { source: "owner/repo" },
  };

  // act
  const result = buildClaudeImportPlan([
    {
      scope: "project",
      settings: {
        enabledPlugins: {
          "alpha@array": true,
          "beta@null": true,
          "gamma@string": true,
          "delta@flat-url": true,
          "epsilon@bad-github": true,
          "zeta@bad-source": true,
          "eta@missing": true,
        },
        extraKnownMarketplaces: extraKnownMarketplaces,
      },
    },
  ]);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "project",
        marketplacesToEnsure: [],
        diagnostics: [
          {
            code: "unmappable-marketplace-source",
            marketplace: "array",
            message:
              'Skipping Claude marketplace "array" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "null",
            message:
              'Skipping Claude marketplace "null" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "string",
            message:
              'Skipping Claude marketplace "string" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "flat-url",
            message:
              'Skipping Claude marketplace "flat-url" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "bad-github",
            message:
              'Skipping Claude marketplace "bad-github" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "bad-source",
            message:
              'Skipping Claude marketplace "bad-source" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
          {
            code: "unmappable-marketplace-source",
            marketplace: "missing",
            message:
              'Skipping Claude marketplace "missing" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
            scope: "project",
            severity: "warning",
          },
        ],
        pluginsToInstall: [],
        skippedPlugins: [
          {
            scope: "project",
            ref: { marketplace: "array", plugin: "alpha", raw: "alpha@array" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "null", plugin: "beta", raw: "beta@null" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "string", plugin: "gamma", raw: "gamma@string" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "flat-url", plugin: "delta", raw: "delta@flat-url" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "bad-github", plugin: "epsilon", raw: "epsilon@bad-github" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "bad-source", plugin: "zeta", raw: "zeta@bad-source" },
            reason: "unmappable-marketplace-source",
          },
          {
            scope: "project",
            ref: { marketplace: "missing", plugin: "eta", raw: "eta@missing" },
            reason: "unmappable-marketplace-source",
          },
        ],
      },
    ],
    diagnostics: [
      {
        code: "unmappable-marketplace-source",
        marketplace: "array",
        message:
          'Skipping Claude marketplace "array" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "null",
        message:
          'Skipping Claude marketplace "null" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "string",
        message:
          'Skipping Claude marketplace "string" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "flat-url",
        message:
          'Skipping Claude marketplace "flat-url" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "bad-github",
        message:
          'Skipping Claude marketplace "bad-github" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "bad-source",
        message:
          'Skipping Claude marketplace "bad-source" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
      {
        code: "unmappable-marketplace-source",
        marketplace: "missing",
        message:
          'Skipping Claude marketplace "missing" because it has no supported url, github, or directory source (nested file/remote-marketplace.json sources are not importable).',
        scope: "project",
        severity: "warning",
      },
    ],
  });
});

test("buildClaudeImportPlan maps flat directory and GitHub entries in ref order", () => {
  // arrange
  const extraKnownMarketplaces = {
    private: {
      directory: "../fixtures/private-marketplace",
      github: { repo: "ignored/by-directory-precedence" },
    },
    team: { github: { repo: "owner/repo" } },
  };

  // act
  const result = buildClaudeImportPlan([
    {
      scope: "project",
      settings: {
        enabledPlugins: { "alpha@private": true, "beta@team": true },
        extraKnownMarketplaces: extraKnownMarketplaces,
      },
    },
  ]);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "project",
        marketplacesToEnsure: [
          {
            scope: "project",
            marketplace: "private",
            source: "../fixtures/private-marketplace",
          },
          { scope: "project", marketplace: "team", source: "owner/repo" },
        ],
        diagnostics: [],
        pluginsToInstall: [
          {
            scope: "project",
            ref: { marketplace: "private", plugin: "alpha", raw: "alpha@private" },
          },
          { scope: "project", ref: { marketplace: "team", plugin: "beta", raw: "beta@team" } },
        ],
        skippedPlugins: [],
      },
    ],
    diagnostics: [],
  });
});

test("buildClaudeImportPlan maps every nested source shape and optional ref", () => {
  // arrange
  const extraKnownMarketplaces = {
    url: { source: { source: "url", url: "https://gitlab.com/acme/marketplace.git" } },
    "url-ref": {
      source: {
        source: "url",
        url: "https://gitlab.com/acme/marketplace.git",
        ref: "main",
      },
    },
    github: { source: { source: "github", repo: "acme/marketplace" } },
    "github-ref": {
      source: { source: "github", repo: "acme/marketplace", ref: "v2.0" },
    },
    directory: { source: { source: "directory", path: "/opt/acme/marketplace" } },
  };

  // act
  const result = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: {
          "alpha@url": true,
          "beta@url-ref": true,
          "gamma@github": true,
          "delta@github-ref": true,
          "epsilon@directory": true,
        },
        extraKnownMarketplaces: extraKnownMarketplaces,
      },
    },
  ]);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "user",
        marketplacesToEnsure: [
          {
            scope: "user",
            marketplace: "url",
            source: "https://gitlab.com/acme/marketplace.git",
          },
          {
            scope: "user",
            marketplace: "url-ref",
            source: "https://gitlab.com/acme/marketplace.git#main",
          },
          { scope: "user", marketplace: "github", source: "acme/marketplace" },
          {
            scope: "user",
            marketplace: "github-ref",
            source: "acme/marketplace@v2.0",
          },
          {
            scope: "user",
            marketplace: "directory",
            source: "/opt/acme/marketplace",
          },
        ],
        diagnostics: [],
        pluginsToInstall: [
          { scope: "user", ref: { marketplace: "url", plugin: "alpha", raw: "alpha@url" } },
          {
            scope: "user",
            ref: { marketplace: "url-ref", plugin: "beta", raw: "beta@url-ref" },
          },
          {
            scope: "user",
            ref: { marketplace: "github", plugin: "gamma", raw: "gamma@github" },
          },
          {
            scope: "user",
            ref: { marketplace: "github-ref", plugin: "delta", raw: "delta@github-ref" },
          },
          {
            scope: "user",
            ref: { marketplace: "directory", plugin: "epsilon", raw: "epsilon@directory" },
          },
        ],
        skippedPlugins: [],
      },
    ],
    diagnostics: [],
  });
});

test("buildClaudeImportPlan maps the official source and skips its duplicate", () => {
  // arrange

  // act
  const result = buildClaudeImportPlan([
    {
      scope: "user",
      settings: {
        enabledPlugins: {
          "alpha@claude-plugins-official": true,
          "omega@claude-plugins-official": true,
        },
        extraKnownMarketplaces: {},
      },
    },
  ]);

  // assert
  assert.deepStrictEqual(result, {
    scopes: [
      {
        scope: "user",
        marketplacesToEnsure: [
          {
            scope: "user",
            marketplace: "claude-plugins-official",
            source: "anthropics/claude-plugins-official",
          },
        ],
        diagnostics: [],
        pluginsToInstall: [
          {
            scope: "user",
            ref: {
              marketplace: "claude-plugins-official",
              plugin: "alpha",
              raw: "alpha@claude-plugins-official",
            },
          },
          {
            scope: "user",
            ref: {
              marketplace: "claude-plugins-official",
              plugin: "omega",
              raw: "omega@claude-plugins-official",
            },
          },
        ],
        skippedPlugins: [],
      },
    ],
    diagnostics: [],
  });
});
