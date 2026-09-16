import { piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin uninstall command surface. */
export const PLUGIN_UNINSTALL_FIXTURES: FixtureMap = {
  "/claude:plugin uninstall <plugin>@<marketplace>": {
    success: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WR-06 / DATA-01: the preserving disposition, which is the only thing that
    // separates this row from the `success` row above.
    "success-keep-data": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["data kept"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "success-soft-dep-omitted": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    "failure-permission-denied": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["permission denied"],
                cause: new Error("EACCES: permission denied, unlink '/path/to/file'"),
              },
            ],
          },
        ],
      },
    },

    // ATTR-04 / SCOPE-01 / M3 / M4: marketplace never added (or present only
    // in the other scope) -> LOUD standalone `marketplace-not-added` variant
    // carrying the requested-scope bracket (distinct from the silent PU-5
    // already-gone-plugin converge).
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      } satisfies NotificationMessage,
    },

    // D-01 / PU-5: standalone uninstall of an already-gone (not-installed)
    // plugin -- the marketplace IS present, so the header renders; the absent
    // target reports an `error` row (was literal silence). The orchestrated
    // reconcile converge stays silent (no row) per WR-06 / NFR-2.
    "already-gone-not-installed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                reasons: ["not installed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target, so the brace names it beside `not installed` -- the scope word is
    // always the OPPOSITE of the row's bracket.
    "already-gone-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                name: "helper",
                reasons: ["not installed", "marketplace in project scope"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // D-05-14 / D-05-15 / PRUNE-05: another installed plugin in the scope
    // still declares the target, so the uninstall is refused and nothing is
    // removed. The dependents ride the cause line, never the token.
    "refused-dependents-remain": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["dependents remain"],
                cause: new Error("required by deploy-kit@official"),
              },
            ],
          },
        ],
      },
    },

    // D-05-07: some OTHER record's declarations could not be established, so
    // the uninstall is refused rather than risked. The brace carries the
    // declarer's read-failure token and the cause names which record it was.
    "refused-declarer-unreadable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                reasons: ["not in manifest"],
                cause: new Error(
                  "cannot read the dependencies of other@official: not declared by its marketplace",
                ),
              },
            ],
          },
        ],
      },
    },
  },
};
