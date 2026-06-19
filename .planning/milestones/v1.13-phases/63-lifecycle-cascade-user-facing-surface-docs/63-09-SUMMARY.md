---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 09
subsystem: domain/hooks-parser
tags: [HOOK-03, LIFE-01, SURF-01, LIFE-02, wire-format, WR-05-revert]
requires:
  - extensions/pi-claude-marketplace/domain/components/hooks.ts (pre-63-09 parseHooksConfig)
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts (BUCKET_A_EVENTS)
  - tmp/pi-uat/agent/.../claude-plugins-official/plugins/hookify/hooks/hooks.json (upstream wire-format sample)
  - Claude Code plugin-dev/skills/hook-development/SKILL.md (binding wire-format authority)
provides:
  - "Two-arm parseHooksConfig: wrapper-detection at function head unwraps `parsed.hooks` when the upstream plugin-format envelope is present; bare settings-format inputs fall through to direct validation."
  - "Verbatim hookify wire-format pin under tests/fixtures/hookify-hooks.json (slimmed to bucket-A keys; Stop arm deferred to v1.14+)."
  - "WR-05 fixture flip from commit ba6632d reverted across the three hook test sites; on-disk deepEqual assertions adjusted to compare against the unwrapped inner record the bridge writes."
affects:
  - extensions/pi-claude-marketplace/domain/resolver.ts (readStandaloneHooks consumer; sees unwrapped value)
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (readHookSummaryEntries consumer; sees unwrapped value)
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts (writeHookConfig caller passes parsed.value = inner record)
tech-stack:
  added: []
  patterns:
    - "Structural wrapper-detection heuristic at parser entry: `typeof v === 'object' && v !== null && !Array.isArray(v) && Object.hasOwn(v, 'hooks') && (...)` -- purely structural, no new validation surface."
key-files:
  created:
    - tests/fixtures/hookify-hooks.json (committed in b78956b; slimmed in 714a6d4)
    - tests/domain/components/hooks.test.ts (the parser-level wire-format pin test added in b78956b)
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks.ts (wrapper-arm + JSDoc)
    - tests/bridges/hooks/stage.test.ts (WR-05 revert + .hooks unwrap pattern)
    - tests/orchestrators/marketplace/cascade.test.ts (WR-05 revert at seed JSON literal)
    - tests/transaction/lifecycle-cascade.test.ts (WR-05 revert at v1Hooks/v2Hooks + 3 deepEqual sites)
    - .planning/debug/hookify-unavailable-resolver-flip.md (inline correction at head)
decisions:
  - "Option A taken at the user-decided checkpoint: ship the wrapper-format wire-contract fix and DEFER Stop-event admission to v1.14+. The plan's truth #3 (`hookify becomes installable from this parser's perspective`) is PARTIALLY closed: the wrapper bug is fixed, but the bucket-A supportability gate still flips hookify because `Stop` is not in v1.13's BUCKET_A_EVENTS. This is by-design v1.13 scope, not a defect."
  - "Fixture slimmed (not amended) by a follow-up commit (714a6d4) -- the verbatim Stop arm would have tripped `(c) non-bucket-A event: Stop` BEFORE the wrapper-acceptance verdict could land, masking the wire-format question this fixture exists to pin. The slim isolates the test to the wrapper question."
metrics:
  duration_minutes: 25
  completed_date: 2026-06-16
---

# Phase 63 Plan 09: Hookify Wire-Format Wrapper Fix Summary

**One-liner:** Two-arm `parseHooksConfig` unwraps the upstream PLUGIN-format wrapper `{description?, hooks: {...}}` per Claude Code `plugin-dev/skills/hook-development/SKILL.md`, closing the wire-contract bug that flipped every wrapper-shipping plugin (hookify and siblings) to `(unavailable) {unsupported hooks}` before the install cascade could reach the hooks-bridge slot.

## Status

`complete with deviation` -- the wrapper-bug fix lands verbatim, but plan truth #3 is partially closed because hookify still flips `(unavailable)` at runtime via the bucket-A supportability gate (intentional v1.13 scope; see Deferred section).

## What landed

### Commits (5, oldest -> newest)

| Commit    | Subject                                                                | Role                                                       |
| --------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `b78956b` | `test(63-09): pin parseHooksConfig against hookify upstream wire format` | Task 1 RED: fixture + failing parser test                  |
| `714a6d4` | `test(63-09): slim hookify fixture to bucket-A events (defer Stop)`    | Option A fixture slim (Stop arm removed)                   |
| `5fa5543` | `fix(63-09): unwrap plugin-format hooks.json wrapper in parseHooksConfig` | Task 2 GREEN: wrapper-detection arm + JSDoc                |
| `02bb8ba` | `test(63-09): restore upstream wrapper form in hook test fixtures`     | Task 3: WR-05 fixture revert + on-disk `.hooks` unwrap     |
| `2fbb15d` | `docs(63-09): correct hookify debug session claim re bucket-A coverage` | Debug session correction (bucket-A overstatement)          |

### Behavior changes

- `parseHooksConfig` accepts BOTH wire shapes:
  - the upstream **PLUGIN-format wrapper** `{description?, hooks: {<event>: [...]}}` per Claude Code SKILL.md (real upstream plugin files)
  - the **bare settings-format** `{<event>: [...]}` shape (backward-compat for in-tree fixtures)
- The success arm's `value` is the **unwrapped inner record** either way, so every downstream consumer (resolver, info.ts projection, bridge stage-write) keeps seeing the bare-event-keys shape it already expected.
- A new structural helper `isPluginWrapper(v)` performs the discrimination -- a private, type-narrowing predicate `v is { hooks: object }` that flips only when `v` is a plain non-null non-array object carrying an own `hooks` property whose value is itself a plain non-null non-array object.
- JSDoc on `HOOKS_CONFIG_SCHEMA` and `parseHooksConfig` now cite the upstream Claude Code `plugin-dev/skills/hook-development/SKILL.md` as the binding wire-format authority and document both supported shapes.
- The file-level comment block at the top of `hooks.ts` gains a new bullet documenting the two-arm contract.

### Test surface

- New fixture `tests/fixtures/hookify-hooks.json` derived from hookify@claude-plugins-official's `hooks/hooks.json` -- slimmed to PreToolUse / PostToolUse / UserPromptSubmit (Stop arm removed; see Deviation below).
- New parser-level pin test `parseHooksConfig accepts the upstream plugin-format wrapper (hookify wire bytes, bucket-A slim)` in `tests/domain/components/hooks.test.ts` -- 42 tests total in this file (was 41 pre-63-09; one new wire-format pin).
- `tests/bridges/hooks/stage.test.ts` HOOKS_VALUE restored to wrapper form; 5 `writeHookConfig` calls now pass `HOOKS_VALUE.hooks`; 1 on-disk `deepEqual` compares against `HOOKS_VALUE.hooks`.
- `tests/orchestrators/marketplace/cascade.test.ts:166` seed JSON literal restored to wrapper form (no downstream consumer assertion adjustment needed).
- `tests/transaction/lifecycle-cascade.test.ts` v1Hooks + v2Hooks restored to wrapper form; 3 on-disk `deepEqual` assertions adjusted to compare against `.hooks`.

### Verification

- `npx tsx --test tests/domain/components/hooks.test.ts` -- 42 pass / 0 fail.
- `npm run check` GREEN end-to-end: 2274 pass / 0 fail / 1 skip (unit) + 10 pass / 0 fail (integration). Baseline preserved (was 2273 pre-63-09; the new wire-format pin test adds 1).
- All commits pass `pre-commit run --files <...>` without `--no-verify` (lint errors caught and fixed inline: `Object.hasOwn` over `Object.prototype.hasOwnProperty.call`, import-order in test file).

## Truths revisited (against the PLAN frontmatter `must_haves.truths`)

| # | Truth                                                                                                                                | Status                                                                                  |
|---|---|---|
| 1 | `parseHooksConfig` accepts the upstream wrapper AND continues to accept the bare shape.                                              | Landed verbatim.                                                                        |
| 2 | Structural wrapper-detection heuristic on `parsed.hooks`.                                                                            | Landed verbatim via `isPluginWrapper(v)`.                                               |
| 3 | After the fix, hookify's verbatim wire bytes return `{ok: true}` -- hookify becomes installable from this parser's perspective.      | **Partially landed.** Parser accepts hookify's verbatim wrapper. However, hookify ships a `Stop` arm not in v1.13's BUCKET_A_EVENTS -- `checkMatcherSupportability` will still trip at install time. The wrapper-bug is closed; the Stop-event gap is deferred to v1.14+. See Deviation. |
| 4 | WR-05 fixture revert across three test sites; on-disk `deepEqual` assertions adjusted to compare against the unwrapped inner record.  | Landed verbatim.                                                                        |
| 5 | New dedicated parser test against the verbatim hookify wire fixture.                                                                 | Landed (with bucket-A slim per Option A).                                               |
| 6 | All in-tree bare-shape configs and `readStandaloneHooks` callers still validate via the backward-compat arm.                         | Verified -- 2274 pass / 0 fail across the unit suite.                                   |
| 7 | `npm run check` GREEN at commit boundary.                                                                                            | Landed verbatim.                                                                        |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan truth #3 unsatisfiable verbatim -- `Stop` event arm in hookify's wire bytes is not in BUCKET_A_EVENTS**

- **Found during:** Task 1 RED execution (prior agent) -- the verbatim fixture committed in b78956b included hookify's full upstream `hooks/hooks.json`, which declares `Stop` alongside the v1.13-supported PreToolUse / PostToolUse / UserPromptSubmit arms. `Stop` is NOT a member of `BUCKET_A_EVENTS` (see `extensions/pi-claude-marketplace/domain/components/hook-events.ts:37`).
- **Issue:** The plan's "Wrapper-detection arm lands and hookify's wire bytes parse to `{ok: true}`" verification could not hold against the verbatim fixture, because `checkMatcherSupportability` trips `(c) non-bucket-A event: Stop` BEFORE the wrapper-acceptance verdict can land. The fixture-as-committed would have masked the wire-format question this fixture exists to pin.
- **Decision:** The user-decided checkpoint selected **Option A: ship wrapper fix, defer Stop**. The fixture was slimmed in a follow-up commit (714a6d4) to PreToolUse / PostToolUse / UserPromptSubmit only -- keeping the upstream `{description?, hooks: {...}}` wrapper verbatim, dropping the Stop arm. The slim isolates the test to the wrapper question; Stop-event admission is a sibling concern (BUCKET_A_EVENTS extension) deferred to v1.14+.
- **Fix:** Two coordinated edits:
  - Fixture: removed the `Stop` arm; wrapper structure preserved verbatim.
  - Test docstring: updated to call out the deliberate slim, cite `BUCKET_A_EVENTS` as the v1.13 scope source, and drop the now-absent `Stop in result.value` assertion.
- **Files modified:** `tests/fixtures/hookify-hooks.json`, `tests/domain/components/hooks.test.ts`.
- **Commit:** 714a6d4.

**2. [Rule 1 - Bug] Debug session claim "hookify uses ONLY bucket-A supported events" was incorrect**

- **Found during:** Diagnosing the Option A scope above. The trigger string at `.planning/debug/hookify-unavailable-resolver-flip.md:3` asserted hookify "uses ONLY bucket-A supported events", which is false (hookify ships `Stop`).
- **Fix:** Inline correction at the head of the debug session file, before the original session narrative, explaining: (a) the original claim was wrong; (b) the wrapper-format bug IS closed by 63-09; (c) hookify will still flip `(unavailable)` at runtime via the bucket-A supportability gate until `Stop` is admitted in v1.14+.
- **Commit:** 2fbb15d.

## Deferred

### Stop-event admission to BUCKET_A_EVENTS (v1.14+)

The wrapper-format wire-contract bug closed in this plan is one half of the hookify story. The other half -- admitting `Stop` (and any other v1.14+ event-set promotion) to `BUCKET_A_EVENTS` so `checkMatcherSupportability` no longer trips `(c) non-bucket-A event: Stop` on hookify and similar plugins -- is out of scope for v1.13.

Runtime evidence after 63-09 + 63-10 lands:

- The resolver no longer flips hookify via `parseHooksConfig` (wrapper bug closed).
- The resolver still flips hookify via `checkMatcherSupportability` with `unsupported hooks: (c) non-bucket-A event: Stop` (intentional v1.13 scope).
- The user surface differs: today the plugin is `(unavailable) {unsupported hooks}` for a different reason (the runtime evidence will surface in the 63-11 UAT log) -- but it is STILL `(unavailable) {unsupported hooks}`, so the user-visible classification is unchanged.

This is by-design v1.13 scope per the PROJECT.md milestone description (bucket-A is the closed 8-event set for v1.13). A v1.14+ plan should:

1. Audit upstream Claude Code's full hook-event set against `BUCKET_A_EVENTS`.
2. Add a Pi peer-dep analog for `Stop` (and any other promoted event) in `hook-events.ts` / `hook-tool-names.ts` / the dispatcher.
3. Promote each event to `BUCKET_A_EVENTS` with a closed matcher set per the existing TOOL-02 supportability contract.

## Threat Flags

None. The wrapper-detection heuristic is purely structural; the downstream `HOOKS_VALIDATOR.Check` still gates every entry. The new fixture file is hermetic test data with no execution surface.

## Self-Check

Files claimed in this SUMMARY:

- `tests/fixtures/hookify-hooks.json` -- FOUND (slimmed, bucket-A keys only).
- `tests/domain/components/hooks.test.ts` -- FOUND (42 tests, wire-format pin test present).
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` -- FOUND (`isPluginWrapper` private helper at top; wrapper-arm in `parseHooksConfig`).
- `tests/bridges/hooks/stage.test.ts` -- FOUND (HOOKS_VALUE wrapper-shaped; 5x `.hooks` adjustments).
- `tests/orchestrators/marketplace/cascade.test.ts` -- FOUND (line 166 seed JSON wrapper-shaped).
- `tests/transaction/lifecycle-cascade.test.ts` -- FOUND (v1Hooks + v2Hooks wrapper-shaped; 3x `.hooks` deepEqual adjustments).
- `.planning/debug/hookify-unavailable-resolver-flip.md` -- FOUND (inline correction at head).

Commits claimed in this SUMMARY:

- `b78956b` -- FOUND in `git log` (Task 1 RED).
- `714a6d4` -- FOUND in `git log` (fixture slim).
- `5fa5543` -- FOUND in `git log` (Task 2 GREEN).
- `02bb8ba` -- FOUND in `git log` (Task 3 WR-05 revert).
- `2fbb15d` -- FOUND in `git log` (debug session correction).

## Self-Check: PASSED
