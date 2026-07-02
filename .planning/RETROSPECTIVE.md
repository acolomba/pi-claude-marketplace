# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: force-install

**Shipped:** 2026-07-02 as `pi-claude-marketplace@0.7.0` (PR #77)
**Phases:** 12 (Phases 64-74, incl. inserted 65.1) | **Plans:** 33 | **Tasks:** 71 | **Requirements:** 42/42

### What Was Built
- A **three-way resolver state** (`installable` / `unsupported` / `unavailable`) replacing the binary `installable: true|false`, with `requireInstallable` / `requireForceInstallable` narrowing gates. `unavailable` (structural defects: bad manifest/hooks, NFR-10 path violation) exposes `pluginRoot` to no consumer, so `--force` can degrade components but never rescue a hard failure -- NFR-7 refined, not weakened.
- `install` / `update --force` degrade-not-block on partially-supported plugins, with **derived** force-state (`force-installed` ◉ / `force-upgradable` ●) -- no persisted flag, no migration. A force-installed plugin returns to `(installed)` automatically once its components become supported; a version-gated load-time backfill (`lastReconciledExtensionVersion` stamp) re-materializes it when the extension gains a new bridge.
- Cross-surface consistency: an `--unsupported` list filter, force-aware completion, reinstall demoted to an unconditional repair primitive, partial-hook degradation (install the supportable handlers, drop the rest), and a distinct `⊖ (unsupported)` token unified across list / info / install-error / update-decline via the shared `narrowUnsupportedKinds` anchor.
- SEV-01..05 desired-state severity: direct force degrade at info, missing soft-dep / reinstall-recovery at warning, no-force unsupported install at error with a `--force` hint, structural unavailable at error with no hint.

### What Worked
- Foundation-first sequencing (Phase 64 three-way state before every downstream surface) meant each later phase composed a frozen resolver seam -- the same load-bearing-primitive-lands-first pattern proven across prior milestones.
- Deriving force-state instead of persisting a sticky flag (the earlier attempt was built and removed) eliminated the migration + drift cost and gave the auto-promotion-to-`(installed)` path for free.
- Atomic catalog-lockstep amendments held across the new tokens (`force-installed`, `⊖ (unsupported)`, `force-upgradable`) -- byte fixtures landed in the same commit as the renderer arm.
- Post-"final-phase" UAT (2026-06-29) surfaced two real gaps, and Phases 72-74 were inserted to close them rather than deferring: install-error / update-decline still said `⊘ (unavailable)`, and bulk `update` inflated its "successes" count with up-to-date no-ops.

### Key Lessons
1. **Derive state that can be recomputed from the source of truth rather than persisting it.** The removed sticky-flag attempt confirmed the migration/drift tax of persistence; the derived model needed neither a schema bump nor a backfill migration.
2. **One cross-surface byte-parity anchor makes "consistent everywhere" verifiable.** `narrowUnsupportedKinds`, imported by all four surfaces, is what let the audit assert token/reason parity and regression-lock it -- mirroring v1.10's cross-op convergence matrix lesson.
3. **UAT after the "last" phase still earns its keep.** The `⊖`/`⊘` cross-surface inconsistency and the inflated bulk-update count were only visible against real command output, not notify-boundary fixtures -- three phases (72-74) came out of that hands-on pass.

## Milestone: v1.13 -- Claude Hook Bridge

**Shipped:** 2026-06-19 as `pi-claude-marketplace@0.6.0`
**Phases:** 7 (Phases 57-63) | **Plans:** 32 | **Tasks:** 52 | **Tests:** 1897 → 2317 unit + 14 integration | **PRs:** #60 (squash merged)

### What Was Built
Claude Code hooks bridge translating plugin `hooks/hooks.json` into Pi event subscriptions for the 8 bucket-A events (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd) at 100% dispatch fidelity. Strict-supportability resolver gate flips plugins to `(unavailable) {unsupported hooks}` for non-bucket-A events, unmapped tools, regex matchers, or non-`command` handlers. Forward-compat investments shipped: `if` field permission-rule matcher (MATCH-03), `asyncRewake` registry with detached background-spawn + ring-buffered stdio + exit-code-2 model-context injection + PID-table orphan reap (HOOK-06 + EXEC-05). Lifecycle cascade: install/uninstall/reinstall/update/enable/disable keep the routing table in lockstep with `state.json` so dispatch fires immediately without `/reload` (NFR-2).

### What Worked
- Strict-supportability stance as a single closed-set decision drove every downstream gate (resolver, install cascade, info surface, lenient reader) — zero "what does this mean for plugin X?" debates mid-execution.
- Atomic catalog-lockstep amendments held across `{unsupported hooks}`, `(disabled)`/`(will disable)`, `orphan rewake`, `(will enable)` — the byte fixtures landed in the same commit as the renderer arm in all four cases.
- 5-agent post-PR review (code, tests, comments, errors, types) on `c4d1a4b..HEAD` caught 10 findings; 9 were applied as a follow-up `/gsd-quick` cleanup pass; one deferred with explicit layering-fence rationale.
- Lenient reader on the info surface lets `(unavailable) {unsupported hooks}` rows enumerate components and tag the offending event — visibility without changing install correctness.

### What Was Inefficient
- Worktree isolation misfired on the very first executor dispatch (base mismatch on a fresh session); fell back to sequential mode for the rest of the session. The harness's session-start HEAD snapshot was stale relative to the pre-dispatch plan commit.
- Spec docs drifted from shipped behavior across 3 quick-task changes (info components / lenient hooks / glyph split). A fourth quick task had to sync REQUIREMENTS.md + PRD post-hoc. Pattern: when shipping behavior changes inside an open milestone, the spec-sync should land in the same commit, not a follow-up.
- Phase 62 (HOOK-06 / EXEC-05) shipped but the REQUIREMENTS.md checkboxes + traceability rows stayed `[ ]` / `Pending` until milestone close. Needs a phase.complete gate that flips REQ checkboxes against the shipped state.
- Audit-open found 9 items needing decisions at close: 4 stale debug-session locations (resolved but not moved to `resolved/`), 5 non-canonical SUMMARY frontmatter (`completed` vs `complete`, missing `status:`). All cheap fixes but accumulated across the milestone.

### Patterns Established
- **Lenient discriminated arm on a strict-resolver-side type:** `HookSummaryEntry { kind: "lenient" }` arm produced ONLY by the info-surface reader, never by the resolver. Render-side branches on `"kind" in entry` first, then `"matcher" in entry`. Same pattern can apply to any "strict at install, lenient at info" type seam.
- **Glyph catalog as a closed set with role legends:** `●` realized, `○` available/will-remove, `⊘` failure-class (unavailable/failed/skipped/manual-recovery), `◌` disabled/will-disable. Amendments require renderer + catalog + byte-tests + grammar invariant in one commit.
- **Pre-dispatch plan commit + sequential-mode fallback:** when the worktree base goes stale, the executor halts cleanly via the `worktree_branch_check` HALT; re-dispatch in sequential mode keeps the session moving without losing the plan.
- **5-agent parallel post-merge review:** code-reviewer + pr-test-analyzer + comment-analyzer + silent-failure-hunter + type-design-analyzer surface complementary findings; cluster overlap (e.g. `groupCount` is dead carry flagged by 3 of 5) is high-signal.

### Key Lessons
1. **Spec sync is part of the behavior change.** REQUIREMENTS.md / PRD updates belong in the commit that ships the behavior, not a follow-up. Same for output-catalog.md amendments.
2. **Phase complete must flip REQ checkboxes.** Audit-open at milestone close caught `[ ] HOOK-06` / `[ ] EXEC-05` while the code had shipped weeks earlier. Worth a phase.complete gate that diffs REQ state against the traceability table.
3. **Operator runtime probes need an explicit "ran/verified" marker.** `resolved-pending-runtime` is a useful state but the verification evidence path was implicit. A `runtime_verified_at: <date>` field would make audit-open's job clean.
4. **Lenient readers must mirror their strict siblings' error contract.** The first cut of `readLenientHookSummary` collapsed EACCES + programmer bugs into "no hooks" via bare `catch {}` — silent-failure-hunter caught it. Restored parity with `readHookSummaryEntries` (ENOENT/SyntaxError narrow, IO errors propagate to row-builder's `narrowProbeError`).
5. **`(disabled)` and `(unavailable)` are different conceptual classes.** They share a glyph in v1.12 but the v1.13 split (`◌` vs `⊘`) makes the disabled = user-requested-state vs unavailable = error/blocked-state distinction structural.

### Cost Observations
- Model mix: opus executors/planners/researchers, sonnet checkers/verifiers; review agents inherited the harness model (Opus 4.7).
- Sessions: 1 long execution session (this one), 6 `/gsd-quick` tasks + the merge/release flow.
- Notable: the 5-agent parallel review (10 findings → 9 applied as cleanup → all green) was the highest signal-per-token segment; the worktree misfire was the highest waste segment.

## Milestone: v1.12 -- Marketplace and Plugin Config Files

**Shipped:** 2026-06-11
**Phases:** 6 (Phases 51-56) | **Plans:** 15 | **Tasks:** 24 | **Tests:** 1515 -> 1804 unit + 10 integration

### What Was Built
Declarative per-scope config files (`claude-plugins.json` + `.local.json` entry-level override) as the authoritative desired-state record: typebox schema with discriminated absent/invalid/valid loading, lossless first-run migration, pure 7-bucket reconcile planner + read-only `preview` command (six `will *` tokens), offline enable/disable with the `(disabled)` token, automatic load-time reconciliation (per-entry soft-fail, one cascade, fixed-point, two-process safe), and config write-back on every mutating command with `--local`.

### What Worked
- Foundation-first sequencing (51 schema -> 52 migration -> 53 planner -> 54/55 consumers -> 56 write-back) meant every later phase composed frozen seams; zero replanning across 6 phases.
- The atomic catalog-lockstep commit pattern (renderer + catalog + byte fixtures in ONE commit) held across three closed-set amendments (will-*, disabled, reconcile-applied-cascade) -- no drift gate ever went red between commits.
- Per-phase code review caught 5 criticals (nested-lock deadlock, token-with-no-producer, autoupdate config clobber, dangling cross-scope declaration, key/name convergence churn) that all passed the per-plan test suites -- adversarial review after execution is load-bearing.
- Architecture tests as ratchets: SPLIT-02 write-seams allow-list (size 1), SPLIT-01 cast allow-list (6 -> 0), planner purity, FORBIDDEN_TARGETS network gates.

### What Was Inefficient
- Plan 51-02 hit a self-contradictory plan (persistence-only boundary vs GREEN gate) requiring a mid-execution user decision; planner should sanity-check cross-cutting type changes against consumer compile surface.
- Worktree-mode fixers had to SKIP=trufflehog and rescan separately every time (known repo limitation).
- The stale ROADMAP historical sections (Phases 15-50 in details blocks) confused both phase discovery and milestone close until removed.

### Patterns Established
- Discriminated `ConfigLoadResult` trichotomy as the safety gate for user-editable files (absent != invalid != valid-empty).
- Orchestrated-vs-standalone notification modes: load-time aggregation reuses command orchestrators without double-notify or config write-back.
- "Implicit marker" persistence (empty resources arrays = disabled) avoids schema bumps but needs a >=1-component invariant -- watch the zero-component edge.

### Key Lessons
1. Reconcile-path code must never write the user config -- the WR-09 fix restored SPLIT-02 after orchestrated-mode briefly leaked write-back; the architecture test now pins it.
2. Write config entries with the user's verbatim source string -- planner convergence breaks on any re-rendering (Phase 55 CR-01).
3. Tests that drive real orchestrators against real temp dirs catch what mock-driven suites cannot (the fresh-enable deadlock and import config pollution were both invisible to mocks).

### Cost Observations
- Model mix: opus executors/planners/researchers, sonnet checkers/verifiers.
- Sessions: 1 autonomous run (discuss-skip mode), 2026-06-09 -> 2026-06-11; 146 commits.
- Notable: review->fix->verify loop per phase added ~30% wall time but removed 5 ship-blocking defects.

## Milestone: v1.11 -- Notification Summary-Line Grammar

**Shipped:** 2026-06-08
**Phases:** 1 (Phase 50) | **Plans:** 1 | **Tasks:** 3 | **Tests:** 1514 -> 1515

### What Was Built

A single file-private `emitWithSummary(ctx, message, body)` seam in `shared/notify.ts` that BOTH the standalone arm (`dispatchInfoMessage`) and the cascade arm of `notify()` route through. `buildSummaryLine` extended to return the failed-subject summary (`N marketplace operation(s) failed.` / `N plugin operation(s) failed.`) for the standalone `marketplace-not-added` and failed `plugin-info` kinds. The v1.10 glued-label defect (`Error: ⊘ y [user] (failed) {not added}`) is gone; every error/warning emission is now a non-empty summary line + a separate detail block. Closed GRAM-01..05.

### What Worked

- **Single-phase, single-seam scoping was right.** Every requirement converged on one notify seam plus a lockstep catalog/fixture byte-rewrite; no over-decomposition. The atomic-landing constraint (code + `buildSummaryLine` + ~9 catalog fences + tests in one plan) kept the `catalog-uat` byte gate from ever going RED across a commit boundary -- the v1.3 atomic-supersession lesson, re-applied.
- **Sequential (non-worktree) execution was the correct call.** A worktree checkout lacks `node_modules`, so `npm run check` (a phase acceptance criterion) would have failed inside one; running the single plan on the main tree avoided that entirely.
- **Code review earned its keep.** It found WR-01: a *surviving* instance of the exact standalone-vs-cascade divergence the phase targeted, on the both-scopes `plugin-info-cascade` fan-out path that the planned scope didn't touch. Fixing it in the orchestrator (mirroring `getMarketplaceInfo`'s failure separation) closed the goal completely rather than leaving a quiet hole.

### What Was Inefficient

- The v1.10 catalog had encoded the broken glued-label form as GREEN across ~6 sections, so byte-equality verification had been passing on broken output. Catalog-as-contract is powerful but only as correct as the bytes a human signed off on.
- A pre-existing, unrelated red test (`reinstall-docs.test.ts` asserting verbatim README prose) surfaced during the green-gate check and had to be triaged mid-milestone; it was resolved by a separate quick task (260608-npa) that removed the brittle README-prose contract in favor of the already-existing spec/behavior coverage.

### Patterns Established

- **One severity-gated emission seam** (`emitWithSummary`): severity computed once via `computeSeverity`; info emits body-only, error/warning prepend `buildSummaryLine(...) + "\n\n" + body`. No standalone kind can drift back to a summary-less emission.
- **Failure separation before fan-out**: info-cascade wrappers (`plugin-info-cascade`) must never carry a `(failed)` block; the orchestrator separates failures out and emits each as its own LOUD standalone notify (the `getPluginInfo`/`getMarketplaceInfo` shape).
- **Docs-as-contract belongs on the spec doc + implementation, not README prose**: brittle verbatim-string README assertions were retired in favor of `docs/output-catalog.md` byte-binding (catalog-uat) + behavior tests.

### Key Lessons

- When a fix targets a *class* of divergence, audit every code path that can produce the class -- not just the one in the bug report. The fan-out path (WR-01) was the same bug wearing a different hat.
- A "pre-existing failure" excuse must be verified, not accepted: confirm the failing files are untouched by the phase and the test is deterministic before treating a red gate as out-of-scope.

### Cost Observations

- Model mix: opus for research/pattern-map/plan/execute/review, sonnet for plan-check/verify/integration.
- Sessions: 1 (autonomous run, discuss skipped via `workflow.skip_discuss`).
- Notable: a single-phase milestone still benefits from the full research -> pattern-map -> plan -> check -> execute -> review -> verify chain when the change touches a core emission seam; the review pass alone caught a real goal gap.

## Milestone: v1.10 -- Error Attribution & Message-Type Consistency

**Shipped:** 2026-06-08
**Phases:** 4 (46-49) | **Plans:** 10 | **Tasks:** 28 | **Tests:** 1473 -> 1513

### What Was Built

A type-model-first attribution overhaul. Phase 46 made the attribution-drift message shapes
unrepresentable (dedicated `marketplace-not-added` variant, `ContentReason` exclusion, per-status
`MarketplaceNotificationMessage` discriminated union, single-source `isInfoKind`/`assertNever`
guard) -- byte-neutral. Phases 47-48 then converged every plugin and marketplace operation on
`info`'s `(failed) {not added}` marketplace-subject model, replaced lying `{not in manifest}` /
`{network unreachable}` fallbacks with truthful reasons, and added cross-scope reporting. Phase 49
proved Class C cross-op convergence with a dedicated 8-orchestrator byte-identity test and closed
the last residual gap (marketplace update raw-throw).

### What Worked

- **Type-model-first sequencing.** Landing the unrepresentable-shapes foundation (Phase 46) before
  the behavior changes meant the compiler enforced the convergence: a wrong attribution shape simply
  did not type-check. The `ContentReason` retype rippling into the orchestrator outcome vocabulary
  strengthened the invariant end-to-end (a sanctioned executor deviation).
- **Serialization through `shared/notify.ts`.** Per the v1.4.1/v1.5 convergence lesson, phases (and
  plans within a phase) were strictly serialized via `depends_on` rather than parallelized, because
  every change converged on the notify type model / reasons / renderer. Zero merge conflicts.
- **Atomic byte-pairing.** Every rendered-byte change landed with its `docs/output-catalog.md`
  catalog state + `catalog-uat` fixture in the same GREEN commit -- no intermediate RED.
- **Adversarial code review caught a real blocker.** The Phase 49 review found CR-01 (a concurrent-
  removal race emitting a false `{network unreachable}` -- the exact lie the milestone exists to
  eliminate) that the per-op tests missed; fixed before close.

### What Was Inefficient

- Two executor deviations per phase were consistently needed for SonarJS cognitive-complexity
  ceilings (helper extraction) -- predictable, could be pre-empted in planning for chokepoint files.
- `mdformat` reformats `docs/output-catalog.md` at commit time (not in `npm run check`), forcing a
  restage-and-recheck loop to confirm byte-equality survived the reformat. Worth a pre-commit-aware
  catalog format step.
- The `D-46-03a` decision (whether the `failed` marketplace arm carries reasons) was deferred from
  Phase 46 to Phase 48, where it became the linchpin `MpFailed.reasons?` touch -- correct call, but
  it meant Phase 48 re-opened the Phase 46 type model (one inverted proof).

### Patterns Established

- **Standalone top-level emission for marketplace-absent** (D-47-A): the precondition fails before
  any cascade, so it emits a standalone variant matching `info`, not an embedded cascade row.
- **`remove.ts` catch-and-reroute** as the reusable shape for routing a raw `MarketplaceNotFoundError`
  precondition through `notify` (reused by reinstall, update, autoupdate, and the Phase 49 fix).
- **Cross-op byte-identity matrix test** as the first-class Class-C regression lock (invoke every
  real orchestrator against the precondition; assert all bytes identical).

### Key Lessons

- A convergence milestone needs a convergence PROOF, not just per-op fixes -- the dedicated matrix
  test is what makes "Class C closed" verifiable and regression-locked.
- "Lying reasons" hide on rare edges (concurrent-removal TOCTOU) that per-op happy-path tests miss;
  adversarial review + a cross-op no-`{network unreachable}` cross-check are the safety net.

### Cost Observations

- Model mix: opus for research / planning / execution; sonnet for plan-checking / code review /
  verification / integration. Run end-to-end via `/gsd:autonomous` (discuss skipped per
  `workflow.skip_discuss`).
- Sessions: 1 (single autonomous run).
- Notable: orchestrator-owned commits via the pre-commit hook path (never `--no-verify`) handled the
  `fix-unicode-dashes` / `mdformat` fixer-modifies-then-aborts loop the GSD commit verb does not.

## Milestone: v1.9 -- Manifest In-Memory Cache

**Shipped:** 2026-06-07
**Phases:** 1 (45) | **Plans:** 2
**Timeline:** 2026-06-06 → 2026-06-07 (autonomous run)

### What Was Built

A process-lifetime in-memory cache (`createManifestCache(loader)` in `domain/manifest-cache.ts`) wrapping the single `loadMarketplaceManifest` seam, realizing PRD NFR-8. `stat`-only invalidation keyed by `(mtimeMs, size)`, by-reference success hits, same-instance negative re-throw (negative caching), `stat()`-failure as a pure miss. Wired behind the existing seam via one module-level singleton with zero call-site churn across the 9 consumers; byte-identical output (catalog-UAT 3/3, `npm run check` 1473/1473).

### What Worked

- **The seam was pre-landed for exactly this.** Phase 7 / Plan 07-02 deliberately built `loadMarketplaceManifest` as the sole manifest-read chokepoint with a "future caching wraps this" comment. v1.9 slotted the cache in behind it with no consumer changes -- the single-seam discipline paid off two milestones later.
- **TDD scaffold-first (Wave 0 RED → Wave 1 GREEN).** Authoring the 7-test behavioral contract before the implementation made the locked design (D-01..D-04) executable and caught the spy-mechanism question early (injected counting loader, since `readFile` is unmockable on the ESM namespace).
- **Research POC de-risked the one open question.** The phase researcher built and ran the full `createManifestCache` design end-to-end before planning, proving all four behavioral arms -- so planning had no unknowns.

### What Was Inefficient

- **VALIDATION.md authored pre-execution as a draft stayed `nyquist_compliant: false`** until manually flipped at audit time. The frontmatter didn't auto-update when the Wave 0 suite went green; a post-execution reconcile step would avoid the audit-time PARTIAL flag.
- **`phase complete` regressed STATE.md Current Position** to "Plan: Not started" on the last phase, needing a manual closure-narrative restore.

### Patterns Established

- **Injected-loader cache** (mirrors `shared/completion-cache.ts`) but with a constructed-instance factory instead of a module-global map + reset hook -- fresh instances give tests a guaranteed cold start without leaking a `__resetCacheForTests()` onto the public surface.
- **Accepted, documented residual risk over scope creep:** the same-`(mtimeMs, size)` collision on a same-size rewrite is owned in code comments and REQUIREMENTS Non-Goals rather than solved with content hashing.

### Key Lessons

- A single-chokepoint seam built one milestone is the cheapest possible insertion point for a cross-cutting optimization the next -- design seams for the wrap point you anticipate.
- Code-review warnings that touch a locked design + byte-identical contract are a grey-area acceptance call, not an auto-fix: surface the trade-off, let the operator decide (here: apply both -- post-load re-stat + exact-thrown-value preservation, commit `3fe6b46`).

### Cost Observations

- Model mix: opus (research, planning, execution, integration) + sonnet (plan-check, verify); single autonomous run.
- Notable: 1-phase milestone end-to-end (discuss pre-done → research → plan → execute → review → verify → audit → complete) with no blockers and zero gap-closure cycles.

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
| v1.12 | 6 | Declarative desired-state config + load-time reconciliation; architecture-test ratchets (write-seams, cast allow-list, planner purity) |

### Cumulative Quality

| Milestone | Tests (end) | Notable |
|-----------|------------|---------|
| v1.0 | ~700 | Test framework: `node --test` built-in |
| v1.1 | ~900 | Cross-process IPC fork tests for concurrent-install race |
| v1.2 | ~1000 | Catalog-UAT fixture pattern seeded |
| v1.3 | 1249/1249 | Byte-equality catalog UAT + 34-rule MSG-* drift-guard plugin; v1.3 user-contract structurally enforced |
| v1.12 | 1804 + 10 int | Config/state split architecture-tested; two-process reconcile race coverage; 5 review criticals fixed pre-ship |

### Top Lessons (Verified Across Milestones)

1. **Spec-then-refactor beats refactor-and-spec.** v1.3 Phase 12 (foundations) before Phase 13 (refactor) mirrored v1.0 Phase 2 (primitives) before Phases 3-7 (consumers). The "load-bearing primitive lands first" pattern has now shipped across 4 milestones.
2. **Atomic transaction boundaries are non-negotiable.** v1.1's `withLockedStateTransaction` and v1.3's `c4d87d4` supersession commit both ship as single atomic units. Any cross-file user-contract change that can't fit in one commit is a design smell.
3. **Discriminated unions catch design errors at the type level.** NFR-7's `installable: true | false` (v1.0), `failureClass: "manual-recovery" | "rollback-partial" | ...` (v1.3), and `PluginCascadeRow.declaresAgents/Mcp` (v1.3) all use the same pattern: a closed set discriminant where consumers can't read forbidden fields without narrowing.
