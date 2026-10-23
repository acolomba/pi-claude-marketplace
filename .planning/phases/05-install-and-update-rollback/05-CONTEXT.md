# Phase 5: Install and Update Rollback - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was accepted without a prompt.

<domain>
## Phase Boundary

Behavioral coverage for an install and an update that fail partway (INS-07,
UPD-04): the failure result, what stays in the scope after it, and the retry
once the cause is gone. Files: `features/plugin/install-rollback.feature`
(seeded by Phase 1) and `features/plugin/update-rollback.feature`. Test
plugins carry skills only. A product bug a scenario exposes is fixed here.

</domain>

<decisions>
## Implementation Decisions

- **D-01:** Both commands use the Phase 1 obstruction: a directory in place of
  `<scopeRoot>/mcp-adapter.json`. The mcp phase reads that file after the
  skills phase has staged, so the failure is "partway", and it does not depend
  on file mode, so it holds for root. No new step module is needed; the shared
  steps cover every check.
- **D-02:** UPD-04 is covered by the pre-swap failure only. The update flow
  (`orchestrators/plugin/update-swap.ts`) prepares every bridge into tmp,
  then swaps. A prepare failure aborts the prepared handles and keeps the
  installed version: that is the contract UPD-04 states. A failure after the
  swap is, by design (update-swap D-03), not rolled back: it continues across
  bridges and reports `rollback partial` with a reinstall hint. That is a
  different contract from UPD-04, and the mcp-adapter.json obstruction cannot
  reach it, because the mcp prepare reads the same file. No post-swap scenario.
- **D-03:** An install that fails on EISDIR reports `failed` with empty
  reasons and the error in the cause chain. This is not a bug. The install
  failure composer (`install.messaging.ts`, Branch 4, D-15-01) gives an
  unclassified runtime throw no reason token and carries the error in the
  cause chain. Claude Code prints the raw error too: the 2.1.308 binary has
  `Failed to install plugin ${name}: ${error.message}` and no classification.
  The scenario states the empty reasons and the full cause chain.
- **D-04:** An update that fails on EISDIR reported `unreadable manifest`.
  That is a bug: the marketplace manifest was readable, and the token blames
  the wrong file. `narrowDirectFailReason` (`orchestrators/plugin/update-flow.ts`)
  fell through to its `unreadable manifest` fallback for every errno it did not
  name. Fix: map `EISDIR`, `EIO`, and `EBADF` to `unreadable`, the same mapping
  `orchestrators/marketplace/shared.ts` uses. The fallback for an unknown error
  stays (the lock-held update row that also reaches it belongs to Phase 15).
- **D-05:** INS-07 criterion 1 asks for "no skill in a new session". A new
  scenario starts a session after the failed install and states that it
  offers no skills; the existing failure scenario keeps its record and
  declaration checks.
- **D-06:** UPD-04 scenarios, one behavior each: the failure result with the
  record, declaration, and staged skill kept; `list` after the failure
  (`upgradable`, version 1.0.0, because 1.1.0 is offered); `info` after the
  failure (installed 1.0.0); a new session offers the 1.0.0 skill; the retry
  after the directory is removed updates 1.0.0 to 1.1.0. A Background holds
  the install, the 1.1.0 offer, and the obstruction.

### Claude's Discretion

Scenario titles and table layout follow `.agents/skills/cucumber/rules/features.md`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 5; `.planning/REQUIREMENTS.md` INS-07, UPD-04
- `.planning/phases/01-suite-foundation/01-07-SUMMARY.md` (obstruction, measured install row)
- `.planning/phases/01-suite-foundation/01-VERIFICATION.md` (UPD-04 obstruction note)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` (3-phase update)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` (`composeInstallFailureMessage`)
- `.agents/skills/cucumber/rules/features.md`

</canonical_refs>

<deferred>
## Deferred Ideas

- A post-swap update failure (`rollback partial` with a reinstall hint) has no
  obstruction that reaches it without failing prepare first; it is outside
  UPD-04.

</deferred>
