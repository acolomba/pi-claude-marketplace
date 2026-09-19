# Phase 8: Final Verification and Reconciliation — Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

Recorded from the authorized test-backlog scope and a live inspection of the
checkout. This is an autonomous planning record: routine decisions are
authorized by PROJECT.md, and no substantive product choice exists in this phase.

<domain>
## Phase Boundary

Run every required gate fresh at the phase HEAD, prove aggregate unit production
coverage is exactly 100%, and account for all eleven authorized items with
implementation evidence or a current disposition. Write the records that close
the milestone's bookkeeping. No product behavior changes; no new gates.

</domain>

<decisions>
## Implementation Decisions

### Gate execution (FINAL-01)
- The complete gate is `npm run check` (typecheck, lint, workflow lints, fallow,
  format, corresponding-test controls, direct-coverage negative, verified unit
  coverage, coverage negatives, coverage risk and its negative, integration,
  type-member gate and its negative), plus `npm run test:e2e` (pinned ref),
  `npm run test:coverage:direct:all`, and `pre-commit run --all-files`. All run
  fresh at the phase HEAD; Phase 7 numbers are evidence, not a substitute.
- The branch was never pushed (292 ahead of `origin/main`, 0 behind), so local
  runs are the evidence. Record each command, its exit status and its counts in
  a phase measurement document.
- The 100% claim comes from the validated same-run aggregate unit capture
  (`coverage/unit.lcov`) in all three dimensions. The direct-pair pin and the
  integration/e2e reports remain separate measurements and are reported as such.
- A failing gate is classified before it is acted on: a regression is fixed
  through reachable public behavior; an environment failure is recorded as a debt
  with its cause. Known candidate: two integration tests resolve `pi-subagents`
  from `npm root -g` (global 0.47.1; the `excludeTools` floor is 0.62.0). No
  threshold, exclusion, suppression or pin may be loosened to turn a gate green.
- e2e needs network (a depth-1 fetch of the pinned upstream marketplace SHA). If
  the sandbox blocks it, record the launch error verbatim as an environment
  debt; do not treat a launch error as a passing or skipped gate.

### Item reconciliation (FINAL-02)
- The authorized items are NEGCTL-01, E2EIMP-01, TESTQ-01, FLOW-07, COV-01
  (Phase 1); SWTEST-01 (Phase 2); AGCOL-01 (Phase 3); ARGS-01 (Phase 4);
  FLOW-09 (Phase 5); the pending todo
  `2026-09-02-detect-unused-code-and-type-members.md` (Phase 6); FLOW-05
  (Phase 7). Each disposition cites its phase VERIFICATION.md status and score
  and the fresh gate result; nothing is re-implemented.
- Records to write: close `FLOW-05` in BACKLOG.md (the only heading still open;
  the CRAP 30 policy lives in `scripts/coverage-risk-policy.json`, whole-tree
  `maxCrap: 0` is unchanged by design); mark the `SWTEST-01` heading closed to
  match its body; move the pending todo to `todos/completed/`; flip the STATE.md
  deferred-items row "Tooling — Detect unused code and unused type members" from
  Pending to closed; check FINAL-01/FINAL-02 in REQUIREMENTS.md and set their
  traceability rows to Complete.
- Preserve `.planning/milestones/`, `inputs/test-backlog/`, every phase
  directory and every completed summary. Reconciliation edits are additive
  closure notes, never rewrites of history.
- Preserve the uncommitted local configuration edits (`.claude/settings.json`,
  `.codex/config.toml`, `.planning/state.json`, `.mcp.json`); never stage them.

### Release artifacts
- No version bump and no CHANGELOG entry in this phase. The previous two test
  milestones shipped with no npm release, and the changelog now lists one entry
  per pull request ending in its number, which only `/gsd-ship` can supply.

### Claude's Discretion
- Shape and name of the phase measurement document, the order of the gate runs,
  and how the closure notes are worded, subject to the comment and prose
  policies already in force (no phase/plan/wave references in source comments).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `npm run check` is the mandatory 16-step chain CI runs; Phase 6 measured it at
  14m21s and pre-commit splits the type-member gates across two hooks.
- `scripts/coverage-unit.mjs` publishes the validated bundle; `coverage:unit:current`
  reuses it without a second unit launch; `coverage:risk` reads it.
- `scripts/test-coverage-direct.mjs --all --report` is the direct all-pairs sweep
  Phase 5 used at its close.
- Phase 7's `07-MEASUREMENT.md` is the template for a measured closing record.

### Established Patterns
- Every prior phase closed with a VERIFICATION.md that re-ran its gates live and
  cited exact counts; the stale verdicts on Phases 1-7 are the known
  `covered_files` timestamp artifact, not outcome failures.
- Backlog closures keep the original filing as historical evidence under a
  closure paragraph (see FLOW-09, AGCOL-01, ARGS-01).

### Integration Points
- BACKLOG.md, `todos/pending/`, STATE.md deferred table, REQUIREMENTS.md,
  ROADMAP.md progress table.
- `tests/integration/provenance-invisibility.test.ts` and
  `skill-path-resolution.test.ts` are the two global-peer resolvers.

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the authorized constraints: preserve 100%
aggregate unit coverage, assertion strength, the direct-pair pin, every quality
check, this branch, archived milestones and unrelated local edits.

</specifics>

<deferred>
## Deferred Ideas

- Raising the global `pi-subagents` peer to the 0.62.0 `excludeTools` floor on
  this machine is an environment task, not phase work.
- Pushing the branch and opening the PR belongs to `/gsd-ship` after the
  milestone completes.

</deferred>
