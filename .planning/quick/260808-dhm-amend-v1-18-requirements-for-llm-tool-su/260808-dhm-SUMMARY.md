---
quick_id: 260808-dhm
status: complete
date: 2026-08-08
tasks_completed: 3
files_modified: 3
---

# Quick Task 260808-dhm: Summary

Documentation-only amendment bringing the v1.18 requirement documents into
agreement with the Phase 95 discuss decision to widen the LLM tool surface's
reason projection (D-95-06 / D-95-07, applied per D-95-10).

## What changed

### `.planning/REQUIREMENTS.md`

- Added **INV-05** under § Installed Inventory: `pluginReasons` forwards reasons
  for `installed` and `partially-installed`, joining the existing
  `unavailable` / `partially-available` / `upgradable` set. The requirement text
  records the pre-existing loss it also closes (`projectRowStatus` flattens four
  statuses into `installed`, so a degraded install currently looks clean to the
  agent), the required-vs-optional `reasons` asymmetry between
  `PluginPartiallyInstalledMessage` and `PluginInstalledMessage`, and that
  COMPAT-01 continues to hold because no token, glyph, field, migration, or
  network path is added.
- Replaced the "Extending the LLM tool surface to carry the new reason" Out of
  Scope row with the narrower "An `info` tool on the LLM surface" exclusion. The
  original row conflated two things: widening the existing `list` tool's reason
  projection (now in scope as INV-05) and adding a new `info` tool (still out).
- Traceability: `| INV-05 | Phase 95 | Pending |`; counts 21 → 22 for both total
  and mapped, `Unmapped: 0` preserved.
- Prose reconciled — "Eight of the twenty-one" → "twenty-two", `INV-05` added to
  the net-new work list.
- Footer updated, prior entry preserved.

### `.planning/ROADMAP.md`

- Phase 95 milestone bullet and Phase Details `Requirements:` line both carry
  `INV-05`; the bullet's lead-in corrected from "two things" to "three things".
- New success criterion 5: the tool payload carries the reason on both
  `installed` and `partially-installed` rows, asserted on tool output rather
  than inferred from the row builder.
- Appended a correction to criterion 2. Its original wording claimed INV-01
  "requires lifting the render map's suppression of reasons on installed rows".
  No such suppression exists — `shared/notify.ts` already composes reasons on
  the `installed` arm and `PluginInstalledMessage.reasons?` already exists on
  the type. The omission is a single unset field in the `list.ts` row builder,
  so the scope is smaller than the original phrasing implied.
- Open-decisions block rewritten: decisions 1 and 3 marked resolved with their
  decision IDs, decision 2 re-gated to Phase 96 discuss, and the
  "resolve before Phase 95 planning" gate dropped from the heading. Recorded
  that `RLD-04` / `D-08` are defined in no surviving artifact and must not be
  carried forward as anchors.

### `.planning/STATE.md`

- Blockers section cleared — Phase 95 planning is unblocked.
- Quick Tasks Completed row added.

## Verification

| Check | Result |
| --- | --- |
| `INV-05` present in both requirement documents | ✓ |
| Traceability data rows | 22, matching the stated total |
| `Unmapped: 0` still holds | ✓ |
| No Out of Scope row excludes the reason-projection widening | ✓ |
| Phase 95 lists 6 requirements | ✓ |
| Phase 95 lists 5 success criteria | ✓ |
| Source files touched | 0 — documentation only, as scoped |

## Notes

Executed inline rather than via `gsd-planner` + `gsd-executor` subagents, per a
standing operator instruction not to dispatch the Agent tool unless requested.
The quick-task artifacts, commit structure, and STATE.md tracking are unchanged.

Worktree isolation auto-degraded to sequential (`worktree.base-check` reported
`shouldDegrade: true`, HEAD 13 commits ahead of `origin/HEAD`). Correct here — a
nested worktree would have forked from `origin/main` and lost the v1.18 branch.

INV-05 is implemented in Phase 95, not in this task. No `extensions/` or
`tests/` file was touched.
