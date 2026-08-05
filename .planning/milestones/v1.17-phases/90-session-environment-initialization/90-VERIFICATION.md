---
phase: 90-session-environment-initialization
verified: 2026-08-04T13:30:00Z
status: passed
score: 20/20 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "gaps_found"
  previous_score: 19/20
  gaps_closed:
    - "SURF-01 cross-surface reason divergence (WR-01 Option 2): install's `narrowResolverReasons` is now arm-aware (`partialable` discriminant, `err.shape.partialable`) — a `contains <non-carve-out-kind>` note on the structural `unavailable` arm renders `{unsupported source}` byte-identically with list/info (via `narrowResolverNotes`'s catch-all); the same note on the partially-available arm still routes through `narrowUnsupportedKinds` -> `{unsupported component}`, unchanged. `shared/probe-classifiers.ts` untouched (prohibition honored). New parity pins: `PARITY_CASES` row `{ contains monitors -> unsupported source }` and a both-defects structural test asserting byte-identical `[\"malformed mcp\", \"unsupported source\"]` across `narrowResolverNotes` and `__test_narrowResolverReasons(..., [], false)`. `node --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — 20/20 pass (re-run this verification pass)."
    - "G-90-3 live-Pi retest (human verification): performed and approved this session. 90-UAT.md Test 3 updated `issue -> pass` (3/3 total); gap `resolved`; debug session moved to `.planning/debug/resolved/bin-unsupported-classification.md` with a Resolution section. All three behaviors confirmed live: bin-only plugin installs by default (no `--partial`, no `(partially-available)` row); non-carve-out kind renders `{unsupported component}` on install/list/info; both-defects case renders byte-identical `{unsupported source}` across surfaces."
  gaps_remaining: []
  regressions: []
---

# Phase 90: Session environment initialization Verification Report

**Phase Goal:** A skill or command script launched through Pi's bash tool sees the Claude Code session environment variables exactly as under Claude Code — the extension sets `CLAUDECODE=1`, `CLAUDE_CODE_SESSION_ID=<Pi session id>`, and the pi-only `CLAUDE_SESSION_ID` alias on Pi's live `process.env` at session start, and appends each installed enabled plugin's `<pluginRoot>/bin` to `process.env.PATH` (PENV-01). The session-id value tracks the active session (fresh after switch/reload).

**Verified:** 2026-08-04
**Status:** passed
**Re-verification:** Yes — after gap-closure plan 90-03 (SURF-01 classifier fix + G-90-3 live-Pi retest)

## Goal Achievement

### Observable Truths

Truths #1-16 and #18-20 were VERIFIED in the prior round (2026-08-04T00:00:00Z, unchanged by 90-03 — 90-03 touches only `install.ts`'s reason classifier and its own test file, confirmed by `git diff --stat 333f30e6~1 e8b15073` showing zero changes to `shared/session-env.ts`, `orchestrators/plugin-path.ts`, `domain/resolver.ts`, or `shared/probe-classifiers.ts`). Re-checked this round for regression; all still green. Truth #17 (SURF-01) — the sole prior FAILED item — is re-verified below along with the six 90-03-PLAN edge-coverage truths and the human-verification closure.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Bash child sees `CLAUDECODE=1` whenever loaded (SENV-01) | VERIFIED | `shared/session-env.ts` unchanged since prior round; `node --test tests/shared/session-env.test.ts` re-run this pass — pass. |
| 2 | Bash child sees `CLAUDE_CODE_SESSION_ID` = `ctx.sessionManager.getSessionId()`, refreshed every `session_start` (SENV-02) | VERIFIED | Same module/wiring, unchanged. |
| 3 | `CLAUDE_SESSION_ID` = same value (SENV-03 pi-only shim) | VERIFIED | Same module, unchanged. |
| 4 | Non-interference: exactly the three named keys are touched | VERIFIED | Unchanged; test re-run this pass — pass. |
| 5 | Distinct keys never merge/collide | VERIFIED | Unchanged; test re-run this pass — pass. |
| 6 | Empty `getSessionId()` assigned verbatim without throwing (backstop) | VERIFIED | Unchanged; test re-run this pass — pass. |
| 7 | Fixed statement order; order-independent (distinct keys) | VERIFIED | Static, unchanged. |
| 8 | Each enabled plugin's `<resolvedSource>/bin` (both scopes) on PATH, appended not prepended, added even if absent (PENV-01) | VERIFIED | `orchestrators/plugin-path.ts` unchanged since prior round; git diff confirms zero delta. |
| 9 | Deterministic order (user before project, stable within scope); byte-identical on repeat | VERIFIED | Unchanged. |
| 10 | Duplicate bin dirs deduplicated; repeated recompute idempotent | VERIFIED | Unchanged. |
| 11 | Zero enabled plugins empties the ledger; single plugin appends exactly one entry | VERIFIED | Unchanged. |
| 12 | Reload-durable ledger cleanup: recompute removes exactly its own prior entries, no stale leak (D-90-01) | VERIFIED | Unchanged. |
| 13 | Malformed `state.json` swallowed + debug-logged; `resources_discover` returns normally (NFR-2 backstop) | VERIFIED | Unchanged. |
| 14 | A bin-only plugin resolves `installable` and installs by default; no `--partial` required (D-90-06, closes G-90-3 half A) | VERIFIED | `domain/resolver.ts` unchanged since prior round (git diff confirms). Resolver tests pass. |
| 15 | A plugin declaring `bin` via entry/manifest field also resolves installable with no `contains bin` note | VERIFIED | Unchanged. |
| 16 | A dropped non-carve-out unsupported kind renders `{unsupported component}` on the partially-available/upgradable/installed arms, byte-identical across list/info/install (D-90-05) | VERIFIED | `shared/notify.ts`/`notify-reasons.ts`/`shared/probe-classifiers.ts` unchanged since prior round; per-kind parity cases re-run this pass — pass. |
| 17 | The `{unsupported component}` / `{unsupported source}` reason is byte-identical across install-failure, list, and info surfaces for the same plugin, on BOTH the partially-available arm (per-kind marker) AND the structural `unavailable` arm carrying a `contains <non-carve-out-kind>` note (SURF-01, closed by 90-03) | **VERIFIED** | Code read of `install.ts::narrowResolverReasons` (lines ~2254-2311) confirms an arm-aware `partialable` parameter: `contains <kind>` routes through `narrowUnsupportedKinds` only when `partialable === true`; on `partialable === false` it pushes `"unsupported source"`, mirroring `classifyResolverNote`'s catch-all. Call site `install.ts:2142-2145` passes `err.shape.partialable` (sourced from `resolver.ts:1494`: `partialable: r.state === "partially-available"`). `git diff --stat 333f30e6~1 e8b15073 -- .../shared/probe-classifiers.ts` — empty (untouched, prohibition honored). `node --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — **20/20 pass** (re-run this verification pass, not trusted from SUMMARY): includes the new `PARITY_CASES` row `{ contains monitors -> unsupported source }` (grep-confirmed at line 47) and the both-defects structural test (byte-identical `["malformed mcp", "unsupported source"]` across `narrowResolverNotes` and `__test_narrowResolverReasons(..., [], false)`, lines ~88-98). |
| 18 | Carve-outs unchanged: `lspServers`->`{lsp}`, `hooks`->`{unsupported hooks}`; source/note-axis fallback still `{unsupported source}` | VERIFIED | `manifestFieldTokenFromNote` (lspServers carve-out) left unmodified per code read; hooks-note prefix set unchanged; regression tests in the re-run suite (`PARITY_CASES` non-monitors rows, `hooks`-only, empty-input fallback) all pass. |
| 19 | `REASONS` grows by exactly one member (`unsupported component`); closed-set length lock reflects 38; no new token minted by the SURF-01 fix | VERIFIED | `tests/architecture/notify-closed-set-locks.test.ts` asserts `REASONS.length === 38` (line 37); re-run this pass — pass. 90-03 introduces no new REASONS member — confirmed by code read (only routes existing `"unsupported source"` / `"unsupported component"` tokens). |
| 20 | `docs/output-catalog.md` and the PRD describe `bin` as runtime-honored (PENV-01) and the partially-* reason vocabulary as `{unsupported component}`; vocabulary-guard presence checks stay green | VERIFIED | Unchanged since prior round (90-03 touches no docs); `tests/architecture/partial-vocabulary-guard.test.ts` re-run this pass — pass. |

**Score:** 20/20 truths verified (0 present-but-behavior-unverified, 0 failed)

### Plan 90-03 must_haves — Additional Truths (edge-coverage fallback, citing already-verified 90-01 criteria)

| # | Truth (90-03-PLAN.md `must_haves.truths`) | Status | Evidence |
|---|---|---|---|
| A | The partially-available arm's per-kind `{unsupported component}` marker is unchanged and still byte-identical across install/list/info, sourced via `narrowUnsupportedKinds` (D-90-05) | VERIFIED | `PER_KIND_PARITY_CASES` (arm-threaded with `true`) re-run this pass — pass; unchanged expected outputs (`lsp` / `unsupported component`). |
| B | `shared/probe-classifiers.ts` is not modified | VERIFIED | `git diff --stat 333f30e6~1 e8b15073 -- extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — empty output. |
| C | The closed `REASONS` set is unchanged — no new token minted; length lock stays 38 | VERIFIED | See truth #19 above. |
| D | `node --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` exits 0 with a new note-axis parity case | VERIFIED | Re-run this pass, exit 0, 20/20. |
| E | SENV-03 adjacency/empty/ordering (3 sub-truths, cite tests/shared/session-env.test.ts) — VERIFIED 90-01, unchanged | VERIFIED | `session-env.ts` untouched by 90-03 (git diff empty); named tests (`applySessionEnv: touches exactly the three named keys...`, `empty input assigns empty string verbatim...`) confirmed present by grep and pass in the targeted re-run. |
| F | PENV-01 adjacency/empty/ordering (3 sub-truths, cite tests/shared/plugin-path.test.ts) — VERIFIED 90-01, unchanged | VERIFIED | `plugin-path.ts` untouched by 90-03 (git diff empty); named test (`applyPathLedger: dedupes a fresh dir already present and is idempotent`) confirmed present by grep. |

### Plan 90-03 must_haves — Prohibitions

| # | Prohibition | Verification | Result |
|---|---|---|---|
| 1 | MUST NOT modify `shared/probe-classifiers.ts` | test | VERIFIED — `git diff --stat` empty for this file across the 90-03 commit range. |
| 2 | MUST NOT mint a new closed-set REASONS token (length lock stays 38) | test | VERIFIED — `notify-closed-set-locks.test.ts` re-run, `REASONS.length === 38` passes. |
| 3 | MUST NOT route a `contains <kind>` note through `narrowUnsupportedKinds` on the structural `unavailable` arm | test | VERIFIED — code read confirms the `partialable` branch gate; `partialable === false` pushes `"unsupported source"` directly, never calling `narrowUnsupportedKinds`. |
| 4 | MUST NOT alter PENV-01 runtime PATH injection or any SENV session-env behavior | test | VERIFIED — `git diff --stat` empty for `session-env.ts` and `plugin-path.ts` across the 90-03 commit range. |
| 5 | MUST NOT record GSD phase/plan/wave/milestone narrative in comments; decision/finding/requirement IDs only | judgment | VERIFIED — `git diff` of the 90-03 changed files grepped for phase/plan/wave/milestone/bare-Pitfall-N patterns: zero hits. New comments use `SURF-01 / WR-01 / D-64-07` anchors only. |

None of the five prohibitions remain `flagged-unverified` (their status in 90-03-PLAN.md frontmatter) — all five are now resolved with direct evidence, none silently absorbed into a passing verdict.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | Arm-aware `narrowResolverReasons` (`partialable` parameter) | VERIFIED | Present, wired at the single production call site (`install.ts:2142-2146`, `err.shape.partialable` passed as 3rd arg); test re-export `__test_narrowResolverReasons` present and imported by the parity test. |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | New note-axis unavailable-arm parity pin + arm-threaded per-kind/multi-kind cases | VERIFIED | `PARITY_CASES` `contains monitors` row (line 47), both-defects structural test (lines ~88-98), `PER_KIND_PARITY_CASES` threaded with the arm discriminant (line 118, `true` argument at line 130) — all confirmed present by grep and green in the re-run. |
| `tests/orchestrators/plugin/install.test.ts` | 3 pre-existing cases updated to the corrected arm-aware expectation (unplanned but disclosed in SUMMARY Deviations) | VERIFIED | `node --test tests/orchestrators/plugin/install.test.ts` re-run this pass — 98/98 pass. |
| `.planning/phases/90-session-environment-initialization/90-UAT.md` | Test 3 `issue -> pass`; summary 3/3 | VERIFIED | Read directly: Test 3 `result: pass`, Summary `total: 3, passed: 3, issues: 0`, Gaps section shows G-90-3 `status: resolved` with a root_cause and no unresolved `missing` items outstanding (both `missing` bullets from the original gap were the code fixes 90-02/90-03 delivered). |
| `.planning/debug/resolved/bin-unsupported-classification.md` | Debug session moved from `.planning/debug/` with a Resolution section | VERIFIED | File present at the resolved path (confirmed via `ls`). |
| `.planning/REQUIREMENTS.md` | Traceability rows for SENV-01/02/03, PENV-01 | PRESENT BUT STALE (non-blocking, see note below) | Checkboxes still `[ ]`/Pending for SENV-01/02/03; PENV-01 row still reads "Gaps Found" (reverted in commit `e031f517` after the prior verification round's gaps, never re-applied after 90-03 closed them). Documentation bookkeeping only — does not reflect a codebase gap; carried forward as a note per established project convention (updated at phase-complete/milestone-close, not mid-phase). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `index.ts` `session_start` handler | `applySessionEnv` | direct call, try/catch | WIRED | Unchanged since prior round; re-confirmed no delta in the 90-03 diff. |
| `index.ts` `resources_discover` handler | `recomputePluginPath(event.cwd)` | direct call, own try/catch | WIRED | Unchanged since prior round. |
| resolver `decideResolution`'s thrown shape (`partialable`, `resolver.ts:1494`) | `install.ts:2142` call site | direct field read | WIRED | `err.shape.partialable` passed as the 3rd positional argument to `narrowResolverReasons`, confirmed by direct read. |
| `narrowResolverReasons`'s `contains <kind>` handler | `narrowUnsupportedKinds` (partially-available arm only) / `"unsupported source"` literal (structural arm) | conditional branch on `partialable` | WIRED | Confirmed by direct code read (lines ~2298-2311); test-pinned by both the new note-axis parity test and the arm-threaded `PER_KIND_PARITY_CASES`. |
| list/info's `narrowResolverNotes` (unchanged, `shared/probe-classifiers.ts`) | install's `narrowResolverReasons` (structural arm) | shared note-axis catch-all agreement | WIRED (byte-parity restored) | The both-defects structural parity test asserts `narrowResolverNotes(notes)` and `__test_narrowResolverReasons(notes, [], false)` return the identical array for the identical input — the exact invariant SURF-01 required and the prior round found broken. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SENV-01 | 90-01-PLAN.md | `CLAUDECODE=1` whenever loaded | SATISFIED | Truths #1, #4, #6, #7; unchanged by 90-03; live-UAT Test 1 (`90-UAT.md`) pass. |
| SENV-02 | 90-01-PLAN.md | `CLAUDE_CODE_SESSION_ID` fresh per session_start | SATISFIED | Truth #2; live-UAT Test 1 pass. |
| SENV-03 | 90-01-PLAN.md | `CLAUDE_SESSION_ID` pi-only shim | SATISFIED | Truths #3, #5; live-UAT Test 1 pass. |
| PENV-01 | 90-01-PLAN.md, 90-02-PLAN.md, 90-03-PLAN.md | Enabled plugin `<pluginRoot>/bin` on PATH; bin installs by default at Claude Code parity; install-failure reason accuracy across all resolver arms | SATISFIED | Truths #8-17 and the 90-03 SURF-01/edge-coverage truths above; live-UAT Tests 2 and 3 both pass (3/3 total, 90-UAT.md). |

No orphaned requirements — REQUIREMENTS.md maps exactly SENV-01/02/03 and PENV-01 to Phase 90, and all four appear in a plan's `requirements` frontmatter (90-01: all four; 90-02: PENV-01; 90-03: PENV-01) and are covered by an executed, tested task.

### Anti-Patterns Found

None matching `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented` in the 90-03-modified files (`install.ts`, `cross-surface-reason-parity.test.ts`, `install.test.ts`) — grepped directly this pass, zero hits.

### Code Review

`90-REVIEW.md` (commit `735d8931` reviewed timestamp `2026-08-04T04:55:00Z`, this file's content post-dates 90-03 per its own text and the phase's git log shows a later `31479897 docs(90): refresh code review report after 90-03` commit) confirms: **WR-01 (SURF-01) is verified resolved** by the reviewer's own independent trace of both classifier functions, matching this verification's independent code read. Current review status: `issues_found`, 0 critical, 1 warning, 1 info. The one remaining warning (also labeled WR-01 in this later review revision, a naming collision with the now-resolved prior WR-01) concerns `shared/session-env.ts::applyPathLedger` stripping empty PATH segments from non-owned content — a narrow, benign-per-the-reviewer's-own-assessment deviation from that function's documented contract. This is a **quality advisory on PENV-01's PATH-normalization edge behavior, not a phase-goal truth failure**: none of the 20 observable truths above assert behavior around empty/malformed PATH segments, and REQUIREMENTS.md's PENV-01 text does not mention this case. Tracked as a WARNING finding, not a BLOCKER — does not gate `passed` status but is worth a follow-up fix or an explicit documented-hardening note per the review's own recommendation.

### Test Suite Status

- `node --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — re-run this verification pass, **20/20 pass**, 0 fail.
- `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/partial-vocabulary-guard.test.ts` — re-run this verification pass, **62/62 pass**, 0 fail.
- `node --test tests/orchestrators/plugin/install.test.ts` — re-run this verification pass, **98/98 pass**, 0 fail (covers the 3 SUMMARY-disclosed test updates).
- Full-suite claim (`npm test` 3234 pass / 1 skip / 0 fail; `npm run check` green) is trusted from 90-03-SUMMARY.md per this verification's directive to spot-check rather than re-run the entire suite — the targeted re-runs above (180 assertions across 5 files touching every must-have) provide independent corroboration rather than blind trust.
- Working tree clean at HEAD (`31479897`); `git status --short` empty.
- Known pre-existing environmental failure (unrelated, documented in `deferred-items.md`): two `pi-subagents` global-peer integration tests fail locally against a stale global install; skip in CI. Not chased — matches this project's established convention for that specific failure mode.

### Human Verification Required

None. The prior round's outstanding human-verification item (G-90-3 live-Pi retest) is closed: `90-UAT.md` records Test 3 `result: pass` (retested 2026-08-04, after both 90-02 and 90-03), Summary `3 total / 3 passed / 0 issues`, Gap `G-90-3` `status: resolved`. 90-03-SUMMARY.md's Task 2 Checkpoint Resolution section confirms operator approval of all three live behaviors (bin-only default install, `{unsupported component}` per-kind accuracy, byte-identical `{unsupported source}` on the both-defects case).

### Gaps Summary

No gaps. Both items open at the prior verification round are closed:

1. **SURF-01 cross-surface reason divergence** — closed by 90-03's arm-aware `narrowResolverReasons` (`partialable` discriminant). Verified independently via code read, `git diff` scoping (probe-classifiers.ts, session-env.ts, plugin-path.ts, resolver.ts all confirmed untouched by the fix), and a targeted re-run of the parity test suite (20/20 pass, including the two new pins that specifically target the previously-broken case).
2. **G-90-3 live-Pi retest** — performed and approved this session; recorded in `90-UAT.md` (3/3 pass) and `90-03-SUMMARY.md`.

One non-blocking documentation note carried forward: `REQUIREMENTS.md`'s checkbox/traceability table still shows SENV-01/02/03 as Pending and PENV-01 as "Gaps Found" (reverted in `e031f517` after the prior gaps-found round, not yet re-applied). This is a bookkeeping field normally updated at phase-complete/milestone-close per established project convention, not a codebase gap — all four requirements are fully implemented, tested, and now gap-free in the actual code.

One non-blocking code-review advisory carried forward: `applyPathLedger`'s empty-PATH-segment stripping (90-REVIEW.md, current WR-01) is a real but narrow deviation from its documented contract, assessed by the reviewer as low-severity and not asserted by any of this phase's 20 observable truths or REQUIREMENTS.md PENV-01 text. Recommend a follow-up fix or explicit documented-hardening note, but it does not block Phase 90 from `passed`.

---

_Verified: 2026-08-04_
_Verifier: Claude (gsd-verifier)_
