# Phase 1: Staging Warning Channels - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Every staging verb reports the staging warnings its materialization produced: on success, on failure, and inside cascades. `enable`, the update and reinstall cascades (`marketplace update`, autoupdate, `apply` catalog moves), and a failed install, update or reinstall show the warnings a standalone install shows. The two warning channels (discovery and hygiene) become different types, tagged at the bridge that produces them, so swapping them is a compile error.

Requirements: WRN-01..WRN-07. Backlog: ENWARN-01, UPCASC-01, WCHAN-01, WARN-01, AGIDX-01, LCORCH-01 b3 b4.

Out of scope: how apply's and import's failed-install rows render (Phase 6), dependency-move rows (Phase 3), the install-flow planning functions (Phase 4), git classification and clone cleanup (Phase 7).

</domain>

<upstream>
## Upstream position (claude-code-compat-research)

- Question: does Claude Code print per-command warnings for skipped or degraded plugin components after install, enable or update? Answer: no upstream position known for a per-command diagnostic. Claude Code collects plugin problems in a separate errors view of `/plugin` (the binary carries the string "No plugin errors"; CHANGELOG mentions "plugin error at startup"). Evidence: `grep -a` over `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`, 2026-10-26. Confidence: medium -- the errors view exists; how it words a duplicate skill was not recovered.
- Constraint: Pi has no plugin-errors view, and IL-2 allows one notification per command plus the sanctioned `notifyDiagnostic` seam. The project already decided the diagnostic surface: D-141-03 (discovery warnings reach standalone users) and D-141-05 (the split is every staging verb's policy). This phase extends those decisions to the verbs and cascades they did not reach. No new divergence from Claude Code is introduced; the surface itself is the existing D-141-03 divergence, licensed by the Pi capability gap.

</upstream>

<decisions>
## Implementation Decisions

### Warning type and producer tags (WRN-03, WCHAN-01)

- **D-PL1-01: one tagged warning type, in a new leaf module `shared/staging-warnings.ts`.** `DiscoveryWarning = { readonly kind: "discovery"; readonly message: string }`, `HygieneWarning = { readonly kind: "hygiene"; readonly message: string }`, `StagingWarning = DiscoveryWarning | HygieneWarning`, two constructors (`discoveryWarning(message)`, `hygieneWarning(message)`), and `partitionStagingWarnings(warnings)` returning `{ discovery: readonly DiscoveryWarning[]; hygiene: readonly HygieneWarning[] }`. It lives in `shared/` because every bridge zone and the orchestrators must import it and no bridge may import a sibling bridge or an orchestrator.
- **D-PL1-02: each bridge tags at the producer.** The `warnings` member of every bridge's prepare result becomes `readonly StagingWarning[]`:
  - skills, commands, workflows: every warning is `discovery` (unchanged classification).
  - mcp: every warning is `hygiene` (unchanged classification).
  - agents: the D-07 duplicate-name skips from `discoverPluginAgents` are `discovery`; agents-index corruptions and per-agent conversion notes are `hygiene`. This is the split WCHAN-01 asks for: D-07 agent skips now reach the user like every other bridge's.
  - hooks: produces no warnings; unchanged.
  - The `bridges/*/discover.ts` modules keep returning strings (`info.ts` and `discover-names.ts` read them); the stage function tags them.
  - The commit functions' cleanup-leak return (`Promise<string | undefined>`) keeps its type: a leak is hygiene by construction, and the orchestrator wraps it with `hygieneWarning(leak)` at its one push site. Changing the commit contract would ripple into uninstall and the rollback paths for no classification gain.
- **D-PL1-03: one classifier.** `splitStagingWarnings` is deleted. Install's ledger phases, the update swap, and reinstall all partition with `partitionStagingWarnings`, so D-141-05's accepted drift ("a change to the split has to be applied at install's four phase sites by hand") is gone. `InstallLedgerContext.discoveryWarnings` is `DiscoveryWarning[]`, `bridgeWarnings` is `HygieneWarning[]`, and `InstallLedgerSummary` exposes them with the same element types.
- **D-PL1-04: the renderer accepts discovery warnings only.** `surfaceDiscoveryWarnings` takes `readonly DiscoveryWarning[]`, so a hygiene warning cannot reach a standalone diagnostic without a compile error. A unit test pins this with `@ts-expect-error` (pushing a `HygieneWarning` into a `DiscoveryWarning[]`, and passing one to the renderer). Criterion 3 is proved by that test plus `npm run typecheck`.

### Diagnostic header and placement (WRN-02, UPCASC-01)

- **D-PL1-05: the header names the scope, on every verb.** `Plugin "<name>" [<scope>] <verb>; 1 declared component has a note.` / `...; N declared components have notes.` The bracketed scope matches the row grammar (`<name> [scope]`). This fixes the UPCASC-01 parity gap for install, update and reinstall at the same time, so every existing header changes bytes; the tests that pin those headers are updated.
- **D-PL1-06: closed verb union.** `"installed" | "updated" | "reinstalled" | "enabled" | "install failed" | "update failed" | "reinstall failed"`. The compiler names every header site.
- **D-PL1-07: one placement rule for every verb and every cascade.** After a command's own rows, each plugin whose materialization produced discovery warnings gets one `notifyDiagnostic`, in row order, with the D-PL1-05 header; the MCP config file notices follow the diagnostics, as they already do for install and reinstall. Lines are redacted with `redactAbsolutePaths` (NFR-9), as today.
- **D-PL1-08: cascades render the discovery half only.** The same rule as the standalone verbs (D-141-03): the user-facing channel is discovery, everywhere. The hygiene half stays on the orchestrated payload (the outcome's tagged warnings) and is not rendered by the update and reinstall cascades (D-19-01). See Uncertain choices #1.
- **D-PL1-09: the three cascades.** The `marketplace update` cascade and the autoupdate cascade are one code path (`cascadeAutoupdates` in `orchestrators/marketplace/update.ts`), so one call after the cascade rows covers both; the helper lives in `orchestrators/marketplace/update.messaging.ts`. `apply` renders the warnings of its catalog moves (`plugin-converged`, `plugin-backfilled`) and of its enable step (`plugin-enabled`) through the same per-plugin rule, right after the existing install post-commit block. The reconcile backfill named by UPCASC-01 no longer exists: a growth move now goes through the update runner and reports through `grownMoveOutcomes`, which this rule covers.

### Outcome carriers

- **D-PL1-10: the update runner carries tagged warnings.** `PluginUpdateOutcome`'s `updated` and `failed` arms (`orchestrators/types.ts`) gain `stagingWarnings?: readonly StagingWarning[]`, both halves, omitted when empty (NREG-01). The flat string fold of the warnings into the `updated` arm's `notes` is removed; the typed member replaces it, and the direct update, reinstall and the cascades read it.
- **D-PL1-11: reinstall carries the discovery half typed.** `ReinstallReinstalledOutcome.discoveryWarnings` becomes `readonly DiscoveryWarning[]`; `ReinstallFailedOutcome` gains the same optional member for WRN-04. `notes` keeps its orchestrated string fold (maintenance warnings plus the discovery half, `warning: ` prefixed).

### Enable (WRN-01, ENWARN-01)

- **D-PL1-12: the enable root renders its discovery half.** The enable branch reads `summary.discoveryWarnings` and `summary.bridgeWarnings` and collects them in the same sink that already carries the MCP config notices (`McpConfigNoticeSink` pattern, set as soon as the ledger returns). Standalone: one diagnostic with verb `enabled` after the enable row, before the MCP notices. Orchestrated: the `enabled` outcome arm carries `stagingWarnings` (both halves), and `apply` renders its discovery half (D-PL1-09). Only the enable root is rendered; the dependencies an enable cascade re-enables are not, as the install cascade does not render its members' warnings either (Deferred).

### Failure paths (WRN-04, WARN-01)

- **D-PL1-13: install.** `InstallFailureCapture` gains the tagged warnings the phases that ran collected; `runInstallLedgerBody` copies them from the context on a `runPhases` failure, beside `rollbackPartials`. The standalone failure path renders the discovery half after the `(failed)` row with verb `install failed`. The orchestrated install failure outcome does not carry them: apply's and import's failed-install rows belong to Phase 6 (Deferred).
- **D-PL1-14: update and reinstall.** A phase-3 commit or finalize failure has every prepared handle, so `composePhase3FailureOutcome` puts their tagged warnings on the `failed` outcome. A throw out of the prepare loop or the intent-mark window reports the warnings of the handles prepared so far through a report holder in `ThreePhaseArgs`, following the `CandidateReport` / `onCandidate` precedent, and the catch sites that build the `failed` outcome read it. The direct update renders the discovery half after its failure row (verb `update failed`); the cascades render failed outcomes under D-PL1-07; reinstall renders after its cascade (verb `reinstall failed`).

### Agents index (WRN-05, AGIDX-01)

- **D-PL1-15: a forced commit replaces only the rows this staging produced.** Under `force`, a foreign-preserved row (its file failed the AG-5 ownership check) is replaced -- file removed, row dropped -- only when its `generatedName` is among the names this staging's `newEntries` carry. Every other foreign-preserved row, including one the user named by hand, keeps its file and its row, exactly as an unforced commit keeps it. Rows whose files this plugin still owns (`previousEntries`) are replaced as before. A unit case in `test/bridges/agents/stage.test.ts` seeds a hand-named row.

### Dependency MCP notices (WRN-06, LCORCH-01 b3)

- **D-PL1-16: a settle reports the notices of the dependencies it installs.** The `installed` arm of `SettleCascadeRun` carries the cascade's `mcpConfigNotices` (today dropped in `install-flow.ts::saveRootClosure`); `runDependencySteps` accumulates them across materialize steps; both arms of `UpdateDependencySettlement` carry them; `materialize-latest.ts` puts them on the outcome ahead of the update's own notices, so the existing renderers (direct update, the marketplace cascade, reinstall) show them unchanged. The notices of a dependency MOVE (`dependency-move.ts`, Phase 3's file) are not included (Deferred).

### Reinstall maintenance (WRN-07, LCORCH-01 b4)

- **D-PL1-17: the completion cache drops once, in the shared swap.** `update-swap.ts::dropPluginCompletionCache` stays the one drop; reinstall's post-success maintenance stops dropping the cache and keeps only the data-dir removal. The reinstall deferral note "completion cache refresh deferred" therefore goes away; the swap's own drop failure stays debug-logged (D-19-01).
- **D-PL1-18: `resourcesChanged` comes back, derived from the runner.** The update runner's `updated` arm gains a required `resourcesChanged: boolean`: true when the record's inventory before the swap or the staged inventory after it holds any skill, prompt, agent, MCP server or workflow (hooks are re-routed in process and need no reload). `reinstall-record.ts` maps it onto the required `ReinstallReinstalledOutcome.resourcesChanged`. Phase 18 removed the field because the runner did not report the new skills and prompts inventory; the runner reports it now, so the value is right exactly when a newer version adds or removes components. The reinstall row keeps `needsReload: true` (byte-pinned D-03/D-06); no renderer is changed to read the field.

### Resolutions after research

- **D-PL1-19: one new feature file.** All new scenarios go in `features/plugin/staging-warnings.feature`, so sibling phases' feature files stay untouched. WRN-05 (AGIDX-01) and WRN-07 are proved by unit tests only: the forced-commit row is an index-file detail with no row or diagnostic, and the cache drop is not user-visible.
- **D-PL1-20: apply header verbs.** `plugin-converged` renders with `updated` (or `update failed` on its failed arm), `plugin-backfilled` with `updated`, `plugin-enabled` with `enabled`.
- **D-PL1-21: apply's held-down "move then enable" path is not changed.** Rendering it needs an edit in `apply.ts::runStep`, which is at the cognitive ceiling and which Phase 2 edits. Only the outcomes `runStep` already pushes through `grownMoveOutcomes` / `convergedMoveOutcomes` and the enable step carry warnings (Deferred).
- **D-PL1-22: direct update abort path.** When a direct update aborts, only the failed target renders its `update failed` diagnostic; the rule that targets which succeeded before the abort render no diagnostics stays.
- **D-PL1-23: corrections adopted from research.** `InstallLedgerSummary` already exposes both arrays (enable reads it, no projection change); `reconcile/notify.ts::convergedMoveOutcomes` gets the carrier spread; `update-flow.ts::surfaceUpdateMcpConfigNotices` also reads the `failed` arm so WRN-06 notices of a refused settle reach the direct path; the two agents tests that pin the old forced behavior are updated (the NFR-10 escape case gives its row a staged `generatedName`).
- **D-PL1-24: the warnings report holder extends `CandidateReport` / `recordCandidate`.** The swap reports from `prepareUpdateHandles`' catch, and once after prepare succeeds, before the intent-mark `try` (the block Phases 4 and 7 edit stays untouched). The install failure diagnostic renders only in `handleInstallThrow`'s standalone branch, never for a cascade member's failure, since cascade members share one capture.

### Claude's Discretion

- Exact helper names and module placement inside the owned files, test case structure, the report-holder shape for D-PL1-14, and the order of the warnings inside one diagnostic (bridge order skills, commands, agents, mcp, workflows, as the ledger runs).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `orchestrators/plugin/shared.ts::surfaceDiscoveryWarnings` -- the one renderer; gains `scope`, the widened verb union, and the `DiscoveryWarning[]` parameter type.
- `shared/notification-dispatch.ts::notifyDiagnostic` and `notifyMcpConfigNotices` -- the sanctioned second-notify channels.
- `enable-disable.ts::McpConfigNoticeSink` -- the sink pattern the enable branch reuses for warnings.
- `materialize-latest.ts::recordCandidate` / `CandidateReport` -- the report-holder precedent for warnings that must survive a throw.
- `reconcile/apply-outcomes.ts::carriedMcpConfigNotices` -- the precedent for a carrier helper beside the outcome types.

### Established Patterns

- NREG-01: an optional carrier key is spread only when non-empty, so a clean outcome keeps its shape and bytes.
- D-19-01 / D-141-03: hygiene warnings are orchestrated-only; discovery warnings reach standalone users through `notifyDiagnostic`.
- IL-2: one notification per command arm; the diagnostic is the sanctioned extra.

### Integration Points

- Install: `install-outcome.ts` ledger phases and failure capture; `install-flow.ts::handleInstallThrow` (standalone failure render), `collectPostCommitWarnings` (maps tagged warnings to strings), the success-path `surfaceDiscoveryWarnings` call, `saveRootClosure` (settle notices).
- Update: `update-swap.ts` (`collectUpdateWarnings`, `composePhase3FailureOutcome`, prepare/intent-mark throws), `update-flow.ts::surfaceUpdateDiscoveryWarnings` (direct render), `materialize-latest.ts`, `dependency-settle.ts`.
- Reinstall: `reinstall-flow.ts`, `reinstall-record.ts`.
- Enable: `enable-disable.ts::materializeEnableRoot`, `runEnableBranch`, `buildEnableRootPhase`, `runSetEnabledOutcome`.
- Cascades: `marketplace/update.ts` (after the cascade rows), `marketplace/update.messaging.ts` (helper), `reconcile/apply.ts` (move and enable rows, renderer), `reconcile/apply-outcomes.ts` (carriers).
- Files outside this phase's `Files` line that the plan has to touch (call sites only): `install-flow.ts` (`handleInstallThrow`, the success-path render call, `collectPostCommitWarnings`, `saveRootClosure`), `update-flow.ts` (`surfaceUpdateDiscoveryWarnings` and the failure catch), `reinstall-record.ts`, `marketplace/update.ts` (one call), `reconcile/apply.ts` (move/enable carriers and the renderer), the new `shared/staging-warnings.ts`.

</code_context>

<specifics>
## Specific Ideas

- Criterion 1 scenario: enable a disabled plugin whose skills collide; the enable output shows the same skip line `install` shows, under `Plugin "<name>" [<scope>] enabled; ...`.
- Criterion 2 scenarios: a `marketplace update` cascade (with autoupdate on, which is the same path as autoupdate) and an `apply` catalog move each show a moved plugin's warnings under `Plugin "<name>" [<scope>] updated; ...`.
- Criterion 4 scenario: an install whose mcp phase fails after the skills phase skipped a duplicate shows the skip after the `(failed)` row, under `Plugin "<name>" [<scope>] install failed; ...`.
- A scenario for the agents D-07 skip reaching a standalone install (WRN-03 is user-visible through D-PL1-02).

</specifics>

<deferred>
## Deferred Ideas

- The orchestrated install failure carrying its warnings to apply's and import's failed-install rows (Phase 6 owns those rows).
- Rendering the warnings of the dependencies an install or enable cascade materializes (members, not the root).
- The MCP config notices of a dependency move (`dependency-move.ts`, Phase 3).
- An `enable failed` header for an enable whose ledger failed (WRN-04 names install, update and reinstall only).
- Converting apply's existing install post-commit block ("N post-install warnings surfaced from reconcile installs.") to the per-plugin header.

</deferred>

## Uncertain choices (for user review)

1. **Cascades render the discovery half only (D-PL1-08).** Alternative: render both halves in cascades, matching the install cascade, whose orchestrated `postCommitWarnings` include hygiene lines and which apply and import render. Chosen because the WGATE-01 header ("declared components have notes") would be false over hygiene lines such as an index corruption or a cleanup leak, and because it gives one rule for standalone and cascade.
2. **Commit cleanup leaks are tagged at the orchestrator, not the bridge (D-PL1-02).** Alternative: change every `commitPrepared*` to return a `HygieneWarning`. Chosen to keep the commit contract that uninstall and the rollback paths share; a leak has only one possible tag.
3. **AGIDX-01 matches against this staging's new names (D-PL1-15).** Alternative: also replace foreign-preserved rows the plugin's record names (agents an earlier version shipped). Chosen because it never deletes a user-edited file the current version does not replace; the cost is that a forced reinstall leaves such a file and row in place.
4. **`resourcesChanged` derivation and no reader (D-PL1-18).** Alternative: have the reinstall row's `needsReload` read it, which would drop the `/reload` hint for a hooks-only reinstall. Chosen not to change the byte-pinned row; the field is restored as WRN-07 states, but nothing in production reads it today.
5. **Failure header verbs (D-PL1-06)** read `install failed` / `update failed` / `reinstall failed`. Alternative: `not installed` / `not updated`. Chosen to name the attempted verb plainly.
6. **Agents conversion notes stay hygiene (D-PL1-02).** Alternative: tag dropped-field / dropped-tool notes as discovery, since they describe a declared agent that installed with a caveat (the WGATE-01 shape). Chosen to change only what WCHAN-01 names (the D-07 skips).
7. **Apply's install warnings keep their existing generic block (Deferred).** Alternative: move them to the per-plugin header too, so one apply run uses one header shape. Chosen to keep the change inside this phase's files and away from Phase 6's failed-install row.

---

*Phase: 01-staging-warning-channels*
*Context gathered: 2026-10-26*
