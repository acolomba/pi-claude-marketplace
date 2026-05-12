# Phase 4: Marketplace Orchestrators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 4-marketplace-orchestrators
**Areas discussed:** Orchestrator layout + cascade composition, Phase 4 ↔ Phase 5 cascade hand-off, Clone-then-rename staging location, Network seam + offline tests

______________________________________________________________________

## Orchestrator Layout + Cascade Composition

### Q1: File layout under `orchestrators/marketplace/`

| Option | Description | Selected |
|--------|-------------|----------|
| 5 files + shared.ts | `add.ts`, `remove.ts`, `list.ts`, `update.ts`, `autoupdate.ts` plus `shared.ts` for cross-command helpers | ✓ |
| 5 files, no shared helper | Same 5 files, no shared.ts; small helpers duplicated | |
| Fewer, denser files | Group: `lifecycle.ts` (add/remove), `refresh.ts` (list/update), `autoupdate.ts` | |
| You decide | Claude picks based on Phase 3 precedent | |

**User's choice:** 5 files + shared.ts (Recommended)
**Notes:** Mirrors planned README skeleton; 1:1 file→PRD-section mapping enables grep-able test localization.

### Q2: `marketplace remove` cascade composition

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled try/catch loop | Plain `for...of` with per-plugin envelope; helper in `shared.ts` as `cascadeUnstagePlugin` | ✓ |
| runPhases per plugin | Each plugin's 4-bridge unstage runs as its own ledger | |
| Single big ledger with all (plugin×bridge) phases | One mega-ledger | |
| You decide | Claude picks based on MR-3 semantics | |

**User's choice:** Hand-rolled try/catch loop (Recommended)
**Notes:** `runPhases` halts and rolls back on first throw; MR-3 explicitly says cascade continues across per-plugin failures. Wrong shape for the requirement.

### Q3: Per-plugin bridge-failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast per plugin | First bridge throw halts that plugin's cascade; plugin lands in `failedPlugins[]` with chained cause | ✓ |
| Continue across bridges | Try all 4 bridges per plugin; collect per-bridge failures separately | |
| You decide | Claude picks the model matching MR-3 + MR-4 | |

**User's choice:** Fail-fast per plugin (Recommended)
**Notes:** Flat `failedPlugins[]` shape matches MR-4's single-aggregated-warning format; one cause per failed plugin keeps the audit story simple.

### Q4: `withStateGuard` boundary

| Option | Description | Selected |
|--------|-------------|----------|
| One guard per orchestrator | Each mutating subcommand wraps entire flow (including network IO) in one `withStateGuard` | ✓ |
| Guard only around state mutation | Network IO outside guard; guard wraps in-memory mutate + save | |
| You decide | Claude picks based on Phase 2 D-02 + TOCTOU window | |

**User's choice:** One guard per orchestrator (Recommended)
**Notes:** Eliminates TOCTOU window where MA-6 stale-clone check passes at plan but the directory exists at commit. Concurrent-add/remove detection lands at the save boundary naturally.

______________________________________________________________________

## Phase 4 ↔ Phase 5 Cascade Hand-off

### Q1: How `marketplace update --autoupdate` reaches the Phase 5 plugin-update primitive

| Option | Description | Selected |
|--------|-------------|----------|
| Function-injection seam | Phase 4 defines `PluginUpdateFn`; `marketplace/update.ts` accepts it as parameter; Phase 7 injects | ✓ |
| Stub that throws until Phase 5 | `cascadeUpgrade(plugin)` throws "Phase 5 not yet wired" until Phase 5 lands | |
| Defer all autoupdate work to Phase 5 | Phase 4 ships manifest-refresh-only; MU-6/MU-7 cascade deferred | |
| You decide | Claude picks based on testability + zero-cycle constraint | |

**User's choice:** Function-injection seam (Recommended)
**Notes:** No import cycle, testable in isolation, Phase 4 ships `marketplace update` end-to-end working (manual + autoupdate paths via mock injection).

### Q2: Type location for `PluginUpdateFn` + `PluginUpdateOutcome`

| Option | Description | Selected |
|--------|-------------|----------|
| `orchestrators/types.ts` | New cross-orchestrator types file at `orchestrators/` root; no cycle | ✓ |
| `shared/types.ts` | Co-locate with `Scope` and SCOPES; mild layering smell | |
| `orchestrators/marketplace/types.ts` | Local to Phase 4; Phase 5 imports sibling; coupling marketplace to plugin contract feels backward | |
| You decide | Claude picks based on import boundaries | |

**User's choice:** `orchestrators/types.ts` (Recommended)
**Notes:** Mirrors Phase 3 D-01 escalation note about future `BridgeOps<Prep, Target>` belonging at this same path.

### Q3: Cascade plugin enumeration

| Option | Description | Selected |
|--------|-------------|----------|
| Read from state.json post-refresh | Read `state.marketplaces[mp].plugins` keys; MU-8 satisfied by construction | ✓ |
| Iterate refreshed manifest, filter by state | Walk refreshed manifest; check which are installed; equivalent outcome | |
| You decide | Claude picks based on MU-7/MU-8 spirit | |

**User's choice:** Read from state.json post-refresh (Recommended)
**Notes:** Avoids manifest read; ML-3 spirit says "don't load manifest when state has the answer."

### Q4: Cascade vs marketplace state-guard scope

| Option | Description | Selected |
|--------|-------------|----------|
| Outside | Marketplace guard wraps refresh + persist + autoupdate readback ONLY; cascade runs outside; each `PluginUpdateFn` opens its own guard | ✓ |
| Inside (nested guards) | Single outer guard wraps refresh + cascade; nested-guard semantics undefined | |
| You decide | Claude picks based on MU-4 literal ordering | |

**User's choice:** Outside (Recommended)
**Notes:** Honors MU-4 literal "persisted before any plugin cascade runs"; avoids nested-state-guard semantics undefined in Phase 2 D-02.

______________________________________________________________________

## Clone-then-Rename Staging Location

### Q1: Staging root location

| Option | Description | Selected |
|--------|-------------|----------|
| `<scopeRoot>/pi-claude-marketplace/sources-staging/<uuid>/` | Sibling of final `sources/`; same-FS by construction; scope-local lifecycle | ✓ |
| `<extensionRoot>/sources-staging/<uuid>/` (V1 layout) | Centralized under extension root; EXDEV risk | |
| `os.tmpdir()/pi-claude-marketplace/<uuid>/` | Cross-mount risk almost guaranteed (tmpfs on Linux) | |
| You decide | Claude picks based on AS-1 same-FS guarantee | |

**User's choice:** `<scopeRoot>/pi-claude-marketplace/sources-staging/<uuid>/` (Recommended)
**Notes:** Same FS by construction; scope-local leaks don't pollute the other scope; new helper `sourcesStagingDir(loc, uuid)` added to `persistence/locations.ts`.

### Q2: MA-9 cleanup implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `shared/fs-utils.cleanupStaging` | Already exists from Phase 3; pair with `appendLeakToError` | ✓ |
| Hand-rolled try/catch + appendLeaks | Inline `fs.rm` + leak collection | |
| You decide | Claude picks based on Phase 3 precedent | |

**User's choice:** Reuse `shared/fs-utils.cleanupStaging` (Recommended)
**Notes:** One consistent surface across Phase 3 bridges and Phase 4 orchestrators.

### Q3: MA-6 stale-clone check timing

| Option | Description | Selected |
|--------|-------------|----------|
| Check final `sources/<name>/` BEFORE clone | Pre-clone existence + non-empty check; single check at flow start | ✓ |
| Check at atomic-rename time | Clone proceeds first; check just before `fs.rename` | |
| You decide | Claude picks based on MA-6 literal text | |

**User's choice:** Check final `sources/<name>/` BEFORE clone (Recommended)
**Notes:** No race window; user-visible failure surfaces before any network IO is wasted.

______________________________________________________________________

## Network Seam + Offline Test Surface

### Q1: Testing seam shape

| Option | Description | Selected |
|--------|-------------|----------|
| Function-injection via shared.ts `GitOps` | Interface in `shared.ts`; orchestrators accept `gitOps?: GitOps`; defaults to `platform/git.ts` re-export | ✓ |
| Module-level monkey-patch | Tests reassign properties on `import * as git from 'platform/git'`; brittle with ESM frozen exports | |
| Top-level adapter at `marketplace/source-ops.ts` | Dedicated file wraps git+manifest-read; tests stub whole adapter | |
| You decide | Claude picks based on testability + ESM compatibility | |

**User's choice:** Function-injection via shared.ts `GitOps` (Recommended)
**Notes:** Mirrors `PluginUpdateFn` injection pattern for consistency; single import boundary.

### Q2: `GitOps` interface surface

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: clone + fetch + pull + resolveRef | Just what MA-5 + MU-2 + MU-3 need | (initially selected, then evolved -- see Q3/Q4) |
| Full `platform/git.ts` re-export | Mirror entire surface even if unused | |
| You decide | Claude picks minimal verifiable surface | |

**User's choice (initial):** Minimal: clone + fetch + pull + resolveRef
**Notes:** Evolved during Q3 when the user surfaced the "follow upstream blindly" semantic; `pull` was dropped from the surface entirely (see Q4 below).

### Q3: MU-3 non-fast-forward detection (RECONSIDERED -- user surfaced new framing)

| Option | Description | Selected |
|--------|-------------|----------|
| Catch & inspect Error class/message | `instanceof git.Errors.MergeNotSupportedError` introspection | (none -- user redirected) |
| Pre-check via `resolveRef` | Compare local HEAD to remote HEAD before pull | (none -- user redirected) |
| You decide | Claude picks based on isomorphic-git error types | (none -- user redirected) |

**User's response (free-text):** *"why would there be a divergence? the local copy of the marketplace is never altered"*

**Notes:** User identified that the local marketplace clone is read-only by contract. No commits, no pushes, no working-tree edits. Any "divergence" is exclusively upstream-driven (force-push, tag move, history rewrite). The PRD MU-3 recovery model ("remove + re-add") is overkill -- following upstream blindly is simpler and better UX. Question reformulated into Q4.

### Q4: Update-failure handling (REFORMULATED after Q3)

| Option | Description | Selected |
|--------|-------------|----------|
| Any failure → MU-3 hint | Wrap pull/checkout; ANY error → `MarketplaceUpdateError` with canonical message; no error-class introspection | (initial recommendation) |
| Distinguish upstream-changed vs network/disk | Introspect isomorphic-git error types to differentiate; same user-visible resolution | |
| You decide | Claude picks based on read-only-local invariant | |

**User's response (free-text):** *"i can't really think of errors in pulling. even if a ref. is changed upstream, what we need to do is follow it no matter what, just as if deleted the marketplace and reinstalled"*

**Notes:** User pushed the model further: don't even treat upstream ref changes as failures. Just follow upstream HEAD or the new ref-target, no matter what changed. This is a deliberate user-contract change overriding PRD MU-2 and MU-3 literal text -- the Phase 4 D-14 decision in CONTEXT.md.

### Q5: `GitOps` surface, post-D-14

| Option | Description | Selected |
|--------|-------------|----------|
| `clone` + `fetch` + `checkout` + `resolveRef` | Drop `pull` entirely; rely on `fetch` + `checkout` to track upstream | |
| `clone` + `fetch` + `checkout` + `resolveRef` + force-update-local-ref | Same primitives plus explicit `forceUpdateRef` to update local branch before checkout | ✓ |
| You decide | Claude picks minimal verb set + locks user-contract change | |

**User's choice:** `clone` + `fetch` + `checkout` + `resolveRef` + force-update-local-ref
**Notes:** The explicit `forceUpdateRef` op makes the symbolic-HEAD update path unambiguous (set local branch to remote SHA, then checkout) without relying on isomorphic-git's implicit checkout behavior. Locked as D-13 in CONTEXT.md.

______________________________________________________________________

## Claude's Discretion

The user signed off on recommended options for all standard implementation choices (D-01 through D-13 in CONTEXT.md). The user explicitly directed:

- The "follow upstream blindly" semantic (D-14) -- not a Claude call. This overrides PRD MU-2 and MU-3 literal text and is recorded as a deliberate user-contract change parallel to Phase 1 D-21 (MA-7 supersession).
- The marginally heavier `GitOps` surface with explicit `forceUpdateRef` (D-13) over the smaller alternative.

All recommendation rationales are captured inline in CONTEXT.md `<decisions>` under each D-XX.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`. Highlights:

- `marketplace info <name>` (PRD §11 deferral)
- JSON output / dry-run modes (PRD §11 deferral; orchestrator return shapes are JSON-serializable already)
- MR-1 disambiguation interactive prompt (PRD §11 rich-interactive deferral)
- `--force` overwrite for stale source clone (post-V1 UX)
- Parallel marketplace refresh in bare-form `marketplace update` (perf concern; sequential in V1)
- Telemetry for cascade failure rates (IL-4 forbids V1; structured `failedPlugins[]` shape is event-channel-ready)
- MU-2/MU-3 retention in PRD §5.1.4 (D-14 supersedes in `.planning/` artifacts; PRD v2 rewrite is post-V1)
