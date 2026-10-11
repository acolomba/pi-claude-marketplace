---
phase: 08-clear-milestone-debt
verified: 2026-10-10T09:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".fallowrc.json"
  - ".planning/codebase/CONVENTIONS.md"
  - ".planning/phases/01-pi-1-0-floor-and-adapter-only-detection/01-REVIEW-DISPOSITION.md"
  - ".planning/phases/02-adapter-file-delivery/02-REVIEW-DISPOSITION.md"
  - ".planning/phases/03-claude-code-tool-names-and-tool-search/03-REVIEW-DISPOSITION.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-REVIEW-DISPOSITION.md"
  - ".planning/phases/05-automatic-migration-on-reload/05-REVIEW-DISPOSITION.md"
  - ".planning/phases/06-live-mcp-status-in-info/06-REVIEW-DISPOSITION.md"
  - ".planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md"
  - ".planning/phases/08-clear-milestone-debt/08-01-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-01-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-02-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-02-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-03-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-03-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-04-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-04-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-05-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-05-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-06-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-06-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-07-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-07-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-08-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-08-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-09-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-09-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-10-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-10-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-11-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-11-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-12-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-12-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-13-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-13-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-14-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-14-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-15-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-15-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-16-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-16-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-17-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-17-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-18-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-18-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-19-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-19-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-20-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-20-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-21-PLAN.md"
  - ".planning/phases/08-clear-milestone-debt/08-21-SUMMARY.md"
  - ".planning/phases/08-clear-milestone-debt/08-REVIEW-DISPOSITION.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/unstage.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-server-features.ts"
  - "extensions/pi-claude-marketplace/domain/name.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts"
  - "extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/shared/own-key.ts"
  - "tests/integration/mcp-adapter-entry-conformance.test.ts"
  - "tests/integration/mcp-override-lifecycle.test.ts"
  - "tests/integration/reserved-record-keys.test.ts"
covered_digest: "v3:sha256:4f372511814482b1adca24599064e92aded7fdf544213cc3ffb2ac6c8c6e6ba4"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: none
---

# Phase 8: Clear milestone debt Verification Report

**Phase Goal:** The milestone closes with no carried debt: the pull request passes the fallow audit, every open review finding is fixed or closed with a recorded reason, the two MCP backlog items are settled, and the planning records match the code.
**Verified:** 2026-10-10
**Status:** passed (with record-drift warnings, listed below)
**Re-verification:** No, initial verification
**HEAD:** 6199bc53

## Goal Achievement

### Observable Truths (the five ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npx fallow audit --base <merge-base with origin/main>` reports `pass` (DEBT-01) | VERIFIED | Re-ran at HEAD 6199bc53 against merge-base 369eaec3: verdict `pass`, gate `audit-verdict` pass and enforced, dead_code 0, complexity 0, duplication_introduced 0, duplication_inherited 8. `.fallowrc.json` carries no `ignoredClones`. `rg fallow-ignore extensions tests scripts` gives 22 markers, each with a `--` reason, which matches CONVENTIONS.md (6+2+2+1+1+10). |
| 2 | Every review finding of Phases 1-7 reads fixed, wontfix with a reason, or already-fixed; none open, deferred or skipped (DEBT-02) | VERIFIED | All eight `0N-REVIEW-DISPOSITION.md` files read `open: 0`. Row ids equal the union of finding ids in each phase's REVIEW and REVIEW-FIX (compared by script; phase 3 has no REVIEW-FIX). Dispositions are only `fixed` (already-fixed rows cite 6cb09db2) or `wontfix`. All 10 wontfix or partial-wontfix rows carry a reason (P1 IN-10 harness, P2 WR-06, P3 WR-01 and WR-03, P4 IN-01, IN-03 and IN-04, P5 IN-04, P7 IN-06 sub-item). `07-REVIEW-DISPOSITION.md` exists. Every commit hash cited in the ledgers resolves with `git cat-file`; spot-checked subjects match the finding. Phase 8's own review (4 WR, 3 IN) is 7/7 fixed in 7 commits, ledger `open: 0`. |
| 3 | Per-server choices, now including `openUi` and `trace`, survive update, reinstall, disable then enable, and uninstall then reinstall (D-08-01, D-08-02; closes MCPOVR-01) (DEBT-03) | VERIFIED | `CARRIED_FIELDS` ends with `openUi`, `trace` (`bridges/mcp/adapter-entry.ts:55-56`). `bridges/mcp/adapter-doc.ts` implements `_piClaudeMarketplace.serverChoices` capture and consume as `{ plugin, marketplace, fields }` inside the one document that `stage.ts:552` and `unstage.ts:163` write atomically; unstage uses the store composer for `mcp-adapter.json` only. Ran `tests/integration/mcp-override-lifecycle.test.ts` (real install, disable, enable, uninstall, reinstall ops; hermetic): 12/12 pass, including the openUi uninstall/reinstall, trace disable/enable, update-that-drops-the-server, reinstall openUi+trace, and the two foreign-owner cases. |
| 4 | enable and import report success rows with MCP notices as separate warnings (D-08-03); OAuth beside non-Authorization headers (D-08-04); Phase 5 remedies work (D-08-05); explicit staging environment (D-08-06); own-key lookups (D-08-07) (DEBT-04) | VERIFIED | D-08-03: tests `execute.test.ts:2034` and `enable-disable.test.ts:7408` pin the adapter-loaded info row plus separate warnings; the catalog states it; MCPROW-01 is closed in BACKLOG. D-08-04: `authField` in `domain/mcp-server-features.ts:161-168` writes `auth: "oauth"` only without an Authorization key; `withOAuthDecision` in `adapter-entry.ts` drops it when a header value is empty or names an unset variable. `tests/integration/mcp-adapter-entry-conformance.test.ts` runs against real pi-mcp-adapter 5.2.0 (3/3 pass). D-08-05: `git-source-probe.ts` falls through to the recorded-sha clone only on an unreadable mirror HEAD; reinstall does the same; `mcp-migration.ts` emits `source-outdated` for `missing-subdir` and `marketplace-unreadable` for `escapes` (narrowing, see warning W4). 277/277 pass across migration, probe, adapter-doc, adapter-entry, own-key and notice-lock tests. D-08-06: no `process` environment read in `bridges/`; defaults sit only at entry points (`install-flow`, `enable-disable`, `update-flow`, `reinstall-flow`, `reconcile/mcp-migration`, `info`). D-08-07: `shared/own-key.ts` (`ownValue`, `setOwn`); `isReservedRecordKey` rejects only `__proto__` and is used by `plugin-resolver.ts:517` and `marketplace/add.ts:333`; no raw name-keyed bracket read remains in `extensions/` (only `delete` statements). `tests/integration/reserved-record-keys.test.ts`: 14/14 pass (constructor works through install, list, info, disable, enable, update, uninstall, import and reload; absent-name parity for every verb). |
| 5 | Planning records match the code: ROADMAP Phase 1 criterion 4, STATE ADET-02 wording, the ledgers (DEBT-05) | VERIFIED for the three named records; see W1-W4 for drift outside them | ROADMAP Phase 1 criterion 4 carries the D-04-12, D-07-07 and 261006-kr1 amendments, and `scripts/pi.sh` pins adapter 5.2.0, pi-subagents 0.74.0 and engine 3.14.0 as it says. STATE.md:658-659 say an extension command. Ledgers verified under truth 2. |

**Score:** 5/5 truths verified. No behavior-dependent truth was left unexercised: the lifecycle, own-key and conformance claims were each run through a real operation or the real adapter.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/own-key.ts` | own-key read and own-property write helpers | VERIFIED | substantive and wired (30 files use it per 08-15..18 summaries; reads confirmed by grep) |
| `bridges/mcp/adapter-doc.ts` | choice store capture, consume, ownership match | VERIFIED | read in full; no stub; wired from `stage.ts` and `unstage.ts` |
| `bridges/mcp/adapter-entry.ts` | `openUi` and `trace` carried; OAuth decision | VERIFIED | wired through `translatedEntry` |
| `domain/name.ts` `isReservedRecordKey` | `__proto__` rule | VERIFIED | two call sites, both before any state write |
| `07-REVIEW-DISPOSITION.md` | new ledger | VERIFIED | `open: 0`, 8 rows |
| BACKLOG MCPOVR-01, MCPROW-01 | closed with reason | VERIFIED | both struck through and CLOSED with commits that exist; ROOTKEY-01 recorded as a new open item |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `stage.ts` | `withPluginServersKeepingChoices`, `storedChoicesFor` | one `atomicWriteJson` of the adapter file (NFR-1) | WIRED |
| `unstage.ts` | store composer for `mcp-adapter.json` only | `target.file` choice; legacy `mcp.json` uses `withPluginServers` | WIRED |
| entry points | `prepareStageMcpServers` | explicit `ClaudeEnv` argument | WIRED |
| `plugin-resolver.ts`, `marketplace/add.ts` | `isReservedRecordKey` | before state mutation | WIRED |

### Behavioral Spot-Checks (TMPDIR=/var/tmp/mcp4-p8/ver, hermetic homes, adapter 5.2.0 via PI_MCP_ADAPTER_ROOT)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Choices survive the plugin lifecycle | `node --test tests/integration/mcp-override-lifecycle.test.ts` | 12 pass, 0 fail | PASS |
| Reserved and inherited names | `node --test tests/integration/reserved-record-keys.test.ts` | 14 pass, 0 fail | PASS |
| Adapter reads our entries and the store member | `node --test tests/integration/mcp-adapter-entry-conformance.test.ts` | 3 pass, 0 skip | PASS |
| Migration, probe, doc, entry, own-key, notice lock | seven unit and architecture files | 277 pass, 0 fail | PASS |
| fallow audit | `npx fallow audit --base $(git merge-base origin/main HEAD) --format json` | verdict pass | PASS |
| Full gate | orchestrator's `npm run check` log, mtime after the last code commit 49345f38; not re-run | CHECK_EXIT=0 | ACCEPTED |

### Probe Execution

Step 7c: no `probe-*.sh` declared by any Phase 8 plan. SKIPPED.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| DEBT-01 | 08-01, 08-06, 08-15, 08-21 | SATISFIED | truth 1 |
| DEBT-02 | 08-01..08-08, 08-10, 08-11, 08-13, 08-14, 08-16, 08-18, 08-20, 08-21 | SATISFIED | truth 2 |
| DEBT-03 | 08-03, 08-10, 08-14 | SATISFIED | truth 3 |
| DEBT-04 | 08-02, 08-04, 08-08..08-19 | SATISFIED | truth 4 |
| DEBT-05 | 08-21 | SATISFIED | truth 5 |

All five IDs appear in plan frontmatter and map to Phase 8 as Complete in REQUIREMENTS.md. No orphans. Only 08-21's SUMMARY lists `requirements-completed`; the other 20 carry `[]`, a bookkeeping gap with no effect on coverage.

### Anti-Patterns Found

No TBD, FIXME or XXX markers introduced without a reference were found in the examined files. No stubs. The "Legacy marketplace migration could not be persisted" lines in the check log (5 per run of `list-flow` and `info` tests) also appear on `origin/main` (reproduced from a `git archive` of main: 5), so they are not caused by this phase.

### Warnings: record drift (not blockers)

These records disagree with code after the post-08-21 review fixes. Each is a one-line edit.

- **W1.** `.planning/STATE.md:741` says a stored choice is `{ plugin, fields }`. Code and docs are `{ plugin, marketplace, fields }` (WR-02, 28a1bf0c).
- **W2.** `.planning/BACKLOG.md` MCPOVR-01 closing paragraph says the store is "recorded with the plugin name". It now records the plugin name and marketplace.
- **W3.** `05-REVIEW-DISPOSITION.md` IN-07 Source cell says the catalog remedy is "remove and add the marketplace again, or uninstall". The catalog row now leads with `uninstall` and offers `marketplace update` when the copy is out of date (IN-03, 49345f38). Also, the Source cells of `02-REVIEW-DISPOSITION.md` (WR-03, WR-04, WR-05, WR-07, CR-01) and `05-REVIEW-DISPOSITION.md` (WR-04) name `*-REVIEW-FIX.iter2.md` files that do not exist in those phase directories (the current `02-REVIEW-FIX.md` is iteration 2, and `05-REVIEW-FIX.md` is also iteration 2). The status values are right; the pointers dangle.
- **W4.** `08-CONTEXT.md` D-08-05 names `escapes` as a `source-outdated` case, and `08-02-SUMMARY.md` repeats it. WR-04 (9003e476) routes `escapes` to `marketplace-unreadable`. The narrowing is recorded only in `08-REVIEW-FIX.md`; no amendment note sits in CONTEXT or the SUMMARY (the review-fix run was told not to edit CONTEXT).

### Known recorded items (not gaps)

- **ROOTKEY-01** is open in BACKLOG with a carrier, evidence and a pinned case (`tests/integration/reserved-record-keys.test.ts`): `install __proto__@<mp>` and other root names outside the token alphabet get a misleading dependency cause. The refusal is correct and no record is dropped. It is new debt found in this phase and carried, not cleared; D-08-07 itself holds.
- Commit `8578407a` lacks the attribution trailers; recorded in 08-20-SUMMARY and cannot be amended under the no-rewrite rule.

### Human Verification Required

None. Every success criterion was proven by a command or by reading code, and the adapter-dependent claims ran against a real pi-mcp-adapter 5.2.0.

### Gaps Summary

No gaps. The phase goal is achieved: the audit passes at HEAD, all ledgers are closed with real commits and reasons, both MCP backlog items are closed with working behavior and tests, own-key lookups hold end to end, and the three named records match the code. Four record-drift warnings (W1-W4) remain and should be fixed before the milestone close, because the goal wording says the planning records match the code. ROOTKEY-01 stays as recorded backlog debt.

---

_Verified: 2026-10-10_
_Verifier: Claude (gsd-verifier)_

## Record warnings resolved (orchestrator, 2026-10-10)

The four record warnings above were fixed after this report was written, and
the covered digest was recomputed over the same 67 files:

- W1: `STATE.md` now says a stored choice is `{ plugin, marketplace, fields }`.
- W2: the MCPOVR-01 closing note in `BACKLOG.md` names the plugin and the marketplace.
- W3: the 05 ledger IN-07 row names the current remedy (49345f38); the 02 and
  05 rows that pointed at never-committed `*-REVIEW-FIX.iter2.md` files now
  cite their fix commits (02: e6cd1997, 13958368, 883ddd21, b47972fb and
  f692a2c7; 05: 7a7d9783).
- W4: `08-CONTEXT.md` D-08-05 and `08-02-SUMMARY.md` carry the WR-04 amendment.
