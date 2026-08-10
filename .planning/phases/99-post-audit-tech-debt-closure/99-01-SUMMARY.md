---
phase: 99-post-audit-tech-debt-closure
plan: 01
subsystem: orchestrators
tags: [typescript, refactor, naming, outcome-types, degradation-signals]

requires:
  - phase: 98-lifecycle-regression-and-contract-documentation
    provides: LedgerDegradationSignals boolean shape in orchestrators/plugin/shared.ts
provides:
  - "ReinstallReinstalledOutcome.stagedAgentNames / .stagedMcpServerNames (renamed from stagedAgents / stagedMcpServers)"
  - "PluginUpdateUpdatedOutcome.stagedAgentNames / .stagedMcpServerNames (renamed from stagedAgents / stagedMcpServers)"
  - "The stagedAgents / stagedMcpServers spellings are now free for LedgerDegradationSignals' boolean members on both outcome interfaces"
affects: [99-04 WR-12 update-verb degradation signals, any future outcome extending LedgerDegradationSignals]

actuals:
  tokens: 9500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Name-list vs presence-flag disambiguation: `<subject>Names` for readonly string[] generated names, bare `<subject>` for the boolean count verdict"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Chose stagedAgentNames / stagedMcpServerNames over any novel spelling because enable-disable.ts:304-305 and install.ts:400-401 already carry ledger-context fields under exactly those names — the rename adopts in-tree precedent rather than minting a convention."
  - "tests/orchestrators/reconcile/notify.test.ts was listed in the plan's Task 1 file set but needed NO edit: its three occurrences are `stagedAgents: true` boolean signals on PerEntryOutcome, not the reinstall outcome's arrays."
  - "Reworded the two new doc comments so they name `LedgerDegradationSignals` as a shape without repeating its member spellings — otherwise the plan's residual-name grep gate would flag my own explanatory prose."

patterns-established:
  - "A readonly string[] member and an optional boolean member that share a spelling make the two interfaces structurally incompatible (TS2430), so `extends` is unavailable until one side is renamed."

requirements-completed: [D-99-02c]

coverage:
  - id: D1
    description: "ReinstallReinstalledOutcome carries the staged generated-name arrays under stagedAgentNames / stagedMcpServerNames"
    requirement: "D-99-02c"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#reinstall populates staged agent + mcp names (deep-equal assertions, lines 343-344)"
        status: pass
      - kind: other
        ref: "npm run typecheck (tsc --noEmit) — exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "PluginUpdateUpdatedOutcome carries the same renamed arrays; its producer's local consts move with the keys so the shorthand spread stays shorthand"
    requirement: "D-99-02c"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-04: successful update populates stagedAgentNames + stagedMcpServerNames on outcome"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts (22 cascade fixture occurrences)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No rendered byte and no persisted key moved; the milestone no-expansion contract stays green"
    verification:
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts — 14/14 pass, file unchanged"
        status: pass
      - kind: other
        ref: "git diff review: every hunk is a key rename, an identifier rename, or a comment — no right-hand side altered"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-10
status: complete
---

# Phase 99 Plan 01: Staged-name array rename Summary

**Both outcome interfaces' `readonly string[]` staged-name pairs renamed to `stagedAgentNames` / `stagedMcpServerNames`, freeing the bare spellings for `LedgerDegradationSignals`' boolean presence flags and lifting the TS2430 block on plan 99-04.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-10T07:20Z
- **Completed:** 2026-08-10T07:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Renamed the field pair on **both** sites the research found, not just the one D-99-02c names: `ReinstallReinstalledOutcome` (`types.ts:26-27`) and `PluginUpdateUpdatedOutcome` (`types.ts:148-149`). Renaming only reinstall would have left plan 99-04 blocked, since `PluginUpdateUpdatedOutcome extends LedgerDegradationSignals` is a `TS2430` incompatible-property error while a `readonly string[]` member collides with an optional `boolean` one.
- Moved both producers with their keys: `reinstall.ts:1759-1760` (values `resources.agents` / `resources.mcpServers` unchanged) and `update.ts:1898-1899` + `:1940-1943`, where the local consts were renamed too so the shorthand spread stays shorthand and the `declaresAgents` / `declaresMcp` derivations keep reading `<renamed>.length > 0`.
- Re-narrated the three doc sites (`types.ts` reinstall block, `types.ts:140` update block, `update.ts:30` header) to state WHY the names differ: the arrays are generated names, the `shared.ts` members are presence flags carrying a count verdict only.
- Confirmed the freed spellings: the residual grep over `types.ts`, `reinstall.ts` and `update.ts` returns no match.

**Exact new field names:** `stagedAgentNames`, `stagedMcpServerNames` — on both `ReinstallReinstalledOutcome` and `PluginUpdateUpdatedOutcome`.

**Test occurrences moved, per suite:**

| Suite | Occurrences renamed | Old-name occurrences remaining | Why |
|---|---|---|---|
| `tests/orchestrators/plugin/reinstall.test.ts` | 8 | 0 | reinstall-outcome fixtures + the two deep-equal assertions |
| `tests/orchestrators/marketplace/update.test.ts` | 22 | 0 | update-outcome cascade fixtures |
| `tests/orchestrators/plugin/update.test.ts` | 7 | 0 | WR-04 assertions, its section banner and test title |
| `tests/orchestrators/reconcile/notify.test.ts` | 0 | 3 | **Correct** — those are `stagedAgents: true` BOOLEAN signals on `PerEntryOutcome`, not the renamed arrays |

**`install.ts`'s `Omit` was left in place, untouched.** `install.ts:258`'s `Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">` and its doc comment at `:239` record a deliberate exclusion — `installPlugin` never advertises those two signals — not a collision workaround. The plan prohibited touching it and it does not appear in either commit's diff.

## Task Commits

1. **Task 1: Rename the reinstall outcome's staged-name arrays** - `408e7fda` (refactor)
2. **Task 2: Rename the update outcome's staged-name arrays and prove the collision is gone** - `d9659f68` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/types.ts` - both outcome interfaces renamed, three doc blocks re-narrated
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - producer keys renamed, values byte-identical
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - producer keys, local consts and header comment renamed
- `tests/orchestrators/plugin/reinstall.test.ts` - 8 occurrences
- `tests/orchestrators/plugin/update.test.ts` - 7 occurrences (+ prettier re-wrap)
- `tests/orchestrators/marketplace/update.test.ts` - 22 cascade fixture occurrences

## Decisions Made

- **Name choice settled by precedent, not taste.** `enable-disable.ts:304-305` and `install.ts:400-401` already carry ledger-context fields spelled `stagedAgentNames` / `stagedMcpServerNames`, so adopting them makes the name-vs-flag distinction self-documenting instead of novel.
- **`notify.test.ts` deliberately left alone.** Classifying each occurrence before editing (rather than renaming blind) showed its three hits are boolean `PerEntryOutcome` signals. Renaming them would have been a regression; typecheck would have caught it, but the classification avoided the round-trip.
- **Doc comments reworded to survive the plan's own gate.** My first draft of the new doc blocks spelled `LedgerDegradationSignals.stagedAgents` / `.stagedMcpServers` to explain the distinction, which made the residual-name grep return two matches — against explanatory prose, not live code. Rather than weaken the gate, I reworded to name the shape without repeating its member spellings. The gate keeps its literal form and the comments keep their meaning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier re-wrap in `tests/orchestrators/plugin/update.test.ts`**
- **Found during:** Task 2
- **Issue:** The longer field names pushed several assertion lines past the 100-column `printWidth`, so `npm run format:check` exited 1 and the pre-commit `prettier` hook would have failed the commit.
- **Fix:** Ran `npx prettier --write` on that one file (formatting only — 9 insertions / 6 deletions, all re-wrapping).
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`
- **Verification:** `npm run format:check` exit 0; suite re-run 83/83 pass.
- **Committed in:** `d9659f68` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Formatting only, mechanically forced by the rename. No scope creep — the plan's file set is unchanged.

## Issues Encountered

- **Worktree trufflehog hook fails structurally**, as CLAUDE.md documents: in a linked worktree `.git` is a file, so the git-mode scan cannot read the index. Followed the sanctioned route — a `trufflehog filesystem` scan over exactly the paths being committed, `--results=verified,unknown --fail`, exit 0 with 0 verified and 0 unverified secrets on both commits — then committed with `SKIP=trufflehog` only. Every other hook passed.

## Test Results

| Gate | Result |
|---|---|
| `npm run typecheck` (after each task) | exit 0 |
| `tests/orchestrators/plugin/reinstall.test.ts` + `reconcile/notify.test.ts` | exit 0 — 126/126 pass |
| `tests/orchestrators/plugin/update.test.ts` + `marketplace/update.test.ts` | exit 0 — 136/136 pass |
| `tests/architecture/compat-01-no-expansion.test.ts` | exit 0 — 14/14 pass, file unchanged |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 (after the auto-fix above) |
| Residual-name grep over the three renamed source files | no match (required) |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 99-04 is unblocked.** `PluginUpdateUpdatedOutcome extends LedgerDegradationSignals` no longer collides; the boolean members can be inherited rather than worked around with `Omit` / `Pick`.
- **Carrier note for 99-04:** when the update outcome starts extending the signal shape, the inherited `stagedAgents` / `stagedMcpServers` booleans will need populating at `update.ts:1940` alongside the existing `declaresAgents` / `declaresMcp` derivations, which already compute the same predicate from the renamed arrays.
- No blockers. No stubs, no skipped tests, no unrun verifications.

## Self-Check: PASSED

- Commits `408e7fda`, `d9659f68` present in `git log`.
- `99-01-SUMMARY.md` exists on disk.
- `stagedAgentNames` present 4× in `orchestrators/types.ts` (2 interfaces × 2 members).

---
*Phase: 99-post-audit-tech-debt-closure*
*Completed: 2026-08-10*
