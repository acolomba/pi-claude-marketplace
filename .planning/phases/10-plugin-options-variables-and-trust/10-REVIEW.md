---
phase: 10-plugin-options-variables-and-trust
iteration: 2
reviewed: 2026-11-15T20:34:51Z
depth: standard
diff_base: b61555b4
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - features/lib/mcp-configuration.ts
  - features/mcp-server/builtin-options.feature
  - features/mcp-server/legacy-move.feature
  - features/step_definitions/mcp-server/builtin-options.steps.ts
  - features/step_definitions/mcp-server/legacy-move.steps.ts
  - test/bridges/hooks/spawn-helpers.test.ts
  - test/orchestrators/mcp/builtin-registration-step.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
  - test/persistence/state-io.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
  necessity: 0
status: issues_found
---

# Phase 10: Code Review Report (iteration 2)

**Reviewed:** 2026-11-15T20:34:51Z
**Depth:** standard
**Files Reviewed:** 12 (`git diff b61555b4 HEAD -- extensions features test`)
**Status:** issues_found (Info only)

## Summary

This pass re-reviews the three iteration-1 Warning fixes: 75805061 (WR-03), 50106f97 (WR-01), and 99c33372 (WR-02, under D-PG10-25). It also covers the harness fixture `features/lib/mcp-configuration.ts`. I traced each fix to its callers. For WR-01 that meant `migrateLocked`, `recordAction`, `stageOwner`/`stagedSource`, and the load order in `index.ts`: `loadReconcile`, then `resyncBuiltinRegistrations`, then `applyForLoad`. That order means the moved record's `userConfig` is read later in the same load. For WR-02 I covered the three readers of `recordedOptionsOf`: `plugin-options.ts:74`, `builtin-registration-step.ts:264`, and `event-router.ts:696`. I also checked pi-mcp-adapter 7.0.1's `utils.ts` and `server-manager.ts`, and Claude Code 2.1.323's hook option order as 10-RESEARCH records it (`:470`).

The four owner test files pass when run in isolation (242/242).

- **WR-01: fixed and complete.** `applyStagedOptions` now runs for every `move` owner, whatever the verdict, and it is independent of `applyNeutralVerdict`. The `disabled` and `malformed` arms leave `userConfig` unchanged, as their stage writes no option reference. The two new or changed owner cases fail without the fix: with a neutral record and no name change, the old code returns `false` and saves nothing. The new `@mcp` scenario in `legacy-move.feature` also fails without the fix under both profiles. Under the adapter, no variable is set, so the tool name is empty. Under the built-in MCP, the record has no `userConfig`, so the literal reference is registered (D-PG10-21). Its `Given` asserts `compatibilityBasis: "neutral"`, so the scenario does reach the early return that caused the bug. The reversed D-PG10-15 owner case is the recorded WR-01 residual, so I do not report it.
- **WR-02: fixed as D-PG10-25 states.** `resolveOptions({})` has only three consumers, and none of them reads `declared` except through `declaredOptions` in the built-in step. So the change reaches only the built-in lane. The hooks and the variable pass behave as before. The new owner case is strict-mock. It fails if the `keyed` server registers with literal text, and also if the whole plugin is skipped. The `@builtin-only` scenario rules out both wrong implementations, and a third that reads the manifest default `abc`.
- **WR-03: resolved as parity.** 10-RESEARCH `:470` reads `if(wo)Fi=Frn(Fi,wo)` after the three path variables, so the two passes match upstream. `fillPluginOptions` is one `replace`, so an option value is never scanned again. The new owner case pins the order, so a later change to a single pass fails it. It passes before and after the commit, which is expected for a parity pin.
- **Fixture:** `SUBSTITUTED_VARIABLE` matches 0.19.2's `VAR_RE` (`git show v0.19.2:.../bridges/mcp/substitute.ts:36`) exactly. The regex has no `g` flag, so `.test` keeps no `lastIndex` state between calls. Loosening the old guard, which rejected any `${`, now matches what 0.19.2 really wrote.

I found no Critical or Warning issue. The three Info items cover comments that no longer describe the code, and one claim in D-PG10-25 that is false for the adapter lane. That claim matters to the pending maintainer review.

## Narrative Findings (AI reviewer)

## Info

### IN-09: D-PG10-25's "every reader fails closed" is false under pi-mcp-adapter: a stdio server starts with empty option values

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:348-352` (the same claim is in `.planning/PROJECT.md` D-PG10-25)
**Issue:** The doc comment lists "no option variable is set" as one way the corrupt record fails closed. But the entries staged in `mcp-adapter.json` still hold `${PI_CLAUDE_MARKETPLACE_OPTION_<hex>}`. pi-mcp-adapter 7.0.1 expands an unset name to `""` (`node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/utils.ts:151`). It checks for a missing variable only in `url` (`utils.ts:286`) and `caFile` (`http-ca.ts:25`). Stdio `args` are expanded with no such check (`server-manager.ts:1214`), and `env` is expanded the same way. So for one corrupt record, the two implementations now act differently. The built-in MCP leaves the server out. The adapter starts it with blank option values, and nothing tells the user. This is not a regression, because the adapter lane behaved the same way before 99c33372. The adapter cannot fail closed without a load-time restage, which APL-D1 forbids, so this is a policy matter and only the claim is wrong.
**Fix:** Change the comment and the D-PG10-25 text to describe each lane as it behaves. The built-in MCP skips the server. Under pi-mcp-adapter, a stdio server starts with each option reference empty, and a remote server fails at connect with "Missing environment variable". The maintainer can then judge the policy with the real adapter behavior in view.

### IN-10: The path-pass paragraph of `planSpawn` still says "a spliced value is never rescanned", which the next paragraph now contradicts

**File:** `extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts:49-50` vs `:54-57`
**Issue:** 75805061 added the correct statement that the option pass reads the path pass's output. But the sentence iteration 1 flagged, "One pass: a spliced value is never rescanned.", is still in the paragraph above it. Read alone, it states the invariant that WR-03 showed this lane does not have.
**Fix:** Limit the sentence to its own pass, for example "The path pass is one pass: it never rescans a value it spliced.", or delete it, since `:54-57` now gives the full rule.

### IN-11: The move's comments still say it changes only MCP fields and takes them from the recorded version, but it now writes `userConfig` from the staged source

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:12-13`, `:62-66`, `:626-628`
**Issue:** The header says `state.json` is written "when a record's MCP inventory changed". It also says "the record's verdict and server configs still come from the recorded version only". The `recordAction` doc says "Nothing else on the record changes: the move is MCP-only." After 50106f97 the move also writes `userConfig`, and from the staged source, which can be a newer path-source version. The hooks hydrate also reads `userConfig` (`event-router.ts:696`), so the change reaches more than MCP. That reach is the recorded WR-01 residual. A reader who trusts these comments will not see it.
**Fix:** Add `userConfig` to the header's list of what the record write covers, and say that it follows the staged source (reinstall parity, D-PG10-23). Replace "the move is MCP-only" with a phrase that names the option schema too, for example "the move changes only the MCP fields and the option schema the stage resolved".

## Carried Info (not re-reviewed)

These iteration-1 Info findings are out of scope for the fix pass. They are carried forward unchanged so that they are not lost.

- **IN-01:** `domain/claude-mcp-variables.ts:242-259`: `optionPieces` finds each match again with `indexOf`. A skipped reference can mis-split a field. No current caller can reach that branch, so the code is fragile, not broken.
- **IN-02:** `shared/probe-classifiers.ts:210-212`, `orchestrators/plugin/install.messaging.ts:555-557`: on the `unavailable` arm, the unset-required note reads as `unsupported source`, a token on the wrong axis.
- **IN-03:** `bridges/hooks/async-rewake/registry.ts:314` / `dispatch-exec.ts:200-207`: on the async lane, the D-PG10-08 and D-PG10-10 refusals reach only the debug log.
- **IN-04:** `shared/errors-bridges.ts:328-331`: the unset-option message tells the user to run `/plugin manage`, which Pi does not have.
- **IN-05:** `bridges/skills/stage.ts:404`, `bridges/commands/staged-command.ts:275-284`: the whole-file content pass writes option values into frontmatter fields with no escaping.
- **IN-06:** `index.ts:313-327` vs `:343-353`: the background autoupdate pass does not apply the option variables again.
- **IN-07:** `index.ts:215`, `:231`; `orchestrators/plugin-options.ts:107-110`: the load's option apply can be skipped by an earlier throw. The names inherited for an untrusted project then stay set.
- **IN-08 (necessity):** `domain/user-config.ts:105`, `:308-310`: the unsafe-character replace in `hookOptionVariableName` can never change a parsed key.

---

_Reviewed: 2026-11-15T20:34:51Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
