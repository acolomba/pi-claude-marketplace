---
phase: 03-read-time-verdicts
reviewed: 2026-11-04T19:40:03Z
depth: standard
iteration: 2
files_reviewed: 25
files_reviewed_list:
  - docs/messaging-style-guide.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - features/mcp-server/verdict-apply.feature
  - features/mcp-server/verdict-install.feature
  - features/mcp-server/verdict-list.feature
  - features/mcp-server/verdict-update.feature
  - test/integration/mcp-verdict-migration.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/mcp-verdict-read.test.ts
  - test/orchestrators/plugin/mcp-verdict.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - test/orchestrators/reconcile/mcp-migration.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/pending.test.ts
  - .planning/phases/03-read-time-verdicts/03-REVIEW-FIX.md
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
  necessity: 1
status: issues_found
---

# Phase 3: Code Review Report (iteration 2)

**Reviewed:** 2026-11-04T19:40:03Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

This review covers the fix commits `git diff 09e6007 edb754e` (20ac944, 3817f22,
8a7404f, 04f07a0, 224fd7d, 89f72ad). I checked them against 03-CONTEXT.md
(D-P3-01..23), the P3-DC log (P3-DC-112..121), `01-FROZEN.md`, and AGENTS.md. No
frozen file changed: the diff touches no file in the frozen list
(`recorded-servers.ts`, `mcp-implementation.ts`, `state-io.ts`, `index.ts`,
the edge files, the closed sets, the steps, `cucumber.json`, and the build
files are all untouched). The new imports (`dependency-move.ts` and
`update-preflight.ts` to `mcp-verdict*.ts`) close no cycle. `update-preflight.ts`
takes the record read as an injected port. The new read path stays offline:
the legacy reader reads the cached manifest and the recorded root, and
`mcp-verdict-read.ts` imports no git surface. Tags are correct: the
`@own-implementation` scenario runs only on the adapter/default profiles, the
folded `@mcp` scenario runs on both, and the `@builtin-only` apply scenario runs
only on the built-in profile.

Status of the iteration-1 findings:

- **CR-01:** resolved. The no-trace shortcut now needs `compatibilityBasis === undefined`, and AMIG-01 writes `mcpServerConfigs` and `mcpBundle`. The fix adds a new defect, WR-05 below.
- **WR-01:** resolved for the switch case. The excuse it adds is too wide and drops a consent hold where no switch happened (WR-04, new).
- **WR-02:** resolved for cascades through the `readRecordDegradeBaseline` port. A user-run update keeps today's rules by recorded decision (P3-DC-112, D-P3-12 last sentence). The port also widens non-MCP behavior (IN-04, new).
- **WR-03:** not resolved. The token changed, but `pending` still promises an install that `apply` refuses. It stays open as WR-03.
- **IN-01:** resolved. The four titles now claim only what their steps show.
- **IN-02:** resolved. The style-guide sentence is scoped to install, update, reinstall, and enable rows, and every `companionSeverity` caller is one of these.
- **IN-03:** skipped by decision (P3-DC-91). It is still open and carried below.

## Warnings

### WR-04: An unreadable record under pi-mcp-adapter excuses a new adapter-only drop, so a real new degrade moves without consent and is not flagged as newly degraded (new, from the WR-01 fix)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts:83-110`, `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts:423-443, 509`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1825`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:480-502`

**Issue:** `degradeBaselineOf` sets `readable: recorded.kind !== "unreadable"`. It does not look at the record's basis or the active implementation. `newlyDroppedKinds` then skips every `mcpServers` drop that the neutral resolution does not make. The excuse rests on one idea: an unreadable record's stored verdict cannot say what the *active* implementation drops. That idea is false for a legacy record (`compatibilityBasis === undefined`) under `adapter`. The frozen `effectiveMcpCompatibility` treats that stored verdict as pi-mcp-adapter's own verdict (`domain/mcp-implementation.ts:316`), so no switch happened and the stored verdict is exact.

A reachable case: a record from a released build with a staged stdio server (no configs, no basis, `resources.mcpServers` not empty, and not migrated by AMIG-01 because its entries already live in `mcp-adapter.json`). Its source is an unpinned path source whose catalog moved, so the legacy reader refuses with `version-mismatch` and the read is `unreadable`. Pi runs pi-mcp-adapter, and the new version adds a server with `bareElicitationCapability: true`:

- The view drops `mcpServers`. The baseline (the adapter's stored verdict) does not, `readable` is `false`, and the neutral resolution does not drop it. So `dropped` is `[]` and `excused` is `true`.
- Convergence: `consent` is `undefined` and `partial` is `true`. Apply moves the plugin and silently drops the new server. Before the fix this move was held for `update --partial` (D-12, D-P3-13: "needs consent only when the candidate drops something the installed record ... does not drop").
- Update swap: `newlyDegraded` is `false`, so the autoupdate row stays `info` instead of the SEV-03 `warning`.
- Dependency move: `dropsNothingNew` admits the candidate without `--partial`.

None of the new unit cases (`mcp-verdict.test.ts` DROP_ROWS, `convergence.test.ts` legacy cases, `update-swap.test.ts`) runs under `adapter`, so nothing pins this.

**Fix:** Excuse a drop only when a switch could explain it. Treat the stored verdict as readable when it is the active implementation's own verdict:

```ts
export function degradeBaselineOf(
  effective: { readonly unsupported: readonly string[] },
  recorded: Pick<RecordedMcpServers, "kind">,
  record: Pick<PluginInstallRecord, "compatibilityBasis">,
  active: ActiveMcpImplementation,
): RecordDegradeBaseline {
  // A legacy record holds pi-mcp-adapter's verdict, which is exact under the adapter.
  const storedIsActive = record.compatibilityBasis === undefined && active === "adapter";
  return {
    unsupported: effective.unsupported,
    readable: recorded.kind !== "unreadable" || storedIsActive,
  };
}
```

Pass `record` and `active` at the three call sites (`convergence.ts` `recordMove`, `update-swap.ts` `partialDegradeOf`, `mcp-verdict-read.ts` `recordDegradeBaselineReader`). Add an `adapter` row to DROP_ROWS and a convergence case: an unreadable legacy record under `adapter` whose candidate adds a bare-elicitation server is declined.

### WR-05: AMIG-01 now writes `mcpServerConfigs` from the live revision, not from the recorded version, which bypasses the frozen MREC-02 version guard (new, from the CR-01 fix)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts:540-563` (resolve at `resolveOffline`, ~370-400; header at 58-63)

**Issue:** `resolveOffline` resolves a path source from the marketplace's current checkout, with no `pathPluginPin` and no version check. The module header accepts this for *staging* ("a newer plugin version there can stage under the recorded version"). The CR-01 fix now also writes that resolve's `declaredMcpServers` into `record.mcpServerConfigs`. After that, `recordedMcpServers` answers `recorded` with these servers for every read. The frozen legacy reader refuses this exact case on purpose (`recorded-servers.ts`: "the reader never returns the servers of a version the record does not name", `version-mismatch`). The migration now writes around that guard and stores the newer revision's servers on a record that still names the old `version`.

The effects, for a legacy owner whose path-source catalog moved before the first load after the upgrade:

- `list` and `info` classify the old version by the new version's servers. For example, a v1.0.0 stdio-only plugin lists `(partially-installed) {unsupported mcp, requires pi-mcp-adapter}` under built-in when v1.1.0 adds an sse server.
- Apply's convergence baseline already contains the new server. The move to v1.1.0 is not held for the D-12 consent that a real new degrade needs. Before the fix, the read was `unreadable`, and only the neutral kinds came from the newer revision.
- Phase 2's built-in registration reads the same field and registers the newer revision's servers for the old record.

A tag-pinned path source (`resolvedSha` set) has the same problem, because `resolveOffline` passes no `pathPluginPin`.

**Fix:** Write the configs only when the resolve is the recorded revision. Check the version as the legacy reader does: `deriveInstallVersion` plus `isSameVersion(record.version, version, record.resolvedSha)`, or pin path sources with `pathPluginPin: record.resolvedSha`. On a mismatch, leave `mcpServerConfigs` absent so the read stays `unreadable` and the stored verdict stands (MREC-02). The verdict write has the same problem and predates this fix. If the newer-revision write is meant as reinstall parity, record it as a decision and update the header, because it now changes what every read and the built-in registration see, not only what is staged.

### WR-03 (carried, not resolved): `pending` still previews an install that `apply` refuses, and the preview no longer reads the active implementation as D-P3-15 requires

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:630-680`, `features/mcp-server/verdict-apply.feature:1-8, 87-140`

**Issue:** `resolvePendingForceInstalls` now reads the neutral verdict, so an sse plugin under built-in previews `(will install)`, with `needs apply true` and a success count of 1. The new `@builtin-only` scenario pins the opposite result for the same input: `apply` fails with `(failed) {unsupported mcp}` at severity `error`. The two surfaces still disagree, and the preview now looks like a clean install. The same mismatch now also happens under pi-mcp-adapter for a bare-elicitation-only plugin. D-P3-15 says the forced-install preview "read[s] the active implementation like every other surface", and the fix moves it to the neutral view. The feature description ("Pending promises no partial install that apply will not make") is true only in a narrow sense, and false for kinds every implementation drops (P3-DC-117). The orchestrator logged this as P3-DC-117, so it is known, but the defect the finding named is still there.

**Fix:** Make the preview match apply's real outcome under the active implementation. Do one of these:

- Have `applyPluginInstalls` pass `partial: true` for a planned install the read pass marked forced, and keep the active-implementation mark from D-P3-15. P3-DC-20 then needs an amendment.
- Preview such an install as a pending failure or hold (for example a `will not install {unsupported mcp}` row), and do not count it toward `needs apply`.

Either way, restore D-P3-15's active-implementation read, or amend D-P3-15 in 03-CONTEXT.md.

## Info

### IN-04: The dependency-move port admits any already-dropped kind, not only MCP, so a non-MCP partial dependency now moves without `--partial` (new, from the WR-02 fix)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:480-502, 575-579`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts:167-171`

**Issue:** `dropsNothingNew` compares every kind in `view.unsupported` with the record's effective kinds. Take an enabled dependency that was installed with `--partial` for `lspServers`. Before this fix, `widensPartialGate` covers only disabled records, so a cascade move of that dependency asked for `--partial`. Now it moves without asking. That is a user-visible change outside D-MB-06's "a switch" scope. It matches apply's D-12 rule and P3-DC-112's wording ("dependency moves ask only for a new degrade"), but no scenario under `features/plugin/` pins it. The only new scenario is MCP. AGENTS.md asks for a scenario for each user-visible behavior change.

**Fix:** Either limit the port to MCP (admit only when the non-MCP kinds of `view.unsupported` are empty or `--partial` is set), or add an `install-dependencies.feature` scenario that pins the non-MCP move and a CHANGELOG line.

### IN-03 (carried, skipped by decision P3-DC-91): Impossible-state guard: `partialDegradeOf` throws a concurrency error for a marketplace the preflight already found

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1805-1811`
**Category:** necessity

**Issue:** `preflight.record` was read from `preflight.state.marketplaces[args.marketplace]`, so the `ownValue(...) === undefined` branch, a `marketplace-removed` failure, cannot happen. The orchestrator kept it as a defensive guard (P3-DC-91). The finding rests on reading the preflight's code path, not on a type-level proof.

**Fix:** Carry the marketplace record on `PreparedPluginUpdate` and drop the branch, or leave it as recorded.

---

_Reviewed: 2026-11-04T19:40:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
