---
phase: 06-release-docs-and-combined-tree
reviewed: 2026-11-05T12:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - .fallowrc.json
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
  - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - features/lib/plugin-completions.ts
  - features/lib/turn-records.ts
  - features/lib/upstream/tool-search.ts
  - features/mcp-server/agent-grants.feature
  - features/mcp-server/implementation-switch.feature
  - features/mcp-server/lifecycle.feature
  - features/mcp-server/verdict-list.feature
  - features/step_definitions/completion.steps.ts
  - features/step_definitions/mcp-server/builtin-tool-search.steps.ts
  - CHANGELOG.md
  - README.md
  - README.es.md
  - docs/hooks-compatibility.md
  - docs/json-output.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
  necessity: 1
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-05T12:00:00Z
**Depth:** standard
**Files Reviewed:** 35 (28 primary source/harness files plus 7 user docs; the 50 changed test files were screened only for tests that cannot fail)
**Status:** issues_found

## Summary

I read the diff `37f1cfd..HEAD` of every primary file and its surrounding code. I traced these call chains: `register.ts` -> `makeLocationsResolver` -> `classifyInstalledPluginRow` / `probeManifestEntry`, the `LegacyServersSource.locations` threading at all eight call sites, the producers of `ThreePhaseArgs.mcpImplementation` (direct update, reinstall, dependency move, autoupdate via `beginPluginUpdateRun`, `apply` convergence), and `isPluginRootContained` in the built-in step and the legacy reader.

No blocker survived verification.
- The implementation stamp closes the cross-implementation leak for both the memory entry and the file.
- `readRecordMcpVerdict` cannot throw on the completion path, because `recordedMcpServers` folds every reader error, so NFR-2 holds.
- The containment move is behavior-preserving for the built-in step.
- Every `ThreePhaseArgs` producer sets `mcpImplementation` from its own run, so the `update-swap.ts` repoint is correct.
- The doc claims about Pi's tool-name cut (55 characters, `_`, the first 8 hex digits of sha256 of `server\0tool`) match `node_modules/@earendil-works/pi-coding-agent/dist/extensions/mcp/tools.js:45-50`. The worked example hash `ca340f16` reproduces.
- The claim that pi-mcp-adapter writes `-builtin:mcp` matches `pi-mcp-adapter/pi-builtin-mcp.ts:10`.
- Every D-MB ID that the docs cite is defined in PROJECT.md. BLT-06, MSEL-03, and MSEL-04 are in REQUIREMENTS.md.

These problems remain:
- One user-facing remedy in the README is wrong.
- The list/completion parity rests on duplicated composition, and the test that the code cites for it does not exist.
- The completion cache stamps one shared file, but D-P6-22 says the file is keyed by the implementation.

## Warnings

### WR-01: README remedy for `{requires builtin mcp}` does not work while pi-mcp-adapter is loaded

**File:** `README.md:185`, `README.es.md:185`
**Issue:** The marker table tells the user to "Turn on Pi's built-in MCP" for `{requires builtin mcp}`. The marker shows in two cases, per the D-MB-07 rule in `docs/output-catalog.md:69`: with no implementation active, or when *another* implementation is active. The only server that Pi's built-in MCP runs and pi-mcp-adapter blocks is one with `bareElicitationCapability` (`domain/mcp-server-features.ts:483-500` against `domain/mcp-builtin-features.ts:23-36`). Under pi-mcp-adapter that plugin shows `{unsupported mcp}{requires builtin mcp}`. Turning on the built-in does nothing there, for two reasons:
- `activeMcpImplementation` gives the adapter precedence (`platform/pi-api.ts:340-352`).
- The adapter writes `-builtin:mcp` back on its next version start (`pi-mcp-adapter/pi-builtin-mcp.ts:10`).

The remedy is only half right. The `{requires pi-mcp-adapter}` row is correct, because installing the adapter does win.
**Fix:** Make the remedy say what works in both cases, and mirror it in `README.es.md`. For example:
```markdown
| `{requires builtin mcp}` | Only Pi's built-in MCP runs every server of the plugin. | Remove pi-mcp-adapter if it is loaded, then turn on Pi's built-in MCP (see [Choosing an implementation](docs/mcp-compatibility.md#choosing-an-implementation)). |
```

### WR-02: List and completion parity is duplicated by hand, and the module header cites a parity test that does not exist

**File:** `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:143-188`, `extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts:171-195`, `extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts:7-12`
**Issue:** D-P6-22 promises that completion "never diverges from `list`" (`edge-deps.ts:294-298`). The installed-row composition is now written twice. Both copies run `readRecordMcpVerdict` -> `candidateFor(upgradeCandidate(...))` -> `classifyInstalledRecord({enabled, compatibility:{unsupported: effective.unsupported}}, ...)`, and they already differ:
- `list` short-circuits disabled records before the verdict read (`list-installed-row.ts:158`). Completion reads the verdict first.
- `list` finds the manifest entry with `lookupDeclaredPlugin`. Completion uses `parsed.plugins.find(...)` (`edge-deps.ts:305`).

The classifier header says "A parity drift-guard test (test/orchestrators/edge-deps.test.ts) asserts the two surfaces never diverge". No such test exists: `test/orchestrators/edge-deps.test.ts` never calls `composeInstalledListRow` or the list flow. The new per-implementation cases in that file pin hard-coded expectations, not agreement with `list`. A later change to one copy will drift silently.
**Fix:** Extract one helper, for example `classifyInstalledForImplementation(record, source, candidate, active)`, in `plugin-state-classifier.ts` or `mcp-verdict-read.ts`. Have `composeInstalledListRow` and `classifyInstalledPluginRow` both call it. Alternatively, add the drift-guard test that the header claims. For each of `adapter`, `builtin`, and `none`, it would run `composeInstalledListRow` and `makeLocationsResolver(...).loadManifestForMarketplace` over one fixture and assert the same bucket. If neither is done, delete the false sentence from the header.

### WR-03: The completion cache compares a stamp in one shared file, but D-P6-22 says the file is keyed by the implementation

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts:79-91,167-169,283-320`
**Issue:** D-P6-22 in 06-CONTEXT.md "Amendments after research" says: "the completion cache file is keyed by the implementation too, not only the memory key". The implementation does the opposite. `pluginIndexKey` is still `${scope}::${marketplace}`, and the path still comes from `pluginCacheFile(marketplace)`. Each entry or file carries one stamp, and a read under another stamp deletes the entry and overwrites the file. Correctness holds, because no read is served across implementations. But Pi processes that share a scope's cache file and run different implementations rebuild and rewrite each other's file on every lookup. A user-scope marketplace is shared this way, for example two projects whose `.pi/settings.json` differ on `builtin:mcp`. So does any switch back and forth. 06-03-SUMMARY records this as a note, not as a decision amendment, and the security audit flags the same gap.
**Fix:** Do one of the following:
- Key by implementation. Use `${scope}::${marketplace}::${mcpImplementation ?? "-"}` for memory, and a per-implementation file name from `ScopedLocations` (for example `pluginCacheFile(marketplace, implementation)`). `dropMarketplaceCache` then unlinks all variants.
- Record an amendment to D-P6-22 that accepts the stamp-and-rebuild design and its thrash.

## Info

### IN-01: The cucumber completion step injects the profile's implementation instead of the one Pi reports

**File:** `features/step_definitions/completion.steps.ts:14-17`, `features/lib/plugin-completions.ts:27-38`
**Issue:** The step calls the provider in-process with `this.mcpProfile`, so the verdict-list completion scenarios bypass `register.ts:192-200` (`openNotificationSnapshot(pi).softDeps.mcpImplementation`). Suppose register passed `"none"` or the registration-time value. Every completion scenario would still pass. Only `test/edge/register.test.ts` "classifies install completions for the MCP implementation each lookup reads" covers the per-lookup snapshot. In an `@own-implementation` scenario that switches implementation, the step would also classify for the run profile and not for the Pi actually running. The cucumber skill documents this choice (`rules/world-and-stand-ins.md:65`).
**Fix:** If the harness can drive completion through the profiled Pi's registered command (as the TUI completion steps do), use it for at least one built-in scenario. Otherwise keep the gap recorded as a known limit.

### IN-02: Phase-scoped decision IDs cited in durable code and features are not recorded in PROJECT.md

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts:79`, `orchestrators/edge-deps.ts:104,138`, `orchestrators/plugin/plugin-state-classifier.ts:10`, `edge/register.ts:191`, `features/mcp-server/implementation-switch.feature:82`, and others (20 `D-P6-22` and 1 `D-P6-18` additions)
**Issue:** CONVENTIONS.md says comments cite durable spec IDs. PROJECT.md defines no `D-P6-*` ID, although it carries D-P3-* and D-P5-*. Once the phase directory is archived, these citations point at nothing. `P2-DC-53` (`substitute.ts:209`) and `P2-DC-77` (`turn-records.ts:96`) are dubious-choice IDs from phase records.
**Fix:** Carry D-P6-18 and D-P6-22 into PROJECT.md's decision table (or mint D-MB IDs for them, as D-P6-24 did for P2-DC IDs). Alternatively, cite the durable requirement (MREC-03, MSEL-01, DUAL-04).

### IN-03: Completion reads the MCP verdict of disabled records, which `list` never does

**File:** `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts:150-166`
**Issue:** For a disabled legacy record, `readRecordMcpVerdict` re-resolves the plugin from disk, or logs an `unreadable` line on the `mcp` debug channel, on every cache rebuild. `classifyInstalledRecord` then returns `installed` without using the result (`plugin-state-classifier.ts:146-148`). This is wasted I/O and log noise, and one more divergence from `list` (see WR-02).
**Fix:** Return `{ name, status: "installed", version }` before the verdict read when `isRecordedButDisabled(installed)`, as `composeInstalledListRow` does.

### IN-04: The CHANGELOG understates which completions now follow the implementation

**File:** `CHANGELOG.md:28`
**Issue:** The bullet names only `install` and `update --partial`. The installed rows are classified per implementation for every mode that reads the plugin index (`edge/completions/data.ts:366,409`, `INSTALLED_INVENTORY_STATUSES`, `FETCH_STATUSES`). So plain `update`, `fetch`, and `install --partial` completions change too. An sse record under built-in MCP moves from `upgradable` to `partially-installed(-upgradable)`.
**Fix:** "Tab completion of plugin names now follows the MCP implementation Pi runs, as `list` does."

### IN-05: The cache schema re-lists the implementation literals instead of deriving them

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts:89-91`
**Issue:** `Type.Union([Type.Literal("adapter"), Type.Literal("builtin"), Type.Literal("none")])` repeats `ActiveMcpImplementation`. If a fourth implementation is added, the schema rejects its stamp. The file then reads as corrupt and rebuilds on every lookup, and the compiler gives no error, because the schema is a subset.
**Fix:** Add a compile-time check, for example `void (null as unknown as ActiveMcpImplementation satisfies Static<typeof STAMP>)`, or build the union from one exported tuple.

### IN-06: The direct-swap grant test cannot tell whether the code reads `args.run` or `args.mcpImplementation`

**File:** `test/orchestrators/plugin/update-swap.test.ts:2583-2593`
**Issue:** The direct case sets both `run: builtinRun()` and `mcpImplementation: "builtin"`. It would pass if `prepareUpdateAgents` still read `args.run.softDeps.mcpImplementation` for a direct swap. The cascade-over-notification case (`runWithAllLoaded()` against `"builtin"`) does discriminate for cascades, so the repoint is proven, but not for the direct path.
**Fix:** Give the direct case a run that disagrees, for example `run: runWithAllLoaded()` with `mcpImplementation: "builtin"`.

### IN-07: Phantom requirement -- an unstamped cache read exists only for test fixtures

**File:** `extensions/pi-claude-marketplace/shared/completion-cache.ts:248-254,231-236`
**Category:** necessity
**Issue:** `GetPluginIndexOptions.mcpImplementation` is optional, and "an absent option is its own stamp". All three production callers pass it (`edge/completions/data.ts:379,442,497`). The 06-03-SUMMARY says the absent branch exists to keep eleven test files working unchanged (P6-DC-0301). The same phase made `substituteAndInject`'s encoder required for exactly this reason (P2-DC-53: "no path writes one implementation's encoding by omission"). `LocationsResolverLike.mcpImplementation` is required too (D-P3-03). A future production caller that omits the option would not fail to compile. It would thrash against the production stamp and serve rows classified for no implementation. This rests on judgment, so it is Info.
**Fix:** Make `mcpImplementation` required on the cache read, and stamp the test seeds with `"none"`, as `LOOKUP_STAMP` in `test/edge/register.test.ts` already does.

---

## Dubious Choices

- **Choice:** Stamp-and-rebuild of one cache file per (scope, marketplace) instead of an implementation-keyed file (WR-03).
  **Alternatives:** A per-implementation file name and memory key; an amendment to D-P6-22.
  **Why:** It kept the six orchestrator invalidation sites unchanged (06-03-SUMMARY).
  **Severity:** Medium. It is correct, but it deviates from the recorded decision text and thrashes across concurrent processes.

- **Choice:** `recordedMcpServers` returns stored `mcpServerConfigs` of an uncontained record unchecked. Only the built-in step guards it with a separate `isPluginRootContained` call (`builtin-registration-step.ts:161-164`).
  **Alternatives:** Put the containment check inside `recordedMcpServers` (or the reader factory) for both arms, so that no consumer can run stored configs from an uncontained root.
  **Why:** Stored configs are state data, not files, and the current consumers that only read names or verdicts are safe.
  **Severity:** Low. No current consumer runs the configs without the check, but a future one could forget it.

- **Choice:** The completion classification composes the `list` pipeline a second time instead of sharing it (WR-02).
  **Alternatives:** One shared helper, or a real parity test.
  **Why:** BLOCK C and the cycle note in `mcp-verdict-read.ts` constrain where the helper can live.
  **Severity:** Medium.

- **Choice:** The cucumber completion step passes the profile's implementation instead of going through Pi's registered command (IN-01).
  **Alternatives:** A TUI-driven completion step on a profiled Pi.
  **Why:** The in-process adapter was the existing pattern and is fast.
  **Severity:** Low. A unit test covers the register path.

- **Choice:** The bounded 10 s poll in `assertStandInsStopped` (`features/lib/turn-records.ts:22-23,104-112`) relies on stand-ins exiting when stdin closes after Pi exits. It re-enabled the built-in half of the BLT-01 new-session scenario (`lifecycle.feature:391`).
  **Alternatives:** Fix the double `session_start` connection leak at its source, or keep the scenario `@adapter-only` with the Pi-gap comment.
  **Why:** Pi 1.5.0 leaves the first connection open, which is a Pi gap.
  **Severity:** Low. A real leak still fails after 10 s. A zombie child of the harness process would also read as running, as it did before the change.

- **Choice:** Containment of the legacy reader is now enforced for `list`, `info`, completion, update, convergence, and the AMIG move, so an uncontained legacy record keeps its stored verdict on every surface.
  **Alternatives:** Enforce it only where files are read.
  **Why:** UF-1 / D-P6-23.
  **Severity:** Low. It is the safer default, and it only affects records whose root fails NFR-10.

_Reviewed: 2026-11-05T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
