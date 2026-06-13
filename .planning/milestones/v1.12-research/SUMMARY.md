# Project Research Summary

**Project:** pi-claude-marketplace v1.12 — Marketplace and Plugin Config Files
**Domain:** Declarative desired-state config + load-time reconciler for an existing imperative
plugin manager (Pi extension)
**Researched:** 2026-06-09
**Confidence:** HIGH

## Executive Summary

v1.12 introduces two user-facing JSON files (`claude-plugins.json` + `claude-plugins.local.json`)
as the authoritative desired state for which marketplaces and plugins should be installed per
scope, paired with a load-time reconciler that materializes declared state on every Pi startup
and `/reload`. Research confirms this places the extension firmly at the **authoritative-pole**
of declarative config tools — the same pole as nix home-manager and `brew bundle` — which is
powerful but carries the highest density of data-loss failure modes of any milestone to date.
The stack requires zero new runtime dependencies; every capability needed is already present in
`write-file-atomic`, `typebox`, `proper-lockfile`, and `node:fs/promises`.

The recommended approach mirrors the existing codebase's established patterns throughout. The
reconciler reuses the D-28 pure-planner + effectful-executor split from `orchestrators/import/`;
config I/O mirrors `persistence/state-io.ts` with a sibling `config-io.ts`; write-back composes
inside the existing `withLockedStateTransaction` scope; and first-run migration follows the
fire-and-forget model of `persistence/migrate.ts`. No new architectural patterns are introduced —
the risk is in wiring, ordering, and the new safety rails required by full-declarative semantics,
not in novel technology.

The dominant risk is **safety** around destructive reconciliation. Three non-negotiable gates must
be engineered before the reconciler can run any prune: (1) migration-first ordering so an
existing install is never reconciled against absence; (2) an absent/unparseable/empty config
trichotomy that aborts reconciliation on bad input rather than interpreting it as "uninstall
everything"; and (3) provenance-scoped removal so the reconciler only prunes artefacts this
extension materialized, mirroring ArgoCD's ownership guard. The secondary risk cluster is
behavioral integrity: reconcile convergence (fixed-point invariant), notification catalog
compliance (byte-locked UAT), and cross-process lock coverage for the new internal bookkeeping
file.

## Key Findings

### Recommended Stack

No new runtime dependencies are warranted. All required capabilities exist in the current
dependency set. The single noteworthy stack decision is to route all config writes through the
existing `shared/atomic-json.ts` seam (`write-file-atomic`) rather than adding a parallel
mechanism. A thin `saveConfig` wrapper mirroring `saveState` is the right abstraction. The
`typebox` pattern (`Type.Object` + `Compile` + `.Check`/`.Errors`) adds a new `CONFIG_SCHEMA`
constant alongside `STATE_SCHEMA` — same pattern, different shape. An optional routine bump of
the `typebox` dev-pin from `^1.1.38` to `^1.2.6` is available but not required.

**Core technologies (all already present):**

- `write-file-atomic@^8.0.0` — atomic JSON write for config files via the existing
  `atomicWriteJson` seam (NFR-1)
- `typebox@^1.1.38` — `CONFIG_SCHEMA` + compiled JIT validator for the new config-file shape;
  same pattern as `STATE_SCHEMA`
- `proper-lockfile@^4.1.2` — cross-process write serialization; config write-back joins the
  existing `withLockedStateTransaction` scope (no new lock)
- `node:fs/promises` (built-in) — `readFile` at load; ENOENT as migration trigger
- `memfs@^4.57.2` (dev) — in-memory unit tests for merge/diff/reconcile logic

**What NOT to use:** `comment-json` or `jsonc-parser` (comment preservation is a losing battle
against machine write-back); `deepmerge` / `lodash.merge` (entry-level override requires domain
logic, not generic recursion); `chokidar` / `fs.watch` (reconcile is load-time-only by locked
decision); `semver` (version pins are exact-equality strings, not ranges).

### Expected Features

v1.12 is at the authoritative-pole: config = truth, reconcile is automatic at load, undeclared
entries are removed. This is closest to home-manager's model and shares its pitfalls. The
features that matter most are the safety rails around destructive reconcile, not the reconcile
itself.

**Must have (table stakes for v1.12):**

- `claude-plugins.json` + `claude-plugins.local.json` schema, per scope — the artifact itself
- State split: committed desired-state vs internal machine bookkeeping — required for safe
  scoped removal and a reviewable committed file
- First-run generate-only migration from `state.json` — prevents data loss on upgrade; must
  precede any reconcile pass
- Load-time reconcile with provenance-scoped removal + network soft-fail (NFR-5) + atomic saga
  (v1.7)
- Reconcile report through the existing structured-notification cascade (trust surface)
- Write-back from every mutating command + `--local` flag
- enable/disable commands with re-enable from persisted records, no network
- gitignore handling / documentation for the `.local` file

**Should have (P2 — consider pulling to v1.12):**

- Dry-run / preview of the next reconcile — unusually important because reconcile is automatic
  (no explicit user gate like `brew bundle`); cost is LOW-MEDIUM since the diff is already
  computed

**Defer (v2+):**

- Per-entry version ranges / update policy in the committed file (conflicts with PI-7
  exact-equality hash model)
- Reconcile generation history (home-manager style)
- Cross-scope merge conflict surfacing

### Architecture Approach

v1.12 is a brownfield integration into an existing edge -> orchestrator -> bridge -> persistence
layering. The reconciler hooks into the `resources_discover` event handler in `index.ts`, running
before `aggregateDiscoveredResources` to guarantee ordering by construction. New persistence
components (`config-io.ts`, `config-merge.ts`, `migrate-config.ts`) are siblings to the existing
`state-io.ts`. A new `orchestrators/reconcile/` subtree mirrors `orchestrators/import/` in
structure: pure planner (`plan.ts`) + effectful executor (`apply.ts`) + notification builder
(`notify.ts`). Mutating commands each gain a config write-back step composed inside their
existing `withLockedStateTransaction` closure. The `STATE_SCHEMA` loses its desired-state fields
(autoupdate, enabled) which move to `CONFIG_SCHEMA`.

**Major components:**

1. `persistence/config-io.ts` — `CONFIG_SCHEMA`, `loadConfig`/`saveConfig`, entry-level
   base+local merge producing `MergedConfig`
2. `persistence/migrate-config.ts` — first-load generate-only migration from `state.json`;
   analogue of `migrate.ts`
3. `orchestrators/reconcile/plan.ts` — pure `planReconcile(merged, state) -> ReconcilePlan`;
   template is `import/marketplaces.ts::buildClaudeImportPlan`
4. `orchestrators/reconcile/apply.ts` — drives existing orchestrators serially (each owns its
   scope lock); template is `import/execute.ts::executeScopedPlan`
5. `orchestrators/plugin/enable.ts` / `disable.ts` — enable delegates to reinstall building
   blocks (cached, no network); disable delegates to uninstall cascade minus data-dir removal
6. `shared/config-writeback.ts` — `writeBackPluginEntry` / `writeBackMarketplaceEntry` invoked
   inside existing locked closures

**Critical wiring constraint:** existing orchestrators acquire the per-scope `proper-lockfile`
with `retries: 0`. They cannot be nested. `applyReconcile` drives them sequentially with no
outer lock, exactly as `import/execute.ts` does. Any attempt to wrap apply in an outer
`withStateGuard` deadlocks.

**Open feasibility question:** the `resources_discover` handler currently has no `ctx`/`pi` for
`notify()`. Reconcile notifications need a notify sink. Two options: (a) deferred channel
surfaced on `session_start`; (b) capture `pi` at extension-init. Flag for a spike in the
load-wiring phase.

### Critical Pitfalls

1. **Empty / missing / unparseable config silently uninstalls everything** — Implement a strict
   trichotomy: missing -> migrate-then-reconcile; unparseable -> abort reconcile, change nothing,
   surface error; genuinely empty-but-valid -> apply ownership guard before any prune. A 0-byte
   or truncated file must never trigger a mass uninstall.

2. **Migration is a one-way door** — Migration must be atomic (write config before touching any
   bookkeeping), idempotent (ENOENT detection, not a half-set flag), lossless (all installed
   entries including soft-degraded ones must appear in the generated config), and must preserve
   `state.json` intact. Exit gate: migrate-then-reconcile is a strict no-op.

3. **Write-back clobbers concurrent hand edits and the base/local split** — Write-back is a
   targeted entry-level patch of the specific target file (base or `--local` -> local), re-read
   under the scope lock immediately before write. Never serialize the merged view back to disk.
   Never let a `--local` write touch the base file.

4. **Reconcile -> mutate -> `/reload` -> reconcile loop** — Reconcile must converge to a fixed
   point (second immediate reconcile is a no-op, config/internal file byte-unchanged). Reconcile
   must never emit a reload hint. Reconcile writes only to the internal bookkeeping file, never
   to the user config (except one-time migration).

5. **Concurrent reconcile corrupts the internal bookkeeping file** — The entire reconcile pass
   must run under the existing cross-process scope lock extended to cover the new internal file.
   Two Pi instances starting simultaneously must not double-apply or interleave writes.

6. **Notification catalog compliance** — Reconcile is a brand-new emission context. All output
   must go through the typed `notify`/`emitWithSummary` seam (IL-2). New status/reason tokens
   require closed-set + catalog + byte-UAT amendment in the same atomic commit.

7. **enable/disable three-state confusion** — Model three orthogonal facts: declared / enabled /
   available. `disabled` (deliberate) and `unavailable` (soft-degraded) must never collapse.
   Reconcile's desired-materialized set = declared AND enabled; it must not re-materialize
   disabled entries.

## Implications for Roadmap

Based on research, the dependency graph mandates a foundation-before-behavior ordering. Persistence
shapes are leaf dependencies of everything else; the pure planner and enable/disable are
independently testable before any wiring; apply and load-wiring sit on top; write-back into
existing commands lands last on a frozen foundation.

### Phase 1: Config Schema and Persistence Foundation

**Rationale:** Every downstream component reads config shapes. Freezing them first avoids
repeated rework. This is pure addition with no behavior change — the lowest-risk entry point.

**Delivers:** `config-io.ts` (CONFIG_SCHEMA, loadConfig, saveConfig, atomicWriteJson seam),
`config-merge.ts` (entry-level base+local merge -> MergedConfig), `locations.ts` additions
(`configJsonPath`, `configLocalJsonPath` under `scopeRoot`), schema versioning field, lenient
validation + unknown-key preservation.

**Addresses:** Must-have schema artifact; state-split design (desired vs bookkeeping); Pitfall 9
(merge semantics), Pitfall 10 (schema evolution).

**Avoids:** Pitfall 3 (write-back semantics established here, not later); Pitfall 9 (entry-level
merge matrix unit-tested in isolation).

### Phase 2: State Split — Carve Desired Fields from STATE_SCHEMA

**Rationale:** Reconciler, write-back, and enable/disable all read the final shapes. Do early so
no downstream code is written against a transitional shape.

**Delivers:** `autoupdate` and `enabled` intent moved from `STATE_SCHEMA` to `CONFIG_SCHEMA`;
`state.json` retains only machine bookkeeping (resolved versions, artefact records, timestamps).
`schemaVersion` bump decision confirmed.

**Addresses:** State-split correctness; enables provenance-scoped removal (Pitfall 1 ownership
guard).

**Avoids:** Pitfall 2 (state-split leak in generated config); Pitfall 8 (disabled vs unavailable
modeled from the start).

### Phase 3: First-Run Migration

**Rationale:** Migration must precede reconcile in execution order. A wrong migration is not a
transient bug — it is the new ground truth. Must be provably correct before any reconcile code
exists.

**Delivers:** `migrate-config.ts` — reads `state.json`, generates `claude-plugins.json` with all
installed entries including soft-degraded ones, atomic write (tmp+rename), idempotent (ENOENT
detection), fire-and-forget model. `state.json` left intact.

**Addresses:** Must-have migration; Pitfall 2 (lossless coverage, atomic, idempotent, no
state-split leak).

**Exit gate:** Migrate a populated `state.json`, immediately run reconcile, assert zero net
change (no installs, no uninstalls).

**Avoids:** Pitfall 1 (migration-first ordering safety rail).

### Phase 4: Pure Reconcile Planner

**Rationale:** Separating the pure diff from effectful apply makes the correctness logic
exhaustively unit-testable without disk. Pin the full desired x actual matrix before any
mutations are wired.

**Delivers:** `orchestrators/reconcile/plan.ts` — pure `planReconcile(MergedConfig,
ExtensionState) -> ReconcilePlan`; reuses `samePlannedSource` from `import/execute.ts`;
bidirectional diff (adds and removes, unlike import which only adds). Architecture test
`reconcile-plan-matrix.test.ts` covering the full matrix.

**Addresses:** Correctness foundation; Pitfall 5 (planner logic provable without concurrency
risk); Pitfall 8 (disabled entries excluded from desired-materialized set in the planner).

**Avoids:** Anti-pattern of re-deriving the orchestration loop from scratch (reuses import
planner template).

### Phase 5: enable/disable Orchestrators

**Rationale:** Independent of the reconciler apply step; can prove the three-state model and
offline re-enable in isolation before wiring into reconcile.

**Delivers:** `orchestrators/plugin/enable.ts` (delegates to `reinstallPlugin` building blocks,
cached, no network, reads from persisted internal records not in-memory cache) and `disable.ts`
(delegates to uninstall cascade core minus `pluginDataDir` removal, keeps config entry + version
pin + cached clone). Config write-back included (`enabled: true/false`). Distinct list/info
presentation for `disabled` vs `unavailable`.

**Addresses:** Must-have enable/disable; Pitfall 8 (three-state model, offline re-enable,
reconcile exclusion of disabled entries).

**Exit gate:** `enable` re-materializes from cache with network unplugged and preserves the
version pin. Reconcile plan excludes disabled entries from `pluginsToInstall`.

### Phase 6: Reconcile Apply, Notification, and Load Wiring

**Rationale:** Apply drives existing orchestrators; notification must comply with the byte-locked
catalog; load wiring is the riskiest integration (the notify-sink feasibility question must be
resolved first). Bundle these because notification and wiring are tightly coupled.

**Delivers:** `orchestrators/reconcile/apply.ts` (drives add/remove/install/uninstall/
enable/disable sequentially, no outer lock, continue-on-failure per-item, accumulates outcomes);
`orchestrators/reconcile/notify.ts` (reconcile outcome -> `MarketplaceNotificationMessage[]`,
mirrors `buildImportNotificationMarketplaces`); `index.ts` modification (reconcileAtLoad inside
`resources_discover` before `aggregateDiscoveredResources`); notify-sink resolution; NFR-5
soft-fail boundary (never re-throw past `resources_discover`); NFR-10 containment extension for
config + internal file paths; architecture tests: no-throw-boundary, lock-discipline, catalog
byte-UAT extension, config-containment.

**Addresses:** Must-have load-time reconcile; must-have reconcile report; Pitfalls 4, 5, 6, 7.

**Research flag:** Notify-sink mechanism needs a feasibility spike before implementation — the
`resources_discover` handler has no `ctx`/`pi` in its current signature.

**Avoids:** Anti-patterns: nesting orchestrator locks, allowing network failures to escape the
boundary, emitting a reload hint from reconcile.

### Phase 7: Write-Back Integration into Mutating Commands

**Rationale:** Largest mechanical surface (every mutating command: add/remove/autoupdate/update/
install/uninstall/reinstall/import/bootstrap). Lands last so config shapes are frozen. The
targeted-patch and re-read-under-lock semantics established in Phase 1 are the foundation.

**Delivers:** `shared/config-writeback.ts` (`writeBackPluginEntry`, `writeBackMarketplaceEntry`);
`--local` flag threading through affected commands; write-back composed inside each command's
existing `withLockedStateTransaction` closure; format contract documented and enforced (plain
JSON, canonical on write, no no-op reformatting); unknown-key preservation on write-back;
architecture test `config-state-consistency.test.ts`.

**Addresses:** Must-have write-back + `--local`; Pitfall 3 (targeted patch, re-read under lock,
`--local` never touches base); Pitfall 9 (explicit write-target selection).

**Avoids:** The most dangerous shortcut: serializing the merged view back to the base file.

### Phase Ordering Rationale

- Phases 1-3 are leaf dependencies; everything downstream reads their output. Any phase that
  starts before Phase 3 is complete risks building against transitional shapes.
- Phase 4 (pure planner) and Phase 5 (enable/disable) are independently testable and can proceed
  in parallel after Phases 1-2 deliver frozen shapes; Phase 3 (migration) should complete first
  so its exit gate (migrate-then-reconcile no-op) is verifiable.
- Phase 6 (apply + wiring) depends on Phases 4 and 5; it is the highest-integration phase and
  carries the notify-sink uncertainty.
- Phase 7 (write-back) lands last to avoid re-touching commands as shapes evolve; it is
  mechanically broad but low-risk once the foundation is frozen.
- The pitfall-to-phase mapping confirms this order: Pitfalls 1-2 are addressed in Phases 1-3
  before any reconcile logic runs; Pitfalls 4-7 are addressed in Phase 6; Pitfall 3 spans
  Phases 1 and 7.

### Research Flags

Phases needing a feasibility spike during planning:

- **Phase 6 (load wiring):** The notify-sink question — `resources_discover` currently has no
  `ctx`/`pi`. Investigate whether (a) `pi` captured at extension-init is accessible in the
  handler or (b) a deferred-notification channel surfaced on `session_start` is needed. Low
  implementation cost either way, but the answer changes the wiring design.

Phases with well-documented patterns (standard implementation, skip dedicated research phase):

- **Phase 1 (config schema):** Direct mirror of `state-io.ts`; typebox + atomicWriteJson pattern
  fully established.
- **Phase 2 (state split):** Schema field relocation; no new patterns.
- **Phase 3 (migration):** Direct mirror of `migrate.ts` fire-and-forget model.
- **Phase 4 (pure planner):** Direct mirror of `import/marketplaces.ts`; reuses
  `samePlannedSource`.
- **Phase 5 (enable/disable):** Direct mirror of reinstall + uninstall cascade; patterns
  confirmed in source.
- **Phase 7 (write-back):** Targeted-patch pattern defined in Phase 1; mechanical threading.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                          |
| ------------ | ---------- | ---------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Grounded in real `package.json` + source files; zero new deps; all patterns confirmed in code. |
| Features     | HIGH       | Authoritative sources: brew, home-manager, asdf, pre-commit, Claude Code docs, real GH issues. |
| Architecture | HIGH       | Grounded in real codebase; every integration point cites a file path and line range.           |
| Pitfalls     | HIGH       | System-specific pitfalls from locked decisions; ecosystem signal from IaC reconciler research. |

**Overall confidence:** HIGH

### Gaps to Address

- **Notify-sink mechanism (Phase 6):** `resources_discover` has no `ctx`/`pi`. Spike before
  designing apply + wiring. Low cost; high certainty once spiked.
- **`STATE_SCHEMA` schemaVersion bump:** `autoupdate` is `Type.Optional` in the current schema,
  so an old state.json with it still validates. Confirm during Phase 2 whether a version bump is
  needed or optional; document the decision.
- **enable/disable STATUS_TOKENS:** Are "enabled"/"disabled" new tokens in the closed set or do
  they reuse "installed"/"uninstalled"? Decide in Phase 5 before any catalog forms are written.
- **bootstrap / import write-back batching:** These commands make N changes in one invocation.
  Write-back must be a batched multi-entry patch under one lock, not N full-file rewrites.
  Confirm the `config-writeback.ts` API supports batching before Phase 7 wires the first command.

## Sources

### Primary (HIGH confidence)

- Real codebase `extensions/pi-claude-marketplace/` — `index.ts`, `edge/register.ts`,
  `orchestrators/import/marketplaces.ts`, `import/execute.ts`, `plugin/install.ts`,
  `plugin/uninstall.ts`, `plugin/reinstall.ts`, `transaction/with-state-guard.ts`,
  `persistence/state-io.ts`, `persistence/migrate.ts`, `persistence/locations.ts`,
  `shared/notify.ts`, `shared/atomic-json.ts`
- `.planning/PROJECT.md` — milestone scope, locked decisions, NFR catalog
- `package.json` — confirmed dep set (`write-file-atomic@^8.0.0`, `proper-lockfile@^4.1.2`,
  `typebox` peer/dev, `memfs@^4.57.2`, `yaml@^2.9.0` dev)
- npm registry (`npm view`, 2026-06-09) — `write-file-atomic@8.0.0`, `typebox@1.2.6`,
  `comment-json@5.0.0`, `jsonc-parser@3.3.1`

### Secondary (MEDIUM confidence — ecosystem signal)

- Homebrew/brew#22450 — `brew bundle cleanup` uninstalling unmanaged artefacts (provenance-scoped
  removal evidence)
- nix-community/home-manager docs — authoritative-pole semantics, silent-drop on declaration
  removal
- pre-commit docs + issues (#1354, #2366) — immutable `rev`, autoupdate drift
- Claude Code settings docs + anthropics/claude-code#32606 — `enabledPlugins`, local override,
  prompt-model failure
- devcontainer lockfile spec + microsoft/vscode-remote-release#11616 — state-split leak
- ArgoCD/Flux/kubebuilder prune safety — ownership guard pattern
- Configuration files as user interfaces (HN) — round-trip clobber pattern

---

*Research completed: 2026-06-09*
*Ready for roadmap: yes*
