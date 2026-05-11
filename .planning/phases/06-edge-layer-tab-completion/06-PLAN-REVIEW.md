# Phase 6 Plan Review

**Reviewer:** gsd-plan-checker (adversarial pre-execution review)
**Date:** 2026-05-11
**Plans reviewed:** 06-01 .. 06-05 + 06-PLANS-INDEX.md
**Decision sources:** 06-CONTEXT.md (D-01..D-04), 06-RESEARCH.md, 06-PATTERNS.md, 06-VALIDATION.md, ROADMAP.md lines 143-152, REQUIREMENTS.md lines 200-217, CLAUDE.md NFRs/IL constraints.

## Overall Verdict

**PASS WITH CONCERNS**

The plan set covers every Phase 6 success criterion and every owned REQ-ID (AP-1..4, TC-1..9). Locked decisions D-01..D-04 are each implemented across explicit plans with cross-references in `requirements:` frontmatter. Wave structure is acyclic (06-01 -> 06-02 -> {06-03 || 06-04} -> 06-05), depends_on declarations are consistent with the index. Atomic shippability is preserved (each plan's verify command exits 0 after merge).

Concerns (none blocking, all tracked below): (1) Open Questions in RESEARCH.md are not marked RESOLVED -- the planner adopted V1-parity defaults in each plan, satisfying the spirit of Dimension 11 but failing the section-heading check. (2) Plan 06-05 Task 3 partially duplicates an existing ESLint rule. (3) Plan 06-04's tool execute body strategy may force orchestrator-side additions whose API surface is not yet defined.

## Dimension Findings

### Dimension 1: Goal Coverage (PASS)

All 5 ROADMAP success criteria map to at least one task with an automated verify:

| ROADMAP SC | Slice | Plan(s) | Verify |
|------------|-------|---------|--------|
| SC1 | Tab completion at every position; `rm` accepted-not-surfaced | 06-02 (router rm alias), 06-03 (provider TC-1..TC-6 dispatcher) | `node --test tests/edge/router.test.ts tests/edge/completions/provider.test.ts` |
| SC2 | `<plugin>@<marketplace>`; bare `@<marketplace>`; soft-fail per-marketplace; state.json propagates | 06-03 (cache TC-8/TC-9 + provider branch 4) | `node --test tests/shared/completion-cache.test.ts tests/edge/completions/provider.test.ts` |
| SC3 | Tokenization + `--scope` validation + Usage at `error` severity | 06-02 (args.ts, args-schema.ts, router.ts) | `node --test tests/edge/args.test.ts tests/edge/args-schema.test.ts tests/edge/router.test.ts` |
| SC4 | Trailing space + fish-style normalization scoped to `/claude:plugin` | 06-02 (normalize.ts), 06-05 (session_start install) | `node --test tests/edge/completions/normalize.test.ts tests/edge/register.test.ts` |
| SC5 | Every user-visible message via `ctx.ui.notify`; ESLint blocks `process.stdout`/`stderr` in `edge/` | 06-02 (notify-discipline grep gate), 06-04 (handlers gate), 06-05 (eslint.config.js edit) | Per-task grep gates + `npx eslint extensions/claude-marketplace/edge/**/*.ts` |

### Dimension 2: REQ-ID Coverage (PASS)

All 13 owned REQ-IDs mapped (the index audit table at 06-PLANS-INDEX.md lines 117-131 matches the 06-VALIDATION.md verification map at lines 41-57). Plans' `requirements:` frontmatter explicitly lists the slice covered:

- Plan 06-01: AP-1, AP-2, AP-3, AP-4, TC-1..TC-9 (stubs for all 13).
- Plan 06-02: AP-1, AP-2, AP-3, AP-4, TC-2 (router slice), TC-7. (5 implementations)
- Plan 06-03: TC-1, TC-3, TC-4, TC-5, TC-6, TC-8, TC-9. (7 implementations)
- Plan 06-04: AP-2, AP-3, AP-4 (re-use of parser at handler entry; D-02 anchor).
- Plan 06-05: TC-5, TC-6, TC-7 (end-to-end wiring via register.ts).

Union covers every REQ-ID with an `<automated>` verify command. No silent drops.

### Dimension 3: Decision Adherence (PASS)

- **D-01 (handler 1:1; router stays in router.ts; pure functions):** 06-04 ships exactly 9 thin-shim handler files under `edge/handlers/{plugin,marketplace}/` matching orchestrator names; 06-02 places `router.ts` separate from `register.ts`. PASS.
- **D-02 (exactly 2 read-only LLM tools registered in `edge/handlers/tools.ts`; called from `edge/register.ts`):** 06-04 Task 2 implements `registerListMarketplacesTool` + `registerListPluginsTool`; 06-05 Task 2 calls them from `registerClaudeMarketplaceTools(pi)`. PL-1 union semantics explicitly listed in tools.test.ts cases. PASS.
- **D-03 (two-tier cache; status-aware; install includes `unavailable`; 5 mutating orchestrators; plugin update no-op; cache optimization-only):** 06-03 Task 1 implements two-tier cache with `_loadError` poisoned-entry semantics; Task 2 D-03 status filter explicitly keeps `status !== "installed"` for install (i.e. includes available + unavailable); 06-05 Task 1 inserts invalidation in exactly 5 orchestrators with `plugin/update.ts` deliberately excluded (06-PLANS-INDEX.md line 95). PASS.
- **D-04 (Phase 6 ships `registerClaudePluginCommand` + `registerClaudeMarketplaceTools`; Phase 7 calls them; `EdgeDeps` in `edge/types.ts`):** 06-02 Task 2 creates `edge/types.ts` with `EdgeDeps`; 06-05 Task 2 implements both registration helpers. PASS.

### Dimension 4: Dependency Correctness (PASS)

depends_on graph parses cleanly:

| Plan | depends_on | Wave | Files overlap with peers? |
|------|------------|------|----------------------------|
| 06-01 | `[]` | 0 | n/a |
| 06-02 | `[06-01]` | 1 | n/a (single plan) |
| 06-03 | `[06-02]` | 2 | Verified no overlap with 06-04 |
| 06-04 | `[06-02]` | 2 | Verified no overlap with 06-03 |
| 06-05 | `[06-03, 06-04]` | 3 | n/a |

**Wave 2 parallel-safety:** Plan 06-03 modifies `shared/completion-cache.ts` + `edge/completions/{provider,data}.ts` + 3 test files. Plan 06-04 modifies `edge/handlers/**` + tools.ts + 10 test files. Zero `files_modified` intersection -- verified by frontmatter comparison. PASS.

No cycles, no forward references, wave numbers consistent.

### Dimension 5: NFR / Project-Invariant Adherence (PASS WITH ONE WARNING)

- **NFR-1 (atomic writes):** Plan 06-03 frontmatter `key_links` explicitly maps `shared/completion-cache.ts` -> `shared/atomic-json.atomicWriteJson`. Plan 06-03 Task 1 action invokes `atomicWriteJson` on every cache write (lines 291-297 of plan). PASS.
- **NFR-5 (no-network on local ops):** All Plan 06-03 work uses `node:fs/promises` + injected closures; no `fetch`/`https`/`isomorphic-git` import permitted by BLOCK C (shared/ is leaf). PASS.
- **NFR-6 (green build):** Every task has an `<automated>` block. Verified across all 5 plans. PASS.
- **NFR-7 (strict TS):** Plan 06-03 task 1 defines a discriminated `ManifestSoftFailError` class (not a string tag) for TC-8/TC-9 separation; Plan 06-02 mandates `// @ts-expect-error` rather than `any` for stubs. No `as` casts called out in task descriptions. PASS.
- **NFR-10 (containment):** Plan 06-02 Task 3 adds `assertPathInside(cacheDir, candidate)` and `assertSafeName(marketplace)` inside `pluginCacheFile`. PASS.
- **IL-2 (single-channel notify):** Plan 06-02 Task 2 + 06-04 Task 1 + 06-05 Task 2 each include explicit grep gates for `ctx.ui.notify` in their files. The existing global ESLint rule (BLOCK A) already enforces this. PASS.
- **Threat models:** Each plan has a `<threat_model>` block referencing T-EDGE-1..9 with mitigations. PASS.

**WARNING (NFR-7 / scope reduction risk):** Plan 06-04 Task 1's action for `plugin/list.ts` proposes a hand-rolled token scan for `--installed/--available/--unavailable` flags ("OR: do all parsing manually using `parseArgs` only ... Pick the path that keeps the shim shortest"). This punts a non-trivial parser decision to the executor and risks divergent shim styles across handlers. Recommend the planner lock this to one approach pre-execution to prevent shim-pattern drift.

### Dimension 6: Atomic Shippability (PASS)

Each plan documents an unskipping flow that keeps `npm run check` green at each commit:

- 06-01 explicitly uses `// @ts-expect-error` + `test.skip()` so `npm run check` is green from the first commit.
- 06-02 unskips args/router/normalize tests as those modules land.
- 06-03 unskips cache/data/provider tests.
- 06-04 unskips handler + tools tests.
- 06-05 unskips register tests + adds D-03-INV cases to existing orchestrator tests (additive).

Verified via `must_haves.truths` line in each plan (e.g., 06-02 truth: "Skipped tests for ... are now unskipped and green").

### Dimension 7: Test Scaffolding Adequacy (PASS)

VALIDATION.md "Wave 0 Requirements" lists 10 test-file groups (some glob-collapsed). Plan 06-01 enumerates 18 individual files matching every group. Each stub uses `test.skip(name, () => {})` with `// @ts-expect-error` on the not-yet-existing import. Counts: Task 1 = 36+ stubs; Task 2 = 50+ stubs; Task 3 = 55+ stubs; total >= 141. The Wave 0 gate's quick-verify command (`node --test ... 2>&1 | grep -E "# (tests|pass|fail|skipped)"`) is correct for the node:test reporter format.

### Dimension 8: Cache-Invalidation Insertion Correctness (PASS)

Plan 06-05 Task 1 inserts invalidation calls in EXACTLY these 5 orchestrators (matching D-03):

| Orchestrator | Cache call | Failure envelope |
|--------------|------------|------------------|
| `orchestrators/marketplace/add.ts` | `invalidateMarketplaceNames(scope) + invalidateMarketplaceCache(scope, name)` | try/catch + notifyWarning |
| `orchestrators/marketplace/remove.ts` | `invalidateMarketplaceNames + dropMarketplaceCache` | try/catch + notifyWarning |
| `orchestrators/marketplace/update.ts` | `invalidateMarketplaceCache(scope, name)` | try/catch + notifyWarning |
| `orchestrators/plugin/install.ts` | `invalidateMarketplaceCache(scope, marketplace)` | try/catch + notifyWarning |
| `orchestrators/plugin/uninstall.ts` | `invalidateMarketplaceCache(scope, marketplace)` | try/catch + notifyWarning |

`orchestrators/plugin/update.ts` is explicitly excluded per D-03 corollary (PLANS-INDEX line 95). Per-call failure envelope (notify.warning + no rollback) is documented in each insertion (06-05 Task 1 action lines 233-280). PASS.

### Dimension 9: Open Questions Resolution (WARNING)

RESEARCH.md "## Open Questions" (line 1243) is NOT marked as `(RESOLVED)`. The three questions remain in question form. The planner DID adopt explicit answers in each plan (06-04 line 90: "LLM tool param schemas: inline at top of handlers/tools.ts (no separate tools-schemas.ts)"; line 91: "execute bodies: replicate V1 inline loop"; 06-05 line 312: "unconditionally installs the autocomplete wrapper (V1 carry-forward)"). All three default to V1-parity per the researcher's recommendations.

**Severity: WARNING (not BLOCKER).** The decisions are made and documented in the plans; the RESEARCH.md section heading is the cosmetic miss. Dimension 11's strict check would flag this, but the substance is resolved.

### Dimension 10: Cross-Plan Invariants (PASS WITH ONE CONCERN)

- **`orchestrators/edge-deps.ts` indirection (NEW file added by planner to resolve BLOCK C):** Justified at 06-05 lines 82-94. `edge/register.ts` -> `orchestrators/edge-deps.ts` is legal (edge -> orchestrators); `orchestrators/edge-deps.ts` -> `persistence/` is legal (orchestrators -> persistence). The indirection does NOT violate Phase 1 D-11 import boundaries. PASS.
- **`LocationsResolver` interface lives in `edge/completions/data.ts`** (06-03 lines 196-205) and is imported by `orchestrators/edge-deps.ts` (06-05 line 176). This is `orchestrators/` -> `edge/` for a TYPE -- legal as a type-only import (TypeScript erases it at runtime). The plans do not explicitly mark this as `import type` -- recommend executors use `import type { LocationsResolver }` to make the boundary one-way clean. **WARNING (low severity).**
- **`ManifestSoftFailError` class is exported from `shared/completion-cache.ts`** and imported by `orchestrators/edge-deps.ts` (06-05 line 175). `orchestrators/` -> `shared/` is always legal. PASS.

### Dimension 11: Architectural Tier Compliance (PASS)

The Architectural Responsibility Map in 06-RESEARCH.md lines 135-148 assigns:

- Slash command dispatch -> edge (`router.ts`): satisfied by 06-02.
- Argument tokenization + scope validation -> edge: satisfied by 06-02.
- Tab completion provider -> edge with shared cache reads: satisfied by 06-03.
- LLM tool registration + execute body -> edge handler with orchestrator delegation: satisfied by 06-04 (with the BLOCK C resolution proposed for tool execute bodies).
- Cache read API -> shared: satisfied by 06-03 (`shared/completion-cache.ts`).
- Cache invalidation -> shared (called from orchestrators): satisfied by 06-03 (impl) + 06-05 (caller).
- Cache rebuild from authoritative source -> shared: satisfied by 06-03 with the resolver-injection seam to avoid `shared/` -> `persistence/`.
- Slash command + LLM tool registration on Pi -> edge (`register.ts`): satisfied by 06-05.
- Session-start autocomplete wrapper -> edge (`register.ts`): satisfied by 06-05.

Every capability lands in the assigned tier. PASS.

### Dimension 12: CLAUDE.md Compliance (PASS)

Spot-checks of project-level CLAUDE.md constraints:

- **TypeBox `^1.1.38`:** Plan 06-03 imports `typebox/compile`/`typebox` per the v1 module surface; PASS.
- **node:test built-in:** All test files use `import { test } from "node:test"`; PASS.
- **write-file-atomic@^8 via shared/atomic-json.ts:** Plan 06-03 cache writes route through `atomicWriteJson`; PASS.
- **ESM-only:** No CJS-style imports in any plan; PASS.
- **No semver for hash versions:** Not applicable to Phase 6 (no hash-version code paths).
- **GSD Workflow Enforcement:** This review is being performed via gsd-plan-checker as part of the workflow; PASS.
- **Lockfile committed:** Not modified by Phase 6.

### Dimension 13: Tactical Concerns Specific to This Phase

- **ESLint rule duplication (Plan 06-05 Task 3):** The existing `eslint.config.js` lines 65-82 already restricts `process.stdout.write` and `process.stderr.write` across `extensions/claude-marketplace/**/*.ts` (the project-wide rule). Plan 06-05 Task 3 proposes to add the SAME rule scoped to `extensions/claude-marketplace/edge/**/*.ts`. The planner's `<action>` text correctly says: "If the existing BLOCK A rule already covers process.stdout/stderr via a wildcard ... this task is a no-op." So Plan 06-05 Task 3 may simply confirm the existing rule is sufficient and not edit `eslint.config.js`. **Severity: WARNING.** The plan does call this out, but the SUCCESS_CRITERIA line "ESLint blocks process.stdout/stderr writes in edge/" is technically satisfied at HEAD, not as a Phase 6 deliverable.
- **Plan 06-04 Task 2's BLOCK C tension for tool execute bodies:** The plan correctly identifies that `edge/handlers/tools.ts` cannot import from `persistence/`. It proposes either (a) refactor orchestrators to expose a `loadVisibleMarketplaces` / `loadPluginListPayload` helper, or (b) delegate to orchestrators directly. Neither helper exists today. **Severity: WARNING.** Executors will discover this only when implementing -- recommend pinning this to option (a) and adding "export `loadVisibleMarketplaces` from `orchestrators/marketplace/shared.ts`" as a sub-task with its own `<verify>`.

## Specific Issues

| # | Severity | Plan | Location | Issue | Required Fix |
|---|----------|------|----------|-------|---------------|
| 1 | WARNING | 06-04 | Task 1, action lines re: `edge/handlers/plugin/list.ts` | Two-path ambiguity for `--installed/--available/--unavailable` parsing ("hand-rolled scan" OR "extend parseCommandArgs"); risks shim-pattern drift | Pin a single approach pre-execution; recommend explicit `extractListFlags(tokens) -> { installed, available, unavailable }` helper exported from `edge/args.ts` |
| 2 | WARNING | 06-04 | Task 2, action lines 269-282 | Tool execute body's BLOCK C resolution depends on a `loadVisibleMarketplaces` / `loadPluginListPayload` orchestrator helper that does not exist today; planner says "Implementers MAY add these exports" -- discretion under-specified | Lock to option (a): add an explicit sub-task that exports `loadVisibleMarketplaces` from `orchestrators/marketplace/shared.ts` (and similar for plugins) with its own `<verify>` |
| 3 | WARNING | 06-05 | Task 3, eslint.config.js | The proposed rule already exists at lines 65-82 of `eslint.config.js` (extension-wide, not just edge/) | Replace Task 3 with a "verify the existing global BLOCK A rule covers edge/" check (no-op edit). Update Task 3 done criteria accordingly |
| 4 | WARNING | 06-RESEARCH.md | line 1243 | `## Open Questions` section heading is not marked `(RESOLVED)` despite the planner adopting all three V1-parity recommendations across the plans | Either (a) update RESEARCH.md heading to `## Open Questions (RESOLVED)` with `RESOLVED: <answer>` per question, or (b) add a `<decisions>` note inside the plans citing the source of resolution. (a) is cleaner. |
| 5 | WARNING | 06-05 | Task 2, line 176 | `orchestrators/edge-deps.ts` imports `LocationsResolver` from `edge/completions/data.ts` -- this is `orchestrators -> edge`, a reverse-direction import | Use `import type` to make it a type-only import (TS-erased at runtime), or move `LocationsResolver` to `shared/types.ts` or `orchestrators/edge-deps.ts` itself |
| 6 | WARNING | 06-05 | Task 1, verify command line 300 | The grep gate uses `invalidateMarketplaceCache\\|...` (escaped) inside a shell heredoc -- works as an OR predicate, but the regex looks fragile across shells | Replace with a simpler grep -E pattern: `grep -E "invalidate(Marketplace(Cache|Names))\|dropMarketplaceCache"` |
| 7 | INFO | 06-PLANS-INDEX.md | line 31 | Wave 0 verification says ">=141 skipped" -- round number; actual sum is 36 + 50 + 55 = 141 exactly | Tighten to `== 141` or to a specific lower-bound `>= 138` to allow minor planner discretion |
| 8 | INFO | 06-03 | Task 1, behavior section | "Memory miss + file hit returns file content (no rebuild) for marketplace-names; for plugin-index, returns file content unless `now() - loadedAt > 10*60*1000` (TTL)" -- but `loadedAt` is set on memory entry, not file entry. The semantics for "file hit serves before TTL elapses since file write" are not explicitly stated | Clarify: "on file hit, set `loadedAt = now()` so TTL resets from this in-memory entry's load time"; document that file mtime is not used |

No BLOCKERs identified.

## Recommended Revisions

Not required (verdict is PASS WITH CONCERNS, not REVISE). The 6 warnings above can be tracked at execution time without blocking the wave-0 start. The two highest-value tightenings are:

1. **Lock Plan 06-04 Task 2's BLOCK C resolution to "expose orchestrator-side payload helpers" as a sub-task with a verify gate** (Issue #2). This prevents the executor from making an ad-hoc decision that triples back into the orchestrators.
2. **Pin Plan 06-04 Task 1's `plugin/list.ts` flag-parsing approach to a single style** (Issue #1) -- reduces post-execution diff friction.

Optional improvements (low ROI but cheap): Issues #3 (recognize existing ESLint rule), #4 (mark RESEARCH Open Questions RESOLVED), #5 (`import type` discipline).
