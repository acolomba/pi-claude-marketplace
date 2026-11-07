---
phase: 06-release-docs-and-combined-tree
reviewed: 2026-11-05T04:13:20Z
depth: standard
iteration: 2
files_reviewed: 10
files_reviewed_list:
  - README.md
  - README.es.md
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - test/architecture/gate-targets.ts
  - test/architecture/manifest-lookup-drift.test.ts
  - test/orchestrators/edge-deps.test.ts
  - test/orchestrators/plugin/list-installed-row.test.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
  necessity: 1
status: issues_found
---

# Phase 6: Code Review Report (iteration 2, re-review after --fix)

**Reviewed:** 2026-11-05T04:13:20Z
**Depth:** standard
**Files Reviewed:** 10 (the source, test, and README files of fix commits `8a2ccd9..71a37c4`: 4ef28fa WR-01, 970f5e2 WR-02, 4dc6a36 WR-03, 71a37c4 report). I also read the planning records that WR-03 changed (06-CONTEXT.md D-P6-22, ARCHITECTURE.md, 06-03-SUMMARY.md, the P6-PLN-03 entry in DUBIOUS-CHOICES.md).
**Status:** issues_found (Info only)

## Summary

All three iteration-1 warnings are resolved. The fixes add no Critical or Warning defect.

What I verified:
- **`list` output is byte-identical for every record state.** `composeInstalledListRow` (`list-installed-row.ts:208-287`) still computes `scopeField`, `descriptionField`, and `notInManifest` the same way. The helper's disabled short-circuit (`:175-177`) uses the same `isRecordedButDisabled` predicate and still runs before any verdict read or candidate probe. The enabled path runs the same steps in the same order with the same arguments: `readRecordMcpVerdict` with `locationsFor(pluginScope, cwd)`, then `candidateFor(upgradeCandidate | {upgradable:false})`, then `classifyInstalledRecord`. The old `manifestEntry === undefined` test and the new `lookup.kind === "declared"` test agree for the `declared`, `absent`, and `unverified` arms. Partial, upgradable, partially-upgradable, not-in-manifest, and installed rows are projected by unchanged code. An uncontained legacy record goes through the same `readRecordMcpVerdict` call with the same `locations`, so its stored verdict is kept as before.
- **Completion's mapping matches what it showed before.** Before the fix, a disabled record reached `classifyInstalledRecord`, whose `isRecordedButDisabled` branch returned `installed`. Now `completionStatus` maps `{kind:"disabled"}` to `installed` (`edge-deps.ts:134-136`). Enabled records pass `view.status` through unchanged, `partially-installed-upgradable` included. `lookupDeclaredPlugin` is the same `plugins.find(p => p.name === name)` (`domain/manifest-lookup.ts:54-60`) that completion inlined before. `upgradeCandidate` reads no field that the larger options object adds (`manifestPath`, `mcpImplementation`, `lookup`). The only change is the intended one: a disabled record no longer reads its MCP verdict, so the `[mcp] ... unreadable` debug line is gone.
- **The D-99-02a gate has no gap.** `manifest-lookup-drift.test.ts` walks every `.ts` file under the extension (`:140-202`). Removing `edge-deps.ts` from `NON_ABSENCE_LOOKUPS` makes the gate stricter: if someone put a raw `.plugins.find(...name ===` back into edge-deps, the walk would report it as an offender. Before, the allowlist hid it. The position-order clause and the `DECLARED_MODULE_ORDER` list were updated together, and the gate's doc comment now says "two" lookups.
- **The README remedy is correct under both implementations.** `{requires builtin mcp}` now says to remove pi-mcp-adapter if it is loaded, then turn on Pi's built-in MCP, and links `docs/mcp-compatibility.md#choosing-an-implementation`. That section (`docs/mcp-compatibility.md:17-28`) gives both steps, including removing `-builtin:mcp` and restarting Pi. The adapter's precedence (`platform/pi-api.ts:340-352`) makes the first step necessary when the adapter is active. The condition "if it is loaded" keeps the step harmless when no implementation is active.
- **EN/ES parity holds.** The same commit (4ef28fa) changed both files. Each has 541 lines, 22 headings, and 30 table rows. The Spanish row translates both sentences and the link text, and the href is identical.
- `tsc --noEmit` exits 0. ESLint `--max-warnings 0` passes on the 8 changed TS files. `fallow audit --base 8a2ccd9` reports no issues. `edge-deps`, `list-installed-row`, `plugin-state-classifier`, `list-flow`, and `manifest-lookup-drift` pass. The new disabled-record cases discriminate: the fixture is a legacy record whose manifest is missing, so a verdict read would log the `unreadable` line that the cases assert is absent.

What remains is Info only: six iteration-1 Info items still open (IN-03 is resolved), and two new Info items about leftovers of the WR-02 refactor.

## Iteration-1 Warnings: status

| ID    | Status   | Evidence |
| ----- | -------- | -------- |
| WR-01 | Resolved | `README.md:185` and `README.es.md:185` now say to remove pi-mcp-adapter if it is loaded, then turn on the built-in MCP, and link the steps. The linked section covers `-builtin:mcp`. |
| WR-02 | Resolved | `classifyInstalledForImplementation` (`list-installed-row.ts:171-205`) is the only composition of the verdict read, `candidateFor`, and `classifyInstalledRecord`. Both `composeInstalledListRow` (`:218`) and `classifyInstalledPluginRow` (`edge-deps.ts:155-163`) call it. Completion uses `lookupDeclaredPlugin`. The false parity-test sentence is gone from the classifier header (`plugin-state-classifier.ts:4-12`). |
| WR-03 | Resolved (by amendment) | D-P6-22 in 06-CONTEXT.md:218-220 records the stamp-and-rebuild design. P6-PLN-03 is defined in `.planning/DUBIOUS-CHOICES.md:1358`. `completion-cache.ts:85-90` states the cross-process rebuild cost, and `pluginIndexKey` (`:173`) notes that its key names no implementation. ARCHITECTURE.md and 06-03-SUMMARY.md now say "stamped". The behavior did not change, which matches the second fix option. |

## Resolved Info

### IN-03 (iteration 1): Completion reads the MCP verdict of disabled records -- RESOLVED

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts:175-177`
**Evidence:** The shared helper returns `{kind:"disabled"}` before `readRecordMcpVerdict`. `test/orchestrators/edge-deps.test.ts:610-653` asserts no debug line for a disabled legacy record and one line for its enabled twin.

## Info

### IN-01: The cucumber completion step injects the profile's implementation instead of the one Pi reports -- STILL OPEN

**File:** `features/step_definitions/completion.steps.ts:14-17`, `features/lib/plugin-completions.ts:27-38`
**Issue:** Unchanged since iteration 1. The step calls the provider in-process with `this.mcpProfile`, so no scenario covers `register.ts`'s per-lookup `openNotificationSnapshot(pi).softDeps.mcpImplementation`. Only `test/edge/register.test.ts` covers it.
**Fix:** Drive at least one built-in completion scenario through the profiled Pi's registered command, or keep the gap recorded as a known limit.

### IN-02: Phase-scoped decision IDs cited in durable code, tests, and features are not recorded in PROJECT.md -- STILL OPEN (grown)

**File:** `orchestrators/edge-deps.ts:139`, `orchestrators/plugin/list-installed-row.ts:163`, `shared/completion-cache.ts:173`, `test/orchestrators/edge-deps.test.ts:610`, `test/orchestrators/plugin/list-installed-row.test.ts:807,838`, and the iteration-1 sites
**Issue:** The fix commits added five more `D-P6-2x` citations: 28 before, 33 after (`git grep -c 'D-P6-2[0-9]' -- extensions test features`). Two of them are in test titles. `typescript-unit-tests/rules/cases.md` says a test title may cite a durable requirement ID, but not a plan or phase reference. PROJECT.md still defines no `D-P6-*` ID. The new `P6-PLN-03` citation in `.planning/codebase/ARCHITECTURE.md:184` points to a dubious-choice entry, not to a decision.
**Fix:** As in iteration 1. Carry D-P6-18, D-P6-22 (with its amendment), and D-P6-23 into PROJECT.md's decision table, or cite the durable requirement instead (MREC-03, ENBL-04, MSEL-01). Then retitle the two new test cases.

### IN-04: The CHANGELOG understates which completions now follow the implementation -- STILL OPEN

**File:** `CHANGELOG.md:28`
**Issue:** Unchanged. The bullet names only `install` and `update --partial`. Plain `update`, `fetch`, and `install --partial` completions also follow the implementation.
**Fix:** "Tab completion of plugin names now follows the MCP implementation Pi runs, as `list` does."

### IN-05: The cache schema re-lists the implementation literals instead of deriving them -- STILL OPEN

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts:96`
**Issue:** Unchanged. The fix added comment lines only, so the code moved down by six lines. If a fourth `ActiveMcpImplementation` were added, the schema would reject its stamp, and the compiler would not report it.
**Fix:** Add a compile-time check, such as `ActiveMcpImplementation satisfies Static<typeof STAMP>`, or build the union from one exported tuple.

### IN-06: The direct-swap grant test cannot tell whether the code reads `args.run` or `args.mcpImplementation` -- STILL OPEN

**File:** `test/orchestrators/plugin/update-swap.test.ts:2583-2593`
**Issue:** Unchanged. The direct case sets `run: builtinRun()` and `mcpImplementation: "builtin"`, so the two values agree.
**Fix:** Give the direct case a run that disagrees with `mcpImplementation`, for example `run: runWithAllLoaded()` with `mcpImplementation: "builtin"`.

### IN-07: Phantom requirement -- an unstamped cache read exists only for test fixtures -- STILL OPEN

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts` (`GetPluginIndexOptions.mcpImplementation` and the absent-stamp branch)
**Category:** necessity
**Issue:** Unchanged. All three production callers pass the option. The optional field exists to keep test files working (P6-DC-0301). A future production caller that omits it would still compile. Its reads would rebuild the file each time, because they never match the production stamp. This rests on judgment.
**Fix:** Make `mcpImplementation` required, and stamp the test seeds with `"none"`.

### IN-08: The disabled branch of `classifyInstalledRecord` is unreachable in production, and its rewritten comment says completion relies on it (new)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:31-39,151-164`; `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:134-136`
**Issue:** After WR-02, the only production caller of `classifyInstalledRecord` is `list-installed-row.ts:199`. That call runs after the helper returns early for `isRecordedButDisabled(record)` (`:175-177`), so the `if (isRecordedButDisabled(record)) return "installed"` branch at `plugin-state-classifier.ts:162` runs only in `plugin-state-classifier.test.ts`. The `enabled` input is always `true` in production. The rewritten comments say otherwise. The header says "The classifier collapses such a record to `installed` the same way". The branch comment says the collapse "matches what completion offers for it". Completion gets that value from `completionStatus` in `edge-deps.ts`, not from the classifier. The rule "disabled means `installed` for completion" is now written in two places, and only one of them runs. This is dead code (category 3), not a necessity finding.
**Fix:** Pick one place for the rule. One option is to keep the branch as an explicit defensive guard and reword both comments: "unreachable from `classifyInstalledForImplementation`, which answers a disabled record first; kept so a direct caller cannot split a frozen record". The other option is to remove the branch and the `enabled` field from `InstalledRecordLike`, move the disabled cases of `plugin-state-classifier.test.ts` to `classifyInstalledForImplementation`, and remove `plugin-state-classifier.ts` from `DISABLED_STATE_TARGETS` (`test/architecture/gate-targets.ts:116`).

### IN-09: The new edge-deps cases break two case-structure rules (new)

**File:** `test/orchestrators/edge-deps.test.ts:610-653`
**Issue:** `typescript-unit-tests/rules/cases.md` says "one top-level `describe()` per entrypoint" and "Do not put a conditional in the loop body". The fix adds a fourth `describe` for the same entrypoint, `loadManifestForMarketplace` (`:610`), next to the existing ones at `:655` and `:688`. It also adds a ternary inside the loop body (`const recordLabel = enabled ? "an enabled" : "a disabled"`, `:630`). The existing describe at `:720` has the same ternary. The title "with N verdict read(s)" counts debug lines, not reads. That holds only because the fixture is a legacy record that the manifest no longer declares. The file already had the extra describes, so this follows an existing deviation.
**Fix:** Put `recordLabel` in each data row (`{ recordLabel: "a disabled", enabled: false, ... }`). Title the rows by the observable fact: "logs N unreadable-verdict line(s)". When this file is next restructured, merge the `loadManifestForMarketplace` describes into one.

---

## Dubious Choices

- **Choice:** The shared helper lives in `list-installed-row.ts` and takes `ComposeInstalledListRowOptions`, so completion builds "list row" options to classify a cache row.
  **Alternatives:** Put the helper in `plugin-state-classifier.ts` (but that file is pure by NFR-5 and must not do I/O), or in `mcp-verdict-read.ts` (where the cycle note applies). Or keep it in `list-installed-row.ts` and name the options type for the shared role (`InstalledRecordFacts`), with `ComposeInstalledListRowOptions` as an alias.
  **Why:** `edge-deps.ts` already imported from `list-installed-row.ts`, so this adds no new zone edge, and the classifier stays pure.
  **Severity:** Low. It is correct. The name suggests list ownership of a contract that two surfaces now share.

- **Choice:** The exported type is named `InstalledRecordView`, which `orchestrators/plugin/info.ts:1495` already uses for a private interface with a different shape.
  **Alternatives:** A distinct name, such as `InstalledClassificationView`.
  **Why:** Neither module imports the other's type, so the compiler sees no clash.
  **Severity:** Low. A future import into `info.ts` would have to alias one of them, and grep returns both.

- **Choice:** WR-03 was closed by amending D-P6-22 (stamp and rebuild), not by keying the cache file by implementation.
  **Alternatives:** Per-implementation memory keys and file names, with `dropMarketplaceCache` unlinking every variant.
  **Why:** The six drop sites stay unchanged (P6-PLN-03), and correctness never depended on the key.
  **Severity:** Low. The cost is now documented (`completion-cache.ts:85-90`). Processes that run different implementations on one user-scope marketplace still rebuild the file in turn.

- **Choice:** The disabled→`installed` rule for completion moved into `edge-deps.ts::completionStatus`, but the old copy in the classifier was kept (IN-08).
  **Alternatives:** Remove the classifier branch, or mark it as a deliberate guard.
  **Why:** Keeping the branch avoided changes to the ENBL-05 gate and the classifier test cases.
  **Severity:** Low. No behavior changes. The comments mislead about which code runs.

- **Choice:** The fixer wrote no cross-surface parity test (list row vs. completion row for each implementation). It relies on the shared composition.
  **Alternatives:** The drift-guard test that the iteration-1 fix offered as the second option.
  **Why:** With one composition, a parity test would only check `completionStatus` and the list projection, and both are small and visible.
  **Severity:** Low. The two projections that remain (`completionStatus` and `composeInstalledListRow`'s status-to-row mapping) are still per-surface. A new `InstalledClassification` member would be checked by the compiler in `completionStatus` only through the `PluginIndexRow["status"]` return type.

_Reviewed: 2026-11-05T04:13:20Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
