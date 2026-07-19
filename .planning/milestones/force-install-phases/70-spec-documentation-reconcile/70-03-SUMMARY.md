---
phase: 70-spec-documentation-reconcile
plan: 03
subsystem: notify-render + docs
tags: [docs, comments, force-install, severity, DOC-02, DOC-03, D-70-01, D-70-03]
requires: ["70-01"]
provides:
  - "Frozen --force hint trailer byte form, locked in both contract docs"
  - "DOC-03 stale-comment sweep clear across notify.ts / autoupdate.ts / plugin/update.ts"
affects:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
tech-stack:
  added: []
  patterns: ["comment-only edits (no behavior change)", "byte-form contract locked in docs"]
key-files:
  created:
    - .planning/phases/70-spec-documentation-reconcile/70-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
decisions:
  - "D-70-01: --force hint byte form frozen, placeholder framing dropped, locked in docs"
  - "D-70-03: WR-01 outcomeToCascadePluginMessage comment already clean; located in marketplace/update.ts (not autoupdate.ts), no edit needed"
metrics:
  duration: "~12 min"
  completed: "2026-06-28"
  tasks: 2
  files: 4
---

# Phase 70 Plan 03: Freeze --force Hint + DOC-03 Sweep Summary

Froze the `--force` hint trailer byte form as the locked DOC contract (D-70-01)
and cleared the DOC-03 stale "autoupdate is warning" comment sweep, with no
behavior change and the catalog-UAT byte gate staying green.

## What Was Built

**Task 1 (D-70-01) -- commit `02b08363`:** Dropped the "placeholder" framing
around `FORCE_INSTALL_HINT_TRAILER` in `notify.ts` (both the definition comment
~2160 and the render-site comment ~3348) and replaced it with the frozen-DOC-
contract framing citing D-70-01 and pointing at the two contract docs. The
constant's string value (`Re-run with --force to install the supported
components.`) is byte-identical -- untouched. Locked the byte form into the
docs: `docs/output-catalog.md` `failure-unsupported-features` prose now says the
wording is FROZEN as the DOC contract (D-70-01), replacing the "reconciled in
the DOC pass (DOC-01..03)" clause; `docs/messaging-style-guide.md` now records
the exact trailer string in the SEV-02/D-70-02 caller-stamped-severity carve-out
(section 10), citing D-70-01.

**Task 2 (DOC-03 / D-70-03) -- commit `9d82fc1a`:** Rephrased the
`cascadeSkipSeverity` skip-case comment in `plugin/update.ts` (~1688) so the
(semantically correct) `benign/idempotent -> info` and `actionable -> warning`
clauses no longer sit within the DOC-03 sweep window on a single line. Meaning
unchanged; SEV-04 / D-69-02 anchors preserved; no non-comment line touched.

## Verification

- `npm run check` exits **0** (green) on the FIRST run -- no serialization
  needed; the known parallel-test tmpdir ENOTEMPTY flake did NOT fire.
- Catalog-UAT gate: **GREEN** (all 4 assertions pass; rendered `--force` trailer
  byte unchanged).
- Closed-set counts confirmed **unchanged**: STATUS_TOKENS **22**,
  PLUGIN_STATUSES **17**, MARKETPLACE_STATUSES **7** (SNM-02 locks).
- DOC-03 sweep grep
  (`idempotent.{0,40}warning|benign.{0,40}warning|no-op.{0,40}warning`) over
  notify.ts / autoupdate.ts / plugin/update.ts returns **no match**.
- Frozen byte string verified byte-identical; placeholder framing fully removed
  (`grep placeholder | grep force|trailer|hint` -> no match).
- `outcomeToCascadePluginMessage` WR-01 / SEV-03 auditable comment present.

## Deviations from Plan

### Plan mis-attribution: `outcomeToCascadePluginMessage` location (no action needed)

- **Found during:** Task 2.
- **Issue:** The plan (Task 2 read_first and the D-70-03 action) places the
  auditable `outcomeToCascadePluginMessage` comment in
  `orchestrators/marketplace/autoupdate.ts` and asks to scrub it of any stale
  benign/idempotent-is-warning wording. In fact the function and its WR-01 /
  SEV-03 auditable comment live in `orchestrators/marketplace/update.ts`
  (lines ~648-671). That comment is already CLEAN: it correctly states the
  missing-soft-dep-companion `warning` is deliberately NOT applied on the
  autoupdate cascade (WR-01 / SEV-03), that a NEW degradation is the actionable
  `warning`, and that a benign re-degrade / up-to-date no-op is `info`. There is
  no stale benign/idempotent-is-warning claim to scrub.
- **Resolution:** No edit made. The acceptance criterion ("the
  `outcomeToCascadePluginMessage` comment still exists and references the WR-01 /
  SEV-03 autoupdate scoping") is satisfied as-is. `marketplace/update.ts` is not
  in the plan's `files_modified` and was correctly left untouched. The
  autoupdate.ts ~563 benign-idempotent-skip note (`-> info, no reload`) was also
  already correct and required no change.
- **Scope note:** `marketplace/update.ts:715` carries the same single-line
  `benign idempotent skip -> info, actionable skip -> warning` phrasing as the
  fixed plugin/update.ts line, but it is OUTSIDE the plan's DOC-03 acceptance-
  grep scope (which lists only autoupdate.ts, plugin/update.ts, notify.ts) and
  outside `files_modified`. Left untouched per the scope boundary; the
  acceptance grep stays green.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/notify.ts (edited)
- FOUND: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts (edited)
- FOUND: docs/output-catalog.md (edited)
- FOUND: docs/messaging-style-guide.md (edited)
- FOUND commit: 02b08363 (Task 1, D-70-01)
- FOUND commit: 9d82fc1a (Task 2, DOC-03)
