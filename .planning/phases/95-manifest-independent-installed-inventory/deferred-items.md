# Deferred items — Phase 95

Out-of-scope discoveries logged during execution. Not fixed here (SCOPE
BOUNDARY: only issues directly caused by this phase's changes are auto-fixed).

## Two pi-subagents integration tests fail on a stale GLOBAL peer

**Found during:** Plan 95-01 Task 3 (`npm run check`)

**Symptom:** `npm run test:integration` reports 16/18 passing. The two failures
are:

- `tests/integration/provenance-invisibility.test.ts`
- `tests/integration/skill-path-resolution.test.ts:124` — "resolveSkillsWithFallback
  must resolve the generated skill by name via the emitted skillPath"

**Cause:** both suites locate pi-subagents through `npm root -g` rather than the
project tree. The globally installed version is **0.24.3**, while `package.json`
declares the peer as `>=0.35.0`. The tests therefore exercise an API that the
stale global package does not provide.

**Why it is not this phase's regression:** neither file references `list.ts`,
`listPlugins`, or any symbol this plan touched (`grep -c` returns 0 for both).
The failing code path is skill staging and agent-index resolution. The unit
suite is fully green (3264 passing, 0 failing), as are all five suites named in
this plan's task verifications.

**Resolution:** environment, not code — update the global install
(`npm i -g pi-subagents@latest`) or set the suites' documented env override. In
CI the peer is absent and both tests skip, so this does not gate the branch.
