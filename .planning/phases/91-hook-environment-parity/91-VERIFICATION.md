---
phase: 91-hook-environment-parity
verified: 2026-08-03T12:00:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 91: Hook Environment Parity Verification Report

**Phase Goal:** A plugin hook process — on both the synchronous dispatch lane
and the async-rewake lane — receives `CLAUDECODE=1` and
`CLAUDE_CODE_SESSION_ID` alongside the existing
`CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`CLAUDE_ENV_FILE`
set, matching what a hook sees under Claude Code. Session id from the
authoritative per-dispatch snapshot (`transCtx.sessionId`), not the
`process.env` spread; the two hand-mirrored spawn sites pinned together by a
drift-guard test. Per D-91-02 the pi-only `CLAUDE_SESSION_ID` alias is also
pinned in both lanes (three keys total).
**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** No — initial verification

## Important note: SUMMARY.md is stale relative to the actual final code

`91-01-SUMMARY.md` states "Deviations from Plan: None — plan executed exactly
as written" and documents the "local literals over a shared constant"
decision as final. That was true of the Task 1-3 commits
(`306e099c`/`c9c97bac`/`00e2acee`), but a subsequent code-review fix commit
(`96cb08c5`, `fix(91): WR-01 share Claude session-env producer across hook
lanes`, made **after** the SUMMARY was written) refactored both lanes to
spread a single shared `claudeSessionEnvFor(sessionId)` producer from
`shared/session-env.ts` instead of duplicating the three literals. This is
recorded in `91-REVIEW.md` (iteration 2) and `91-REVIEW-FIX.md`, but
`91-01-SUMMARY.md` was never updated to reflect it. This verification was
performed against the actual HEAD source (not the SUMMARY narrative); the
final implementation is behaviorally equivalent to what the plan required and
is arguably more robust (lane parity by construction, not just by the
drift-guard test). Not treated as a gap — flagged for documentation hygiene
only.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | HENV-01: sync-lane `prepareEnv` env carries `CLAUDECODE="1"`, `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` = `transCtx.sessionId`, alongside unchanged existing set | VERIFIED | `dispatch-exec.ts:313-324` spreads `...claudeSessionEnvFor(transCtx.sessionId)` after `...process.env`; test `dispatch-exec.test.ts:259-290` ("EXEC-01 + HOOK-05") asserts all three values plus the pre-existing keys; `node --test` green |
| 2 | HENV-02: async-lane `prepareAsyncEnv` env identical to sync lane on every shared key, differing only by `MARKER_ENV` | VERIFIED | `registry.ts:610-621` spreads the same producer; `assertLaneParity` drift-guard tests (`hooks-async-rewake.test.ts:1408-1452`) assert `onlyAsync === [MARKER_ENV]`, `onlySync === []`, and per-key value equality across two fixtures; green |
| 3 | HENV-01 / D-91-02 (adjacency): id-related keys take value from post-spread `transCtx.sessionId` snapshot, not the spread | VERIFIED | `dispatch-exec.test.ts:296-321` pre-seeds `process.env.CLAUDE_CODE_SESSION_ID = "stale-sentinel-from-spread"` and asserts the spawned env carries `"session-xyz"` (the ctx snapshot), not the sentinel; passes |
| 4 | HENV-02 / D-91-02 (adjacency): async lane's added keys win over the spread identically to the sync lane | VERIFIED | By construction post-WR-01: both lanes call the identical `claudeSessionEnvFor(transCtx.sessionId)` in the identical post-spread position (`registry.ts:620` mirrors `dispatch-exec.ts:323`); code-review (`91-REVIEW.md`) explicitly confirms "Spread ordering preserved (D-91-02)" for both lanes |
| 5 | HENV-02 / D-91-01 (ordering): drift guard compares by key SET (symmetric difference) + per-key value equality — order-independent | VERIFIED | `assertLaneParity` (`hooks-async-rewake.test.ts:1388-1398`) builds `Set`s from `Object.keys`, computes `onlyAsync`/`onlySync` via array filter, and loops `for (const k of syncKeys)` for value equality — no literal-order dependency |
| 6 | HENV-02 / D-91-01 (precision/tie-break): `MARKER_ENV` is the SOLE permitted key-set difference | VERIFIED | `assert.deepEqual(onlyAsync, [MARKER_ENV])` and `assert.deepEqual(onlySync, [])` in both drift-guard cases; any other only-async/only-sync key would fail these assertions |
| 7 | HENV-02 (boundary): `CLAUDE_ENV_FILE` present exactly for `SessionStart`, absent otherwise, identically in both lanes | VERIFIED | Two drift-guard cases: PreToolUse fixture asserts `CLAUDE_ENV_FILE === undefined` in both envs; SessionStart fixture asserts present, equal across lanes, and matching `/data/_shared/claude-env-session-rewake\.env$/` |
| 8 | HENV-01 (empty, backstop): empty/falsy `transCtx.sessionId` still yields all three keys present on the sync lane, never omitted/throw | VERIFIED | `tests/shared/session-env.test.ts:129-137` exercises `claudeSessionEnvFor("")` (via `applySessionEnv`, its sole caller path) and asserts `CLAUDECODE="1"`, `CLAUDE_CODE_SESSION_ID=""`, `CLAUDE_SESSION_ID=""` with no throw; `prepareEnv` spreads this same producer unconditionally (no sessionId-based branching in `dispatch-exec.ts`) |
| 9 | HENV-02 (empty, backstop): identical empty-input behavior on the async lane | VERIFIED | Same reasoning as #8 — `prepareAsyncEnv` spreads the identical shared producer unconditionally (no sessionId-based branching in `registry.ts`); the producer's empty-input contract is the single behavioral surface both lanes depend on, and it is directly tested |

**Score:** 9/9 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` | `prepareEnv` extended with three keys | VERIFIED | Lines 313-324; wired into `dispatchHookExec` → spawn; exercised by 2 tests |
| `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` | `prepareAsyncEnv` extended with mirrored three keys | VERIFIED | Lines 610-621; wired into `spawnAndRegister` → spawn; exercised by tests + drift guard |
| `extensions/pi-claude-marketplace/shared/session-env.ts` | Not in original plan's artifact list — added by the WR-01 review fix as the single shared producer both lanes now call | VERIFIED | `claudeSessionEnvFor` (lines 37-47) exported and imported by both hook files; `applySessionEnv` delegates to it too |
| `tests/bridges/hooks/dispatch-exec.test.ts` | Extended EXEC-01 + HOOK-05 block + new snapshot-wins test | VERIFIED | Lines 259-321; 25/25 subtests pass |
| `tests/architecture/hooks-async-rewake.test.ts` | Extended EXEC-05 env block + new HENV-02 drift-guard describe | VERIFIED | Lines 436-440, 1379-1453; green |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `transCtx.sessionId` (`buildTranslationContext` snapshot) | `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` in both lanes | `claudeSessionEnvFor(transCtx.sessionId)` spread after `...process.env` in both `prepareEnv` and `prepareAsyncEnv` | WIRED | Confirmed by source read and the snapshot-wins test (sentinel proof) |
| The two hand-mirrored env literals (now: shared producer call sites) | HENV-02 behavioral drift guard | `assertLaneParity` invoked from two `describe("hook env parity (HENV-02)")` test cases, driving both public entry points via the `wireBoth` dual spawn spy | WIRED | Both drift-guard cases pass; guard would fail on any non-`MARKER_ENV` key-set or value divergence |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sync-lane targeted suite | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | Included in combined run below | PASS |
| Async-lane + drift-guard targeted suite | `node --test tests/architecture/hooks-async-rewake.test.ts` | Included in combined run below | PASS |
| Combined targeted run | `node --test tests/bridges/hooks/dispatch-exec.test.ts tests/architecture/hooks-async-rewake.test.ts` | 58 pass, 1 pre-existing platform skip, 0 fail | PASS |
| Producer empty-input contract | `node --test tests/shared/session-env.test.ts` | 5/5 pass | PASS |
| Typecheck | `npm run typecheck` | exit 0 | PASS |
| Lint | `npm run lint` | exit 0, no output | PASS |
| Format check | `npm run format:check` | "All matched files use Prettier code style!" | PASS |
| Full unit suite | `npm test` | 3181 pass, 1 pre-existing platform skip, 0 fail | PASS |
| Integration suite | `npm run test:integration` | 16 pass, 2 fail | FAIL (pre-existing, unrelated — see below) |

**Integration failures are pre-existing and out of scope for this phase.** The
2 failures (`tests/integration/provenance-invisibility.test.ts`,
`tests/integration/skill-path-resolution.test.ts`) are pi-subagents
integration tests unrelated to hooks/session-env; per project MEMORY
("pi-subagents integration tests use global peer"), these resolve the peer
from `npm root -g` and fail against a stale global install, independent of
any branch content. Neither failing test touches `bridges/hooks/`,
`async-rewake/`, or `shared/session-env.ts`. Not counted as a gap for Phase 91.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| HENV-01 | 91-01-PLAN.md | Sync dispatch lane hook env parity | SATISFIED | Truths 1, 3, 8 above |
| HENV-02 | 91-01-PLAN.md | Async-rewake lane mirror parity, drift-guarded | SATISFIED | Truths 2, 4-7, 9 above |

No orphaned requirements — `REQUIREMENTS.md` maps exactly HENV-01/HENV-02 to
Phase 91, both claimed by the plan's `requirements` frontmatter.

Note: `REQUIREMENTS.md`'s traceability table still shows HENV-01/HENV-02 as
`Pending` with unchecked `- [ ]` boxes. This is consistent with the same
milestone's other phases (SENV-*/PENV-01 for Phase 90 are also still
`Pending`) — this appears to be milestone-level bookkeeping updated at
milestone close, not a per-phase gap.

### Prohibitions Check (from PLAN frontmatter)

| Prohibition | Status | Evidence |
|---|---|---|
| Session id keys sourced from the spread instead of `transCtx.sessionId` | HELD | Snapshot-wins test proves the opposite |
| Any added key placed before `...process.env` | HELD | Both lanes place the producer spread after `...process.env` |
| Exporting `prepareEnv`/`prepareAsyncEnv` to enable the drift guard | HELD | `grep -n "export.*prepareEnv\|export.*prepareAsyncEnv"` — no matches; drift guard uses the public entry points |
| Source-text snapshot locking in the drift guard | HELD | `assertLaneParity` is a runtime key/value comparison, no `toString()`/source read |
| Changing the name/value/conditionality of pre-existing keys or `MARKER_ENV` | HELD | `CLAUDE_PROJECT_DIR`/`CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA`/`MARKER_ENV` unchanged; `SessionStart`-only `CLAUDE_ENV_FILE` conditional untouched |
| Adding any env key beyond `CLAUDECODE`/`CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID` | HELD | `grep` of both env literals shows only these three added; no host-identity/entrypoint/remote var introduced |
| Diverging the two lanes on the `SessionStart`-only `CLAUDE_ENV_FILE` rule | HELD | Drift-guard SessionStart case asserts present + equal; PreToolUse case asserts absent in both |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any touched
file. No phase/plan/wave/Pitfall tokens in added comments or test titles
(only `HENV-01`, `HENV-02`, `D-91-01`, `D-91-02`, `SENV-01/02/03`, `WR-01` IDs
used, per `.claude/rules/typescript-comments.md`).

### Human Verification Required

None. `91-VALIDATION.md` declares no manual-only rows, and every truth above
(including the two `verification: backstop` truths) has direct behavioral
test evidence — no truth was left as present-but-behavior-unverified.

### Gaps Summary

No gaps. All 9 must-have truths verified against actual HEAD source (not
SUMMARY narrative), all required artifacts exist/substantive/wired, both key
links confirmed, all 7 prohibitions held, `npm run check`'s in-scope gates
(typecheck, lint, format, unit tests) are green, and the 2 integration-test
failures are a pre-existing, unrelated, previously-documented environment
issue (stale global pi-subagents peer) that does not touch any file this
phase modified.

One documentation-hygiene note (not a gap): `91-01-SUMMARY.md` predates the
`96cb08c5` review-fix commit and does not mention it — the SUMMARY's
"Deviations from Plan: None" and "local literals" decision narrative are
stale. The actual final implementation (shared `claudeSessionEnvFor` producer)
fulfills the phase goal at least as well as, and more robustly than, what the
SUMMARY describes.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
