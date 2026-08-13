# Spike Wrap-Up Summary

## Session: 2026-08-13 (backward-compat removal)

**Date:** 2026-08-13
**Spikes processed:** 3
**Feature areas:** Backward-compat removal (state.json + claude-plugins.json)
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | installed-record-backcompat-audit | standard | ✓ VALIDATED | Backward-compat removal |
| 002 | config-file-backcompat-audit | standard | ⚠ PARTIAL | Backward-compat removal |
| 003 | force-reinstall-on-version-mismatch | standard | ⚠ PARTIAL | Backward-compat removal |

### Key Findings

- `persistence/migrate.ts` (283 prod / 529 test LOC) is pure legacy-shape
  catchup with zero overlap with the live install/add write paths --
  clean deletion candidate.
- `persistence/migrate-config.ts` (197 prod / 570 test LOC) looks
  structurally similar but is NOT: it's the only thing preventing "config
  file absent" from being read as "uninstall everything" by
  `reconcile/plan.ts`. Deleting it requires a replacement guard, not a
  bare removal.
- The core "force reinstall on version mismatch" idea works, and more
  cheaply than expected: `STATE_VALIDATOR.Check()` on raw un-migrated JSON
  is already a complete staleness detector (proven against the real,
  unmodified validator in `prototype.ts`), so no new version-stamp field
  is needed. It covers plugin- and marketplace-level record staleness in
  one call.
- One gap: the D-13 `autoupdate` scrub (a stray-field cleanup, not a
  missing-field problem) is invisible to a `Check()`-based gate by
  construction (TypeBox tolerates extra properties). Recommendation:
  leave it, it's provably inert.
- `bridges/agents/marker.ts`'s legacy marker constant is a safety
  predicate, not a migration -- out of scope for this removal.
- Net estimated impact: ~480 prod LOC and ~1100 test LOC deleted, ~10-20
  LOC of new guard code added.

## Session: 2026-08-13 (Claude plugin dependency support)

**Date:** 2026-08-13
**Spikes processed:** 2
**Feature areas:** Claude plugin dependency support
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

### Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 004 | claude-plugin-dependency-spec | standard | ✓ VALIDATED | Claude plugin dependency support |
| 005 | pi-cm-dependency-behavior | standard | ⚠ PARTIAL | Claude plugin dependency support |

### Key Findings

- Upstream Claude Code plugins fully support declaring dependencies on
  other plugins via a `dependencies` array in `plugin.json` (bare string
  or `{name, version, marketplace}` object with semver ranges). It is not
  informational: `/plugin install` auto-resolves and auto-installs the
  whole tree, with git-tag-based version resolution, constraint
  intersection across installers, cross-marketplace guards, transitive
  enable/disable cascades, and orphan pruning (`claude plugin prune`).
- A research trap along the way: an open GitHub feature-request issue
  (#9444, filed 2025-10-12) reads as "not supported" if found in
  isolation, but predates the shipped feature -- confirmed against a
  separate, closed docs-bug issue (#48864) and the official reference
  docs directly.
- pi-claude-marketplace's own handling matches its documented scope
  (opaque field, no auto-resolution, static "must be installed manually"
  note) -- but the note itself barely reaches the user in practice: it's
  dropped from `install` (D-19-01), never read by `list` for an
  installable plugin, and `info`'s `normalizeDependencies` silently drops
  the version-pinned object form of a dependency declaration. Confirmed
  live against the real resolver and `info` orchestrator, not by static
  reading alone.
- Net effect: a plugin declaring a version-pinned dependency -- the shape
  upstream documents as the primary use case -- is currently invisible to
  a pi-claude-marketplace user through every command surface. No crashes
  or correctness defects; purely a lost-information gap, fixable with a
  narrow change to `info.ts`.
