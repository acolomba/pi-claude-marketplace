---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 03
subsystem: testing
tags: [tests, integration, pi-subagents, peer-floor]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "pi-subagents optional peer declared as >=0.74.0 in package.json (plan 01-01)"
provides:
  - "tests/integration/pi-subagents-peer.ts: findPiSubagentsPackage, readPeerFloor, isBelowPeerFloor, loadPiSubagentsModule"
  - "Both pi-subagents peer integration tests on the shared loader, proven with zero skips against pi-subagents 0.74.0"
  - "PI_SUBAGENTS_ROOT contract: an explicit override must name a pi-subagents package, or the test fails"
affects: [01-05, 01-06, 01-08, pi-subagents, peer-floor]

actuals:
  tokens: 4481
  tasks: 2
  commits: 1
plan_head_before: 27b03261d957eb634b482a8fe4fe1391f9200840
plan_head_after: 8de91d1a3c1cb29e279cb869ef4951cb31849c7b

tech-stack:
  added: []
  patterns:
    - "The pi-subagents floor is semver.minVersion of package.json peerDependencies[\"pi-subagents\"], read from import.meta.url"
    - "Optional-peer tests skip only on a failed global lookup or a below-floor version; an explicit override or a broken at-floor package fails"

key-files:
  created:
    - tests/integration/pi-subagents-peer.ts
  modified:
    - tests/integration/provenance-invisibility.test.ts
    - tests/integration/skill-path-resolution.test.ts

key-decisions:
  - "pi-subagents peer tests share tests/integration/pi-subagents-peer.ts; the floor is semver.minVersion of the declared peer range, and an explicit PI_SUBAGENTS_ROOT that names no pi-subagents package fails instead of skipping"
  - "The loader exports readPeerFloor() so both skip messages name the floor without a second constant"
  - "The package-name check applies to the global lookup too: a global pi-subagents directory holding another package fails rather than skips"

patterns-established:
  - "A later pi-subagents floor bump edits package.json alone; the integration tests follow it"

requirements-completed: [PIFL-02, PIFL-04]

coverage:
  - id: D1
    description: "Both peer integration tests pass with zero skips against pi-subagents 0.74.0 through PI_SUBAGENTS_ROOT and report the proven version as a diagnostic"
    requirement: PIFL-02
    verification:
      - kind: integration
        ref: "PI_SUBAGENTS_ROOT=/var/tmp/mcp4-subagents/node_modules/pi-subagents node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts (tmp/p03-both.log)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A bad override fails and names the path or the found package; a broken at-floor package fails; a floor prerelease skips as below the floor"
    requirement: PIFL-04
    verification:
      - kind: integration
        ref: "tmp/p03-neg-nonexistent.log, tmp/p03-neg-wrongpkg.log, tmp/p03-neg-broken.log, tmp/p03-neg-rc.log"
        status: pass
    human_judgment: false
  - id: D3
    description: "The default run, with no override, exits 0 and skips both tests with the below-floor message for the local global 0.47.1"
    requirement: PIFL-02
    verification:
      - kind: integration
        ref: "node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts (tmp/p03-default.log)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 03: pi-subagents peer floor proof Summary

**Both pi-subagents peer integration tests now share one loader,
`tests/integration/pi-subagents-peer.ts`. The loader imports the compiled
`src/agents/<module>.js` in place and takes the floor from the declared peer range through
`semver.minVersion`. Both tests pass with zero skips against pi-subagents 0.74.0. A bad
`PI_SUBAGENTS_ROOT` or a broken at-floor package fails the test instead of skipping.**

## Performance

- **Duration:** about 30 min, plus the pre-commit run
- **Started:** 2026-10-02T18:08:49Z
- **Completed:** 2026-10-02
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified; all under `tests/integration/`)
- **Node:** v26.10.0

## Accomplishments

- `tests/integration/pi-subagents-peer.ts` exports `PiSubagentsPeer`,
  `findPiSubagentsPackage()`, `readPeerFloor()`, `isBelowPeerFloor(version)` and
  `loadPiSubagentsModule<T>(peer, module)`.
  - `findPiSubagentsPackage()` throws when `PI_SUBAGENTS_ROOT` names no package.json or a
    package whose `name` is not `pi-subagents` (IN-07). Without the override, it returns
    `undefined` only when the `npm root -g` lookup fails or finds no package.json.
  - `readPeerFloor()` reads the repository package.json from `import.meta.url` and returns
    `minVersion(peerDependencies["pi-subagents"])`. It throws on a missing or unusable range
    (IN-05).
  - `isBelowPeerFloor()` uses `semver.lt`, so `0.74.0-rc.1` is below the floor (IN-06).
  - `loadPiSubagentsModule()` imports `src/agents/<module>.js` by file URL. A missing file or
    an import error rejects (`5b1d8ef6`, `dac3a245`).
- `provenance-invisibility.test.ts` and `skill-path-resolution.test.ts` use the loader (IN-04).
  Their local root resolvers, the `.ts` copy-to-scratch loaders and the scratch directory are
  gone. Every T-d8i-01 and SC-2 / AGSK-06 assertion is unchanged.
- The skill-path test looks up the peer and checks the floor before
  `createHermeticEnvironment`, because the hermetic HOME hides the npm config that sets the
  global prefix (`69e0870a`).
- The headers no longer list a closed `exports` set or name `agents.ts`, `execution.ts` or
  `0.35.1` (IN-02). The call-site comment describes pi-subagents' foreground and background
  skill resolution by behavior. The CI-gap paragraph in the provenance test is kept, because
  no workflow installs pi-subagents (`grep -rn pi-subagents .github/` is empty).

## Task Commits

The plan makes one code commit (Tasks 1 and 2 together, as the plan specifies):

1. **Tasks 1-2: shared pi-subagents peer loader and the zero-skip proof** - `8de91d1a`
   (test: `test: prove the pi-subagents peer floor without skips`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, REQUIREMENTS,
state.json).

The code commit SHA was fixed before the pre-commit run, as plan 01-01 did. The commit object
was built with `git commit-tree` and pinned author and committer dates
(`2026-10-02T18:15:00+0000`). `git commit` then used the same dates, index and message.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

The scratch install was `npm install --prefix /var/tmp/mcp4-subagents --ignore-scripts
pi-subagents@0.74.0` (`INSTALL_EXIT=0`, 5 packages). `npm view pi-subagents@0.74.0 scripts`
printed nothing. The repository package.json and lock are unchanged
(`git diff --name-only HEAD -- package.json package-lock.json` is empty).

### Proof runs

Task 1, `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-subagents/node_modules/pi-subagents node --test
tests/integration/provenance-invisibility.test.ts` (`tmp/p03-provenance.log`):

```text
✔ T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser (15.529279ms)
ℹ pi-subagents 0.74.0 at /var/tmp/mcp4-subagents/node_modules/pi-subagents
ℹ pass 1
ℹ fail 0
ℹ skipped 0
EXIT=0
```

Task 2, both tests against the same root (`tmp/p03-both.log`):

```text
✔ T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser (16.951374ms)
ℹ pi-subagents 0.74.0 at /var/tmp/mcp4-subagents/node_modules/pi-subagents
✔ SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog (131.694612ms)
ℹ pi-subagents 0.74.0 at /var/tmp/mcp4-subagents/node_modules/pi-subagents
ℹ pass 2
ℹ fail 0
ℹ skipped 0
EXIT=0
```

### Negative controls

| Control | Command | Exit | Message |
| --- | --- | --- | --- |
| Nonexistent root (IN-07) | `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-nonexistent node --test tests/integration/provenance-invisibility.test.ts` | 1 (fail 1, skipped 0) | `Error: PI_SUBAGENTS_ROOT=/var/tmp/mcp4-nonexistent holds no package.json` |
| Wrong package (IN-07) | `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-subagents/node_modules/yaml node --test tests/integration/skill-path-resolution.test.ts` | 1 (fail 1, skipped 0) | `Error: /var/tmp/mcp4-subagents/node_modules/yaml holds "yaml" "2.8.3", not pi-subagents` |
| Broken at-floor package (`dac3a245`) | copy of the 0.74.0 package with `src/agents/frontmatter.js` deleted, `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-broken node --test tests/integration/provenance-invisibility.test.ts` | 1 (fail 1, skipped 0) | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/tmp/mcp4-broken/src/agents/frontmatter.js'` |
| Floor prerelease (IN-06) | copy of the 0.74.0 package with `version` set to `0.74.0-rc.1`, `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-rc node --test tests/integration/provenance-invisibility.test.ts` | 0 (skipped 1) | `pi-subagents 0.74.0-rc.1 at /var/tmp/mcp4-rc is below the peer floor 0.74.0` |
| Default run, no override | `node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts` | 0 (pass 0, fail 0, skipped 2) | both: `pi-subagents 0.47.1 at /home/acolomba/.npm-global/lib/node_modules/pi-subagents is below the peer floor 0.74.0` |

The scratch prefix has no `semver` package, so the wrong-package control points at `yaml`,
another package in the same `node_modules`, as the plan allows. The broken and prerelease
copies were deleted after their runs.

### Other checks

- `npm run typecheck`: `TC=0`.
- `npx eslint` over the three files: `LINT=0` (after `--fix` added the blank line before the
  sibling import group). `prettier --check`: clean.
- `npx fallow dupes`: `DUPES=0`, and no clone names any of the three files.
- `rg -n "exposes only|0\.35\.1|execution\.ts" tests/integration`: no output.
- `rg -n '\.ts"\)|pi-subagents-src|cp\(installedSrcDir'
  tests/integration/provenance-invisibility.test.ts`: no output.
- Pre-commit (`TMPDIR=/var/tmp/mcp4-exec SKIP=trufflehog pre-commit run --files <three test
  paths + tracking files>`, log `tmp/p03-precommit.log`): see the self-check below.

## Files Created/Modified

- `tests/integration/pi-subagents-peer.ts` - shared peer lookup, floor check and in-place
  module loader (PIFL-02)
- `tests/integration/provenance-invisibility.test.ts` - T-d8i-01 on the shared loader;
  header restated
- `tests/integration/skill-path-resolution.test.ts` - SC-2 / AGSK-06 on the shared loader;
  peer lookup before the hermetic HOME; header and call-site comment restated

## Decisions Made

- The loader exports `readPeerFloor()`, which the plan allows, so both below-floor skip
  messages name the floor without a second constant.
- The `name === "pi-subagents"` check also applies to the `npm root -g` fallback. A global
  `pi-subagents` directory that holds another package is not a missing peer, so it fails.
- The skill-path test computes `isBelowPeerFloor` before `createHermeticEnvironment` together
  with the lookup, as the plan states. The floor read itself does not depend on HOME.

## Deviations from Plan

### Acceptance-criterion refinement

**1. [Rule 3 - Blocking criterion] `rg -n "PI_SUBAGENTS_FLOOR|localeCompare" tests/integration`
prints one line**
- **Found during:** Task 1 acceptance check
- **Issue:** The match is `tests/integration/standalone-prune.test.ts:112`, a
  `left.localeCompare(right)` sort comparator. It has nothing to do with the pi-subagents
  floor, and the file is outside this plan.
- **Fix:** No code change. Neither term appears in the three files this plan owns, and
  `PI_SUBAGENTS_FLOOR` appears nowhere under `tests/integration`.
- **Files modified:** none

### Negative-control substitution

The wrong-package control uses `/var/tmp/mcp4-subagents/node_modules/yaml`, because the
scratch prefix has no `semver`. The plan names this fallback.

**Total deviations:** 1 (acceptance-criterion refinement). **Impact:** none on the delivered
behavior.

## Issues Encountered

The state verbs left three STATE.md fields stale: `progress.completed_plans` (2),
`last_activity_desc` and the Current Position "Last activity" line (both named 01-02). These
three fields were set by hand to 3 and to this plan.

## User Setup Required

None. To re-prove the floor, install pi-subagents 0.74.0 into any prefix outside the
repository and point `PI_SUBAGENTS_ROOT` at `<prefix>/node_modules/pi-subagents`.

## Next Phase Readiness

- PIFL-02 and PIFL-04 are complete; REQUIREMENTS.md marks both.
- CI still installs no pi-subagents, so both tests skip there by design. The provenance test
  header keeps the CI-gap TODO.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: the install went to `/var/tmp/mcp4-subagents` with `--ignore-scripts`. The
  repository package.json and lock are unchanged. The prefix is deleted after the commit.
- T-01-04: an override must name a package.json whose `name` is `pi-subagents`; the
  wrong-package control proves the failure names what it found.
- T-01-05: accepted; only the two integration tests read `PI_SUBAGENTS_ROOT`.

## Self-Check: PASSED

- `tests/integration/pi-subagents-peer.ts` exists (FOUND).
- Code commit `8de91d1a` exists, and `git rev-parse HEAD` after `git commit` equals the
  pre-computed `commit-tree` SHA. It is HEAD~1 of the docs commit.
- Pre-commit over the three test files and the tracking files: `PRECOMMIT_EXIT=0`
  (`tmp/p03-precommit.log`); no hook rewrote a file. `fallow audit --gate-marker agent`:
  verdict `pass`.
- `/var/tmp/mcp4-subagents` was removed after the code commit.
