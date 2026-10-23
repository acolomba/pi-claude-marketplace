# Phase 8: Plugin Reinstall - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous; the orchestrating session asked for a non-interactive run, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 8 adds cucumber scenarios for single-plugin `reinstall` to
`features/plugin/reinstall.feature`: reinstalling an installed plugin at the
same version (REI-01), restoring deleted skill files (REI-02), and the
not-installed failure (REI-03). Phase 1 already seeded the file with the
`--local`, dependency, invalid-manifest, and deleted-skills scenarios. This
phase extends the file and edits no Phase 1 file or other phase's file.

</domain>

<decisions>
## Implementation Decisions

- **D-01:** Every step the new scenarios need already exists (command,
  session, config, and `plugin/installation.steps.ts` topic steps), so the
  phase adds no `plugin/reinstall.steps.ts`. The new scenarios reuse the
  file's Background (`demo@fixtures` 1.0.0 installed in the project scope).
- **D-02:** REI-01 is two scenarios, following the install and update
  precedent (`The plugin list shows the installed plugin` /
  `... updated version`): one runs the reinstall and compares the whole
  cascade result (`reinstalled`, version `1.0.0`, scope `project`, severity
  `info`, needs reload `true`, tally) and the installation record
  (`demo@fixtures | 1.0.0 | true`); the other has the reinstall as a `Given`
  and runs `list --scope project`, comparing the whole list result.
- **D-03:** REI-02 keeps the Phase 1 seed (`Reinstalling a plugin whose
  installed skills were deleted restores them`) as the restore proof and adds
  one scenario that proves the precondition from the user's side: after the
  skill files are deleted, a new session offers no skills. Two scenarios keep
  one behavior each instead of a four-step When/Then chain.
- **D-04:** REI-03 reinstalls `pp@fixtures`, which the marketplace offers but
  the project scope has not installed. Measured output: cascade severity
  `error`, summary `A plugin operation has failed.`, needs reload `false`, and
  the row `pp | skipped | not installed | project`. The `skipped` status with
  error severity is the recorded reinstall design (reinstall messaging D-01:
  an absent-target reinstall flips severity to error and keeps the
  `(skipped) {not installed}` row grammar), not a product bug. "Changes
  nothing" is proven by comparing the installation record and the base
  config, which still hold only `demo@fixtures`, and the absent local config.
- **D-05:** The user-scope variant (`--scope user` while the marketplace lives
  only in the project scope, reason `not installed, marketplace in project
  scope`) is a different behavior from REI-03 and is not added here.
- **D-06:** Finding deferred, not fixed: when a path-source plugin's
  marketplace now offers a newer version, `reinstall` reports and records the
  old version (`1.0.0`) but stages the new content (the next session shows
  `A skill of demo 1.1.0.`). The code documents this on purpose: a path
  source re-resolves through the marketplace's current checkout, and
  reinstall preserves the recorded version (D-68-02). Changing it means
  changing that recorded decision (refuse the reinstall, or adopt the new
  version), which is the user's call, so the phase reports it to the
  orchestrator instead of fixing it. REI-01 is scoped to an unchanged source.

### Claude's Discretion
- Scenario titles and placement within the feature file.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 8" -- goal and success criteria
- `.planning/REQUIREMENTS.md` -- REI-01..REI-03
- `.agents/skills/cucumber/rules/{layout,features,steps}.md` -- suite rules
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts`,
  `reinstall.messaging.ts` -- reinstall behavior and row grammar

</canonical_refs>

<deferred>
## Deferred Ideas

- Reinstall of a path-source plugin whose source advanced past the recorded
  version (D-06).
- Reinstall in a scope whose marketplace lives only in the other scope (D-05).

</deferred>
