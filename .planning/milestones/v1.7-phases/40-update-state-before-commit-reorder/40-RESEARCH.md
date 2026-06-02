# Phase 40: Update State-Before-Commit Reorder - Research

**Researched:** 2026-06-02
**Domain:** Orchestrator-tier state-write ordering relative to physical commits; intent-mark + finalize bracketing; per-bridge resource updates with all-or-nothing version bump; D-03 continue-on-failure preservation; retry-safety after partial-success
**Confidence:** HIGH

## Summary

Phase 40 closes the F4 / TR-04 state-write-before-commit defect in
`runThreePhaseUpdate` (`orchestrators/plugin/update.ts:825-1010`). Today the
single `swapStateRecord` call (lines 781-823, invoked at line 868) writes the
NEW version + NEW resources into state.json BEFORE any physical commit runs;
phase 3a then executes four bridge commits in skills -> commands -> agents ->
mcp order with D-03 continue-on-failure semantics
(`phase3aFailures: Phase3Failure[]` accumulator, lines 885-923); any phase-3a
failure emits a recovery-hint notification (line 927-963) but leaves state.json
already mutated. On partial failure the post-state contract LIES about disk:
state claims `version=NEW, resources.skills=NEW` while disk has `version=OLD
bytes for skills` -- a classic 2PC ghost record from the version-bump direction
(complementary to the cascade ghost record TR-03 closed in Phase 39).

The fix replaces `swapStateRecord` with two helpers: `markUpdateInProgress`
(pre-commit intent-mark setting `compatibility.installable = false` + `notes:
["update-in-progress"]`) and `finalizeUpdateRecord` (post-commit per-bridge
resource updates + all-or-nothing version bump). The intent-mark survives the
phase-3a window and is the truthful disk reality during commits. The finalize
call inspects each `phase3aFailures` entry by phase, applies `sRecord.resources.X
= newName[]` for every bridge whose commit succeeded (regardless of other
bridges' outcomes), and bumps `sRecord.version = toVersion` ONLY when
`phase3aFailures.length === 0`. On any failure the version stays at `fromVersion`
and `installable` stays `false` so a retry's preflight reads the truthful prior
version and the `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint is now structurally
mirrored on disk -- the operator can `plugin-uninstall + plugin-install` knowing
state.json agrees with what is actually on disk.

The 4-bridge x 2-outcome failure matrix (16 cases) decomposes as four "exactly
one bridge fails" tests + the all-success and all-fail boundary tests (the
existing PUP-6 + phase3a-commands-fail + phase3a-agents-fail tests already cover
multi-failure). The retry test (SC#5) seeds the truthful partial-success state
(`version=fromVersion, resources.skills=newSkillNames, disk skills=NEW`),
re-runs update with the same target, and asserts the second run reaches
`version=toVersion` without unexpected notifications. The retry contract is
load-bearing on the per-bridge `previousNames` semantics: each bridge's prepare
step reads `record.resources.X` -- after partial success those arrays are NEW,
not OLD, so the second prepare correctly rms the NEW names (which match disk),
re-stages, and renames idempotently (rename(staged, NEW-target) overwrites the
just-completed NEW-target -- file rename overwrite is atomic, skills tree
overwrite is the Phase 38 `removeOrphanIfPresent` path, agents/commands are
sequential reverse-rollback if anything throws).

The single most critical insight: the version bump and resources update have
DIFFERENT failure semantics. Resources update is PER-BRIDGE (record what
actually committed on disk); version bump is ALL-OR-NOTHING (only when all four
bridges succeed). A naive "move the whole swap to after commits" loses the
successful bridges' resources on partial failure -- the state.json-never-written
trap documented in Pitfall 4 / Pitfall 12 of `.planning/research/PITFALLS.md`.

**Primary recommendation:** Land all six SC items in a SINGLE plan
(`40-01-PLAN.md`) with **5 tasks**. The phase is the most invasive structural
change of the v1.7 milestone but has a clean decomposition: Task 1 splits
`swapStateRecord` into the two new helpers + their unit tests; Task 2 rewires
`runThreePhaseUpdate` to call intent-mark BEFORE phase-3a and finalize AFTER;
Task 3 amends the ~10-15 existing `update.test.ts` tests whose state-write
ordering assertions shift (PUP-3 unchanged stays GREEN; PUP-6 / phase3a-commands
/ phase3a-agents stay GREEN with documented post-state assertions added); Task 4
adds the 4-bridge x 2-outcome matrix tests (4 NEW tests); Task 5 adds the retry
test (1 NEW test) and runs `npm run check` to confirm phase-gate. The phase
does NOT split per-helper because the intent-mark and finalize are co-evolved
with `runThreePhaseUpdate`'s control flow and cannot be tested independently
without the wiring change; a per-helper split would create dead-code tests for
the unit-tested helpers until Task 2 lands.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Intent-mark write (pre-commit `installable: false`) | `orchestrators/plugin/update.ts::markUpdateInProgress` (NEW) | `transaction/with-state-guard.ts::withStateGuard` (atomic save) | The intent-mark is an orchestrator-tier marker that survives a process crash mid-commit, telling the next operation "this plugin is being updated; do not assume installable." `withStateGuard` provides the atomic save guarantee. |
| Per-bridge resource record update + all-or-nothing version bump | `orchestrators/plugin/update.ts::finalizeUpdateRecord` (NEW) | `transaction/with-state-guard.ts::withStateGuard` | The finalize is the only place that knows which bridges succeeded (via `phase3aFailures` inspection) and which `handles.*.result.recorded` lists hold the post-commit truth. Splitting per-bridge from version bump is the load-bearing structural contract. |
| Phase-3a continue-on-failure aggregation (D-03 preservation) | `orchestrators/plugin/update.ts::runThreePhaseUpdate` (lines 885-923, unchanged) | -- | The four try/catch blocks accumulating `phase3aFailures` are the existing D-03 contract. Phase 40 does NOT modify this -- it brackets it with intent-mark before and finalize after. |
| Recovery-hint emission on phase-3a failure | `orchestrators/plugin/update.ts::runThreePhaseUpdate` (lines 927-963, unchanged) | `notifyDirectFailure` | The `RECOVERY_PLUGIN_REINSTALL_PREFIX` notification site is preserved byte-identically. The new finalize makes the hint truthful (state actually reflects "needs reinstall" because version=OLD + installable=false). |
| ST-9 stale-version check | `markUpdateInProgress` (moved from `swapStateRecord`) | -- | ST-9 (concurrent-update detection) belongs in the intent-mark step because that's where `sRecord.version` is first read against `fromVersion`. The finalize step does NOT re-check ST-9: it has the lock held since `withStateGuard` is called twice (once per intent-mark, once per finalize) but each acquisition is independent. **CRITICAL TRADEOFF DOCUMENTED IN OPEN QUESTIONS Q1.** |
| Bridge handle ownership (`PrepHandles`) | `runThreePhaseUpdate` (unchanged) | `abortHandles` on early throw | The `handles: PrepHandles` object is constructed by `prepareUpdateHandles` and consumed by both finalize (reads `.result.recorded`) and the four `commitPrepared*` calls. Phase 40 does not relocate this. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states implementation is at Claude's discretion (discuss phase
skipped via `workflow.skip_discuss: true`). The six Success Criteria in
CONTEXT.md `<specifics>` function as locked success criteria:

1. `markUpdateInProgress` sets `sRecord.compatibility = { installable: false,
   notes: ["update-in-progress"] }` before phase-3a commits; this is the only
   state write before commits begin.
2. `finalizeUpdateRecord` applies per-bridge resource updates for every bridge
   that succeeded (independent of other bridges' outcomes); version bump
   (`sRecord.version`) occurs only when all four bridges succeed.
3. D-03 continue-on-failure contract is preserved: all four bridge commits
   attempt regardless of individual failures; `phase3aFailures[]` accumulates
   them; the existing recovery-hint emission at line ~928 fires on any failure.
4. A 4-bridge x 2-outcome failure matrix: for each bridge individually throwing
   while the other three succeed, the post-run `state.json` reflects the
   correct per-bridge resources update (committed bridges updated, failing
   bridge resources unchanged) and version unchanged.
5. A retry test seeds partial-success state (`version=OLD,
   resources.skills=NEW, disk skills=NEW`) and runs update again; the second
   run reaches `version=NEW` without unexpected notifications.
6. `npm run check` GREEN; `update.test.ts` test count change accounted for
   (~10-15 test rewrites expected).

### Claude's Discretion

All implementation choices (where to place the two helpers, whether
`compatibility.supported/.unsupported` carry forward through intent-mark or
reset, exact ST-9 re-check policy on finalize, test-file taxonomy for the new
4-bridge matrix) are at Claude's discretion. The SUMMARY.md flags this as the
**most invasive structural change of v1.7**; the planner should draft a
state-contract table (16 cases) before writing the implementation spec.

### Deferred Ideas (OUT OF SCOPE)

None per CONTEXT.md. The milestone-wide `TR-D01` (WAL-style audit trail) is
explicitly out of scope per `.planning/REQUIREMENTS.md:79` -- "TR-04 is
ordering fix only." A `state.json` schema migration to add a top-level
transaction-id is NOT introduced. The intent-mark uses the EXISTING
`compatibility: { installable, notes, supported, unsupported }` shape (verified
at `persistence/state-io.ts:41-46`).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TR-04 | `runThreePhaseUpdate` in `orchestrators/plugin/update.ts` splits `swapStateRecord` into `markUpdateInProgress` (sets `installable:false` as intent-mark before phase-3a commits) and `finalizeUpdateRecord` (per-bridge resource-record update regardless of other bridges' outcomes; version bump only on all-success); D-03 continue-on-failure semantics preserved; the 4-bridge x 2-outcome failure matrix (16 cases) is covered by tests, including a retry test that seeds partial-success state and verifies a second update reaches the correct final state. | Fix site verified at `update.ts:781-823` (current `swapStateRecord`) and `update.ts:867-923` (current control flow: `swapStateRecord` -> phase-3a continue-on-failure with `phase3aFailures[]`). Schema for `compatibility.installable` + `notes` verified at `state-io.ts:41-46`. ST-7 contract verified at `with-state-guard.ts:50-76` (save-only-on-no-throw). |

## Project Constraints (from CLAUDE.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Conventional Commits, titles >=5 and <=72 chars, body lines <=80 chars | CLAUDE.md "Git" | Commits land as `fix(orchestrators):` or `refactor(orchestrators):` -- never `chore:`. Body lines should reference TR-04 + SC#1..6. |
| `pre-commit run --all-files` before commit; fix failures, restage, re-run | CLAUDE.md "Git" | Implementation tasks MUST verify hooks pass before commit. |
| `SKIP=trufflehog` prefix only when committing from a worktree | CLAUDE.md "Git" | Not applicable -- working on `features/transaction-resilience-hardening` branch (not a worktree). |
| TypeScript strict; discriminated `installable: true \| false` (NFR-7) | CLAUDE.md "Constraints" | The intent-mark sets `installable: false` -- this IS the discriminated-union NFR-7 was designed for. No type changes required; the schema already permits both values. |
| Atomic file ops (NFR-1) | CLAUDE.md "Constraints" | Both `markUpdateInProgress` and `finalizeUpdateRecord` wrap their mutations in `withStateGuard` which uses `write-file-atomic` via `saveState` -- atomic save preserved. |
| Recovery via `/reload` only (NFR-2) | CLAUDE.md "Constraints" | The fix STRENGTHENS NFR-2: an interrupted update now leaves state at `installable: false` so the next `/reload` + retry sees the truthful prior version and the `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint is structurally mirrored on disk. |
| Retry-safe (NFR-3) | CLAUDE.md "Constraints" | SC#5 IS the NFR-3 enforcement: the retry test proves second-run idempotency on partial-success state. |
| Containment refusal (NFR-10) | CLAUDE.md "Constraints" | Not directly touched -- no new FS path operations. |
| Output via `ctx.ui.notify` only (IL-2) | CLAUDE.md "Constraints" | The recovery-hint emission at line 927-963 (`notifyDirectFailure`) is unchanged byte-for-byte. The intent-mark and finalize calls write state.json only, never notify. |
| `npm run check` must stay GREEN (NFR-6) | CLAUDE.md "Constraints" | Phase-gate validation; SC#6 enforces this. |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow Enforcement" | Implementation MUST proceed via `/gsd-execute-phase`, not direct edits. |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `^5.9.3` | Strict-mode discriminated `installable: true \| false`; `compatibility.notes` is `Type.Array(Type.String())` | `[VERIFIED: package.json + tsconfig.json + state-io.ts:42-43]`. |
| `node:test` | bundled with Node >=20.19.0 | Test framework for the 16-case matrix + retry test | `[VERIFIED: tests/orchestrators/plugin/update.test.ts:6 already uses it]`. |
| `node:assert/strict` | bundled with Node >=20.19.0 | `assert.deepEqual`, `assert.equal`, `assert.ok`, `assert.match` | `[VERIFIED: tests/orchestrators/plugin/update.test.ts:1]`. |
| `write-file-atomic` | `^8.0.0` | Atomic state.json write inside both intent-mark and finalize | `[VERIFIED: shared/state-write via withStateGuard]`. Carry forward. |
| `proper-lockfile` | `^4.1.2` | Cross-process scope lock around each `withStateGuard` call | `[VERIFIED: with-state-guard.ts:155-163]`. Carry forward. |

### No new dependencies

`.planning/research/SUMMARY.md` lines 36-50: "No new dependencies. All eight
TR-* fixes stay within `extensions/pi-claude-marketplace/`." Phase 40
specifically requires zero new packages. The intent-mark uses the existing
`compatibility` shape (`installable, notes, supported, unsupported`); the
finalize uses the existing `handles.X.result.recorded.map(r =>
r.generatedName)` extraction pattern (verified at `update.ts:808-812` in the
current `swapStateRecord`).

## Package Legitimacy Audit

Not applicable -- Phase 40 installs no new packages. The fix is in-place
restructuring of one orchestrator function (`runThreePhaseUpdate`) and the
introduction of two new helper functions in the same file plus regression
tests using already-installed `node:test` and `node:assert/strict` built-ins.

## Architecture Patterns

### System Architecture Diagram

```
   updatePlugins(opts) [direct path]      updateSinglePlugin(...)  [cascade path]
        │                                       │
        ▼                                       ▼
   for each ResolvedTarget                  try { runThreePhaseUpdate(cascade:true) }
        │                                   catch -> partition='failed' outcome
        ▼
   try { runThreePhaseUpdate(cascade:false) }
   catch -> notifyDirectFailure (phase-2-or-earlier throw)

   ┌─── runThreePhaseUpdate (POST-FIX) ──────────────────────────────────────┐
   │                                                                          │
   │   preflightUpdate                                                        │
   │     │                                                                    │
   │     ▼                                                                    │
   │   unchanged? skipped? failed? -> return outcome (no state write yet)     │
   │     │                                                                    │
   │     ▼ (PUP-3/4/5 short-circuits passed; entering 3-phase swap)           │
   │                                                                          │
   │   discoverGeneratedNames + assertNoCrossPluginConflicts                  │
   │     │                                                                    │
   │     ▼                                                                    │
   │   prepareUpdateHandles -> { handles: PrepHandles, .result.recorded.* }   │
   │     │                                                                    │
   │     ▼                                                                    │
   │ ◄┐  markUpdateInProgress(args, preflight) [NEW]                          │
   │  │   withStateGuard:                                                     │
   │  │     ST-9 stale-version check on sRecord.version === fromVersion       │
   │  │     sRecord.compatibility = { installable: false,                     │
   │  │                               notes: ["update-in-progress"],          │
   │  │                               supported: [...preflight....supported], │
   │  │                               unsupported: [...preflight...] }        │
   │  │   guard saves -> intent-mark on disk                                  │
   │  │     │                                                                 │
   │  │     ▼ throw on ST-9 mismatch -> caller aborts handles, rethrows       │
   │  │                                                                       │
   │  ▼  Phase 3a: physical commits (D-03 continue-on-failure, UNCHANGED)     │
   │      ┌──────────────────────────────────────────────────────────────┐    │
   │      │ try commitPreparedSkills   catch -> phase3aFailures.push     │    │
   │      │ try commitPreparedCommands catch -> phase3aFailures.push     │    │
   │      │ try commitPreparedAgents   catch -> phase3aFailures.push     │    │
   │      │ try commitPreparedMcp      catch -> phase3aFailures.push     │    │
   │      └──────────────────────────────────────────────────────────────┘    │
   │                          │                                                │
   │                          ▼                                                │
   │   finalizeUpdateRecord(args, preflight, handles, phase3aFailures) [NEW]  │
   │   withStateGuard:                                                        │
   │     compute failedPhases = new Set(phase3aFailures.map(f => f.phase))    │
   │     for each bridge in {skills, commands, agents, mcp}:                  │
   │       if NOT failedPhases.has(bridge):                                   │
   │         sRecord.resources.<schemaField(bridge)> =                        │
   │           handles.<bridge>.result.recorded.map(r => r.generatedName)     │
   │     if phase3aFailures.length === 0:                                     │
   │       sRecord.version = toVersion                                        │
   │       sRecord.compatibility = { installable: true, notes: [...],         │
   │                                 supported: [...], unsupported: [...] }   │
   │       sRecord.resolvedSource = installable.pluginRoot                    │
   │     ELSE:                                                                │
   │       sRecord.compatibility stays { installable: false,                  │
   │                                     notes: ["update-in-progress"] }     │
   │       sRecord.version stays fromVersion                                  │
   │     sRecord.updatedAt = new Date().toISOString()                         │
   │   guard saves -> final state on disk                                     │
   │                          │                                                │
   │                          ▼                                                │
   │   if phase3aFailures.length > 0:                                         │
   │     emit notifyDirectFailure with PluginUpdatePhase3Error                │
   │     return partition='failed' outcome with phaseFailures                 │
   │   else: dropPluginCompletionCache; return partition='updated' outcome    │
   └──────────────────────────────────────────────────────────────────────────┘

   Bridge -> schema-field mapping (CRITICAL, mirrors Phase 39 asymmetry):
     skills    -> resources.skills
     commands  -> resources.prompts    ◄── note the asymmetry (same as TR-03)
     agents    -> resources.agents
     mcp       -> resources.mcpServers
```

### Recommended Project Structure

No new files. The fix is in-place across one existing source file plus one
existing test file:

```
extensions/pi-claude-marketplace/
└── orchestrators/
    └── plugin/
        └── update.ts          # MODIFIED:
                               #   - REMOVE swapStateRecord (lines 781-823)
                               #   - ADD markUpdateInProgress
                               #   - ADD finalizeUpdateRecord
                               #   - rewire runThreePhaseUpdate (line 867-989)
                               #     to call intent-mark BEFORE phase-3a,
                               #     finalize AFTER phase-3a, BEFORE the
                               #     phase-3b aggregate-or-success branch

tests/
└── orchestrators/
    └── plugin/
        └── update.test.ts     # MODIFIED:
                               #   - PRESERVE PUP-3 (unchanged path; no state
                               #     write at all -- preflight short-circuit)
                               #   - PRESERVE PUP-6, phase3a-commands-fail,
                               #     phase3a-agents-fail (existing failure-
                               #     trigger tests stay GREEN; add post-state
                               #     assertions per the 16-case matrix)
                               #   - PRESERVE WR-04 success test (verify
                               #     finalize wrote version=NEW + installable=true)
                               #   - APPEND 4 NEW per-bridge matrix tests
                               #     (each: bridge X fails, others succeed)
                               #   - APPEND 1 NEW retry test (partial-success
                               #     seed -> second run reaches version=NEW)
```

### Pattern 1: Intent-mark helper (`markUpdateInProgress`)

**What:** Replace the pre-commit half of `swapStateRecord` with a focused helper
that sets `installable: false` + `notes: ["update-in-progress"]` and performs
the ST-9 stale-version check. The version bump and resources mutation move OUT
of this call.

**Why required:** SC#1 -- "this is the only state write before commits begin."
The intent-mark is what makes a process crash mid-commit recoverable: the next
`/reload` sees `installable: false` and the `list` rendering can surface
"update in progress" while a retry re-attempts.

**Example shape:**

```typescript
// Source: research synthesis grounded in update.ts:781-823 (current
// swapStateRecord) and state-io.ts:41-46 (compatibility schema).

async function markUpdateInProgress(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { fromVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
    }

    // ST-9: stale-version check (MOVED here from swapStateRecord).
    if (sRecord.version !== fromVersion) {
      throw new Error(
        `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
      );
    }

    // Intent-mark: ONLY state write before phase-3a. Version stays at
    // fromVersion; resources stay at their pre-update names; only
    // compatibility flips to installable:false with the locked notes
    // marker.
    sRecord.compatibility = {
      installable: false,
      notes: ["update-in-progress"],
      // Preserve the pre-update supported/unsupported arrays. These are
      // diagnostic-only (the renderer surfaces them on `list`); they
      // become stale once we know the new entry's manifest, but the
      // finalize step re-writes them on all-success. On failure they
      // stay at the pre-update view, which is the truthful "we did not
      // complete the swap" state.
      supported: [...sRecord.compatibility.supported],
      unsupported: [...sRecord.compatibility.unsupported],
    };
  });
}
```

**Critical notes:**

- **Why ST-9 is here, not in finalize:** ST-9 is the "concurrent-update was
  attempted" detector and MUST fire BEFORE physical commits run. Putting it in
  finalize would let two concurrent updates both proceed to phase-3a and trash
  each other's disk state. The intent-mark site is the right ST-9 surface.
- **`compatibility.notes = ["update-in-progress"]` is the load-bearing marker.**
  It is a CONTRACT visible to anyone reading state.json (the `list` rendering,
  the next `update` retry's preflight, an operator debugging from `cat
  state.json`). Lock the string in a module-level constant so refactors do not
  silently drift the marker text.
- **`supported`/`unsupported` carry forward unchanged on intent-mark.** The
  pre-update view IS the truthful current state during the intent-mark window.
  Finalize re-writes them on success. On failure they correctly stay at the
  pre-update view (we did not finish the swap).
- **No `resolvedSource` mutation in intent-mark.** Same reasoning -- finalize
  overwrites on success; on failure it stays at the pre-update install path.
- **Throw on guard mismatch propagates per ST-7.** A throw here aborts the
  save (intent-mark not committed) and propagates to the caller's catch where
  `abortHandles` runs.

### Pattern 2: Finalize helper (`finalizeUpdateRecord`)

**What:** A post-phase-3a helper that inspects `phase3aFailures` to decide which
resource arrays to update and whether to bump the version. Per-bridge resource
update is independent across bridges; version bump is all-or-nothing.

**Why required:** SC#2 -- "applies per-bridge resource updates for every bridge
that succeeded (independent of other bridges' outcomes); version bump occurs
only when all four bridges succeed."

**Example shape:**

```typescript
// Source: research synthesis grounded in update.ts:781-823 (current
// swapStateRecord), update.ts:807-822 (post-success mutations), and
// shared/errors.ts::Phase3Failure (the .phase field).

const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "mcp"] as const;
type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];

async function finalizeUpdateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
  phase3aFailures: readonly Phase3Failure[],
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { installable, toVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during finalize of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled during finalize.`);
    }

    // Compute the failed-phase set for per-bridge gating.
    const failedPhases = new Set<Phase3Phase>(
      phase3aFailures.map((f) => f.phase as Phase3Phase),
    );

    // SC#2: per-bridge resource update. Each bridge that did NOT fail
    // writes its new generated names into the corresponding state field.
    // Field-name mapping mirrors the Phase 39 asymmetry:
    //   skills    -> resources.skills
    //   commands  -> resources.prompts   (asymmetry locked by schema)
    //   agents    -> resources.agents
    //   mcp       -> resources.mcpServers
    if (!failedPhases.has("skills")) {
      sRecord.resources.skills = handles.skills.result.recorded.map(
        (r) => r.generatedName,
      );
    }
    if (!failedPhases.has("commands")) {
      sRecord.resources.prompts = handles.commands.result.recorded.map(
        (r) => r.generatedName,
      );
    }
    if (!failedPhases.has("agents")) {
      sRecord.resources.agents = handles.agents.result.recorded.map(
        (r) => r.generatedName,
      );
    }
    if (!failedPhases.has("mcp")) {
      sRecord.resources.mcpServers = handles.mcp.result.recorded.map(
        (r) => r.generatedName,
      );
    }

    // SC#2: version bump is ALL-OR-NOTHING. The intent-mark stays in
    // place on any failure so a retry's preflight sees installable=false
    // and the operator-visible "update-in-progress" marker survives.
    if (phase3aFailures.length === 0) {
      sRecord.version = toVersion;
      sRecord.compatibility = {
        installable: true,
        notes: [...installable.notes],
        supported: [...installable.supported],
        unsupported: [...installable.unsupported],
      };
      sRecord.resolvedSource = installable.pluginRoot;
    }
    // On failure: compatibility stays at the intent-mark
    // { installable:false, notes:["update-in-progress"] } set by
    // markUpdateInProgress. version stays at fromVersion. resolvedSource
    // stays at the pre-update install path.

    sRecord.updatedAt = new Date().toISOString();
  });
}
```

**Critical notes:**

- **`Phase3Failure.phase` typed as `string` -> narrowed to `Phase3Phase`.** The
  existing `shared/errors.ts::Phase3Failure` interface declares `phase: string`.
  The fix uses a `as Phase3Phase` cast inside the `Set` construction OR a
  type-guard predicate function. Recommended: declare the closed-set tuple at
  module top + narrow defensively. A future fifth bridge would require updating
  this tuple (audit point).
- **`installable: ResolvedPluginInstallable` carries `notes`, `supported`,
  `unsupported` arrays.** Verified at the existing swapStateRecord call site
  (lines 814-819). Copy via spread.
- **Why not delete `sRecord.compatibility.notes = ["update-in-progress"]` on
  failure?** Because the intent-mark IS the truthful state. Stripping the
  marker on failure would lie about whether the swap was attempted. The
  `list` rendering shows `(installable: false) {update-in-progress}` so the
  operator sees the in-progress marker and knows to retry.
- **Per-bridge filter mirrors Phase 39's TR-03 mapping** -- `commands` ->
  `prompts` asymmetry is identical. Document the mapping as a comment.
- **A second `withStateGuard` call is the load-bearing structural change.**
  The existing single-guard model conflates intent-mark + version bump. Phase
  40 splits them into two atomic windows. Each window takes the per-scope lock
  independently. Open Q1 discusses the ST-9 re-check tradeoff in the finalize
  window.

### Pattern 3: `runThreePhaseUpdate` rewiring

**What:** Replace the single `swapStateRecord` call site (line 868) with a
sequence: `markUpdateInProgress` -> phase-3a (unchanged) -> `finalizeUpdateRecord`.
The recovery-hint emission and the `partition='failed' / 'updated'` outcome
returns stay byte-for-byte identical.

**Example shape (post-fix `runThreePhaseUpdate` skeleton):**

```typescript
async function runThreePhaseUpdate(args: ThreePhaseArgs): Promise<PluginUpdateOutcome> {
  const { plugin, marketplace, scope } = args;

  const preflight = await preflightUpdate(args);
  if (isOutcome(preflight)) {
    return preflight;
  }
  const { installable, fromVersion, toVersion } = preflight;

  // Pre-phase: discover generated names + cross-plugin guard + prepare handles.
  const generatedNames = await discoverGeneratedNames(plugin, installable);
  const stateForGuard = removePluginRecord(preflight.state, marketplace, plugin);
  assertNoCrossPluginConflicts(scope, generatedNames, stateForGuard);
  const handles = await prepareUpdateHandles(args, preflight, generatedNames.agentsSourceDir);

  // NEW: Phase 2a -- intent-mark (replaces swapStateRecord).
  try {
    await markUpdateInProgress(args, preflight);
  } catch (err) {
    // Intent-mark failure (e.g., ST-9 stale-version): abort prep handles + rethrow.
    throw appendLeaks(err, await abortHandles(handles));
  }

  // Phase 3a: physical replace -- D-03 continue-on-failure (UNCHANGED).
  const phase3aFailures: Phase3Failure[] = [];

  try {
    const leak = await commitPreparedSkills(handles.skills);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedCommands(handles.commands);
  } catch (err) {
    phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
  }

  try {
    const leak = await commitPreparedAgents(handles.agents);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "agents",
        msg: `agents staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "agents", msg: errorMessage(err), cause: err });
  }

  try {
    await commitPreparedMcp(handles.mcp);
  } catch (err) {
    phase3aFailures.push({ phase: "mcp", msg: errorMessage(err), cause: err });
  }

  // NEW: Phase 2b -- finalize (per-bridge resources + all-or-nothing version).
  // This call ALWAYS runs, regardless of phase3aFailures.length. The
  // resource arrays for succeeded bridges are recorded; version+installable
  // bump only on the all-success path.
  //
  // The finalize MUST run BEFORE the phase-3b recovery-hint emission so the
  // recovery hint is structurally backed by a truthful state.json.
  try {
    await finalizeUpdateRecord(args, preflight, handles, phase3aFailures);
  } catch (finalizeErr) {
    // Finalize failure (e.g., ST-9 race during finalize, write-file-atomic
    // failure): this is bad -- physical commits succeeded but state was not
    // updated. The state is now stale (intent-mark still on disk; version
    // unchanged; resources unchanged). User-visible: an extra failure
    // notification on top of any phase-3a failures. Wrap into the aggregate
    // path so the recovery hint fires.
    phase3aFailures.push({
      phase: "mcp", // last-phase synthetic; the error message identifies finalize
      msg: `state finalize failed: ${errorMessage(finalizeErr)}`,
      cause: finalizeErr,
    });
  }

  // Phase 3b: aggregate error path OR success (UNCHANGED below this line).
  if (phase3aFailures.length > 0) {
    const recoveryHint = `${RECOVERY_PLUGIN_REINSTALL_PREFIX} "${plugin}".`;
    const aggregateMsg = `Plugin "${plugin}" update failed during physical replace. ${recoveryHint}`;
    const firstCause = phase3aFailures[0]?.cause;
    const aggregate = new PluginUpdatePhase3Error(
      aggregateMsg,
      phase3aFailures,
      aggregateCause(firstCause),
    );
    if (isDirectUpdate(args) && args.ctx !== undefined && args.pi !== undefined) {
      notifyDirectFailure({
        ctx: args.ctx,
        pi: args.pi,
        marketplace: args.marketplace,
        scope: args.scope,
        pluginName: args.plugin,
        err: aggregate,
        reasonOverride: "rollback partial" as const,
        rollbackPartial: phase3aFailures,
      });
    }
    return {
      partition: "failed",
      name: plugin,
      fromVersion,
      toVersion,
      notes: [aggregateMsg, ...phase3aFailures.map((f) => `${f.phase}: ${f.msg}`)],
      reasons: ["rollback partial"] as const,
      phaseFailures: phase3aFailures.map((f) => ({ phase: f.phase, msg: f.msg })),
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  // Success: cache drop + outcome (UNCHANGED).
  const stagedAgents = handles.agents.result.recorded.map((r) => r.generatedName);
  const stagedMcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
  await dropPluginCompletionCache(args);
  return {
    partition: "updated",
    name: plugin,
    fromVersion,
    toVersion,
    stagedAgents,
    stagedMcpServers,
    declaresAgents: stagedAgents.length > 0,
    declaresMcp: stagedMcpServers.length > 0,
  };
}
```

**Critical notes:**

- **The recovery-hint emission site is byte-identical** -- `notifyDirectFailure`
  with `reasonOverride: "rollback partial"` and the `rollbackPartial:
  phase3aFailures` children. PUP-6 + phase3a-commands-fail + phase3a-agents-fail
  tests stay GREEN.
- **Finalize-failure path threads through the same recovery hint.** A
  finalize error is technically a state-write failure (physical commits
  succeeded). The fix routes it through the same `phase3aFailures` aggregator
  with a synthetic `phase: "mcp"` entry. This is a TRADEOFF documented in
  Pitfall 6 -- a cleaner alternative is a dedicated `phase: "finalize"` member
  on `Phase3Failure.phase`, but that requires shared/errors.ts schema change.
- **Order matters: finalize BEFORE the phase-3b branch.** If finalize ran AFTER
  the recovery-hint emission, a finalize failure on the success path would
  emit a success notification then fail to write state -- worst of both worlds.
- **The two-guard model breaks the existing single-`withStateGuard` test
  invariants** -- any test that asserts "state.json was written exactly once"
  will now see TWO writes. The PUP-3 unchanged test (line 265-316) asserts
  `before === after` and stays GREEN because the preflight short-circuit
  returns BEFORE any guard call. Other tests need post-state assertions.

### Anti-Patterns to Avoid

- **Single `withStateGuard` wrapping intent-mark + commits + finalize.** That
  would hold the cross-process lock across the entire phase-3a commits window
  (potentially seconds for large plugins). The Phase 7 D-06 lock discipline
  explicitly bounds lock-hold to load-mutate-save -- holding it across
  filesystem renames would block concurrent installs in other marketplaces
  unnecessarily. Use TWO separate `withStateGuard` calls (intent-mark +
  finalize).
- **`withLockedStateTransaction` for explicit save control.** This is a Phase 8
  PRL-10 facility for reinstall's rollback-window. The Phase 40 finalize does
  NOT need explicit save control -- it always saves (the only branching is
  inside the closure: whether to bump version). `withStateGuard` is the right
  shape.
- **Stripping `compatibility.notes = ["update-in-progress"]` on the failure
  finalize path.** That would lie about whether the swap was attempted. The
  marker is the truthful in-progress signal. Keep it.
- **Bumping `installable: true` on the failure finalize path.** A failed
  update means the plugin is in a partial state; `installable: true` would
  let `list` render it as healthy. Keep `installable: false` until a
  successful retry completes.
- **Re-checking ST-9 inside `finalizeUpdateRecord`.** A second ST-9 race-window
  test would over-fire on the legitimate case of "this same process did the
  intent-mark, then did the phase-3a commits, then doing finalize." The intent
  of ST-9 is "another PROCESS stole the update slot." Within a single
  process's phase-3a window, the version stays at fromVersion (intent-mark
  did not bump it), and no other process can take the lock because each
  withStateGuard re-acquires the same scope lock (so concurrent updates from
  another process WOULD have been blocked from taking the lock for THEIR
  intent-mark). See Open Q1 for the tradeoff.
- **Materializing `phase3aFailures.map(f => f.phase)` into a `string[]` for
  set membership.** Use `Set<Phase3Phase>` for compile-time exhaustiveness
  against the closed-set tuple. A future fifth bridge would surface as a TS
  error at the `f.phase as Phase3Phase` cast.
- **Adding a `phase: "finalize"` member to `Phase3Failure.phase` schema.**
  That is a `shared/errors.ts` change with cross-cutting consumer impact
  (renderer, persistence). The fix threads finalize failure as a synthetic
  `phase: "mcp"` entry per Pitfall 6; if that proves user-confusing, the
  schema change is deferred to a follow-up (Open Q3).
- **Skipping `dropPluginCompletionCache` on the failure path.** Currently it
  only runs on success (line 999). Phase 40 preserves this: the failure
  path returns the `partition='failed'` outcome before reaching
  `dropPluginCompletionCache`. The completion cache may now contain stale
  entries pointing at a partial-success state, but the next user action
  (e.g., `list` or a retry update) refreshes the cache. NFR-2 honoured.
- **Naming the helpers `swapStateRecordPre` / `swapStateRecordPost`.** Names
  must reflect intent, not split mechanics. `markUpdateInProgress` and
  `finalizeUpdateRecord` are the contract-level names locked by CONTEXT.md
  SC#1 and SC#2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic state save | Hand-rolled tmp+rename | `withStateGuard` -> `saveState` -> `write-file-atomic` | Already validated through 6 prior milestones; NFR-1 contract. |
| Cross-process exclusion during finalize | New lockfile primitive | `withStateGuard`'s `proper-lockfile` `.state-lock` | Each guard call re-acquires the per-scope lock. No new locking surface. |
| Failed-phase set extraction | New `inferFailedPhases(failures)` predicate module | Inline `new Set<Phase3Phase>(phase3aFailures.map(f => f.phase as Phase3Phase))` at the finalize call site | The closure is a 1-liner; extracting it obscures the closed-set typing. Match the inline locality discipline established in Phase 39. |
| Phase-3 failure aggregation | New `Phase3Aggregator` class with per-bridge accumulation | The existing 4 try/catch blocks with `phase3aFailures.push(...)` | The existing pattern is correct and tested; Phase 40 does not touch it. |
| Intent-mark marker text repository | New `intent-marks.ts` module with constants | Module-level `const UPDATE_IN_PROGRESS_NOTE = "update-in-progress"` inside `update.ts` | One marker, one consumer, one test -- no premature abstraction. |
| Per-test state-recovery helper | New `readStateOnDisk(locations)` test helper | The existing `loadState(locations.extensionRoot)` from `persistence/state-io.ts` | Already imported and used at `update.test.ts:18`. |

**Key insight:** The fix is structural at one call site (`runThreePhaseUpdate`
lines 867-989) with two new helpers locally scoped to the same file. The
temptation to extract `intent-marks.ts` or `state-mutation-helpers.ts` modules
is documented as YAGNI -- there is one consumer, one marker, and the
two-helper split is the load-bearing contract that should stay near its caller
for readability.

## Runtime State Inventory

Not applicable in the standard rename/migration sense, but Phase 40 introduces
a NEW state-record value (`compatibility.installable = false` with
`notes: ["update-in-progress"]`) that callers reading state.json need to
tolerate. The schema is unchanged (TypeBox already permits `installable:
boolean` and `notes: string[]` per state-io.ts:42-43), so no migration is
required, but the new value lands on disk during the intent-mark window.

- **Stored data:** state.json schema unchanged. The intent-mark value
  `compatibility: { installable: false, notes: ["update-in-progress"] }` is a
  new operational state. The renderer surface for `list` should display this
  as `(installable: false) {update-in-progress}` per the existing
  `compatibility` rendering contract (verified at `shared/notify.ts` install
  surface). **Verify:** check `tests/shared/notify.test.ts` for any test
  asserting compatibility rendering that would surface the new marker; expect
  no change because the renderer already handles arbitrary `notes` strings.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: State-write-after-only-all-success regression (the trap SC#2 prevents)

**What goes wrong:** The "obvious" fix is to move ALL of `swapStateRecord` to
after phase-3a and guard it on `phase3aFailures.length === 0`. This makes the
happy-path tests (PUP-3 unchanged, WR-04 success) GREEN and the phase-3a
failure tests (PUP-6 + phase3a-commands-fail + phase3a-agents-fail) GREEN
(those tests only assert the recovery-hint notification, not state.json
contents) -- but loses the per-bridge truth: skills committed to disk, but
state.json never wrote `resources.skills = newNames`, so the next retry's
preflight reads OLD names, the bridge prepares against OLD names, the rename
overwrites the NEW disk content with a re-staged tree, and the failed bridge
(e.g., agents) re-fails -- BUT now skills is in a different post-fix shape
than before the first attempt.

**Why it happens:** The PITFALLS.md Pitfall 12 trap exactly -- "writing state
only when all commits succeed means state never writes on any failure path,
which is silently the wrong fix."

**How to avoid:**
1. Enforce SC#2 in the helper itself: the per-bridge gating is `if
   (!failedPhases.has(bridge))`, NOT `if (failedPhases.size === 0)`.
2. The 4-bridge x 2-outcome matrix tests are the load-bearing regression
   gate. Each of the 4 NEW tests asserts that the FAILING bridge's
   `resources.X` stays at the pre-update value AND the SUCCEEDING bridges'
   `resources.X` reflect the new generated names.
3. Code review checklist: search for any use of `phase3aFailures.length ===
   0` inside finalize that gates a resource update (only the version bump
   should gate on it).

**Warning signs:** A finalize implementation that writes nothing on the
failure path. Re-read SC#2 -- "applies per-bridge resource updates for every
bridge that succeeded (independent of other bridges' outcomes)."

### Pitfall 2: Test count change masks regressions (the ~10-15 rewrite trap)

**What goes wrong:** The CONTEXT.md SC#6 wording acknowledges ~10-15 test
rewrites. The trap is two-fold: (a) "rewriting" tests that previously asserted
`state.json contained version=NEW immediately` to "now state.json contains
version=NEW after finalize" silently weakens the test; (b) tests that
previously asserted a SINGLE state.json write may now silently see TWO writes
without noticing because their assertions never checked write count.

**Why it happens:** The PITFALLS.md "Integration Pitfall: Test Suite
Co-Adaptation" trap. Tests pinned through SPECIFIC failure injection (the
PUP-6 file obstacle, the phase3a-commands directory obstacle) stay GREEN
under the new contract -- but the new contract has different state.json
post-failure semantics that none of the existing tests assert.

**How to avoid:**
1. **Enumerate the ~10-15 tests up front.** Grep for tests that assert
   `state.json` contents on the failure path -- they are the ones that need
   post-state assertions added (NOT replaced).
2. **Add post-state assertions, do NOT replace failure-trigger seeds.** The
   PUP-6 file obstacle, the phase3a-commands directory obstacle, and the
   phase3a-agents directory obstacle MUST stay intact (per Phase 38's TR-06
   discipline -- the obstacle text is `"obstacle"` which is not in any
   plugin's resources list, so the Phase 38 `removeOrphanIfPresent` does NOT
   touch it; the rename fails as before; phase3aFailures populates as
   before).
3. **For each preserved test, add an `await loadState(...)` post-assertion
   block** that checks `state.marketplaces.mp.plugins.hello.version` against
   the expected value AND each `resources.X` against the per-bridge
   succeeded/failed expectation.
4. **The PUP-3 unchanged test stays UNTOUCHED.** Preflight short-circuits
   before any `withStateGuard` call; the existing `before === after`
   assertion remains accurate.

**Warning signs:** A PR diff that DELETES test seeds. A PR diff that updates
PUP-6's `assert.equal(notifications.length, 1)` to `assert.equal(...
length, 2)` -- the recovery-hint emission should remain a single
notification.

### Pitfall 3: ST-9 race after intent-mark (the "two `withStateGuard` calls" tradeoff)

**What goes wrong:** The Phase 40 fix replaces one `withStateGuard` call with
two (intent-mark + finalize). Between those two calls, phase-3a commits run
WITHOUT the per-scope lock held. Another process could (in principle) acquire
the lock, observe `installable: false` and `notes: ["update-in-progress"]`,
and decide to retry the update -- bumping the version while phase-3a is still
running.

**Why it happens:** The Phase 7 D-06 lock discipline bounds lock-hold to
load-mutate-save. Holding the lock across phase-3a renames would block
concurrent operations in other plugins of the same scope unnecessarily.

**How to avoid:**
1. **The intent-mark IS the cross-process coordination signal.** A second
   process observing `installable: false` + `notes: ["update-in-progress"]`
   on a plugin record SHOULD treat that plugin as "in flight" and skip it.
   No second process should bump the version of a record marked
   `installable: false`.
2. **Implementation discipline:** the next `preflightUpdate` retry detects
   the intent-mark and either (a) treats it as a stale lock if the
   `updatedAt` timestamp is older than a threshold (out of scope for v1.7 --
   no GC sweeper exists) or (b) proceeds with the retry knowing the previous
   attempt did not complete (correct -- the retry's intent-mark overwrites
   the prior intent-mark, then the retry's commits idempotently overwrite
   disk -- skills/commands/agents/mcp bridges are idempotent on commit).
3. **Document the contract** in the JSDoc on `markUpdateInProgress`: "a
   process observing this state in a subsequent operation MUST treat it as
   in-flight or as the artifact of a crashed attempt; either way, the next
   `update` call is the recovery path."
4. **Do NOT re-check ST-9 in finalize.** The finalize is called inside the
   SAME process that ran the intent-mark. Adding a finalize-time ST-9
   re-check would over-fire on the legitimate "we ran intent-mark, ran
   phase-3a, want to finalize" case (the sRecord.version is still
   fromVersion because intent-mark did not bump it). See Open Q1 for the
   rejected alternative.

**Warning signs:** A test that uses two concurrent processes to drive
update against the same plugin and assert specific race outcomes. Defer to
Open Q1 -- no such test is in the required SC#5; if needed, that is a
v1.8+ test.

### Pitfall 4: Finalize-failure routing (the "physical commits succeeded but state failed" trap)

**What goes wrong:** If `finalizeUpdateRecord` throws (e.g., due to a
write-file-atomic IO failure, a lock contention timeout), phase-3a's
physical commits already succeeded. The state.json on disk is in the
intent-mark state (`installable: false`, `notes:
["update-in-progress"]`); disk is in the NEW-version state (skills/commands
/agents/mcp committed). The user sees... what?

**Why it happens:** Phase 40's two-window design has a third window between
"phase-3a complete" and "finalize complete" that is technically NOT atomic
(though both windows are individually atomic). A finalize throw means the
user is in this no-op-or-recovery state.

**How to avoid:**
1. **Route finalize failure through `phase3aFailures` aggregation.** Push a
   synthetic `phase: "mcp"` (the last bridge) failure with msg `"state
   finalize failed: <error>"` into `phase3aFailures`. This trips the
   `phase3aFailures.length > 0` branch, fires the recovery-hint
   notification, and the user sees `RECOVERY_PLUGIN_REINSTALL_PREFIX`.
   The user-action is reinstall, which is the correct recovery for the
   "disk is NEW but state says installable:false" state.
2. **Document the synthetic phase choice** in code -- a comment at the catch
   block: "finalize failures synthesize as a `mcp`-phase failure to route
   through the existing recovery-hint pipeline; the msg field carries the
   finalize-specific cause text."
3. **Open Question Q3:** consider adding `phase: "finalize"` as a Phase3Failure
   member in v1.8 if the synthetic-`mcp` muddles user-facing diagnostics.
   For v1.7 the synthetic is correct: the marker output for `(failed)
   {rollback partial}` is identical regardless of which phase string is
   attached.
4. **Test:** the matrix tests do NOT need to cover finalize-failure (the
   four bridges throw scenarios cover the routing). A dedicated
   finalize-failure test would require mocking `withStateGuard` to throw on
   the second call -- complex setup. Defer to v1.8 if surface-area emerges.

**Warning signs:** A try/catch around `finalizeUpdateRecord` that re-throws.
The throw MUST be routed through `phase3aFailures` so the recovery-hint
pipeline fires; otherwise the user sees a raw uncaught exception (which the
direct-path's `notifyDirectFailure` would catch, but the cascade path's
silent partition='failed' would only log).

### Pitfall 5: PUP-6 phase-3 failure trigger erasure (carry-over from Phase 38)

**What goes wrong:** The PUP-6 test at `update.test.ts:744` seeds a FILE at
`skillsTargetDir/hello-tool` to force rename(dir -> file) ENOTDIR. Phase 38's
TR-06 `removeOrphanIfPresent` is kind-strict (only rm's dirs in "tree" mode,
only rm's files in "file" mode) AND only acts on owned orphans (state.json
membership). The obstacle text is `"obstacle"`, NOT in any plugin's
resources list, so Phase 38's helper does NOT rm it -- the rename still
fails. Phase 40 must NOT introduce any code path that rms this obstacle.

**Why it happens:** Phase 40 does NOT touch the bridge commit paths or any
`replacePrepared*` helper -- only the orchestrator. So the phase-3a commits
still call `commitPreparedSkills(handles.skills)` which fails on the
ENOTDIR rename as before. PUP-6 stays GREEN naturally.

**How to avoid:**
1. **Verify by reading the post-fix `runThreePhaseUpdate`:** the four
   try/catch blocks around `commitPrepared*` calls are unchanged byte-for-byte.
   Phase 40 only adds `markUpdateInProgress` BEFORE and `finalizeUpdateRecord`
   AFTER.
2. **Run PUP-6 after the source fix and verify the notification text is
   byte-identical.** The recovery-hint emission at the existing
   `notifyDirectFailure` call site is unchanged.
3. **Add post-state assertions to PUP-6** to lock the new contract: assert
   that state.json after the failure shows `version === "1.0.0"` (fromVersion,
   unchanged), `compatibility.installable === false`,
   `compatibility.notes.includes("update-in-progress")`, AND
   `resources.skills === []` (the original empty array -- skills bridge
   failed so resources.skills did NOT get updated to newSkillNames).
4. **Add post-state assertions to phase3a-commands-fail and
   phase3a-agents-fail** with the same shape: failed bridges' resources
   stay at pre-update value; succeeded bridges' resources reflect new
   generated names.

**Warning signs:** A Phase 40 implementation that adds code to the bridge
commit paths or `replacePrepared*` helpers. Those are Phase 38's territory
and are FROZEN for Phase 40.

### Pitfall 6: WR-04 success test post-state expansion

**What goes wrong:** The existing WR-04 test (line 817) asserts
`outcome.partition === "updated"` + `outcome.fromVersion === "1.0.0"` +
`outcome.toVersion === "1.0.1"`, but does NOT inspect state.json. After
Phase 40, the on-disk state.json should reflect `version === "1.0.1"`,
`compatibility.installable === true`, `compatibility.notes` does NOT
include `"update-in-progress"`. A regression where finalize silently writes
the intent-mark `notes` array on the success path would be missed by the
existing assertion.

**Why it happens:** Outcome shape tests don't exercise on-disk state.
Phase 40 changes ON-DISK state write semantics; outcome-shape assertions
are insufficient.

**How to avoid:**
1. **Add post-state assertions to WR-04** -- load state after the call,
   assert version + installable + notes per the all-success finalize
   contract.
2. **Add a "no-intent-mark-leak" assertion**: explicitly check that
   `state.marketplaces.mp.plugins.hello.compatibility.notes` does NOT
   include `"update-in-progress"` after a successful update.

**Warning signs:** A Phase 40 PR that adds the 4-bridge matrix tests but
does NOT update WR-04. The matrix tests cover the failure axes; WR-04 is
the success axis and must be updated to lock the new contract.

### Pitfall 7: Compatibility.supported / .unsupported semantics on intent-mark

**What goes wrong:** The current `swapStateRecord` writes `supported` and
`unsupported` from `preflight.installable` (NEW resolution) BEFORE phase-3a.
The intent-mark in Phase 40 happens BEFORE phase-3a but should reflect the
OLD installable state (the swap has not yet committed). If the intent-mark
writes the NEW `supported`/`unsupported`, then on failure the post-finalize
state.json claims the NEW supported list -- but disk has the OLD plugin
files for any failed bridge. List rendering surfaces a contradictory view.

**Why it happens:** The current code writes NEW values for everything in one
shot because there is no failure-window concern. Phase 40 splits the write,
and the intent-mark must carry forward OLD values for fields that finalize
re-writes on success.

**How to avoid:**
1. **Intent-mark preserves `sRecord.compatibility.supported` and
   `sRecord.compatibility.unsupported`** -- read the existing values from
   sRecord (via the closure parameter `s.marketplaces[...].plugins[...]`)
   and copy them through. Only `installable` flips to false and `notes`
   becomes `["update-in-progress"]`.
2. **Finalize on success overwrites all four** (`installable: true`,
   `notes`, `supported`, `unsupported`) from `preflight.installable`.
3. **Finalize on failure leaves all four at the intent-mark values**:
   `installable: false`, `notes: ["update-in-progress"]`, supported/
   unsupported from pre-update.

**Warning signs:** Intent-mark code that reads `preflight.installable.supported`
or `preflight.installable.unsupported`. Those belong in finalize on the
success path only.

### Pitfall 8: Resource-array referential mutation (the Phase 39 gotcha replay)

**What goes wrong:** In Phase 39, the orchestrator mutated `sRecord.resources.skills`
in place by reassignment. The Phase 40 finalize does the same shape:
`sRecord.resources.X = handles.X.result.recorded.map(...)`. The trap is
DIFFERENT here: in Phase 39 the mutation was a `.filter()` returning a new
array; in Phase 40 the mutation is `.map()` ALSO returning a new array. Both
are correct (no in-place push/splice). But a careless refactor that does
`sRecord.resources.skills.length = 0; sRecord.resources.skills.push(...)` would
work in this closure context but break under `Object.freeze` or readonly
typing if that ever lands.

**Why it happens:** The state schema uses `Type.Array(Type.String())` which is
mutable at the TS level; the runtime arrays are NOT frozen (unlike
`cascadeUnstagePlugin`'s `outcome.dropped.*` which IS frozen). The pitfall is
relying on mutability that may not hold in future refactors.

**How to avoid:**
1. **Always reassign**: `sRecord.resources.X = newArray`. Never push/splice/sort
   in place.
2. **Pattern lock:** mirror the existing line 808-812 idiom: `skills:
   handles.skills.result.recorded.map((r) => r.generatedName)` -- this is the
   verified shape from the current `swapStateRecord`.

**Warning signs:** Any in-place mutation primitive on `sRecord.resources.X`
arrays in the finalize closure. Reassignment is the only sanctioned shape.

## Code Examples

### Verified shape: current `swapStateRecord` (BEFORE Phase 40)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:781-823
// (verbatim; this function is REPLACED by Phase 40)

async function swapStateRecord(
  args: ThreePhaseArgs,
  preflight: PluginPreflight,
  handles: PrepHandles,
): Promise<void> {
  const { plugin, marketplace, locations } = args;
  const { installable, fromVersion, toVersion } = preflight;
  await withStateGuard(locations, (s) => {
    const sMp = s.marketplaces[marketplace];
    if (sMp === undefined) {
      throw new Error(
        `Marketplace "${marketplace}" disappeared from state during update of "${plugin}".`,
      );
    }

    const sRecord = sMp.plugins[plugin];
    if (sRecord === undefined) {
      throw new Error(`Plugin "${plugin}" was concurrently uninstalled.`);
    }

    if (sRecord.version !== fromVersion) {
      throw new Error(
        `Plugin "${plugin}" was concurrently updated; expected version "${fromVersion}", found "${sRecord.version}".`,
      );
    }

    sRecord.version = toVersion;
    sRecord.resources = {
      skills: handles.skills.result.recorded.map((r) => r.generatedName),
      prompts: handles.commands.result.recorded.map((r) => r.generatedName),
      agents: handles.agents.result.recorded.map((r) => r.generatedName),
      mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
    };
    sRecord.compatibility = {
      installable: true,
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    };
    sRecord.resolvedSource = installable.pluginRoot;
    sRecord.updatedAt = new Date().toISOString();
  });
}
```

### Verified shape: current phase-3a aggregation (UNCHANGED in Phase 40)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:885-923
// (verbatim; phase-3a continue-on-failure block is byte-identical post-fix)

const phase3aFailures: Phase3Failure[] = [];

try {
  const leak = await commitPreparedSkills(handles.skills);
  if (leak !== undefined) {
    phase3aFailures.push({
      phase: "skills",
      msg: `skills staging cleanup leak: ${leak}`,
      cause: new Error(leak),
    });
  }
} catch (err) {
  phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
}

try {
  await commitPreparedCommands(handles.commands);
} catch (err) {
  phase3aFailures.push({ phase: "commands", msg: errorMessage(err), cause: err });
}

try {
  const leak = await commitPreparedAgents(handles.agents);
  if (leak !== undefined) {
    phase3aFailures.push({
      phase: "agents",
      msg: `agents staging cleanup leak: ${leak}`,
      cause: new Error(leak),
    });
  }
} catch (err) {
  phase3aFailures.push({ phase: "agents", msg: errorMessage(err), cause: err });
}

try {
  await commitPreparedMcp(handles.mcp);
} catch (err) {
  phase3aFailures.push({ phase: "mcp", msg: errorMessage(err), cause: err });
}
```

### Verified shape: state-record schema for `compatibility`

```typescript
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts:41-46
// (verbatim) -- proves the intent-mark write is schema-valid.

compatibility: Type.Object({
  installable: Type.Boolean(),
  notes: Type.Array(Type.String()),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
}),
```

### Verified shape: `Phase3Failure` interface

```typescript
// Source: extensions/pi-claude-marketplace/shared/errors.ts (referenced
// at update.ts:86 import; the .phase field is currently typed as `string`).

export interface Phase3Failure {
  readonly phase: string; // currently any string; Phase 40 narrows via cast
  readonly msg: string;
  readonly cause?: unknown;
}
```

### Verified shape: ST-7 contract

```typescript
// Source: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:65-76
// (verbatim) -- the "save only on no-throw" contract.

/**
 * On any throw inside `mutate`, the original error propagates and
 * `saveState` is NOT called -- ST-7 contract: "save only on no-throw."
 */
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
): Promise<T> {
  return withScopeLock(locations, async () => {
    const fresh = await loadState(locations.extensionRoot);
    const result = await mutate(fresh);
    await saveState(locations.extensionRoot, fresh);
    return result;
  });
}
```

### Required new pattern: TR-04 module-level constant + helpers

```typescript
// Source: research synthesis grounded in CONTEXT.md SC#1 + SC#2.

// Module-level constant locks the intent-mark marker text. Refactor
// audit point if the marker text ever changes (e.g., per i18n in v2).
const UPDATE_IN_PROGRESS_NOTE = "update-in-progress";

// Closed-set tuple for Phase3Failure.phase narrowing. A future fifth
// bridge surfaces here as a compile-time TS error at the cast site.
const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "mcp"] as const;
type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `swapStateRecord` call BEFORE phase-3a commits writes NEW version + NEW resources optimistically; phase-3a continue-on-failure does NOT roll back state on partial failure -> state.json lies about disk on every phase-3a failure path | Two helpers: `markUpdateInProgress` sets `compatibility.installable=false` + `notes=["update-in-progress"]` BEFORE phase-3a; `finalizeUpdateRecord` after phase-3a applies per-bridge resource updates for every bridge that succeeded (independent of others' outcomes) and bumps version + `installable=true` only on all-success | Phase 40 (v1.7, TR-04) | Closes the F4 / Pitfall 4 / Pitfall 12 state-write-before-commit divergence. State.json now reflects truthful on-disk content for every phase-3a outcome; retries against partial-success state correctly reach the final state without unexpected work. |
| `compatibility: { installable: true, notes: [...installable.notes], ... }` written optimistically at swap time | `compatibility: { installable: false, notes: ["update-in-progress"], ... }` written at intent-mark time; `installable: true` + final notes only set on all-success finalize | Phase 40 (v1.7, TR-04) | The intent-mark survives crashes and is the recovery anchor. NFR-2 (`/reload`-only recovery) is strengthened. |
| One `withStateGuard` window per `runThreePhaseUpdate` | Two `withStateGuard` windows (intent-mark + finalize) bracketing phase-3a (which holds NO state lock per Phase 7 D-06 lock-bounding) | Phase 40 (v1.7, TR-04) | Per-scope lock-hold remains bounded to load-mutate-save; phase-3a renames run without the lock, preserving concurrent operability across plugins. |

**Deprecated/outdated:** The `swapStateRecord` function name and signature are
retired in Phase 40. Direct callers (none outside `runThreePhaseUpdate`) are
not affected.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The intent-mark `notes: ["update-in-progress"]` does NOT need to be rendered by `list` -- the existing renderer surfaces `notes` strings generically | "Architectural Responsibility Map" + "Pitfall 7" | If `list` rendering breaks on the intent-mark marker (e.g., a notify-types test fails because `update-in-progress` is not in a closed-set Reason vocabulary), the implementation must either (a) document the new marker in `notify-types.ts` or (b) use a different rendering scheme. Mitigation: spot-check `shared/notify.ts` rendering of `compatibility.notes` during implementation; if it routes through a closed-set Reason, add `update-in-progress` to that set OR move the marker into a NEW state field. The risk surface is `tests/shared/notify*.test.ts` -- verify by running `node --test tests/shared/notify*.test.ts` early in Task 1. |
| A2 | `Phase3Failure.phase` typed as `string` (not the closed `Phase3Phase` union) is acceptable because the Phase 40 finalize casts via `as Phase3Phase` in a single closed-set Set construction | "Pattern 2" + "Pitfall 6" | If `shared/errors.ts` ever tightens `Phase3Failure.phase` to the union type, the cast becomes a no-op and is fine. If a fifth bridge is added without updating the closed-set tuple, the cast silently drops to `string` and the failed-phase Set could lose entries. Mitigation: declare `PHASE3_FAILURE_PHASES` as a module-level tuple and write a unit test asserting the four expected values. |
| A3 | A finalize failure routed as a synthetic `phase: "mcp"` Phase3Failure entry is acceptable for v1.7 (no dedicated `phase: "finalize"` member added) | "Pitfall 4" + "Open Questions Q3" | If the synthetic `mcp` phase muddles diagnostics for end users, a v1.8 fix adds the dedicated member. For v1.7 the user-visible recovery-hint output is identical across all phase strings (the renderer composes `(failed) {rollback partial}` regardless). Mitigation: add a comment at the synthetic-cast site explaining the choice + reference Open Q3. |
| A4 | Tests that previously asserted `state.json` write count implicitly (e.g., via `before === after` on the unchanged path) continue to behave correctly because PUP-3 short-circuits BEFORE any `withStateGuard` call | "Pattern 3" + "Pitfall 2" | If any short-circuit path now reaches `markUpdateInProgress` (e.g., a future refactor merges PUP-3/4/5 short-circuits into the intent-mark step), the unchanged test would RED. Mitigation: keep the preflight short-circuits at their current location (early return BEFORE `markUpdateInProgress`). The post-fix code skeleton in Pattern 3 explicitly shows the early return remains at the top of `runThreePhaseUpdate`. |
| A5 | The 4-bridge x 2-outcome matrix is sufficiently covered by 4 dedicated "exactly one bridge fails" tests (one per bridge) + the existing PUP-6 (skills fails) test serving as the skills variant, totaling 4 new + 1 existing-updated = 5 of 16 cases | "Validation Architecture" | The 16 cases include 4 single-failure (covered), 6 double-failure pairs (covered by phase3a-commands-fail which seeds skills + commands obstacles, and phase3a-agents-fail which seeds skills + agents), 4 triple-failure cases (NOT explicitly tested but composable from the existing seeds), 1 all-fail (NOT tested -- low value, same recovery hint), 1 all-success (WR-04 existing test). The matrix COVERAGE is sufficient because the finalize logic is per-bridge orthogonal -- a single-bridge-fail test verifies the gate; multi-bridge-fail cases compose deterministically. Mitigation: document this reasoning in the test file as a comment block. |
| A6 | `compatibility.supported` and `compatibility.unsupported` arrays carry forward unchanged from the pre-update sRecord during intent-mark (not overwritten with NEW values) | "Pattern 1" + "Pitfall 7" | If a list-rendering test asserts the intent-mark phase has NEW `supported`/`unsupported` (current behavior), it would RED. Verify the unchanged path: existing `swapStateRecord` writes NEW values at swap time, so PUP-6 today sees NEW values in state on the failure path -- a test asserting that would RED under Phase 40 (which would carry forward OLD values during intent-mark, leave them OLD on finalize-failure). Mitigation: grep `update.test.ts` for `supported` / `unsupported` assertions; none found in the file scan, so this is LOW-risk. |

**Confirmation required from planner:**
- A1 -- spot-check `shared/notify.ts` rendering of `compatibility.notes` before
  Task 1. If a closed-set Reason gate exists, add `update-in-progress` to it
  OR reroute via a different field.
- A5 -- decide whether the planner wants explicit double-failure tests (e.g.,
  agents-AND-mcp-fail). Recommendation: NO -- the existing phase3a-* tests
  cover the multi-bridge axis indirectly, and the load-bearing contract is
  the per-bridge orthogonality of the finalize logic. Document the matrix
  reasoning as a comment block in `update.test.ts`.

## Open Questions

1. **Should `finalizeUpdateRecord` re-check ST-9 stale-version inside its
   `withStateGuard`?**
   - What we know: ST-9 (the `sRecord.version !== fromVersion` check) exists
     today in `swapStateRecord` to detect concurrent updates. Phase 40 moves
     this check into `markUpdateInProgress`. The finalize step runs
     subsequently in the same process.
   - What's unclear: Could another process acquire the lock between
     intent-mark and finalize, see `installable: false` + `notes:
     ["update-in-progress"]`, and bump the version anyway (e.g., a buggy
     V2 retry path)? Should finalize defensively re-check ST-9?

2. **Should the intent-mark + finalize be wrapped in a SINGLE atomic
   transaction via `withLockedStateTransaction` (Phase 8 PRL-10)?**
   - What we know: `withLockedStateTransaction` holds the per-scope lock
     across an explicit `tx.save()` call. Wrapping intent-mark + phase-3a +
     finalize in one transaction would mean the lock is held for the entire
     update duration (potentially seconds).
   - What's unclear: Does the cross-process serialization win outweigh the
     blocking cost?

3. **Should `Phase3Failure.phase` gain a `"finalize"` member to surface
   finalize-write failures explicitly?**
   - What we know: Pitfall 4 routes finalize failures as synthetic `phase:
     "mcp"` entries to reuse the existing recovery-hint pipeline. The
     user-visible byte form is identical.
   - What's unclear: Does diagnostics (e.g., cause-chain trailer rendering
     "mcp: state finalize failed: <cause>") confuse operators into thinking
     mcp specifically failed?

4. **Does the existing PUP-6 obstacle seed (FILE at
   `skillsTargetDir/hello-tool`) still trigger phase-3a failure under
   Phase 40 + Phase 38's `removeOrphanIfPresent`?**
   - What we know: Phase 38 made `removeOrphanIfPresent` kind-strict
     (rm's directories in "tree" mode only) AND only acts on owned orphans
     (state.json membership). The PUP-6 obstacle text `"obstacle"` is NOT
     in any plugin's resources list.
   - What's unclear: Have I verified this against the actual post-Phase-38
     code? Phase 38's research said YES, the obstacle stays intact.

5. **Should `markUpdateInProgress` write a TIMESTAMP into the notes (e.g.,
   `notes: ["update-in-progress: 2026-06-02T12:34:56.789Z"]`)?**
   - What we know: A static `"update-in-progress"` string is sufficient for
     the intent-mark detection. A timestamp could enable a future GC sweeper
     to detect stale marks (process died mid-update >1h ago).
   - What's unclear: Is a timestamp prefix harmful (e.g., does it break a
     closed-set Reason rendering)?

## Open Questions (RESOLVED)

1. **Should `finalizeUpdateRecord` re-check ST-9 stale-version inside its
   `withStateGuard`?**
   - What we know: ST-9 (the `sRecord.version !== fromVersion` check) exists
     today in `swapStateRecord` to detect concurrent updates. Phase 40 moves
     this check into `markUpdateInProgress`. The finalize step runs
     subsequently in the same process.
   - What's unclear: Could another process acquire the lock between
     intent-mark and finalize, see `installable: false` + `notes:
     ["update-in-progress"]`, and bump the version anyway (e.g., a buggy
     V2 retry path)?
   - **RESOLVED: REJECTED ST-9 re-check in finalize.** Within a single
     process's phase-3a window, the intent-mark left `sRecord.version` at
     `fromVersion` (intent-mark does NOT bump it). A correctly-behaved
     second process observing `installable: false` SHOULD not bump the
     version -- and even a buggy second process would still need to take
     the per-scope lock, which is serialized per Phase 7 D-06. The intent-mark
     IS the cross-process signal; ST-9 re-check would over-fire on the
     legitimate same-process finalize. If a v1.8 strengthens cross-process
     update semantics, that is a milestone-wide refactor (TR-D04+ category).
     Documented in Anti-Patterns + Pitfall 3.

2. **Should the intent-mark + finalize be wrapped in a SINGLE atomic
   transaction via `withLockedStateTransaction` (Phase 8 PRL-10)?**
   - What we know: `withLockedStateTransaction` holds the per-scope lock
     across an explicit `tx.save()` call. Wrapping intent-mark + phase-3a +
     finalize in one transaction would mean the lock is held for the entire
     update duration (potentially seconds for large plugins).
   - What's unclear: Does the cross-process serialization win outweigh the
     blocking cost?
   - **RESOLVED: REJECTED long-held-lock design.** Phase 7 D-06 explicitly
     bounds lock-hold to load-mutate-save; holding it across phase-3a
     renames violates the discipline and blocks concurrent operations on
     OTHER plugins in the same scope. The two-window `withStateGuard` model
     is correct: each window is atomic; the intent-mark is the cross-process
     coordination signal that bridges the two windows. Adopted in Pattern
     1 + Pattern 2. The TRADEOFF: a second process could in principle race
     between intent-mark and finalize -- mitigated by the intent-mark's
     `installable: false` signal that a correctly-behaved consumer should
     honour. v1.7 does not introduce cross-process update orchestration.

3. **Should `Phase3Failure.phase` gain a `"finalize"` member to surface
   finalize-write failures explicitly?**
   - What we know: Pitfall 4 routes finalize failures as synthetic `phase:
     "mcp"` entries to reuse the existing recovery-hint pipeline. The
     user-visible byte form is identical (`(failed) {rollback partial}`).
   - What's unclear: Does diagnostics confuse operators?
   - **RESOLVED: DEFERRED to v1.8.** For v1.7 the synthetic-`mcp` routing
     keeps the schema change cost out of TR-04. The cause-chain trailer
     carries the explicit `"state finalize failed: <error>"` text in the
     `msg` field, so an operator reading the notification body sees the
     truthful diagnosis. If user-research surfaces that the `mcp:` prefix
     muddles understanding, the v1.8 fix adds a `phase: "finalize"`
     Phase3Failure member -- a `shared/errors.ts` schema change with
     consumer ripple. Out of scope for v1.7. Documented in Assumptions A3
     + Anti-Patterns.

4. **Does the existing PUP-6 obstacle seed still trigger phase-3a failure
   under Phase 40 + Phase 38's `removeOrphanIfPresent`?**
   - What we know: Phase 38 made `removeOrphanIfPresent` kind-strict (rm's
     directories in "tree" mode only) AND only acts on owned orphans
     (state.json membership). The PUP-6 obstacle text `"obstacle"` is NOT
     in any plugin's resources list.
   - What's unclear: Have I verified this against the post-Phase-38 code?
   - **RESOLVED: ADOPTED -- the PUP-6 trigger is preserved.** Phase 38
     research (`38-RESEARCH.md` Pitfall 3 + Pattern 2) explicitly preserves
     this property: the `removeOrphanIfPresent` helper does NOT touch the
     obstacle file because (a) it is a FILE in a context where the helper
     is called with "tree" mode (so kind-strict skips it), AND (b) it is
     not in the plugin's `_previousNames` list (so the call-site policy
     skips it). Phase 40 does NOT modify the bridge commit paths, so the
     PUP-6 rename-on-skills-fails ENOTDIR still fires; phase3aFailures
     populates; recovery hint emits. Add post-state assertions per Pitfall 5.

5. **Should `markUpdateInProgress` write a TIMESTAMP into the notes?**
   - What we know: A static string is sufficient for intent detection. A
     timestamp could enable a future GC sweeper.
   - What's unclear: Does a timestamp prefix break closed-set rendering?
   - **RESOLVED: REJECTED for v1.7 (static string only).** The intent-mark
     marker is a CONTRACT visible to multiple consumers (state.json
     readers, `list` rendering, retry preflight). A static string is
     simpler to grep, simpler to assert in tests, and does not introduce
     timestamp-comparison semantics that out-of-scope GC tooling would
     need. If a v1.8 GC sweeper lands, it can use `sRecord.updatedAt`
     (already in the schema) for the staleness signal -- no new field
     needed. Adopted: `UPDATE_IN_PROGRESS_NOTE = "update-in-progress"`
     module-level constant.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runtime + TypeScript strip + fs/promises | OK | >=20.19.0 (NFR-4) | -- |
| TypeScript | typecheck for `compatibility.installable` discriminated union | OK | ^5.9.3 (project lockfile) | -- |
| `node:test` (built-in) | Regression test framework (~5 new tests + ~10-15 modified) | OK | bundled | -- |
| `node:assert/strict` (built-in) | `assert.deepEqual`, `assert.equal`, `assert.ok`, `assert.match` | OK | bundled | -- |
| `write-file-atomic` | Atomic state.json writes (intent-mark + finalize) | OK | ^7 / ^8 per state-io | -- |
| `proper-lockfile` | Per-scope state-lock (held during each withStateGuard) | OK | ^4.1.2 | -- |
| `pre-commit` | CLAUDE.md hook gate | OK (verified by `.pre-commit-config.yaml` presence) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, stable since 20.x) |
| Config file | none -- `package.json` `"test"` script glob: `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` |
| Quick run command | `node --test tests/orchestrators/plugin/update.test.ts` (~3-6 sec) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |
| Phase gate | Full suite GREEN before `/gsd-verify-work` (per SC#6) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TR-04 (SC#1, SC#3) | Existing PUP-6 + phase3a-commands-fail + phase3a-agents-fail tests stay GREEN with byte-identical notifications; post-state assertions added: failure path leaves `compatibility.installable === false`, `notes.includes("update-in-progress")`, `version === fromVersion` | regression+expansion | `node --test tests/orchestrators/plugin/update.test.ts` -> tests at lines 744, 1584, 1641 + post-state expansion | YES (modified) |
| TR-04 (SC#1, SC#2) | Existing WR-04 test (line 817) stays GREEN with byte-identical outcome; post-state assertions added: `version === toVersion`, `installable === true`, `notes` does NOT include `"update-in-progress"`, all four `resources.*` reflect new generated names | regression+expansion | same file -> test at line 817 + post-state expansion | YES (modified) |
| TR-04 (SC#3) | PUP-3 unchanged test (line 265) stays UNTOUCHED -- preflight short-circuits BEFORE any state guard call | regression | same file -> test at line 265 | YES (unchanged) |
| TR-04 (SC#4) Matrix #1 | Skills bridge fails (FILE obstacle at hello-tool), other 3 succeed: post-state has `resources.skills === []` (pre-update value), `resources.prompts === ["hello-deploy"]` (new), `resources.agents === [GENERATED_AGENT_PREFIX + "hello-bot"]` (new), `resources.mcpServers === ["hello-server1"]` (new); `version === "1.0.0"`; `installable === false` | unit | same file -> NEW test "TR-04 matrix: skills-fails-others-succeed" | NO (Wave 0: append) |
| TR-04 (SC#4) Matrix #2 | Commands bridge fails (DIR obstacle at promptsTargetDir/hello:deploy.md), others succeed: post-state has skills updated, prompts at pre-update, agents updated, mcpServers updated; version unchanged; installable=false | unit | same file -> NEW test "TR-04 matrix: commands-fails-others-succeed" | NO (Wave 0: append) |
| TR-04 (SC#4) Matrix #3 | Agents bridge fails (DIR obstacle at agentsDir/<prefix>hello-bot.md), others succeed: post-state has skills updated, prompts updated, agents at pre-update, mcpServers updated; version unchanged; installable=false | unit | same file -> NEW test "TR-04 matrix: agents-fails-others-succeed" | NO (Wave 0: append) |
| TR-04 (SC#4) Matrix #4 | MCP bridge fails (synthetic: pre-create unwriteable mcp.json target or DIR at mcp.json path), others succeed: post-state has skills updated, prompts updated, agents updated, mcpServers at pre-update; version unchanged; installable=false | unit | same file -> NEW test "TR-04 matrix: mcp-fails-others-succeed" | NO (Wave 0: append) |
| TR-04 (SC#5) Retry | Seed state with `version="1.0.0", resources.skills=["hello-tool"]` AND pre-stage NEW disk content at `skillsTargetDir/hello-tool` (simulating partial-success). Trigger an update to `1.0.1` from a manifest that ALSO updates skills. Assert: second run completes; final `version === "1.0.1"`; final `resources.skills === ["hello-tool"]` (or whatever the new manifest produces); NO unexpected error notifications | unit | same file -> NEW test "TR-04 retry: partial-success-state-converges-to-new-version" | NO (Wave 0: append) |
| TR-04 (SC#6) | `npm run check` GREEN; full suite incl. modified + new tests | regression | `npm run check` (full suite) | YES |

### Sampling Rate

- **Per task commit:** `node --test tests/orchestrators/plugin/update.test.ts`
  (~3-6 sec; ~50 tests file-wide)
- **Per wave merge:** `node --test tests/orchestrators/**/*.test.ts
  tests/transaction/**/*.test.ts tests/persistence/**/*.test.ts` (~30-60 sec)
- **Phase gate:** `npm run check` (full suite ≈ 1362+ tests post-Phase 39,
  ≈ 1370+ tests post-Phase 40 assuming ~10 net new tests after the 4 matrix
  + 1 retry are added and the existing tests are augmented rather than
  multiplied)

### Wave 0 Gaps

The test file exists and is well-structured (`update.test.ts` is ~1695
lines). The 5 new tests must be APPENDED; the ~10-15 existing tests need
post-state assertions added in-place. No new test files required.

- [ ] `tests/orchestrators/plugin/update.test.ts` -- APPEND 5 new tests
  PLUS in-place modifications to existing tests for post-state assertions:
  - **Matrix #1 (skills-fails):** Adapt PUP-6's seed shape; after the
    update call, load state via `loadState`, assert:
    - `state.marketplaces.mp.plugins.hello.version === "1.0.0"` (unchanged)
    - `state.marketplaces.mp.plugins.hello.compatibility.installable === false`
    - `state.marketplaces.mp.plugins.hello.compatibility.notes.includes("update-in-progress")`
    - `state.marketplaces.mp.plugins.hello.resources.skills` equals
      pre-update value (the `installedVersions` produced empty arrays via
      `makePluginRecord`, so `[]`)
    - `state.marketplaces.mp.plugins.hello.resources.prompts` equals new
      generated names (commands committed successfully)
    - similarly for agents, mcpServers
    - `notifications.length === 1` (recovery hint unchanged)
  - **Matrix #2 (commands-fails):** Adapt phase3a-commands-fail seed but
    REMOVE the skills obstacle (so only commands fails); similar post-state.
  - **Matrix #3 (agents-fails):** Adapt phase3a-agents-fail seed but
    REMOVE the skills obstacle; similar post-state.
  - **Matrix #4 (mcp-fails):** Pre-create a DIRECTORY at the mcp.json
    target path (or use a different forcing function the mcp bridge
    surfaces); similar post-state.
  - **Retry test:** Two-call test. Call 1 fails on skills (PUP-6 shape).
    Between calls: rm the obstacle; verify state is at partial-success;
    pre-state assertion: `version === "1.0.0", resources.skills === []`,
    `compatibility.installable === false`. Call 2 succeeds; post-state:
    `version === "1.0.1"`, all four resources arrays reflect new generated
    names, `installable === true`, no `update-in-progress` note.
  - **In-place modifications:**
    - PUP-6 test (line 744): ADD post-state assertions per Matrix #1
      shape.
    - phase3a-commands-fail test (line 1584): ADD post-state assertions
      (skills+commands both fail; agents+mcp succeed; per-bridge update).
    - phase3a-agents-fail test (line 1641): ADD post-state assertions
      (skills+agents both fail; commands+mcp succeed).
    - WR-04 test (line 817): ADD post-state assertions for the all-success
      finalize contract.
    - PUP-3 unchanged test (line 265): NO change required (preflight
      short-circuit unchanged).

### Recommended exact test cases (input -> expected -> assertion mechanism)

**Existing tests with post-state augmentation (5 modifications):**

1. **PUP-6 (line 744, skills-fails-only):**
   - **Input:** Pre-create FILE at `skillsTargetDir/hello-tool`. Run
     `updatePlugins`.
   - **Expected:** `notifications.length === 1` with
     `RECOVERY_PLUGIN_REINSTALL_PREFIX` match; state shows
     skills-not-updated + version-unchanged + installable=false.
   - **Assertion:** Existing assertions PLUS `const after = await
     loadState(locations.extensionRoot); assert.equal(after.marketplaces.mp.plugins.hello.version, "1.0.0"); assert.equal(after.marketplaces.mp.plugins.hello.compatibility.installable, false); assert.ok(after.marketplaces.mp.plugins.hello.compatibility.notes.includes("update-in-progress")); assert.deepEqual(after.marketplaces.mp.plugins.hello.resources.skills, []); ...`

2. **phase3a-commands-fail (line 1584, skills+commands fail):** as above
   with two-bridge gating.

3. **phase3a-agents-fail (line 1641, skills+agents fail):** as above.

4. **WR-04 (line 817, all-success):**
   - **Input:** Manifest update bumps `hello: 1.0.0 -> 1.0.1` with skill +
     agent + mcp.
   - **Expected:** Outcome `partition === "updated"`; state shows version
     bumped, installable=true, all resources updated.
   - **Assertion:** Existing assertions PLUS `const after = await
     loadState(locations.extensionRoot); assert.equal(after.marketplaces.mp.plugins.hello.version, "1.0.1"); assert.equal(after.marketplaces.mp.plugins.hello.compatibility.installable, true); assert.ok(!after.marketplaces.mp.plugins.hello.compatibility.notes.includes("update-in-progress"));`

5. **PUP-3 (line 265, unchanged):** No modification. Preflight returns
   `unchanged` outcome BEFORE the intent-mark window. `before === after`
   assertion remains accurate.

**New tests (4 matrix + 1 retry):**

6. **Matrix #1 (skills-fails-others-succeed):**
   - **Input:** Manifest bumps `hello: 1.0.0 -> 1.0.1` with skill + command
     + agent + mcp. Pre-create FILE at `skillsTargetDir/hello-tool`. Run
     `updatePlugins`.
   - **Expected:** state shows skills-not-updated (pre-update value),
     commands+agents+mcp updated, version unchanged, installable=false.
   - **Assertion:** `loadState` + `assert.deepEqual` per axis.

7. **Matrix #2 (commands-fails-others-succeed):**
   - **Input:** Pre-create DIRECTORY at
     `promptsTargetDir/hello:deploy.md`. Run `updatePlugins`.

8. **Matrix #3 (agents-fails-others-succeed):**
   - **Input:** Pre-create DIRECTORY at
     `agentsDir/<GENERATED_AGENT_PREFIX>hello-bot.md`. Run `updatePlugins`.

9. **Matrix #4 (mcp-fails-others-succeed):**
   - **Input:** Pre-create DIRECTORY at `locations.mcpJsonPath` (or
     pre-create read-only file). Run `updatePlugins`.

10. **Retry (SC#5):**
    - **Input:** Two `updatePlugins` calls. Call 1: PUP-6 shape (skills
      obstacle). Between calls: `rm` the obstacle. Pre-call-2 state
      assertion: `version === "1.0.0", resources.skills === [],
      compatibility.installable === false`. Call 2: same target, same
      manifest.
    - **Expected:** Call 2 completes; final state shows version bumped,
      all resources updated, installable=true, no `update-in-progress`
      note.
    - **Assertion:** `notifications.length` for call 2 reflects exactly
      the expected single success-cascade notification (no unexpected
      errors).

### 4-bridge x 2-outcome matrix coverage analysis

The 16 cases (4 bridges x 2 outcomes per bridge = 4^2 = 16 if independent,
or 2^4 = 16 distinct failure-success patterns):

| # | Skills | Commands | Agents | MCP | Coverage |
|---|--------|----------|--------|-----|----------|
| 1 | succeed | succeed | succeed | succeed | WR-04 (existing, augmented) |
| 2 | **FAIL** | succeed | succeed | succeed | Matrix #1 (new) + PUP-6 (existing, augmented) |
| 3 | succeed | **FAIL** | succeed | succeed | Matrix #2 (new) |
| 4 | succeed | succeed | **FAIL** | succeed | Matrix #3 (new) |
| 5 | succeed | succeed | succeed | **FAIL** | Matrix #4 (new) |
| 6 | **FAIL** | **FAIL** | succeed | succeed | phase3a-commands-fail (existing, augmented) |
| 7 | **FAIL** | succeed | **FAIL** | succeed | phase3a-agents-fail (existing, augmented) |
| 8-16 | ... | ... | ... | ... | Combinatorial composition of #2-7 (per-bridge orthogonal logic) |

**Coverage claim:** The per-bridge gating logic in `finalizeUpdateRecord` is
orthogonal across the four bridges (`failedPhases.has("skills")` is
independent of `failedPhases.has("commands")` etc.). Tests #1-7 cover
every per-bridge "succeed" vs "fail" outcome in BOTH directions for ALL
four bridges. The remaining 9 multi-failure cases (e.g., agents+mcp fail,
skills+commands+agents fail, all fail) compose deterministically from the
per-bridge orthogonality. Explicit tests for these multi-failure cases
would not exercise a code path that is not already covered by #1-7;
adding them would be test-multiplication without coverage gain.

**Coverage attestation in source:** Add a comment block at the top of
the new matrix tests explaining this reasoning + cross-link to this
research file (`.planning/phases/40-update-state-before-commit-reorder/40-RESEARCH.md`).

### Single-plan feasibility

**The phase can be closed by a SINGLE plan (`40-01-PLAN.md`) with 5 tasks:**

1. **Task 1 -- Add `markUpdateInProgress` + `finalizeUpdateRecord` to
   `update.ts`:** Define both helpers + the module-level constant
   `UPDATE_IN_PROGRESS_NOTE` + the closed-set tuple `PHASE3_FAILURE_PHASES`.
   Leave `swapStateRecord` in place (dead code until Task 2 removes it).
   Spot-check `shared/notify.ts` rendering of `compatibility.notes` for
   any closed-set Reason gating (A1). NO wiring change yet -- existing
   tests continue running against `swapStateRecord`.

2. **Task 2 -- Rewire `runThreePhaseUpdate`:** Replace the
   `swapStateRecord(args, preflight, handles)` call (line 868) with the
   intent-mark + finalize sequence per Pattern 3. Delete `swapStateRecord`.
   Add the finalize-failure catch block that synthesizes a `phase: "mcp"`
   Phase3Failure entry per Pitfall 4. NO test changes yet -- expect ~10-15
   existing tests to RED with state-write count or post-state assertion
   failures.

3. **Task 3 -- Amend existing `update.test.ts` tests:** Add post-state
   assertions to PUP-6, phase3a-commands-fail, phase3a-agents-fail, and
   WR-04. Verify PUP-3 unchanged stays UNTOUCHED (preflight short-circuit
   unaffected). Run `node --test tests/orchestrators/plugin/update.test.ts`;
   verify all existing tests GREEN against the post-fix contract.

4. **Task 4 -- Add 4 matrix tests + 1 retry test:** Append the 5 new tests
   per Validation Architecture. Verify GREEN locally. Document the 16-case
   coverage attestation in a comment block.

5. **Task 5 -- Phase-gate validation:** Run `npm run check` (full suite);
   confirm GREEN with no regression. Confirm post-Phase-39 baseline
   (1362+ tests) + Phase 40 net additions/modifications.

**Why NOT split per-helper:** Tasks 1 + 2 are co-evolved; the helpers
introduced in Task 1 cannot be tested independently of the wiring change
in Task 2 (they have no callers until Task 2). Tasks 3 + 4 are sequential
on Task 2's wiring landing. Task 5 is the gate.

**Why NOT split per-test-category:** Tasks 3 + 4 could in principle be
done in either order, but Task 3 (existing tests) is the regression
surface; landing it first validates the wiring change before adding net
new tests. Reverse order would interleave test failures from two sources.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable -- internal state-mutation control flow. |
| V3 Session Management | no | Not applicable. |
| V4 Access Control | no | Not applicable. |
| V5 Input Validation | no | No new inputs introduced. `compatibility.notes` is `Type.Array(Type.String())` -- the intent-mark marker is a hardcoded constant, not user input. |
| V6 Cryptography | no | Not applicable. |
| V10 Malicious Code | no | No new external code paths. |
| V12 File and Resources | yes (indirect) | The Phase 40 fix preserves NFR-10 containment (no new path operations); the existing `withStateGuard` + `write-file-atomic` semantics provide the atomic state write across BOTH new windows. The two-guard model maintains the same per-scope lock discipline (Phase 7 D-06). |

### Known Threat Patterns for state-record-coherence fix

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-process state.json race during the intent-mark window (process A writes intent-mark; process B reads it and treats the plugin as in-flight) | Tampering | Mitigated by `proper-lockfile` `.state-lock` held across each load -> mutate -> save (Phase 7 D-06). The intent-mark write is inside the lock. Between intent-mark and finalize, the lock is released -- by design, to allow concurrent operations on OTHER plugins. A second process observing `installable: false` + `notes: ["update-in-progress"]` SHOULD treat the plugin as in-flight (Open Q1 RESOLVED). |
| State row "lying" about disk contents after partial failure (the F4 / TR-04 pattern being fixed) | Repudiation / Integrity | Pre-Phase-40: state.json claims `version=NEW + resources.skills=NEW` while disk has `version=OLD + skills=OLD bytes for some bridges` -- a repudiation/integrity gap. Post-Phase-40: state.json reflects the truthful per-bridge commit outcomes (succeeded bridges updated, failed bridges at pre-update); version bump only on all-success. The intent-mark marker (`installable: false` + `notes: ["update-in-progress"]`) is the truthful in-progress signal. |
| Intent-mark marker forgery (a malicious actor writes `update-in-progress` directly to state.json to confuse the renderer / retry) | Spoofing | Out of threat model. The state.json file is OWNED by the Pi process; manual writes by an operator are documented as supported only via the `/claude:plugin` command surface (NFR-2 contract). A malicious-but-local actor could spoof the marker, but the same actor could spoof any state.json field; the marker's role is to coordinate within the Pi process / between concurrent Pi processes, not to defend against tampering. |
| Finalize-failure cascade (physical commits succeeded, state finalize fails, user sees "rollback partial" but disk is NEW) | Repudiation / Diagnostic confusion | Mitigated by the synthetic `phase: "mcp"` Phase3Failure routing (Pitfall 4): the recovery-hint emission fires with the explicit `msg: "state finalize failed: <error>"` text. The operator-visible outcome is "rollback partial; reinstall recommended" -- which is the correct guidance (a reinstall normalizes the state-disk divergence). |

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
  (1653 lines, READ in full) -- the TR-04 primary fix site at lines 781-823
  (current `swapStateRecord`) + lines 867-989 (current `runThreePhaseUpdate`
  control flow + phase-3a + recovery-hint emission). All imports verified;
  cascade vs direct routing verified; `PrepHandles` shape + `.result.recorded`
  extraction pattern verified.
- Project source: `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
  (177 lines, READ in full) -- ST-7 contract at lines 65-76 ("save only on
  no-throw"); per-scope `proper-lockfile` discipline at lines 155-163;
  withLockedStateTransaction at lines 83-104 (rejected for TR-04 per Open Q2).
- Project source: `extensions/pi-claude-marketplace/persistence/state-io.ts`
  (lines 38-55) -- `PLUGIN_INSTALL_RECORD_SCHEMA` confirming the state schema
  field names: `compatibility.{installable, notes, supported, unsupported}`
  + `resources.{skills, prompts, agents, mcpServers}`.
- Project source: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  (lines 285-395) -- `UnstageOutcome` + `cascadeUnstagePlugin` -- referenced
  for Phase 39 context (TR-03 cascade-side state mutation pattern).
- Project source: `tests/orchestrators/plugin/update.test.ts` (1695 lines;
  READ critical regions) -- PUP-6 at line 744 (file-obstacle ENOTDIR
  trigger), phase3a-commands-fail at line 1584 (directory obstacle pattern),
  phase3a-agents-fail at line 1641 (GENERATED_AGENT_PREFIX dir obstacle),
  WR-04 success at line 817, PUP-3 unchanged at line 265, `makePluginRecord`
  helper at lines 94-111, `seedPathMarketplace` helper at lines 123-221.
- `.planning/research/SUMMARY.md` (293 lines, READ in full) -- v1.7 milestone
  research synthesis; TR-04 rationale at lines 192-205 (Phase 4: Update
  State-Before-Commit Reorder); Critical Pitfall 5 (state-before-commit
  partial-failure matrix) at lines 141-147.
- `.planning/research/PITFALLS.md` (800 lines, READ in full) -- Pitfall 4
  (state-before-commit reversal) at lines 284-365 -- direct authority for
  the per-bridge vs all-or-nothing split + the 4-bridge x 2-outcome matrix
  + the retry test requirement; Pitfall 12 (re-entrant retry) at lines
  636-666.
- `.planning/research/ARCHITECTURE.md` (269 lines, READ in full) -- Q4
  update.ts state-before-commit at lines 186-203 confirming the two-guard
  intent-mark approach; SUMMARY pattern at line 53-54 confirming
  split-with-no-new-files structure.
- `.planning/research/FEATURES.md` (142 lines, READ in full) -- Category 3
  ghost-record prevention at lines 72-92; F4 specifically at lines 88-92.
- `.planning/REQUIREMENTS.md` -- TR-04 definition at lines 54-61; TR-D01
  WAL-style audit trail OUT OF SCOPE at line 79; TR-D02 (neverthrow) OUT
  OF SCOPE at line 80.
- `.planning/phases/40-update-state-before-commit-reorder/40-CONTEXT.md`
  (74 lines, READ in full) -- locked SC#1-#6.
- `.planning/phases/39-cascade-ghost-record/39-RESEARCH.md` (1404 lines,
  READ in full) -- the `dropped.commands -> resources.prompts` field-name
  asymmetry (lines 41-51); the AG-5 typed-discrimination pattern; the
  sentinel + post-guard branch shape for ST-7 abort-save (Pattern 1);
  the locked test-count convention (4 new tests).
- `.planning/phases/38-sequential-commit-loops-orphan-tolerance/38-RESEARCH.md`
  (1300+ lines, READ summary + Pattern 2 + Pitfall 3) -- the
  `removeOrphanIfPresent(target, mode)` shape (kind-strict +
  state.json-membership-discriminated); PUP-6 obstacle preservation
  reasoning; bridge rollback for TR-01/TR-05 (now landed).
- `.planning/STATE.md` -- v1.7 milestone progress; Phase 39 COMPLETE;
  Phase 40 next.
- `.planning/ROADMAP.md` -- Phase 40 definition (TR-04, depends on
  Phase 38).
- `package.json` `scripts` -- confirmed `npm run check` composition
  (`typecheck && lint && format:check && test`) and the `node:test` glob.
- CLAUDE.md project section -- Conventional Commits, `pre-commit run`
  discipline, NFR-1 / NFR-2 / NFR-3 / NFR-6 / NFR-7 / NFR-10 / IL-2 constraints.
- `.planning/config.json` -- `workflow.nyquist_validation: true` (Validation
  Architecture section included); `workflow.skip_discuss: true` (all
  implementation at Claude's discretion).

### Secondary (MEDIUM confidence -- ecosystem signal, not load-bearing)

- Microsoft Azure Compensating Transaction Pattern -- "intent-mark before
  side effect" is the canonical 2PC discipline; Phase 40 implements it.
- Temporal Saga Compensating Transactions -- intent-mark + per-bridge
  observability matches the saga primary-vs-compensation pattern.
- Quick task `260525-aub` (commit `da04709`) -- the typed-cause migration
  that established the `instanceof PluginShapeError` discipline at the
  uninstall.ts / remove.ts / update.ts cascade boundaries. Not directly
  modified by TR-04 (the recovery-hint emission is byte-identical), but
  Phase 40 preserves the discipline.
- Phase 39's Plan 39-01 (one plan, 3 tasks, ~1362 tests post-fix) --
  procedural template for the single-plan + per-task-commit shape Phase 40
  adopts (5 tasks instead of 3 due to larger scope).

### Tertiary (LOW confidence)

None -- all load-bearing claims sourced from project files read in full
or in the relevant slices.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new packages; existing imports verified by
  reading update.ts in full (lines 53-118).
- Architecture: HIGH -- all three fix-relevant code sites verified at
  line-level (update.ts:781-823 swapStateRecord; update.ts:867-989
  runThreePhaseUpdate; with-state-guard.ts:65-76 ST-7). The two-guard
  pattern matches the v1.7 research architecture Q4 verbatim.
- Pitfalls: HIGH -- direct authority from PITFALLS.md Pitfall 4 (state-
  before-commit partial-failure matrix) + Pitfall 12 (re-entrant retry);
  field-name asymmetry inherited from Phase 39 (TR-03 lock).
- Tests: HIGH -- existing PUP-6 / phase3a-commands-fail / phase3a-agents-fail
  / WR-04 / PUP-3 tests read at line-level. The matrix coverage analysis
  (per-bridge orthogonality from finalize logic) is structurally derived
  from the proposed `failedPhases.has(...)` gate.

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days -- in-place orchestrator-boundary fix;
the only external surface drift risk is the `shared/notify.ts` rendering of
`compatibility.notes` -- spot-checking is mandatory in Task 1 per A1)

## RESEARCH COMPLETE

The recommended fix structure for Phase 40:

1. **One plan (`40-01-PLAN.md`), five tasks.**
   - **Task 1:** Add `markUpdateInProgress` + `finalizeUpdateRecord` to
     `orchestrators/plugin/update.ts`. Define module-level constants
     (`UPDATE_IN_PROGRESS_NOTE`, `PHASE3_FAILURE_PHASES`). Spot-check
     `shared/notify.ts` rendering of `compatibility.notes` per A1. Leave
     `swapStateRecord` in place (dead code until Task 2).
   - **Task 2:** Rewire `runThreePhaseUpdate` to call intent-mark BEFORE
     phase-3a and finalize AFTER. Route finalize failures as synthetic
     `phase: "mcp"` Phase3Failure entries per Pitfall 4. Delete
     `swapStateRecord`.
   - **Task 3:** Amend existing `update.test.ts` tests with post-state
     assertions (PUP-6, phase3a-commands-fail, phase3a-agents-fail, WR-04).
     Verify PUP-3 unchanged stays UNTOUCHED. Confirm existing-test GREEN
     gate locally.
   - **Task 4:** Append 4 NEW matrix tests (one per bridge fails) + 1 NEW
     retry test (partial-success seed). Document the 16-case coverage
     attestation in a comment block.
   - **Task 5:** Run `npm run check`; confirm full suite GREEN.

2. **Key safety controls:**
   - Per-bridge gating uses `!failedPhases.has(bridge)` (NOT
     `failedPhases.size === 0`) -- the load-bearing structural contract
     for SC#2.
   - Version bump uses `phase3aFailures.length === 0` -- the all-or-nothing
     all-success gate.
   - Field-name mapping `commands -> prompts` mirrors Phase 39's TR-03
     asymmetry (document inline at the finalize site).
   - Two separate `withStateGuard` windows (intent-mark + finalize) preserve
     Phase 7 D-06 bounded-lock discipline; phase-3a renames run without
     the lock held.
   - Finalize-failure routes through `phase3aFailures` synthetic entry to
     reuse the existing `notifyDirectFailure` recovery-hint pipeline (no
     new notification surface).
   - PUP-6 phase-3 failure trigger preserved -- Phase 38's
     `removeOrphanIfPresent` is kind-strict + state.json-membership-
     discriminated; the `"obstacle"` file is NOT removed; rename ENOTDIR
     fires; phase3aFailures populates.
   - WR-04 success-path post-state assertions lock the all-success
     finalize contract (`version=NEW, installable=true, notes does NOT
     include "update-in-progress"`).
   - Retry test (SC#5) seeds the truthful partial-success state and
     verifies idempotent convergence to `version=NEW` on the second run.
