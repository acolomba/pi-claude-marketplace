# Phase 38: Sequential Commit Loops + Orphan Tolerance - Research

**Researched:** 2026-06-02
**Domain:** Sequential commit loops with reverse-rename rollback; orphan-tolerant target removal; PI-6 foreign-content guard preservation
**Confidence:** HIGH

## Summary

Phase 38 hardens the agents and commands bridge commit paths to be atomic at rename
granularity (TR-01, TR-05) and replaces the brittle `if (pathExists(pair.to)) throw`
guard in all three `replacePrepared*` helpers with a shared `removeOrphanIfPresent`
primitive that pre-removes owned orphan content while preserving the PI-6 foreign-content
protection (TR-06). The skills bridge `commitPreparedSkills` already received an
ENOTEMPTY-tolerant orphan pre-removal in commit `01028ea` (2026-06-02); Phase 38 replicates
the SAME orphan tolerance into agents/commands and ADDITIONALLY adds reverse-rename
rollback (which the skills commit did NOT carry).

The fix shape is determined by two existing patterns in the codebase: (a) the
`rollbackReplacementCommon` reference at `shared/fs-utils.ts:135-177` -- spread-copy
before reverse, leaks accumulation, never throws from the rollback loop, returns
`readonly string[]` -- which the new sequential-commit-rollback in agents/commands must
mirror; and (b) the stat-then-rm pattern at `bridges/skills/stage.ts:238-247` -- which
gets lifted into `shared/fs-utils.ts::removeOrphanIfPresent(target, mode)`. No new
dependencies. No new abstractions beyond the helper. The change touches three bridges,
one shared module, and three test files.

The single highest-risk integration is the PI-6 cross-plugin collision guard at
`stage.test.ts:388`. The orphan pre-removal MUST distinguish "this install's prior-attempt
orphan" from "a different plugin's content at the same generated name." This research
recommends the discriminator be the caller's existing `_previousNames` / `_previousEntries`
membership check, performed at the `replacePrepared*` call site BEFORE calling
`removeOrphanIfPresent` -- and the helper itself stays kind-strict (`tree` only rm's
directories; `file` only rm's files) so a mismatched kind leaves the obstacle in place
and the rename fails loudly. This preserves both the PI-6 rejection test AND the PUP-6
phase-3 failure test.

**Primary recommendation:** Land all six SC items in a SINGLE plan (`38-01-PLAN.md`)
with a 4-task structure: Task 1 adds `removeOrphanIfPresent` to `shared/fs-utils.ts` +
unit tests; Task 2 rewrites `commitPreparedAgents` and `commitPreparedCommands` step-2
loops to sequential-with-rollback shape; Task 3 replaces the `pathExists`-throw in all
three `replacePrepared*` helpers; Task 4 amends tests for the new contract and verifies
PI-6 / PUP-6 invariants survive. The phase does NOT need to be split per-bridge because
(a) TR-06 cross-cuts all three bridges with the same helper, (b) the agents/commands
commit-loop rewrites are mechanical replicas with no inter-dependency, and (c) all six
SC items must close on the same `npm run check` GREEN gate. Per-bridge splits would
create artificial wave boundaries with no parallelization win.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Commit-path rename atomicity (agents, commands) | `bridges/agents/stage.ts::commitPreparedAgents` + `bridges/commands/stage.ts::commitPreparedCommands` | -- | Each bridge owns its own staging directory; rollback is self-contained at the bridge boundary so the orchestrator can keep using the existing `phase3aFailures: Phase3Failure[]` continue-on-failure aggregation contract (D-03). |
| Orphan-tolerant target removal (shared) | `shared/fs-utils.ts::removeOrphanIfPresent` (NEW) | `bridges/skills/stage.ts:238-247` (donor pattern, will be refactored to call helper) | The shared helper centralizes the kind-strict stat+rm pattern so future bridges adopt it uniformly; the existing skills commit-path inline pattern is lifted into the helper to eliminate divergence. |
| PI-6 cross-plugin foreign-content guard | `bridges/{skills,commands,agents}/stage.ts::replacePrepared*` (call-site policy) | `domain/resolver.ts` (upstream prepare-time conflict detection) | The narrow protection at the `replacePrepared*` rename loop guards against the case where prepare-time PI-6 detection missed (e.g., a manual file dropped between prepare and replace). The discriminator is `_previousNames` / `_previousEntries` membership. |
| Leak surfacing for commit-path rollback | `shared/errors.ts::appendLeakToError` | `shared/notify.ts::composePluginLines` (rendering) | NEW commit-path rollback uses `appendLeakToError` (NOT `ManualRecoveryError`) per Pitfall 8 -- commit-path leaks are transient IO, not user-action-required manual recovery. |
| State.json membership view for "owned" | `_previousNames` (skills, commands) / `_previousEntries` (agents) on prepared handle | Orchestrator already populates these from `oldRecord.resources.{skills,prompts,agents}` (reinstall.ts:973/982/990) | The bridge handle already carries the state.json view; the helper does NOT need state.json access -- the caller passes the ownership signal through the existing `_previousNames` field by checking basename membership at the call site. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states implementation is at Claude's discretion (discuss phase skipped via
`workflow.skip_discuss: true`). The six Specific Ideas in CONTEXT.md `<specifics>`
function as locked success criteria:

1. `commitPreparedAgents` iterates `_stagedFilePaths` sequentially; on a rename throw,
   it reverse-walks completed renames (`[...completedRenames].reverse()`) to restore
   them to staging; rollback failures accumulate into `leaks[]` surfaced via
   `appendLeakToError`; rollback loop never throws.
2. `commitPreparedCommands` adds the same `completedRenames[]` tracking to its
   existing sequential loop; reverse-walk shape is identical to agents.
3. `shared/fs-utils.ts` exports `removeOrphanIfPresent(target, mode: "file" | "tree")`
   that pre-removes a target only when state.json confirms it is an owned artifact from
   a prior partial install; ENOENT is silently swallowed; mismatched kind (file where
   tree expected) leaves the target alone so rename fails loudly.
4. `replacePreparedSkills`, `replacePreparedAgents`, and `replacePreparedCommands`
   call `removeOrphanIfPresent` instead of `if (pathExists(pair.to)) throw`; the PI-6
   `stage.test.ts:388` non-previous-content rejection test remains RED for foreign
   artifacts not in state.json.
5. PUP-6 phase-3 failure test (`update.test.ts:744`) still triggers its failure path
   (the file obstacle at `hello-tool` is not in state.json's skills list, so the
   orphan guard leaves it alone); alternatively, a synthetic bridge-throw variant
   preserves the phase-3a aggregation contract if the file test is retired.
6. `npm run check` GREEN; no regression from Phase 37 baseline.

### Claude's Discretion

All implementation choices (helper signature beyond `(target, mode)`, exact variable
naming, whether to add a `commitWithRollback` helper, test-file organisation, JSDoc
wording) are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)

None per CONTEXT.md.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TR-01 | `commitPreparedAgents` in `bridges/agents/stage.ts` replaces the `Promise.all` rename loop with a sequential `for...of` loop that tracks completed renames and reverse-walks them on throw; rollback adopts the shape of `rollbackReplacementCommon` (spread-copy before reverse, ENOENT-tolerant, leaks surface via `appendLeakToError`, never throws from rollback loop). | Fix site verified at `bridges/agents/stage.ts:340-349` (current `Promise.all`); reference shape at `shared/fs-utils.ts:135-177`. |
| TR-05 | `commitPreparedCommands` in `bridges/commands/stage.ts` adds `completedRenames[]` tracking to its existing sequential rename loop and reverse-walks on throw; same rollback shape as TR-01. | Fix site verified at `bridges/commands/stage.ts:219-221` (loop is sequential today; missing `completedRenames[]` tracking + reverse rollback). |
| TR-06 | `replacePreparedSkills`, `replacePreparedCommands`, and `replacePreparedAgents` replace the `if (pathExists(pair.to)) throw` guard with `removeOrphanIfPresent(pair.to, mode)` -- a new export in `shared/fs-utils.ts` -- that pre-removes a target only when state.json confirms it is an owned orphan from a prior partial install; foreign artifacts (not in state.json's resources list) still trigger the existing PI-6 rejection error; the `stage.test.ts:388` non-previous-content rejection test remains RED after the fix. | Fix sites verified at `bridges/skills/stage.ts:307-313`, `bridges/commands/stage.ts:275-281`, `bridges/agents/stage.ts:431-438`. |

## Project Constraints (from CLAUDE.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Conventional Commits, titles >=5 and <=72 chars, body lines <=80 chars | CLAUDE.md "Git" | Commits land as `fix(bridges):` -- never `chore:`. Multiple sub-commits per task may apply. |
| `pre-commit run --all-files` before commit; fix failures, restage, re-run | CLAUDE.md "Git" | Implementation tasks MUST verify hooks pass before commit. |
| `SKIP=trufflehog` prefix only when committing from a worktree | CLAUDE.md "Git" | Not applicable -- working on main checkout `features/transaction-resilience-hardening` branch (not a worktree). |
| TypeScript strict; discriminated `installable: true \| false` (NFR-7) | CLAUDE.md "Constraints" | `_stagedFilePaths` / `_renamePairs` are `readonly { from, to }[]` arrays under strict-mode; rollback loops must respect immutability. |
| Atomic file ops (NFR-1) | CLAUDE.md "Constraints" | Per-rename is atomic on same-FS (staging + target both under `<extensionRoot>/`); compound-commit is NOT atomic but rolls back to staged state on partial failure -- that's the TR-01/TR-05 contract. |
| Recovery via `/reload` only (NFR-2) | CLAUDE.md "Constraints" | Rollback restores staging; staged data is recoverable through commit retry -- no process restart required. |
| Retry-safe (NFR-3) | CLAUDE.md "Constraints" | After rollback, the staging dir holds all unrenamed files; the caller can retry commit OR call abort. |
| Containment refusal (NFR-10) | CLAUDE.md "Constraints" | The `removeOrphanIfPresent` helper performs raw `rm` on caller-supplied paths; the caller must have already `assertPathInside`'d the target. Document this in the helper JSDoc. |
| Output via `ctx.ui.notify` only (IL-2) | CLAUDE.md "Constraints" | Not directly touched -- the bridges don't notify; the orchestrator does via `appendLeakToError` chains. |
| `npm run check` must stay GREEN (NFR-6) | CLAUDE.md "Constraints" | Phase-gate validation; SC#6 enforces this. |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow Enforcement" | Implementation MUST proceed via `/gsd-execute-phase`, not direct edits. |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | bundled with Node >=20.19.0 | `rename`, `rm`, `stat`, `mkdir` for all atomic ops | `[VERIFIED: existing imports across stage.ts files]`; same-FS guarantee under `<extensionRoot>/`. |
| TypeScript | `^5.9.3` | Strict-mode for `_stagedFilePaths` immutability + `removeMode: "file" \| "tree"` discriminated union | `[VERIFIED: package.json + tsconfig.json]`. |
| `node:test` | bundled with Node >=20.19.0 | Test framework for unit + regression tests | `[VERIFIED: existing tests/transaction/, tests/bridges/]` already use it. |
| `node:assert/strict` | bundled with Node >=20.19.0 | `assert.deepEqual`, `assert.rejects`, `assert.match` | `[VERIFIED: existing test files use this convention]`. |

### No new dependencies

`.planning/research/STACK.md` and `.planning/research/SUMMARY.md` are explicit:
"No new dependencies. All eight TR-* fixes stay within
`extensions/pi-claude-marketplace/`." Phase 38 specifically requires zero new packages.
Already-imported helpers (`appendLeakToError`, `cleanupStaging`,
`rollbackReplacementCommon`, `pathExists`) are sufficient.

## Package Legitimacy Audit

Not applicable -- Phase 38 installs no new packages. All work uses
already-installed Node built-ins (`fs/promises`, `path`, `test`, `assert`) and
existing project modules in `shared/`.

## Architecture Patterns

### System Architecture Diagram

```
                       Orchestrators
                  install.ts     reinstall.ts      update.ts
                       │              │                │
                       │              │                │
              ┌────────┴──────┐  ┌────┴────┐    ┌──────┴──────┐
              │  commit path  │  │ replace │    │ commit path │
              │ (3 bridges)   │  │  path   │    │ (3 bridges) │
              └────────┬──────┘  └────┬────┘    └──────┬──────┘
                       │              │                │
                       └─────────┬────┴────────────────┘
                                 │
                                 ▼
                ┌──────────────────────────────────────┐
                │ bridges/{skills,commands,agents}     │
                │   commitPrepared*                    │ ←── TR-01, TR-05
                │     step-1 pre-rm (no rollback)      │      sequential
                │     step-2 sequential rename         │      + reverse
                │       ─ track completedRenames[]     │      rollback
                │       ─ on throw: reverse-rename     │
                │                  + accumulate leaks  │
                │     step-3 finalize index (agents)   │
                │                                      │
                │   replacePrepared*                   │ ←── TR-06
                │     step-1 backup prior targets      │      replace
                │     step-2 for each pair.to:         │      pathExists
                │       ─ if owned + kind match: rm    │      throw with
                │       ─ if owned + kind mismatch:    │      removeOrphan
                │           leave (rename will throw)  │      IfPresent
                │       ─ if NOT owned + exists:       │
                │           throw "non-previous        │
                │            content" (PI-6 guard)     │
                │       ─ rename(from, to)             │
                │                                      │
                └──────────────────────────────────────┘
                                 │
                                 ▼
                ┌──────────────────────────────────────┐
                │ shared/fs-utils.ts                   │
                │   removeOrphanIfPresent(target,mode) │ ←── NEW
                │     try { stat(target) }             │
                │     if mode==="tree" && isDir:       │
                │       rm({recursive:true})           │
                │     if mode==="file" && isFile:      │
                │       rm(target)                     │
                │     mismatched kind -> noop          │
                │     ENOENT -> noop                   │
                │                                      │
                │   rollbackReplacementCommon          │ ←── REFERENCE
                │     (existing -- shape donor)        │      SHAPE for
                │                                      │      TR-01/TR-05
                └──────────────────────────────────────┘
```

Key contract preservations:

- `commitPrepared*` step-1 pre-rm loops stay parallel (agents) / sequential (commands)
  with ENOENT tolerance -- step-1 is destructive cleanup of prior targets the bridge
  intentionally doesn't back up; rollback would have no source to restore from.
- `commitPrepared*` step-2 rename loops become sequential AND track `completedRenames[]`
  for reverse-rename rollback on throw.
- `replacePrepared*` `_previousNames` membership check happens at the CALL SITE (not
  inside the helper) -- the helper stays minimal at `(target, mode)`.
- `removeOrphanIfPresent` is kind-strict: mode "tree" only rm's directories; mode "file"
  only rm's files. Mismatched kind leaves the target alone (so rename surfaces
  ENOTDIR/ENOTEMPTY -- preserves PUP-6 phase-3 failure trigger).
- Leak surfacing: `appendLeakToError` for commit-path leaks (transient IO);
  `ManualRecoveryError` reserved for replacePrepared* rollback leaks (already used at
  `bridges/agents/stage.ts:454`, `bridges/skills/stage.ts:318`, `bridges/commands/stage.ts:286`).

### Recommended Project Structure

No new files. The fix is in-place across five existing files plus three test files:

```
extensions/pi-claude-marketplace/
├── bridges/
│   ├── agents/
│   │   └── stage.ts          # MODIFIED: commitPreparedAgents step-2 sequential
│   │                         #           + replacePreparedAgents orphan tolerance
│   ├── commands/
│   │   └── stage.ts          # MODIFIED: commitPreparedCommands add tracking
│   │                         #           + replacePreparedCommands orphan tolerance
│   └── skills/
│       └── stage.ts          # MODIFIED: refactor inline stat-rm to call helper
│                             #           + replacePreparedSkills orphan tolerance
└── shared/
    └── fs-utils.ts           # MODIFIED: export removeOrphanIfPresent

tests/
└── bridges/
    ├── agents/
    │   └── stage.test.ts     # MODIFIED: append TR-01 rollback test
    ├── commands/
    │   └── stage.test.ts     # MODIFIED: append TR-05 rollback test
    └── skills/
        └── stage.test.ts     # NOT modified: stage.test.ts:388 PI-6 test stays GREEN
                              # (proves the call-site policy preserves rejection)

tests/shared/
└── fs-utils.test.ts          # MODIFIED (or NEW if not present): removeOrphanIfPresent
                              # unit tests (5 cases: ENOENT, mode-tree dir match,
                              # mode-file file match, mode-tree file mismatch,
                              # mode-file dir mismatch)

tests/orchestrators/plugin/
└── update.test.ts            # NOT modified: PUP-6 test at :744 stays GREEN
                              # (the file obstacle survives because the obstacle is
                              # at the COMMIT path, not the replace path; the orphan
                              # helper isn't called on commit-side per current design.
                              # Confirm during plan.)
```

### Pattern 1: Sequential rename loop with reverse-rollback (TR-01, TR-05)

**What:** Replace `Promise.all(_stagedFilePaths.map(({from, to}) => rename(from, to)))`
with a sequential `for...of` loop that tracks completed renames; on throw, reverse-walk
the completed pairs and rename them BACK to staging; rollback failures accumulate into
`leaks[]` surfaced via `appendLeakToError`; the rollback loop NEVER throws.

**When to use:** Any commit-path that performs N sequential atomic renames where partial
completion must be reversible.

**Example (verified shape, ready for agents and commands):**
```typescript
// Source: extensions/pi-claude-marketplace/shared/fs-utils.ts:135-177
// (rollbackReplacementCommon reverse-rename + leaks pattern), adapted for
// commit-path (no backups -- staging dir holds the source).

// Step 2: mkdir <scopeRoot>/agents/ + sequential rename staged -> target.
const completedRenames: { from: string; to: string }[] = [];
try {
  await mkdir(prepared.locations.agentsDir, { recursive: true });
  for (const pair of prepared._stagedFilePaths) {
    await rename(pair.from, pair.to);
    completedRenames.push(pair);
  }
} catch (err) {
  // Reverse-walk completed renames -- restore each to staging.
  // NEVER throws from this loop; accumulate failures into leaks[].
  const leaks: string[] = [];
  for (const pair of [...completedRenames].reverse()) {
    try {
      await rename(pair.to, pair.from);
    } catch (rollbackErr) {
      leaks.push(
        `failed to roll back agent rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
      );
    }
  }

  // Surface BOTH the original error AND any rollback leaks AND the
  // staging-cleanup leak via appendLeakToError. Use appendLeaks (sequential
  // chain, already in shared/errors.ts:124) for multiple leak sources.
  const cleanupLeak = await cleanupStaging(prepared.stagingDir, "agents staging directory");
  throw appendLeaks(err, [...leaks, cleanupLeak]);
}
```

**Critical notes:**
- `[...completedRenames].reverse()` -- spread BEFORE reverse so the source array stays
  unmutated (Pitfall 1 #1; existing `rollbackReplacementCommon` line 142 does this).
- The rollback `rename(pair.to, pair.from)` may itself ENOENT (concurrent process
  removed the target). The try/catch swallows ALL errors into `leaks`, NEVER throws.
- Use `appendLeaks` (`shared/errors.ts:124`) for K rollback leaks + cleanup leak --
  it sequentially calls `appendLeakToError`, preserving the existing `Error.cause`
  chain depth-5 walker behavior.
- Do NOT wrap in `ManualRecoveryError` -- commit-path leaks are transient (e.g., disk
  full); `ManualRecoveryError` is for replacement-path leaks requiring user action
  (Pitfall 8 in PITFALLS.md).

### Pattern 2: Kind-strict orphan removal helper (TR-06 core)

**What:** A shared helper that pre-removes a target ONLY when its on-disk kind matches
the expected kind. ENOENT is swallowed. Mismatched kind leaves the target alone so the
subsequent rename surfaces a loud, informative error.

**When to use:** Before a `rename(from, to)` where `to` might hold an orphan from a
prior failed install; the caller has independently confirmed ownership.

**Example (verified shape, sourced from `bridges/skills/stage.ts:238-247`):**
```typescript
// Source: shared/fs-utils.ts (NEW export)
import { rm, stat } from "node:fs/promises";

/**
 * Pre-remove an orphan target before a planned rename. Kind-strict: mode `"tree"` only
 * removes directories, mode `"file"` only removes files. ENOENT is silently swallowed
 * (target already absent -- noop). Mismatched kind (e.g. mode "tree" but target is a
 * file) leaves the target alone, so the caller's subsequent rename surfaces ENOTDIR /
 * ENOTEMPTY with full context.
 *
 * CONTAINMENT: The caller MUST have already `assertPathInside`-d `target` -- this
 * helper does raw FS ops. Calling it on an uncontained path is a NFR-10 violation.
 *
 * OWNERSHIP: This helper does NOT verify ownership -- it removes the target uncondi-
 * tionally when kind matches. The caller is responsible for checking that `target`
 * represents a name this install owns (e.g., basename(target) ∈ _previousNames),
 * preserving the PI-6 cross-plugin guard at the call site.
 */
export async function removeOrphanIfPresent(
  target: string,
  mode: "file" | "tree",
): Promise<void> {
  try {
    const s = await stat(target);
    if (mode === "tree" && s.isDirectory()) {
      await rm(target, { recursive: true, force: true });
    } else if (mode === "file" && s.isFile()) {
      await rm(target);
    }
    // Mismatched kind: leave alone. Subsequent rename will surface ENOTDIR/ENOTEMPTY.
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
      throw e;
    }
  }
}
```

### Pattern 3: replacePrepared* call-site policy (TR-06 integration)

**What:** At the rename loop in `replacePrepared*`, BEFORE calling
`removeOrphanIfPresent`, the caller checks `basename(pair.to)` against the owned-names
set (`_previousNames` for skills/commands; `_previousEntries.map(e => e.generatedName)`
for agents). If owned, call the helper (rm orphan if kind matches; noop otherwise).
If NOT owned and `pair.to` exists, throw the existing "Cannot replace ... with
non-previous content" error.

**Example (skills variant; commands+agents follow same shape):**
```typescript
// Source: bridges/skills/stage.ts:307-313, post-TR-06 shape
const ownedNames = new Set(prepared._previousNames);
await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
for (const pair of prepared._renamePairs) {
  const targetName = path.basename(pair.to);
  if (ownedNames.has(targetName)) {
    // Owned orphan from a prior partial install -- safe to remove.
    // Kind-strict: only rms if pair.to is a directory.
    await removeOrphanIfPresent(pair.to, "tree");
  } else if (await pathExists(pair.to)) {
    // PI-6 cross-plugin guard: refuse to overwrite foreign content.
    throw new Error(`Cannot replace skill target with non-previous content at ${pair.to}`);
  }

  await rename(pair.from, pair.to);
  renamed.push(pair);
}
```

**Variations by bridge:**

| Bridge | Owned-names source | Basename derivation | Mode |
|--------|-------------------|---------------------|------|
| skills | `prepared._previousNames` | `path.basename(pair.to)` -- pair.to is `<skillsTargetDir>/<name>/` (directory) | `"tree"` |
| commands | `prepared._previousNames` | `path.basename(pair.to, ".md")` -- pair.to is `<promptsTargetDir>/<name>.md` | `"file"` |
| agents | `prepared._previousEntries.map(e => e.generatedName)` | `path.basename(pair.to, ".md")` -- pair.to is `<agentsDir>/<name>.md` | `"file"` |

**Why this preserves PI-6:** The PI-6 test at `stage.test.ts:388` seeds an unrelated
`acme-helper` dir while `previousSkillNames=["acme-knowledge"]`. Under the new policy:
the basename `acme-helper` is NOT in `ownedNames`, so the `else if (await pathExists(...))`
branch fires and the rejection error throws verbatim. Test stays GREEN.

**Why this preserves PUP-6:** The PUP-6 obstacle at `update.test.ts:744` is on the
`commitPreparedSkills` PATH (update orchestrator goes through `commitPrepared*`, NOT
`replacePrepared*`). The TR-06 changes are confined to `replacePrepared*`. Even if a
future refactor routed it through replace, the obstacle is a FILE (mode "tree" expected)
-- mismatched kind -> helper leaves alone -> rename throws ENOTDIR -> phase-3a aggregates.
Trigger preserved.

### Anti-Patterns to Avoid

- **`completedRenames.reverse()` in place** -- mutates the source array; the original
  list is then lost for any post-rollback diagnostic (e.g. a final
  `appendLeakToError` that wants to mention "N of M renames completed"). ALWAYS use
  `[...completedRenames].reverse()` (Pitfall 1 #1; confirmed by
  `rollbackReplacementCommon:142`).
- **Throwing from inside the rollback loop** -- a single failed reverse-rename poisons
  the rest of the rollback; you accumulate orphan files AND lose visibility. EVERY
  reverse-rename MUST be in try/catch that captures `errorMessage(err)` into `leaks[]`
  (Pitfall 6 / Pitfall 1 #2).
- **`throw new ManualRecoveryError(...)` from commit-path catch** -- the commit-path
  is transient IO (ENOSPC, EIO); `ManualRecoveryError` triggers the `(manual recovery)`
  rendering arm in `shared/notify.ts:1039-1049` which is intended for prepare-path
  rollbacks where the user must take action. Use `appendLeakToError` /
  `appendLeaks` for commit-path leaks (Pitfall 8). Confirmed by current
  `commitPreparedAgents` at `stage.ts:334-338,344-348` which already uses
  `appendLeakToError`.
- **Calling `removeOrphanIfPresent` without an ownership pre-check** -- removing any
  pre-existing target before rename silently enables cross-plugin overwrite. The
  PI-6 test at `stage.test.ts:388` MUST stay GREEN; the discriminator is the
  call-site basename-membership check (Pitfall 5).
- **Converting the agents step-1 `Promise.all` rm loop to sequential** -- step 1
  removes the OLD targets (ENOENT-tolerant); it has no per-rename source to roll back
  to (those files were never backed up). Only step-2 (rename) needs the sequential
  rewrite. Pitfall 1 final paragraph; confirmed by ARCHITECTURE.md Q2 boundary
  clarifications.
- **Lifting commit-loop rollback into a shared `commitWithRollback` helper inside
  Phase 38** -- the two bridges (agents step-2 + commands step-2) have meaningfully
  different shapes around the per-rename loop (agents has step-3 index save AFTER
  renames; commands has nothing after). Extracting a helper now would either be a
  loose generic that loses the post-rename steps or a tightly-coupled abstraction
  that doesn't generalize. Defer to v1.8 if the pattern recurs.
- **Updating the PI-6 rejection test (`stage.test.ts:388`) to match new behavior** --
  per SC#4, the test MUST stay RED (the rejection must still fire). Modifying the
  test is a documented red-flag for the cross-plugin-data-loss vector (Pitfall 5).
- **Modifying the PUP-6 file obstacle to "play nicer" with the orphan helper** --
  the file at `<skillsTargetDir>/hello-tool` is the test's failure trigger; replacing
  it with a different obstacle silently loses the ENOTDIR-via-file coverage
  (Pitfall 11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency-limited rename | `p-limit`, `p-queue` | Sequential `for...of` await rename | The fixes go FROM parallel `Promise.all` TO sequential -- concurrency primitives are precisely the wrong direction. Plugin component counts are 1-20; concurrency win is invisible. |
| Atomic FS transaction wrapper | `transactional-fs`, `fs-jetpack` | Sequential rename + tracked rollback (this fix) | Per the v1.7 STACK research: no transactional-FS lib matches the same-FS rename semantics the existing bridges already depend on. |
| Sequential-commit shared helper | New `commitWithRollback` helper | Inline the pattern in each bridge | The two bridges (agents step-2 + commands step-2) have meaningfully different surrounding context. Extracting a helper for two call sites costs more than it saves. Reconsider in v1.8 if a third commit-loop appears. |
| Multi-leak error chaining | New `MultiLeakError` class, `compose-error` library | Existing `appendLeaks(err, leaks[])` at `shared/errors.ts:124` | Already chains via `Error.cause`; depth-5 walker in `shared/notify.ts` surfaces the cause chain to the user. |
| Cross-plugin ownership marker for skills/commands | New `isOwnedSkillDir`, `isOwnedPromptFile` content scanner | `_previousNames` membership at call site | Skills (directories) and commands (`<plugin>:<command>.md` files) carry the plugin name in the basename via the resolver-generated form; the cross-plugin distinction is structural. No need for body content marker like agents' `GENERATED_AGENT_MARKER`. |
| Saga/orchestration library | `node-sagas`, Temporal | Existing `transaction/phase-ledger.ts` + this fix | The phase-ledger primitive (now fixed in Phase 37) provides the orchestrator-level rollback. The bridge-level commit fix is one layer down; bringing in a saga lib for either is overkill (v1.7 milestone-wide verdict). |

**Key insight:** The fix is a structural reshape of two existing commit functions and a
helper extraction. NO new abstractions are warranted -- adding a `commitWithRollback`
helper or a multi-leak error class would violate the v1.7 milestone-wide "no new
dependencies, no new infrastructure" verdict from `.planning/research/SUMMARY.md`.

## Runtime State Inventory

Not applicable. Phase 38 modifies in-memory control flow + filesystem rename ordering
in existing functions. No data migration, no rename of identifiers stored anywhere on
disk or in any service config. The changes only affect:

- **Stored data:** None affected -- state.json schema unchanged. The `resources.{skills,
  prompts,agents,mcpServers}` arrays are READ by the post-TR-06 call-site policy
  (through `_previousNames` already populated by the orchestrators) but NOT written
  differently.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: Sequential rollback loop bugs (3 sub-traps)

**What goes wrong:** The naive sequential-with-rollback rewrite hides three traps that
PITFALLS.md Pitfall 1 enumerates: (a) `completed.reverse()` mutates the source array;
(b) reverse-rename can ALSO fail (e.g., ENOENT after concurrent unlink); (c) the
pre-step parallel `rm` loop (agents step-1) is asymmetric with the new sequential
step-2 -- its ENOENT-tolerant pass has no backup to rollback to and must stay
parallel.

**Why it happens:** Each sub-trap looks correct in isolation. The combination breaks.

**How to avoid:**
1. Always `[...completed].reverse()` -- spread before reverse.
2. Wrap every reverse-rename in try/catch; capture `errorMessage(err)` into `leaks[]`;
   NEVER throw from the rollback loop.
3. Leave step-1 (`rm` of `_previousEntries`) parallel and ENOENT-tolerant; only
   rewrite step-2 (the new-rename loop).

**Warning signs:** A test assertion that checks `completedRenames.length` AFTER a
catch block -- if it reads "0" instead of N (because `reverse()` mutated in place),
that's bug (a). A test that runs in CI but fails locally only under load -- that's
bug (b) where a concurrent process raced the rollback rename.

### Pitfall 2: PI-6 cross-plugin guard bypassed by naive orphan removal

**What goes wrong:** The PI-6 test at `stage.test.ts:388` seeds an unrelated
`acme-helper` dir (not in `previousSkillNames`) and the current code REJECTS the
replace with "non-previous content". A "fix" that always calls
`removeOrphanIfPresent` before rename silently removes `acme-helper` and overwrites
foreign content -- exactly the cross-plugin data-loss vector PI-6 is designed to
prevent.

**Why it happens:** SC#4 wording "instead of `if (pathExists(pair.to)) throw`" reads
as a 1:1 replacement; the natural implementation is to unconditionally call the helper.

**How to avoid:** The call-site policy must:
1. Build `ownedNames = new Set(prepared._previousNames)` (or
   `_previousEntries.map(e => e.generatedName)` for agents) at the top of the rename
   loop.
2. For each `pair.to`: derive `targetName = path.basename(pair.to[, ".md"])`.
3. If `ownedNames.has(targetName)`: call `removeOrphanIfPresent(pair.to, mode)`.
4. Else: if `pathExists(pair.to)`, throw the existing PI-6 rejection error.
5. `rename(pair.from, pair.to)` + push to `renamed[]`.

**Warning signs:** A change to `stage.test.ts:388` that adapts the test to "accept
the new behavior" (e.g., asserting the rename succeeds OR changing the seed to a
foreign body marker). The test MUST stay verbatim and pass via the call-site
ownership check.

### Pitfall 3: PUP-6 phase-3 failure trigger erasure

**What goes wrong:** `update.test.ts:744` seeds a FILE at
`<skillsTargetDir>/hello-tool` to force `rename(stagedDir, fileTarget)` -> ENOTDIR.
The current PUP-6 path goes through `commitPreparedSkills` (NOT replacePreparedSkills).
The TR-06 changes confined to `replacePrepared*` do NOT touch this path. BUT if a
future planner mistakenly applies the helper to `commitPreparedSkills` step-2 OR
if the helper's kind-check is wrong (e.g. rm anything regardless of kind), the file
gets rm'd, rename succeeds, the test goes GREEN-for-wrong-reasons.

**Why it happens:** The TR-06 scope is "replacePrepared*", but a planner might
infer "let's apply the same orphan-tolerance to the commit path too" -- which would
mask the failure trigger.

**How to avoid:**
1. SCOPE BOUND: TR-06's helper is ONLY called from the THREE `replacePrepared*`
   functions. The existing `commitPreparedSkills` inline stat-rm (commit 01028ea)
   may be REFACTORED to call the helper for code-dedup, but ONLY if the refactor
   preserves the existing PUP-6 GREEN behavior (helper's kind-strict check leaves
   the file alone, rename throws ENOTDIR).
2. Verify post-fix: run `node --test tests/orchestrators/plugin/update.test.ts`
   and confirm the PUP-6 test still triggers phase-3a aggregation.
3. The helper's `mode === "tree" && s.isDirectory()` check is the structural guard:
   a FILE under mode "tree" leaves the target alone. Lock this with a unit test
   in `tests/shared/fs-utils.test.ts`.

**Warning signs:** A diff that touches both `bridges/skills/stage.ts` AND
`tests/orchestrators/plugin/update.test.ts` -- specifically a change to the obstacle
seed at line 776. If the obstacle is changed to a directory with foreign content,
PUP-6 is no longer testing the ENOTDIR trigger.

### Pitfall 4: Leak-surfacing via wrong error type (ManualRecoveryError vs appendLeakToError)

**What goes wrong:** The catch block's `throw new ManualRecoveryError(errorMessage(err),
leaks, { cause: err })` (copied from `replacePrepared*` at `bridges/agents/stage.ts:454`)
routes commit-path errors through the `(manual recovery)` rendering arm in
`shared/notify.ts:1039`. But commit-path failures (ENOSPC, EIO during rename) are
transient -- not "user must clean up files by hand" semantics. The user sees a
`(manual recovery)` row pointing at staging-dir leaks they don't need to act on.

**Why it happens:** The two patterns look syntactically similar in the existing source.
A copy-paste during the TR-01 fix carries the wrong error type.

**How to avoid:**
1. Use `appendLeakToError(err, leak)` (single-leak source) or `appendLeaks(err,
   leaks[])` (multi-leak chain) for commit-path catches. Both are at
   `shared/errors.ts:114-131`.
2. Reserve `ManualRecoveryError` for `replacePrepared*` -- those paths really do
   require user-visible recovery (e.g., "your backups are at /tmp/.../backup-<uuid>/").
3. The user-visible difference per docs/messaging-style-guide v1.0 §15: commit-path
   leaks render as a parenthetical "(additionally: <leak>)" appended to the original
   error; `(manual recovery)` is a top-level row marker.

**Warning signs:** A diff that imports `ManualRecoveryError` into the TR-01/TR-05
catch sites. The existing `commitPreparedAgents` catch at lines 334 and 344 uses
`appendLeakToError` -- the new sequential-rollback catch should follow the same
pattern, scaled to multi-leak via `appendLeaks`.

### Pitfall 5: Skills bridge commit-path refactor breaks the existing 01028ea fix

**What goes wrong:** The current `commitPreparedSkills` at `bridges/skills/stage.ts:
231-250` has an INLINE stat+rm pattern (added by commit 01028ea) that pre-removes a
stale directory at `pair.to` before rename. The natural Phase 38 refactor is to
replace this inline with `removeOrphanIfPresent(pair.to, "tree")`. Two failure modes:
(a) the helper changes the error semantics (e.g., re-throws on EISDIR where the inline
swallowed); (b) the helper's "leave alone on kind mismatch" changes behavior
relative to the inline.

**Why it happens:** The inline pattern at line 238-247 swallows only ENOENT (line 244)
and ALSO unconditionally re-throws other errors (line 245). The helper does the same.
But the inline's "if (targetStat.isDirectory())" gate at line 240 means a FILE at
`pair.to` is silently skipped (no rm), then rename throws ENOTDIR -- which is the
PUP-6 mechanism. The helper must preserve this verbatim.

**How to avoid:**
1. Verify the helper's behavior on ALL THREE inputs the inline pattern handles:
   - target is a directory + mode "tree" -> rm (recursive, force)
   - target is a file + mode "tree" -> leave alone (NO rm)
   - target ENOENT -> noop (swallow)
   - target stat throws non-ENOENT -> re-throw
2. Confirm PUP-6 still triggers after the refactor.
3. Note: this refactor of `commitPreparedSkills` is OPTIONAL for the phase. Strict
   TR-06 scope is only `replacePreparedSkills/Commands/Agents`. The commit-side
   refactor is a code-dedup nice-to-have; if it adds risk, skip it.

**Warning signs:** Test failures in `tests/bridges/skills/stage.test.ts` after the
refactor. Specifically tests that exercise the ENOTEMPTY orphan recovery path (added
by commit 01028ea -- check that commit's test additions).

### Pitfall 6: Phase 37 ledger contract assumption

**What goes wrong:** Phase 37 (TR-02) just landed and reorganised `runPhases` to call
the failing phase's `undo` BEFORE `rollbackExecuted`. The install path's `agentsPhase.do`
calls `commitPreparedAgents`. After Phase 37 + Phase 38 land together:
- If the new sequential-rename in `commitPreparedAgents` throws after K renames
  succeed, the bridge's internal rollback restores those K renames (TR-01).
- Then the bridge throws.
- `runPhases` catches: calls `agentsPhase.undo` (which calls `unstagePluginAgents`
  on `c.stagedAgentNames`).
- But the new sequential-rollback ALREADY restored the renames to staging -- so
  `unstagePluginAgents` finds nothing at the agentsDir paths and ENOENT-tolerates
  its way to a no-op.

**Why it happens:** Two layers of rollback (bridge-level + ledger-level) both target
the same on-disk state. Without coordination, the second layer's work is redundant
(harmless ENOENT-noop) or destructive (if it removes something the first layer didn't
fully roll back).

**How to avoid:**
1. The agentsPhase.undo arm (`install.ts:560-572`) calls `unstagePluginAgents`,
   which is ENOENT-tolerant by codebase convention. After the bridge restores
   renames to staging, there's nothing for unstage to find -- the no-op is the
   correct behavior.
2. `c.stagedAgentNames` is set BEFORE commit (line 550 of install.ts) -- wait,
   no: at line 550 it's set AFTER `await commitPreparedAgents(prep)` line 545.
   This means on a partial-commit throw, `c.stagedAgentNames` is still the
   `[]` initialized at line 451. So undo's `unstagePluginAgents` removes nothing.
   That's correct because the bridge already rolled back via reverse-rename.
3. The skills bridge case (already fixed in 01028ea) sets `c.stagedSkillNames`
   BEFORE the commit call (line 475). With the bridge now performing reverse-rename
   rollback on throw, the undo's `unstagePluginSkills` finds no files (rolled back)
   and ENOENT-tolerates. Still correct.

**Warning signs:** A test for the bridge's sequential-rollback that ALSO asserts
the undo's behavior -- if the test runs both layers, ENOENT-noop is the expected
outcome. A test that asserts unstage removed something would catch a regression
where bridge rollback didn't fully run.

### Pitfall 7: Containment escape via removeOrphanIfPresent

**What goes wrong:** The helper does raw `stat` + `rm` on caller-supplied paths.
If a future caller passes a path that hasn't been `assertPathInside`-d, the helper
could rm content outside the scope root -- violating NFR-10.

**Why it happens:** The helper signature is minimal; there's no path-safety enforcement
inside.

**How to avoid:**
1. Document in the helper's JSDoc that the CALLER must have `assertPathInside`-d
   the target.
2. Audit all three call sites: each `replacePrepared*` already calls
   `assertPathInside` on its targets (verified at `bridges/skills/stage.ts:295`,
   `bridges/commands/stage.ts:263`, `bridges/agents/stage.ts:420`). The new helper
   call sits AFTER those guards on the same `pair.to` value.
3. Consider: should the helper itself accept a `containedBy: string` arg and call
   `assertPathInside` internally? Reject this -- the existing helpers in
   `shared/fs-utils.ts` (`cleanupStaging`, `rollbackReplacementCommon`) don't do
   internal containment, and the convention is "caller owns containment, helper
   owns IO."

**Warning signs:** A new caller that imports `removeOrphanIfPresent` without an
adjacent `assertPathInside`. Architecture tests in `tests/architecture/` could lint
for this if it becomes a pattern.

## Code Examples

### Verified pattern: existing reverse-walk rollback (the template for TR-01/TR-05)

```typescript
// Source: extensions/pi-claude-marketplace/shared/fs-utils.ts:135-177
export async function rollbackReplacementCommon(
  input: RollbackReplacementInput,
): Promise<readonly string[]> {
  const leaks: string[] = [];
  const rmOptions =
    input.removeMode === "tree" ? { recursive: true, force: true } : { force: true };

  for (const pair of [...input.renamed].reverse()) {
    try {
      await rm(pair.to, rmOptions);
    } catch (err) {
      leaks.push(
        `failed to remove ${input.labels.replacement} at ${pair.to}: ${errorMessage(err)}`,
      );
    }
  }

  for (const backup of [...input.backups].reverse()) {
    try {
      await mkdir(path.dirname(backup.from), { recursive: true });
      await rename(backup.to, backup.from);
    } catch (err) {
      leaks.push(
        `failed to restore ${input.labels.previous} ${backup.name} from ${backup.to} to ${backup.from}: ${errorMessage(err)}`,
      );
    }
  }

  // ... beforeCleanup + final cleanup ...
  return Object.freeze(leaks);
}
```

### Verified pattern: existing commit-path catch with appendLeakToError

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/stage.ts:333-348
// Step 1: parallel rm + step 2: parallel rename, BOTH wrapped in
// try { ... } catch (err) { throw appendLeakToError(err, await cleanupStaging(...)); }
// The TR-01 fix adds a multi-leak inner-loop catch INSIDE the step-2 try.
try {
  await Promise.all(
    prepared._previousEntries.map(async (entry) => {
      try {
        await rm(entry.targetPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          throw err;
        }
      }
    }),
  );
} catch (err) {
  throw appendLeakToError(
    err,
    await cleanupStaging(prepared.stagingDir, "agents staging directory"),
  );
}
```

### Required new pattern: TR-01 sequential commit with reverse rollback (agents step-2)

```typescript
// Post-TR-01 shape for bridges/agents/stage.ts step-2 (replaces current Promise.all
// at line 343).

// Step 2: mkdir <scopeRoot>/agents/ + sequential rename staged -> target.
// Sequential so we can track completed renames and reverse them on a partial
// failure -- matches the rollback shape in rollbackReplacementCommon
// (shared/fs-utils.ts:135-177).
const completedRenames: { from: string; to: string }[] = [];
try {
  await mkdir(prepared.locations.agentsDir, { recursive: true });
  for (const pair of prepared._stagedFilePaths) {
    await rename(pair.from, pair.to);
    completedRenames.push(pair);
  }
} catch (err) {
  // Reverse-walk completed renames -- restore each back to staging. NEVER
  // throws from this loop; rollback failures accumulate into leaks[].
  const rollbackLeaks: string[] = [];
  for (const pair of [...completedRenames].reverse()) {
    try {
      await rename(pair.to, pair.from);
    } catch (rollbackErr) {
      rollbackLeaks.push(
        `failed to roll back agent rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
      );
    }
  }

  // Surface BOTH original err AND rollback leaks AND staging-cleanup leak
  // via appendLeaks (sequential-cause chain; preserves Error.cause for the
  // depth-5 walker in shared/notify.ts).
  throw appendLeaks(err, [
    ...rollbackLeaks,
    await cleanupStaging(prepared.stagingDir, "agents staging directory"),
  ]);
}
```

### Required new pattern: TR-05 sequential commit with rollback (commands step-2)

Identical shape to agents step-2, applied to `bridges/commands/stage.ts:219-221`.
The pre-step `unlink` loop at lines 202-213 stays sequential + ENOENT-tolerant
(no rollback). Only the inner `rename` loop gets `completedRenames[]` tracking
plus the same reverse-walk + multi-leak catch.

### Required new pattern: TR-06 call-site policy (skills variant)

```typescript
// Post-TR-06 shape for bridges/skills/stage.ts:306-314 (replaces the existing
// pathExists-throw at line 308-310).
const ownedNames = new Set<string>(prepared._previousNames);
await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
for (const pair of prepared._renamePairs) {
  const targetName = path.basename(pair.to);
  if (ownedNames.has(targetName)) {
    // Owned orphan from a prior partial install -- safe to remove.
    // Kind-strict: helper only rms if pair.to is a directory; mismatched
    // kind leaves the target alone so rename fails loudly.
    await removeOrphanIfPresent(pair.to, "tree");
  } else if (await pathExists(pair.to)) {
    // PI-6 cross-plugin guard: foreign content at a name we don't own.
    throw new Error(`Cannot replace skill target with non-previous content at ${pair.to}`);
  }

  await rename(pair.from, pair.to);
  renamed.push(pair);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Promise.all` rename in agents commit step-2 (no partial-failure tracking) | Sequential `for...of` rename with reverse-walk rollback on throw | Phase 38 (v1.7, TR-01) | Closes the K-1 orphan-files-on-disk path when one of K renames throws (e.g., EACCES on disk #5 of 7). |
| Sequential `for...of` rename in commands commit (no rollback) | Sequential `for...of` rename WITH `completedRenames[]` tracking and reverse-walk rollback on throw | Phase 38 (v1.7, TR-05) | Symmetry with agents fix; same protections. |
| `if (await pathExists(pair.to)) throw "non-previous content"` in `replacePrepared*` | `ownedNames.has(basename(pair.to)) ? removeOrphanIfPresent(...) : (pathExists ? throw : continue)` | Phase 38 (v1.7, TR-06) | Unblocks reinstall after a prior partial install left an owned orphan; preserves PI-6 cross-plugin guard for foreign content. |
| Inline stat+rm pattern in `commitPreparedSkills` (post-01028ea) | OPTIONAL refactor to call `removeOrphanIfPresent(pair.to, "tree")` | Phase 38 (v1.7, TR-06 dedup) | Centralizes the kind-strict pattern; reduces divergence between commit-path and replace-path orphan handling. |

**Deprecated/outdated:** None -- this is in-place hardening of an existing primitive
shape.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The TR-06 helper should be called from `replacePrepared*` ONLY, not from `commitPrepared*` (skills/commands/agents) | "Architecture Patterns" + "Pitfall 3" + "Pattern 1" | If the planner extends the helper to commit paths, the PUP-6 file obstacle could be removed (mode "tree" + file mismatch leaves it alone, so this is safe IF the helper's kind-check is preserved verbatim). Mitigation: explicit unit test for the mismatched-kind case. The OPTIONAL refactor of `commitPreparedSkills` inline stat+rm to call the helper is documented as optional in Pitfall 5 -- the planner decides based on risk appetite. |
| A2 | The owned-names discriminator at `replacePrepared*` call sites is `_previousNames` (skills/commands) and `_previousEntries.map(e => e.generatedName)` (agents) | "Pattern 3" + "Pitfall 2" | If the orchestrator pipeline actually exposes a different "owned" set (e.g., a separate state.json read), the call-site policy may miss orphans owned per state.json but not in `_previousNames`. Mitigation: VERIFY against the existing reinstall.ts flow (lines 973/982/990) -- `previousSkillNames = input.oldRecord.resources.skills` IS the state.json view. Same for commands and agents. So `_previousNames` IS the state.json-confirmed view; the assumption holds. |
| A3 | The PUP-6 test at `update.test.ts:744` exercises the `commitPreparedSkills` path (not `replacePreparedSkills`), so TR-06's changes to `replacePrepared*` do NOT affect it | "Pattern 3" + "Pitfall 3" | If `updatePlugins` is later refactored to use `replacePreparedSkills` (e.g., via the TR-04 reorder in Phase 40), the obstacle path would change. For Phase 38, this is OUT OF SCOPE -- the `runThreePhaseUpdate` path uses `commitPrepared*` (verified at `orchestrators/plugin/update.ts:888,901,907,920`). |
| A4 | The OPTIONAL refactor of `commitPreparedSkills` inline stat+rm (commit 01028ea) to use `removeOrphanIfPresent` is a nice-to-have, NOT a TR-06 requirement | "Pitfall 5" + "State of the Art" | If the planner skips the refactor, the helper exists ONLY for `replacePrepared*` callers. The skills commit-path keeps its inline pattern. SAFER but creates divergence. Mitigation: defer to the planner; both options are acceptable. |
| A5 | The `commitPreparedSkills` skills commit-path does NOT need TR-01-style sequential rollback because the inline stat+rm already eliminates the ENOTEMPTY case AND the skills bridge has no equivalent K-1-orphan issue when a rename throws mid-loop | "Architecture Patterns" | If a skills rename throws AFTER the orphan-rm step (e.g., disk full after rm but before rename), the orphan target is gone AND the original staged dir is still in staging. The next retry's `_previousNames` will be empty (state.json was never updated), so the helper finds nothing at `pair.to` -- safe to retry. BUT a partial-loop throw at K of N renames leaves K previously-renamed dirs at target. Skills CURRENTLY has no reverse-walk for this. ADDING TR-01-style rollback to skills commit-path is in scope per parallel TR-01 reasoning -- BUT not in CONTEXT.md SC. Planner: confirm scope. (Recommendation: defer skills commit-loop rollback to a follow-up; SC explicitly names only agents + commands.) |

**Confirmation required from planner:**
- A1 (helper scope): re-confirm by reading the orchestrator entry points (install.ts,
  update.ts, reinstall.ts) and verifying which path each test exercises.
- A2 (owned-names source): re-confirm by reading reinstall.ts:960-1006 and tracing
  `oldRecord.resources` -> `previousSkillNames` -> `_previousNames`.
- A3 (PUP-6 path): re-confirm by reading `runThreePhaseUpdate` at update.ts:867-923
  -- it calls `commitPrepared*`, not `replacePrepared*`.
- A5 (skills commit-loop scope): decide whether to apply TR-01-style sequential
  rollback to skills `commitPreparedSkills` step-2 in this phase, or defer. The
  SC list names only agents (SC#1) and commands (SC#2); strict reading says skills
  is out of scope.

## Open Questions (RESOLVED)

1. **RESOLVED -- DEFERRED: `commitPreparedSkills` step-2 does NOT get TR-01-style
   sequential rollback in this phase.**
   - SC#1 names `commitPreparedAgents`. SC#2 names `commitPreparedCommands`. Skills
     is not named. The skills commit-path already does sequential rename (line 248-249
     of stage.ts) but does NOT track `completedRenames[]` for rollback.
   - Adopted by PLAN.md must_haves: skills commit-loop rollback is documented as a
     follow-up in `.planning/BACKLOG.md` (future v1.8). The skills commit-path is the
     most defensive of the three already -- it has the orphan pre-rm at line 238-247.

2. **RESOLVED -- DEFERRED: the `commitPreparedSkills` inline stat+rm at lines 238-247
   is NOT refactored to call `removeOrphanIfPresent` in this phase.**
   - The shapes are identical and refactoring is a 6-line code-dedup win, but it lies
     on the PUP-6 path and is orthogonal to the SC contract. Deferred to a follow-up
     pass after Phase 38 lands. Plan must_haves call this out explicitly.

3. **RESOLVED -- REJECTED: `removeOrphanIfPresent` does NOT take an `ownedNames` arg.
   The helper signature stays minimal `(target, mode)` with the ownership check at
   the call site.**
   - Adopted by PLAN.md Task 1 action and must_haves: the 4-line ownership policy is
     repeated at the three call sites in `replacePrepared*` for explicit-control-flow
     ergonomics. Premature abstraction would be harder to refactor when (e.g.) a
     fourth bridge appears.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runtime + TypeScript strip + fs/promises | ✓ | >=20.19.0 (NFR-4) | -- |
| TypeScript | typecheck for strict-mode interfaces | ✓ | ^5.9.3 (project lockfile) | -- |
| `node:test` (built-in) | Regression test framework | ✓ | bundled | -- |
| `node:assert/strict` (built-in) | `assert.deepEqual`, `assert.match`, `assert.rejects` | ✓ | bundled | -- |
| `node:fs/promises` (built-in) | `rename`, `rm`, `stat`, `mkdir` -- all used in fix sites | ✓ | bundled | -- |
| `pre-commit` | CLAUDE.md hook gate | ✓ (verified by `.pre-commit-config.yaml` presence) | -- | -- |
| `write-file-atomic` (already installed) | NOT used directly in this phase (only state.json IO uses it; commit paths use raw `rename`) | ✓ | ^8.0.0 (verified in package.json) | -- |
| `memfs` (already in dev deps) | Optional for unit test isolation; existing tests use temp dirs | ✓ | ^4.57.2 | tempdir-based tests (current convention) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, since 20.x stable) |
| Config file | none -- `package.json` `"test"` script glob: `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` |
| Quick run command | `node --test tests/bridges/agents/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/skills/stage.test.ts tests/shared/fs-utils.test.ts` (~3-6 sec) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |
| Phase gate | Full suite GREEN before `/gsd-verify-work` (per SC#6) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TR-01 (SC#1) | `commitPreparedAgents` partial-throw triggers reverse-walk rollback; staging dir holds all files after rollback | unit | `node --test tests/bridges/agents/stage.test.ts` → new test "TR-01 commitPreparedAgents sequential commit rolls back completed renames on throw" | ❌ (Wave 0: add) |
| TR-01 (SC#1) | Rollback failure (reverse-rename throws) accumulates into leaks; original error preserved via `appendLeaks`; `ManualRecoveryError` NOT used | unit | same file → new test "TR-01 commitPreparedAgents rollback rename failure surfaces via appendLeaks" | ❌ (Wave 0: add) |
| TR-05 (SC#2) | `commitPreparedCommands` partial-throw triggers reverse-walk rollback (identical shape to agents) | unit | `node --test tests/bridges/commands/stage.test.ts` → new test "TR-05 commitPreparedCommands sequential commit rolls back completed renames on throw" | ❌ (Wave 0: add) |
| TR-06 (SC#3) | `removeOrphanIfPresent(target, "tree")` rms when target is a directory; noop when target is a file (kind mismatch); noop on ENOENT | unit | `node --test tests/shared/fs-utils.test.ts` → 5 new test cases | ❌ (Wave 0: add or create file) |
| TR-06 (SC#3) | `removeOrphanIfPresent(target, "file")` rms when target is a file; noop when target is a directory (kind mismatch); noop on ENOENT | unit | same file | ❌ (Wave 0: add) |
| TR-06 (SC#4) | `replacePreparedSkills` call-site policy: owned name -> helper rm; not owned + exists -> throw "non-previous content"; not owned + ENOENT -> continue | integration | `node --test tests/bridges/skills/stage.test.ts` → EXISTING test at :388 stays GREEN (asserts rejection); NEW test "TR-06 replacePreparedSkills tolerates owned orphan dir from prior partial install" | ✓ (:388 exists; new test to add) |
| TR-06 (SC#4) | Same for `replacePreparedCommands` and `replacePreparedAgents` | integration | same convention; existing PI-6 tests at `stage.test.ts:378` (commands), `stage.test.ts:1064` (agents) stay GREEN | ✓ (existing tests; new orphan tests to add) |
| TR-06 (SC#5) | PUP-6 phase-3 failure test (`update.test.ts:744`) still triggers its failure path -- the file obstacle survives because Phase 38 changes only `replacePrepared*` (commit path unaffected) | regression | `node --test tests/orchestrators/plugin/update.test.ts` -- existing test stays verbatim and GREEN | ✓ (existing PUP-6 test) |
| TR-01/TR-05/TR-06 (SC#6) | `npm run check` GREEN; no regression from Phase 37 baseline | regression | `npm run check` full suite | ✓ (full suite) |

### Sampling Rate

- **Per task commit:** `node --test tests/bridges/{agents,commands,skills}/stage.test.ts
  tests/shared/fs-utils.test.ts` (~3-6 sec)
- **Per wave merge:** `node --test tests/bridges/**/*.test.ts
  tests/orchestrators/plugin/update.test.ts tests/orchestrators/plugin/install.test.ts
  tests/orchestrators/plugin/reinstall.test.ts tests/shared/fs-utils.test.ts`
  (~30-60 sec) -- includes PUP-6 and install/reinstall paths that exercise the
  fixed code.
- **Phase gate:** `npm run check` (full suite ≈ 1160+ tests post-Phase 37) -- green
  before `/gsd-verify-work`.

### Wave 0 Gaps

The test files mostly exist; the gaps are NEW test cases appended to existing files
and possibly a new file for the shared helper.

- [ ] `tests/shared/fs-utils.test.ts` -- VERIFY exists. If not, CREATE. Append 5 unit
      tests for `removeOrphanIfPresent` (mode-tree dir match, mode-tree file mismatch,
      mode-file file match, mode-file dir mismatch, ENOENT swallow).
- [ ] `tests/bridges/agents/stage.test.ts` -- APPEND 2 tests:
      (a) "TR-01 commitPreparedAgents sequential commit rolls back completed renames
          on throw" -- prepare 3 stages, inject a `rename` failure on the 2nd (e.g.
          via chmod 0 on a sub-dir), assert staging dir holds all 3 staged files
          after rollback, no agent files at target.
      (b) "TR-06 replacePreparedAgents tolerates owned orphan file from prior partial
          install" -- prepare with previousNames=["X"], pre-create "X" on disk,
          assert rename succeeds.
- [ ] `tests/bridges/commands/stage.test.ts` -- APPEND 2 tests (symmetric to agents).
- [ ] `tests/bridges/skills/stage.test.ts` -- APPEND 1 test for orphan tolerance
      (existing :388 PI-6 test stays untouched).

### Required exact test cases (input -> expected behavior -> assertion mechanism)

1. **TR-01 sequential commit rollback (agents):**
   - **Input:** Prepare 3 staged agents (`a.md`, `b.md`, `c.md`). Pre-create the
     agentsDir, then `chmod 0` it AFTER mkdir but BEFORE rename of `b.md` (or use
     a POSIX permission tweak that fails the 2nd rename). Run `commitPreparedAgents`.
   - **Expected:** Throws. Staging dir still contains all 3 files (rolled back).
     Target agentsDir contains 0 files (a.md rolled back; b.md never landed;
     c.md never tried). Error message includes `appendLeakToError`-style
     "(additionally: ...)" if cleanup leaked.
   - **Assertion:** `assert.rejects` + post-throw `stat` on each staged + target
     path.

2. **TR-01 rollback failure accumulates into leaks (agents):**
   - **Input:** Prepare 3 staged agents. Allow first rename. Force second rename
     to throw (chmod). Force the rollback `rename(b_target, b_staged)` to ALSO
     throw (e.g. concurrent removal of staging file).
   - **Expected:** Throws. Error message is the original error wrapped by
     `appendLeaks` with the rollback-leak text embedded as `"(additionally: failed
     to roll back agent rename ...)"` and the cleanup-leak text.
   - **Assertion:** `assert.rejects` with regex matching the leak format.

3. **TR-05 sequential commit rollback (commands):**
   - **Input:** Symmetric to TR-01 test 1, using `commitPreparedCommands`.
   - **Expected:** Symmetric assertions.

4. **TR-06 removeOrphanIfPresent kind-strict (tree mode, directory target):**
   - **Input:** Pre-create directory at `/tmp/X/`. Call
     `removeOrphanIfPresent("/tmp/X", "tree")`.
   - **Expected:** Returns void. `/tmp/X` no longer exists.
   - **Assertion:** `await assert.rejects(() => stat("/tmp/X"), { code: "ENOENT" })`.

5. **TR-06 removeOrphanIfPresent kind-strict (tree mode, file target = mismatch):**
   - **Input:** Pre-create file at `/tmp/X`. Call `removeOrphanIfPresent("/tmp/X",
     "tree")`.
   - **Expected:** Returns void. `/tmp/X` still exists as a file.
   - **Assertion:** `assert.ok((await stat("/tmp/X")).isFile())`.

6. **TR-06 removeOrphanIfPresent kind-strict (file mode, file target):**
   - **Input:** Pre-create file at `/tmp/X.md`. Call
     `removeOrphanIfPresent("/tmp/X.md", "file")`.
   - **Expected:** Returns void. File no longer exists.
   - **Assertion:** `assert.rejects(() => stat("/tmp/X.md"), { code: "ENOENT" })`.

7. **TR-06 removeOrphanIfPresent kind-strict (file mode, directory target = mismatch):**
   - **Input:** Pre-create directory at `/tmp/X/`. Call
     `removeOrphanIfPresent("/tmp/X", "file")`.
   - **Expected:** Returns void. Directory still exists.
   - **Assertion:** `assert.ok((await stat("/tmp/X")).isDirectory())`.

8. **TR-06 removeOrphanIfPresent ENOENT swallow:**
   - **Input:** Call `removeOrphanIfPresent("/tmp/never-existed", "tree")`.
   - **Expected:** Returns void with no error.
   - **Assertion:** `await removeOrphanIfPresent(...)` does not throw.

9. **TR-06 replacePreparedSkills orphan tolerance:**
   - **Input:** Pre-create `<skillsTargetDir>/acme-knowledge/SKILL.md` ("orphan
     bytes"). Prepare with `previousSkillNames: ["acme-knowledge"]`. Call
     `replacePreparedSkills`.
   - **Expected:** Rename succeeds. New content at target. NO throw on "non-previous
     content".
   - **Assertion:** `replacement.kind === "replaced"`. `await readFile(...)` returns
     post-stage content (not "orphan bytes").

10. **TR-06 replacePreparedSkills PI-6 guard preserved (existing :388 test):**
    - **Input:** Same as existing test at `stage.test.ts:388` -- `acme-helper`
      unrelated content + `previousSkillNames: ["acme-knowledge"]`.
    - **Expected:** Throws "non-previous content".
    - **Assertion:** `assert.rejects(..., /non-previous content/)` -- verbatim
      from existing test.

11. **PUP-6 unchanged (regression-only):**
    - **Input:** Run existing `update.test.ts:744` test verbatim.
    - **Expected:** PASS -- the file obstacle still triggers ENOTDIR, phase-3a
      aggregates to one error notification with `RECOVERY_PLUGIN_REINSTALL_PREFIX`.
    - **Assertion:** Existing assertions remain GREEN; no test modification.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable -- internal control-flow + FS ops. |
| V3 Session Management | no | Not applicable. |
| V4 Access Control | no | Not applicable. |
| V5 Input Validation | yes (indirect) | `assertSafeName` (`domain/name.ts`) at the caller already validates the basename of each `pair.to`; the new helper accepts pre-validated paths. |
| V6 Cryptography | no | Not applicable. |
| V10 Malicious Code | no | No new external code paths. |
| V12 File and Resources | yes | The helper performs raw `rm` on caller-supplied paths -- caller MUST have `assertPathInside`-d the target (NFR-10 containment). Documented in helper JSDoc. |
| V13 API and Web Service | no | Not applicable. |

### Known Threat Patterns for bridge-commit hardening

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `removeOrphanIfPresent` (caller passes uncontained path) | Tampering | Caller-side `assertPathInside` BEFORE invoking the helper. All three `replacePrepared*` call sites already pass through `assertPathInside(targetDir, pair.to, ...)` during prepare; the helper is called on the same `pair.to`. |
| Cross-plugin data-loss via orphan-rm of foreign content (PI-6 bypass) | Tampering | Call-site `ownedNames.has(basename(pair.to))` check; helper called ONLY for confirmed owned names; foreign content triggers the existing "non-previous content" rejection. |
| Concurrent process races the rollback (target removed between catch and reverse-rename) | Tampering / Repudiation | Rollback loop is ENOENT-tolerant: `try { rename(to, from) } catch { leaks.push(...) }`. Concurrent racing produces a leak message, not silent corruption. |
| Symlink-pointing target tricks `removeOrphanIfPresent` into deleting outside scope | Tampering | `node:fs/promises::stat` follows symlinks. If a malicious symlink at `pair.to` points OUTSIDE the scope, `stat` reports the target's kind. `rm({recursive:true,force:true})` would follow the symlink and delete the destination. BUT containment is enforced upstream via `assertPathInside` (PS-1 refuses symlinks) -- the helper is called only on already-validated paths. Document this dependency in helper JSDoc. |

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/bridges/skills/stage.ts` (398 lines,
  READ in full) -- the reference implementation: `commitPreparedSkills` post-01028ea
  inline stat+rm at lines 230-250 (the donor pattern for `removeOrphanIfPresent`);
  `replacePreparedSkills` at lines 277-334 (TR-06 site; existing `pathExists` throw at
  line 308); the WeakMap internals pattern (TR-06 must not perturb).
- Project source: `extensions/pi-claude-marketplace/bridges/agents/stage.ts` (568
  lines, READ in full) -- TR-01 fix site at lines 340-349 (`Promise.all` rename loop);
  `replacePreparedAgents` at lines 390-471 (TR-06 site; `pathExists` throw at line 433);
  step-1 parallel rm at lines 321-332 (stays parallel, ENOENT-tolerant); the agents
  bridge's reference shape for `rollbackReplacementCommon` integration at lines 516-537.
- Project source: `extensions/pi-claude-marketplace/bridges/commands/stage.ts` (366
  lines, READ in full) -- TR-05 fix site at lines 219-221 (sequential loop without
  rollback); `replacePreparedCommands` at lines 245-302 (TR-06 site; `pathExists` throw
  at line 276); step-1 sequential unlink at lines 202-213 (stays sequential,
  ENOENT-tolerant).
- Project source: `extensions/pi-claude-marketplace/shared/fs-utils.ts` (178 lines,
  READ in full) -- the reference shape `rollbackReplacementCommon` at lines 135-177
  (spread-before-reverse, leaks accumulation, never-throws-from-rollback discipline);
  `pathExists`, `cleanupStaging` already exported.
- Project source: `extensions/pi-claude-marketplace/shared/errors.ts` lines 105-131
  -- `appendLeakToError` (single-leak wrapping with `Error.cause` chain),
  `appendLeaks` (multi-leak sequential chain), `ManualRecoveryError` at lines 304-311.
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  lines 460-600 -- install's bridge consumer phases; verified `c.stagedSkillNames` /
  `c.stagedCommandNames` set BEFORE commit call (lines 475, 508) but
  `c.stagedAgentNames` set AFTER commit (line 550) -- significant for Pitfall 6
  Phase 37 ledger contract integration.
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  lines 960-1032 -- the only direct production caller of `replacePrepared*`; verifies
  ownership signal flow: `oldRecord.resources.skills` -> `previousSkillNames` ->
  `prepared._previousNames`; the TR-06 call-site policy reads from `_previousNames`,
  closing the loop.
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
  lines 867-923 -- `runThreePhaseUpdate` calls `commitPrepared*`, NOT
  `replacePrepared*` -- confirms PUP-6 path is unaffected by TR-06 (Pitfall 3, A3).
- Project source: `extensions/pi-claude-marketplace/persistence/state-io.ts` lines
  40-55 -- state.json schema: `resources.{skills,prompts,agents,mcpServers}: string[]`
  -- these are the names the TR-06 ownership check reads via `_previousNames` proxy.
- Project source: `extensions/pi-claude-marketplace/shared/notify.ts` lines 1330-1410
  -- the rendering boundary that consumes leak text from `Error.cause` chains and
  `ManualRecoveryError.leaks` (depth-5 walker at line 1362-1378) -- confirms commit-
  path `appendLeaks`-style chaining is preserved by the renderer.
- Tests: `tests/bridges/skills/stage.test.ts:309-421` (existing TR-06 reference tests
  for replace+rollback+rejection); `tests/bridges/agents/stage.test.ts:792-1098`
  (existing replacement-internal-failure + foreign-content tests; the test at
  :1064-1097 is the agents-bridge equivalent of the PI-6 rejection test);
  `tests/bridges/commands/stage.test.ts:358-384` (commands equivalent).
- Tests: `tests/orchestrators/plugin/update.test.ts:744-813` (PUP-6 phase-3 failure
  test, file obstacle pattern, CR-01 `notifications.length === 1` assertion).
- Commit history: `git show 01028ea` -- the commit that hardened
  `commitPreparedSkills` against ENOTEMPTY; verified the change is ONLY the orphan
  pre-rm (no completedRenames tracking). Phase 38 adds the rollback layer that
  01028ea did NOT include.
- `.planning/research/SUMMARY.md` lines 165-178 (Phase 2 rationale: group TR-01,
  TR-05, TR-06 in one phase because they share the shape and TR-06 interacts with
  the renamed-pair tracking).
- `.planning/research/PITFALLS.md` lines 71-143 (Pitfall 1: sequential rename loop
  bugs); lines 369-454 (Pitfall 5: PI-6 collision guard bypassed by orphan removal);
  lines 597-633 (Pitfall 11: PUP-6 test trigger removal masks regression); lines
  519-543 (Pitfall 8: aggregating leaks via wrong error type).
- `.planning/research/ARCHITECTURE.md` lines 132-159 (Q2 rollback surface),
  lines 207-231 (Q5 replacePrepared* orphan blocking), lines 233-249 (build order
  with TR-01/TR-05/TR-06 grouped in Wave 1).
- `.planning/research/FEATURES.md` lines 22-46 (Category 1 sequential commit loops),
  lines 95-111 (Category 4 TOCTOU-safe orphan target cleanup).
- `.planning/REQUIREMENTS.md` lines 25-45 (TR-01, TR-05, TR-06 definitions).
- `.planning/phases/38-sequential-commit-loops-orphan-tolerance/38-CONTEXT.md`
  (62 lines, READ in full) -- locked decisions and SC#1-6.
- `.planning/phases/37-phase-ledger-undo-gap/37-RESEARCH.md` (verified Phase 37
  shape; ledger contract for Pitfall 6 integration).
- `.planning/STATE.md` (Phase 37 complete; Phase 38 next).
- `.planning/ROADMAP.md` lines 794-827 (Phase 38 definition).
- `.planning/config.json` -- `workflow.nyquist_validation: true` (Validation Architecture
  section required); `workflow.skip_discuss: true` (CONTEXT auto-generated); `mode:
  yolo`; `granularity: standard`.

### Secondary (MEDIUM confidence -- ecosystem signal, not load-bearing)

- Microsoft Azure Compensating Transaction Pattern -- "started → eligible for
  compensation" maps to TR-01/TR-05 reverse-walk shape (cited transitively via
  `.planning/research/PITFALLS.md` Pitfall 1).
- POSIX rename(2) semantics for ENOTDIR (file at dir target) and ENOTEMPTY (non-empty
  dir at dir target) -- confirms the kind-strict helper design protects PUP-6.

### Tertiary (LOW confidence)

None -- all load-bearing claims sourced from project files read in full.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- no new packages; existing imports verified by reading three
  bridge stage.ts files in full.
- Architecture: HIGH -- all five fix sites verified by line-level source reads;
  current shape vs. post-fix shape diff is mechanical and small.
- Pitfalls: HIGH -- direct authority from `.planning/research/PITFALLS.md` Pitfall 1
  (sequential rename), Pitfall 5 (PI-6 bypass), Pitfall 8 (wrong error type),
  Pitfall 11 (PUP-6 trigger).
- Tests: HIGH -- existing tests at `stage.test.ts:309/388`, `update.test.ts:744`
  were read in full and their failure-injection mechanisms identified.

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days -- stable in-place hardening; nothing external
can drift the contract since no new dependencies)

## RESEARCH COMPLETE

The recommended fix structure:

1. **One plan, four tasks.** Task 1: export `removeOrphanIfPresent(target, mode)` from
   `shared/fs-utils.ts` + 5 unit tests in `tests/shared/fs-utils.test.ts`. Task 2:
   rewrite `commitPreparedAgents` step-2 (Promise.all -> sequential + `completedRenames[]`
   + reverse-walk + `appendLeaks`) and `commitPreparedCommands` step-2 (same shape) +
   2 regression tests each. Task 3: replace the `pathExists`-throw in
   `replacePreparedSkills`, `replacePreparedCommands`, `replacePreparedAgents` with the
   `ownedNames.has(basename) ? helper(...) : (pathExists ? throw : continue)` policy +
   1 orphan-tolerance test per bridge. Task 4: confirm PUP-6 (`update.test.ts:744`)
   and PI-6 (`stage.test.ts:388` + commands :378 + agents :1064) tests stay GREEN
   verbatim; run `npm run check` full-suite gate.
2. **Single-plan justification:** All six SC items share one helper (TR-06), two
   identically-shaped bridge rewrites (TR-01, TR-05), and one regression boundary
   (PUP-6 + PI-6 tests). Splitting per-bridge creates artificial waves with no
   parallelism win because the same `npm run check` gates each. The Wave 1 sub-tasks
   are inherently independent (no inter-bridge dependencies) so the task-level
   parallelism is preserved within the single plan.
3. **Key safety controls:** kind-strict helper (mode "tree" only rms directories);
   call-site ownership pre-check via `_previousNames` membership (preserves PI-6);
   `appendLeaks` not `ManualRecoveryError` for commit-path leaks; rollback loop NEVER
   throws.
