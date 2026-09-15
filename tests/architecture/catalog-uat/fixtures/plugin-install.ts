import { piWithBothLoaded, piWithMcpLoaded, piWithNothingLoaded } from "../mock-pi.ts";

import type { NotificationMessage } from "../../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin install command surface. */
export const PLUGIN_INSTALL_FIXTURES: FixtureMap = {
  "/claude:plugin install <plugin>@<marketplace>": {
    success: {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "helper",
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

    // SEV-01: both declared companions are unloaded, so the otherwise-clean
    // install row stamps `warning` (silent degradation) and the cascade carries
    // the `needs attention` summary line. The per-row bytes are unchanged from
    // the info form -- only the severity / summary line moves.
    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents", "mcp"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08: install succeeds but the parsed hooks.json carries
    // an orphan-rewake handler (`rewakeMessage` / `rewakeSummary` without
    // `asyncRewake: true`). The closed-set REASONS token rides the existing
    // installed-row reasons brace. No soft-dep markers (both companion
    // extensions are loaded), so the brace contains exactly one reason.
    "success-with-orphan-rewake": {
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
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // SURF-05 / D-63-08 + D-16-15: the orphan-rewake token and the soft-dep
    // marker share ONE brace block. `composeReasons` appends the soft-dep
    // markers AFTER the typed `reasons[]`, so the brace renders as
    // `{orphan rewake, requires pi-subagents}`. Probe with only `mcp`
    // loaded so the `agents` soft-dep marker fires.
    // SEV-01: the declared `agents` companion is unloaded, so the success row
    // stamps `warning` even though the install succeeded -- the cascade carries
    // the `needs attention` summary line (per-row bytes unchanged).
    "success-with-orphan-rewake-and-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },

    // WR-03: a `--partial` install succeeds with one or more components dropped
    // (the resolver's `partially-available` arm) -- the success row is
    // `(partially-installed)`. The partially-available arm still stages the SUPPORTED
    // components, so the row carries `dependencies`; with the `agents` companion
    // extension unloaded the soft-dep marker fires in the SAME brace AFTER the
    // dropped-component reason (MSG-GR-4), rendering `{lsp, requires
    // pi-subagents}`. Probe with only `mcp` loaded so the `agents` marker fires.
    // SEV-01: the unloaded `agents` companion is a silent degradation
    // independent of the dropped components, so the partially-installed success row
    // stamps `warning` and the cascade carries the `needs attention` summary
    // line. The direct `--partial` opt-in itself stays benign info -- the warning
    // is the missing companion, not the partial install.
    "success-partially-installed-with-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["lsp"],
              },
            ],
          },
        ],
      },
    },

    // WDET-04: explicit partial consent installs the supported components and
    // reports the dropped workflow kind through the existing success grammar.
    "workflow-partial-install-success": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-installed",
                severity: "info",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                reasons: ["workflows"],
              },
            ],
          },
        ],
      },
    },

    // DFEN-04 / OUT-01 / OUT-04: the install ran whole and then unstaged
    // because the plugin's own `defaultEnabled` said so. The `◍` row names the
    // author-declared cause and carries the frozen enable-hint trailer; no
    // reload hint, because nothing net entered or left Pi's resource view.
    "install-disabled": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "helper",
                version: "1.0.0",
                reasons: ["installs disabled"],
                enableHint: true,
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // WARN-01 / FSTAT-07: the same row over a degraded ledger run. The durable
    // facts ride the same brace after the cause, and the frontmatter degrade
    // raises the row to warning (so the cascade carries its summary line).
    "install-disabled-degraded": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "disabled",
                name: "helper",
                version: "1.0.0",
                reasons: ["installs disabled", "malformed skill", "unsupported component"],
                enableHint: true,
                severity: "warning",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // SEV-02 / D-69-03 / XSURF-01: partially-available install failure -- the row
    // renders the resolver-state-driven `(partially-available)` token (consistent with
    // list / info), carries the `--partial` hint trailer, and renders at error
    // severity.
    "failure-unsupported-features": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                reasons: ["unsupported hooks", "lsp"],
                partialHint: true,
                severity: "error",
              },
            ],
          },
        ],
      },
    },

    // WDET-04: a normal install rejects a workflow-bearing plugin through the
    // existing partially-available error row and partial-install hint.
    "workflow-install-rejection": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "partially-available",
                name: "helper",
                reasons: ["workflows"],
                partialHint: true,
                severity: "error",
              },
            ],
          },
        ],
      },
    },

    // SEV-02 / D-69-03 / D-70-02: structurally `unavailable` install failure --
    // force cannot degrade-install a structural defect, so the row carries NO
    // `--partial` hint, but it still stamps error severity (the leading summary
    // line fires) because an install failure must read as an error.
    "failure-structural-unavailable": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "unavailable",
                name: "helper",
                reasons: ["unsupported source"],
                severity: "error",
              },
            ],
          },
        ],
      },
    },

    "failure-runtime-with-cause": {
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
                cause: new Error(
                  "state.json at /path/to/state.json is not valid JSON: Unexpected token n in JSON at position 0",
                ),
              },
            ],
          },
        ],
      },
    },

    "failure-rollback-partial": {
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
                reasons: ["rollback partial"],
                cause: new Error("orchestrator failed mid-staging"),
                rollbackPartial: [
                  {
                    phase: "phase3a",
                    cause: new Error("failed to remove staged agent: EACCES"),
                  },
                  { phase: "phase3b", cause: new Error("orphan path: /.../helper.bak") },
                ],
              },
            ],
          },
        ],
      },
    },

    // ATTR-01 / ATTR-08 / M1: marketplace absent -> standalone
    // `marketplace-not-added` variant on the marketplace subject (NOT
    // `{not in manifest}` on a plugin row). install always carries a
    // resolved scope, so the `[scope]` bracket is always present.
    "missing-marketplace-not-added": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "project",
      } satisfies NotificationMessage,
    },

    // CMP-4 / SCOPE-01: the container exists in the scope the install did not
    // target, so the brace carries the cross-scope structural token INSTEAD of
    // `marketplace not added`. The message field is a BOOLEAN --
    // notification-grammar.ts owns the bytes.
    // The bare-row state above is the SAME variant with the flag omitted, which
    // is what a miss in both scopes emits.
    "missing-marketplace-not-added-cross-scope": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "user",
        presentInOtherScope: true,
      } satisfies NotificationMessage,
    },

    // The project-target direction of the same claim. Unreachable from
    // `install` (the CMP-3 fallback adopts a user-scope marketplace into
    // project scope) but reachable from every other verb that renders this row.
    "missing-marketplace-not-added-cross-scope-project": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "project",
        presentInOtherScope: true,
      } satisfies NotificationMessage,
    },

    // RESV-01 / RESV-06: the dependency cascade's success block. One row per
    // closure member beside the requesting plugin's own row, in the canonical
    // name-then-scope order. A dependency renders by its full `<plugin>@<mp>`
    // key because it may come from a marketplace other than the header's; the
    // requesting plugin renders bare, since the header already names its
    // marketplace. RESV-05: a dependency already present in the target scope is
    // reported as a benign `(skipped) {already installed}` -- never reinstalled
    // -- which is what distinguishes it from one this command materialized.
    "dependency-cascade-success": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "formatter@tools",
                version: "2.1.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              {
                status: "skipped",
                name: "linter@tools",
                version: "3.0.0",
                reasons: ["already installed"],
              },
            ],
          },
        ],
      },
    },

    // RESV-05: the same skip, against a record that is DISABLED. A disabled
    // record keeps its inventory and its name reservations while its artifacts
    // are off disk, so the requesting plugin installed against a dependency
    // that materialized nothing. `{already installed}` alone is the benign
    // idempotent skip and would report that as fine; the second token names it
    // and lifts the row -- and the block -- to warning. The install still
    // stands: enablement is never decided on a dependency's behalf, so the row
    // is the whole remedy.
    "dependency-cascade-disabled-skip": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
              {
                status: "skipped",
                name: "linter@tools",
                version: "3.0.0",
                reasons: ["already installed", "dependency disabled"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    // RESV-03: the constraint is satisfiable but the dependency's source
    // advertises no release tag inside it. The failing DEPENDENCY is the row's
    // subject and carries the constraint in its cause; the requesting plugin
    // gets its own row saying its install did not complete.
    "dependency-no-matching-version": {
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
                name: "formatter@tools",
                reasons: ["no matching version"],
                cause: new Error(
                  'Dependency "formatter@tools" has no release tag satisfying "^2.0.0".',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-03: two declarations of one dependency ask for version sets that do
    // not overlap. The cause names the joined declared ranges and the
    // intersection's own measurement, never a declaration's prose.
    "dependency-version-conflict": {
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
                name: "formatter@tools",
                reasons: ["version conflict"],
                cause: new Error(
                  'Dependency "formatter@tools" has contradictory version constraints "^1.0.0 ^2.0.0" (inputs 1 and 2 do not overlap).',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-05: the dependency is already installed at a version the effective
    // constraint rejects. The SAME `version conflict` token as the declaration
    // contradiction above, distinguished by the `already installed` token beside
    // it and by the recorded version on the row.
    "dependency-installed-version-conflict": {
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
                name: "formatter@tools",
                version: "1.0.0",
                reasons: ["already installed", "version conflict"],
                cause: new Error(
                  'Dependency "formatter@tools" is installed at version 1.0.0, which does not satisfy "^2.0.0".',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-03: the declarations pass one of the two combination size caps. The
    // cause carries the measurement that tripped, so the operator can see which
    // cap and by how much.
    "dependency-constraint-too-complex": {
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
                name: "formatter@tools",
                reasons: ["constraint too complex"],
                cause: new Error(
                  'Dependency "formatter@tools" declares version constraints too complex to combine (total input 5400 characters exceeds the 4096 character cap).',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-03: a declared constraint is not a version range the evaluator can
    // read. The rendered range is bounded by the same helper every other
    // constraint row uses, so a very long declaration cannot flood the block.
    "dependency-invalid-version-constraint": {
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
                name: "formatter@tools",
                reasons: ["invalid version constraint"],
                cause: new Error(
                  'Dependency "formatter@tools" declares an unparseable version constraint "nope" (input 1 of 1 is not a valid version range).',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-03: the tag listing itself could not be read. The transport
    // classification is already a member of the inherited vocabulary, so the row
    // carries `{authentication required}` (or `{network unreachable}`) rather
    // than a cascade-private token -- truthful attribution keeps "could not be
    // read" apart from "held nothing usable".
    "dependency-tag-listing-failed": {
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
                name: "formatter@tools",
                reasons: ["authentication required"],
                cause: new Error(
                  'Dependency "formatter@tools" could not be checked against "^2.0.0" (authentication required).',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-02 / D-03-08: the dependency names a marketplace the target scope has
    // not added. Nothing adds or clones a marketplace to satisfy a dependency,
    // so a plugin cannot introduce a new source of code by declaring one. The
    // row names the marketplace through the dependency key that is its subject
    // and points at the command that would add it.
    "dependency-marketplace-not-added": {
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
                name: "formatter@tools",
                reasons: ["dependency marketplace not added"],
                cause: new Error(
                  'Dependency "formatter@tools" requires marketplace "tools", which is not added. Run marketplace add <source> to add it.',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-01: the dependency's marketplace IS added but declares no entry under
    // that name. The inherited `not in manifest` token already states exactly
    // this, so the cascade mints nothing for it.
    "dependency-not-in-manifest": {
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
                name: "formatter@tools",
                reasons: ["not in manifest"],
                cause: new Error(
                  'Dependency "formatter@tools" is not declared by its marketplace.',
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-04: the graph closes on itself. The subject is the key the walk met
    // twice, and the cause renders the whole chain in walk order with that key
    // shown where it recurs -- a cycle is a property of the path, so a row alone
    // cannot state it.
    "dependency-cycle": {
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
                name: "formatter@tools",
                reasons: ["dependency cycle"],
                cause: new Error(
                  "Dependency cycle: helper@official -> formatter@tools -> linter@tools -> formatter@tools.",
                ),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-01: the requesting plugin's OWN `dependencies` array is unusable, so
    // the subject is the requesting plugin and there is no second row to add.
    // The inherited `invalid manifest` token carries it: the declaration lives
    // in a manifest, and no dependency of it was ever reached.
    "dependency-unusable-declaration": {
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
                reasons: ["invalid manifest"],
                cause: new Error(
                  'Plugin "helper@official" declares an unusable dependency (dependencies.0: Invalid input).',
                ),
                severity: "error",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },

    // RESV-06 / D-03-07: the dependency resolved cleanly and its own
    // materialization then threw. The row carries no cascade reason at all --
    // the ledger's own error is the fact -- and the requesting plugin's row
    // still says why it is there.
    "dependency-install-failed": {
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
                name: "formatter@tools",
                reasons: [],
                cause: new Error("failed to stage skill a-fmt: EACCES"),
                severity: "error",
                needsReload: false,
              },
              {
                status: "failed",
                name: "helper",
                reasons: ["dependency failed"],
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
