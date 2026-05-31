# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

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
