---
phase: 39
slug: cascade-ghost-record
status: passed
verified: 2026-06-02
must_haves_passed: 5/5
overrides_applied: 0
---

# Phase 39: Cascade Ghost Record (TR-03) Verification Report

**Phase Goal (ROADMAP.md:833-838):** When `cascadeUnstagePlugin` partially succeeds
(e.g. skills and commands unstaged but agents throws), the orchestrators filter
`sRecord.resources.*` by `outcome.dropped.*` rather than leaving the full record
pointing at files no longer on disk (ghost record) or dropping the entire record
(data loss).

**Verified:** 2026-06-02
**Status:** PASSED (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #  | Truth (ROADMAP SC)                                                                                                                                                                                                                          | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                  |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | uninstall.ts filters `sRecord.resources.{skills,prompts,agents,mcpServers}` by `outcome.dropped.*` on `outcome.ok===false`; cascade primitive itself makes NO state mutation                                                                  | VERIFIED    | `uninstall.ts:216-244` non-AG-5 arm: in-place `.filter()` on all four `sRecord.resources.*` axes via `dropped = localOutcome.dropped` local alias; closure returns without throw so guard's saveState commits shrunken row; `sRecord` aliases `installed` which IS `mp.plugins[plugin]`. `shared.ts:317-395` cascadeUnstagePlugin is untouched (no writes outside its own `dropped` local var and the `Object.freeze`'d return value).                                                              |
| 2  | remove.ts applies the same filter in its per-plugin loop                                                                                                                                                                                     | VERIFIED    | `remove.ts:202-243` per-plugin loop's `else` arm: `if (!(cause instanceof AgentsUnstageFailureError))` block at lines 225-239 mutates `plugin.resources.{skills,prompts,agents,mcpServers}` in place using the same `dropped.{skills,commands,agents,mcpServers}` mapping; `failedPlugins.push` runs in both branches; loop never throws so guard's trailing saveState writes the shrunken record. `plugin` is the SAME object as `record.plugins[pluginName]` (loop variable shares reference). |
| 3  | When `cause instanceof AgentsUnstageFailureError` (AG-5 foreign-content), the state row is preserved intact (not filtered)                                                                                                                  | VERIFIED    | `uninstall.ts:220-223`: `if (cause instanceof AgentsUnstageFailureError) throw cause;` re-throws out of the guard so ST-7 aborts saveState (row preserved on disk). `remove.ts:225`: `if (!(cause instanceof AgentsUnstageFailureError))` guards the filter -- AG-5 falls through unmodified; only `failedPlugins.push` fires (no filter, no delete). Both paths use typed `instanceof` discrimination (NOT substring matching).                                                              |
| 4  | Regression test asserts both shapes: (a) cascade-failure-after-partial-success shrinks resources.*; (b) AG-5 cause preserves full row                                                                                                       | VERIFIED    | `uninstall.test.ts:1193-1301` (TR-03 non-AG-5 partial: re-loads state, asserts `resources.skills=["skill2"]`, `resources.prompts=["cmd2"]` -- LOCKS the asymmetry mapping; agents/mcpServers untouched; 1 error notification with `(failed) {permission denied}`; NO reload-hint trailer). `uninstall.test.ts:1303-1407` (TR-03 AG-5: re-loads state, asserts all four `resources.*` axes UNCHANGED at full pre-cascade content). Mirror pair `remove.test.ts:666-770` + `:772-866` covers same shapes in the multi-plugin loop. |
| 5  | `npm run check` GREEN; no regression from Phase 38 baseline (1358 tests)                                                                                                                                                                     | VERIFIED    | `npm run check` output captured this run: `ℹ tests 1362 / pass 1362 / fail 0 / duration_ms 17093.586`. Delta: +4 tests (1358 baseline + 4 new TR-03 tests = 1362 expected, observed). Typecheck + lint + format also pass (single command).                                                                                                                                                  |

**Score: 5/5 truths verified**

### Required Artifacts (PLAN frontmatter must_haves)

| Artifact                                                                          | Expected                                                                                                                                                                                                              | Status     | Details                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`              | Hybrid AG-5-throw + non-AG-5-sentinel-filter inside withStateGuard; new `cascadeFailure` sentinel + post-guard `PluginFailedMessage` emission BEFORE post-state cleanup; `narrowCascadeFailure` reused for Reason mapping. Contains `instanceof AgentsUnstageFailureError`. | VERIFIED   | All structural elements present at the correct line ranges. `cascadeFailure: Error \| undefined` declared at line 163 outside the guard. `instanceof AgentsUnstageFailureError` appears 2x (line 93 in narrowCascadeFailure helper -- unchanged; line 220 in the new closure branch). Post-guard branch at lines 295-313 emits PluginFailedMessage then `return` BEFORE cache-drop + dataDir cleanup at lines 315-344. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`            | Per-plugin loop else arm extended with non-AG-5 in-place filter on `plugin.resources.{skills,prompts,agents,mcpServers}`; AG-5 case skips filter; `failedPlugins.push` happens in BOTH branches; trailing saveState commits shrunken record. Contains `instanceof AgentsUnstageFailureError`. | VERIFIED   | Loop at lines 202-243. `failedPlugins.push` at line 241 is the SINGLE push site (fires for both branches). `if (!(cause instanceof AgentsUnstageFailureError))` at line 225 guards the four-line `.filter()` block at 227-238. `instanceof AgentsUnstageFailureError` appears 2x (line 103 in narrowCascadeFailure -- unchanged; line 225 in the loop). `delete record.plugins[pluginName]` stays inside the `if (outcome.ok)` arm (line 208). |
| `tests/orchestrators/plugin/uninstall.test.ts`                                    | Two new TR-03 unit tests appended (PU-TR03-A non-AG-5 + PU-TR03-B AG-5)                                                                                                                                                | VERIFIED   | 2 new tests at lines 1193 and 1303. Both seed via `seedState`, stub `cascade`, call `loadState` AFTER orchestrator returns (Pitfall 3 mitigation -- asserts ON-DISK state), and use `assert.deepEqual` on the four `resources.*` arrays. PU-TR03-A asserts `["skill2"]` + `["cmd2"]` (LOCKS the dropped.commands -> resources.prompts asymmetry).                                                                       |
| `tests/orchestrators/marketplace/remove.test.ts`                                  | Two new TR-03 unit tests appended (MR-TR03-C non-AG-5 partial + MR-TR03-D AG-5)                                                                                                                                        | VERIFIED   | 2 new tests at lines 666 and 772. Both seed 2 plugins (or 1 for AG-5) via `seedState`, stub `cascade`, call `loadState` AFTER. MR-TR03-C asserts `["skill2"]`/`["cmd2"]` for failed plugin, `"plugin-ok" in mp.plugins === false` for successful plugin (Pitfall 5 mitigation -- shrunken row NOT deleted), MR-7 invariant (mp retained when any plugin failed). MR-TR03-D asserts all `resources.*` UNCHANGED.    |

### Key Link Verification

| From                              | To                                                                                                          | Via                                                                              | Status   | Details                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `uninstall.ts`                    | `marketplace/shared.ts (AgentsUnstageFailureError export at line 55)`                                       | `import { AgentsUnstageFailureError, cascadeUnstagePlugin } from "../marketplace/shared.ts"` at line 49 | WIRED    | Import at line 49; consumed by `instanceof AgentsUnstageFailureError` at line 220.                                                                                  |
| `remove.ts`                       | `marketplace/shared.ts (AgentsUnstageFailureError export at line 55)`                                       | `import { AgentsUnstageFailureError, cascadeUnstagePlugin, resolveScopeFromState } from "./shared.ts"` at lines 48-52 | WIRED    | Import at lines 48-52; consumed by `instanceof AgentsUnstageFailureError` at line 225.                                                                              |
| `uninstall.ts` filter block       | `outcome.dropped.commands -> sRecord.resources.prompts`                                                     | `dropped = localOutcome.dropped`, then `sRecord.resources.prompts.filter((n) => !dropped.commands.includes(n))` | WIRED    | Lines 229 (alias) + 233-235 (filter). Inline comment at 212-215 documents the asymmetry mapping.                                                                  |
| `remove.ts` filter block          | `outcome.dropped.commands -> plugin.resources.prompts`                                                      | `const dropped = outcome.dropped`, then `plugin.resources.prompts.filter((n) => !dropped.commands.includes(n))` | WIRED    | Lines 226 (alias) + 230-232 (filter). Inline comment at 222-224 documents the asymmetry mapping.                                                                  |

### Behavioral Spot-Checks

| Behavior                                                                                              | Command                                                                                                                                                            | Result                                                                  | Status |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------ |
| `npm run check` GREEN at 1362 tests                                                                   | `npm run check`                                                                                                                                                    | `tests 1362 / pass 1362 / fail 0 / duration_ms 17093`                  | PASS   |
| `dropped.commands` paired with `resources.prompts` in BOTH files (asymmetry-mapping cross-check)      | `grep -nE "dropped\.commands" extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | Both files show `dropped.commands.includes(n)` paired with `resources.prompts.filter(...)` immediately above. | PASS   |
| `instanceof AgentsUnstageFailureError` discrimination present in both fix-site closures (not just imports/helpers) | `grep -nE "instanceof AgentsUnstageFailureError" .../uninstall.ts .../remove.ts`                                                                                  | uninstall.ts:220 (closure body), remove.ts:225 (loop body). Plus pre-existing lines 93 / 103 in narrowCascadeFailure helpers. | PASS   |
| `cascade primitive` (shared.ts:317-395) untouched in this phase                                       | `git diff 685d10e^..302ba4b --stat`                                                                                                                                | shared.ts NOT in the diff; only uninstall.ts, remove.ts, and the 2 test files modified. | PASS   |
| Existing PU-3+PU-7 + MR-4 invariants preserved                                                        | Implicit via `npm run check` GREEN at 1362 tests (1358 baseline + 4 new, no regressions). PU-3+PU-7 test at uninstall.test.ts:347, MR-4 at remove.test.ts:338 unmodified. | All baseline tests pass.                                                | PASS   |

### Requirements Coverage

| Requirement | Source Plan      | Description                                                                                                                                                                                                                                                                                | Status     | Evidence                                                                                                                                                                          |
| ----------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TR-03       | 39-01-PLAN.md    | Cascade ghost-record correctness: orchestrators materialize `outcome.dropped.*` into a partial `sRecord.resources.*` filter on `outcome.ok===false`; cascade primitive stays read-only on state; AG-5 foreign-content cause preserves the full state row rather than stripping it. | SATISFIED  | All 5 ROADMAP SCs VERIFIED above; PLAN must_haves all VERIFIED; 4 new regression tests assert ON-DISK state via `loadState` after orchestrator returns (Pitfall 3 mitigation). |

### Known Executor Deviations -- Audit

| Deviation                                                                                       | Audit Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Removed unused outer `outcome` variable in uninstall.ts (ESLint `noUnusedLocals`)               | ACCEPTABLE. The PLAN's Pattern 1 reasoned in terms of `let outcome: UnstageOutcome \| undefined` hoisted from inside the closure so the post-guard path could read `outcome.dropped` etc. The executor instead bound `const localOutcome = await cascade(...)` strictly INSIDE the closure (line 199) and consumed `localOutcome.dropped` via the `dropped = localOutcome.dropped` local at line 229. This is structurally equivalent for SC#1: the filter still runs in-place on `sRecord.resources.*` inside the guard; the post-guard branch never needed to re-read `outcome` (only `cascadeFailure`, which IS hoisted at line 163). TypeScript strict + ESLint `noUnusedLocals` correctly flagged the hoisted `let outcome` as dead. The fix is semantically identical and cleaner. |
| Removed stale `eslint-disable-next-line` directive above `if (cascadeFailure !== undefined)`    | ACCEPTABLE. The `no-unnecessary-condition` rule correctly accepts `cascadeFailure !== undefined` because the variable is typed `Error \| undefined` and TS flow analysis cannot prove the inner closure executed and set it. The disable comment was over-cautious and ESLint flagged it as unused. Removing it is a hygiene fix; the runtime branch behavior is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                              |

Both deviations are surface-level (lint hygiene) and do not affect the semantics
of SC#1-5. They were folded into the same Task 1 commit (`685d10e`) per CLAUDE.md
Conventional Commit policy.

### Anti-Patterns Found

None. Specifically:

- No `TBD` / `FIXME` / `XXX` debt markers introduced in the 4 modified files.
- No `TODO` / `HACK` / `PLACEHOLDER` cleanup comments introduced.
- No substring matching used for AG-5 detection (typed `instanceof` only -- Pitfall 2 / Pattern 3 honored).
- No mutation of `outcome.dropped` (Pitfall 6 -- the four `.filter()` calls return new arrays; the frozen source is never written to).
- No deletion of `record.plugins[pluginName]` from the `else` arm in remove.ts (Pitfall 5 honored).
- No new state-mutation paths in `cascadeUnstagePlugin` (SC#1 explicit: cascade stays read-only; verified by git diff showing shared.ts unchanged in this phase).

### Gaps Summary

None. All five ROADMAP Success Criteria + all four PLAN must_have artifacts +
all four key links VERIFIED. The two executor deviations are lint-hygiene only
and do not affect semantics. `npm run check` GREEN at the expected count (1362
= 1358 baseline + 4 new).

The hybrid AG-5-throw + non-AG-5-sentinel pattern in uninstall.ts is the
correct shape: AG-5 abort-save preserves PU-3+PU-7 verbatim, while the
non-AG-5 sentinel + post-guard branch commits the shrunken row before
emitting the PluginFailedMessage (the existing notification surface stays
byte-identical). The remove.ts per-plugin loop's additive `if (!(cause
instanceof AgentsUnstageFailureError))` block is the minimum-diff fix:
the loop continues to be fail-soft, the guard's trailing saveState commits
the shrunken record, and the trailing `if (failedPlugins.length === 0)
delete state.marketplaces[opts.name]` keeps the marketplace record when any
plugin failed (MR-7 unchanged).

The four new regression tests are well-shaped: all four re-load state from
disk via `loadState(locations.extensionRoot)` after the orchestrator returns,
which catches Pitfall 3 (in-memory-only mutations that never reach
state.json). The asymmetry mapping `dropped.commands -> resources.prompts`
is locked by direct array-content assertions (`assert.deepEqual(...,
["cmd2"], "resources.prompts filtered via dropped.commands -> resources.prompts mapping")`).

---

## VERIFICATION PASSED

All 5 ROADMAP Success Criteria + all 4 PLAN must-have artifacts +
all 4 key links VERIFIED. Phase 39 (TR-03) goal achieved. No gaps.
No human verification needed. Ready to proceed to Phase 40.

_Verified: 2026-06-02_
_Verifier: Claude (gsd-verifier)_
