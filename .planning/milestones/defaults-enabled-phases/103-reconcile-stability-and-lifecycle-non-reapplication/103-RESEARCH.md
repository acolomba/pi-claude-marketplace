# Phase 103: Reconcile stability and lifecycle non-reapplication - Research

**Researched:** 2026-08-15
**Domain:** In-repo characterization and regression-pinning of the reconcile planner's fixed point and the lifecycle verbs' enablement behavior
**Confidence:** HIGH — every load-bearing claim below was re-verified by opening the source this session, and the four success criteria were additionally executed end to end against the real orchestrators (see `## Empirical Probes`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### The install verb (carried forward from Phase 102)

- **D-103-01: the install-disabled verdict is NOT widened.** It keeps firing
  only on `declaredEnabled === undefined`. The alternative — also firing on
  `declaredEnabled === false`, so an explicit config value wins in both
  directions at the install boundary — is rejected because it breaks DFEN-08.
  DFEN-08 requires that `defaultEnabled: true` and an absent `defaultEnabled`
  produce byte-identical behavior and output to today across install, update,
  reinstall, list, info and reconcile. Widening changes `install` for plugins
  whose manifest never mentions the field at all (config `enabled: false` plus
  no `defaultEnabled` would begin installing disabled), and gating the widening
  on the manifest declaring the field does not help — `defaultEnabled: true`
  plus config `enabled: false` would change too. There is no form of the
  widening that leaves DFEN-08 intact.

- **D-103-02: Phase 102's success-criterion 3 gloss is amended, not left
  standing.** Its illustrative clause — "a user who wrote `enabled: false` for a
  `defaultEnabled: true` plugin stays disabled" — is reworded in `ROADMAP.md` to
  match DFEN-05's normative text, which is that an existing `enabled` value wins
  over `defaultEnabled` and is never overwritten. That normative requirement
  holds today in both directions and across both physical config files. The
  override recorded in `102-VERIFICATION.md` stays as the audit trail for why
  the wording changed.

- **D-103-03: today's behavior is pinned by a regression test**, so the decision
  above cannot drift into an accident. Installing over a config entry that
  already says `enabled: false` materializes the plugin, leaves the entry
  byte-identical, and the next reconcile pass converges the record to disabled.
  The test's own comment must say that this is a DFEN-08-driven choice, so a
  later reader does not "fix" it toward symmetry.

#### Proving the DFEN-06 fixed point

- **D-103-04: both seams are asserted, planner-level AND end-to-end.** The
  roadmap mandates the planner assertion — "verified against the reconcile
  planner's own output (`orchestrators/reconcile/plan.ts`), not merely asserted
  at the install boundary" — and the fixed point itself needs real passes,
  because a plan that is empty while the apply path still mutates something
  would satisfy the planner assertion and still oscillate.

- **D-103-05: three reload passes.** Criterion 2 names the second and the third
  explicitly. Two passes prove only that the first pass was not special.

- **D-103-06: every bucket is asserted empty for the plugin, not just
  `acc.enable`.** `acc.enable.push(...)` is the specific hazard the milestone
  names, but a stray `uninstall`, `disable`, or re-`install` for the same plugin
  would be just as wrong and just as silent. Assert the plugin's absence from
  all seven action buckets.

- **D-103-07: the local-declared case is covered alongside the base-declared
  one.** Phase 102's stamp is targeted at the physical file the declaration
  lives in, so a mis-target does not show up as a bad write — it shows up here,
  as a non-fixed point, because the merged view still reads the key as absent
  and the planner keeps planning. This is the assertion that can distinguish a
  correct stamp from a silently ineffective one at this seam.

#### Pinning DFEN-07, which is already true

- **D-103-08: both a behavioral test and an architectural grep gate.** The
  behavioral test proves the guarantee a user cares about; the gate catches the
  regression at its source, before it can reach a behavior. This mirrors the
  house pattern already in the tree — `tests/architecture/no-orchestrator-network.test.ts`
  greps orchestrator sources for forbidden tokens rather than waiting for a
  network call to appear in a test.

- **D-103-09: the gate names the two tokens.** `orchestrators/plugin/update.ts`
  and `orchestrators/plugin/reinstall.ts` must not reference `defaultEnabled` or
  `applyDefaultEnabled`. A looser rule about "enablement reads in the lifecycle
  verbs" was considered and rejected: it is harder to express as a grep and
  prone to false positives on unrelated identifiers. Both files legitimately
  call `resolveStrict`, which RETURNS the field — the gate is about reading it,
  so it must not forbid the resolver call itself.

- **D-103-10: the manifest is flipped between install and update.** Installing
  and updating against the same manifest cannot distinguish "never re-read the
  field" from "re-read it and got the same answer". Install with
  `defaultEnabled: false`, rewrite the marketplace entry to
  `defaultEnabled: true`, then `update` — the record must not move. Run the
  converse too: a user who ran `enable` on a `defaultEnabled: false` plugin
  stays enabled across reload, update and reinstall.

- **D-103-11: criterion 4's converse is proven end to end, config included.**
  Assert that `enable` writes `enabled: true` into the declaring config file,
  not merely that the record flipped. Without that write the next `/reload`
  would read the `enabled: false` the install stamped, plan a disable, and undo
  the user's explicit choice — which is the same class of silent reversal this
  milestone exists to close, pointed the other way.

### Claude's Discretion

- Test file placement, fixture naming, and whether the planner-level assertions
  live beside the existing `tests/orchestrators/reconcile/plan.test.ts` cases or
  in a new file.
- Whether the three reload passes are one test with three `applyReconcile` calls
  or three named assertions inside one fixture.
- The exact grep-gate file: extending an existing architecture test versus a new
  one, following whichever the existing gates make more natural.

### Deferred Ideas (OUT OF SCOPE)

- **Standalone retry after a failed disable cascade.** When the install ledger
  succeeds and the disable cascade fails, the record is saved, so an immediate
  re-run of `install` hits the PI-15 `already-installed` gate and the only
  escape named to the user is `uninstall`. A `/reload` does converge, because
  the config now declares `enabled: false`
  (`orchestrators/plugin/install.ts:1638-1653`). Outside every success criterion
  of this phase; backlog-grade.
- **Criterion 2 of Phase 102 rests on composition for agents and MCP.** The
  tests assert skills, commands and hooks are gone from disk; agents and MCP
  rest on `cascadeUnstagePlugin` covering all five kinds. One `stat` on
  `locations.agentsDir` and one read of `mcpJsonPath` in the existing
  `install-out04-row-` fixture would make it direct. A Phase 105 parity-sweep
  candidate.

Also out of scope per `<domain>`: DFEN-08's byte-identical parity sweep (Phase
105) and the pre-install read surfaces (Phase 104). This phase asserts stability
for the `defaultEnabled: false` case it was given; it does not re-audit the
`true` and absent cases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DFEN-06 | The state produced by DFEN-04 is reconcile-stable: a `/reload` after installing a `defaultEnabled: false` plugin plans no action for it and does not re-enable it. Verified against the reconcile planner, not only at the install boundary. `[VERIFIED: .planning/workstreams/defaults-enabled/REQUIREMENTS.md:36]` | Already true in the tree. `planReconcile` is empty over the real on-disk state the install writes, for both a base declaration and a local one, on passes 1/2/3 (probes 1–2 below). The seam to attach to is `planReconcile(merged, state, scope)` (`orchestrators/reconcile/plan.ts:409`); the steady-state arm is the fall-through at `plan.ts:340-342`; the hazard is `acc.enable.push` at `plan.ts:338`. |
| DFEN-07 | `update` and `reinstall` never re-apply `defaultEnabled` to an already-installed plugin, so a plugin release that changes the field does not flip a user's existing choice. `[VERIFIED: .planning/workstreams/defaults-enabled/REQUIREMENTS.md:37]` | True as written, and now measured: with the manifest flipped `false → true` mid-flight, `update` moved only the version and left `enabled: false` (probe B). Neither file names `defaultEnabled` or `applyDefaultEnabled` anywhere (grep below). The grep-gate host is `tests/helpers/source-scan.ts::assertNoForbiddenSurface`. **But see Finding 2: `reinstall` re-enables a disabled record by a different mechanism** — an unconditional `enabled: true` at `reinstall.ts:1733`, not a `defaultEnabled` read. |
</phase_requirements>

## Summary

The scout was right about all four of its claims, and I re-verified each one by
opening the file rather than trusting the note (table below; two line ranges
drifted slightly, nothing material). Three of the four success criteria are
structurally true today, so this phase is a pinning exercise, exactly as the
roadmap anticipated. To keep that conclusion from being a code-reading opinion,
I executed the four criteria end to end against the real orchestrators in a
hermetic tmp HOME: the fixed point holds for three passes over both a base and a
local declaration, with **zero** `ctx.ui.notify` calls on passes 2 and 3 and an
empty `planReconcile` over the actual bytes on disk; `update` against a flipped
manifest moved the version and left enablement alone; and a user's `enable`
survives a version-bump `update` and a `reinstall` and a `/reload`.

Two things the scout did not look for turned up, and both bear on this phase's
own goal sentence rather than on its literal criteria.

**Finding 1 — `enable` without `--local` under a local declaration silently
reverses itself.** `setPluginEnabled` picks its write target from the user's
`--local` flag alone (`enable-disable.ts:520` → `shared.ts:401-416`); it never
consults where the declaration actually lives. So when Phase 102's reconcile
stamp landed `enabled: false` in `claude-plugins.local.json`, a plain
`/claude:plugin enable foo@mp` writes `enabled: true` into
`claude-plugins.json`, the CFG-02 wholesale-replacement merge keeps reading the
local `false`, and the next `/reload` plans a disable and undoes the user
(probe C, observed). This is precisely the class of silent reversal D-103-11
names, and it is real today. D-103-11's assertion, taken literally over a
locally-declared plugin, will FAIL.

**Finding 2 — `reinstall` re-enables a disabled plugin.**
`updateStateRecord` writes `enabled: true` unconditionally (`reinstall.ts:1733`)
and `reinstall.ts` contains no occurrence of the strings `disabled` or `enabled`
outside those two record-composition sites — there is no disabled-record branch
at all, unlike `update.ts:1870`. A reinstall of an install-disabled plugin
re-materializes its skills, flips the record to enabled, renders
`(reinstalled)`, and leaves the config still saying `enabled: false`; the next
`/reload` plans a disable and converges back (probe A, observed). It does not
violate criterion 3 as written — nothing here reads `defaultEnabled` — but it
does violate the phase goal sentence's "not a `reinstall`".

Both are scope questions for the planner and the human, not defects this
research can settle; they are written up in `## Open Questions` with the exact
reproduction.

**Primary recommendation:** plan a tests-and-docs phase: one end-to-end
fixed-point test per declaration site (base, local) reusing
`seedDefaultDisabledInstallScope`, each running three `applyReconcile` passes and
ending with a `planReconcile` call over the state and merged config re-read from
disk; one planner-level pair beside the existing ENBL-08 fixed-point case; one
DFEN-07 behavioral test using a mid-flight manifest flip whose **version bump is
the control** that proves the flip was seen; one new architecture grep gate built
on `assertNoForbiddenSurface`; the D-103-03 comment amendment on the existing
`install-dfen05-false-kept-` case plus its missing convergence half; and the
D-103-02 `ROADMAP.md` reword. Add no mechanism.

## Scout Re-Verification

Every `<code_context>` claim from `103-CONTEXT.md`, checked against the tree at
`af8d3a69`.

| Scout claim | Verdict | Evidence |
|---|---|---|
| `resolved.defaultEnabled` has exactly ONE reader outside the resolver, the landed-disabled verdict at `install.ts:1606-1616` | **TRUE**, line range shifts by ~11 | `grep -rn "\.defaultEnabled" --include="*.ts" extensions/` returns exactly five hits: `resolver.ts:655,656,659,660` and `install.ts:1620`. The verdict *comment* spans `install.ts:1601-1610`; the *assignment* is `install.ts:1617-1620`. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1617-1620]` |
| `update.ts` and `reinstall.ts` call `resolveStrict` (`update.ts:902`, `reinstall.ts:1510`) but never read the field, never pass `applyDefaultEnabled`, never write `claude-plugins.json` | **TRUE**, both line numbers exact | `update.ts:902` `const resolved = await resolveStrict(entry, { marketplaceRoot, resolveGitPluginRoot });`; `reinstall.ts:1510` `const resolved = await resolveStrict(input.entry, {`. `grep -n "defaultEnabled\|applyDefaultEnabled\|writeBatchedConfigEntries\|writePluginConfigEntry\|saveConfig"` over both files returns **zero** hits. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:902]` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1510]` |
| `enable-disable.ts` DOES write back to config — `writeBatchedConfigEntries` at `:583` and `:657` | **TRUE**, both exact | `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:583]` (the config-truth reclassification arm) and `[VERIFIED: …:657]` (the ordinary `fresh` write-back). Both are gated `if (!orchestrated)`. **Caveat the scout missed:** both write `targetConfigPath`, chosen at `:520` from `opts.local` only — see Finding 1. |
| The reconcile planner never sees a manifest; desired enablement comes only from `isDeclaredEnabled` over the merged config | **TRUE** | `plan.ts` imports exactly three modules: `domain/source.ts`, `persistence/config-io.ts`, `persistence/state-io.ts` (`plan.ts:48-50`). No resolver import, no manifest import, no `fs`. `plan.ts:301` `const enabledExplicitFalse = !isDeclaredEnabled(declared.entry);` is the sole enablement read on the declared side. `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:48-50,301]` |
| `classifyDeclaredPlugin` lives at `plan.ts:295-345`; the steady-state comment is `:339-343`; the hazard is `acc.enable.push` at `:338` | **PARTLY DRIFTED** | The function spans `plan.ts:259-343`. `acc.enable.push({ scope, plugin, marketplace });` is at `plan.ts:338` — exact. The steady-state comment is `plan.ts:340-342`, verbatim: `// Declared-enabled, recorded, not disabled: steady state, no action. The` / `// record's inventory is not consulted -- ENBL-18 keeps it populated across a` / `// disable, so it distinguishes nothing here.` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:259-343]` |
| `tests/architecture/no-orchestrator-network.test.ts` is the grep-gate model | **TRUE, with a correction** | That file no longer owns its own read/strip/accumulate loop — it delegates to `tests/helpers/source-scan.ts::assertNoForbiddenSurface` (D-98-09). The new gate should call the same helper, not copy the older shape. `[VERIFIED: tests/architecture/no-orchestrator-network.test.ts:84-95]` |
| `seedRealPathMarketplace` carries an `entryDefaultEnabled` knob; the WR-09 local-file fixture shape exists | **TRUE** | `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:1351-1394]` (`entryDefaultEnabled?: boolean` at `:1363`, spread onto the manifest entry at `:1386-1388`) and `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:458]` (WR-09 local-file isolation). A purpose-built local/base seeder for exactly this phase's shape already exists too: `seedDefaultDisabledInstallScope` `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:1839-1901]`. |

## Empirical Probes

Five probes, written to the session scratchpad (never to the repo) and run with
`node --test`, importing the real orchestrator modules by absolute path against a
hermetic tmp `HOME` + tmp cwd. Every line below is observed output, not inference.
Probe sources: `…/scratchpad/probe.test.ts`, `probe2.test.ts`, `probe3.test.ts`.

| Probe | Setup | Observed |
|---|---|---|
| **1 — base-declared fixed point** | `claude-plugins.json` declares `mp` + bare `"foo@mp": {}`; manifest entry says `defaultEnabled: false`; state records `mp` with no plugins; three `applyReconcile` passes | Pass 1 notifies once: `● mp [project]\n  ◍ foo v1.2.3 (disabled) {installs disabled}\n    Run enable on this plugin to use its components.\n\nReconcile: 1 success`. **Pass 2 and pass 3 notify ZERO times.** Base entry ends `{"enabled": false}`, record `enabled: false`. `planReconcile` over the re-read state + merged config returns all seven buckets empty. |
| **2 — local-declared fixed point** | Same, but the plugin key is declared only in `claude-plugins.local.json`; base declares the marketplace only | Identical row on pass 1, **zero notify on passes 2 and 3**, stamp lands in the local file, base `plugins` stays `{}`, `planReconcile` empty. D-103-07's concern is real but the code already handles it. |
| **A — `reinstall` on an install-disabled record** | Probe 1's terminal state, then `reinstallPlugins` targeting `foo@mp` | Record `false → true`; `foo-s1` re-appears in `skillsTargetDir`; row is `● foo v1.2.3 (reinstalled)`; config still `{"enabled": false}`; the next `planReconcile` carries `pluginsToDisable: [{scope:"project",plugin:"foo",marketplace:"mp"}]`. **Finding 2.** |
| **B — `update` with the manifest flipped `false → true`** | Probe 1's terminal state; rewrite `marketplace.json` to `version: "2.0.0", defaultEnabled: true` and bump `plugin.json`; then `updatePlugins` | Row `⊘ foo (skipped) {already disabled}`; record `version: "2.0.0"` (the flip WAS read) and `enabled: false` (the `defaultEnabled` half was not); `planReconcile` empty. **DFEN-07 confirmed for `update`, with a live control.** |
| **C — `enable` (no `--local`) on a locally-declared install-disabled plugin** | Probe 2's terminal state, then `setPluginEnabled({enable: true})` | Record → `true`; **`enabled: true` is written into the BASE file** while the local file still says `false`; `planReconcile` immediately carries `pluginsToDisable` for `foo@mp`; the next `applyReconcile` renders `◍ foo v1.2.3 (disabled)` and puts the record back to `false`. **Finding 1.** |
| **D — `enable` (no `--local`) on a base-declared install-disabled plugin** | Probe 1's terminal state, then `setPluginEnabled({enable: true})` | Record → `true`, base entry → `{"enabled": true}`, `planReconcile` empty, next `applyReconcile` notifies **zero** times and the record stays `true`. Criterion 4 holds on this path. |
| **E — the full converse chain** | Base-declared install-disabled → `enable` → manifest version bump (still `defaultEnabled: false`) → `update` → `reinstall` → `/reload` | `● foo v1.2.3 → v2.0.0 (updated)`, then `● foo v2.0.0 (reinstalled)`; `enabled` stays `true` at every step; base entry stays `{"enabled": true}`; final `planReconcile` empty; reload notifies zero times. **Criterion 4 holds end to end on the base path.** |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deciding whether a plugin is *desired* enabled | `orchestrators/reconcile/plan.ts` (pure planner) | `persistence/config-io.ts::isDeclaredEnabled` | Desired state is a config question only; the planner reads no manifest and no resolver `[VERIFIED: plan.ts:48-50]` |
| Deciding whether a plugin is *recorded* enabled | `persistence/state-io.ts::isRecordedButDisabled` | — | One predicate, one definition; a drift gate already forbids a twin (`plan.test.ts:1012`) |
| Writing the declaration a reconcile install implies | `orchestrators/plugin/install.ts` (the orchestrated stamp) | `persistence/config-write-back.ts::writePluginConfigEntry` | Landed in Phase 102; this phase only proves the planner is quiet over it |
| Re-materializing artifacts for a lifecycle verb | `orchestrators/plugin/{update,reinstall}.ts` | `bridges/*` | Neither should own an enablement policy; `update` defers to `runDisabledRecordRefresh`, `reinstall` does not (Finding 2) |
| Proving a structural absence | `tests/architecture/*` via `tests/helpers/source-scan.ts` | — | House pattern: grep gates are tests, not lint rules |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | bundled with Node ≥ 20.19.0 | The only test runner in this repo | `package.json` `test` script runs `node --test "tests/{architecture,…}/**/*.test.ts"` `[VERIFIED: package.json scripts.test]` |
| `node:assert/strict` | bundled | Assertions | Used by every test file read this session |
| `node:fs/promises` | bundled | Fixture seeding and source reads | `source-scan.ts:26` deliberately uses `readFile` over a `grep` subprocess (D-98-10) `[VERIFIED: tests/helpers/source-scan.ts:14-19]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test`'s `mock.fn()` | bundled | `ctx.ui.notify` capture | `makeCtx()` in `apply.test.ts:52-54` — the zero-notify assertion depends on it `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:52-54]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new architecture test file | Extending `no-orchestrator-network.test.ts` | Rejected: that gate's subject is NFR-5/gitOps and `update.ts` is *explicitly exempt* there (`no-orchestrator-network.test.ts:35-38`). Adding a `defaultEnabled` clause needs its own target list and its own pattern list anyway, so the only thing shared would be the filename — and the file's failure message names four requirement IDs that have nothing to do with DFEN-07. |
| `assertNoForbiddenSurface` | A hand-rolled read/strip/match loop | Rejected: D-98-09 exists precisely to stop that duplication, and the helper already implements the WR-06 "a missing target FAILS" rule (`source-scan.ts:76-91`). |

**Installation:** none. This phase adds no dependency.

## Package Legitimacy Audit

Not applicable — this phase installs no external package. No `npm install` line
appears anywhere in the plan surface, and the entire test stack is Node built-ins
already in use.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
  /reload                       /claude:plugin enable|update|reinstall
     │                                          │
     ▼                                          ▼
 resources_discover                     edge/handlers/plugin/*
     │                                          │
     ▼                                          ▼
 applyReconcile (apply.ts:1359)          setPluginEnabled / updatePlugins /
     │                                   reinstallPlugins
     │ (1) withLockedStateTransaction              │
     │ (2) loadMergedScopeConfig(loc) ──┐          │ each re-reads
     │     apply.ts:192                 │          │ marketplace.json
     │ (3) planReconcile(merged,        │          │ through the process-
     │     state, scope)  apply.ts:229  │          │ lifetime singleton
     ▼                                  │          │ (manifest.ts:85)
 ┌──────────────────────────────┐       │          ▼
 │ plan.ts — PURE, 7 buckets    │       │   resolveStrict(entry, …)
 │ reads: isDeclaredEnabled     │       │   returns `.defaultEnabled`
 │        isRecordedButDisabled │       │          │
 │ reads NO manifest, NO        │       │          │  update.ts / reinstall.ts
 │ resolver, NO fs   :48-50     │       │          └──► NEVER read it
 └──────────┬───────────────────┘       │              (the DFEN-07 gate)
            │                           │
            ▼                           │
 applyPluginInstalls (apply.ts:576)     │
   installPlugin({ applyDefaultEnabled: │ true, local: configSource==="local" })
            │                           │
            ▼                           │
 install.ts:1617 landed-disabled verdict│
   ├─ disableFreshlyInstalledPlugin     │
   └─ writePluginConfigEntry(…,         │
        { enabled:false })  :1734 ──────┘  the stamp the NEXT plan reads
            │
            ▼
   claude-plugins{,.local}.json  ──►  merged view  ──►  back to plan.ts
                                       (CFG-02: a local entry REPLACES the
                                        base entry for that key, wholesale)
```

The loop is closed by the stamp: without it the merged view reads the key as
absent, `isDeclaredEnabled` says enabled (D-04), the record says disabled, and
`plan.ts:338` pushes an enable forever. Phase 102 closed it; this phase pins it.

### Recommended Test Placement

```text
tests/
├── orchestrators/reconcile/
│   ├── apply.test.ts        # extend: the 3-pass end-to-end fixed point,
│   │                        #   base + local, ending in a planReconcile call
│   └── plan.test.ts         # extend: the planner-level pair, beside ENBL-08
├── orchestrators/plugin/
│   ├── install.test.ts      # extend: D-103-03's comment + convergence half
│   ├── update.test.ts       # extend: DFEN-07 flip test (update)
│   └── reinstall.test.ts    # extend: DFEN-07 flip test (reinstall)
└── architecture/
    └── <new>.test.ts        # D-103-08/09 grep gate via assertNoForbiddenSurface
```

Placement note: the end-to-end fixed point belongs in `apply.test.ts` because
`seedDefaultDisabledInstallScope` and `pathExists` already live there
(`apply.test.ts:1821-1901`) and the three existing DFEN cases sit directly below;
a new file would have to duplicate `withHermeticHome`, `makeCtx` and `STUB_PI`.

### Pattern 1: The planner seam and its exact shape

**What:** `planReconcile` is the only export of `plan.ts` that a test drives.

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:409-413
export function planReconcile(
  merged: MergedConfig,
  state: ExtensionState,
  scope: Scope,
): ReconcilePlan {
```

**The seven buckets, verbatim** `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:207-216]`:

```ts
export interface ReconcilePlan {
  readonly scope: Scope;
  readonly marketplacesToAdd: readonly PlannedMarketplaceAdd[];
  readonly marketplacesToRemove: readonly PlannedMarketplaceRemove[];
  readonly pluginsToInstall: readonly PlannedPluginInstall[];
  readonly pluginsToUninstall: readonly PlannedPluginUninstall[];
  readonly pluginsToEnable: readonly PlannedPluginEnable[];
  readonly pluginsToDisable: readonly PlannedPluginDisable[];
  readonly sourceMismatches: readonly PlannedSourceMismatch[];
}
```

D-103-06 says "all seven". Those are the seven names; `scope` is not a bucket.
`emptyReconcilePlan(scope)` returns exactly that shape with six empty arrays plus
`sourceMismatches: []` `[VERIFIED: types.ts:222-233]`, and `planReconcile` returns
it by identity of shape through a fast path when every count is zero
`[VERIFIED: plan.ts:426-436]` — which means `assert.deepEqual(plan, emptyReconcilePlan(scope))`
is a legitimate way to say "all seven empty" in one line, and is what the tree
already does (`plan.test.ts:112,241,268,418,441,495-496`).

**When to use:** the planner-level half of D-103-04.

### Pattern 2: The end-to-end fixed point, driven from disk

**What:** `applyReconcile` takes no state — it re-reads `state.json` and both
config files from disk on every call (`apply.ts:168-233`), so N sequential calls
are N honest reloads. Nothing is carried in memory between passes except the
process-lifetime manifest cache (see Pitfall 4).

**Verified shape** (`apply.test.ts:1912-1918`, and re-run in probe 1):

```ts
await applyReconcile({
  ctx: makeCtx() as unknown as ExtensionContext,
  pi: STUB_PI,
  cwd,
  scope: "project",
});
```

**What Phase 102's second-pass assertion does and does not prove.** It lives at
`apply.test.ts:1978-1998` and is exactly two assertions: the base config file's
bytes are unchanged, and the state record deep-equals its pre-pass value. Its own
comment says why it stops there — verbatim `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:1978-1981]`:

```ts
// Fixed point AT THIS SEAM: a second pass writes neither the config nor
// the record. Whether the planner plans an action at all is a separate
// question (DFEN-06) with its own coverage -- asserting it here would
// pre-empt it, so this checks only what this seam can observe.
```

So it proves *no net mutation*, on one extra pass, at the apply seam. It does
**not** prove (a) that the planner produced an empty plan — an apply path that
planned an enable and then failed silently would leave both bytes and record
untouched; (b) that a *third* pass is also quiet; (c) that nothing was rendered
— it never inspects `ctx.ui.notify`; it passes a throwaway `makeCtx()` whose
calls are never read. All three gaps are exactly D-103-04/05/06's job.

**The house idiom for (c)** already exists — `RECON-05` asserts zero notify on
the second call `[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:373]`
("two consecutive applyReconcile calls … ZERO notify on the second call
(silent empty-steady-state)"). Reuse it; probe 1 confirms the count is genuinely
`0` on passes 2 and 3 for this fixture, so the assertion will not need weakening.

### Pattern 3: The local-declared fixture, and why it differs

**What:** `seedDefaultDisabledInstallScope` already takes both files
`[VERIFIED: tests/orchestrators/reconcile/apply.test.ts:1839-1844]`:

```ts
async function seedDefaultDisabledInstallScope(opts: {
  cwd: string;
  home: string;
  base: Record<string, object>;
  local?: Record<string, object>;
}): Promise<{ basePath: string; localPath: string; extensionRoot: string }> {
```

The local case is seeded `{ base: {}, local: { "foo@mp": {} } }`
`[VERIFIED: apply.test.ts:2004-2009]`; the base file still declares the
marketplace (`:1861`), only the plugin key moves.

**How the fixed-point assertion differs from the base case.** In the base case
the physical file and the merged view agree by construction, so reading either
answers the question. In the local case they can disagree, and only the merged
view distinguishes a correct stamp from a mis-targeted one — Phase 102 says so in
the fixture itself `[VERIFIED: apply.test.ts:2035-2040]`. For a *fixed-point*
assertion the distinction gets sharper still: a stamp mis-aimed at the base file
would leave the merged entry with `enabled` absent, `isDeclaredEnabled` would
return `true`, `plan.ts:337` would find `isRecordedButDisabled(record)` true, and
`acc.enable.push` would fire on **every** pass. So a mis-targeted stamp shows up
here as a non-empty `pluginsToEnable` and a non-zero notify count on pass 2 —
loud, not silent. That is the whole reason D-103-07 exists.

The merged read is one call `[VERIFIED: apply.test.ts:2041-2049]`:

```ts
const merged = await loadMergedScopeConfig(locationsFor("project", cwd));
const effective = merged.merged.plugins["foo@mp"]!;
assert.equal(effective.source, "local");
assert.equal(effective.entry.enabled, false);
assert.equal(isDeclaredEnabled(effective.entry), false);
```

`loadMergedScopeConfig(loc)` returns `{ merged, base, local }`
`[VERIFIED: extensions/pi-claude-marketplace/persistence/config-merge.ts:142-152]`,
which is exactly what `apply.ts:192` uses, so a test that calls it is replaying
the production read rather than approximating it.

### Pattern 4: The architecture grep gate

**What:** a new `tests/architecture/*.test.ts` that hands a target list and a
pattern list to the shared helper.

**Verified helper contract** `[VERIFIED: tests/helpers/source-scan.ts:68-73]`:

```ts
export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
  opts: { readonly allowMissing?: ReadonlyArray<string> } = {},
): Promise<void>
```

It reads each repo-relative target with `readFile(..., "utf8")`, runs
`stripComments` (block comments then line comments,
`[VERIFIED: source-scan.ts:44-48]`), accumulates one offender string per match,
and makes a **single** `assert.deepEqual(offenders, [], describeViolation(offenders))`
so a failure reports every offender at once `[VERIFIED: source-scan.ts:93-101]`.
A target that does not exist **fails** unless listed in `allowMissing`
`[VERIFIED: source-scan.ts:76-91]` — which is what makes the gate survive a
rename instead of quietly greening over zero files.

**The smallest gate that satisfies D-103-09 without false positives:**

```ts
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "defaultEnabled reference", pattern: /\bdefaultEnabled\b/ },
  { name: "applyDefaultEnabled reference", pattern: /\bapplyDefaultEnabled\b/ },
];
```

Three properties worth stating in the plan, because each is a way to get this
subtly wrong:

1. **`resolveStrict` is untouched.** Neither pattern mentions it. The gate
   forbids naming the field, not obtaining the object that carries it — which is
   exactly D-103-09's distinction.
2. **The two patterns are independent, not redundant.** `\bdefaultEnabled\b` does
   **not** match inside `applyDefaultEnabled` (`y` and `d` are both word
   characters, so there is no boundary between them), and neither matches
   `resolveDefaultEnabled`. Both are needed; neither subsumes the other.
3. **A comment explaining the absence is legal**, because `stripComments` runs
   first. This matters concretely: today `grep -n "defaultEnabled" update.ts
   reinstall.ts` returns **nothing at all**, so the gate would pass even without
   stripping — but the moment someone writes `// DFEN-07: this file must never
   read defaultEnabled` the unstripped form would fail on its own docstring. Use
   the helper; do not hand-roll a raw `readFile` + `test()`.

### Anti-Patterns to Avoid

- **Asserting only `pluginsToEnable.length === 0`.** D-103-06 forbids it, and the
  tree already shows the better idiom: `deepEqual(plan, emptyReconcilePlan(scope))`
  plus per-bucket `some(p => p.plugin === … && p.marketplace === …)` negatives for
  the two buckets that could plausibly fire `[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:498-510]`.
- **Building the planner fixture by hand when the real bytes are available.** A
  hand-written `configWith({...}, {"foo@mp": {enabled: false}})` proves the
  planner is quiet over *someone's idea* of what install writes. Feeding it
  `loadState(extensionRoot)` + `loadMergedScopeConfig(loc)` after a real
  `applyReconcile` proves it is quiet over what install *actually* wrote. Do
  both: the hand-built pair belongs beside ENBL-08 as a unit-level matrix cell,
  the disk-driven one as the capstone.
- **Copying the reconcile-planner-purity gate's inline loop.** That file predates
  the shared helper and still carries its own `stripComments` + loop
  `[VERIFIED: tests/architecture/reconcile-planner-purity.test.ts:47-68]`. It is
  not the model to copy; `source-scan.ts` is.
- **Adding a mechanism.** `103-CONTEXT.md` `<domain>` says any proposal that adds
  one is a signal the scout was wrong. The scout was not wrong (table above).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading sources for a grep gate | `readFile` + regex loop in the new test | `assertNoForbiddenSurface` (`tests/helpers/source-scan.ts:68`) | Gets comment-stripping, single-assert reporting, and the WR-06 missing-target rule for free |
| Seeding a `defaultEnabled: false` install scope | A new fixture | `seedDefaultDisabledInstallScope` (`apply.test.ts:1839`) | Already builds the real path marketplace, both config files, and the state record with an empty plugin map |
| Building a real path marketplace | Hand-written manifest JSON | `seedRealPathMarketplace` with `entryDefaultEnabled` (`apply.test.ts:1351`) | Its own comment (`:1356-1362`) explains why the flag goes on the marketplace *entry* and not `plugin.json`: the entry is the side that WINS `resolveDefaultEnabled`, so a fixture on the fallback side can pass for the wrong reason |
| Rewriting a manifest mid-test | Ad-hoc `writeFile` | `rewriteManifest` (`tests/orchestrators/plugin/update.test.ts:293-304`) | The established shape in the file the DFEN-07 update test belongs in |
| Hermetic HOME + cwd | `process.env.HOME = …` inline | `withHermeticHome` (`apply.test.ts:58-88`) | Restores both env vars and uses `rm(..., {maxRetries: 10})` against a documented `proper-lockfile` teardown race |
| An "is this record disabled" test | `!record.enabled` inline | `isRecordedButDisabled` | A drift gate walks the whole extension tree for twin spellings, including the destructured and `Boolean()` forms `[VERIFIED: tests/orchestrators/reconcile/plan.test.ts:1012,1050]` |

**Key insight:** every primitive this phase needs already exists, most of them
authored by Phase 102 for this exact state shape. The work is assembly and
assertion, not construction.

## Common Pitfalls

### Pitfall 1: The vacuous empty plan

**What goes wrong:** `assert.deepEqual(plan, emptyReconcilePlan("project"))`
passes when the plugin was never in `merged.plugins` at all — a typo in the
fixture key, a `plugins: {}` that was never populated, a scope mismatch between
the seeder and the assertion.
**Why it happens:** the empty plan is the *default* outcome. Absence of input and
correctness of classification produce identical output.
**How to avoid:** the tree's own answer is the counter-case — `plan.test.ts:513`
runs the **same** state fixture under the opposite declaration and asserts
`pluginsToEnable` is non-empty, which proves the record is reachable by the
planner at all. Mirror it: one assertion that the fixture DOES reach a bucket
when the declaration flips, beside every assertion that it does not.
**Warning signs:** the test still passes when you delete the plugin key from the
seeded config; the test still passes when you rename the marketplace.

### Pitfall 2: The vacuous zero-notify

**What goes wrong:** `assert.equal(ctx.ui.notify.mock.calls.length, 0)` on pass 2
passes if pass 1 never ran, if the scope was wrong, or if `applyReconcile` bailed
at its pristine-scope short-circuit (`apply.ts:160-166` returns without touching
disk when neither `state.json` nor either config file exists).
**Why it happens:** silence is also the failure mode.
**How to avoid:** assert pass 1's row bytes first. Probe 1 shows exactly one
notify on pass 1 with the full `(disabled) {installs disabled}` row; a fixture
that never reached the orchestrator cannot produce it. The existing base case
already asserts those bytes (`apply.test.ts:1962-1976`) — extend that test rather
than starting a fresh, unanchored one.
**Warning signs:** the fixture seeds no `state.json`; `cwd` differs between the
seeder and the `applyReconcile` call.

### Pitfall 3: The state read that isn't a reload

**What goes wrong:** feeding `planReconcile` an `ExtensionState` object held over
from before the apply pass, so the assertion is made against pre-install state.
**Why it happens:** `applyReconcile` returns `void` — there is no plan or state to
capture, so a test must re-read.
**How to avoid:** always `await loadState(extensionRoot)` and
`await loadMergedScopeConfig(locationsFor(scope, cwd))` *after* the last apply
pass, in that order, mirroring `apply.ts:192,229`. Both are already imported in
`apply.test.ts` (`:40,42`).
**Warning signs:** `loadState` called once at the top of the test.

### Pitfall 4: The manifest flip the cache swallows

**What goes wrong:** D-103-10 rewrites `marketplace.json` between two orchestrator
calls, but `domain/manifest.ts:85` holds a **process-lifetime singleton** cache
with no reset hook `[VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:85]`:

```ts
const manifestCache = createManifestCache(loadMarketplaceManifestUncached);
```

keyed per path on `(mtimeMs, size)` `[VERIFIED: extensions/pi-claude-marketplace/domain/manifest-cache.ts:91-98]`.
A rewrite that changes neither field is served stale, and the DFEN-07 test then
passes because the second call never saw the flip — the exact wrong-reason pass
`103-CONTEXT.md` warns about.
**Why it happens:** the cache is invisible from the test; existing update tests
get away with it because each test uses a fresh `mkdtemp` path, so the key is
cold.
**How to avoid — use the version bump as the control.** Flip `defaultEnabled`
*and* the version in the same rewrite, then assert the record's `version` moved.
Probe B observed exactly this: with the manifest rewritten to
`{"version":"2.0.0","defaultEnabled":true}` the record came back
`version: "2.0.0", enabled: false`. The version movement is proof the re-read
happened; the unmoved `enabled` is the requirement. A stale cache would leave the
version at `1.2.3` and the test would fail loudly instead of passing quietly.
(Belt and braces, probe E also re-read the manifest through
`loadMarketplaceManifest` and printed the flipped entry — a second, cheaper
control if a version bump ever muddies a fixture.)
**Warning signs:** a flip that changes only a boolean of equal string length; two
orchestrator calls against the same `manifestPath` with no observable difference
asserted between them.

### Pitfall 5: Asserting `reinstall` leaves enablement alone

**What goes wrong:** a criterion-3 test that reinstalls a *disabled* plugin and
expects the record untouched will fail — see Finding 2. `reinstall.ts:1733`
writes `enabled: true` unconditionally.
**Why it happens:** the criterion is phrased about `defaultEnabled` consultation,
but the natural test to write is "reinstall doesn't change enablement", which is
a stronger and currently false statement.
**How to avoid:** scope the DFEN-07 reinstall assertion to an **enabled** record
(probe E's shape: the manifest still says `false`, the user's `enable` survives a
reinstall), and route the disabled-record behavior to `## Open Questions` rather
than asserting it either way inside this phase without a decision.
**Warning signs:** a test named "reinstall preserves the disabled record".

### Pitfall 6: Test titles that name planning artifacts

**What goes wrong:** `test("Phase 103: …")` or `// Pitfall 4:` in a comment.
**Why it happens:** research and plan documents number things.
**How to avoid:** cite `DFEN-06`, `DFEN-07`, `D-103-04`, `NFR-3`, `WR-05`,
`ENBL-08` only. `.claude/rules/typescript-comments.md` forbids `Phase NN`,
`Plan NN`, `Wave N`, bare `Pitfall N` and bare `Pattern N`
`[VERIFIED: .claude/rules/typescript-comments.md]`. Nothing in this research
document's own numbering may travel into the source.

## Code Examples

Every snippet below was executed this session (probe sources in
`## Empirical Probes`) or read verbatim from the tree.

### The capstone: three passes, then the planner, over the real bytes

```ts
// Verified by probe 1. Zero notify on passes 2 and 3; empty plan at the end.
const c1 = makeCtx();
await applyReconcile({ ctx: c1 as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" });
assert.equal(c1.ui.notify.mock.calls.length, 1);          // Pitfall 2 anchor
assert.match(
  (c1.ui.notify.mock.calls[0]!.arguments as [string])[0],
  /^ {2}◍ foo v1\.2\.3 \(disabled\) \{installs disabled\}$/m,
);

for (const pass of [2, 3]) {                               // D-103-05
  const c = makeCtx();
  await applyReconcile({ ctx: c as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" });
  assert.equal(c.ui.notify.mock.calls.length, 0, `pass ${pass} must be silent`);
}

// D-103-04, planner half — over what install actually wrote, not a hand-built twin.
const loc = locationsFor("project", cwd);
const state = await loadState(extensionRoot);
const merged = await loadMergedScopeConfig(loc);
const plan = planReconcile(merged.merged, state, "project");
assert.deepEqual(plan, emptyReconcilePlan("project"));     // D-103-06, all seven
```

### The counter-case that makes the empty plan mean something

```ts
// Source shape: tests/orchestrators/reconcile/plan.test.ts:513-529 (ENBL-05 counter-case).
// Same state, opposite declaration -> the record IS reachable by the planner.
const merged = mergeScopeConfigs(
  configWith({ mp: { source: "acme/tools" } }, { "cr@mp": { enabled: true } }),
  {},
);
const plan = planReconcile(merged, stateWithDisabledRecord("mp", "acme/tools", "cr"), "project");
assert.deepEqual(plan.pluginsToEnable, [{ scope: "project", plugin: "cr", marketplace: "mp" }]);
assert.equal(plan.pluginsToDisable.length, 0);
```

### The DFEN-07 flip, with its control

```ts
// Verified by probe B. The version bump proves the manifest re-read happened;
// the unmoved `enabled` is the requirement.
await rewriteManifestWithDefaultEnabled(manifestPath, { version: "2.0.0", defaultEnabled: true });
await updatePlugins({ ctx, pi, scope: "project", cwd,
  target: { kind: "plugin", marketplace: "mp", plugin: "foo" } });

const rec = (await loadState(extensionRoot)).marketplaces.mp!.plugins.foo!;
assert.equal(rec.version, "2.0.0", "control: the flipped manifest WAS read");
assert.equal(rec.enabled, false, "DFEN-07: defaultEnabled was not re-applied");
```

### The steady-state arm this phase proves

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:336-342
const record = state.marketplaces[marketplace]?.plugins[plugin];
if (record !== undefined && isRecordedButDisabled(record)) {
  acc.enable.push({ scope, plugin, marketplace });
}
// Declared-enabled, recorded, not disabled: steady state, no action. The
// record's inventory is not consulted -- ENBL-18 keeps it populated across a
// disable, so it distinguishes nothing here.
```

The install-disabled plugin never reaches line 338 because the branch above
returns first: `enabledExplicitFalse` is `true` (the config says
`enabled: false`), the record IS `isRecordedButDisabled`, so the disable push at
`plan.ts:321` is skipped and the function returns at `plan.ts:324`
`[VERIFIED: plan.ts:304-325]`.

## State of the Art (in-repo)

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| Each architecture gate owned its read/strip/match loop | One shared `assertNoForbiddenSurface` in `tests/helpers/source-scan.ts` | D-98-09 | The new D-103-08 gate must delegate; `reconcile-planner-purity.test.ts` is a survivor of the old shape, not a template |
| A missing grep target was skipped with a marker | A missing target FAILS unless in `allowMissing` | WR-06 (`source-scan.ts:60-66`) | The gate cannot be silently uncovered by a rename |
| Disabled-ness inferred from empty `resources.*` arrays | `isRecordedButDisabled(record)` reads the explicit `enabled` boolean and nothing else | ENBL-05 / ENBL-18 (`state-io.ts:205-207`) | A disabled record KEEPS its inventory, so no test may use empty arrays as the marker |
| `install`'s config patch was always `{}` | It carries `enabled: false` on the landed-disabled path, in both the standalone and the orchestrated arm | DFEN-04 / D-102-04 (`install.ts:1705`, `:1734`) | The state DFEN-06 asserts over |

**Deprecated/outdated for this phase:**

- The `102-CONTEXT.md`-era assumption that only the *apply* seam can be asserted
  for idempotence. `planReconcile` is pure and importable; the disk-driven
  planner call costs two extra lines.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node ≥ 20.19.0 built-in), assertions via `node:assert/strict` |
| Config file | none — glob lives in `package.json` `scripts.test` |
| Quick run command | `node --test "tests/orchestrators/reconcile/**/*.test.ts" "tests/architecture/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck → lint → format:check → test → test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DFEN-06 | Three `applyReconcile` passes over a base-declared install-disabled plugin: one row, then silence, then an empty `planReconcile` | integration | `node --test "tests/orchestrators/reconcile/apply.test.ts"` | ✅ extend (`apply.test.ts:1903`) |
| DFEN-06 / D-103-07 | Same for a locally-declared plugin, with the merged view read | integration | same | ✅ extend (`apply.test.ts:2002`) |
| DFEN-06 / D-103-04 | Planner-level: the disabled-record + declared-disabled cell is a fixed point, plus its counter-case | unit | `node --test "tests/orchestrators/reconcile/plan.test.ts"` | ✅ extend (`plan.test.ts:477`) |
| DFEN-07 | `update` against a flipped manifest moves the version and not `enabled` | integration | `node --test "tests/orchestrators/plugin/update.test.ts"` | ✅ extend |
| DFEN-07 / criterion 4 | `enable` → flipped-manifest `update` → `reinstall` → `/reload` keeps the user enabled | integration | `node --test "tests/orchestrators/plugin/reinstall.test.ts"` (or `update.test.ts`) | ✅ extend |
| DFEN-07 / D-103-08/09 | `update.ts` and `reinstall.ts` name neither token | architecture | `node --test "tests/architecture/**/*.test.ts"` | ❌ new file |
| D-103-03 | Install over `enabled: false` materializes, entry byte-identical, next pass converges | integration | `node --test "tests/orchestrators/plugin/install.test.ts"` | ✅ partial — the matrix row exists (`install.test.ts:1185-1193`); the DFEN-08 rationale in the comment and the convergence half are missing |
| D-103-11 | `enable` writes `enabled: true` into the **declaring** file | integration | `node --test "tests/orchestrators/plugin/enable-disable.test.ts"` | ⚠️ base path passes today (probe D); local path FAILS (probe C) — see Open Question 1 |

### Sampling Rate

- **Per task commit:** `node --test "tests/orchestrators/reconcile/**/*.test.ts" "tests/architecture/**/*.test.ts"` (~3 s for the reconcile tree in this session's probes)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/architecture/<name>.test.ts` — the D-103-08/09 gate. No framework install needed.

*(No other gaps: every other target file exists and every helper this phase needs is already written.)*

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json`, so this
section is included. The phase adds tests, one architecture gate and two document
edits; it introduces no input surface, no network call and no new write path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No credential surface touched; `platform/git-credential.ts` is not on any path here |
| V3 Session Management | no | Not a session-bearing system |
| V4 Access Control | no | No authorization decision is added or moved |
| V5 Input Validation | no (unchanged) | Config and manifest validation stay where they are (`CONFIG_SCHEMA`, `MARKETPLACE_VALIDATOR`); this phase only reads through them |
| V6 Cryptography | no | None involved |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A test fixture writing outside its tmp scope | Tampering | `withHermeticHome` sets `HOME` to a fresh `mkdtemp` and deletes `PI_CODING_AGENT_DIR`; every path derives from `locationsFor(scope, cwd)`, which routes through `assertPathInside` (NFR-10) |
| An architecture gate greening over a file it never read | Repudiation | `assertNoForbiddenSurface` fails on ENOENT (WR-06) and uses `readFile`, never a `grep` subprocess that can classify a file as binary and report nothing (D-98-10) |
| Absolute tmp paths leaking into an asserted message | Information disclosure | Assert on row shape with a regex anchored to the plugin name, as `apply.test.ts:1964-1968` does; do not deep-equal whole notification strings containing `mpRoot` |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test runner, TS stripping | ✓ | ≥ 20.19.0 required by `package.json` `engines`; the probes ran clean | — |
| npm | `npm run check` | ✓ | bundled | — |
| Network | nothing on this phase's paths | n/a | — | All fixtures are `path`-source marketplaces on local disk (NFR-5) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Project Constraints (from CLAUDE.md)

- `npm run check` must stay green — typecheck + ESLint + Prettier + tests (NFR-6).
- Never commit to `main`; this work lives on `features/defaults-enabled` in a
  worktree. Commits from the worktree need `SKIP=trufflehog` **after** the
  documented filesystem scan, never `--no-verify`.
- Run `pre-commit run --files <changed files>` before attempting a commit; CI runs
  `--all-files`.
- Conventional Commits; no GSD milestone/phase mentions in titles or bodies.
- Comments and test titles cite durable IDs only — `.claude/rules/typescript-comments.md`.
- All user-visible output through `ctx.ui.notify` (IL-2); nothing in this phase
  emits output, so no notify surface changes.
- `sonarjs/cognitive-complexity: 15` and `@stylistic/padding-line-between-statements`
  apply to test files too (`eslint.config.js` lints `extensions tests`); a
  three-pass loop is cheaper than three copy-pasted blocks on both counts.
- Prettier `printWidth: 100`.
- Markdown is formatted by `mdformat` via pre-commit, **not** prettier
  (`format:check` covers only `js/json/ts`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A new `tests/architecture/*.test.ts` file is the right home for the D-103-08 gate rather than extending an existing one | Standard Stack / Pattern 4 | Low — D-103's discretion list explicitly leaves the file choice open; if the planner prefers extension, `assertNoForbiddenSurface` supports a second `test()` in any existing file |
| A2 | The `(mtimeMs, size)` key change is what makes probe B's flip visible, rather than something else | Pitfall 4 | Low — the mechanism is documented in `manifest-cache.ts:25-36` and the version bump was observed to land; the recommendation does not depend on the mechanism, only on the control |
| A3 | Findings 1 and 2 are pre-existing behavior, not regressions introduced by Phase 102 | Open Questions | Medium — Finding 2 (`reinstall.ts:1733`) predates this milestone by inspection (no `defaultEnabled` involvement), but Finding 1 became *reachable* through Phase 102's stamp: before it, nothing wrote `enabled: false` into a local file on the user's behalf. Git archaeology on `reinstall.ts:1733` would settle Finding 2's age if the planner wants it |

## Open Questions

1. **Does D-103-11's assertion bind the locally-declared case, and if so, does
   this phase fix `enable`'s write target?**
   - **What we know:** `setPluginEnabled` selects `targetConfigPath` from
     `opts.local` alone (`enable-disable.ts:520` → `shared.ts:401-416`) and writes
     there (`:583`, `:657`). Under a local declaration and no `--local`, the write
     lands in the base file, CFG-02 keeps the local `false` effective
     (`config-merge.ts:108-120`), and the next `/reload` plans a disable and undoes
     the user. Observed, not inferred (probe C: record `true` → base file gains
     `enabled: true` → plan carries `pluginsToDisable` → reload renders
     `◍ foo v1.2.3 (disabled)` and the record returns to `false`). The base-declared
     path is clean (probe D).
   - **What's unclear:** whether "the declaring config file" in D-103-11 means
     "the file the declaration lives in" (then this phase must either fix `enable`
     or record a known gap) or "the file the user targeted" (then the assertion is
     base-only and the local case is Phase 105 / backlog work). Note the parallel:
     Phase 102 solved exactly this for `install` by threading
     `PlannedPluginInstall.configSource`, but a standalone `enable` has no planner
     provenance to read — it would need to consult `loadMergedScopeConfig(loc).merged.plugins[key].source`,
     which `enable-disable.ts` does not import today.
   - **Recommendation:** scope the phase's D-103-11 assertion to the base-declared
     case (which passes), and put the local-declared reproduction in front of the
     human as a decision before planning. It is a genuine silent reversal and it is
     in the milestone's stated blast radius, but fixing it is a mechanism change,
     which `<domain>` says this phase should not contain.

2. **Is `reinstall` re-enabling a disabled plugin in scope?**
   - **What we know:** `updateStateRecord` writes `enabled: true` unconditionally
     (`reinstall.ts:1733`); `reinstall.ts` has no disabled-record branch (`grep -n
     "disabled\|enabled" reinstall.ts` returns exactly two lines, `:1733` and
     `:2071`), unlike `update.ts:1870`'s `runDisabledRecordRefresh` guard. Observed
     (probe A): the record flips to enabled, the skill re-appears on disk, the row
     says `(reinstalled)` while the config still says `enabled: false`, and the next
     `/reload` plans a disable and converges back.
   - **What's unclear:** criterion 3 as written ("never consult `defaultEnabled`")
     is satisfied — nothing here reads the field. The phase *goal sentence*
     ("nothing re-enables it behind the user's back — … not a `reinstall`") is not.
     The divergence is transient (one reload converges) but the row is untruthful
     while it lasts, which is the same "a row contradicting its own record" concern
     Phase 102 cited when it chose `plugin-disabled` over `plugin-installed`
     (`apply.ts:607-620`).
   - **Recommendation:** treat as out of scope for the criteria but record it. The
     minimal honest option is a characterization test that pins today's behavior
     with a comment naming the open question; the fix (mirror `update.ts:1870` —
     refresh the disabled record without re-materializing) is a mechanism change
     and belongs in its own phase or the backlog.

3. **Does D-103-03's regression test need a new case or an amendment?**
   - **What we know:** the behavior is already pinned. `DFEN_PRECEDENCE_CASES` row
     `install-dfen05-false-kept-` (`install.test.ts:1185-1193`) asserts a manifest
     `defaultEnabled: true` plus a seeded `{ enabled: false }` yields
     `expectRecordEnabled: true`, `expectArtifacts: true`,
     `expectEntryAfter: { enabled: false }`. Its comment (`:1178-1184`) explains the
     choice as "running `install` IS the user asking for the install" — it does
     **not** mention DFEN-08, which is what D-103-03 requires. The convergence half
     ("the next reconcile pass converges the record to disabled") is asserted
     nowhere on this fixture.
   - **What's unclear:** whether amending the existing comment plus adding the
     convergence assertion satisfies D-103-03, or whether the decision wants a
     separately-named test.
   - **Recommendation:** amend in place and add the convergence half; a duplicate
     case would trip `sonarjs/no-identical-functions` risk and split the matrix the
     surrounding comment (`:1130-1150`) carefully explains.

4. **Where does the D-103-02 `ROADMAP.md` reword land, and is it this phase's
   commit?**
   - **What we know:** the gloss is still unamended. `ROADMAP.md`'s Phase 102 block,
     criterion 3, still reads "… and a user who wrote `enabled: false` for a
     `defaultEnabled: true` plugin stays disabled." The `102-VERIFICATION.md`
     override that documents why it is wrong is in place
     (`102-VERIFICATION.md:8-20`).
   - **What's unclear:** editing a *previous* phase's success criterion in
     `ROADMAP.md` from inside Phase 103 is unusual bookkeeping; it may want to be a
     standalone docs commit rather than a plan task.
   - **Recommendation:** one docs task at the end of the phase, message scoped
     `docs(roadmap):`, touching only that clause. Keep the override block.

## Sources

### Primary (HIGH confidence) — files opened with `Read` this session

- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (full)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` (full)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (160-249, 560-660)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (260-410, 1395-1520, 1520-1810)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (1850-1910)
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (1180-1240, 1330-1360, 1495-1535, 1690-1770, 2030-2084)
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (500-680)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (380-440)
- `extensions/pi-claude-marketplace/persistence/config-merge.ts` (40-153)
- `extensions/pi-claude-marketplace/domain/manifest.ts` (40-100), `domain/manifest-cache.ts` (full), `domain/resolver.ts` (630-670)
- `tests/helpers/source-scan.ts` (full)
- `tests/architecture/no-orchestrator-network.test.ts` (full), `tests/architecture/reconcile-planner-purity.test.ts` (full), `tests/architecture/config-state-write-seams.test.ts` (1-60)
- `tests/orchestrators/reconcile/apply.test.ts` (1-115, 1340-1420, 1821-2186), `plan.test.ts` (1-190, 234-335, 402-535), `plan-convergence.test.ts` (full)
- `tests/orchestrators/plugin/install.test.ts` (1120-1210), `update.test.ts` (240-305)
- `.planning/workstreams/defaults-enabled/phases/103-reconcile-stability-and-lifecycle-non-reapplication/103-CONTEXT.md`
- `.planning/workstreams/defaults-enabled/phases/102-…/102-03-SUMMARY.md`, `102-VERIFICATION.md`
- `.planning/workstreams/defaults-enabled/{ROADMAP.md,REQUIREMENTS.md}`, `.planning/config.json`, `package.json`
- `.claude/rules/typescript-comments.md`, `CLAUDE.md`, `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md`

### Secondary (MEDIUM confidence)

- Executed probes 1, 2, A–E against the real orchestrators (scratchpad, not committed). Behavior is directly observed; the mapping from observation to requirement is my reading.

### Tertiary (LOW confidence)

- None. No web source was consulted: every question in this phase is answerable from the tree, and no external library is involved.

## Metadata

**Confidence breakdown:**

- Scout re-verification: HIGH — each claim re-derived from the file, with line ranges corrected where they drifted
- Standard stack: HIGH — no dependency decision to make; the stack is Node built-ins already in use
- Architecture / seams: HIGH — `planReconcile`'s signature, the seven bucket names and the helper contract were quoted verbatim from files opened this session
- Pitfalls: HIGH — Pitfalls 1–3 and 5 are grounded in executed probes; Pitfall 4's mechanism is documented in `manifest-cache.ts` and its control was observed working
- Findings 1 and 2: HIGH on the behavior (executed), MEDIUM on the scope call (a human decision)

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 for the in-repo facts, or until `orchestrators/plugin/{install,update,reinstall,enable-disable}.ts` or `orchestrators/reconcile/{plan,apply}.ts` next change — whichever is sooner
