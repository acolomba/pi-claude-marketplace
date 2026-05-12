---
phase: 01-foundations-toolchain
plan: 03
subsystem: infra
tags: [scaffolding, isomorphic-git, esm, import-boundaries, readme]

# Dependency graph
requires:
  - phase: 01-foundations-toolchain
    plan: 01
    provides: ESLint flat config with import-x/no-restricted-paths zones, tsconfig with exactOptionalPropertyTypes, package.json with isomorphic-git@^1.37.6 declared, npm scripts (typecheck/lint/format:check/test)
provides:
  - 9 folders under extensions/pi-claude-marketplace/ (edge, orchestrators, bridges, domain, transaction, persistence, presentation, platform, shared)
  - 9 placeholder READMEs documenting Purpose / Allowed Imports / Planned Contents per folder
  - 7 placeholder index.ts files (export {};) for forward-reference + canary-fixture import resolution
  - platform/git.ts isomorphic-git wrapper exposing 7 functions (clone, fetch, pull, checkout, resolveRef, listBranches, listRemotes) with 7 typed option interfaces
affects: [01-04, 01-05, 01-06, 02, 03, 04, 05, 06, 07]

# Tech tracking
tech-stack:
  added: []  # All deps already declared by Plan 01-01; this plan only consumes them
  patterns:
    - "9-folder layout under extensions/pi-claude-marketplace/ (D-10) with sibling-import discipline (D-11)"
    - "Placeholder index.ts shape (`export {};`) keeps each folder a resolvable ESM module"
    - "platform/ as external-system facade boundary; isomorphic-git wrapper consolidated at platform/git.ts (D-20)"
    - "Spread-conditional optional field forwarding (`...(opts.x !== undefined && { x: opts.x })`) compatible with exactOptionalPropertyTypes: true"
    - "isomorphic-git ESM namespace import (`import * as git`) verified under module: NodeNext"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/README.md
    - extensions/pi-claude-marketplace/edge/index.ts
    - extensions/pi-claude-marketplace/orchestrators/README.md
    - extensions/pi-claude-marketplace/orchestrators/index.ts
    - extensions/pi-claude-marketplace/bridges/README.md
    - extensions/pi-claude-marketplace/bridges/index.ts
    - extensions/pi-claude-marketplace/domain/README.md
    - extensions/pi-claude-marketplace/domain/index.ts
    - extensions/pi-claude-marketplace/transaction/README.md
    - extensions/pi-claude-marketplace/transaction/index.ts
    - extensions/pi-claude-marketplace/persistence/README.md
    - extensions/pi-claude-marketplace/persistence/index.ts
    - extensions/pi-claude-marketplace/presentation/README.md
    - extensions/pi-claude-marketplace/presentation/index.ts
    - extensions/pi-claude-marketplace/platform/README.md
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/shared/README.md
  modified: []

key-decisions:
  - "Honored verbatim README bodies over an inconsistent acceptance regex (see Deviations)."
  - "platform/ folder gets only README in Task 1 commit; git.ts ships in Task 2 commit, leaving import-x boundary surface complete."

patterns-established:
  - "Folder placeholder pattern: README (Purpose / Allowed Imports / Planned Contents) + index.ts (`export {};`) per folder"
  - "platform/git.ts as the canonical git-ops surface; no other layer touches isomorphic-git directly"

requirements-completed: [NFR-1, NFR-9, NFR-10]

# Metrics
duration: 6min
completed: 2026-05-09
---

# Phase 1 Plan 3: Layout Skeleton + Git Wrapper Summary

**9-folder layered scaffold under `extensions/pi-claude-marketplace/` with placeholder READMEs documenting D-11 import-direction zones, plus the `platform/git.ts` isomorphic-git wrapper (D-18/D-19/D-20) replacing V1's `execFile("git")` shell-out.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-09T22:57:50Z
- **Completed:** 2026-05-09T23:03:29Z
- **Tasks:** 2
- **Files created:** 17 (9 READMEs + 7 index.ts placeholders + 1 git.ts)
- **Files modified:** 0

## Accomplishments

- All 9 architectural-layer folders exist with READMEs that mirror the D-11 zone matrix from `eslint.config.js`. Future phases just add files; no further scaffold work required.
- 7 placeholder `index.ts` files (every folder except `shared/`, which Plan 01-02 populates, and `platform/`, which got `git.ts` directly in Task 2) keep imports resolvable so Plan 05's canary fixtures will trip `import-x/no-restricted-paths` without also tripping `import-x/no-unresolved` (closes Pitfall #1's "rule passes vacuously" risk).
- `platform/git.ts` exposes 7 functions (`clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches`, `listRemotes`) with 7 typed option interfaces (`CloneOptions`, `FetchOptions`, `PullOptions`, `CheckoutOptions`, `ResolveRefOptions`, `ListBranchesOptions`, `ListRemotesOptions`). Pins `fs` (Node built-in) and `http` (`isomorphic-git/http/node`) so Phase 4's marketplace orchestrators don't thread transports through every call.
- `npm run typecheck`, `npm run lint`, `npm run format:check` all green; `npm test` clean (0 tests, expected -- Plan 06 adds tests).
- Runtime smoke: dynamic import of `platform/git.ts` resolves and exposes all 7 named function exports.
- Eliminates the `git not found on PATH` failure mode (D-21 will then mark MA-7 superseded in REQUIREMENTS.md -- that edit is Plan 04's surface).

## Task Commits

1. **Task 1: Scaffold 9 folders with placeholder READMEs (D-12)** - `90fbaaa` (docs)
2. **Task 2: Create platform/git.ts wrapper around isomorphic-git (D-18, D-19, D-20)** - `1c1133f` (feat)

## Files Created/Modified

### Created

- `extensions/pi-claude-marketplace/edge/README.md` - edge/ purpose, allowed imports (orchestrators/, presentation/, shared/), Phase 6 planned contents
- `extensions/pi-claude-marketplace/edge/index.ts` - placeholder `export {};` so the canary fixture can import without resolution failure
- `extensions/pi-claude-marketplace/orchestrators/README.md` - orchestrators/ purpose, allowed imports (bridges/, domain/, transaction/, persistence/, presentation/, platform/, shared/), Phase 4-5 planned contents
- `extensions/pi-claude-marketplace/orchestrators/index.ts` - placeholder
- `extensions/pi-claude-marketplace/bridges/README.md` - bridges/ purpose, allowed imports (domain/, persistence/, shared/) + cross-bridge prohibition, Phase 3 planned contents
- `extensions/pi-claude-marketplace/bridges/index.ts` - placeholder (canary fixture target)
- `extensions/pi-claude-marketplace/domain/README.md` - domain/ pure-logic discipline (`MUST NOT import upward`), shared/ as only sibling, Phase 2-3 planned contents, note about Scope type moving to shared/types.ts
- `extensions/pi-claude-marketplace/domain/index.ts` - placeholder
- `extensions/pi-claude-marketplace/transaction/README.md` - transaction/ purpose, allowed imports (persistence/, shared/), Phase 2 planned contents
- `extensions/pi-claude-marketplace/transaction/index.ts` - placeholder
- `extensions/pi-claude-marketplace/persistence/README.md` - persistence/ purpose, allowed imports (domain/, shared/), Phase 2 planned contents, note about IL-3 sanctioned `console.warn` site
- `extensions/pi-claude-marketplace/persistence/index.ts` - placeholder
- `extensions/pi-claude-marketplace/presentation/README.md` - presentation/ purpose, allowed imports (domain/, shared/), Phase 4-6 planned contents, note about MARKERS consumption
- `extensions/pi-claude-marketplace/presentation/index.ts` - placeholder
- `extensions/pi-claude-marketplace/platform/README.md` - platform/ purpose, allowed imports (shared/ only), Phase 1 git.ts marked `[x]`, Phase 7 pi-api.ts planned
- `extensions/pi-claude-marketplace/platform/git.ts` - 7-function isomorphic-git wrapper (154 lines) with 7 typed option interfaces; namespace import shape; spread-conditional optional handling
- `extensions/pi-claude-marketplace/shared/README.md` - shared/ pure-leaves discipline (`MUST NOT import from any other extension folder`), Plan 01-02 markers/errors/notify/atomic-json/path-safety marked `[x]`, Phase 2 types.ts (`Scope`) planned

## Decisions Made

- **Honored verbatim README bodies over an inconsistent acceptance regex.** The plan's verbatim README bodies for `domain/` and `shared/` deliberately use "MUST NOT import upward" / "MUST NOT import from any other extension folder" (since these folders forbid imports -- they are the strictest-zone sinks). The plan's acceptance criterion `grep -l "may import from" ... | wc -l` outputs `9` is mutually exclusive with those bodies. Verbatim bodies are the explicit, dominant artifact spec; the regex was a planning bug. The "all 9 have 3 required sections" check (the authoritative shape gate) passes. Documented under Deviations below.
- **Smoke-test relocation.** The plan's verification embedded a `mktemp` smoke script that wrote to `/tmp` and used a relative import; under Node 26's strict ESM resolver this fails because the relative path resolves against `/tmp`, not the worktree. Moved the smoke script into the worktree root and ran `node ./.git-smoke.mjs` from there. Result: all 7 exports verified as functions. No code change to `git.ts`; only the test harness path. Documented under Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance criterion `grep -l "may import from" | wc -l` expects 9, conflicts with verbatim README bodies that mandate `MUST NOT import upward` (domain/) and `MUST NOT import from any other extension folder` (shared/)**

- **Found during:** Task 1 verification
- **Issue:** The plan's verbatim README bodies for `domain/` and `shared/` (the strictest-import-zone sinks) deliberately do not contain the phrase "may import from" -- they describe what those folders cannot do. The numeric acceptance criterion is mutually exclusive with the verbatim bodies. Cannot satisfy both simultaneously.
- **Fix:** Followed the verbatim README bodies (the explicit, dominant artifact spec). The "all 9 have 3 required sections" shape gate passes; only the `wc -l` numeric expectation is off. The 7 folders that DO permit some sibling imports (edge, orchestrators, bridges, transaction, persistence, presentation, platform) all contain "may import from" verbatim. The 2 that forbid imports (domain, shared) use the stricter "MUST NOT" phrasing per their plan-mandated bodies.
- **Files modified:** None (followed plan verbatim bodies; no code or content change)
- **Verification:** `grep -c '## Allowed Imports' extensions/pi-claude-marketplace/*/README.md | wc -l` → 9 (all 9 READMEs have the section). The semantic intent ("each README documents its allowed-imports zone") is satisfied. `import-x/no-restricted-paths` in `eslint.config.js` is the actual enforcement; the README phrasing is documentation.
- **Committed in:** Task 1 commit `90fbaaa`

**2. [Rule 3 - Blocking] Plan's smoke test `mktemp` placement caused ERR_MODULE_NOT_FOUND**

- **Found during:** Task 2 verification
- **Issue:** Plan's smoke harness writes a `.mjs` file via `mktemp -t` (which lands in `/tmp`) and uses `await import("./extensions/pi-claude-marketplace/platform/git.ts")` -- the relative specifier resolves against the script's directory (`/tmp`), not the project root. Node 26's strict ESM resolver fails with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Wrote the smoke script into the worktree root (`./.git-smoke.mjs`), ran it from there, deleted afterward. No change to `platform/git.ts` itself; only the test harness location.
- **Files modified:** None permanent (smoke file deleted post-run)
- **Verification:** Smoke test exits 0 with output `OK -- all 7 exports present and functions`. All 7 declared exports (`clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches`, `listRemotes`) are `typeof === "function"`.
- **Committed in:** N/A (test infra only, not committed)

**3. [Rule 1 - Bug] Plan's grep acceptance regex with `^...$` anchors omits the trailing semicolon**

- **Found during:** Task 2 verification
- **Issue:** Plan acceptance asserts e.g. `grep '^import \* as git from "isomorphic-git"$' extensions/pi-claude-marketplace/platform/git.ts` returns 1 line. The actual line ends with `;` (TypeScript convention; Prettier preserves), so the anchored regex returns 0 lines.
- **Fix:** Verified semantic intent via fixed-string match (`grep -F 'import * as git from "isomorphic-git"' git.ts`) -- all 3 import shapes confirmed present. The trailing semicolon is unambiguously correct TS; the planning regex omitted it.
- **Files modified:** None (planning regex was off-by-one; actual code is correct)
- **Verification:** `grep -F 'import * as git from "isomorphic-git"' extensions/pi-claude-marketplace/platform/git.ts` returns 1 line. Same for `import http from "isomorphic-git/http/node"` and `import * as fs from "node:fs"`. `npm run typecheck` and `npm run lint` exit 0, confirming the import shapes parse correctly.
- **Committed in:** Task 2 commit `1c1133f`

---

**Total deviations:** 3 documentation/test-harness inconsistencies in the plan. **No source-code deviations from the verbatim plan bodies.** **Impact on plan:** Zero. All artifacts ship per spec; only acceptance-regex / harness-path details were corrected.

## Issues Encountered

- `node_modules/` was missing in this worktree at start (worktrees are fresh checkouts). Ran `npm install --no-audit --no-fund` once before verification. Installed cleanly with 5 deprecation warnings (all upstream `@mariozechner/*` package-rename notices unrelated to this plan).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 04 (REQUIREMENTS.md edits)** can proceed: D-21's MA-7 supersession note has a concrete reason (the V1 `git not found on PATH` failure mode is now mechanically impossible because no `git` binary is invoked).
- **Plan 05 (boundary canary tests)** can proceed: 7 placeholder `index.ts` files exist for canary fixture imports; `bridges/index.ts` (the canary target) is in place. `eslint.config.js` already enforces the import-direction zones; the canary just exercises a known-bad import.
- **Plan 06 (smoke import test)** can proceed: `platform/git.ts` resolves and the 7 exports are callable.
- **Phase 2 (primitives)** can populate `domain/` and `shared/` without touching this plan's surface; the README "Planned Contents" lists are forward-only.
- **Phase 4 (marketplace orchestrators)** can import from `platform/git.ts` directly with no further wrapper work. The `pull` author-field requirement (isomorphic-git mandates it for merge commits) is documented in the wrapper's `PullOptions` interface; Phase 4's planner needs to wire a sensible default (e.g., `{ name: "pi-claude-marketplace", email: "pi-claude-marketplace@local" }`).

## Self-Check: PASSED

All 17 created files exist on disk:

- 9 README files: edge, orchestrators, bridges, domain, transaction, persistence, presentation, platform, shared
- 7 index.ts placeholders: edge, orchestrators, bridges, domain, transaction, persistence, presentation
- 1 platform/git.ts

Both commits exist in the worktree branch:

- `90fbaaa docs(01-03): scaffold 9-folder layout with placeholder READMEs`
- `1c1133f feat(01-03): add platform/git.ts isomorphic-git wrapper`

All verification gates green:

- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run format:check` exits 0
- `npm test` exits 0 (0 tests, expected -- Plan 06 lands tests)
- Runtime smoke: 7 exports verified as functions

---

*Phase: 01-foundations-toolchain*
*Plan: 03*
*Completed: 2026-05-09*
