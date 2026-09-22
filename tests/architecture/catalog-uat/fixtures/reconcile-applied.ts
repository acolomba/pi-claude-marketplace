import { narrowUnsupportedKinds } from "../../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";
import { piWithBothLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the applied reconcile notification surface. */
export const RECONCILE_APPLIED_FIXTURES: FixtureMap = {
  "reconcile-applied-cascade": {
    "success-cascade-mixed": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "new-mp",
            scope: "project",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "new-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
          {
            name: "other-mp",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "other-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "soft-fail-mixed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "flaky-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["network unreachable"],
            plugins: [],
          },
          {
            name: "ok-mp",
            scope: "user",
            status: "added",
            plugins: [
              {
                status: "installed",
                name: "ok-plugin",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
    "invalid-config-row": {
      // T-55-02-01 / T-53-02-02: BASENAME only -- never the absolute path.
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            needsReload: false,
            reasons: ["invalid manifest"],
            plugins: [],
          },
        ],
      },
    },

    // I5 / PR #51: invalid-config row that carries the loadConfig diagnostic
    // detail (EACCES / JSON-parse / schema key) via a synthetic plugin child
    // (SNM-10 pattern -- mp headers cannot carry a cause). Absolute paths
    // are stripped at the apply boundary via `redactAbsolutePaths`; the
    // parse / permission detail survives so the operator can debug.
    "invalid-config-row-with-cause": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "claude-plugins.json",
            scope: "project",
            status: "failed",
            severity: "error",
            reasons: ["invalid manifest"],
            plugins: [
              {
                status: "failed",
                severity: "error",
                needsReload: false,
                name: "claude-plugins.json",
                reasons: ["invalid manifest"],
                cause: new Error("schema validation failed: /marketplaces: Expected object"),
              },
            ],
          },
        ],
      },
    },

    // I1 / PR #51: reconcile-driven `marketplace remove` whose cascade
    // unstaged some plugins and failed others. Bare `(failed)` mp header +
    // one row per unstaged plugin (○ uninstalled) + one row per failed
    // plugin (⊘ {reason}). Mirrors the standalone `marketplace remove`
    // `partial` byte form: collapsing to ONE mp-failed row would silently
    // drop the N-1 other rows.
    "partial-marketplace-remove": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "acme-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            plugins: [
              { status: "uninstalled", name: "plugin-ok", severity: "info", needsReload: true },
              {
                status: "failed",
                name: "plugin-fail-a",
                reasons: ["permission denied"],
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "plugin-fail-b",
                reasons: ["source missing"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // BFILL-01 / SEV-05 / D-69-04: a load-time backfill promotion row carries
    // the re-resolved dropped-component kinds as a factual {reasons} brace
    // through the shared narrowUnsupportedKinds seam (lspServers -> lsp). The
    // marketplace was already added, so its header is bare (no status token).
    // SEV-03 / A3: a benign promotion stays info -- no expectedSeverity.
    "backfill-partially-installed": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                name: "hello",
                version: "1.0.0",
                dependencies: [],
                reasons: narrowUnsupportedKinds(["lspServers"]),
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // SEV-05 / D-69-04: a backfill partially-installed row whose dropped-kind set is
    // empty renders brace-less -- byte-identical to the pre-SEV-05 form (the
    // change is additive; rows without reasons do not gain a brace).
    "backfill-partially-installed-no-reasons": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                name: "hello",
                version: "1.0.0",
                dependencies: [],
                reasons: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WR-06 / SEV-01: the projected enable row derives `dependencies` from the
    // ledger's staged counts, so the soft-dep marker fires on the load-time
    // surface too. Severity stays `info` -- this projection applies the
    // companion raise on neither arm, so its enable arm agrees with its
    // install arm; the standalone verb owns the SEV-01 composition.
    "reconcile-enable-soft-dep": {
      pi: piWithNothingLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "hello",
                version: "1.0.0",
                dependencies: ["agents"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // DFEN-04 / OUT-01 / OUT-04: the load-time counterpart of the standalone
    // install-disabled row. Same cause token and same remedy trailer; the
    // reload stamp differs (`true` here) because this row shares the arm every
    // other reconcile disable uses.
    "reconcile-install-disabled": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "local-mp",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "hello",
                version: "1.0.0",
                reasons: ["installs disabled"],
                enableHint: true,
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // LOAD-01: the load-time dependency check disabled a plugin whose declared
    // dependency has no record in the scope. The token names the condition and
    // the cause line carries the remedy, which names both parties.
    "reconcile-dependency-unsatisfied": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "disabled",
                name: "deploy-kit",
                version: "1.0.0",
                reasons: ["dependency unsatisfied"],
                cause: new Error('Install "secrets-vault@mp" or uninstall "deploy-kit@mp"'),
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // LOAD-01: the same check, on the arm where the dependency IS recorded but
    // its own record is disabled. Same token, because the dependency is not
    // usable at all; the remedy says enable rather than install.
    "reconcile-dependency-disabled": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "disabled",
                name: "deploy-kit",
                version: "1.0.0",
                reasons: ["dependency unsatisfied"],
                cause: new Error('Enable "secrets-vault@mp" or uninstall "deploy-kit@mp"'),
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // LOAD-01: the same check, on the arm where the dependency is recorded and
    // enabled at a version outside the declared range. The second token, and a
    // remedy that names the canonical folded range.
    "reconcile-dependency-version-unsatisfied": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "disabled",
                name: "deploy-kit",
                version: "1.0.0",
                reasons: ["dependency version unsatisfied"],
                cause: new Error(
                  'Update "secrets-vault@mp" to satisfy >=2.0.0 <3.0.0-0, or uninstall "deploy-kit@mp"',
                ),
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // RESV-06: the load-time counterpart of the standalone dependency-cascade
    // {dependency failed} row. Reconcile drives ONE orchestrated outcome per
    // declared plugin, so the requesting plugin's own row carries both the
    // {dependency failed} token and the failing dependency's own cause line.
    "reconcile-install-dependency-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "hello",
                reasons: ["dependency failed"],
                cause: new Error('Dependency "missing@mp" is not declared by its marketplace.'),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // MISS-01 / D-09-09: `/reload` installed a missing declared dependency
    // through the install cascade. The materialized member's row carries
    // `{dependency installed}`; the dependent that declared it comes back up
    // in the same reload as an ordinary `(installed)` row (D-09-07).
    "reconcile-dependency-installed": {
      pi: piWithBothLoaded(),
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "installed",
                name: "secrets-vault",
                version: "1.0.0",
                dependencies: [],
                reasons: ["dependency installed"],
                severity: "info",
                needsReload: true,
              },
              {
                status: "installed",
                name: "deploy-kit",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // MISS-02 / D-09-10: `/reload` could not install a missing declared
    // dependency. The dependency's own `(failed)` row reuses the standalone
    // cascade's `{dependency failed}` token and cause line; the dependent
    // stays held by the LOAD-01 `{dependency unsatisfied}` row with the
    // install remedy.
    "reconcile-dependency-install-failed": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "reconcile-applied-cascade",
        label: "Reconcile",
        cardinality: "plural",
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "failed",
                name: "secrets-vault",
                reasons: ["dependency failed"],
                cause: new Error('Dependency "crypto-core@mp" is not declared by its marketplace.'),
                severity: "error",
                needsReload: false,
              },
              {
                status: "disabled",
                name: "deploy-kit",
                version: "1.0.0",
                reasons: ["dependency unsatisfied"],
                cause: new Error('Install "secrets-vault@mp" or uninstall "deploy-kit@mp"'),
                severity: "warning",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
  },
};
