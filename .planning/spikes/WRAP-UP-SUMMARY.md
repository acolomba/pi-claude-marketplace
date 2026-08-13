# Spike Wrap-Up Summary

**Date:** 2026-08-13
**Spikes processed:** 3
**Feature areas:** Backward-compat removal (state.json + claude-plugins.json)
**Skill output:** `./.claude/skills/spike-findings-pi-claude-marketplace/`

## Processed Spikes

| # | Name | Type | Verdict | Feature Area |
|---|------|------|---------|--------------|
| 001 | installed-record-backcompat-audit | standard | ✓ VALIDATED | Backward-compat removal |
| 002 | config-file-backcompat-audit | standard | ⚠ PARTIAL | Backward-compat removal |
| 003 | force-reinstall-on-version-mismatch | standard | ⚠ PARTIAL | Backward-compat removal |

## Key Findings

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
