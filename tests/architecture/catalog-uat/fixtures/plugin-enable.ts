import { narrowUnsupportedKinds } from "../../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";
import { piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin enable command surface. */
export const PLUGIN_ENABLE_FIXTURES: FixtureMap = {
  "/claude:plugin enable <plugin>@<marketplace>": {
    "enable-fresh": {
      pi: piWithBothLoaded(),
      // Re-materialization through the install ledger -- UAT-04 (decision
      // 2026-06-11): BARE always-marketplace-header
      // form (no `(added)` token; that header belongs to `marketplace add`)
      // + `(installed)` plugin row (existing state-change token);
      // reload-hint fires per SNM-33.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // ENBL-07 / FSTAT-07 / D-66-04: a re-enable admitted through the partial
    // gate drops component kinds, so the row follows the RESOLUTION (`◉
    // (partially-installed)` + the kinds) rather than the verb. SEV-03: the
    // degradation predates the enable, so the row stays `info` (no summary
    // line) -- parity with install --partial and the backfill partial arm.
    "enable-partial": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: narrowUnsupportedKinds(["lspServers"]),
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / D-86-03: the enable branch runs the same ledger over the same
    // bridges as install, so a malformed-frontmatter degrade renders the same
    // `(installed) {malformed skill}` row at the same `warning` raise. Distinct
    // from `enable-partial`: a DEGRADED component installed short, a DROPPED
    // one is absent.
    "enable-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08: an orphan companion field is a config bug the ledger
    // reports; it names itself in the brace without moving the severity
    // channel, exactly as on the install row.
    "enable-orphan-rewake": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // SEV-01 / WR-06: the enable row derives `dependencies` from the ledger's
    // staged counts, so a re-enable that staged an agent declares the
    // `pi-subagents` companion. With that companion unloaded the row takes the
    // marker AND the info -> warning raise, exactly as the install row does for
    // the same ledger run.
    "enable-soft-dep": {
      pi: piWithNothingLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "foo-plugin",
                version: "1.2.3",
                dependencies: ["agents"],
              },
            ],
          },
        ],
      },
    },

    "enable-idempotent": {
      pi: piWithBothLoaded(),
      // Idempotent no-op -- benign reason routes to info per UXG-02 / D-28-06.
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "info",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["already enabled"],
              },
            ],
          },
        ],
      },
    },

    "enable-not-installed": {
      pi: piWithBothLoaded(),
      // WR-03 / D-01: marketplace present, plugin row absent. Nothing was
      // enabled or disabled, so the operation was NOT carried out -> `error`,
      // the same stamp every sibling verb applies to `["not installed"]`.
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["not installed"],
              },
            ],
          },
        ],
      },
    },

    // SCOPE-01: the container is registered in the scope the command did not
    // target. The brace names it beside `not installed` so this miss stops
    // rendering byte-identically to `enable-not-installed` above -- the two take
    // different remedies. The scope word is the OPPOSITE of the row's bracket.
    "enable-not-installed-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["not installed", "marketplace in user scope"],
              },
            ],
          },
        ],
      },
    },

    "enable-source-missing": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["source missing"],
              },
            ],
          },
        ],
      },
    },

    // WR-02 / CR-01 / D-98-03: the stale-gate enable failure. `partialHint` on a
    // `failed` row is set ONLY by the enable-failure narrowing, and it selects
    // the enable-worded `STALE_GATE_UPDATE_HINT_TRAILER` -- NOT the XSURF-03
    // update-decline trailer, whose "re-run" wording would name `enable`, the
    // one command that rejects `--partial`. The `{lsp}` brace comes through the
    // same `narrowUnsupportedKinds` seam the list `(partially-upgradable)` row
    // uses.
    "enable-failed-stale-gate": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                version: "1.2.3",
                reasons: narrowUnsupportedKinds(["lspServers"]),
                partialHint: true,
                cause: new Error('Plugin "foo-plugin" is not installable: contains lspServers'),
              },
            ],
          },
        ],
      },
    },

    "enable-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      },
    },

    "enable-invalid-config": {
      // CFG-03 abort. T-53-02-02: the marketplace name carries
      // the file BASENAME via the renderer; here the plugin row carries the
      // `{invalid manifest}` reason -- the orchestrator aborts BEFORE entering
      // the cascade, so the body is the bare cascade with the failed plugin
      // row.
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "claude-plugins-official",
            scope: "user",
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "foo-plugin",
                reasons: ["invalid manifest"],
              },
            ],
          },
        ],
      },
    },
  },
};
