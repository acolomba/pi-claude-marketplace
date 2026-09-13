---
phase: 05-injection-and-ownership-design
plan: 12
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, completion-cache, dependency-injection, lifecycle-isolation, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime construction and hook hydration from Plans 05-09 and 05-11
  - phase: 05-injection-and-ownership-design
    provides: instance-scoped CompletionCache implementation and transition-compatible completion semantics from Plans 05-07 and 05-08
provides:
  - one HooksRuntime and one CompletionCache constructed per extension invocation
  - required root-to-edge CompletionCache injection with registration-scoped reads
  - independent completion memory across peer extension registrations
affects: [05-13-through-05-25, 05-28-through-05-31, edge-registration, hook-lifecycle]

actuals:
  tokens: 8684
  tasks: 2
  commits: 4
plan_head_before: 3e829f26640886c3a7e11d0a41031bee1cfc38b3

tech-stack:
  added: []
  patterns:
    - extension-root lifetime composition with required consumer-owned ports
    - edge completion registration closes over an injected cache identity
    - handler dependency parameters expose only the exact EdgeDeps members consumed

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/edge/types.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - tests/index.test.ts
    - tests/edge/types.test.ts
    - tests/edge/register.test.ts
    - tests/e2e/import-command.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts

key-decisions:
  - "Keep HooksRuntime at its real root-to-hooks consumer boundary instead of violating D-11 by importing bridge contracts into EdgeDeps."
  - "Require CompletionCache in EdgeDeps and close registered completion callbacks over that exact identity without an optional or default owner."
  - "Narrow add, marketplace-update, and bootstrap handler parameters to the exact EdgeDeps ports each consumes so the newly required cache does not become a dead handler dependency."

patterns-established:
  - "Root composition: each extension invocation constructs one HooksRuntime and one CompletionCache before registering their consumers."
  - "Cache isolation: peer command registrations can hold the same logical cache key without sharing in-memory rows."

requirements-completed: []

coverage:
  - id: D1
    description: "Each extension invocation constructs exactly one runtime/cache pair and immediately supplies each owner to its real production consumer."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/index.test.ts#constructs one runtime and completion cache for edge registration and hook hydration"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for extensions/pi-claude-marketplace/index.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edge registration requires the supplied CompletionCache and uses it for completion reads without transition ownership."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/edge/types.test.ts; tests/edge/register.test.ts#keeps supplied lifecycle completion-cache hits isolated between registrations"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/types.ts and edge/register.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hook lifecycle identity, stale-generation behavior, completion rows, and registration behavior remain unchanged while peer cache memory stays isolated."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/architecture/hooks-lifecycle.test.ts; tests/edge/completions/provider.test.ts; tests/edge/completions/data.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration (13/13 files passed)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 12: Root Runtime and Completion Cache Ownership Summary

**Each extension load now owns one hooks runtime and one completion cache, with hook hydration using the runtime directly and edge command completions retaining the injected cache's isolated memory.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-08T01:31:26Z
- **Completed:** 2026-09-08T02:01:22Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Constructed one `CompletionCache` beside the existing root-owned `HooksRuntime` for every `claudeMarketplaceExtension` invocation.
- Made the cache a required `EdgeDeps` member and changed command registration to close over that exact instance. No optional field, fallback factory, test-only constructor, or second edge lifetime was added.
- Kept the runtime at its direct root-to-hooks boundary: the same root runtime continues to drive hydration, registration, re-entry, attribution, stale-generation checks, async child ownership, and reload behavior.
- Added public completion evidence showing two registrations retain different in-memory rows for the same scoped marketplace key.
- Removed `transitionCompletionCache` from root/edge ownership while preserving its legacy shared compatibility surface for the later terminal cleanup plans.

## Task Commits

1. **Task 1 RED: Pin one root cache construction beside the existing runtime** - `7bd60b6d` (test)
2. **Task 1 GREEN: Compose the root cache and required edge contract** - `bcad1b58` (feat)
3. **Task 2 RED: Expose registration's transition-cache ownership leak** - `7619e48e` (test)
4. **Task 2 GREEN: Bind completion callbacks to the supplied lifecycle cache** - `3da6a074` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/index.ts` - Creates one cache per load and supplies it to edge registration beside the existing hooks runtime composition.
- `extensions/pi-claude-marketplace/edge/types.ts` - Requires a readonly production `CompletionCache` on `EdgeDeps`.
- `extensions/pi-claude-marketplace/edge/register.ts` - Uses `deps.completionCache` for every registered argument-completion read and no longer imports the transition singleton.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` - Accepts only the `gitOps` port it consumes.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` - Accepts only its `gitOps` and `pluginUpdate` ports.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` - Accepts only the `gitOps` port it consumes.
- `tests/index.test.ts` - Pins exactly one runtime and one cache construction in the root factory.
- `tests/edge/types.test.ts` - Proves the cache is required, readonly, and uses the exact production type.
- `tests/edge/register.test.ts` - Injects production caches and proves same-key peer registration isolation through public completion callbacks.
- `tests/e2e/import-command.test.ts` - Supplies a fresh production cache to its direct registration helper.
- `tests/edge/handlers/marketplace/add.test.ts` - Removes the now-invalid unused plugin-update argument while retaining all behavior assertions.
- `tests/edge/handlers/plugin/bootstrap.test.ts` - Removes the now-invalid unused plugin-update argument while retaining all behavior assertions.

The planned apply-reconcile and orchestrator-bootstrap controls remained read-only and passed unchanged. No reset surface, cache schema, TTL, poison behavior, invalidation rule, PID behavior, message, comment, or Fallow suppression changed.

## Decisions Made

- `CompletionCache` belongs in `EdgeDeps` because edge registration consumes it directly. Its member is required and has no fallback or default selector.
- `HooksRuntime` does not belong in `EdgeDeps`: the edge layer does not consume it, and importing the bridge-owned type there violates the project's D-11 import boundary. The root still constructs exactly one runtime and passes it as a required value to hook hydration, its real consumer.
- Handler functions accept exact `Pick<EdgeDeps, ...>` ports. This keeps the new cache required at the registration composition boundary without making it a dead dependency of handlers that never read it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Architecture boundary correction] Kept HooksRuntime out of EdgeDeps**

- **Found during:** Task 1 GREEN lint verification
- **Issue:** The plan asked `EdgeDeps` to carry `HooksRuntime`, but D-11 forbids `edge/types.ts` from importing a bridge-owned contract, and no edge consumer reads the runtime. Carrying it would create the dead port the plan also prohibits.
- **Fix:** Kept one required, root-owned runtime passed directly into `createHooksHydration`, the actual consumer. The root/runtime owner evidence was updated to assert this honest boundary; no optional, default, raw, test-only, or relocated runtime was introduced.
- **Files modified:** `extensions/pi-claude-marketplace/index.ts`, `tests/index.test.ts`, `tests/edge/types.test.ts`
- **Verification:** Full typecheck, repository ESLint, `tests/index.test.ts`, `tests/edge/types.test.ts`, and `tests/architecture/hooks-lifecycle.test.ts` pass.
- **Committed in:** `7bd60b6d`, `bcad1b58`

**2. [Rule 3 - Required caller propagation] Narrowed handler ports and repaired direct registration fixtures omitted from plan frontmatter**

- **Found during:** Task 1 required-cache type propagation
- **Issue:** Making `completionCache` required on `EdgeDeps` caused handlers typed against the full bundle to advertise a dead cache port, while the direct import-command registration fixture lacked the new required production cache. Exact non-generic `Pick` parameters then made two handler tests' unused `pluginUpdate` arguments invalid excess properties.
- **Fix:** Narrowed add/bootstrap to `Pick<EdgeDeps, "gitOps">` and marketplace update to `Pick<EdgeDeps, "gitOps" | "pluginUpdate">`; supplied a fresh production cache in the E2E registration helper; removed only the unused plugin-update setup from the add/bootstrap handler tests. Their public assertions and behavior stayed unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts`, `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts`, `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts`, `tests/e2e/import-command.test.ts`, `tests/edge/handlers/marketplace/add.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`
- **Verification:** Typecheck and focused ESLint pass; all three handler owner suites and `tests/e2e/import-command.test.ts` pass.
- **Committed in:** `bcad1b58`

---

**Total deviations:** 2 auto-fixed Rule 3 plan-structure issues.
**Impact on plan:** Both corrections enforce the intended no-dead-port/no-fallback ownership contract. They add only required direct callers and paired tests, without widening runtime behavior or entering later cleanup work.

## Issues Encountered

- `npm run check` passed typecheck, full ESLint, and Fallow, then stopped at `format:check` solely because the pre-existing untracked `.mcp.json` is not formatted. The file remained byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All plan-owned files pass Prettier, and every later gate ran independently.
- The workspace sandbox blocked subprocess-based direct-coverage negative controls and caused two file-level unit-suite failures. Their approved process-capable reruns passed: direct-coverage negative controls and all 5,428 unit tests.

## Validation Results

- Both exact task verification sequences passed, including the committed tracer feedback rerun.
- Direct coverage is 100% for `index.ts`, type-only `edge/types.ts`, and `edge/register.ts` (all branches, functions, and lines).
- Typecheck, focused and repository-wide ESLint, Fallow (`0 above threshold`), plan-file Prettier, corresponding-test checks, and both negative-control gates passed.
- The full unit suite passed all 5,428 tests, including the adjusted handler owners. The integration suite passed all 13 files; the direct E2E import owner also passed.
- Static census found exactly one `createHooksRuntime()` and one `createCompletionCache()` in the extension root, and no `transitionCompletionCache` reference under the root or edge tree.
- The existing `scripts/revalidation.mjs` suppression remains byte-identical: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed only because the root factory had no `createCompletionCache()` construction. `tdd-red-evidence` returned `RED_EVIDENCE_OK` before implementation.
- Task 1 GREEN passed its exact focused suites, direct coverage, typecheck, and ESLint. The committed tracer slice then passed the complete feedback gate before Task 2 began.
- Task 2 RED failed only because edge registration ignored the injected cache and returned no owner-cache candidate. `tdd-red-evidence` returned `RED_EVIDENCE_OK` before the production binding changed.
- Task 2 GREEN passed the named isolation proof and the complete exact task gate.

## Known Stubs

None. No TODO, FIXME, placeholder production path, skipped test, or unwired component was added.

## Deferred Issues

None.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plans 05-13 through 05-25 can thread the same root-owned cache through mutation consumers. Plans 05-28 through 05-31 retain responsibility for legacy reset-call migration and shared transition-surface removal; this plan deliberately leaves those surfaces intact.

## Self-Check: PASSED

- All 12 modified implementation/test artifacts exist, and the two plan-named composition controls remain unchanged.
- All four task commits exist and match the measured plan ledger from `3e829f26640886c3a7e11d0a41031bee1cfc38b3`.
- Root and edge ownership scans, full verification, `.mcp.json` byte identity, and the preserved Fallow suppression all match the claims above; no tracked file was deleted.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_
