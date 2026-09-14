import { narrowUnsupportedKinds } from "../../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";
import {
  piWithAllLoaded,
  piWithBothLoaded,
  piWithNothingLoaded,
  piWithoutWorkflowEngine,
} from "../mock-pi.ts";

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

    // BFILL-01 / WCONV-03 / SEV-05 / D-69-04: a load-time backfill promotion row
    // leads its brace with the convergence marker, then carries the re-resolved
    // dropped-component kinds through the shared narrowUnsupportedKinds seam
    // (lspServers -> lsp). The marketplace was already added, so its header is
    // bare (no status token). SEV-03 / A3: a benign promotion stays info -- no
    // expectedSeverity.
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
                reasons: ["components now supported", ...narrowUnsupportedKinds(["lspServers"])],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WCONV-03 / SEV-05 / D-69-04: a backfill partially-installed row whose
    // dropped-kind set is empty still braces the convergence marker alone. A
    // backfilled row has no brace-less shape.
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
                reasons: ["components now supported"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WCONV-03 / D-69-04: the FULLY PROMOTED arm -- a record whose supported set
    // grew re-resolved clean, so the row takes the `installed` byte form a fresh
    // install renders and the convergence marker is the only thing separating
    // the two. Probe with every companion loaded, so no soft-dep marker fires
    // and this state isolates the marker. SEV-03 / A3: a benign promotion stays
    // info -- no expectedSeverity.
    "backfill-installed": {
      pi: piWithAllLoaded(),
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
                dependencies: [],
                reasons: ["components now supported"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },

    // WCONV-03 / WDEP-04 / D-16-15: the same fully promoted row in a session
    // with no host workflow engine -- the real population's likely first render.
    // Two tokens, ONE brace, and the composed order is what this state pins: the
    // convergence marker is caller-placed and leads, the soft-dep marker is
    // appended by `composeReasons` and trails. Severity stays info: this
    // projection applies no companion raise on either arm.
    "backfill-installed-workflow-engine-absent": {
      pi: piWithoutWorkflowEngine(),
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
                dependencies: ["workflows"],
                reasons: ["components now supported"],
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
  },
};
