# Phase 6: Uninstall Data and Prune Flags - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** Autonomous (recommended defaults taken, no user questions)

<domain>
## Phase Boundary

Cucumber coverage in `features/plugin/uninstall.feature` for what `uninstall`
does with a plugin's data directory (UNI-01) and with its dependencies under
`--prune` (UNI-02). Only this feature file and, if needed,
`features/step_definitions/plugin/uninstall.steps.ts` change. No Phase 1 file
and no other phase's file changes.
</domain>

<decisions>
## Implementation Decisions

- **D-01:** The `--keep-data` behavior is already covered by the Phase 1 seed
  scenario "Uninstalling with --keep-data keeps the plugin's data directory and
  the file in it" (row reason `data kept`, file content compared). Phase 6 keeps
  it unchanged and adds the default-removal scenario beside it.
- **D-02:** The default-removal scenario plants a file in the data directory
  first (the Phase 1 `holds the file ... with the text ...` step), so the
  directory is non-empty and a removal that only deletes an empty directory
  fails the scenario.
- **D-03:** No Phase 1 step states that a data directory is absent. Phase 6
  adds one phase-local step in `plugin/uninstall.steps.ts` whose text names the
  verb (D-08 of the milestone): `the uninstall has removed the data directory
  of <id> from the <scope> scope`. It first asserts that the marketplace's data
  directory still exists, so a wrong path cannot pass the absence check
  vacuously.
- **D-04:** `--prune` is covered by two scenarios over a `tools` marketplace
  with dependency tables: (a) `app -> lib`, uninstalling `app --prune` reports
  both rows (`lib` with reason `dependency pruned`), leaves no installed plugin
  and no declaration, and a new session offers no skills; (b) `app -> lib` and
  `other -> lib`, uninstalling `app --prune` reports only `app`, the
  installation record keeps `lib` and `other`, and a new session offers their
  skills.
- **D-05:** Upstream parity: Claude Code's `plugin uninstall --prune` removes
  auto-installed dependencies that no remaining installed plugin requires and
  keeps the rest; the extension's behavior matches, so no product change is
  expected. A mismatch found while running the scenarios is fixed in this phase.
- **D-06:** Each scenario compares whole results (fields and every row), per the
  cucumber skill, and states the session's skills after a state change.

### Claude's Discretion

Scenario titles and step wording, within the cucumber skill's rules.
</decisions>

<canonical_refs>
## Canonical References

- `.agents/skills/cucumber/SKILL.md` and `rules/*.md` -- feature and step rules
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` -- PU-2 data-dir removal, D-05-01..13 prune
- `features/step_definitions/plugin/installation.steps.ts` -- data-directory and record steps (Phase 1)
</canonical_refs>

<deferred>
## Deferred Ideas

None.
</deferred>
