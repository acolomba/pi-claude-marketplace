---
phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam
verified: 2026-09-14T00:00:00Z
status: passed
score: 10/10 must-haves verified
covered_files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-01-PLAN.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-01-SUMMARY.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-02-PLAN.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-02-SUMMARY.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-CONTEXT.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-PATTERNS.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-RESEARCH.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-REVIEW-FIX.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-REVIEW.md
  - .planning/phases/02-uninstall-data-disposition-and-the-uninstall-option-seam/02-VALIDATION.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
covered_digest: "v1:sha256:f97bf3ce62bd93ae186b49cbcff52fcaa431331ca453143bf78e15b4bd4805cc"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Uninstall data disposition and the uninstall option seam Verification Report

**Phase Goal:** `uninstall` stops destroying a plugin's data directory with no way to
opt out. `--keep-data` preserves it; without the flag the directory is still
deleted, still without a prompt, at both entry points. The phase also
establishes the seam this milestone's second uninstall flag will join: one
place where a per-invocation uninstall option is parsed, carried into
`uninstallPlugin()`, and defaulted for the caller that has no command line.

**Verified:** 2026-09-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `uninstall --keep-data <plugin>` removes artifacts/record, preserves data directory (DATA-01, SC-1) | ✓ VERIFIED | `orchestrators/plugin/uninstall.ts:503-516` skips `pluginDataDir` resolution and `rm` entirely when `keepData` is true; `runPostUninstallCleanup` only guards the data-specific path. Behavioral tests: `tests/orchestrators/plugin/uninstall.test.ts` (`DATA-01`/`D1` cases — full 68/68 pass), `tests/edge/handlers/plugin/uninstall.test.ts` (`DATA-01: keeps the seeded data bytes when the preservation flag appears ahead of the reference \| after the reference \| twice`, `DATA-01: preservation keeps the project-scope \| user-scope data...`) — all pass, run directly and observed green in this session. |
| 2 | `uninstall <plugin>` with no flag deletes the data directory, no prompt (DATA-02, SC-2) | ✓ VERIFIED | `opts.keepData ?? false` at `uninstall.ts:851` normalizes omission to deletion; no confirmation surface exists anywhere in the handler or orchestrator (no `readline`/prompt call in either file). Tests: `tests/edge/handlers/plugin/uninstall.test.ts` (`DATA-02: removes the project-scope record and its data...`, `DATA-02: removes the ${scope}-scope record and data alone when --scope <value> is supplied`), `tests/orchestrators/plugin/uninstall.test.ts` (disposition matrix `false\|undefined`) — run directly, pass. |
| 3 | Dropping a plugin from `claude-plugins.json` and reloading (reconcile) also deletes its data directory — same promptless-delete behavior (DATA-03, SC-3) | ✓ VERIFIED | `orchestrators/reconcile/apply.ts::applyPluginUninstalls` (line 342-393) calls `createNodeUninstallPlugin` and never sets `keepData` on the options bundle passed to it, so the operation's own `?? false` default applies — deletion, unconditionally, exactly as intended per D-02-04 (confirmed intentional, not a gap, per phase context). Directly ran `tests/orchestrators/reconcile/apply.test.ts#WR-06: a plugin whose declaration is deleted...` — the test seeds a real nested data file, asserts `dataExistsAfterFirst === false` after the first `applyReconcile` pass, and asserts second-pass silence (byte-identical tree). Test passed in this session. |
| 4 | `uninstall` documents `--keep-data` in usage/completions and rejects `--delete-data`/`-y` as unknown flags (SC-4) | ✓ VERIFIED | `edge/handlers/plugin/uninstall.ts:22-23` USAGE string includes `[--keep-data]`; `edge/flag-catalog.ts:93-98,162` declares `KEEP_DATA_FLAG_ENTRY` (`parse: true, complete: true`) in `CATALOG.uninstall`, consumed by `completionFlagEntries` (via `edge/completions/provider.ts:38,113`) and by `passThroughFlagNames("uninstall")` at the handler. `edge/handlers/shared.ts::extractLocalFlag`'s consuming mode rejects any `-`-prefixed token not in the accepted set (`isOptionToken`). Directly ran `tests/edge/handlers/plugin/uninstall.test.ts` — the parametrized rejection block ("consuming mode rejects ... before/after the reference") covers `--delete-data`, `-y`, `--yes`, `--prune`, `--keep-data=false`, `-`, and an unrelated long option, in both positions (12 cases, all pass) plus `tests/edge/flag-catalog.test.ts` (`completionFlagEntries` / `passThroughFlagNames` expectations) and `tests/architecture/flag-catalog-drift.test.ts` (`uninstall: ["--keep-data", "--local"]` pin) — all pass. |

**Score:** 4/4 roadmap success criteria verified; 6/6 PLAN-frontmatter D-02 decision truths (D-02-01 through D-02-06, folded below) also independently verified — see PLAN Must-Haves Cross-Check.

### PLAN Must-Haves Cross-Check (D-02-01..06, from 02-01/02-02-PLAN.md frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | D-02-01: preserves the existing success notification bytes and orchestrated outcome contract | ✓ VERIFIED | `buildUninstalledRow` (`uninstall.ts:587-601`) only adds `reasons: ["data kept"]` on the preserving branch; the deleting branch's row is byte-identical to the pre-phase shape. `docs/output-catalog.md` diff was additive-only (`git diff --stat` in 02-02-SUMMARY: `2 insertions, 0 deletions`), confirmed present at lines 785, 802-804 without altering existing success blocks. |
| 6 | D-02-03: `keepData: true` removes installed artifacts/record while preserving every byte in the data directory | ✓ VERIFIED | Same code path as truth #1; `tests/orchestrators/plugin/uninstall.test.ts` symlink/hygiene case proves preservation never resolves `pluginDataDir` at all. |
| 7 | D-02-05: the consuming scanner rejects unsupported short/long options; existing pass-through callers keep their contract | ✓ VERIFIED | `edge/handlers/shared.ts::extractLocalFlag` — dual-overload design keeps the array-form (`isUnacceptedLongFlag`) and consuming-form (`isOptionToken`) rejection tests separate; `tests/edge/handlers/shared.test.ts` full suite passes (108/108 across all four owner files run together). |
| 8 | D-02-06: cleanup uses only the already-resolved scope; retained data is not enrolled in a new collection process | ✓ VERIFIED | `runPostUninstallCleanup` takes `locations: ScopedLocations` already bound to one scope; no cross-scope search exists in `uninstall.ts`. `tests/orchestrators/plugin/uninstall.test.ts` scope-isolation cases (a sibling-scope sentinel untouched) pass. |
| 9 | Data preservation leaves completion-cache invalidation, hook-route removal, and unused clone collection active | ✓ VERIFIED | `runPostUninstallCleanup` (`uninstall.ts:480-523`) runs `completionCache.dropMarketplaceCache`, the `if (!keepData)` data-only guard, and `garbageCollectPluginClones` unconditionally in that order; only the data `rm` is skipped. `dropCachedHooks` (called from the caller before `runPostCommitCleanup`) is unconditional too. Test: `tests/orchestrators/plugin/uninstall.test.ts` ("preservation bypasses the data path while retiring routes, caches and the last clone") — passed in the full-file run in this session. |
| 10 | D-02-02: catalog-derived completions offer `--keep-data` with a concise preservation description | ✓ VERIFIED | `KEEP_DATA_FLAG_ENTRY.description = "Preserve the plugin's persistent data directory"`; offered via `completionFlagEntries("uninstall")`, proven by `tests/edge/flag-catalog.test.ts` (`completionFlagEntries offers the uninstall preservation flag ahead of the scope target`). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | `UninstallPluginOptions.keepData` threaded to `runPostUninstallCleanup` | ✓ VERIFIED | Present, wired, exercised (line 141: field; line 455: cleanup option; line 851: `?? false` default). |
| `extensions/pi-claude-marketplace/edge/handlers/shared.ts` | `extractLocalFlag` consuming mode alongside pass-through mode | ✓ VERIFIED | Present, overloaded, wired; 108 tests pass across dependent owners. |
| `extensions/pi-claude-marketplace/edge/flag-catalog.ts` | `CATALOG.uninstall` preservation entry with parse/complete enabled | ✓ VERIFIED | `KEEP_DATA_FLAG_ENTRY` present, `KEEP_DATA_FLAG` exported and consumed at the handler mapping site. |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` | `makeUninstallHandler` consuming catalog-owned names, forwarding `keepData` | ✓ VERIFIED | `CONSUMED_FLAGS`, `KEEP_DATA_FLAG` mapping at line 60, `USAGE` updated. |
| `tests/orchestrators/plugin/uninstall.test.ts` | Real filesystem disposition/cleanup/failure assertions | ✓ VERIFIED | 68/68 tests pass (direct run, this session). |
| `tests/edge/handlers/shared.test.ts` | Direct extraction, scope-value, duplicate, rejected-token contracts | ✓ VERIFIED | Included in the 108/108 direct run. |
| `tests/orchestrators/reconcile/apply.test.ts` | `applyReconcile` removes non-empty data after a declaration is dropped | ✓ VERIFIED | 50/50 tests pass (direct run, this session); WR-06 case specifically re-run in isolation and passed. |
| `tests/edge/flag-catalog.test.ts` | Independent expected completion descriptions and accepted names | ✓ VERIFIED | Included in the 108/108 direct run. |
| `tests/architecture/flag-catalog-drift.test.ts` | Exact uninstall accepted-set pin `["--keep-data", "--local"]` | ✓ VERIFIED | Confirmed present at line 130 and 178; included in the 108/108 direct run. |
| `tests/edge/handlers/plugin/uninstall.test.ts` | Command-to-filesystem preservation, default deletion, rejection cases | ✓ VERIFIED | Included in the 108/108 direct run. |
| `docs/output-catalog.md` | Preservation/default policy beside existing uninstall contract | ✓ VERIFIED | Line 785 documents both dispositions and the reconcile default; line 144 documents the `{data kept}` row marker; existing success blocks untouched (additive diff only, per 02-02-SUMMARY). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `orchestrators/plugin/uninstall.ts` | `persistence/locations.ts` | `pluginDataDir` resolved only when `!keepData`, outside the removal-error catch | ✓ WIRED | Confirmed at lines 503-516: resolution and `rm` both inside the `if (!keepData)` block; `pluginDataDir` call sits outside the inner `try`, so a `PathContainmentError`/symlink refusal propagates (proven by `NFR-10: pluginDataDir containment failure PROPAGATES` test, re-run in isolation, passed). |
| `orchestrators/reconcile/apply.ts` | `orchestrators/plugin/uninstall.ts` | `applyPluginUninstalls` uses `createNodeUninstallPlugin` and omits `keepData` | ✓ WIRED | Confirmed at `apply.ts:66,347,350-358` — no `keepData` key in the options object literal. |
| `edge/handlers/plugin/uninstall.ts` | `edge/flag-catalog.ts` | `passThroughFlagNames("uninstall")` supplies `consumeLongFlags` | ✓ WIRED | Confirmed at `uninstall.ts:13,31`. |
| `edge/handlers/plugin/uninstall.ts` | `orchestrators/plugin/uninstall.ts` | Detected `--keep-data` forwards `keepData: true` | ✓ WIRED | Confirmed at `uninstall.ts:60` (`...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true })`). |
| `edge/completions/provider.ts` | `edge/flag-catalog.ts` | `flagCompletions` consumes `completionFlagEntries` | ✓ WIRED | Confirmed at `provider.ts:38,113`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full uninstall orchestrator owner suite | `node --test tests/orchestrators/plugin/uninstall.test.ts` | 68 tests, 68 pass, 0 fail | ✓ PASS |
| Full reconcile apply owner suite | `node --test tests/orchestrators/reconcile/apply.test.ts` | 50 tests, 50 pass, 0 fail | ✓ PASS |
| DATA-03 reconcile-dropped-declaration case in isolation | `node --test --test-name-pattern "declaration is deleted" tests/orchestrators/reconcile/apply.test.ts` | 1 test, 1 pass — asserts `dataExistsAfterFirst === false` | ✓ PASS |
| Handler + catalog + drift + scanner owners together | `node --test tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts tests/edge/handlers/shared.test.ts` | 108 tests, 108 pass, 0 fail — includes all 12 unknown-flag rejection cases (`--delete-data`, `-y`, `--yes`, `--prune`, `--keep-data=false`, `-`) in both positions | ✓ PASS |
| WR-07 symlink containment regression check | `node --test --test-name-pattern "NFR-10: pluginDataDir containment failure" tests/orchestrators/plugin/uninstall.test.ts` | 1 test, 1 pass — confirms containment failure propagates (matches pre-phase behavior per operator's WR-07 revert decision) | ✓ PASS |
| Typecheck | `npm run typecheck` | exit 0, no errors | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DATA-01 | 02-01, 02-02 | `uninstall --keep-data` preserves the plugin's data directory | ✓ SATISFIED | Truths #1, #6, #9, #10; REQUIREMENTS.md marks it Complete under Phase 2. |
| DATA-02 | 02-01, 02-02 | `uninstall` without `--keep-data` deletes data, no prompt | ✓ SATISFIED | Truth #2; REQUIREMENTS.md marks it Complete under Phase 2. |
| DATA-03 | 02-01, 02-02 | Reconcile-driven uninstall deletes data, matching the promptless default | ✓ SATISFIED | Truth #3; REQUIREMENTS.md marks it Complete under Phase 2. |

No orphaned requirements: `grep -n "Phase 2" .planning/REQUIREMENTS.md` returns exactly DATA-01, DATA-02, DATA-03, all Complete, matching the three IDs declared in both plans' `requirements:` frontmatter.

### Anti-Patterns Found

None. Scanned all five modified production files (`uninstall.ts` orchestrator, `uninstall.ts` handler, `flag-catalog.ts`, `shared.ts`, `reconcile/apply.ts`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` — zero matches. No stub return patterns, no hardcoded empty-array/object stand-ins for the new `keepData` surface.

### Human Verification Required

None. All four success criteria and all six D-02 decision truths resolve to deterministic, filesystem-observable behavior, and each is exercised by a real, currently-passing automated test run directly in this verification (not merely cited from SUMMARY.md). No visual, real-time, or external-service behavior is involved.

### Gaps Summary

No gaps. All roadmap success criteria (DATA-01, DATA-02, DATA-03, and the usage/completion/rejection criterion) and all PLAN-frontmatter must-haves (D-02-01 through D-02-06) are verified directly against the current codebase and a fresh, isolated test run — not inferred from SUMMARY.md claims.

Three items flagged during code review are deliberately out of this phase's must-haves and are not gaps against it:
- **CR-01** (reconcile deletes data promptlessly on every `/reload`) is DATA-03 working as specified (D-02-04), reaffirmed by the operator.
- **WR-04/WR-05** (`marketplace remove` / `reinstall` also hard-delete data; no removal path for `--keep-data`-retained data) were explicitly ruled out of scope for this phase (DATA-01..03 name `uninstall` only).
- **WR-07** (symlinked data directory causes an uncaught error on delete) was fixed then reverted by explicit operator decision to preserve pre-existing containment-propagation behavior (commit `eeeb80eb`); this verification confirmed the reverted state still throws on containment failure via a direct, isolated test run, so it is a preserved pre-phase behavior, not a regression.

---

*Verified: 2026-09-14*
*Verifier: Claude (gsd-verifier)*
