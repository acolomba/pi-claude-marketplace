# Phase 39: Cascade Ghost Record - Research

**Researched:** 2026-06-02
**Domain:** Orchestrator-boundary state mutation on partial cascade unstage; AG-5 foreign-content carve-out; ghost-record prevention without data loss
**Confidence:** HIGH

## Summary

Phase 39 closes the F3 ghost-record defect in two orchestrators
(`orchestrators/plugin/uninstall.ts` and `orchestrators/marketplace/remove.ts`)
that consume the `UnstageOutcome` shape returned by `cascadeUnstagePlugin`
(`orchestrators/marketplace/shared.ts:317-395`). The cascade primitive already
accumulates per-bridge drops into `outcome.dropped.{skills,commands,agents,mcpServers}`
as forward progress lands (lines 335, 341, 348, 372), and on the first throw it
returns `{ok:false, dropped, cause}` -- so the partial-success ledger of "what
was actually removed from disk" is already in the outcome. Phase 39 makes the
orchestrators materialise that ledger into a partial `sRecord.resources.*`
filter when cascade fails, instead of (a) leaving the row intact (the current
**ghost-record** behaviour pointing at vanished files) or (b) dropping the row
entirely (data loss).

The fix has two distinct shapes per call site. `uninstall.ts` currently `throw
outcome.cause` INSIDE `withStateGuard` (line 204) -- which aborts the save
entirely per the ST-7 "save only on no-throw" contract (`with-state-guard.ts:64`).
The fix must restructure this catch: for the AG-5 cause (cause instanceof
`AgentsUnstageFailureError`, defined at `shared.ts:55-62`), continue throwing
to preserve PU-3+PU-7 verbatim (state row intact via abort-save); for any other
cause, mutate `sRecord.resources.*` to drop dropped.* names IN-PLACE, then throw
OUTSIDE the guard so the save commits the shrunken row and the catch block still
emits its existing `PluginFailedMessage`. `remove.ts` is simpler: the per-plugin
loop (lines 202-214) already accumulates failures WITHOUT throwing from the
guard; the fix is to add an `else` arm that mutates `record.plugins[pluginName].resources.*`
in place for non-AG-5 causes before pushing to `failedPlugins[]`. The guard's
trailing `saveState` writes the shrunken record.

The single most important pitfall is the **field-name mismatch**: cascade's
`dropped.commands` populates from `installedPlugin.resources.prompts` (verified
at `shared.ts:339`), so the orchestrator filter must wire `dropped.commands ->
resources.prompts` (NOT `dropped.commands -> resources.commands`, which does not
exist). The state schema has `skills | prompts | agents | mcpServers` (verified
at `persistence/state-io.ts:47-52`); the cascade outcome has `skills | commands
| agents | mcpServers`. Getting this wrong silently no-ops the filter on the
prompts axis -- the ghost-record bug for prompts would remain even after a
"successful" filter. The locked, tested mapping is:

| `outcome.dropped.*` | `sRecord.resources.*` |
|---|---|
| `skills` | `skills` |
| `commands` | `prompts` |
| `agents` | `agents` |
| `mcpServers` | `mcpServers` |

**Primary recommendation:** Land both fix sites in a SINGLE plan (`39-01-PLAN.md`)
with 3 tasks: Task 1 wires the filter in `uninstall.ts` (restructure the
catch to keep AG-5 abort-save behaviour and add non-AG-5 in-guard filter +
out-of-guard throw); Task 2 wires the filter in `remove.ts` (add the `else` arm
to the per-plugin loop with the same AG-5 carve-out); Task 3 adds 4 new
regression tests (2 per call site: partial-success-non-AG5 asserting filtered
row + failure notification; AG-5 cause asserting full row preserved) and
verifies the full `npm run check` suite. **Do NOT** extract the helper to
`marketplace/shared.ts::applyPartialUnstageToRecord` -- the SUMMARY.md flags it
TR-D03 / DEFERRED, the shapes are 4 lines each, and the two call sites have
materially different catch-block structures (throw-in-guard vs. accumulate-out-of-guard).
Locality wins; defer dedup to v1.8 if a third caller appears.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Partial-cascade `resources.*` filter at orchestrator boundary | `orchestrators/plugin/uninstall.ts` + `orchestrators/marketplace/remove.ts` (both INSIDE their respective `withStateGuard`) | -- | The orchestrator holds the state lock and is the only tier that can mutate `sRecord.resources.*`. The cascade primitive at `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` stays read-only on state (SC#1 explicit). |
| AG-5 foreign-content cause discrimination | Both fix sites via `cause instanceof AgentsUnstageFailureError` | `orchestrators/marketplace/shared.ts:55-62` (class definition) + `shared.ts:360` (throw site) | The AG-5 carve-out is a TYPED discriminator (no substring matching). `AgentsUnstageFailureError` is exported from `marketplace/shared.ts` (NOT from `shared/errors.ts`) -- both fix sites already import it (`uninstall.ts:49`, `remove.ts:49`). |
| `dropped.* -> resources.*` field name mapping | Both fix sites (inline) | -- | The cascade's `dropped.commands` populates from `installedPlugin.resources.prompts` (shared.ts:339); the filter MUST wire `dropped.commands -> resources.prompts`. Locality of the 4-row mapping is preferable to a shared helper that could mask the mismatch. |
| Notification surface (`PluginFailedMessage`) | `uninstall.ts` catch block + `remove.ts` post-guard branch | `shared/notify.ts` (V2 renderer; unchanged) | The fix preserves the existing single-V2-notification contract per IL-2; severity (error), reload-hint suppression, and Reason narrowing (`narrowCascadeFailure`) all stay byte-identical to Phase 38 baseline. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states implementation is at Claude's discretion (discuss phase skipped
via `workflow.skip_discuss: true`). The five Specific Ideas in CONTEXT.md
`<specifics>` function as locked success criteria:

1. In `orchestrators/plugin/uninstall.ts`, on `outcome.ok === false`, the code
   filters `sRecord.resources.skills`, `.prompts`, `.agents`, `.mcpServers` by
   removing names present in `outcome.dropped.*`; the cascade primitive itself
   (`cascadeUnstagePlugin`) makes no state mutation.
2. `orchestrators/marketplace/remove.ts` applies the same filter in its
   per-plugin loop.
3. When `outcome.ok === false` and `cause instanceof AgentsUnstageFailureError`
   (AG-5 foreign-content), the state row is preserved intact (not filtered) --
   foreign content owned by another process must not cause data loss.
4. A regression test drives cascade-failure-after-partial-success and asserts
   `sRecord.resources.*` reflects only the artifacts still on disk; a second
   test drives the AG-5 cause and asserts the full row is preserved.
5. `npm run check` GREEN; no regression from Phase 38 baseline (1358 tests).

### Claude's Discretion

All implementation choices (whether to extract a helper, exact mutation idiom,
test-file organisation, error-message text on the AG-5 path) are at Claude's
discretion. The SUMMARY.md flags `applyPartialUnstageToRecord` extraction
(TR-D03) as DEFERRED -- the planner is free to keep the 4-row filter inline at
both sites or extract; this RESEARCH recommends inline locality.

### Deferred Ideas (OUT OF SCOPE)

None per CONTEXT.md. (`TR-D03` -- the optional `applyPartialUnstageToRecord`
extraction -- is a milestone-wide deferral, not a phase-39 deferral. The planner
may revisit it within Phase 39 if both call sites end up with byte-identical
filter logic.)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TR-03 | `orchestrators/plugin/uninstall.ts` and `orchestrators/marketplace/remove.ts` materialize `outcome.dropped.*` into a partial `sRecord.resources.*` filter on `outcome.ok === false`; the cascade primitive (`cascadeUnstagePlugin`) stays read-only on state; the AG-5 foreign-content cause preserves the full state row rather than stripping it. | Fix site verified at `uninstall.ts:202-205` (throw outcome.cause inside guard) and `remove.ts:209-213` (push to failedPlugins[] without state mutation); `UnstageOutcome` shape verified at `shared.ts:290-302`; `AgentsUnstageFailureError` exported from `shared.ts:55-62`; cascade's `dropped.commands <- resources.prompts` mapping verified at `shared.ts:339`. |

## Project Constraints (from CLAUDE.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Conventional Commits, titles >=5 and <=72 chars, body lines <=80 chars | CLAUDE.md "Git" | Commits land as `fix(orchestrators):` -- never `chore:`. Two sub-commits per task may apply (uninstall vs. remove). |
| `pre-commit run --all-files` before commit; fix failures, restage, re-run | CLAUDE.md "Git" | Implementation tasks MUST verify hooks pass before commit. |
| `SKIP=trufflehog` prefix only when committing from a worktree | CLAUDE.md "Git" | Not applicable -- working on `features/transaction-resilience-hardening` branch (not a worktree). |
| TypeScript strict; discriminated `installable: true \| false` (NFR-7) | CLAUDE.md "Constraints" | `installedPlugin.resources.*` arrays are `string[]` at the schema level (`state-io.ts:47-52`); the filter `arr.filter(n => !dropped.includes(n))` returns `string[]` -- no type changes required. |
| Atomic file ops (NFR-1) | CLAUDE.md "Constraints" | `withStateGuard` already wraps the mutation in `write-file-atomic` via `saveState` -- the new filter mutation is captured by the same atomic write. |
| Recovery via `/reload` only (NFR-2) | CLAUDE.md "Constraints" | The fix preserves `/reload`-only recovery: a partial failure now produces a truthful shrunken row that the next retry can act on (skills/commands already dropped from `resources.*`, retry skips them). |
| Retry-safe (NFR-3) | CLAUDE.md "Constraints" | The post-fix shrunken-row contract IS the retry-safety enabler: a subsequent uninstall retry's cascade reads `resources.{skills,prompts,agents,mcpServers}`, sees only the un-dropped names, and idempotently re-attempts. |
| Containment refusal (NFR-10) | CLAUDE.md "Constraints" | Not directly touched -- the filter is in-memory array manipulation; no new FS paths. |
| Output via `ctx.ui.notify` only (IL-2) | CLAUDE.md "Constraints" | Both fix sites already route through `notify(ctx, pi, message)`; the filter is a state mutation, not a notification change. Severity + reload-hint discipline preserved. |
| `npm run check` must stay GREEN (NFR-6) | CLAUDE.md "Constraints" | Phase-gate validation; SC#5 enforces this. |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow Enforcement" | Implementation MUST proceed via `/gsd-execute-phase`, not direct edits. |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | `^5.9.3` | Strict-mode `string[]` filter typing; `cause instanceof AgentsUnstageFailureError` narrowing | `[VERIFIED: package.json + tsconfig.json]`. |
| `node:test` | bundled with Node >=20.19.0 | Test framework for the 4 new regression tests | `[VERIFIED: tests/orchestrators/plugin/uninstall.test.ts and tests/orchestrators/marketplace/remove.test.ts both already use it]`. |
| `node:assert/strict` | bundled with Node >=20.19.0 | `assert.deepEqual`, `assert.equal`, `assert.ok` | `[VERIFIED: existing test files at uninstall.test.ts:1 and remove.test.ts:1]`. |

### No new dependencies

`.planning/research/SUMMARY.md` lines 36-50 are explicit: "No new dependencies.
All eight TR-* fixes stay within `extensions/pi-claude-marketplace/`." Phase 39
specifically requires zero new packages. Imports already present at both call
sites (`AgentsUnstageFailureError`, `cascadeUnstagePlugin`, `UnstageOutcome`,
`withStateGuard`, `notify`) are sufficient.

## Package Legitimacy Audit

Not applicable -- Phase 39 installs no new packages. The fix is in-place
restructuring of two existing orchestrator catch/loop blocks plus regression
tests using already-installed `node:test` and `node:assert/strict` built-ins.

## Architecture Patterns

### System Architecture Diagram

```
   uninstallPlugin(opts)                  removeMarketplace(opts)
        │                                       │
        ▼                                       ▼
   withStateGuard(locations, async (state) => { ... })
        │                                       │
        ▼                                       ▼
   sRecord = state.marketplaces[mp]       record = state.marketplaces[opts.name]
            .plugins[plugin]                       │
        │                                       │
        ▼                                       ▼ for each [pluginName, plugin]
   outcome = await cascade(...)            outcome = await cascade(pluginName,...)
        │                                       │
        ├── ok=true: delete row             ├── ok=true: delete record.plugins[pluginName]
        │                                   │              successfullyUnstaged.push(...)
        │                                   │
        └── ok=false:                       └── ok=false:
              ┌──── NEW (Phase 39) ────┐         ┌──── NEW (Phase 39) ────┐
              │ if (cause instanceof   │         │ if (cause instanceof   │
              │     AgentsUnstageFail) │         │     AgentsUnstageFail) │
              │   throw cause   ◄──── AG-5: abort save, full row preserved
              │ else                    │         │ else                    │
              │   sRecord.resources    │         │   plugin.resources     │
              │     .skills = filter   │         │     .skills = filter   │
              │     .prompts = filter  │         │     .prompts = filter  │
              │     .agents = filter   │         │     .agents = filter   │
              │     .mcpServers = ...  │         │     .mcpServers = ...  │
              │   throw cause          │         │   failedPlugins.push   │
              │   (escapes guard;       │         │     ({name, cause})   │
              │    save still happens? │         │ // does NOT delete row │
              │    NO: ST-7 aborts)    │         │ // guard saves shrunken │
              └────────────────────────┘         │   row (no throw)        │
                                                  └────────────────────────┘
        │                                       │
        ▼                                       ▼
   (uninstall catch -> notify)            (post-guard branches)
                                          if (failedPlugins.length > 0)
                                            notify({status: "failed", ...})
                                          else
                                            notify({status: "removed", ...})
```

**Critical contract divergence between the two sites:**

- **`uninstall.ts`** (single plugin, single guard): `withStateGuard`'s ST-7
  "save only on no-throw" means that for the non-AG-5 partial path we want the
  shrunken row PERSISTED. The mutation must happen IN-place, then the throw
  must escape the guard so the catch block fires the failure notification.
  **But ST-7 means a throw aborts the save.** Two viable shapes:
  - **Shape A (post-guard re-throw):** capture the cause inside the guard,
    mutate `sRecord.resources.*` in place, return normally from the closure
    (guard saves the shrunken row), then surface failure via a sentinel flag
    or return-value channel that the outer code branches on to emit the
    `PluginFailedMessage`.
  - **Shape B (throw + retry):** keep the throw inside the guard; let it abort
    save; the existing ghost-record persists. **REJECTED** -- this is the bug
    being fixed.
  - **Shape A is the correct shape.** The throw moves OUT of the guard
    closure; the catch block becomes a post-guard branch on a captured-failure
    sentinel. See "Code Examples" below.

- **`remove.ts`** (multi-plugin loop, single guard): the existing loop already
  does NOT throw on per-plugin failure -- it accumulates `failedPlugins[]` and
  the guard saves the partial state at end of loop. The fix is additive:
  before pushing to `failedPlugins[]`, mutate the plugin's `resources.*` arrays
  in place for non-AG-5 causes. The guard's existing save commits the
  shrunken row. AG-5 case: skip the mutation; push to failedPlugins as today.
  **No structural change** to the loop; just an `if/else` on the cause type.

### Recommended Project Structure

No new files. The fix is in-place across two existing source files plus two
existing test files:

```
extensions/pi-claude-marketplace/
└── orchestrators/
    ├── plugin/
    │   └── uninstall.ts        # MODIFIED: restructure withStateGuard
    │                           #           closure to capture cascade-failure
    │                           #           sentinel, mutate row on non-AG5,
    │                           #           surface failure via post-guard branch
    └── marketplace/
        └── remove.ts           # MODIFIED: extend ok=false arm of per-plugin
                                #           loop to mutate plugin.resources.*
                                #           for non-AG5 cause before failedPlugins.push

tests/
├── orchestrators/
│   ├── plugin/
│   │   └── uninstall.test.ts   # MODIFIED: append 2 new tests (TR-03
│   │                           #           partial-success-non-AG5 +
│   │                           #           AG-5 full-row-preserved)
│   └── marketplace/
│       └── remove.test.ts      # MODIFIED: append 2 new tests (same shape
│                               #           as uninstall, adapted to multi-
│                               #           plugin loop)
```

### Pattern 1: Cascade-failure sentinel + post-guard branch (uninstall.ts)

**What:** Replace the current `throw outcome.cause` inside `withStateGuard`
(uninstall.ts:204) with a sentinel-capture pattern that lets the guard SAVE the
shrunken row on the non-AG-5 path while still letting the catch block fire the
existing failure notification.

**Why required:** ST-7's "save only on no-throw" contract (`with-state-guard.ts:64`)
means that a throw inside the guard abandons all mutations to `sRecord`. For
SC#1 (filter on non-AG-5 partial), the mutation MUST persist, so the closure
MUST return normally. Failure is then surfaced via a captured sentinel.

**Example shape (post-fix uninstall.ts):**

```typescript
// Source: research synthesis grounded in uninstall.ts:162-240 and
// the ST-7 contract at transaction/with-state-guard.ts:64.

let alreadyGone = false;
let outcome: UnstageOutcome | undefined;
let removedVersion: string | undefined;
// NEW: capture the cascade-failure cause so the post-guard branch can fire
// the existing PluginFailedMessage. Set INSIDE the guard; read AFTER.
let cascadeFailure: Error | undefined;

await withStateGuard(locations, async (state) => {
  const mp = state.marketplaces[marketplace];
  if (mp === undefined) {
    alreadyGone = true;
    return;
  }
  const installed = mp.plugins[plugin];
  if (installed === undefined) {
    alreadyGone = true;
    return;
  }
  removedVersion = installed.version;

  outcome = await cascade(plugin, marketplace, locations, installed);

  if (!outcome.ok) {
    const cause = outcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);

    if (cause instanceof AgentsUnstageFailureError) {
      // AG-5 carve-out (SC#3): preserve the row intact. Re-throw to
      // abort the save -- the row stays at its pre-cascade contents.
      // Existing PU-3 + PU-7 test (uninstall.test.ts:344) relies on
      // this exact shape.
      throw cause;
    }

    // SC#1: non-AG-5 partial -- filter resources.* by dropped.*.
    // Mapping (CRITICAL): dropped.commands -> resources.prompts.
    // The mutation persists via the guard's trailing saveState.
    const sRecord = mp.plugins[plugin]!; // alias for clarity; same object as `installed`
    sRecord.resources.skills = sRecord.resources.skills.filter(
      (n) => !outcome!.dropped.skills.includes(n),
    );
    sRecord.resources.prompts = sRecord.resources.prompts.filter(
      (n) => !outcome!.dropped.commands.includes(n),
    );
    sRecord.resources.agents = sRecord.resources.agents.filter(
      (n) => !outcome!.dropped.agents.includes(n),
    );
    sRecord.resources.mcpServers = sRecord.resources.mcpServers.filter(
      (n) => !outcome!.dropped.mcpServers.includes(n),
    );

    // Surface failure to the post-guard branch; do NOT throw (we want
    // saveState to commit the shrunken row).
    cascadeFailure = cause;
    return;
  }

  // Happy path: delete the row entirely.
  delete mp.plugins[plugin];
});

// ... silent-converge branch unchanged ...

if (cascadeFailure !== undefined) {
  // Emit the existing V2 PluginFailedMessage. Severity (error) and
  // reload-hint computation unchanged; the post-state cache + data-dir
  // cleanup is SKIPPED on the failure path (current behaviour preserved
  // because the original throw skipped them too).
  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: [narrowCascadeFailure(cascadeFailure)],
    ...(removedVersion !== undefined && { version: removedVersion }),
    cause: cascadeFailure,
  };
  notify(ctx, pi, {
    marketplaces: [{ name: marketplace, scope, plugins: [failedRow] }],
  });
  return;
}

// ... existing post-guard success branches (cache drop, data-dir rm,
// PluginUninstalledMessage) unchanged ...
```

**Critical notes:**
- The AG-5 throw INSIDE the guard preserves the existing PU-3+PU-7 test
  invariant (state record retained intact). The current outer try/catch (at
  uninstall.ts:212-240) already handles this -- it must REMAIN as the AG-5
  catch path. The Shape A change adds a SECOND surface (the `cascadeFailure`
  sentinel) for non-AG-5; the existing try/catch handles AG-5.
- An alternative shape that captures BOTH causes via sentinel (no `throw`
  inside the guard at all) would require an additional mechanism to abort the
  save on AG-5. This is what `withLockedStateTransaction` provides --
  explicit `tx.save()`. Migrating uninstall to `withLockedStateTransaction`
  is OUT OF SCOPE for Phase 39 (it would touch state-flow semantics across
  the file). Keep `withStateGuard` and use the throw-for-AG-5 channel.
- The `outcome!` non-null assertion after `if (!outcome.ok)` is required
  because TS flow analysis cannot prove `outcome` (declared `let outcome:
  UnstageOutcome | undefined`) is defined inside the closure. Existing code
  (uninstall.ts:194-205) already structures around this; the new code can
  use the same pattern.

### Pattern 2: Per-plugin in-loop filter (remove.ts)

**What:** Extend the existing `else` arm of the per-plugin loop (remove.ts:209-213)
to mutate `plugin.resources.*` in place for non-AG-5 causes before pushing to
`failedPlugins[]`. The guard's existing save commits the shrunken plugin record.

**Example shape (post-fix remove.ts):**

```typescript
// Source: research synthesis grounded in remove.ts:202-220 and
// the cascade outcome contract at shared.ts:290-302.

for (const [pluginName, plugin] of Object.entries(record.plugins)) {
  const outcome = await cascade(pluginName, opts.name, locations, plugin);
  if (outcome.ok) {
    successfullyUnstaged.push(pluginName);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
    delete record.plugins[pluginName];
  } else {
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

    if (!(cause instanceof AgentsUnstageFailureError)) {
      // SC#1/SC#2 (non-AG-5 partial): filter the plugin's resources.* by
      // dropped.* names. Mapping: dropped.commands -> resources.prompts.
      // The mutation persists via the guard's trailing saveState because
      // the loop does NOT throw.
      plugin.resources.skills = plugin.resources.skills.filter(
        (n) => !outcome.dropped.skills.includes(n),
      );
      plugin.resources.prompts = plugin.resources.prompts.filter(
        (n) => !outcome.dropped.commands.includes(n),
      );
      plugin.resources.agents = plugin.resources.agents.filter(
        (n) => !outcome.dropped.agents.includes(n),
      );
      plugin.resources.mcpServers = plugin.resources.mcpServers.filter(
        (n) => !outcome.dropped.mcpServers.includes(n),
      );
    }
    // AG-5 case (SC#3): leave the row intact -- skip the filter entirely.

    failedPlugins.push({ name: pluginName, cause });
  }
}
```

**Critical notes:**
- TS strict typing: `plugin` is `installedPlugin` typed via the schema
  (state-io.ts ST-3 PLUGIN_INSTALL_RECORD_SCHEMA). The `.resources` object
  fields are `Type.Array(Type.String())` -- so `string[]`. `.filter()`
  returns `string[]`. No type-cast required.
- The plugin object reference (`plugin`) is the SAME object held in
  `record.plugins[pluginName]` -- mutating `plugin.resources.skills` mutates
  the record. The guard's saveState writes the shrunken record.
- AG-5 case: skipping the filter intentionally leaves the row's
  `resources.*` arrays pointing at the original on-disk contents. The agents
  bridge already preserved the foreign-content index row (see PU-3 + PU-7
  invariant); the state row stays consistent with the index.

### Pattern 3: Type-discrimination via `instanceof` (NOT substring matching)

**What:** The AG-5 carve-out uses `cause instanceof AgentsUnstageFailureError`,
matching the convention established in `narrowCascadeFailure` at both call
sites (`uninstall.ts:94`, `remove.ts:103`).

**Why required:** Substring-matching cause text is the V1 pattern that quick
task `260525-aub` (commit `da04709`) deliberately replaced with typed dispatch
to eliminate the SonarCloud S5852 ReDoS hotspot. New code MUST use
`instanceof` discrimination.

**Example (existing convention, verified in both files):**

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:93-114
function narrowCascadeFailure(cause: Error): Reason {
  if (cause instanceof AgentsUnstageFailureError) {
    return "not in manifest";
  }
  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return "permission denied";
      case "ENOENT":
        return "source missing";
      default:
        break;
    }
  }
  return "not in manifest";
}
```

The TR-03 filter discrimination follows the SAME shape: `cause instanceof
AgentsUnstageFailureError` first, no message-text inspection.

### Anti-Patterns to Avoid

- **Mutating state inside `cascadeUnstagePlugin`.** SC#1 explicitly forbids it:
  "the cascade primitive itself (`cascadeUnstagePlugin`) makes no state
  mutation." The primitive returns a READ-ONLY `UnstageOutcome` (the
  `Object.freeze` at shared.ts:374, 384 already enforces this). All state
  mutation belongs at the orchestrator boundary inside `withStateGuard`.
- **Filtering by `outcome.dropped.commands -> resources.commands`** -- a field
  that does not exist (Pitfall 1). The cascade reads from `resources.prompts`
  (shared.ts:339) and reports as `dropped.commands` (shared.ts:341); the
  filter must wire `dropped.commands -> resources.prompts`.
- **Substring matching the cause message text for AG-5 detection** -- repeats
  the V1 ReDoS pattern that quick task `260525-aub` eliminated. Use
  `instanceof AgentsUnstageFailureError` (Pattern 3).
- **Filtering the row on AG-5 cause** -- SC#3 explicit. Foreign content owned
  by another process is a manual-recovery situation; the row stays intact so
  a retry has the complete `resources.*` history to re-attempt cascade.
- **Replacing `withStateGuard` with `withLockedStateTransaction`** to gain
  explicit `tx.save()` control over both AG-5 and non-AG-5 paths.
  `withLockedStateTransaction` is a Phase 8 PRL-10 facility for orchestrators
  that need a rollback-window between phase-3a commits and state save. Phase
  39's scope is the partial-cascade filter at an existing orchestrator
  boundary; migrating to the locked-transaction shape is a much larger
  refactor and is OUT OF SCOPE.
- **Extracting `applyPartialUnstageToRecord` to `marketplace/shared.ts`** in
  Phase 39. TR-D03 is a DEFERRED dedup helper per `.planning/REQUIREMENTS.md`
  line 78-79 ("optional dedup; locality preferred for v1.7"). The two call
  sites have meaningfully different surrounding structure (throw-in-guard vs.
  accumulate-out-of-guard); a 4-row helper extracted in Phase 39 would couple
  the two sites prematurely. Defer to v1.8 if a third caller appears.
- **Touching `narrowCascadeFailure` in either file.** The Reason narrowing
  contract is locked by quick task `260525-aub` and by the catalog UAT
  fixtures. Phase 39 changes state mutation, NOT notification. The
  `PluginFailedMessage.reasons` shape stays byte-identical -- the V2
  `(failed) {not in manifest}` body in PU-3+PU-7 must remain verbatim.
- **Removing the existing outer `try/catch` in uninstall.ts.** The AG-5 path
  still throws from inside the guard; the existing catch (lines 212-240)
  still handles the AG-5 notification surface. The Phase 39 change is
  ADDITIVE: a new `cascadeFailure` sentinel branch is added AFTER the
  `alreadyGone` check; the existing catch block remains as the AG-5 surface.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Partial-state-mutation helper | New `applyPartialUnstageToRecord(record, dropped)` extracted to `marketplace/shared.ts` | Inline 4-row filter at each call site | TR-D03 is DEFERRED per REQUIREMENTS.md; two call sites with different surrounding shapes; locality preferred for v1.7. |
| Cause-type discrimination wrapper | New `isForeignContentFailure(cause)` predicate | `cause instanceof AgentsUnstageFailureError` inline | The two call sites already inline this check inside `narrowCascadeFailure`; a one-line `instanceof` is more readable than a predicate. |
| Atomic resource-array mutation | `immer`, `immutable.js`, structuredClone-based reassign | Direct in-place `.filter()` reassign to mutable schema-typed field | `installedPlugin.resources.skills` is typed `string[]` via TypeBox `Type.Array(Type.String())` -- a mutable schema field; in-place reassign is standard. `withStateGuard`'s atomic save (`write-file-atomic` via `saveState`) provides crash-safety; no extra immutability layer needed. |
| Generic shared "cascade-outcome-to-state-mutation" helper | New `marketplace/shared.ts::applyCascadeOutcome(record, outcome)` that handles both ok and !ok arms | Keep the ok/!ok branching at the call site | The ok arm in remove.ts ALSO does `delete record.plugins[pluginName]` + `successfullyUnstaged.push`; the ok arm in uninstall.ts does `delete mp.plugins[plugin]`. The branching cannot be unified without surrendering the per-orchestrator semantics that distinguish "single plugin / abort or commit" from "multi-plugin / per-plugin outcome". |

**Key insight:** The fix is structural at TWO specific call sites with
different surrounding context. The temptation to extract `applyPartialUnstageToRecord`
is documented in SUMMARY.md as a DEFERRED helper (TR-D03); the planner should
favour locality and the explicit 4-row filter at each site. If both filter
blocks end up byte-identical, extraction can land in a follow-up after Phase
39 closes.

## Runtime State Inventory

Not applicable. Phase 39 is not a rename / refactor / migration; the change is
to in-memory mutation flow inside two orchestrator closures. No runtime state
migration required.

- **Stored data:** State.json schema unchanged. `resources.{skills,prompts,
  agents,mcpServers}` arrays are SHRUNK on partial failure (a value-shape
  change, not a schema change). No migration tooling required: existing
  records with full `resources.*` are still valid post-Phase-39; new records
  written by partial failure simply have shorter arrays.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: Field-name mismatch (`commands` vs `prompts`) -- highest-risk

**What goes wrong:** The cascade outcome reports `dropped.commands`, but the
state-record schema uses `resources.prompts`. A naive filter
`sRecord.resources.commands.filter(...)` accesses a non-existent field; TS
strict mode catches it. But the inverse mistake -- filtering
`sRecord.resources.prompts` against `dropped.prompts` (a non-existent field on
`UnstageOutcome.dropped`) -- ALSO trips TS strict mode. The hidden trap is the
"clever" mix: filtering `sRecord.resources.prompts` against `dropped.commands`
LOOKS wrong at first glance but is the ONLY correct mapping.

**Why it happens:** The cascade was written when the field was called "commands"
(see the `commands` bridge); the state schema uses `prompts` to mirror
Claude's terminology (PRD §6.12). The mismatch is locked by the existing
cascade implementation at `shared.ts:339`: `previousCommandNames:
installedPlugin.resources.prompts`. Reading that line confirms the mapping.

**How to avoid:**
1. Build a mapping table at the top of the filter block as a comment:
   `// dropped.skills -> resources.skills, dropped.commands -> resources.prompts,`
   `// dropped.agents -> resources.agents, dropped.mcpServers -> resources.mcpServers`
2. Write each filter line OUT EXPLICITLY (no clever loop) so the mapping is
   visible at the call site.
3. Add a regression test that seeds `installedPlugin.resources.prompts =
   ["c1", "c2"]` and stubs `cascade` to return `dropped.commands = ["c1"]`;
   assert `resources.prompts = ["c2"]` post-call. If the wiring is wrong,
   this test reds.

**Warning signs:** A future planner reads `dropped.commands` and reaches for
`sRecord.resources.commands`. TS strict catches that. But a careless
refactor that "tidies up" the field-name asymmetry (e.g., renames `dropped.commands`
to `dropped.prompts` in `UnstageOutcome` -- which would be a breaking change
spanning shared.ts + every consumer) is the lurking risk.

### Pitfall 2: AG-5 cause-discrimination wrong-direction

**What goes wrong:** Inverting the AG-5 check (`if (cause instanceof
AgentsUnstageFailureError)` becomes `if (!(cause instanceof
AgentsUnstageFailureError))`). The non-AG-5 path then filters on AG-5 (data
loss) and the AG-5 path preserves the row on every OTHER error (perfect
ghost record for EACCES). Both are silent regressions because the existing
PU-3+PU-7 test only exercises the AG-5 case; a non-AG-5 cause is currently
untested.

**Why it happens:** The locked-decision SC#3 wording (`cause instanceof
AgentsUnstageFailureError ... state row preserved intact`) reads as "if AG-5
THEN preserve", but a refactor might flip the predicate.

**How to avoid:**
1. The SC#4 new test specifies a non-AG-5 cascade-failure cause (e.g.,
   `new Error("EACCES at skill")`). Assert `resources.skills` is FILTERED.
2. The SC#4 second test specifies an `AgentsUnstageFailureError` cause.
   Assert `resources.skills` is UNCHANGED (full row preserved).
3. Both tests stub the cascade -- no actual filesystem race required.

**Warning signs:** A test that asserts "the row is filtered when cascade
fails" without specifying the cause type. That test could go GREEN whether
or not AG-5 is correctly carved out.

### Pitfall 3: ST-7 throw-aborts-save trap in uninstall.ts

**What goes wrong:** Naively translating "filter the row and throw" into the
uninstall.ts closure produces:

```typescript
// WRONG
if (!outcome.ok) {
  sRecord.resources.skills = sRecord.resources.skills.filter(...);
  // ... 3 more filter lines ...
  throw outcome.cause;  // BUG: ST-7 aborts the save; filter is lost
}
```

The throw inside the guard means `saveState` is NOT called (verified at
`with-state-guard.ts:64`: "On any throw inside `mutate`, the original error
propagates and `saveState` is NOT called"). The filter mutation is in-memory
only; state.json on disk is unchanged. The ghost record persists.

**Why it happens:** The CURRENT code structure (`throw outcome.cause` at
uninstall.ts:204) was designed for AG-5 only -- where abort-save IS the
correct semantics. Extending the throw to non-AG-5 cases requires moving the
notification surface OUT of the current catch and INTO a post-guard branch
that fires on a captured sentinel.

**How to avoid:**
1. Use Pattern 1 (sentinel + post-guard branch). The non-AG-5 path mutates,
   then `return` from the closure (no throw -- save commits). The
   `cascadeFailure` sentinel is captured in the outer scope; the
   post-guard branch checks it and fires the `PluginFailedMessage`.
2. The AG-5 path keeps its existing `throw cause` -- the existing outer
   try/catch handles it. (Two surface paths: AG-5 via try/catch, non-AG-5
   via sentinel. Document this explicitly in a code comment.)
3. Add a regression test that asserts `state.json` ON DISK reflects the
   shrunken row AFTER a non-AG-5 partial failure. Reload state via
   `loadState` after the orchestrator call -- this catches the
   "in-memory only" trap.

**Warning signs:** A regression test that only asserts the notification
shape, without re-loading state from disk to verify the mutation persisted.

### Pitfall 4: Post-failure cleanup skipping

**What goes wrong:** The current uninstall.ts catch block (lines 212-240) is
the AG-5 surface; on the throw, the post-state cleanup (lines 254-279:
`dropMarketplaceCache`, `rm(dataDir)`, `notify(PluginUninstalledMessage)`) is
SKIPPED. Phase 39's new sentinel branch must NOT skip them differently --
the contract is "on cascade failure (any), skip post-state cleanup." A
half-hearted implementation that runs cache-drop after a non-AG-5 partial
failure but skips it after AG-5 would diverge.

**Why it happens:** The post-guard cleanup block sits BELOW the catch
return; both AG-5 (via catch) and non-AG-5 (via new sentinel) must return
BEFORE the cleanup runs.

**How to avoid:**
1. The post-guard `cascadeFailure !== undefined` branch MUST `return` after
   emitting the `PluginFailedMessage` -- same shape as the existing catch
   block (line 239 `return;`).
2. Specifically: the post-guard order is `alreadyGone -> return; cascadeFailure ->
   notify+return; success -> cache-drop, data-dir rm, PluginUninstalledMessage`.
3. Run the existing PU-3+PU-7 test verbatim: it asserts `notifications.length ===
   1` AND `notifications[0].severity === "error"` -- if cleanup runs after AG-5,
   `dropMarketplaceCache` could throw an extra notification (it doesn't currently
   -- it's wrapped in a swallow try/catch at lines 254-262 -- but the structural
   discipline matters).

**Warning signs:** A test that asserts `notifications.length === 1` after a
NON-AG-5 partial failure. If the cleanup block runs by accident, you might
get TWO notifications (the failure + an accidental success). Test catches
that.

### Pitfall 5: `failedPlugins.push` ordering vs. delete (remove.ts)

**What goes wrong:** In remove.ts's per-plugin loop, the existing ok=true arm
does `delete record.plugins[pluginName]`. The new !ok arm with the filter
must NOT delete the row -- it shrinks it. A "clever" refactor that
unifies the two arms could accidentally delete the shrunken row.

**Why it happens:** The intuition "always delete the plugin record on cascade
return" is wrong; the shrunken row is the truthful representation of disk
state and MUST persist.

**How to avoid:**
1. Keep the ok / !ok branching explicit at the top of the loop:
   `if (outcome.ok) { delete ... } else { ... filter ... failedPlugins.push(...) }`.
2. The !ok branch NEVER deletes from `record.plugins`. The trailing
   `if (failedPlugins.length === 0) delete state.marketplaces[opts.name]`
   at remove.ts:216-219 correctly preserves the marketplace record when ANY
   plugin failed -- this stays unchanged.
3. Regression test: seed `record.plugins = { "p1": ..., "p2": ... }`; stub
   cascade so p1 succeeds and p2 fails non-AG-5; assert post-call
   `record.plugins.p1 === undefined` (deleted) AND `record.plugins.p2 !==
   undefined` (shrunken, retained).

**Warning signs:** A change that moves the `delete record.plugins[pluginName]`
OUT of the `if (outcome.ok)` arm. The schema-typed `record.plugins` is a
`Record<string, ...>` -- deleting a key is irrevocable inside the loop.

### Pitfall 6: `Object.freeze`'d outcome.dropped arrays

**What goes wrong:** `cascadeUnstagePlugin` returns `dropped.*` arrays
wrapped in `Object.freeze` (verified at `shared.ts:377-380, 387-390`). The
filter call `dropped.skills.includes(n)` is safe (`.includes` is read-only).
But a future "optimization" that sorts the outcome arrays
(`dropped.skills.sort()`) would throw a TypeError under strict mode.

**Why it happens:** Freeze is invisible at TS level (`readonly string[]` is
just a type assertion; runtime freeze enforces it). A planner unfamiliar
with the freeze contract might assume the arrays are mutable.

**How to avoid:**
1. The filter `arr.filter(n => !outcome.dropped.X.includes(n))` does NOT
   mutate the outcome -- it produces a new array assigned to
   `sRecord.resources.X`. This is the correct shape.
2. Do NOT sort, push, splice, or otherwise mutate `outcome.dropped.*` --
   it's frozen.

**Warning signs:** A test that mutates `outcome.dropped` to set up a
condition. Builds a different fake outcome instead.

### Pitfall 7: Filter wired against `installed.resources.*` (pre-cascade snapshot)

**What goes wrong:** In uninstall.ts, the closure captures `installed = mp.plugins[plugin]`
at line 182. After the cascade returns, the closure mutates state via
`sRecord` (the SAME object). A naive Phase 39 implementation might re-derive
`installed.resources.skills.filter(...)` and assign back, hoping for clarity:

```typescript
// LOOKS clearer but is the SAME mutation (installed === sRecord === mp.plugins[plugin])
installed.resources.skills = installed.resources.skills.filter(...);
```

This is structurally identical to the recommended pattern; it just relies on
the implicit aliasing. The pitfall is: the planner SHOULD use `sRecord` (or
`mp.plugins[plugin]!`) as the explicit mutation target so a reader of the
diff sees "mutating state" not "mutating a local variable."

**How to avoid:**
1. Use an explicit alias: `const sRecord = mp.plugins[plugin]!;` before the
   filter block.
2. Document in a comment: "// sRecord IS the state-tree object; mutation
   persists via the guard's saveState."

**Warning signs:** Confusion in the diff about whether `installed` is the
state object or a local snapshot. Use a distinct name (`sRecord`) to clear
the ambiguity.

## Code Examples

### Verified pattern: existing AG-5 throw inside `withStateGuard` (uninstall.ts, current)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:194-211
// (verbatim, current code BEFORE Phase 39)

// PU-1 ordering enforced INSIDE cascadeUnstagePlugin (Phase 4 D-03
// corollary: skills -> commands -> agents -> mcp).
outcome = await cascade(plugin, marketplace, locations, installed);

// PU-7: cascade returns ok=false with chained AgentsUnstageFailureError
// when foreign content detected at an agent target file. Re-throw to
// abort the state commit (the marketplace record + plugin record stay
// intact for retry).
if (!outcome.ok) {
  // outcome.cause is non-undefined when ok=false (Phase 4 D-03 contract).
  throw outcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
}

// State commit: remove the plugin record. The guard saves atomically
// on closure return.
// eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- mp.plugins is a dynamic-key Record<string, ...>.
delete mp.plugins[plugin];
```

### Verified pattern: existing per-plugin loop (remove.ts, current)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:202-220
// (verbatim, current code BEFORE Phase 39)

for (const [pluginName, plugin] of Object.entries(record.plugins)) {
  const outcome = await cascade(pluginName, opts.name, locations, plugin);
  if (outcome.ok) {
    successfullyUnstaged.push(pluginName);

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
    delete record.plugins[pluginName];
  } else {
    // D-03: outcome.cause is set when ok===false (see UnstageOutcome).
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);
    failedPlugins.push({ name: pluginName, cause });
  }
}

if (failedPlugins.length === 0) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- state.marketplaces is a dynamic-key Record<string, ...>.
  delete state.marketplaces[opts.name];
}
```

### Verified shape: `UnstageOutcome` discriminated by `ok`

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:290-302
// (verbatim)

export interface UnstageOutcome {
  /** True when all four bridges' unstage* calls returned cleanly. */
  readonly ok: boolean;
  /** Names actually removed across all four bridges. Empty when nothing was staged. */
  readonly dropped: {
    readonly skills: readonly string[];
    readonly commands: readonly string[];
    readonly agents: readonly string[];
    readonly mcpServers: readonly string[];
  };
  /** Set on failure: the FIRST throw, wrapped to Error if needed (D-03 fail-fast). */
  readonly cause?: Error;
}
```

### Verified shape: `AgentsUnstageFailureError` (the AG-5 discriminator)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:55-62
// (verbatim)

export class AgentsUnstageFailureError extends Error {
  readonly failedAgents: readonly UnstageAgentFailure[];
  constructor(message: string, failedAgents: readonly UnstageAgentFailure[]) {
    super(message);
    this.name = "AgentsUnstageFailureError";
    this.failedAgents = failedAgents;
  }
}
```

### Verified mapping: cascade reads `prompts`, reports `commands`

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:337-341
// (verbatim) -- proves the dropped.commands <- resources.prompts axis

const cmdResult = await unstagePluginCommands({
  locations,
  previousCommandNames: installedPlugin.resources.prompts,
});
dropped.commands = [...cmdResult.removedNames];
```

### Verified shape: state schema (`resources` field names)

```typescript
// Source: extensions/pi-claude-marketplace/persistence/state-io.ts:38-55
// (verbatim) -- proves the schema axis

const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({
  version: Type.String(),
  resolvedSource: Type.String(),
  compatibility: Type.Object({
    installable: Type.Boolean(),
    notes: Type.Array(Type.String()),
    supported: Type.Array(Type.String()),
    unsupported: Type.Array(Type.String()),
  }),
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
  }),
  installedAt: Type.String(),
  updatedAt: Type.String(),
});
```

### Required new pattern: TR-03 filter in uninstall.ts (post-fix)

See Pattern 1 above for the full structural diff. The salient new block:

```typescript
if (!outcome.ok) {
  const cause = outcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);

  if (cause instanceof AgentsUnstageFailureError) {
    // SC#3: AG-5 carve-out. Throw to abort save; row preserved intact.
    throw cause;
  }

  // SC#1: non-AG-5 partial. Filter resources.* by dropped.*; the guard
  // saves the shrunken row. Field-name mapping:
  //   dropped.skills    -> resources.skills
  //   dropped.commands  -> resources.prompts   (note the asymmetry!)
  //   dropped.agents    -> resources.agents
  //   dropped.mcpServers -> resources.mcpServers
  const sRecord = mp.plugins[plugin]!;
  sRecord.resources.skills = sRecord.resources.skills.filter(
    (n) => !outcome!.dropped.skills.includes(n),
  );
  sRecord.resources.prompts = sRecord.resources.prompts.filter(
    (n) => !outcome!.dropped.commands.includes(n),
  );
  sRecord.resources.agents = sRecord.resources.agents.filter(
    (n) => !outcome!.dropped.agents.includes(n),
  );
  sRecord.resources.mcpServers = sRecord.resources.mcpServers.filter(
    (n) => !outcome!.dropped.mcpServers.includes(n),
  );

  // Surface the failure to the post-guard branch (sentinel pattern).
  // No throw -- the guard's saveState commits the shrunken row.
  cascadeFailure = cause;
  return;
}
```

### Required new pattern: TR-03 filter in remove.ts (post-fix)

```typescript
for (const [pluginName, plugin] of Object.entries(record.plugins)) {
  const outcome = await cascade(pluginName, opts.name, locations, plugin);
  if (outcome.ok) {
    successfullyUnstaged.push(pluginName);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
    delete record.plugins[pluginName];
  } else {
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);

    if (!(cause instanceof AgentsUnstageFailureError)) {
      // SC#1/SC#2: non-AG-5 partial. Filter the plugin's resources.* by
      // dropped.* names. Field-name mapping (note asymmetry):
      //   dropped.skills    -> resources.skills
      //   dropped.commands  -> resources.prompts
      //   dropped.agents    -> resources.agents
      //   dropped.mcpServers -> resources.mcpServers
      // The mutation persists via the guard's trailing saveState because
      // the loop does NOT throw.
      plugin.resources.skills = plugin.resources.skills.filter(
        (n) => !outcome.dropped.skills.includes(n),
      );
      plugin.resources.prompts = plugin.resources.prompts.filter(
        (n) => !outcome.dropped.commands.includes(n),
      );
      plugin.resources.agents = plugin.resources.agents.filter(
        (n) => !outcome.dropped.agents.includes(n),
      );
      plugin.resources.mcpServers = plugin.resources.mcpServers.filter(
        (n) => !outcome.dropped.mcpServers.includes(n),
      );
    }
    // AG-5 case (SC#3): leave the row intact -- skip the filter entirely.

    failedPlugins.push({ name: pluginName, cause });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `throw outcome.cause` inside the guard on ALL non-ok cases (uninstall.ts) -- aborts save, leaves the FULL resources.* arrays intact whether or not some bridges succeeded -> ghost record on partial failures | AG-5 cause: still throw (preserve full row). Non-AG-5 cause: in-place filter `resources.* by dropped.*` then return (guard saves shrunken row) | Phase 39 (v1.7, TR-03) | Closes the ghost-record path documented in PITFALLS.md Pitfall 3 / SUMMARY.md F3 -- state.json now reflects what is actually on disk after partial failures. |
| `failedPlugins.push({name, cause})` and skip `delete record.plugins[pluginName]` on all non-ok cases (remove.ts) -- guard saves the row INTACT despite partial drops -> ghost record | AG-5 cause: skip filter (preserve full row). Non-AG-5 cause: in-place filter on the plugin record, then push to failedPlugins | Phase 39 (v1.7, TR-03) | Symmetric fix; same correctness improvement at the marketplace-removal call site. |

**Deprecated/outdated:** None -- the underlying `cascadeUnstagePlugin`,
`UnstageOutcome` shape, `AgentsUnstageFailureError`, and `withStateGuard`
contracts remain authoritative and unchanged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cascade primitive's `dropped.commands` field name MUST NOT be renamed to `dropped.prompts` as part of Phase 39 -- the cascade outcome shape stays byte-stable | "Pitfall 1" + "Code Examples" | If a planner attempts a name-symmetry refactor, every consumer of `UnstageOutcome` would need an in-lockstep change, expanding the phase's blast radius. Mitigation: explicit DO-NOT-DO at "Anti-Patterns to Avoid"; CONTEXT.md SC#1 binds the cascade primitive to "no state mutation" but does NOT forbid signature changes -- so we add the discipline here explicitly. |
| A2 | The non-AG-5 path in `uninstall.ts` MUST NOT skip the cleanup block by accident -- the existing `try/catch` at line 212-240 still handles AG-5 (via the throw), and the new sentinel branch must `return` AFTER emitting the `PluginFailedMessage` to skip the post-guard cleanup | "Pitfall 4" + "Pattern 1" | If the cleanup runs after a non-AG-5 partial failure, the cache-drop and data-dir-rm could silently affect the shrunken row's residual files. Risk is LOW because: (a) `dropMarketplaceCache` invalidates the completion cache (idempotent); (b) `rm(dataDir)` removes the per-plugin data dir (also idempotent for ENOENT). The semantic question is whether to remove the data dir on partial cascade failure (current: no, because throw skipped it). Mitigation: preserve current behaviour -- the new sentinel branch returns BEFORE cleanup. Documented in Pattern 1. |
| A3 | `withLockedStateTransaction` is NOT introduced into uninstall.ts in Phase 39 | "Anti-Patterns" + "Pattern 1" | The cleaner shape would be `withLockedStateTransaction` so both AG-5 and non-AG-5 can route through a sentinel without an in-guard throw. But migrating uninstall.ts to the locked-transaction shape is a structural change that affects every test in `uninstall.test.ts` and re-litigates D-02 composition. Defer to a v1.8 refactor if the throw-in-guard + sentinel hybrid feels brittle. Mitigation: the hybrid pattern is explicit, testable, and locally coherent. |
| A4 | The `PluginFailedMessage` byte form (severity=error, reasons=[narrowCascadeFailure(cause)], cause: cause) emitted on the non-AG-5 path is byte-identical to the AG-5 path's existing emission | "Pattern 1" + "Architectural Responsibility Map" | If the planner introduces a different `reasons` value for non-AG-5 (e.g., `"permission denied"` for EACCES paths), the catalog UAT fixture for `failure-permission-denied` must already cover that byte form (verified: docs/output-catalog.md `failure-permission-denied` IS the catalog state for EACCES). Mitigation: re-use the existing `narrowCascadeFailure` function -- it ALREADY maps `instanceof AgentsUnstageFailureError -> "not in manifest"` and `code "EACCES"/"EPERM" -> "permission denied"`. No new Reason member needed. |
| A5 | `installedPlugin.resources.*` arrays at the time of cascade-failure return are the PRE-cascade snapshot (not mutated by the cascade primitive); filter logic can rely on them as the source of truth for "what was supposed to be there" | "Architectural Responsibility Map" + "Pitfall 7" | The cascade primitive is read-only on state per SC#1 (the planner must NOT mutate it as part of Phase 39 either). The bridges' `unstage*` calls return `removedNames[]` reports but do NOT touch state. Mitigation: explicit SC#1 wording + the `Object.freeze` runtime enforcement on `outcome.dropped.*`. The `installedPlugin` reference is the same object held in `state.marketplaces[mp].plugins[plugin]`; mutations to `installedPlugin.resources.*` persist via the guard. |

**Confirmation required from planner:**
- A1 -- when writing the filter lines, EXPLICITLY comment the mapping
  asymmetry (`commands -> prompts`). Lock it in a unit test.
- A2 -- verify Pattern 1's post-guard branch returns BEFORE the cleanup
  block; add a regression test that asserts data-dir is NOT removed after
  non-AG-5 partial failure.
- A3 -- if the hybrid pattern (throw-in-guard for AG-5, sentinel for
  non-AG-5) is rejected during planning, the alternative is migrating to
  `withLockedStateTransaction`. RECOMMEND staying with `withStateGuard` per
  this research.

## Open Questions (RESOLVED)

1. **Should the filter block in both files be extracted to a shared helper
   `applyPartialUnstageToRecord(record, dropped)` in `marketplace/shared.ts`?**
   - What we know: The filter block is 4 lines in each file with the SAME
     field-name mapping. Extraction would be ~12 lines for the helper plus a
     1-line import at each call site.
   - What's unclear: The two call sites have DIFFERENT surrounding shapes
     (throw-in-guard sentinel in uninstall.ts vs. accumulate-in-loop in
     remove.ts); the helper would not cleanly encapsulate the AG-5
     discrimination because that gate lives at the call site.
   - **RESOLVED: REJECTED.** Per REQUIREMENTS.md TR-D03 (DEFERRED), the
     v1.7 milestone prefers locality. Inline the 4-row filter at each call
     site with a mapping comment. Defer extraction to v1.8 if a third
     caller appears. Adopted by SC discipline -- the planner should match
     the inline shape at both call sites byte-identically so a future
     extraction is mechanical.

2. **For the AG-5 case in uninstall.ts, should the existing `throw` shape
   be preserved or replaced with a "filter dropped.* even though
   instanceof AgentsUnstageFailureError" alternative for symmetry?**
   - What we know: SC#3 is explicit: "When `outcome.ok === false` and
     `cause instanceof AgentsUnstageFailureError` (AG-5 foreign-content),
     the state row is preserved intact (not filtered) -- foreign content
     owned by another process must not cause data loss."
   - What's unclear: "Data loss" wording could be parsed two ways. (a)
     Dropping the foreign-content-bearing row would lose the user's record
     of having installed it -- so retry has no anchor. (b) Filtering
     dropped.skills/commands (which actually ARE gone from disk) is not
     "data loss" in the strict sense.
   - **RESOLVED: ADOPTED full-row preservation per SC#3 wording.** The
     conservative read is correct: AG-5 means manual recovery is needed
     ("another process owns part of the agents dir"). Keeping the WHOLE
     row gives the user a clear "your prior install is still recorded; the
     retry will idempotently re-attempt cascade." A partial-shrink under
     AG-5 would leave a half-truth row that mixes "skills dropped" with
     "agents-foreign-content-stuck"; the retry's cascade would then ENOENT
     on the dropped skills (harmless), succeed, no-op on commands (already
     dropped), and STILL hit AG-5 on agents. The net outcome is identical
     for the user, but the shrunk-row presentation is less coherent. Stay
     with full-row preservation. Adopted in Pattern 1 + Pattern 2 +
     Pitfall 2.

3. **Should `cascadeUnstagePlugin` evolve to carry a `phaseReached: "skills"
   | "commands" | "agents" | "mcp" | "complete"` field per PITFALLS.md
   Pitfall 3 "Strategy 3" recommendation?**
   - What we know: PITFALLS.md Pitfall 3 proposes adding `phaseReached` to
     distinguish "skills succeeded but agents threw" from "skills threw
     first." Today, the distinction IS reconstructible from `dropped.*`
     non-emptiness (e.g., `dropped.skills.length > 0 && cause.message`
     references agents -> skills succeeded and agents threw).
   - What's unclear: Is the reconstruction reliable enough to skip the
     explicit field?
   - **RESOLVED: REJECTED for Phase 39.** SC#1 explicit: "the cascade
     primitive itself (`cascadeUnstagePlugin`) makes no state mutation."
     Adding `phaseReached` would be a SHAPE change to the cascade
     primitive's return type, expanding the milestone scope. The
     dropped.* + cause discrimination at the call site is sufficient for
     SC#1-#4. The `phaseReached` field IS a worthwhile v1.8 enhancement
     for diagnostic precision but does NOT close any Phase 39 SC. Defer.

4. **For SC#5 ("npm run check GREEN; no regression from Phase 38
   baseline (1358 tests)"), should the test count be EXACTLY 1358 + 4
   (new tests) = 1362, or could SC#4's two-test minimum be satisfied
   by a single combined test per call site (i.e., 2 new tests, total
   1360)?**
   - What we know: SC#4 says "A regression test drives [non-AG-5];
     a second test drives the AG-5 cause." That reads as 2 tests
     minimum, but does not specify per-call-site or shared.
   - What's unclear: For coverage parity with the existing PU-3+PU-7
     test (which lives in uninstall.test.ts) and the MR-4 test (which
     lives in remove.test.ts), should new tests be per-file or
     centralized?
   - **RESOLVED: ADOPTED 4 new tests, 2 per file.** Each file's test
     suite has a clear taxonomy (`PU-*` for uninstall, `MR-*` for
     remove); a per-file pair (non-AG-5 + AG-5) tags cleanly and
     follows the existing convention. Total new tests = 4; baseline
     1358 + 4 = 1362 GREEN target. Adopted in Validation Architecture.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runtime + TypeScript strip + fs/promises | OK | >=20.19.0 (NFR-4) | -- |
| TypeScript | typecheck for `installedPlugin.resources.*` strict-mode | OK | ^5.9.3 (project lockfile) | -- |
| `node:test` (built-in) | Regression test framework | OK | bundled | -- |
| `node:assert/strict` (built-in) | `assert.deepEqual`, `assert.equal`, `assert.ok` | OK | bundled | -- |
| `pre-commit` | CLAUDE.md hook gate | OK (verified by `.pre-commit-config.yaml` presence) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, since 20.x stable) |
| Config file | none -- `package.json` `"test"` script glob: `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` |
| Quick run command | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/marketplace/remove.test.ts` (~2-4 sec) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |
| Phase gate | Full suite GREEN before `/gsd-verify-work` (per SC#5) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TR-03 (SC#1, SC#4) | `uninstall.ts` non-AG-5 partial: cascade returns `{ok:false, dropped:{skills:["s1"], commands:[], agents:[], mcpServers:[]}, cause: new Error("EACCES")}`; state.json AFTER call has `resources.skills` with `s1` removed and the row preserved | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` -> NEW test "TR-03 uninstall: non-AG-5 partial cascade filters resources.* by dropped.* and preserves shrunken row" | NO (Wave 0: append) |
| TR-03 (SC#3, SC#4) | `uninstall.ts` AG-5 cause: cascade returns `{ok:false, dropped:{skills:["s1"], ...}, cause: new AgentsUnstageFailureError(...)}`; state.json AFTER call has `resources.skills` UNCHANGED (still contains `s1`); row preserved INTACT | unit | same file -> NEW test "TR-03 uninstall: AG-5 cause preserves full state row (no filter)" | NO (Wave 0: append) |
| TR-03 (SC#2, SC#4) | `remove.ts` non-AG-5 partial: cascade returns `{ok:false, dropped:{commands:["c1"], ...}, cause: new Error("EACCES")}` for one plugin; state.json AFTER call has that plugin's `resources.prompts` filtered (c1 removed) AND row preserved; OTHER plugins in the marketplace handled per existing semantics | unit | `node --test tests/orchestrators/marketplace/remove.test.ts` -> NEW test "TR-03 remove: non-AG-5 partial cascade filters resources.prompts by dropped.commands and preserves shrunken row" | NO (Wave 0: append) |
| TR-03 (SC#3, SC#4) | `remove.ts` AG-5 cause: cascade returns `{ok:false, dropped:{skills:["s1"]}, cause: new AgentsUnstageFailureError(...)}` for one plugin; state.json AFTER call has that plugin's `resources.*` UNCHANGED; row preserved intact | unit | same file -> NEW test "TR-03 remove: AG-5 cause preserves full state row (no filter)" | NO (Wave 0: append) |
| TR-03 / TR-03 regression (SC#5) | Existing PU-3+PU-7 test at `uninstall.test.ts:344` -- AG-5 cascade -> state record retained intact, foreign agent file on disk, agents-index row retained, notify single error message; MR-4 test at `remove.test.ts:338` -- cascade fails for plugin-a, succeeds for plugin-b, mp record retained | regression | both files (existing tests verbatim) | YES (existing) |
| TR-03 (SC#5) | `npm run check` GREEN; full suite 1358 + 4 (new) = 1362 tests minimum | regression | `npm run check` (full suite) | YES |

### Sampling Rate

- **Per task commit:** `node --test tests/orchestrators/plugin/uninstall.test.ts
  tests/orchestrators/marketplace/remove.test.ts` (~2-4 sec)
- **Per wave merge:** `node --test tests/orchestrators/**/*.test.ts
  tests/bridges/**/*.test.ts` (~30-60 sec) -- includes phase-37/38 affected
  bridge tests
- **Phase gate:** `npm run check` (full suite ≈ 1362 tests post-Phase 39) --
  green before `/gsd-verify-work`

### Wave 0 Gaps

The test files exist and are well-structured (uninstall.test.ts is ~1150
lines, remove.test.ts is ~700 lines). The 4 new tests must be APPENDED to
existing files; no new test files required.

- [ ] `tests/orchestrators/plugin/uninstall.test.ts` -- APPEND 2 new tests:
  - **(a) TR-03 non-AG-5 partial filter test:** Seed state with `hello`
    plugin containing `resources: { skills: ["s1","s2"], prompts: ["p1"],
    agents: [], mcpServers: [] }`. Stub cascade to return `{ok:false,
    dropped: {skills: ["s1"], commands: [], agents: [], mcpServers: []},
    cause: new Error("forced EACCES")}`. Call `uninstallPlugin`. Re-load
    state via `loadState`. Assert:
    - `state.marketplaces.mp.plugins.hello !== undefined` (row preserved)
    - `state.marketplaces.mp.plugins.hello.resources.skills === ["s2"]`
      (s1 filtered)
    - `state.marketplaces.mp.plugins.hello.resources.prompts === ["p1"]`
      (unchanged, dropped.commands was empty)
    - `notifications.length === 1`
    - `notifications[0].severity === "error"`
    - `notifications[0].message` matches `/(failed)/` (PluginFailedMessage byte form)
  - **(b) TR-03 AG-5 full-row preservation test:** Same seed. Stub cascade
    to return `{ok:false, dropped: {skills: ["s1"], ..., agents: []},
    cause: new AgentsUnstageFailureError("...", [])}`. Call
    `uninstallPlugin`. Re-load state. Assert:
    - `state.marketplaces.mp.plugins.hello !== undefined` (row preserved)
    - `state.marketplaces.mp.plugins.hello.resources.skills === ["s1","s2"]`
      (UNCHANGED -- full row preserved despite dropped.skills=["s1"])
    - `notifications.length === 1`, severity error
- [ ] `tests/orchestrators/marketplace/remove.test.ts` -- APPEND 2 new tests
  with the same shape adapted to multi-plugin loop:
  - **(c) TR-03 non-AG-5 partial filter test:** Seed marketplace with
    `plugin-a` (resources.prompts = ["c1","c2"]). Stub cascade for
    plugin-a to return `{ok:false, dropped: {skills: [], commands:
    ["c1"], agents: [], mcpServers: []}, cause: new Error("forced
    EACCES")}`. Call `removeMarketplace`. Re-load state. Assert:
    - `state.marketplaces["acme-mp"] !== undefined` (mp retained --
      failedPlugins.length > 0)
    - `state.marketplaces["acme-mp"].plugins["plugin-a"] !== undefined`
      (row preserved)
    - `state.marketplaces["acme-mp"].plugins["plugin-a"].resources.prompts
      === ["c2"]` (c1 filtered; NOTE the asymmetry: dropped.commands ->
      resources.prompts)
    - `notifications.length === 1`, severity error, message matches
      `/(failed)/`
  - **(d) TR-03 AG-5 full-row preservation test:** Same seed. Stub cascade
    for plugin-a to return `{ok:false, dropped: {commands: ["c1"]},
    cause: new AgentsUnstageFailureError("...", [])}`. Call
    `removeMarketplace`. Re-load state. Assert:
    - `state.marketplaces["acme-mp"].plugins["plugin-a"].resources.prompts
      === ["c1","c2"]` (UNCHANGED -- full row preserved)
    - `notifications.length === 1`, severity error

### Recommended exact test cases (input -> expected -> assertion mechanism)

1. **TR-03 uninstall non-AG-5 partial (test a):**
   - **Input:** Stub cascade returns `{ok:false, dropped:{skills:["s1"],
     commands:[], agents:[], mcpServers:[]}, cause: new Error("EACCES")}`.
   - **Expected:** After call, `state.marketplaces.mp.plugins.hello.resources.skills
     === ["s2"]`; one error notification.
   - **Assertion:** `assert.deepEqual(after.marketplaces.mp.plugins.hello.resources.skills,
     ["s2"])`; `assert.equal(notifications.length, 1)`;
     `assert.equal(notifications[0].severity, "error")`.

2. **TR-03 uninstall AG-5 (test b):**
   - **Input:** Stub cascade returns `{ok:false, dropped:{skills:["s1"]},
     cause: new AgentsUnstageFailureError("agents leak", [])}`.
   - **Expected:** `resources.skills` UNCHANGED.
   - **Assertion:** `assert.deepEqual(after.marketplaces.mp.plugins.hello.resources.skills,
     ["s1","s2"])`.

3. **TR-03 remove non-AG-5 partial (test c):**
   - **Input:** As described above.
   - **Expected:** `resources.prompts === ["c2"]`; the field-name
     asymmetry is the load-bearing assertion.
   - **Assertion:** `assert.deepEqual(...prompts, ["c2"])`.

4. **TR-03 remove AG-5 (test d):**
   - **Input:** As described above.
   - **Expected:** `resources.prompts === ["c1","c2"]`.
   - **Assertion:** `assert.deepEqual(...prompts, ["c1","c2"])`.

5. **Regression preservation (SC#5):**
   - **Input:** Run the full `npm run check` suite.
   - **Expected:** Existing PU-3+PU-7 (uninstall.test.ts:344) and MR-4
     (remove.test.ts:338) tests stay GREEN verbatim plus 4 new TR-03
     tests; full project suite GREEN at 1362 tests minimum.
   - **Assertion:** `npm run check` exits 0; existing test count +
     4 new = total count baseline.

### Single-plan feasibility

**The phase can be closed by a SINGLE plan (`39-01-PLAN.md`) with three tasks:**

1. **Task 1 -- `uninstall.ts` fix:** Restructure the `withStateGuard` closure
   per Pattern 1 (AG-5 throw + non-AG-5 sentinel + in-place filter). Add
   the post-guard sentinel branch that emits `PluginFailedMessage` and
   returns before cleanup. Append 2 new regression tests (a, b).
2. **Task 2 -- `remove.ts` fix:** Extend the per-plugin loop's `else` arm
   per Pattern 2 (AG-5 carve-out + non-AG-5 in-place filter on
   `plugin.resources.*`). Append 2 new regression tests (c, d).
3. **Task 3 -- Phase gate validation:** Run `npm run check`; confirm
   1362+ tests GREEN; confirm existing PU-3+PU-7 + MR-4 tests stay
   verbatim and GREEN; confirm no test in any other suite regresses.

Splitting per-file (one plan for uninstall, one for remove) would create
artificial wave boundaries without parallelization benefit: both fixes
share the same field-name mapping (Pitfall 1), the same AG-5
discrimination pattern, and the same `npm run check` gate. A single plan
with 3 tasks is the right granularity.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable -- internal state-mutation control flow. |
| V3 Session Management | no | Not applicable. |
| V4 Access Control | no | Not applicable. |
| V5 Input Validation | no | No new inputs introduced. |
| V6 Cryptography | no | Not applicable. |
| V10 Malicious Code | no | No new external code paths. |
| V12 File and Resources | yes (indirect) | The Phase 39 fix preserves NFR-10 containment (no new path operations); the existing `withStateGuard` + `write-file-atomic` semantics provide the atomic state write. |

### Known Threat Patterns for state-record-coherence fix

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-process state.json race during the in-guard mutation (process A's shrunken row written; process B reads stale full row) | Tampering | Mitigated by `proper-lockfile` `.state-lock` held across loadState -> mutate -> saveState (Phase 7 D-06). The Phase 39 fix does not introduce new concurrent windows; the mutation is INSIDE the existing lock. |
| AG-5 cause discrimination bypass via spoofed Error (a non-AG-5 cause crafted to pass `instanceof AgentsUnstageFailureError`) | Spoofing | The class is `extends Error` -- `instanceof` checks the prototype chain, which is not spoofable without `Object.setPrototypeOf`. The cascade primitive is the only producer of cascade-cause errors in production; tests use the typed class directly. No threat surface introduced by the fix. |
| State row "lying" about disk contents after partial failure (the GHOST RECORD pattern being fixed) | Repudiation | Pre-Phase-39: state.json says skills=[a,b,c] but a,b,c were dropped from disk -- a repudiation/integrity gap because next operation reads inconsistent state. Post-Phase-39: state.json shrinks to skills=[] when a,b,c were dropped; or stays intact under AG-5 (manual recovery anchor). Either way, the state row is now truthful within the discrimination contract. |
| Data loss via over-aggressive filter (the AG-5 case filtering rows that the user actually needs for retry context) | Tampering / Data Loss | Mitigated by SC#3 carve-out: AG-5 preserves the full row. The AG-5 case is the foreign-content / manual-recovery anchor; preserving the row preserves the user's record of "this plugin WAS installed" so retry has the prior-state ledger. |

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
  (336 lines, READ in full) -- the TR-03 primary fix site at lines 162-240
  (withStateGuard closure + try/catch), the AG-5 throw at line 204, the
  `narrowCascadeFailure` typed-dispatch at lines 93-114.
- Project source: `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`
  (333 lines, READ in full) -- the TR-03 second fix site at lines 202-220
  (per-plugin loop with the failedPlugins[] accumulator), the
  `narrowCascadeFailure` mirror at lines 102-148.
- Project source: `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  (lines 1-80 + 285-395, READ) -- `AgentsUnstageFailureError` class
  definition at lines 55-62, `UnstageOutcome` interface at lines 290-302,
  `cascadeUnstagePlugin` body at lines 317-395 including the
  `dropped.commands <- resources.prompts` mapping at line 339 and the AG-5
  throw at lines 350-365.
- Project source: `extensions/pi-claude-marketplace/persistence/state-io.ts`
  (lines 35-55) -- `PLUGIN_INSTALL_RECORD_SCHEMA` confirming the state
  schema field names are `resources.{skills, prompts, agents, mcpServers}`.
- Project source: `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
  (lines 1-100, READ) -- ST-7 contract at lines 50-76 confirming "save only
  on no-throw"; `withStateGuard` signature and behaviour.
- Project source: `tests/orchestrators/plugin/uninstall.test.ts` (1150+
  lines; READ lines 1-450 + grep across the file) -- PU-3+PU-7 invariant
  test at lines 344-450 (state record retained on AG-5; this is the test
  that MUST stay GREEN); `makePluginRecord` helper at lines 84-100
  (confirming the state-shape construction for new tests).
- Project source: `tests/orchestrators/marketplace/remove.test.ts` (700+
  lines; READ lines 336-460 + grep across the file) -- MR-4 cascade-failure
  test at lines 338-405 with the existing `stubCascade` injection seam
  pattern that the new TR-03 tests will reuse.
- `.planning/research/SUMMARY.md` (293 lines, READ in full) -- v1.7 milestone
  research synthesis; Phase 3/TR-03 rationale at lines 181-191; Critical
  Pitfall 3 (cascade-side state mutation pattern) at lines 73-92.
- `.planning/research/PITFALLS.md` (800 lines, READ in full) -- Pitfall 3
  (ghost-record prevention) at lines 229-280 -- direct authority for the
  caller-materialises-dropped-into-mutation discipline; Pitfall 10 (AG-5
  carve-out) at lines 573-595.
- `.planning/research/ARCHITECTURE.md` (269 lines, READ in full) -- Q3
  cascade-ghost-record fix at lines 161-185 confirming the orchestrator-side
  filter is the correct architectural surface; explicit "the dropped
  contract is already adequate" verdict.
- `.planning/research/FEATURES.md` (142 lines, READ in full) -- Category 3
  ghost-record prevention patterns at lines 72-92.
- `.planning/REQUIREMENTS.md` -- TR-03 definition at lines 49-53;
  TR-D03 deferral at lines 78-79.
- `.planning/phases/39-cascade-ghost-record/39-CONTEXT.md` (66 lines, READ
  in full) -- locked decisions and SC#1-#5.
- `.planning/phases/37-phase-ledger-undo-gap/37-RESEARCH.md` -- style
  reference (sentinel + sequencing patterns; PathContainmentError discipline
  as a model for typed-cause discrimination).
- `.planning/phases/38-sequential-commit-loops-orphan-tolerance/38-RESEARCH.md`
  -- style reference (per-task task layout; PI-6/PUP-6 regression-preservation
  discipline as a model for PU-3+PU-7/MR-4 preservation).
- `.planning/STATE.md` -- v1.7 milestone progress; Phase 38 COMPLETE; Phase
  39 next.
- `.planning/ROADMAP.md` lines 833-859 -- Phase 39 definition.
- `package.json` `scripts` -- confirmed `npm run check` composition
  (`typecheck && lint && format:check && test`) and the `node:test` glob.
- CLAUDE.md project section -- Conventional Commits, `pre-commit run`
  discipline, NFR-1/NFR-2/NFR-3/NFR-6/IL-2 constraints.

### Secondary (MEDIUM confidence -- ecosystem signal, not load-bearing)

- Quick task `260525-aub` (commit `da04709`) -- the typed-cause migration
  that established the `instanceof AgentsUnstageFailureError` discipline at
  both call sites. Confirms the AG-5 discrimination pattern Phase 39
  re-uses.
- D-19-01 cache-drop swallow precedent (referenced in uninstall.ts comments)
  -- confirms post-state-commit cleanup-leak swallow discipline; Phase 39
  fix preserves this by returning BEFORE the cleanup block on either
  failure path.

### Tertiary (LOW confidence)

None -- all load-bearing claims sourced from project files read in full or
in the relevant slices.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new packages; existing imports verified by
  reading both orchestrator files in full.
- Architecture: HIGH -- all three fix-relevant code sites verified at
  line-level (uninstall.ts:194-211; remove.ts:202-220; shared.ts:317-395);
  ST-7 contract verified at with-state-guard.ts:50-76.
- Pitfalls: HIGH -- direct authority from PITFALLS.md Pitfall 3 (ghost-record
  caller-materialisation) + Pitfall 10 (AG-5 carve-out); field-name
  asymmetry (Pitfall 1) sourced from line-level reading of shared.ts:339
  and state-io.ts:47-52.
- Tests: HIGH -- existing PU-3+PU-7 test at uninstall.test.ts:344 and MR-4
  test at remove.test.ts:338 read in full; both rely on the `cascade`
  injection seam that the new TR-03 tests reuse byte-identically.

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days -- stable in-place orchestrator-boundary
fix; nothing external can drift the contract since no new dependencies and the
cascade primitive's shape is locked)

## RESEARCH COMPLETE

The recommended fix structure for Phase 39:

1. **One plan (`39-01-PLAN.md`), three tasks.**
   - **Task 1:** Restructure `uninstall.ts`'s `withStateGuard` closure to
     (a) throw `cause` when `cause instanceof AgentsUnstageFailureError`
     (preserve PU-3+PU-7 verbatim via ST-7 abort-save); (b) for non-AG-5
     causes, mutate `sRecord.resources.*` IN-PLACE by filtering each axis
     against `outcome.dropped.*` with the field-name mapping
     `commands -> prompts`, then capture a `cascadeFailure` sentinel and
     `return` from the closure (guard saves the shrunken row). After the
     guard, branch on the sentinel: emit `PluginFailedMessage` via the
     existing `narrowCascadeFailure` Reason mapping and `return` BEFORE
     the post-state cleanup block. Append 2 new regression tests
     (non-AG-5 filter + AG-5 full-row preservation).
   - **Task 2:** Extend `remove.ts`'s per-plugin loop `else` arm. For
     non-AG-5 causes, mutate `plugin.resources.*` in place with the same
     four-row filter (same `commands -> prompts` asymmetry) before
     pushing to `failedPlugins[]`. For AG-5 causes, skip the filter --
     just push. The guard's existing `saveState` commits the shrunken
     row. Append 2 new regression tests (non-AG-5 filter on
     `resources.prompts` -- locking the field-name mapping in a test --
     and AG-5 full-row preservation).
   - **Task 3:** Run `npm run check` (full suite); confirm 1362+ tests
     GREEN with no regression from Phase 38 baseline (1358); confirm
     existing PU-3+PU-7 and MR-4 tests stay verbatim.

2. **Key safety controls:**
   - `cause instanceof AgentsUnstageFailureError` for AG-5 discrimination
     (NOT substring matching).
   - Field-name mapping `dropped.commands -> resources.prompts` documented
     inline at both filter blocks AND locked in a regression test.
   - Cascade primitive (`cascadeUnstagePlugin`) stays read-only on state
     (NO mutation inside the cascade -- only at the orchestrator
     boundary).
   - PU-3+PU-7 test invariant preserved verbatim (AG-5 full-row preservation).
   - MR-4 test invariant preserved verbatim (cascade-failure marketplace
     record retention).
   - Post-state cleanup (cache-drop, data-dir rm, PluginUninstalledMessage)
     SKIPPED on any cascade failure path (current behaviour preserved on
     both AG-5 via existing catch and non-AG-5 via new sentinel return).
