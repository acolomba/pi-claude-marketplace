# Phase 1: Staging Warning Channels - Research

**Researched:** 2026-10-26
**Domain:** Internal TypeScript refactor + user-visible notification behavior (Pi extension, no new dependencies)
**Confidence:** HIGH (every claim below was read in this session at current HEAD `812fa85f`; two typecheck ripples were measured by a reverted trial edit)

## Summary

This phase is a type-and-plumbing change inside the extension. There is no library to choose. The work is: (1) one new leaf module `shared/staging-warnings.ts` with a tagged union; (2) the five bridges that produce prepare warnings tag them; (3) install, update, reinstall, enable, and the three cascades (`marketplace update`/autoupdate, `apply` moves, `apply` enables) carry the tagged warnings and render the discovery half through the one renderer, whose header now names the scope; (4) three small orchestrator fixes (AGIDX-01 forced agents commit, LCORCH-01 b3 dependency MCP notices on update, LCORCH-01 b4 reinstall `resourcesChanged` and single cache drop).

The CONTEXT's integration list is mostly right, with four corrections found in the code: (a) `InstallLedgerSummary` ALREADY exposes `bridgeWarnings` and `discoveryWarnings` (the ENWARN-01 backlog text is stale), so enable only has to read them; (b) `orchestrators/reconcile/notify.ts::convergedMoveOutcomes` builds the `plugin-converged` outcome, so it needs a one-line carrier spread per arm and is NOT in the CONTEXT list; (c) `update-flow.ts::surfaceUpdateMcpConfigNotices` reads MCP notices only from `updated` outcomes, so WRN-06's refused-settle notices would not render on the direct path unless it also reads the non-phase-3 `failed` arm; (d) two existing agents unit tests pin the OLD AGIDX behavior and must change, one of them (the NFR-10 escape test) in a way that keeps its point.

The biggest planning risk is not logic but ripple and merge conflict. Making `resourcesChanged` REQUIRED on both the runner's `updated` arm and `ReinstallReinstalledOutcome` (D-PL1-18, locked) produces 96 compile errors: 2 in production and 94 in 10 test files, several of which belong to sources other wave-1 phases own. The tagged `warnings` type change is small by comparison: 30 compile errors. Two functions sit at the fallow cognitive ceiling (`apply.ts::runStep` is at 15 of 15), so every new branch must live in a helper.

**Primary recommendation:** Build `shared/staging-warnings.ts` first (wave 0, with its paired test), then tag the bridges, then thread carriers per verb, keeping every new conditional in a small named helper and every edit in a sibling-shared file inside the exact functions named below.

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Never commit to `main`; merge, never rebase; Conventional Commits; no GSD milestone/phase/plan in commit messages or scopes. [CITED: AGENTS.md, .agents/skills/committing/SKILL.md]
- Read a file before editing it; trace callers before changing a function. [CITED: AGENTS.md]
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario under `features/` that fails without the change; unit tests do not replace it. [CITED: AGENTS.md "Behavioral tests"]
- `npm run check` (static + unpaired + integration + cucumber + 100% direct coverage per pair) is the gate for every GSD wave/phase gate; the commit hook runs only `check:commit`. [CITED: AGENTS.md, .agents/skills/local-verification/rules/gates.md]
- Every production `.ts` file has exactly one paired test at the mirrored path; each pair reaches 100% line/function/branch coverage alone; no coverage ignores. [CITED: .agents/skills/typescript-unit-tests/rules/pairing-and-design.md]
- Output only through `shared/notification-dispatch.ts` (`notify`, `notifyDiagnostic`, `notifyMcpConfigNotices`); no stdout/stderr; one notification per command arm plus the sanctioned diagnostic (IL-2). [CITED: AGENTS.md Constraints]
- Upstream parity: no new divergence; this phase extends the existing D-141-03 divergence (Pi has no `/plugin` errors view). [CITED: 01-CONTEXT.md `<upstream>`]
- Comments cite durable IDs (D-PL1-NN, WRN-NN, NFR-N), never "Phase N"/"Plan N"; no comments on trivial code. [CITED: .planning/codebase/CONVENTIONS.md "Comments"]
- Exported functions declare return types; `import-x/order` groups with type imports last; `curly: all`; blank line after block statements; `sonarjs/cognitive-complexity` 15 AND fallow `maxCognitive` 15 / `maxCyclomatic` 20, both must pass. [CITED: .planning/codebase/CONVENTIONS.md]
- `fallow dupes --fail-on-issues` fails on every clone group (no threshold). [CITED: .planning/codebase/STACK.md]
- Tests that touch user state must use the hermetic home helper (`withHermeticHome`), never real `~/.pi/agent`. [CITED: MEMORY "Subagent tests must use hermetic home"]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Warning type and producer tags (WRN-03, WCHAN-01)

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

#### Diagnostic header and placement (WRN-02, UPCASC-01)

- **D-PL1-05: the header names the scope, on every verb.** `Plugin "<name>" [<scope>] <verb>; 1 declared component has a note.` / `...; N declared components have notes.` The bracketed scope matches the row grammar (`<name> [scope]`). This fixes the UPCASC-01 parity gap for install, update and reinstall at the same time, so every existing header changes bytes; the tests that pin those headers are updated.
- **D-PL1-06: closed verb union.** `"installed" | "updated" | "reinstalled" | "enabled" | "install failed" | "update failed" | "reinstall failed"`. The compiler names every header site.
- **D-PL1-07: one placement rule for every verb and every cascade.** After a command's own rows, each plugin whose materialization produced discovery warnings gets one `notifyDiagnostic`, in row order, with the D-PL1-05 header; the MCP config file notices follow the diagnostics, as they already do for install and reinstall. Lines are redacted with `redactAbsolutePaths` (NFR-9), as today.
- **D-PL1-08: cascades render the discovery half only.** The same rule as the standalone verbs (D-141-03): the user-facing channel is discovery, everywhere. The hygiene half stays on the orchestrated payload (the outcome's tagged warnings) and is not rendered by the update and reinstall cascades (D-19-01). See Uncertain choices #1.
- **D-PL1-09: the three cascades.** The `marketplace update` cascade and the autoupdate cascade are one code path (`cascadeAutoupdates` in `orchestrators/marketplace/update.ts`), so one call after the cascade rows covers both; the helper lives in `orchestrators/marketplace/update.messaging.ts`. `apply` renders the warnings of its catalog moves (`plugin-converged`, `plugin-backfilled`) and of its enable step (`plugin-enabled`) through the same per-plugin rule, right after the existing install post-commit block. The reconcile backfill named by UPCASC-01 no longer exists: a growth move now goes through the update runner and reports through `grownMoveOutcomes`, which this rule covers.

#### Outcome carriers

- **D-PL1-10: the update runner carries tagged warnings.** `PluginUpdateOutcome`'s `updated` and `failed` arms (`orchestrators/types.ts`) gain `stagingWarnings?: readonly StagingWarning[]`, both halves, omitted when empty (NREG-01). The flat string fold of the warnings into the `updated` arm's `notes` is removed; the typed member replaces it, and the direct update, reinstall and the cascades read it.
- **D-PL1-11: reinstall carries the discovery half typed.** `ReinstallReinstalledOutcome.discoveryWarnings` becomes `readonly DiscoveryWarning[]`; `ReinstallFailedOutcome` gains the same optional member for WRN-04. `notes` keeps its orchestrated string fold (maintenance warnings plus the discovery half, `warning: ` prefixed).

#### Enable (WRN-01, ENWARN-01)

- **D-PL1-12: the enable root renders its discovery half.** The enable branch reads `summary.discoveryWarnings` and `summary.bridgeWarnings` and collects them in the same sink that already carries the MCP config notices (`McpConfigNoticeSink` pattern, set as soon as the ledger returns). Standalone: one diagnostic with verb `enabled` after the enable row, before the MCP notices. Orchestrated: the `enabled` outcome arm carries `stagingWarnings` (both halves), and `apply` renders its discovery half (D-PL1-09). Only the enable root is rendered; the dependencies an enable cascade re-enables are not, as the install cascade does not render its members' warnings either (Deferred).

#### Failure paths (WRN-04, WARN-01)

- **D-PL1-13: install.** `InstallFailureCapture` gains the tagged warnings the phases that ran collected; `runInstallLedgerBody` copies them from the context on a `runPhases` failure, beside `rollbackPartials`. The standalone failure path renders the discovery half after the `(failed)` row with verb `install failed`. The orchestrated install failure outcome does not carry them: apply's and import's failed-install rows belong to Phase 6 (Deferred).
- **D-PL1-14: update and reinstall.** A phase-3 commit or finalize failure has every prepared handle, so `composePhase3FailureOutcome` puts their tagged warnings on the `failed` outcome. A throw out of the prepare loop or the intent-mark window reports the warnings of the handles prepared so far through a report holder in `ThreePhaseArgs`, following the `CandidateReport` / `onCandidate` precedent, and the catch sites that build the `failed` outcome read it. The direct update renders the discovery half after its failure row (verb `update failed`); the cascades render failed outcomes under D-PL1-07; reinstall renders after its cascade (verb `reinstall failed`).

#### Agents index (WRN-05, AGIDX-01)

- **D-PL1-15: a forced commit replaces only the rows this staging produced.** Under `force`, a foreign-preserved row (its file failed the AG-5 ownership check) is replaced -- file removed, row dropped -- only when its `generatedName` is among the names this staging's `newEntries` carry. Every other foreign-preserved row, including one the user named by hand, keeps its file and its row, exactly as an unforced commit keeps it. Rows whose files this plugin still owns (`previousEntries`) are replaced as before. A unit case in `test/bridges/agents/stage.test.ts` seeds a hand-named row.

#### Dependency MCP notices (WRN-06, LCORCH-01 b3)

- **D-PL1-16: a settle reports the notices of the dependencies it installs.** The `installed` arm of `SettleCascadeRun` carries the cascade's `mcpConfigNotices` (today dropped in `install-flow.ts::saveRootClosure`); `runDependencySteps` accumulates them across materialize steps; both arms of `UpdateDependencySettlement` carry them; `materialize-latest.ts` puts them on the outcome ahead of the update's own notices, so the existing renderers (direct update, the marketplace cascade, reinstall) show them unchanged. The notices of a dependency MOVE (`dependency-move.ts`, Phase 3's file) are not included (Deferred).

#### Reinstall maintenance (WRN-07, LCORCH-01 b4)

- **D-PL1-17: the completion cache drops once, in the shared swap.** `update-swap.ts::dropPluginCompletionCache` stays the one drop; reinstall's post-success maintenance stops dropping the cache and keeps only the data-dir removal. The reinstall deferral note "completion cache refresh deferred" therefore goes away; the swap's own drop failure stays debug-logged (D-19-01).
- **D-PL1-18: `resourcesChanged` comes back, derived from the runner.** The update runner's `updated` arm gains a required `resourcesChanged: boolean`: true when the record's inventory before the swap or the staged inventory after it holds any skill, prompt, agent, MCP server or workflow (hooks are re-routed in process and need no reload). `reinstall-record.ts` maps it onto the required `ReinstallReinstalledOutcome.resourcesChanged`. Phase 18 removed the field because the runner did not report the new skills and prompts inventory; the runner reports it now, so the value is right exactly when a newer version adds or removes components. The reinstall row keeps `needsReload: true` (byte-pinned D-03/D-06); no renderer is changed to read the field.

### Claude's Discretion

- Exact helper names and module placement inside the owned files, test case structure, the report-holder shape for D-PL1-14, and the order of the warnings inside one diagnostic (bridge order skills, commands, agents, mcp, workflows, as the ledger runs).

### Deferred Ideas (OUT OF SCOPE)

- The orchestrated install failure carrying its warnings to apply's and import's failed-install rows (Phase 6 owns those rows).
- Rendering the warnings of the dependencies an install or enable cascade materializes (members, not the root).
- The MCP config notices of a dependency move (`dependency-move.ts`, Phase 3).
- An `enable failed` header for an enable whose ledger failed (WRN-04 names install, update and reinstall only).
- Converting apply's existing install post-commit block ("N post-install warnings surfaced from reconcile installs.") to the per-plugin header.

### Uncertain choices recorded in CONTEXT (for user review; not re-opened here)

1. Cascades render the discovery half only (D-PL1-08). 2. Commit cleanup leaks tagged at the orchestrator (D-PL1-02). 3. AGIDX-01 matches against this staging's new names (D-PL1-15). 4. `resourcesChanged` with no reader (D-PL1-18). 5. Failure header verbs `install failed` / `update failed` / `reinstall failed`. 6. Agents conversion notes stay hygiene. 7. Apply's install warnings keep their generic block.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRN-01 | `enable` shows the discovery warnings its re-materialization produces, as `install` does (ENWARN-01) | Enable section: `materializeEnableRoot` already holds `summary` with both arrays; sink + standalone render site after `dispatchOutcome` and before `notifyMcpConfigNotices` (`enable-disable.ts:2593-2605`) |
| WRN-02 | Cascade update/reinstall renders each plugin's warnings, one placement rule, header names scope (UPCASC-01) | Header site `shared.ts:1809-1828`; marketplace cascade emission `marketplace/update.ts:910-921`; apply emission order `apply.ts:1883-1912`; carriers in `apply-outcomes.ts`, `reconcile/notify.ts:423-473` |
| WRN-03 | Each bridge tags at producer; swapping channels is a compile error (WCHAN-01) | Measured 30 tsc errors when the five commit-result `warnings` types change (list below); agents aggregation `agents/stage.ts:146-150` |
| WRN-04 | Failed install/update/reinstall reports prepare warnings collected before the failure (WARN-01) | `install-outcome.ts:1538-1550` capture block; `handleInstallThrow` standalone branch `install-flow.ts:1708-1729`; update throw sites `update-swap.ts:419-421`, `1433-1443`, `1494-1499`; catch sites `update-flow.ts:403-424`, `715-728`, `materialize-latest.ts:135-153`, `reinstall-flow.ts:280-287` |
| WRN-05 | A forced agents commit keeps a hand-named `agents-index.json` row (AGIDX-01) | `agents/stage.ts:295-302` `partitionPreviousEntries`; two existing tests pin the old behavior (`stage.test.ts:1573-1648`, `1720-1785`) |
| WRN-06 | `update` shows the MCP notices of the dependencies it installs (LCORCH-01 b3) | Notices dropped at `install-flow.ts:3430-3455`; `dependency-settle.ts:45-47, 116-131, 137-174, 187-226`; `materialize-latest.ts:84-152`; direct renderer gap `update-flow.ts:498-508` |
| WRN-07 | Reinstall outcome carries `resourcesChanged`; reinstall drops the completion cache once (LCORCH-01 b4) | Double drop `update-swap.ts:1549` + `reinstall-flow.ts:454-463`; mapping site `reinstall-record.ts:89-106`; measured 96 tsc errors for the required field |
</phase_requirements>

## Architectural Responsibility Map

The extension has no browser/server tiers; its layers are the relevant "tiers" (fallow boundary zones).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tagged warning type, constructors, partition | `shared/` (leaf) | -- | Every bridge zone and the orchestrators import it; `shared` may import only `platform` [VERIFIED: .fallowrc.json boundaries rule `{'from': 'shared', 'allow': ['platform']}`] |
| Tagging each warning | `bridges/<kind>/stage.ts` | `bridges/<kind>/types.ts` | Producer knows the kind; discover modules keep strings (D-PL1-02) |
| Wrapping commit cleanup leaks | `orchestrators/plugin/install-outcome.ts` ledger phases | -- | Commit contract stays `Promise<string \| undefined>` |
| Carrying warnings across lock / runner boundaries | `orchestrators/plugin/*` (install-outcome, update-swap, materialize-latest, reinstall-flow/record, enable-disable, dependency-settle) + `orchestrators/types.ts` | `orchestrators/reconcile/apply-outcomes.ts` | Outcomes are the only thing that crosses from runner to renderer |
| Rendering one per-plugin diagnostic | `orchestrators/plugin/shared.ts::surfaceDiscoveryWarnings` | `shared/notification-dispatch.ts::notifyDiagnostic` | Single renderer; sanctioned second-notify seam (IL-2) |
| Cascade placement (rows -> diagnostics -> MCP notices) | each command's final emission function | -- | `marketplace/update.ts`, `reconcile/apply.ts`, `update-flow.ts`, `reinstall-flow.ts`, `install-flow.ts`, `enable-disable.ts` |
| Agents index row retention under force | `bridges/agents/stage.ts` | -- | Pure bridge logic |

## Standard Stack

No new libraries. The phase uses the existing toolchain only.

| Tool | Version (repo) | Purpose |
|------|----------------|---------|
| TypeScript strict (`noEmit`) | `^6.0.3` | Discriminated union makes the channel swap a compile error [CITED: .planning/codebase/STACK.md] |
| `node:test` + `node:assert/strict` + `strong-mock` | built-in | Unit tests, one pair per source [CITED: .agents/skills/typescript-unit-tests/SKILL.md] |
| `@cucumber/cucumber` | repo devDep | Behavioral scenarios under `features/` [CITED: .agents/skills/cucumber/SKILL.md] |
| fallow | `^3.33.1` | dead-code, health (cognitive 15 / cyclomatic 20), dupes, boundaries [CITED: .planning/codebase/STACK.md] |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. **Packages removed due to [SLOP]:** none. **Packages flagged [SUS]:** none.

## Architecture Patterns

### Data flow (warnings, after the change)

```
bridge prepareStage*()  --tags-->  result.warnings: StagingWarning[]
        |                                   (skills/commands/workflows: discovery; mcp: hygiene;
        |                                    agents: D-07 skips discovery, corruptions+conversion hygiene)
        v
 +---------------------------+      +----------------------------------+
 | install ledger phase do() |      | update swap prepareUpdateHandles |
 | partition -> ctx arrays   |      | collect in bridge order          |
 | leak -> hygieneWarning()  |      |                                  |
 +------------+--------------+      +-----------+----------------------+
              | ok                              | ok: outcome.stagingWarnings (both halves)
              | fail: capture.stagingWarnings    | throw: args.onStagingWarnings(report holder)
              v                                  | phase-3 fail: failed.stagingWarnings
   InstallLedgerSummary (typed)                  v
     |        |                       materializeLatestVersion (+ settle notices first)
     |        +--> enable: sink.stagingWarnings         |
     |                 |                    +-----------+-------------+---------------+
     v                 v                    v                         v               v
 install row     enable row          update-flow direct      marketplace cascade   apply converge
     |                 |             (and reinstall-record)  (update.messaging)    (apply-outcomes,
     v                 v                    |                         |              reconcile/notify)
  surfaceDiscoveryWarnings({plugin, scope, verb, partition(w).discovery})  <-- one renderer
     |
     v
  notifyDiagnostic (severity "warning")  ->  then notifyMcpConfigNotices
```

### Pattern 1: The leaf module (`shared/staging-warnings.ts`)

```typescript
// Shape fixed by D-PL1-01; implementation detail is discretion.
export interface DiscoveryWarning {
  readonly kind: "discovery";
  readonly message: string;
}
export interface HygieneWarning {
  readonly kind: "hygiene";
  readonly message: string;
}
export type StagingWarning = DiscoveryWarning | HygieneWarning;

export function discoveryWarning(message: string): DiscoveryWarning {
  return { kind: "discovery", message };
}
export function hygieneWarning(message: string): HygieneWarning {
  return { kind: "hygiene", message };
}
export function partitionStagingWarnings(warnings: readonly StagingWarning[]): {
  readonly discovery: readonly DiscoveryWarning[];
  readonly hygiene: readonly HygieneWarning[];
} {
  const discovery: DiscoveryWarning[] = [];
  const hygiene: HygieneWarning[] = [];
  for (const warning of warnings) {
    if (warning.kind === "discovery") {
      discovery.push(warning);
    } else {
      hygiene.push(warning);
    }
  }
  return { discovery, hygiene };
}
```

Imports nothing, so it satisfies the `shared` zone and every bridge zone may import it [VERIFIED: .fallowrc.json zones; bridges allow `shared`]. Paired test: `test/shared/staging-warnings.test.ts` (runtime cases for the constructors and partition order, plus the `@ts-expect-error` negative for pushing a `HygieneWarning` into a `DiscoveryWarning[]`). The renderer half of D-PL1-04 (`@ts-expect-error` on `surfaceDiscoveryWarnings`) belongs in `test/orchestrators/plugin/shared.test.ts`, because a test may not test one source from another source's test [CITED: pairing-and-design.md]. Precedent for compile-time locks: `test/architecture/hooks-foundation.test.ts:182` (`// @ts-expect-error -- NFR-7: ...`).

### Pattern 2: Report holder for warnings that must survive a throw (D-PL1-14)

Precedent, read verbatim [VERIFIED: materialize-latest.ts:28-44]:

```typescript
export interface CandidateReport {
  move?: Partial<RevisionMove>;
}
export function recordCandidate(
  report: CandidateReport,
): Pick<ThreePhaseArgsBase, "onCandidate" | "onRecord"> {
  return {
    onRecord: (fromVersion) => { report.move = { fromVersion }; },
    onCandidate: (move) => { report.move = move; },
  };
}
```

Recommended extension (discretion): add `stagingWarnings?: readonly StagingWarning[]` to `CandidateReport`, add `onStagingWarnings?: (warnings: readonly StagingWarning[]) => void` to `ThreePhaseArgsBase` (`update-swap.ts:191-257`), and wire it in `recordCandidate`. Every catch site already creates a `CandidateReport` per target (`update-flow.ts:389`, `update-flow.ts:719`, `reinstall-flow.ts:278`), so no new holder plumbing is needed. Remember `runCascadeTarget`'s parameter type is `Omit<CascadeThreePhaseArgs, "onCandidate" | "onRecord">` (`update-flow.ts:717`) and must also omit the new callback.

**Where to call it in `update-swap.ts` (conflict-aware):**
- In `prepareUpdateHandles`'s catch (`update-swap.ts:419-421`), report the warnings of the handles already prepared, before the rethrow. This function is Phase 1's alone.
- Report the full set ONCE right after `prepareUpdateHandles` returns (`update-swap.ts:1412-1418`), BEFORE the intent-mark `try` at `1433-1443`. That `try` block is exactly where Phase 4 (agent-target check, `assertAgentCommitTargets`) and Phase 7 (intent mark) edit; reporting before it covers the agent-target and intent-mark throws without touching that block.
- `composePhase3FailureOutcome` (`update-swap.ts:1304-1361`) puts the handles' warnings on the returned `failed` outcome (it needs a `handles` or warnings argument; its call site is `1494-1499`).

### Pattern 3: NREG-01 carrier spread

Precedent [VERIFIED: apply-outcomes.ts:850-856]:

```typescript
export function carriedMcpConfigNotices(carrier: {
  readonly mcpConfigNotices?: readonly McpConfigNotice[];
}): Pick<OutcomeBase, "mcpConfigNotices"> {
  return carrier.mcpConfigNotices === undefined
    ? {}
    : { mcpConfigNotices: carrier.mcpConfigNotices };
```

Add a sibling `carriedStagingWarnings(carrier)` in `apply-outcomes.ts` and spread it wherever `carriedMcpConfigNotices(result)` is spread for an enable/move outcome. Using a helper function call instead of an inline `...(x !== undefined && {...})` keeps the cognitive score of the caller unchanged.

### Anti-Patterns to Avoid

- **Inline conditional spreads in ceiling functions.** `apply.ts::runStep` is at cognitive 15/15, `install-flow.ts::installPluginWithTransaction` at cyclomatic 18/20 [VERIFIED: `npx fallow health ... --format compact`, this session]. Any `&&`, `?:`, or `if` added there fails `npm run fallow`. Put logic in helpers.
- **Rendering the dependency's warnings under the root's name.** `capture` is shared by every cascade member's ledger (`install-cascade.ts:536-540`, threaded at `1232-1238`). When a dependency member fails, `capture` holds that member's warnings and `cascadeFailure.subject` is set. Render only on the `handleInstallThrow` path (subject undefined), never in `handleCascadeThrow`.
- **Passing `postCommitWarnings` to the renderer.** After D-PL1-04 the renderer takes `DiscoveryWarning[]`; the install success call must pass `installCtx.discoveryWarnings` (today it passes the standalone `postCommitWarnings`, which in standalone mode is exactly the discovery strings, so bytes stay the same) [VERIFIED: install-flow.ts:1170-1172, 2861-2865].
- **Editing `cascadeFailureOutcome` in `update-flow.ts`.** Phase 7 (CASCREASON-01) edits its `reasons` line. Prefer spreading the report's warnings in `runCascadeTarget` around the call: `return { ...cascadeFailureOutcome(args.plugin, report, err), ...stagingWarningsMember(report) }`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path redaction in diagnostic lines | per-site regex | `shared/redact-absolute-paths.ts::redactAbsolutePaths` (already applied inside `surfaceDiscoveryWarnings`) | NFR-9; URL-safe anchor rules already solved |
| A second diagnostic channel | direct `ctx.ui.notify` | `notifyDiagnostic` | `architecture/notify-chokepoint` rule-pack ban |
| Per-verb classifiers | `splitStagingWarnings` copies | `partitionStagingWarnings` | D-PL1-03 |
| Per-verb loops over outcomes | one loop per cascade | one helper in `plugin/shared.ts` that takes `{ plugin, scope, verb, warnings }` entries | `fallow dupes` fails on any clone group; loops in update-flow, reinstall-flow, update.messaging, apply would otherwise look alike |

## Research Answers (file:line evidence at HEAD)

### Q1. Producers and consumers of each bridge prepare result's `warnings`

The five types that change (`StageXCommitResult.warnings`), read this session:

| Bridge | Type (file:line) | Production producer sites (tsc-measured) | Kind |
|--------|------------------|------------------------------------------|------|
| skills | `skills/types.ts:84-92` `readonly warnings: readonly string[];` (line 87) | `skills/stage.ts:248`, `:398` (`Object.freeze([...discoverWarnings])`) | discovery |
| commands | `commands/types.ts:83-92` (line 87) | `commands/stage.ts:174`, `:283` | discovery |
| agents | `agents/types.ts:120-135` `/** Aggregated warnings (per-agent + per-row index corruptions). */ readonly warnings: readonly string[];` (line 128) | `agents/stage.ts:161`, `:242`; aggregation at `:146-150`: `...loaded.corruptions.map(...)` (hygiene), `...converted.flatMap((c) => formatAgentWarnings(c))` (hygiene), `...discoverWarnings` (discovery) | mixed |
| mcp | `mcp/types.ts:66-91` (line 75) | `mcp/stage.ts:380` (`Object.freeze<string[]>([])`, must become the tagged element type), `:534` (`stampWarnings` from `stampServers`), `:593` | hygiene |
| workflows | `workflows/types.ts:129-150` (line 131) | `workflows/stage.ts:202`, `:257` | discovery |
| hooks | no warnings member | -- | -- |

Types that stay `string[]` (do NOT change): every `Unstage*Result.warnings` (`skills/types.ts:131`, `commands/types.ts:126`, `agents/types.ts:171`, `mcp/types.ts:167`, `workflows/types.ts:222`), `ConvertedAgent.warnings` (`agents/types.ts:63`), and every `Discover*Result.warnings` (e.g. `workflows/types.ts:89`) [VERIFIED: read].

Production consumers (tsc-measured, 30 errors total when the five types change):
- `install-outcome.ts:1093` (skills), `:1136` (commands), `:1185` (agents), `:1287` (mcp), `:1366` (workflows) -- the five ledger pushes.
- `update-swap.ts:439-442, 450` -- `collectUpdateWarnings`.
- Not consumers: `reconcile/mcp-migration.ts:464-477` (reads `notices`/`stagedNames` only), `plugin/info.ts:1090` (reads the workflows DISCOVER result) [VERIFIED: read].

Tests (tsc-measured compile errors: 10, all in `test/bridges/*/types.test.ts`, two each: agents `:79,:82`; commands `:45,:48`; mcp `:60,:63`; skills `:46,:49`; workflows `:70,:72`). Runtime assertions that compare non-empty warning arrays and will need tagged expectations: skills `stage.test.ts:245`; commands `:595`; workflows `:242`, `:355`; mcp `:814`; agents `:100`, `:152`, `:269`, `:523`/`:572` [VERIFIED: grep + read]. Empty `warnings: []` literals (about 40 sites) compile unchanged.

Orchestrator tests that assert these strings downstream: `install-outcome.test.ts:647, 662, 709, 815, 1732` (`summary.bridgeWarnings` with leak strings -> `hygieneWarning(...)` objects); `shared.test.ts` 3 `splitStagingWarnings` references (delete, replace with `test/shared/staging-warnings.test.ts` cases); `update-swap.test.ts:511` (expected `notes` on an `updated` outcome -> `stagingWarnings: [hygieneWarning("[bot] source description was missing or empty -- using fallback")]`); `update-flow.test.ts:1385` (agents D-07 duplicate on cascade `notes` -> now a discovery-tagged member), `:11174`, `:11564` [VERIFIED: read].

Behavior change to note: the agents D-07 duplicate (e.g. the `install-flow.test.ts:1339-1400` fixture) now joins `discoveryWarnings`, so it reaches a standalone install diagnostic and, in orchestrated `postCommitWarnings`, it moves ahead of the hygiene lines (the order inside `collectPostCommitWarnings` is discovery first, `install-flow.ts:1170-1222`). That test asserts a single warning, so its expectation is unchanged.

### Q2. Header text sites and pins

Only producer [VERIFIED: shared.ts:1809-1828]:

```typescript
    readonly verb: "installed" | "updated" | "reinstalled";
    readonly warnings: readonly string[];
...
      ? `Plugin "${args.plugin}" ${args.verb}; 1 declared component has a note.`
      : `Plugin "${args.plugin}" ${args.verb}; ${lines.length.toString()} declared components have notes.`;
```

Callers: `install-flow.ts:2861-2865` (verb `installed`), `update-flow.ts:471-487` (`updated`, inside `surfaceUpdateDiscoveryWarnings`), `reinstall-flow.ts:630-646` (`reinstalled`) [VERIFIED: read]. The new `scope` argument: install has `scope` in scope; reinstall outcomes carry `scope`; update's loop receives `UpdateCascadeOutcome` = `{ target, outcome }` [VERIFIED: update-cascade.ts:39-42], and `target` carries `scope`, but the current helper destructures `{ outcome }` only, so its parameter type widens. `Scope` is `"user" | "project"` [VERIFIED: shared/types.ts:16].

Pins to update (19 assertions, 4 files, no feature file, no doc) [VERIFIED: grep over test/ features/ docs/]:
- `test/orchestrators/plugin/shared.test.ts:3516, 3558, 3590`
- `test/orchestrators/plugin/install-flow.test.ts:12205, 12292, 17910, 18135`
- `test/orchestrators/plugin/reinstall-flow.test.ts:6527, 6574, 6628, 6633, 6825, 6968`
- `test/orchestrators/plugin/update-flow.test.ts:11093, 11138, 11212, 11258, 11263, 11530` (11530 is a regex)

### Q3. Update runner arms: readers of `updated.notes`, producers of `failed`

`updated.notes` is declared at `types.ts:470` (`readonly notes?: readonly string[];`) and produced by the fold at `update-swap.ts:1548` / `:1594` (`...(updateWarnings.length > 0 && { notes: updateWarnings })`). Production readers [VERIFIED: grep `\.notes\b` across orchestrators/edge/index.ts, then read]:
- `update-flow.ts:477-484` (`surfaceUpdateDiscoveryWarnings`)
- `reinstall-flow.ts:426` (`discoveryWarnings: run.partition === "updated" ? (run.notes ?? []) : []`)

No other reader: `update.messaging.ts:221/229` read `skipped`/`failed` arms; `update-row.ts:305` reads `skipped`; `dependency-move.ts:154` reads a non-`updated` verdict. So the fold can be replaced by `stagingWarnings` and the `notes?` member REMOVED from the `updated` arm (recommended; otherwise it is a member with no producer).

Producers of the `failed` arm [VERIFIED: grep `partition: "failed"` + read]:
- `update-swap.ts:1304-1361` `composePhase3FailureOutcome` (phase-3 commit/finalize)
- `materialize-latest.ts:86-97` (settle `refused`), `:141-152` (`swapAfterSettle` catch)
- `update-flow.ts:739-775` `cascadeFailureOutcome` (cascade throw)
- `marketplace/update.ts:590-616` (`cascadeAutoupdates` catch of a `pluginUpdate` throw; defensive, `runCascadeTarget` already catches)
- `update-preflight.ts:579, 625, 661` (pre-staging verdicts; no warnings exist yet -- no change)
- `apply.ts:1385-1395` `failedMoveRows` (synthetic; no change)

### Q4. Swap throw paths and where each is caught

| Throw site | Caught at | Builds failed outcome? |
|-----------|-----------|------------------------|
| `prepareUpdateHandles` catch rethrow (`update-swap.ts:419-421`) | direct: `update-flow.ts:403-424` (notifyDirectFailure + abortUpdateBatch); cascade: `update-flow.ts:715-728` `runCascadeTarget` -> `cascadeFailureOutcome`; after a settle: `materialize-latest.ts:135-153` `swapAfterSettle`; reinstall: `reinstall-flow.ts:280-287` -> `failReinstall` (`:481-503`) | yes in cascade, swapAfterSettle, reinstall; direct path renders a row from `report` |
| intent-mark / agent-target `try` (`update-swap.ts:1433-1443`) | same four | same |
| phase-3 aggregate (`update-swap.ts:1494-1499`) | returned, not thrown. Direct: `isPhase3aAggregateFailure` (`update-flow.ts:591-596`) -> `abortUpdateBatch(..., outcome)`; the failure ROW is emitted inside the swap through `notifyPhaseFailure` (`update-flow.ts:278-290`). Reinstall: `notifyPhaseFailure` only captures (`reinstall-flow.ts:410-412`); `reinstallOutcomeFromRun` maps the failed arm (`reinstall-record.ts:115-133`). Cascade: returned straight through. | yes |

`swapAfterSettle` holds `args`, not the caller's report. Recommended: inside `swapAfterSettle`, wrap `args` with a local collector (`onStagingWarnings: (w) => { local = w; args.onStagingWarnings?.(w); }`) so its own failed outcome can carry the warnings.

### Q5. The enable branch

- `materializeEnableRoot` (`enable-disable.ts:371-482`) already has `summary` (`:446`); it returns `{ outcome, mcpConfigNotices: summary.mcpConfigNotices }` (`:481`). `InstallLedgerSummary` already projects both arrays [VERIFIED: install-outcome.ts:345-346, 960-961], so ENWARN-01's "the projection drops both" is stale; nothing in install-outcome needs to widen for enable.
- `MaterializedEnableRoot` (`:489-492`) gains the warnings; `McpConfigNoticeSink` [VERIFIED: enable-disable.ts:221-223 `interface McpConfigNoticeSink { mcpConfigNotices: readonly McpConfigNotice[]; }`] gains a `stagingWarnings` member (keeping the name avoids churn in a file Phase 2 also edits).
- Two paths call `materializeEnableRoot`: `runEnableBranch` (`:498-532`, used by `disable` and the ORCHESTRATED enable) sets `sink.mcpConfigNotices` at `:523`; `buildEnableRootPhase` (`:1058-1100`, the STANDALONE enable cascade's last phase) pushes onto `run.mcpConfigNotices` at `:1081`. `EnableCascadeRun` (`:826-849`) needs a warnings slot, `runEnableCascadeWithRoot` (`:1276-1345`) returns it on the `ok` arm, and `runFreshEnableCascadeWithRoot` (`:2212-2272`) copies it to the sink at `:2254`.
- Standalone render site: after `dispatchOutcome(...)` and before `notifyMcpConfigNotices(ctx, run, sink.mcpConfigNotices)` at `enable-disable.ts:2593-2605`; guard on `outcome.kind === "fresh"` (a config-phase failure unwinds after the root committed, so the sink may hold warnings on an `enable-failed` outcome; `enable failed` is Deferred). `runSetEnabledOutcome` is at cognitive 11 [VERIFIED: fallow], so put the guard in a helper.
- Orchestrated outcome: `EnableDisablePluginOutcome` enabled arm (`:194-197`) gains `stagingWarnings?`; produced by `freshOutcomeToTypedResult` (`:2829-2859`) via `outcomeToTypedResult` (`:2886-2953`, `case "fresh"` at `:2950-2952`), which already receives the sink's notices.
- Apply consumption: `applyPluginToggles` (`apply.ts:849-913`) pushes `axes.buildSuccess(...)` plus `...carriedMcpConfigNotices(result)` at `:896`; add `...carriedStagingWarnings(result)` there. `PluginEnabledOutcome` (`apply-outcomes.ts:285-288`) gains the optional member. `enableStep` (`apply.ts:1513-1520`) just calls `applyPluginToggles`.
- Held-down move then enable (`apply.ts:1452-1461`): the reported row is `enabledMoveOutcome(move)` (`reconcile/notify.ts:479-...`), which DROPS the `enabled` outcomes and their warnings. To render them, pass `enabled` into `enabledMoveOutcome` (one-token edit in `runStep` line `rows: rematerialize ? enabled : [enabledMoveOutcome(move)]`, no added complexity) and carry its warnings. See Open Question 2.

### Q6. Import legality for the new renderer calls

- `marketplace/update.messaging.ts` importing `orchestrators/plugin/shared.ts`: no ESLint BLOCK C violation, because the zone forbids only `PLUGIN_LEDGERS` [VERIFIED: eslint.config.js:15-21 lists `install-flow.ts`, `update-flow.ts`, `uninstall.ts`, `reinstall-flow.ts`, `enable-disable.ts`; rule at `:491-494`]. `plugin/shared.ts` is not a ledger. No cycle: `npx fallow trace --path orchestrators/plugin/shared.ts orchestrators/marketplace/update.messaging.ts` -> `reachable: no` [VERIFIED: run this session]. `update.messaging.ts` already reaches `plugin/shared.ts` type-only through `../types.ts` (`types.ts:23`). `plugin/shared.ts` imports `../marketplace/shared.ts` (`shared.ts:54`), which imports no messaging module [VERIFIED: read imports].
- `reconcile/apply.ts` already imports `plugin/shared.ts` (`apply.ts:105`, `degradationFromEnable`); `fallow trace` from `plugin/shared.ts` to `apply.ts` -> no path [VERIFIED].
- fallow zones: all of `orchestrators/**` is one zone, so cross-directory imports inside it are free [VERIFIED: .fallowrc.json].

### Q7. `apply.ts` emission order

`reportScopePasses` (`apply.ts:1883-1912`): `notifyScopePasses` (migration notice + cascade, `:1887`), then `surfacePostCommitWarnings(opts, outcomes)` (`:1906`, the generic install block, unchanged), then `surfaceMcpConfigNotices(opts, outcomes)` (`:1911`). Insert the per-plugin diagnostics between `:1906` and `:1911` (D-PL1-09). Sources: `plugin-converged` from `reconcile/notify.ts::convergedMoveOutcomes` (`:423-473`; `updated` arm `:430-445`, `failed` arm `:458-471` each spread `carriedMcpConfigNotices(outcome)`), `plugin-backfilled` from `apply.ts::grownMoveOutcomes` (`:1745-1765`, spreads `carriedMcpConfigNotices(result)` at `:1762`), `plugin-enabled` from `applyPluginToggles` (`:896`). `PluginConvergedOutcome` is `apply-outcomes.ts:534-537`, `PluginBackfilledOutcome` `:183-199`.

### Q8. `install-flow.ts` failure render and settle notices

- Capture does flow: `installPluginWithTransaction` creates `capture` (`install-flow.ts:2164`), threads it through `sharedCascadeOptions` (`:942-1000`, `capture: args.capture` at `:978`) into `install-cascade.ts` (`InstallCascadeOptions.capture`, `:536-540`), which calls `seam.runInstallLedger(..., options.capture, transaction)` per member (`:1232-1238`; re-enable member `:1381-1393`) -> `runInstallLedgerBody`, which writes `capture` only on `runPhases` failure [VERIFIED: install-outcome.ts:1538-1550]:

```typescript
  const result = await transaction.runPhases(phases, ctxLocal);
  if (isFailedRunPhasesResult(result)) {
    const rollback = formatRollbackError(result, result.error);
    if (capture !== undefined) {
      capture.rollbackPartials = rollback.rollbackPartials;
      capture.version = ctxLocal.version;
    }
    throw rollback.error;
  }
```

  `InstallFailureCapture` is [VERIFIED: install-outcome.ts:288-291] `rollbackPartials: readonly RollbackPartial[]; version: string | undefined;`. Recommend an OPTIONAL `stagingWarnings?` assigned only when non-empty: there are 7 production literal sites (`install-flow.ts` x4, `enable-disable.ts` x3) and 12 test literal sites, and `install-outcome.test.ts:442`/`:491` `deepStrictEqual(capture, { rollbackPartials: [], version: "0.0.1" })` stay green when the fixture produced no warnings.
- Standalone failure render: `handleInstallThrow` (`install-flow.ts:1672-1735`) emits the failed row at `:1714-1726`; render the discovery half right after it, in the non-orchestrated branch. Then the caller's `withMcpConfigNotices` (`:2629`) emits the MCP notices, giving row -> diagnostic -> notices. `handleInstallThrow` is reached only from `handleCaughtInstallFailure` (`:1768`), which has three callers (`:2616` plain install, `:3148` missing-dependency install, orchestrated; `:3558` install-after-moves). The missing-dependency caller passes `orchestrated: true`, so nothing renders there.
- Settle notices: `saveRootClosure` (`install-flow.ts:3430-3455`) returns `{ kind: "installed", rows }` and drops `settled.mcpConfigNotices`; the `dependencies-installed` arm does carry them [VERIFIED: install-cascade.ts:575-581, 1477-1482]. Chain to change: `SettleCascadeRun` (`dependency-settle.ts:45-47`), `StepRun` (`:116-131`), `runDependencySteps` (`:137-174`), `settlePlanned` (`:187-205`), `settleDependencies` (`:208-226`), `UpdateDependencySettlement` (`update-swap.ts:162-169`), `materializeLatestVersion` refused arm (`materialize-latest.ts:86-97`) and `swapAfterSettle` (`:129-153`, prepend settle notices to the outcome's own). `runDependencySteps` is also called by install's `installAfterMoves` (`install-flow.ts:3561`, a Phase 4 function); it can ignore the new member.
- Recommend optional members (omitted when empty) on these internal settle shapes: required ones would touch 19 test literals in `dependency-settle.test.ts` (7), `install-cascade.test.ts` (4), `materialize-latest.test.ts` (4), `update-flow.test.ts` (2), `install-flow.test.ts` (1), `install-outcome.test.ts` (1) [VERIFIED: grep count].
- Renderer gap: `surfaceUpdateMcpConfigNotices` (`update-flow.ts:498-508`) flatMaps notices from `updated` outcomes only (plus the phase-3 `failed`). A settle-refused or `swapAfterSettle` failure is a non-phase-3 `failed` outcome pushed into `outcomes`, so its dependency notices would not render on the direct path. Extend it to the `failed` arm. The marketplace cascade (`marketplace/update.ts:915-921`) and reinstall (`reinstall-flow.ts:590-601`) already include `failed`.

### Q9. Reinstall: double cache drop and `resourcesChanged`

- Swap drop on success: `update-swap.ts:1549` `await dropPluginCompletionCache(args);` (body `:1638-1655`, debug-logs a failure). Reinstall drop: `runPostSuccessMaintenance` `reinstall-flow.ts:449-476`, drop at `:454-463` with note `` `Plugin "${plugin}" reinstalled; completion cache refresh deferred: ${errorMessage(error)}` `` [VERIFIED: read]. Reinstall runs the runner in `cascade: false` mode, so both drops happen on every reinstalled outcome.
- Tests that pin either: `reinstall-flow.test.ts:7571` `const CONVERGED_SCHEDULE = ["save:state", "save:state", "drop:cache", "drop:cache", "remove:data"];` (two drops; used at `:7692` and in the cache retry proof `:8595-8680`, which also asserts `first.notes` equals the deferral note and the comment "only reinstall's maintenance step notes the deferral, once"); `:1374-1420` (PRL-13: notes include the cache deferral); `:2905-2940` (cache drop failure swallowed). These change. Install's own deferral (`install-flow.test.ts:7287`) is unrelated and stays.
- `resourcesChanged` inputs at the swap's success return (`update-swap.ts:1552-1600`): before = `preflight.record.resources.{skills, prompts, agents, mcpServers, workflows}`; after = `handles.skills.result.stagedNames`, `handles.commands.result.stagedNames`, `stagedAgentNames` (`:1528`), `stagedMcpServerNames` (`:1529`), `handles.workflows.result.stagedNames` [VERIFIED: types read: every commit result has `stagedNames`]. Compute it in a helper (`swapPluginUpdate` is at cognitive 12/15). Map in `reinstall-record.ts::reinstallOutcomeFromRun` `case "updated"` (`:89-106`).
- Measured ripple of the REQUIRED field (trial edit, reverted): 96 tsc errors -- `reinstall-record.ts` 1, `update-swap.ts` 1, and tests: `update-row.test.ts` 21, `update.messaging.test.ts` 20, `reinstall.messaging.test.ts` 20, `marketplace/update.test.ts` 12, `types.test.ts` 7, `update-cascade.test.ts` 5, `reinstall-record.test.ts` 4, `reconcile/notify.test.ts` 4, `workflows-marker-coverage.test.ts` 1 [VERIFIED: `npx tsc --noEmit` this session]. Runtime `deepStrictEqual` whole-outcome expectations will also change in `update-swap.test.ts` (6 `updated` literals), `materialize-latest.test.ts` (3), `update-flow.test.ts` (3), `reinstall-flow.test.ts` (23 `reinstalled`), `operations.test.ts`, `test/integration/plugin-layer-verbs.test.ts` [VERIFIED: grep counts].

### Q10. AGIDX-01 (`bridges/agents/stage.ts`)

Current rule [VERIFIED: agents/stage.ts:295-302]:

```typescript
function partitionPreviousEntries(
  prepared: PreparedAgentsStaged,
  options: { readonly force?: boolean } | undefined,
): { readonly replaced: readonly AgentsIndexEntry[]; readonly kept: readonly AgentsIndexEntry[] } {
  return options?.force === true
    ? { replaced: [...prepared.previousEntries, ...prepared.foreignPreservedEntries], kept: [] }
    : { replaced: prepared.previousEntries, kept: prepared.foreignPreservedEntries };
}
```

Fix: under force, split `foreignPreservedEntries` by `newEntries`' `generatedName` set: matching rows join `replaced`, the rest join `kept`. All consumers read this one function: `assertAgentCommitTargets` (`:313-332`), `assertForcedTargetsContained` (`:341-354`, iterates `replaced` only), `commitPreparedAgents` (`:373-...`, removes `replaced` targets, saves `[...prepared.otherEntries, ...prepared.newEntries, ...previous.kept]` at `:438`).

Existing tests that pin the old behavior (must change in the same plan):
- `stage.test.ts:1573-1648` "force replaces a previous target whose bytes a user changed and drops its preserved row": seeds `current` (staged) and `orphan` (not staged) and expects only `current` to remain. Under D-PL1-15 the `orphan` file and row are kept. Rewrite the expectation (or split into the AGIDX case the CONTEXT names).
- `stage.test.ts:1720-1785` NFR-10 escape: the escaping row is `pi-claude-marketplace-acme-outside`, which is NOT staged, so under the new rule it is kept, never checked, and the commit succeeds. Rename the escaping row's `generatedName` to the staged `pi-claude-marketplace-acme-current` (escaping `targetPath` unchanged) to keep the containment refusal under test.
- Unaffected: `update-swap.test.ts:440-...` and `reinstall-flow.test.ts:1093`, `:1132`, `:2734` overwrite the staged name `...-bot` [VERIFIED: read].
- Edge to note: a kept hand-named row whose `targetPath` equals a NEW entry's target makes `assertAgentCommitTargets` throw "Cannot replace agent target with non-previous content" (`:324-330`). That is a safe refusal.

### Q11. Cucumber

How scenarios observe output: `When the user runs "<command>"` records every payload (`features/step_definitions/command.steps.ts`); a diagnostic is a payload of kind `diagnostic` with fields `header` and `lines` [VERIFIED: notification-wire.ts:667-675 `kind: Type.Literal("diagnostic"), header: Type.String(), lines: STRINGS`] and severity `warning` [VERIFIED: notification-resolve.ts:620 `diagnostic: "warning",`]. No existing scenario asserts a diagnostic (grep `diagnostic` in `features/` returns nothing). Existing steps already suffice:
- `Then the command reports these results:` -- one row per payload, columns from envelope fields, so `| kind | severity | needs reload | header | lines |` compares the diagnostic whole; a `lines` list joins with `, ` [VERIFIED: field-rows.ts `cell()`]. It also marks notices compared.
- `Then the results list these marketplaces and plugins:` -- skips a payload with no row arrays (`result-rows.ts:150-171`), so it still works beside a diagnostic.
- `Then the result has these fields:` requires EXACTLY one payload (`world.ts:200-211`); a scenario that produces a diagnostic must use the two-step form.
- `Given the user has run "<cmd>"` requires every payload to be `info`, so the collision must be introduced AFTER setup commands (a diagnostic is `warning`).

Fixtures available: plugins carry one skill `skills/<plugin>-skill/SKILL.md` (`features/lib/path-marketplace.ts:91-108`); `writePublishedPluginFile(published, plugin, file, text)` writes any file inside a published plugin (`features/lib/published-marketplace.ts:471-484`); `a directory blocks the mcp-adapter.json file of the {word} scope` fails an install in its mcp phase after skills commit and records `{mcp-adapter.json read error}` (`features/step_definitions/mcp-configuration.steps.ts:36-55`); `the published plugin ... declares the mcp server ...`, `the mcp-adapter.json file of the {word} scope holds a comment` (comments-dropped notice), `the marketplace ... offers these plugins with dependencies:`, `/claude:plugin marketplace autoupdate <mp> --scope <s>` as a setup command.

New steps needed (each a `Given` in `features/step_definitions/plugin/publishing.steps.ts`, the plugin publishing topic module, which owns "changes to a plugin a marketplace already offers"):
1. A second skill that elides to the first skill's name: write `skills/skill/SKILL.md` into plugin `demo` (`generatedSkillName("demo", "skill")` is `demo-skill`, and `demo-skill/` sorts first, so `skill/` is skipped). Rendered line after redaction: `skill source "skill" in "skills" elides to generated name "demo-skill", already produced by skill source "demo-skill"; ignoring duplicate.` [VERIFIED: skills/discover.ts:77-89 text; redact-absolute-paths.ts basename rule]. The step should assert the file it wrote.
2. Two agent files with the same frontmatter `name` (D-07 agent skip, for the WRN-03 standalone scenario; same-directory duplicates are skipped, `agents/stage.test.ts:60`). Message shape at `agents/discover.ts:103` (`duplicateWarning`), paths redacted to basenames.

Use a dir-source marketplace without an Outline: the plugin root is read from the published directory, so a `Given` after setup is seen by the next command; a git source would need a marketplace update first [VERIFIED: existing plugin features use a dir Background; `unreadableSkillFile` notes "a git repository cannot hold a file nobody may read"].

File placement (recommended, to avoid collisions with sibling wave-1 phases that add scenarios to `enable.feature`, `apply.feature`, `update*.feature`, `marketplace/update.feature`, `install-rollback.feature`): one new file `features/plugin/staging-warnings.feature` ("Feature: Plugin staging warnings") holding every new scenario. Phase 10 owns `features/**` in wave 2, after this merges. See Open Question 1.

Planned scenarios (titles only; the writer owns step text under `rules/features.md`):
- "Enabling a plugin whose skills collide reports the skip install reports, under a header that names the scope" (WRN-01)
- "A marketplace update with autoupdate on reports a moved plugin's skip under its header" (WRN-02; the autoupdate cascade is the same `cascadeAutoupdates` path)
- "Apply that moves a plugin to its catalog version reports the moved plugin's skip under its header" (WRN-02)
- "Installing a plugin whose agents share a name reports the skipped agent" (WRN-03, D-07 agents now discovery)
- "An install that fails in its mcp phase reports the skill the skills phase skipped after the failed row" (WRN-04)
- "Updating a plugin whose new version needs a dependency with an MCP server reports that dependency's MCP config notice" (WRN-06; root has no server, dependency declares one, `mcp-adapter.json` holds a comment)
- Existing scenarios whose expectations change: none pin a header today.

Commands: `npx cucumber-js features/plugin/staging-warnings.feature`, one scenario `npx cucumber-js --name '<title>'`, the dry-run gate `npm run check:features` [CITED: local-verification/rules/commands.md].

### Q12. Verification commands

| Scope | Command |
|-------|---------|
| one owner test | `node --test test/shared/staging-warnings.test.ts` |
| one named test | `node --test --test-name-pattern '<title>' <test-path>` |
| one pair's 100% direct coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/staging-warnings.ts` (source or test path; `scripts/test-coverage-direct.mjs` maps either) |
| types | `npm run typecheck` |
| complexity / dupes / dead code | `npm run fallow` (or `npx fallow health <file> --complexity` while editing) |
| cucumber feature / scenario | `npx cucumber-js features/plugin/staging-warnings.feature` / `npx cucumber-js --name '<title>'` |
| static gate | `npm run check:static` (includes `check:features`) |
| GSD wave / phase gate | `npm run check` on the merged tree (not piped; read the exit code) |

Schedule from `local-verification`: per task, owner tests + the pair's direct coverage; the commit hook runs `check:commit`; every post-merge wave gate and the phase gate run `npm run check` on the combined tree; reuse a passing result only for identical inputs [CITED: local-verification/rules/gates.md]. Local Node is v26.12.1 while CI uses Node 24 [VERIFIED: `node --version`]; scenarios that show an errno message must use the recorded error tokens (as `{mcp-adapter.json read error}` does) [CITED: MEMORY "Node errno message drift"].

### Q13. Risks

- **fallow complexity ceilings** (measured, `npx fallow health <file> --complexity`): `apply.ts::runStep` cyclomatic 12 / cognitive **15**; `apply.ts::applyDependencyInstalls` 14/**15**; `install-flow.ts::installPluginWithTransaction` **18**/13 (cyclomatic ceiling 20) and its inner arrow at `:2207` 15/14; `update-swap.ts::swapPluginUpdate` 12/12; `enable-disable.ts::runSetEnabledOutcome` 9/11, `composeOutcomeRow` 14/13; `update-flow.ts::updatePluginsWith` 9/11; `reinstall-flow.ts::reinstallPluginsWith` 12/12; `marketplace/update.ts::refreshOneMarketplace` 10/11. ESLint `sonarjs/cognitive-complexity` scores differently and must pass too.
- **fallow dupes:** the per-outcome render loops in update-flow, reinstall-flow, update.messaging and apply would be near-identical; route them through one shared helper. The five install ledger phases would each gain the same partition-and-push pair; use one local helper in `install-outcome.ts`.
- **fallow dead-code:** every new export must have a production consumer (production mode ignores tests). `hygieneWarning` is used by mcp/agents stage and the leak wraps; `partitionStagingWarnings` by install/swap/renderers; the types by bridges and outcomes.
- **import-x/order:** in bridges, `import { discoveryWarning } from "../../shared/staging-warnings.ts";` sits in the parent group, alphabetized; `import type { StagingWarning } ...` goes in the last (type) group [CITED: CONVENTIONS.md "Import Organization"].
- **Pairing:** `test/shared/staging-warnings.test.ts` must exist in the same commit as the source (`npm run test:corresponding`).
- **D-07-06 gate-file rules:** no architecture test names any file this phase adds or moves; the walk-based gates (`no-test-only-production-surface`, `partial-vocabulary-guard`) cover the new module automatically and nothing in it trips them [VERIFIED: grep of `test/architecture/` for the touched names].
- **Merge conflicts with sibling wave-1 phases** (ROADMAP Files lines): `update-swap.ts` (Phase 4 agent-target check, Phase 7 intent mark and cleanup), `install-outcome.ts` (Phase 4 preview, Phase 9 ledger array), `enable-disable.ts` (Phase 2), `materialize-latest.ts` (Phase 9 update hook), `update-flow.ts` (Phase 7), `reinstall-flow.ts` (Phase 7 cleanup), `marketplace/update.ts` (Phases 5 and 7), `apply.ts` (Phases 2, 6, 7), `install-flow.ts` (Phase 4 planning functions), `plugin/shared.ts` (Phase 5 cascade fold). The `resourcesChanged` ripple lands in test files for sources other phases may also touch (`update-row.test.ts`, `marketplace/update.test.ts`, `reconcile/notify.test.ts`). Keep each edit inside the functions named in this research, and land the mechanical test-literal sweep as its own commit so a merge conflict is easy to resolve.

### Files outside the Files line that need call-site edits (CONTEXT list confirmed and corrected)

| File | Functions | In CONTEXT list? |
|------|-----------|------------------|
| `orchestrators/plugin/install-flow.ts` | `collectPostCommitWarnings` (`.message` mapping, `:1151-1222`), success render call (`:2861-2865`, new `scope` and typed warnings), `handleInstallThrow` (`:1672-1735`), `saveRootClosure` (`:3430-3455`) | yes |
| `orchestrators/plugin/update-flow.ts` | `surfaceUpdateDiscoveryWarnings` (`:471-487`), `surfaceUpdateMcpConfigNotices` (`:498-508`, add `failed` arm for WRN-06), `abortUpdateBatch` (`:614-627`, failed target's diagnostic before MCP notices), `runCascadeTarget` (`:715-728`, report warnings onto the cascade failed outcome) | partly (the MCP-notice and abort edits are additions) |
| `orchestrators/plugin/reinstall-record.ts` | `reinstallOutcomeFromRun` (`:83-134`) | yes |
| `orchestrators/marketplace/update.ts` | `refreshOneMarketplace` one call after `:910` | yes |
| `orchestrators/reconcile/apply.ts` | `applyPluginToggles` (`:896`), `grownMoveOutcomes` (`:1762`), `reportScopePasses` (`:1906-1911`), new render helper; one-token `runStep` edit only if Open Question 2 is accepted | yes |
| `orchestrators/reconcile/notify.ts` | `convergedMoveOutcomes` `updated`/`failed` arms (`:430-471`); `enabledMoveOutcome` (`:479-...`) if Open Question 2 is accepted | **no (addition)** |
| `shared/staging-warnings.ts` (new) + `test/shared/staging-warnings.test.ts` (new) | -- | yes |

## Runtime State Inventory

This is a refactor of in-memory types plus two behavior fixes. Answering the five categories:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `state.json` records: no field added or renamed (`resourcesChanged` lives on outcomes, not records). `agents-index.json`: AGIDX-01 changes which rows a forced commit writes, no schema change. | None (code edit only) |
| Live service config | None -- no external service. | None |
| OS-registered state | None. | None |
| Secrets/env vars | None. | None |
| Build artifacts | None (no build step; Node strips TS at run time). | None |

## Common Pitfalls

### Pitfall 1: A hand-named row survives, but the escape test goes green for the wrong reason
**What goes wrong:** after D-PL1-15 the NFR-10 test's escaping row is kept rather than refused, so the commit succeeds and the test fails, or a hasty fix deletes the containment assertion.
**How to avoid:** make the escaping row's `generatedName` a staged name (see Q10).

### Pitfall 2: Root warnings rendered for a dependency failure
**What goes wrong:** the shared `capture` holds the FAILING member's warnings; rendering from `handleCaughtInstallFailure` would print a dependency's skip under the root's header.
**How to avoid:** render only inside `handleInstallThrow`'s standalone branch (no cascade subject).

### Pitfall 3: Enable renders on a failed enable
**What goes wrong:** the standalone enable cascade's config phase can fail after the root phase filled the warnings, giving `enable-failed` with warnings present.
**How to avoid:** render only for `outcome.kind === "fresh"`; `enable failed` is Deferred.

### Pitfall 4: Diagnostic changes the payload count of existing scenarios
**What goes wrong:** a scenario using `the result has these fields:` (exactly one payload) breaks when its fixture starts producing a diagnostic, for example an existing agents fixture whose D-07 skip is now discovery.
**How to avoid:** run `npm run test:cucumber` after the agents re-tag; today no cucumber fixture has duplicate agents (plugins carry one skill only), so none is expected to break.
**Warning signs:** "expected exactly one result" from `world.ts:207`.

### Pitfall 5: The direct update's abort path drops the failure's warnings
**What goes wrong:** `surfaceUpdateDiscoveryWarnings` is "Deliberately NOT called from `abortUpdateBatch`" (`update-flow.ts:466-469`), so a prepare-throw or phase-3 failure renders nothing unless `abortUpdateBatch` gets the failure's warnings.
**How to avoid:** pass the failing target's warnings (from `report` for a throw, from the phase-3 outcome otherwise) into `abortUpdateBatch` and render after its cascade and before its MCP notices.

### Pitfall 6: `resourcesChanged` ripple blocks every other task
**What goes wrong:** adding the required member first breaks typecheck in 10 test files until all 94 literals are fixed.
**How to avoid:** schedule the type change and the literal sweep in one task, and run `npm run typecheck` as that task's verify.

### Pitfall 7: Hooks counted in `resourcesChanged`
**What goes wrong:** using `record.resources.hooks` makes a hooks-only reinstall report a change.
**How to avoid:** D-PL1-18 excludes hooks; read the five named inventories only.

## Code Examples

### Bridge tagging (skills; commands and workflows identical, mcp uses `hygieneWarning`)
```typescript
// skills/stage.ts:398 today: warnings: Object.freeze([...discoverWarnings]),
warnings: Object.freeze(discoverWarnings.map((message) => discoveryWarning(message))),
```

### Agents split (`agents/stage.ts:146-150`)
```typescript
const aggregatedWarnings: StagingWarning[] = [
  ...loaded.corruptions.map((c) => hygieneWarning(`agent index corruption (entry dropped): ${c}`)),
  ...converted.flatMap((c) => formatAgentWarnings(c)).map((w) => hygieneWarning(w)),
  ...discoverWarnings.map((w) => discoveryWarning(w)),
];
```

### Install ledger phase (one helper for all five phases)
```typescript
function collectStagingWarnings(c: InstallLedgerContext, warnings: readonly StagingWarning[]): void {
  const { discovery, hygiene } = partitionStagingWarnings(warnings);
  c.discoveryWarnings.push(...discovery);
  c.bridgeWarnings.push(...hygiene);
}
// leak site: if (leak !== undefined) { c.bridgeWarnings.push(hygieneWarning(leak)); }
```

### Renderer (D-PL1-04/05/06)
```typescript
export function surfaceDiscoveryWarnings(
  ctx: NotificationContext,
  run: NotificationRun,
  args: {
    readonly plugin: string;
    readonly scope: Scope;
    readonly verb: StagingVerb; // the seven-member closed union of D-PL1-06
    readonly warnings: readonly DiscoveryWarning[];
  },
): void {
  if (args.warnings.length === 0) {
    return;
  }
  const lines = args.warnings.map((w) => redactAbsolutePaths(w.message));
  const subject = `Plugin "${args.plugin}" [${args.scope}] ${args.verb}`;
  const header =
    lines.length === 1
      ? `${subject}; 1 declared component has a note.`
      : `${subject}; ${lines.length.toString()} declared components have notes.`;
  notifyDiagnostic(ctx, run, header, lines);
}
```
`Scope` values are `"user" | "project"` [VERIFIED: shared/types.ts:16]. `StagingVerb` is a suggested name (discretion).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two `string[]` channels, classified at each call site; agents all hygiene | One tagged union, classified at the producer | this phase | Channel swap becomes a compile error; agent D-07 skips reach users |
| `splitStagingWarnings` (update/reinstall) + inline install pushes | `partitionStagingWarnings` everywhere | this phase | D-141-05's accepted drift removed |
| Header names plugin only | Header names plugin and scope | this phase | All 19 pinned header assertions change bytes |

**Deprecated:** `splitStagingWarnings` (`shared.ts:1777-1787`), `collectUpdateWarnings(handles, cascade)`'s mode seam (`update-swap.ts:437-455`), the `updated` arm's `notes?` (`types.ts:470`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | fallow's cognitive score does not rise for an added optional call (`a?.()`) or a plain function call | Pitfalls / Q13 | A ceiling function fails `npm run fallow`; mitigated by putting every addition in a helper anyway |
| A2 | No existing cucumber fixture produces a duplicate agent or colliding skill, so no existing scenario gains a diagnostic payload | Pitfall 4 | Some scenario using `the result has these fields:` fails; caught by `npm run test:cucumber` |
| A3 | The verb for a `plugin-backfilled` (growth) move header is `updated` | Open Question 3 | Header reads oddly for a same-version re-materialization |

## Open Questions

1. **One new feature file vs. adding to existing ones.**
   - Known: sibling wave-1 phases likely add scenarios to `enable.feature`, `apply.feature`, `update*.feature`, `marketplace/update.feature`; Phase 10 owns `features/**` in wave 2.
   - Recommendation: `features/plugin/staging-warnings.feature` for all Phase 1 scenarios, and new `Given` steps appended at the end of `features/step_definitions/plugin/publishing.steps.ts`.
2. **The held-down move-then-enable path in `apply`** (`apply.ts:1452-1461`) reports `enabledMoveOutcome(move)` and drops the enable's warnings.
   - Recommendation: include it (pass `enabled` into `enabledMoveOutcome`, a one-token edit in `runStep` with no complexity cost) because D-PL1-09 names the enable step. If the planner wants zero `runStep` edits (Phase 2 owns apply ordering), record this as a known gap instead.
3. **Header verbs per apply outcome kind.** Recommendation: `plugin-converged` -> `updated` / `update failed` (by row status), `plugin-backfilled` -> `updated`, `plugin-enabled` -> `enabled`.
4. **The direct update's abort path and earlier successes.** `surfaceUpdateDiscoveryWarnings` is deliberately not called on abort. D-PL1-14 asks for the FAILED target's diagnostic. Recommendation: render only the failed target's diagnostic on abort, keeping the existing choice for the earlier successes; flag it to the user if a strict reading of D-PL1-07 ("every verb") is wanted.
5. **Scenarios for WRN-05 and WRN-07.** WRN-07 has no user-visible effect (no reader of `resourcesChanged`; the cache drop and the removed deferral note are orchestrated-only), so unit tests suffice with that justification. WRN-05 is user-visible (a hand-named agent file survives a reinstall) but needs two new steps (seed a hand-named index row plus file; read the agents directory). Recommendation: add the unit case D-PL1-15 names and ask the user whether a scenario is wanted, citing the AGENTS.md rule.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all tests | yes | v26.12.1 (CI: 24) | -- |
| npm deps (`node_modules`) | typecheck, fallow, cucumber | yes | present in worktree | -- |
| fallow CLI | `npm run fallow`, trace | yes | via `npx fallow` | -- |

No missing dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit), `@cucumber/cucumber` (behavior) |
| Config file | `package.json` scripts; `cucumber.json` (`order: random`, `parallel: 8`) |
| Quick run command | `node --test <test-path>` and `npm run test:coverage:direct -- <source-or-test>` |
| Full suite command | `npm run check` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRN-01 | standalone enable renders `Plugin "x" [scope] enabled; ...` after its row, before MCP notices; orchestrated `enabled` arm carries `stagingWarnings` | unit + scenario | `node --test test/orchestrators/plugin/enable-disable.test.ts`; `npx cucumber-js --name 'Enabling a plugin whose skills collide reports the skip install reports, under a header that names the scope'` | unit yes; scenario Wave 0 |
| WRN-02 | marketplace update/autoupdate cascade and apply move/backfill/enable render per-plugin diagnostics between rows and MCP notices; header carries scope on every verb | unit + scenario | `node --test test/orchestrators/marketplace/update.messaging.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/plugin/shared.test.ts`; `npx cucumber-js features/plugin/staging-warnings.feature` | unit yes; scenario Wave 0 |
| WRN-03 | every bridge returns tagged warnings; agents D-07 skips are discovery; renderer and `DiscoveryWarning[]` refuse a hygiene warning at compile time | unit + typecheck + scenario | `node --test test/shared/staging-warnings.test.ts test/bridges/*/stage.test.ts`; `npm run typecheck`; agents-skip scenario | `staging-warnings.test.ts` Wave 0 |
| WRN-04 | install failure in a later phase shows earlier phases' discovery warnings after the `(failed)` row; update/reinstall failures (prepare throw, intent-mark throw, phase-3) carry and render them | unit + scenario | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/reinstall-record.test.ts`; install-failure scenario | unit yes; scenario Wave 0 |
| WRN-05 | forced commit keeps a hand-named foreign row and file; still replaces a staged-name foreign row; NFR-10 refusal still fires for a staged-name escaping row | unit | `node --test --test-name-pattern 'force' test/bridges/agents/stage.test.ts` | yes (cases change) |
| WRN-06 | settle notices flow `saveRootClosure` -> settle -> outcome, ahead of the update's own; direct path renders them for `failed` too | unit + scenario | `node --test test/orchestrators/plugin/dependency-settle.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/update-flow.test.ts`; dependency-notice scenario | unit yes; scenario Wave 0 |
| WRN-07 | runner `updated.resourcesChanged` true/false per the five inventories; reinstall maps it; one cache drop per reinstall; no cache deferral note | unit | `node --test test/orchestrators/plugin/update-swap.test.ts test/orchestrators/plugin/reinstall-record.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` | yes (cases change) |

Each source-test pair's 100% direct coverage: `npm run test:coverage:direct -- <path>` per touched source.

### Sampling Rate
- **Per task commit:** owner tests of the touched pairs + `npm run test:coverage:direct -- <each touched source>`; `npm run typecheck` for any task that changes a shared type.
- **Per wave merge:** `npm run check` on the merged tree.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `extensions/pi-claude-marketplace/shared/staging-warnings.ts` + `test/shared/staging-warnings.test.ts` (WRN-03)
- [ ] `features/plugin/staging-warnings.feature` (WRN-01..04, 06) and new `Given` steps in `features/step_definitions/plugin/publishing.steps.ts` (colliding skill; duplicate agents)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled). The phase adds no input surface, network path, credential use, or file-write location.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes (plugin-authored text reaches the user) | `redactAbsolutePaths` (NFR-9) in the renderer; `redactCredentials` on the diagnostic wire payload (`notification-resolve.ts:686-691`) |
| V6 Cryptography | no | -- |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Absolute path disclosure in warning lines (new failure and cascade paths) | Information disclosure | All rendering goes through `surfaceDiscoveryWarnings` -> `redactAbsolutePaths`; never call `notifyDiagnostic` with raw lines |
| Forced commit deleting a user file (AGIDX-01) | Tampering | D-PL1-15 restricts forced removal to staged names; NFR-10 containment check kept on every removed row |

## Sources

### Primary (HIGH confidence -- read this session)
- `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,workflows}/{types,stage}.ts`, `bridges/skills/discover.ts`, `bridges/agents/discover.ts`
- `orchestrators/plugin/{install-outcome,install-flow,install-cascade,update-swap,update-flow,materialize-latest,reinstall-flow,reinstall-record,enable-disable,dependency-settle,shared}.ts`
- `orchestrators/{types.ts,marketplace/update.ts,marketplace/update.messaging.ts,reconcile/apply.ts,reconcile/apply-outcomes.ts,reconcile/notify.ts}`
- `shared/{notification-dispatch,notification-wire,notification-resolve,notification-json,redact-absolute-paths,types}.ts`
- `eslint.config.js`, `.fallowrc.json`, `package.json`, `cucumber.json`, `scripts/test-coverage-direct.mjs`
- `features/` step modules, libs, and feature files named above
- Tool runs: `npx fallow trace`, `npx fallow health --complexity`, two reverted `npx tsc --noEmit` trial edits

### Secondary
- `.planning/BACKLOG.md` (ENWARN-01, UPCASC-01, WCHAN-01, WARN-01, AGIDX-01, LCORCH-01); `.planning/ROADMAP.md` Files lines; `.planning/PROJECT.md` D-141-03 / D-141-05

## Metadata

**Confidence breakdown:**
- Stack: HIGH -- no new dependencies.
- Architecture / call sites: HIGH -- every site read at HEAD; ripple counts measured with the compiler.
- Pitfalls: HIGH for the code-derived ones; MEDIUM for A1 (fallow scoring of optional calls).

**Research date:** 2026-10-26
**Valid until:** until any sibling wave-1 branch merges into `features/plugin-lifecycle` (line numbers drift; re-grep before editing).
