---
phase: 09-final-quality-and-backlog-closure
plan: 01
subsystem: testing
tags: [dependency-injection, hooks-bridge, filesystem-port, typescript, node-test]

# Dependency graph
requires:
  - phase: 08-direct-coverage
    provides: the RemovalOps port precedent (D-08-12/D-08-13), the direct-coverage gate, and the sibling control the staleness case leans on
provides:
  - "`HooksFileReader`: the hooks bridge's one required, never-defaulted read port"
  - "`readHooksJson`: the real implementation, in `bridges/hooks/stage.ts`, exported through the hooks barrel"
  - "`HooksHydrationReader extends HooksFileReader`, so hydration's reader satisfies routing's port"
  - "Zero static `readFile` in `bridges/hooks/event-router.ts` — the `node:fs/promises` import is `mkdir` alone"
  - "A staleness case whose trigger is named rather than counted: the generation advances from inside the injected read"
  - "A re-measured direct-coverage reading for `event-router.ts` that supersedes the pre-change one"
affects: [09-02 coverage re-measurement, 09-03 requirement seal change A, 09-06 CLOSE-01/CLOSE-02]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate`.
actuals:
  tokens: 25800
  tasks: 2
  commits: 2
plan_head_before: e70a087dc5d883eef6f1ca79bf73c2da56dd731e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required, never-defaulted filesystem port declared beside its consumer, supplied by the composition root"
    - "Narrow interface extension (`extends`) instead of a merged superset, so no factory receives a member it cannot call"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/index.ts
    - tests/bridges/hooks/stage.test.ts
    - tests/bridges/hooks/index.test.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/index.test.ts
    - tests/architecture/hooks-lifecycle.test.ts

key-decisions:
  - "D-09-08 shape: a one-member `HooksFileReader` with `HooksHydrationReader extends HooksFileReader`, rejecting the merged `HooksReader` that would hand `createHooksRouting` a `loadState` it never calls"
  - "`readHooksJson` lives in `bridges/hooks/stage.ts`, not a new `reader.ts`, so the source-test pair count stays at 230"
  - "The composition root supplies the port as an object-literal shorthand (`{ readHooksJson }` / `{ loadState, readHooksJson }`), keeping one pinnable literal per construction"
  - "Every pre-existing call site is handed the production `readHooksJson`, so the port changes no behavior anywhere except the one case that substitutes it deliberately"
  - "`tryHydrateOnePlugin` takes a tenth positional parameter rather than folding nine into an options object; folding is a separate refactor no decision authorizes"

patterns-established:
  - "Port doc comment states how wide the port is, why it is not wider, that it is required rather than defaulted, and that it replaces the syscall and never the containment guard"
  - "A test that needs behavior at an injected boundary decorates the port member, not the runtime — the trigger is named by where it runs"

requirements-completed: []

coverage:
  - id: D1
    description: "`bridges/hooks/event-router.ts` holds zero static filesystem read; the `node:fs/promises` import narrows to `mkdir` alone"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "grep -c 'readFile' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts -> 0"
        status: pass
      - kind: other
        ref: "grep -n 'from \"node:fs/promises\"' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts -> one line, mkdir only"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both former read call sites go through the same injected `readHooksJson` member"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "grep -c 'reader.readHooksJson(' extensions/pi-claude-marketplace/bridges/hooks/event-router.ts -> 2"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts (28 tests, fail 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both public factories take a required reader; the composition root supplies the real implementation to each"
    requirement: CLOSE-01
    verification:
      - kind: unit
        ref: "tests/index.test.ts#constructs one runtime and completion cache for edge registration, hook hydration, and plugin update"
        status: pass
      - kind: other
        ref: "npm run typecheck -> exit 0 (a call site without a reader does not compile)"
        status: pass
    human_judgment: false
  - id: D4
    description: "`readHooksJson` is owner-tested in `stage.ts`'s pair and re-exported identically through the hooks barrel"
    requirement: CLOSE-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/stage.test.ts#reads back the exact bytes written to a hooks.json path"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/stage.test.ts#rejects when the hooks.json path does not exist"
        status: pass
      - kind: unit
        ref: "tests/bridges/hooks/index.test.ts#readHooksJson > re-exports the defining binding"
        status: pass
    human_judgment: false
  - id: D5
    description: "NFR-10 read-site ordering is unchanged: `assertPathInside` -> generation guard -> `asAbsolutePluginRoot` -> read"
    requirement: CLOSE-01
    verification:
      - kind: other
        ref: "source order in tryHydrateOnePlugin: assertPathInside (+20), asAbsolutePluginRoot (+38), reader.readHooksJson (+48)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The staleness case reaches the stale window from inside its own injected `readHooksJson`, with no counted `currentGeneration()` consultation and no runtime decorator (D-09-07)"
    requirement: CLOSE-01
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts#project hydration stops before parsing a plugin's hooks.json read under a stale generation"
        status: pass
      - kind: other
        ref: "grep -c 'GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ|runtimeGoingStaleAfterTheHooksRead|KNOWN CONFLICT' -> 0, 0, 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every gate that names a touched file is green on the final tree: typecheck, lint, fallow, format:check, unit, integration, direct coverage, and the unowned-export census"
    requirement: CLOSE-01
    verification:
      - kind: unit
        ref: "npm test -> tests 6007, pass 6007, fail 0"
        status: pass
      - kind: integration
        ref: "npm run test:integration -> tests 32, pass 32, fail 0"
        status: pass
      - kind: other
        ref: "npm run typecheck / npm run lint / npm run fallow / npm run format:check -> all exit 0"
        status: pass
      - kind: unit
        ref: "tests/architecture/unowned-exports-census.test.ts -> tests 3, pass 3, fail 0"
        status: pass
    human_judgment: false

# Metrics
duration: 30 min
completed: 2026-09-11
status: complete
---

# Phase 9 Plan 01: Injected Hooks Read Port Summary

**`bridges/hooks/event-router.ts` now performs both of its `hooks.json` reads through one required, never-defaulted `HooksFileReader` supplied by the extension composition root, and the staleness case that motivated the port advances the generation from inside that injected read instead of counting guard consultations.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-11T20:11Z (approximate — the plan's start timestamp was not captured before the first edit; the preceding commit `e70a087d` landed at 20:11:08Z)
- **Completed:** 2026-09-11T20:37:32Z (last task commit) / 20:45Z including the final gate re-runs
- **Tasks:** 2
- **Files modified:** 39 across the two task commits

## Accomplishments

- **The port exists and is complete on both chains.** `HooksFileReader` carries one readonly member, `readHooksJson`. `createHooksRouting` takes it as a required second parameter; `createHooksHydration` takes a `HooksHydrationReader` that now `extends` it. Both former `readFile` call sites — the one inside `readAndCachePluginHooksWith` and the one inside `tryHydrateOnePlugin` — call `reader.readHooksJson(...)`. The `node:fs/promises` import narrows to `mkdir`, which `ensureSharedDataDir` still needs.
- **The real implementation lives in the hooks bridge's file-primitives module.** `readHooksJson` is one utf-8 read and nothing else, in `bridges/hooks/stage.ts`, exported through the hooks barrel and supplied by `extensions/pi-claude-marketplace/index.ts` as an object-literal shorthand alongside `loadState`. No new module, so the source-test pair count stays at 230.
- **NFR-10 containment is untouched.** In `tryHydrateOnePlugin` the order is still `assertPathInside` → generation guard → `asAbsolutePluginRoot` → read → generation guard. The port replaced the syscall and nothing else; the interface and the implementation both document that the path arrives already contained and no implementation performs resolution.
- **All 171 call sites converted in one commit.** 139 `createHooksRouting(` sites across 29 test files, 32 `createHooksHydration(` sites across 10, plus the 2 production lines. Every pre-existing site receives the production `readHooksJson`, which is what those sites do today, so the port changes no behavior anywhere it was not meant to.
- **All four gate-embedded literals moved with the wiring.** `tests/index.test.ts`'s two regexes and two expected strings, the `satisfies HooksHydrationReader` literal in `tests/bridges/hooks/index.test.ts`, the WR-01 Block E reader literal in `tests/architecture/hooks-lifecycle.test.ts`, and the pinned unowned-export census all agree with the new shape.
- **The staleness case is honest by design.** The 22-line KNOWN-CONFLICT comment, the `GUARDS_FROM_THE_STATE_READ_TO_THE_HOOKS_READ` constant, the `runtimeGoingStaleAfterTheHooksRead` decorator, the counter and the latch are all gone. Its reader advances the generation and then delegates to the production `readHooksJson`. Its three assertions and its sibling control are unchanged, so the empty parsed-config reading still means a stopped hydration.

## Direct coverage reading for `event-router.ts` (verbatim, for 09-02)

```
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (branches 114/114, functions 43/43, lines 1002/1002)
```

Measured after both task commits. The pre-change reading was `branches 114/114, functions 43/43, lines 967/967`; the line count moved because the port added declarations and doc comments to the module. Branches and functions are unchanged. The other three modules this plan touched also pass:

```
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/stage.ts (branches 38/38, functions 13/13, lines 291/291)
Direct coverage passed: extensions/pi-claude-marketplace/bridges/hooks/index.ts (branches 1/1, functions 0/0, lines 30/30)
Direct coverage passed: extensions/pi-claude-marketplace/index.ts (branches 17/17, functions 3/3, lines 184/184)
```

## Task Commits

1. **Task 1: Thread one injected read port through both hooks call chains, end to end** — `73a3c85f` (`feat(hooks): read hooks.json through one injected port`), 39 files
2. **Task 2: Reach the stale-generation window through the injected reader (D-09-07)** — `c6a6758c` (`test(hooks): name the stale-generation trigger in the hydrate case`), 1 file

Task 1 is a single atomic commit by design: every intermediate state of a 171-call-site signature change is a type error, so the change cannot be split without leaving the tree red.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` — declares and exports `HooksFileReader`; `HooksHydrationReader` now extends it; `readAndCachePluginHooksWith`, `hydrateScopeFromState` and `tryHydrateOnePlugin` each gained one `reader` parameter; `createHooksRouting` gained a required second parameter; the fs import narrowed to `mkdir`
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` — adds `readHooksJson`; module header now names read alongside write and remove
- `extensions/pi-claude-marketplace/bridges/hooks/index.ts` — re-exports `readHooksJson` (value) and `HooksFileReader` (type)
- `extensions/pi-claude-marketplace/index.ts` — imports `readHooksJson` and supplies it to both factories
- `tests/bridges/hooks/stage.test.ts` — two owner cases for `readHooksJson` (exact bytes read back; ENOENT rejection)
- `tests/bridges/hooks/index.test.ts` — the `satisfies` literal grew a member; a fifth re-export case asserts the barrel's `readHooksJson` is the identical binding to `stage.ts`'s
- `tests/bridges/hooks/event-router.test.ts` — 7 routing sites and 18 hydration sites converted; the staleness case rewritten
- `tests/index.test.ts` — both construction regexes and both expected strings updated to the new literals
- `tests/architecture/hooks-lifecycle.test.ts` — the WR-01 Block E reader literal gained `readHooksJson`; the Block E regex itself is unedited and still matches, because every annotation added is a named interface
- 30 further test files — mechanical conversion of `createHooksRouting(...)` / `createHooksHydration(...)` call sites plus the `readHooksJson` import

## Decisions Made

The five design choices the plan delegated, each with what it rejected:

1. **Interface shape:** `HooksFileReader { readHooksJson }` with `HooksHydrationReader extends HooksFileReader`. Rejected the merged one-interface shape 09-RESEARCH §2.3 recommended — it hands `createHooksRouting` a `loadState` member routing provably never calls, and would force 139 test sites to stub an operation the unit under test cannot reach. Also rejected two sibling reader parameters on `createHooksHydration` (three positionals for one responsibility) and two differently-shaped ports for the same read (the asymmetry D-09-06 refuses, relocated rather than removed).
2. **Implementation home:** `bridges/hooks/stage.ts`. Rejected a new `bridges/hooks/reader.ts` — `check-corresponding-tests.mjs` would demand a 231st pair every downstream plan measures against 230. Rejected `shared/fs-utils.ts` (a generic `readUtf8File` there contradicts that module's own narrowness rule) and an arrow declared in the extension entry.
3. **Composition-root wiring:** object-literal shorthand, keeping `index.ts` one consistent line and one pinnable literal per construction, rather than a `createHooksFileReader()` factory whose body lives elsewhere.
4. **Test doubles:** the production implementation at every pre-existing call site. Rejected a shared `tests/bridges/hooks/*-fake.ts` (the `-fake.test.ts` / `-contract.ts` companion rule is cost with no return for a one-member interface) and a per-file synthetic-bytes stub (it would change behavior at the sites that genuinely read a fixture file).
5. **Threading style:** `tryHydrateOnePlugin` takes a tenth positional parameter, matching how `routingState` and `generationIsCurrent` already travel. Rejected folding nine parameters into an options object: every one of them is required and positional, so `CONVENTIONS.md`'s options-object rule does not apply, and the fold is a separate refactor with its own blast radius that no decision in 09-CONTEXT.md authorizes.

One small readability choice not named in the plan: the staleness case's `readHooksJson` member calls the imported production `readHooksJson` from inside a method of the same name. An object-literal method name binds no identifier in its own body, so this is delegation and not recursion — a one-line comment says so at the call, because the shape reads ambiguously otherwise.

## Deviations from Plan

None — plan executed exactly as written. `npm run typecheck` was green on the first run after the mechanical conversion, so no auto-fix rule was invoked.

## Issues Encountered

**`gsd-tools query state.update-progress` regressed the STATE.md progress frontmatter.** It rewrote `completed_phases: 4` to `1` and `percent: 44` to `11`, recomputing from the active workstream only. This is the known workstream-STATE behavior, not a consequence of this plan's work. Both fields were restored by hand in the same change; `total_plans` moving 205 → 211 is correct (the six Phase 9 plans are now on disk) and was kept.

## Requirements

`CLOSE-01` is declared by this plan and by 09-02, 09-03 and 09-06. `requirements.ready-ids` correctly reports `0/1 requirement(s) ready`, so nothing was marked complete here. This agrees with D-09-02: `CLOSE-01` asserts the suite passes *after* all terminal work is complete, and flipping it now would write a claim that has not been measured — the defect class this milestone exists to retire. The flip belongs to change B.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **09-02 can proceed.** Its input is the re-measured coverage: `event-router.ts` reads `branches 114/114, functions 43/43, lines 1002/1002`, recorded verbatim above. The line count moved from 967 to 1002, so D-09-09's obligation to re-run `npm run test:coverage:direct:all` over all 230 pairs and regenerate the committed pin is live, not a formality.
- **The pin itself is not at risk from this plan.** `event-router.ts` has no pin row (the pin holds exactly two modules), and all four touched modules read complete, so the port created no shortfall.
- **No blockers.** The full suite, both complexity gates, and the unowned-export census are all green on the final tree.

---
*Phase: 09-final-quality-and-backlog-closure*
*Completed: 2026-09-11*

## Self-Check: PASSED

All four modified production modules exist on disk. `HooksFileReader` is declared and exported
in `event-router.ts`; `readHooksJson` is declared and exported in `stage.ts`. All three commits
(`73a3c85f`, `c6a6758c`, `605d0550`) are present in `git log`. Every plan-level verification
command was re-run on the final tree after the last task commit: `npm run typecheck`,
`npm run lint`, `npm run fallow` and `npm run format:check` exit 0; `npm test` reports
`pass 6007 / fail 0`; `npm run test:integration` reports `pass 32 / fail 0`;
`node scripts/test-coverage-direct.mjs` exits 0 for each of the four modules; and
`tests/architecture/unowned-exports-census.test.ts` reports `pass 3 / fail 0`, so the new
export did not shift the pinned census in either direction.
