# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.8 -- Plugin and Marketplace Info Commands

**Shipped:** 2026-06-04
**Phases:** 3 (42, 43, 44) | **Plans:** 5
**Timeline:** 2026-06-03 → 2026-06-04 (~24 hours wall-clock; autonomous run)

### What Was Built

- Phase 42 (Type Model & Render Seam Foundations): `MarketplaceInfoMessage` + `PluginInfoMessage` discriminated-union variants + `wrapDescription` helper + `"not added"` REASON closed-set member -- single atomic-supersession commit per the v1.3 lesson.
- Phase 43 (Marketplace Info Command): `/claude:plugin marketplace info <name>` end-to-end (orchestrator + edge handler + TC-5 completion + new `MarketplaceInfoCascadeMessage` variant for per-scope fan-out + 6 catalog states).
- Phase 44 (Plugin Info Command): `/claude:plugin info <plugin>@<marketplace>` end-to-end (orchestrator + edge handler + new TC-6 `info` mode + `PluginInfoCascadeMessage` variant + 9 catalog states + `components: not resolved` marker for unsynced external sources).

Result: 8/8 INFO requirements satisfied, 1459/1459 tests GREEN, full catalog UAT coverage for both new info surfaces.

### What Worked

- **Architecture intel folded into the planner prompt** when the gsd-phase-researcher agent stalled twice on Phase 43. Investigating code areas inline myself (TC-5/TC-6 patterns, orchestrator analogs) and citing exact file:line references in the planner prompt got Phase 43 unblocked without retrying a flaky agent. This was strictly faster than a third research retry.
- **Phase 44 explicitly learned from Phase 43 review findings.** The Phase 44 planner prompt referenced 43-REVIEW.md and asked the planner to fold WR-01/WR-02/IN-01/IN-04 mitigations into the new orchestrator. Phase 44 shipped with those mitigations baked in (destructure pattern instead of `found.length === 1`, typed `switch (src.kind)` with `assertNever`, all touched test files enumerated in `files_modified`). Phase 44 also retroactively extended the architecture grep-gate to cover `marketplace/info.ts` -- closing a Phase 43 oversight.
- **Atomic-supersession discipline held** for Phase 42's closed-set extension. Five files in one commit, GREEN tests at every commit boundary. The planner correctly refused to split.
- **Byte-equality carry-forward** through three phases. Phase 42's `scope-mismatch-not-added` anchor stayed byte-identical at HEAD across Phase 43 and Phase 44 work -- locked structurally by the catalog UAT runner.
- **Code review + fixer chain caught real regressions.** Phase 42's CR-01 (missing `assertNever` exhaustiveness gate -- the if-ladder claimed it but didn't actually have one) and Phase 44's WR-01/WR-02 (Phase 29 `narrowProbeError` discipline regression) were both legitimate defects that would have been tech debt without the review step.

### What Was Inefficient

- **gsd-phase-researcher stalled twice on Phase 43** with 600s watchdog timeouts. Both stalls were at the file-write step, not investigation. Workaround was to skip the standalone research and fold intel into the planner. Phase 44 followed the same skip-research pattern proactively. Worth surfacing as a flake to investigate before relying on the researcher in future autonomous runs.
- **ROADMAP analyzer false-positive at autonomous startup**: discovered 27 incomplete phases because the historical Phase Details section (15-41) wasn't wrapped in `<details>`. The analyzer's `extractCurrentMilestone` strips `<details>` blocks but parses bare `### Phase N` headers. Required a structural cleanup commit before autonomous could discover the correct 3-phase scope. Worth surfacing for the analyzer to handle this corner case directly.
- **Em-dash auto-conversion forced multiple re-commits.** The pre-commit `fix-unicode-dashes` hook converts `--` to `--` in markdown files after staging. Every plan doc and commit message containing em-dashes required a re-stage + retry. Worth either pre-converting in the prompt template or amending the hook to skip planning artifacts.

### Patterns Established

- **Inline-intel planning** when the researcher stalls: gather architecture pointers (file paths, line ranges, analog files, requirement table extracts) inline via Read/Grep, then dispatch the planner with `<architecture_intel_gathered>` blocks embedded in the prompt. Strictly faster than re-trying a flaky researcher.
- **Carry-forward findings between phases.** Phase N+1's planner prompt should explicitly reference Phase N's REVIEW.md and ask the planner to fold mitigations into the new code. This compounds review value across the milestone.
- **`<details>`-wrap historical Phase Details** in ROADMAP.md so the active-milestone analyzer only sees the current milestone's phases. Apply at every milestone close (or have the analyzer infer it from the milestone summary checkboxes).

### Key Lessons

- **Atomic-supersession is non-negotiable for closed-set changes.** Phase 42's contract -- REASONS tuple + first consumer + tests + catalog state + fixture in ONE commit -- meant `npm run check` was GREEN at every commit boundary, no transient RED states. Phases 43 and 44 inherited a stable foundation and never had to fight a half-shipped closed-set.
- **Code review surfaces correctness bugs, not just style.** CR-01 in Phase 42 (missing exhaustiveness gate) and WR-01/WR-02 in Phase 44 (narrowProbeError regression) were not cosmetic. The fixer agent has positive ROI when severity policy is set per-finding rather than blanket-applied.
- **Skipping discuss saves time when the ROADMAP phase description is precise.** All three phases used `workflow.skip_discuss=true` and auto-generated minimal CONTEXT.md from the ROADMAP goal. None of the planners blocked on missing context.

### Cost Observations

- Model mix: ~100% opus for researchers / planners / fixers / executor; sonnet for plan-checker + code-reviewer. Mostly intended by config defaults.
- Background agents: ~12 dispatched, ~10 succeeded first try. Two researcher stalls (Phase 43) cost ~20 min of wall-clock with no output. Net positive impact: workaround pattern (inline intel) was reusable for Phase 44.
- Pre-commit hook fix-cycle was the largest non-agent time cost: most commits required 2 attempts due to em-dash auto-conversion.

## Milestone: v1.5 -- Notification Output Polish

**Shipped:** 2026-05-31
**Phases:** 3 (27, 28, 29) | **Plans:** 10 | **Tasks:** ~25
**Timeline:** 2026-05-30 → 2026-05-31 (~2 days)

### What Was Built

- **UXG-01/04/05/06** (Phase 27): `<last-updated>` dropped from `marketplace list`; autoupdate `<autoupdate>` / `<no autoupdate>` marker grammar with idempotent braces; `marketplace update` no-op → `(skipped) {up-to-date}`; catalog/heading nits.
- **UXG-02** (Phase 28): 5-arm benign-softening `computeSeverity` ladder with `BENIGN_REASONS` closed set -- benign-only skip cascades route `info` not `warning`.
- **UXG-03** (Phase 28): Resolved DEFER-WITH-FINDING. Read-only spike refuted host feasibility; `@earendil-works/pi-coding-agent` couples label+color inseparably. Accepted upstream limitation.
- **UXG-07** (Phase 29): `notify()` prepends a summary line (`N plugin operation(s) failed/skipped.`) for error/warning cascades, giving the `Error:`/`Warning:` host prefix a meaningful sentence.
- **UXG-08** (Phase 29): `preflightUpdate` restructured to consult the marketplace manifest before the not-installed guard, so `update <nonexistent>@<mp>` → `(failed) {not in manifest}` matching `install`.
- **Version arrow fix** (post-UAT): `composeVersionArrow` changed to symmetric `v`-prefix on both sides (`v1.0.0 → v1.1.0`), surfaced during branch gate UAT.

### What Worked

- **Branch gate UAT with pre-provisioned fixture marketplace** (`uat/uat-mp/`) caught the version-arrow asymmetry and confirmed all 8 UXG requirements in one ~30-minute live session. Having the fixture already seeded eliminated setup friction between each test.
- **catalog-uat byte-equality gate** continued to be the enforcement anchor: every notify() output change required an atomic catalog + test lockstep commit, making regressions impossible to commit accidentally.
- **D-29-01 decision capture during discuss-phase** (keeping severity routing, adding summary line instead of routing to info) was the right call -- it aligned with the user's actual preference after seeing the UXG-03 upstream constraint. The discuss-phase artifact saved a wasted Phase 29 plan.

### What Was Inefficient

- **v1.5 milestone reopened mid-close** (Phase 29 added after v1.5 was initially marked complete). The 2026-05-31 runtime pass surfaced UXG-07/08 that the notify-boundary capture approach had missed. A full live-runtime UAT earlier in the milestone would have caught these before declaring complete.
- **SUMMARY.md writing to main tree** (a recurring worktree pattern): agents consistently wrote their SUMMARY.md to the absolute main-repo path rather than their worktree-relative path, blocking each `worktree.cleanup-wave` call. The `rm`-and-recommit workaround is now muscle memory but should be fixed at the agent level.

### Key Lessons

- **Live-runtime UAT is not optional before milestone close.** The notify-boundary capture approach is a useful signal but is not a substitute for actually running the commands against the source-loaded runtime. Add a mandatory `scripts/pi.sh --home /tmp/pi-uat` step to the milestone completion checklist.
- **Pre-provision UAT fixture marketplaces with the milestone plan.** Having `uat/uat-mp/` in the repo turned the branch gate UAT from "set up fixtures, run tests, document" into "run tests, report pass/fail." 30-minute complete UAT instead of 2+ hours.

---

## Milestone: v1.3 -- Consistent Messaging

**Shipped:** 2026-05-25
**Phases:** 5 (12, 13, 14, 14.1, 14.2) | **Plans:** 27 | **Tasks:** 72
**Timeline:** 2026-05-21 → 2026-05-24 (~3 days, 223 commits, +15,030 / -1,917 LOC across 180 files)

### What Was Built

- **Closed-set grammar primitives** under `shared/grammar/` (`STATUS_TOKENS`, `REASONS`, `MARKERS`, `PATTERN_CLASSES`) with a YAML-frontmatter set-equality drift test reading `docs/messaging-style-guide.md` as the binding contract.
- **Wave 1 presentation composers** under `presentation/` (`compact-line`, `cascade-summary`, `manual-recovery`, `rollback-partial`, `cause-chain`, `reload-hint`, `sort`) consumed by every user-visible orchestrator with per-row soft-dep markers and 2-arm severity dispatch.
- **ES-5 atomic supersession** (`c4d87d4`): one commit deleted the 5 legacy markers, retired the snapshot byte-equality assertion, rewrote PRD §6.12 to a pointer, rolled back temporary ESLint marker-restriction blocks.
- **Per-command catalog conformance** via `tests/architecture/catalog-uat.test.ts` byte-equality runner against `docs/output-catalog.md`.
- **34-rule ESLint drift-guard plugin** (16 meta-assertion + 18 full-impl) under `tests/lint-rules/` with per-rule scoping and a 4-way registry parity test tying style-guide body to rule files to ESLint wiring to plugin module.
- **CMC-13 import-path closure** (Phase 14.1) and **CR-01 cross-scope ordering fix + retroactive Phase 12/14.1 gates** (Phase 14.2).

### What Worked

- **Phase 12 foundations-first split** kept Phase 13's mechanical refactor purely additive: the 10 Phase-13 plans each consumed Wave 1 primitives unchanged. Refactor-then-supersede beats refactor-and-supersede.
- **Byte-equality catalog UAT runner** caught drift the moment a catalog fixture and renderer diverged, eliminating the "matches the catalog" judgment call. Pairing `<!-- catalog-state: STATE -->` comments with programmatic fixtures is now load-bearing.
- **YAML frontmatter as binding contract** (style guide → ESLint rules) means a docs edit fails `npm run check` if it widens the closed set without a paired rule update. The 4-way registry parity test surfaced every drift attempt in the milestone.
- **Atomic 3-file ES-5 supersession** (markers + snapshot test + PRD pointer in one commit `c4d87d4`) -- the only commit that could land was one that passed `npm run check`, so the user-contract change boundary was inherently green.
- **Retroactive gates pattern** for closing milestone drift: when Phase 12 / 14.1 lacked SECURITY/VALIDATION artefacts, a dedicated wave-2 plan (14.2-03 / 14.2-04) running `/gsd:secure-phase` + `/gsd:validate-phase` against the prior phase was cleaner than discarding-and-redoing the draft.

### What Was Inefficient

- **Phase 14.2 was unplanned** -- it existed only to close tech debt (CR-01) and retroactive gates that Phase 14's audit surfaced. Worth ~30% of the milestone's plan count for what was effectively cleanup; a stricter post-Phase-13 audit could have caught CR-01 before Phase 14 ran.
- **The MSG-GR-3 lint rule shipped as a no-op meta-assertion in Phase 14** (D-14-09) and had to be re-promoted in Phase 14.2 (D-14-2-08) to an active two-axis AST detector. Two passes where one would have done; the no-op intermediate step added zero value.
- **Stale-format quick task SUMMARY frontmatter** (7 tasks) was flagged by `audit-open` at milestone close even though all tasks were complete. Acknowledged as deferred but a small fixture refactor (canonical SUMMARY frontmatter) would have prevented the flag.
- **Auto-generated MILESTONES.md entry** ingested raw fixture text and code-review headers as "accomplishments". Required manual cleanup; the `milestone.complete` query's accomplishment extractor needs tighter heuristics.
- **PROJECT.md "Last updated" footer** accumulated 11 distinct timestamps across the milestone; collapsing them at close was a 12-paragraph delete. A per-milestone footer (not per-phase) would scale better.

### Patterns Established

- **Drift contract via frontmatter:** read closed sets from `docs/<contract>.md` YAML frontmatter at test time. One source of truth, structural enforcement, zero duplicated lists. Now load-bearing for `status_tokens` / `reasons` / `markers` / `pattern_classes`.
- **Per-row markers replacing aggregated trailers:** `PluginCascadeRow.declaresAgents/Mcp` predicates drive `{requires pi-subagents}` / `{requires pi-mcp}` on the affected line. Cleaner than a separate "Warnings:" partition and structurally typeable via discriminated unions (NFR-7).
- **Atomic user-contract change boundary commits:** one commit that simultaneously deletes the legacy form, retires the test that locked it in, and rewrites the spec pointer. Rollback path is `git revert <SHA>` (single commit) instead of a coordinated 3-file revert.
- **Catalog UAT byte-equality fixtures:** programmatic fixture composes via the production renderer; assertion reads the catalog markdown at test time and asserts byte equality. No string-templating in the catalog; no copy-paste between docs and tests.
- **Retroactive gates:** when historical phases lack SECURITY/VALIDATION artefacts, spawn `/gsd:secure-phase N` + `/gsd:validate-phase N` from a closure-phase plan rather than skipping or backfilling manually. The skill runs the same auditor against the same plan-time threat model.

### Key Lessons

1. **Lint rules that ship as no-ops are dead weight.** D-14-09 added a `Program: () => {}` rule visitor "to be promoted later" -- and "later" arrived in the next phase. Either ship the active rule or ship nothing; the placeholder rule offered structural-enforcement claims it couldn't back.
2. **Audits catch what verification doesn't.** Phase 14 verification (5/5 must-haves) passed; the post-phase code-review audit caught CR-01. The phase-goal verification is necessary but not sufficient -- when the goal is "drift-guard", an integration-checker pass should be in scope, not deferred.
3. **The user-contract change boundary should be a single commit.** ES-5 supersession (`c4d87d4`) worked because all three artefacts moved together. Where the user-contract crosses multiple files, atomic commit is the only safe rollback unit.
4. **Frontmatter as binding contract scales better than enumerated lists in test code.** Phase 14 extended `grammar-frontmatter.test.ts` from 2-key to 4-key set-equality with no rule duplication -- the YAML loader at `tests/lint-rules/lib/frontmatter.js` is the single seam.
5. **A 5-plan wave-2 retroactive-gate phase is the cheapest fix for milestone gate gaps.** Better than postponing the milestone close; better than blanket-acknowledging gaps as tech debt.

### Cost Observations

- Model mix: not tracked at the planning-doc level (`STATE.md` performance metrics are by-phase, not by-model). Phase 14.2 ran with `quality` profile (Opus 4.7 1M).
- Sessions: not tracked.
- Notable: ~3-day calendar duration for 27 plans + 5 phases is roughly twice the planning velocity of v1.2 (Phases 10-11, ~5 days for 2 phases); the higher density reflects the mechanical-refactor character of v1.3 (closed-set primitives consumed unchanged across waves).

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 7 | PRD-as-spec pattern; dependency-graph inside-out roadmap |
| v1.1 | 2 | Atomic transaction primitive (`withLockedStateTransaction`); cross-process state locking |
| v1.2 | 2 | Pure desired-state planning boundary (D-28); both-scope default with explicit-scope override |
| v1.3 | 5 | Drift contract via YAML frontmatter; byte-equality catalog UAT; atomic user-contract supersession commits |

### Cumulative Quality

| Milestone | Tests (end) | Notable |
|-----------|------------|---------|
| v1.0 | ~700 | Test framework: `node --test` built-in |
| v1.1 | ~900 | Cross-process IPC fork tests for concurrent-install race |
| v1.2 | ~1000 | Catalog-UAT fixture pattern seeded |
| v1.3 | 1249/1249 | Byte-equality catalog UAT + 34-rule MSG-* drift-guard plugin; v1.3 user-contract structurally enforced |

### Top Lessons (Verified Across Milestones)

1. **Spec-then-refactor beats refactor-and-spec.** v1.3 Phase 12 (foundations) before Phase 13 (refactor) mirrored v1.0 Phase 2 (primitives) before Phases 3-7 (consumers). The "load-bearing primitive lands first" pattern has now shipped across 4 milestones.
2. **Atomic transaction boundaries are non-negotiable.** v1.1's `withLockedStateTransaction` and v1.3's `c4d87d4` supersession commit both ship as single atomic units. Any cross-file user-contract change that can't fit in one commit is a design smell.
3. **Discriminated unions catch design errors at the type level.** NFR-7's `installable: true | false` (v1.0), `failureClass: "manual-recovery" | "rollback-partial" | ...` (v1.3), and `PluginCascadeRow.declaresAgents/Mcp` (v1.3) all use the same pattern: a closed set discriminant where consumers can't read forbidden fields without narrowing.
