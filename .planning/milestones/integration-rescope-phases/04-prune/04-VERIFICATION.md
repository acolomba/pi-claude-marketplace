---
phase: 04-prune
verified: 2026-11-22T02:39:08Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/04-prune/04-01-PLAN.md
  - .planning/phases/04-prune/04-01-SUMMARY.md
  - .planning/phases/04-prune/04-02-PLAN.md
  - .planning/phases/04-prune/04-02-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - features/plugin/prune.feature
  - features/step_definitions/plugin/prune.steps.ts
  - test/integration/standalone-prune.test.ts
  - test/orchestrators/plugin/prune-rollback.test.ts
covered_digest: "v4:sha256:418a4a6ef7ced1f1c952d0bec38133ee319955e42779a99b0a00792344303561"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: Prune Verification Report

**Phase Goal:** Cucumber scenarios prove every `prune` behavior a user can see that the suite left out, and `standalone-prune` keeps only its internal cases.
**Verified:** 2026-11-22T02:39:08Z
**Status:** passed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

Truths 1 to 3 are the ROADMAP success criteria. Truths 4 and 5 restate the goal's second half and the plans' must-haves that the criteria do not already state.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: each remaining empty-scope variant of `prune` and `prune --dry-run`, with and without `--scope`, reports the empty scope and changes nothing. Both forms report a malformed state file without its path. The scenarios pass, fail under a break, and the cases they replace are gone. | VERIFIED | `prune.feature:300` E01 Outline, 7 rows (`prune`, `--scope user`, `--scope project`, `--dry-run`, and the three `--scope`/`--dry-run` orders). Each row checks `prune-empty`, `info`, `needs reload false`, and the scope, then `the files of the <scope> scope are unchanged`. `:327` M01 Outline, 4 rows, checks the `state.json at state.json` cause, `the command result contains no absolute sandbox path`, and unchanged files. Break map over the `8744eae` logs: every E01 row fails under at least one of K1, K13, K25 to K28, and every M01 row under K1, K3, K4, K13, or K27. No log holds a step timeout. The `:222-248` and `:702-764` loops are gone from `standalone-prune.test.ts`. |
| 2 | SC2: a prune keeps held neighbours across marketplaces, selects again after a stale preview, keeps a failed member's dependency until a retry removes both, previews with no project state and leaves both scopes as they were, and refuses without changing either scope when a declarer's manifest cannot be read. Same pass, red, and deletion conditions. | VERIFIED | A01 `:446` (alternating `alpha`/`beta` chain removed in preview order; the record keeps `disabled@alpha`, `held@beta`, `keeper@beta`, `paused@alpha`). S01 `:389`. F01 `:589` and F02 `:620` (a read-only skill directory, which a user can meet, as the ROADMAP note requires, in place of the tampered `../invalid` record). N02 `:527` (starts from an empty `.pi`, both scopes checked unchanged). U01 `:548` Outline, 4 rows, both scopes checked unchanged. Breaks: A01 fails under K8, K11, K12, K13, K19, K27. S01 under K1, K8, K19. F01 under K9, K13, K19. F02 under K9, K10, K13, K19. N02 under K14, K26, K27, and FIX04-W3. U01's rows under K15 (all four) and K24 (the dry-run rows). Their integration cases (`:417`, `:489`, `:533`, `:670`, `:802`) are gone. |
| 3 | SC3: `prune -y`, `--keep-data`, and `--prune` are refused with the prune usage line before any orphan is selected, and both scopes stay unchanged. Same pass, red, and deletion conditions. | VERIFIED | FL01 Outline `:357`, 5 rows (`-y`, `--keep-data`, `--prune`, `--bogus`, `lib@tools`). An orphan `lib` sits in each scope. Each row checks `usage-error` with `Usage: /claude:plugin prune [--scope user\|project] [--dry-run]` and both scopes unchanged. Rows fail under K5 (`-y`), K6 (`--keep-data`), K7 (`--prune`), K29 (all four flags), and K21 (`lib@tools`). The `:845-877` loop is gone. |
| 4 | `standalone-prune` keeps only internal cases. | VERIFIED | `test/integration/standalone-prune.test.ts` has 2 `test(` calls: the registered-command actual prune and the `--dry-run` preview. Each asserts `gitCalls.clone`/`fetch` are empty, and `registeredCommand` makes `applyReconcile` and `installMissingDependencies` throw. That is ITSCOPE-01's "calls that must not happen" class, and the preview also pins mtimes. The header names ITSCOPE-01 and the three feature files. A focused run gave `tests 2`, `pass 2`. |
| 5 | The rule-4 product bug the scenarios exposed is fixed, with a scenario that fails without the fix. | VERIFIED | `prune-rollback.ts:372-400` adds the private `grantBackupWrites` (`lstat`, no symlink follow) and `removeBackupRoot` (guarded by `pathExists`). All three removal points (`:480`, `:535`, `:545`) call it, and the snapshot path catches and logs a cleanup failure (`6d229d1`). There are still 4 exports. F03 `:645` with `the prune has left no backup in the {word} scope`: its natural red (`fix-red-adapter.log`, mtime 1795312396) predates the fix commit `d24f937` (1795312857). B1 fails F03 alone. A focused run of the unit pair gave `tests 56`, `pass 56`; it includes the read-only, absent-root, cleanup-failure, and symlink cases. |

**Score:** 5/5 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `features/plugin/prune.feature` | 13 new scenarios (12 from plan 01 plus F03), four Outlines | VERIFIED | 686 lines, 29 scenario headings. Adapter: 41 scenarios. No tag, no Background. |
| `features/step_definitions/plugin/prune.steps.ts` | the preview Given, the invalid-record Given, the repair Given, the empty-scope Given, and the no-backup Then | VERIFIED | 92 lines, five steps, every one used by a scenario (the static gate's `check:features` passed). |
| `test/integration/standalone-prune.test.ts` | the two call-absence carriers with an ITSCOPE-01 header | VERIFIED | 2 tests. `GraphPlugin`, `seedGraphScope`, `installedKeys`, and the `proper-lockfile` import are gone. |
| `extensions/.../orchestrators/plugin/prune-rollback.ts` | `async function removeBackupRoot` | VERIFIED | It is called at all three sites. The diff from `ee04e7e` adds lines and changes only the three call sites. |
| `test/orchestrators/plugin/prune-rollback.test.ts` | the read-only, absent-root, cleanup-failure, and symlink cases | VERIFIED | 56 of 56 pass. 100% direct coverage, per the orchestrator's gate on `cca81c1` and the fix report's pair run. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prune.feature` | `orchestrators/plugin/prune.ts` | default scope, fresh snapshot on the actual run, row order, redacted cause, `prune-empty` reports | WIRED | K1, K8, K12, K3, K25, and K26 each turn the named scenarios red (logs in `phase04-plan01/`). |
| `prune.feature` | `orchestrators/plugin/uninstall.ts` | `sweepOrphans` adds a key to `gone` only on a removal | WIRED | K9 fails F01 and F02, and K10 fails F02. |
| `prune.steps.ts` | `features/lib/pi-commands.ts` | the preview Given runs `runCommandPayloads` and compares through `pluginRowRecords`/`recordTable` | WIRED | Imports and calls are present. K12 and K8 fail at the preview Given or after it. |
| `standalone-prune.test.ts` | `edge/register.ts` | `registerClaudePluginCommand` with throwing seams and the git double | WIRED | Present, and both tests pass. |
| `prune.feature` F03 | `prune-rollback.ts` `discard` | `removeBackupRoot(ops, backupRoot)` | WIRED | B1 (plain `removeBackup` in `discard`) fails F03 alone. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| prune.feature green, adapter | `npm run test:cucumber:profile -- --profile adapter --parallel 2 features/plugin/prune.feature` (nondac prefix) | `41 scenarios (41 passed)`, `617 steps (617 passed)`, exit 0 | PASS |
| prune.feature, builtin | same with `--profile builtin` | `0 scenarios`, exit 0 (DUAL-02 / D-BG-04: no MCP surface) | PASS |
| integration carriers | `node --test test/integration/standalone-prune.test.ts` | `tests 2`, `pass 2`, `fail 0` | PASS |
| rollback unit pair under the non-DAC shell | `nondac-sh -c "node --test test/orchestrators/plugin/prune-rollback.test.ts"` | `tests 56`, `pass 56`, `fail 0` | PASS |
| red proofs | read 28 `K*-adapter.log` files plus B1, `fix-red`, FIX04-W3, and FIX04-I3 | every K log has `restored=clean` and 0 timeouts. K2 is the only `exit=0`, the accepted survivor. Every new row fails under at least one break. | PASS |

### Probe Execution

None declared. The phase PLAN and SUMMARY files name no probe.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ITMIG-08 | 04-01, 04-02 | the uncovered `prune` cases a user can see | SATISFIED | Each clause maps to a scenario: empty-scope variants (E01), malformed state (M01), held neighbours across marketplaces (A01), actual prune after a stale preview (S01), failed member kept until a retry (F01, F02), preview with no project state (N02), unreadable declarer manifest (U01), `-y`, `--keep-data`, and `--prune` (FL01), project-only prune (P01), dependent-first chain matching its preview (C01). Rule 1: adapter green, and builtin selects 0, which D-BG-04 allows. Rule 2: breaks recorded and reverted. Rule 3: 23 of 25 cases deleted. Rule 4: the backup leak fixed with F03. |

No orphaned requirements: REQUIREMENTS.md maps only ITMIG-08 to Phase 4. Its checkbox and traceability row still read Pending. Updating them is the orchestrator's post-verification step.

### Prohibitions (judgment tier, verdicts backed by evidence)

| Statement | Verdict | Evidence |
|-----------|---------|----------|
| No deliberate break staged, committed, or left in the tree | held | `git diff ee04e7e HEAD -- extensions/` shows only the fix in `prune-rollback.ts`. Every break log ends `restored=clean`. `git status --porcelain` is clean. |
| No break or scenario run in another checkout, no research file run | held (non-authoritative) | Every plan-01 log starts with `root=` at that plan's own worktree. Whether a research file was run cannot be checked; that rests on the executor's word. |
| No break recorded as detected on timeouts alone; no case deleted before its replacements went red | held | `grep -c 'timed out'` is 0 in every K log. Commit `17ee478` (the trim) follows the break logs on `8744eae`. |
| No change to an existing `prune.feature` line, `features/support/**`, `features/lib/**`, another step module, `cucumber.json`, `.fallowrc.json`, CI, or `extensions/` (plan 01) | held for the plans' commits | `git diff --stat ee04e7e HEAD` over those paths shows only `prune.steps.ts`. The review fix `640c9e1` (IN-03) later renamed the scenario at `:15` and added a second prune to it. This was an orchestrator-directed strengthening after both plans, and is recorded as Info below. |
| Fix not committed before F03 and the unit cases were red | held | Log mtimes 1795312396, 1795312513, and 1795312537 are all before the `d24f937` commit time 1795312857. |
| No symlink followed, no helper exported, no change to `PruneRestoreOps`, the restore functions, or `operations.ts` | held | `lstat` walk. The WR-02 case pins the outside directory at 0o555. Still 4 exports. The diff touches only the three call sites and the new helpers. |
| B1 not left in the tree; no edit to CHANGELOG (the line goes to the parent) | held | Tree clean. CHANGELOG has no phase change. The parent line is in STATE.md:1201. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all five changed files) | none | no TBD/FIXME/XXX/TODO/HACK | none | none |
| `test/integration/standalone-prune.test.ts` | 5-8 | The header says the cases prove prune "makes no git call", but they assert only `clone` and `fetch` (review IN-03, open) | Info | Overclaim in a comment. These are path-source plugins with no remote. Phase 8 (ITSCOPE-02, file headers) is the natural place to tighten it. |
| `features/plugin/prune.feature` | 15 | Existing scenario retitled and given a second `When` by review fix `640c9e1` | Info | A deliberate strengthening (lock release), proved red by FIX04-I3. Not a regression. |
| E01 / K2 | n/a | an actual prune that saves an unchanged record with the same bytes survives every scenario. The deleted cases compared mtimes. | Info | Accepted in CONTEXT [Same-bytes save]: a user sees no change. |
| `prune-rollback.ts` | 372-381 | `lstat`-then-`chmod` race (review IN-01, open by decision) | Info | Needs a concurrent writer under the held state lock. Optional hardening. |

### Human Verification Required

None.

### Gaps Summary

No gaps. The goal is in the code. Thirteen new scenarios (four Outlines, 20 rows) cover every clause of ITMIG-08. All 41 prune scenarios pass under the adapter profile, and the builtin profile selects none, as D-BG-04 allows. Every new scenario and row fails under at least one recorded, reverted break, and K2 is the one accepted survivor. `standalone-prune` keeps only its two call-absence carriers. The backup leak the failed-member scenario exposed is fixed, and F03 failed before the fix and fails under B1. The Info items do not block. The `fallow audit` `weakened-tests` warning on the trimmed file is accepted by the user's decision for the PR review.

---

_Verified: 2026-11-22T02:39:08Z_
_Verifier: Claude (gsd-verifier)_
