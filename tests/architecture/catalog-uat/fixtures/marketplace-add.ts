import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the marketplace add command surface. */
export const MARKETPLACE_ADD_FIXTURES: FixtureMap = {
  "/claude:plugin marketplace add <source>": {
    "path-source": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [{ name: "local-mp", scope: "user", status: "added", plugins: [] }],
      },
    },

    "github-source": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "added",
            plugins: [],
          },
        ],
      },
    },

    "failure-unreachable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "unreachable-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [],
          },
        ],
      },
    },

    // ATTR-07 / D-48-A: the five marketplace-add precondition reasons render on
    // the marketplace subject via the MpFailed.reasons brace. Post-manifest
    // failures carry the derived name; pre-manifest failures carry the raw
    // source string (A2). All route to `error` severity (failed-bearing).
    "add-duplicate-name": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["duplicate name"],
            plugins: [],
          },
        ],
      },
    },

    "add-stale-clone": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["stale clone"],
            plugins: [],
          },
        ],
      },
    },

    "add-unsupported-source": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "git@github.com:foo/bar.git",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["unsupported source"],
            plugins: [],
          },
        ],
      },
    },

    "add-source-missing": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "./missing-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["source missing"],
            plugins: [],
          },
        ],
      },
    },

    "add-invalid-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "anthropics/claude-plugins-official",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },

    // D-76-08: a url-source `marketplace add` whose clone hits an HTTP auth
    // challenge (401/403). Truthful attribution -- `{authentication required}`,
    // NOT `{network unreachable}`. The reason + HTTP cause chain ride a
    // synthetic-child failed row (marketplace headers carry no `cause`; SNM-10),
    // mirroring the `update-path-invalid-manifest` recipe. The subject is the
    // user-typed URL (pre-name failure). Severity `error`; no reload-hint.
    "add-authentication-required": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "https://gitlab.com/acme/private-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "https://gitlab.com/acme/private-mp",
                reasons: ["authentication required"],
                cause: new Error("HTTP Error: 401 Unauthorized"),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
  },
};
