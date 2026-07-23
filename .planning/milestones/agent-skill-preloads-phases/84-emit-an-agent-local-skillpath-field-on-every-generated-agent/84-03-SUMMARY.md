---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
plan: 03
subsystem: testing
tags: [node-test, integration-test, pi-subagents, skill-resolution, dynamic-import]

requires:
  - phase: 84-01
    provides: "emitGeneratedAgentFile emits skillPath: ../pi-claude-marketplace/resources/skills whenever frontmatter.skills is non-empty"
  - phase: 84-02
    provides: "pi-subagents >=0.35.0 declared as an optional peerDependency, confirming the 0.35.1 resolver contract this test exercises"
provides:
  - "tests/integration/skill-path-resolution.test.ts: SC-2 resolver-contract test proving the emitted skillPath resolves the bridged skill via pi-subagents' real resolveSkillsWithFallback, and that the skill stays out of the parent/global catalog (invocation-private)"
  - "A reusable dynamic-import pattern (copy installed package src/ outside node_modules, then import by pathToFileURL) for any future test that needs to exercise an optional peer's un-exported internals under Node's native TypeScript type stripping"
affects: [84-04-live-verification]

tech-stack:
  added: []
  patterns:
    - "Optional-peer resolver contract tests: locate the installed package via an env override or `npm root -g`, copy its real source tree into a scratch dir outside node_modules (sidesteps ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), dynamically import by pathToFileURL, and t.skip() gracefully on any failure so CI without the peer stays green"

key-files:
  created:
    - tests/integration/skill-path-resolution.test.ts
  modified: []

key-decisions:
  - "Copy the installed pi-subagents package's real, unmodified src/ tree into a scratch temp directory outside node_modules before dynamically importing its internal skills module -- Node refuses native TypeScript type-stripping for any file whose resolved path contains a node_modules segment (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), and an npm-installed package (global or local) always lives under one, so importing the installed .ts file in place is impossible on Node 26.5 regardless of the exports-map workaround"
  - "PI_OFFLINE=1 is set for the duration of the resolver calls so pi-subagents' own global-npm-package skill scan (used only by discoverAvailableSkills) is skipped, keeping the invocation-private assertion independent of whatever other packages happen to be installed globally on the machine running the test"
  - "The generated skill name carries a random suffix (skillpath-sc2-<8 hex chars>) to eliminate any realistic collision with a real skill name already present in the environment's global catalog"

patterns-established:
  - "Optional-peer un-exported-internals test pattern: env-override-or-npm-root-g locate -> copy src/ to scratch dir outside node_modules -> pathToFileURL dynamic import -> t.skip() on any failure"

requirements-completed: [AGSK-06]

coverage:
  - id: D1
    description: "resolveSkillsWithFallback resolves the bridged skill by its generated name (present in `resolved`, not `missing`) given the emitter's actual skillPath output and a real staged skill install"
    requirement: AGSK-06
    verification:
      - kind: integration
        ref: "tests/integration/skill-path-resolution.test.ts#SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog"
        status: pass
    human_judgment: false
  - id: D2
    description: "The resolved skill does NOT enter the parent/global catalog -- discoverAvailableSkills(runtimeCwd) excludes the generated name (invocation-private guarantee)"
    requirement: AGSK-06
    verification:
      - kind: integration
        ref: "tests/integration/skill-path-resolution.test.ts#SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog"
        status: pass
    human_judgment: false
  - id: D3
    description: "The test skips gracefully (t.skip, exit 0) when pi-subagents is not reachable, keeping npm run check green in CI where the optional peer is absent"
    requirement: AGSK-06
    verification:
      - kind: other
        ref: "PI_SUBAGENTS_ROOT=/nonexistent-path node --test tests/integration/skill-path-resolution.test.ts (exits 0, 1 skipped)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-20
status: complete
---

# Phase 84 Plan 03: SC-2 Resolver-Contract Integration Test Summary

**New `tests/integration/skill-path-resolution.test.ts` proves pi-subagents' real `resolveSkillsWithFallback` resolves the emitter's actual `skillPath` output against a staged skill, and that the skill stays invocation-private -- by copying the installed package's source out of `node_modules` before dynamically importing it, working around Node 26's `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-20T10:49:29Z (immediately after 84-02 completion)
- **Completed:** 2026-07-20T11:05:07Z
- **Tasks:** 1 completed
- **Files modified:** 1 created

## Accomplishments

- Added `tests/integration/skill-path-resolution.test.ts`, the first automated test to exercise pi-subagents' real `resolveSkillsWithFallback`/`discoverAvailableSkills` against a hermetic fixture mirroring the production `skillsTargetDir` layout, closing the SC-2 coverage gap RESEARCH.md flagged as genuinely missing.
- The test calls `emitGeneratedAgentFile` (the real emitter from Plan 84-01) to produce the agent file, then asserts the written file literally carries `skillPath: ../pi-claude-marketplace/resources/skills` before feeding that exact contract into the resolver call -- closing the loop between SC-1 (pointer emitted) and SC-2 (pointer resolves).
- Discovered and worked around a real Node 26.5 restriction not anticipated by the plan's `important_correction`: dynamic import of a `.ts` file located under any `node_modules` path segment throws `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, which blocks importing an installed npm package's internal module in place regardless of how the exports-map issue is worked around. The test now copies pi-subagents' real `src/` tree into a scratch directory outside `node_modules` before importing, verified to run pi-subagents' resolver verbatim (never reimplemented).
- Verified both branches of the graceful-skip contract directly: the test PASSES (not skipped) against the pi-subagents 0.35.1 install present in this environment, and SKIPS cleanly (exit 0) when `PI_SUBAGENTS_ROOT` is pointed at a nonexistent path, simulating CI environments without the optional peer.
- `npm run check` (typecheck, lint, format, unit tests, integration tests) is green with the new file present.

## Task Commits

Each task was committed atomically:

1. **Task 1: SC-2 resolver-contract integration test with graceful skip** - `8b0a79af` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `tests/integration/skill-path-resolution.test.ts` - New integration test. Locates the installed pi-subagents package (env override `PI_SUBAGENTS_ROOT` or `npm root -g`), copies its `src/` tree into a scratch temp dir, dynamically imports the internal `agents/skills.ts` module by `pathToFileURL`, stages a hermetic fixture (agent file via the real emitter + a real `SKILL.md` at the production layout), calls `resolveSkillsWithFallback` and `discoverAvailableSkills`, and asserts both the resolution and invocation-privacy guarantees.

## Decisions Made

- Copy the installed package's real source tree into a scratch dir outside `node_modules` rather than attempting any other workaround (see Deviations below) -- this preserves "never reimplement the resolver" (RESEARCH.md's "Don't Hand-Roll" table) while satisfying Node's type-stripping restriction.
- `PI_OFFLINE=1` is set for the duration of the resolver calls so the global-catalog assertion is not influenced by unrelated packages installed globally on the test-running machine.
- The generated skill name carries a random 8-hex-character suffix to avoid any realistic collision with real skills already present in the environment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Node 26.5 blocks dynamic import of `.ts` files under any `node_modules` path segment**

- **Found during:** Task 1 (SC-2 resolver-contract integration test)
- **Issue:** The plan's `important_correction` anticipated only the `exports` map restriction (bare-specifier subpath imports throw `ERR_PACKAGE_PATH_NOT_EXPORTED`) and prescribed importing pi-subagents' internal module by absolute file path via `pathToFileURL` instead. Implementing exactly that against the real installed location (`/opt/homebrew/lib/node_modules/pi-subagents/src/agents/skills.ts`) still failed, with a *different* error: `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` -- Node 26's native TypeScript type stripping is unconditionally disabled for any file whose resolved path contains a `node_modules` segment, with no flag to override it. Because npm always installs packages under a directory literally named `node_modules` (global or local), this affects every reachable install location, not just this machine's.
- **Fix:** Before importing, the test copies the installed package's real, unmodified `src/` tree (`cp(installedSrcDir, scratchSrcDir, { recursive: true })`) into a scratch directory under the test's own `mkdtemp` root (which lives under `os.tmpdir()`, outside any `node_modules` segment), then imports `<scratchSrcDir>/agents/skills.ts` from there via `pathToFileURL`. Verified empirically that the copied module's relative imports (`../shared/utils.ts`, transitively `./formatters.ts`, `./types.ts`, etc.) resolve correctly since the whole `src/` tree is copied together, and that only `import type` specifiers (erased at compile time) reference the package's own bare-specifier dependencies (`@earendil-works/pi-ai`, `@earendil-works/pi-coding-agent`), so no further copying of `node_modules` content is needed.
- **Files modified:** `tests/integration/skill-path-resolution.test.ts` (within the single task commit; no separate fix commit needed since this was resolved before the task's only commit).
- **Verification:** `node --test tests/integration/skill-path-resolution.test.ts` passes (not skipped) against the real pi-subagents 0.35.1 install; `PI_SUBAGENTS_ROOT=/nonexistent-path node --test tests/integration/skill-path-resolution.test.ts` skips cleanly (exit 0); `npm run check` green.
- **Committed in:** `8b0a79af` (part of the task commit -- this is new-file authoring, not a follow-up fix)

---

**Total deviations:** 1 auto-fixed (Rule 3 -- blocking issue)
**Impact on plan:** Necessary to make the plan's stated goal ("the test should actually RUN here ... not skip") achievable at all under Node 26.5's actual behavior. No scope creep -- the fix stays entirely inside the one new test file the plan specified.

## Issues Encountered

None beyond the Node type-stripping deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `tests/integration/skill-path-resolution.test.ts` is a permanent, CI-safe fixture: it runs and passes wherever pi-subagents is globally installed (as it is in this dev environment) and skips cleanly everywhere else.
- Plan 84-04 (live foreground-spawn UAT, SC-4) is unaffected by and independent of this automated coverage; no blockers carried forward.
- The copy-outside-node_modules dynamic-import pattern established here is reusable for any future optional-peer internals test in this repo.

---

*Phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent*
*Completed: 2026-07-20*
