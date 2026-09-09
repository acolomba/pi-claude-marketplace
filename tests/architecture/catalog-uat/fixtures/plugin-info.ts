import { piWithBothLoaded } from "../mock-pi.ts";

import type { FixtureMap } from "../fixture-types.ts";

/** Catalog fixtures for the plugin info command surface. */
export const PLUGIN_INFO_FIXTURES: FixtureMap = {
  "/claude:plugin info <plugin>@<marketplace>": {
    "installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
        },
      },
    },

    "installed-single-scope-with-dependencies": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
          dependencies: ["helper@utils-mp"],
        },
      },
    },

    "state-only-installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      },
    },

    "state-only-partially-installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "partially-installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest", "lsp"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      },
    },

    "state-only-installed-with-hooks": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            hooks: [{ event: "Stop" }, { event: "PreToolUse", matcher: "Bash" }],
            skills: ["alpha-skill"],
          },
        },
      },
    },

    "state-only-installed-hooks-degraded": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest", "source missing"],
          componentsResolved: true,
          components: {
            skills: ["alpha-skill"],
          },
        },
      },
    },

    // ENBL-16 / ENBL-17: a recorded-but-disabled record the manifest no longer
    // declares. `status: "disabled"` on a `PluginInfoRow` is what the reroute
    // added: the row travels the shared block builder, so it carries the
    // component inventory the disable preserved (ENBL-18) and the hook entries
    // the record holds -- the materialized configuration is gone. `reasons`
    // carries the absence token ALONE: a persisted unsupported kind would be
    // suppressed on this row (ENBL-16 / D-100-07), so no fixture can show one.
    "state-only-disabled-with-components": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "disabled",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            hooks: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
            skills: ["alpha-skill"],
          },
        },
      },
    },

    // D-96-04: `--fetch` against a manifest-absent installation record. This is
    // a CASCADE row, not a `PluginInfoRow`: the standalone info status set
    // admits no `skipped`. The `severity: "warning"` on the row is what selects
    // the `needs attention` summary and the second `notify` argument.
    "state-only-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["not in manifest"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    // D-96-04: `--fetch` against an all-disabled marketplace. Same cascade row
    // shape as the state-only note above, with the reason token that names the
    // OTHER cause of a skipped fetch -- a disabled record has no materialized
    // artifacts to refresh (ENBL-02).
    "disabled-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["already disabled"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    // D-96-04 / MSG-GR-3: the two skip causes in ONE run. This is the byte
    // shape `info-manifest-absent.test.ts`'s mixed-run test pins by index --
    // plural summary, two marketplace headers, one reason token each, ordered
    // project-first by SCOPE rather than grouped by the arm that produced the
    // row. It composes the two states above; it is not a third cause.
    "mixed-fetch-skipped": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "mp",
            scope: "project",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "1.0.0",
                reasons: ["already disabled"],
                severity: "warning",
              },
            ],
          },
          {
            name: "mp",
            scope: "user",
            plugins: [
              {
                status: "skipped",
                name: "alpha",
                version: "2.0.0",
                reasons: ["not in manifest"],
                severity: "warning",
              },
            ],
          },
        ],
      },
    },

    "available-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "chat-helper",
          version: "0.5.0",
          description: "Quick chat helper plugin; experimental.",
          componentsResolved: true,
          components: {
            commands: ["chat"],
            skills: ["chat-init"],
          },
        },
      },
    },

    // OUT-03 / DFEN-04: the `available-single-scope` row above whose
    // marketplace ENTRY declares `defaultEnabled: false`. The info surface
    // states the fact through the reason brace the row already had, so the two
    // renders differ by that brace alone -- no extra body line, description and
    // component lines untouched. The claim is entry-derived, so nothing on disk
    // is read to answer it. Severity `info`; no reload-hint (read-only surface).
    "available-installs-disabled": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "chat-helper",
          version: "0.5.0",
          description: "Quick chat helper plugin; experimental.",
          componentsResolved: true,
          components: {
            commands: ["chat"],
            skills: ["chat-init"],
          },
          reasons: ["installs disabled"],
        },
      },
    },

    "unavailable-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "unavailable",
          name: "legacy-plugin",
          version: "0.1.0",
          description: "Old plugin that declares hooks; not installable in Pi.",
          reasons: ["unsupported hooks"],
          componentsResolved: false,
        },
      },
    },

    "installed-both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info-cascade",
        blocks: [
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "project",
            marketplaceDetails: { autoupdate: true },
            plugin: {
              status: "installed",
              name: "foo",
              version: "1.0.0",
              componentsResolved: true,
              components: { skills: ["s1"] },
            },
          },
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "user",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "foo",
              version: "2.0.0",
              componentsResolved: true,
              components: { agents: ["a1"] },
            },
          },
        ],
      },
    },

    // INFO-09: the same fan-out when NEITHER scope's manifest declares the
    // plugin. Both blocks are `(installed) {not in manifest}` rather than
    // `(failed)`, so they join one `info` cascade instead of being separated
    // into two `error` notifications by the GRAM-04 failure split.
    "state-only-installed-both-scopes-fan-out": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info-cascade",
        blocks: [
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "project",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "alpha",
              version: "1.0.0",
              reasons: ["not in manifest"],
              componentsResolved: true,
              components: { skills: ["alpha-skill"] },
            },
          },
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "user",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "installed",
              name: "alpha",
              version: "1.0.0",
              reasons: ["not in manifest"],
              componentsResolved: true,
              components: { skills: ["alpha-skill"] },
            },
          },
        ],
      },
    },

    "components-not-resolved": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "remote-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "remote-plugin",
          version: "1.0.0",
          description: "Remote plugin sourced from an external npm package.",
          componentsResolved: false,
        },
      },
    },

    // RSTA-01 / D-80-04: info-surface row for a not-installed git-source plugin
    // whose clone/mirror is not materialized. The status glyph is `◌`
    // (`pluginInfoStatusGlyph` remote arm) and the row reads `(remote)`. The
    // `componentsResolved: false` arm keeps the `components: not resolved`
    // marker (existing wording preserved) -- an unfetched source has no warm
    // tree to resolve. Severity `info`.
    "remote-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "remote",
          name: "git-helper",
          version: "0.5.0",
          description: "Git-source helper plugin; not yet fetched.",
          componentsResolved: false,
        },
      },
    },

    "missing-plugin-not-in-manifest": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "failed",
          name: "ghost-plugin",
          reasons: ["not in manifest"],
          // The renderer's standard-body path runs the components switch
          // unconditionally; use `componentsResolved: true` with empty
          // components so no `components: not resolved` marker appears
          // (the failed row is its own structural signal; INFO-05's
          // marker is reserved for installed/available external sources).
          componentsResolved: true,
          components: {},
        },
      },
    },

    "missing-marketplace-not-added-absent-from-both": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      // TYPE-01 variant. `name` carries the MARKETPLACE name (the user-facing
      // failure is "the marketplace is not added"). `scope` OMITTED -> no
      // bracket. Byte form unchanged (`⊘ ghost-mp (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
      },
    },

    "missing-marketplace-not-added-scope-mismatch": {
      pi: piWithBothLoaded(),
      expectedSeverity: "error",
      // TYPE-01 variant. `--scope user` requested explicitly -> renderer emits
      // the `[user]` bracket. Byte form unchanged
      // (`⊘ ghost-mp [user] (failed) {marketplace not added}`).
      message: {
        kind: "marketplace-not-added",
        name: "ghost-mp",
        scope: "user",
      },
    },
  },
};
