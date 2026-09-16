# Phase 5: Prune on uninstall - Research

**Researched:** 2026-09-16
**Domain:** In-repo orchestration (uninstall ledger, dependency declarations, closed-set notification vocabulary, flag catalog) -- no new external technology
**Confidence:** HIGH (every load-bearing claim is a file opened this session or an upstream doc retrieved verbatim with `curl`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Upstream reference for every decision below: Claude Code's
`claude plugin uninstall --prune` and `claude plugin prune`
(`docs/en/plugin-dependencies` § "Remove orphaned auto-installed
dependencies", retrieved 2026-09-16): "After removing the named plugin,
Claude Code scans for and removes any auto-installed dependencies that are
now orphaned. Plugins you installed yourself are never pruned." Where this
extension departs from upstream it is because FLAG-01 / D-02-05 close the
flag surface (no `-y`, no prompt) or because a standalone command is out of
scope.

#### Orphan scan breadth

- **D-05-01: The prune step is a WHOLE-SCOPE sweep, not a walk of the removed
  plugin's own closure.** After the named plugin is removed, every record in
  the target scope with `provenance: "dependency"` that no remaining installed
  plugin in that scope declares is removed — including orphans left behind by
  earlier plain uninstalls or by config-driven (reconcile) removals. This is
  upstream's semantics and the only path that ever cleans reload orphans,
  because reconcile keeps them (D-04-05, D-05-08).
  — **Reversibility:** costly — narrowing to the removed plugin's closure
  later would strand every orphan that already accumulated, with no command
  to clean it.
- **D-05-02: The sweep iterates to a FIXPOINT.** Removing dependency D1 can
  orphan D1's own dependency D2; the orphan test repeats until nothing new
  qualifies. Mirrors the install cascade's transitive closure.
- **D-05-03: Prune runs ONLY after the named plugin was actually removed.** A
  primary uninstall that does not happen — not installed, permission denied,
  lock held, or refused by the dependents guard (D-05-13) — prunes nothing;
  the failure row stands alone. `uninstall <not-installed> --prune` is not a
  back door to a standalone prune.
- **Removal order (Claude's discretion):** dependents before their
  dependencies (the reverse of the install post-order), each through the
  existing per-plugin removal, rows rendered in that order.

#### Who still counts as a declarer

- **D-05-04: A DISABLED installed plugin still holds its declared
  dependencies.** Installed is installed: a disabled record keeps its
  inventory and reservations (ENBL-18/19), and re-enabling it must find its
  dependencies still there. The orphan test is "no installed plugin declares
  it", never "no enabled plugin".
- **D-05-05: Same scope only.** The declarer set is the target scope's
  `state.json`; a plugin installed in the other scope never holds a record
  here and is never consulted. D-03-05 installs a dependency beside its root,
  and upstream prunes per `--scope`. Prune reads one state document.
- **D-05-06: Declarations are read OFFLINE from each remaining installed
  plugin's manifest at its on-disk root**, through the existing
  `orchestrators/plugin/dependency-declaration-read.ts::readDependencyDeclaration`
  (own manifest outranks the marketplace entry; entry answers only where the
  manifest is unreadable; fs + warm clone cache only, NFR-5). No stored
  declarer list exists or is added (D-04-01).
- **D-05-07: FAIL CLOSED on an unreadable declarer.** If any remaining
  installed plugin's declarations cannot be established — no readable
  manifest AND no marketplace entry to fall back to — the prune step removes
  NOTHING and reports it on that plugin's row (an existing reason such as
  `unreadable manifest` where it fits; the planner confirms which member the
  read's failure arm maps to). The primary uninstall still stands. Deleting
  on incomplete information is the one outcome this phase must never
  produce.
  — **Reversibility:** reversible — relaxing to "unreadable declares
  nothing" later is a one-line predicate change; the reverse direction
  cannot restore a wrongly pruned plugin.

#### Reconcile-path default (ROADMAP open decision 4 — settled)

- **D-05-08: Reconcile NEVER prunes.** The flag's absent value is "no prune",
  and `applyPluginUninstalls()` takes that default exactly as it takes
  DATA-03's delete default — one behavior at both entry points. Orphaned
  `"dependency"` records survive `/reload` (D-04-05 stays unconditional; the
  D-04-05 exemption is what keeps them) and are removed only by an explicit
  `uninstall … --prune`. Upstream: auto-installed dependencies "stay on disk
  … in case you reinstall a dependent plugin."
  The operator first chose a standing sweep on every reload and reversed it
  once three consequences were laid out: (1) plain `uninstall` and `/reload`
  would disagree about orphans — the two-behaviors trap the ROADMAP names;
  (2) promptless deletion would extend to plugins never named in any command
  or config edit; (3) D-05-07's fail-closed rule would fire on every reload
  for any user with one cold `(remote)` git-source plugin, making the sweep
  a third behavior.
  — **Reversibility:** reversible — a later standing sweep is one call in
  `apply.ts` plus a doc change; nothing written to disk depends on it.
- **D-05-09: `--keep-data` covers EVERY plugin the command removes.** The flag
  is a disposition for the whole command; each pruned row renders
  `{dependency pruned, data kept}` exactly as the primary row renders
  `{data kept}`. A per-plugin split would need a flag FLAG-01 forbids.
- **D-05-10: The prune decision lives on the Phase 2 option seam.**
  `UninstallPluginOptions` gains `prune?: boolean` beside `keepData`; the
  orchestrator runs the sweep inside the SAME locked state transaction after
  the primary removal, reusing its own per-plugin removal path; the reconcile
  caller never sets it. One ledger, one report. The edge handler maps the
  catalog-owned `--prune` name onto the option the way `KEEP_DATA_FLAG` is
  mapped today (D-02-02 / WR-01).

#### Reporting shape (PRUNE-04)

- **D-05-11: Each pruned plugin renders an ORDINARY uninstall row under its
  own marketplace header carrying a new closed-set reason `dependency pruned`**
  — in the register of `dependency promoted` / `dependency disabled`:
  `○ dep v1.0.0 (uninstalled) {dependency pruned}`, or
  `{dependency pruned, data kept}` under `--keep-data`. Same status, glyph,
  severity (`info`) and reload hint as the primary row; the brace is the only
  difference. One new `REASONS` member (appended at the tail — the tuple
  order is catalog-stable), one new catalog state, and the FULL closed-set
  amendment in one commit exactly as D-04-07 did: the member, its home in the
  command-private reason partition (not the idempotent group — a prune
  mutates state), the `notify-reasons.ts` count ledger, the emitting arm, the
  catalog section with its state anchor, the fixture, both catalog contract
  constants, the byte-length lock, both enumeration pins, and the
  `catalog-parser.test.ts` tuple count (the tenth surface 04-06 found).
  — **Reversibility:** one-way — a published catalog row is a user-visible
  contract; renaming the token later is a breaking output change.
- **D-05-12: Nothing to prune renders NOTHING extra.** When `--prune` was
  passed and no record qualified, the block is the primary row alone; no
  second token, no marker. Matches how `--keep-data` renders only where it
  changed something.
- **D-05-13: A pruned plugin that fails to remove renders its own
  `(failed) {reason}` row beside the successful ones**; the block computes
  `warning` (carried out but short); the named plugin's removal and the
  other prunes are NOT rolled back — each removal is its own committed step,
  as the cascade install reports per member. Uninstall has no ledger today
  and this phase does not add one.
- **Dev-tree residue (UAT note, no code):** records Phase 3 wrote on the
  operator's own trees were back-filled `"explicit"` by D-04-03, so `--prune`
  will correctly decline them there. The remedy is to uninstall and
  reinstall those plugins; carry this into `05-UAT.md` so it is not debugged
  as a prune defect (04-05-SUMMARY, Pitfall H).

#### Dependents guard (PRUNE-05 — folded in by the operator)

- **D-05-14: `uninstall X` REFUSES when any remaining installed plugin in the
  same scope declares X, and names the dependents.** Nothing is removed. The
  remedy is to uninstall the dependents first (or `uninstall Y --prune`,
  which then sweeps X as an orphan). Upstream's `disable` shape ("X is still
  required by Y. Disable that plugin first…"); cascade-removing dependents
  was rejected as a promptless command with an unbounded blast radius.
  Same declarer rules as the prune sweep: a DISABLED declarer holds (D-05-04),
  same scope only (D-05-05), offline manifest read (D-05-06), and an
  unreadable declarer fails closed — the uninstall is refused rather than
  risked (D-05-07).
  — **Reversibility:** costly — once users rely on the refusal, relaxing it
  silently breaks dependents again; adding a cascade-remove later needs a
  confirmation story the flag surface forbids.
- **D-05-15: Rendered as `⊘ X v1.0.0 (failed) {dependents remain}` with a
  cause line naming them: `cause: required by Y@mp, Z@mp`.** One new
  closed-set reason in the `plugins remain` register (that token's documented
  subject is a marketplace and is not borrowed); the names ride the cause
  line, never the token, on the `dependency cycle` precedent. `error`
  severity (the operation was not carried out). Full closed-set amendment as
  in D-05-11; the two new members land in one amendment commit or two — the
  planner decides — but each lands in FULL.
  — **Reversibility:** one-way — published catalog row.
- **D-05-16: The guard holds on the RECONCILE path.** A config-driven
  uninstall of X while a remaining installed plugin still declares X is
  refused, and reconcile reports the same failed row on every reload until
  the config is fixed — truthful, and the fix is one config edit. One
  behavior at both entry points (the DATA-02 / DATA-03 principle).
  — **Reversibility:** reversible — the reconcile arm can be relaxed to
  "config wins" later without touching persisted state.
- **D-05-17: PRUNE-05 is the requirement ID**, added to the PRUNE family in
  `REQUIREMENTS.md`, and ROADMAP Phase 5 gains success criterion 6 for it.

#### Flag surface (carried forward, not re-asked)

- `--prune` and `--keep-data` are the whole extra-flag set; `--local` and
  `--scope` unchanged (FLAG-01). No confirmation prompt and no `-y`: D-02-05
  rejected `-y`/`--yes`, DATA-02 set the no-prompt precedent, and Pi has no
  TTY prompt to honor. `edge/flag-catalog.ts` owns the `--prune` NAME the way
  it owns `KEEP_DATA_FLAG`; `flag-catalog-drift.test.ts`'s `uninstall`
  entries move from `["--keep-data", "--local"]` to include `--prune`, and
  the usage string documents it.

### Claude's Discretion

- Removal order within the pruned set (dependents before dependencies).
- How the fixpoint is computed (repeat-until-stable over the in-memory state
  snapshot inside the lock vs. a topological pass) — as long as D-05-01/02
  hold and the state is saved once.
- Which existing reason member (if any) carries D-05-07's "could not
  establish declarations" report, versus whether the failure arm of
  `readDependencyDeclaration` already yields a member; a NEW token for it
  needs the same full amendment and should be avoided if an existing one is
  truthful.
- Whether `dependents remain` and `dependency pruned` land in one catalog
  amendment commit or two.

### Deferred Ideas (OUT OF SCOPE)

- **Standalone `/claude:plugin prune` (`autoremove`) with `--dry-run`** — upstream has it; a new command surface, its own phase.
- **`-y` / confirmation prompt for prune** — rejected by D-02-05 / FLAG-01 for this milestone; Pi has no TTY prompt to honor anyway.
- **`list` / `info` marker for an orphaned dependency** (e.g. `{orphaned}`) — the only way a user could see what `--prune` would remove without running it; new closed-set token, new inventory semantics.
- **Repair path for pre-milestone provenance** (re-derive `"explicit"`/`"dependency"` from config membership for records Phase 3 wrote) — new capability; the UAT note covers the operator's tree.
- **Cascade-remove dependents on uninstall** (apt-style) — rejected in favor of the refusal (D-05-14); would need a confirmation story.
- Already backlogged from Phase 4, restated so the planner does not pick them up: **ENBL-DEP-01** (a cascade enables a disabled, already-installed dependency) and **DEPS-STATUS-01** (a plugin whose dependency is partially installed is itself partial).

#### Reviewed Todos (not folded)
- `2026-09-02-detect-unused-code-and-type-members.md` — matched on the word "phase" only (score 0.2); unrelated tooling todo.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRUNE-01 | `uninstall --prune` also removes dependency-installed plugins that no remaining installed plugin declares. | Pattern 2 (one declaration index per command, computed inside the lock), Pattern 3 (fixpoint over `provenance === "dependency"` records), Pattern 4 (guard-free per-plugin removal body); the `provenance` field is `Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` at `state-io.ts:136`. |
| PRUNE-02 | `--prune` never removes a plugin the user installed directly. | The orphan candidate set is filtered on `provenance === "dependency"` before any declaration is consulted (Pattern 3); a promoted record is `"explicit"` (04-06). Test: an explicit record declared by another plugin must survive (Validation map). |
| PRUNE-03 | `--prune` never removes a dependency that another installed plugin still declares. | Declaration index keyed `${name}@${marketplace ?? declaringMarketplace}` exactly as `buildChildEdge` fills it (`dependency-closure.ts:325`); disabled declarers included (D-05-04); the fixpoint only ever removes a record with zero remaining declarers (Pattern 3). |
| PRUNE-04 | The user learns which plugins `--prune` removed. | One `(uninstalled) {dependency pruned}` row per pruned plugin under its marketplace header; multi-block `notifyWithContext` call with `"single"` cardinality (Pattern 5); full ten-surface closed-set amendment (Pattern 6). |
| PRUNE-05 | `uninstall` refuses to remove a plugin another installed plugin in the same scope still declares, and names the dependents. | Same declaration index answers "who declares X" (Pattern 2); refusal row `(failed) {dependents remain}` + `cause: required by Y@mp, Z@mp` via `PluginFailedMessage.cause` (`notification-types.ts:360`); reconcile path needs `cause?: Error` on `PluginUninstallFailedOutcome` on the `InvalidBlockOutcome` precedent (Pattern 7). |
| FLAG-01 | `uninstall` accepts exactly `--keep-data` and `--prune` as extra flags, pinned by the drift guard. | Catalog is already consumed by the uninstall handler (`passThroughFlagNames("uninstall")`); the change is one `FlagEntry`, one exported `PRUNE_FLAG` constant, two pin rows in `flag-catalog-drift.test.ts`, two usage strings, and the two rejection tests that currently pin `--prune` as unknown (Pattern 1). |
</phase_requirements>

## Summary

Phase 5 is entirely in-repo work on machinery that already exists: the uninstall orchestrator's single locked transaction, the offline dependency-declaration reader Phase 3 built, the `provenance` field Phase 4 wrote, and the closed-set notification vocabulary with its ten pinning surfaces. No new package is needed and none should be added. The two behaviors -- the dependents guard (PRUNE-05) and the `--prune` sweep (PRUNE-01..04) -- share ONE input: a per-scope declaration index (`installed key -> set of declared keys`) built from every OTHER record in the target scope's `state.json`, read through `readDependencyDeclaration` inside the lock. The guard asks "does any entry declare X?"; the sweep asks "which `"dependency"` records have no declarer left?" and iterates to a fixpoint. Both fail closed on the same unreadable-declarer condition, which -- because the index is built once before the primary removal -- means the D-05-07 "sweep removes nothing but the primary stands" arm is unreachable from any entry point: the guard already refused. The planner should design one read pass and one fail-closed arm, not two.

Three facts found this session shape the plan more than anything in the CONTEXT: (1) `LockedStateTransaction.save()` throws when called twice (`with-state-guard.ts:93-95`), so the sweep MUST run before the one save and MUST NOT throw after the primary's artifacts are already off disk -- the existing AG-5 rethrow arm in `foldPartialCascadeFailure` would otherwise abort the save and leave a ghost record for the plugin the user named; (2) `uninstallPluginWithTransaction` sits at fallow cognitive 14 / ESLint 12 against a ceiling of 15, so the guard and the sweep must land as extracted helpers with at most one new branch each in the closure; (3) the guard runs on EVERY uninstall, so every existing fixture that uninstalls a plugin while a second record exists in the same scope with a non-existent `marketplace.json` (`seedGitPlugin`'s shared-clone case at `tests/orchestrators/plugin/uninstall.test.ts:2568`, and the LIFE-04 comment at `:306` that says uninstall "reads no manifest") flips from `(uninstalled)` to a fail-closed refusal. Those fixtures must grow a real manifest, not a relaxed guard.

Upstream parity was re-verified against the raw markdown (`curl`, 2026-09-16): `claude plugin uninstall` accepts `--keep-data`, `--prune`, `-y/--yes`, `--json`; prune removes dependencies "no longer required by any installed plugin" and "plugins you installed directly are never touched"; orphans otherwise "stay on disk". Upstream documents a refusal on DISABLE ("still required by ... Disable that plugin first"); it does not document an UNINSTALL refusal, so the D-05-14 guard is a deliberate divergence the docs must state as such.

**Primary recommendation:** Build one pure domain module for the orphan/dependents computation (`domain/dependency-orphans.ts`, no I/O) and one orchestrator leaf that assembles the scope's declaration index through `readDependencyDeclaration` (`orchestrators/plugin/dependency-index.ts`); wire both into `uninstall.ts` through the existing `UninstallTransaction` seam with a guard-free per-plugin removal body extracted from the lock closure, save once, never throw past the primary removal, and land the two closed-set members with all ten surfaces in one commit each.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `--prune` / `PRUNE_FLAG` name, parse, completion, usage text | edge (`flag-catalog.ts`, `handlers/plugin/uninstall.ts`, `router.ts`) | tests/architecture (`flag-catalog-drift.test.ts`) | The catalog is the SSOT by construction; the handler already consumes it via `passThroughFlagNames("uninstall")`. |
| Dependents guard + prune sweep decision | orchestrators/plugin (`uninstall.ts` inside `withLockedStateTransaction`) | domain (pure orphan/dependents computation) | Must read the locked in-memory state and reuse the per-plugin removal path (D-05-10); the pure math is domain so it is testable against synthetic graphs like `dependency-closure.ts`. |
| Declaration read (who declares what) | orchestrators/plugin (`dependency-declaration-read.ts`, existing) | domain (`dependencies.ts`, `manifest-lookup.ts`, `manifest.ts`) | Offline by construction (NFR-5); the manifest-read-agreement gate already covers this reader, so no new `path.join` of a manifest path may appear in `uninstall.ts`. |
| Row composition, severity, cause line | orchestrators/plugin (`uninstall.messaging.ts` + the emitting arms in `uninstall.ts`) | shared (`notification-types.ts`, `notify-reasons.ts`) | `notify` is a dumb renderer; the orchestrator stamps status/reasons/severity; the two new tokens are closed-set members. |
| Reconcile refusal row (D-05-16) | orchestrators/reconcile (`apply.ts::applyPluginUninstalls`, `apply-outcomes.ts`, `notify.ts`) | orchestrators/plugin (orchestrated `failed` outcome) | `plugin-uninstall-failed` carries only `reason` today; the cause line needs an optional `cause` on the outcome (InvalidBlockOutcome precedent). |
| Persisted state | persistence (`state-io.ts`) | -- | Nothing new is persisted: `provenance` exists, no declarer list is stored (D-04-01). |
| Docs | `docs/output-catalog.md` (byte-gated), `docs/dependency-resolution.md`, `docs/plugin-enablement.md`, `README.md` | tests/architecture (`catalog-uat`, `dependency-doc-agreement.test.ts`) | The failure-table gate parses only `## Why a dependency can fail`; prune/guard prose must live in its own section. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` + `node:assert/strict` | Node 26.8.2 local, 24 in CI `[VERIFIED: node --version this session; STACK.md]` | Unit + integration suites | Project-wide; no other runner. |
| `typebox` | `^1.1.38` `[VERIFIED: STACK.md]` | `PLUGIN_INSTALL_RECORD_SCHEMA.provenance` already typed | No schema change in this phase. |
| `proper-lockfile` via `transaction/with-state-guard.ts` | `^4.1.2` `[VERIFIED: STACK.md]` | The single locked transaction the sweep runs inside | Not re-entrant; the sweep must not re-acquire. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fallow` | `^3.17.0` `[VERIFIED: package.json:26]` | Complexity / dead-code / dupes gate; `fallow health --complexity --max-cyclomatic 1 --max-cognitive 1 --format json` gives per-function numbers | Run after every extraction to confirm the closure stayed under 15 cognitive. |
| `eslint` + `sonarjs` | `^10.4.0` `[VERIFIED: STACK.md]` | Second, independently computed cognitive ceiling (15) | `npx eslint --no-inline-config --rule '{"sonarjs/cognitive-complexity": ["error", 0]}' --format json <file>` prints every function's score. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixpoint over "declared by any remaining record" (D-05-01/02 literal) | Mark-and-sweep reachability from `"explicit"` roots | Reachability also prunes a mutually-dependent island of two `"dependency"` records; but PRUNE-03 says never remove a dependency "that another installed plugin still declares", and in that island each IS declared by an installed record. Fixpoint is the requirement-compliant choice; the island residue is unreachable through the cascade anyway (RESV-04 refuses cycles at install). |
| One read pass (index once, before the primary cascade) | Re-read declarations after the primary removal for the sweep | A second read re-opens the same files under the same lock and makes a TOCTOU window plus an otherwise-unreachable fail-closed arm the direct-coverage gate would not admit. |

**Installation:** none. This phase adds no package. `[VERIFIED: no new import outside the existing dependency tree is required by any pattern below]`

## Package Legitimacy Audit

No external package is installed by this phase. `npm view`, `package-legitimacy check`, and the postinstall scan were not run because there is nothing to check.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
/claude:plugin uninstall X@mp [--prune] [--keep-data] [--local] [--scope S]
        │
        ▼
edge/handlers/plugin/uninstall.ts
  extractLocalFlag(args, {consumeLongFlags: passThroughFlagNames("uninstall")})
  consumedFlags.has(KEEP_DATA_FLAG) → keepData:true
  consumedFlags.has(PRUNE_FLAG)     → prune:true            (FLAG-01)
        │
        ▼
orchestrators/plugin/uninstall.ts :: uninstallPluginWithTransaction
  resolveCrossScopePluginTarget ── miss ──▶ emitAlreadyGone / emitMarketplaceNotAdded (unchanged)
        │ resolved {scope, locations}
        ▼
  withLockedStateTransaction(locations, tx => {
     CFG-03 config check ─ invalid ─▶ configInvalid (unchanged)
     record absent ──────────────▶ alreadyGone (unchanged)
     ┌───────────────────────────────────────────────────────────────┐
     │ NEW (1) buildScopeDeclarationIndex(tx.state, locations, {exclude: X})  │
     │   for each other record R under each mp in tx.state:            │
     │     loadMarketplaceManifest(mp.manifestPath) ──throw──▶ FAIL CLOSED │
     │     lookupDeclaredPlugin(manifest, R.name) ──absent──▶ FAIL CLOSED  │
     │     readDependencyDeclaration({marketplaceRoot, entry, locations}) │
     │        found ──▶ index[R.key] = {dep.name@(dep.marketplace ?? mp)} │
     │        unusable ─────────────────────────────────▶ FAIL CLOSED    │
     │   FAIL CLOSED → refusal sentinel {declarer, reason, cause}; return │
     └───────────────────────────────────────────────────────────────┘
     NEW (2) dependents = keys whose set contains X  ── non-empty ──▶ refusal
                 sentinel {reasons:["dependents remain"], cause: "required by Y@mp, Z@mp"}; return
     existing: cascade(X) → fold/commit → sweepConfigLayers (standalone only)
     NEW (3) if opts.prune:                                          (D-05-03: only here)
        order = pruneOrphans(records with provenance "dependency", index, removed={X})
                 ← pure fixpoint; each pass removes the just-orphaned batch
        for each key in order:  removeRecordedPlugin(tx.state, key)  ← guard-free body,
                 NEVER throws: AG-5 → row (failed){source mismatch}@warning, record kept
        collect pruned rows / failed rows
     await tx.save()   ← exactly once (with-state-guard.ts:93-95)
  })
        │
        ▼ post-lock (unchanged mechanics, now per removed plugin)
  dropCachedHooks(...) per removed plugin
  runPostCommitCleanup({keepData}) per removed plugin (data dir, completion cache, clone GC)
        │
        ▼
  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [ {mp, scope, plugins:[primary row, …]},
                                                  {mp2, scope, plugins:[pruned rows…]} ], undefined, "single")

Reconcile entry (resources_discover / session_start):
  applyPluginUninstalls → uninstallPlugin({notifications:{mode:"orchestrated"}})   (no prune, ever)
     failed{reason:"dependents remain", error} → outcome plugin-uninstall-failed{reason, cause?}
     → notify.ts applyPluginOutcomeToBlock: failed row + cause line          (D-05-16)
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   └── dependency-orphans.ts            # NEW, pure: findDependents(), pruneOrphans() fixpoint
├── orchestrators/plugin/
│   ├── dependency-index.ts              # NEW leaf: buildScopeDeclarationIndex() over tx.state via
│   │                                    #   loadMarketplaceManifest + lookupDeclaredPlugin + readDependencyDeclaration
│   ├── uninstall.ts                     # guard + sweep wired through UninstallTransaction; removal body extracted
│   ├── uninstall.messaging.ts           # composePrunedRow / composeDependentsRefusal (+ UninstallPrivateReason pin)
│   └── dependency-declaration-read.ts   # unchanged (the ONLY manifest-locating read uninstall may use)
├── edge/
│   ├── flag-catalog.ts                  # PRUNE_FLAG_ENTRY + exported PRUNE_FLAG
│   ├── handlers/plugin/uninstall.ts     # USAGE + prune mapping
│   └── router.ts                        # TOP_LEVEL_USAGE uninstall line
├── orchestrators/reconcile/
│   ├── apply-outcomes.ts                # PluginUninstallFailedOutcome.cause?: Error
│   ├── apply.ts                         # thread result.error → cause
│   └── notify.ts                        # failed arm spreads cause
└── shared/
    ├── notification-types.ts            # REASONS += "dependency pruned", "dependents remain" (tail)
    └── notify-reasons.ts                # ledger 54→56, CommandPrivateReason arms
tests/
├── domain/dependency-orphans.test.ts    # NEW pair
├── orchestrators/plugin/dependency-index.test.ts   # NEW pair
├── orchestrators/plugin/uninstall.test.ts          # prune/guard cases + fixture manifests
├── orchestrators/plugin/uninstall.messaging.test.ts
├── orchestrators/reconcile/{apply,notify,apply-outcomes}.test.ts
├── edge/handlers/plugin/uninstall.test.ts          # --prune flips from rejected to accepted
├── edge/handlers/shared.test.ts                    # --prune stays rejected for the ENABLE consuming list (unchanged)
├── edge/router.test.ts                             # usage line pin
└── architecture/{flag-catalog-drift,catalog-uat/*,notify-closed-set-locks,compat-01-no-expansion,gate-targets}.test.ts
```

The `test:corresponding` gate (`scripts/check-corresponding-tests.mjs`) requires every new production file under `extensions/pi-claude-marketplace/<p>.ts` to have `tests/<p>.test.ts` `[VERIFIED: scripts/check-corresponding-tests.mjs:22-25 -- "function expectedTestPath(sourcePath) { const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3); return `${testRoot}/${relativePath}.test.ts`; }"]`.

### Pattern 1: FLAG-01 is a catalog entry, not a handler rewrite

**What:** The ROADMAP note ("`uninstall`'s handler hard-rejects unknown long flags inline rather than consuming `edge/flag-catalog.ts`") is stale since Phase 2. The handler already reads `passThroughFlagNames("uninstall")` and maps `KEEP_DATA_FLAG` off the catalog `[VERIFIED: edge/handlers/plugin/uninstall.ts:31,58 -- "const CONSUMED_FLAGS = { consumeLongFlags: passThroughFlagNames(\"uninstall\") };" and "...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true }),"]`.

**Surfaces to touch (each pinned by a test that fails if skipped):**

1. `edge/flag-catalog.ts:158` -- today `uninstall: [KEEP_DATA_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY],` `[VERIFIED: edge/flag-catalog.ts:158]`. Add a `PRUNE_FLAG_ENTRY` (`name: "--prune"`, description e.g. "Also remove dependency-installed plugins no remaining plugin needs", `parse: true, complete: true`) and export `PRUNE_FLAG = PRUNE_FLAG_ENTRY.name` beside `KEEP_DATA_FLAG` (`:190`) so the handler mapping cannot fail open on a rename (WR-01 rationale at `:70-77`).
2. `edge/handlers/plugin/uninstall.ts:22-23` USAGE string and the option spread: `...(localFlag.consumedFlags.has(PRUNE_FLAG) && { prune: true })` -- omit rather than forward `false`, the DATA-01 discipline (`:56-58`).
3. `edge/router.ts:95` -- `"  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local]\n"` `[VERIFIED: edge/router.ts:95]` gains `[--prune]`; the drift guard asserts each `documented` flag appears as `[--flag]` in that line (`flag-catalog-drift.test.ts:203-208`).
4. `tests/architecture/flag-catalog-drift.test.ts:127` -- `uninstall: ["--keep-data", "--local"],` → `["--keep-data", "--local", "--prune"]` (canonical sorted order; the pin compares against the SORTED catalog side, `:139-141`). And `:173` -- `uninstall: { documented: ["--keep-data", "--local"], omitted: [] },` → documented gains `"--prune"` `[VERIFIED: tests/architecture/flag-catalog-drift.test.ts:127,173]`.
5. Two existing tests pin `--prune` as REJECTED and must flip: `tests/edge/handlers/plugin/uninstall.test.ts:673-702` (the `rejectedToken` loop lists `"--prune"` and its comment says "the Phase 5 option this phase deliberately does not implement" -- reword under `.claude/rules/typescript-comments.md` when touching it) and `tests/edge/router.test.ts` / the handler suite's `USAGE_BLOCK` constant, which embed the usage line. `tests/edge/handlers/shared.test.ts:344,365` also list `--prune`, but against `consumeLongFlags: ["--keep-data"]` (the ENABLE usage) -- those stay correct and must NOT be edited.

### Pattern 2: One declaration index per command, built inside the lock, before anything mutates

**What:** A leaf `buildScopeDeclarationIndex(state, locations, { exclude })` that walks `state.marketplaces[mp].plugins[name]` for every record except the target and returns either `{ ok: true, index: ReadonlyMap<key, ReadonlySet<key>> }` or `{ ok: false, declarer: key, reason: ContentReason, cause: Error }`.

**Why the marketplace record is always at hand:** every plugin record lives under its marketplace record in the SAME state document, including a dependency adopted through the CMP-3 fallback (`install-outcome.ts:369-370`: "Mutates `state.marketplaces[marketplace]` when the CMP-3 fallback adopts a user-scope record into the target scope") `[VERIFIED: orchestrators/plugin/install-outcome.ts:365-370]`. So `uninstall.ts` never needs `resolveInstallMarketplaceSource`; `mpRecord.manifestPath` / `mpRecord.marketplaceRoot` are the inputs (`MARKETPLACE_RECORD_SCHEMA` fields at `state-io.ts:285-286`).

**The three failure arms and the tokens that already exist for them** (Claude's discretion item 3 -- recommendation: no new token):

| Arm | Trigger | Existing token | Precedent |
|-----|---------|----------------|-----------|
| manifest load throws | `loadMarketplaceManifest(mp.manifestPath)` rejects (`InvalidMarketplaceManifestError`, ENOENT, EACCES) | `narrowProbeError(err)` → `"unparseable" \| "invalid manifest" \| "permission denied" \| "source missing" \| "unreadable"` | `shared/probe-classifiers.ts:37-66` `[VERIFIED]`; reconcile's `classifyOrchestratorThrow` falls through to the same classifier (`apply-outcomes.ts:393`) |
| entry absent | `lookupDeclaredPlugin(manifest, name).kind === "absent"` | `"not in manifest"` | `install-cascade.messaging.ts:264-268 -- case "not-found": return { key: failure.key, reasons: ["not in manifest"], cause: new Error(`Dependency "${failure.key}" is not declared by its marketplace.`) };` `[VERIFIED]` |
| declaration unusable | `readDependencyDeclaration(...).kind === "unusable"` | `"invalid manifest"` | `install-cascade.messaging.ts:270-277 -- case "unusable-declaration": return { key: failure.key, reasons: ["invalid manifest"], cause: new Error(`Plugin "${failure.key}" declares an unusable dependency (${failure.detail}).`) };` `[VERIFIED]` |

`readDependencyDeclaration` itself never fails on a cold clone: a git source with no materialized clone yields `pluginRoot === undefined` → `NOT_READABLE` → the ENTRY answers `[VERIFIED: orchestrators/plugin/dependency-declaration-read.ts:256-267 -- "const declared = own.kind === \"readable\" ? own.dependencies : options.entry.dependencies;"]`, and `parseDeclaredDependencies(undefined)` is `{ ok: true, dependencies: [] }` `[VERIFIED: domain/dependencies.ts:180-182]`. So "cold `(remote)` plugin" is NOT a fail-closed trigger; only the three arms above are.

**The cause line must name the declarer, because the reason token is about the declarer's manifest, not X's.** The refusal row is X's (`⊘ X (failed) {not in manifest}` would misattribute without it): `cause: cannot read the dependencies of Y@mp: <detail>`. Cause text must contain only allowlisted keys and `detail` field paths (`ClosureLookupResult.unusable.detail` "carries a field path, never untrusted manifest text", `dependency-closure.ts:58-61`) -- never an absolute path (T-53-02-02).

### Pattern 3: The pure computation lives in `domain/` (dependents + fixpoint)

**What:** `domain/dependency-orphans.ts`, no I/O, on the `dependency-closure.ts` model ("The walk lives in `domain/` because it is pure: no I/O, no clock, no filesystem and no network. The catalog read arrives as a PARAMETER", `dependency-closure.ts:8-12`).

**Key derivation must match the closure walk byte for byte:** `const marketplace = args.dependency.marketplace ?? args.declaringMarketplace;` … `key: `${args.dependency.name}@${marketplace}`` `[VERIFIED: domain/dependency-closure.ts:325,343]`. A declaration's `version`/`sha` are irrelevant to "does anything declare it" -- do not drop a `sha`-pinned element the way `buildChildEdge` refuses it (`:314-322`); for the orphan test a declaration that names the key HOLDS it, whatever constraint it carries (fail-closed direction).

**Sketch (source: this research, shaped on `dependency-closure.ts`'s two-structure discipline):**

```ts
// domain/dependency-orphans.ts
export interface OrphanCandidate {
  readonly key: string;                       // `${name}@${marketplace}`
  readonly provenance: "explicit" | "dependency";
}

/** Keys of every installed record whose declaration set names `target`. */
export function findDependents(
  target: string,
  index: ReadonlyMap<string, ReadonlySet<string>>,
): readonly string[] {
  return [...index].filter(([, declares]) => declares.has(target)).map(([key]) => key).sort();
}

/**
 * D-05-01 / D-05-02: repeat until stable. Each pass removes the records that are
 * `dependency`-provenance, not yet removed, and declared by NO record still
 * present. A pass's batch is appended in sorted order; a later pass can only
 * contain records the previous batch was holding, so the accumulated order is
 * dependents-before-dependencies by construction.
 */
export function pruneOrphans(
  records: readonly OrphanCandidate[],
  index: ReadonlyMap<string, ReadonlySet<string>>,
  removed: ReadonlySet<string>,
): readonly string[] {
  const gone = new Set(removed);
  const order: string[] = [];
  for (;;) {
    const batch = records
      .filter((r) => r.provenance === "dependency" && !gone.has(r.key))
      .filter((r) => ![...index].some(([holder, declares]) => !gone.has(holder) && declares.has(r.key)))
      .map((r) => r.key)
      .sort();
    if (batch.length === 0) {
      return order;
    }
    for (const key of batch) {
      gone.add(key);
      order.push(key);
    }
  }
}
```

Bounded: each pass removes at least one key or terminates, so the loop runs at most `records.length + 1` times. Cognitive complexity of `pruneOrphans` as sketched is well under 15 but the nested `some`/`filter` may trip `sonarjs/no-nested-functions`-style rules -- extract `isHeldBy(index, gone, key)` if ESLint complains.

### Pattern 4: Extract a guard-free per-plugin removal body from the lock closure

**What:** Today the closure does `cascade(plugin, marketplace, locations, installed)` → `foldPartialCascadeFailure` → `commitPluginRemoval` → `sweepConfigLayers` inline (`uninstall.ts:749-788`). D-05-10 says reuse the per-plugin path; the CONTEXT names the `runInstallLedger` extraction as the model. The prune sweep calls that body once per orphan with `tx.state` already held.

**Hard rules for the body when called for a prune member:**

- It must NOT throw. `foldPartialCascadeFailure` RETHROWS `AgentsUnstageFailureError` (`uninstall.ts:372-374`) so the PRIMARY's save aborts and its row stays intact (TR-03). For a prune member that throw would abort the save AFTER the primary's artifacts are gone from disk → the primary's record is a ghost (NFR-3 violation). The member arm catches AG-5, keeps the member's record, and yields `(failed) {source mismatch}` at `warning` (D-05-13; `narrowCascadeFailure` already maps AG-5 → `"source mismatch"`, `:201-207`).
- It must NOT call `tx.save()`. `LockedStateTransaction.save()` throws on the second call `[VERIFIED: transaction/with-state-guard.ts:93-95 -- "save: async (): Promise<void> => { ... throw new Error(\"LockedStateTransaction.save() called more than once.\");"]`. One save, after the sweep, on the existing line.
- Config sweep for a member: a `"dependency"` record is never declared in either config file (D-04-02), so `sweepConfigLayers` is a WR-02 no-op for it; calling it is harmless but pointless. Skip it for members, or call it and let WR-02 keep the files byte-stable -- either is fine; document the choice.
- Post-commit cleanup runs OUTSIDE the lock per removed plugin: `dropCachedHooks` when hooks were dropped, then `runPostCommitCleanup({ ..., keepData: opts.keepData ?? false })` per plugin (D-05-09: the same disposition for every removed plugin). `garbageCollectPluginClones` derives live keys from the saved state (`:473-478`), so running it per plugin is idempotent; running it once after the last plugin is cheaper.

**Escape-object discipline (measured constraint):** `uninstallPluginWithTransaction` is at fallow cyclomatic 15 / cognitive 14 and ESLint cognitive 12; the ceiling is 20 / 15 / 15 `[VERIFIED: fallow health --complexity run this session: "uninstallPluginWithTransaction" cyclomatic 15, cognitive 14, line_count 274; eslint sonarjs/cognitive-complexity threshold-0 run: line 629 → 12]`. The lock closure `<arrow>` at `:710` is 6 / 5. Budget: ONE new `if (refusal)` post-guard arm and ONE `if (opts.prune)` in the closure at most; everything else -- index build, guard test, fixpoint, member loop, row assembly -- must be helpers. The 04-06 escape pattern applies: carry results out of the closure in an object (`const prune = { rows: [] as PruneRow[] }`, `const refusal = { row: undefined as PluginFailedMessage | undefined }`) because a bare `let` written inside the closure reads as its initializer to TypeScript's flow analysis at the post-guard site (04-06 SUMMARY, "A lock-closure escape that carries an object rather than a bare `let`").

### Pattern 5: The multi-block standalone report

**What:** The existing emit is one marketplace block with one row (`uninstall.ts:887-900`). With prune the array grows: the primary's block first (primary row, then any pruned rows under the same marketplace), then one block per other marketplace that lost a member. Cardinality stays `"single"` -- the install cascade set this precedent ("The cascade emits `single`, not `plural`: the user named ONE plugin, and the members are that install's transitive consequence", `docs/output-catalog.md:785`), so no tally line appears and the no-prune bytes stay frozen.

**Row shapes (all existing types):**

- Pruned success: `PluginUninstalledMessage` with `reasons: ["dependency pruned"]` or `["dependency pruned", "data kept"]` -- the type already admits `reasons?: readonly ContentReason[]` `[VERIFIED: shared/notification-types.ts:262-268 -- "export interface PluginUninstalledMessage extends TransitionMessageBase { readonly status: \"uninstalled\"; readonly name: string; readonly version?: string; readonly scope?: Scope; readonly reasons?: readonly ContentReason[]; }"]`. Reason ORDER inside the brace is array order and is contractual (`docs/output-catalog.md:65`); D-05-11 fixes it as `{dependency pruned, data kept}`. `buildUninstalledRow` (`uninstall.ts:587-601`) currently spreads `["data kept"]` only when `keepData === true`; extend it with a `pruned: boolean` input rather than adding a second builder.
- Pruned failure: `PluginFailedMessage` with `severity: "warning"` (the type admits `"error" | "warning"` `[VERIFIED: shared/notification-types.ts:351-364]`), `reasons: [narrowCascadeFailure(cause)]`, `cause`. The block severity is the numeric MAX over row severities (`notification-summary.ts:137-162`), so stamping `warning` on the member row is what makes the block compute `warning` per D-05-13; the summary sentence becomes "A plugin operation needs attention." (`summaryPhrase`, `:308-327`).
- Dependents refusal: `PluginFailedMessage` with `severity: "error"`, `reasons: ["dependents remain"]`, `cause: new Error(`required by ${dependents.join(", ")}`)`. The renderer prints `cause: <Error.message>` through `causeChainTrailer` (`shared/errors.ts:158-176`, `PREFIX = "cause: "`), so the message string IS the line after the prefix -- write exactly `required by Y@mp, Z@mp` with dependents sorted (`compareByNameThenScope`-style or plain sort; pick one and pin it).

**Render map:** `UNINSTALL_RENDER` is total over `"uninstalled" | "failed"` `[VERIFIED: orchestrators/plugin/uninstall.messaging.ts:38-41 -- "uninstalled: (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope), failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, \"(failed)\", probe),"]`. No new status arm is needed; do not add `skipped`.

**Row order is the orchestrator's:** neither `notifyWithContext` nor the grammar sorts rows or blocks (no `sort`/`compareByNameThenScope` call in `notification-dispatch.ts`, `notification-grammar.ts`, `notify-context.ts` `[VERIFIED: grep this session]`). Recommendation for the discretion item: blocks in first-appearance order along the removal sequence (primary's marketplace first), rows within a block in removal order.

### Pattern 6: The closed-set amendment, ten surfaces, one commit per member (or one for both)

The 04-06 SUMMARY measured the surfaces; every one is pinned:

| # | Surface | Today | After (two members) |
|---|---------|-------|---------------------|
| 1 | `shared/notification-types.ts` `REASONS` tail | ends `"dependency promoted",` `[VERIFIED: :107]` | append `"dependency pruned"`, `"dependents remain"` with inline notes in the register of `:100-107` |
| 2 | `shared/notify-reasons.ts` header ledger | "(53 to 54)" `[VERIFIED: :34-35]`; `54-entry` at `:9,:15` | add sentences; `56-entry` |
| 3 | `shared/notify-reasons.ts` `CommandPrivateReason` | `:250-292`, tail members `"dependency promoted"`, `"plugins remain"`, … | add both (uninstall-owned; NOT in `IDEMPOTENT_REASONS` -- a prune mutates state, a refusal is an error) |
| 4 | emitting arms | `buildUninstalledRow`, `emitCascadeFailure` in `uninstall.ts` | pruned/refusal composers in `uninstall.messaging.ts` + a `_ReasonInSet` pin as `remove.messaging.ts:36-38` does |
| 5 | `docs/output-catalog.md` `## /claude:plugin uninstall` section (`:1003`) | 6 states | +4 sections with `<!-- catalog-state: … -->` anchors: prune success, prune + keep-data, prune partial failure, dependents-remain refusal (+1 reconcile-applied state if the D-05-16 row is catalogued) |
| 6 | `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` | 6 fixtures | +4 fixtures (same keys as the anchors) |
| 7 | `catalog-contract.test.ts` `EXPECTED_STATE_COUNT = 206`, `EXPECTED_UTF8_BYTES = 27_385` `[VERIFIED: :51-52]`, title at `:341` | | bump both + ledger comment + title; take the byte lock AFTER `mdformat`/`markdownlint` hooks ran over the catalog (04-06 did this) |
| 8 | `catalog-parser.test.ts` title `:69` + assertion `:74` (`206`) `[VERIFIED]` | | bump |
| 9 | `notify-closed-set-locks.test.ts` `REASONS.length === 54` (`:68`), title `:29` `[VERIFIED]` | | 56 + ledger line |
| 10 | enumeration pins: `compat-01-no-expansion.test.ts` and `tests/shared/notification-types.test.ts` (equality over the whole tuple) | | append both members at the tail |

Commit-shape fact from 04-04/05/06: `npm-typecheck` and `npm-coverage-direct` pre-commit hooks reject a half-swept commit (the `notification-types.test.ts` enumeration pin is red until the tuple and the pin move together), so member + all ten surfaces land in ONE commit. RED evidence is a recorded run, not a commit.

Stale prose to know about, not to fix unasked: `docs/output-catalog.md:65` says "The 52-member … `REASONS` tuple" while the tuple has 54 members; the sentence is not byte-gated by count. Mention in the plan only if the section is being edited anyway.

### Pattern 7: The reconcile refusal row needs a `cause` on the outcome

**What:** `applyPluginUninstalls` maps the orchestrated `failed` arm to `{ kind: "plugin-uninstall-failed", scope, marketplace, plugin, reason: result.reason }` `[VERIFIED: orchestrators/reconcile/apply.ts:375-381]` and drops `result.error`. `PluginUninstallFailedOutcome` is `{ kind: "plugin-uninstall-failed"; reason: Reason }` plus the base `[VERIFIED: orchestrators/reconcile/apply-outcomes.ts:165-169]`. The projection's failed arm pushes `{ status: "failed", name, reasons: reasonAsContent(outcome.reason), severity: "error", needsReload: false }` with no cause `[VERIFIED: orchestrators/reconcile/notify.ts:841-851]`.

**Precedent to copy:** `InvalidBlockOutcome.cause?: Error` ("optional path-redacted diagnostic. When set, the projection surfaces it as a synthetic plugin-row cause-chain trailer", `apply-outcomes.ts:316-326`) and its render at `notify.ts:719-737`. Add `readonly cause?: Error` to `PluginUninstallFailedOutcome`, spread `...(result.error !== undefined && { cause: result.error })` in `applyPluginUninstalls`, and `...(outcome.cause !== undefined && { cause: outcome.cause })` in the failed arm -- but note the failed arm is shared by four kinds (`plugin-install-failed`, `plugin-uninstall-failed`, `plugin-enable-failed`, `plugin-disable-failed`), so either narrow on `outcome.kind === "plugin-uninstall-failed"` or give all four the optional field (the type union must admit the property on the narrowed `outcome`). The dependents cause contains only `name@marketplace` tokens, so no `redactAbsolutePaths` pass is needed, but say so in the comment. `applyPluginOutcomeToBlock` is at fallow cyclomatic 14 / cognitive 5 -- one conditional spread fits.

Without this, the reconcile row renders `⊘ X (failed) {dependents remain}` with no names, which is not "the same failed row" D-05-16 promises.

### Anti-Patterns to Avoid

- **Calling the public `uninstallPlugin` from inside the sweep:** `proper-lockfile` is `retries: 0`, non-re-entrant; nesting `withLockedStateTransaction` on the same scope self-deadlocks → `StateLockHeldError` (ARCHITECTURE.md "Lock re-entrancy"). Use the extracted body.
- **Locating a manifest with `path.join` in `uninstall.ts`:** every reader that locates `plugin.json` must be enrolled in `tests/architecture/manifest-read-agreement.test.ts` ("The list is deliberately open: a reader added later is added here too"). Routing through `readDependencyDeclaration` adds no reader.
- **Importing `install-flow.ts` (for `lookupCascadeDependencies`) from `uninstall.ts`:** both are `PLUGIN_LEDGER_TARGETS` `[VERIFIED: tests/architecture/gate-targets.ts:275-281]`; the D-11 gate forbids a ledger importing a ledger in either direction, `import type` included. Extract the index builder into a leaf both may import.
- **A second `tx.save()`:** throws (Pattern 4).
- **Exporting a helper "for tests" from a production module:** `UNOWNED_EXPORT_CENSUS` is an exact-equality pin re-measured with `fallow dead-code --production --unused-exports`; an export only tests read fails `unowned-exports-census.test.ts` until the census row is added in the same commit (`tests/architecture/unowned-exports-census.test.ts:4-16`). Prefer injecting through `UninstallTransaction`.
- **Adding `{dependency pruned}` / `{dependents remain}` rows to the failure TABLE in `docs/dependency-resolution.md`:** `dependency-doc-agreement.test.ts` parses `| `{token}` |` rows under `## Why a dependency can fail` and asserts set-equality with what the CASCADE composers stamp `[VERIFIED: tests/architecture/dependency-doc-agreement.test.ts:186-197]`. New prose goes in NEW sections (e.g. `## Removing a plugin other plugins need`, `## Pruning dependencies nothing needs`).
- **Making the guard skip when the target is `"dependency"`-provenance or when `--prune` is absent:** PRUNE-05 is unconditional and runs on both entry points.
- **`Phase 5` / `Pitfall N` in comments or test titles:** `.claude/rules/typescript-comments.md`; anchor on `D-05-NN` / `PRUNE-NN` / `FLAG-01`. (`PRUNE-NN` has no homonym in the codebase, unlike `PROV-NN`; `grep -rn "PRUNE-0" extensions tests docs` is empty apart from BACKLOG `PRUNE-CMD-01` `[VERIFIED: grep this session]`.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "What does plugin R declare?" | A `JSON.parse` of `plugin.json` in `uninstall.ts` | `readDependencyDeclaration({ marketplaceRoot, entry, locations })` (`dependency-declaration-read.ts:256`) | Owns the D-01-32 read order, the fs-only clone probe (NFR-5), containment (NFR-10), the present-but-unusable rule, and is enrolled in the read-agreement gate. |
| Finding R's entry | `manifest.plugins.find(...)` | `lookupDeclaredPlugin(manifest, name)` (`domain/manifest-lookup.ts:54`) | "the ONE place it is written"; exact string identity. |
| Loading `marketplace.json` | `readFile` + `JSON.parse` | `loadMarketplaceManifest(mp.manifestPath)` (`domain/manifest.ts:139`) | Memoized PI-2 read, typed `InvalidMarketplaceManifestError`, negative-cached. |
| Classifying a manifest read throw | `err.code` switch | `narrowProbeError(err)` (`shared/probe-classifiers.ts:37`) | Same tokens the read-only surfaces and reconcile already use for the same on-disk condition. |
| Classifying a member's cascade failure | new mapping | `narrowCascadeFailure(cause)` (`uninstall.ts:196`) | Already maps AG-5 → `source mismatch`, EACCES → `permission denied`, ENOENT → `source missing`. |
| Parsing a declaration element | regex in the sweep | `parseDeclaredDependencies` (already inside the reader) | Allowlists every field (D-01-25/33); a bad element rejects the whole declaration. |
| The cause trailer | string concatenation into the row | `PluginFailedMessage.cause: Error` | `causeChainTrailer` renders `cause: <message>`; the message is the contract. |
| The flag name at the mapping site | `"--prune"` literal | exported `PRUNE_FLAG` | WR-01: a literal fails OPEN on a catalog rename. |
| Block severity | asserting `"warning"` on the block | stamp row severities; the reducer computes the max | notify is a dumb renderer (SEV-02). |

**Key insight:** every input the sweep needs is already produced by a module with its own tests and gates; the phase's only new logic is a set-difference iterated to a fixpoint, and that belongs in `domain/` where it can be tested against a synthetic graph in milliseconds.

## Common Pitfalls

### Pitfall 1: The guard changes the precondition of EVERY uninstall, and existing fixtures assume no manifest is read
**What goes wrong:** `seedFullPlugin` writes a record whose `manifestPath` "never exists" and its comment says "Uninstall reads no manifest and no resolver -- the installation record alone drives the cascade" `[VERIFIED: tests/orchestrators/plugin/uninstall.test.ts:302-310]`. With a single record that is still true (no OTHER record → nothing to read). But `seedGitPlugin(locations, "mp", { alpha: "keyShared", beta: "keyShared" }, cwd)` (`:2568`, the shared-clone case) seeds TWO records under a non-existent `marketplace.json`; after the guard, uninstalling `alpha` fails closed on `beta` (`source missing` from `narrowProbeError` on ENOENT) and the test's `(uninstalled)` assertions go red. Any other suite that uninstalls with a sibling record and no readable manifest (integration `transaction-lifecycle-cascade`, edge handler suites that seed two records in ONE scope, reconcile `apply.test.ts` cases using `writeMarketplaceSource` are fine because they write a real manifest with entries) is exposed the same way.
**Why it happens:** D-05-07 + D-05-14 make "every other record's declarations are readable" a precondition of a successful uninstall.
**How to avoid:** Plan a fixture task FIRST: a helper that writes `<marketplaceRoot>/.claude-plugin/marketplace.json` `{ name, plugins: [{ name, source: "./plugins/<name>", dependencies? }] }` (the minimal valid shape, `domain/manifest.ts:28-33`, as `apply.test.ts:370-397` does) and, for declaring fixtures, the SAME declaration in `<root>/plugins/<name>/.claude-plugin/plugin.json` (D-03-25: an entry-only declaration is suppressed by a readable own manifest that declares nothing). Then run `node --test tests/orchestrators/plugin/uninstall.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts tests/integration/transaction-lifecycle-cascade.test.ts` after wiring the guard and fix every red fixture by adding a manifest, never by weakening the guard.
**Warning signs:** a formerly-green uninstall test now reports `{source missing}` or `{not in manifest}`.

### Pitfall 2: Two stale records in one scope block each other's uninstall forever
**What goes wrong:** A record whose marketplace manifest no longer lists it (the `not in manifest` inventory state, ENBL-16) is an unreadable declarer. With ONE such record Z, `uninstall Z` still works (the guard reads the OTHERS). With TWO (Z1, Z2), neither can be uninstalled: each refuses on the other. Reconcile uninstalls in that scope refuse the same way on every reload. The only exits are `marketplace remove` (which unstages through `cascadeUnstagePlugin` directly, not through `uninstallPlugin` -- `apply.ts:242-295` -- and therefore carries no guard) or a hand edit of `state.json`.
**Why it happens:** D-05-07's fail-closed rule applied to the guard, which runs unconditionally.
**How to avoid:** This is the locked decision's consequence, not a defect; the plan must (a) state it in `docs/dependency-resolution.md` beside the remedy (`marketplace remove`, or restore the manifest / `marketplace update`), (b) carry it into `05-UAT.md`, and (c) name it to the operator as the cost of D-05-07 -- the CONTEXT rates that decision "reversible … a one-line predicate change", and this is the scenario that would trigger the reversal. See Open Question 2.
**Warning signs:** `(failed) {not in manifest}` with a cause naming a plugin the user did not type.

### Pitfall 3: A throw after the primary cascade makes a ghost record
**What goes wrong:** the primary's `cascadeUnstagePlugin` already removed skills/commands/agents/mcp from disk; if the prune sweep then throws (AG-5 rethrow, an unexpected error in a member's cascade), `withLockedStateTransaction` does not save (ST-7 "save only on no-throw") and `state.json` still claims the artifacts.
**Why it happens:** the existing TR-03 split rethrows `AgentsUnstageFailureError` by design for the PRIMARY (`uninstall.ts:364-378`).
**How to avoid:** the member removal body is total: every failure becomes a `warning` row and the loop continues; `tx.save()` runs exactly once after the loop. A unit test injects an AG-5-throwing cascade for the SECOND member and asserts the primary and first member are gone from `state.json`, the second member's record is intact, and the block is `warning`.
**Warning signs:** a test that asserts `state.json` unchanged after a prune-member failure -- that is the wrong invariant.

### Pitfall 4: Complexity ceilings with one point of headroom
**What goes wrong:** `uninstallPluginWithTransaction` is at fallow cognitive 14 (ceiling 15); one `if` for the refusal and one for the prune report exceeds it. `applyReconcileWithReader` is at ESLint 15 exactly -- do not touch its branching. `diffMarketplaces` 14 / `buildUninstallBucket` 13 in `plan.ts` -- this phase should not touch `plan.ts` at all (reconcile never prunes; the guard lives in `uninstall.ts`).
**How to avoid:** one post-guard dispatch `if (refusal.row !== undefined) return emitRefusal(...)`; fold the prune rows into the SAME success emit (`plugins: [uninstalledRow, ...prune.rows]` grouped by marketplace by a helper); measure with the two commands in Standard Stack after each task.
**Warning signs:** `fallow health` "above threshold" or `sonarjs/cognitive-complexity` on `uninstall.ts:629`.

### Pitfall 5: The `--prune` rejection tests and the usage-line pins
**What goes wrong:** `tests/edge/handlers/plugin/uninstall.test.ts:673-702` asserts `Unknown flag: "--prune"`; `USAGE_BLOCK` there and in `tests/edge/router.test.ts` embed the current usage line. Flipping the catalog turns those red; forgetting `router.ts:95` turns the drift guard's help-text reconciliation red (`documented` must appear as `[--prune]`).
**How to avoid:** the FLAG-01 task lists all five surfaces in Pattern 1 and the two suites; keep `tests/edge/handlers/shared.test.ts:344,365` untouched (they test the ENABLE consuming list where `--prune` is legitimately unknown).

### Pitfall 6: WebFetch summaries of upstream docs are not the docs
**What goes wrong:** this session's `WebFetch` of `plugins-reference.md` returned an uninstall option table WITHOUT `--prune` and a "Behavior regarding dependencies" paragraph that does not exist in the source; the raw `curl` copy shows `--prune` and `-y, --yes` rows at `:1081-1082`.
**How to avoid:** cite only the `curl`-retrieved text (Sources below); the planner should not re-derive parity from a summarizer.

### Pitfall 7: `catalog-parser` and the byte lock are taken after the markdown hooks
**What goes wrong:** `EXPECTED_UTF8_BYTES` is the catalog file's size; `mdformat`/`markdownlint-cli2` in pre-commit may reflow the new sections.
**How to avoid:** run `SKIP=trufflehog pre-commit run --files docs/output-catalog.md` BEFORE reading the size into the constant (04-06 did exactly this; +92 bytes held).

### Pitfall 8: Provenance residue on the operator's tree (UAT, not code)
Records Phase 3 wrote on dev trees were back-filled `"explicit"` (D-04-03); `--prune` correctly declines them. Remedy: uninstall and reinstall those plugins. Put it in `05-UAT.md` verbatim (CONTEXT "Dev-tree residue").

## Code Examples

Verified patterns from the repository (opened this session):

### The option seam the flag joins
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:140-141
  /** Preserves plugin data after uninstall; omission or false removes it. */
  readonly keepData?: boolean;
```
Add beside it: `/** D-05-10: also removes dependency-installed plugins no remaining plugin declares; omission is "no prune" (reconcile never sets it, D-05-08). */ readonly prune?: boolean;`

### The catalog-owned flag name and its mapping (template for `PRUNE_FLAG`)
```ts
// Source: extensions/pi-claude-marketplace/edge/flag-catalog.ts:79-84, 190
const KEEP_DATA_FLAG_ENTRY: FlagEntry = {
  name: "--keep-data",
  description: "Preserve the plugin's persistent data directory",
  parse: true,
  complete: true,
};
...
export const KEEP_DATA_FLAG = KEEP_DATA_FLAG_ENTRY.name;

// Source: extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts:58
      ...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true }),
```

### The cause-line precedent (names ride the cause, never the token)
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:241-249
    case "cycle":
      return {
        key: failure.chain.at(-1) ?? rootKey,
        reasons: ["dependency cycle"],
        cause: new Error(`Dependency cycle: ${failure.chain.join(" -> ")}.`),
      };
```
For D-05-15: `reasons: ["dependents remain"], cause: new Error(`required by ${dependents.join(", ")}`)` renders `    cause: required by Y@mp, Z@mp`.

### The command-private reason pin (template for the two new members)
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts:34-38
type _ReasonInSet<R extends Reason> = R;
// fallow-ignore-next-line private-type-leak -- `_ReasonInSet` is the compile-time membership guard; exporting that helper would widen the command's public reason vocabulary.
export type RemovePrivateReason = _ReasonInSet<"plugins remain">;
```

### The offline declaration read the index builder composes
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:496-506 (private today; the leaf must re-express it over tx.state)
  const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, subject.name);
  if (declared.kind === "absent") {
    return { kind: "absent" };
  }

  return readDependencyDeclaration({
    marketplaceRoot: source.sourceRecord.marketplaceRoot,
    entry: declared.entry,
    locations: core.locations,
  });
```
In the uninstall leaf, `source.sourceRecord` is simply `tx.state.marketplaces[mpName]` (Pattern 2), and the `absent` / `unusable` / throw arms map to the tokens in Pattern 2's table.

### The multi-block emit (existing single-block form to extend)
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:886-901
  const uninstalledRow = buildUninstalledRow(plugin, removedVersion, opts.keepData);
  notifyWithContext(
    ctx,
    pi,
    UNINSTALL_CONTEXT,
    [
      {
        name: marketplace,
        scope,
        plugins: [uninstalledRow],
      },
    ],
    undefined,
    "single",
  );
```

### The reconcile outcome that needs a `cause` (precedent)
```ts
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:165-169, 316-326 (InvalidBlockOutcome.cause)
export interface PluginUninstallFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-uninstall-failed";
  readonly reason: Reason;
}
...
  readonly cause?: Error;   // on InvalidBlockOutcome: "optional path-redacted diagnostic ... surfaces it as a synthetic plugin-row cause-chain trailer"
```

### Test seeding shape that satisfies the guard (minimal valid marketplace.json)
```ts
// Source: tests/orchestrators/reconcile/apply.test.ts:382-394
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: Object.entries(trees).map(([plugin, tree]) => ({
        name: plugin,
        version: "1.0.0",
        source: `./plugins/${plugin}`,
        ...
      })),
    }),
  );
```
Add `dependencies: [...]` to an entry AND to that plugin's own `.claude-plugin/plugin.json` when the fixture is about a declaration (D-03-25).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Uninstall handler hard-rejects unknown flags inline (ROADMAP note) | Handler consumes `passThroughFlagNames("uninstall")`; catalog is SSOT | Phase 2 (D-02-02 / D-02-05) | FLAG-01 is a catalog entry + pins, not a parser change. |
| Cascade wrote dependencies into `claude-plugins.json` (Phase 3 CR-01 fix) | `provenance: "dependency"` on the record; config names only explicit plugins | Phase 4 (D-04-02, D-04-05) | The orphan candidate set is `provenance === "dependency"`; reconcile keeps them (D-04-05), only `--prune` removes them. |
| Reason set 53 members | 54 (`dependency promoted` at the tail) | 04-06, commit `bb300d96` | This phase appends at index 54 and 55; every count-bearing title moves. |
| Nine pinning surfaces for a closed-set member | Ten (`catalog-parser.test.ts` tuple count) | 04-06 | Enumerated in Pattern 6. |
| Upstream `plugin uninstall` flags: `--keep-data` only (v1.x docs) | `--keep-data`, `--prune`, `-y/--yes`, `--json` | upstream docs retrieved 2026-09-16 | FLAG-01 adopts `--prune` only; `-y`/`--json` remain out of scope. |

**Deprecated/outdated:**
- ROADMAP § Phase 5 "Notes" first sentence (handler hard-rejects inline) -- superseded by Phase 2; the second sentence (reconcile takes the default) is settled by D-05-08.
- `tests/orchestrators/plugin/uninstall.test.ts:306-310` LIFE-04 comment ("Uninstall reads no manifest") -- becomes false the moment a second record exists; reword when the fixture grows a manifest.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Only the `seedGitPlugin` shared-clone case (`uninstall.test.ts:2568`) among the uninstall owner's 60 tests seeds two records without a manifest; other suites (edge handler `seedBothScopes`, integration lifecycle) seed at most one record per scope or write real manifests. Not exhaustively measured -- inferred from `makePluginRecord` counts per test and the helpers read. | Pitfall 1 | More fixtures go red than planned; the fix is the same (write a manifest), only the task's file list grows. Measure by running the four suites after wiring the guard. |
| A2 | Upstream Claude Code does not refuse `plugin uninstall` of a plugin another installed plugin requires (only `disable` is documented as refusing). Based on the absence of such a statement in the two retrieved pages; absence is not evidence. | Summary, Pattern 5 docs prose | The docs' "divergence" wording would overstate; phrase as "upstream documents the refusal for `disable`; this extension applies it to `uninstall`" rather than asserting upstream permits it. |
| A3 | A `sha`-pinned declaration element should count as HOLDING its dependency for the orphan test (the closure walk refuses it at install). | Pattern 3 | If the operator prefers "unusable declaration = fail closed" for the whole index instead, the `sha` element already parses fine through `parseDeclaredDependencies` (only the walk refuses it), so no arm changes -- the difference is documentation only. |
| A4 | The ESLint/fallow scores measured today hold at plan time (no intervening commits on `features/manifest` touching `uninstall.ts`, `apply.ts`, `notify.ts`). | Pitfall 4 | Re-run the two measurement commands at the start of the first task. |

## Open Questions

1. **What does the unreadable-declarer refusal row look like on X?**
   - What we know: the token comes from the declarer's read failure (`not in manifest` / `invalid manifest` / `narrowProbeError`), and D-05-07 says report "on that plugin's row"; but through the guard the row that exists is X's `(failed)` row, and there is no operation on the declarer to fail.
   - What's unclear: whether the operator wants X's row to carry the declarer's reason with a cause naming the declarer (recommended, no new token), or a second synthetic row for the declarer.
   - Recommendation: X's row, `{<declarer's token>}`, `cause: cannot read the dependencies of Y@mp: <detail>`; catalog one state for it (`refused-declarer-unreadable`) so the bytes are pinned. Also note that with the index built once, D-05-07's "prune removes nothing, primary stands" arm is unreachable from either entry point -- the plan should not write a test for it (the direct-coverage gate would reject the dead arm), and the CONTEXT's D-05-07 text should be read through D-05-14's "the uninstall is refused".

2. **Two stale records block each other (Pitfall 2) -- accept, or carve an exception?**
   - What we know: D-05-07 is rated reversible; the trap needs two records that are simultaneously absent from their manifests in ONE scope; `marketplace remove` is an exit.
   - Recommendation: accept for this phase, document the remedy in `docs/dependency-resolution.md`, and raise it in the plan's checkpoint so the operator decides with the scenario in view rather than discovering it in UAT.

3. **Should the D-05-16 reconcile refusal get its own catalog state under `reconcile-applied`?**
   - What we know: reconcile rows render through `RECONCILE_APPLIED_FIXTURES`; the row is `⊘ X (failed) {dependents remain}` + cause under the reconcile summary; it fires on every reload until fixed.
   - Recommendation: yes -- it is the only surface where a user meets the refusal without having typed the command; one fixture + one section (+1 to the state count).

4. **Block/row order for the standalone prune report (discretion).**
   - Recommendation in Pattern 5: primary's marketplace block first, blocks thereafter in first-appearance order along the removal sequence, rows in removal order (dependents before dependencies). Pin it with a three-marketplace fixture.

5. **Does `marketplace remove` need the dependents guard?**
   - What we know: it unstages every plugin under the marketplace through `cascadeUnstagePlugin` directly (`apply.ts:242-295`, `orchestrators/marketplace/remove.ts`), bypassing `uninstallPlugin`, so a plugin in another marketplace that depends on one of them is left dangling.
   - Recommendation: out of scope (PRUNE-05 names `uninstall`); record as a BACKLOG entry in the plan's deferred list so it is a decision, not an omission.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests, native TS strip | ✓ | v26.8.2 (CI: 24) | -- |
| npm | `npm run check` chain | ✓ | 11.19.1 | -- |
| `node_modules/.bin/{fallow,eslint,prettier,tsc}` | `npm run check` | ✓ | fallow ^3.17.0, eslint ^10.4.0 | -- |
| `pre-commit` | executor runs hooks by hand | ✓ | 4.5.1 | -- (no hook is installed in `.git/hooks`; run `SKIP=trufflehog pre-commit run --files …` explicitly; this is a linked worktree so trufflehog needs the filesystem route) |
| `.claude/gsd-core/bin/gsd-tools.cjs` | commits of planning docs | ✓ | in-repo | -- |
| Network | none (no package install; upstream docs already retrieved) | n/a | -- | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 26 local / 24 CI), `node:assert/strict` |
| Config file | none (npm scripts in `package.json:86-96`) |
| Quick run command | `node --test tests/orchestrators/plugin/uninstall.test.ts` (add `--test-name-pattern "D-05-"` for the new cases) |
| Full suite command | `npm run check` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding(+negative), test:coverage:direct:negative, test, test:integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRUNE-01 | `--prune` removes orphaned `"dependency"` records, transitively (fixpoint D1→D2) | unit (owner) | `node --test --test-name-pattern "D-05-01\|D-05-02" tests/orchestrators/plugin/uninstall.test.ts` | ✅ suite exists; cases ❌ Wave 0 |
| PRUNE-01 | fixpoint math on a synthetic graph incl. diamond and cyclic island | unit (domain) | `node --test tests/domain/dependency-orphans.test.ts` | ❌ Wave 0 (new pair) |
| PRUNE-02 | explicit record declared by another plugin survives `--prune`; a promoted record survives | unit (owner) | same owner suite, `D-05-01` / PRUNE-02 titles | ❌ Wave 0 |
| PRUNE-03 | a dependency still declared by a DISABLED record survives; same-scope only (other-scope declarer not consulted) | unit (owner) | same | ❌ Wave 0 |
| PRUNE-04 | pruned rows `{dependency pruned}` / `{dependency pruned, data kept}`, `warning` on member failure, nothing extra when nothing qualifies | unit (messaging + owner) + catalog | `node --test tests/orchestrators/plugin/uninstall.messaging.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ suites; fixtures ❌ Wave 0 |
| PRUNE-05 | refusal with `{dependents remain}` + `cause: required by Y@mp, Z@mp`; disabled declarer holds; unreadable declarer refuses; nothing removed (whole-footprint check incl. data dirs) | unit (owner) | owner suite, `D-05-14` / `D-05-15` titles | ❌ Wave 0 |
| PRUNE-05 (reconcile) | `applyPluginUninstalls` reports the same failed row with cause on every pass; converges once config is fixed | unit (reconcile) | `node --test tests/orchestrators/reconcile/apply.test.ts tests/orchestrators/reconcile/notify.test.ts` | ✅ suites; cases ❌ Wave 0 |
| PRUNE-05 (index) | declaration index arms: found / absent → `not in manifest` / unusable → `invalid manifest` / throw → `narrowProbeError` | unit (leaf) | `node --test tests/orchestrators/plugin/dependency-index.test.ts` | ❌ Wave 0 (new pair) |
| D-05-08 | reconcile never sets `prune`; an orphaned dependency survives a reconcile pass | unit (reconcile) | `apply.test.ts` (existing D-04-05 reload-survival case is the control) | ✅ existing control; add the explicit "no prune option forwarded" assertion |
| FLAG-01 | catalog parse-set, completions, usage line, handler mapping, rejection of `-y`/`--yes`/`--delete-data` unchanged | architecture + edge | `node --test tests/architecture/flag-catalog-drift.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/router.test.ts` | ✅ suites; pins ❌ must move |
| closed set | ten surfaces moved; omission plant fires | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/shared/notification-types.test.ts` | ✅ |
| NFR-3 ghost-record guard | AG-5 on prune member #2: primary + member #1 gone from state, member #2 intact, block `warning` | unit (owner) | owner suite | ❌ Wave 0 |
| NFR-5 | `uninstall.ts` still names no git surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (consider adding `uninstall.ts` to `NETWORK_FREE_TARGETS` now that it reads manifests -- `gate-targets.ts` "implicitly clean" note at `:37`) |

### Sampling Rate
- **Per task commit:** the owner suite + the architecture suites named in that task (each < 30 s), then `npm run test:coverage:direct:commit` (the pre-commit hook's script) and `SKIP=trufflehog pre-commit run --files <paths>`.
- **Per wave merge:** `npm run check` (≈ 5 min per 04-06).
- **Phase gate:** `npm run check` exit 0 + `SKIP=trufflehog pre-commit run --all-files` exit 0 before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/domain/dependency-orphans.test.ts` -- pairs the new pure module (PRUNE-01..03 math; cyclic-island residue documented as a case).
- [ ] `tests/orchestrators/plugin/dependency-index.test.ts` -- pairs the new leaf (four arms; injected `DependencyDeclarationReader` seam already exists on `readDependencyDeclaration`).
- [ ] A manifest-writing seed helper in `tests/orchestrators/plugin/uninstall.test.ts` (or a shared `tests/orchestrators/plugin/prune-seed.ts` -- note `*-fake.ts` naming rules in `check-corresponding-tests.mjs:38-49` apply only to `domain|platform`) that writes `marketplace.json` + per-plugin `plugin.json` with declarations on both sides and records with chosen `provenance`.
- [ ] Fixtures in `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` (+ `reconcile-applied.ts` if Open Question 3 is yes).
- [ ] Framework install: none.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- (no network, no credentials touched; the tag probe is not on this path) |
| V3 Session Management | no | -- |
| V4 Access Control | yes | NFR-10 containment: every path the sweep touches is derived by `ScopedLocations` getters (`pluginDataDir`, `pluginCacheFile`) and `readDependencyDeclaration`'s `assertPathInside`; `uninstall.ts` must not join paths itself. |
| V5 Input Validation | yes | `parseDeclaredDependencies` allowlists every rendered field (D-01-25/33); the manifest schema is typebox-validated in `loadMarketplaceManifest`; the cause line is assembled from allowlisted keys only. |
| V6 Cryptography | no | -- |
| V7 Error handling / logging | yes | No absolute path on any row (T-53-02-02 / T-55-02-01): the `unusable.detail` is a field path; `narrowProbeError` tokens carry no path; the declarer key is a token. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A crafted `dependencies` array in a third-party plugin's manifest makes the sweep keep (never remove) or refuse -- e.g. a plugin declaring every installed key to pin itself and its siblings | Denial of service (of `uninstall`) | Fail-closed is the intended direction (a declaration can only HOLD, never cause removal); the user's remedy is `uninstall <declarer>`; document. Row text is allowlisted so the manifest cannot forge a row. |
| A manifest that lists the target under a different marketplace name to dodge the guard | Tampering | Keys are exact `${name}@${marketplace}` strings with the RESV-02 fill rule; a mismatch means "not a declarer", which errs toward refusing nothing extra but also protects nothing extra -- the guard is best-effort against a hostile declarer that WANTS its dependency removed, which is upstream's model too. |
| TOCTOU between reading declarations and removing records | Race | Index is built INSIDE `withLockedStateTransaction`; the state snapshot and the removal happen under the same cross-process lock; manifests are read once. |
| Ghost record after a mid-sweep throw | Repudiation of on-disk truth (NFR-3) | Member removal body is total; single save after the loop (Pitfall 3). |
| Oversized `dependencies` array or deeply nested manifest | DoS | `parseDeclaredDependencies` is linear over a JSON array; `readManifestCandidate` stats before reading (device node / FIFO guard); no new parser. |
| Path disclosure through the cause line | Information disclosure | Cause carries keys and field paths only; `redactAbsolutePaths` not needed but the comment must say why (reviewers grep for it). |

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (whole file) -- option seam, transaction shape, TR-03 fold, `narrowCascadeFailure`, emit sites.
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` (whole file) -- read order, fs-only contract, `NOT_READABLE` → entry fallback.
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts:1-130, 280-459` -- key fill rule, two-structure walk, lookup result union.
- `extensions/pi-claude-marketplace/domain/dependencies.ts` (whole) -- `DeclaredDependency`, `parseDeclaredDependencies(undefined)`.
- `extensions/pi-claude-marketplace/edge/flag-catalog.ts`, `edge/handlers/plugin/uninstall.ts`, `edge/router.ts:92-95`, `tests/architecture/flag-catalog-drift.test.ts` (whole).
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{apply.ts:335-390, apply-outcomes.ts:150-330, notify.ts:700-937, plan.ts:240-575}`.
- `extensions/pi-claude-marketplace/shared/{notification-types.ts:1-140,262-268,340-400, notify-reasons.ts:1-80,230-309, probe-classifiers.ts:37-66, errors.ts:158-198, notification-summary.ts:296-330, notify-context.ts:60-110}`.
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts:1-95`; `persistence/state-io.ts:75-142,276-311`; `orchestrators/plugin/install-outcome.ts:355-400`; `orchestrators/plugin/shared.ts:380-470`; `orchestrators/plugin/install-flow.ts:440-520`; `orchestrators/plugin/install-cascade.messaging.ts:225-300`; `orchestrators/plugin/install.messaging.ts:323-372`; `orchestrators/marketplace/remove.messaging.ts` (whole).
- `tests/architecture/{gate-targets.ts:270-315,565-690, no-orchestrator-network.test.ts, unowned-exports-census.test.ts:1-60, dependency-doc-agreement.test.ts, manifest-read-agreement.test.ts:1-40, catalog-uat/catalog-contract.test.ts:40-60,341-352, catalog-uat/catalog-parser.test.ts:69-74, notify-closed-set-locks.test.ts:29,68, catalog-uat/fixtures/plugin-uninstall.ts}`; `tests/orchestrators/plugin/uninstall.test.ts:1-330,2404-2470,2568`; `tests/orchestrators/plugin/install-flow.test.ts:483-680`; `tests/orchestrators/reconcile/apply.test.ts:370-400`; `tests/edge/handlers/plugin/uninstall.test.ts:655-729`; `tests/edge/handlers/shared.test.ts:335-380`; `scripts/check-corresponding-tests.mjs:1-50`.
- `docs/output-catalog.md:61-71,779-830,1003-1100`; `docs/dependency-resolution.md:100-162`; `docs/plugin-enablement.md:34-63`; `.claude/rules/typescript-comments.md`.
- Measurements run this session: `fallow health --complexity --max-cyclomatic 1 --max-cognitive 1 --format json`; `npx eslint --no-inline-config --rule '{"sonarjs/cognitive-complexity": ["error", 0]}' --format json`; `node --version`, `npm --version`, `pre-commit --version`; `grep -rn "\-\-prune"`, `grep -c 'catalog-state:'` (211), `wc -c docs/output-catalog.md` (258307 -- the file, not the locked subset).
- Planning artifacts: `05-CONTEXT.md`, `04-CONTEXT.md`, `04-06-SUMMARY.md`, `04-PATTERNS.md:255-350`, `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md § Phase 5`, `.planning/config.json`.

### Secondary (MEDIUM confidence -- official upstream docs, raw markdown via `curl`, 2026-09-16)
- `[CITED: https://code.claude.com/docs/en/plugins-reference.md]` lines 1063-1115 of the retrieved copy: `plugin uninstall` options `-s, --scope`, `--keep-data`, `--prune` ("Also remove auto-installed dependencies that no other plugin requires"), `-y, --yes` ("Skip the `--prune` confirmation prompt. Required when stdin or stdout is not a TTY"), `--json`; `plugin prune` "Remove auto-installed plugin dependencies that are no longer required by any installed plugin. … plugins you installed directly are never touched."; alias `autoremove`; `--dry-run`, `-y`.
- `[CITED: https://code.claude.com/docs/en/plugin-dependencies.md]` lines 195-217 of the retrieved copy: "secrets-vault is still required by deploy-kit. Disable that plugin first, or disable everything together: …" (the DISABLE refusal); "Auto-installed dependencies stay on disk after the plugins that installed them are uninstalled, in case you reinstall a dependent plugin …"; "After removing the named plugin, Claude Code scans for and removes any auto-installed dependencies that are now orphaned. Plugins you installed yourself are never pruned, only those installed automatically through another plugin's `dependencies` array."

### Tertiary (LOW confidence)
- `WebFetch` summaries of the same two pages -- discarded where they contradicted the raw text (Pitfall 6). No other web source was used; the `research-plan` seam was not invoked because no library/API question arose (no package is added).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- nothing is added; every module named was opened.
- Architecture: HIGH for the mechanics (lock, save-once, complexity numbers, gates), MEDIUM for the recommended module split (`domain/dependency-orphans.ts` + `orchestrators/plugin/dependency-index.ts` is a recommendation, not a locked decision).
- Pitfalls: HIGH for 1, 3, 4, 5, 7 (each rests on a line read this session); MEDIUM for 2 (a consequence derived from the locked rules, not yet observed).

**Research date:** 2026-09-16
**Valid until:** 2026-10-16 for the in-repo facts (or until the next commit touching `uninstall.ts`, `notification-types.ts`, `flag-catalog.ts`, or the catalog pins); upstream flag table re-check at the next `analyze-upstream-releases` pass.
