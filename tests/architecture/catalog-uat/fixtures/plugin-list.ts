import { LIST_CONTEXT } from "../../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { notifyWithContext } from "../../../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import { piWithBothLoaded, piWithMcpLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

const AVAILABLE_INSTALLS_DISABLED_ROWS = [
  {
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    plugins: [
      {
        status: "available",
        name: "helper",
        version: "1.0.0",
        severity: "info",
        needsReload: false,
        reasons: ["installs disabled"],
      },
    ],
  },
] as const;

const REMOTE_INSTALLS_DISABLED_ROWS = [
  {
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    plugins: [
      {
        status: "remote",
        name: "git-plugin",
        version: "1.2.3",
        severity: "info",
        needsReload: false,
        reasons: ["installs disabled"],
      },
    ],
  },
] as const;

/** Catalog fixtures for the plugin list command surface. */
export const PLUGIN_LIST_FIXTURES: FixtureMap = {
  "/claude:plugin list": {
    empty: {
      pi: piWithBothLoaded(),
      message: { marketplaces: [] },
    },

    "single-mp-mixed": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              {
                status: "upgradable",
                name: "beta",
                version: "1.0.0",
                reasons: ["stale clone"],
              },
              { status: "unavailable", name: "delta", reasons: ["unsupported hooks"] },
              {
                status: "partially-available",
                name: "epsilon",
                reasons: ["unsupported hooks", "lsp"],
              },
              { status: "available", name: "gamma", version: "2.0.0" },
            ],
          },
        ],
      },
    },

    "same-plugin-both-scopes": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    "project-orphan-folded": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
                scope: "project",
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                // Same-scope row: no explicit `scope`. The renderer's
                // orphan-fold rule (D-16-17) suppresses the bracket when
                // `p.scope === mp.scope`; here we leave `p.scope`
                // undefined so the short-circuit is on the `undefined`
                // arm rather than the equality arm. Either input shape
                // yields the same byte form; mirrors the cleaner
                // `same-plugin-both-scopes` fixture above.
              },
            ],
          },
        ],
      },
    },

    "soft-dep-on-installed": {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "dual",
                version: "0.5.0",
                dependencies: ["agents", "mcp"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
              },
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "mcp-tool",
                version: "2.0.0",
                dependencies: ["mcp"],
              },
            ],
          },
        ],
      },
    },

    "unparseable-mp": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "other-mp",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "unparseable-mp",
            scope: "user",
            status: "failed",
            severity: "error",
            needsReload: false,
            // Empty plugins[] -- the bare failed marketplace header is the
            // entire block. The type model does not carry cause on
            // marketplace headers; orchestrators wanting to surface the
            // parse error must include a per-plugin failed/manual-recovery
            // row carrying the diagnostic as `cause?: Error`.
            plugins: [],
          },
        ],
      },
    },

    "zero-plugin-mp-block": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          { name: "empty-mp", scope: "project", plugins: [] },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    "multiple-mps": {
      pi: piWithMcpLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "project",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "0.9.0",
                dependencies: [],
              },
            ],
          },
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
              },
              { status: "available", name: "beta", version: "2.0.0" },
            ],
          },
          {
            name: "zeta-mp",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "tool",
                version: "1.0.0",
                dependencies: ["agents"],
              },
            ],
          },
        ],
      },
    },

    // SNM-35: persisted PI-7 hash renders as git-style short SHA on a
    // list-surface inventory row (`hash-2ea95f85703d` -> `v#2ea95f8`).
    "hash-version-list": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "hashed-plugin",
                version: "hash-2ea95f85703d",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // D-77-01 / PURL-09: a persisted git-source `sha-<12hex>` version renders as
    // the git-style short SHA on a list-surface inventory row
    // (`sha-a1b2c3d4e5f6` -> `v#a1b2c3d`).
    "sha-version-list": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "git-plugin",
                version: "sha-a1b2c3d4e5f6",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },

    // PL-4: description on all four list-surface variants. Beta's description
    // is 80 chars (> 66) so it truncates to 63 + "..." = 66 chars rendered.
    "description-lines": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                severity: "info",
                needsReload: false,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                description: "A short description of the alpha plugin.",
              },
              {
                status: "upgradable",
                name: "beta",
                version: "1.0.0",
                reasons: ["stale clone"],
                // 80 chars -- truncated to 63 + "..." = 66 displayed.
                description:
                  "A longer description that is exactly sixty-three characters longer than expected.",
              },
              {
                status: "available",
                name: "gamma",
                version: "2.0.0",
                description: "Installable plugin with a description.",
              },
              {
                status: "unavailable",
                name: "delta",
                reasons: ["unsupported hooks"],
                description: "Unavailable plugin that still surfaces its description.",
              },
            ],
          },
        ],
      },
    },

    // D-54-01 / ENBL-04: list-surface inventory row for a
    // recorded-but-disabled plugin. The new `(disabled)` closed-set token
    // mirrors the catalog list section's `disabled-inventory` state.
    "disabled-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // PL-4: the disabled inventory row carries the manifest description on a
    // second 4-space-indented line, same as the other list-surface variants.
    "disabled-inventory-with-description": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
                description: "Disabled plugin that still surfaces its description.",
              },
            ],
          },
        ],
      },
    },

    // ENBL-16 / D-100-07: the disabled inventory row carries `not in manifest`
    // -- and no other reason. The stamp is an orchestrator decision made at the
    // inventory site, so the fresh-disable transition row (which stamps
    // nothing) keeps rendering bare. `piWithBothLoaded` is not what suppresses
    // the soft-dep markers here: the renderer passes both soft-dep flags as
    // `false` for this variant whatever the probe reports (ENBL-15).
    "disabled-inventory-not-in-manifest": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "disabled",
                name: "foo-plugin",
                version: "1.2.3",
                reasons: ["not in manifest"],
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // OUT-02 / DFEN-04: list-surface inventory row for a not-installed plugin
    // whose marketplace ENTRY declares `defaultEnabled: false`. The claim is
    // entry-derived -- the cached manifest carries it whatever the clone state --
    // so the `(available)` row names the author's install-time declaration
    // before the install runs, not after it. The same plugin's post-install row
    // is the `install-disabled` state on the install surface. Severity `info`;
    // `needsReload: false`.
    //
    // Driven through the list surface's own `CommandContext` via `emit`, for
    // the same reason the bulk-update no-op states are: the reason brace on a
    // `(available)` / `(remote)` row is composed by `LIST_RENDER`, while the
    // central `renderPluginRow` arms omit `composeReasons` by construction --
    // no producer that renders through THEM stamps `reasons` on those two
    // statuses (OUT-05 / RSTA-01). `notifyWithContext` is the seam `listPlugins`
    // itself
    // calls, so the block below is byte-paired with the real list surface.
    "available-installs-disabled": {
      pi: piWithBothLoaded(),
      message: { marketplaces: AVAILABLE_INSTALLS_DISABLED_ROWS },
      emit: (ctx, pi) => {
        notifyWithContext(
          ctx,
          pi,
          LIST_CONTEXT,
          AVAILABLE_INSTALLS_DISABLED_ROWS,
          undefined,
          "plural",
        );
      },
    },

    // RSTA-01 / D-80-03: list-surface inventory row for a not-installed
    // git-source plugin whose clone/mirror is not materialized locally. The
    // `(remote)` closed-set token wears the dedicated `◌` glyph. Bare row --
    // no scope bracket (SNM-11), no reasons brace (D-80-03). Severity `info`;
    // `needsReload: false`.
    "remote-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "remote",
                name: "git-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // PL-4: the remote inventory row carries the manifest description on a
    // second 4-space-indented line, same as the other list-surface variants.
    "remote-inventory-with-description": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "remote",
                name: "git-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
                description: "Remote git-source plugin not yet fetched locally.",
              },
            ],
          },
        ],
      },
    },

    // OUT-02 / OUT-05 / RSTA-01: the `remote-inventory` row above
    // whose marketplace ENTRY declares `defaultEnabled: false`. This NARROWS
    // the bare-row rule rather than reversing it: the row still refuses every
    // probe-derived reason and both soft-dependency markers (no materialized
    // tree exists to derive either from) and admits exactly one entry-derived
    // token, which needs no tree at all. Severity `info`; `needsReload: false`.
    // Driven through the list surface's `CommandContext` via `emit`, for the
    // reason recorded on the `(available)` state above.
    "remote-installs-disabled": {
      pi: piWithBothLoaded(),
      message: { marketplaces: REMOTE_INSTALLS_DISABLED_ROWS },
      emit: (ctx, pi) => {
        notifyWithContext(
          ctx,
          pi,
          LIST_CONTEXT,
          REMOTE_INSTALLS_DISABLED_ROWS,
          undefined,
          "plural",
        );
      },
    },

    // WDET-04: a workflow-bearing plugin uses the existing partial inventory
    // grammar. The typed reason has info severity and adds no hint or reload
    // trailer before installation.
    "workflow-partially-available-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                version: "1.0.0",
                reasons: ["workflows"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-02 / D-66-03: list-surface inventory row for a recorded-installed
    // plugin currently re-resolving `partially-available`. The derived `partially-installed`
    // token wears the dedicated `◉` glyph, distinct from the clean `●`
    // `(installed)` row. Severity `info` (the row omits `severity`).
    "partially-installed-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                version: "1.0.0",
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-02 / PHOOK-04 / PHOOK-05 / D-71-04: list-surface inventory row for
    // a recorded-installed partial-hook plugin re-resolving `partially-available` with
    // one or more hook events / matcher groups dropped. The partially-available
    // `hooks` kind rides the SINGLE aggregate `{unsupported hooks}` brace (no
    // per-handler fan-out on the list row -- D-71-04); the
    // `event(matcher) (unsupported)` breakdown lives on `info` (D-71-05). The
    // brace is sourced via `narrowUnsupportedKinds` (typed kind), distinct from
    // the structural `narrowResolverNotes` path an `unavailable` malformed-hooks
    // row uses.
    "partially-installed-inventory-hooks": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "hook-plugin",
                version: "1.0.0",
                reasons: ["unsupported hooks"],
              },
            ],
          },
        ],
      },
    },

    // FSTAT-04 / D-66-02 / D-66-03: list-surface inventory row for a
    // currently-clean installed plugin whose newer no-network candidate would
    // newly degrade it. The derived `partially-upgradable` token REUSES the `●`
    // glyph (the row is clean today), mirroring the `upgradable` precedent.
    "partially-upgradable-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-upgradable",
                name: "clean-plugin",
                version: "1.0.0",
                reasons: ["unsupported component"],
              },
            ],
          },
        ],
      },
    },

    // INV-01: the steady-state inventory row for a record whose marketplace
    // manifest loaded successfully but does not declare it. The clean
    // `(installed)` token and `●` glyph are unchanged -- manifest absence is a
    // reason, not a status. Severity stays `info` (no `expectedSeverity`).
    "manifest-absent-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "installed",
                name: "orphan-plugin",
                version: "1.0.0",
                needsReload: false,
                dependencies: [],
                reasons: ["not in manifest"],
                severity: "info",
              },
            ],
          },
        ],
      },
    },

    // INV-02: manifest absence and dropped components are independent axes, so
    // a degraded manifest-absent record carries BOTH -- absence first, then the
    // `narrowUnsupportedKinds` output. Severity stays `info`.
    "manifest-absent-partially-installed-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "partially-installed",
                name: "degraded-plugin",
                version: "1.0.0",
                reasons: ["not in manifest", "lsp"],
              },
            ],
          },
        ],
      },
    },
  },
};
