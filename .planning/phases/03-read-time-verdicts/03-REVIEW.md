---
phase: 03-read-time-verdicts
reviewed: 2026-11-04T18:51:31Z
depth: standard
files_reviewed: 57
files_reviewed_list:
  - docs/messaging-style-guide.md
  - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - features/lib/mcp-verdict-git.ts
  - features/mcp-server/builtin-status.feature
  - features/mcp-server/companion-missing.feature
  - features/mcp-server/invalid-configs.feature
  - features/mcp-server/project-scope.feature
  - features/mcp-server/verdict-apply.feature
  - features/mcp-server/verdict-fetch.feature
  - features/mcp-server/verdict-info.feature
  - features/mcp-server/verdict-install.feature
  - features/mcp-server/verdict-list.feature
  - features/mcp-server/verdict-markers.feature
  - features/mcp-server/verdict-update.feature
  - features/step_definitions/mcp-server/verdict-fetch.steps.ts
  - features/step_definitions/mcp-server/verdict-settings.steps.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
  necessity: 1
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-04T18:51:31Z
**Depth:** standard
**Files Reviewed:** 57
**Status:** issues_found

## Summary

I reviewed Phase 3's own diff (`git diff 87d3f28 eb9258b` plus the non-merge
first-parent commits after `7d4246c`) across the 57 scoped files. I checked it
against D-P3-01..23, the P3-DC dubious-choice log, and `01-FROZEN.md`. No frozen
file changed in Phase 3's own diff: `domain/mcp-implementation.ts`,
`persistence/state-io.ts`, `orchestrators/mcp/recorded-servers.ts`,
`platform/pi-api.ts`, `index.ts`, the edge register/types/info handler, the
closed sets, `docs/json-output.md`, and the build/CI files are all untouched.
The `notify-reasons.ts` edit touches only `companionSeverity`, not the reason
table.

These parts are sound:

- The D-MB-07 name table (`soft-dep.ts` `MCP_NAME_TABLE`) matches D-P3-06, D-P3-07 and D-P3-08 in every cell.
- `resolutionFor` agrees with the frozen effective read: every view is a superset of the neutral drops, so no stale `droppedMcpServers` survives the spread.
- The install, update, and consent gates name an implementation explicitly, and the neutral record writes set the basis after `replaceCompatibility`.
- `list`, `info`, and `pending` stay offline.

The main defect: the "no MCP trace" shortcut in `legacyReaderFor` was written for
adapter-basis legacy records, but AMIG-01 now stamps
`compatibilityBasis: "neutral"` on legacy records without writing
`mcpServerConfigs`. Under that combination, a plugin whose only servers
pi-mcp-adapter blocks reads as having no MCP servers at all (CR-01). That
defeats the stated purpose of P3-DC-95 and contradicts Phase 2's built-in
registration, which uses the full reader.

The other gaps:

- Under Pi's built-in MCP, apply holds a catalog move of a legacy unpinned path-source plugin, which breaks D-P3-13 (WR-01).
- Dependency moves and user updates still ask for `--partial` after a switch, even when the record is already partial under the active implementation (WR-02).
- A newly added built-in scenario pins a `(will partially install)` pending preview that `apply` does not carry out (WR-03).

## Critical Issues

### CR-01: A neutral legacy record with no staged MCP server reads as having no MCP servers, so adapter-only-blocked servers vanish from list, info, pending, and apply

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts:41-48`, `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:531-563`

**Issue:** `legacyReaderFor` skips the offline re-resolve when a record lacks `mcpServerConfigs` and has `resources.mcpServers.length === 0` and no `mcpServers` kind. It then answers `{ servers: [], bundle: false }`. That rule holds only for records that carry the adapter's verdict (no basis): an adapter-blocked server always leaves `mcpServers` in `unsupported`.

`applyNeutralVerdict` (AMIG-01) breaks this assumption. It converts a legacy record to `compatibilityBasis: "neutral"` and never writes `mcpServerConfigs`. Take a pre-milestone install whose only server has `bareElicitationCapability: true`. pi-mcp-adapter blocks that server, and Pi's built-in MCP runs it. The legacy `mcp.json` entry moves, the adapter drops the server, so `stagedNames` is `[]` and `resources.mcpServers` becomes `[]`. The neutral verdict is installable with no `mcpServers` kind, and the basis is set to neutral. From then on `readRecordMcpVerdict` / `readRecordMcpDependency` answer "no servers" under every implementation. I confirmed this with a direct probe of `readRecordMcpVerdict` on such a record: `recorded.servers` is `[]`, and the effective verdict under `adapter` is `installable: true` with `unsupported: []`. The results:

- Under pi-mcp-adapter, `list` shows `(installed)` with no marker instead of `(partially-installed) {unsupported mcp, requires builtin mcp}`.
- `info` shows no `mcp:` line and no MCP `requires:` entry.
- `apply`'s convergence treats the record as clean, so a move to a version that still declares the server is held for consent.
- Under Pi's built-in MCP, `builtin-registration-step.ts:233` calls `recordedMcpServers(record, createLegacyServersReader(source))` without the shortcut, so it registers the server while `info` lists no server for the plugin.

`03-07-SUMMARY.md:246` gives exactly this case ("a legacy record whose bare-elicitation server was dropped would keep reading installable under the adapter") as the reason to write the basis, and that intent is not achieved.

**Fix:** Apply the shortcut only to records whose stored verdict is the adapter's, and make AMIG-01 leave a self-describing record:

```ts
// mcp-verdict-read.ts
return (record) =>
  record.compatibilityBasis === undefined &&
  record.resources.mcpServers.length === 0 &&
  !record.compatibility.unsupported.includes("mcpServers")
    ? Promise.resolve({ servers: [], bundle: false })
    : reader(record);

// mcp-migration.ts, applyNeutralVerdict, beside the basis write
record.mcpServerConfigs = mcpServerConfigsOf(resolved.declaredMcpServers);
if (resolved.mcpBundle === true) { record.mcpBundle = true; } else { delete record.mcpBundle; }
```

Add a migration integration case and a `@adapter-only` list scenario for a moved bare-elicitation-only legacy plugin.

## Warnings

### WR-01: Under Pi's built-in MCP, apply holds the catalog move of a legacy unpinned path-source plugin because of the switch alone (D-P3-13)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:422-434, 479-497` (same pattern in `orchestrators/plugin/update-swap.ts:1794-1814`)

**Issue:** `recordMove` reads the record's effective verdict only after the offer shows a changed revision. For a legacy record (no `mcpServerConfigs`) of an unpinned path source, the frozen legacy reader re-resolves the live marketplace directory. That directory is exactly what moved, so `deriveInstallVersion` no longer matches `record.version`. The reader refuses with `version-mismatch`, and the read is `unreadable`, so the stored verdict stands. That stored verdict is either:

- the adapter's (no basis), or
- after AMIG-01, a neutral one without configs.

For an sse plugin both say `installable: true`. Under Pi's built-in MCP, `move.partial` is `false`, the candidate's view drops `mcpServers`, and `newlyDroppedKinds` returns `["mcpServers"]`. So the move is held and the user is told to run `update --partial`. D-P3-13 says "a switch alone never holds a move", but every pre-milestone path-source install with an sse server hits this hold on its first catalog move after the switch. The same `unreadable` fallback makes `partialDegradeOf` report `newlyDegraded: true` for such an update. The frozen MREC-02 rule only says the stored verdict stands for the record. It does not require counting a kind that only the active implementation drops as a new degrade when the record side cannot be read.

**Fix:** When the record read is `unreadable`, compare the candidate against the neutral baseline, so a kind that only the active implementation drops is not counted as newly dropped. Treat the move as partial for those kinds. For example, have `readRecordMcpVerdict` return `recorded.kind`, and in `recordMove` use:

```ts
const baseline = recorded.kind === "unreadable"
  ? resolutionFor(resolved, "none").unsupported   // what no switch could explain
  : effective.unsupported;
const dropped = view.unsupported.filter((k) => !baseline.includes(k) && !effective.unsupported.includes(k));
// and partial: !effective.installable || view.unsupported.some((k) => !baseline.includes(k))
```

Writing `mcpServerConfigs` in AMIG-01 (CR-01) removes the case for records that had legacy `mcp.json` entries.

### WR-02: A dependency move and a user-run update after a switch still ask for `--partial` when the record is already partial under the active implementation

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:527-538, 1221`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts:163-166`, `features/mcp-server/verdict-update.feature:1-7`

**Issue:** The candidate gate is `requireInstallable(view)` unless `options.partial` or `widensPartialGate(record)` is set, and `widensPartialGate` covers disabled records only. Nothing compares the candidate's view with the record's effective view. Two cases follow:

1. An sse dependency installed under pi-mcp-adapter (or with no implementation). The record is partial under Pi's built-in MCP, but `install`/`update` of a dependent that moves the dependency (`moveArgs`, `cascade: true`, `partial` only from the user's flag) is refused under built-in. This contradicts D-P3-13 ("cascades never ask because of a switch").
2. A direct `update demo` of the same plugin to a version with the same sse server is refused under built-in. Yet `apply` moves it without asking (`verdict-apply.feature:9-39`). D-P3-12's first sentence ("asks only for a new degrade: the candidate's view is compared with the installed record's effective view") is not implemented in the gate. Only the swap's `newlyDegraded` flag reads the record.

`verdict-update.feature`'s description claims the D-P3-12 behavior ("asks for --partial only when the MCP implementation pi runs now drops a server of the new version that the installed version did not need"), but no scenario covers an already-partial record, so nothing pins the actual behavior.

**Fix:** The callers can read the record (`update-preflight.ts` cannot import `mcp-verdict-read.ts`, which would close a cycle). Have them pass the record's effective `unsupported` kinds as data (for example `recordDrops?: readonly string[]` on `PreparePluginUpdateOptions`). Then admit the candidate when `view.unsupported.every((k) => recordDrops.includes(k))`, at least for `cascade: true` dependency moves. If keeping "today's rules" for a direct update is intended, record that as a decision, fix the feature description, and add the already-partial scenario that pins it.

### WR-03: The new built-in pending scenario pins `(will partially install)` for an sse plugin, but `apply` installs without `partial` and refuses it

**File:** `features/mcp-server/verdict-apply.feature:86-112`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:647-673`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:693-727`

**Issue:** `resolvePendingForceInstalls` now marks a planned install as forced when the run's view is `partially-available`. Under Pi's built-in MCP this covers every sse plugin. `applyPluginInstalls` calls `installPlugin` with no `partial`, and `buildInstallLedgerOptions` passes `consentView: run.softDeps.mcpImplementation`. So the actual apply runs `requireInstallable(view)` and fails with a `PluginShapeError` (`partialable: true`), which `installFailureReasonFields` reports as `no longer installable`. The preview says the plugin will partially install, and the apply it advertises refuses. The mismatch predates Phase 3 for non-MCP kinds. Phase 3 makes it reachable for the headline sse case and adds a scenario that freezes the preview without a matching apply scenario.

**Fix:** Make the two surfaces agree. Either pass `partial: true` from `applyPluginInstalls` for a planned install that the read pass marked forced (the FSTAT-06 meaning of "will partially install"), or stop previewing a forced install that apply will refuse. Add an apply scenario under `@builtin-only` that pins the real result.

## Info

### IN-01: The switch scenarios state no implementation in their steps

**File:** `features/mcp-server/verdict-apply.feature:9-62`, `features/mcp-server/verdict-install.feature:112-134`, `features/mcp-server/verdict-list.feature:59-84`

**Issue:** The titles say "installed under pi-mcp-adapter ... when pi runs its built-in MCP instead". The install, though, runs on the profile's shared Pi, and the switch happens inside `Given pi runs with the scripted model` (`companions: []`, so Pi's built-in MCP). No step names either implementation. The result rows prove that Pi's built-in MCP is active at read time. Nothing proves the install ran under pi-mcp-adapter: the neutral record is the same under no implementation. So the "from pi-mcp-adapter" half of each title rests on a harness default the feature text does not show.

**Fix:** Start the install on an explicit adapter Pi (`pi runs with the scripted model and these companions: | pi-mcp-adapter |`), as `companion-missing.feature:146` does, or reword the titles to claim only the read-time switch.

### IN-02: The style guide says an MCP marker always raises a warning, but list rows stay `info`

**File:** `docs/messaging-style-guide.md:93`

**Issue:** "A row warns for MCP exactly when its marker shows." `companionSeverity` applies only to install, update, and enable rows. The `list` rows with the marker are pinned at `severity info` / `tally warnings 0` (`verdict-markers.feature:375-398`, `verdict-list.feature:59-84`), and the guide itself says reconcile rows apply no companion severity.

**Fix:** Scope the sentence: "An install, update, or enable row warns for MCP exactly when its marker shows."

### IN-03: Impossible-state guard: `partialDegradeOf` throws a concurrency error for a marketplace the preflight already found

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1803-1806`
**Category:** necessity

**Issue:** `preflight.record` was read out of `preflight.state.marketplaces[args.marketplace]` by the preflight, so `ownValue(preflight.state.marketplaces, args.marketplace)` cannot be `undefined` there. The guard turns a type-narrowing need into a user-facing `marketplace-removed` failure path that cannot happen. P3-DC-91 calls it "defensive". This finding rests on reading the preflight's code path, not on a type-level proof.

**Fix:** Carry the marketplace record on `PreparedPluginUpdate` (the preflight already holds it) and pass it to `readRecordMcpVerdict` directly, dropping the branch.

---

_Reviewed: 2026-11-04T18:51:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
