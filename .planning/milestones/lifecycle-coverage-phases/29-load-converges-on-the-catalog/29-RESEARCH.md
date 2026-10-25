# Phase 29: Apply Command and Read-Only Reload - Research

**Researched:** 2026-10-24
**Domain:** Reconcile pipeline split (read-only load + explicit `apply` verb), catalog convergence through the shared update runner, pending-tense closed-set expansion, edge verb plumbing
**Confidence:** HIGH for the code map (every anchor read this session); MEDIUM for the recommended decomposition; LOW where marked `[ASSUMED]` (user decisions not yet recorded in CONTEXT.md)

> Scope note. This file was started for the superseded "Load converges on the catalog" scope (CAT-01..04) and then re-scoped on the coordinator's 2026-10-24 message to "Apply Command and Read-Only Reload" (APL-01..04). The phase directory is still named `29-load-converges-on-the-catalog/`. Findings from the first pass that still apply (the shared runner, the constraint gate, the offline candidate, the blocked rows, the closed-set sites, the extension-version stamp) are kept and re-aimed at `apply`. `29-CONTEXT.md` on disk is stale (it records CAT-D1, "a load moves every plugin"); the coordinator is rewriting it. The planner must re-read the rewritten CONTEXT.md and treat its decision IDs as authoritative over the relayed text below.

<user_constraints>
## User Constraints

### Locked Decisions (relayed by the coordinator, user decision of 2026-10-24; CONTEXT.md rewrite pending)

Verbatim from the coordinator's message:

- A load (`/reload`, session start) changes NO installation state: no install, uninstall, enable, disable, update, reinstall or backfill.
- Resource discovery, the hook routing table and the plugin path keep running at load.
- On a mismatch, the load prints the same block `pending` prints, with a trailer to run `/claude:plugin apply`. A matching state prints nothing.
- ~~Marketplace autoupdate at session start refreshes marketplaces only.~~ Dropped by D-27 (option C): autoupdate stays as it is.
- A new `/claude:plugin apply` (same scope flags as `pending`) makes every change `pending` lists, under the state lock, one row per change, then suggests `/reload`.
- `apply` converges every installed plugin on its marketplace's catalog version on disk, including the partial backfill. It MAY clone on a cache miss (NFR-5, like install/update), so the offline-only constraint on the runner and the gate is gone for `apply`. The load and `pending` stay offline.
- Blocked moves (a dependent's range, or a partial without consent) stay put with warning rows (`{dependents constrain}`, `partially-upgradable`) and stay in `pending`.
- `pending` advises `apply` instead of `/reload`.
- `apply` goes into help, completions, the router, the JSON output (`docs/json-output.md`) and the docs.
- NFR-2 changes from "`/reload` must suffice" to "`apply`, then `/reload`".
- Keep: phase 28's DLS-D1 and its per-session `not in manifest` warning at load. Phase 19's `import`, which installs directly through the reconcile planner.
- Many reload cucumber scenarios move to `apply`. They keep their assertions, and only the trigger and the trailer change.

ROADMAP Phase 29 adds: "record both as decision IDs, with the Claude Code comparison" (the read-only load and the NFR-2 amendment). PROJECT.md:1246 already cites "APL-D2" for the NFR-2 amendment `[VERIFIED: .planning/PROJECT.md:1246 "`/claude:plugin apply`, then `/reload`, must suffice (NFR-2, amended by APL-D2)"]`. No APL-D1 text exists yet in PROJECT.md (grep found none).

Still-applicable upstream evidence from the stale CONTEXT D-01 (retrieved 2026-10-24 from `https://code.claude.com/docs/en/plugins/host-marketplace.md`): Claude Code keeps an installed plugin at its cached version until `/plugin marketplace update` / `claude plugin update`, or until background auto-update (off by default per marketplace) runs; a local-path marketplace plugin loads its current files at every session start.

### Claude's Discretion (inferred; confirm against the rewritten CONTEXT.md)

- Module names (the read-only load module, the convergence planner, the apply orchestrator), the policy knobs' names, how the shared pending composer is threaded.
- The trailer's exact wording and its JSON field, the `apply` row label, and the new pending-tense statuses, within `docs/output-catalog.md`'s grammar.
- Scenario titles and step wording.

### Deferred Ideas (OUT OF SCOPE)

- UAT-02 (Pi erases reload-time rows) stays in BACKLOG.md (from the stale CONTEXT; the reason `pending` must preview everything).
- Offering an admitting tag for a range-blocked plugin (stale CONTEXT deferral; see Open Question 6 for whether `apply` should search tags).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md:171-174) | Research Support |
|----|-------------|------------------|
| APL-01 | `apply` makes every change `pending` lists (install, uninstall, enable, disable, update, reinstall) for the selected scope under the state lock, one row per change, ends by suggesting `/reload` | Pattern 1 (apply = today's `applyPlan` driven from a command), Pattern 4 (edge verb template = `pending`), reload trailer is automatic for `needsReload` rows (notification-summary.ts:461-515) |
| APL-02 | `apply` moves every installed plugin whose recorded version differs from the catalog on disk, including partial backfill; may clone; range / no-consent blocks stay with warning rows and stay in `pending` | Pattern 2 (shared offline convergence planner), Pattern 3 (move execution through `materializeLatestVersion` with a convergence policy), blocked-row composers in `update-cascade.ts:60-94` |
| APL-03 | A load changes no installation state; mismatch prints `pending`'s block + `apply` trailer; match prints nothing; session-start autoupdate refreshes marketplaces only | Pattern 1 (read-only `load.ts`), Pattern 5 (one pending composer, two callers); Open Question 1 (no session-start autoupdate exists today) |
| APL-04 | `pending` advises `apply`; `apply` in help, completions, router, JSON output, docs | Pattern 4 + the closed-set inventory and doc list below |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Upstream parity is the default; a divergence needs a recorded decision ID (APL-D1/APL-D2) or a Pi capability gap. Research upstream with `.agents/skills/claude-code-compat-research`.
- NFR-1 atomic writes; NFR-2 (now amended: `apply` then `/reload`); NFR-3 retry-safe; NFR-5 network policy; NFR-10 containment; NFR-7 discriminated `installable`.
- Output only through `shared/notification-dispatch.ts` (`notify-chokepoint`); no stdout/stderr (`no-stdio`); no console beyond the two sanctioned sites.
- `npm run check` green: typecheck, ESLint (`--max-warnings 0`, cognitive complexity 15), fallow (dead code, two cycle runs, health `maxCognitive 15` / `maxCyclomatic 20`, dupes, rule pack), Prettier, `test:corresponding` pairing, `check:features`, unpaired tests, integration, cucumber, 100% direct coverage per source-test pair.
- Every production module has exactly one paired test at the mirrored path; no coverage ignores; no test-only exports (typescript-unit-tests skill).
- Comments cite durable IDs, never phase/plan numbers; no comments on trivial code.
- Cucumber rules: one feature per capability under `features/<function>/`, steps lower case, `Given`/`When`/`Then` only, whole-value tables, every field of a result stated (`namesLike` in `features/lib/field-rows.ts` fails on an unstated field), request-log steps only in git-source feature files.
- Git: never commit to main, merge not rebase, `--squash` PRs, commit format per `.agents/skills/committing/SKILL.md`. Tests that touch state must use a hermetic home.
- Every plan SUMMARY.md carries `## Threat Flags`.

## Summary

Today one module does everything at load. `index.ts` `prepareResources` (index.ts:111-152) hydrates project hooks, calls `applyReconcile` (index.ts:123-130), then recomputes the plugin PATH. `applyReconcileWithReader` (reconcile/apply.ts:1383-1518) runs, per scope: a locked write-free read pass that also performs the MIG-01 first-run config migration and computes the LOAD-01 verdict (apply.ts:192-303); the AMIG-01 MCP move (apply.ts:1436); `applyPlan`, which uninstalls, removes and adds marketplaces, installs, installs missing dependencies (reload only), re-plans, enables, disables, dependency-disables (apply.ts:1275-1289); the version-gated backfill (apply.ts:1457); the unreadable-declarer and delisted warnings (apply.ts:1461, 1465); and the hook routing rebuild (apply.ts:1473). It then emits one migration notice and one `reconcile-applied-cascade` (apply.ts:1478, 1497), which structurally suppresses the `/reload` trailer (notification-summary.ts:476-490).

The phase splits that module along the read/write line. The **load** keeps hydration, the read pass (including MIG-01, which writes only the config file), the MCP move (open question), the warnings, the routing rebuild and the PATH recompute, and replaces the cascade with the `pending` block plus an `apply` trailer. A new **`apply` command** runs the mutating `applyPlan` steps plus a new **convergence** step that moves installed plugins to the catalog on disk through the same shared runner `update`/`reinstall` use (`materializeLatestVersion`, materialize-latest.ts:56-71). `pending`, the load and `apply` must agree, so the planning (sync `planReconcile` + a new async offline convergence planner) must be one function the three call.

Three facts the planner must not miss. (1) **There is no session-start marketplace autoupdate today**: PROJECT.md:1206 lists "Session-start autoupdate run -- Claude Code parity, deferred", `index.ts` registers nothing of the kind, and `autoupdate.ts` is only the `marketplace autoupdate|noautoupdate` flag flip. Autoupdate only changes `marketplace update`, whose cascade updates plugins through `beginPluginUpdateRun` (marketplace/update.ts:565-600). Success criterion 4 therefore asks for new behavior that needs the network at load (Open Question 1). (2) The load today also **adds and removes marketplaces** and **dependency-disables** plugins (LOAD-01); the user's list of forbidden load actions does not name either explicitly (Open Questions 2-3). (3) A new pending-tense status touches about 20 closed-set sites plus a regenerated JSON schema.

**Primary recommendation:** Build tracer-first: (W1) the `apply` verb wrapping today's `applyPlan` and emitting a normal command cascade; (W2) the read-only load printing a shared pending composer's block with an `apply` trailer, moving the reconcile scenarios to `apply`; (W3) the offline convergence planner plus the `will update`/`will reinstall` pending rows; (W4) `apply` executing convergence moves through `materializeLatestVersion` with a new convergence policy, deleting `backfill.ts`; (W5) docs and the decision records.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read-only load (plan + print) | `orchestrators/reconcile/` (new load module, network-free) | `index.ts` (event wiring) | BLOCK F gates every new `orchestrators/` module network-free from its first commit; the load must stay offline (NFR-5). |
| `apply` verb parsing | `edge/handlers/plugin/apply.ts` (new) | `edge/router.ts`, `edge/register.ts`, `edge/flag-catalog.ts` | Edge handlers parse args and call one orchestrator (ARCHITECTURE.md "Edge handlers"). |
| Apply execution (config-driven buckets) | `orchestrators/reconcile/apply.ts` (existing, NETWORK_SEAM) | `orchestrators/plugin/operations.ts` factories | It already drives every bucket with per-entry soft-fail and no outer lock. |
| Convergence planning (offline candidate, growth, range, consent) | new `orchestrators/reconcile/` leaf (network-free) | `orchestrators/plugin/list-candidate-version.ts`, `dependency-index.ts`, `domain/dependencies.ts` | `pending` is not a NETWORK_SEAM (eslint.config.js:58-100), so the shared planner must be offline by construction. |
| Convergence move execution | `orchestrators/plugin/` (update-flow sibling of `beginPluginUpdateRun`) | `materialize-latest.ts`, `update-preflight.ts`, `update-swap.ts` | The shared runner is the only materialization path for a version move (UPR-01 / D-18-02). |
| Pending/load row composition | `orchestrators/reconcile/notify.ts` + `reconcile.messaging.ts` | `shared/notification-*.ts` | Rows are composed by the command; `notify.ts` stays a dumb renderer (project memory). |
| Hook routing + PATH + resource discovery at load | `index.ts` + `bridges/hooks` + `orchestrators/plugin-path.ts` | — | Explicitly kept at load by the user. |

## Standard Stack

No new libraries. Everything uses the in-repo stack: TypeScript `^6.0.3` strict, `node:test`, `@cucumber/cucumber`, `typebox`, `proper-lockfile` (through `transaction/with-state-guard.ts` only), `write-file-atomic` (through `shared/atomic-json.ts`), fallow, ESLint 10 `[VERIFIED: .planning/codebase/STACK.md]`.

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package. No package was recommended, so no `package-legitimacy check` was run.

## Architecture Patterns

### System Architecture Diagram (target)

```
Pi resources_discover(event)                         user types /claude:plugin <verb>
        |                                                     |
        v                                                     v
 index.ts prepareResources                              edge/router.ts
   |-- hooks hydrate (project cwd)                        |-- "pending" -> pending handler --+
   |-- LOAD (read-only, offline) ---------------+         |-- "apply"   -> apply handler ----|--+
   |     per scope:                             |         '-- others                          |  |
   |       read pass (lock, MIG-01 config only, |                                             |  |
   |         verdict, planReconcile)            |                                             |  |
   |       MCP move (AMIG-01)  [open Q4]        |                                             |  |
   |       convergence plan (offline)           |<----- shared planScopes() ------------------+  |
   |       warnings (delisted, declarer)        |       (plan + convergence, offline)            |
   |       hook routing rebuild                 |                                                |
   |     if any actionable row:                 |                                                |
   |       notify(pending block + apply trailer)|                                                |
   |-- plugin PATH recompute                    |      APPLY (command, may clone)  <-------------+
   v                                            |        per scope: same plan + convergence
 aggregateDiscoveredResources -> Pi             |        applyPlan buckets (each op takes its own lock)
                                                |        convergence moves via shared runner
                                                |        one command cascade, rows needsReload:true
                                                |        -> "/reload to pick up changes" trailer
```

### Recommended module layout

```
extensions/pi-claude-marketplace/
├── index.ts                         # calls the load operation instead of applyReconcile
├── edge/handlers/plugin/apply.ts    # NEW: mirrors pending.ts (scope flag only)
├── orchestrators/reconcile/
│   ├── read-pass.ts                 # NEW (extracted from apply.ts:192-303), shared by load + apply
│   ├── load.ts                      # NEW: read-only load (network-free, not a NETWORK_SEAM)
│   ├── convergence.ts               # NEW: offline move/block planner (network-free)
│   ├── apply.ts                     # becomes the apply COMMAND orchestrator (stays a NETWORK_SEAM)
│   ├── pending.ts                   # calls the shared planner + composer; advises apply
│   ├── notify.ts                    # pending projection gains move/block rows
│   ├── reconcile.messaging.ts       # PENDING_CONTEXT gains statuses; APPLY_CONTEXT
│   └── backfill.ts                  # DELETED (its isolation helpers move; runScopeIsolated is imported by apply.ts:112)
└── orchestrators/plugin/
    └── update-flow.ts               # NEW sibling of beginPluginUpdateRun: a convergence runner
```

Every new module gets a paired `test/...` module at the mirrored path; `test:corresponding` enforces it.

### Pattern 1: Split `applyReconcileWithReader` along the read/write line

**What:** the per-scope loop in apply.ts:1383-1518 has these steps. Classify each:

| Step (anchor) | Writes | At load after this phase | In `apply` |
|---|---|---|---|
| Read pass `readPassForScope` (apply.ts:192-303), locked, `tx.save()` never called | MIG-01 writes `claude-plugins.json` on first run only (apply.ts:226-230); state.json untouched | KEEP (config generation, not installation state) `[ASSUMED]` | KEEP (same function) |
| LOAD-01 verdict `buildScopeSatisfactionVerdict` (apply.ts:285) | none | KEEP (feeds warnings and pending rows) | KEEP |
| AMIG-01 MCP move `migrateScopeIsolated` (apply.ts:1436) | `mcp.json`, `mcp-adapter.json` | Open Question 4 | — |
| `applyPluginUninstalls` / `applyMarketplaceRemoves` / `applyMarketplaceAdds` / `applyPluginInstalls` / `applyDependencyInstalls` / `refreshTogglePlan` / `applyToggleSteps` / `applySourceMismatches` (apply.ts:1275-1289) | state, artifacts, network for git adds | REMOVE (Open Question 2 for marketplace adds/removes, 3 for dependency-disable) | KEEP |
| `applyBackfillForScopeIsolated` (apply.ts:1457) | state stamp, artifacts | REMOVE | REPLACED by convergence |
| `reportUnreadableDeclarer` (apply.ts:1461) | none | KEEP | optional (RECON-04 single-emit rules) |
| `reportDelistedPlugins` (apply.ts:1465) | none | KEEP (user: DLS-D1 warning stays) | optional |
| `rebuildScopeRoutingTableIsolated` (apply.ts:1473, body 1548-1580) | none (lock, no save) | KEEP (user: routing keeps running) | not needed; the user runs `/reload` after `apply` |
| `notifyMcpMigration` (apply.ts:1478) | none | KEEP if the move stays | — |
| `notifyReconcileAppliedWithContext` (apply.ts:1497) | none | REPLACED by the pending block | REPLACED by a command cascade |
| `surfacePostCommitWarnings` / `surfaceMcpConfigNotices` (apply.ts:1512, 1517) | none | only if load still writes MCP files | KEEP |

**How `index.ts` calls it today** `[VERIFIED: extensions/pi-claude-marketplace/index.ts:85, 111-152]`: `const applyReconcile = createApplyReconcile({ loadState });` then inside `prepareResources`: `hydrateProjectScopeForCwd(event.cwd)`, then `await applyReconcile({ ctx, run, cwd: event.cwd, hooksRouting, completionCache, reason: event.reason })` wrapped in a try that calls `notifyReconcileAborted` on throw, then `recomputePluginPath(event.cwd)` with `notifyPluginPathSkipped` per skip. `resources_discover` then returns `aggregateDiscoveredResources(...)`. `session_start` only sets env vars (index.ts:201-209). The run is opened with `openNotificationRun(pi, { kind: "load" })` (index.ts:116), so load payloads carry `origin.kind: "load"`.

**Lock rule (APL-01 "under the state lock"):** each orchestrator the apply pass drives takes its own per-scope lock; the pass itself holds NO outer lock because `proper-lockfile` is `retries: 0` and not re-entrant (apply.ts CONTRACT comment lines 18-23; ARCHITECTURE.md "Lock re-entrancy"). "Under the state lock" must mean per change, not one lock around `apply`. Wrapping `apply` in `withLockedStateTransaction` self-deadlocks (`StateLockHeldError`).

### Pattern 2: One offline planner for `pending`, the load and `apply`

**What:** `planReconcile` is pure and synchronous and is gated pure by `test/architecture/reconcile-planner-purity.test.ts` (plan.ts is in `gate-targets.ts:221-227`). Convergence needs file reads (manifest, candidate tree, mirror HEAD), so it cannot live in `planReconcile`. Add an async, network-free convergence planner beside it and a single function that returns, per scope, `{ plan, convergence, warnings }`. `pending.ts`, the load and `apply` all call it, so the three cannot disagree.

**Inputs that differ today and must be unified:**
- The load plans with the LOAD-01 verdict (apply.ts:285, 290); `pending.ts:321` calls `planReconcile(mergedViewForPlanning(outcome, state), state, scope)` with NO verdict (PENDING-VERDICT-01, notify.ts:406-420). For "the load prints the same block pending prints", `pending` must compute the verdict too (`buildScopeSatisfactionVerdict` is offline).
- The load reads state under the lock and migrates first; `pending` reads unlocked and simulates the migration through `mergedViewForPlanning` (pending.ts:207-214). Keep both mechanisms; the composer takes the resulting plan.
- `pending` shows no delisted or unreadable-declarer rows; the load does. Recommend the shared composer emit those warning rows for both, so the blocks are identical. `PendingStatus` already includes `failed` (reconcile.messaging.ts:30).

**Convergence predicate (carried from the first pass, re-aimed at `apply`):**
- Population: every record in `state.marketplaces[*].plugins` that is enabled (`isRecordedButDisabled` is the single predicate, persistence/state-io.ts; backfill.ts:317 uses it), whose marketplace manifest lists it (DLS-D1: a delisted record never moves), and that this load's plan does not already touch (RECON-04 dedupe, backfill.ts:254-259, 321-325).
- Candidate: `resolveListCandidate(manifestEntry, { marketplaceRoot, marketplaceName }, locationsFor(scope, cwd))` (list-candidate-version.ts:45-82). Path source: resolves and takes the declared version (VER-02). Git source, warm: the mirror HEAD or the pinned commit copy and its version (VER-01: declared version, else `sha-` of the commit). Git source, cold: `{ kind: "cold" }`.
- Move when the candidate's version, sha, or plugin root differs from the record (the D-18-11 same-revision test is `isRecordedCandidate`, update-preflight.ts:376-389, which is module-private) OR the supported set strictly grew (`supportedSetGrew`, backfill.ts:571-578) OR a partial record's candidate resolves `installable` (the "made whole" case; see Pitfall 6).
- Cold git candidate: `list` today only reads `upgradable` from the entry's `version` (list-installed-row.ts:79-95: `const version = resolved?.version ?? manifestEntry.version; if (version === undefined || version === options.record.version) return { upgradable: false }`). A sha-pinned entry whose sha differs from `record.resolvedSha` with no `version` reads not upgradable. Since `apply` may now clone, `pending` can list a cold move whenever the target is known offline (a version that differs, or a sha pin that differs). An unpinned cold source with an unchanged version has no offline evidence of a move and must be listed by neither `pending` nor `apply` (so `apply` does exactly what `pending` listed).
- Block 1, range: walk dependents with `buildScopeDeclarationDetail` (the gate's walk, update-constraint-gate.ts:465-480), fold their ranges with `intersectDependencyRanges`, and hold when the candidate version fails the fold (`admitResolvedVersion`, update-constraint-gate.ts:521-543, is exported and pure). An unreadable walk fails closed (D-18-17) as a `(failed) {unreadable}` row.
- Block 2, consent: a clean record (`compatibility.installable: true`) whose candidate resolves `partially-available` is blocked with the `(partially-upgradable)` decline (WCONV-01, backfill.ts:404-419). A record already `installable: false` moves.
- Ordering for ranges judged against the post-apply scope (the stale D-08 idea): see Open Question 7.

### Pattern 3: Execute a move through the shared runner, not through reinstall

**What:** today's backfill re-materializes through `createReinstallOperation` with `render: "none"` (backfill.ts:253, 423-431). Reinstall is the wrong primitive for a version move:
- `runPostSuccessMaintenance` deletes the plugin data directory on every successful reinstall (reinstall-flow.ts:451-485: `const dataDir = await locations.pluginDataDir(marketplace, plugin); ... await removeDataDir(dataDir, { recursive: true, force: true })`). An update keeps data.
- `REINSTALL_MATERIALIZATION` `[VERIFIED: orchestrators/plugin/reinstall-flow.ts:210-219]` is `refreshSource: false`, `skipSameRevision: false`, `overwrite: true` (re-materializes the recorded revision and overwrites user-edited agent files).

`MaterializationPolicy` `[VERIFIED: orchestrators/plugin/update-preflight.ts:131-150]` has exactly three fields: `readonly refreshSource: boolean;` `readonly skipSameRevision: boolean;` `readonly overwrite: boolean;`. `UPDATE_MATERIALIZATION` `[VERIFIED: orchestrators/plugin/update-flow.ts:1195-1199]` is `refreshSource: true, skipSameRevision: true, overwrite: false`.

Recommended convergence policy: `refreshSource: false` (converge on the catalog *on disk*; a present mirror's HEAD is read offline, a missing mirror is cloned, which `apply` may now do), `skipSameRevision: true`, `overwrite: false`. Add one knob for the tag search (Open Question 6). `partial` is a per-call option, not a policy field: pass `partial: !record.compatibility.installable` so a clean record declines and a partial record moves (the preflight's `widensPartialGate` covers only disabled records, update-preflight.ts:666-668).

Where the network is reached with `refreshSource: false`:
- `probeUnpinned` → `materializeUnpinnedSource(seam, { ..., refresh: refreshSource })` under `withExistingScopeLock` (update-preflight.ts:273-289). The policy comment says `false` "reads a present mirror's HEAD with no network and clones only a missing mirror (NFR-5 cache miss)" (update-preflight.ts:132-136).
- `probePinned` → `seam.resolvePluginPin` + `seam.materializePluginClone` (update-preflight.ts:292-318), which clone the commit when the copy is absent.
- The constraint gate's stage one: `probeGitStageOne` lists the dependency repository's remote tags through `seam.probeDependencyTags` when `options.auth.notification` is set (update-constraint-gate.ts:387-412); with no notification context it skips the query and admits the range unpinned (lines 394-396). `probePathStageOne` reads the marketplace clone's local tags (no network) and may pin a marketplace tag (lines 419-446).

Template to copy: `beginPluginUpdateRun` in `createPluginUpdateOperations` (update-flow.ts:1244-1272) returns a cascade-safe, render-free `PluginUpdateFn` that calls `updateSinglePluginWith` (update-flow.ts:629-718), which catches every throw into a `failed` outcome except `InvalidGitHubBaseUrlError`. Add a sibling (e.g. `beginPluginConvergeRun`) that passes the convergence policy, takes `cwd` explicitly (`updateSinglePluginWith` uses `process.cwd()`, update-flow.ts:643, which is wrong for a project scope run from another cwd), and takes `partial` from the caller. `index.ts:79` already builds `createPluginUpdateOperations(hooksRouting, completionCache)` and passes `beginPluginUpdateRun` into `EdgeDeps` (index.ts:211-219), so the apply handler can receive the convergence runner the same way.

What `createReinstallOperation` adds that convergence must still replicate: the ENBL-08/ENBL-05 disabled skip (reinstall-flow.ts:388-404; the preflight's disabled branch is update's pin refresh instead, so convergence must filter disabled records itself, as backfill.ts:317 does); the completion-cache drop (reinstall-flow.ts:458-466; update's own path handles its cache drop inside the swap/flow, verify before relying on it). What it must NOT replicate: the data-dir delete and `overwrite: true`.

### Pattern 4: Adding a verb (template: `pending`)

Files and anchors `[VERIFIED: read this session]`:
- `edge/router.ts`: `SubcommandHandlers` interface (lines 43-73, `pending: SubcommandHandler;` at 58); `TOP_LEVEL_SUBCOMMANDS` (line 79, holds `"pending"`), which the completion provider imports (`edge/completions/provider.ts:39, 73, 150-151`), so completions follow automatically; `TOP_LEVEL_USAGE` (line 139; holds `"  pending [--scope user|project]\n"`), which IS the help text (`edge/handlers/plugin/help.ts` calls `notifyUsageInfo(ctx, run, TOP_LEVEL_USAGE)`); the dispatch `case "pending": return { commandId: "plugin pending", handler: handlers.pending, args: rest };` (line 256-257).
- `edge/register.ts:126`: `pending: makePendingHandler(),`; the command description string at register.ts:82 lists verbs.
- `edge/flag-catalog.ts`: `CatalogVerb` union (lines 52-75, holds `| "pending"`) and the `CATALOG` record (`pending: [],` at line 203). `test/architecture/flag-catalog-drift.test.ts` checks the catalog against the router.
- `edge/handlers/plugin/pending.ts` (55 lines) is the whole template: `withParsedArgs(parseArgs, USAGE, ...)`, `rejectUnknownFlag`, a no-positional guard, then the orchestrator call with `cwd: ctx.cwd` and the optional `scope`.
- `commandId` is a free string in the wire schema (`commandId: Type.String({ minLength: 1 })`, notification-wire.ts:352), so `"plugin apply"` needs no schema change. `test/architecture/catalog-uat/catalog-wire.test.ts:130` maps `"/claude:plugin pending"` to `"plugin pending"`; add the apply pair there.
- Byte-pinned usage consumers that change with `TOP_LEVEL_USAGE`: `features/plugin/help.feature`, `features/plugin/usage-errors.feature`, `test/edge/router.test.ts`, `test/edge/register.test.ts`, `test/edge/handlers/plugin/help.test.ts`.

`apply` deps: it needs `hooksRouting`, `completionCache`, the git ops seam for marketplace adds (apply.ts uses `opts.gitOps ?? DEFAULT_GIT_OPS` through `addMarketplace`), and the convergence runner. `makeImportHandler(deps, hooksRouting)` (register.ts:129) is the closest template for a handler that takes `EdgeDeps` + `hooksRouting`.

### Pattern 5: The pending block, the trailer, and the JSON shape

- `pending` emits through `notifyWithContext(opts.ctx, opts.run, PENDING_CONTEXT, marketplaces, undefined, "plural", retained)` (pending.ts:397-405), i.e. a `cascade` payload with label `"Reconcile pending"` (reconcile.messaging.ts:44-53). The empty case emits `{ kind: "reconcile-pending-empty", ...retained }` (pending.ts:341), rendered as the frozen line `"Pending: next reload will apply 0 actions."` `[VERIFIED: shared/notification-grammar.ts:880]`. APL-04 changes that wording.
- `pending` has NO trailer today: the catalog says "The `/reload to pick up changes` trailer is STRUCTURALLY EXCLUDED" (docs/output-catalog.md:3509). The trailer machinery: `formatEnvelopeArguments` folds body, then tally or no-op headline, then `envelope.needsReload ? RELOAD_HINT_TRAILER : ""` (notification-grammar.ts:1225-1236), with `const RELOAD_HINT_TRAILER = "/reload to pick up changes";` (notification-grammar.ts:1161). `needsReload` is the OR of the rows' stamped `needsReload` (notification-summary.ts:461-515), except for kinds excluded by name, which include `reconcile-applied-cascade` and `reconcile-pending-empty` (notification-summary.ts:483-491).
- Two ways to add the `apply` trailer: (a) an `advisories` line (existing field on the `cascade` payload; renders after the body and before the tally, notify-context.ts:76-85); (b) a new envelope flag, e.g. `needsApply`, rendered as a frozen trailer after the tally, exactly parallel to `needsReload`, and exposed in JSON. (b) gives JSON consumers a typed signal and keeps the trailer last; (a) needs no schema change. Recommend (b) `[ASSUMED]`; both put a new field in every pending scenario's field table, because `the result has these fields:` fails on any unstated field (`namesLike`, features/lib/field-rows.ts).
- `apply`'s own output: emit a plain `cascade` with an `APPLY_CONTEXT` (label e.g. `"Apply"`, plural cardinality). Its realized rows stamp `needsReload: true`, so the standard `/reload to pick up changes` trailer fires with no new code. That satisfies "then suggests `/reload`".
- JSON cascade shape `[VERIFIED: docs/json-output.md:229-247]`: common fields `schemaVersion`, `kind`, `origin` (`kind` `command`|`load`|`hook`; `commandId`, `invocationId` for commands), `severity`, `needsReload`; `cascade` adds `marketplaces` (required), `tally`, `noOp`, `advisories`, `retainedWorkflows`. `reconcile-applied-cascade` carries `marketplaces` and `tally` only (docs/json-output.md:249-262). Docs policy: "A new optional field, a new kind, or a new closed-set member keeps the same version. Removing or renaming a field, changing its type, or changing its meaning requires a version bump." (docs/json-output.md:162).
- Fate of `reconcile-applied-cascade`: if the load prints the pending `cascade` and `apply` prints a command `cascade`, the kind loses its only producer (`notifyReconcileAppliedWithContext`, notify-context.ts imports `emitReconcileAppliedContextCascade`) and fallow reports the dead export chain. Open Question 5.

### Anti-Patterns to Avoid

- **One lock around `apply`:** self-deadlocks; each orchestrator locks itself.
- **Putting convergence inside `planReconcile`:** breaks the purity gate and import's synchronous use of the planner (`orchestrators/import/execute.ts:14` imports `planReconcile`).
- **Reusing reinstall for a version move:** deletes plugin data and overwrites edited agent files (Pattern 3).
- **A second pending composer for the load:** the load and `pending` drift; the requirement is "the same block".
- **Letting `apply` search tags while `pending` cannot:** `apply` would land a version `pending` never listed (Open Question 6).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version move | a new stage/commit flow | `materializeLatestVersion` (materialize-latest.ts:56-71) via a `beginPluginUpdateRun` sibling | Three-phase swap, rollback, clone GC, MCP notices, intent-mark locking already solved (UPR-01). |
| Offline candidate and version | a new resolver walk | `resolveListCandidate` (list-candidate-version.ts:45-82) | The one version rule (VER-01/02) that `list` already uses; `pending` and `list` then agree. |
| Range verdict | ad-hoc semver | `buildScopeDeclarationDetail` + `intersectDependencyRanges` + `admitResolvedVersion` | DLS-D1 installed-copy reads, fail-closed walk, holder naming in the cause line. |
| Blocked rows | new row literals | `projectSkippedOutcome` shape (update-cascade.ts:60-94) and `constraintCauseFor` (update-row.ts:294-308) | Byte parity with `update`'s rows (XSURF-03, D-10-11). |
| Updated row | new composer | `updatedRowFromOutcome` (update-row.ts:132-205) | Five degradation axes already composed; both cascades share it. |
| Per-scope fault isolation | new try/catch shapes | `runScopeIsolated` (backfill.ts:145-161) — move it, `apply.ts:112` imports it | Coerces a lock-held/EACCES throw into one `invalid-block` row. |
| Disabled check | `!record.enabled` | `isRecordedButDisabled` | `test/architecture/disabled-state-classification.test.ts` scans `DISABLED_STATE_TARGETS` for inline re-derivation. |

## Runtime State Inventory

This is a behavior refactor of a load path, so the five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` may carry `lastReconciledExtensionVersion` (persistence/state-io.ts:279, optional, threaded through normalization at 446-452). Records may carry the LOAD-01 `dependencyDisabled` marker (docs/plugin-enablement.md:34). | Keep the schema field readable (no migration). Stop reading/writing the stamp (see "Extension-version stamp" below). The `dependencyDisabled` marker: whoever owns LOAD-01 after this phase (apply) keeps re-deriving it (Open Question 3). |
| Live service config | None. No external service holds reconcile state. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None tied to reconcile. `PI_CODING_AGENT_DIR` relocates the user scope only. | None. |
| Build artifacts | `schema/claude-plugin.schema.json` is generated from `shared/notification-wire.ts` (`npm run schema:generate`, `scripts/generate-wire-schema.mjs`); `test/architecture/wire-schema.test.ts` fails when stale. | Regenerate after any status/field change. |

**Extension-version stamp (D-68-01/D-68-03):** the only writer is `applyBackfillForScope` (backfill.ts:111-114: `fresh.lastReconciledExtensionVersion = EXTENSION_VERSION;`), the only reader is backfill.ts:76. `EXTENSION_VERSION` (`shared/extension-version.ts`, `export const EXTENSION_VERSION = "0.20.1";`) has no other production consumer (grep: only backfill.ts:19 imports it). Deleting `backfill.ts` makes `extension-version.ts` an unused file under fallow. Least churn: delete `shared/extension-version.ts`, its paired test, and `test/architecture/extension-version-sync.test.ts`; keep the optional `lastReconciledExtensionVersion` in `STATE_SCHEMA` and its normalization carry-through so an old file still loads byte-stable. Update the version-bump checklist note (project memory says a bump touches `EXTENSION_VERSION`) and the `.claude/commands/analyze-upstream-releases.md` mention. Test files referencing the stamp: `test/orchestrators/reconcile/apply.test.ts` (97 hits), `backfill.test.ts` (64), `test/transaction/with-state-guard.test.ts` (22), `test/persistence/state-io.test.ts` (7), `test/index.test.ts` (6), `test/integration/workflow-kind-inversion.test.ts` (3), `test/integration/auth-e2e.test.ts` (1).

## Common Pitfalls

### Pitfall 1: The pending closed set is wider than it looks
**What goes wrong:** a new pending status compiles in one file and is silently dropped elsewhere (project memory: "optional-field silent-omission class").
**Sites a new plugin status touches** `[VERIFIED: grep + reads this session]`: `shared/notification-types.ts` (`StatusToken` union line 307ff, `PluginStatus` 338ff, a new message interface, `PluginNotificationMessage` union, `SCOPE_BEARING_LIST_STATUS` 739ff, `pluginVersion` switch 800ff); `shared/notification-wire.ts` `PLUGIN_STATUSES` (38-58); `shared/notification-json.ts` `wireScope` (584-604) and `wireVersion` (620-646); `shared/notification-grammar.ts` `PLUGIN_ROW_LAYOUT` (419-439), `DESCRIPTION_BEARING_STATUS` (1016-1036), the `partial` modifier in `formatPluginRow` (446-448); `shared/notification-resolve.ts` `CENTRAL_ROW_POLICY` (321-341); `edge/browser/plugin-browser.ts` three switches (134, 168, 205); `orchestrators/reconcile/reconcile.messaging.ts` `PendingStatus`/`PendingMsg`/`PENDING_CONTEXT` (30-53); `test/architecture/compat-01-no-expansion.test.ts` (`EXPECTED_STATUS_TOKENS`, `EXPECTED_PLUGIN_STATUSES`, 318-366); `test/architecture/notify-closed-set-locks.test.ts` (enrollment records 122-170 and size pins); `test/architecture/notify-will-reload-agreement.test.ts` (each pending token mapped to its realized row); `test/architecture/soft-dep-marker-policy.test.ts` (policy maps 242, 277); `schema/claude-plugin.schema.json` (regenerate); `docs/output-catalog.md` (status table "19-member `PLUGIN_STATUSES`" at line 136, "The remaining 10 of the 19" at line 45, the pending section at 3507ff); `docs/json-output.md:839` (`PluginStatus` list); `docs/messaging-style-guide.md:61` (field matrix). `edge/handlers/tools.ts` switches over list statuses only and is unaffected.
**How to avoid:** add the status to `PluginStatus` first and let the `Record<..., ...>` maps and `noImplicitReturns` switches fail to compile; then fix every architecture enrollment.

### Pitfall 2: `reconcile-applied-cascade` kind exclusions
`shouldEmitReloadHint` excludes `reconcile-applied-cascade` by kind (notification-summary.ts:476-490) and severity code names it at 163 and 359. If `apply` reuses that kind, the exclusion must go or `apply` never suggests `/reload`.

### Pitfall 3: Scenario field tables state every field
A new `needsApply` (or `advisories`) field on the pending payload changes every `pending.feature` field table and every load scenario. `the result has these fields:` fails on any unstated field.

### Pitfall 4: MCP migration consults the load's plan
`mcp-migration.ts:179-217` skips an owner the plan installs, uninstalls, disables or enables, because the apply pass "rewrites both files". If the load no longer applies, a legacy entry whose owner the config newly declares is neither moved nor installed. `test/integration/mcp-migration.test.ts:322` ("when claude-plugins.json declares the owner, the reload installs it and sweeps the old entry") breaks. Open Question 4.

### Pitfall 5: LOAD-01 and uninstall's `{dependents unsatisfied}` rely on a load-time disable
README.md:369: "At the next reload, Pi disables those dependents." If the load stops disabling, a dependent with an unsatisfied dependency keeps loading until `apply`. Open Question 3.

### Pitfall 6: The "made whole" case cannot be faked by a code change in cucumber
Backfill's growth test (`supportedSetGrew`) only fires when the extension's supported kinds grow, which needs a code change. A scenario can instead install with `--partial` a plugin that has an output style (`Given the published plugin "X" of the marketplace "X" has an output style` exists in update.feature), then republish it without the output style. With the same version and root, `isRecordedCandidate` says "same revision", so the convergence predicate must also move a partial record whose candidate now resolves `installable` (or the unsupported set shrank).

### Pitfall 7: `partially-upgradable` severity and hint
`projectSkippedOutcome` stamps `severity: cardinality === "single" ? "warning" : "info"` on the decline and `partialHint: true` (update-cascade.ts:70-80), and the hint text is `"Re-run with --partial to update with the supported components."` (notification-grammar.ts:504-505). `apply` is plural, so the row would be `info`, and `apply` has no `--partial` flag. Open Question 8.

### Pitfall 8: `apply` with nothing pending must write nothing
APL-01 success criterion 1. The read pass never saves; each orchestrator writes only when it acts; the convergence runner returns `unchanged` before any write when `skipSameRevision` holds (update-preflight.ts:1035-1055). Do not stamp anything on an empty `apply`.

### Pitfall 9: BLOCK C and BLOCK F
- BLOCK F default-denies `platform/git` imports and the identifiers `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone` in every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS` `[VERIFIED: eslint.config.js:44-100]`. The new load, convergence and read-pass modules must not name them; `read-pass.ts` extracted from apply.ts must not carry the `gitOps` option. `apply.ts` and `types.ts` stay seams.
- BLOCK C ledger lists are `PLUGIN_LEDGERS` (install-flow, update-flow, uninstall, reinstall-flow, enable-disable) and `MARKETPLACE_LEDGERS` (add, remove, update, autoupdate) `[VERIFIED: eslint.config.js:15-28]`. A reconcile module is not a ledger and may import plugin and marketplace orchestrators, as apply.ts already does.
- Fallow boundary zones: `orchestrators` is one zone (STACK.md), so reconcile → plugin imports are legal.
- `test/architecture/gate-targets.ts` names `orchestrators/reconcile/backfill.ts` in `MANIFEST_LOOKUP_TARGETS` (line 137) and `pending.ts` (136); deleting backfill.ts requires editing that list (project memory: "source-walk gates follow code").

### Pitfall 10: Complexity ceilings
`applyReconcileWithReader` and `preparePluginUpdate` are near the cognitive-complexity cap (update-preflight.ts comments at 964-970 say so). Split new logic into small functions; both ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15` must pass independently.

## Code Examples

### The apply handler (shape copied from `edge/handlers/plugin/pending.ts`)

```typescript
// Source: extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts:27-55 (template)
const USAGE = "Usage: /claude:plugin apply [--scope user|project]";

export function makeApplyHandler(deps: ApplyHandlerDeps, hooksRouting: InstallHooksRouting): SubcommandHandler {
  return withParsedArgs(parseArgs, USAGE, async (parsed, ctx, run): Promise<void> => {
    if (rejectUnknownFlag(parsed.positional, { ctx, run, usage: USAGE })) {
      return;
    }

    if (parsed.positional.length > 0) {
      notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
      return;
    }

    await applyCommand({ ctx, run, cwd: ctx.cwd, hooksRouting, ...deps,
      ...(parsed.scope !== undefined && { scope: parsed.scope }) });
  });
}
```
`ApplyHandlerDeps` and `applyCommand` are placeholder names `[ASSUMED]`.

### Convergence policy beside the two existing ones

```typescript
// Source pattern: orchestrators/plugin/update-flow.ts:1195-1199 and reinstall-flow.ts:210-219
const CONVERGE_MATERIALIZATION: MaterializationPolicy = {
  refreshSource: false, // the catalog on disk; a missing mirror still clones (apply may)
  skipSameRevision: true,
  overwrite: false,
};
```
A fourth field (tag search on/off) is `[ASSUMED]` and only needed if Open Question 6 resolves to "no tag search".

## State of the Art

| Old Approach | Current Approach (this phase) | Impact |
|--------------|------------------|--------|
| Load applies the config (RECON-01..05) and backfills on extension-version change (BFILL-01..03) | Load is read-only and prints the pending block; `apply` applies | NFR-2 amended (APL-D2); many reconcile scenarios move to `apply` |
| `pending` previews install/uninstall/enable/disable only; "no `will partially update` analog" (D-66-05, notify.ts:326-331) | `pending` also previews convergence moves and blocks | D-66-05 superseded; new pending statuses |
| WR-05 silent retry of a range-held backfill (backfill.ts:433-445) | A blocked move is a warning row on every `pending`/load and every `apply` | No silent retry |

**Deprecated by this phase:** `backfill.ts`, the `lastReconciledExtensionVersion` gate, `EXTENSION_VERSION` (if deleted), possibly the `reconcile-applied-cascade` kind.

## Feature and test inventory (what changes)

### Cucumber: new-session scenarios
`When the user starts a new pi session` appears 95 times, `Given the user has started a new pi session` 8 times, and `... in another project` 6 times. A scan of every scenario with a new-session `When` found 96 such scenarios across 22 feature files; 20 of them assert reconcile rows after the session.

**Move to `apply` (the session today changes installation state): 10 scenarios**
- `features/plugin/reconcile.feature` (8): installs a hand-declared plugin; adds a hand-declared marketplace and installs its plugin; uninstalls a plugin removed from a config; disables a plugin set to disabled; enables a plugin set to enabled; cannot install one hand-declared plugin and installs the other; disables a plugin an update left needing a newer dependency (LOAD-01); reports a hand-declared plugin Pi supports only in part.
- `features/plugin/git-source.feature` (2): a declared plugin whose clone the git host refuses (`source missing`); a declared plugin whose dependency's clone is refused (`dependency failed`). These assert request logs; under `apply` the clone attempt still happens, so the request-log steps stay valid.

**Stay at load, but the payload changes (kind, trailer, label): 10 scenarios**
- `features/plugin/reconcile.feature` (4): every new session warns about an installed plugin its catalog no longer offers; whose marketplace manifest is invalid; whose manifest is not valid JSON; once about a delisted plugin whose files are gone.
- `features/plugin/configuration.feature` (1): a new session does not install a plugin whose local layer lacks its marketplace (layer-gap row).
- `features/marketplace/update.feature` (2): autoupdate keeps a plugin removed from the catalog; an invalid refreshed manifest leaves installed plugins unchanged.
- `features/marketplace/remove.feature` (1), `features/plugin/uninstall.feature` (1), `features/plugin/update.feature` (1): an unreadable dependency declaration warning at load.

**Expectation changes outside session scenarios**
- `features/plugin/pending.feature` (7 scenarios): the trailer field and the empty-advisory wording.
- `features/plugin/help.feature`, `features/plugin/usage-errors.feature`: `TOP_LEVEL_USAGE` gains `apply`.
- `features/marketplace/update.feature` "Autoupdate off preserves installed versions" and similar: still true until `apply`, but the next load now prints a pending block naming the move. Any of these scenarios that runs a new session afterwards gains a pending payload to state.
- New: `features/plugin/apply.feature`.

Step support: no `reconcile` or `pending` verb step module exists (`features/step_definitions/plugin/` holds `fetch`, `git-source`, `import`, `installation`, `publishing`, `uninstall`); both features use shared steps (`the user runs "<command>"`, session steps, `the result has these fields:`, `the result lists these plugins:`). `apply.feature` can use the same shared steps. Steps needed for the APL-02 scenarios already exist: `Given the marketplace "X" offers these plugins:` / `... with dependencies:` / `... from git repositories:`, `Given the git repository "X" holds these plugins:`, `Then the git host receives no request`, `Then the git-source plugin "X" installed in the project scope runs revision 2 of its repository`, `Given the published plugin "X" of the marketplace "X" has an output style` (counts from update.feature, git-source-update.feature, fetch.feature). Request-log steps may only appear in git-source feature files (cucumber steps rule), so the cold-git `apply` scenario that asserts requests belongs in `features/plugin/git-source-update.feature` or a new git-source-specific feature, not in `apply.feature`. Under the layout rule, an `apply` verb step module would be `features/step_definitions/plugin/apply.steps.ts`; none is expected to be needed.

### Unit and integration tests
- `test/orchestrators/reconcile/apply.test.ts` (7,456 lines), `backfill.test.ts` (2,894; deleted with its source), `pending.test.ts` (913), `notify.test.ts` (2,689), `reconcile.messaging.test.ts`, `types.test.ts`, `mcp-migration.test.ts` (if Q4 changes the move), `plan.test.ts` (only if the planner input changes).
- `test/index.test.ts` (2,162): the `resources_discover` wiring.
- `test/edge/router.test.ts`, `test/edge/register.test.ts`, `test/edge/handlers/plugin/help.test.ts`, new `test/edge/handlers/plugin/apply.test.ts`, `test/edge/browser/plugin-browser.test.ts`.
- Integration: `load-reconcile-race.test.ts` (RECON-06 two-process race through `applyReconcile` children: becomes an `apply` race or a load race), `hooks-cross-scope-reconcile.test.ts`, `plugin-layer-consistency.test.ts`, `reserved-record-keys.test.ts:220` ("a reload whose config declares ... installs it"), `workflow-kind-inversion.test.ts:287-431` (RECON-05 / WCONV backfill tests), `mcp-migration.test.ts`, plus `test/integration/ipc-child.ts` and `load-reconcile-race-child.ts`.
- e2e: `test/e2e/resources-discover.test.ts`, `test/e2e/pi-json-output.test.ts` (CI only).
- Architecture: the closed-set tests in Pitfall 1, `catalog-uat/catalog-contract.test.ts` (command list at line 38), `catalog-uat/catalog-wire.test.ts:130`, `catalog-uat/fixtures/plugin-pending.ts`, `catalog-uat/fixtures/reconcile-applied.ts`, `flag-catalog-drift.test.ts`, `gate-targets.ts`, `extension-version-sync.test.ts`, `json-output-docs.test.ts`, `wire-schema.test.ts`, `reconcile-planner-purity.test.ts`.

### Docs
`README.md:164` ("Pi applies their contents at extension load (`/reload`)"), `README.md:197`, `README.md:369` (LOAD-01), `README.md:387`, and `README.es.md` in sync (readme skill); `docs/plugin-enablement.md` (rows 21-34 describe the reload convergence loop); `docs/dependency-resolution.md`; `docs/output-catalog.md` (pending section 3507ff, `reconcile-applied-cascade` section 3645ff, backfill states 3753ff/3779ff, status table and counts, a new `/claude:plugin apply` section with catalog states and fixtures); `docs/json-output.md` (kind list, `PluginStatus` list, the trailer field); `docs/messaging-style-guide.md`; `orchestrators/reconcile/README.md`; `CHANGELOG.md` (changelog skill); `.planning/PROJECT.md` (APL-D1/APL-D2 rows, the "Session-start autoupdate run -- deferred" line if criterion 4 lands).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MIG-01 (first-run `claude-plugins.json` generation) stays at load because it writes only the config file | Pattern 1 | If the user counts it as installation state, the load must stop migrating and `pending` keeps simulating the migration |
| A2 | The `apply` trailer is a new typed envelope flag (option b), not an advisory line | Pattern 5 | Wrong JSON shape in docs and scenarios |
| A3 | `apply` emits a plain `cascade` with an `APPLY_CONTEXT` and the standard reload trailer | Pattern 5 | Different scenario `kind` values |
| A4 | New pending statuses `will update` and `will reinstall` (realized `updated` / `reinstalled`), with a `partial` modifier on `will update` | Pitfall 1 | Closed-set churn twice |
| A5 | Convergence policy `refreshSource: false` (catalog on disk, not the remote branch head) | Pattern 3 | `apply` would differ from `update` for unpinned git sources; the user said "catalog version on disk" |
| A6 | The pending composer emits delisted and unreadable-declarer warnings so the load block equals `pending`'s | Pattern 2 | `pending` stays narrower than the load |
| A7 | A growth-only move renders `(reinstalled)` in `apply` rather than backfill's `(installed) {components now supported}` | Pitfall 1 / A4 | Row bytes in the catalog |

## Open Questions

1. **Session-start autoupdate does not exist (criterion 4, APL-03).**
   - What we know: PROJECT.md:1206 "Session-start autoupdate run -- Claude Code parity, deferred". `index.ts` runs no marketplace refresh. `orchestrators/marketplace/autoupdate.ts` (752 lines) is only the `marketplace autoupdate|noautoupdate` config flip (`setMarketplaceAutoupdate`). The autoupdate flag changes only `marketplace update`: `cascadeAutoupdates` updates each recorded plugin through the injected `pluginUpdate` when `snapshot.autoupdate` is true (marketplace/update.ts:565-600), wired by `deps.beginPluginUpdateRun()` in `edge/handlers/marketplace/update.ts:59`.
   - What's unclear: whether the user expects (a) a NEW session-start refresh of autoupdate-enabled marketplaces (git marketplaces need the network at load, which contradicts "the load and `pending` stay offline" and needs an NFR-5 amendment), or (b) that `marketplace update` with autoupdate on stops cascading plugin updates and leaves the moves pending.
   - Recommendation: ask the user before planning criterion 4. If (a), treat it as its own plan after the read-only load lands, with the network call isolated in a NETWORK_SEAM and a failure that never blocks the load (NFR-2). If (b), it touches `marketplace/update.ts` and the `features/marketplace/update.feature` autoupdate scenarios.
   - **Resolved (D-27, user, 2026-10-24):** option C. Autoupdate stays as it is; criterion 4 and the APL-03 autoupdate clause are dropped. No plan touches `marketplace/update.ts` or `autoupdate.ts`.

2. **Does the load still add and remove hand-declared marketplaces?**
   - What we know: `applyMarketplaceAdds`/`applyMarketplaceRemoves` run at load today (apply.ts:1281-1282); a git-source add clones (network at load). `pending` drops `marketplacesToAdd` ("marketplace add is immediate", notify.ts:436-440, WILL-01 / D-65.1-02), so a marketplace-only add shows no pending row.
   - Recommendation: move both to `apply` (the user's rule is "a load changes no installation state", and an add is a network clone). Then `pending` needs a row for a marketplace-only add/remove, which means a marketplace-level pending token (a `MarketplaceStatus` closed-set change) or counting the add in `isReconcilePlanListEmpty`. Ask the user.

3. **LOAD-01 dependency-disable at load.**
   - What we know: the load disables a plugin whose dependency is unsatisfied and stamps `dependencyDisabled` (apply.ts:1038-1146; `features/plugin/reconcile.feature` "A new session disables a plugin that an update left needing a newer version of its dependency"). The user's list forbids disable at load.
   - Recommendation: move it to `apply` and show it as `will disable` in `pending` (the projection already folds `pluginsToDependencyDisable` into the `will disable` loop, notify.ts:484-497). State the consequence to the user: until `apply`, the dependent keeps loading against an unsatisfied dependency.

4. **AMIG-01 MCP move at load.** It rewrites `mcp.json` / `mcp-adapter.json` for installed, enabled plugins, and consults the plan's buckets (mcp-migration.ts:179-217). It is a format migration, not one of the listed operations, but it writes artifacts. Recommendation: keep it at load (the old names stop working under pi-mcp-adapter) and drop the "plan installs it" sweep branch; confirm with the user.

5. **The `reconcile-applied-cascade` kind.** Keep it as `apply`'s output kind (remove the reload-trailer exclusion; JSON kind meaning changes from "applied load-time reconciliation"), or retire it (fallow forces deleting its emitter chain; the docs' version policy does not list kind removal explicitly). Recommendation: retire it and use `cascade` for both `apply` and the load; check with the user whether removing a kind needs a `schemaVersion` bump.

6. **Does `apply` search for an admitting tag?** `update`'s gate pins the highest satisfying tag (update-constraint-gate.ts:387-446). If `apply` does, it lands a version `pending` never listed. Recommendation: `apply` converges on the catalog version only and holds an out-of-range candidate (`admitResolvedVersion`), with a policy knob that skips stage one; `update` keeps the tag search.

7. **Ordering when a dependency and its dependent move together.** The gate walks the declarations in state (installed copies). If the catalog widens the dependent's range and bumps the dependency together, judging the dependency first holds it. Recommendation: in the planner, judge each candidate against the post-apply scope (a dependent that also moves contributes its candidate tree's declarations); in `apply`, move dependents before their dependencies (reverse of `domain/dependency-closure.ts` post-order) so the runner's own gate sees the new declarations. Both must be deterministic and identical between `pending` and `apply`.

8. **`(partially-upgradable)` in `apply`.** Its hint says "Re-run with --partial ..." but `apply` takes only `--scope`, and plural cardinality makes the row `info`, while APL-02 says "warning row". Options: give `apply` a `--partial` flag, or add an `apply`-specific hint naming `update <plugin>@<mp> --partial`, and stamp `warning`. Ask the user.

9. **APL-01's "reinstall".** Read as the growth-only/partial backfill move (same version). If the user also means "restore deleted artifacts" (what `reinstall` does), the offline planner would need an artifact-presence check. Recommendation: confirm the narrower reading.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.12.1 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; CI uses 24) | — |
| cucumber-js | `npm run test:cucumber` | ✓ | `node_modules/.bin/cucumber-js` | — |
| fallow | `npm run fallow` | ✓ | `node_modules/.bin/fallow` | — |

Note (project memory): Node 26 appends paths to fs errno messages where Node 24 does not; read error wording from the runtime, not from memory.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` (unit/integration); `@cucumber/cucumber` (behavioral) |
| Config file | `cucumber.json`; `package.json` scripts |
| Quick run command | `node --test test/orchestrators/reconcile/<module>.test.ts` |
| One named unit test | `node --test --test-name-pattern '<title>' <test-path>` |
| One pair's coverage | `npm run test:coverage:direct -- <source-or-test-path>` |
| One scenario | `npx cucumber-js --name '<scenario title>'` |
| Behavioral suite | `npm run test:cucumber` |
| Feature gate | `npm run check:features` (part of `check:static`) |
| Schema | `npm run schema:generate` after any wire change |
| Full suite | `npm run check` (static + unpaired + integration + cucumber + all-pair direct coverage) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APL-01 | `apply` makes every pending change, then `pending` is empty; empty `apply` reports so and writes nothing | cucumber + unit | `npx cucumber-js --name '<apply titles>'`; `node --test test/orchestrators/reconcile/apply.test.ts` | ❌ `features/plugin/apply.feature`; ✅ apply.test.ts (rewrite) |
| APL-01 | `apply` verb parses `--scope`, rejects positionals/unknown flags | unit | `node --test test/edge/handlers/plugin/apply.test.ts` | ❌ Wave 0 |
| APL-02 | path + cached-git catalog moves applied; range block and consent block stay with warning rows and stay in `pending` | cucumber + unit | `npx cucumber-js --name '<titles>'`; `node --test test/orchestrators/reconcile/convergence.test.ts` | ❌ |
| APL-02 | cold git target cloned by `apply` (request log) | cucumber (git-source feature) | `npx cucumber-js features/plugin/git-source-update.feature` | ✅ file, ❌ scenario |
| APL-02 | partial record made whole | cucumber | `npx cucumber-js --name '<title>'` | ❌ |
| APL-03 | hand-edited config + `/reload` (new session) changes no state, prints pending block with apply trailer; match prints nothing | cucumber + unit | session scenarios in `features/plugin/reconcile.feature`; `node --test test/orchestrators/reconcile/load.test.ts`; `node --test test/index.test.ts` | ✅ reconcile.feature (rewrite), ❌ load.test.ts |
| APL-04 | `pending` advises `apply`; help/completions/router name `apply`; JSON documents it | cucumber + architecture | `npx cucumber-js features/plugin/pending.feature features/plugin/help.feature`; `node --test test/architecture/json-output-docs.test.ts test/architecture/wire-schema.test.ts test/architecture/flag-catalog-drift.test.ts test/architecture/catalog-uat/catalog-contract.test.ts` | ✅ (update) |
| all | closed sets enrolled | architecture | `npm run test:unpaired` (runs `test/architecture/**`) | ✅ (update) |

### Sampling Rate
- **Per task commit:** the owner tests and `npm run test:coverage:direct -- <path>` for each touched pair; the hook runs `npm run check:commit` (no cucumber).
- **Per wave merge:** `npm run check` (includes `test:cucumber`).
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/edge/handlers/plugin/apply.test.ts` — APL-01 parsing
- [ ] `test/orchestrators/reconcile/load.test.ts` — APL-03 read-only load
- [ ] `test/orchestrators/reconcile/convergence.test.ts` — APL-02 planner
- [ ] `test/orchestrators/reconcile/read-pass.test.ts` — if the read pass is extracted
- [ ] `features/plugin/apply.feature`
- [ ] `test/architecture/catalog-uat/fixtures/plugin-apply.ts` and its registration in `fixture-maps.ts`

## Recommended decomposition (tracer-first; same-wave plans touch disjoint files)

**Wave 1 — Plan A: the `apply` verb (tracer).** `apply` runs today's config buckets (`applyPlan`) from a command and prints a command `cascade` with the reload trailer; the load is unchanged. Files: `edge/handlers/plugin/apply.ts` (new) + test, `edge/router.ts`, `edge/register.ts`, `edge/flag-catalog.ts`, `orchestrators/reconcile/apply.ts` (export a command entry beside `createApplyReconcile`), `reconcile.messaging.ts` (`APPLY_CONTEXT`), tests, `features/plugin/apply.feature` (hand-declared install → `apply` installs → `pending` empty; empty `apply` writes nothing), `features/plugin/help.feature`, `features/plugin/usage-errors.feature`, `test/architecture/catalog-uat/*` for the apply states, `docs/output-catalog.md` apply section.

**Wave 2 — Plan B: the read-only load and the shared pending composer.** Files: `index.ts` + `test/index.test.ts`, `orchestrators/reconcile/load.ts` (new) + test, `read-pass.ts` (extracted) + test, `apply.ts` (loses load-only steps), `pending.ts` (verdict, warnings, trailer), `notify.ts`, `shared/notification-grammar.ts` / `notification-summary.ts` / `notification-types.ts` / `notification-wire.ts` / `notification-json.ts` (trailer flag), `schema/claude-plugin.schema.json`, `features/plugin/reconcile.feature` → scenarios move to `apply.feature` (owned by this plan in this wave), `features/plugin/pending.feature`, the other 10 load-warning scenarios, `test/integration/*` reconcile tests, `docs/json-output.md`, `docs/output-catalog.md` pending/reconcile sections. Depends on Plan A (scenarios need `apply`). Resolve Open Questions 2-5 first.

**Wave 3 — Plan C: offline convergence planner + pending preview.** Files: `orchestrators/reconcile/convergence.ts` (new) + test, `notify.ts` / `pending.ts` / `load.ts` (rows), `reconcile.messaging.ts` (new pending statuses), every closed-set site in Pitfall 1, `schema/`, architecture tests, `docs/output-catalog.md` status table and counts, `features/plugin/pending.feature` move/block scenarios. Possibly an exported offline helper in `update-constraint-gate.ts` (Open Question 6/7).

**Wave 4 — Plan D: `apply` executes convergence; backfill retired.** Files: `orchestrators/plugin/update-flow.ts` (convergence runner) + test, `update-preflight.ts` (tag-search knob, if chosen) + test, `orchestrators/reconcile/apply.ts` (move step, blocked rows), delete `backfill.ts` + `backfill.test.ts` (move `runScopeIsolated`), delete `shared/extension-version.ts` + its tests + `extension-version-sync.test.ts`, `test/architecture/gate-targets.ts`, `test/integration/workflow-kind-inversion.test.ts`, `features/plugin/apply.feature` (path + cached git moves, range block, consent block, partial made whole), `features/plugin/git-source-update.feature` (cold git target cloned by `apply`, request log), `features/marketplace/update.feature` expectations, `docs/output-catalog.md` backfill states replaced.

**Wave 5 — Plan E: docs and decisions** (can run beside Plan D only if it touches no file D touches; `docs/output-catalog.md` belongs to D, so keep E to): `README.md`, `README.es.md`, `docs/plugin-enablement.md`, `docs/dependency-resolution.md`, `docs/messaging-style-guide.md`, `orchestrators/reconcile/README.md`, `CHANGELOG.md`, `.planning/PROJECT.md` (APL-D1/APL-D2 with the Claude Code comparison researched through `.agents/skills/claude-code-compat-research`). Criterion 4 (Open Question 1) becomes its own plan once decided.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (apply may clone git sources) | existing `buildCloneAuth` / stored-credential bundles in the runner; the load must not trigger a Device Flow (no network) |
| V4 Access Control | yes (path containment) | `assertPathInside` via `ScopedLocations` (NFR-10) |
| V5 Input Validation | yes (hand-edited configs, manifests) | typebox validators (`PLUGIN_ENTRY_VALIDATOR`, `CONFIG_SCHEMA`); CFG-03 invalid config aborts the scope |
| V6 Cryptography | no | — |
| V7 Errors / logging | yes | redaction (`redactAbsolutePaths`, T-53-02-02) on every row cause; only closed-set reasons in rows |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| Load triggers a network request (offline regression) | Information disclosure / DoS | BLOCK F on the new modules; cucumber `the git host receives no request` after a session |
| Uninstall at `apply` deletes plugin data without a prompt | Tampering | Now behind an explicit command (D-02-04 kept the promptless default; it is less surprising on `apply` than on load) |
| Stale lock / concurrent `apply` | Tampering | per-op `withLockedStateTransaction`, `StateLockHeldError` rows; RECON-06 race test re-aimed at `apply` |
| Path leak in cause lines | Information disclosure | `redactAbsolutePaths` / `redactCauseChain` already on every reconcile push site |

## Sources

### Primary (HIGH confidence; read this session)
- `extensions/pi-claude-marketplace/index.ts` (whole file)
- `orchestrators/reconcile/{apply.ts, backfill.ts, pending.ts, notify.ts, reconcile.messaging.ts, types.ts, apply-outcomes.ts, delisted-plugins.ts}` (sections cited)
- `orchestrators/plugin/{materialize-latest.ts, update-preflight.ts, update-flow.ts, reinstall-flow.ts, operations.ts, update-constraint-gate.ts, update-row.ts, update-cascade.ts, list-installed-row.ts, list-candidate-version.ts, git-source-probe.ts}`
- `orchestrators/marketplace/update.ts:560-600`, `orchestrators/marketplace/autoupdate.ts` (outline)
- `edge/{router.ts, register.ts, flag-catalog.ts}`, `edge/handlers/plugin/{pending.ts, import.ts, help.ts}`, `edge/completions/provider.ts` (imports)
- `shared/{notification-types.ts, notification-wire.ts, notification-json.ts, notification-grammar.ts, notification-resolve.ts, notification-summary.ts, notify-context.ts, extension-version.ts}`, `persistence/state-io.ts:270-460`
- `eslint.config.js:15-100`, `test/architecture/{gate-targets.ts, compat-01-no-expansion.test.ts, notify-closed-set-locks.test.ts, notify-will-reload-agreement.test.ts}`
- `docs/json-output.md:1-360, 839`, `docs/output-catalog.md` (sections cited), `README.md` (lines cited), `.planning/PROJECT.md:1195-1252`, `.planning/ROADMAP.md` Phase 29, `.planning/REQUIREMENTS.md:171-174`
- `features/plugin/reconcile.feature`, `features/plugin/pending.feature` (outline), a scripted scan of every `features/**/*.feature`
- `.agents/skills/{cucumber, typescript-unit-tests, local-verification, typescript-style}` SKILL and rules files

### Secondary
- Upstream Claude Code docs `https://code.claude.com/docs/en/plugins/host-marketplace.md`, as quoted in the stale 29-CONTEXT.md D-01 (not re-fetched this session).

## Metadata

**Confidence breakdown:**
- Code map and closed-set inventory: HIGH (read and grepped this session).
- Architecture split: MEDIUM (sound against the code, but Open Questions 1-5 change its edges).
- Pitfalls: HIGH for the mechanical ones (1, 2, 3, 9), MEDIUM for 5-8 (they depend on user answers).

**Research date:** 2026-10-24
**Valid until:** until the CONTEXT.md rewrite lands; re-check Open Questions 1-9 against it before planning.
