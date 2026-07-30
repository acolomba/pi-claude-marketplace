---
phase: 87-bucket-a-admission-platform-floor
verified: 2026-07-30T04:48:21Z
status: passed
score: 22/22 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 87: Bucket-A Admission & Platform Floor Verification Report

**Phase Goal:** Make `Stop` and `StopFailure` first-class supported hook events
at the resolver/admission layer — the prerequisite plumbing every later phase
builds on. `BUCKET_A_EVENTS` grows from 8 to 10, each new event gets its
matcher disposition, and the peer floor rises to the version that introduced
the fire-point primitive. A plugin whose `hooks.json` declares `Stop`
and/or `StopFailure` alongside already-supported bucket-A events resolves
available (no `{unsupported hooks}` partition drop for these events) and
`plugin info` lists both as supported — even though dispatch is not yet wired
(Phase 88).
**Verified:** 2026-07-30T04:48:21Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `BUCKET_A_EVENTS` contains exactly 10 events, `Stop` then `StopFailure` appended after `SessionEnd` (ADMIT-01) | VERIFIED | `hook-events.ts:40-51` — 10-element tuple ending `..., "SessionEnd", "Stop", "StopFailure"`; `hooks-supportability.test.ts` locked-order deepEqual passes |
| 2 | An empty/`*` Stop matcher is admissible; any non-empty Stop matcher drops as `no-matcher-support` (ADMIT-01, edge: empty) | VERIFIED | `hook-events.ts:182` `Stop: null` in `NON_TOOL_EVENT_FIELDS`, omitted from `NON_TOOL_EVENT_CLOSED_SETS`; unit case `hooks.test.ts:389` (`no-matcher-support` on non-empty matcher) and inline resolver case `resolver-strict.test.ts:200` (match-all Stop → installable) both pass |
| 3 | StopFailure closed-set membership is exact whole-string byte-equality — no case-folding, no pipe-OR splitting; `rate_limit\|server_error` drops as `closed-set` (ADMIT-01, edges: encoding + adjacency) | VERIFIED | `hook-events.ts:253-264` flat `Set` of 10 values, doc-comment explicitly disclaims pipe-splitting; unit case `hooks.test.ts:437` pins the pipe-compound drop |
| 4 | A StopFailure matcher exactly equal to a vocabulary value is admitted; a value outside the set drops as `closed-set` (ADMIT-01, edge: adjacency) | VERIFIED | `hooks.test.ts:415` (`rate_limit` admitted), `hooks.test.ts:426` (`bogus_value` → `closed-set`) |
| 5 | StopFailure lands BOTH `NON_TOOL_EVENT_FIELDS` and `NON_TOOL_EVENT_CLOSED_SETS` in the same edit; Stop lands ONLY the `null` sentinel, omitted from the closed-set table (WR-04) | VERIFIED | `hook-events.ts:183` (`StopFailure: "error"`) + `:253-264` (10-value set) landed together in commit `9ff93e5a`; `hooks-supportability.test.ts` WR-04 sync pins pass |
| 6 | `ClaudeHookEvent` widens to 10 in lockstep with `BUCKET_A_EVENTS` via the `satisfies` pin (ADMIT-01) | VERIFIED | `shared/concerns/hooks.ts:58-68` — 10-literal union including `"Stop" \| "StopFailure"`; `npm run typecheck` exits clean (the pin would break the build otherwise) |
| 7 | `package.json` peerDependencies `@earendil-works/pi-coding-agent` floor is `>=0.80.5`, declarative only (FLOOR-01, D-87-01, D-87-05) | VERIFIED | `package.json:56` reads `">=0.80.5"`; `grep -c "0.74.0" package.json` = 0; no runtime version-detection code introduced anywhere in the diff |
| 8 | DISPATCHABLE_EVENTS is an 8-event subset tuple pinned `satisfies readonly BucketAEvent[]` (D-87-04) | VERIFIED | `hook-events.ts:100-115` |
| 9 | The three total dispatch tables key on `DispatchableEvent`, not `BucketAEvent` — Stop/StopFailure translators not demanded (D-87-04) | VERIFIED | `Record<DispatchableEvent, ...>` at `dispatch-exec.ts` TRANSLATORS/REQUIRED_EVENT_FIELDS and `async-rewake/registry.ts` TRANSLATORS; `isDispatchableEvent` guard wired at both index sites (`dispatch-exec.ts:201`, `registry.ts:236`) |
| 10 | No canonical `Stop` used as an unsupported/non-bucket-A example remains in the suite — replaced by `Notification` (D-87-06) | VERIFIED | `grep -rn "hooks-stop-only\|hooks-posttooluse-and-stop" tests/` → 0 matches; `grep -rn "Stop (unsupported)" tests/` → 0 matches; renamed fixtures `hooks-notification-only.json` / `hooks-posttooluse-and-notification.json` exist and key on `Notification` |
| 11 | A plugin declaring Stop/StopFailure alongside supported bucket-A events (hookify) resolves `available`, no partition drop (ADMIT-02, edge: adjacency) | VERIFIED | `resolver-strict.test.ts:230` case passes; hookify fixture has restored real `Stop` arm |
| 12 | A Stop-only plugin (ralph-wiggum) resolves `available` with a non-empty supported subset — not the empty-subset edge (ADMIT-02, edge: empty) | VERIFIED | `resolver-strict.test.ts:260` case passes; `ralph-wiggum-hooks.json` fixture is Stop-only |
| 13 | `plugin info` lists Stop and StopFailure as supported in deterministic order for both fixtures (ADMIT-02, edge: ordering) | VERIFIED | `info.test.ts:1821,1860,1905` cases pass; `grep "Stop (unsupported)"` returns nothing |
| 14 | Fixtures derived from real claude-plugins-official wire bytes, provenance recorded in `description` (D-87-03) | VERIFIED | `hookify-hooks.json` Stop arm matches real hookify command shape; `ralph-wiggum-hooks.json` description names `plugins/ralph-loop/hooks/hooks.json` as source |

**Score:** 14/14 must-have truths verified across all three plans (22 counting artifact/key-link/prohibition items individually — see below); 0 present-but-behavior-unverified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/components/hook-events.ts` | 10-event tuple, both dispositions, DISPATCHABLE subset | VERIFIED | All present, WR-04 tables in sync, doc-comments updated per comment policy |
| `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` | `ClaudeHookEvent` widened to 10 | VERIFIED | Lines 58-68 |
| `package.json` | peer floor `>=0.80.5` | VERIFIED | Line 56; lockfile synced, no lockfile churn beyond the range line |
| `tests/fixtures/hookify-hooks.json` | Stop arm restored | VERIFIED | Real wire-byte command shape, existing arms byte-unchanged |
| `tests/fixtures/ralph-wiggum-hooks.json` | Stop-only fixture, real bytes | VERIFIED | Created, single `Stop` key, provenance in `description` |
| `tests/fixtures/hooks-notification-only.json`, `hooks-posttooluse-and-notification.json` | Renamed from Stop-based fixtures | VERIFIED | Both exist, key on `Notification` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `DISPATCHABLE_EVENTS` | `BUCKET_A_EVENTS` | `satisfies readonly BucketAEvent[]` pin | WIRED | Compiles; typecheck green |
| `BUCKET_A_MEMBERS = new Set(BUCKET_A_EVENTS)` | admission verdict | automatic set derivation | WIRED | No new admission code needed; resolver cases confirm |
| `ClaudeHookEvent` | `BUCKET_A_EVENTS` | `as const satisfies readonly ClaudeHookEvent[]` pin | WIRED | Both widened together; typecheck would break otherwise |
| WR-04 desync guard (`tryNonToolEventTrip`) | `NON_TOOL_EVENT_FIELDS` / `NON_TOOL_EVENT_CLOSED_SETS` | both StopFailure entries land together | WIRED | No `HooksTableDesyncError` thrown; both tables populated in the same commit |
| fixtures → `parseHooksConfig` → `partitionHooks` → resolver verdict | | | WIRED | Resolver cases for hookify + ralph-wiggum both pass |
| `info.ts` `projectHookSummaryEntries` | `Stop`/`StopFailure` supported listing | non-tool arm auto-render | WIRED | `info.test.ts` cases confirm bare `<event>` listing, no `(unsupported)` suffix |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck clean with widened union + decoupled dispatch keys | `npm run typecheck` | exit 0, no output | PASS |
| Targeted admission/dispatch/resolver/info/install/notify suites | `node --test tests/architecture/hooks-supportability.test.ts tests/architecture/hooks-translators.test.ts tests/domain/resolver-strict.test.ts tests/bridges/hooks/dispatch-exec.test.ts tests/domain/components/hooks.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/install.test.ts tests/shared/notify-v2.test.ts` | 467 pass / 0 fail | PASS |
| `pi.on` subscription count untouched (Pitfall 6 guard) | `node --test tests/architecture/hooks-dispatch.test.ts` | 10 pass / 0 fail; DISP-01 still asserts exactly 8 `pi.on` calls | PASS |
| Catalog UAT passes without doc lockstep edit (D-87-06) | `node --test tests/architecture/catalog-uat.test.ts` | 6 pass / 0 fail | PASS |
| No dangling old-fixture references | `grep -rn "hooks-stop-only\|hooks-posttooluse-and-stop" tests/` | 0 matches | PASS |
| No `Stop (unsupported)` anywhere | `grep -rn "Stop (unsupported)" tests/` | 0 matches | PASS |
| Lint clean | `npm run lint` | 0 errors/warnings | PASS |
| Format clean | `npm run format:check` | "All matched files use Prettier code style!" | PASS |
| No debt markers in phase-touched files | `grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all files_modified | 0 matches | PASS |
| No doc edits (D-87-02) | `git log --oneline -5 -- docs/output-catalog.md docs/hooks-compatibility.md README.md` | last touching commits predate Phase 87 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIT-01 | 87-02 | `BUCKET_A_EVENTS` 8→10 with matcher dispositions | SATISFIED | Tuple widened, both dispositions landed together, unit + architecture pins pass |
| ADMIT-02 | 87-03 | Stop/StopFailure plugins resolve available; `plugin info` lists both supported | SATISFIED | hookify + ralph-wiggum fixture-backed resolver and info cases pass |
| FLOOR-01 | 87-02 | Peer floor `>=0.74.0` → `>=0.80.5`, declarative only | SATISFIED | `package.json:56`; REQUIREMENTS.md marks all three `[x]` Complete |

No orphaned requirements — REQUIREMENTS.md's Phase 87 row lists exactly ADMIT-01, ADMIT-02, FLOOR-01, and all three appear in the plans' `requirements:` frontmatter (87-01: ADMIT-01 prep only, not marked complete by design; 87-02: ADMIT-01 + FLOOR-01; 87-03: ADMIT-02).

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any phase-touched file. No stub returns, no hardcoded-empty data flows, no orphaned imports. The one deliberate deviation (dispatch.ts re-key, not in the original `files_modified` list) is documented as a Rule-3 blocking auto-fix in the 87-02-SUMMARY with a clear rationale (exhaustive-switch typecheck break from the union widen) and is consistent with the D-87-04 decoupling pattern already applied elsewhere.

### Human Verification Required

None. All must-haves are statically/structurally verifiable (admission is a pure supportability verdict — no I/O, no runtime behavior, no UI). D-87-01 explicitly forbids runtime version detection, so there is no below-floor behavior to spot-check live.

### Gaps Summary

No gaps. All 3 requirement IDs (ADMIT-01, ADMIT-02, FLOOR-01) are satisfied with direct code evidence, not just SUMMARY narrative:

- `BUCKET_A_EVENTS` is verified at exactly 10 members in the correct order, both new-event matcher dispositions are landed together per WR-04, and `ClaudeHookEvent` is widened in lockstep — all confirmed by direct file read plus a green `npm run typecheck`.
- The dispatch/rewake/translator tables were decoupled onto a `DispatchableEvent` subset before the admission cutover (D-87-04), avoiding a forced Phase-88 translator pull-forward; `isDispatchableEvent` guards are in place at both index sites.
- Two real-wire-byte fixtures (hookify restored, ralph-wiggum added) drive fixture-backed resolver and `plugin info` proofs that Stop/StopFailure now resolve in the supported partition — the phase's stated "observable outcome" (the resolver's verdict).
- The peer floor is `>=0.80.5` declaratively, matching the corrected D-87-05 value (0.80.4 was never published).
- D-87-02 (no doc edits) and D-87-06 (catalog-uat unaffected) are both honored — confirmed by git log and a passing catalog-uat run.
- Dispatch/translator work remains untouched (Phase 88 scope): no `agent_settled` subscription, the 8-entry `pi.on` assertion is unchanged, no new translator/payload modules.
- Full targeted suite (467 tests across the 8 touched suites) plus `hooks-dispatch.test.ts` and `catalog-uat.test.ts` are green; typecheck, lint, and format are clean.
- The two pre-existing `pi-subagents`-peer integration test failures are a documented local-environment condition (stale global npm peer resolution), unrelated to this phase, and were excluded from this verification's pass/fail determination per the verification notes.

---

_Verified: 2026-07-30T04:48:21Z_
_Verifier: Claude (gsd-verifier)_
