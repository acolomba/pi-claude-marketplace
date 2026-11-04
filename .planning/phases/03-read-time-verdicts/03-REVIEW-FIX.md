---
phase: 03-read-time-verdicts
fixed_at: 2026-11-04T19:33:37Z
review_path: .planning/phases/03-read-time-verdicts/03-REVIEW.md
iteration: 1
fix_scope: all
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
findings:
  CR-01: {outcome: fixed, commit: 20ac944}
  WR-01: {outcome: "fixed: requires human verification", commit: 3817f22}
  WR-02: {outcome: "fixed: requires human verification", commit: 8a7404f, note: "partial fix by decision: cascades only; a user-run update keeps today's rules"}
  WR-03: {outcome: "fixed: requires human verification", commit: 04f07a0, note: "preview fixed; pre-existing non-MCP mismatch left as it was"}
  IN-01: {outcome: fixed, commit: 89f72ad}
  IN-02: {outcome: fixed, commit: 224fd7d}
  IN-03: {outcome: skipped, reason: "orchestrator decision: keep the defensive guard (P3-DC-91)"}
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-04T19:33:37Z
**Source review:** .planning/phases/03-read-time-verdicts/03-REVIEW.md
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

_Fixed: 2026-11-04T19:33:37Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
