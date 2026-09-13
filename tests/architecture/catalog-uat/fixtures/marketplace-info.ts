import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace info command surface. */
export const MARKETPLACE_INFO_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace info <name>": {
    // INFO-07: full catalog state coverage for marketplace info.
    "github-single-scope-full": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "claude-plugins-official",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: {
          sourceKind: "github",
          owner: "anthropics",
          repo: "claude-plugins-official",
          ref: "main",
        },
        description: "Official Claude plugin marketplace.",
      },
    },

    "github-single-scope-minimal": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "community-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "github", owner: "someuser", repo: "community-mp" },
      },
    },

    // MURL-05 / D-76-09 / D-76-10: url source with ref, lastUpdatedAt, and
    // description. The `url: <url>#<ref>` line replaces `github:`/`path:`, and
    // `last_updated:` renders because url is a git-backed kind. Non-github host.
    "url-single-scope-full": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "acme-mp",
        scope: "user",
        details: { autoupdate: true, lastUpdatedAt: "2026-06-03T00:00:00Z" },
        source: { sourceKind: "url", url: "https://gitlab.com/acme/mp", ref: "main" },
        description: "An ACME marketplace hosted on GitLab.",
      },
    },

    // MURL-05 / D-76-09: url source with NO ref -> the `url:` line drops the
    // `#<ref>` suffix; no lastUpdatedAt so no `last_updated:` line.
    "url-single-scope-minimal": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "acme-mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "url", url: "https://gitlab.com/acme/mp" },
      },
    },

    "path-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "local-mp",
        scope: "project",
        details: { autoupdate: false },
        source: { sourceKind: "path", absPath: "/home/user/marketplaces/local-mp" },
      },
    },

    "path-single-scope-with-description": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info",
        name: "dev-mp",
        scope: "user",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/home/user/src/dev-mp" },
        description: "Local development marketplace; experimental plugins.",
      },
    },

    "both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "marketplace-info-cascade",
        blocks: [
          {
            kind: "marketplace-info",
            name: "my-mp",
            scope: "project",
            details: { autoupdate: true },
            source: { sourceKind: "path", absPath: "/repo/path/my-mp" },
          },
          {
            kind: "marketplace-info",
            name: "my-mp",
            scope: "user",
            details: { autoupdate: false },
            source: { sourceKind: "github", owner: "someuser", repo: "my-mp" },
          },
        ],
      },
    },

    "absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      // TYPE-01: the dedicated `marketplace-not-added` variant. `scope` is
      // OMITTED so the renderer emits no `[scope]` token -- absent-from-both
      // states have no bracket because the marketplace is in NEITHER scope.
      // Byte form is unchanged (`⊘ ghost-mp (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      },
    },

    // Byte form preserved byte-identical (`⊘ my-mp [user] (failed) {marketplace not added}`).
    // The fixture shape is re-keyed to the TYPE-01 variant; the rendered BYTES
    // are unchanged.
    "scope-mismatch-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "my-mp",
        scope: "user",
      },
    },

    // D-48-B IN-02: a schema-invalid `marketplace.json` (typed
    // InvalidMarketplaceManifestError, NO SyntaxError cause) reads
    // `{invalid manifest}` for parity with the `marketplace add` write path,
    // not the generic `{unreadable}` fallback. Mirrors
    // buildManifestFailureMessage: a `plugin-info` payload on the marketplace
    // subject (marketplaceName === plugin.name, plugin.scope ===
    // marketplaceScope so the renderer's orphan-fold rule drops the failed-row
    // bracket), status `failed`, reasons `["invalid manifest"]`,
    // componentsResolved false. Byte form: header + 2-space-indent failed row.
    "manifest-invalid": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "bad-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "bad-mp",
          scope: "user",
          reasons: ["invalid manifest"],
          componentsResolved: false,
        },
      },
    },
  },
};
