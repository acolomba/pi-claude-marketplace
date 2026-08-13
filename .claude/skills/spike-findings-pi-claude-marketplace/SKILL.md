---
name: spike-findings-pi-claude-marketplace
description: Implementation blueprint from spike experiments on pi-claude-marketplace -- backward-compat migration removal and Claude plugin dependency-declaration handling. Requirements, proven patterns, and verified knowledge for both. Auto-loaded during implementation work on either.
---

<context>
## Project: pi-claude-marketplace

**Backward-compat removal:** investigated whether pi-claude-marketplace's
field-level backward-compat migration code (for `state.json` installed
records and for the `claude-plugins.json` desired-state config file) can
be replaced by detecting a stale record shape and forcing a full resync,
now that the project has a desired-state config file to rebuild from and
few enough users that a forced resync on upgrade is an acceptable cost.

**Claude plugin dependency support:** investigated whether Claude Code
plugins support declaring a dependency on another plugin, whether that
dependency is actually resolved anywhere -- upstream in Claude Code
itself, or in this repo's own `plugin.json`/`marketplace.json` handling --
or is purely informational.

Spike sessions wrapped: 2026-08-13
</context>

<requirements>
## Requirements

### Backward-compat removal

- Any replacement for `migrate-config.ts` MUST NOT let "config file
  absent" collapse to "empty desired state" for a scope with a populated
  `state.json` -- that reads as "uninstall everything" to
  `reconcile/plan.ts`'s `buildUninstallBucket`.
- Staleness detection for `state.json` reuses `STATE_VALIDATOR.Check()` on
  the raw un-migrated JSON rather than a new per-record version stamp --
  it already fails on every REQUIRED-field addition and covers plugin-
  and marketplace-level records in one check.
- The combination "stale `state.json` AND absent `claude-plugins.json`"
  MUST fail loud (notify + explicit recovery step), never silently wipe
  or silently auto-migrate.
- Do not actively scrub the D-13 `autoupdate` legacy field -- it's
  provably inert and structurally invisible to a `Check()`-based gate
  anyway. Leave it in place.

### Claude plugin dependency support

- Upstream Claude Code's `dependencies` field is a real, fully-resolved
  feature (auto-install, semver, cross-marketplace guards, enable/disable
  cascade, `prune`) -- treat it as such, never as purely informational.
- pi-claude-marketplace's opaque, no-auto-resolution handling of
  `dependencies` is an intentional, still-valid scope decision -- do not
  build upstream's resolution engine here.
- The "manual-install warning" this project relies on to compensate for
  no auto-resolution MUST actually reach the user for every valid
  dependency shape, including the version-pinned object form -- it
  currently does not (see references/plugin-dependencies.md).
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Backward-compat removal | references/backward-compat-removal.md | `STATE_VALIDATOR.Check()` on raw JSON is a complete, zero-new-code staleness detector; deletes `migrate.ts` outright, but `migrate-config.ts` needs a loud-failure guard, not a bare deletion |
| Claude plugin dependency support | references/plugin-dependencies.md | Upstream fully auto-installs declared dependencies (semver, prune, cascades); this repo stays opaque by design, but `info.ts`'s `normalizeDependencies` silently drops the version-pinned object form of a dependency, making it invisible on every command surface |

## Source Files

Original spike source files are preserved in `sources/` for complete
reference -- including `sources/003-force-reinstall-on-version-mismatch/prototype.ts`,
a runnable proof against the real production `STATE_VALIDATOR`, and
`sources/005-pi-cm-dependency-behavior/prototype.ts`, a runnable proof
against the real production `resolveStrict` and `getPluginInfo`.
</findings_index>

<metadata>
## Processed Spikes

- 001-installed-record-backcompat-audit
- 002-config-file-backcompat-audit
- 003-force-reinstall-on-version-mismatch
- 004-claude-plugin-dependency-spec
- 005-pi-cm-dependency-behavior
</metadata>
