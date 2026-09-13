---
phase: 08-direct-coverage
plan: 03
subsystem: testing
tags: [coverage, node-test, hooks-hydration, generation-guard, type-predicate]

requires:
  - phase: 08-direct-coverage
    provides: "08-01's measured enumeration baseline — the two refused rows this plan closes, with their exact reading strings (`bridges/hooks/event-router.ts` branches 107/111, lines 959/967; `orchestrators/plugin/update-preflight.ts` functions 20/21, lines 589/593)"
provides:
  - "`bridges/hooks/event-router.ts` reads complete under the direct gate (branches 114/114, functions 43/43, lines 967/967), so it leaves the accepted-shortfall set without a pin row"
  - "`orchestrators/plugin/update-preflight.ts` reads complete under the direct gate (branches 97/97, functions 21/21, lines 593/593)"
  - "Three cases pinning the hooks hydration generation guards: the containment guard, the post-hooks.json-read guard, and the SessionStart shared-data-dir guard, each reached through the injected `HooksRuntime` or `HooksHydrationReader`"
  - "Two cases pinning `isUpdatePreflightOutcome`'s discrimination with real values of both arms"
  - "The measured answer to `D-08-03a`: neither module is pin-eligible, so the pin plan has two fewer candidate rows"
affects: [08-04, 08-08, 08-09]

actuals:
  tokens: 1919
  tasks: 2
  commits: 2
  plan_head_before: eb46a03b930a122e95f1935d236b74b06982d730

tech-stack:
  added: []
  patterns:
    - "A generation guard is reached by advancing the real runtime's generation through an injected collaborator — a concurrent `registerHooksBridge`, or a one-member spread decorator over `createHooksRuntime()` — never by patching a builtin or adding a production seam"
    - "Where two guards sit either side of an uninjected `await`, the case keys its advance on the guard consultation itself and still asserts the consequence; the count is a documented cost, never the promise"
    - "A type predicate's two arms are covered by calling it with values the owner suite already produces, and narrowing through the predicate so the case proves discrimination rather than a returned boolean"

key-files:
  created: []
  modified:
    - tests/bridges/hooks/event-router.test.ts
    - tests/orchestrators/plugin/update-preflight.test.ts

key-decisions:
  - "Site 614-616 is the one site with no named trigger available: no injected collaborator runs between the guard after the containment check and the guard after the hooks.json read, and `readFile` is a direct `node:fs/promises` import that TREF-08 forbids patching. Its case keys the advance on the guard consultation, counted from the injected state read rather than from the whole call history, and asserts the consequence"
  - "Sites 586-588 and 552-554 were reached through `registerHooksBridge`, not `hydrateProjectScopeForCwd`: the factory-time hydrate has no guard between the state read and `hydrateScopeFromState`, so a pre-existing staleness survives into `tryHydrateOnePlugin`. On the `hydrateProjectScopeForCwd` path the guard after the state read intercepts it first — which is the guard the file's existing case at the deferred-read precedent already owns"
  - "The SessionStart decorator is armed only after registration returns, because registration reads the same `SessionStart` bucket once per hydrated scope; an unarmed advance there would have made the bridge's own captured generation stale and hollowed out the case"
  - "Measured readings are reported as measured. Both modules reproduce 08-01's before-readings exactly at this HEAD, and `bridges/hooks/event-router.ts` reproduces research's predicted after-reading exactly; `orchestrators/plugin/update-preflight.ts`'s after-reading carries a branch count research did not record"

patterns-established:
  - "Before accepting a counted trigger, enumerate the collaborators in the window between the two guards; the count is only honest once that enumeration comes back empty, and the enumeration is what the comment records"
  - "Anchor an unavoidable consultation count to an injected call (the state read) rather than to the call history of the whole entrypoint, so the constant survives anything added outside the function under test"

# RCOV-02 asks for ALL terminal shortfalls to be reclassified. Two measured
# modules remain — `bridges/commands/discover.ts` (pin row) and
# `orchestrators/plugin/install-outcome.ts` (owner tests after the removal
# port) — so the box stays unchecked. The per-deliverable `requirement:` links
# below carry the traceability.
requirements-completed: []

coverage:
  - id: D1
    description: "`bridges/hooks/event-router.ts` reads complete under the direct gate, with all four `generationIsCurrent` early returns reached through an injected collaborator"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (Direct coverage passed: branches 114/114, functions 43/43, lines 967/967)"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts (27 pass, 0 fail)"
        status: pass
      - kind: unit
        ref: "node --test \"tests/bridges/hooks/**/*.test.ts\" (513 pass, 0 fail, 26 suites)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each of the four guard bodies (553-554, 587-588, 615-616, 872-873) is executed by the three new cases alone, not by the suite around them"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node --test --experimental-test-coverage --test-reporter=lcov --test-name-pattern=<the three new titles> tests/bridges/hooks/event-router.test.ts — lcov DA hit counts: 553:2 554:2 587:1 588:1 615:1 616:1 872:1 873:1"
        status: pass
    human_judgment: false
  - id: D3
    description: "`orchestrators/plugin/update-preflight.ts` reads complete under the direct gate after `isUpdatePreflightOutcome` is called with real values of both arms"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts (Direct coverage passed: branches 97/97, functions 21/21, lines 593/593)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts (20 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No builtin is patched, no test-only production surface is added, and no production file changed"
    requirement: RCOV-02
    verification:
      - kind: other
        ref: "git diff eb46a03b..HEAD --name-only lists only the two test files; no `createRequire`, `syncBuiltinESMExports`, `t.mock.module`, ` as never`, ` as unknown`, or `Partial<` in the added lines"
        status: pass
      - kind: other
        ref: "npm run typecheck (exit 0) + npx eslint --max-warnings=0 + npx prettier --check + npm fallow via pre-commit (Passed) + npm test (5959 pass, 0 fail, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Site 614-616 is closed by a counted guard consultation rather than a named trigger, and the reason is recorded"
    requirement: RCOV-02
    verification: []
    human_judgment: true
    rationale: "The plan's backstop truth asks an operator to agree that no named semantically adjacent trigger exists for this one site. The enumeration behind that claim — that only `asAbsolutePluginRoot` and a direct `readFile` import run between the two guards — is a judgment about the production code's collaborator surface, not something a test can assert."

duration: 19min
completed: 2026-09-11
status: complete
---

# Phase 08 Plan 03: Two Reachable Shortfalls Covered Summary

**`bridges/hooks/event-router.ts` now reads `branches 114/114, functions 43/43, lines 967/967` and `orchestrators/plugin/update-preflight.ts` reads `branches 97/97, functions 21/21, lines 593/593` — five test cases, no builtin patched, no production file touched, and two rows fewer for the pin.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-09-11T02:56:39Z
- **Completed:** 2026-09-11T03:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All four `generationIsCurrent` early returns in `bridges/hooks/event-router.ts` are covered, each through an injected collaborator: the `HooksHydrationReader` for two of them, a one-member spread decorator over the real `createHooksRuntime()` for the other two. `D-08-03a` is discharged by measurement and the module earns no pin row.
- `isUpdatePreflightOutcome` is called with a real `UpdatePreflightOutcome` and a real `PreparedPluginUpdate`, both obtained from `preparePluginUpdate` against fixtures the owner suite already had. No `as never`, no hand-built literal.
- Site attribution was measured, not argued: an lcov run over only the three new case titles shows every one of the four guard bodies executed.
- The shortfall set is down to two modules from 08-02's four.

## Task Commits

1. **Task 1: Reach all four generationIsCurrent early returns through the injected HooksRuntime** — `510ce1ec` (test)
2. **Task 2: Call isUpdatePreflightOutcome with real values of both arms** — `80b8e0be` (test)

## The measured readings

Both before-readings reproduce 08-01's exactly at this HEAD, so no number is quoted from a record.

| module | before | after |
| --- | --- | --- |
| `bridges/hooks/event-router.ts` | `branches 107/111, lines 959/967` | `branches 114/114, functions 43/43, lines 967/967` |
| `orchestrators/plugin/update-preflight.ts` | `functions 20/21, lines 589/593` | `branches 97/97, functions 21/21, lines 593/593` |

`bridges/hooks/event-router.ts` reproduces research's predicted after-reading byte for byte, which 08-02 had warned is not guaranteed. `orchestrators/plugin/update-preflight.ts`'s after-reading carries a branch count (`97/97`) that neither research nor 08-01 recorded, because a complete reading prints all three counters while a shortfall reading prints only the ones that fall short.

## How each guard was reached

| site | mechanism | trigger |
| --- | --- | --- |
| 586-588 (after the containment check) | `registerHooksBridge` with the project-scope state read deferred, plus a concurrent second `registerHooksBridge` | named: a concurrent registration advances the generation while the read is in flight |
| 552-554 (the caller's per-plugin loop) | same case, reached on the return from the stale `tryHydrateOnePlugin` | named: as above |
| 614-616 (after the hooks.json read) | `hydrateProjectScopeForCwd` with a one-member spread decorator over the real runtime's `currentGeneration` | **counted**: the third guard consultation after the injected state read — see below |
| 871-873 (after the shared data dir) | `registerHooksBridge`, then the recorded `session_start` handler, with a one-member spread decorator over `getRoutingBucket` | named: the `SessionStart` routing read that `event-router.ts` performs immediately before the `ensureSharedDataDir` await |

**Why 586-588 needed the factory-time path.** The plan's first preference was the in-file precedent — a deferred `reader.loadState` on `hydrateProjectScopeForCwd` plus a concurrent registration. Measured, that shape cannot reach 586-588 at all: `hydrateProjectScopeForCwdWith` consults the guard immediately after its own state read, so a staleness that arose during the read is intercepted there and `hydrateScopeFromState` never runs. That guard is exactly the one the existing case "runtime hydration stops before mirroring when registration advances its generation" already owns. `hydrateCacheFromDisk` has **no** guard between its per-scope state read and `hydrateScopeFromState`, so the same staleness survives into `tryHydrateOnePlugin` there. The mechanism is the precedent's; the entrypoint is the factory-time one.

**Why the SessionStart decorator is armed late.** `registerHooksBridgeWith` reads the `SessionStart` bucket once per hydrated scope to decide whether to create the shared data dir. An unconditional advance inside `getRoutingBucket` would fire during registration, making the bridge's own captured generation stale before any handler ran — every later assertion would then pass for the wrong reason. The decorator therefore delegates silently until the case arms it, between registration and the dispatch.

## The one counted trigger (`614-616`)

Per the plan's option 3 and its backstop truth, the site and the reason are named here.

`tryHydrateOnePlugin` consults the generation guard once after `await assertPathInside(...)` and once after `await readFile(hooksJsonPath, "utf8")`. Between those two consultations it runs exactly two things: `asAbsolutePluginRoot(resolvedSource)`, a synchronous domain call, and the `readFile` itself. Neither is an injected collaborator. `readFile` is a direct `node:fs/promises` import, and `TREF-08` forbids patching it; `t.mock.module` is forbidden as well. Research's own suggestion — "advance inside `reader.loadState` on a second invocation" — was built and does not work: the reader is called once per scope, always before `tryHydrateOnePlugin`, so an advance there lands on the 586-588 guard and never on this one.

Two alternatives were considered and rejected as worse than a count, not better:

- **Scheduling the advance with `setImmediate` from a `setParsedConfig` decorator**, relying on `readFile`'s thread-pool hop to land the callback inside the read window. This trades a consultation count for a dependency on libuv phase ordering and on `assertPathInside` not crossing a macrotask boundary — an unstated, unasserted assumption that would rot silently rather than loudly.
- **Making the hooks.json a FIFO** so the test can hold the read open. Deterministic, but it needs `mkfifo` through a subprocess, is not portable, and a mis-sequenced writer hangs the suite forever. A hanging case is a worse failure than a coupled one.

The coupling was narrowed rather than accepted whole. The decorator counts consultations **from the injected state read**, not from the entrypoint, so the constant (`3`: after the state read, after the containment check, after the hooks.json read) is unaffected by anything added to `hydrateProjectScopeForCwd` outside `hydrateProjectScopeForCwdWith`. The comment in the case records the enumeration above, so the next reader meets the reason rather than a bare number. The case asserts the consequence — `runtime.parsedConfigEntries()` and `runtime.getRoutingBucket("PreToolUse")` both empty, and the real runtime's generation advanced to 1 — and never the count.

## Files Created/Modified

- `tests/bridges/hooks/event-router.test.ts` — three cases added (24 → 27). Each builds a fresh fixture through `makeProjectHookFixture`, owns the agent root through `ownAgentRoot`, and takes a fresh `createHooksRuntime()`; the two decorators spread the real runtime and override exactly one declared member.
- `tests/orchestrators/plugin/update-preflight.test.ts` — two cases added (18 → 20) plus `isUpdatePreflightOutcome` on the existing value import. Each case narrows the union through the predicate and asserts both the boolean and a distinguishing member of the narrowed value.

## Decisions Made

Recorded in the frontmatter `key-decisions`. The two that shape the tests:

**The decorators override one declared member each, and nothing else.** `HooksRuntime` is a public interface and the runtime is `createHooksHydration`'s first parameter, so a spread over `createHooksRuntime()` substitutes an answer without replacing behavior. `createRoutingStateOperations` binds its members off whatever runtime it is handed, which is why overriding `getRoutingBucket` on the runtime is visible to `event-router.ts`'s `routingState.getRoutingBucket` call — the same property that makes the override reach the production call site makes it reach nothing else.

**The predicate's cases state the boolean and the narrowing in one act phase.** `const finished = isUpdatePreflightOutcome(value)` followed by `finished ? … : undefined` gives the assert phase both facts without a second predicate call and without an `assert.ok` whose only job is to narrow. A predicate that returned a constant would fail the member assertion, not just the boolean one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded a comment containing the literal token ` as `**

- **Found during:** Task 1, running the task's own acceptance grep for an introduced type assertion
- **Issue:** The SessionStart decorator's comment read "leaves the guard after the await as the only thing this case can be measuring". The acceptance grep for an added ` as ` assertion matched that comment line, producing a false positive any later reviewer running the same grep would hit. 08-02 hit the identical hazard and recorded it.
- **Fix:** Reworded to "leaves only the guard after the await for this case to measure".
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`
- **Verification:** `git diff … | grep '^+' | grep -E "! *\)|!\.| as "` returns nothing
- **Committed in:** `510ce1ec` (Task 1 commit)

**2. [Rule 3 - Blocking] Added the blank line `@stylistic/padding-line-between-statements` requires**

- **Found during:** Task 1, `npx eslint --max-warnings=0`
- **Issue:** The `await hydration.registerHooksBridge(...)` statement followed the `executor` arrow-function declaration with no blank line, which this repo's padding rule rejects after a block-like statement.
- **Fix:** Inserted the blank line, then re-ran the focused suite and the direct gate so the fix was not assumed to be inert.
- **Files modified:** `tests/bridges/hooks/event-router.test.ts`
- **Verification:** `npx eslint … --max-warnings=0` exit 0; 27 pass / 0 fail; `Direct coverage passed:` unchanged
- **Committed in:** `510ce1ec` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking).
**Impact on plan:** Both are inside the one file Task 1 owns, neither changes an assertion, and no production code was touched. No scope creep.

## Issues Encountered

**The plan's preferred mechanism does not reach the site the plan assigned it.** The plan states that a deferred `reader.loadState` "reaches the guard that follows the containment check and, through the caller's loop, the guard that follows `tryHydrateOnePlugin`". On the `hydrateProjectScopeForCwd` path it reaches neither — the guard after that function's own state read intercepts first, and that guard already has a case. The mechanism works once it is pointed at `registerHooksBridge`, whose factory-time hydrate has no such intercepting guard. This is the plan's instruction honored at the level of the mechanism rather than the entrypoint, and it is why the case is titled for factory hydration.

**Research's fallback for 614-616 was built and discarded.** "Advance inside `reader.loadState` on a second invocation" cannot reach it for the structural reason given above. The counted consultation is not a shortcut past an untried named trigger; it is what is left after the named ones were tried.

**The full unit suite reports 5959 cases, not the 5957 a simple addition predicts.** 08-02 recorded 5952 and this plan adds five. The two extra are outside this plan's files — `node --test` counts nested subtests, and nothing in this run touched them. 0 fail, 0 skipped either way.

## Known Stubs

None. This plan added test cases only: no placeholder, no unwired path, no coverage pragma, and no pin row.

No entry was appended to `.planning/WINDOWS.md`. Nothing here is a stub, a skipped test, or an unrun verify, and the one design compromise (the counted trigger for 614-616) is carried by this SUMMARY exactly as the plan's backstop truth specifies. `WINDOWS.md` entry 26 names a stale comment in `bridges/hooks/event-router.ts` production source; this plan changed no production file and leaves it open for its owner.

## Threat Flags

None. No file this plan touched introduces a network endpoint, an auth path, a file-access pattern, or a schema change. `T-08-11`'s obligation is discharged by measurement: `git diff eb46a03b..HEAD --name-only` lists only the two test files, so `assertPathInside` and the rest of NFR-10's chokepoint are provably untouched.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **The measured shortfall set is two modules:** `bridges/commands/discover.ts` (`branches 55/57, lines 412/414`, two unreachable sites per `D-08-A05`) and `orchestrators/plugin/install-outcome.ts` (`branches 60/83, functions 22/27, lines 956/1031`, owner tests after the removal port, never a pin). Neither module this plan touched is pin-eligible, so plan 04's pin has two fewer candidate rows than 08-01's enumeration implied.
- **For plan 08's regenerated baseline:** `CONTRIBUTING.md`'s table still names `bridges/hooks/event-router.ts` and, implicitly through its count, the whole set. Both of this plan's modules now read complete and their rows are false. `.planning/WINDOWS.md` is unchanged by this plan.
- **No blocker for downstream plans.** `npm run typecheck` is clean, `npm test` is green at 5959 cases with 0 skipped, the hooks bridge suite is green at 513, and `npm run test:coverage:direct:negative` passes. No production signature, exported type, or message string changed.

---

_Phase: 08-direct-coverage_
_Completed: 2026-09-11_

## Self-Check: PASSED

Both modified test files and this SUMMARY are present on disk. Both task commits (`510ce1ec`, `80b8e0be`) are reachable from `git log`.
