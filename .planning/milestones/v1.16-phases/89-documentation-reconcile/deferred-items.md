# Phase 89 — Deferred Items (out of scope for the current plan)

## Pre-existing, environmental integration-test failures (not caused by phase 89)

**Discovered during:** 89-01 full `npm run check` green-bar confirmation.

**Test file:** `tests/integration/skill-path-resolution.test.ts` — 2 failing subtests
(`resolveSkillsWithFallback must resolve the generated skill by name via the emitted
skillPath`).

**Root cause:** these subtests resolve the `pi-subagents` peer from the global npm
install (`resolveSkillsWithFallback`). The globally installed
`@earendil-works/pi-coding-agent` is `0.80.10` (drifted); the tests are skipped in CI
(peer absent there) and fail LOCALLY on a stale/mismatched global version. This is a
known environmental condition, not a branch regression.

**Why out of scope for 89-01:** this is a docs-only plan. The two commits touched only
markdown (`docs/output-catalog.md` 1 line; `docs/research/issue-103-stop-stopfailure-promotion.md`
6 lines). Neither doc is read by the skill-path-resolution test — there is no causal path
from a markdown prose edit to skill resolution. Per the executor SCOPE BOUNDARY rule,
pre-existing failures in unrelated files are logged here and not fixed.

**Plan-relevant gate status:** the three `output-catalog.md`-coupled tests
(`catalog-uat`, `hooks-cap-notify`, `partial-vocabulary-guard`) plus `typecheck`, `lint`,
and `format:check` all passed. The docs edits are byte-safe.
