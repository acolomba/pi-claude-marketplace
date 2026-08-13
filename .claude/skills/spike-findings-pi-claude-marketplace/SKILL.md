---
name: spike-findings-pi-claude-marketplace
description: Implementation blueprint from spike experiments. Requirements, proven patterns, and verified knowledge for building pi-claude-marketplace. Auto-loaded during implementation work.
---

<context>
## Project: pi-claude-marketplace

Investigated whether pi-claude-marketplace's field-level backward-compat
migration code (for `state.json` installed records and for the
`claude-plugins.json` desired-state config file) can be replaced by
detecting a stale record shape and forcing a full resync, now that the
project has a desired-state config file to rebuild from and few enough
users that a forced resync on upgrade is an acceptable cost.

Spike session wrapped: 2026-08-13
</context>

<requirements>
## Requirements

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
</requirements>

<findings_index>
## Feature Areas

| Area | Reference | Key Finding |
|------|-----------|-------------|
| Backward-compat removal | references/backward-compat-removal.md | `STATE_VALIDATOR.Check()` on raw JSON is a complete, zero-new-code staleness detector; deletes `migrate.ts` outright, but `migrate-config.ts` needs a loud-failure guard, not a bare deletion |

## Source Files

Original spike source files are preserved in `sources/` for complete
reference -- including `sources/003-force-reinstall-on-version-mismatch/prototype.ts`,
a runnable proof against the real production `STATE_VALIDATOR`.
</findings_index>

<metadata>
## Processed Spikes

- 001-installed-record-backcompat-audit
- 002-config-file-backcompat-audit
- 003-force-reinstall-on-version-mismatch
</metadata>
