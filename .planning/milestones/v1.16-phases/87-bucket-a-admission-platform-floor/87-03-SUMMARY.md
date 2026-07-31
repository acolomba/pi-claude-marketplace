---
phase: 87-bucket-a-admission-platform-floor
plan: 03
subsystem: testing
tags: [hooks, admission, fixtures, resolver, plugin-info]

# Dependency graph
requires:
  - phase: 87-bucket-a-admission-platform-floor
    provides: "BUCKET_A_EVENTS = 10 with Stop null-sentinel + StopFailure closed set (Plan 02, ADMIT-01); Notification as the canonical unsupported example (Plan 01, D-87-06)"
provides:
  - "hookify fixture with the real Stop arm restored (full claude-plugins-official wire bytes)"
  - "ralph-wiggum-hooks.json — Stop-only fixture from real ralph-loop wire bytes (D-87-03)"
  - "Fixture-backed resolver available-flip proof for Stop (adjacency + empty edges) and info supported-listing for Stop/StopFailure (ADMIT-02)"
affects: [88-agent-settled-dispatcher-stop-contract-stopfailure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-wire-byte fixtures drive the resolver/info admission proof; StopFailure listing pinned by a synthetic config because no first-party plugin ships StopFailure"

key-files:
  created:
    - tests/fixtures/ralph-wiggum-hooks.json
  modified:
    - tests/fixtures/hookify-hooks.json
    - tests/domain/components/hooks.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "Fixture filename honors the plan (ralph-wiggum-hooks.json); provenance in the description records the true source plugin (ralph-loop) since the marketplace has no plugin literally named ralph-wiggum"
  - "ralph-wiggum fixture uses the real matcher-less Stop group verbatim (admissible via match-all) rather than injecting an empty/`*` matcher — the most faithful reading of D-87-03"
  - "StopFailure supported-listing proven by a synthetic Stop + StopFailure info case; neither real fixture declares StopFailure (no first-party plugin does)"

requirements-completed: [ADMIT-02]

# Metrics
duration: 35min
completed: 2026-07-30
status: complete
---

# Phase 87 Plan 03: ADMIT-02 Fixture-Backed Admission Flip Summary

**The hookify Stop arm is restored and a Stop-only ralph-wiggum fixture (real ralph-loop wire bytes) is added; the resolver now flips both to `installable` with `hooks` supported and no Stop/StopFailure drop, and `plugin info` lists Stop (and, synthetically, StopFailure) as bare supported entries — the emergent ADMIT-02 proof with zero new admission code, all offline.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-30
- **Tasks:** 2
- **Files modified:** 5 (1 fixture created, 1 fixture restored, 3 test files)

## Accomplishments

- Restored the real hookify `Stop` arm (`python3 "${CLAUDE_PLUGIN_ROOT}/hooks/stop.py"`, timeout 10) into `tests/fixtures/hookify-hooks.json`, placed between the `PostToolUse` and `UserPromptSubmit` arms to match the upstream claude-plugins-official wire-byte order; the pre-existing arms are byte-unchanged.
- Added `tests/fixtures/ralph-wiggum-hooks.json`: a Stop-only wrapper config transcribed verbatim from the real `ralph-loop` plugin's `hooks/hooks.json` (`bash "${CLAUDE_PLUGIN_ROOT}/hooks/stop-hook.sh"`, no matcher = match-all admissible), with provenance recorded in the `description`.
- Added two resolver cases: hookify (Stop + bucket-A events) → `installable`, `hooks` supported, `droppedHooks` absent, no `{unsupported hooks}` note (adjacency edge); ralph-wiggum (Stop-only) → `installable` with a non-empty supported subset and recorded `hooksConfigPath` (empty edge — the deliberate counterpoint to the Notification-only empty-subset → `partially-available` case).
- Added three `plugin info` cases: hookify and ralph-wiggum each list `Stop` as a bare supported entry (no ` (unsupported)` suffix); a synthetic Stop + StopFailure config pins StopFailure as a bare supported entry in deterministic declaration order.
- Refreshed the hookify wrapper-acceptance test in `hooks.test.ts` (comment + title) whose "bucket-A slim / Stop REMOVED" narrative was falsified by restoring the Stop arm.

## Task Commits

1. **Task 1: Restore hookify Stop arm and add the ralph-wiggum fixture (real wire bytes)** — `3bf94249` (test)
2. **Task 2: Assert resolver available-flip and plugin info supported-listing for both fixtures** — `ce3bf7d6` (test)

## Files Created/Modified

- `tests/fixtures/ralph-wiggum-hooks.json` (created) — Stop-only real-wire-byte fixture (ralph-loop provenance, D-87-03)
- `tests/fixtures/hookify-hooks.json` — restored real Stop arm; existing arms byte-unchanged
- `tests/domain/components/hooks.test.ts` — wrapper-acceptance test comment/title refreshed (stale "bucket-A slim" narrative removed), asserts the Stop arm unwraps
- `tests/domain/resolver-strict.test.ts` — two ADMIT-02 available-flip cases (adjacency + empty edges)
- `tests/orchestrators/plugin/info.test.ts` — three ADMIT-02 supported-listing cases (hookify, ralph-wiggum, synthetic StopFailure)

## Decisions Made

- **Fixture filename vs. real plugin name.** The plan mandates the filename `ralph-wiggum-hooks.json` (load-bearing across `files_modified`, acceptance criteria, and all test references), but the claude-plugins-official marketplace has no plugin literally named `ralph-wiggum` — the real Stop-only plugin is `ralph-loop` (the codebase already refers to it as `ralph-loop` in `hooks.test.ts`; issue #103 colloquially calls it `ralph-wiggum`). Resolution: keep the plan-mandated filename, and record honest provenance in the fixture `description` naming the true source (`plugins/ralph-loop/hooks/hooks.json`). This satisfies both the plan's filename contract and D-87-03's real-wire-byte-provenance requirement.
- **Verbatim real bytes over the plan's suggested matcher.** The plan suggested "an empty or `*` Stop matcher so it is admissible." The real ralph-loop Stop group carries no matcher field at all, which is already match-all (admissible) and short-circuits before the null-sentinel gate. Using the real bytes verbatim is the most faithful reading of D-87-03; no matcher was injected.
- **StopFailure listing is synthetic.** No first-party plugin ships StopFailure (issue #103), so neither real fixture declares it. The StopFailure supported-listing + deterministic-order edge is pinned by a synthetic inline `Stop + StopFailure` info case rather than by inventing StopFailure wire bytes for a fixture (which D-87-03 forbids).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale comment] Refreshed the hookify wrapper-acceptance test narrative**
- **Found during:** Task 1
- **Issue:** Restoring the Stop arm directly falsified the comment and title of `hooks.test.ts`'s wrapper-acceptance test, which described the fixture as "bucket-A slim" with the "upstream `Stop` event arm REMOVED because `Stop` is NOT a member of `BUCKET_A_EVENTS`." Stop is now a bucket-A member (Plan 02) and is present in the fixture.
- **Fix:** Rewrote the comment to state the fixture now carries the full real wire bytes including Stop, dropped the stale "bucket-A slim" / version-history narration (comment-policy compliant), dropped "bucket-A slim" from the test title, and added `assert.ok("Stop" in result.value)`. `hooks.test.ts` was not in the plan's `files_modified`, but the change is a direct consequence of the Task 1 fixture edit and in-scope per the clean-up-your-own-mess boundary.
- **Files modified:** `tests/domain/components/hooks.test.ts`
- **Commit:** `3bf94249`

## Issues Encountered

- `npm run check` reports the same 2 integration failures as Plans 01 and 02 (`tests/integration/provenance-invisibility.test.ts` T-d8i-01, `tests/integration/skill-path-resolution.test.ts` SC-2/AGSK-06). These resolve the `pi-subagents` optional peer from the global `npm root -g` and fail on a stale/absent global version — a documented local-environment issue unrelated to hook admission, out of scope per the deviation scope boundary. typecheck, lint, format:check, and the entire unit suite (3082 tests, 0 fail) are green.

## Verification

- `node --test tests/domain/resolver-strict.test.ts tests/orchestrators/plugin/info.test.ts` — green (all cases pass, incl. the 5 new ADMIT-02 cases).
- `npm run check`: typecheck exit 0, lint clean, format:check clean, unit suite 3082 pass / 0 fail; only the 2 pre-existing pi-subagents environment integration failures remain (unchanged from Plans 01/02).
- `grep -rn "Stop (unsupported)" tests/` returns nothing (Stop is supported everywhere; Notification is the deliberate unsupported example).
- Fixtures parse as JSON; `npx prettier --check` clean; hookify `hooks` keys include `Stop`; ralph-wiggum `hooks` has only `Stop`.

## Known Stubs

None. Stop/StopFailure are admitted-but-not-dispatched by design this phase (dispatch is Phase 88); this plan only proves the admission/info verdict.

## Next Phase Readiness

- ADMIT-02 is proven offline. Phase 88 can wire the `agent_settled` dispatcher and Stop/StopFailure translators on top of the now-admitted events.
- No blockers.

## Self-Check: PASSED
