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

    // MPA-01: a same-source re-add changes nothing and stays info.
    "already-added": {
      pi: piWithBothLoaded(),
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            status: "skipped",
            reasons: ["already added"],
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
    // source string. All route to `error` severity (failed-bearing).
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

    // MA-14 / WR-02 / NFR-9: a recognized leftover the add could not remove.
    // The advisory names the cleanup failure with every absolute path reduced
    // to its last segment at the composition site.
    "add-stale-clone-cleanup-leak": {
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
        advisories: [
          "    failed to clean up marketplace leftover clone at claude-plugins-official: EACCES: permission denied, rm 'claude-plugins-official'",
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

    // GHB-01 / D-03: under the GitHub base override, a failed add names the
    // fetched URL on a synthetic-child failed row (SNM-10).
    "add-fetched-url": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "anthropics/claude-plugins-official",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "anthropics/claude-plugins-official",
                reasons: ["source missing"],
                cause: new Error("HTTP Error: 404", {
                  cause: new Error(
                    "fetched https://mirror.example/git/anthropics/claude-plugins-official.git",
                  ),
                }),
                severity: "error",
                needsReload: false,
              },
            ],
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

    // ADD-10: the git host answered the clone with an HTTP status outside the
    // 401/403 auth challenge and the 404/410 absence answers, so the synthetic
    // child carries `{network error}`. The first frame of the cause line names
    // the status and the URL the clone fetched, as on `update-host-http-error`.
    "add-host-http-error": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        label: "Marketplace add",
        cardinality: "single",
        marketplaces: [
          {
            name: "https://git.example.com/acme/flaky-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              {
                status: "failed",
                name: "https://git.example.com/acme/flaky-mp",
                reasons: ["network error"],
                cause: new Error("503 on https://git.example.com/acme/flaky-mp", {
                  cause: new Error("HTTP Error: 503 Service Unavailable"),
                }),
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
