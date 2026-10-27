---
phase: 04-dependency-resolver-residue
verified: 2026-10-27T06:00:00Z
status: passed
score: 4/4 roadmap success criteria verified (RSV-01..05 and D-PL4-01..07 all satisfied)
covered_files:
  - ".planning/phases/04-dependency-resolver-residue/04-01-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-01-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-02-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-02-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-03-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-03-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-04-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-04-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-05-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-05-SUMMARY.md"
  - ".planning/phases/04-dependency-resolver-residue/04-06-PLAN.md"
  - ".planning/phases/04-dependency-resolver-residue/04-06-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/agents/target-check.ts"
  - "extensions/pi-claude-marketplace/domain/release-tag.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts"
  - "test/bridges/agents/target-check.test.ts"
covered_digest: "v4:sha256:2dab8364f5cf57f5832fcbf3a30b6f022f700f5580bdec27c1b81a79232ed0a3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: Dependency Resolver Residue Verification Report

**Phase Goal:** The dependency resolver installs the commit it previewed, refuses before any move lands, and its completeness and `apply` behavior are decided against Claude Code.
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** Yes, after review-note commit `0cd991ce` (no gaps in the prior report; regression pass)

Verified against the code and tests at HEAD `0cd991ce` (phase commits `2829db68..HEAD`). The first pass covered HEAD `9ab65cab`. `npm run check` was not run by this pass; it ran separately on the combined tree.

### Re-verification delta (`0cd991ce` and doc edits)

- `test/bridges/agents/target-check.test.ts`: one new case, "D-PL4-04: refuses an occupied target behind a free one". It places a user file at the second generated name's target and expects the check to refuse with the commit's own message. `node --test test/bridges/agents/target-check.test.ts`: 6 pass, 0 fail. It exercises the loop over `generatedNames` in `target-check.ts`, which was previously proven only with a single name. No source behavior changed; truth 3 and D-PL4-04 still hold.
- `install-flow.ts` and `update-swap.ts`: doc comments only (the diff touches comment lines only). The `rollbackPartials` comment now says `apply` does not render them yet (LCORCH-01); `grep rollbackPartials orchestrators/reconcile/` finds no renderer, and LCORCH-01 is a backlog carrier in ROADMAP, so the claim is accurate. The `assertNamesFree` comment matches the callers described in truth 3. Truth 4 (RSV-05, D-PL4-06) is unchanged: the field is still declared and the REC-06 test still asserts it.
- `04-CONTEXT.md` (D-PL4-07 scope note: only the move refusal is redacted) matches `dependency-plan.ts::unmovable` as verified for truth D-PL4-07. `04-06-SUMMARY.md` gains a backlog proposal (one rule, two copies in `target-check.ts` and `stage.ts`, no parity test); this is a non-blocking note below, not a success-criterion gap.
- `git diff HEAD -- extensions test` is empty, so the verified tree is the committed one.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | A fresh unpinned git dependency resolves once over the network and installs the previewed commit (RSV-01) | VERIFIED | `previewInstall` now returns `preflight.resolvedSha` (`install-outcome.ts:886`). `dependency-plan.ts` keeps a per-key commit map (`previewFresh`) and sets `previewedCommit` on each scheduled install member via `withPreviewedCommit`, and sets the root's from `options.rootCommit`. `install-flow.ts::memberLedgerPin` (used by both `dependencyLedgerOptions` and the inline builder in `installPluginWithTransaction`) gives a release-tag pin first, else `{ sourcePin: previewedCommit }`, which `buildInstallLedgerOptions` maps to `sourcePinOverride` (line 445). `planInstallMoves` passes the root preview's commit as `rootCommit`. Behavioral proof: scenario "Installing a plugin whose installed dependency moves fetches the repository of its new git dependency once" passes (4/4 targeted scenarios green) and asserts the git host receives exactly one `info/refs` and one `git-upload-pack` for `util`. Counter-check in a throwaway worktree with `install-flow.ts` reverted to `001e164d` (before the pin): the same scenario fails with the second fetch pair in the request log. |
| 2 | RSV-02 and RSV-03 each have a recorded decision, and the code and tests match it | VERIFIED | D-PL4-02 (keep the refusal under `apply`) and D-PL4-03 (record the greedy search limit, no complete solver) are in `04-CONTEXT.md` with the Claude Code 2.1.310 evidence record. Code: `dependency-plan.ts` header paragraphs name both IDs; `dependencyInstallsFollow` doc in `install-flow.ts` states D-PL4-02. Tests: `dependency-plan.test.ts` "D-PL4-02: a deferring plan refuses a fresh dependency only a move reaches when its preview refuses" (line 412) and "D-PL4-03: refuses a graph only an untried pair of versions solves ..." (line 836). Both pass. No behavior changed for RSV-02, consistent with the decision. |
| 3 | An update whose agent target is occupied refuses before any earlier move lands (RSV-04) | VERIFIED | New write-free `bridges/agents/target-check.ts::assertAgentTargetsFree` (index plus `isOwnedAgentFile` ownership, same rule and same message as `assertAgentCommitTargets` without `force`), exported via the bridge barrel. `update-swap.ts::assertUpdateNamesFree` now runs names then agent targets; the swap itself uses the module-private names-only `assertNamesFree`, so reinstall's forced overwrite is unchanged (D-PL4-04). `previewInstall` also runs the check. Callers `judgeDependencyMove` and `settleUpdateDependencies` (WR-C) go through `assertUpdateNamesFree`. Behavioral proof: three scenarios (second dependency's new version; new fresh dependency before installed dependency moves; plain update before its missing dependency installs) pass and assert the installation record and the user's file are unchanged. Counter-check with `update-swap.ts` and `install-outcome.ts` reverted to `2829db68`: all 3 scenarios fail. |
| 4 | The `no-matching-tag` range and the `rollbackPartials` declaration are settled (RSV-05) | VERIFIED | `SelectedReleaseTag` and `DependencyTagProbeResult` no-match arms are `{ kind: "no-matching-tag" }`; `renderConstraintRange` import dropped from `release-tag.ts`; `install-cascade.ts::toMemberConstraintOutcome` parameter type updated. The failed arm of `InstallMissingDependencyOutcome` declares `rollbackPartials?: readonly RollbackPartial[]` with REC-06 doc; test "REC-06: a missing-dependency install whose own ledger cannot finish an undo reports the rollback partial" asserts the value reaches the outcome. Typecheck passed under `npm run check`. |

**Score:** 4/4 truths verified, 0 behavior-unverified.

### Decision Conformance (04-CONTEXT.md)

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-PL4-01 previewed commit installed | VERIFIED | See truth 1. The root of an install plan is covered too (Uncertain choice 1). Unit tests: dependency-plan "D-PL4-01" (lines 444, 514), install-flow "D-PL4-01" (lines 18505, 18528). The CONTEXT text says `sourcePinOverride`; code carries it as `sourcePin` through `buildInstallLedgerOptions` to `sourcePinOverride`. Same mechanism. |
| D-PL4-02 keep refusal under apply | VERIFIED | Documentation and pinning test only; no executable change. |
| D-PL4-03 record the limit | VERIFIED | Header and pinning test. |
| D-PL4-04 write-free agent check | VERIFIED | See truth 3; `target-check.test.ts` has 128 lines of unit cases. |
| D-PL4-05 drop unread `range` | VERIFIED | See truth 4. |
| D-PL4-06 declare `rollbackPartials` | VERIFIED | See truth 4. |
| D-PL4-07 redact move refusal paths | VERIFIED | `dependency-plan.ts::unmovable` sets `moveRefusal: redactAbsolutePaths(cause)`; test D-PL4-07 (line 559). The update-swap scenario cause chain shows only the file name for the install-root case, and the `{project dir}` placeholder in the other two scenarios. |

### Key Link Verification

| From | To | Status | Details |
| ---- | -- | ------ | ------- |
| `previewInstall` result | `planDependencyGraph` ports.preview -> `previewedCommit` on member | WIRED | `previewFresh` collects, `schedule` applies. |
| `planInstallMoves` | `rootCommit` option -> root member in `final` | WIRED | `install-flow.ts` around line 3625-3642. |
| `previewedCommit` | ledger options (`sourcePinOverride`) | WIRED | Both builders use `memberLedgerPin`; confirmed by the scenario's one-fetch outcome. |
| `assertAgentTargetsFree` | move judge, WR-C, install preview | WIRED | Through `assertUpdateNamesFree` and a direct call in `previewInstall`. |
| `assertAgentTargetsFree` | swap | INTENTIONALLY NOT WIRED | Swap keeps names-only plus commit-time `assertAgentCommitTargets` (RINST-01). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Four new scenarios | `npx cucumber-js --name 'fetches the repository of its new git dependency once' --name "would overwrite a user's agent file"` | 4 scenarios, 57 steps passed | PASS |
| Unit suites touched by the phase | `node --test` on target-check, dependency-plan, install-outcome, update-swap, release-tag, dependency-tag-probe | 390 pass, 0 fail | PASS |
| Scenarios fail without the fix | throwaway worktree, source reverted | RSV-01 scenario fails (double fetch); 3 RSV-04 scenarios fail | PASS |

The throwaway worktree was removed afterward. No repo files were modified by this verification other than this report.

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| RSV-01 | SATISFIED | Truth 1. |
| RSV-02 | SATISFIED | Truth 2, D-PL4-02. |
| RSV-03 | SATISFIED | Truth 2, D-PL4-03 (limit recorded with an ID). |
| RSV-04 | SATISFIED | Truth 3. |
| RSV-05 | SATISFIED | Truth 4. |

No orphaned requirements: REQUIREMENTS.md maps only RSV-01..05 to Phase 4, and all are claimed by plans.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` markers in the changed production files. No stub or hollow implementations found.

### Notes (non-blocking)

1. **Misleading reason on a plain-update agent refusal.** The scenario "Updating a plugin whose new version would overwrite a user's agent file ..." records the row reason `unreadable manifest`, which is `update-flow.ts::narrowErrnoFailReason`'s generic fallback for an untyped error. The cause chain names the right path, so the row is not wrong about the cause, but the reason label is not accurate. The same fallback applies to the existing PI-6 name refusal in WR-C, so this is not new to agent targets. 04-06-SUMMARY records it as a proposed backlog entry. It is not a phase success criterion.
2. **`apply`'s deferred dependencies still resolve twice.** A fresh dependency that only a moved dependency's new version needs, and that `apply`'s MISS-01 step installs later, keeps its own resolve. This is Uncertain choice 2 in CONTEXT, documented in the `dependencyInstallsFollow` doc. RSV-01's text and the roadmap criterion concern the plan's own install, which is covered.
3. **Workflow-target refusals and re-enabled members** still refuse in the swap or ledger. Both are listed under Deferred in CONTEXT and are outside RSV-04's text ("agent-target"). They have no carrier in ROADMAP phases 5-11 as far as this report checked, so the orchestrator may want to add them to BACKLOG.md as the CONTEXT proposes.
4. **Parity of two copies (review WR-03).** `target-check.ts` repeats the commit's target rule from `stage.ts::assertAgentCommitTargets` and no test runs one fixture through both. Recorded as a backlog proposal in 04-06-SUMMARY. Not a success-criterion gap.
5. **Bookkeeping:** `REQUIREMENTS.md` still shows RSV-01..05 as Pending and ROADMAP plan checkboxes for 04-01..04-06 are unticked. These are orchestrator updates at phase close, not code gaps.

### Human Verification Required

None.

### Gaps Summary

None. Every success criterion has code evidence and behavioral evidence that fails without the change.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
