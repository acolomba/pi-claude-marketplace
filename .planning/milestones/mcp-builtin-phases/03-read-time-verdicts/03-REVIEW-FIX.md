---
phase: 03-read-time-verdicts
fixed_at: 2026-11-04T20:04:36Z
review_path: .planning/phases/03-read-time-verdicts/03-REVIEW.md
iteration: 2
fix_scope: all
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
findings:
  WR-04: {outcome: "fixed: requires human verification", commit: 861f0bc}
  WR-05: {outcome: "fixed: requires human verification", commit: c84d579}
  WR-03: {outcome: "fixed: requires human verification", commit: e930997, note: "preview restored to the active implementation (D-P3-15); the pending/apply mismatch is accepted as pre-existing, with a proposed BACKLOG parent line"}
  IN-04: {outcome: "fixed: requires human verification", commit: 64aa17f}
  IN-03: {outcome: skipped, reason: "orchestrator decision: keep the defensive guard (P3-DC-91)"}
iteration_1:
  fixed_at: 2026-11-04T19:33:37Z
  findings_in_scope: 7
  fixed: 6
  skipped: 1
  status: partial
  findings:
    CR-01: {outcome: fixed, commit: 20ac944}
    WR-01: {outcome: "fixed: requires human verification", commit: 3817f22}
    WR-02: {outcome: "fixed: requires human verification", commit: 8a7404f, note: "partial fix by decision: cascades only; a user-run update keeps today's rules"}
    WR-03: {outcome: "fixed: requires human verification", commit: 04f07a0, note: "superseded in iteration 2 (e930997): the preview reads the active implementation again"}
    IN-01: {outcome: fixed, commit: 89f72ad}
    IN-02: {outcome: fixed, commit: 224fd7d}
    IN-03: {outcome: skipped, reason: "orchestrator decision: keep the defensive guard (P3-DC-91)"}
---

# Phase 3: Code Review Fix Report

The iteration-2 section comes first. The iteration-1 section below it is kept
as it was written, except where a note says that iteration 2 replaced a fix.

# Iteration 2

**Fixed at:** 2026-11-04T20:04:36Z
**Source review:** .planning/phases/03-read-time-verdicts/03-REVIEW.md (iteration 2)
**Iteration:** 2

**Summary:**

- Findings in scope: 5 (the orchestrator gave a decision for each)
- Fixed: 4 (all four are logic changes flagged for human verification)
- Skipped: 1 (IN-03, P3-DC-91)

The fixes were made in the main checkout on `features/mcp-builtin-phase-3`,
as the orchestrator directed, not in a GSD worktree. Every check below ran in
that checkout. No frozen file from `01-FROZEN.md` changed.

## Fixed Issues (iteration 2)

### WR-04: An unreadable record under pi-mcp-adapter excuses a new adapter-only drop

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/orchestrators/plugin/mcp-verdict.test.ts`, `test/orchestrators/reconcile/convergence.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`
**Commit:** 861f0bc
**Status:** fixed: requires human verification (logic change)
**Applied fix:**

- `degradeBaselineOf(effective, recorded, record, active)` now also takes the record's basis and the active implementation. The baseline counts as readable when the read is not `unreadable`, or when `compatibilityBasis === undefined && active === "adapter"`. A record without a basis holds pi-mcp-adapter's own verdict (P1-DC-02), so under the adapter that verdict is exact, and no switch can explain a drop it does not make. The three callers pass the record and the active implementation: convergence `recordMove`, update swap `partialDegradeOf`, and the `recordDegradeBaselineReader` port, which `dependency-move.ts` passes to the update preflight.
- Effect under pi-mcp-adapter, for an unreadable legacy record whose candidate adds a server only the adapter blocks: apply declines the move for `update --partial` (D-12) again, the update outcome reports `newlyDegraded: true` (SEV-03), and a dependency move asks for `--partial`. Under Pi's built-in MCP and under `none`, an unreadable legacy record still excuses the switch drop, as WR-01 made it.
- Unit cases: six baseline rows (kind x basis x implementation), among them `unreadable` + no basis + `adapter` = readable. A composed case shows that `newlyDroppedKinds` counts the `mcpServers` drop under the adapter. Convergence: an unreadable legacy stdio record under `adapter` whose candidate adds a bare-elicitation server is declined with `unsupported: ["mcpServers"]`. Update swap: the same record's `--partial` update under `adapter` reports `newlyDegraded: true`. Without the fix, the three adapter cases fail (proven by running them against the previous `mcp-verdict.ts`).
- No cucumber scenario: as with WR-01 (P3-DC-113), no frozen step seeds an unreadable legacy record.

### WR-05: AMIG-01 writes `mcpServerConfigs` from the live revision, not from the recorded version

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `test/orchestrators/reconcile/mcp-migration.test.ts`, `test/integration/mcp-verdict-migration.test.ts`, `test/integration/mcp-migration.test.ts`
**Commit:** c84d579
**Status:** fixed: requires human verification (logic change)
**Applied fix:**

The rule: the record's verdict, basis, and server configs all come from the servers of the recorded version, or none of them is written. AMIG-01 still stages from the current checkout (reinstall parity, as the module header already said), so only the record write changed.

- For a moving owner, `ownerAction` now also reads `recordedMcpServers(record, createLegacyServersReader(...))`, the frozen MREC-01/MREC-02 path. A record that already has `mcpServerConfigs` answers `recorded` with them. A legacy record re-resolves pinned to its recorded root (`pathPluginPin: resolvedSha` for a tag-pinned path source), and the reader refuses `root-mismatch` and `version-mismatch`. So the reader never returns servers of a version the record does not name.
- `applyNeutralVerdict` computes the neutral verdict from that read (`effectiveMcpCompatibility(record, recorded, "none")`). It writes the verdict, `compatibilityBasis: "neutral"`, `mcpServerConfigs`, and `mcpBundle` only when the read is `recorded` or `re-resolved`.
- When the read is `unreadable`, the record keeps its stored verdict, with no basis and no configs. It stays a legacy record, so every later read refuses it the same way and the stored verdict stands (MREC-02). The orchestrator's alternative was to write the neutral verdict without configs when the verdict itself comes from the recorded version. That case does not arise under this rule: the neutral verdict is computed from the recorded servers, so with no readable recorded servers, no verdict comes from the recorded version. This also covers the reviewer's note that the verdict write had the same problem before CR-01: the verdict no longer comes from the live resolve either.
- The resource list (`resources.mcpServers`) still follows what the stage wrote, as before, because it describes the staged entries.
- Unit case: a legacy path-source record at 1.0.0 whose catalog moved to 1.1.0, with an added sse server, before the first load. The move stages both servers, and the record keeps its adapter verdict with no basis and no `mcpServerConfigs`. Without the fix, the record gets `compatibilityBasis: "neutral"` and the 1.1.0 servers.
- Integration case `MREC-02 / D-P3-16` in `test/integration/mcp-verdict-migration.test.ts`: the same scenario through a real install and the real load. The record keeps version 1.0.0, its seeded compatibility, no basis, and no configs. `list` under Pi's built-in MCP renders `● hello v1.0.0 (partially-upgradable) {unsupported mcp}`, not the 1.1.0 servers' verdict. Without the fix, the record carries the 1.1.0 configs.
- `test/integration/mcp-migration.test.ts` `AMIG-01: /reload removes an undeclared server, drops an unsupported one and moves the rest` seeded a real install from this build, which records `mcpServerConfigs` for `srv` only, and then declared `live` at the same version. The record's configs are authoritative for its version, so the new rule read `srv` only and kept the record installable. The test models a released-build record, so it now deletes `mcpServerConfigs` before the reload, as `mcp-verdict-migration.test.ts` already does. Its expectations are unchanged.
- The module header and the `applyNeutralVerdict` comment now state the rule.

### WR-03: `pending` previews an install that `apply` refuses, and the preview does not read the active implementation

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `features/mcp-server/verdict-apply.feature`, `test/orchestrators/reconcile/notify.test.ts`, `test/orchestrators/reconcile/pending.test.ts`
**Commit:** e930997
**Status:** fixed: requires human verification (behavior change, by the orchestrator's decision)
**Applied fix:**

- The orchestrator decided to restore D-P3-15 as written: the forced-install preview reads the active implementation, like every other surface. This reverts the iteration-1 change (04f07a0) in the source and the unit tests. `resolvePendingForceInstalls` takes `mcpImplementation` again and marks an install whose candidate is `partially-available` under `resolutionFor(resolved, mcpImplementation)`.
- Under Pi's built-in MCP, a declared plugin with an sse server previews `(will partially install)` again. Under pi-mcp-adapter it previews `(will install)`.
- `verdict-apply.feature`: the folded `@mcp` pending scenario is again a `@builtin-only` / `@adapter-only` pair (`will install` with `partial: true` under built-in, `will install` without `partial` under the adapter). The `@builtin-only` apply scenario that pins `(failed) {unsupported mcp}` at severity `error` stays. The feature description now says that pending previews a partial install and that apply, which installs a declared plugin without `--partial`, refuses it.
- The `resolvePendingForceInstalls` comment states the accepted mismatch.

**Accepted, not fixed (orchestrator decision):** `pending` previews `(will partially install)` for a declared plugin that `apply` then refuses, because `apply` installs a declared plugin without `--partial` (P3-DC-20). This mismatch predates Phase 3 for every kind (lsp, ws, output styles, and so on). The MCP implementations only add the sse case under built-in, and the bare-elicitation case under the adapter. Apply is not changed. Proposed BACKLOG parent line:

> apply refuses a declared install pending previews as will partially install; choose one behavior for both

## Fixed Issues (iteration 2, info)

### IN-04: The dependency-move port admits any already-dropped kind, not only MCP

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `test/orchestrators/plugin/update-preflight.test.ts`
**Commit:** 64aa17f
**Status:** fixed: requires human verification (gate condition)
**Applied fix:**

- `dropsNothingNew` now admits without `--partial` only a candidate whose active-implementation view drops `mcpServers` alone. Any other dropped kind returns `false` before the baseline is read, so a cascade keeps the `--partial` rule it had before the MCP implementations split. The reviewer's other option (an `install-dependencies.feature` scenario plus a CHANGELOG line) was not needed: the change restores the earlier behavior instead of shipping a new one.
- Unit case: a candidate with an sse server and an LSP server whose record baseline already drops both is refused (`skipped`, reasons `lsp, unsupported mcp`, `partialUpgradable: true`). Without the fix, it is admitted.

## Skipped Issues (iteration 2)

### IN-03: Impossible-state guard in `partialDegradeOf`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1805-1811`
**Reason:** skipped by the orchestrator's decision (P3-DC-91), as in iteration 1. It is a necessity finding.
**Original issue:** `preflight.record` was read from `preflight.state.marketplaces[args.marketplace]`, so the `marketplace-removed` branch cannot happen.

## Red proof per profile (iteration 2)

| Change | Profile | Without the fix | With the fix |
| --- | --- | --- | --- |
| WR-03 pending preview (`verdict-apply.feature`, `@builtin-only`) | builtin | fails, seed 219286: the row has no `partial` | passes (seed 17820) |
| WR-03 pending preview (`verdict-apply.feature`, `@adapter-only`) | adapter | passes before and after: the adapter view never marked an sse install | passes (seed 174398) |
| WR-03 apply refusal (`@builtin-only`) | builtin | pins existing behavior | passes (seed 17820) |
| WR-04, WR-05, IN-04 | n/a (no frozen step seeds a legacy record; IN-04 restores the earlier rule) | red in the unit and integration cases listed above | green |

## Verification (iteration 2)

All checks ran in the main checkout `/home/user/pi-claude-marketplace`, not in
a worktree.

- Each commit's hook ran `npm run check:commit` (static checks, `check:features`, unpaired tests, and direct coverage of the staged pairs), and it passed for each of the four fix commits.
- 100% direct coverage, run by hand, for `mcp-verdict.ts`, `mcp-verdict-read.ts`, `convergence.ts`, `update-swap.ts`, `mcp-migration.ts`, `notify.ts`, `pending.ts`, and `update-preflight.ts`.
- `npm run test:integration`: passed.
- Cucumber, adapter profile: `features/mcp-server` 105/105 (seed 282818); `features/plugin/{install-dependencies,update-dependencies,pending,apply}.feature` 152/152 (seed 593910).
- Cucumber, builtin profile: `features/mcp-server` 99/99 (seed 324867); the same four `features/plugin` files 5/5 (seed 136137).
- Not run: the full `npm run check` gate, `npm run test:modules`, the e2e suite, and the cucumber features outside the paths above. These are left to the phase gate.

# Iteration 1

**Fixed at:** 2026-11-04T19:33:37Z
**Source review:** .planning/phases/03-read-time-verdicts/03-REVIEW.md (iteration 1)
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (the orchestrator gave a decision for each)
- Fixed: 6 (three are logic fixes flagged for human verification)
- Skipped: 1 (IN-03)

The fixes were made in the main checkout on `features/mcp-builtin-phase-3`, as
the orchestrator directed, not in a GSD worktree. Every check below ran in
that checkout. No frozen file from `01-FROZEN.md` changed.

## Fixed Issues

### CR-01: A neutral legacy record with no staged MCP server reads as having no MCP servers

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts`, `test/orchestrators/plugin/mcp-verdict-read.test.ts`, `test/orchestrators/reconcile/mcp-migration.test.ts`, `test/integration/mcp-verdict-migration.test.ts`
**Commit:** 20ac944
**Applied fix:**

- `legacyReaderFor` now applies the "no MCP trace" shortcut only when `compatibilityBasis === undefined`. Such a record holds pi-mcp-adapter's verdict, where an adapter-blocked server always leaves the `mcpServers` kind. Any other record re-resolves.
- `applyNeutralVerdict` (AMIG-01) now writes `mcpServerConfigs` (through the frozen `mcpServerConfigsOf`) and sets or removes `mcpBundle` whenever it writes the neutral verdict and the basis, as an install does.
- Unit cases: a neutral record without configs re-resolves (red without the fix), and a legacy bundle source records `mcpBundle: true`. Four existing migration expectations now include the configs.
- Integration case `MREC-03 / D-P3-16` in `test/integration/mcp-verdict-migration.test.ts`: a legacy record whose only server is a bare-elicitation server goes through the real load. The record is neutral with `mcpServerConfigs` and staged nothing, and `list` under the adapter renders `◉ hello v1.0.0 (partially-installed) {unsupported mcp, requires builtin mcp}`. It fails without the fix (`mcpServerConfigs: undefined`).
- No cucumber scenario: no step seeds a released-build `state.json` with legacy `mcp.json` entries, and AMIG-01 has no scenario (see Dubious Choices).

### WR-01: Apply holds the catalog move of an unreadable legacy record because of the switch alone

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `test/orchestrators/plugin/mcp-verdict.test.ts`, `test/orchestrators/reconcile/convergence.test.ts`, `test/orchestrators/plugin/update-swap.test.ts`
**Commit:** 3817f22
**Status:** fixed: requires human verification (logic change)
**Applied fix:**

- A new pure rule in `mcp-verdict.ts`: `newlyDroppedKinds(view, neutral, baseline)` with `degradeBaselineOf(effective, recorded)`. A kind counts as newly dropped only when the record's effective verdict does not drop it. When the record's servers are unreadable, an `mcpServers` drop does not count unless the candidate's neutral resolution makes it too. This is narrower than "always leave `mcpServers` out": a server no implementation runs (ws) is still a new degrade.
- Convergence: `candidateDrops` uses the rule. A move whose drop is excused this way is not held, and it carries `partial: true`, so the runner's gate admits it.
- Update swap: `partialDegradeOf` reports `newlyDegraded` only when the record dropped nothing and the rule finds a newly dropped kind.
- Unit cases: four rows for the rule and three for the baseline. Convergence: an unreadable legacy sse record moves partial without consent under built-in (red without the fix), and an unreadable legacy record still needs consent for a new ws server. Swap: an unreadable legacy sse record's `--partial` update reports `newlyDegraded: false` (red without the fix).
- No cucumber scenario, for the same reason as CR-01 (an unreadable legacy record cannot be seeded through the frozen steps).

### WR-02: A dependency move after a switch asks for `--partial` when the record is already partial

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts`, `features/mcp-server/verdict-install.feature`, `features/mcp-server/verdict-update.feature`, `test/orchestrators/plugin/{update-preflight,dependency-move,mcp-verdict-read}.test.ts`
**Commit:** 8a7404f
**Status:** fixed: requires human verification (partial fix by the orchestrator's decision)
**Applied fix:**

- `PreparePluginUpdateOptions.readRecordDegradeBaseline` (and the same field on `ThreePhaseArgsBase`) is an optional port of type `RecordDegradeBaselineReader`. The update preflight cannot import the record read without closing an import cycle, so the read comes in through this port. When the port is set, the candidate gate also admits a partially available view, without `--partial`, if `newlyDroppedKinds` finds nothing new. This is the same rule as apply's convergence. The port is read only when the view is partial and `--partial` is absent.
- `recordDegradeBaselineReader(active)` in `mcp-verdict-read.ts` builds the port. `dependency-move.ts` passes it for both the judge and the run. A user-run update leaves the port out and keeps today's rules (D-P3-12).
- `verdict-update.feature`'s description now claims only what its scenarios prove: an update asks for `--partial` when the active implementation drops a server of the new version.
- New `@own-implementation` scenario in `verdict-install.feature`: lib 1.2.0 with an sse server is installed on the shared Pi without `--partial`. Then, under Pi's built-in MCP, `install app@tools` (needs `lib@^2.0.0`) moves lib to 2.0.0 as `partially-installed` with `dependency current copy, unsupported mcp, requires pi-mcp-adapter`, and app installs.
- Unit cases: the gate admits a candidate whose sse drop the record already makes (red without the change), refuses one whose drop is new, and reads no baseline when the view is whole. The dependency move admits a move that keeps an sse server its record already drops under built-in (red without the change). The factory gives a readable or an unreadable baseline.

### WR-03: The built-in pending scenario pinned `(will partially install)` for an install apply refuses

> Superseded in iteration 2 (e930997): by the orchestrator's decision, the preview reads the active implementation again (D-P3-15), and the pending/apply mismatch is accepted.

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, `features/mcp-server/verdict-apply.feature`, `test/orchestrators/reconcile/notify.test.ts`, `test/orchestrators/reconcile/pending.test.ts`
**Commit:** 04f07a0
**Status:** fixed: requires human verification (logic change)
**Applied fix:**

- Apply installs a declared plugin with no `partial` and gates on the active implementation's view (P3-DC-20), so it refuses every candidate that view sees as partially available. A probe under the builtin profile showed apply's row: `(failed) {unsupported mcp}`, severity error.
- `resolvePendingForceInstalls` now marks a planned install as partial only when the candidate's neutral verdict is partially available. It no longer takes the active implementation. A drop that only the active implementation makes no longer promises a partial install, so an sse plugin previews `(will install)` under every implementation.
- Pre-existing non-MCP mismatch, left unchanged as the orchestrator directed: a kind every implementation drops (lsp, ws, ...) still previews `(will partially install)`, and apply refuses that install too. This predates Phase 3. Changing it would change FSTAT-06 and the frozen catalog's `degraded-plugin (will partially install)` state.
- `verdict-apply.feature`: the `@builtin-only` and `@adapter-only` pending twins now agree, so they fold into one `@mcp` scenario that pins the true preview (`will install`, no `partial`). A new `@builtin-only` scenario pins what apply does: `reconcile-applied-cascade`, severity error, one failure, the `(failed)` row with `unsupported mcp`, and no installed plugin. The feature description says that pending promises no partial install that apply will not make.
- Unit cases: the resolver previews an sse server as whole and a ws server as partial. The pending test's built-in row now expects `will install`.

### IN-01: The switch scenarios state no implementation in their steps

**Files modified:** `features/mcp-server/verdict-apply.feature`, `features/mcp-server/verdict-install.feature`, `features/mcp-server/verdict-list.feature`
**Commit:** 89f72ad
**Applied fix:** Each scenario can start only one profile Pi (P3-DC-100), and the frozen steps cannot start an adapter Pi and then a built-in Pi. So the four titles were reworded to claim only what the steps show: the plugin was installed without `--partial`, and the command ran under Pi's built-in MCP. Steps are unchanged. The planning records that quote the old titles keep their history.

### IN-02: The style guide says an MCP marker always raises a warning

**Files modified:** `docs/messaging-style-guide.md`
**Commit:** 224fd7d
**Applied fix:** The sentence now reads "An install, update, reinstall, or enable row warns for MCP exactly when its marker shows; a `list` or reconcile row keeps its own severity." Reinstall is included because `reinstall.messaging.ts` also calls `companionSeverity`.

## Skipped Issues

### IN-03: Impossible-state guard in `partialDegradeOf`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1803-1806`
**Reason:** skipped by the orchestrator's decision. It is a necessity finding (removing code is the human's scope decision, #4100). The guard is the recorded P3-DC-91 choice. Carrying the marketplace record on `PreparedPluginUpdate` would widen a shared type that sibling phases also read.
**Original issue:** `ownValue(preflight.state.marketplaces, args.marketplace)` cannot be `undefined` there, so the guard's `marketplace-removed` failure path cannot happen.

## Red proof per profile

| Change | Profile | Without the fix | With the fix |
| --- | --- | --- | --- |
| WR-02 dependency move (`verdict-install.feature`, `@own-implementation`) | adapter (its only profile; the scenario starts its own built-in Pi) | fails, seed 741640: `Some plugin operations have failed.` | passes |
| WR-03 pending preview (`verdict-apply.feature`, `@mcp`) | builtin | fails, seed 677279: the row carries `partial` | passes |
| WR-03 pending preview (`verdict-apply.feature`, `@mcp`) | adapter | passes before and after: the adapter never marked an sse install (the old `@adapter-only` twin) | passes |
| WR-03 apply refusal (`@builtin-only`) | builtin | pins existing behavior (no behavior change) | passes |
| CR-01, WR-01 | n/a (no cucumber step seeds a legacy record) | red in unit and integration cases, listed above | green |

## Verification

All checks ran in the main checkout `/home/user/pi-claude-marketplace`.

- Each commit's hook ran `npm run check:commit` (typecheck, ESLint, fallow, Prettier, pairing, `check:features`, unpaired tests, and direct coverage of the staged pairs), and it passed for every commit. During the work, two hook runs failed and were fixed before commit. The D-75-01 vocabulary guard rejected a `"unsupported"` literal in `mcp-verdict.ts`. Fallow's cognitive limit rejected the `prepare` helper in `update-preflight.test.ts`.
- 100% direct coverage, run by hand, for `mcp-verdict.ts`, `mcp-verdict-read.ts`, `update-preflight.ts`, `dependency-move.ts`, `update-swap.ts`, `convergence.ts`, `mcp-migration.ts`, `notify.ts`, and `pending.ts`.
- `npm run test:integration`: passed.
- Cucumber, adapter profile: `features/mcp-server` 105/105 (seed 665742); `features/plugin/{install-dependencies,update-dependencies,pending}.feature` 98/98 (seed 814542); `features/plugin/apply.feature` 54/54 (seed 430395).
- Cucumber, builtin profile: `features/mcp-server` 99/99 (seed 467686).
- Not run: the full `npm run check` gate, `npm run test:modules`, the e2e suite, and the non-MCP cucumber features outside the paths above. These are left to the phase gate.

---

_Fixed: 2026-11-04T19:33:37Z (iteration 1), 2026-11-04T20:04:36Z (iteration 2)_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
