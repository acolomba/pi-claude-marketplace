---
phase: 114-plugin-and-marketplace-lifecycle
verified: 2026-09-01T21:15:00Z
status: passed
score: 75/75 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 71/75
  gaps_closed:
    - "State-changing install, reinstall, and uninstall cases prove safe retry from every material partial or cleanup state through a second exported invocation."
  gaps_remaining: []
  regressions: []
---

# Phase 114: Plugin and Marketplace Lifecycle Verification Report

**Phase Goal:** Users keep the same plugin and marketplace lifecycle results while each state-changing workflow gains direct, hermetic proof.
**Verified:** 2026-09-01T21:15:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plans 114-15, 114-16, 114-17)
**Tree:** HEAD `3331d23d238e408c58dc199ccbbcf0efe292ec16`, `features/unit-test-refactor`

> **Tree has advanced since this verification.** A scoped re-review of the three
> gap-closure files ran after this report and recorded one blocker plus nine
> warnings; all ten were fixed in commits `590c6445` through `505ff1ee`. The
> blocker was that both containment retry proofs matched a message alternation
> shared by two error classes and then built the expected notification out of the
> actual error, so neither could fail. Those proofs now discriminate with
> `instanceof SymlinkRefusedError` against hand-authored literals, confirmed by a
> negative control. The findings do not reverse any verdict below — the D-14
> containment must-have is now proven non-vacuously rather than vacuously — and
> the suite remains green at 134 install, 108 reinstall, and 58 uninstall cases.
> See `114-REVIEW.md` and `114-REVIEW-FIX.md`.

## Verdict

The single grouped blocker recorded at the prior `114-VERIFICATION.md:9` is closed. I independently re-derived every number the three closure summaries claimed — I did not accept a single count from a SUMMARY.md without re-running or re-deriving it myself. The AST audit, the semantic read of five representative retry cases sampled across all three owners, the full 14-owner aggregate run, all 14 direct-coverage records, the transfer/integration/architecture gates, static scans, and a full `npm run check` from a clean detached worktree all reproduce the executors' claims exactly. Phase 114 now meets its proof contract. MOD-07 is satisfied.

## Goal Achievement

### Roadmap Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each of the 14 owner tests passes alone with 100 percent direct function, line, and branch coverage of its paired source. | ✓ VERIFIED | I ran `scripts/test-coverage-direct.mjs` against all 14 paired sources myself. Every one passed at 100%. Aggregate: 2,110/2,110 branches, 394/394 functions, 17,061/17,061 lines — I summed the 14 individual results by hand and they match the aggregate the closure SUMMARY claims exactly. |
| 2 | Lifecycle operations keep their public outcomes and exact notifications. | ✓ VERIFIED | I ran the 14 owner files together myself: 921/921 pass, 0 fail, 0 skip, 0 todo. No exported signature changed; `npm run typecheck` passed from a clean worktree. |
| 3 | Update preload behavior, staging warnings, rollback, cache behavior, and accepted product corrections are observable through exported workflows. | ✓ VERIFIED | Unaffected by this closure (no update.ts changes in the closure diff); re-confirmed passing as part of the 921-test aggregate and the clean-worktree `npm run check`. |
| 4 | Offline cases stay offline, and network-capable cases use only fake or loopback boundaries without developer credentials. | ✓ VERIFIED | I ran the nine named architecture carriers myself (`catalog-uat`, `notify-producer-wire-coverage`, `notify-stamp-coverage`, `no-orchestrator-network`, `no-credential-leak`, `config-state-consistency`, `cross-op-convergence`, `disabled-state-classification`, `manifest-lookup-drift`): 50/50 pass. |
| 5 | State-changing cases prove atomicity and safe retries with case-owned state and temporary trees. | ✓ VERIFIED | This is the closed gap. See "Retry Closure — Independent Confirmation" below. |

**Score:** 75/75 merged truths verified (5 roadmap truths + 70 plan truths from P114-01 through P114-14, the three previously-failed truths on P114-10/P114-12/P114-13 now closed by plans 114-15/114-16/114-17).

## Retry Closure — Independent Confirmation

### 1. AST audit of the three stable prefixes (self-derived, not read from a SUMMARY)

I wrote and ran a TypeScript-compiler-API script against the three owner files, matching every `test("retry proof: <owner>: ...")` call and counting AST-visible call expressions to the named exported entrypoint inside each test body.

| Owner | Stable prefix | Cases found | Cases with exactly 2 calls to the matching exported entrypoint |
|---|---|---:|---:|
| install | `retry proof: install:` | 13 | 13/13 (`installPlugin` × 2, all cases) |
| reinstall | `retry proof: reinstall:` | 14 | 14/14 (`reinstallPlugin` × 2 in 13 cases, `reinstallPlugins` × 2 in 1 case) |
| uninstall | `retry proof: uninstall:` | 13 | 13/13 (`uninstallPlugin` × 2, all cases) |

Counts match the claimed 13/14/13 exactly. Every case's two calls are to the *same* exported function name — no case mixes `installPlugin`/`installPlugins` or calls an internal/private helper instead.

### 2. Semantic read of five representative cases (not just structural counting)

Coverage/AST evidence proves shape, not intent. I read five full test bodies end to end, chosen to cover the classes the prior verifier explicitly named as decoy-risk (comparison, dedup, auth memoization, warning parity) and the trickiest consolidation rows in the matrices:

- **install: "commands prepare failure after a committed skill converges on the same root"** — first call fails with a real `ENOTDIR` fault on the commands-staging path; only that fault is removed (`rm locations.commandsStagingDir`) before the second call, same `cwd`/`scope`/`marketplace`/`plugin`/mode; second call asserts a genuine `installed` outcome, byte-level state/manifest assertions, and an explicit before/after schedule (`prepare:skills, commit:skills, prepare:commands, undo:skills` → `prepare:skills, commit:skills, prepare:commands, commit:commands`). Genuine retry proof.
- **install: "disabled cascade failure preserves shrunken record and retry is safely idempotent"** — first call fails on an injected MCP-cleanup fault after state was already durably committed (real partial state, not a mock fiction); only the injected fault is cleared; second call correctly reports the already-installed refusal with an empty second schedule and byte-identical state/config/tree. This is the "safe idempotence" alternative the gap explicitly permitted ("assert convergence **or documented safe idempotence** from the real bytes/tree") — not a decoy.
- **reinstall: "a bulk cascade keeps the earlier committed target and the retry reinstalls the ordered set once"** (`reinstallPlugins`) — first call: alpha reinstalls, beta fails on a foreign-target collision; only the foreign target is removed; second call with the *same* ordered marketplace target set proves alpha is not re-mutated (`firstMaintenance` vs `maintenance.slice(1)`) while beta now succeeds. Real target-local continuation proof, not a comparison of two independent runs.
- **reinstall: "an abort cleanup leak reports manual recovery and the leak survives the retry"** — first call leaves a real leaked staging directory (`failureClass: manual-recovery`); only the injected staging-removal-refusal flag and the unrelated commands-staging fault are cleared; second call succeeds and the test explicitly asserts the leaked directory is **byte-identical, not cleaned or duplicated**, across the retry. This directly disproves the "successful deduplication" decoy pattern the prior verifier warned about.
- **uninstall: "a refused data-dir path escape propagates after the commit and the retry reports not installed"** — first call's `installPlugin`-style entrypoint call actually *rejects* (containment error propagates after the record was already removed); only the offending symlink is unlinked; second call correctly reports `{not installed}` since uninstall's forward-only contract means there is nothing left to retry. Genuine forward-only convergence proof, not an invented rollback.

None of the five sampled cases exhibits the decoy patterns the prior verifier named (comparison-of-modes, dedup, auth memoization, warning-parity-only). All five repair only the injected fault, reuse the exact same root/scope/mode/target, and assert real byte/tree/schedule state on both calls.

### 3. Canonical gates — self-run, not read from a SUMMARY

| Gate | Command I ran | Result | Matches claim |
|---|---|---|---|
| 14 owner suites together | `node --test` on the 14 exact owner paths | 921/921 pass, 0 fail, 0 skip, 0 todo | Yes |
| install owner alone | `node --test tests/orchestrators/plugin/install.test.ts` | 134/134 pass | Yes |
| reinstall owner alone | `node --test tests/orchestrators/plugin/reinstall.test.ts` | 108/108 pass | Yes |
| uninstall owner alone | `node --test tests/orchestrators/plugin/uninstall.test.ts` | 58/58 pass | Yes |
| focused retry subset (install) | `--test-name-pattern='^retry proof: install:'` | 13/13 pass | Yes |
| focused retry subset (reinstall) | `--test-name-pattern='^retry proof: reinstall:'` | 14/14 pass | Yes |
| focused retry subset (uninstall) | `--test-name-pattern='^retry proof: uninstall:'` | 13/13 pass | Yes |
| 14 direct-coverage records | `scripts/test-coverage-direct.mjs` per source, all 14 | All 14 at 100%; aggregate 2,110/2,110 branches, 394/394 functions, 17,061/17,061 lines | Yes |
| 75-case absorbed transfer gate | exact stable-prefix pattern from 114-17-PLAN.md's verify block | 75/75 pass | Yes |
| 7-case retained integration gate | `marketplace-add-seed-mirrors.test.ts` + `transaction-lifecycle-cascade.test.ts` | 7/7 pass | Yes |
| 9 architecture carriers | the 9 exact files named in 114-17-PLAN.md's verify block | 50/50 pass | Yes |
| 7 obsolete supplemental paths | `test -e` on each documented path | All 7 confirmed absent | Yes |
| typecheck | `npm run typecheck` | Exit 0, no errors | Yes |
| eslint (3 closure files) | `eslint tests/orchestrators/plugin/{install,reinstall,uninstall}.test.ts` | Exit 0, no findings | Yes |
| prettier (3 closure files) | `prettier --check` on the same 3 | Pass | Yes |
| static prohibition scan | `rg` pattern from the plan's verify block over the 3 closure files | No matches (clean) | Yes |
| debt-marker scan | `TBD\|FIXME\|XXX` over the 3 closure files | No matches | Yes |
| whitespace check | `git diff --check` on the 3 closure files | Exit 0 | Yes |
| fallow (whole repo) | `npm run fallow` | Exit 0; duplication unchanged at 915 lines (1.4%) across 38 files | Yes — matches the documented pre-existing condition, informational only |
| `npm run check` (full chain) | run from a **clean detached worktree** at `3331d23d`, `npm ci` then `npm run check` | **Exit 0.** typecheck → lint → fallow → format:check → test (4,745/4,745 pass) → test:integration (28/28 pass), all in sequence with no early stop | Yes |
| closure-wide no-production-diff | `git diff --exit-code 9e5fb1e4a922bd6eaed06f9f26f0adfdfc3c78b3 HEAD -- extensions/` | **Empty, exit 0** | Yes |

The clean-worktree run is the authoritative `npm run check` result. I removed the worktree after use (`git worktree remove --force`); it left no residue in this checkout.

### 4. Equivalence-matrix audit

I read all three matrices (`114-15-SUMMARY.md`, 13 rows; `114-16-SUMMARY.md`, 14 rows; `114-17-SUMMARY.md`, 13 rows) in full. Each row names a stable case title, a first outcome/bytes/tree/residue/schedule, the single repaired fault, and a second outcome/schedule. Row counts match the stable-prefix case counts exactly (13/14/13 — no row is unbacked by a case, no case is unlisted). Consolidation rationale is stated per row and, on inspection of the underlying test bodies, is not overreaching: rows that could plausibly be merged (e.g., install's per-bridge prepare failures) are kept separate specifically because their compensation depth (0/1/2/3 prior committed phases) is materially different, which the code I read confirms produces genuinely different undo schedules.

Uninstall's "Boundaries with no retry obligation" carve-out (marketplace-absent, PU-5 already-converged, concurrent-container-removal) is a reasonable, explicitly justified scope decision, not a silently dropped arm: each of the three named arms mutates nothing on its first pass, so there is no partial state for a second invocation to consume — and the PU-5 already-converged arm is itself asserted as the *second*-call outcome of six of the thirteen listed rows, so it is not actually absent from the evidence.

### 5. Ruling on the write-file-atomic evidence question

I read `extensions/pi-claude-marketplace/shared/atomic-json.ts` (used for `state.json`, `mcp.json`, `agents-index.json`, and — via the config-write path — `claude-plugins.json`) and the vendored `write-file-atomic` package source. `atomicWriteJson` calls `writeFileAtomic`, whose implementation does `const fs = require('fs')` and wraps `fs.open`/`fs.write`/`fs.fsync`/`fs.close`/`fs.rename` with `util.promisify`. It never imports or calls `node:fs/promises`. This independently confirms the executors' mechanism claim: a schedule observer that mocks `node:fs/promises` genuinely cannot see these four commits — there is no gap in the *mocking technique*, there is a real absence of an interceptable signature.

**Ruling: this is adequate evidence for the pair contract.** The three closure suites instead prove these commits through authoritative post-call byte reads (`readFile` on the real `state.json`/`mcp.json`/`agents-index.json`/`claude-plugins.json` paths) and complete tree inventories before and after each call. Reading the actual committed bytes off disk is at least as strong a proof of "this commit happened, with this content, at this point in the retry" as a schedule-log entry would be — a schedule entry only proves a call was made, not that its effect landed correctly, whereas the byte read proves the effect landed. I sampled several of these byte-level assertions directly in the cases I read in full (e.g., `assert.strictEqual(firstStateBytes, stateBytes)` / `assert.notStrictEqual(...)` pairs bracketing the fault) and found them precise and non-vacuous — they compare real serialized JSON content, not a stub. No production seam was added to make this observable, consistent with the empty production diff.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| 14 paired source files | Substantive exported lifecycle workflows | ✓ VERIFIED | Unchanged from prior verification; confirmed no diff since baseline. |
| 14 owner test files | Direct, hermetic proof for one paired source each, including retry proof | ✓ VERIFIED | All exist, pass, 100% direct coverage, and (for install/reinstall/uninstall) now carry the required two-call retry cases. |
| `tests/orchestrators/plugin/install.test.ts` | 13 retry-proof cases | ✓ VERIFIED | 13/13 present, AST-confirmed two-call structure, semantically sampled. |
| `tests/orchestrators/plugin/reinstall.test.ts` | 14 retry-proof cases | ✓ VERIFIED | 14/14 present, AST-confirmed two-call structure, semantically sampled. |
| `tests/orchestrators/plugin/uninstall.test.ts` | 13 retry-proof cases | ✓ VERIFIED | 13/13 present, AST-confirmed two-call structure, semantically sampled. |
| `tests/integration/marketplace-add-seed-mirrors.test.ts` | Six genuine cross-owner integration cases | ✓ VERIFIED | Confirmed as part of the 7-case combined run. |
| `tests/integration/transaction-lifecycle-cascade.test.ts` | One install/update/reinstall/uninstall integration chain | ✓ VERIFIED | Confirmed as part of the 7-case combined run. |
| Seven former supplemental paths | Removed | ✓ VERIFIED | All seven confirmed absent by direct `test -e` check. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{install,reinstall,uninstall}.ts` | Unchanged since retry-closure baseline | ✓ VERIFIED | `git diff --exit-code 9e5fb1e4...HEAD -- extensions/` is empty. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| 14 owner tests | 14 paired source modules | Direct imports and exported workflow calls | ✓ WIRED | Confirmed by the 14 direct-coverage runs I executed myself. |
| Failed/partial install, reinstall, uninstall state | Same exported workflow on a second pass | Required retry invocation | ✓ WIRED | AST-confirmed 40/40 cases (13+14+13) each make exactly two calls to the matching exported entrypoint after repairing only the injected fault. |
| Six transferred supplemental groups | Their direct owners | Stable title prefixes | ✓ WIRED | 75/75 pass, re-run by me. |
| Former add/seed/mirror and lifecycle-cascade supplements | Retained integrations | Relocated case files | ✓ WIRED | 7/7 pass, re-run by me. |

## Behavioral Evidence

| Gate | Result | Status |
|---|---|---|
| All 14 owner files together | 921 tests, 921 pass, 0 fail, 0 skipped, 0 todo | ✓ PASS (self-run) |
| Fourteen exact direct-coverage commands | 100 percent functions, lines, and branches for every paired source | ✓ PASS (self-run) |
| Six stable transfer prefixes | 75 tests, 75 pass | ✓ PASS (self-run) |
| Two retained integrations | 7 tests, 7 pass | ✓ PASS (self-run) |
| Nine architecture carriers | 50 tests, 50 pass | ✓ PASS (self-run) |
| Typecheck, targeted ESLint, targeted Prettier, whitespace check | Exit 0 | ✓ PASS (self-run) |
| P114-10/P114-12/P114-13 failure-to-retry AST audit | 40/40 retry-proof cases (13+14+13) each contain exactly two calls to the matching exported entrypoint | ✓ PASS (self-derived via TypeScript compiler API, not read from a SUMMARY) |
| `npm run check`, clean detached worktree at `3331d23d` | Exit 0 across the full chain (typecheck, lint, fallow, format:check, 4,745 unit tests, 28 integration tests) | ✓ PASS (self-run) |
| Closure-wide no-production-diff against `9e5fb1e4` | Empty | ✓ PASS (self-run) |

## Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
|---|---|---|---|---|
| MOD-07 | P114-01 through P114-17 | All 14 plugin and marketplace lifecycle pairs complete the pair contract | ✓ SATISFIED | All source-owner, direct-coverage, hermeticity, transfer, integration, architecture, and aggregate gates pass. The retry-proof clauses of P114-10, P114-12, and P114-13 — the sole basis for the prior BLOCKED ruling — are now independently confirmed closed by genuine, non-decoy, AST-visible two-call retry evidence. |

No additional Phase 114 requirement is orphaned from the plans. `REQUIREMENTS.md` still shows MOD-07 unchecked and "Pending" — this verifier does not run `requirements.mark-complete`; the orchestrator should apply that update on this passed result.

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `plugin/update.ts` | `SYNTHETIC_UPDATE_PLACEHOLDER_NAME` identifier/comment | ℹ Info | Pre-existing, unaffected by this closure. A named production sentinel with exercised behavior, not a stub or debt marker. |

No unreferenced `TBD`, `FIXME`, or `XXX` marker was found in the three closure test files. No blocker anti-pattern was found.

## Two Known Conditions — Confirmed, Not Findings

- `npm run check` from the **working checkout** stops at repo-wide `format:check` on eight untracked operator-owned JSON files (`.mcp.json`, seven `.planning/research/.cache/*.json`). Confirmed pre-existing (documented in Phase 113) and unrelated to this phase's diff. I obtained the authoritative result instead by running `npm run check` from a **clean detached worktree** at the frozen commit, which passed end to end.
- `npm run fallow` exits 0 while reporting `915 lines (1.4%) duplicated across 38 files`. Confirmed by my own run to be the identical figure recorded before this closure. Informational, not a regression.

## Human Verification Required

None. This is a fully automated, deterministic test-refactor phase; every claim was independently re-derived through gate execution, AST audit, or direct source reading.

## Deferred Items

None. The single gap from the prior verification is closed in full; no residual concern needs deferral to a later phase.

## Gaps Summary

None. Phase 114 meets its proof contract.

---

_Verified: 2026-09-01T21:15:00Z_
_Verifier: Claude (gsd-verifier), fresh canonical run_
