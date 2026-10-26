# Phase 7: Plugin Update by Marketplace, Constraint, and Partial - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Phase 7 adds cucumber scenarios to `features/plugin/update.feature` for three
`/claude:plugin update` behaviors: updating every outdated plugin of one
marketplace (`update @<marketplace>`, UPD-01), a dependent's version constraint
that blocks a dependency's update (UPD-03), and a new version that became
partially available, with and without `--partial` (UPD-05). The phase owns
`features/plugin/update.feature` and, only if needed,
`features/step_definitions/plugin/update.steps.ts`. It edits no Phase 1 file
and no file another phase owns.

</domain>

<decisions>
## Implementation Decisions

### Scope and files
- **D-01:** Every scenario uses steps Phase 1 already provides. Probe runs
  showed that the shared steps cover all three behaviors, so the phase adds no
  `update.steps.ts` module.
- **D-02:** The new scenarios go into the existing `features/plugin/update.feature`
  and reuse its Background (`fixtures` published as a dir source, `demo` 1.0.0
  installed in the project scope). Each scenario lists every plugin its result,
  record, or session holds, so the Background's `demo` appears in those tables.

### UPD-01: update @<marketplace>
- **D-03:** One scenario installs `demo` and `pp` from `fixtures` and `app` from a
  second marketplace `tools`, offers a newer version of all three, and runs
  `/claude:plugin update @fixtures --scope project`. The result must list `demo`
  and `pp` as `updated` with their `from` and `to` versions and a tally of 2,
  and the installation record must show `app@tools` still at 1.0.0. The
  installation record is the proof that the other marketplace's outdated
  plugin kept its version; a result that lists only the fixtures rows cannot
  show this on its own.

### UPD-03: blocking version constraint
- **D-04:** The blocking case is the one the product's constraint gate
  implements (UPDT-01/UPDT-02, D-10-12): `app` 1.0.0 declares `lib@^1.0.0`, the
  marketplace then offers `lib` 2.0.0, and `update lib@tools` holds the update.
  The probe showed a `skipped` row with the reason `dependents constrain`, the
  cause chain `version 2.0.0 falls outside what the combined range admits
  (>=1.0.0 <2.0.0-0) -- required by "app@tools"`, and a `warning` result with
  the summary "A plugin operation needs attention." The scenario asserts this
  whole result, the unchanged installation record, and the unchanged skills of
  a new session.
- **D-05:** The opposite direction is out of scope and is not a bug: when a
  plugin's new version declares a range that the installed dependency does not
  meet (`app` 1.1.0 needs `lib@^2.0.0`, only `lib` 1.0.0 exists), the update
  goes through. The product leaves that constraint to the load-time check
  (LOAD-01, `dependency version unsatisfied`), which mirrors Claude Code's
  `dependency-version-unsatisfied` load error, in the same way as the TAGS-02
  install precedent (`dependency current copy`). No scenario covers it here.

### UPD-05: partially available new version
- **D-06:** The new version is made partially available with the Phase 1 step
  `the published plugin "demo" of the marketplace "fixtures" has an output
  style`, after the step that offers `demo` 1.1.0.
- **D-07:** Without `--partial`, the update leaves `demo` at 1.0.0. The probe
  showed a `partially-upgradable` row with the reason `unsupported component`,
  the hint `partial-update`, and the installed version 1.0.0. The scenario
  asserts the whole result and the installation record (`demo@fixtures` 1.0.0).
- **D-08:** With `--partial`, the update moves `demo` to 1.1.0. The probe showed
  a `partially-installed` row at version 1.1.0 with the reason `unsupported
  component`. One scenario asserts that result and the record.
- **D-09:** "Info names what was left out" is checked with
  `/claude:plugin info demo@fixtures` after the partial update. Its result is a
  single `plugin-info` result: status `partially-installed`, version 1.1.0, the
  reason `unsupported component`, and the components it did install (the
  `demo-skill` skill). The reason vocabulary names the class of the missing
  component (`unsupported component`, against `unsupported hooks` or
  `unsupported mcp`), and the JSON result carries no list of component kinds.
  So the reason is the name of what was left out. Deeper `info` coverage
  belongs to Phase 10.
- **D-10:** The update that "fails" without `--partial` reports a `warning`
  result ("A plugin operation needs attention."), not an `error`. This is the
  recorded SEV-04/XSURF-03 split: a targeted update decline is a warning, and a
  bulk one is info. A `partially-available` install without `--partial` is an
  error instead. Claude Code has no partial install, so no upstream rule
  overrides this. The scenario asserts the warning, and this is not a bug.

### Claude's Discretion
- Scenario titles, the order of scenarios in the file, and whether a check
  of the new session's skills is added beside an installation record check,
  within the cucumber rules (one behavior for each scenario, whole-result
  tables).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 7" (goal and success criteria) and its "File ownership" table
- `.planning/REQUIREMENTS.md` UPD-01, UPD-03, UPD-05
- `.agents/skills/cucumber/SKILL.md` and `rules/{features,steps,layout}.md`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` (constraint hold)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` (skip severity and the `partially-upgradable` projection)
- `extensions/pi-claude-marketplace/shared/notification-types.ts` (reason vocabulary, LOAD-01 and TAGS-02 notes)

</canonical_refs>

<code_context>
## Existing Code Insights

- Steps used: `the marketplace {string} offers these plugins:`, `... offers these
  plugins with dependencies:` (the dependencies column takes `lib@^1.0.0`),
  `the published plugin {string} of the marketplace {string} has an output
  style`, `the result has these fields:`, `the result lists these plugins:`,
  `the installation record of the {word} scope holds these plugins:`, `the
  session offers these skills:`.
- `the result lists these plugins:` accepts cascade results only. A
  `plugin-info` result is compared whole with `the result has these fields:`.

</code_context>

<specifics>
## Specific Ideas

None beyond the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- A scenario for a new version that needs a newer dependency than the one
  installed (D-05) belongs with the load-time checks (Phase 11 reconcile), not
  with update.

</deferred>

---

*Phase: 07-plugin-update-by-marketplace-constraint-and-partial*
*Context gathered: 2026-10-23*
